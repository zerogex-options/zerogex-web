import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY,
  HOUR,
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

// The manual scripts that change a member's trial or offer in Stripe and then
// record the change here: extend-trial, restore-trial-after-switch,
// grant-founding-on-existing-sub, activate-late-founder and
// honor-winback-discount. Each is run for real (--yes) two ways.
//
// First while another process holds the database's write lock, the way the
// live site does whenever a member is active: the record waits for the lock
// and lands whole, once.
//
// Then with the record made to fail after the Stripe change, the way a write
// that still cannot get the lock fails once the wait and the retries run out.
// The Stripe change cannot be taken back, so the run has to say what Stripe now
// has that this database does not, leave none of the record behind (a row
// update rolls back with the audit row that failed), print the command that
// records it, and exit non-zero. That command, run as printed, records it.
//
// Stripe is stubbed by tests/support/stub-http.mts, which gives the same answer
// to every call on a route, so a second run that has to see the change is given
// the subscription as Stripe has it afterwards. tests/support/busyDb.ts has the
// rest.

const { fixture, member, audit, run, runWhileLocked } = await createBusyDb('busy-db-trials');

const stripeKey = { STRIPE_SECRET_KEY: 'sk_test_busy_db' };

// Unix seconds `ms` from now, the way Stripe gives a time, and the timestamp
// the scripts mirror it as.
const unix = (ms: number) => Math.floor((NOW_MS + ms) / 1000);
const iso = (seconds: number) => new Date(seconds * 1000).toISOString();

// The calls the stub answered for one method and path, in order.
function calls(f: Fixture, method: string, pathname: string) {
  return httpCalls(f).filter((c) => c.method === method && new URL(c.url).pathname === pathname);
}

// One field of a call's form-encoded body.
function field(call: { body: string | null }, name: string): string | null {
  return new URLSearchParams(call.body ?? '').get(name);
}

// What the operator does next: writes go through again, and the command the
// script printed is run exactly as printed.
function recordByHand(f: Fixture, stderr: string): void {
  unblockWrites(f);
  const command = printedCommand(stderr);
  assert.ok(command, `no command printed to record it by hand:\n${stderr}`);
  const result = runPrinted(command);
  assert.equal(result.status, 0, result.stderr + result.stdout);
}

// ---------------------------------------------------------------------------
// extend-trial: pushes trial_end out in Stripe, then mirrors the new end here
// and re-arms the ~48h reminder.
// ---------------------------------------------------------------------------

// Reminded twelve hours ago, a day and a half before the trial ends, and given
// a week more.
const EXTEND_FROM = unix(36 * HOUR);
const EXTEND_TO = unix(8 * DAY);
const REMINDED_AT = at(-12 * HOUR);
const extendArgs = ['--email', 'extended@example.com', '--trial-end', iso(EXTEND_TO), '--yes'];

function trialingMember(f: Fixture): string {
  return member(f, 'extended@example.com', {
    subscription_status: 'trialing',
    stripe_customer_id: 'cus_extend',
    stripe_subscription_id: 'sub_extend',
    current_period_end: iso(EXTEND_FROM),
    trial_reminder_email_sent_at: REMINDED_AT,
  });
}

// `trialEnd`: the trial end Stripe reports before the run.
function extendOpts(trialEnd: number): RunOptions {
  const subscription = (end: number) => ({ id: 'sub_extend', object: 'subscription', status: 'trialing', trial_end: end });
  return {
    env: stripeKey,
    routes: {
      'GET api.stripe.com/v1/subscriptions/sub_extend': subscription(trialEnd),
      'POST api.stripe.com/v1/subscriptions/sub_extend': subscription(EXTEND_TO),
    },
  };
}

test('extend-trial: a busy database waits, so the new end and the re-armed reminder are recorded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'extend-trial');
  const id = trialingMember(f);

  const first = await runWhileLocked(f, 'extend-trial.mts', extendArgs, extendOpts(EXTEND_FROM));
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. Trial for extended@example\.com now ends /m);
  const updates = calls(f, 'POST', '/v1/subscriptions/sub_extend');
  assert.equal(updates.length, 1, 'extended once');
  assert.equal(field(updates[0], 'trial_end'), String(EXTEND_TO));
  assert.equal(column(f, id, 'current_period_end'), iso(EXTEND_TO), 'the new end mirrored');
  assert.equal(column(f, id, 'trial_reminder_email_sent_at'), null, 'the reminder re-armed');
  assert.equal(auditCount(f, 'billing_trial_extended', id), 1, 'one audit row, written with the row');

  // Stripe has the new end now, so the same command refuses rather than
  // extending again.
  const second = run(f, 'extend-trial.mts', extendArgs, extendOpts(EXTEND_TO));
  assert.equal(second.status, 1, second.stderr + second.stdout);
  assert.match(second.stderr, /is not after the current one/);
  assert.equal(calls(f, 'POST', '/v1/subscriptions/sub_extend').length, 1, 'still extended once');
});

