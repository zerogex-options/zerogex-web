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

// The scripts that record a member after something that can't be taken back
// (an email, a Stripe change, an alert), run with that record step failing even
// after the wait and the retries: a trigger rejects its audit row. Each must
// leave nothing of the record half-written, exit non-zero, and print a command
// that, run as printed, finishes the record by hand. The scripts' tests under a
// busy database are in tests/busyDatabase.test.ts; the same seeds are used here.

const { fixture, member, audit, run } = await createBusyDb('busy-db-record-fails');

type Case = {
  script: string;
  args: string[];
  opts?: RunOptions;
  seed: (f: Fixture) => string;
  // The record's audit type: only that insert is rejected.
  auditType: string;
  // Whether the record is in the database.
  recorded: (f: Fixture, id: string) => boolean;
};

const latch = (name: string) => (f: Fixture, id: string) => column(f, id, name) != null;
const audited = (type: string) => (f: Fixture, id: string) => auditCount(f, type, id) > 0;

// Paid, left 40 days ago, and logged back in three days ago.
function churnedMember(f: Fixture, email: string): string {
  const id = member(f, email, { created_at: at(-200 * DAY), subscription_lapsed: 1, first_payment_at: at(-190 * DAY) });
  audit(f, id, 'stripe_cancellation_requested', at(-41 * DAY), 'Cancellation requested for sub_old cancel_feedback=too_expensive');
  audit(f, id, 'stripe_subscription_deleted', at(-40 * DAY), 'Subscription sub_old deleted');
  audit(f, id, 'login_success', at(-3 * DAY), 'Login');
  return id;
}

const soon = new Date(NOW_MS + 10 * DAY);
const paidAt = Math.floor((NOW_MS - DAY) / 1000);

