import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCohortReport, type CohortAuditInput, type CohortUserInput } from '../core/cohortRetention.ts';

// The definitions the business runs on. Each case below is one of the customer
// shapes that a plausible-looking implementation classifies wrongly — and every
// one of them was classified wrongly before this suite existed.

const NOW = '2026-09-12T00:00:00Z';
const DAY = 86_400_000;
const ago = (days: number, hours = 0) =>
  new Date(Date.parse(NOW) - days * DAY + hours * 3_600_000).toISOString();
const ahead = (days: number) => new Date(Date.parse(NOW) + days * DAY).toISOString();

const user = (
  id: string,
  createdAt: string,
  overrides: Partial<CohortUserInput> = {},
): CohortUserInput => ({
  id,
  email: `${id}@example.test`,
  createdAt,
  firstPaymentAt: null,
  currentStatus: null,
  currentTier: 'public',
  currentPriceId: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  signupUtmSource: null,
  foundingRate: false,
  cadence: 'monthly',
  cadenceSource: 'current_price',
  ...overrides,
});

const paying = (id: string, createdAt: string, firstPaymentAt: string, overrides: Partial<CohortUserInput> = {}) =>
  user(id, createdAt, { firstPaymentAt, currentStatus: 'active', currentTier: 'pro', currentPriceId: 'price_pro', ...overrides });

const churned = (id: string, createdAt: string, firstPaymentAt: string, overrides: Partial<CohortUserInput> = {}) =>
  user(id, createdAt, { firstPaymentAt, currentStatus: null, currentTier: 'public', ...overrides });

const event = (userId: string, type: string, createdAt: string, message: string): CohortAuditInput =>
  ({ userId, type, createdAt, message });
const sync = (id: string, at: string, status: string, tier: string, sub = `sub_${id}`, cancelling = false) =>
  event(id, 'stripe_subscription_sync', at, `Subscription ${sub} status=${status} tier=${tier} cancelAtPeriodEnd=${cancelling}`);
const deleted = (id: string, at: string, sub = `sub_${id}`) =>
  event(id, 'stripe_subscription_deleted', at, `Subscription ${sub} ended; tier reset to public`);
const cancelRequested = (id: string, at: string, sub = `sub_${id}`, feedback = 'unused') =>
  event(id, 'stripe_cancellation_requested', at, `Cancellation requested for sub ${sub} | cancel_feedback=${feedback}`);
const failed = (id: string, at: string, invoice = `in_${id}`) =>
  event(id, 'stripe_payment_failed', at, `Invoice ${invoice} payment failed for sub sub_${id} (attempt 1)`);

const report = (users: CohortUserInput[], events: CohortAuditInput[]) => buildCohortReport(users, events, NOW);
const only = (users: CohortUserInput[], events: CohortAuditInput[]) => report(users, events).users[0];

// ---------------------------------------------------------------------------
// Trial → paid
// ---------------------------------------------------------------------------

test('trial → paid is the intersection, so it can never exceed 100%', () => {
  // Four trials, two of which converted; three more customers paid without ever
  // starting one. The old numerator (everyone who paid) gave 5/4 = 125%.
  const users = [
    ...[0, 1].map((i) => paying(`conv${i}`, ago(200), ago(190))),
    ...[0, 1].map((i) => user(`trialonly${i}`, ago(200))),
    ...[0, 1, 2].map((i) => paying(`direct${i}`, ago(200), ago(190))),
  ];
  const events = [
    ...[0, 1].flatMap((i) => [sync(`conv${i}`, ago(197), 'trialing', 'pro'), sync(`conv${i}`, ago(190), 'active', 'pro')]),
    ...[0, 1].map((i) => sync(`trialonly${i}`, ago(197), 'trialing', 'pro')),
    ...[0, 1, 2].map((i) => sync(`direct${i}`, ago(190), 'active', 'pro')),
  ];
  const result = report(users, events).summary;

  assert.equal(result.trialStarts, 4);
  assert.equal(result.trialThenPaid, 2, 'only trial starters who later paid');
  assert.equal(result.directToPaid, 3);
  assert.equal(result.becamePaid, 5);
  assert.equal(result.trialToPaid, 0.5, '2 of 4 trial starters — not 5 of 4');
});

// ---------------------------------------------------------------------------
// Retention eligibility
// ---------------------------------------------------------------------------

test('a customer who lost access before the milestone is a failure, not "too new"', () => {
  // Paid 10 days ago, access gone on day 7. Thirty days cannot now be reached,
  // so the answer is already known and must be in the denominator.
  const result = only(
    [churned('dead', ago(12), ago(10))],
    [sync('dead', ago(10), 'active', 'pro'), deleted('dead', ago(3))],
  );
  assert.equal(result.retained['30'], false);
  assert.equal(result.retained['60'], false);
});