test('extend-trial: a record that still fails leaves nothing half-written, and the printed command records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'extend-trial-unrecorded');
  const id = trialingMember(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_trial_extended'");

  const result = run(f, 'extend-trial.mts', extendArgs, extendOpts(EXTEND_FROM));
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /The trial on sub_extend was EXTENDED in Stripe to \S+, but not recorded here: .*write blocked by the test/,
  );
  assert.equal(calls(f, 'POST', '/v1/subscriptions/sub_extend').length, 1, 'extended in Stripe');
  assert.equal(column(f, id, 'current_period_end'), iso(EXTEND_FROM), 'the row update rolled back with the audit row');
  assert.equal(column(f, id, 'trial_reminder_email_sent_at'), REMINDED_AT);
  assert.equal(auditCount(f, 'billing_trial_extended', id), 0);

  recordByHand(f, result.stderr);
  assert.equal(column(f, id, 'current_period_end'), iso(EXTEND_TO));
  assert.equal(column(f, id, 'trial_reminder_email_sent_at'), null);
  assert.equal(auditCount(f, 'billing_trial_extended', id), 1);
});

// ---------------------------------------------------------------------------
// restore-trial-after-switch: refunds the charge a plan switch wrongly made and
// puts the trial back in Stripe, then mirrors the trial here.
// ---------------------------------------------------------------------------

const RESTORED_UNTIL = unix(7 * DAY);
const SWITCHED_PERIOD_END = at(365 * DAY);
const restoreArgs = ['--email', 'switched@example.com', '--trial-end', iso(RESTORED_UNTIL), '--yes'];

function switchedMember(f: Fixture): string {
  return member(f, 'switched@example.com', {
    tier: 'basic',
    subscription_status: 'active',
    stripe_customer_id: 'cus_switch',
    stripe_subscription_id: 'sub_switch',
    stripe_price_id: 'price_basic_annual',
    current_period_end: SWITCHED_PERIOD_END,
    trial_reminder_email_sent_at: REMINDED_AT,
  });
}

// `status`: what Stripe reports for the subscription before the run.
function restoreOpts(status: 'active' | 'trialing'): RunOptions {
  const subscription = {
    id: 'sub_switch',
    object: 'subscription',
    status,
    customer: 'cus_switch',
    items: {
      object: 'list',
      data: [
        {
          id: 'si_switch',
          object: 'subscription_item',
          price: { id: 'price_basic_annual', object: 'price', unit_amount: 19900, currency: 'usd', recurring: { interval: 'year' } },
        },
      ],
    },
    discounts: [{ id: 'di_promo', object: 'discount', coupon: { id: 'coupon_promo_basic_annual', object: 'coupon' } }],
  };
  return {
    env: { ...stripeKey, STRIPE_PRICE_BASIC_ANNUAL: 'price_basic_annual', STRIPE_COUPON_PROMO_BASIC_ANNUAL: 'coupon_promo_basic_annual' },
    routes: {
      'GET api.stripe.com/v1/subscriptions/sub_switch': subscription,
      'GET api.stripe.com/v1/invoices': {
        object: 'list',
        url: '/v1/invoices',
        has_more: false,
        data: [{ id: 'in_switch', object: 'invoice', status: 'paid', amount_paid: 15000, currency: 'usd', charge: 'ch_switch' }],
      },
      'POST api.stripe.com/v1/refunds': { id: 're_switch', object: 'refund', amount: 15000, currency: 'usd', status: 'succeeded' },
      'POST api.stripe.com/v1/subscriptions/sub_switch': { ...subscription, status: 'trialing', trial_end: RESTORED_UNTIL },
    },
  };
}

