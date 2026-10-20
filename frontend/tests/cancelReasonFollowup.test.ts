import test from 'node:test';
import assert from 'node:assert/strict';
import { decideCancelReasonFollowup, type FollowupInput } from '../core/cancelReasonFollowup.ts';
import { classifyExclusion } from '../core/excludedAccounts.ts';

// A member who clicked Cancel, still has access, and picked "Too expensive".
function pending(over: Partial<FollowupInput> = {}): FollowupInput {
  return {
    feedback: 'too_expensive',
    exclusion: null,
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
  assert.deepEqual(decideCancelReasonFollowup(pending({ exclusion: 'admin' })), { send: false, skip: 'admin' });
  assert.deepEqual(decideCancelReasonFollowup(pending({ alreadySent: true })), { send: false, skip: 'already_sent' });
  assert.deepEqual(decideCancelReasonFollowup(lapsed({ moneyBackRefunded: true })), { send: false, skip: 'refunded' });
});

test('creator partners and comped members get no offer, in either state', () => {
  // Rows as the users table holds them, through the same classifier the growth
  // numbers use. A partner or comped member who paid before can have a recent
  // cancel on file and an ended subscription, which is exactly the "50% off to
  // come back" state.
  const partner = classifyExclusion({
    tier: 'pro',
    partner_tier: 'creator',
    partner_pro_grant_expires_at: '2027-01-17T00:00:00.000Z',
    comped: 0,
  });
  const comped = classifyExclusion({ tier: 'pro', partner_tier: null, partner_pro_grant_expires_at: null, comped: 1 });
  for (const feedback of ['too_expensive', 'too_complex'] as const) {
    for (const state of [pending, lapsed]) {
      assert.deepEqual(decideCancelReasonFollowup(state({ feedback, exclusion: partner })), {
        send: false,
        skip: 'partner_grant',
      });
      assert.deepEqual(decideCancelReasonFollowup(state({ feedback, exclusion: comped })), {
        send: false,
        skip: 'comped',
      });
    }
  }
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
