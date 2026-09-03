import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accumulateSubscriptionFlow,
  accumulateFlowByWeekday,
  weekdayFromDayKey,
  emptyFlowDelta,
  parseSyncTierStrict,
  WEEKDAY_LABELS,
  type FlowDelta,
  type FlowSyncEvent,
  type FlowDeleteEvent,
  type FlowCounts,
} from '../core/subscriptionFlow.ts';

// The subscription-flow accumulator is the source of the admin "Subscription
// Flow" bars. Its contract: each day's bars sum to the change in Total
// Subscribers, and a member in the payment-recovery grace window stays a
// subscriber (no loss booked) until access actually drops. Lock that down.

function sync(subId: string, status: string, tier: string | null, day: string): FlowSyncEvent {
  return { subId, status, tier: tier as FlowSyncEvent['tier'], day };
}
function del(subId: string | null, day: string): FlowDeleteEvent {
  return { subId, day };
}
function totals(map: Map<string, FlowDelta>): FlowDelta {
  const t = emptyFlowDelta();
  for (const d of map.values()) {
    for (const k of Object.keys(t) as (keyof FlowDelta)[]) t[k] += d[k];
  }
  return t;
}

test('parseSyncTierStrict: paid tiers, public, legacy aliases, and unknown', () => {
  assert.equal(parseSyncTierStrict('Subscription sub_1 status=active tier=pro cancelAtPeriodEnd=false'), 'pro');
  assert.equal(parseSyncTierStrict('Subscription sub_1 status=active tier=basic cancelAtPeriodEnd=false'), 'basic');
  assert.equal(parseSyncTierStrict('Subscription sub_1 status=past_due tier=public cancelAtPeriodEnd=false'), 'public');
  assert.equal(parseSyncTierStrict('tier=elite'), 'pro');
  assert.equal(parseSyncTierStrict('tier=starter'), 'basic');
  assert.equal(parseSyncTierStrict('tier=admin'), null);
  assert.equal(parseSyncTierStrict('no tier token here'), null);
});

test('a new conversion books exactly one add, on the first paid day', () => {
  const flow = accumulateSubscriptionFlow(
    [sync('s1', 'trialing', 'pro', 'd1'), sync('s1', 'active', 'pro', 'd2')],
    [],
  );
  assert.equal(flow.get('d1')?.proAdd, 1);
  assert.equal(totals(flow).proAdd, 1);
  assert.equal(flow.get('d2'), undefined); // trial->active is not a second event
});

test('GRACE SAVE: past_due then recovery books nothing (the core fix)', () => {
  // active -> past_due (tier retained = in grace) -> active. The member never
  // stopped being a subscriber, so there is no loss and no reactivation.
  const flow = accumulateSubscriptionFlow(
    [
      sync('s1', 'active', 'pro', 'd1'),
      sync('s1', 'past_due', 'pro', 'd2'),
      sync('s1', 'active', 'pro', 'd3'),
    ],
    [],
  );
  const t = totals(flow);
  assert.equal(t.proAdd, 1); // only the original conversion
  assert.equal(t.proPaymentFail, 0);
  assert.equal(t.proReactivate, 0);
  assert.equal(flow.get('d2'), undefined);
  assert.equal(flow.get('d3'), undefined);
});

test('GRACE EXPIRY: the loss books on the day tier actually drops to public', () => {
  const flow = accumulateSubscriptionFlow(
    [
      sync('s1', 'active', 'pro', 'd1'),
      sync('s1', 'past_due', 'pro', 'd2'), // still in grace — no booking
      sync('s1', 'past_due', 'public', 'd3'), // grace expired — access drops
    ],
    [],
  );
  assert.equal(flow.get('d2'), undefined);
  assert.equal(flow.get('d3')?.proPaymentFail, -1);
  assert.equal(totals(flow).proPaymentFail, -1);
});

test('trial-conversion failure downgrades immediately (no grace for trials)', () => {
  const flow = accumulateSubscriptionFlow(
    [sync('s1', 'trialing', 'pro', 'd1'), sync('s1', 'past_due', 'public', 'd2')],
    [],
  );
  assert.equal(flow.get('d1')?.proAdd, 1);
  assert.equal(flow.get('d2')?.proPaymentFail, -1);
});

test('a clean deletion is a voluntary cancel', () => {
  const flow = accumulateSubscriptionFlow(
    [sync('s1', 'active', 'basic', 'd1')],
    [del('s1', 'd2')],
  );
  assert.equal(flow.get('d2')?.basicCancel, -1);
  assert.equal(totals(flow).basicCancel, -1);
  assert.equal(totals(flow).basicPaymentFail, 0);
});

