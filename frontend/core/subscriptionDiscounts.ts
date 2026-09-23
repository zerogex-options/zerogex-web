// Reading and writing a subscription's discount set without the two traps that
// make a "reconcile the coupons" write quietly wrong.
//
// TRAP 1 — an empty set is not sent. stripe-node form-encodes the request and
// drops an empty array entirely, so `discounts: []` leaves the key out of the
// request and every coupon already on the subscription stays. Clearing the set
// takes `discounts: ''`. (tests/subscriptionDiscounts.test.ts runs both through
// the SDK's own encoder to pin this.)
//
// TRAP 2 — `{ coupon }` is a NEW redemption. Passing a coupon the subscription
// already carries creates a fresh discount: a repeating coupon's months restart,
// and the write fails outright if the coupon has since expired or hit its
// redemption cap. A discount that should stay is passed as `{ discount: <its
// id> }`, which keeps the existing redemption, end date included.
//
// And the precondition for both: the coupons have to be READ first. Webhook
// payloads and plain retrieves list a subscription's discounts as bare 'di_'
// ids, so a reader that only looks for expanded objects sees none and then
// "reconciles" a subscription it cannot see. readAttachedDiscounts refuses to
// guess: bare ids return null, and the caller re-reads with
// expand: ['discounts'].
//
// Pure — no SDK import beyond types.

import type Stripe from 'stripe';

export type AttachedDiscount = { discountId: string; couponId: string };

export type DiscountsParam = '' | Array<{ discount: string } | { coupon: string }>;

// The discounts attached to a subscription, or null when the object does not
// carry them expanded (so the caller must re-read before deciding anything).
export function readAttachedDiscounts(subscription: Pick<Stripe.Subscription, 'discounts'>): AttachedDiscount[] | null {
  const raw = ((subscription as { discounts?: unknown }).discounts ?? []) as unknown[];
  const out: AttachedDiscount[] = [];
  for (const entry of raw) {
    if (!entry) continue;
    if (typeof entry === 'string') return null;
    const discount = entry as { id?: unknown; coupon?: unknown };
    const coupon = discount.coupon as { id?: unknown } | string | null | undefined;
    const couponId = typeof coupon === 'string' ? coupon : typeof coupon?.id === 'string' ? coupon.id : null;
    if (typeof discount.id !== 'string' || !couponId) return null;
    out.push({ discountId: discount.id, couponId });
  }
  return out;
}

export function attachedCouponIds(attached: readonly AttachedDiscount[]): string[] {
  return [...new Set(attached.map((a) => a.couponId))];
}

// The `discounts` param that makes the set exactly `couponIds`: coupons already
// attached by their existing discount, new ones by coupon, and an empty set as
// '' so it actually clears.
export function discountsParam(couponIds: readonly string[], attached: readonly AttachedDiscount[]): DiscountsParam {
  const wanted = [...new Set(couponIds)];
  if (wanted.length === 0) return '';
  const existing = new Map<string, string>();
  for (const a of attached) if (!existing.has(a.couponId)) existing.set(a.couponId, a.discountId);
  return wanted.map((couponId) => {
    const discountId = existing.get(couponId);
    return discountId ? { discount: discountId } : { coupon: couponId };
  });
}

// For a log line: what the param means, in coupon ids.
export function describeDiscountsParam(param: DiscountsParam, attached: readonly AttachedDiscount[]): string {
  if (param === '') return 'none';
  const couponByDiscount = new Map(attached.map((a) => [a.discountId, a.couponId]));
  return param
    .map((entry) => ('discount' in entry ? `${couponByDiscount.get(entry.discount) ?? entry.discount} (kept)` : entry.coupon))
    .join(', ');
}
