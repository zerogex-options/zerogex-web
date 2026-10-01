// Pure decision logic for an existing subscriber changing plans from the pricing
// page, extracted so it can be unit-tested without the route's DB + Stripe-API
// side effects (mirrors core/paymentGrace.ts and core/subscriptionFlow.ts). No
// `server-only`, DB, fs, or Stripe-runtime imports, so it's safe to import from a
// test.
//
// THE PROBLEM IT SOLVES: the /pricing "Switch to {tier}" CTA used to drop every
// existing subscriber into Stripe's generic billing portal. For a member still
// on the free trial who wants to move up, that portal shows the rack rate, never
// mentions the promo, and — depending on its configuration — may not offer the
// switch at all, so the member is effectively unable to upgrade. This function
// decides, per (current plan, target plan, subscription status), whether the
// switch is one we perform in-app or hand to the Stripe billing portal
// (paid-member prorations, downgrades scheduled at period end).
//
// Since the trial was narrowed to one plan (core/billingPlans.ts), moving OFF
// the trial onto a plan sold under the money-back guarantee means starting to
// pay: the in-app switch ends the trial and charges the new plan today, and the
// guarantee's 7 days start from that payment. Moving to another TRIAL plan
// (only possible when BILLING_TRIAL_PLANS names more than one) keeps the trial,
// exactly as before.
//
// A PAYING member moving to a longer billing period on the same tier (monthly
// to quarterly or annual, quarterly to annual) is also switched in-app, after
// confirming the amount: the new period starts today and is charged today, less
// a credit for the unused part of the current one. That is the switch the cancel
// flow and the first-month plan offer put in front of a monthly member, and the
// Stripe billing portal can't be the place it happens: the portal no longer
// offers Cancel (every cancel goes through the in-app flow), and sending a
// member who is deciding whether to stay to a different site loses them.

import type { BillableTier, BillingCadence, Sku } from './billingPlans.ts';
import { BILLING_CADENCES, CADENCE_MONTHS, planDisplay } from './billingPlans.ts';

export type { BillableTier, BillingCadence };

export type PlanSwitchInput = {
  // Tier the member's CURRENT subscription price maps to, or null when the price
  // id doesn't resolve to a known SKU (never handled in-app).
  currentTier: BillableTier | null;
  // Cadence the current price maps to, or null when unresolvable.
  currentCadence: BillingCadence | null;
  // Tier + cadence the member is switching TO (from the pricing card + toggle).
  targetTier: BillableTier;
  targetCadence: BillingCadence;
  // Whether the TARGET plan is a free-trial plan (skuHasFreeTrial). A trial
  // member moving to a trial plan keeps their trial; moving to any other plan
  // starts paying.
  targetHasTrial: boolean;
  // Live Stripe subscription status ('trialing' | 'active' | 'past_due' | …).
  status: string;
  // Whether collection is paused (Stripe keeps the status `active` while a
  // pause is on). A paused subscription is never switched in-app.
  paused: boolean;
};

export type PlanSwitchDecision =
  // Trialing member moving UP to another trial plan at the same cadence: swap
  // the price in-app, preserve the trial (no charge now), and let the webhook
  // apply the correct promo coupon before the trial-end invoice.
  | { kind: 'in_app_upgrade' }
  // Trialing member moving to a plan sold under the money-back guarantee (Pro,
  // or any quarterly/annual plan): end the trial and charge the new plan now,
  // after the member has confirmed the amount. Covered by the guarantee.
  | { kind: 'in_app_start_paid' }
  // Paying member moving to a longer billing period on the same tier: start
  // the new period today, charge it less a credit for the unused part of the
  // current one, after the member has confirmed the amount. Not covered by the
  // guarantee, which covers a subscription's first payment only.
  | { kind: 'in_app_lengthen' }
  // Everything else — paid members (proration), downgrades (scheduled at period
  // end), unmapped prices — routes to the Stripe billing portal.
  | { kind: 'portal' }
  // Target equals the current plan; nothing to do (the pricing card shows this as
  // "Current Plan", but guard the request path too).
  | { kind: 'noop' };

const TIER_RANK: Record<BillableTier, number> = { basic: 0, pro: 1 };

// A move to a lower tier, or to a shorter billing period on the same tier.
// Downgrades wait for period end in the portal so the member keeps what they
// already have; they are never performed in-app.
export function isDowngrade(input: {
  currentTier: BillableTier;
  currentCadence: BillingCadence;
  targetTier: BillableTier;
  targetCadence: BillingCadence;
}): boolean {
  const tierDelta = TIER_RANK[input.targetTier] - TIER_RANK[input.currentTier];
  if (tierDelta < 0) return true;
  if (tierDelta > 0) return false;
  return CADENCE_MONTHS[input.targetCadence] < CADENCE_MONTHS[input.currentCadence];
}