test('TERMINAL payment failure: deleted straight out of grace is a payment fail, not a cancel', () => {
  const flow = accumulateSubscriptionFlow(
    [
      sync('s1', 'active', 'pro', 'd1'),
      sync('s1', 'past_due', 'pro', 'd2'), // in grace; Stripe then exhausts retries and deletes
    ],
    [del('s1', 'd3')],
  );
  assert.equal(flow.get('d3')?.proPaymentFail, -1);
  assert.equal(totals(flow).proCancel, 0);
});

test('no double count: a sync-drop then a later deletion books the loss once', () => {
  const flow = accumulateSubscriptionFlow(
    [
      sync('s1', 'active', 'pro', 'd1'),
      sync('s1', 'past_due', 'public', 'd2'), // already dropped + booked here
    ],
    [del('s1', 'd3')], // Stripe's delayed cleanup — must NOT book again
  );
  assert.equal(totals(flow).proPaymentFail, -1);
  assert.equal(flow.get('d3'), undefined);
});

test('recovery AFTER a real drop books a reactivation', () => {
  const flow = accumulateSubscriptionFlow(
    [
      sync('s1', 'active', 'pro', 'd1'),
      sync('s1', 'past_due', 'public', 'd2'), // dropped (payment fail)
      sync('s1', 'active', 'pro', 'd3'), // came back
    ],
    [],
  );
  assert.equal(flow.get('d2')?.proPaymentFail, -1);
  assert.equal(flow.get('d3')?.proReactivate, 1);
});

test('a pro<->basic tier switch is not a loss or an add (still a subscriber)', () => {
  const flow = accumulateSubscriptionFlow(
    [sync('s1', 'active', 'pro', 'd1'), sync('s1', 'active', 'basic', 'd2')],
    [],
  );
  const t = totals(flow);
  assert.equal(t.proAdd, 1);
  assert.equal(t.basicAdd, 0);
  assert.equal(t.proPaymentFail + t.basicPaymentFail, 0);
  assert.equal(t.proCancel + t.basicCancel, 0);
});

test('an unresolvable deleted sub id falls back to a basic cancel (loss never dropped)', () => {
  const flow = accumulateSubscriptionFlow([], [del(null, 'd1')]);
  assert.equal(flow.get('d1')?.basicCancel, -1);
});

test('RECONCILIATION: summed flow equals the net change in subscriber headcount', () => {
  // Five subs in distinct end states, all starting from zero. The signed sum of
  // every flow delta must equal the number still subscribed at the end.
  const syncEvents: FlowSyncEvent[] = [
    // s1: converts and stays
    sync('s1', 'active', 'pro', 'd1'),
    // s2: converts, grace-saved (recovers within grace)
    sync('s2', 'active', 'basic', 'd1'),
    sync('s2', 'past_due', 'basic', 'd2'),
    sync('s2', 'active', 'basic', 'd3'),
    // s3: converts, grace expires -> dropped
    sync('s3', 'active', 'pro', 'd1'),
    sync('s3', 'past_due', 'pro', 'd2'),
    sync('s3', 'past_due', 'public', 'd4'),
    // s5: converts, drops, then recovers (reactivation)
    sync('s5', 'active', 'pro', 'd1'),
    sync('s5', 'past_due', 'public', 'd2'),
    sync('s5', 'active', 'pro', 'd5'),
  ];
  // s4: converts, voluntary cancel
  const s4: FlowSyncEvent[] = [sync('s4', 'active', 'basic', 'd1')];
  const deleteEvents: FlowDeleteEvent[] = [del('s4', 'd3')];

  const flow = accumulateSubscriptionFlow([...syncEvents, ...s4], deleteEvents);
  const t = totals(flow);
  const net =
    t.proAdd + t.basicAdd + t.proReactivate + t.basicReactivate +
    t.proPaymentFail + t.basicPaymentFail + t.proCancel + t.basicCancel;

  // Independent oracle: subs whose final tier is paid and not deleted (s1, s2, s5).
  assert.equal(net, 3);
});

// --- Weekday breakdown -----------------------------------------------------
// ── Pause is not churn ─────────────────────────────────────────────────────
// Stripe leaves a PAUSED subscription `active` while the webhook grants no tier,
// so the member genuinely leaves the headcount — but filing that under
// payment-failure downgrades reported a deliberate, bounded break as involuntary
// churn, and made the retention lever look like a billing problem.