test('restore-trial-after-switch: a busy database waits, so the restored trial is recorded once and never refunded twice', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'restore-trial');
  const id = switchedMember(f);

  const first = await runWhileLocked(f, 'restore-trial-after-switch.mts', restoreArgs, restoreOpts('active'));
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. switched@example\.com is back on a free trial until /m);
  const refunds = calls(f, 'POST', '/v1/refunds');
  assert.equal(refunds.length, 1, 'refunded once');
  assert.equal(field(refunds[0], 'charge'), 'ch_switch');
  const updates = calls(f, 'POST', '/v1/subscriptions/sub_switch');
  assert.equal(updates.length, 1, 'restored once');
  assert.equal(field(updates[0], 'trial_end'), String(RESTORED_UNTIL));
  assert.equal(column(f, id, 'subscription_status'), 'trialing', 'the trial mirrored');
  assert.equal(column(f, id, 'current_period_end'), iso(RESTORED_UNTIL));
  assert.equal(column(f, id, 'trial_reminder_email_sent_at'), null, 'the reminder re-armed');
  assert.equal(auditCount(f, 'billing_trial_restored_after_switch', id), 1, 'one audit row, written with the row');

  // Stripe has the subscription trialing now, so the same command refuses
  // before it looks for anything to refund.
  const second = run(f, 'restore-trial-after-switch.mts', restoreArgs, restoreOpts('trialing'));
  assert.equal(second.status, 1, second.stderr + second.stdout);
  assert.match(second.stderr, /as 'trialing', not 'active'/);
  assert.equal(calls(f, 'POST', '/v1/refunds').length, 1, 'still refunded once');
});

test('restore-trial-after-switch: a record that still fails leaves nothing half-written, and the printed command records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'restore-trial-unrecorded');
  const id = switchedMember(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_trial_restored_after_switch'");

  const result = run(f, 'restore-trial-after-switch.mts', restoreArgs, restoreOpts('active'));
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /The trial on sub_switch was RESTORED in Stripe until \S+, and in_switch REFUNDED \(re_switch\), but not recorded here: .*write blocked by the test/,
  );
  assert.equal(calls(f, 'POST', '/v1/refunds').length, 1, 'refunded in Stripe');
  assert.equal(calls(f, 'POST', '/v1/subscriptions/sub_switch').length, 1, 'restored in Stripe');
  assert.equal(column(f, id, 'subscription_status'), 'active', 'the row update rolled back with the audit row');
  assert.equal(column(f, id, 'current_period_end'), SWITCHED_PERIOD_END);
  assert.equal(column(f, id, 'trial_reminder_email_sent_at'), REMINDED_AT);
  assert.equal(auditCount(f, 'billing_trial_restored_after_switch', id), 0);

  recordByHand(f, result.stderr);
  assert.equal(column(f, id, 'subscription_status'), 'trialing');
  assert.equal(column(f, id, 'current_period_end'), iso(RESTORED_UNTIL));
  assert.equal(column(f, id, 'trial_reminder_email_sent_at'), null);
  assert.equal(auditCount(f, 'billing_trial_restored_after_switch', id), 1);
});

// ---------------------------------------------------------------------------
// grant-founding-on-existing-sub: moves a paying member's subscription onto the
// founding plan in Stripe, then flags them founding-eligible here.
// ---------------------------------------------------------------------------

const grantArgs = ['--email', 'loyal@example.com', '--yes'];

function payingMember(f: Fixture): string {
  return member(f, 'loyal@example.com', {
    tier: 'basic',
    subscription_status: 'active',
    stripe_customer_id: 'cus_loyal',
    stripe_subscription_id: 'sub_loyal',
    stripe_price_id: 'price_basic_monthly',
  });
}

// `converted`: whether Stripe already has the subscription on the founding plan
// before the run.
function grantOpts(converted: boolean): RunOptions {
  const items = (price: string) => ({
    object: 'list',
    data: [{ id: 'si_loyal', object: 'subscription_item', price: { id: price, object: 'price' } }],
  });
  const founding = {
    id: 'sub_loyal',
    object: 'subscription',
    status: 'active',
    customer: 'cus_loyal',
    items: items('price_pro_annual'),
    discounts: [{ id: 'di_founding', object: 'discount', coupon: { id: 'coupon_founding_pro_annual', object: 'coupon' } }],
    metadata: { founding: '1' },
  };
  return {
    env: {
      ...stripeKey,
      STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly',
      STRIPE_PRICE_PRO_ANNUAL: 'price_pro_annual',
      STRIPE_COUPON_FOUNDING_PRO_INTRO_ANNUAL: 'coupon_founding_pro_annual',
    },
    routes: {
      'GET api.stripe.com/v1/subscriptions/sub_loyal': converted
        ? founding
        : { ...founding, items: items('price_basic_monthly'), discounts: [], metadata: {} },
      'POST api.stripe.com/v1/invoices/create_preview': { id: 'upcoming_loyal', object: 'invoice', amount_due: 15000, currency: 'usd' },
      'POST api.stripe.com/v1/subscriptions/sub_loyal': {
        ...founding,
        // Raised by the update itself, so it is what the run reports as charged.
        latest_invoice: {
          id: 'in_founding',
          object: 'invoice',
          created: Math.floor(Date.now() / 1000),
          amount_due: 15000,
          currency: 'usd',
          hosted_invoice_url: 'https://invoice.stripe.test/in_founding',
        },
      },
    },
  };
}

