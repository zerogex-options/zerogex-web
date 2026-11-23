// What the Black Friday announcement email states about the sale, and when it
// may go out.
//
// The email names a rate, a deadline and four prices. None is typed into the
// template: scripts/send-product-update.mts fills them from the sale module the
// pricing page and checkout read (core/blackFridaySale.ts) and the configured
// window, so the email can't state a price the page doesn't show or a deadline
// the sale doesn't keep. The November promo-code email works the same way
// (core/promoCodeOffer.ts), and this reuses its deadline wording.
//
// Kept apart from core/blackFridaySale.ts because the pricing page bundles that
// module for the browser, and nothing here belongs in a browser.
//
// Pure: no env, no clock. tests/blackFridayEmail.test.ts.

import { LIST_PRICE_USD, formatBilledUsd, formatUsd, type BillableTier } from './billingPlans.ts';
import { BLACK_FRIDAY_SALE, isSaleWindowOpen, salePriceUsd, type SaleWindow } from './blackFridaySale.ts';
import { formatOfferDeadline } from './promoCodeOffer.ts';

/** The least time the sale must still have to run when the email goes out. */
export const MIN_SALE_EMAIL_LEAD_HOURS = 48;

/** What a sale email must state: the rate, and until when. */
export const REQUIRED_SALE_PLACEHOLDERS = ['SALE_PERCENT', 'SALE_DEADLINE'] as const;

const HOUR_MS = 3_600_000;

const TIER_KEY: Record<BillableTier, string> = { basic: 'BASIC', pro: 'PRO' };

/**
 * Every placeholder a sale email may use:
 *   SALE_PERCENT          "50%"
 *   SALE_DEADLINE         "11:59 PM ET on Tuesday, December 1"
 *   SALE_DEADLINE_SHORT   "December 1"
 *   SALE_BASIC_MONTHLY    "$19.50/month"   and _THEN "for your first year, then $39/month"
 *   SALE_BASIC_ANNUAL     "$99.50"         and _THEN "for your first year, then $199/year"
 *   (and the same for Pro)
 */
export function buildSaleEmailPlaceholders(endMs: number): Record<string, string> {
  const when = formatOfferDeadline(endMs);
  const out: Record<string, string> = {
    SALE_PERCENT: `${BLACK_FRIDAY_SALE.percentOff}%`,
    SALE_DEADLINE: when.long,
    SALE_DEADLINE_SHORT: when.short,
  };
  for (const tier of ['basic', 'pro'] as const) {
    const key = TIER_KEY[tier];
    out[`SALE_${key}_MONTHLY`] = `${formatUsd(salePriceUsd({ tier, cadence: 'monthly' }))}/month`;
    out[`SALE_${key}_MONTHLY_THEN`] = `for your first year, then ${formatBilledUsd(LIST_PRICE_USD[tier].monthly)}/month`;
    out[`SALE_${key}_ANNUAL`] = formatUsd(salePriceUsd({ tier, cadence: 'annual' }));
    out[`SALE_${key}_ANNUAL_THEN`] = `for your first year, then ${formatBilledUsd(LIST_PRICE_USD[tier].annual)}/year`;
  }
  return out;
}

// "Thursday, November 19 at 12:00 AM ET": when the sale opens, for messages.
function newYork(ms: number): string {
  const text = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
  return `${text} ET`;
}

export type SaleEmailCheck = {
  // STRIPE_COUPON_BLACK_FRIDAY is set. Without it the sale is off whatever the
  // window says (core/stripe.ts isBlackFridayOpen).
  couponConfigured: boolean;
  // parseSaleWindow of BLACK_FRIDAY_START_AT / BLACK_FRIDAY_END_AT.
  window: SaleWindow | null;
  nowMs: number;
  // A real send needs the sale on now, so a reader who clicks sees the sale
  // prices. A preview may go out before it opens.
  requireOpen: boolean;
  minLeadHours?: number;
  // A last-call email says the sale ends "tonight", which is only true on the
  // sale's final day in New York. A real send on any other day is refused; a
  // preview may still go out ahead of time.
  lastDayOnly?: boolean;
};

// "2026-12-01": the calendar day in New York, for comparing two instants.
function newYorkDay(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

// "Tuesday, December 1": the sale's last day, for messages.
function newYorkDayName(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(ms));
}

/**
 * Every reason not to send the sale email. Empty means the sale is configured
 * and, for a real send, on now with at least minLeadHours to run (and, for a
 * last call, on the sale's final day in New York).
 */
export function saleEmailProblems(check: SaleEmailCheck): string[] {
  const problems: string[] = [];
  if (!check.couponConfigured) {
    problems.push('STRIPE_COUPON_BLACK_FRIDAY is not set, so the sale is off and checkout charges regular prices');
  }
  const window = check.window;
  if (!window) {
    problems.push(
      'BLACK_FRIDAY_END_AT is missing or not a valid time (or the start is not before it), so the sale is off',
    );
    return problems;
  }
  if (window.endMs <= check.nowMs) {
    problems.push('the sale has already ended');
    return problems;
  }
  if (check.requireOpen && !isSaleWindowOpen(window, check.nowMs) && window.startMs !== null) {
    problems.push(
      `the sale hasn't opened yet (it opens ${newYork(window.startMs)}). Send once it's on, so a reader ` +
        'who clicks sees the sale prices',
    );
  }
  const lead = check.minLeadHours ?? MIN_SALE_EMAIL_LEAD_HOURS;
  if (window.endMs - check.nowMs < lead * HOUR_MS) {
    const hours = Math.floor((window.endMs - check.nowMs) / HOUR_MS);
    problems.push(
      `the sale ends in ${hours} hour(s). This email needs at least ${lead}: recipients don't all read ` +
        'their email the hour it arrives',
    );
  }
  if (check.requireOpen && check.lastDayOnly) {
    const note = saleLastDayProblem(window.endMs, check.nowMs);
    if (note) problems.push(note);
  }
  return problems;
}

/**
 * Why a last-call email ("the sale ends tonight") can't go out at nowMs, or null
 * on the sale's last day in New York. An end at exactly midnight belongs to the
 * day before, as the deadline wording has it (formatOfferDeadline), hence the
 * millisecond back. The sender also prints it on a dry run, ahead of the day.
 */
export function saleLastDayProblem(endMs: number, nowMs: number): string | null {
  const lastDay = endMs - 1;
  if (newYorkDay(nowMs) === newYorkDay(lastDay)) return null;
  return (
    `this email says the sale ends tonight, so it can only go out on its last day, ` +
    `${newYorkDayName(lastDay)} (New York time)`
  );
}
