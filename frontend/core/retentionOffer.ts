// Shared retention-offer machinery: the self-serve SAVE discount (25% off for a
// year) and the coupon-stacking helpers, extracted so BOTH the email-driven
// /save route (app/save/route.ts) and the in-app cancellation flow
// (app/api/billing/cancel-flow/route.ts) apply the exact same coupon the exact
// same way — one Stripe object, one stacking rule, no drift.
//
// The pure helpers (subscriptionCouponIds / stackCoupon) do the discount-shape
// juggling Stripe webhook payloads require (a discount's coupon may be an
// expanded object or a bare id) and never strip an existing coupon — a member's
// founding/promo/referral discount rides ALONGSIDE the save coupon, exactly as
// scripts/honor-winback-discount.mts does by hand.

import type Stripe from 'stripe';
import { getStripe, getWinbackCouponId, type Sku } from '@/core/stripe';

// The self-serve retention discount: 25% off for a year.
export const SAVE_PERCENT = 25;

// Resolve the 25%/yr save coupon for a plan. Prefer the operator's configured
// win-back coupon; if none is set, create-or-reuse a deterministic coupon using
// the SAME id scheme as scripts/honor-winback-discount.mts, so the manual, the
// email-save, and the in-app-cancel paths all share one Stripe object. This
// keeps the one-click save working without requiring the STRIPE_COUPON_WINBACK_*
// envs. Create is idempotent (fixed id → at most one coupon per cadence, reused
// thereafter); every caller latches one claim per account, so this can't be used
// to farm coupons.
export async function resolveSaveCoupon(
  stripe: ReturnType<typeof getStripe>,
  sku: Sku,
): Promise<string> {
  const configured = getWinbackCouponId(sku);
  if (configured) return configured;
  const id = `winback-${SAVE_PERCENT}pct-1yr-${sku.cadence}`;
  try {
    const existing = await stripe.coupons.retrieve(id);
    if (existing?.id) return existing.id;
  } catch {
    // Not found (or a transient read error) — fall through to create.
  }
  try {
    const params: Stripe.CouponCreateParams = {
      id,
      percent_off: SAVE_PERCENT,
      name: `Win-back ${SAVE_PERCENT}% off (1 year)`,
      metadata: { source: 'self-serve-save', cadence: sku.cadence },
      ...(sku.cadence === 'annual'
        ? { duration: 'once' }
        : { duration: 'repeating', duration_in_months: 12 }),
    };
    const created = await stripe.coupons.create(params);
    return created.id ?? id;
  } catch (err) {
    // Race / prior partial create: the id already exists — reuse it.
    if ((err as { code?: string } | undefined)?.code === 'resource_already_exists') return id;
    throw err;
  }
}

// The coupon ids currently attached to a subscription's discounts, de-duplicated
// and in order. A discount on a (possibly expanded) subscription payload may be
// an expanded coupon object or a bare id — handle both.
type ExpandedDiscount = { coupon?: string | { id?: string } | null } | string;
export function subscriptionCouponIds(subscription: Stripe.Subscription): string[] {
  const raw = ((subscription as unknown as { discounts?: ExpandedDiscount[] }).discounts ??
    []) as ExpandedDiscount[];
  const ids: string[] = [];
  for (const d of raw) {
    if (typeof d === 'string') continue;
    const c = d?.coupon;
    const id = typeof c === 'string' ? c : c?.id ?? null;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

// STACK a coupon onto the existing ids — never strip, dedup so a re-submit can't
// add it twice. Returns the same array reference when the coupon is already
// present so callers can cheaply detect a no-op.
export function stackCoupon(currentIds: string[], couponId: string): string[] {
  return currentIds.includes(couponId) ? currentIds : [...currentIds, couponId];
}
