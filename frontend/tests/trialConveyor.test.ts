import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accumulateTrialOutcomes,
  beltProgress,
  classifyRider,
  countdownParts,
  emptyConveyorDelta,
  formatCountdown,
  projectFullSubscribers,
  sortRidersByDeadline,
  summarizeRiders,
  summarizeTrialOutcomes,
  NOMINAL_TRIAL_DAYS,
  type ConveyorDayDelta,
  type ConveyorDeleteEvent,
  type ConveyorRider,
  type ConveyorSyncEvent,
} from '../core/trialConveyor.ts';

// The conveyor is the admin's answer to "when do these trials pay me, and which
// ones won't". Its contracts: a member who clicked Cancel is never counted as
// heading for a charge, a declined first charge is still recoverable (not a
// loss), a sub converts at most once, and the conversion rate is measured only
// over trials that actually reached a decision. Lock those down.

const DAY = 86_400_000;

function sync(subId: string, status: string, day: string): ConveyorSyncEvent {
  return { subId, status, day };
}
function del(subId: string | null, day: string): ConveyorDeleteEvent {
  return { subId, day };
}
function rider(over: Partial<ConveyorRider> = {}): ConveyorRider {
  return {
    userId: 'u1',
    email: 'a@example.com',
    state: 'running',
    tier: 'pro',
    cadence: 'monthly',
    founding: false,
    boardedAt: '2026-08-20T00:00:00.000Z',
    convertsAt: '2026-08-27T00:00:00.000Z',
    monthlyValue: 59,
    ...over,
  };
}
function totals(map: Map<string, ConveyorDayDelta>): ConveyorDayDelta {
  const t = emptyConveyorDelta();
  for (const d of map.values()) {
    for (const k of Object.keys(t) as (keyof ConveyorDayDelta)[]) t[k] += d[k];
  }
  return t;
}

// ── classifyRider ──────────────────────────────────────────────────────────

test('classifyRider: a running trial is heading for the charge', () => {
  assert.equal(
    classifyRider({ subscriptionStatus: 'trialing', cancelAtPeriodEnd: false, paymentGraceReason: null }),
    'running',
  );
});

test('classifyRider: a trial with a scheduled cancel is already rolling off', () => {
  assert.equal(
    classifyRider({ subscriptionStatus: 'trialing', cancelAtPeriodEnd: true, paymentGraceReason: null }),
    'rollingOff',
  );
});

test('classifyRider: past_due counts as a stall ONLY when the trial opened the grace window', () => {
  assert.equal(
    classifyRider({ subscriptionStatus: 'past_due', cancelAtPeriodEnd: false, paymentGraceReason: 'trial' }),
    'stalled',
  );
  // An established payer's failed renewal is ordinary dunning, not a trial.
  assert.equal(
    classifyRider({ subscriptionStatus: 'past_due', cancelAtPeriodEnd: false, paymentGraceReason: 'renewal' }),
    null,
  );
  // Pre-split rows carry no reason and must not be guessed onto the belt.
  assert.equal(
    classifyRider({ subscriptionStatus: 'past_due', cancelAtPeriodEnd: false, paymentGraceReason: null }),
    null,
  );
});

test('classifyRider: paying and lapsed members are not on the belt', () => {
  for (const status of ['active', 'canceled', 'incomplete_expired', null]) {
    assert.equal(
      classifyRider({ subscriptionStatus: status, cancelAtPeriodEnd: false, paymentGraceReason: null }),
      null,
      `status=${status}`,
    );
  }
});

// ── beltProgress ───────────────────────────────────────────────────────────

test('beltProgress: walks 0 → 1 across the rider’s own trial span', () => {
  const boardedAtMs = Date.parse('2026-08-20T00:00:00Z');
  const convertsAtMs = boardedAtMs + 8 * DAY;
  assert.equal(beltProgress({ boardedAtMs, convertsAtMs, nowMs: boardedAtMs }), 0);
  assert.equal(beltProgress({ boardedAtMs, convertsAtMs, nowMs: boardedAtMs + 2 * DAY }), 0.25);
  assert.equal(beltProgress({ boardedAtMs, convertsAtMs, nowMs: convertsAtMs }), 1);
});