test('grant-founding-on-existing-sub: a busy database waits, so the grant is flagged and recorded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'grant-founding');
  const id = payingMember(f);

  const first = await runWhileLocked(f, 'grant-founding-on-existing-sub.mts', grantArgs, grantOpts(false));
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. loyal@example\.com converted to founding pro\/annual\.$/m);
  assert.match(first.stdout, /^ {2}Charged now: +\$150\.00 \(invoice in_founding\)$/m);
  const updates = calls(f, 'POST', '/v1/subscriptions/sub_loyal');
  assert.equal(updates.length, 1, 'converted once');
  assert.equal(field(updates[0], 'items[0][price]'), 'price_pro_annual');
  assert.equal(field(updates[0], 'discounts[0][coupon]'), 'coupon_founding_pro_annual');
  assert.equal(field(updates[0], 'metadata[founding]'), '1');
  assert.equal(column(f, id, 'founding_eligible'), 1, 'flagged');
  assert.equal(auditCount(f, 'billing_founding_granted_existing_sub', id), 1, 'one audit row, written with the flag');

  // Once the webhook has stamped founding_member_started_at off
  // metadata.founding, the same command has nothing left to do.
  f.db.prepare('UPDATE users SET founding_member_started_at = ? WHERE id = ?').run(at(0), id);
  const second = run(f, 'grant-founding-on-existing-sub.mts', grantArgs, grantOpts(true));
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Nothing to do: /m);
  assert.equal(calls(f, 'POST', '/v1/subscriptions/sub_loyal').length, 1, 'still converted once');
});

test('grant-founding-on-existing-sub: a record that still fails leaves nothing half-written, and the printed command records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'grant-founding-unrecorded');
  const id = payingMember(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_founding_granted_existing_sub'");

  const result = run(f, 'grant-founding-on-existing-sub.mts', grantArgs, grantOpts(false));
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /Subscription sub_loyal was CONVERTED to founding pro\/annual in Stripe \(coupon coupon_founding_pro_annual, metadata\.founding=1, invoice in_founding\), but not recorded here: .*write blocked by the test/,
  );
  assert.equal(calls(f, 'POST', '/v1/subscriptions/sub_loyal').length, 1, 'converted in Stripe');
  assert.equal(column(f, id, 'founding_eligible'), 0, 'the flag rolled back with the audit row');
  assert.equal(auditCount(f, 'billing_founding_granted_existing_sub', id), 0);

  recordByHand(f, result.stderr);
  assert.equal(column(f, id, 'founding_eligible'), 1);
  assert.equal(auditCount(f, 'billing_founding_granted_existing_sub', id), 1);
});

// ---------------------------------------------------------------------------
// activate-late-founder: creates the member's Stripe customer and links it
// here, then mints a founding checkout link and records the mint. Two records,
// so two ways for a record to fail.
// ---------------------------------------------------------------------------

const lateArgs = ['--email', 'late@example.com', '--tier', 'pro', '--cadence', 'annual', '--yes'];
const lateCustomer = { id: 'cus_late', object: 'customer', email: 'late@example.com' };
const lateOpts: RunOptions = {
  env: { ...stripeKey, STRIPE_PRICE_PRO_ANNUAL: 'price_pro_annual', STRIPE_COUPON_FOUNDING_PRO_INTRO_ANNUAL: 'coupon_founding_pro_annual' },
  routes: {
    'POST api.stripe.com/v1/customers': lateCustomer,
    'GET api.stripe.com/v1/customers/cus_late': lateCustomer,
    'POST api.stripe.com/v1/checkout/sessions': {
      id: 'cs_late',
      object: 'checkout.session',
      url: 'https://checkout.stripe.test/c/pay/cs_late',
    },
  },
};

