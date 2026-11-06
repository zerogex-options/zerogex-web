// A time-boxed discount for free members, carried by a Stripe PROMOTION CODE
// they type at checkout — and everything the offer email states about it,
// derived from the code itself.
//
// Why a promotion code. Checkout switches Stripe's "Add promotion code" box on
// whenever the server applies no discount of its own
// (app/api/billing/checkout/route.ts: allow_promotion_codes), which is the case
// for a never-subscribed signup now that the public promo has closed. So an
// offer to the free cohort needs no change to checkout, the webhook or the
// plan-switch logic: the coupon behind the code is not one the app manages, and
// core/planSwitch.ts reconcileSwitchDiscounts keeps every unmanaged coupon on a
// plan switch. Creator partners' audiences already redeem their codes this way.
//
// Why derive the copy. The email names a rate, a duration, a deadline and four
// prices. Each of those is a property of a Stripe object, and copy typed by hand
// drifts from the object it describes — the August extended-trial email and the
// July trial wording both shipped promises checkout would not keep. So the
// sender looks the code up, refuses anything this file cannot describe exactly,
// and fills the template from what Stripe returns.
//
// What it refuses, and why:
//   • A code that is inactive, used up, or whose coupon is no longer valid.
//   • No deadline. The email is a deadline email; "ends soon" with no date is
//     the kind of claim it exists to avoid.
//   • A deadline under MIN_OFFER_LEAD_HOURS away: most of the list would read
//     the email after the code stopped working.
//   • Not limited to first-time customers. That restriction is what keeps a
//     forwarded or posted code from discounting a churned member's return (the
//     win-back owns them) and bounds the damage of a leak to new customers.
//   • Limited to one customer or to a minimum order, or to products that leave
//     out a plan the email prices. The copy says the code works on any plan.
//     A product limit that covers every plan is fine: each tier is one Stripe
//     product with all its billing periods under it, so a coupon limited to the
//     Basic and Pro products discounts every plan.
//   • A coupon shape whose wording would be wrong on some plan:
//       - duration "once": with the Basic trial the first invoice is the $0
//         trial invoice, so "your first payment" is not a promise this email can
//         make with confidence;
//       - "repeating" for more than 12 months: an annual renewal falls on the
//         edge of the window, so whether the second year is discounted is not
//         something to print in a price table;
//       - 100% off, or an amount off in a currency other than the prices'.
//
// Pure: no Stripe client, no env, no clock. tests/promoCodeOffer.test.ts.

import { applyCoupon, formatMoneyCompact } from './offerPricing.ts';
import {
  BILLABLE_TIERS,
  BILLING_CADENCES,
  MONEY_BACK_GUARANTEE_DAYS,
  planHasFreeTrial,
} from './billingPlans.ts';

/**
 * The free-trial length checkout grants on a trial plan. Mirrors
 * TRIAL_PERIOD_DAYS in app/api/billing/checkout/route.ts, which is not
 * importable from a script; tests/promoCodeOffer.test.ts reads the route and
 * fails if the two ever disagree.
 */
export const OFFER_TRIAL_DAYS = 7;

/** The least time a code may have left when the email goes out. */
export const MIN_OFFER_LEAD_HOURS = 48;

/** The longest "repeating" coupon whose wording holds on every plan. */
export const MAX_REPEATING_MONTHS = 12;

const HOUR_MS = 3_600_000;

// ---------------------------------------------------------------------------
// The Stripe shapes this reasons about (API version 2025-02-24.acacia, where a
// promotion code carries its coupon as an object). Structural, so the tests
// build them by hand.
// ---------------------------------------------------------------------------

export type OfferCoupon = {
  id: string;
  valid: boolean;
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: 'once' | 'repeating' | 'forever' | string;
  duration_in_months: number | null;
  // Unix seconds. A coupon past its redeem_by can't be applied, so it is a
  // deadline just as the code's own expires_at is.
  redeem_by: number | null;
  max_redemptions: number | null;
  times_redeemed: number;
  // Only present when the list call expands data.coupon.applies_to.
  applies_to?: { products: string[] } | null;
};

export type OfferPromotionCode = {
  id: string;
  code: string;
  active: boolean;
  livemode: boolean;
  // Unix seconds.
  expires_at: number | null;
  max_redemptions: number | null;
  times_redeemed: number;
  customer: string | null;
  restrictions: {
    first_time_transaction: boolean;
    minimum_amount: number | null;
  };
  coupon: OfferCoupon;
};

