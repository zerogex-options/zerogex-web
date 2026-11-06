import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  MIN_OFFER_LEAD_HOURS,
  OFFER_TRIAL_DAYS,
  REQUIRED_OFFER_PLACEHOLDERS,
  buildOfferPlaceholders,
  couponShapeProblem,
  describeOffer,
  formatOfferDeadline,
  offerDeadlineMs,
  planTermsLine,
  promoCodeProblems,
  redemptionsLeft,
  type OfferCoupon,
  type OfferListPrices,
  type OfferPromotionCode,
} from '../core/promoCodeOffer.ts';
import { parseTrialPlans } from '../core/billingPlans.ts';

// Friday, November 6, 2026, 12:00 UTC.
const NOW = Date.parse('2026-11-06T12:00:00Z');
// 11:59 PM ET on Sunday, November 15, 2026 (EST, UTC-5).
const SUNDAY_NIGHT = Date.parse('2026-11-16T04:59:00Z') / 1000;

function coupon(over: Partial<OfferCoupon> = {}): OfferCoupon {
  return {
    id: 'ZGX_FREE_MEMBER_40_12M',
    valid: true,
    percent_off: 40,
    amount_off: null,
    currency: null,
    duration: 'repeating',
    duration_in_months: 12,
    redeem_by: null,
    max_redemptions: null,
    times_redeemed: 0,
    applies_to: { products: [] },
    ...over,
  };
}

function promo(over: Partial<OfferPromotionCode> = {}, couponOver: Partial<OfferCoupon> = {}): OfferPromotionCode {
  return {
    id: 'promo_123',
    code: 'ZGX40',
    active: true,
    livemode: true,
    expires_at: SUNDAY_NIGHT,
    max_redemptions: null,
    times_redeemed: 0,
    customer: null,
    restrictions: { first_time_transaction: true, minimum_amount: null },
    coupon: coupon(couponOver),
    ...over,
  };
}

// The October 2026 list prices (core/billingPlans.ts LIST_PRICE_USD), in cents.
const PRICES: OfferListPrices = {
  basicMonthly: { amount: 3900, currency: 'usd' },
  proMonthly: { amount: 5900, currency: 'usd' },
  basicAnnual: { amount: 19900, currency: 'usd' },
  proAnnual: { amount: 29900, currency: 'usd' },
};

const DEFAULT_TRIAL_PLANS = parseTrialPlans('');

// ---------------------------------------------------------------------------

test('a first-time-only code with a real deadline and a 12-month coupon has no problems', () => {
  assert.deepEqual(promoCodeProblems(promo(), NOW), []);
});

test('40% off for 12 months reads as "your first year" and prices every plan', () => {
  const p = buildOfferPlaceholders({ promo: promo(), prices: PRICES, trialPlans: DEFAULT_TRIAL_PLANS });
  assert.equal(p.PROMO_CODE, 'ZGX40');
  assert.equal(p.OFFER_SHORT, '40% off');
  assert.equal(p.OFFER_LABEL, '40% off every payment in your first year');
  assert.equal(p.OFFER_HEADLINE, '40% off your first year of ZeroGEX');
  assert.equal(p.BASIC_MONTHLY_LIST, '$39/month');
  assert.equal(p.BASIC_MONTHLY_OFFER, '$23.40/month in your first year, then $39');
  assert.equal(p.PRO_MONTHLY_OFFER, '$35.40/month in your first year, then $59');
  assert.equal(p.BASIC_ANNUAL_LIST, '$199/year');
  assert.equal(p.BASIC_ANNUAL_OFFER, '$119.40 for your first year, then $199/year');
  assert.equal(p.PRO_ANNUAL_OFFER, '$179.40 for your first year, then $299/year');
  assert.equal(p.OFFER_DEADLINE, '11:59 PM ET on Sunday, November 15');
  assert.equal(p.OFFER_DEADLINE_SHORT, 'November 15');
});

test('a fixed amount off for 12 months: every monthly payment, and the annual payment once', () => {
  const p = buildOfferPlaceholders({
    promo: promo({}, { percent_off: null, amount_off: 1000, currency: 'usd' }),
    prices: PRICES,
    trialPlans: DEFAULT_TRIAL_PLANS,
  });
  assert.equal(p.OFFER_LABEL, '$10 off every payment in your first year');
  assert.equal(p.BASIC_MONTHLY_OFFER, '$29/month in your first year, then $39');
  assert.equal(p.PRO_MONTHLY_OFFER, '$49/month in your first year, then $59');
  // One annual payment falls in a 12-month window, so it is $10 off, not $120.
  assert.equal(p.BASIC_ANNUAL_OFFER, '$189 for your first year, then $199/year');
});