test('activate-late-founder: a busy database waits, so the customer is linked, the mint recorded, and a re-run reuses the customer', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'late-founder');
  const id = member(f, 'late@example.com');

  const first = await runWhileLocked(f, 'activate-late-founder.mts', lateArgs, lateOpts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^ {4}https:\/\/checkout\.stripe\.test\/c\/pay\/cs_late$/m);
  assert.match(first.stdout, /^Done\. 1 link\(s\) minted /m);
  assert.equal(calls(f, 'POST', '/v1/customers').length, 1, 'one customer');
  assert.equal(calls(f, 'POST', '/v1/checkout/sessions').length, 1, 'one link');
  assert.equal(column(f, id, 'stripe_customer_id'), 'cus_late', 'linked');
  assert.equal(column(f, id, 'founding_eligible'), 1);
  assert.equal(auditCount(f, 'billing_late_founder_activation', id), 1, 'the mint recorded');

  // The link is what makes a re-run (to refresh a lapsed link) reuse the
  // customer instead of creating a second one.
  const second = run(f, 'activate-late-founder.mts', lateArgs, lateOpts);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.equal(calls(f, 'GET', '/v1/customers/cus_late').length, 1, 'reused');
  assert.equal(calls(f, 'POST', '/v1/customers').length, 1, 'still one customer');
});

test('activate-late-founder: a mint record that still fails is printed, and the printed command records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'late-founder-unrecorded');
  const id = member(f, 'late@example.com');
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_late_founder_activation'");

  const result = run(f, 'activate-late-founder.mts', lateArgs, lateOpts);
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /The link\(s\) above were MINTED in Stripe \(pro\/annual=cs_late\), but not recorded here: .*write blocked by the test/,
  );
  assert.match(result.stdout, /^ {4}https:\/\/checkout\.stripe\.test\/c\/pay\/cs_late$/m, 'the link is still shown');
  assert.equal(calls(f, 'POST', '/v1/checkout/sessions').length, 1, 'minted in Stripe');
  // Written before the mint, and records the customer, not the mint: kept.
  assert.equal(column(f, id, 'stripe_customer_id'), 'cus_late');
  assert.equal(auditCount(f, 'billing_late_founder_activation', id), 0);

  recordByHand(f, result.stderr);
  assert.equal(auditCount(f, 'billing_late_founder_activation', id), 1);
});

test('activate-late-founder: a customer link that still fails stops before any link is minted, and the printed command records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'late-founder-unlinked');
  const id = member(f, 'late@example.com');
  blockWrites(f, 'UPDATE', 'users', 'NEW.stripe_customer_id IS NOT OLD.stripe_customer_id');

  const result = run(f, 'activate-late-founder.mts', lateArgs, lateOpts);
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /Stripe customer cus_late was CREATED for late@example\.com, but not recorded here: .*write blocked by the test/,
  );
  assert.equal(calls(f, 'POST', '/v1/customers').length, 1, 'created in Stripe');
  assert.equal(calls(f, 'POST', '/v1/checkout/sessions').length, 0, 'no link on a customer the member is not linked to');
  assert.equal(column(f, id, 'stripe_customer_id'), null);
  assert.equal(column(f, id, 'founding_eligible'), 0);
  assert.equal(auditCount(f, 'billing_late_founder_activation', id), 0);

  recordByHand(f, result.stderr);
  assert.equal(column(f, id, 'stripe_customer_id'), 'cus_late');

  // The re-run it asks for then mints the link on that same customer.
  const rerun = run(f, 'activate-late-founder.mts', lateArgs, lateOpts);
  assert.equal(rerun.status, 0, rerun.stderr + rerun.stdout);
  assert.equal(calls(f, 'POST', '/v1/customers').length, 1, 'still one customer');
  assert.equal(calls(f, 'POST', '/v1/checkout/sessions').length, 1, 'the link minted');
  assert.equal(auditCount(f, 'billing_late_founder_activation', id), 1);
});

// ---------------------------------------------------------------------------
// honor-winback-discount: adds the win-back coupon and clears the scheduled
// cancellation in Stripe, then mirrors the cleared cancellation here.
// ---------------------------------------------------------------------------

const winbackArgs = ['--email', 'staying@example.com', '--yes'];
const CANCEL_ACKED_AT = at(-2 * DAY);

