import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY,
  NOW_MS,
  at,
  auditCount,
  blockWrites,
  column,
  createBusyDb,
  holdWriteLock,
  httpCalls,
  printedCommand,
  runPrinted,
  sqlite3Missing,
  unblockWrites,
  type Fixture,
  type RunOptions,
} from './support/busyDb.ts';

// The manual billing scripts that change something in Stripe and then record
// it here: recover-orphan-payment, upgrade-at-current-price, gift-month and
// fix-plan-switch-discount. Two tests each.
//
// The first runs the script for real while another process holds the
// database's write lock, the way the live site does whenever a member is
// active: the record waits for the lock instead of failing after Stripe has
// already changed.
//
// The second makes the record fail anyway (a trigger rejects it), and checks
// what the operator is left with: a non-zero exit, a report that says what was
// done in Stripe and that it is not recorded, nothing half-written here, and a
// printed command that records it when run exactly as printed.
//
// tests/support/busyDb.ts has the harness; Stripe is answered by
// tests/support/stub-http.mts from the routes each test gives.

const { fixture, member, audit, run, runWhileLocked } = await createBusyDb('busy-db-billing-fixes');

const unix = (ms: number) => Math.floor(ms / 1000);

// Unblocks the failed write and runs the command the script printed for
// recording it by hand, exactly as printed.
function recordByHand(f: Fixture, stderr: string): void {
  unblockWrites(f);
  const command = printedCommand(stderr);
  assert.ok(command, `printed a command to record it by hand:\n${stderr}`);
  const byHand = runPrinted(command);
  assert.equal(byHand.status, 0, byHand.stderr);
}

// The bodies of the Stripe POSTs to one path, from every run on this fixture,
// in order.
function posts(f: Fixture, pathname: string): Array<string | null> {
  return httpCalls(f)
    .filter((c) => c.method === 'POST' && new URL(c.url).pathname === pathname)
    .map((c) => c.body);
}

// ---------------------------------------------------------------------------
// recover-orphan-payment: re-creates the plan in Stripe, then mirrors the grant
// onto the users row and writes its audit row, in one transaction.
// ---------------------------------------------------------------------------

const ORPHAN_EMAIL = 'paid-anyway@example.com';
const ORPHAN_PAID_AT = unix(NOW_MS - DAY);
const ORPHAN_PERIOD_END = unix(NOW_MS + 25 * DAY);

// Dropped to 'public' when Stripe canceled their subscription for nonpayment,
// then paid its still-open invoice yesterday.
function orphanMember(f: Fixture): string {
  const id = member(f, ORPHAN_EMAIL, { stripe_customer_id: 'cus_orphan' });
  audit(f, id, 'stripe_subscription_deleted', at(-3 * DAY), 'Subscription sub_canceled deleted');
  return id;
}