test('a retention pause books its own family, not a payment failure', () => {
  const flow = accumulateSubscriptionFlow(
    [
      sync('s1', 'active', 'pro', 'd1'),
      sync('s1', 'active', 'public', 'd2'), // pause_collection set: still active, no tier
    ],
    [],
  );
  const t = totals(flow);
  assert.equal(t.proPause, -1);
  assert.equal(t.proPaymentFail, 0, 'a pause is not a declined card');
  assert.equal(t.proCancel, 0, 'and it is not a cancellation either');
});

test('resuming a pause comes back as a reactivation', () => {
  const flow = accumulateSubscriptionFlow(
    [
      sync('s1', 'active', 'pro', 'd1'),
      sync('s1', 'active', 'public', 'd2'),
      sync('s1', 'active', 'pro', 'd3'),
    ],
    [],
  );
  const t = totals(flow);
  assert.equal(t.proPause, -1);
  assert.equal(t.proReactivate, 1);
  // The whole episode nets to zero, exactly as the headcount does.
  assert.equal(t.proAdd + t.proReactivate + t.proPause, 1, 'only the original add survives');
});

test('a dunning drop is still a payment failure, not a pause', () => {
  // The status is what tells them apart: tier->public from past_due is grace
  // expiring, and that must keep reading as involuntary churn.
  const flow = accumulateSubscriptionFlow(
    [sync('s1', 'active', 'pro', 'd1'), sync('s1', 'past_due', 'public', 'd2')],
    [],
  );
  const t = totals(flow);
  assert.equal(t.proPaymentFail, -1);
  assert.equal(t.proPause, 0);
});

// ── The unretryable first charge ───────────────────────────────────────────
// Stripe deletes a subscription outright — with no past_due at all — when the
// post-trial charge fails on a payment method it won't retry. The last synced
// status is then the trial-end `active`, which used to read as a clean exit and
// file a declined card under voluntary cancellations.

test('a trial deleted right after its first charge is a payment failure', () => {
  const flow = accumulateSubscriptionFlow(
    [sync('s1', 'trialing', 'pro', '2026-08-01'), sync('s1', 'active', 'pro', '2026-08-08')],
    [del('s1', '2026-08-08')],
  );
  const t = totals(flow);
  assert.equal(t.proPaymentFail, -1);
  assert.equal(t.proCancel, 0, 'nobody chose to leave here — the card was refused');
});

test('a converted member canceling a cycle later is still a voluntary cancel', () => {
  // Well outside the first-charge window, so this must not be re-attributed.
  const flow = accumulateSubscriptionFlow(
    [sync('s1', 'trialing', 'pro', '2026-08-01'), sync('s1', 'active', 'pro', '2026-08-08')],
    [del('s1', '2026-09-08')],
  );
  const t = totals(flow);
  assert.equal(t.proCancel, -1);
  assert.equal(t.proPaymentFail, 0);
});

test('a sub that never trialed keeps the old deletion attribution', () => {
  const flow = accumulateSubscriptionFlow(
    [sync('s1', 'active', 'pro', '2026-08-01')],
    [del('s1', '2026-08-01')],
  );
  assert.equal(totals(flow).proCancel, -1);
});

// accumulateFlowByWeekday folds the per-day flow onto the seven weekdays for the
// admin "Subscription Flow by Weekday" card. Its contract: correct weekday from
// an ET date key (timezone-independent), fair `days` denominator, and sums that
// stay reconciled with the input.

function emptyCounts(): FlowCounts {
  return {
    proAdd: 0,
    basicAdd: 0,
    proReactivate: 0,
    basicReactivate: 0,
    proCancel: 0,
    basicCancel: 0,
    proPaymentFail: 0,
    basicPaymentFail: 0,
    proPause: 0,
    basicPause: 0,
    registrations: 0,
  };
}
function fp(day: string, partial: Partial<FlowCounts>): { day: string } & FlowCounts {
  return { day, ...emptyCounts(), ...partial };
}

