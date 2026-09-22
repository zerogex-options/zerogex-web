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
const { getMoneyBackStatus, requestMoneyBackRefund, sweepStalledMoneyBackRequests } = await import('../core/moneyBackServer.ts');

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

// ---------------------------------------------------------------------------
// Failure modes a real Stripe produces and the simple fake above does not.
// ---------------------------------------------------------------------------

type RefundMode = 'ok' | 'reject' | 'dispute' | 'timeout_applied' | 'timeout_not_applied';

// Stripe's actual idempotency: a key's first outcome — success OR error — is
// stored and replayed for 24h. And the failures come typed, as the SDK throws them.
class RealisticStripe extends FakeStripe {
  refundMode: RefundMode = 'ok';
  // Per-invoice override, for a partial failure.
  refundModeByCharge = new Map<string, RefundMode>();
  storedOutcomes = new Map<string, { ok: true; value: { id: string } } | { ok: false; error: Error }>();
  keysSeen: string[] = [];
  listCallsLeft = Infinity;

  constructor() {
    super();
    const baseList = this.invoices.list;
    this.invoices = {
      list: async (params: { subscription: string }) => {
        if (this.listCallsLeft <= 0) throw Object.assign(new Error('read timeout'), { type: 'StripeConnectionError' });
        this.listCallsLeft -= 1;
        return baseList(params);
      },
    };
    this.refunds = {
      create: async (params: { charge?: string; amount: number }, opts: { idempotencyKey: string }) => {
        this.refundCalls += 1;
        this.keysSeen.push(opts.idempotencyKey);
        const stored = this.storedOutcomes.get(opts.idempotencyKey);
        if (stored) {
          if (stored.ok) return stored.value;
          throw stored.error;
        }
        const charge = this.chargeById.get(params.charge as string);
        if (!charge) throw Object.assign(new Error('No such charge'), { type: 'StripeInvalidRequestError' });
        const mode = this.refundModeByCharge.get(charge.id) ?? this.refundMode;
        let error: Error | null = null;
        if (mode === 'reject') error = Object.assign(new Error('Refunds are unavailable'), { type: 'StripeInvalidRequestError' });
        if (mode === 'dispute') {
          error = Object.assign(new Error('Charge is disputed'), { type: 'StripeInvalidRequestError', code: 'charge_disputed' });
        }
        if (mode === 'timeout_applied') {
          charge.amount_refunded += params.amount;
          error = Object.assign(new Error('Request timed out'), { type: 'StripeConnectionError' });
        }
        if (mode === 'timeout_not_applied') error = Object.assign(new Error('Request timed out'), { type: 'StripeConnectionError' });
        if (error) {
          // Only answered requests are stored; a connection drop never reached Stripe's idempotency layer.
          if (mode === 'reject' || mode === 'dispute') this.storedOutcomes.set(opts.idempotencyKey, { ok: false, error });
          throw error;
        }
        charge.amount_refunded += params.amount;
        const refund = { id: `re_${this.storedOutcomes.size + 1}_${charge.id}` };
        this.storedOutcomes.set(opts.idempotencyKey, { ok: true, value: refund });
        return refund;
      },
    };
  }
}

function auditCount(userId: string, type: string): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM audit_events WHERE user_id = ? AND type = ?').get(userId, type) as { n: number }).n;
}

