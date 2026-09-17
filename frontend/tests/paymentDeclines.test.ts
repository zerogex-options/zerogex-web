import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDeclineReport,
  classifyAttemptKind,
  classifyPaidInvoices,
  foldDeclinesToInvoices,
  type DeclineRecord,
  type PaidInvoice,
} from '../core/paymentDeclines.ts';

// The arithmetic behind Admin → Monitoring → Stripe → Payment Declines.
//
// Every case below is one of the ways a plausible-looking implementation lies
// about lost revenue, and each of them is a lie an operator would act on:
//
//   * counting Smart Retries as separate lost invoices (3× the loss)
//   * counting a declined-then-paid invoice twice in the denominator
//   * calling a decline "not recovered" while Stripe is still retrying it
//   * averaging trial conversions and renewals into one meaningless rate
//   * attributing an invoice to the first reason it failed for rather than the
//     one it is actually stuck on now

const NOW = '2026-09-17T12:00:00.000Z';
const NOW_MS = Date.parse(NOW);
const DAY = 86_400_000;
const ago = (days: number, hours = 0) => new Date(NOW_MS - days * DAY - hours * 3_600_000).toISOString();

let seq = 0;
function decline(overrides: Partial<DeclineRecord> = {}): DeclineRecord {
  seq += 1;
  return {
    id: `decl_${seq}`,
    invoiceId: `in_${seq}`,
    attemptCount: 1,
    chargeId: `ch_${seq}`,
    userId: `user_${seq}`,
    email: `member${seq}@example.com`,
    subscriptionId: `sub_${seq}`,
    priceId: 'price_pro_monthly',
    tier: 'pro',
    cadence: 'monthly',
    kind: 'renewal',
    billingReason: 'subscription_cycle',
    amountDue: 4900,
    currency: 'usd',
    failureCode: 'card_declined',
    declineCode: 'insufficient_funds',
    networkDeclineCode: null,
    failureMessage: 'Your card has insufficient funds.',
    sellerMessage: 'The bank returned the decline code insufficient_funds.',
    category: 'insufficient_funds',
    cardBrand: 'visa',
    cardLast4: '4242',
    cardFunding: 'credit',
    cardCountry: 'US',
    nextAttemptAt: null,
    graceUntil: null,
    failedAt: ago(3),
    outcome: 'open',
    resolvedAt: null,
    recoveredAmount: null,
    recoveryRoute: null,
    lostReason: null,
    source: 'webhook',
    ...overrides,
  };
}

