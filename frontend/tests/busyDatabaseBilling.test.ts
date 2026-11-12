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
  httpCalls,
  printedCommand,
  runPrinted,
  sqlite3Missing,
  unblockWrites,
  type Fixture,
  type RunOptions,
} from './support/busyDb.ts';

// The manual billing scripts that change a member's subscription in Stripe and
// then record the change here: cancel-subscription, comp-member,
// set-cancellation and reactivate-member. Each runs for real, the way the ones
// in tests/busyDatabase.test.ts do.
//
// Two tests per script. The first runs it while another process holds the
// database's write lock, the way the live site does: the record has to wait for
// the lock rather than fail after Stripe has already changed, and it lands
// once. The second makes the record fail outright (a trigger rejects its audit
// row, or its only write): the script has to say what it did in Stripe and that
// it is not recorded, leave none of the record behind (its writes go in one
// transaction), and print a command that records it when run as printed.
//
// Stripe and the key service are answered by tests/support/stub-http.mts. The
// scripts shell out to the sqlite3 CLI, so these skip where that isn't
// installed.

const { fixture, member, audit, run, runWhileLocked } = await createBusyDb('busy-db-billing');

const STRIPE_ENV = { STRIPE_SECRET_KEY: 'sk_test_busy_db' };

// The changes the run(s) made in Stripe (every call but a read), in order.
function stripeChanges(f: Fixture): string[] {
  return httpCalls(f)
    .filter((c) => c.method !== 'GET' && new URL(c.url).host === 'api.stripe.com')
    .map((c) => `${c.method} ${new URL(c.url).pathname}`);
}

// Runs the command the failed run printed, exactly as printed.
function runFix(stderr: string) {
  const command = printedCommand(stderr);
  assert.ok(command, 'prints the command that records it');
  return runPrinted(command);
}

const unix = (ms: number) => Math.floor((NOW_MS + ms) / 1000);

function subscriptionItems(subscriptionId: string, item: Record<string, unknown>) {
  return {
    object: 'list',
    url: `/v1/subscription_items?subscription=${subscriptionId}`,
    has_more: false,
    data: [{ id: `si_${subscriptionId}`, object: 'subscription_item', ...item }],
  };
}

// ---------------------------------------------------------------------------
// cancel-subscription: cancels and voids in Stripe, records the downgrade and
// its audit row, then revokes the member's API keys.
// ---------------------------------------------------------------------------

function pastDueMember(f: Fixture): string {
  return member(f, 'past-due@example.com', {
    tier: 'pro',
    subscription_status: 'past_due',
    stripe_customer_id: 'cus_past_due',
    stripe_subscription_id: 'sub_past_due',
    stripe_price_id: 'price_pro_monthly',
    current_period_end: at(-2 * DAY),
    payment_recovery_pending: 1,
    payment_grace_started_at: at(-2 * DAY),
  });
}

const KEY_SERVICE_ENV = {
  ZEROGEX_API_BASE_URL: 'https://keys.zerogex.test',
  ZEROGEX_API_TOKEN: 'test-bearer',
  ZEROGEX_ADMIN_TOKEN: 'test-admin',
};

const cancelArgs = ['--email', 'past-due@example.com', '--void-invoice', '--yes'];
const cancelOpts: RunOptions = {
  env: { ...STRIPE_ENV, ...KEY_SERVICE_ENV },
  routes: {
    'GET api.stripe.com/v1/subscriptions/sub_past_due': {
      id: 'sub_past_due',
      object: 'subscription',
      status: 'past_due',
      customer: 'cus_past_due',
      items: subscriptionItems('sub_past_due', {
        current_period_end: unix(-2 * DAY),
        price: { id: 'price_pro_monthly', object: 'price', unit_amount: 4900, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } },
      }),
    },
    'GET api.stripe.com/v1/invoices': {
      object: 'list',
      url: '/v1/invoices',
      has_more: false,
      data: [{ id: 'in_open', object: 'invoice', status: 'open', amount_due: 4900, currency: 'usd', attempt_count: 2 }],
    },
    'DELETE api.stripe.com/v1/subscriptions/sub_past_due': { id: 'sub_past_due', object: 'subscription', status: 'canceled' },
    'POST api.stripe.com/v1/invoices/in_open/void': { id: 'in_open', object: 'invoice', status: 'void' },
    'POST keys.zerogex.test/api/admin/api-keys/revoke-all': { revoked: 1 },
  },
};

