// The prices quoted on the ZeroGEX-vs-competitor pages, in one place.
//
// ZeroGEX's side is read from the plan catalogue (core/billingPlans.ts), the
// same numbers the pricing page shows, so a price change can never leave a
// comparison page quoting the old figure. Each competitor's side is a dated
// snapshot of what that competitor itself publishes. It cannot be read live,
// so the date is published next to it, and it is the thing to re-check before
// editing. A competitor figure is recorded only when it was read first-hand
// from the competitor's own page; a figure from a review site or an app store
// listing does not qualify.
//
// Content names a price with a token that is filled at render:
//
//   {{zgx:basic:annual}}             "$199"      billed per period
//   {{zgx:basic:annual:mo}}          "$16.58"    the same, per month
//   {{bullflow:premium:annual}}      "$708"      the yearly total
//   {{bullflow:premium:annual:mo}}   "$59"       the yearly plan, per month
//   {{quantdata:api:monthly}}        "$149.99"
//   {{menthorq:pro:firstMonth}}      "$174.50"   a discounted first month
//   {{tradegex:platform:sixMonths}}  "$299"      billed every six months
//   {{bullflow:checked}}             "September 29, 2026"
//
// An unknown or malformed token throws, so a typo fails
// tests/comparisonPrices.test.ts instead of reaching a reader as literal
// braces. So does a token for a figure the competitor did not publish, such
// as the yearly total of a plan it quotes only per month.
//
// Pure: no DB, no env, no `server-only`, so node --test can import it.

import {
  LIST_PRICE_USD,
  formatPerMonthUsd,
  isBillableTier,
  perMonthEquivalentUsd,
} from './billingPlans.ts';

export type ComparedCadence = 'monthly' | 'annual';

// One plan as its vendor states it. `annual` is the yearly total and
// `annualPerMonth` the per-month rate on yearly billing. Record only what the
// source says. The per-month rate is derived from the total when only the total
// is known; when the vendor states both, both are kept as it prints them, since
// a vendor may round the monthly figure ($1,499.99 a year shown as $124.99 a
// month) and the page should match what readers see on the vendor's site.
export type CompetitorPlanPrice = {
  monthly: number;
  annual?: number;
  annualPerMonth?: number;
  // The price of the first month on the monthly plan, when the vendor
  // discounts it. `monthly` stays the regular list price every later month.
  firstMonth?: number;
  // The single charge for a plan billed every six months, when the vendor
  // sells one. ZeroGEX has no six-month plan, so it has no counterpart.
  sixMonths?: number;
};

export type CompetitorPrices = {
  // The ISO date the figures were last read from `source`.
  checked: string;
  source: string;
  plans: Record<string, CompetitorPlanPrice>;
};

export const COMPETITOR_PRICES = {
  // List prices, before discounts and tax. The in-app price in Apple's App
  // Store is higher and is not what this compares.
  bullflow: {
    checked: '2026-09-29',
    source: 'https://www.bullflow.io/pricing',
    plans: {
      basic: { monthly: 39, annual: 396 },
      premium: { monthly: 69, annual: 708 },
      dataApi: { monthly: 129, annual: 1188 },
    },
  },
  // `platform` is the pricing section of quantdata.us: $74.99/mo billed
  // monthly, or $750 a year shown as $62.50/mo, both labeled "Non-professionals
  // only" with a 7-day free trial. Registered professionals are sent to a
  // separate Professional plan whose price that section does not show, so it
  // is not recorded. `api` is the API plan: $149.99/mo, or $1,499.99 a year
  // shown as $124.99/mo (the help center's GEX API quickstart, dated July 2,
  // 2026, gives the same two monthly figures). Yearly totals read first-hand
  // from quantdata.us on the date below.
  quantdata: {
    checked: '2026-09-30',
    source: 'https://quantdata.us/#pricing',
    plans: {
      platform: { monthly: 74.99, annual: 750, annualPerMonth: 62.5 },
      api: { monthly: 149.99, annual: 1499.99, annualPerMonth: 124.99 },
    },
  },
  // MenthorQ's pricing page, read first-hand on the date below. Monthly:
  // Premium $129/mo and Pro $349/mo, each with a discounted first month that
  // is applied automatically at checkout ($39 with code FIRST39, $174.50 with
  // FIRST50). Yearly: Premium $1,164 ($97/mo) and Pro $3,108 ($259/mo),
  // "Save 25% by paying yearly." Pro is everything in Premium plus coaching
  // (mentorship meetings, live trading sessions, a monthly strategy session),
  // not more data.
  menthorq: {
    checked: '2026-09-30',
    source: 'https://menthorq.com/pricing/',
    plans: {
      premium: { monthly: 129, firstMonth: 39, annual: 1164, annualPerMonth: 97 },
      pro: { monthly: 349, firstMonth: 174.5, annual: 3108, annualPerMonth: 259 },
    },
  },
  // TradeGEX's pricing section, read first-hand on the date below. It is a
  // section of the homepage: tradegex.pro/pricing is a 404, and the site's
  // Pricing link jumps to #pricing. One plan, "Full platform access", at
  // $59.99/mo billed monthly, $299 billed every six months, or $599 billed
  // yearly. The page prints no per-month figure for either longer plan, so
  // none is recorded. A 3-day free trial needs no card and does not convert to
  // a paid plan on its own.
  tradegex: {
    checked: '2026-10-09',
    source: 'https://tradegex.pro/#pricing',
    plans: {
      platform: { monthly: 59.99, sixMonths: 299, annual: 599 },
    },
  },
} satisfies Record<string, CompetitorPrices>;

