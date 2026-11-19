// The Black Friday 2026 sale: half off the first year of any plan, for a
// first-time member who PAYS TODAY. One PURE module (no Stripe, no DB, no env
// reads, no clock), so the pricing page, checkout and the unit tests all read
// the same answers. Env is read by core/stripe.ts (getBlackFridayWindow,
// isBlackFridayOpen); the setup script creates and checks the Stripe coupon.
//
// THE OFFER
//   • 50% off every payment in the member's first 12 months, on every plan:
//     twelve monthly payments, four quarterly payments, or the first annual
//     payment. One Stripe coupon (percent off, repeating for 12 months) does all
//     six plans, because a repeating coupon discounts every invoice inside its
//     window whatever the billing period.
//   • First-time members only: an account that has never held a subscription,
//     the same rule as the free trial. A member who has paid before, or let a
//     trial lapse, is not eligible: the win-back owns them, and a sale open to
//     them would invite current members to cancel and come back at half price.
//   • Paid today, never with a free trial. On every plan but Basic monthly
//     that changes nothing: those plans are paid up front already. On Basic
//     monthly the member chooses: the sale price, charged today, or the regular
//     7-day free trial at the regular price.
//   • Covered by the 7-day money-back guarantee, Basic monthly included. Every
//     plan the site sells paid up front carries the guarantee, and a sale
//     purchase is paid up front. The one-refund-per-customer limit still applies.
//   • Exclusive: it replaces a referral, partner or campaign discount for that
//     checkout rather than stacking with it. Each of those is worth less than
//     half off the first year (the partner rate is 25%, the business-card
//     campaign 50%), so nobody gets a worse deal than the page shows them.
//     Partner commission and campaign attribution follow users.referred_by_code,
//     not the coupon, so they are unaffected.
//
// THE WINDOW
//   BLACK_FRIDAY_START_AT (optional) to BLACK_FRIDAY_END_AT, start inclusive and
//   end exclusive, like PROMO_END_AT. Both are instants: the end of Tuesday,
//   December 1 in New York is 2026-12-02T04:59:59Z (EST is UTC-5). Set them
//   ahead of time and the sale opens and closes on its own.
//
// Locked down in tests/blackFridaySale.test.ts.

import { CADENCE_MONTHS, LIST_PRICE_USD, type Sku } from './billingPlans.ts';

export const BLACK_FRIDAY_SALE = {
  percentOff: 50,
  // How many months of payments the discount covers. 12 reads as "your first
  // year" on every billing period.
  months: 12,
} as const;

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------

export type SaleWindow = {
  // Null when no start is set: open from the moment the env is read.
  startMs: number | null;
  endMs: number;
};

function parseInstant(raw: string | null | undefined): number | null | 'invalid' {
  const value = (raw ?? '').trim();
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 'invalid';
}

// The configured window, or null when there is none or it cannot be trusted:
// no end, an end or start that does not parse, or a start at or after the end.
// Null means closed. A garbled value must close the sale rather than open it
// with no end, and must never take checkout down.
export function parseSaleWindow(
  startAt: string | null | undefined,
  endAt: string | null | undefined,
): SaleWindow | null {
  const endMs = parseInstant(endAt);
  if (endMs === null || endMs === 'invalid') return null;
  const startMs = parseInstant(startAt);
  if (startMs === 'invalid') return null;
  if (startMs !== null && startMs >= endMs) return null;
  return { startMs, endMs };
}

export function isSaleWindowOpen(window: SaleWindow | null, nowMs: number): boolean {
  if (!window) return false;
  if (window.startMs !== null && nowMs < window.startMs) return false;
  return nowMs < window.endMs;
}

export type SaleConfig = {
  couponId: string | null | undefined;
  startAt: string | null | undefined;
  endAt: string | null | undefined;
};

// The sale's window while the sale is on (the coupon is configured and now is
// inside the window); null otherwise. The one definition of "on" that checkout
// (core/stripe.ts isBlackFridayOpen), the pricing page and the session's banner
// flag all read, so they can never disagree. A blank coupon counts as unset:
// deploy/steps/036.billing seeds blank placeholders (KEY=).
export function openSaleWindow(config: SaleConfig, nowMs: number): SaleWindow | null {
  if (!(config.couponId ?? '').trim()) return null;
  const saleWindow = parseSaleWindow(config.startAt, config.endAt);
  return isSaleWindowOpen(saleWindow, nowMs) ? saleWindow : null;
}