test('beltProgress: clamps outside the span instead of running off the track', () => {
  const boardedAtMs = Date.parse('2026-08-20T00:00:00Z');
  const convertsAtMs = boardedAtMs + 7 * DAY;
  assert.equal(beltProgress({ boardedAtMs, convertsAtMs, nowMs: boardedAtMs - DAY }), 0);
  assert.equal(beltProgress({ boardedAtMs, convertsAtMs, nowMs: convertsAtMs + DAY }), 1);
});

test('beltProgress: an unrecoverable boarding time falls back to the nominal span', () => {
  const convertsAtMs = Date.parse('2026-08-27T00:00:00Z');
  const nowMs = convertsAtMs - (NOMINAL_TRIAL_DAYS / 2) * DAY;
  assert.equal(beltProgress({ boardedAtMs: null, convertsAtMs, nowMs }), 0.5);
  // A nonsense boarding time (at or after the deadline) uses the same fallback.
  assert.equal(beltProgress({ boardedAtMs: convertsAtMs + DAY, convertsAtMs, nowMs }), 0.5);
});

test('beltProgress: no deadline means nothing to position against', () => {
  assert.equal(beltProgress({ boardedAtMs: 0, convertsAtMs: null, nowMs: 1 }), 0);
});

// ── countdown ──────────────────────────────────────────────────────────────

test('countdownParts: floors each unit so a display never over-reports', () => {
  const p = countdownParts(2 * DAY + 3 * 3600_000 + 4 * 60_000 + 5_000 + 999);
  assert.deepEqual(p, { days: 2, hours: 3, minutes: 4, seconds: 5, expired: false });
});

test('countdownParts: a passed, missing, or non-finite deadline reads expired at zero', () => {
  for (const ms of [0, -1, null, Number.NaN]) {
    assert.deepEqual(countdownParts(ms), { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
  }
});

test('formatCountdown: fixed-width d:hh:mm:ss so the ticker does not jitter', () => {
  assert.equal(formatCountdown(6 * DAY + 23 * 3600_000 + 59 * 60_000 + 59_000), '6:23:59:59');
  assert.equal(formatCountdown(61_000), '0:00:01:01');
  assert.equal(formatCountdown(0), '0:00:00:00');
});

// ── accumulateTrialOutcomes ────────────────────────────────────────────────

test('accumulateTrialOutcomes: a trial that converts books boarded + converted, once each', () => {
  const byDay = accumulateTrialOutcomes(
    [
      sync('sub_1', 'trialing', '2026-08-01'),
      sync('sub_1', 'trialing', '2026-08-03'), // Stripe re-syncs mid-trial
      sync('sub_1', 'active', '2026-08-08'),
      sync('sub_1', 'active', '2026-09-08'), // the next renewal is not a conversion
    ],
    [],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 1, rolledOff: 0, stalled: 0 });
  assert.equal(byDay.get('2026-08-01')?.boarded, 1);
  assert.equal(byDay.get('2026-08-08')?.converted, 1);
});

test('accumulateTrialOutcomes: a trial canceled before the charge rolls off', () => {
  const bySync = accumulateTrialOutcomes(
    [sync('sub_1', 'trialing', '2026-08-01'), sync('sub_1', 'canceled', '2026-08-04')],
    [],
  );
  assert.deepEqual(totals(bySync), { boarded: 1, converted: 0, rolledOff: 1, stalled: 0 });

  // Same outcome when Stripe reports it as a deletion instead of a status sync.
  const byDelete = accumulateTrialOutcomes([sync('sub_2', 'trialing', '2026-08-01')], [del('sub_2', '2026-08-04')]);
  assert.deepEqual(totals(byDelete), { boarded: 1, converted: 0, rolledOff: 1, stalled: 0 });
});

test('accumulateTrialOutcomes: a cancel is never double-booked across both streams', () => {
  const byDay = accumulateTrialOutcomes(
    [sync('sub_1', 'trialing', '2026-08-01'), sync('sub_1', 'canceled', '2026-08-04')],
    [del('sub_1', '2026-08-04')],
  );
  assert.equal(totals(byDay).rolledOff, 1);
});

test('accumulateTrialOutcomes: churn AFTER converting is not a trial roll-off', () => {
  const byDay = accumulateTrialOutcomes(
    [sync('sub_1', 'trialing', '2026-08-01'), sync('sub_1', 'active', '2026-08-08')],
    [del('sub_1', '2026-09-20')],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 1, rolledOff: 0, stalled: 0 });
});

