import test from 'node:test';
import assert from 'node:assert/strict';

import { foldDeclinesToInvoices, type DeclineRecord } from '../core/paymentDeclines.ts';
import {
  byDayOfMonth,
  byDaysToPayday,
  daysToNextPayday,
  windowByOutcome,
  ordinal,
  byPaydayCrossing,
  retryWindowDays,
  retryWindowStats,
  windowCrossedPayday,
} from '../core/declineTiming.ts';

// The timing cut exists to test one hypothesis: that insufficient-funds failures
// persist because the retries land while the account is still empty. It is only
// worth anything if it can come back NEGATIVE, so these pin the arithmetic that
// would let it do so.

let seq = 0;
function attempt(overrides: Partial<DeclineRecord> = {}): DeclineRecord {
  seq += 1;
  return {
    id: `d_${seq}`,
    invoiceId: `in_${seq}`,
    attemptCount: 1,
    chargeId: null,
    userId: `u_${seq}`,
    email: null,
    signupSource: null,
    subscriptionId: `sub_${seq}`,
    priceId: null,
    tier: 'pro',
    cadence: 'monthly',
    kind: 'trial_conversion',
    billingReason: 'subscription_cycle',
    amountDue: 4900,
    currency: 'usd',
    failureCode: 'card_declined',
    declineCode: 'insufficient_funds',
    networkDeclineCode: null,
    failureMessage: null,
    sellerMessage: null,
    category: 'insufficient_funds',
    methodType: 'card',
    cardBrand: 'visa',
    cardLast4: '4242',
    cardFunding: 'debit',
    cardCountry: 'US',
    nextAttemptAt: null,
    graceUntil: null,
    collectionMethod: 'charge_automatically',
    invoiceStatus: 'open',
    failedAt: '2026-03-10T15:00:00.000Z',
    outcome: 'lost',
    resolvedAt: null,
    recoveredAmount: null,
    recoveryRoute: null,
    lostReason: 'canceled',
    source: 'webhook',
    ...overrides,
  };
}

/** One invoice from a list of (ISO) attempt times. */
function invoiceOf(id: string, times: readonly string[], outcome: DeclineRecord['outcome'] = 'lost') {
  return foldDeclinesToInvoices(
    times.map((failedAt, i) => attempt({ invoiceId: id, attemptCount: i + 1, failedAt, outcome })),
  )[0];
}

test('the retry window is measured from the first failure to the last', () => {
  const invoice = invoiceOf('in_w', [
    '2026-03-10T15:00:00.000Z',
    '2026-03-13T15:00:00.000Z',
    '2026-03-19T15:00:00.000Z',
  ]);
  assert.equal(retryWindowDays(invoice), 9);

  // Never retried: zero days is the truth about what happened, even where the
  // policy would have allowed more.
  assert.equal(retryWindowDays(invoiceOf('in_once', ['2026-03-10T15:00:00.000Z'])), 0);
});

test('a window is judged by the days it covered, not by its endpoints', () => {
  // 28th to the 3rd crosses the 1st without either end being near it. Comparing
  // endpoints — the obvious implementation — answers this one wrong.
  const across = invoiceOf('in_across', ['2026-03-28T15:00:00.000Z', '2026-04-03T15:00:00.000Z']);
  assert.equal(windowCrossedPayday(across), true);

  // Wholly inside a month and clear of both the 1st and the 15th.
  const inside = invoiceOf('in_inside', ['2026-03-17T15:00:00.000Z', '2026-03-24T15:00:00.000Z']);
  assert.equal(windowCrossedPayday(inside), false);

  // Landing exactly on one counts.
  const onIt = invoiceOf('in_on', ['2026-03-15T15:00:00.000Z']);
  assert.equal(windowCrossedPayday(onIt), true);
});

test('the payday split can come back negative', () => {
  // The test is only worth running if it can fail to find anything. Here both
  // sides recover identically, and the cut must report exactly that rather than
  // manufacturing a difference.
  const crossed = [
    invoiceOf('in_c1', ['2026-03-28T15:00:00.000Z', '2026-04-03T15:00:00.000Z'], 'recovered'),
    invoiceOf('in_c2', ['2026-03-28T15:00:00.000Z', '2026-04-03T15:00:00.000Z'], 'lost'),
  ];
  const missed = [
    invoiceOf('in_m1', ['2026-03-17T15:00:00.000Z', '2026-03-22T15:00:00.000Z'], 'recovered'),
    invoiceOf('in_m2', ['2026-03-17T15:00:00.000Z', '2026-03-22T15:00:00.000Z'], 'lost'),
  ];
  const rows = byPaydayCrossing([...crossed, ...missed]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].recoveryRate, 0.5);
  assert.equal(rows[1].recoveryRate, 0.5);
  // And at n = 2 a side it must refuse to look conclusive.
  for (const row of rows) {
    assert.ok(row.recoveryRateInterval!.low < 0.1);
    assert.ok(row.recoveryRateInterval!.high > 0.9);
  }
});

test('open invoices are counted but kept out of the recovery rate', () => {
  // Same rule as everywhere else in this report: an invoice Stripe may still
  // collect is not a failure yet, and putting it in the denominator makes the
  // rate sag whenever volume rises.
  const rows = byPaydayCrossing([
    invoiceOf('in_o1', ['2026-03-15T15:00:00.000Z'], 'open'),
    invoiceOf('in_o2', ['2026-03-15T15:00:00.000Z'], 'recovered'),
  ]);
  assert.equal(rows[0].invoices, 2);
  assert.equal(rows[0].open, 1);
  assert.equal(rows[0].recoveryRate, 1);
});

