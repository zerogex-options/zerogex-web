// Which coupons a subscription should carry after it moves to a new plan — the
// env- and member-dependent half of the reconciliation whose set arithmetic is
// core/planSwitch.ts reconcileSwitchDiscounts. Shared by the Stripe webhook
// (maybeReconcileDiscountOnPlanSwitch, which fixes up a switch made anywhere,
// including the billing portal) and the in-app trial upgrade in
// app/api/billing/change-plan, which must put the right coupons on the SAME
// update that ends the trial: that update draws and charges the first invoice
// on the spot, so a reconcile that waits for the webhook is one invoice late.
//
// Precedence mirrors checkout's resolveDiscount, derived from the account's
// persistent entitlements (there is no request context here):
//   • Founding member: the founding intro rate for the new plan, and an
//     EXCLUSIVE branch — never the public promo. Once the 25%-forever lifetime
//     coupon is applied (~month 12) it persists on its own, so the discounts
//     are left entirely untouched (null is returned). Likewise when the new
//     billing period has no founding rate at all (quarterly — the offer closed
//     before it existed): the founder's discounts are left as they are rather
//     than their intro rate silently stripped.
//   • Everyone else: a monthly promo the member already holds stays on a move
//     to the other monthly plan, even after the window has closed (the promise
//     is their first 12 months). Otherwise the new plan gets the ACTIVE public
//     promo, or none once the window has closed or the promo isn't advertised
//     on that plan. See planSwitch.pickSwitchPromoCoupon.
//   • A pending referral bonus (a once-coupon still on the subscription) is
//     swapped to the new cadence's referral coupon — never newly granted here.

// Relative imports, and none that reach the db or mailer, so the manual twin
// scripts/fix-plan-switch-discount.mts can import this under plain node.
import {
  getActivePromoCouponId,
  getConfiguredPromoCouponId,
  getFoundingIntroCouponId,
  getManagedCadenceCouponIds,
  type Sku,
} from './stripe.ts';
import { BILLABLE_TIERS, BILLING_CADENCES, isPromoAdvertised } from './billingPlans.ts';
import { getRefereeCouponId } from './refereeCoupon.ts';
import { pickSwitchPromoCoupon, reconcileSwitchDiscounts } from './planSwitch.ts';

export type SwitchDiscountPlan = {
  keep: string[];
  stale: string[];
  missing: string[];
  changed: boolean;
  managed: string[];
  correct: string[];
};

export function planSwitchDiscounts(input: {
  currentCouponIds: readonly string[];
  newSku: Sku;
  foundingMemberStartedAt: string | null;
  foundingLifetimeAppliedAt: string | null;
}): SwitchDiscountPlan | null {
  // (1) Correct promo/founding coupon for the NEW plan (may be null).
  let correctPrimary: string | null;
  if (input.foundingMemberStartedAt) {
    // Founding is exclusive: never fall through to the public promo. Once the
    // lifetime coupon is on, it isn't cadence-specific and validly persists.
    if (input.foundingLifetimeAppliedAt) return null;
    correctPrimary = getFoundingIntroCouponId(input.newSku.tier, input.newSku.cadence);
    if (!correctPrimary) return null;
  } else {
    const advertisedPromoCouponIds = BILLABLE_TIERS.flatMap((tier) =>
      BILLING_CADENCES.filter((cadence) => isPromoAdvertised({ tier, cadence })).map((cadence) =>
        getConfiguredPromoCouponId({ tier, cadence }),
      ),
    ).filter((id): id is string => !!id);
    correctPrimary = pickSwitchPromoCoupon({
      currentCouponIds: input.currentCouponIds,
      advertisedPromoCouponIds,
      targetAdvertisesPromo: isPromoAdvertised(input.newSku),
      activePromoCouponId: getActivePromoCouponId(input.newSku),
    });
  }

  // (2) Referral coupon: cadence-specific and duration:once. If one is still on
  // the sub it hasn't been consumed yet (Stripe drops a once-coupon after it
  // applies), so a cadence switch must SWAP it to the new cadence's referral
  // coupon — otherwise the 100%-off-monthly coupon rides an annual or quarterly
  // invoice as a free year or quarter.
  const monthlyReferee = getRefereeCouponId('monthly');
  const refereeIds = new Set(
    BILLING_CADENCES.map((cadence) => getRefereeCouponId(cadence)).filter((id): id is string => !!id),
  );
  const hadReferee = input.currentCouponIds.some((id) => refereeIds.has(id));
  let correctReferee: string | null = null;
  if (hadReferee) {
    const candidate = getRefereeCouponId(input.newSku.cadence);
    // Misconfig guard: never let the 100%-off monthly coupon land on a longer cadence.
    if (candidate && !(input.newSku.cadence !== 'monthly' && monthlyReferee && candidate === monthlyReferee)) {
      correctReferee = candidate;
    }
  }

  const managed = [...new Set([...getManagedCadenceCouponIds(), ...refereeIds])];
  const correct = [correctPrimary, correctReferee].filter((id): id is string => !!id);
  return {
    ...reconcileSwitchDiscounts({
      currentCouponIds: input.currentCouponIds,
      managedCouponIds: managed,
      correctCouponIds: correct,
    }),
    managed,
    correct,
  };
}
