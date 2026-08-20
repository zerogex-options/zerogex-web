// Pricing arithmetic for "upgrade this member a tier but hold their bill where
// it is" (scripts/upgrade-at-current-price.mts).
//
// Lives here rather than inline in the script because getting it wrong
// overcharges a real customer silently: the subscription switches to the new
// price and the wrong discount rides along, so nothing errors — the member just
// pays more than they were promised. Unit-tested in tests/holdRate.test.ts.
//
// All amounts are integer cents, matching Stripe.

// A coupon's shape, narrowed to the two fields that determine what it takes off.
// Mirrors the parts of Stripe.Coupon we depend on, without importing the SDK.
export interface CouponLike {
  amount_off?: number | null;
  percent_off?: number | null;
}

/**
 * What a member must be discounted so a `listCents` plan bills at the
 * `currentCents` they already pay.
 *
 * Negative means the target tier lists BELOW their current rate — holding their
 * rate steady would charge them more than the tier costs, so callers must treat
 * a negative result as an error rather than applying it.
 */
export function holdSteadyDiscountCents(listCents: number, currentCents: number): number {
  return listCents - currentCents;
}

/**
 * What `listCents` actually bills once `coupon` is applied, or null when the
 * coupon carries neither an amount nor a percentage (so the result cannot be
 * determined and must not be guessed).
 *
 * amount_off wins when both are present — that is Stripe's own precedence.
 * Percentages are rounded half-up to the cent, matching Stripe's rounding, and
 * are exactly why the script MINTS amount_off coupons rather than percentage
 * ones: a percentage re-derived against a different list price rarely lands
 * back on the original figure.
 */
export function couponResultCents(coupon: CouponLike, listCents: number): number | null {
  if (typeof coupon.amount_off === 'number') {
    return Math.max(0, listCents - coupon.amount_off);
  }
  if (typeof coupon.percent_off === 'number') {
    return Math.max(0, Math.round(listCents * (1 - coupon.percent_off / 100)));
  }
  return null;
}

/**
 * Whether `coupon` lands `listCents` exactly on `intendedCents`. Used to vet an
 * operator-supplied `--coupon` before it touches a live subscription.
 */
export function couponHoldsRate(
  coupon: CouponLike,
  listCents: number,
  intendedCents: number,
): boolean {
  return couponResultCents(coupon, listCents) === intendedCents;
}
