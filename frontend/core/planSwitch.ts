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

import type { BillableTier, BillingCadence } from './billingPlans.ts';
import { CADENCE_MONTHS } from './billingPlans.ts';

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
  // Only a trial is handled in-app: a paid member's switch prorates, which the
  // portal already does well. An unmapped current price is never guessed at.
  if (input.status !== 'trialing' || !input.currentTier || !input.currentCadence) {
    return { kind: 'portal' };
  }
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
