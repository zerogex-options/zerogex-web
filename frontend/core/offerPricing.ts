import type Stripe from 'stripe';

// ---------------------------------------------------------------------------
// Live display pricing for marketing / lifecycle emails.
//
// Marketing copy used to hard-code the offer prices ("Basic $19/mo, Pro
// $29/mo", "normally $39/$59", "25% off"). Those strings silently go stale the
// moment a Stripe Price or Coupon changes, which is exactly how an email ends
// up quoting a number that doesn't match what the customer is actually charged.
// This module resolves those numbers LIVE from Stripe instead, so the copy can
// never drift from the real configuration.
//
// The Price IDs and Coupon IDs are read from the same env vars core/stripe.ts
// uses — Stripe itself is the single source of truth for the amounts; the env
// vars only name which objects to fetch. They're named here (rather than
// imported from core/stripe.ts) on purpose: the callers are standalone
// `node --experimental-strip-types` cron scripts that deliberately don't pull
// in the Next.js server module graph, mirroring the local helper in
// scripts/send-checkout-recovery.mts. Because both readers key off the same env
// names, the resolved amounts can't diverge from checkout.
// ---------------------------------------------------------------------------

// Only the monthly Basic/Pro list prices are ever quoted in email copy, so
// those are the only Price IDs this module needs.
function envPriceBasicMonthly(): string | undefined {
  return process.env.STRIPE_PRICE_BASIC_MONTHLY;
}
function envPriceProMonthly(): string | undefined {
  return process.env.STRIPE_PRICE_PRO_MONTHLY;
}

// Public limited-time promo coupons (monthly), one per tier.
function envPromoCouponBasicMonthly(): string | undefined {
  return process.env.STRIPE_COUPON_PROMO_BASIC_MONTHLY;
}
function envPromoCouponProMonthly(): string | undefined {
  return process.env.STRIPE_COUPON_PROMO_PRO_MONTHLY;
}

// Founding intro coupons (monthly first-year rate), one per tier, plus the
// 25%-forever lifetime coupon applied after the first year.
function envFoundingCouponBasicIntro(): string | undefined {
  return process.env.STRIPE_COUPON_FOUNDING_BASIC_INTRO;
}
function envFoundingCouponProIntro(): string | undefined {
  return process.env.STRIPE_COUPON_FOUNDING_PRO_INTRO;
}
function envFoundingCouponLifetime(): string | undefined {
  return process.env.STRIPE_COUPON_FOUNDING_LIFETIME;
}

// Minimal shape of the Stripe.Coupon fields we reason about, so the pure
// applyCoupon helper can be unit-tested without constructing a full coupon.
export type CouponLike = {
  amount_off?: number | null;
  percent_off?: number | null;
  // Present (and relevant) only for amount_off coupons — the currency the
  // fixed discount is denominated in.
  currency?: string | null;
};

// Apply a Stripe coupon to a list amount (both in minor units, e.g. cents),
// clamped at 0. percent_off takes precedence over amount_off (a Stripe coupon
// carries exactly one). An amount_off in a different currency than the price is
// NOT subtracted — mixing currencies would produce a wrong number, so we return
// the list amount unchanged and let the caller decide (in practice every
// coupon/price here is USD). Pure and side-effect-free for testing.
export function applyCoupon(
  listMinor: number,
  listCurrency: string,
  coupon: CouponLike,
): number {
  if (typeof coupon.percent_off === 'number' && coupon.percent_off > 0) {
    return Math.max(0, Math.round(listMinor * (1 - coupon.percent_off / 100)));
  }
  if (typeof coupon.amount_off === 'number' && coupon.amount_off > 0) {
    if (coupon.currency && coupon.currency.toLowerCase() !== listCurrency.toLowerCase()) {
      return listMinor;
    }
    return Math.max(0, listMinor - coupon.amount_off);
  }
  return listMinor;
}

// Format a minor-unit amount as compact currency copy: whole dollars drop the
// ".00" ("$19"), fractional amounts keep two places ("$19.50"). Matches the
// "$19/mo" style the emails already use (the "/mo" suffix is added by the copy).
export function formatMoneyCompact(amountMinor: number, currency: string): string {
  const major = amountMinor / 100;
  const isWhole = Number.isInteger(major);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(major);
  } catch {
    // Unknown currency code — fall back to a plain, unambiguous rendering.
    const fixed = isWhole ? major.toFixed(0) : major.toFixed(2);
    return `${fixed} ${currency.toUpperCase()}`;
  }
}