// Whether the site-wide sale banner is for this signed-in member: someone
// checkout would sell the sale to, which means a free account ('public') with
// no live subscription or trial that has never held one. A paid tier with no
// subscription (a comped member, a creator partner) already has the product,
// so it doesn't see the banner. An admin sees it as a preview, as on /pricing:
// an admin can't subscribe, so nothing can be bought from it.
export function showsSaleBanner(member: {
  tier: string;
  hasActiveSubscription: boolean;
  hasHeldSubscription: boolean;
}): boolean {
  if (member.tier !== 'public' && member.tier !== 'admin') return false;
  return !member.hasActiveSubscription && !member.hasHeldSubscription;
}

// The last day of the sale as the page states it, in New York time and the
// member's language: "Tuesday, December 1". Formatted one second before the
// end, so an end set at midnight reads as the day it closes rather than the
// day after.
export function formatSaleDeadline(endMs: number, locale: string = 'en-US'): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  };
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(endMs - 1000));
  } catch {
    return new Intl.DateTimeFormat('en-US', options).format(new Date(endMs - 1000));
  }
}

// ---------------------------------------------------------------------------
// Prices
// ---------------------------------------------------------------------------

// What one payment costs at the sale price, in dollars to the cent. Stripe
// takes the percentage off the amount in cents and rounds to the cent, and so
// does this. At 50% every plan comes out exact: $19.50, $29.50, $37.50, $57.50,
// $99.50 and $149.50.
export function salePriceUsd(sku: Sku): number {
  const listCents = LIST_PRICE_USD[sku.tier][sku.cadence] * 100;
  const offCents = Math.round((listCents * BLACK_FRIDAY_SALE.percentOff) / 100);
  return (listCents - offCents) / 100;
}

// The sale price spread over the months one payment covers, to the cent.
export function salePerMonthUsd(sku: Sku): number {
  return Math.round((salePriceUsd(sku) / CADENCE_MONTHS[sku.cadence]) * 100) / 100;
}

// How many payments the discount covers on this billing period: 12 monthly, 4
// quarterly, 1 annual.
export function salePayments(sku: Sku): number {
  return Math.max(1, Math.floor(BLACK_FRIDAY_SALE.months / CADENCE_MONTHS[sku.cadence]));
}

// ---------------------------------------------------------------------------
// Checkout
// ---------------------------------------------------------------------------

export type SaleCheckoutInput = {
  // The window is open AND the coupon is configured (core/stripe.ts
  // isBlackFridayOpen).
  saleOpen: boolean;
  // The account has never held a subscription of any kind (checkout's
  // hasHeldSubscriptionBefore, negated): the free-trial population.
  firstTime: boolean;
  // Whether this checkout would start a free trial without the sale: the
  // Basic monthly trial, or the extended reactivation trial an invited member
  // gets on any plan.
  trialOtherwise: boolean;
  // The member picked the sale price on the pricing page. The page sends it
  // whenever it showed them the sale price on the plan they chose, so a sale
  // that closed between page load and click is refused rather than charged at
  // a price they were not shown.
  saleRequested: boolean;
};

export type SaleRefusal = 'closed' | 'not_first_time';

export type SaleCheckoutDecision = { kind: 'sale' } | { kind: 'none' } | { kind: 'refuse'; reason: SaleRefusal };

// Whether this checkout is sold at the sale price.
//
//   • Asked for: sold at the sale price if the window is open and the member is
//     first-time, even on a plan that would otherwise trial (that is the
//     choice the Basic monthly card offers). Otherwise refused, with a reason
//     the page can show.
//   • Not asked for: a first-time member checking out a plan that is paid
//     today anyway still gets the sale price, so a checkout started anywhere
//     but the pricing page cannot charge more than the page advertises. A
//     checkout that would start a trial keeps its trial and the regular price:
//     the sale is never given alongside a free trial.
export function decideSaleCheckout(input: SaleCheckoutInput): SaleCheckoutDecision {
  if (input.saleRequested) {
    if (!input.saleOpen) return { kind: 'refuse', reason: 'closed' };
    if (!input.firstTime) return { kind: 'refuse', reason: 'not_first_time' };
    return { kind: 'sale' };
  }
  if (input.saleOpen && input.firstTime && !input.trialOtherwise) return { kind: 'sale' };
  return { kind: 'none' };
}

// What checkout tells a member whose sale request it refused. 'closed' covers
// both sides of the window (not open yet, or over), so it names neither.
export const SALE_REFUSAL_MESSAGE: Record<SaleRefusal, string> = {
  closed:
    "The Black Friday sale isn't on right now, so that price isn't available. Refresh the page to see current prices.",
  not_first_time:
    'The Black Friday price is for new members only. Refresh the page to see the plans available to you.',
};
