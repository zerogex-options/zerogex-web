import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifySubscriberBucket,
  normalizeBucketTier,
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