test('a young customer who still has access stays unanswerable', () => {
  const result = only([paying('fresh', ago(5), ago(3))], [sync('fresh', ago(3), 'active', 'pro')]);
  assert.deepEqual(result.retained, { '30': null, '60': null, '90': null });
});

test('the milestone ladder resolves exactly as far as the loss reaches', () => {
  // Churned on day 45: past 30, short of 60 and 90.
  const result = only(
    [churned('mid', ago(200), ago(190))],
    [sync('mid', ago(190), 'active', 'pro'), deleted('mid', ago(145))],
  );
  assert.equal(result.retained['30'], true);
  assert.equal(result.retained['60'], false);
  assert.equal(result.retained['90'], false);
  assert.equal(result.daysPaidBeforePermanentLoss, 45);
});

test('the fast churners are in the denominator, which is the point', () => {
  const summary = report(
    [
      paying('kept', ago(200), ago(190)),
      churned('quick', ago(20), ago(18)),
    ],
    [
      sync('kept', ago(190), 'active', 'pro'),
      sync('quick', ago(18), 'active', 'pro'),
      deleted('quick', ago(14)),
    ],
  ).summary;
  assert.equal(summary.retention['30'].eligible, 2, 'the 4-day customer counts');
  assert.equal(summary.retention['30'].retained, 1);
  assert.equal(summary.retention['30'].rate, 0.5, 'not 100%');
});

// ---------------------------------------------------------------------------
// Scheduled cancellation
// ---------------------------------------------------------------------------

test('a scheduled cancellation keeps the access it paid for', () => {
  // Cancelled on day 10 of a period running to day 45. They had paid access on
  // day 30, so the 30-day milestone is a success, not a failure.
  const result = only(
    [paying('leaving', ago(60), ago(50), { cancelAtPeriodEnd: true, currentPeriodEnd: ahead(5) })],
    [
      sync('leaving', ago(50), 'active', 'pro'),
      cancelRequested('leaving', ago(40)),
      sync('leaving', ago(40), 'active', 'pro', 'sub_leaving', true),
    ],
  );
  assert.equal(result.retained['30'], true, 'still entitled at day 30');
  assert.equal(result.paidCustomerState, 'active', 'not churned until access ends');
  assert.equal(result.currentlyEntitled, true);
  assert.equal(result.scheduledAccessEndAt, ahead(5));
  assert.equal(result.lastAccessEndedAt, null, 'nothing has ended yet');
});

// ---------------------------------------------------------------------------
// Interruption vs. permanent loss
// ---------------------------------------------------------------------------

test('a customer who lapsed and came back is active, and is not "lost"', () => {
  const result = only(
    [paying('returner', ago(300), ago(290))],
    [
      sync('returner', ago(290), 'active', 'pro', 'sub_first'),
      deleted('returner', ago(285), 'sub_first'),
      sync('returner', ago(200), 'active', 'pro', 'sub_second'),
    ],
  );
  assert.equal(result.paidCustomerState, 'active');
  assert.equal(result.reactivatedAfterInterruption, true);
  assert.equal(result.daysToFirstInterruption, 5, 'the interruption is on record');
  assert.equal(result.daysPaidBeforePermanentLoss, null, 'but nothing was permanently lost');
  assert.equal(result.churnKind, null, 'a returning customer has no standing churn');
  // The gap is still a real retention failure: day 30 fell inside it. Being a
  // customer today does not retroactively mean they were one in month one.
  assert.equal(result.retained['30'], false, 'day 30 landed in the gap');
  assert.equal(result.retained['90'], true, 'and they were back by day 90');
});

test('an interruption is counted separately from a loss that still stands', () => {
  const rows = report(
    [paying('back', ago(300), ago(290)), churned('gone', ago(300), ago(290))],
    [
      sync('back', ago(290), 'active', 'pro', 'sub_b1'),
      deleted('back', ago(287), 'sub_b1'),
      sync('back', ago(250), 'active', 'pro', 'sub_b2'),
      sync('gone', ago(290), 'active', 'pro'),
      deleted('gone', ago(287)),
    ],
  ).cohorts[0];
  assert.equal(rows.interrupted['7'].count, 2, 'both stopped inside 7 days');
  assert.equal(rows.permanentlyLost['7'].count, 1, 'only one is still gone');
});

// ---------------------------------------------------------------------------
// Loss attribution
// ---------------------------------------------------------------------------