function orphanOptions(): RunOptions {
  const periodStart = unix(NOW_MS - 5 * DAY);
  const canceled = { id: 'sub_canceled', object: 'subscription', status: 'canceled', customer: 'cus_orphan', discounts: [], metadata: {} };
  return {
    env: { STRIPE_SECRET_KEY: 'sk_test_busy_db', STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly' },
    routes: {
      'GET api.stripe.com/v1/invoices': {
        object: 'list',
        url: '/v1/invoices',
        has_more: false,
        data: [
          {
            id: 'in_orphan',
            object: 'invoice',
            customer: 'cus_orphan',
            subscription: 'sub_canceled',
            status: 'paid',
            amount_paid: 3900,
            currency: 'usd',
            billing_reason: 'subscription_cycle',
            created: periodStart,
            status_transitions: { paid_at: ORPHAN_PAID_AT },
            // Expanded, as the script asks: nothing refunded, and the card that
            // paid it is the one the plan renews on.
            charge: { id: 'ch_orphan', object: 'charge', amount_refunded: 0, payment_method: 'pm_orphan' },
            lines: {
              object: 'list',
              url: '/v1/invoices/in_orphan/lines',
              has_more: false,
              data: [
                {
                  id: 'il_orphan',
                  object: 'line_item',
                  price: { id: 'price_basic_monthly', object: 'price' },
                  period: { start: periodStart, end: ORPHAN_PERIOD_END },
                },
              ],
            },
          },
        ],
      },
      'GET api.stripe.com/v1/subscriptions/sub_canceled': canceled,
      'GET api.stripe.com/v1/subscriptions': { object: 'list', url: '/v1/subscriptions', has_more: false, data: [canceled] },
      'POST api.stripe.com/v1/subscriptions': {
        id: 'sub_recovered',
        object: 'subscription',
        status: 'active',
        customer: 'cus_orphan',
        cancel_at_period_end: false,
        metadata: { recovered_from_invoice: 'in_orphan' },
        items: {
          object: 'list',
          url: '/v1/subscription_items',
          has_more: false,
          data: [{ id: 'si_recovered', object: 'subscription_item', current_period_end: ORPHAN_PERIOD_END }],
        },
      },
    },
  };
}

function assertRecovered(f: Fixture, id: string): void {
  assert.equal(column(f, id, 'tier'), 'basic');
  assert.equal(column(f, id, 'stripe_subscription_id'), 'sub_recovered');
  assert.equal(column(f, id, 'subscription_status'), 'active');
  assert.equal(column(f, id, 'last_paid_subscription_id'), 'sub_recovered', 'counted as paid for');
  assert.equal(column(f, id, 'last_paid_invoice_at'), new Date(ORPHAN_PAID_AT * 1000).toISOString());
  assert.equal(auditCount(f, 'billing_orphan_payment_recovered', id), 1, 'one audit row, written with the grant');
}

test('recover-orphan-payment: a busy database waits, so the recovery is granted and recorded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'orphan-recovery');
  const id = orphanMember(f);
  const opts = orphanOptions();
  const args = ['--email', ORPHAN_EMAIL, '--yes'];

  const first = await runWhileLocked(f, 'recover-orphan-payment.mts', args, opts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. paid-anyway@example\.com is now 'basic' on subscription sub_recovered \(active\)\.$/m);
  assertRecovered(f, id);

  // The recorded subscription is what tells a second run there is nothing left
  // to recover.
  const second = run(f, 'recover-orphan-payment.mts', args, opts);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^No orphaned payment found/m);
  assert.equal(posts(f, '/v1/subscriptions').length, 1, 'the plan is re-created once');
});

test('recover-orphan-payment: a record that still fails leaves nothing half-written and prints the command that records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'orphan-recovery-unrecorded');
  const id = orphanMember(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_orphan_payment_recovered'");

  const result = run(f, 'recover-orphan-payment.mts', ['--email', ORPHAN_EMAIL, '--yes'], orphanOptions());
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /^Subscription sub_recovered was CREATED in Stripe for invoice in_orphan, but not recorded here: .*write blocked by the test/m,
  );
  assert.equal(posts(f, '/v1/subscriptions').length, 1);
  // The grant went with the audit row it could not write.
  assert.equal(column(f, id, 'tier'), 'public');
  assert.equal(column(f, id, 'stripe_subscription_id'), null);
  assert.equal(column(f, id, 'last_paid_subscription_id'), null);
  assert.equal(auditCount(f, 'billing_orphan_payment_recovered', id), 0);

  recordByHand(f, result.stderr);
  assertRecovered(f, id);
});

// ---------------------------------------------------------------------------
// upgrade-at-current-price: mints the hold-steady coupon and puts it on the
// subscription, checks the next invoice, then writes one audit row.
// ---------------------------------------------------------------------------

const UPGRADE_EMAIL = 'held-rate@example.com';
// Repair mode: already on Pro, where a plan switch's discount reconciler left
// them on the wrong rate. Their rate to hold is stated, as repair mode requires.
const UPGRADE_ARGS = ['--email', UPGRADE_EMAIL, '--tier', 'pro', '--current-price', '19', '--yes'];

function upgradeMember(f: Fixture): string {
  return member(f, UPGRADE_EMAIL, {
    tier: 'pro',
    subscription_status: 'active',
    stripe_customer_id: 'cus_held',
    stripe_subscription_id: 'sub_held',
    stripe_price_id: 'price_pro_monthly',
  });
}