// ---------------------------------------------------------------------------
// Deadline
// ---------------------------------------------------------------------------

/** When the code stops working: its own expiry or its coupon's, whichever is first. */
export function offerDeadlineMs(promo: OfferPromotionCode): number | null {
  const candidates = [promo.expires_at, promo.coupon.redeem_by]
    .filter((s): s is number => typeof s === 'number' && Number.isFinite(s) && s > 0)
    .map((s) => s * 1000);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

const ET = 'America/New_York';

function etParts(ms: number): Record<string, string> {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ET,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(new Date(ms));
  const out: Record<string, string> = {};
  for (const p of parts) out[p.type] = p.value;
  return out;
}

/**
 * The deadline as the email states it, in New York time: "11:59 PM ET on
 * Sunday, November 16", and "November 16" for the subject line.
 *
 * A code set to expire at midnight is described as the end of the day before:
 * "12:00 AM ET on Monday" is correct and reads as a day later than it is.
 */
export function formatOfferDeadline(deadlineMs: number): { long: string; short: string } {
  let ms = deadlineMs;
  const first = etParts(ms);
  if (first.hour === '12' && first.minute === '00' && first.dayPeriod === 'AM') ms -= 60_000;
  const p = etParts(ms);
  return {
    long: `${p.hour}:${p.minute} ${p.dayPeriod} ET on ${p.weekday}, ${p.month} ${p.day}`,
    short: `${p.month} ${p.day}`,
  };
}

// ---------------------------------------------------------------------------
// The discount, in words
// ---------------------------------------------------------------------------

function formatPercent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

function windowPhrase(months: number): string {
  if (months === 12) return 'your first year';
  if (months === 1) return 'your first month';
  return `your first ${months} months`;
}

/**
 * Why this coupon's discount can't be described exactly on every plan, or null
 * when it can. See the file header for the reasoning behind each refusal.
 */
export function couponShapeProblem(coupon: OfferCoupon): string | null {
  const percent = coupon.percent_off;
  const amount = coupon.amount_off;
  const hasPercent = typeof percent === 'number' && percent > 0;
  const hasAmount = typeof amount === 'number' && amount > 0;
  if (!hasPercent && !hasAmount) return 'the coupon takes nothing off (no percent_off or amount_off)';
  if (hasPercent && percent >= 100) {
    return 'the coupon is 100% off, which is a free plan, not an offer this email can make';
  }
  if (!hasPercent && hasAmount && (coupon.currency ?? '').toLowerCase() !== 'usd') {
    return `the coupon takes an amount off in ${(coupon.currency ?? 'no currency').toUpperCase()}, but ZeroGEX prices are in USD`;
  }
  if (coupon.duration === 'once') {
    return (
      'the coupon is duration "once". With the Basic free trial, the first invoice is the $0 trial ' +
      'invoice, so "your first payment" is not a promise this email can make. Use "repeating" ' +
      '(12 months reads as "your first year") or "forever"'
    );
  }
  if (coupon.duration === 'repeating') {
    const months = coupon.duration_in_months;
    if (typeof months !== 'number' || !Number.isInteger(months) || months < 1) {
      return 'the coupon is "repeating" but has no whole number of months';
    }
    if (months > MAX_REPEATING_MONTHS) {
      return (
        `the coupon repeats for ${months} months. Past ${MAX_REPEATING_MONTHS}, whether an annual ` +
        'renewal is discounted depends on the exact renewal instant, so the price table cannot ' +
        'state it. Use 12 months or less, or "forever"'
      );
    }
    return null;
  }
  if (coupon.duration === 'forever') return null;
  return `the coupon has an unrecognized duration "${coupon.duration}"`;
}

export type OfferWords = {
  /** "40% off" */
  short: string;
  /** "40% off every payment in your first year" */
  label: string;
  /** "40% off your first year of ZeroGEX" */
  headline: string;
};

/** The discount in words, or null for any shape couponShapeProblem refuses. */
export function describeOffer(coupon: OfferCoupon): OfferWords | null {
  if (couponShapeProblem(coupon)) return null;
  const amountText =
    typeof coupon.percent_off === 'number' && coupon.percent_off > 0
      ? formatPercent(coupon.percent_off)
      : formatMoneyCompact(coupon.amount_off ?? 0, coupon.currency ?? 'usd');
  const short = `${amountText} off`;
  if (coupon.duration === 'forever') {
    return {
      short,
      label: `${short} every payment for as long as you stay subscribed`,
      headline: `${short} ZeroGEX for as long as you stay subscribed`,
    };
  }
  const window = windowPhrase(coupon.duration_in_months ?? 0);
  return {
    short,
    label: `${short} every payment in ${window}`,
    headline: `${short} ${window} of ZeroGEX`,
  };
}

// ---------------------------------------------------------------------------
// Is this code safe to email?
// ---------------------------------------------------------------------------

function remaining(max: number | null, used: number): number | null {
  return typeof max === 'number' && max > 0 ? max - used : null;
}

/** How many more times the code can be redeemed, or null for no cap. */
export function redemptionsLeft(promo: OfferPromotionCode): number | null {
  const caps = [
    remaining(promo.max_redemptions, promo.times_redeemed),
    remaining(promo.coupon.max_redemptions, promo.coupon.times_redeemed),
  ].filter((n): n is number => n !== null);
  return caps.length > 0 ? Math.min(...caps) : null;
}

/** A plan the email offers, and the Stripe product its price belongs to. */
export type OfferPlanProduct = { label: string; productId: string };

/**
 * Every reason not to send an email offering this code. Empty means it is safe
 * to describe and every recipient can redeem it.
 *
 * `minLeadHours` is how long the code must still have to run. The first email
 * needs the default two days; a last-call reminder, sent the day the code ends,
 * passes less.
 *
 * `plans` are the plans the email offers with their products, so a coupon
 * limited to products can be checked against them. Without them a product
 * limit cannot be shown to cover every plan, and is refused.
 */
export function promoCodeProblems(
  promo: OfferPromotionCode,
  nowMs: number,
  minLeadHours: number = MIN_OFFER_LEAD_HOURS,
  plans: ReadonlyArray<OfferPlanProduct> = [],
): string[] {
  const problems: string[] = [];
  if (!promo.active) problems.push('the promotion code is not active');
  if (!promo.coupon.valid) problems.push('its coupon is no longer valid in Stripe');
  if (promo.customer) {
    problems.push('the code is limited to one customer; a campaign code must work for everyone it is sent to');
  }
  if (!promo.restrictions.first_time_transaction) {
    problems.push(
      'the code is not limited to first-time customers. Tick "Eligible for first-time order only" ' +
        'on the promotion code, so a forwarded code cannot discount a returning member',
    );
  }
  if (typeof promo.restrictions.minimum_amount === 'number' && promo.restrictions.minimum_amount > 0) {
    problems.push('the code has a minimum order amount, so it would not work on every plan the email offers');
  }
  const limitedTo = promo.coupon.applies_to?.products ?? [];
  if (limitedTo.length > 0) {
    if (plans.length === 0) {
      problems.push('the coupon is limited to specific products, and no plan products were given to check it against');
    } else {
      const missed = plans.filter((plan) => !limitedTo.includes(plan.productId));
      if (missed.length > 0) {
        problems.push(
          `the coupon is limited to specific products and leaves out ${missed
            .map((plan) => `${plan.label} (${plan.productId})`)
            .join(', ')}. A coupon's products cannot be changed in Stripe: make a new coupon ` +
            'covering both the Basic and the Pro product, or with no product limit',
        );
      }
    }
  }
  const left = redemptionsLeft(promo);
  if (left !== null && left <= 0) problems.push('the code has no redemptions left');

  const deadline = offerDeadlineMs(promo);
  if (deadline === null) {
    problems.push('the code never expires. Set an expiration date on it: this email states a deadline');
  } else if (deadline <= nowMs) {
    problems.push('the code has already expired');
  } else if (deadline - nowMs < minLeadHours * HOUR_MS) {
    const hours = Math.floor((deadline - nowMs) / HOUR_MS);
    problems.push(
      `the code expires in ${hours} hour(s). This email needs at least ${minLeadHours}: ` +
        'recipients do not all read their email the hour it arrives',
    );
  }

  const shape = couponShapeProblem(promo.coupon);
  if (shape) problems.push(shape);
  return problems;
}

// ---------------------------------------------------------------------------
// Price table and plan terms
// ---------------------------------------------------------------------------

export type ListPrice = { amount: number; currency: string };

export type OfferListPrices = {
  basicMonthly: ListPrice;
  proMonthly: ListPrice;
  basicAnnual: ListPrice;
  proAnnual: ListPrice;
};

function monthlyRow(price: ListPrice, coupon: OfferCoupon): { list: string; offer: string } {
  const list = formatMoneyCompact(price.amount, price.currency);
  const offer = formatMoneyCompact(applyCoupon(price.amount, price.currency, coupon), price.currency);
  if (coupon.duration === 'forever') return { list: `${list}/month`, offer: `${offer}/month` };
  return {
    list: `${list}/month`,
    offer: `${offer}/month in ${windowPhrase(coupon.duration_in_months ?? 0)}, then ${list}`,
  };
}

function annualRow(price: ListPrice, coupon: OfferCoupon): { list: string; offer: string } {
  const list = formatMoneyCompact(price.amount, price.currency);
  const offer = formatMoneyCompact(applyCoupon(price.amount, price.currency, coupon), price.currency);
  if (coupon.duration === 'forever') return { list: `${list}/year`, offer: `${offer}/year` };
  // Any repeating window of 1-12 months contains exactly one annual payment, the
  // first, which is taken up front (annual plans have no trial).
  return { list: `${list}/year`, offer: `${offer} for your first year, then ${list}/year` };
}

/**
 * The plan sentence under the price table, from the same BILLING_TRIAL_PLANS
 * policy checkout enforces, so the email can never promise a trial or a
 * guarantee a plan does not carry.
 */
export function planTermsLine(trialPlans: ReadonlySet<string>): string {
  const all = BILLABLE_TIERS.flatMap((tier) => BILLING_CADENCES.map((cadence) => ({ tier, cadence })));
  const trialing = all.filter((sku) => planHasFreeTrial(sku, trialPlans));
  const g = MONEY_BACK_GUARANTEE_DAYS;
  const t = OFFER_TRIAL_DAYS;
  if (trialing.length === 0) {
    return `Every plan is paid up front and covered by a ${g}-day money-back guarantee.`;
  }
  if (trialing.length === all.length) {
    return `Every plan starts with a ${t}-day free trial, and the discount starts with your first payment.`;
  }
  if (trialing.length === 1 && trialing[0].tier === 'basic' && trialing[0].cadence === 'monthly') {
    return (
      `Basic monthly starts with a ${t}-day free trial, so nothing is charged until day ${t} and the ` +
      `discount starts with your first payment. Every other plan is paid up front and covered by a ` +
      `${g}-day money-back guarantee.`
    );
  }
  return (
    `Each plan comes with either a ${t}-day free trial or a ${g}-day money-back guarantee, and the ` +
    'pricing page shows which.'
  );
}

/**
 * Every placeholder an offer template may use, filled from the code, its
 * coupon, the live list prices and the trial policy. Throws if the code is one
 * promoCodeProblems would refuse on shape alone, so a caller can't render copy
 * for a discount it skipped checking.
 */
export function buildOfferPlaceholders(input: {
  promo: OfferPromotionCode;
  prices: OfferListPrices;
  trialPlans: ReadonlySet<string>;
}): Record<string, string> {
  const { promo, prices, trialPlans } = input;
  const words = describeOffer(promo.coupon);
  const deadline = offerDeadlineMs(promo);
  if (!words || deadline === null) {
    throw new Error(`promotion code ${promo.code} cannot be described; run promoCodeProblems first`);
  }
  const when = formatOfferDeadline(deadline);
  const basicMonthly = monthlyRow(prices.basicMonthly, promo.coupon);
  const proMonthly = monthlyRow(prices.proMonthly, promo.coupon);
  const basicAnnual = annualRow(prices.basicAnnual, promo.coupon);
  const proAnnual = annualRow(prices.proAnnual, promo.coupon);
  return {
    PROMO_CODE: promo.code,
    OFFER_SHORT: words.short,
    OFFER_LABEL: words.label,
    OFFER_HEADLINE: words.headline,
    OFFER_DEADLINE: when.long,
    OFFER_DEADLINE_SHORT: when.short,
    BASIC_MONTHLY_LIST: basicMonthly.list,
    BASIC_MONTHLY_OFFER: basicMonthly.offer,
    PRO_MONTHLY_LIST: proMonthly.list,
    PRO_MONTHLY_OFFER: proMonthly.offer,
    BASIC_ANNUAL_LIST: basicAnnual.list,
    BASIC_ANNUAL_OFFER: basicAnnual.offer,
    PRO_ANNUAL_LIST: proAnnual.list,
    PRO_ANNUAL_OFFER: proAnnual.offer,
    PLAN_TERMS: planTermsLine(trialPlans),
  };
}

/** The placeholders every offer template must carry: the code, what it gives, and until when. */
export const REQUIRED_OFFER_PLACEHOLDERS = ['PROMO_CODE', 'OFFER_LABEL', 'OFFER_DEADLINE'] as const;