function paid(overrides: Partial<PaidInvoice> = {}): PaidInvoice {
  seq += 1;
  return {
    invoiceId: `in_paid_${seq}`,
    subscriptionId: `sub_paid_${seq}`,
    billingReason: 'subscription_cycle',
    amountPaid: 4900,
    paidAt: ago(3),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Which kind of charge was it
// ---------------------------------------------------------------------------

test('a subscription that opened with a $0 trial invoice converts, it does not renew', () => {
  assert.equal(
    classifyAttemptKind({ billingReason: 'subscription_cycle', hadPriorPaidCharge: false, hadTrialOpener: true }),
    'trial_conversion',
  );
});

test('money already collected on the subscription makes it a renewal', () => {
  assert.equal(
    classifyAttemptKind({ billingReason: 'subscription_cycle', hadPriorPaidCharge: true, hadTrialOpener: true }),
    'renewal',
  );
});

test('a paid signup with no trial is a first charge, not a conversion', () => {
  assert.equal(
    classifyAttemptKind({ billingReason: 'subscription_create', hadPriorPaidCharge: false, hadTrialOpener: false }),
    'first_charge',
  );
});

test('the subscription trial_end answer overrides the history inference', () => {
  // The webhook reads this from the subscription itself, which is the only
  // source event ordering cannot corrupt.
  assert.equal(
    classifyAttemptKind({
      billingReason: 'subscription_cycle',
      hadPriorPaidCharge: true,
      hadTrialOpener: false,
      trialConversion: true,
    }),
    'trial_conversion',
  );
  assert.equal(
    classifyAttemptKind({
      billingReason: 'subscription_cycle',
      hadPriorPaidCharge: false,
      hadTrialOpener: false,
      trialConversion: false,
    }),
    'renewal',
  );
});

test('a proration is neither a conversion nor a renewal', () => {
  // It is real money, but counting a mid-cycle upgrade as a renewal would make
  // a plan switch look like retention.
  assert.equal(
    classifyAttemptKind({ billingReason: 'subscription_update', hadPriorPaidCharge: true, hadTrialOpener: false }),
    'other',
  );
});

test('nothing to go on is unclassified rather than guessed', () => {
  assert.equal(
    classifyAttemptKind({ billingReason: null, hadPriorPaidCharge: false, hadTrialOpener: false }),
    'unknown',
  );
});

test('the $0 trial-opening invoice is never a charge, and a proration never takes the first-money slot', () => {
  const rows = classifyPaidInvoices([
    { invoiceId: 'in_open', subscriptionId: 'sub_1', billingReason: 'subscription_create', amountPaid: 0, paidAt: ago(60) },
    { invoiceId: 'in_upgrade', subscriptionId: 'sub_1', billingReason: 'subscription_update', amountPaid: 1200, paidAt: ago(50) },
    { invoiceId: 'in_convert', subscriptionId: 'sub_1', billingReason: 'subscription_cycle', amountPaid: 4900, paidAt: ago(45) },
    { invoiceId: 'in_renew', subscriptionId: 'sub_1', billingReason: 'subscription_cycle', amountPaid: 4900, paidAt: ago(15) },
  ]);
  assert.deepEqual(
    rows.map((row) => [row.invoiceId, row.kind]),
    [
      ['in_upgrade', 'other'],
      ['in_convert', 'trial_conversion'],
      ['in_renew', 'renewal'],
    ],
  );
});

// ---------------------------------------------------------------------------
// Retries are the same invoice
// ---------------------------------------------------------------------------

test('three Smart Retries on one invoice are one invoice and one amount', () => {
  const invoices = foldDeclinesToInvoices([
    decline({ invoiceId: 'in_x', attemptCount: 1, amountDue: 4900, failedAt: ago(6) }),
    decline({ invoiceId: 'in_x', attemptCount: 2, amountDue: 4900, failedAt: ago(4) }),
    decline({ invoiceId: 'in_x', attemptCount: 3, amountDue: 4900, failedAt: ago(2) }),
  ]);
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0].attempts.length, 3);
  // The bug this pins: summing amount_due over attempts reports $147 at risk on
  // a $49 subscription.
  assert.equal(invoices[0].amount, 4900);
  assert.equal(invoices[0].first.attemptCount, 1);
  assert.equal(invoices[0].last.attemptCount, 3);
});

test('an invoice is attributed to the reason of its LAST attempt', () => {
  const invoices = foldDeclinesToInvoices([
    decline({ invoiceId: 'in_y', attemptCount: 1, category: 'insufficient_funds', failedAt: ago(5) }),
    decline({ invoiceId: 'in_y', attemptCount: 2, category: 'issuer_block', failedAt: ago(1) }),
  ]);
  // A card that was short on Monday and blocked on Thursday is stuck on the
  // block; telling the member to wait for payday would be the wrong advice.
  assert.equal(invoices[0].last.category, 'issuer_block');
});

test('one recovered attempt recovers the invoice even if another says lost', () => {
  const invoices = foldDeclinesToInvoices([
    decline({ invoiceId: 'in_z', attemptCount: 1, outcome: 'lost', lostReason: 'canceled', resolvedAt: ago(1) }),
    decline({ invoiceId: 'in_z', attemptCount: 2, outcome: 'recovered', resolvedAt: ago(1), recoveredAmount: 4900 }),
  ]);
  assert.equal(invoices[0].outcome, 'recovered');
  assert.equal(invoices[0].recoveredAmount, 4900);
});

// ---------------------------------------------------------------------------
// The three rates
// ---------------------------------------------------------------------------

test('a declined-then-paid invoice is ONE attempt at collecting money', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_a', outcome: 'recovered', resolvedAt: ago(2), recoveredAmount: 4900, failedAt: ago(3) }),
    ],
    // The same invoice, now settled, plus nine that never declined.
    paid: [
      paid({ invoiceId: 'in_a', subscriptionId: 'sub_a', paidAt: ago(2) }),
      ...Array.from({ length: 9 }, (_, i) => paid({ invoiceId: `in_ok_${i}` })),
    ],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  // Ten invoices were charged, not eleven — double-counting the recovered one
  // would report a 9.1% decline rate instead of 10%.
  assert.equal(report.totals.attemptedInvoices, 10);
  assert.equal(report.totals.paidInvoices, 10);
  assert.equal(report.totals.declineRate, 0.1);
  // It recovered, so it cost nothing.
  assert.equal(report.totals.lossRate, 0);
  assert.equal(report.totals.recoveryRate, 1);
});