// Decide how to fulfill an existing subscriber's plan-change request.
export function decidePlanSwitch(input: PlanSwitchInput): PlanSwitchDecision {
  const sameCadence = input.currentCadence === input.targetCadence;
  if (input.currentTier === input.targetTier && sameCadence) {
    return { kind: 'noop' };
  }
  // An unmapped current price is never guessed at.
  if (!input.currentTier || !input.currentCadence) return { kind: 'portal' };
  if (
    input.status === 'active' &&
    !input.paused &&
    input.currentTier === input.targetTier &&
    CADENCE_MONTHS[input.targetCadence] > CADENCE_MONTHS[input.currentCadence]
  ) {
    return { kind: 'in_app_lengthen' };
  }
  // Any other paid member's switch (a tier change, or a shorter period) prorates
  // or waits for the period end, which the portal already does well.
  if (input.status !== 'trialing') return { kind: 'portal' };
  if (
    isDowngrade({
      currentTier: input.currentTier,
      currentCadence: input.currentCadence,
      targetTier: input.targetTier,
      targetCadence: input.targetCadence,
    })
  ) {
    return { kind: 'portal' };
  }
  if (!input.targetHasTrial) return { kind: 'in_app_start_paid' };
  // Trial plan → trial plan keeps the trial, but only for the original,
  // well-trodden shape: a tier upgrade at the same cadence.
  const isTierUpgrade = input.currentTier === 'basic' && input.targetTier === 'pro';
  return isTierUpgrade && sameCadence ? { kind: 'in_app_upgrade' } : { kind: 'portal' };
}

// ---------------------------------------------------------------------------
// Longer-period offers
// ---------------------------------------------------------------------------

export type LengthenOffer = {
  tier: BillableTier;
  cadence: BillingCadence;
  // List price billed once per period, in whole US dollars.
  listPrice: number;
  // listPrice spread over the months it covers.
  perMonth: number;
  months: number;
};

/**
 * The longer billing periods a member can switch to in-app, longest first, or
 * none when they can't (not a paying, unpaused member on a plan we recognize).
 * Exactly the switches decidePlanSwitch performs as `in_app_lengthen`, limited
 * to the plans on sale (`isSellable`, core/stripe.ts isSkuSellable).
 *
 * Prices are LIST prices, the ones the pricing page shows. A member paying a
 * promo rate sees their real charge on the confirm step, priced by Stripe.
 */
export function lengthenOffers(input: {
  current: Sku | null;
  status: string | null;
  paused: boolean;
  isSellable: (sku: Sku) => boolean;
}): LengthenOffer[] {
  const { current } = input;
  if (!current || input.status !== 'active' || input.paused) return [];
  return BILLING_CADENCES.filter((cadence) => CADENCE_MONTHS[cadence] > CADENCE_MONTHS[current.cadence])
    .filter((cadence) => input.isSellable({ tier: current.tier, cadence }))
    .sort((a, b) => CADENCE_MONTHS[b] - CADENCE_MONTHS[a])
    .map((cadence) => {
      const display = planDisplay({ tier: current.tier, cadence });
      return {
        tier: current.tier,
        cadence,
        listPrice: display.listPrice,
        perMonth: display.perMonth,
        months: CADENCE_MONTHS[cadence],
      };
    });
}

// ---------------------------------------------------------------------------
// Discounts across a switch
// ---------------------------------------------------------------------------

// The discount set a subscription should carry after moving to a new plan.
// Stripe leaves the old plan's coupons on the subscription across a price
// change, and ours are cadence-specific (a monthly promo must not ride along on
// an annual invoice), so the set is RECONCILED rather than carried forward:
//
//   • every coupon we manage (the promo and founding intro coupons of every
//     plan, plus the referral coupons) that is not correct for the new plan is
//     stripped — even when there is no replacement to grant;
//   • the correct ones are added if missing;
//   • everything we do not manage (the founding lifetime coupon, win-back and
//     hand-applied coupons) is kept untouched, in order.
//
// Pure set arithmetic: the caller decides which coupons are "correct" (that
// needs env and the member's founding state — see core/switchDiscounts.ts).
export function reconcileSwitchDiscounts(input: {
  currentCouponIds: readonly string[];
  managedCouponIds: readonly string[];
  correctCouponIds: ReadonlyArray<string | null>;
}): { keep: string[]; stale: string[]; missing: string[]; changed: boolean } {
  const managed = new Set(input.managedCouponIds);
  const correct = new Set(input.correctCouponIds.filter((id): id is string => !!id));
  const current = [...new Set(input.currentCouponIds)];
  const stale = current.filter((id) => managed.has(id) && !correct.has(id));
  const missing = [...correct].filter((id) => !current.includes(id));
  const keep = current.filter((id) => !managed.has(id) || correct.has(id));
  for (const id of correct) if (!keep.includes(id)) keep.push(id);
  return { keep, stale, missing, changed: stale.length > 0 || missing.length > 0 };
}

// The public-promo coupon the new plan should carry. The promo promises a price
// for the member's first N months, not for the day they switch. So a member who
// already holds it keeps it on a move to another plan the promo is advertised
// on (Basic monthly → Pro monthly), even after the window has closed to new
// signups. With nothing else to change, the discount they already have is left
// alone, end date included, rather than swapped for another promo coupon that
// would start a fresh 12 months. Otherwise the new plan gets whatever promo
// checkout would attach today, which is none once the window has closed.
export function pickSwitchPromoCoupon(input: {
  currentCouponIds: readonly string[];
  // The promo coupons configured for the plans the promo is advertised on.
  advertisedPromoCouponIds: readonly string[];
  targetAdvertisesPromo: boolean;
  // What checkout would attach to the target plan right now (null when closed).
  activePromoCouponId: string | null;
}): string | null {
  if (input.targetAdvertisesPromo) {
    const held = input.currentCouponIds.find((id) => input.advertisedPromoCouponIds.includes(id));
    if (held) return held;
  }
  return input.activePromoCouponId;
}