function upgradeOptions(): RunOptions {
  const price = {
    id: 'price_pro_monthly',
    object: 'price',
    unit_amount: 5900,
    currency: 'usd',
    recurring: { interval: 'month', interval_count: 1 },
  };
  const subscription = {
    id: 'sub_held',
    object: 'subscription',
    status: 'active',
    customer: 'cus_held',
    metadata: {},
    discounts: ['di_promo'],
    items: {
      object: 'list',
      url: '/v1/subscription_items',
      has_more: false,
      data: [{ id: 'si_held', object: 'subscription_item', price }],
    },
  };
  return {
    env: { STRIPE_SECRET_KEY: 'sk_test_busy_db', STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly' },
    routes: {
      'GET api.stripe.com/v1/subscriptions/sub_held': subscription,
      'GET api.stripe.com/v1/prices/price_pro_monthly': price,
      // Both previews, before and after: $59 less the $40 coupon.
      'POST api.stripe.com/v1/invoices/create_preview': { object: 'invoice', amount_due: 1900, currency: 'usd' },
      'GET api.stripe.com/v1/coupons': { object: 'list', url: '/v1/coupons', has_more: false, data: [] },
      'POST api.stripe.com/v1/coupons': {
        id: 'coupon_held',
        object: 'coupon',
        amount_off: 4000,
        currency: 'usd',
        duration: 'forever',
        valid: true,
        metadata: { reason: 'upgrade_at_current_price' },
      },
      'POST api.stripe.com/v1/subscriptions/sub_held': { ...subscription, discounts: ['di_held'] },
    },
  };
}

function assertHoldApplied(f: Fixture): void {
  assert.equal(posts(f, '/v1/coupons').length, 1, 'one coupon minted');
  assert.deepEqual(
    posts(f, '/v1/subscriptions/sub_held').map((body) => decodeURIComponent(body ?? '')),
    ['discounts[0][coupon]=coupon_held'],
    'the coupon is applied once',
  );
}

test('upgrade-at-current-price: a busy database waits, so the held rate is recorded', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'upgrade-held-rate');
  const id = upgradeMember(f);

  // Its one write comes after an 8s wait for Stripe to settle, past the 3s
  // runWhileLocked holds the lock for, so the lock is held longer here.
  const lock = await holdWriteLock(f.dbPath, 12_000);
  const result = run(f, 'upgrade-at-current-price.mts', UPGRADE_ARGS, upgradeOptions());
  await lock.released;
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /^Done\. held-rate@example\.com is on 'pro', next invoice \$19\.00 \/ month — verified after settle\.$/m);
  assertHoldApplied(f);
  assert.equal(auditCount(f, 'billing_tier_upgraded_at_current_price', id), 1, 'one audit row');
});

test('upgrade-at-current-price: a record that still fails says so, with the invoice check, and prints the command that records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'upgrade-held-rate-unrecorded');
  const id = upgradeMember(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_tier_upgraded_at_current_price'");

  const result = run(f, 'upgrade-at-current-price.mts', UPGRADE_ARGS, upgradeOptions());
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /^Subscription sub_held was CHANGED in Stripe \(coupon coupon_held applied\), but not recorded here: .*write blocked by the test/m,
  );
  assert.match(result.stderr, /^Then tell the member yourself \(no email was sent\): the next invoice was verified at \$19\.00\.$/m);
  assert.doesNotMatch(result.stdout, /^Done\./m);
  assertHoldApplied(f);
  assert.equal(auditCount(f, 'billing_tier_upgraded_at_current_price', id), 0);

  recordByHand(f, result.stderr);
  assert.equal(auditCount(f, 'billing_tier_upgraded_at_current_price', id), 1);
});

// ---------------------------------------------------------------------------
// gift-month: posts the credit to the Stripe balance, then writes one audit row.
// ---------------------------------------------------------------------------

function giftMember(f: Fixture, email: string): string {
  return member(f, email, {
    tier: 'basic',
    subscription_status: 'active',
    stripe_customer_id: 'cus_gift',
    stripe_subscription_id: 'sub_gift',
  });
}