test('cancel-subscription: a busy database waits, so the cancel is recorded once and the API key revoked', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'cancel-subscription');
  const id = pastDueMember(f);

  // Its first write is the record, made after the cancel and the void.
  const first = await runWhileLocked(f, 'cancel-subscription.mts', cancelArgs, cancelOpts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.equal(column(f, id, 'tier'), 'public');
  assert.equal(column(f, id, 'stripe_subscription_id'), null);
  assert.equal(column(f, id, 'subscription_status'), 'canceled');
  assert.equal(column(f, id, 'subscription_lapsed'), 1);
  assert.equal(auditCount(f, 'billing_subscription_canceled', id), 1, 'one audit row, written with the downgrade');
  assert.equal(auditCount(f, 'api_key_auto_revoked', id), 1, 'the key revocation ran after the record');

  // The row no longer names the subscription, so a second run, against Stripe
  // as the first left it, has nothing to cancel or void.
  const second = run(f, 'cancel-subscription.mts', cancelArgs, {
    env: cancelOpts.env,
    routes: {
      'GET api.stripe.com/v1/invoices': { object: 'list', url: '/v1/invoices', has_more: false, data: [] },
      'POST keys.zerogex.test/api/admin/api-keys/revoke-all': { revoked: 0 },
    },
  });
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Nothing to cancel and no open invoice to void\.$/m);
  assert.deepEqual(
    stripeChanges(f),
    ['DELETE /v1/subscriptions/sub_past_due', 'POST /v1/invoices/in_open/void'],
    'canceled and voided once',
  );
});

test('cancel-subscription: a record that still fails names the cancel, keeps none of it, and prints the fix', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'cancel-subscription-unrecorded');
  const id = pastDueMember(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_subscription_canceled'");

  const result = run(f, 'cancel-subscription.mts', cancelArgs, cancelOpts);
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stderr, /^Canceled sub_past_due and voided in_open in Stripe, but not recorded here: /m);
  // The downgrade rolled back with the audit row that failed.
  assert.equal(column(f, id, 'tier'), 'pro');
  assert.equal(column(f, id, 'stripe_subscription_id'), 'sub_past_due');
  assert.equal(column(f, id, 'subscription_status'), 'past_due');
  assert.equal(auditCount(f, 'billing_subscription_canceled', id), 0);
  // The key revocation after it did not run; the report says how to finish.
  assert.ok(!httpCalls(f).some((c) => new URL(c.url).host === 'keys.zerogex.test'), 'keys left for the re-run');
  assert.match(result.stderr, /^ {2}make cancel-subscription EMAIL=past-due@example\.com YES=1$/m);

  unblockWrites(f);
  const fix = runFix(result.stderr);
  assert.equal(fix.status, 0, fix.stderr + fix.stdout);
  assert.equal(column(f, id, 'tier'), 'public');
  assert.equal(column(f, id, 'stripe_subscription_id'), null);
  assert.equal(column(f, id, 'subscription_status'), 'canceled');
  assert.equal(auditCount(f, 'billing_subscription_canceled', id), 1);
});

// ---------------------------------------------------------------------------
// comp-member: cancels and refunds in Stripe, mirrors the downgrade, waits for
// Stripe's deletion webhook, then records the comped tier and its audit row.
// ---------------------------------------------------------------------------