test('accumulateTrialOutcomes: a declined first charge stalls once and can still convert', () => {
  const byDay = accumulateTrialOutcomes(
    [
      sync('sub_1', 'trialing', '2026-08-01'),
      sync('sub_1', 'past_due', '2026-08-08'),
      sync('sub_1', 'past_due', '2026-08-09'), // a retry attempt, not a second stall
      sync('sub_1', 'active', '2026-08-10'), // the retry succeeded
    ],
    [],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 1, rolledOff: 0, stalled: 1 });
});

test('accumulateTrialOutcomes: a sub whose trial predates the window is not attributed', () => {
  // No `trialing` event in range — crediting the `active` sync would invent a
  // trial we never observed, so the cohort stays self-consistent.
  const byDay = accumulateTrialOutcomes([sync('sub_1', 'active', '2026-08-08')], [del('sub_1', '2026-08-20')]);
  assert.deepEqual(totals(byDay), emptyConveyorDelta());
});

test('accumulateTrialOutcomes: a sub that never trialed is ignored entirely', () => {
  const byDay = accumulateTrialOutcomes(
    [sync('sub_1', 'active', '2026-08-01'), sync('sub_1', 'canceled', '2026-08-20')],
    [],
  );
  assert.deepEqual(totals(byDay), emptyConveyorDelta());
});

test('accumulateTrialOutcomes: unparseable days and missing sub ids are dropped, not thrown on', () => {
  const byDay = accumulateTrialOutcomes(
    [sync('', 'trialing', '2026-08-01'), { subId: 'sub_1', status: 'trialing', day: null }],
    [del(null, '2026-08-04')],
  );
  assert.deepEqual(totals(byDay), emptyConveyorDelta());
});

// ── Payment confirmation ───────────────────────────────────────────────────
// The stripe_first_payment stream settles a provisional conversion positively
// instead of waiting the confirmation window out. Subscriptions without one
// (history predating the stream) keep falling back to the time-based rule, so
// existing windows read exactly as they did.

test('accumulateTrialOutcomes: an observed payment makes the conversion unrevokable', () => {
  // Money moved on the 8th, so the past_due on the 9th is a LATER problem, not
  // the same charge failing. Without the payment stream the 1-day gap would
  // revoke the conversion and book a stall.
  const byDay = accumulateTrialOutcomes(
    [
      sync('sub_1', 'trialing', '2026-08-01'),
      sync('sub_1', 'active', '2026-08-08'),
      sync('sub_1', 'past_due', '2026-08-09'),
    ],
    [],
    [{ subId: 'sub_1', day: '2026-08-08' }],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 1, rolledOff: 0, stalled: 0 });
});

test('accumulateTrialOutcomes: a deletion right after a PAID conversion is ordinary churn', () => {
  const byDay = accumulateTrialOutcomes(
    [sync('sub_1', 'trialing', '2026-08-01'), sync('sub_1', 'active', '2026-08-08')],
    [del('sub_1', '2026-08-09')],
    [{ subId: 'sub_1', day: '2026-08-08' }],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 1, rolledOff: 0, stalled: 0 });
});

test('accumulateTrialOutcomes: with no payment stream the old revoke still applies', () => {
  // Same sequence, no payment observed: the decline within the window revokes
  // the provisional conversion, exactly as before.
  const byDay = accumulateTrialOutcomes(
    [
      sync('sub_1', 'trialing', '2026-08-01'),
      sync('sub_1', 'active', '2026-08-08'),
      sync('sub_1', 'past_due', '2026-08-09'),
    ],
    [],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 0, rolledOff: 0, stalled: 1 });
});

test('accumulateTrialOutcomes: a payment on a DIFFERENT sub confirms nothing', () => {
  const byDay = accumulateTrialOutcomes(
    [
      sync('sub_1', 'trialing', '2026-08-01'),
      sync('sub_1', 'active', '2026-08-08'),
      sync('sub_1', 'past_due', '2026-08-09'),
    ],
    [],
    [{ subId: 'sub_2', day: '2026-08-08' }],
  );
  assert.equal(totals(byDay).converted, 0);
  assert.equal(totals(byDay).stalled, 1);
});

