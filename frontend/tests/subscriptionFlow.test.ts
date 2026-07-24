import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accumulateSubscriptionFlow,
  emptyFlowDelta,
  parseSyncTierStrict,
  type FlowDelta,
  type FlowSyncEvent,
  type FlowDeleteEvent,
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
