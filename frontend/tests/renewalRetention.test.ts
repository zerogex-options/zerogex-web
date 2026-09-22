import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCohortReport, type CohortAuditInput, type CohortUserInput } from '../core/cohortRetention.ts';
import { buildRenewalReport } from '../core/renewalRetention.ts';
import { DEFAULT_AMOUNTS } from '../core/pricing.ts';

// Does the second payment happen? The cases here are the ones where a renewal
// dashboard normally lies: counting a proration as a renewal, counting a
// customer whose month has not finished, counting a renewal that fell outside
// the invoice record as a failure, and treating a scheduled cancellation as
// churn that has already happened.

const NOW = '2026-09-12T00:00:00Z';
const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.parse(NOW) - days * DAY).toISOString();
const ahead = (days: number) => new Date(Date.parse(NOW) + days * DAY).toISOString();
const unix = (isoValue: string) => Math.floor(Date.parse(isoValue) / 1000);

const monthly = (id: string, firstPaidDaysAgo: number, overrides: Partial<CohortUserInput> = {}): CohortUserInput => ({
  id,
  email: `${id}@example.test`,
  createdAt: ago(firstPaidDaysAgo + 7),
  firstPaymentAt: ago(firstPaidDaysAgo),
  currentStatus: 'active',
  currentTier: 'pro',
  currentPriceId: 'price_pro',
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  signupUtmSource: null,
  foundingRate: false,
  cadence: 'monthly',
  cadenceSource: 'current_price',
  ...overrides,
});

const sync = (id: string, at: string, status = 'active', tier = 'pro'): CohortAuditInput =>
  ({ userId: id, type: 'stripe_subscription_sync', createdAt: at, message: `Subscription sub_${id} status=${status} tier=${tier} cancelAtPeriodEnd=false` });

const invoice = (
  id: string,
  paidAt: string,
  periodEnd: string,
  reason: string,
  seq: number,
  amount = 5900,
): CohortAuditInput => ({
  userId: id,
  type: 'stripe_invoice_paid',
  createdAt: paidAt,
  message: `Invoice in_${id}_${seq} paid for sub sub_${id} amount=${amount} billing_reason=${reason} period_end=${unix(periodEnd)} price=price_pro`,
});

const failed = (id: string, at: string): CohortAuditInput =>
  ({ userId: id, type: 'stripe_payment_failed', createdAt: at, message: `Invoice in_${id}_x payment failed for sub sub_${id} (attempt 1)` });

const cancelRequested = (id: string, at: string): CohortAuditInput =>
  ({ userId: id, type: 'stripe_cancellation_requested', createdAt: at, message: `Cancellation requested for sub sub_${id}` });

const renewals = (users: CohortUserInput[], events: CohortAuditInput[]) =>
  buildRenewalReport(buildCohortReport(users, events, NOW).users, DEFAULT_AMOUNTS, NOW);

// ---------------------------------------------------------------------------

test('a renewal is a cycle invoice that cleared, and nothing else is', () => {
  const users = [
    monthly('renewed', 70),
    monthly('proration', 70),
    monthly('lapsed', 70, { currentStatus: null, currentTier: 'public' }),
  ];
  const events = [
    // Renewed for real.
    sync('renewed', ago(70)),
    invoice('renewed', ago(70), ago(40), 'subscription_create', 1),
    invoice('renewed', ago(40), ago(10), 'subscription_cycle', 2),
    // Upgraded mid-period — real money, not a renewal, and the first period has
    // ended without a cycle invoice.
    sync('proration', ago(70)),
    invoice('proration', ago(70), ago(40), 'subscription_create', 1),
    invoice('proration', ago(55), ago(40), 'subscription_update', 2, 1200),
    // Simply did not come back.
    sync('lapsed', ago(70)),
    invoice('lapsed', ago(70), ago(40), 'subscription_create', 1),
  ];
  const step = renewals(users, events).steps[0];

  assert.equal(step.eligible, 3, 'all three finished their first month');
  assert.equal(step.renewed, 1, 'only the cycle invoice counts');
  assert.equal(step.rate, 1 / 3);
  assert.equal(step.notRenewedUnknown, 2);
});

test('a customer still inside month one is not in the denominator', () => {
  const report = renewals(
    [monthly('young', 10)],
    [sync('young', ago(10)), invoice('young', ago(10), ahead(20), 'subscription_create', 1)],
  );
  const step = report.steps[0];
  assert.equal(step.eligible, 0, 'no outcome has happened yet');
  assert.equal(step.approaching, 1);
  assert.equal(step.rate, null);
});

test('a cancellation scheduled before the first renewal is reported, not counted as a loss', () => {
  const report = renewals(
    [monthly('leaving', 10, { cancelAtPeriodEnd: true, currentPeriodEnd: ahead(20) })],
    [
      sync('leaving', ago(10)),
      invoice('leaving', ago(10), ahead(20), 'subscription_create', 1),
      cancelRequested('leaving', ago(2)),
    ],
  );
  const step = report.steps[0];
  assert.equal(step.approaching, 1);
  assert.equal(step.approachingScheduledCancel, 1, 'the early-warning number');
  assert.equal(step.eligible, 0, 'their renewal has not come due');
  assert.equal(step.rate, null, 'and the rate does not pretend it has');
});