// ── summarizeTrialOutcomes ─────────────────────────────────────────────────

test('summarizeTrialOutcomes: rate is converted over DECIDED trials only', () => {
  const byDay = accumulateTrialOutcomes(
    [
      sync('sub_1', 'trialing', '2026-08-01'),
      sync('sub_1', 'active', '2026-08-08'),
      sync('sub_2', 'trialing', '2026-08-01'),
      sync('sub_2', 'canceled', '2026-08-05'),
      sync('sub_3', 'trialing', '2026-08-02'),
      sync('sub_3', 'past_due', '2026-08-09'), // still in flight — excluded
    ],
    [],
  );
  const out = summarizeTrialOutcomes(byDay, ['2026-08-01', '2026-08-02', '2026-08-05', '2026-08-08', '2026-08-09'], 30);
  assert.equal(out.boarded, 3);
  assert.equal(out.converted, 1);
  assert.equal(out.rolledOff, 1);
  assert.equal(out.stalled, 1);
  assert.equal(out.conversionRate, 0.5);
  assert.equal(out.windowDays, 30);
});

test('summarizeTrialOutcomes: only the requested days are summed', () => {
  const byDay = accumulateTrialOutcomes(
    [
      sync('sub_1', 'trialing', '2026-07-01'),
      sync('sub_1', 'active', '2026-07-08'),
      sync('sub_2', 'trialing', '2026-08-01'),
      sync('sub_2', 'active', '2026-08-08'),
    ],
    [],
  );
  const out = summarizeTrialOutcomes(byDay, ['2026-08-01', '2026-08-08'], 30);
  assert.equal(out.converted, 1);
  assert.equal(out.boarded, 1);
});

test('summarizeTrialOutcomes: no decided trials means no rate, not a zero rate', () => {
  const out = summarizeTrialOutcomes(new Map(), ['2026-08-01'], 30);
  assert.equal(out.conversionRate, null);
  assert.deepEqual(
    { boarded: out.boarded, converted: out.converted, rolledOff: out.rolledOff, stalled: out.stalled },
    emptyConveyorDelta(),
  );
});

// ── summarizeRiders / sortRidersByDeadline ─────────────────────────────────

test('summarizeRiders: only running riders carry belt value; the rest are at risk', () => {
  const t = summarizeRiders([
    rider({ userId: 'u1', state: 'running', monthlyValue: 59 }),
    rider({ userId: 'u2', state: 'running', monthlyValue: 39 }),
    rider({ userId: 'u3', state: 'rollingOff', monthlyValue: 59 }),
    rider({ userId: 'u4', state: 'stalled', monthlyValue: 39 }),
  ]);
  assert.equal(t.running, 2);
  assert.equal(t.rollingOff, 1);
  assert.equal(t.stalled, 1);
  assert.equal(t.beltValue, 98);
  assert.equal(t.atRiskValue, 98);
});

test('summarizeRiders: next conversion ignores riders that are leaving, not paying', () => {
  const t = summarizeRiders([
    rider({ userId: 'u1', state: 'rollingOff', convertsAt: '2026-08-25T00:00:00.000Z' }),
    rider({ userId: 'u2', state: 'stalled', convertsAt: '2026-08-26T00:00:00.000Z' }),
    rider({ userId: 'u3', state: 'running', convertsAt: '2026-08-28T00:00:00.000Z' }),
    rider({ userId: 'u4', state: 'running', convertsAt: '2026-08-27T00:00:00.000Z' }),
  ]);
  assert.equal(t.nextConversionAt, '2026-08-27T00:00:00.000Z');
});

test('summarizeRiders: an empty belt reports zeros and no next conversion', () => {
  const t = summarizeRiders([]);
  assert.deepEqual(t, {
    running: 0,
    rollingOff: 0,
    stalled: 0,
    beltValue: 0,
    atRiskValue: 0,
    nextConversionAt: null,
  });
});

test('sortRidersByDeadline: soonest first, deadline-less riders last', () => {
  const ordered = sortRidersByDeadline([
    rider({ userId: 'late', convertsAt: '2026-08-29T00:00:00.000Z' }),
    rider({ userId: 'unknown', convertsAt: null }),
    rider({ userId: 'soon', convertsAt: '2026-08-27T00:00:00.000Z' }),
  ]);
  assert.deepEqual(ordered.map((r) => r.userId), ['soon', 'late', 'unknown']);
});