test('an open decline is excluded from the recovery rate, not counted against it', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_r', outcome: 'recovered', resolvedAt: ago(1), recoveredAmount: 4900 }),
      decline({ invoiceId: 'in_l', outcome: 'lost', resolvedAt: ago(1), lostReason: 'canceled' }),
      decline({ invoiceId: 'in_o1' }),
      decline({ invoiceId: 'in_o2' }),
      decline({ invoiceId: 'in_o3' }),
    ],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  // 1 of 2 RESOLVED, not 1 of 5. Counting invoices Stripe will retry tomorrow
  // as failures makes the rate sag every time volume rises.
  assert.equal(report.totals.recoveryRate, 0.5);
  assert.equal(report.totals.openInvoices, 3);
  // …but they are still money not yet collected, so the loss rate includes them.
  assert.equal(report.totals.lossRate, 4 / 5);
});

test('money is summed once per invoice across every outcome', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_m', attemptCount: 1, amountDue: 19900, failedAt: ago(5) }),
      decline({ invoiceId: 'in_m', attemptCount: 2, amountDue: 19900, failedAt: ago(4) }),
      decline({ invoiceId: 'in_n', amountDue: 4900, outcome: 'lost', resolvedAt: ago(1), lostReason: 'canceled' }),
    ],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  assert.equal(report.totals.amountAtRisk, 24800);
  assert.equal(report.totals.openAmount, 19900);
  assert.equal(report.totals.lostAmount, 4900);
  assert.equal(report.totals.attempts, 3);
  assert.equal(report.totals.invoices, 2);
});

// ---------------------------------------------------------------------------
// Conversions vs renewals, each against its own denominator
// ---------------------------------------------------------------------------

test('each charge kind is rated against its own attempt volume', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_tc', kind: 'trial_conversion', outcome: 'lost', resolvedAt: ago(1), lostReason: 'canceled' }),
      decline({ invoiceId: 'in_rn', kind: 'renewal', outcome: 'recovered', resolvedAt: ago(1), recoveredAmount: 4900 }),
    ],
    paid: [
      // One conversion succeeded (its subscription opened on a $0 trial invoice).
      paid({ invoiceId: 'in_t0', subscriptionId: 'sub_t', billingReason: 'subscription_create', amountPaid: 0, paidAt: ago(20) }),
      paid({ invoiceId: 'in_t1', subscriptionId: 'sub_t', billingReason: 'subscription_cycle', amountPaid: 4900, paidAt: ago(10) }),
      // …and nineteen renewals did. Each needs the earlier charge that MAKES it
      // a renewal, dated outside the window: classification reads the whole
      // payment history, the rates only count what happened inside it.
      ...Array.from({ length: 19 }, (_, i) => [
        paid({ invoiceId: `in_first_${i}`, subscriptionId: `sub_r_${i}`, amountPaid: 4900, paidAt: ago(60) }),
        paid({ invoiceId: `in_r_${i}`, subscriptionId: `sub_r_${i}`, amountPaid: 4900, paidAt: ago(5) }),
      ]).flat(),
    ],
    windowDays: 30,
    nowMs: NOW_MS,
  });

  const conversions = report.byKind.find((row) => row.key === 'trial_conversion');
  assert.ok(conversions);
  // 1 declined of 2 conversion charges — a 50% conversion decline rate, which
  // the blended rate across 21 invoices would have shown as 9.5%.
  assert.equal(conversions.attemptedInvoices, 2);
  assert.equal(conversions.declineRate, 0.5);
  assert.equal(conversions.lossRate, 0.5);

  const renewals = report.byKind.find((row) => row.key === 'renewal');
  assert.ok(renewals);
  assert.equal(renewals.attemptedInvoices, 20);
  assert.equal(renewals.declineRate, 1 / 20);
  // It recovered, so no renewal revenue was actually lost.
  assert.equal(renewals.lossRate, 0);
});

// ---------------------------------------------------------------------------
// Cause, lag, route
// ---------------------------------------------------------------------------

