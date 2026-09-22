import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// End-to-end run of the money-back refund flow (core/moneyBackServer.ts)
// against a real SQLite file and a scripted fake Stripe. The pure rules live in
// tests/moneyBackGuarantee.test.ts; this covers what only the I/O can get
// wrong: the order of refund → cancel → local clear, the ledger that enforces
// one refund per customer, resuming a request that died part-way without ever
// refunding twice, and leaving the member untouched when nothing moved.

const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-moneyback-')), 'auth.db');
process.env.AUTH_DB_PATH = dbPath;
// core/stripe.ts builds its price table at module load.
process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
process.env.STRIPE_PRICE_PRO_QUARTERLY = 'price_pro_quarterly';
delete process.env.BILLING_TRIAL_PLANS;
delete process.env.REFUND_ALERT_EMAIL;
delete process.env.CANCELLATION_ALERT_EMAIL;
delete process.env.SIGNUP_ALARM_EMAIL;
delete process.env.FOH_REMINDER_EMAIL;

const { getDb } = await import('../core/db.ts');
const { getMoneyBackStatus, requestMoneyBackRefund } = await import('../core/moneyBackServer.ts');

const db = getDb();
const DAY = 86_400;
const NOW_MS = Date.UTC(2026, 9, 10, 15, 0, 0);
const nowUnix = Math.floor(NOW_MS / 1000);

type FakeInvoice = {
  id: string;
  status: string;
  billing_reason: string;
  amount_paid: number;
  created: number;
  status_transitions: { paid_at: number };
  currency: string;
  charge: string | null;
  payment_intent: string | null;
  lines: { data: Array<{ price: { id: string } }> };
};

type FakeCharge = {
  id: string;
  amount: number;
  amount_refunded: number;
  payment_method_details: { card: { fingerprint: string; brand: string; last4: string } };
};

// Just enough of the Stripe surface the flow touches, with switches to make
// each call fail on demand.
class FakeStripe {
  subs = new Map<string, { id: string; status: string; trial_end: number | null; metadata: Record<string, string>; customer: string }>();
  invoiceBySub = new Map<string, FakeInvoice[]>();
  chargeById = new Map<string, FakeCharge>();
  refundKeys = new Map<string, { id: string }>();
  refundCalls = 0;
  cancelCalls = 0;
  failRefunds = false;
  cancelFailuresLeft = 0;

  subscriptions = {
    retrieve: async (id: string) => {
      const sub = this.subs.get(id);
      if (!sub) throw Object.assign(new Error(`No such subscription: ${id}`), { code: 'resource_missing' });
      return structuredClone(sub);
    },
    cancel: async (id: string) => {
      this.cancelCalls += 1;
      if (this.cancelFailuresLeft > 0) {
        this.cancelFailuresLeft -= 1;
        throw new Error('Stripe is having a moment');
      }
      const sub = this.subs.get(id);
      if (!sub) throw Object.assign(new Error('gone'), { code: 'resource_missing' });
      sub.status = 'canceled';
      return structuredClone(sub);
    },
  };

  invoices = {
    list: async (params: { subscription: string }) => ({
      data: (this.invoiceBySub.get(params.subscription) ?? []).map((inv) => ({
        ...structuredClone(inv),
        // Expanded, as the flow asks for.
        charge: inv.charge ? structuredClone(this.chargeById.get(inv.charge) ?? null) : null,
      })),
    }),
  };

  charges = {
    retrieve: async (id: string) => structuredClone(this.chargeById.get(id)),
  };

  paymentIntents = {
    retrieve: async () => {
      throw new Error('not used in these scenarios');
    },
  };

  refunds = {
    create: async (params: { charge?: string; amount: number }, opts: { idempotencyKey: string }) => {
      this.refundCalls += 1;
      const seen = this.refundKeys.get(opts.idempotencyKey);
      if (seen) return seen;
      if (this.failRefunds) throw new Error('card_declined? no — refunds are down');
      const charge = this.chargeById.get(params.charge as string);
      if (!charge) throw new Error('no such charge');
      charge.amount_refunded += params.amount;
      const refund = { id: `re_${this.refundKeys.size + 1}` };
      this.refundKeys.set(opts.idempotencyKey, refund);
      return refund;
    },
  };
}