test('weekdayFromDayKey: Mon→Sun index, timezone-independent, bad keys → null', () => {
  // 2024-01-01 was a Monday; the week runs to Sunday 2024-01-07.
  assert.equal(weekdayFromDayKey('2024-01-01'), 0); // Mon
  assert.equal(weekdayFromDayKey('2024-01-02'), 1); // Tue
  assert.equal(weekdayFromDayKey('2024-01-05'), 4); // Fri
  assert.equal(weekdayFromDayKey('2024-01-06'), 5); // Sat
  assert.equal(weekdayFromDayKey('2024-01-07'), 6); // Sun
  assert.equal(weekdayFromDayKey('2024-01-08'), 0); // back to Mon
  // Malformed or impossible dates are rejected, not guessed onto a weekday.
  assert.equal(weekdayFromDayKey('2026-02-31'), null); // rolls into March
  assert.equal(weekdayFromDayKey('2026-13-01'), null); // no 13th month
  assert.equal(weekdayFromDayKey('2026-08'), null); // wrong shape
  assert.equal(weekdayFromDayKey('not-a-date'), null);
});

test('accumulateFlowByWeekday: always 7 buckets in Mon→Sun order', () => {
  const out = accumulateFlowByWeekday([]);
  assert.equal(out.length, 7);
  assert.deepEqual(out.map((b) => b.label), [...WEEKDAY_LABELS]);
  assert.deepEqual(out.map((b) => b.weekday), [0, 1, 2, 3, 4, 5, 6]);
  // Empty input → every bucket zeroed with a zero denominator.
  assert.ok(out.every((b) => b.days === 0 && b.proAdd === 0 && b.registrations === 0));
});

test('accumulateFlowByWeekday: sums land on the right weekday and count occurrences', () => {
  const out = accumulateFlowByWeekday([
    fp('2024-01-01', { proAdd: 2, basicAdd: 1, registrations: 5 }), // Mon
    fp('2024-01-08', { proAdd: 3, proCancel: -1 }), // Mon (next week)
    fp('2024-01-02', { basicAdd: 4 }), // Tue
    fp('2024-01-07', { proPaymentFail: -2, registrations: 1 }), // Sun
  ]);
  const mon = out[0];
  assert.equal(mon.days, 2); // two Mondays present
  assert.equal(mon.proAdd, 5); // 2 + 3
  assert.equal(mon.basicAdd, 1);
  assert.equal(mon.proCancel, -1);
  assert.equal(mon.registrations, 5);

  const tue = out[1];
  assert.equal(tue.days, 1);
  assert.equal(tue.basicAdd, 4);

  const sun = out[6];
  assert.equal(sun.days, 1);
  assert.equal(sun.proPaymentFail, -2);
  assert.equal(sun.registrations, 1);

  // Untouched weekdays stay empty.
  for (const wd of [2, 3, 4, 5]) {
    assert.equal(out[wd].days, 0);
    assert.equal(out[wd].proAdd, 0);
  }
});

test('accumulateFlowByWeekday: totals reconcile with the input and skip bad keys', () => {
  const points = [
    fp('2024-01-01', { proAdd: 1, basicAdd: 2 }),
    fp('2024-01-02', { proReactivate: 1, basicCancel: -3 }),
    fp('2024-01-03', { proPaymentFail: -1 }),
    fp('bad-key', { proAdd: 99, basicAdd: 99 }), // dropped, not bucketed
  ];
  const out = accumulateFlowByWeekday(points);
  const sum = (k: keyof FlowCounts) => out.reduce((m, b) => m + b[k], 0);
  // The three valid rows are fully represented; the bad key contributes nothing.
  assert.equal(sum('proAdd'), 1);
  assert.equal(sum('basicAdd'), 2);
  assert.equal(sum('proReactivate'), 1);
  assert.equal(sum('basicCancel'), -3);
  assert.equal(sum('proPaymentFail'), -1);
  assert.equal(out.reduce((m, b) => m + b.days, 0), 3); // only the valid rows counted
});

test('accumulateFlowByWeekday: per-weekday average uses the days denominator', () => {
  // Two Mondays of new adds (4 and 2) average to 3/day; a lone Tuesday (10)
  // averages to 10/day — so totals alone (Mon 6 vs Tue 10) and averages (Mon 3
  // vs Tue 10) can rank weekdays differently, which is exactly why `days` exists.
  const out = accumulateFlowByWeekday([
    fp('2024-01-01', { proAdd: 4 }), // Mon
    fp('2024-01-08', { proAdd: 2 }), // Mon
    fp('2024-01-02', { proAdd: 10 }), // Tue
  ]);
  const mon = out[0];
  const tue = out[1];
  assert.equal(mon.proAdd / mon.days, 3);
  assert.equal(tue.proAdd / tue.days, 10);
});