test('sortRidersByDeadline: does not mutate the caller’s array', () => {
  const input = [rider({ userId: 'b', convertsAt: '2026-08-29T00:00:00.000Z' }), rider({ userId: 'a', convertsAt: '2026-08-27T00:00:00.000Z' })];
  sortRidersByDeadline(input);
  assert.deepEqual(input.map((r) => r.userId), ['b', 'a']);
});

// ── The trial-end `active` is provisional ──────────────────────────────────
// Stripe flips a subscription to `active` when the post-trial invoice is
// CREATED, ~an hour before the charge is attempted. Booking that as a
// conversion counts members who then declined — inflating both the converted
// total and the yield rate with people who never paid a cent. These cases are
// taken from a real production account (jordanjosh7718): trialing → active →
// deleted an hour later, no past_due anywhere.

test('trial end → active → DELETED an hour later is a roll-off, not a conversion', () => {
  const byDay = accumulateTrialOutcomes(
    [sync('sub_1', 'trialing', '2026-08-20'), sync('sub_1', 'active', '2026-08-27')],
    [del('sub_1', '2026-08-27')],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 0, rolledOff: 1, stalled: 0 });
  assert.equal(byDay.get('2026-08-27')?.converted, 0, 'the provisional conversion must be revoked');
  assert.equal(byDay.get('2026-08-27')?.rolledOff, 1);
});

test('trial end → active → past_due is a stall, not a conversion', () => {
  const byDay = accumulateTrialOutcomes(
    [
      sync('sub_1', 'trialing', '2026-08-20'),
      sync('sub_1', 'active', '2026-08-27'),
      sync('sub_1', 'past_due', '2026-08-28'),
    ],
    [],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 0, rolledOff: 0, stalled: 1 });
});

test('a stalled trial that recovers converts on the RETRY that succeeded', () => {
  const byDay = accumulateTrialOutcomes(
    [
      sync('sub_1', 'trialing', '2026-08-20'),
      sync('sub_1', 'active', '2026-08-27'), // provisional
      sync('sub_1', 'past_due', '2026-08-28'), // declined — revoked, stalled
      sync('sub_1', 'active', '2026-08-29'), // Smart Retry recovered it
    ],
    [],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 1, rolledOff: 0, stalled: 1 });
  assert.equal(byDay.get('2026-08-29')?.converted, 1);
});

test('a confirmed conversion churning a cycle later is NOT a trial roll-off', () => {
  // The whole point of the confirmation window: ordinary churn is a full
  // billing cycle out, so the conversion stands and nothing books as a roll-off.
  const byDay = accumulateTrialOutcomes(
    [sync('sub_1', 'trialing', '2026-08-20'), sync('sub_1', 'active', '2026-08-27')],
    [del('sub_1', '2026-09-27')],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 1, rolledOff: 0, stalled: 0 });
});

test('the confirmation window boundary holds on both sides', () => {
  const outcome = (deleteDay: string) =>
    totals(
      accumulateTrialOutcomes(
        [sync('s', 'trialing', '2026-08-20'), sync('s', 'active', '2026-08-27')],
        [del('s', deleteDay)],
      ),
    );
  // Inside the window (≤ 2 days): the charge never landed.
  assert.deepEqual(outcome('2026-08-29'), { boarded: 1, converted: 0, rolledOff: 1, stalled: 0 });
  // Outside it: a real customer who churned.
  assert.deepEqual(outcome('2026-08-30'), { boarded: 1, converted: 1, rolledOff: 0, stalled: 0 });
});

test('a terminal STATUS soon after active revokes the conversion too', () => {
  // Same failure reported as a status sync rather than a deletion row.
  const byDay = accumulateTrialOutcomes(
    [
      sync('sub_1', 'trialing', '2026-08-20'),
      sync('sub_1', 'active', '2026-08-27'),
      sync('sub_1', 'canceled', '2026-08-27'),
    ],
    [],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 0, rolledOff: 1, stalled: 0 });
});