test('voluntary, nonpayment and unattributed losses stay distinct', () => {
  const result = report(
    [
      churned('quit', ago(200), ago(190)),
      churned('declined', ago(200), ago(190)),
      churned('vanished', ago(200), ago(190)),
    ],
    [
      sync('quit', ago(190), 'active', 'pro'),
      cancelRequested('quit', ago(100), 'sub_quit', 'too_expensive'),
      deleted('quit', ago(95)),
      sync('declined', ago(190), 'active', 'pro'),
      failed('declined', ago(100)),
      deleted('declined', ago(95)),
      sync('vanished', ago(190), 'active', 'pro'),
      deleted('vanished', ago(95)),
    ],
  );
  const by = (id: string) => result.users.find((u) => u.id === id);
  assert.equal(by('quit')?.churnKind, 'voluntary');
  assert.equal(by('quit')?.cancellationReason, 'Too expensive');
  assert.equal(by('declined')?.churnKind, 'payment_failure');
  assert.equal(by('vanished')?.churnKind, 'other');
  assert.deepEqual(result.summary.paidCustomerStates, {
    active: 0, voluntarily_churned: 1, involuntarily_churned: 1, other_unknown: 1,
  });
});

test('the four current states always reconcile to the ever-paid count', () => {
  const result = report(
    [
      paying('a', ago(300), ago(290)),
      churned('b', ago(300), ago(290)),
      churned('c', ago(300), ago(290)),
      user('d', ago(300)),
      paying('e', ago(300), ago(290), { cancelAtPeriodEnd: true, currentPeriodEnd: ahead(9) }),
    ],
    [
      sync('a', ago(290), 'active', 'pro'),
      sync('b', ago(290), 'active', 'pro'), cancelRequested('b', ago(100)), deleted('b', ago(95)),
      sync('c', ago(290), 'active', 'pro'), failed('c', ago(100)), deleted('c', ago(95)),
      sync('e', ago(290), 'active', 'pro'),
    ],
  ).summary;
  const states = Object.values(result.paidCustomerStates).reduce((sum, n) => sum + n, 0);
  assert.equal(states, result.becamePaid);
  assert.equal(result.becamePaid, 4, 'the never-paid account is not in the population');
  assert.equal(result.paidCustomerStates.active, 2, 'the scheduled cancellation is still active');
});

// ---------------------------------------------------------------------------
// Payment failures
// ---------------------------------------------------------------------------

test('ever-paid failures and never-paid first-charge failures never mix', () => {
  const summary = report(
    [
      paying('recovered', ago(200), ago(190)),
      user('neverpaid', ago(200)),
      user('neverpaid2', ago(200)),
    ],
    [
      sync('recovered', ago(190), 'active', 'pro'),
      failed('recovered', ago(100)),
      event('recovered', 'stripe_invoice_paid', ago(99), 'Invoice in_rec paid for sub sub_recovered amount=5900 billing_reason=subscription_cycle period_end=1790000000 price=price_pro'),
      sync('neverpaid', ago(197), 'trialing', 'pro'),
      failed('neverpaid', ago(190)),
      failed('neverpaid', ago(188), 'in_neverpaid_b'),
      sync('neverpaid2', ago(197), 'trialing', 'pro'),
      failed('neverpaid2', ago(190)),
    ],
  ).summary;
  assert.equal(summary.failedPaymentCustomers, 1, 'unique paying customers affected');
  assert.equal(summary.failedPaymentAttempts, 1, 'attempts, counted separately');
  assert.equal(summary.paymentRecovered, 1);
  assert.equal(summary.neverPaidFailedPaymentCustomers, 2, 'unique people');
  assert.equal(summary.neverPaidFailedPaymentEvents, 3, 'events, not people');
});

// ---------------------------------------------------------------------------
// Invoice parsing
// ---------------------------------------------------------------------------

test('a mid-period proration is money, and is not a billing period', () => {
  const result = only(
    [paying('upgrader', ago(200), ago(190))],
    [
      sync('upgrader', ago(190), 'active', 'pro'),
      event('upgrader', 'stripe_invoice_paid', ago(190), 'Invoice in_1 paid for sub sub_upgrader amount=3900 billing_reason=subscription_create period_end=1788000000 price=price_basic'),
      event('upgrader', 'stripe_invoice_paid', ago(175), 'Invoice in_2 paid for sub sub_upgrader amount=1000 billing_reason=subscription_update period_end=1788000000 price=price_pro'),
      event('upgrader', 'stripe_invoice_paid', ago(160), 'Invoice in_3 paid for sub sub_upgrader amount=5900 billing_reason=subscription_cycle period_end=1790600000 price=price_pro'),
    ],
  );
  assert.equal(result.paidInvoices.length, 3, 'all three were real money');
  assert.equal(result.cycleInvoices.length, 2, 'the proration is not a period');
  assert.deepEqual(result.cycleInvoices.map((i) => i.billingReason), ['subscription_create', 'subscription_cycle']);
});