export type PromoDisplayPricing = {
  // Discounted monthly rate under the active public promo, formatted "$19".
  basicMonthly: string;
  proMonthly: string;
};

// Live intro (discounted) monthly display price for Basic + Pro under the
// public promo: list price minus the promo coupon, straight from Stripe.
// Returns null when any required Price/Coupon isn't configured, so the caller
// can fall back to price-free copy rather than guess. Stripe errors propagate
// to the caller (which treats resolution as best-effort).
export async function resolvePromoDisplayPricing(
  stripe: Stripe,
): Promise<PromoDisplayPricing | null> {
  const basicPriceId = envPriceBasicMonthly();
  const proPriceId = envPriceProMonthly();
  const basicCouponId = envPromoCouponBasicMonthly();
  const proCouponId = envPromoCouponProMonthly();
  if (!basicPriceId || !proPriceId || !basicCouponId || !proCouponId) return null;

  const [basicPrice, proPrice, basicCoupon, proCoupon] = await Promise.all([
    stripe.prices.retrieve(basicPriceId),
    stripe.prices.retrieve(proPriceId),
    stripe.coupons.retrieve(basicCouponId),
    stripe.coupons.retrieve(proCouponId),
  ]);

  if (typeof basicPrice.unit_amount !== 'number' || typeof proPrice.unit_amount !== 'number') {
    return null;
  }

  return {
    basicMonthly: formatMoneyCompact(
      applyCoupon(basicPrice.unit_amount, basicPrice.currency, basicCoupon),
      basicPrice.currency,
    ),
    proMonthly: formatMoneyCompact(
      applyCoupon(proPrice.unit_amount, proPrice.currency, proCoupon),
      proPrice.currency,
    ),
  };
}

export type FoundingDisplayPricing = {
  // First-year founding rate (list minus founding intro coupon), formatted "$12".
  basicMonthlyIntro: string;
  proMonthlyIntro: string;
  // Standard rack rate the intro is discounted from, formatted "$39".
  basicMonthlyList: string;
  proMonthlyList: string;
  // Percent off the founding lifetime coupon grants after year one (e.g. 25),
  // or null when that coupon isn't configured.
  lifetimePercentOff: number | null;
};

// Live founding display prices: the first-year intro rate (list minus the
// founding intro coupon), the standard rate it's discounted from, and the
// post-year-one lifetime discount percent — all from Stripe. Returns null when
// a required Price/Coupon isn't configured so the caller can drop to price-free
// copy. Stripe errors propagate to the (best-effort) caller.
export async function resolveFoundingDisplayPricing(
  stripe: Stripe,
): Promise<FoundingDisplayPricing | null> {
  const basicPriceId = envPriceBasicMonthly();
  const proPriceId = envPriceProMonthly();
  const basicIntroId = envFoundingCouponBasicIntro();
  const proIntroId = envFoundingCouponProIntro();
  if (!basicPriceId || !proPriceId || !basicIntroId || !proIntroId) return null;
  const lifetimeId = envFoundingCouponLifetime();

  const [basicPrice, proPrice, basicIntro, proIntro, lifetime] = await Promise.all([
    stripe.prices.retrieve(basicPriceId),
    stripe.prices.retrieve(proPriceId),
    stripe.coupons.retrieve(basicIntroId),
    stripe.coupons.retrieve(proIntroId),
    lifetimeId ? stripe.coupons.retrieve(lifetimeId) : Promise.resolve(null),
  ]);

  if (typeof basicPrice.unit_amount !== 'number' || typeof proPrice.unit_amount !== 'number') {
    return null;
  }

  return {
    basicMonthlyList: formatMoneyCompact(basicPrice.unit_amount, basicPrice.currency),
    basicMonthlyIntro: formatMoneyCompact(
      applyCoupon(basicPrice.unit_amount, basicPrice.currency, basicIntro),
      basicPrice.currency,
    ),
    proMonthlyList: formatMoneyCompact(proPrice.unit_amount, proPrice.currency),
    proMonthlyIntro: formatMoneyCompact(
      applyCoupon(proPrice.unit_amount, proPrice.currency, proIntro),
      proPrice.currency,
    ),
    lifetimePercentOff:
      lifetime && typeof lifetime.percent_off === 'number' ? lifetime.percent_off : null,
  };
}