test('a renewal lost to a declined card is separated from one simply not taken', () => {
  const users = [
    monthly('declined', 70, { currentStatus: null, currentTier: 'public' }),
    monthly('quit', 70, { currentStatus: null, currentTier: 'public' }),
  ];
  const events = [
    sync('declined', ago(70)),
    invoice('declined', ago(70), ago(40), 'subscription_create', 1),
    failed('declined', ago(39)),
    sync('quit', ago(70)),
    invoice('quit', ago(70), ago(40), 'subscription_create', 1),
    cancelRequested('quit', ago(50)),
  ];
  const step = renewals(users, events).steps[0];
  assert.equal(step.eligible, 2);
  assert.equal(step.notRenewedFailedPayment, 1);
  assert.equal(step.notRenewedVoluntary, 1);
  assert.equal(step.renewed, 0);
});

test('a renewal due before the invoice record began is unknown, never a failure', () => {
  // The only invoice anywhere is 20 days old, so nothing before then is visible.
  const users = [monthly('ancient', 400, { currentStatus: null, currentTier: 'public' }), monthly('recent', 50)];
  const events = [
    sync('ancient', ago(400)),
    sync('recent', ago(50)),
    invoice('recent', ago(20), ago(1), 'subscription_create', 1),
  ];
  const report = renewals(users, events);
  const step = report.steps[0];

  assert.equal(report.observableFrom?.slice(0, 10), ago(20).slice(0, 10));
  assert.equal(step.unobservable, 1, 'the customer with no invoice on file');
  assert.equal(step.eligible, 1, 'only the one whose period we could see');
  assert.equal(step.renewed, 0);
  assert.match(report.limitations.join(' '), /never as a failure/);
});

test('renewal #2 is only asked of customers who cleared renewal #1', () => {
  const users = [monthly('loyal', 100), monthly('oneAndDone', 100, { currentStatus: null, currentTier: 'public' })];
  const events = [
    sync('loyal', ago(100)),
    invoice('loyal', ago(100), ago(70), 'subscription_create', 1),
    invoice('loyal', ago(70), ago(40), 'subscription_cycle', 2),
    invoice('loyal', ago(40), ago(10), 'subscription_cycle', 3),
    sync('oneAndDone', ago(100)),
    invoice('oneAndDone', ago(100), ago(70), 'subscription_create', 1),
  ];
  const steps = renewals(users, events).steps;
  assert.equal(steps[0].eligible, 2);
  assert.equal(steps[0].renewed, 1);
  assert.equal(steps[1].eligible, 1, 'only the customer who made it past renewal #1');
  assert.equal(steps[1].renewed, 1);
  // Their third period ended ten days ago with no fourth invoice on file, so the
  // question is live and the answer is "not yet seen" rather than "renewed".
  assert.equal(steps[2].eligible, 1);
  assert.equal(steps[2].renewed, 0);
  assert.equal(steps[2].notRenewedUnknown, 1);
});

test('annual subscribers are left out of the monthly ladder entirely', () => {
  const report = renewals(
    [monthly('yearly', 200, { cadence: 'annual' }), monthly('month', 200, { currentStatus: null, currentTier: 'public' })],
    [
      sync('yearly', ago(200)),
      invoice('yearly', ago(200), ago(170), 'subscription_create', 1),
      sync('month', ago(200)),
      invoice('month', ago(200), ago(170), 'subscription_create', 1),
    ],
  );
  assert.equal(report.monthlyCustomers, 1, 'the annual customer is not a monthly customer');
  assert.equal(report.steps[0].eligible, 1);
});

// ---------------------------------------------------------------------------
// The at-risk pool
// ---------------------------------------------------------------------------

test('scheduled cancellations are priced, bucketed by date, and still counted as paying', () => {
  const users = [
    monthly('soon', 40, { cancelAtPeriodEnd: true, currentPeriodEnd: ahead(3) }),
    monthly('later', 40, { cancelAtPeriodEnd: true, currentPeriodEnd: ahead(20) }),
    monthly('annual', 40, { cadence: 'annual', cancelAtPeriodEnd: true, currentPeriodEnd: ahead(90) }),
    monthly('staying', 40),
  ];
  const events = ['soon', 'later', 'annual', 'staying'].map((id) => sync(id, ago(40)));
  const pool = renewals(users, events).atRisk;

  assert.equal(pool.total, 3, 'the customer with no cancellation is not at risk');
  assert.equal(pool.monthly, 2);
  assert.equal(pool.annual, 1);
  assert.equal(pool.endingWithin7Days, 1);
  assert.equal(pool.endingWithin30Days, 2);
  assert.equal(pool.endingAfter30Days, 1);
  // Two monthly Pro subscribers at the list rate.
  assert.equal(pool.monthlyMrrAtRisk, DEFAULT_AMOUNTS.pro.monthly.list * 2);
  // The annual figure is the contract, not the monthly slice of it.
  assert.equal(pool.annualRevenueAtRisk, Math.round(DEFAULT_AMOUNTS.pro.annual.list * 12 * 100) / 100);
  assert.equal(pool.customers[0].email, 'soon@example.test', 'soonest first');
});