export type CompetitorId = keyof typeof COMPETITOR_PRICES;

function isCompetitorId(value: string): value is CompetitorId {
  return Object.hasOwn(COMPETITOR_PRICES, value);
}

function isComparedCadence(value: string): value is ComparedCadence {
  return value === 'monthly' || value === 'annual';
}

// "2026-09-29" → "September 29, 2026". Read as a calendar date, never through
// the server's time zone.
export function formatCheckedDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// The date a competitor's figures were last checked, as the pages print it.
export function competitorCheckedLabel(id: CompetitorId): string {
  return formatCheckedDate(COMPETITOR_PRICES[id].checked);
}

// Whole dollars without cents ("$39", "$1,188"), anything else to the cent
// ("$16.58", "$149.99"), the way the vendors quote them.
function formatUsd(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded)
    ? `$${rounded.toLocaleString('en-US')}`
    : `$${rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function competitorAmount(plan: CompetitorPlanPrice, cadence: ComparedCadence, perMonth: boolean): number | null {
  if (cadence === 'monthly') return plan.monthly;
  if (!perMonth) return plan.annual ?? null;
  if (plan.annualPerMonth !== undefined) return plan.annualPerMonth;
  return plan.annual !== undefined ? plan.annual / 12 : null;
}

function resolveToken(body: string): string | null {
  const parts = body.split(':');
  if (parts.length === 2 && parts[1] === 'checked' && isCompetitorId(parts[0])) {
    return competitorCheckedLabel(parts[0]);
  }
  if (parts.length < 3 || parts.length > 4) return null;
  const [vendor, plan, cadence, unit] = parts;
  if (unit !== undefined && unit !== 'mo') return null;

  // A discounted first month and a six-month plan are competitor figures only,
  // and each is already the price of its own period, so neither takes `:mo`.
  if (cadence === 'firstMonth' || cadence === 'sixMonths') {
    if (unit !== undefined || !isCompetitorId(vendor)) return null;
    const plans: Record<string, CompetitorPlanPrice> = COMPETITOR_PRICES[vendor].plans;
    const amount = Object.hasOwn(plans, plan) ? plans[plan][cadence] : undefined;
    return amount === undefined ? null : formatUsd(amount);
  }

  if (!isComparedCadence(cadence)) return null;
  const perMonth = unit === 'mo';

  if (vendor === 'zgx') {
    if (!isBillableTier(plan)) return null;
    return perMonth
      ? formatPerMonthUsd(perMonthEquivalentUsd({ tier: plan, cadence }))
      : formatUsd(LIST_PRICE_USD[plan][cadence]);
  }
  if (isCompetitorId(vendor)) {
    const plans: Record<string, CompetitorPlanPrice> = COMPETITOR_PRICES[vendor].plans;
    if (!Object.hasOwn(plans, plan)) return null;
    const amount = competitorAmount(plans[plan], cadence, perMonth);
    return amount === null ? null : formatUsd(amount);
  }
  return null;
}

// Replaces every {{…}} in `content` with the price it names.
export function fillComparisonPrices(content: string): string {
  return content.replace(/\{\{([^{}]*)\}\}/g, (token, body: string) => {
    const value = resolveToken(body.trim());
    if (value === null) throw new Error(`fillComparisonPrices: unknown price token ${token}`);
    return value;
  });
}
