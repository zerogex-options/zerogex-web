import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSubscriberLedger,
  classifySubscriberBucket,
  normalizeBucketTier,
  summarizeLedger,
  type LedgerSyncEvent,
  type SubscriberBucketInput,
} from '../core/subscriberBucket.ts';

// This classifier must agree, row for row, with the GROUP BY in
// currentPayingCounts (core/monitoring.ts) that draws the Total Subscribers
// chart. That SQL is reproduced here as the oracle, so the two can't drift:
// if someone edits the chart's buckets without editing this, these fail.
//
//   WHERE subscription_status IN ('active','trialing')
//      OR (subscription_status = 'past_due' AND tier IN ('pro','basic'))
//   CASE WHEN subscription_status = 'trialing'                  THEN 'trialing'
//        WHEN subscription_status = 'past_due'
//             AND payment_grace_reason = 'trial'                THEN 'graceTrial'
//        ELSE                                                        'active'
function sqlOracle(row: SubscriberBucketInput): string {
  const tier = normalizeBucketTier(row.tier);
  const inWhere =
    row.subscriptionStatus === 'active' ||
    row.subscriptionStatus === 'trialing' ||
    (row.subscriptionStatus === 'past_due' && (tier === 'pro' || tier === 'basic'));
  if (!inWhere) return 'notCounted';
  if (row.subscriptionStatus === 'trialing') return 'freeTrial';
  if (row.subscriptionStatus === 'past_due' && row.paymentGraceReason === 'trial') return 'trialGrace';
  return 'fullSubscriber';
}

const STATUSES = ['active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete', 'paused', null];
const TIERS = ['pro', 'basic', 'public', 'starter', 'elite', 'admin', null];
const REASONS = ['trial', 'renewal', null];

test('classifier agrees with the chart SQL across every state combination', () => {
  for (const subscriptionStatus of STATUSES) {
    for (const tier of TIERS) {
      for (const paymentGraceReason of REASONS) {
        const row = { subscriptionStatus, tier, paymentGraceReason };
        assert.equal(
          classifySubscriberBucket(row).bucket,
          sqlOracle(row),
          `status=${subscriptionStatus} tier=${tier} reason=${paymentGraceReason}`,
        );
      }
    }
  }
});

test('a trial-conversion failure inside the window reads Trial Grace', () => {
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'pro',
    paymentGraceReason: 'trial',
  });
  assert.equal(v.bucket, 'trialGrace');
  assert.equal(v.label, 'Trial Grace');
});

test('the same failure MISLABELLED renewal hides in Full Subscriber', () => {
  // This is the bug the trial_end fix corrects, stated as a fact about the
  // chart: a member who has never paid a cent reads as a full subscriber.
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'pro',
    paymentGraceReason: 'renewal',
  });
  assert.equal(v.bucket, 'fullSubscriber');
});

test('once the tier drops to public the member leaves the chart entirely', () => {
  // Not Trial Grace, not Full Subscriber — nowhere. This is what a Full
  // Subscriber count falling by one actually looks like.
  for (const paymentGraceReason of ['trial', 'renewal', null]) {
    const v = classifySubscriberBucket({
      subscriptionStatus: 'past_due',
      tier: 'public',
      paymentGraceReason,
    });
    assert.equal(v.bucket, 'notCounted', `reason=${paymentGraceReason}`);
    assert.match(v.why, /dropped to public/);
  }
});

test('a trialer who has clicked Cancel still counts as Free Trial', () => {
  const v = classifySubscriberBucket({
    subscriptionStatus: 'trialing',
    tier: 'pro',
    paymentGraceReason: null,
    cancelAtPeriodEnd: true,
  });
  assert.equal(v.bucket, 'freeTrial');
  assert.match(v.why, /cancel already scheduled/);
});

test('an unattributed legacy grace window still reads Full Subscriber', () => {
  const v = classifySubscriberBucket({
    subscriptionStatus: 'past_due',
    tier: 'basic',
    paymentGraceReason: null,
  });
  assert.equal(v.bucket, 'fullSubscriber');
  assert.match(v.why, /unattributed/);
});

test('legacy tier ids fold like currentTierCounts', () => {
  assert.equal(normalizeBucketTier('starter'), 'basic');
  assert.equal(normalizeBucketTier('elite'), 'pro');
  assert.equal(normalizeBucketTier('pro'), 'pro');
  assert.equal(normalizeBucketTier(null), null);
  // ...and a legacy tier keeps its grace row on the chart.
  assert.equal(
    classifySubscriberBucket({
      subscriptionStatus: 'past_due',
      tier: 'elite',
      paymentGraceReason: 'trial',
    }).bucket,
    'trialGrace',
  );
});

// ── The ledger ─────────────────────────────────────────────────────────────
// Its contract: the per-row deltas must ACCOUNT for the headcount. If Full
// Subscribers moved by -1 over a window, exactly one row in that window must
// carry fullSubscriberDelta -1, naming the member and saying why. That is the
// whole point — no unexplained movement.