test('a shorter window names its months; the annual payment still falls inside it', () => {
  const three = describeOffer(coupon({ duration_in_months: 3 }));
  assert.equal(three?.label, '40% off every payment in your first 3 months');
  assert.equal(three?.headline, '40% off your first 3 months of ZeroGEX');
  const p = buildOfferPlaceholders({
    promo: promo({}, { duration_in_months: 3 }),
    prices: PRICES,
    trialPlans: DEFAULT_TRIAL_PLANS,
  });
  assert.equal(p.BASIC_MONTHLY_OFFER, '$23.40/month in your first 3 months, then $39');
  // Stripe discounts every invoice inside the window, and an annual plan's one
  // invoice is at the start of it. The table says so rather than hiding it.
  assert.equal(p.BASIC_ANNUAL_OFFER, '$119.40 for your first year, then $199/year');

  assert.equal(describeOffer(coupon({ duration_in_months: 1 }))?.label, '40% off every payment in your first month');
});

test('a forever coupon never mentions a window or a "then" price', () => {
  const p = buildOfferPlaceholders({
    promo: promo({}, { percent_off: 25, duration: 'forever', duration_in_months: null }),
    prices: PRICES,
    trialPlans: DEFAULT_TRIAL_PLANS,
  });
  assert.equal(p.OFFER_LABEL, '25% off every payment for as long as you stay subscribed');
  assert.equal(p.BASIC_MONTHLY_OFFER, '$29.25/month');
  assert.equal(p.BASIC_ANNUAL_OFFER, '$149.25/year');
});

test('fractional percentages render as written, without trailing zeros', () => {
  assert.equal(describeOffer(coupon({ percent_off: 12.5 }))?.short, '12.5% off');
  assert.equal(describeOffer(coupon({ percent_off: 33 }))?.short, '33% off');
});

// ---------------------------------------------------------------------------
// Refusals. Each is a way the email would promise something checkout won't do.
// ---------------------------------------------------------------------------

function problemsFor(over: Partial<OfferPromotionCode> = {}, couponOver: Partial<OfferCoupon> = {}): string {
  return promoCodeProblems(promo(over, couponOver), NOW).join(' | ');
}

test('refuses an inactive code or an invalid coupon', () => {
  assert.match(problemsFor({ active: false }), /not active/);
  assert.match(problemsFor({}, { valid: false }), /no longer valid/);
});

test('refuses a code anyone can use on a return, or only one customer can use', () => {
  assert.match(
    problemsFor({ restrictions: { first_time_transaction: false, minimum_amount: null } }),
    /first-time/,
  );
  assert.match(problemsFor({ customer: 'cus_123' }), /one customer/);
});

test('refuses a code that would not work on every plan the email lists', () => {
  assert.match(
    problemsFor({ restrictions: { first_time_transaction: true, minimum_amount: 15000 } }),
    /minimum order/,
  );
  assert.match(problemsFor({}, { applies_to: { products: ['prod_basic'] } }), /some products/);
});

test('refuses a code with no redemptions left, at either level', () => {
  assert.match(problemsFor({ max_redemptions: 10, times_redeemed: 10 }), /no redemptions left/);
  assert.match(problemsFor({}, { max_redemptions: 5, times_redeemed: 5 }), /no redemptions left/);
  assert.equal(redemptionsLeft(promo({ max_redemptions: 100, times_redeemed: 40 }, { max_redemptions: 50 })), 50);
  assert.equal(redemptionsLeft(promo()), null);
});

test('refuses a code with no deadline, a past one, or one too close to read in time', () => {
  assert.match(problemsFor({ expires_at: null }), /never expires/);
  assert.match(problemsFor({ expires_at: NOW / 1000 - 60 }), /already expired/);
  const tooSoon = NOW / 1000 + (MIN_OFFER_LEAD_HOURS - 1) * 3600;
  assert.match(problemsFor({ expires_at: tooSoon }), /expires in 47 hour/);
  // Exactly the minimum lead is enough.
  assert.deepEqual(promoCodeProblems(promo({ expires_at: NOW / 1000 + MIN_OFFER_LEAD_HOURS * 3600 }), NOW), []);
});

test('a last-call reminder can pass a shorter lead, but never past the deadline', () => {
  const in10h = NOW / 1000 + 10 * 3600;
  assert.match(problemsFor({ expires_at: in10h }), /expires in 10 hour/);
  assert.deepEqual(promoCodeProblems(promo({ expires_at: in10h }), NOW, 6), []);
  assert.match(promoCodeProblems(promo({ expires_at: NOW / 1000 + 5 * 3600 }), NOW, 6).join(), /needs at least 6/);
  assert.match(promoCodeProblems(promo({ expires_at: NOW / 1000 - 1 }), NOW, 6).join(), /already expired/);
});

