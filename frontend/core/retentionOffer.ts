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

// The bigger offer made only to a member who picks "Too expensive" as their
// cancel reason in the in-app flow: 50% off for the next 12 months, the same
// rate as the win-back. It shares the one-shot latch with the 25% save, so a
// member gets one or the other, and the two never stack on each other.
export const PRICE_SAVE_PERCENT = 50;

// Resolve the 25%/yr save coupon for a plan: create-or-reuse a deterministic
// coupon on the SAME id scheme as scripts/honor-winback-discount.mts, so the
// manual, the email-save, and the in-app-cancel paths all share one Stripe
// object. Create is idempotent (fixed id → at most one coupon per cadence,
// reused thereafter); every caller latches one claim per account, so this can't
// be used to farm coupons.
//
// Deliberately NOT the STRIPE_COUPON_WINBACK_* coupon. That one is the win-back
// rate (50%, per WINBACK_DISCOUNT_LABEL), and when this resolver preferred it,
// every "25% off" save on a monthly or annual plan quietly applied 50%.
export async function resolveSaveCoupon(
  stripe: ReturnType<typeof getStripe>,
  sku: Sku,
): Promise<string> {
  return ensureYearCoupon(stripe, sku, SAVE_PERCENT, 'self-serve-save');
}

// Resolve the 50%-off-for-12-months "Too expensive" coupon for a plan: the
// configured STRIPE_COUPON_WINBACK_* coupon (the same 50% the win-back email
// offers), else the deterministic `winback-50pct-1yr-<cadence>` coupon, so a
// plan with no win-back coupon configured still gets the offer.
export async function resolvePriceSaveCoupon(
  stripe: ReturnType<typeof getStripe>,
  sku: Sku,
): Promise<string> {
  const configured = getWinbackCouponId(sku);
  if (configured) return configured;
  return ensureYearCoupon(stripe, sku, PRICE_SAVE_PERCENT, 'cancel-too-expensive');
}

// Create-or-reuse `winback-<percent>pct-1yr-<cadence>`: percent off every
// invoice in the next 12 months (one annual invoice, four quarterly, twelve
// monthly).
async function ensureYearCoupon(
  stripe: ReturnType<typeof getStripe>,
  sku: Sku,
  percent: number,
  source: string,
): Promise<string> {
  const id = `winback-${percent}pct-1yr-${sku.cadence}`;
  try {
    const existing = await stripe.coupons.retrieve(id);
    if (existing?.id) return existing.id;
  } catch {
    // Not found (or a transient read error) — fall through to create.
  }
  try {
    const params: Stripe.CouponCreateParams = {
      id,
      percent_off: percent,
      name: `Win-back ${percent}% off (1 year)`,
      metadata: { source, cadence: sku.cadence },
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