test('categories and raw codes are counted at the invoice level', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_1', category: 'insufficient_funds', declineCode: 'insufficient_funds' }),
      decline({ invoiceId: 'in_2', category: 'insufficient_funds', declineCode: 'insufficient_funds' }),
      decline({ invoiceId: 'in_3', category: 'issuer_block', declineCode: 'do_not_honor' }),
    ],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  const short = report.byCategory.find((row) => row.key === 'insufficient_funds');
  assert.equal(short?.invoices, 2);
  assert.equal(short?.share, 2 / 3);
  const codes = Object.fromEntries(report.byCode.map((row) => [row.code, row.invoices]));
  assert.deepEqual(codes, { insufficient_funds: 2, do_not_honor: 1 });
});

test('the raw network code is reported as its own alphabet, never as a decline code', () => {
  const report = buildDeclineReport({
    declines: [decline({ declineCode: null, failureCode: null, networkDeclineCode: '51', category: 'insufficient_funds' })],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  assert.equal(report.byCode[0].code, 'network 51');
});

test('recovery lag is measured from the FIRST failure, not the last retry', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_lag', attemptCount: 1, failedAt: ago(4), outcome: 'recovered', resolvedAt: ago(1), recoveredAmount: 4900 }),
      decline({ invoiceId: 'in_lag', attemptCount: 2, failedAt: ago(2), outcome: 'recovered', resolvedAt: ago(1), recoveredAmount: 4900 }),
    ],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  // Three days of unpaid subscription, not one — the member was without a
  // settled invoice from the first decline onward.
  assert.equal(report.recoveryLag.sampled, 1);
  assert.equal(report.recoveryLag.medianHours, 72);
  assert.equal(report.recoveryLag.buckets.find((b) => b.key === 'lt7d')?.count, 1);
});

test('recoveries are split by who got the money in', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_auto', outcome: 'recovered', resolvedAt: ago(1), recoveryRoute: 'auto_retry', recoveredAmount: 4900 }),
      decline({ invoiceId: 'in_self', outcome: 'recovered', resolvedAt: ago(1), recoveryRoute: 'member_action', recoveredAmount: 4900 }),
      // Not recovered — must not appear in the split at all.
      decline({ invoiceId: 'in_open2' }),
    ],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  assert.deepEqual(
    report.byRecoveryRoute.map((row) => [row.key, row.invoices]),
    [
      ['auto_retry', 1],
      ['member_action', 1],
    ],
  );
});

// ---------------------------------------------------------------------------
// Time, windows and worklists
// ---------------------------------------------------------------------------

test('an invoice lands on the day it FIRST failed, so a retry cannot re-bill the day', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_d', attemptCount: 1, amountDue: 4900, failedAt: ago(5) }),
      decline({ invoiceId: 'in_d', attemptCount: 2, amountDue: 4900, failedAt: ago(2) }),
    ],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  const withMoney = report.daily.filter((point) => point.amountAtRisk > 0);
  assert.equal(withMoney.length, 1);
  assert.equal(withMoney[0].amountAtRisk, 4900);
  assert.equal(withMoney[0].invoices, 1);
  // Attempts still land on their own days — that is the retry pressure.
  assert.equal(report.daily.reduce((sum, point) => sum + point.attempts, 0), 2);
});

test('a day with no charges at all has no decline rate rather than a 0% one', () => {
  const report = buildDeclineReport({ declines: [], paid: [], windowDays: 7, nowMs: NOW_MS });
  assert.ok(report.daily.length >= 7);
  assert.ok(report.daily.every((point) => point.declineRate === null));
});

test('the prior window is the equal-length period immediately before', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_now', failedAt: ago(3) }),
      decline({ invoiceId: 'in_then', failedAt: ago(20) }),
      // Older than both windows — must be in neither.
      decline({ invoiceId: 'in_ancient', failedAt: ago(90) }),
    ],
    paid: [],
    windowDays: 14,
    nowMs: NOW_MS,
  });
  assert.equal(report.totals.invoices, 1);
  assert.equal(report.previous?.invoices, 1);
});

test('all-time has no prior window to compare against', () => {
  const report = buildDeclineReport({ declines: [decline()], paid: [], windowDays: null, nowMs: NOW_MS });
  assert.equal(report.previous, null);
});

