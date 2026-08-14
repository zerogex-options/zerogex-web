import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canClaimTrialConversionOffer,
  shouldStackTrialDiscount,
  type TrialOfferEligibility,
} from '../core/trialOffer.ts';

// The pre-trial-end conversion offer's two guards: WHO may claim it (trialing,
// one-shot) and WHETHER to actually stack the discount (never onto a member who
// already carries an intro coupon). Getting the second wrong double-discounts
// promo holders, so lock it down.

function elig(over: Partial<TrialOfferEligibility> = {}): TrialOfferEligibility {
  return { subscriptionStatus: 'trialing', retentionOfferClaimedAt: null, ...over };
}

test('a trialing member with an unclaimed offer can claim', () => {
  assert.equal(canClaimTrialConversionOffer(elig()), true);
});

test('an already-claimed one-shot offer is never claimable again', () => {
  assert.equal(
    canClaimTrialConversionOffer(elig({ retentionOfferClaimedAt: '2026-08-01T00:00:00Z' })),
    false,
  );
});

test('only trialing members qualify — active (already converted) and others do not', () => {
  for (const status of ['active', 'past_due', 'canceled', 'unpaid', null]) {
    assert.equal(
      canClaimTrialConversionOffer(elig({ subscriptionStatus: status })),
      false,
      `status ${status} should not be claimable`,
    );
  }
});

test('stack the discount only onto a subscription with no existing coupon', () => {
  assert.equal(shouldStackTrialDiscount(0), true);
  // A promo / founding / referral coupon already present → do not double up.
  assert.equal(shouldStackTrialDiscount(1), false);
  assert.equal(shouldStackTrialDiscount(2), false);
});
