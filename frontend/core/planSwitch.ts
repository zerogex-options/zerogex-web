// Pure decision logic for an existing subscriber changing plans from the pricing
// page, extracted so it can be unit-tested without the route's DB + Stripe-API
// side effects (mirrors core/paymentGrace.ts and core/subscriptionFlow.ts). No
// `server-only`, DB, fs, or Stripe-runtime imports, so it's safe to import from a
// test.
//
// THE PROBLEM IT SOLVES: the /pricing "Switch to {tier}" CTA used to drop every
// existing subscriber into Stripe's generic billing portal. For a member still
// on the free trial who wants the advertised promo upgrade (e.g. "Pro at $29/mo
// for 6 months"), that portal shows the rack rate, never mentions the promo, and
// — depending on the portal configuration — may not offer the tier switch at all,
// so the member is effectively unable to upgrade. This function decides, per
// (current plan, target plan, subscription status), whether the switch is a
// trialing tier UPGRADE we can perform in-app (change the price, keep the trial,
// let the webhook reconcile the promo coupon exactly as it does for a portal
// switch) or should still be handed off to the Stripe billing portal (paid-member
// prorations, downgrades scheduled at period end, cadence changes).

export type BillableTier = 'basic' | 'pro';
export type BillingCadence = 'monthly' | 'annual';

export type PlanSwitchInput = {
  // Tier the member's CURRENT subscription price maps to, or null when the price
  // id doesn't resolve to a known SKU (never treated as an in-app upgrade).
  currentTier: BillableTier | null;
  // Cadence the current price maps to, or null when unresolvable.
  currentCadence: BillingCadence | null;
  // Tier + cadence the member is switching TO (from the pricing card + toggle).
  targetTier: BillableTier;
  targetCadence: BillingCadence;
  // Live Stripe subscription status ('trialing' | 'active' | 'past_due' | …).
  status: string;
};

export type PlanSwitchDecision =
  // Trialing member moving to a higher tier at the same cadence: swap the price
  // in-app, preserve the trial (no charge now), and let the webhook apply the
  // correct promo coupon before the trial-end invoice.
  | { kind: 'in_app_upgrade' }
  // Everything else — paid members (proration), downgrades (scheduled at period
  // end), and cadence changes — routes to the Stripe billing portal.
  | { kind: 'portal' }
  // Target equals the current plan; nothing to do (the pricing card shows this as
  // "Current Plan", but guard the request path too).
  | { kind: 'noop' };

// Decide how to fulfill an existing subscriber's plan-change request.
//
// In-app upgrade requires ALL of:
//   • the subscription is `trialing` (no invoice yet → nothing to prorate/refund,
//     and swapping the price can never charge the member today), and
//   • it's a tier UPGRADE basic → pro (revenue-positive; downgrades need the
//     portal's schedule-at-period-end so the member keeps what they're on), and
//   • the cadence is unchanged (a monthly↔annual move changes the coupon shape
//     and trial economics — leave those to the portal).
// Any other request (paid sub, downgrade, cadence change, unknown current price)
// falls back to the portal, which is exactly today's behavior — so this only ever
// ADDS a working path, never removes one.
export function decidePlanSwitch(input: PlanSwitchInput): PlanSwitchDecision {
  const sameCadence = input.currentCadence === input.targetCadence;
  if (input.currentTier === input.targetTier && sameCadence) {
    return { kind: 'noop' };
  }
  const isTrialing = input.status === 'trialing';
  const isTierUpgrade = input.currentTier === 'basic' && input.targetTier === 'pro';
  if (isTrialing && isTierUpgrade && sameCadence) {
    return { kind: 'in_app_upgrade' };
  }
  return { kind: 'portal' };
}