test('a duplicated invoice — audit row plus Stripe import — is counted once', () => {
  const line = 'Invoice in_dup paid for sub sub_dupe amount=5900 billing_reason=subscription_cycle period_end=1790600000 price=price_pro';
  const result = only(
    [paying('dupe', ago(200), ago(190))],
    [
      sync('dupe', ago(190), 'active', 'pro'),
      event('dupe', 'stripe_invoice_paid', ago(160), line),
      event('dupe', 'stripe_invoice_paid', ago(160, 1), line),
    ],
  );
  assert.equal(result.paidInvoices.length, 1);
});

// ---------------------------------------------------------------------------
// Annual and plan changes
// ---------------------------------------------------------------------------

test('an annual customer is a customer, on a different clock', () => {
  const result = only(
    [paying('annual', ago(400), ago(390), { cadence: 'annual', currentPriceId: 'price_pro_annual' })],
    [sync('annual', ago(390), 'active', 'pro')],
  );
  assert.equal(result.cadence, 'annual');
  assert.deepEqual(result.retained, { '30': true, '60': true, '90': true });
});

test('a tier change inside one subscription is not an interruption', () => {
  const result = only(
    [paying('upgrade', ago(200), ago(190))],
    [
      sync('upgrade', ago(190), 'active', 'basic'),
      sync('upgrade', ago(150), 'active', 'pro'),
    ],
  );
  assert.equal(result.firstAccessEndedAt, null, 'basic and pro are both paid access');
  assert.equal(result.tier, 'pro', 'reports the tier they ended up on');
  assert.equal(result.currentlyEntitled, true);
});

test('a real invoice beats the backfilled first_payment_at column', () => {
  // Production case: users.first_payment_at was backfilled from updated_at, so
  // this customer's column says August while their first invoice says June.
  // Trusting the column pushed every milestone two months forward and emptied
  // the 60- and 90-day denominators of everyone still subscribed.
  const result = only(
    [paying('legacy', ago(200), ago(42))],
    [
      sync('legacy', ago(103), 'active', 'pro'),
      event('legacy', 'stripe_invoice_paid', ago(103), `Invoice in_l1 paid for sub sub_legacy amount=1200 billing_reason=subscription_create period_start=${Math.floor(Date.parse(ago(103)) / 1000)} period_end=${Math.floor(Date.parse(ago(73)) / 1000)} price=price_basic`),
      event('legacy', 'stripe_invoice_paid', ago(73), `Invoice in_l2 paid for sub sub_legacy amount=1200 billing_reason=subscription_cycle period_start=${Math.floor(Date.parse(ago(73)) / 1000)} period_end=${Math.floor(Date.parse(ago(43)) / 1000)} price=price_basic`),
    ],
  );
  assert.equal(result.firstPaidAt, ago(103), 'the invoice is the first payment');
  assert.equal(result.retained['90'], true, 'day 90 has passed and they still have access');
});

test('a first_payment_at earlier than any invoice is still believed', () => {
  // A partial invoice import must not shorten a customer's history: the column
  // is then the only evidence of an earlier payment, so the earliest wins.
  const result = only(
    [paying('partial', ago(300), ago(280))],
    [
      sync('partial', ago(280), 'active', 'pro'),
      event('partial', 'stripe_invoice_paid', ago(40), 'Invoice in_p1 paid for sub sub_partial amount=1200 billing_reason=subscription_cycle period_end=1790000000 price=price_basic'),
    ],
  );
  assert.equal(result.firstPaidAt, ago(280));
});

test('an invoice carries the period it paid for, at both ends', () => {
  const result = only(
    [paying('annualish', ago(200), ago(190))],
    [
      sync('annualish', ago(190), 'active', 'pro'),
      event('annualish', 'stripe_invoice_paid', ago(190), `Invoice in_a1 paid for sub sub_annualish amount=19000 billing_reason=subscription_create period_start=${Math.floor(Date.parse(ago(190)) / 1000)} period_end=${Math.floor(Date.parse(ago(-175)) / 1000)} price=price_unmapped`),
    ],
  );
  const invoice = result.cycleInvoices[0];
  assert.equal(invoice.periodStart, ago(190));
  const days = (Date.parse(invoice.periodEnd ?? '') - Date.parse(invoice.periodStart ?? '')) / 86_400_000;
  assert.ok(days > 300, 'a year-long period is visible without mapping the price');
});