function seedUser(id: string, email: string, over: Record<string, unknown> = {}) {
  const row = {
    id,
    email,
    tier: 'pro',
    stripe_customer_id: `cus_${id}`,
    stripe_subscription_id: `sub_${id}`,
    stripe_price_id: 'price_pro_monthly',
    subscription_status: 'active',
    ...over,
  };
  db.prepare(
    `INSERT INTO users (id, email, tier, created_at, updated_at, stripe_customer_id, stripe_subscription_id,
                        stripe_price_id, subscription_status)
     VALUES (?, ?, ?, '2026-01-01', '2026-01-01', ?, ?, ?, ?)`,
  ).run(row.id, row.email, row.tier, row.stripe_customer_id, row.stripe_subscription_id, row.stripe_price_id, row.subscription_status);
}

function seedPaidSub(
  stripe: FakeStripe,
  userId: string,
  opts: { price?: string; amount?: number; paidAgoDays?: number; fingerprint?: string; stamped?: boolean } = {},
) {
  const subId = `sub_${userId}`;
  const chargeId = `ch_${userId}`;
  const paidAt = nowUnix - (opts.paidAgoDays ?? 2) * DAY;
  stripe.subs.set(subId, {
    id: subId,
    status: 'active',
    trial_end: null,
    metadata: opts.stamped === false ? {} : { money_back: '1' },
    customer: `cus_${userId}`,
  });
  stripe.chargeById.set(chargeId, {
    id: chargeId,
    amount: opts.amount ?? 4900,
    amount_refunded: 0,
    payment_method_details: { card: { fingerprint: opts.fingerprint ?? `fp_${userId}`, brand: 'visa', last4: '4242' } },
  });
  stripe.invoiceBySub.set(subId, [
    {
      id: `in_${userId}`,
      status: 'paid',
      billing_reason: 'subscription_create',
      amount_paid: opts.amount ?? 4900,
      created: paidAt,
      status_transitions: { paid_at: paidAt },
      currency: 'usd',
      charge: chargeId,
      payment_intent: `pi_${userId}`,
      lines: { data: [{ price: { id: opts.price ?? 'price_pro_monthly' } }] },
    },
  ]);
}

function userRow(id: string) {
  return db.prepare('SELECT tier, stripe_subscription_id, subscription_status, subscription_lapsed FROM users WHERE id = ?').get(id) as {
    tier: string;
    stripe_subscription_id: string | null;
    subscription_status: string | null;
    subscription_lapsed: number;
  };
}

function ledgerRow(subId: string) {
  return db.prepare('SELECT * FROM money_back_refunds WHERE subscription_id = ?').get(subId) as
    | { status: string; amount_refunded: number; card_fingerprint: string | null; refund_ids: string; email_canonical: string }
    | undefined;
}

const deps = (stripe: FakeStripe) => ({ stripe: stripe as unknown as import('stripe').default });

