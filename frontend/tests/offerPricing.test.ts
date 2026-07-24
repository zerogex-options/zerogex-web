import test from 'node:test';
import assert from 'node:assert/strict';
import type Stripe from 'stripe';
import {
  applyCoupon,
  formatMoneyCompact,
  resolvePromoDisplayPricing,
  resolveFoundingDisplayPricing,
} from '../core/offerPricing.ts';

test('applyCoupon subtracts a same-currency amount_off', () => {
  // $59.00 list − $30.00 off = $29.00
  assert.equal(applyCoupon(5900, 'usd', { amount_off: 3000, currency: 'usd' }), 2900);
  // $39.00 list − $20.00 off = $19.00
  assert.equal(applyCoupon(3900, 'usd', { amount_off: 2000, currency: 'usd' }), 1900);
});

test('applyCoupon applies percent_off with rounding', () => {
  // 25% off $59.00 = $44.25
  assert.equal(applyCoupon(5900, 'usd', { percent_off: 25 }), 4425);
  // 50% off an odd cent count rounds to nearest minor unit
  assert.equal(applyCoupon(1999, 'usd', { percent_off: 50 }), 1000);
});

test('applyCoupon clamps at zero and ignores empty coupons', () => {
  assert.equal(applyCoupon(1000, 'usd', { amount_off: 5000, currency: 'usd' }), 0);
  assert.equal(applyCoupon(1000, 'usd', { percent_off: 100 }), 0);
  assert.equal(applyCoupon(1000, 'usd', {}), 1000);
  assert.equal(applyCoupon(1000, 'usd', { amount_off: 0, percent_off: 0 }), 1000);
});

test('applyCoupon refuses to subtract an amount_off in a different currency', () => {
  // A GBP fixed discount must not be subtracted from a USD price.
  assert.equal(applyCoupon(5900, 'usd', { amount_off: 3000, currency: 'gbp' }), 5900);
  // Currency match is case-insensitive.
  assert.equal(applyCoupon(5900, 'USD', { amount_off: 3000, currency: 'usd' }), 2900);
});

test('formatMoneyCompact drops .00 for whole dollars, keeps cents otherwise', () => {
  assert.equal(formatMoneyCompact(2900, 'usd'), '$29');
  assert.equal(formatMoneyCompact(1900, 'usd'), '$19');
  assert.equal(formatMoneyCompact(1250, 'usd'), '$12.50');
  assert.equal(formatMoneyCompact(0, 'usd'), '$0');
});

// --- resolver end-to-end (fake Stripe, no network) -------------------------

// Minimal fake that answers prices.retrieve / coupons.retrieve from canned
// maps, so the resolvers' env-reading + discount math can be verified without
// hitting Stripe. Cast to Stripe at the call site; only the two methods the
// resolvers use are implemented.
function fakeStripe(
  prices: Record<string, { unit_amount: number; currency: string }>,
  coupons: Record<string, { amount_off?: number | null; percent_off?: number | null; currency?: string | null }>,
): Stripe {
  return {
    prices: {
      retrieve: async (id: string) => {
        const p = prices[id];
        if (!p) throw new Error(`no such price ${id}`);
        return p;
      },
    },
    coupons: {
      retrieve: async (id: string) => {
        const c = coupons[id];
        if (!c) throw new Error(`no such coupon ${id}`);
        return c;
      },
    },
  } as unknown as Stripe;
}

function setPricingEnv() {
  process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_m';
  process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_m';
  process.env.STRIPE_COUPON_PROMO_BASIC_MONTHLY = 'coupon_promo_basic';
  process.env.STRIPE_COUPON_PROMO_PRO_MONTHLY = 'coupon_promo_pro';
  process.env.STRIPE_COUPON_FOUNDING_BASIC_INTRO = 'coupon_found_basic';
  process.env.STRIPE_COUPON_FOUNDING_PRO_INTRO = 'coupon_found_pro';
  process.env.STRIPE_COUPON_FOUNDING_LIFETIME = 'coupon_found_life';
}

test('resolvePromoDisplayPricing computes discounted monthly rates from Stripe', async () => {
  setPricingEnv();
  const stripe = fakeStripe(
    {
      price_basic_m: { unit_amount: 3900, currency: 'usd' },
      price_pro_m: { unit_amount: 5900, currency: 'usd' },
    },
    {
      coupon_promo_basic: { amount_off: 2000, currency: 'usd' },
      coupon_promo_pro: { amount_off: 3000, currency: 'usd' },
    },
  );
  const pricing = await resolvePromoDisplayPricing(stripe);
  assert.deepEqual(pricing, { basicMonthly: '$19', proMonthly: '$29' });
});

test('resolveFoundingDisplayPricing computes intro/list/lifetime from Stripe', async () => {
  setPricingEnv();
  const stripe = fakeStripe(
    {
      price_basic_m: { unit_amount: 3900, currency: 'usd' },
      price_pro_m: { unit_amount: 5900, currency: 'usd' },
    },
    {
      coupon_found_basic: { amount_off: 2700, currency: 'usd' }, // $39 -> $12
      coupon_found_pro: { amount_off: 4000, currency: 'usd' }, // $59 -> $19
      coupon_found_life: { percent_off: 25 },
    },
  );
  const pricing = await resolveFoundingDisplayPricing(stripe);
  assert.deepEqual(pricing, {
    basicMonthlyIntro: '$12',
    basicMonthlyList: '$39',
    proMonthlyIntro: '$19',
    proMonthlyList: '$59',
    lifetimePercentOff: 25,
  });
});

test('resolvers return null when a required id is unconfigured', async () => {
  setPricingEnv();
  delete process.env.STRIPE_COUPON_PROMO_PRO_MONTHLY;
  const stripe = fakeStripe({}, {});
  assert.equal(await resolvePromoDisplayPricing(stripe), null);
});

test('resolveFoundingDisplayPricing tolerates a missing lifetime coupon', async () => {
  setPricingEnv();
  delete process.env.STRIPE_COUPON_FOUNDING_LIFETIME;
  const stripe = fakeStripe(
    {
      price_basic_m: { unit_amount: 3900, currency: 'usd' },
      price_pro_m: { unit_amount: 5900, currency: 'usd' },
    },
    {
      coupon_found_basic: { amount_off: 2700, currency: 'usd' },
      coupon_found_pro: { amount_off: 4000, currency: 'usd' },
    },
  );
  const pricing = await resolveFoundingDisplayPricing(stripe);
  assert.equal(pricing?.lifetimePercentOff, null);
  assert.equal(pricing?.proMonthlyIntro, '$19');
});