function sync(over: Partial<LedgerSyncEvent> & { at: string }): LedgerSyncEvent {
  return {
    subId: 'sub_1',
    userId: 'u1',
    email: 'a@example.com',
    status: 'active',
    tier: 'pro',
    cancelAtPeriodEnd: false,
    ...over,
  };
}

test('a trial that converts then fails accounts for the 106 -> 105 blip', () => {
  // jordanjosh7718's real production sequence, verbatim.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-20T23:44:44Z', status: 'trialing' }),
      sync({ at: '2026-08-27T23:45:20Z', status: 'active' }),
    ],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-08-28T00:45:51Z' }],
  );
  assert.deepEqual(rows.map((r) => r.kind), ['accessEnded', 'converted', 'trialStarted']);
  // The +1 that took the count up, and the -1 an hour later that took it back.
  assert.equal(rows[1].fullSubscriberDelta, 1);
  assert.equal(rows[0].fullSubscriberDelta, -1);
  assert.match(rows[0].detail, /first charge failed/);
  assert.deepEqual(summarizeLedger(rows), { fullSubscriber: 0, freeTrial: 0, trialGrace: 0 });
});

test('a scheduled cancellation warns first, then accounts for the drop', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-07-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-01T00:00:00Z', status: 'active', cancelAtPeriodEnd: true }),
    ],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-09-01T00:00:00Z' }],
  );
  const kinds = rows.map((r) => r.kind);
  assert.deepEqual(kinds, ['accessEnded', 'cancelScheduled', 'converted']);
  // The warning itself moves nothing — they keep access until the period ends.
  const scheduled = rows.find((r) => r.kind === 'cancelScheduled')!;
  assert.equal(scheduled.fullSubscriberDelta, 0);
  // The departure a month later is the row that moves the count.
  assert.equal(rows[0].fullSubscriberDelta, -1);
  assert.match(rows[0].detail, /Scheduled cancellation took effect/);
});

test('a reversed cancellation is recorded and moves nothing', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-07-01T00:00:00Z' }),
      sync({ at: '2026-07-02T00:00:00Z', cancelAtPeriodEnd: true }),
      sync({ at: '2026-07-03T00:00:00Z', cancelAtPeriodEnd: false }),
    ],
    [],
  );
  const reverted = rows.find((r) => r.kind === 'cancelReverted');
  assert.ok(reverted, 'the save should be visible in the ledger');
  assert.equal(reverted!.fullSubscriberDelta, 0);
  assert.equal(summarizeLedger(rows).fullSubscriber, 1); // just the original add
});

test('a trial charge declined lands on the Trial Grace line, not Full Subscribers', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-08-08T00:00:00Z', status: 'past_due', tier: 'pro' }),
    ],
    [],
  );
  const declined = rows.find((r) => r.kind === 'trialChargeDeclined')!;
  assert.equal(declined.trialGraceDelta, 1);
  assert.equal(declined.freeTrialDelta, -1);
  assert.equal(declined.fullSubscriberDelta, 0);
});

test('an established payer failing a renewal is reported but moves nothing', () => {
  // Access is retained through the recovery window, so the count must not move —
  // but the operator still needs to see it coming.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-06-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-01T00:00:00Z', status: 'past_due', tier: 'pro' }),
    ],
    [],
  );
  const failed = rows.find((r) => r.kind === 'renewalFailed');
  assert.ok(failed, 'a renewal failure must be visible');
  assert.equal(failed!.fullSubscriberDelta, 0);
  assert.equal(failed!.trialGraceDelta, 0, 'an established payer is not trial grace');
});

test('repeated no-op syncs do not spam the ledger', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-02T00:00:00Z', status: 'active' }),
      sync({ at: '2026-08-03T00:00:00Z', status: 'active' }),
    ],
    [],
  );
  assert.equal(rows.length, 1);
});

test('rows come back newest-first', () => {
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-08-08T00:00:00Z', status: 'active' }),
    ],
    [],
  );
  assert.ok(Date.parse(rows[0].at) > Date.parse(rows[1].at));
});

test('a deletion for a member already off the chart books nothing', () => {
  // Otherwise a lapsed member would be double-counted out of the headcount.
  const rows = buildSubscriberLedger(
    [
      sync({ at: '2026-08-01T00:00:00Z', status: 'trialing' }),
      sync({ at: '2026-08-08T00:00:00Z', status: 'canceled', tier: 'public' }),
    ],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: '2026-08-09T00:00:00Z' }],
  );
  assert.equal(rows.filter((r) => r.kind === 'accessEnded').length, 1);
  assert.equal(summarizeLedger(rows).freeTrial, 0);
});

test('malformed timestamps are skipped rather than throwing', () => {
  const rows = buildSubscriberLedger(
    [sync({ at: 'not-a-date', status: 'trialing' }), sync({ at: '2026-08-01T00:00:00Z', status: 'trialing' })],
    [{ subId: 'sub_1', userId: 'u1', email: 'a@example.com', at: 'nope' }],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, 'trialStarted');
});