test('a covered member inside the window: refunded in full, canceled, access ended, recorded', async () => {
  const stripe = new FakeStripe();
  seedUser('a1', 'alice@example.com');
  seedPaidSub(stripe, 'a1');

  const status = await getMoneyBackStatus('a1', NOW_MS, deps(stripe));
  assert.equal(status.state, 'eligible');
  if (status.state === 'eligible') {
    assert.equal(status.amountFormatted, '$49.00');
    assert.equal(status.planLabel, 'Pro (monthly)');
    assert.equal(status.deadlineIso, new Date((nowUnix + 5 * DAY) * 1000).toISOString());
  }

  const result = await requestMoneyBackRefund({ userId: 'a1', source: 'self_serve', feedback: 'too_expensive', nowMs: NOW_MS }, deps(stripe));
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.amountRefunded, 4900);
  assert.equal(result.canceled, true);
  assert.deepEqual(result.problems, []);
  assert.equal(stripe.chargeById.get('ch_a1')?.amount_refunded, 4900);
  assert.equal(stripe.subs.get('sub_a1')?.status, 'canceled');

  const user = userRow('a1');
  assert.equal(user.tier, 'public');
  assert.equal(user.stripe_subscription_id, null);
  assert.equal(user.subscription_lapsed, 1);

  const ledger = ledgerRow('sub_a1');
  assert.equal(ledger?.status, 'completed');
  assert.equal(ledger?.amount_refunded, 4900);
  assert.equal(ledger?.card_fingerprint, 'fp_a1');

  // Asking again is refused, not refunded twice.
  const again = await requestMoneyBackRefund({ userId: 'a1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(again.ok, false);
  assert.equal(stripe.refundCalls, 1);
});

test('one refund per customer: same account, same inbox (+alias / Gmail dots), or same card', async () => {
  const stripe = new FakeStripe();
  seedUser('b1', 'Bob.Trader@gmail.com');
  seedPaidSub(stripe, 'b1', { fingerprint: 'fp_shared' });
  assert.equal((await requestMoneyBackRefund({ userId: 'b1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe))).ok, true);

  // A second account on a +alias of the same Gmail inbox.
  seedUser('b2', 'bobtrader+again@gmail.com');
  seedPaidSub(stripe, 'b2');
  const alias = await requestMoneyBackRefund({ userId: 'b2', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(alias.ok ? null : alias.reason, 'prior_refund');

  // A third account, unrelated email, but paying with the same card.
  seedUser('b3', 'someone.else@example.com');
  seedPaidSub(stripe, 'b3', { fingerprint: 'fp_shared' });
  const sameCard = await requestMoneyBackRefund({ userId: 'b3', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(sameCard.ok ? null : sameCard.reason, 'prior_refund');

  // Neither was charged back, canceled, or downgraded.
  assert.equal(stripe.chargeById.get('ch_b2')?.amount_refunded, 0);
  assert.equal(stripe.subs.get('sub_b3')?.status, 'active');
  assert.equal(userRow('b3').tier, 'pro');

  // The Account page tells them so rather than offering a button that fails.
  const status = await getMoneyBackStatus('b3', NOW_MS, deps(stripe));
  assert.deepEqual(status.state === 'ineligible' ? status.reason : status.state, 'prior_refund');
});

test('outside the window, or on the trial plan, nothing happens', async () => {
  const stripe = new FakeStripe();
  seedUser('c1', 'late@example.com');
  seedPaidSub(stripe, 'c1', { paidAgoDays: 8 });
  const late = await requestMoneyBackRefund({ userId: 'c1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(late.ok ? null : late.reason, 'window_elapsed');

  // Basic monthly, returning member, no stamp: the trial plan carries no guarantee.
  seedUser('c2', 'basic@example.com', { tier: 'basic', stripe_price_id: 'price_basic_monthly' });
  seedPaidSub(stripe, 'c2', { price: 'price_basic_monthly', amount: 3900, stamped: false });
  const basic = await requestMoneyBackRefund({ userId: 'c2', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(basic.ok ? null : basic.reason, 'not_covered');

  assert.equal(stripe.refundCalls, 0);
  assert.equal(stripe.cancelCalls, 0);
  assert.equal(userRow('c1').tier, 'pro');
});

test('a trialing member is answered locally without touching Stripe', async () => {
  const stripe = new FakeStripe();
  seedUser('d1', 'trial@example.com', { tier: 'basic', subscription_status: 'trialing' });
  const status = await getMoneyBackStatus('d1', NOW_MS, deps(stripe));
  assert.deepEqual(status, { state: 'ineligible', reason: 'no_payment', deadlineIso: null });
});

test('a refund that fails moves nothing, keeps the member whole, and can simply be retried', async () => {
  const stripe = new FakeStripe();
  seedUser('e1', 'retry@example.com');
  seedPaidSub(stripe, 'e1');
  stripe.failRefunds = true;

  const first = await requestMoneyBackRefund({ userId: 'e1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(first.ok ? null : first.reason, 'refund_failed');
  assert.equal(stripe.cancelCalls, 0);
  assert.equal(userRow('e1').tier, 'pro');
  assert.equal(ledgerRow('sub_e1')?.status, 'failed');
  // A failed request is not "the one refund" — no money moved.
  const status = await getMoneyBackStatus('e1', NOW_MS, deps(stripe));
  assert.equal(status.state, 'unfinished');

  stripe.failRefunds = false;
  const second = await requestMoneyBackRefund({ userId: 'e1', source: 'self_serve', nowMs: NOW_MS + 60_000 }, deps(stripe));
  assert.equal(second.ok, true);
  assert.equal(ledgerRow('sub_e1')?.status, 'completed');
  assert.equal(stripe.chargeById.get('ch_e1')?.amount_refunded, 4900);
});

test('a cancel that fails after the refund: access ends now, the request resumes, and nothing is refunded twice', async () => {
  const stripe = new FakeStripe();
  seedUser('f1', 'cancelfail@example.com');
  seedPaidSub(stripe, 'f1');
  stripe.cancelFailuresLeft = 2; // both attempts inside the first run fail

  const first = await requestMoneyBackRefund({ userId: 'f1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.canceled, false);
    assert.ok(first.problems.some((p) => /would not cancel/.test(p)));
  }
  // Money back, access gone, but the subscription stays on the row so a re-run
  // can find and finish it.
  assert.equal(stripe.chargeById.get('ch_f1')?.amount_refunded, 4900);
  assert.equal(userRow('f1').tier, 'public');
  assert.equal(userRow('f1').stripe_subscription_id, 'sub_f1');
  assert.equal(ledgerRow('sub_f1')?.status, 'pending');

  // Resumed after the in-flight guard (and even after the window closed).
  const refundsBefore = stripe.refundCalls;
  const resumed = await requestMoneyBackRefund(
    { userId: 'f1', source: 'operator', nowMs: NOW_MS + 9 * DAY * 1000 },
    deps(stripe),
  );
  assert.equal(resumed.ok, true);
  if (resumed.ok) {
    assert.equal(resumed.canceled, true);
    assert.equal(resumed.amountRefunded, 4900);
  }
  assert.equal(stripe.refundCalls, refundsBefore, 'the resume must not attempt another refund');
  assert.equal(stripe.subs.get('sub_f1')?.status, 'canceled');
  assert.equal(userRow('f1').stripe_subscription_id, null);
  assert.equal(ledgerRow('sub_f1')?.status, 'completed');
});

test('a double click is refused while the first request is still in flight', async () => {
  const stripe = new FakeStripe();
  seedUser('g1', 'double@example.com');
  seedPaidSub(stripe, 'g1');
  // Simulate the first request having just claimed the row.
  db.prepare(
    `INSERT INTO money_back_refunds (id, subscription_id, user_id, email, email_canonical, status, source, requested_at, updated_at)
     VALUES ('mbr_g1', 'sub_g1', 'g1', 'double@example.com', 'double@example.com', 'pending', 'self_serve', ?, ?)`,
  ).run(new Date(NOW_MS).toISOString(), new Date(NOW_MS).toISOString());
  const second = await requestMoneyBackRefund({ userId: 'g1', source: 'self_serve', nowMs: NOW_MS + 5_000 }, deps(stripe));
  assert.equal(second.ok ? null : second.reason, 'in_progress');
  assert.equal(stripe.refundCalls, 0);
});

test('the ledger survives the account being deleted, so the limit does too', async () => {
  const stripe = new FakeStripe();
  seedUser('h1', 'leaver@example.com');
  seedPaidSub(stripe, 'h1', { fingerprint: 'fp_leaver' });
  assert.equal((await requestMoneyBackRefund({ userId: 'h1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe))).ok, true);
  db.prepare("UPDATE users SET deleted_at = '2026-10-11', email = 'deleted-h1@invalid' WHERE id = 'h1'").run();

  seedUser('h2', 'LEAVER@example.com'.toLowerCase().replace('leaver', 'leaver+new'));
  seedPaidSub(stripe, 'h2');
  const back = await requestMoneyBackRefund({ userId: 'h2', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(back.ok ? null : back.reason, 'prior_refund');
});

test('operator --force honors a goodwill refund outside the window', async () => {
  const stripe = new FakeStripe();
  seedUser('i1', 'goodwill@example.com');
  seedPaidSub(stripe, 'i1', { paidAgoDays: 20 });
  const refused = await requestMoneyBackRefund({ userId: 'i1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(refused.ok ? null : refused.reason, 'window_elapsed');
  const forced = await requestMoneyBackRefund(
    { userId: 'i1', source: 'operator', overrideLimits: true, nowMs: NOW_MS },
    deps(stripe),
  );
  assert.equal(forced.ok, true);
});