function payingMember(f: Fixture): string {
  const id = member(f, 'bug-hunter@example.com', {
    tier: 'basic',
    subscription_status: 'active',
    stripe_customer_id: 'cus_comp',
    stripe_subscription_id: 'sub_comp',
    stripe_price_id: 'price_basic_monthly',
    current_period_end: at(20 * DAY),
  });
  // The deletion webhook's row, already in, so the wait passes on its first look.
  audit(f, id, 'stripe_subscription_deleted', new Date().toISOString(), 'Subscription sub_comp ended; tier reset to public');
  return id;
}

const compArgs = ['--email', 'bug-hunter@example.com', '--tier', 'pro', '--refund', '--yes'];
const compOpts: RunOptions = {
  env: STRIPE_ENV,
  routes: {
    'GET api.stripe.com/v1/subscriptions/sub_comp': {
      id: 'sub_comp',
      object: 'subscription',
      status: 'active',
      customer: 'cus_comp',
      items: subscriptionItems('sub_comp', {
        price: { id: 'price_basic_monthly', object: 'price', unit_amount: 2900, currency: 'usd', recurring: { interval: 'month', interval_count: 1 } },
      }),
    },
    'GET api.stripe.com/v1/invoices': {
      object: 'list',
      url: '/v1/invoices',
      has_more: false,
      data: [{ id: 'in_paid', object: 'invoice', status: 'paid', amount_paid: 2900, currency: 'usd', payment_intent: 'pi_paid' }],
    },
    'DELETE api.stripe.com/v1/subscriptions/sub_comp': { id: 'sub_comp', object: 'subscription', status: 'canceled' },
    'POST api.stripe.com/v1/refunds': { id: 're_comp', object: 'refund', amount: 2900, currency: 'usd', payment_intent: 'pi_paid' },
  },
};

test('comp-member: a busy database waits, so the member is comped, and recorded as comped, once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'comp-member');
  const id = payingMember(f);

  // Its first write is the mirror, right after the cancel.
  const first = await runWhileLocked(f, 'comp-member.mts', compArgs, compOpts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.equal(column(f, id, 'tier'), 'pro');
  assert.equal(column(f, id, 'stripe_subscription_id'), null, 'the cancel is mirrored');
  assert.equal(auditCount(f, 'billing_member_comped', id), 1, 'one audit row, written with the tier');

  // The row no longer names the subscription, so a second run writes the same
  // tier again and leaves Stripe alone.
  const second = run(f, 'comp-member.mts', compArgs, compOpts);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.equal(column(f, id, 'tier'), 'pro');
  assert.deepEqual(stripeChanges(f), ['DELETE /v1/subscriptions/sub_comp', 'POST /v1/refunds'], 'canceled and refunded once');
});

test('comp-member: a comp that still fails to record names the cancel and refund, keeps none of it, and prints the fix', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'comp-member-unrecorded');
  const id = payingMember(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_member_comped'");

  const result = run(f, 'comp-member.mts', compArgs, compOpts);
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /^Canceled sub_comp and refunded \$29\.00 against in_paid \(re_comp\) in Stripe, but the comp to pro is not recorded here: /m,
  );
  // The cancel's mirror landed; the comped tier rolled back with the audit row
  // that failed.
  assert.equal(column(f, id, 'stripe_subscription_id'), null);
  assert.equal(column(f, id, 'tier'), 'public');
  assert.equal(auditCount(f, 'billing_member_comped', id), 0);

  unblockWrites(f);
  const fix = runFix(result.stderr);
  assert.equal(fix.status, 0, fix.stderr + fix.stdout);
  assert.equal(column(f, id, 'tier'), 'pro');
  assert.equal(auditCount(f, 'billing_member_comped', id), 1);
});

// ---------------------------------------------------------------------------
// set-cancellation --off: stops a scheduled cancel in Stripe, then records the
// flag, the cleared acknowledgment stamp and the audit row.
// ---------------------------------------------------------------------------

function cancelingTrialer(f: Fixture): string {
  return member(f, 'changed-mind@example.com', {
    tier: 'basic',
    subscription_status: 'trialing',
    stripe_customer_id: 'cus_trial',
    stripe_subscription_id: 'sub_trial',
    current_period_end: at(4 * DAY),
    cancel_at_period_end: 1,
    cancel_ack_email_sent_at: at(-DAY),
  });
}

