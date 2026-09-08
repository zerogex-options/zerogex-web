// Pure decision logic for restoring a founding member's locked-in rate when they
// resubscribe after their subscription lapsed, extracted from the checkout route
// so it can be unit-tested without that route's DB and Stripe-API side effects
// (mirrors core/paymentGrace.ts and core/refereeBonus.ts).
//
// The problem it solves: founding ACQUISITION is permanently closed after
// FOUNDING_LOCKIN_DEADLINE_ISO — the /founding page 404s, the checkout API
// refuses the founding code with a 410, and the deferred first-charge trial no
// longer mints (see core/foundingLockin.ts). That is correct for someone trying
// to BECOME a founder late.
//
// It is wrong for someone who already IS one. When a founder's card is stolen or
// simply expires, Stripe runs out its dunning retries and deletes the
// subscription; the webhook's clearSubscriptionFromUser then nulls
// stripe_subscription_id and drops the member to tier 'public'. The only
// self-serve route left is /pricing -> checkout, and with no founding branch to
// catch them there they would be silently charged the STANDARD rate — losing a
// rate that cannot be re-acquired at any price, through no decision of their
// own. The most loyal cohort on the platform is the one an involuntary decline
// punishes hardest, so the checkout path has to recognise them.
//
// Restoration is therefore deliberately NOT gated on isFoundingLockinOpen(): the
// deadline governs who may JOIN the founding cohort, never whether someone
// already in it keeps what they already earned.

export type FoundingRestoreInput = {
  // users.founding_member_started_at — stamped by the Stripe webhook on the first
  // sync after a founding redemption (subscription.metadata.founding === '1') and
  // COALESCE-preserved on every sync after it, so it survives a lapse and a
  // resubscribe. This is the PROOF OF REDEMPTION, and deliberately the gate here.
  //
  // users.founding_eligible is NOT the gate. That column is the launch-cohort
  // INVITATION (seeded by scripts/seed-founders.mjs) and stays 1 forever whether
  // or not the member ever took the offer. Gating on it would hand the founding
  // rate, after the deadline, to seeded users who never redeemed — exactly the
  // late acquisition the cutoff exists to refuse.
  foundingMemberStartedAt: string | null;
  // Whether a Stripe subscription is currently on file (users.stripe_subscription_id).
  // Restoration is for a LAPSED founder: a member with a live subscription already
  // carries the founding coupon on the subscription object itself and changes
  // plans through the billing portal, where maybeReconcileDiscountOnPlanSwitch
  // keeps that coupon across the switch. The checkout route already 409s this case
  // before it resolves any discount, so this is a defensive second gate rather
  // than the primary one.
  hasActiveSubscription: boolean;
};

// True when this account is a founding member returning from a lapse, and the
// founding rate it already earned should be re-applied at checkout rather than
// letting it fall through to standard pricing.
export function shouldRestoreFoundingRate(input: FoundingRestoreInput): boolean {
  // A live subscription needs no restoration — see hasActiveSubscription above.
  if (input.hasActiveSubscription) return false;
  // Presence, not parseability, is the signal: the stamp proves a redemption
  // happened and no date arithmetic is done on it here (unlike the lifetime-coupon
  // schedule in the webhook, which does parse it). A blank or whitespace-only
  // value is treated as absent so a malformed backfill can't mint founders.
  const startedAt = input.foundingMemberStartedAt;
  return startedAt != null && startedAt.trim() !== '';
}