// `given`: the balance transactions already on the customer.
function giftOptions(given: unknown[] = []): RunOptions {
  return {
    env: { STRIPE_SECRET_KEY: 'sk_test_busy_db' },
    routes: {
      'GET api.stripe.com/v1/subscriptions/sub_gift': {
        id: 'sub_gift',
        object: 'subscription',
        status: 'active',
        cancel_at_period_end: false,
        customer: 'cus_gift',
        items: {
          object: 'list',
          url: '/v1/subscription_items',
          has_more: false,
          data: [
            {
              id: 'si_gift',
              object: 'subscription_item',
              current_period_end: unix(NOW_MS + 20 * DAY),
              price: {
                id: 'price_basic_monthly',
                object: 'price',
                unit_amount: 3900,
                currency: 'usd',
                recurring: { interval: 'month', interval_count: 1 },
              },
            },
          ],
        },
      },
      'GET api.stripe.com/v1/customers/cus_gift/balance_transactions': {
        object: 'list',
        url: '/v1/customers/cus_gift/balance_transactions',
        has_more: false,
        data: given,
      },
      'GET api.stripe.com/v1/customers/cus_gift': { id: 'cus_gift', object: 'customer', balance: 0 },
      'POST api.stripe.com/v1/invoices/create_preview': { object: 'invoice', amount_due: 3900, currency: 'usd' },
      'POST api.stripe.com/v1/customers/cus_gift/balance_transactions': {
        id: 'cbtxn_gift',
        object: 'customer_balance_transaction',
        amount: -3900,
        currency: 'usd',
        ending_balance: -3900,
        customer: 'cus_gift',
      },
    },
  };
}

const CREDITS = '/v1/customers/cus_gift/balance_transactions';

test('gift-month: a busy database waits, so the gift is credited and recorded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'gift-month');
  const id = giftMember(f, 'goodwill@example.com');
  const args = ['--email', 'goodwill@example.com', '--yes'];

  const first = await runWhileLocked(f, 'gift-month.mts', args, giftOptions());
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. Credited \$39\.00 \(balance transaction cbtxn_gift\)\.$/m);
  assert.equal(auditCount(f, 'billing_goodwill_credit', id), 1, `one audit row\n${first.stderr}`);

  // The guard is the tag on the credit in Stripe: a second run the same day
  // finds it and stops.
  const credited = new URLSearchParams(posts(f, CREDITS)[0] ?? '');
  assert.equal(credited.get('amount'), '-3900');
  const tag = credited.get('metadata[zerogex_gift_ref]');
  assert.ok(tag, 'the credit carries its tag');
  const already = { id: 'cbtxn_gift', object: 'customer_balance_transaction', amount: -3900, currency: 'usd', metadata: { zerogex_gift_ref: tag } };
  const second = run(f, 'gift-month.mts', args, giftOptions([already]));
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Already given today: balance transaction cbtxn_gift/m);
  assert.equal(posts(f, CREDITS).length, 1, 'credited once');
  assert.equal(auditCount(f, 'billing_goodwill_credit', id), 1);
});

test('gift-month: a record that still fails is an error, not a warning, and prints the command that records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'gift-month-unrecorded');
  // A quote and a "$" in the address: the printed command must pass both
  // through to sqlite3 untouched.
  const email = "o'neil$gift@example.com";
  const id = giftMember(f, email);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_goodwill_credit'");

  const result = run(f, 'gift-month.mts', ['--email', email, '--yes'], giftOptions());
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /^\$39\.00 was CREDITED to cus_gift in Stripe \(balance transaction cbtxn_gift\), but not recorded here: .*write blocked by the test/m,
  );
  assert.match(result.stderr, /^Then tell the member yourself: no email was sent\.$/m);
  assert.doesNotMatch(result.stdout, /^Done\./m);
  assert.equal(posts(f, CREDITS).length, 1);
  assert.equal(auditCount(f, 'billing_goodwill_credit', id), 0);

  recordByHand(f, result.stderr);
  const row = f.db.prepare("SELECT email, message FROM audit_events WHERE type = 'billing_goodwill_credit' AND user_id = ?").all(id) as Array<{
    email: string;
    message: string;
  }>;
  assert.equal(row.length, 1);
  assert.equal(row[0].email, email);
  assert.match(row[0].message, /balance transaction cbtxn_gift/);
});