function cancelingMember(f: Fixture): string {
  const id = member(f, 'staying@example.com', {
    tier: 'basic',
    subscription_status: 'active',
    stripe_customer_id: 'cus_winback',
    stripe_subscription_id: 'sub_winback',
    stripe_price_id: 'price_basic_monthly',
    cancel_at_period_end: 1,
    cancel_ack_email_sent_at: CANCEL_ACKED_AT,
  });
  audit(f, id, 'stripe_cancellation_requested', CANCEL_ACKED_AT, 'Cancellation requested for sub_winback cancel_feedback=too_expensive');
  return id;
}

// `honored`: whether Stripe already has the coupon on and the cancellation off
// before the run.
function winbackOpts(honored: boolean): RunOptions {
  const coupon = { id: 'coupon_winback_basic_monthly', object: 'coupon', percent_off: 25, duration: 'repeating', duration_in_months: 12 };
  const subscription = {
    id: 'sub_winback',
    object: 'subscription',
    status: 'active',
    customer: 'cus_winback',
    cancel_at_period_end: true,
    items: {
      object: 'list',
      data: [
        {
          id: 'si_winback',
          object: 'subscription_item',
          current_period_end: unix(20 * DAY),
          price: { id: 'price_basic_monthly', object: 'price', unit_amount: 3900, currency: 'usd' },
        },
      ],
    },
    discounts: [] as unknown[],
  };
  const after = { ...subscription, cancel_at_period_end: false, discounts: [{ id: 'di_winback', object: 'discount', coupon }] };
  return {
    env: { ...stripeKey, STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly', STRIPE_COUPON_WINBACK_BASIC_MONTHLY: 'coupon_winback_basic_monthly' },
    routes: {
      'GET api.stripe.com/v1/subscriptions/sub_winback': honored ? after : subscription,
      'GET api.stripe.com/v1/coupons/coupon_winback_basic_monthly': coupon,
      'POST api.stripe.com/v1/subscriptions/sub_winback': after,
      'POST api.stripe.com/v1/invoices/create_preview': { id: 'upcoming_winback', object: 'invoice', amount_due: 2925, currency: 'usd' },
    },
  };
}

test('honor-winback-discount: a busy database waits, so the cleared cancellation and the grant are recorded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'winback-discount');
  const id = cancelingMember(f);

  const first = await runWhileLocked(f, 'honor-winback-discount.mts', winbackArgs, winbackOpts(false));
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. staying@example\.com's subscription sub_winback now carries: coupon_winback_basic_monthly\.$/m);
  const updates = calls(f, 'POST', '/v1/subscriptions/sub_winback');
  assert.equal(updates.length, 1, 'applied once');
  assert.equal(field(updates[0], 'discounts[0][coupon]'), 'coupon_winback_basic_monthly');
  assert.equal(field(updates[0], 'cancel_at_period_end'), 'false');
  assert.equal(column(f, id, 'cancel_at_period_end'), 0, 'the cleared cancellation mirrored');
  assert.equal(column(f, id, 'cancel_ack_email_sent_at'), null);
  assert.equal(auditCount(f, 'billing_winback_discount_honored', id), 1, 'one audit row, written with the row');

  // Stripe has the coupon on and the cancellation off now: nothing left to do.
  const second = run(f, 'honor-winback-discount.mts', winbackArgs, winbackOpts(true));
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Nothing to do: /m);
  assert.equal(calls(f, 'POST', '/v1/subscriptions/sub_winback').length, 1, 'still applied once');
});

test('honor-winback-discount: a record that still fails leaves nothing half-written, and the printed command records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'winback-discount-unrecorded');
  const id = cancelingMember(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_winback_discount_honored'");

  const result = run(f, 'honor-winback-discount.mts', winbackArgs, winbackOpts(false));
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(
    result.stderr,
    /coupon_winback_basic_monthly was APPLIED to sub_winback in Stripe, and its cancellation cleared, but not recorded here: .*write blocked by the test/,
  );
  assert.equal(calls(f, 'POST', '/v1/subscriptions/sub_winback').length, 1, 'applied in Stripe');
  assert.equal(column(f, id, 'cancel_at_period_end'), 1, 'the row update rolled back with the audit row');
  assert.equal(column(f, id, 'cancel_ack_email_sent_at'), CANCEL_ACKED_AT);
  assert.equal(auditCount(f, 'billing_winback_discount_honored', id), 0);

  recordByHand(f, result.stderr);
  assert.equal(column(f, id, 'cancel_at_period_end'), 0);
  assert.equal(column(f, id, 'cancel_ack_email_sent_at'), null);
  assert.equal(auditCount(f, 'billing_winback_discount_honored', id), 1);
});
