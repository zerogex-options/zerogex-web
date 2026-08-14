// Pure decision logic for the pre-trial-end CONVERSION offer — the one-click
// discount the ~48h trial-reminder email carries (app/convert/route.ts). It lets
// a trialing member lock in a discount and keep going instead of lapsing at
// trial end.
//
// Kept PURE (no imports) so it's unit-tested without Stripe/DB — same discipline
// as core/paymentGrace.ts and core/cancelRetention.ts. Locked down in
// tests/trialOffer.test.ts.

export type TrialOfferEligibility = {
  // Last-synced Stripe status.
  subscriptionStatus: string | null;
  // users.retention_offer_claimed_at — the one-shot latch SHARED with the
  // cancellation save flow, so a member gets at most one retention/conversion
  // discount across every moment we offer it (can't be farmed).
  retentionOfferClaimedAt: string | null;
};

// Can this member still CLAIM the pre-trial-end conversion discount? Only a
// trialing member who hasn't already used their one-shot offer. An `active`
// member has already converted (the offer is PRE-conversion), and a past_due /
// canceled sub is handled by the dunning / resubscribe paths.
export function canClaimTrialConversionOffer(e: TrialOfferEligibility): boolean {
  if (e.retentionOfferClaimedAt) return false;
  return e.subscriptionStatus === 'trialing';
}

// Given how many coupons are ALREADY on the subscription, should we stack the
// conversion discount? Only onto a subscription with no discount at all: a
// member already carrying a promo / founding / referral coupon has an intro
// incentive, and stacking a second would over-discount (and erode margin on
// someone who was going to convert anyway). Those members are simply told their
// rate is already locked in — the one-shot latch is NOT consumed for them, since
// they never received our discount.
export function shouldStackTrialDiscount(currentCouponCount: number): boolean {
  return currentCouponCount === 0;
}