const cases: Case[] = [
  {
    script: 'send-verify-reminders.mts',
    args: ['--yes'],
    seed: (f) => member(f, 'unverified@example.com', { created_at: at(-4 * HOUR), email_verified_at: null }),
    auditType: 'verify_reminder_email_sent',
    recorded: latch('verify_reminder_email_sent_at'),
  },
  {
    script: 'send-checkout-recovery.mts',
    args: ['--yes'],
    seed: (f) => {
      const id = member(f, 'abandoned@example.com');
      audit(f, id, 'billing_checkout_started', at(-48 * HOUR), 'tier=pro cadence=monthly');
      return id;
    },
    auditType: 'checkout_recovery_email_sent',
    recorded: latch('checkout_recovery_email_sent_at'),
  },
  {
    script: 'send-trial-reminders.mts',
    args: ['--yes'],
    seed: (f) =>
      member(f, 'trialing@example.com', {
        subscription_status: 'trialing',
        stripe_subscription_id: 'sub_trial',
        current_period_end: at(48 * HOUR),
        created_at: at(-5 * DAY),
      }),
    auditType: 'trial_reminder_email_sent',
    recorded: latch('trial_reminder_email_sent_at'),
  },
  {
    script: 'send-trial-value-nudge.mts',
    args: ['--yes'],
    seed: (f) =>
      member(f, 'day-two@example.com', {
        subscription_status: 'trialing',
        stripe_subscription_id: 'sub_value',
        current_period_end: at(120 * HOUR),
        created_at: at(-2 * DAY),
      }),
    auditType: 'trial_value_nudge_sent',
    recorded: latch('trial_midpoint_email_sent_at'),
  },
  {
    script: 'send-reactivation.mts',
    args: ['--yes'],
    seed: (f) => member(f, 'cold@example.com'),
    auditType: 'reactivation_email_sent',
    recorded: latch('reactivation_email_sent_at'),
  },
  {
    script: 'send-card-expiry-reminders.mts',
    args: ['--yes'],
    opts: {
      env: { STRIPE_SECRET_KEY: 'sk_test_busy_db' },
      routes: {
        'GET api.stripe.com/v1/subscriptions/sub_card': {
          id: 'sub_card',
          object: 'subscription',
          status: 'active',
          customer: 'cus_card',
          default_payment_method: {
            id: 'pm_card',
            object: 'payment_method',
            card: { brand: 'visa', last4: '4242', exp_month: soon.getUTCMonth() + 1, exp_year: soon.getUTCFullYear() },
          },
        },
      },
    },
    seed: (f) =>
      member(f, 'expiring@example.com', {
        subscription_status: 'active',
        stripe_subscription_id: 'sub_card',
        stripe_customer_id: 'cus_card',
        current_period_end: at(20 * DAY),
      }),
    auditType: 'card_expiry_reminder_sent',
    recorded: latch('card_expiry_notified_ym'),
  },
  {
    script: 'send-grace-expiry-warnings.mts',
    args: ['--yes'],
    seed: (f) =>
      member(f, 'past-due@example.com', {
        subscription_status: 'past_due',
        stripe_subscription_id: 'sub_past_due',
        payment_grace_started_at: at(-60 * HOUR),
        payment_grace_reason: 'renewal',
      }),
    auditType: 'grace_expiry_warning_email_sent',
    recorded: latch('payment_grace_warning_sent_for'),
  },
  {
    script: 'send-winback.mts',
    args: ['--yes'],
    seed: (f) => churnedMember(f, 'churned@example.com'),
    auditType: 'winback_email_sent',
    recorded: latch('winback_email_sent_at'),
  },
  {
    script: 'send-return-intent.mts',
    args: ['--yes'],
    seed: (f) => churnedMember(f, 'came-back@example.com'),
    auditType: 'return_intent_email_sent',
    recorded: latch('return_intent_email_sent_at'),
  },
  {
    script: 'apply-founding-lifetime.mts',
    args: ['--yes'],
    opts: {
      env: { STRIPE_SECRET_KEY: 'sk_test_busy_db', STRIPE_COUPON_FOUNDING_LIFETIME: 'coupon_lifetime' },
      routes: {
        'GET api.stripe.com/v1/subscriptions/sub_founder': { id: 'sub_founder', object: 'subscription', status: 'active' },
        'POST api.stripe.com/v1/subscriptions/sub_founder': { id: 'sub_founder', object: 'subscription', status: 'active' },
      },
    },
    seed: (f) =>
      member(f, 'founder@example.com', {
        tier: 'basic',
        subscription_status: 'active',
        stripe_subscription_id: 'sub_founder',
        founding_member_started_at: at(-365 * DAY),
      }),
    auditType: 'billing_founding_lifetime_applied_batch',
    recorded: latch('founding_lifetime_applied_at'),
  },
  {
    script: 'scan-orphan-payments.mts',
    args: ['--alert', '--to', 'ops@zerogex.test'],
    opts: {
      env: { STRIPE_SECRET_KEY: 'sk_test_busy_db', STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly' },
      routes: {
        'GET api.stripe.com/v1/invoices': {
          object: 'list',
          url: '/v1/invoices',
          has_more: false,
          data: [
            {
              id: 'in_stranded',
              object: 'invoice',
              customer: 'cus_stranded',
              status: 'paid',
              amount_paid: 4900,
              currency: 'usd',
              billing_reason: 'manual',
              created: paidAt,
              status_transitions: { paid_at: paidAt },
            },
          ],
        },
      },
    },
    seed: (f) => member(f, 'stranded@example.com', { stripe_customer_id: 'cus_stranded' }),
    auditType: 'orphan_payment_alert_sent',
    recorded: (f) => auditCount(f, 'orphan_payment_alert_sent', null) > 0,
  },
  {
    script: 'send-cancel-reason-followup.mts',
    args: ['--yes'],
    seed: (f) => {
      const id = member(f, 'too-pricey@example.com', { subscription_lapsed: 1 });
      audit(f, id, 'stripe_cancellation_requested', at(-3 * DAY), 'Cancellation requested for sub_old cancel_feedback=too_expensive');
      return id;
    },
    auditType: 'cancel_reason_followup_sent',
    // The win-back it arms is part of the same record.
    recorded: (f, id) => audited('cancel_reason_followup_sent')(f, id) && latch('winback_email_sent_at')(f, id),
  },
  {
    script: 'send-welcome-email.mts',
    args: ['--email', 'new-member@example.com', '--variant', 'paid'],
    seed: (f) => member(f, 'new-member@example.com', { tier: 'basic', subscription_lapsed: 1 }),
    auditType: 'paid_welcome_email_sent',
    recorded: latch('paid_welcome_email_sent_at'),
  },
  {
    script: 'back-credit-trial.mts',
    args: ['--yes'],
    opts: {
      env: { STRIPE_SECRET_KEY: 'sk_test_busy_db' },
      routes: {
        'GET api.stripe.com/v1/subscriptions/sub_monthly': {
          id: 'sub_monthly',
          object: 'subscription',
          items: { object: 'list', data: [{ id: 'si_1', object: 'subscription_item', price: { id: 'price_m', object: 'price', recurring: { interval: 'month' } } }] },
        },
        'GET api.stripe.com/v1/invoices': {
          object: 'list',
          url: '/v1/invoices',
          has_more: false,
          data: [{ id: 'in_paid', object: 'invoice', amount_paid: 3100, currency: 'usd' }],
        },
        'POST api.stripe.com/v1/customers/cus_monthly/balance_transactions': { id: 'cbtxn_1', object: 'customer_balance_transaction', amount: -700, currency: 'usd' },
      },
    },
    // An address the shell would mangle if the printed command let it.
    seed: (f) =>
      member(f, "o'brien$x`y@example.com", {
        tier: 'basic',
        subscription_status: 'active',
        stripe_customer_id: 'cus_monthly',
        stripe_subscription_id: 'sub_monthly',
      }),
    auditType: 'billing_trial_back_credit',
    recorded: audited('billing_trial_back_credit'),
  },
  {
    script: 'credit-founders-july1-delay.mts',
    args: ['--yes'],
    opts: {
      env: { STRIPE_SECRET_KEY: 'sk_test_busy_db', STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly' },
      routes: {
        'POST api.stripe.com/v1/customers/cus_founder/balance_transactions': { id: 'cbtxn_2', object: 'customer_balance_transaction', amount: -1200, currency: 'usd' },
      },
    },
    seed: (f) =>
      member(f, 'founder@example.com', {
        tier: 'basic',
        stripe_customer_id: 'cus_founder',
        stripe_price_id: 'price_basic_monthly',
        founding_member_started_at: at(-150 * DAY),
      }),
    auditType: 'billing_founding_july1_credit',
    recorded: audited('billing_founding_july1_credit'),
  },
];

for (const c of cases) {
  test(`${c.script}: a record step that still fails is undone whole, named, and finished by the printed command`, { skip: sqlite3Missing }, (t) => {
    const f = fixture(t, c.script.replace(/\.m?[jt]s$/, ''));
    const id = c.seed(f);
    blockWrites(f, 'INSERT', 'audit_events', `NEW.type = '${c.auditType}'`);

    const result = run(f, c.script, c.args, c.opts);
    assert.notEqual(result.status, 0, result.stderr + result.stdout);
    assert.equal(c.recorded(f, id), false, 'nothing of the record is left behind');

    unblockWrites(f);
    const command = printedCommand(result.stderr);
    assert.ok(command, `no command to finish by hand in:\n${result.stderr}`);
    const ran = runPrinted(command);
    assert.equal(ran.status, 0, ran.stderr);
    assert.equal(c.recorded(f, id), true, 'the printed command records it');
  });
}

test('expire-partner-grants.mjs: a downgrade whose audit row fails writes nothing, and no key is revoked', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'partner-grants');
  const id = member(f, 'partner@example.com', {
    tier: 'pro',
    partner_tier: 'creator',
    partner_pro_grant_expires_at: at(-10 * DAY),
  });
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'partner_grant_expired'");

  const result = run(f, 'expire-partner-grants.mjs', ['--yes'], {
    env: { ZEROGEX_API_BASE_URL: 'https://keys.zerogex.test', ZEROGEX_API_TOKEN: 'test-bearer', ZEROGEX_ADMIN_TOKEN: 'test-admin' },
    routes: { 'POST keys.zerogex.test/api/admin/api-keys/revoke-all': { revoked: 1 } },
  });
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stderr, /downgrade\(s\) FAILED and wrote nothing; the next run retries them/);
  assert.equal(column(f, id, 'tier'), 'pro', 'still Pro: the downgrade rolled back with its audit row');
  assert.deepEqual(httpCalls(f), [], 'and its keys are left for the retry');
});