test('the deadline is whichever comes first: the code expiry or the coupon redeem-by', () => {
  const early = Date.parse('2026-11-12T04:59:00Z') / 1000;
  assert.equal(offerDeadlineMs(promo({}, { redeem_by: early })), early * 1000);
  assert.equal(offerDeadlineMs(promo({ expires_at: null }, { redeem_by: early })), early * 1000);
  assert.equal(offerDeadlineMs(promo({ expires_at: null })), null);
});

test('refuses coupon shapes whose wording would be wrong on some plan', () => {
  assert.match(couponShapeProblem(coupon({ duration: 'once', duration_in_months: null })) ?? '', /trial invoice/);
  assert.match(couponShapeProblem(coupon({ duration_in_months: 13 })) ?? '', /13 months/);
  assert.match(couponShapeProblem(coupon({ duration_in_months: null })) ?? '', /no whole number/);
  assert.match(couponShapeProblem(coupon({ percent_off: 100 })) ?? '', /100% off/);
  assert.match(
    couponShapeProblem(coupon({ percent_off: null, amount_off: 1000, currency: 'eur' })) ?? '',
    /EUR/,
  );
  assert.match(couponShapeProblem(coupon({ percent_off: null, amount_off: null })) ?? '', /takes nothing off/);
  assert.equal(describeOffer(coupon({ duration: 'once' })), null);
  // And the refusal reaches the full problem list, not just the helper.
  assert.match(problemsFor({}, { duration: 'once' }), /trial invoice/);
});

test('buildOfferPlaceholders will not render a code it could not describe', () => {
  assert.throws(
    () =>
      buildOfferPlaceholders({
        promo: promo({}, { duration: 'once' }),
        prices: PRICES,
        trialPlans: DEFAULT_TRIAL_PLANS,
      }),
    /cannot be described/,
  );
  assert.throws(
    () => buildOfferPlaceholders({ promo: promo({ expires_at: null }), prices: PRICES, trialPlans: DEFAULT_TRIAL_PLANS }),
    /cannot be described/,
  );
});

// ---------------------------------------------------------------------------
// Deadline wording
// ---------------------------------------------------------------------------

test('the deadline is stated in New York time', () => {
  assert.deepEqual(formatOfferDeadline(Date.parse('2026-11-16T04:59:00Z')), {
    long: '11:59 PM ET on Sunday, November 15',
    short: 'November 15',
  });
  assert.deepEqual(formatOfferDeadline(Date.parse('2026-11-16T22:00:00Z')), {
    long: '5:00 PM ET on Monday, November 16',
    short: 'November 16',
  });
});

test('a midnight expiry reads as the end of the day before, not 12:00 AM the next day', () => {
  // 00:00 ET on Monday, November 16.
  assert.deepEqual(formatOfferDeadline(Date.parse('2026-11-16T05:00:00Z')), {
    long: '11:59 PM ET on Sunday, November 15',
    short: 'November 15',
  });
});

// ---------------------------------------------------------------------------
// Plan terms follow BILLING_TRIAL_PLANS, the lever checkout reads
// ---------------------------------------------------------------------------

test('plan terms: the default policy names the Basic trial and the guarantee', () => {
  const line = planTermsLine(DEFAULT_TRIAL_PLANS);
  assert.match(line, /^Basic monthly starts with a 7-day free trial/);
  assert.match(line, /7-day money-back guarantee/);
});

test('plan terms: no trials, every plan trialing, and a mix', () => {
  assert.match(planTermsLine(parseTrialPlans('none')), /^Every plan is paid up front/);
  assert.match(
    planTermsLine(
      parseTrialPlans('basic:monthly,basic:quarterly,basic:annual,pro:monthly,pro:quarterly,pro:annual'),
    ),
    /^Every plan starts with a 7-day free trial/,
  );
  assert.match(planTermsLine(parseTrialPlans('basic:monthly,pro:monthly')), /either a 7-day free trial/);
});

test('the trial length matches the one checkout grants', () => {
  const route = fs.readFileSync(
    path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'app', 'api', 'billing', 'checkout', 'route.ts'),
    'utf8',
  );
  const match = route.match(/const TRIAL_PERIOD_DAYS = (\d+);/);
  assert.ok(match, 'TRIAL_PERIOD_DAYS not found in the checkout route; update this test');
  assert.equal(OFFER_TRIAL_DAYS, Number(match[1]));
});

test('the required placeholders are all produced', () => {
  const p = buildOfferPlaceholders({ promo: promo(), prices: PRICES, trialPlans: DEFAULT_TRIAL_PLANS });
  for (const key of REQUIRED_OFFER_PLACEHOLDERS) assert.ok(p[key], `${key} missing`);
});