test('a revoked conversion is still not double-booked across both streams', () => {
  const byDay = accumulateTrialOutcomes(
    [
      sync('sub_1', 'trialing', '2026-08-20'),
      sync('sub_1', 'active', '2026-08-27'),
      sync('sub_1', 'canceled', '2026-08-27'),
    ],
    [del('sub_1', '2026-08-27')],
  );
  assert.equal(totals(byDay).rolledOff, 1);
  assert.equal(totals(byDay).converted, 0);
});

test('a clean conversion with no failure is unaffected', () => {
  const byDay = accumulateTrialOutcomes(
    [sync('sub_1', 'trialing', '2026-08-20'), sync('sub_1', 'active', '2026-08-27')],
    [],
  );
  assert.deepEqual(totals(byDay), { boarded: 1, converted: 1, rolledOff: 0, stalled: 0 });
});

test('the yield rate no longer counts a failed conversion as converted', () => {
  // Two trials: one really paid, one is the jordanjosh sequence. 50%, not 100%.
  const byDay = accumulateTrialOutcomes(
    [
      sync('paid', 'trialing', '2026-08-20'),
      sync('paid', 'active', '2026-08-27'),
      sync('failed', 'trialing', '2026-08-20'),
      sync('failed', 'active', '2026-08-27'),
    ],
    [del('failed', '2026-08-27')],
  );
  const out = summarizeTrialOutcomes(byDay, ['2026-08-20', '2026-08-27'], 30);
  assert.equal(out.converted, 1);
  assert.equal(out.rolledOff, 1);
  assert.equal(out.conversionRate, 0.5);
});

// ── Committed forward projection ───────────────────────────────────────────
// The dashed continuation of the Full Subscriber line. It must only ever move
// on things already scheduled, and must not quietly lose an overdue one.

const DAYS7 = ['2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02', '2026-09-03'];

test('projection: conversions add and scheduled departures subtract, day by day', () => {
  const p = projectFullSubscribers({
    startCount: 100,
    days: DAYS7,
    conversionDays: ['2026-08-28', '2026-08-30', '2026-08-30'],
    departureDays: ['2026-08-29'],
  });
  assert.deepEqual(p.map((x) => x.projected), [101, 100, 102, 102, 102, 102, 102]);
  assert.equal(p[2].conversions, 2);
  assert.equal(p[1].departures, 1);
});

test('projection: a flat window just carries the current count forward', () => {
  const p = projectFullSubscribers({ startCount: 105, days: DAYS7, conversionDays: [], departureDays: [] });
  assert.deepEqual(new Set(p.map((x) => x.projected)), new Set([105]));
});

test('projection: anything already overdue lands on the first day, not nowhere', () => {
  // A charge due yesterday is imminent, so dropping it would understate the
  // very next step of the line.
  const p = projectFullSubscribers({
    startCount: 10,
    days: DAYS7,
    conversionDays: ['2026-08-01'],
    departureDays: ['2026-07-15'],
  });
  assert.equal(p[0].conversions, 1);
  assert.equal(p[0].departures, 1);
  assert.equal(p[0].projected, 10);
});

test('projection: events beyond the horizon are outside the window, not folded in', () => {
  const p = projectFullSubscribers({
    startCount: 10,
    days: DAYS7,
    conversionDays: ['2026-12-01'],
    departureDays: ['2026-12-02'],
  });
  assert.deepEqual(p.map((x) => x.projected), Array(7).fill(10));
});

test('projection: never renders below zero', () => {
  const p = projectFullSubscribers({
    startCount: 1,
    days: DAYS7,
    conversionDays: [],
    departureDays: ['2026-08-28', '2026-08-29', '2026-08-30'],
  });
  assert.deepEqual(p.map((x) => x.projected), [0, 0, 0, 0, 0, 0, 0]);
});

test('projection: undated entries are skipped rather than guessed onto a day', () => {
  const p = projectFullSubscribers({
    startCount: 50,
    days: DAYS7,
    conversionDays: [null, null],
    departureDays: [null],
  });
  assert.deepEqual(p.map((x) => x.projected), Array(7).fill(50));
});

test('projection: an empty horizon yields no points', () => {
  assert.deepEqual(
    projectFullSubscribers({ startCount: 5, days: [], conversionDays: ['2026-08-28'], departureDays: [] }),
    [],
  );
});
