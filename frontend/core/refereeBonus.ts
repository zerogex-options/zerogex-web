// Pure decision logic for the REFER-A-FRIEND bonus — the discount the referred
// friend (the "referee") gets on their first bill:
//
//   monthly -> first month free      (a 100%-off, duration:once coupon)
//   annual  -> 10% off the first year (a 10%-off, duration:once coupon)
//
// The bonus is deliberately ADDITIVE. It is a thank-you for arriving through a
// member's link, not an alternative to whatever offer the site is already
// running, so it applies ON TOP of any other promo the same new customer would
// have received anyway (today: the time-boxed public promo, and the founding
// intro rate). A Stripe Checkout Session accepts only ONE discount, so
// splitRefereeBonus() decides which of the two rides the session: the other
// offer does — it is the public-facing rate the customer is shown at checkout —
// and the referee bonus is carried in subscription metadata and stacked onto
// the subscription by the webhook while it is still trialing, i.e. before the
// first invoice, so both discounts land on that invoice.
//
// Scope: this is the refer-a-friend program only. The creator-partner audience
// coupon and the printed-collateral campaign codes also travel in
// `referred_by_code`, but they are separate programs with their own referee
// discount and are resolved (and returned) before this logic is reached in
// app/api/billing/checkout/route.ts.
//
// Kept PURE (no runtime imports) so it's unit-tested without Stripe/DB — same
// discipline as core/trialOffer.ts. Locked down in tests/refereeBonus.test.ts.

import type { BillingCadence } from '@/core/stripe';

export type RefereeBonusInput = {
  // The cadence being purchased — decides which bonus coupon applies.
  cadence: BillingCadence;
  // users.referred_by_code, stamped at signup from the ?ref= link. Null for an
  // organic signup, which gets no bonus.
  referredByCode: string | null;
  // isReferralProgramEnabled() — the REFERRAL_PROGRAM_ENABLED master switch.
  programEnabled: boolean;
  // True when this account has held a paid subscription before. The bonus is a
  // NEW-customer incentive, so a returning customer doesn't get it. Because only
  // first-time customers get a trial, this gate also guarantees the webhook's
  // stacking step always has its pre-first-invoice (trialing) window.
  hasPriorPaid: boolean;
  // getRefereeCouponId(cadence) — the bonus coupon for the cadence being bought.
  // Null when that cadence isn't configured, in which case checkout simply
  // proceeds without a referral bonus.
  couponForCadence: string | null;
  // getRefereeCouponId('monthly') — needed only for the misconfiguration guard
  // below, never applied to an annual purchase.
  monthlyCoupon: string | null;
};

// The refer-a-friend bonus coupon this purchase earns, or null.
export function resolveRefereeBonusCoupon(input: RefereeBonusInput): string | null {
  if (!input.referredByCode || !input.programEnabled || input.hasPriorPaid) return null;

  const coupon = input.couponForCadence;
  if (!coupon) return null;

  // Defense-in-depth: the monthly bonus is a 100%-off coupon (first month
  // free). On an annual line item that same coupon would make the entire first
  // YEAR free. The coupon is already keyed to cadence, but guard the env-
  // misconfig case where the annual var was pointed at the monthly coupon —
  // drop the bonus rather than give away a free year.
  if (input.cadence === 'annual' && input.monthlyCoupon && coupon === input.monthlyCoupon) {
    return null;
  }

  return coupon;
}

export type RefereeBonusSplit = {
  // The single coupon attached to the Checkout Session (Stripe allows one).
  couponId: string | null;
  // A SECOND coupon for the webhook to stack onto the subscription before the
  // first invoice. Non-null only when both a primary offer AND the bonus apply.
  stackCouponId: string | null;
};

// Split "primary offer + refer-a-friend bonus" into the one coupon Checkout can
// carry and the one the webhook stacks. The primary offer always wins the
// session slot so the customer sees the advertised rate on Stripe's page; the
// bonus is added to the subscription moments later, before anything is charged.
// With only one of the two present it simply rides the session alone.
export function splitRefereeBonus(
  primaryCouponId: string | null,
  refereeCouponId: string | null,
): RefereeBonusSplit {
  if (!refereeCouponId) return { couponId: primaryCouponId, stackCouponId: null };
  if (!primaryCouponId) return { couponId: refereeCouponId, stackCouponId: null };
  return { couponId: primaryCouponId, stackCouponId: refereeCouponId };
}