test('a refund that timed out but went through is seen as done: canceled, completed, not re-refunded', async () => {
  const stripe = new RealisticStripe();
  seedUser('j1', 'timeout@example.com');
  seedPaidSub(stripe, 'j1');
  stripe.refundMode = 'timeout_applied';
  const result = await requestMoneyBackRefund({ userId: 'j1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.complete, true);
    assert.equal(result.amountRefunded, 4900);
  }
  assert.equal(stripe.chargeById.get('ch_j1')?.amount_refunded, 4900);
  assert.equal(stripe.subs.get('sub_j1')?.status, 'canceled');
  assert.equal(ledgerRow('sub_j1')?.status, 'completed');
});

test('an outcome that stays unknown holds the request pending — never "failed", never canceled', async () => {
  const stripe = new RealisticStripe();
  seedUser('k1', 'unknown@example.com');
  seedPaidSub(stripe, 'k1', { fingerprint: 'fp_k' });
  stripe.refundMode = 'timeout_applied';
  stripe.listCallsLeft = 1; // the decision's read works; the re-read after the timeout does not
  const result = await requestMoneyBackRefund({ userId: 'k1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(result.ok ? null : result.reason, 'refund_unconfirmed');
  assert.equal(stripe.cancelCalls, 0, 'nothing is canceled while nobody knows whether the money moved');
  assert.equal(userRow('k1').tier, 'pro');
  assert.equal(ledgerRow('sub_k1')?.status, 'pending');
  // Pending still counts toward the one-refund limit (the money may be back).
  seedUser('k2', 'other@example.com');
  seedPaidSub(stripe, 'k2', { fingerprint: 'fp_k' });
  stripe.listCallsLeft = Infinity;
  stripe.refundMode = 'ok';
  const other = await requestMoneyBackRefund({ userId: 'k2', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(other.ok ? null : other.reason, 'prior_refund');
  // Once the in-flight window passes, re-running finds the money already back and finishes.
  const resumed = await requestMoneyBackRefund({ userId: 'k1', source: 'operator', nowMs: NOW_MS + 5 * 60_000 }, deps(stripe));
  assert.equal(resumed.ok, true);
  if (resumed.ok) assert.equal(resumed.complete, true);
  assert.equal(stripe.chargeById.get('ch_k1')?.amount_refunded, 4900);
  assert.equal(stripe.subs.get('sub_k1')?.status, 'canceled');
});

test('a retry after a refused refund uses a fresh idempotency key, so Stripe does not replay the error', async () => {
  const stripe = new RealisticStripe();
  seedUser('l1', 'rejected@example.com');
  seedPaidSub(stripe, 'l1');
  stripe.refundMode = 'reject';
  const first = await requestMoneyBackRefund({ userId: 'l1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(first.ok ? null : first.reason, 'refund_failed');
  assert.equal(ledgerRow('sub_l1')?.status, 'failed');
  stripe.refundMode = 'ok';
  const second = await requestMoneyBackRefund({ userId: 'l1', source: 'self_serve', nowMs: NOW_MS + 60_000 }, deps(stripe));
  assert.equal(second.ok, true);
  assert.notEqual(stripe.keysSeen[0], stripe.keysSeen[1]);
  assert.equal(stripe.chargeById.get('ch_l1')?.amount_refunded, 4900);
});

test('a disputed charge is refused plainly, and retrying does not re-alert the operator', async () => {
  const stripe = new RealisticStripe();
  seedUser('m1', 'disputed@example.com');
  seedPaidSub(stripe, 'm1');
  stripe.refundMode = 'dispute';
  const first = await requestMoneyBackRefund({ userId: 'm1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(first.ok ? null : first.reason, 'refund_disputed');
  assert.equal(stripe.cancelCalls, 0);
  const alertsAfterFirst = auditCount('m1', 'money_back_operator_alert_skipped');
  const again = await requestMoneyBackRefund({ userId: 'm1', source: 'self_serve', nowMs: NOW_MS + 60_000 }, deps(stripe));
  assert.equal(again.ok ? null : again.reason, 'refund_disputed');
  assert.equal(auditCount('m1', 'money_back_operator_alert_skipped'), alertsAfterFirst);
});

test('a partly failed refund is not reported as complete, and the email waits for the run that finishes it', async () => {
  const stripe = new RealisticStripe();
  seedUser('n1', 'partial@example.com');
  seedPaidSub(stripe, 'n1');
  // A proration from an in-window upgrade, on its own charge.
  stripe.chargeById.set('ch_n1_up', {
    id: 'ch_n1_up',
    amount: 6600,
    amount_refunded: 0,
    payment_method_details: { card: { fingerprint: 'fp_n1', brand: 'visa', last4: '4242' } },
  });
  stripe.invoiceBySub.get('sub_n1')?.push({
    id: 'in_n1_up',
    status: 'paid',
    billing_reason: 'subscription_update',
    amount_paid: 6600,
    created: nowUnix - DAY,
    status_transitions: { paid_at: nowUnix - DAY },
    currency: 'usd',
    charge: 'ch_n1_up',
    payment_intent: 'pi_n1_up',
    lines: { data: [{ price: { id: 'price_pro_quarterly' } }] },
  });
  stripe.refundModeByCharge.set('ch_n1', 'reject');
  const first = await requestMoneyBackRefund({ userId: 'n1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(first.ok, true);
  if (first.ok) {
    assert.equal(first.complete, false);
    assert.equal(first.amountRefunded, 6600);
  }
  assert.equal(ledgerRow('sub_n1')?.status, 'pending');
  assert.equal(auditCount('n1', 'money_back_refund_email_error'), 0, 'no "refund complete" email yet');

  stripe.refundModeByCharge.delete('ch_n1');
  const resumed = await requestMoneyBackRefund({ userId: 'n1', source: 'operator', nowMs: NOW_MS + 5 * 60_000 }, deps(stripe));
  assert.equal(resumed.ok, true);
  if (resumed.ok) {
    assert.equal(resumed.complete, true);
    assert.equal(resumed.amountRefunded, 4900 + 6600);
  }
  assert.equal(ledgerRow('sub_n1')?.status, 'completed');
  // One confirmation attempt, from the completing run (Resend is not configured
  // in tests, so the attempt shows up as a logged send error).
  assert.equal(auditCount('n1', 'money_back_refund_email_error'), 1);
});

test('an operator goodwill refund on day 95 gives back the covered payment, not the renewals', async () => {
  const stripe = new RealisticStripe();
  seedUser('o1', 'goodwill95@example.com');
  seedPaidSub(stripe, 'o1', { paidAgoDays: 95 });
  for (const [n, ago] of [[1, 65], [2, 35], [3, 5]] as const) {
    stripe.chargeById.set(`ch_o1_${n}`, {
      id: `ch_o1_${n}`,
      amount: 4900,
      amount_refunded: 0,
      payment_method_details: { card: { fingerprint: 'fp_o1', brand: 'visa', last4: '4242' } },
    });
    stripe.invoiceBySub.get('sub_o1')?.push({
      id: `in_o1_${n}`,
      status: 'paid',
      billing_reason: 'subscription_cycle',
      amount_paid: 4900,
      created: nowUnix - ago * DAY,
      status_transitions: { paid_at: nowUnix - ago * DAY },
      currency: 'usd',
      charge: `ch_o1_${n}`,
      payment_intent: `pi_o1_${n}`,
      lines: { data: [{ price: { id: 'price_pro_monthly' } }] },
    });
  }
  const forced = await requestMoneyBackRefund({ userId: 'o1', source: 'operator', overrideLimits: true, nowMs: NOW_MS }, deps(stripe));
  assert.equal(forced.ok, true);
  if (forced.ok) assert.equal(forced.amountRefunded, 4900);
  assert.equal(stripe.chargeById.get('ch_o1')?.amount_refunded, 4900);
  for (const n of [1, 2, 3]) assert.equal(stripe.chargeById.get(`ch_o1_${n}`)?.amount_refunded, 0);
});

test('two accounts on one card asking at the same moment: only one is refunded', async () => {
  const stripe = new RealisticStripe();
  seedUser('p1', 'twin-one@example.com');
  seedPaidSub(stripe, 'p1', { fingerprint: 'fp_twin' });
  seedUser('p2', 'twin-two@example.com');
  seedPaidSub(stripe, 'p2', { fingerprint: 'fp_twin' });
  const [a, b] = await Promise.all([
    requestMoneyBackRefund({ userId: 'p1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe)),
    requestMoneyBackRefund({ userId: 'p2', source: 'self_serve', nowMs: NOW_MS }, deps(stripe)),
  ]);
  assert.equal([a, b].filter((r) => r.ok).length, 1);
  assert.equal([a, b].filter((r) => !r.ok && r.reason === 'prior_refund').length, 1);
});

test('a request that failed can be retried for a week after it was first made — not longer', async () => {
  const stripe = new RealisticStripe();
  seedUser('q1', 'grace@example.com');
  seedPaidSub(stripe, 'q1', { paidAgoDays: 6 });
  stripe.refundMode = 'reject';
  const first = await requestMoneyBackRefund({ userId: 'q1', source: 'self_serve', nowMs: NOW_MS }, deps(stripe));
  assert.equal(first.ok ? null : first.reason, 'refund_failed');
  stripe.refundMode = 'ok';
  // Day 29: past the retry grace, so it is judged as a new request — and the window closed long ago.
  const late = await requestMoneyBackRefund({ userId: 'q1', source: 'self_serve', nowMs: NOW_MS + 23 * DAY * 1000 }, deps(stripe));
  assert.equal(late.ok ? null : late.reason, 'window_elapsed');
  // Day 9: inside the grace, judged as of day 6 when it was first asked.
  const inGrace = await requestMoneyBackRefund({ userId: 'q1', source: 'self_serve', nowMs: NOW_MS + 3 * DAY * 1000 }, deps(stripe));
  assert.equal(inGrace.ok, true);
});

test('a request left pending mid-way is reported to the operator once per stall, then re-armed if it moves', async () => {
  seedUser('r1', 'stalled@example.com');
  const lastActivity = new Date(NOW_MS - 45 * 60_000).toISOString();
  db.prepare(
    `INSERT INTO money_back_refunds (id, subscription_id, user_id, email, email_canonical, status, source,
                                     amount_refunded, currency, requested_at, updated_at)
     VALUES ('mbr_r1', 'sub_r1', 'r1', 'stalled@example.com', 'stalled@example.com', 'pending', 'self_serve',
             4900, 'usd', ?, ?)`,
  ).run(lastActivity, lastActivity);

  // Dry run: listed, nothing sent.
  const dry = await sweepStalledMoneyBackRequests({ send: false, nowMs: NOW_MS });
  assert.deepEqual(dry.stalled.map((row) => row.id), ['mbr_r1']);
  assert.equal(dry.alerted, 0);

  // Send, with Resend's transport captured.
  const sent: Array<{ to: unknown; subject: string }> = [];
  const realFetch = globalThis.fetch;
  process.env.REFUND_ALERT_EMAIL = 'ops@example.com';
  process.env.RESEND_API_KEY = 're_test';
  process.env.RESEND_FROM_EMAIL = 'ZeroGEX <hello@example.com>';
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body ?? '{}')) as { to: unknown; subject: string };
    sent.push({ to: body.to, subject: body.subject });
    return new Response(JSON.stringify({ id: 'email_1' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  try {
    // (Other tests' rows in this shared DB may stall too; count only this one.)
    const forR1 = () => sent.filter((mail) => /stalled@example\.com/.test(mail.subject)).length;
    const first = await sweepStalledMoneyBackRequests({ send: true, nowMs: NOW_MS });
    assert.ok(first.stalled.some((row) => row.id === 'mbr_r1'));
    assert.equal(forR1(), 1);
    assert.ok(sent.some((mail) => /ACTION NEEDED/.test(mail.subject) && /stalled@example\.com/.test(mail.subject)));
    // Latched: the next hourly run stays quiet about it.
    const second = await sweepStalledMoneyBackRequests({ send: true, nowMs: NOW_MS + 3_600_000 });
    assert.equal(second.stalled.some((row) => row.id === 'mbr_r1'), false);
    assert.equal(forR1(), 1);
    // The request moves again (a resume that also stalls): re-armed.
    const moved = new Date(NOW_MS + 3_600_000).toISOString();
    db.prepare("UPDATE money_back_refunds SET updated_at = ? WHERE id = 'mbr_r1'").run(moved);
    const third = await sweepStalledMoneyBackRequests({ send: true, nowMs: NOW_MS + 2 * 3_600_000 });
    assert.ok(third.stalled.some((row) => row.id === 'mbr_r1'));
    assert.equal(forR1(), 2);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.REFUND_ALERT_EMAIL;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;
  }
});
