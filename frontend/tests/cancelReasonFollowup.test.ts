import test from 'node:test';
import assert from 'node:assert/strict';
import { decideCancelReasonFollowup, type FollowupInput } from '../core/cancelReasonFollowup.ts';

// A member who clicked Cancel, still has access, and picked "Too expensive".
function pending(over: Partial<FollowupInput> = {}): FollowupInput {
  return {
    feedback: 'too_expensive',
    tier: 'basic',
    deleted: false,
    marketingUnsubscribed: false,
    alreadySent: false,
    moneyBackRefunded: false,
    hasSubscriptionOnFile: true,
    cancelAtPeriodEnd: true,
    subscriptionStatus: 'trialing',
    subscriptionLapsed: false,
    retentionOfferClaimed: false,
    emailVerified: true,
    ...over,
  };
}

// A member whose subscription has already ended.
function lapsed(over: Partial<FollowupInput> = {}): FollowupInput {
  return pending({
    hasSubscriptionOnFile: false,
    cancelAtPeriodEnd: false,
    subscriptionStatus: 'canceled',
    subscriptionLapsed: true,
    tier: 'public',
    ...over,
  });
}

test('both reasons are answered, in either state', () => {
  for (const feedback of ['too_expensive', 'too_complex'] as const) {
    assert.deepEqual(decideCancelReasonFollowup(pending({ feedback })), {
      send: true,
      reason: feedback,
      state: 'pending',
    });
    assert.deepEqual(decideCancelReasonFollowup(lapsed({ feedback })), {
      send: true,
      reason: feedback,
      state: 'lapsed',
    });
  }
});

test('any other reason, or none, is skipped', () => {
  for (const feedback of [null, 'unused', 'missing_features', 'other']) {
    assert.deepEqual(decideCancelReasonFollowup(pending({ feedback })), { send: false, skip: 'other_reason' });
  }
});

test('opted out, deleted, admin and already-sent members are never written to', () => {
  assert.equal(decideCancelReasonFollowup(pending({ marketingUnsubscribed: true })).send, false);
  assert.equal(decideCancelReasonFollowup(pending({ deleted: true })).send, false);
  assert.equal(decideCancelReasonFollowup(pending({ tier: 'admin' })).send, false);
  assert.deepEqual(decideCancelReasonFollowup(pending({ alreadySent: true })), { send: false, skip: 'already_sent' });
  assert.deepEqual(decideCancelReasonFollowup(lapsed({ moneyBackRefunded: true })), { send: false, skip: 'refunded' });
});

test('a member who kept their plan or came back is left alone', () => {
  // Kept the plan: sub live, cancel cleared.
  assert.deepEqual(decideCancelReasonFollowup(pending({ cancelAtPeriodEnd: false, subscriptionStatus: 'active' })), {
    send: false,
    skip: 'no_longer_canceling',
  });
  // Resubscribed after lapsing: lapsed flag cleared, new sub on file.
  assert.deepEqual(
    decideCancelReasonFollowup(lapsed({ subscriptionLapsed: false, hasSubscriptionOnFile: true, subscriptionStatus: 'active' })),
    { send: false, skip: 'no_longer_canceling' },
  );
  // Payment failed: not ours to write to here.
  assert.deepEqual(decideCancelReasonFollowup(pending({ subscriptionStatus: 'past_due' })), {
    send: false,
    skip: 'no_longer_canceling',
  });
});

test('a pending "too expensive" member who already used the save offer is skipped', () => {
  assert.deepEqual(decideCancelReasonFollowup(pending({ retentionOfferClaimed: true })), {
    send: false,
    skip: 'offer_already_claimed',
  });
  // The "too complex" note carries no offer, so it still goes.
  assert.equal(decideCancelReasonFollowup(pending({ feedback: 'too_complex', retentionOfferClaimed: true })).send, true);
});

test('a lapsed member with an unverified email is skipped (checkout would refuse them)', () => {
  assert.deepEqual(decideCancelReasonFollowup(lapsed({ emailVerified: false })), {
    send: false,
    skip: 'email_unverified',
  });
});