test('day-of-month buckets drop the empty ones and keep the rest whole', () => {
  const rows = byDayOfMonth([
    invoiceOf('in_d1', ['2026-03-03T15:00:00.000Z']),
    invoiceOf('in_d2', ['2026-03-04T15:00:00.000Z']),
    invoiceOf('in_d3', ['2026-03-28T15:00:00.000Z']),
  ]);
  assert.deepEqual(rows.map((r) => [r.key, r.invoices]), [['1-5', 2], ['26-31', 1]]);
});

test('window stats report the median and the never-retried count', () => {
  const stats = retryWindowStats([
    invoiceOf('in_s1', ['2026-03-01T15:00:00.000Z']),
    invoiceOf('in_s2', ['2026-03-01T15:00:00.000Z', '2026-03-06T15:00:00.000Z']),
    invoiceOf('in_s3', ['2026-03-01T15:00:00.000Z', '2026-03-15T15:00:00.000Z']),
  ]);
  assert.equal(stats.invoices, 3);
  assert.equal(stats.medianDays, 5);
  assert.equal(stats.maxDays, 14);
  assert.equal(stats.singleAttempt, 1);
});

test('ordinals read as dates, not as bare numbers', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 15, 21, 22, 23, 31].map(ordinal), [
    '1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '15th', '21st', '22nd', '23rd', '31st',
  ]);
});

// ---------------------------------------------------------------------------
// The confound that broke the first version of this cut.
//
// windowCrossedPayday measures first failure -> LAST failure. An invoice that
// recovers stops failing, so recovering shortens its window, so "crossed a
// payday" partly encodes "kept failing" which is nearly "never recovered". On
// live data that produced 0% against 26% — a large, confident result pointing
// the opposite way to the hypothesis it was built to test.
// ---------------------------------------------------------------------------

test('the window measure really is contaminated by the outcome', () => {
  // Recovered invoices stop early; lost ones run the full schedule. This is the
  // shape of real data, and it is what the synthetic calibration did not have.
  const invoices = [
    invoiceOf('in_r1', ['2026-03-05T12:00:00.000Z', '2026-03-06T12:00:00.000Z'], 'recovered'),
    invoiceOf('in_r2', ['2026-03-05T12:00:00.000Z', '2026-03-06T12:00:00.000Z'], 'recovered'),
    invoiceOf('in_l1', ['2026-03-05T12:00:00.000Z', '2026-03-19T12:00:00.000Z'], 'lost'),
    invoiceOf('in_l2', ['2026-03-05T12:00:00.000Z', '2026-03-19T12:00:00.000Z'], 'lost'),
  ];
  const rows = windowByOutcome(invoices);
  const recovered = rows.find((r) => r.outcome === 'recovered');
  const lost = rows.find((r) => r.outcome === 'lost');
  assert.ok(recovered && lost);
  assert.ok(
    recovered.medianDays! < lost.medianDays!,
    'recovered invoices must show shorter windows — that IS the contamination',
  );
});

test('the exogenous measure depends only on the first failure', () => {
  // Same first failure, wildly different histories and outcomes. The clean
  // measure must not budge; the contaminated one does.
  const short = invoiceOf('in_s', ['2026-03-05T12:00:00.000Z'], 'recovered');
  const long = invoiceOf('in_l', [
    '2026-03-05T12:00:00.000Z',
    '2026-03-12T12:00:00.000Z',
    '2026-03-19T12:00:00.000Z',
  ], 'lost');
  assert.equal(daysToNextPayday(short), daysToNextPayday(long));
  assert.equal(daysToNextPayday(short), 10); // 5th -> 15th
});

test('the wait to payday is counted across the month boundary', () => {
  assert.equal(daysToNextPayday(invoiceOf('in_a', ['2026-03-01T12:00:00.000Z'])), 0);
  assert.equal(daysToNextPayday(invoiceOf('in_b', ['2026-03-15T12:00:00.000Z'])), 0);
  assert.equal(daysToNextPayday(invoiceOf('in_c', ['2026-03-14T12:00:00.000Z'])), 1);
  // 31-day March: the 20th waits 11 days for the 1st of April.
  assert.equal(daysToNextPayday(invoiceOf('in_d', ['2026-03-20T12:00:00.000Z'])), 12);
  // 28-day February 2026: the 20th waits 9 days.
  assert.equal(daysToNextPayday(invoiceOf('in_e', ['2026-02-20T12:00:00.000Z'])), 9);
  assert.equal(daysToNextPayday(invoiceOf('in_f', ['2026-03-31T12:00:00.000Z'])), 1);
});

test('the exogenous split is immune to the bias that broke the window one', () => {
  // Recovered invoices given SHORT histories and lost ones long ones — exactly
  // the pattern that fooled the window cut. Both groups failed on the same day,
  // so the clean cut must put them in one bucket and report the true rate.
  const invoices = [
    invoiceOf('in_p1', ['2026-03-14T12:00:00.000Z'], 'recovered'),
    invoiceOf('in_p2', ['2026-03-14T12:00:00.000Z', '2026-03-28T12:00:00.000Z'], 'lost'),
  ];
  const rows = byDaysToPayday(invoices);
  assert.equal(rows.length, 1, 'same first-failure date must mean one bucket');
  assert.equal(rows[0].key, '0-3');
  assert.equal(rows[0].invoices, 2);
  assert.equal(rows[0].recoveryRate, 0.5);
});