// ---------------------------------------------------------------------------
// fix-plan-switch-discount: rewrites the subscription's discounts in Stripe,
// then writes one audit row.
// ---------------------------------------------------------------------------

const SWITCH_EMAIL = 'went-quarterly@example.com';

// Moved from monthly to quarterly in the billing portal, and the monthly promo
// came along.
function switchMember(f: Fixture): string {
  return member(f, SWITCH_EMAIL, {
    tier: 'basic',
    subscription_status: 'trialing',
    stripe_customer_id: 'cus_switch',
    stripe_subscription_id: 'sub_switch',
    stripe_price_id: 'price_basic_quarterly',
  });
}

// `discounts`: what the subscription carries when the run reads it.
function switchOptions(discounts: unknown[]): RunOptions {
  const subscription = {
    id: 'sub_switch',
    object: 'subscription',
    status: 'trialing',
    customer: 'cus_switch',
    discounts,
    items: {
      object: 'list',
      url: '/v1/subscription_items',
      has_more: false,
      data: [{ id: 'si_switch', object: 'subscription_item', price: { id: 'price_basic_quarterly', object: 'price' } }],
    },
  };
  return {
    env: {
      STRIPE_SECRET_KEY: 'sk_test_busy_db',
      STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly',
      STRIPE_PRICE_BASIC_QUARTERLY: 'price_basic_quarterly',
      STRIPE_COUPON_PROMO_BASIC_MONTHLY: 'promo_basic_monthly',
    },
    routes: {
      'GET api.stripe.com/v1/subscriptions/sub_switch': subscription,
      'POST api.stripe.com/v1/subscriptions/sub_switch': { ...subscription, discounts: [] },
    },
  };
}

const MONTHLY_PROMO = {
  id: 'di_promo',
  object: 'discount',
  coupon: { id: 'promo_basic_monthly', object: 'coupon', amount_off: 1000, currency: 'usd', duration: 'repeating', duration_in_months: 12 },
};

function assertPromoStripped(f: Fixture): void {
  assert.deepEqual(
    posts(f, '/v1/subscriptions/sub_switch').map((body) => decodeURIComponent(body ?? '')),
    ['discounts=&proration_behavior=none'],
    'the stale promo is stripped once',
  );
}

test('fix-plan-switch-discount: a busy database waits, so the fix is recorded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'plan-switch-discount');
  const id = switchMember(f);
  const args = ['--email', SWITCH_EMAIL, '--yes'];

  const first = await runWhileLocked(f, 'fix-plan-switch-discount.mts', args, switchOptions([MONTHLY_PROMO]));
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. went-quarterly@example\.com's subscription sub_switch now carries: no coupons\.$/m);
  assertPromoStripped(f);
  assert.equal(auditCount(f, 'billing_discount_reconciled_manual', id), 1, 'one audit row');

  // Read back from Stripe as it now stands, there is nothing left to fix.
  const second = run(f, 'fix-plan-switch-discount.mts', args, switchOptions([]));
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Nothing to do: discounts already match the correct set\. No writes\.$/m);
  assertPromoStripped(f);
  assert.equal(auditCount(f, 'billing_discount_reconciled_manual', id), 1);
});

test('fix-plan-switch-discount: a record that still fails says so and prints the command that records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'plan-switch-discount-unrecorded');
  const id = switchMember(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_discount_reconciled_manual'");

  const result = run(f, 'fix-plan-switch-discount.mts', ['--email', SWITCH_EMAIL, '--yes'], switchOptions([MONTHLY_PROMO]));
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /^The discounts on sub_switch were CHANGED in Stripe \(stripped \[promo_basic_monthly\], now no coupons\), but not recorded here: .*write blocked by the test/m,
  );
  assert.doesNotMatch(result.stdout, /^Done\./m);
  assertPromoStripped(f);
  assert.equal(auditCount(f, 'billing_discount_reconciled_manual', id), 0);

  recordByHand(f, result.stderr);
  assert.equal(auditCount(f, 'billing_discount_reconciled_manual', id), 1);
});