test('the open worklist carries the guidance for what to actually do', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_w1', category: 'insufficient_funds', failedAt: ago(1) }),
      decline({ invoiceId: 'in_w2', category: 'card_problem', declineCode: 'expired_card', failedAt: ago(2) }),
    ],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  const byInvoice = Object.fromEntries(report.openWorklist.map((row) => [row.invoiceId, row]));
  // An empty account is not the member's problem to solve; an expired card is.
  assert.equal(byInvoice.in_w1.needsMemberAction, false);
  assert.equal(byInvoice.in_w2.needsMemberAction, true);
  assert.match(byInvoice.in_w2.guidance, /update it/i);
  // Newest first — the worklist is read from the top.
  assert.equal(report.openWorklist[0].invoiceId, 'in_w1');
});

test('a member is only a repeat offender on a SECOND invoice, not a second retry', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_p', attemptCount: 1, userId: 'user_x', email: 'x@example.com' }),
      decline({ invoiceId: 'in_p', attemptCount: 2, userId: 'user_x', email: 'x@example.com' }),
      decline({ invoiceId: 'in_q', userId: 'user_y', email: 'y@example.com' }),
    ],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  assert.equal(report.repeatMembers.length, 0);

  const withSecond = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_p1', userId: 'user_x', email: 'x@example.com', amountDue: 4900, outcome: 'lost', resolvedAt: ago(1), lostReason: 'canceled' }),
      decline({ invoiceId: 'in_p2', userId: 'user_x', email: 'x@example.com', amountDue: 4900 }),
    ],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  assert.equal(withSecond.repeatMembers.length, 1);
  assert.equal(withSecond.repeatMembers[0].invoices, 2);
  assert.equal(withSecond.repeatMembers[0].neverRecovered, true);
  assert.equal(withSecond.repeatMembers[0].lostAmount, 4900);
  assert.equal(withSecond.repeatMembers[0].openAmount, 4900);
});

test('a lost invoice reports the reason of the attempt that CLOSED it, not of its last retry', () => {
  // Closing events land against whichever attempts were open at the time, so an
  // invoice can be lost on attempt 1 while a later retry is still marked open.
  // Reading the reason off `last` reported those as lost with no reason at all.
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_split', attemptCount: 1, failedAt: ago(40), outcome: 'lost', resolvedAt: ago(9), lostReason: 'canceled' }),
      decline({ invoiceId: 'in_split', attemptCount: 2, failedAt: ago(35), outcome: 'open', lostReason: null }),
    ],
    paid: [],
    windowDays: 90,
    nowMs: NOW_MS,
  });
  assert.equal(report.totals.lostInvoices, 1);
  assert.equal(report.recentLosses[0].lostReason, 'canceled');
});

test('a recovered invoice carries no loss reason even if an attempt was written off first', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_back', attemptCount: 1, outcome: 'lost', resolvedAt: ago(3), lostReason: 'canceled' }),
      decline({ invoiceId: 'in_back', attemptCount: 2, outcome: 'recovered', resolvedAt: ago(1), recoveredAmount: 4900 }),
    ],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  assert.equal(report.totals.recoveredInvoices, 1);
  assert.equal(report.recentLosses.length, 0);
});

test('coverage states how many attempts actually carry an issuer reason', () => {
  const report = buildDeclineReport({
    declines: [
      decline({ invoiceId: 'in_c1', failedAt: ago(2) }),
      decline({
        invoiceId: 'in_c2',
        failedAt: ago(10),
        declineCode: null,
        failureCode: null,
        networkDeclineCode: null,
        category: 'unknown',
        source: 'audit_backfill',
      }),
    ],
    paid: [],
    windowDays: 30,
    nowMs: NOW_MS,
  });
  assert.equal(report.coverage.withCodes, 1);
  assert.equal(report.coverage.withoutCodes, 1);
  assert.equal(report.coverage.firstCodedAt, ago(2));
  assert.equal(report.coverage.firstRecordedAt, ago(10));
  assert.deepEqual(
    report.coverage.bySource.map((row) => row.source).sort(),
    ['audit_backfill', 'webhook'],
  );
});

test('an empty window renders rather than dividing by zero', () => {
  const report = buildDeclineReport({ declines: [], paid: [], windowDays: 30, nowMs: NOW_MS });
  assert.equal(report.totals.invoices, 0);
  assert.equal(report.totals.declineRate, null);
  assert.equal(report.totals.recoveryRate, null);
  assert.equal(report.totals.lossRate, null);
  assert.deepEqual(report.byCode, []);
  assert.equal(report.recoveryLag.medianHours, null);
});