test('a founding subscriber is priced at the rate they actually pay', () => {
  const pool = renewals(
    [monthly('founder', 40, { foundingRate: true, cancelAtPeriodEnd: true, currentPeriodEnd: ahead(5) })],
    [sync('founder', ago(40))],
  ).atRisk;
  assert.equal(pool.monthlyMrrAtRisk, DEFAULT_AMOUNTS.pro.monthly.founding);
});

test('an unmappable plan contributes nothing rather than a guess, and says so', () => {
  const pool = renewals(
    [monthly('mystery', 40, { cadence: null, cadenceSource: 'unknown', cancelAtPeriodEnd: true, currentPeriodEnd: ahead(5) })],
    [sync('mystery', ago(40))],
  ).atRisk;
  assert.equal(pool.total, 1);
  assert.equal(pool.cadenceUnknown, 1);
  assert.equal(pool.unpriced, 1);
  assert.equal(pool.monthlyMrrAtRisk, 0);
});

test('first renewal by cohort separates the rate from the cancellations coming', () => {
  const users = [
    monthly('a', 70),
    monthly('b', 70, { currentStatus: null, currentTier: 'public' }),
    monthly('c', 10, { cancelAtPeriodEnd: true, currentPeriodEnd: ahead(20) }),
  ];
  const events = [
    sync('a', ago(70)), invoice('a', ago(70), ago(40), 'subscription_create', 1), invoice('a', ago(40), ago(10), 'subscription_cycle', 2),
    sync('b', ago(70)), invoice('b', ago(70), ago(40), 'subscription_create', 1),
    sync('c', ago(10)), invoice('c', ago(10), ahead(20), 'subscription_create', 1), cancelRequested('c', ago(1)),
  ];
  const rows = renewals(users, events).cohorts;
  const totals = rows.reduce((acc, row) => ({
    eligible: acc.eligible + row.eligible,
    renewed: acc.renewed + row.renewed,
    cancelling: acc.cancelling + row.approachingScheduledCancel,
  }), { eligible: 0, renewed: 0, cancelling: 0 });
  assert.deepEqual(totals, { eligible: 2, renewed: 1, cancelling: 1 });
});

test('a resubscription months later is not a renewal of the subscription that lapsed', () => {
  // Paid, cancelled in month two, came back on a NEW subscription. Reading the
  // invoice list straight through would score the comeback's first charge as the
  // original subscription renewing.
  const report = renewals(
    [monthly('returner', 200)],
    [
      sync('returner', ago(200)),
      { userId: 'returner', type: 'stripe_invoice_paid', createdAt: ago(200), message: `Invoice in_r1 paid for sub sub_first amount=5900 billing_reason=subscription_create period_end=${unix(ago(170))} price=price_pro` },
      cancelRequested('returner', ago(180)),
      { userId: 'returner', type: 'stripe_subscription_deleted', createdAt: ago(170), message: 'Subscription sub_first ended; tier reset to public' },
      sync('returner', ago(60)),
      { userId: 'returner', type: 'stripe_invoice_paid', createdAt: ago(60), message: `Invoice in_r2 paid for sub sub_second amount=5900 billing_reason=subscription_create period_end=${unix(ago(30))} price=price_pro` },
      { userId: 'returner', type: 'stripe_invoice_paid', createdAt: ago(30), message: `Invoice in_r3 paid for sub sub_second amount=5900 billing_reason=subscription_cycle period_end=${unix(ahead(1))} price=price_pro` },
    ],
  );
  const step = report.steps[0];
  assert.equal(step.eligible, 1);
  assert.equal(step.renewed, 0, 'the first subscription never renewed');
  assert.equal(step.notRenewedVoluntary, 1);
});

test('a customer already gone is not "approaching" a renewal they cannot make', () => {
  // Cancelled and deleted on day 20 of a period that runs another ten days. The
  // calendar has not reached the due date, but the answer has.
  const report = renewals(
    [monthly('fast', 20, { currentStatus: null, currentTier: 'public' })],
    [
      sync('fast', ago(20)),
      invoice('fast', ago(20), ahead(10), 'subscription_create', 1),
      cancelRequested('fast', ago(6)),
      { userId: 'fast', type: 'stripe_subscription_deleted', createdAt: ago(4), message: 'Subscription sub_fast ended; tier reset to public' },
    ],
  );
  const step = report.steps[0];
  assert.equal(step.approaching, 0, 'they are not waiting for anything');
  assert.equal(step.eligible, 1);
  assert.equal(step.renewed, 0);
  assert.equal(step.notRenewedVoluntary, 1);
});