function trialSubscription(cancelAtPeriodEnd: boolean) {
  return {
    id: 'sub_trial',
    object: 'subscription',
    status: 'trialing',
    customer: 'cus_trial',
    cancel_at_period_end: cancelAtPeriodEnd,
    items: subscriptionItems('sub_trial', {
      current_period_end: unix(4 * DAY),
      price: { id: 'price_basic_monthly', object: 'price' },
    }),
  };
}

const setCancellationArgs = ['--email', 'changed-mind@example.com', '--off', '--yes'];
const setCancellationOpts: RunOptions = {
  env: STRIPE_ENV,
  routes: {
    'GET api.stripe.com/v1/subscriptions/sub_trial': trialSubscription(true),
    'POST api.stripe.com/v1/subscriptions/sub_trial': trialSubscription(false),
  },
};

test('set-cancellation --off: a busy database waits, so the stopped cancel is recorded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'set-cancellation');
  const id = cancelingTrialer(f);

  const first = await runWhileLocked(f, 'set-cancellation.mts', setCancellationArgs, setCancellationOpts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.equal(column(f, id, 'cancel_at_period_end'), 0);
  assert.equal(column(f, id, 'cancel_ack_email_sent_at'), null, 'a later cancel is acknowledged again');
  assert.equal(auditCount(f, 'billing_cancellation_set', id), 1, 'one audit row, written with the flag');

  // Stripe now has the flag off, so a second run has nothing to set.
  const second = run(f, 'set-cancellation.mts', setCancellationArgs, {
    env: STRIPE_ENV,
    routes: { 'GET api.stripe.com/v1/subscriptions/sub_trial': trialSubscription(false) },
  });
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Already not canceling\. Nothing to do\.$/m);
  assert.deepEqual(stripeChanges(f), ['POST /v1/subscriptions/sub_trial'], 'updated once');
  assert.deepEqual(
    httpCalls(f)
      .filter((c) => c.method === 'POST')
      .map((c) => c.body),
    ['cancel_at_period_end=false'],
  );
});

test('set-cancellation --off: a record that still fails names the change, keeps none of it, and prints the fix', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'set-cancellation-unrecorded');
  const id = cancelingTrialer(f);
  const ackSentAt = column(f, id, 'cancel_ack_email_sent_at');
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_cancellation_set'");

  const result = run(f, 'set-cancellation.mts', setCancellationArgs, setCancellationOpts);
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stderr, /^cancel_at_period_end is now false on sub_trial in Stripe, but not recorded here: /m);
  // The flag and the cleared stamp rolled back with the audit row that failed.
  assert.equal(column(f, id, 'cancel_at_period_end'), 1);
  assert.equal(column(f, id, 'cancel_ack_email_sent_at'), ackSentAt);
  assert.equal(auditCount(f, 'billing_cancellation_set', id), 0);

  unblockWrites(f);
  const fix = runFix(result.stderr);
  assert.equal(fix.status, 0, fix.stderr + fix.stdout);
  assert.equal(column(f, id, 'cancel_at_period_end'), 0);
  assert.equal(column(f, id, 'cancel_ack_email_sent_at'), null);
  assert.equal(auditCount(f, 'billing_cancellation_set', id), 1);
});

// ---------------------------------------------------------------------------
// reactivate-member: creates a trialing subscription in Stripe on the card on
// file, records it with an audit row (its only write), then waits for the
// webhook to mirror the subscription onto the row.
// ---------------------------------------------------------------------------

function churnedCustomer(f: Fixture): string {
  return member(f, 'returning@example.com', {
    tier: 'public',
    subscription_status: 'canceled',
    stripe_customer_id: 'cus_back',
    subscription_lapsed: 1,
    first_payment_at: at(-120 * DAY),
    paid_welcome_email_sent_at: at(-120 * DAY),
  });
}

const card = {
  id: 'pm_back',
  object: 'payment_method',
  type: 'card',
  customer: 'cus_back',
  card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2030 },
};
const basicMonthly = {
  id: 'price_basic_monthly',
  object: 'price',
  active: true,
  currency: 'usd',
  unit_amount: 2900,
  nickname: 'Basic monthly',
  recurring: { interval: 'month', interval_count: 1 },
  metadata: { tier: 'basic' },
};

const reactivateArgs = ['--email', 'returning@example.com', '--yes'];
const reactivateOpts: RunOptions = {
  env: STRIPE_ENV,
  routes: {
    'GET api.stripe.com/v1/customers/cus_back': { id: 'cus_back', object: 'customer', invoice_settings: { default_payment_method: card } },
    'GET api.stripe.com/v1/subscriptions': {
      object: 'list',
      url: '/v1/subscriptions',
      has_more: false,
      data: [
        {
          id: 'sub_old',
          object: 'subscription',
          status: 'canceled',
          customer: 'cus_back',
          created: unix(-120 * DAY),
          default_payment_method: 'pm_back',
          items: subscriptionItems('sub_old', { price: basicMonthly }),
        },
      ],
    },
    'GET api.stripe.com/v1/prices/price_basic_monthly': basicMonthly,
    'GET api.stripe.com/v1/customers/cus_back/payment_methods': {
      object: 'list',
      url: '/v1/customers/cus_back/payment_methods',
      has_more: false,
      data: [card],
    },
    'GET api.stripe.com/v1/payment_methods/pm_back': card,
    'POST api.stripe.com/v1/subscriptions': {
      id: 'sub_back',
      object: 'subscription',
      status: 'trialing',
      customer: 'cus_back',
      pending_setup_intent: null,
    },
  },
};

test('reactivate-member: a busy database waits, so the reactivation is recorded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'reactivate-member');
  const id = churnedCustomer(f);
  // Plays the webhook, which mirrors the new subscription onto the row; the
  // script waits for that before it reports. Here it lands with the audit row.
  f.db.exec(
    `CREATE TRIGGER play_subscription_webhook AFTER INSERT ON audit_events
     WHEN NEW.type = 'billing_manual_reactivation'
     BEGIN
       UPDATE users SET stripe_subscription_id = 'sub_back', subscription_status = 'trialing', tier = 'basic', subscription_lapsed = 0
       WHERE id = NEW.user_id;
     END;`,
  );

  const first = await runWhileLocked(f, 'reactivate-member.mts', reactivateArgs, reactivateOpts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Webhook landed: tier=basic, status=trialing, lapsed=no\.$/m);
  assert.equal(auditCount(f, 'billing_manual_reactivation', id), 1, 'recorded once');

  // The member has a subscription again, so a second run refuses.
  const second = run(f, 'reactivate-member.mts', reactivateArgs, reactivateOpts);
  assert.equal(second.status, 1, second.stderr + second.stdout);
  assert.match(second.stderr, /still has a subscription on file \(sub_back,/);
  assert.deepEqual(stripeChanges(f), ['POST /v1/subscriptions'], 'created once');
});

test('reactivate-member: a record that still fails names the new subscription and prints the fix', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'reactivate-member-unrecorded');
  const id = churnedCustomer(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_manual_reactivation'");

  const result = run(f, 'reactivate-member.mts', reactivateArgs, reactivateOpts);
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /^Created sub_back in Stripe \(a 21-day trial on price_basic_monthly, card pm_back\), but not recorded here: /m,
  );
  assert.equal(auditCount(f, 'billing_manual_reactivation', id), 0);
  assert.deepEqual(stripeChanges(f), ['POST /v1/subscriptions'], 'created once');

  unblockWrites(f);
  const fix = runFix(result.stderr);
  assert.equal(fix.status, 0, fix.stderr + fix.stdout);
  assert.equal(auditCount(f, 'billing_manual_reactivation', id), 1);
});
