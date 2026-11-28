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
//   {{spotgamma:essential:annual}}   "$891"
//   {{volland:api:pack}}             "$500"      a block of API calls
//   {{bullflow:checked}}             "September 29, 2026"
//
// A translated page (zerogex-vs-bullflow.de.md, ...) carries the same tokens
// and is filled in its own language: "1.188 $" and "29. September 2026" in
// German, the way the translated articles write a dollar figure and a date.
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
import type { Locale } from './i18n/locales.ts';

// The number and date format of each page language.
const INTL_LOCALE: Record<Locale, string> = {
  en: 'en-US',
  it: 'it-IT',
  de: 'de-DE',
  es: 'es-ES',
  fr: 'fr-FR',
};

export type ComparedCadence = 'monthly' | 'annual';

// One plan as its vendor states it. `annual` is the yearly total and
// `annualPerMonth` the per-month rate on yearly billing. Record only what the
// source says. The per-month rate is derived from the total when only the total
// is known; when the vendor states both, both are kept as it prints them, since
// a vendor may round the monthly figure ($1,499.99 a year shown as $124.99 a
// month) and the page should match what readers see on the vendor's site.
export type CompetitorPlanPrice = {
  // Absent only for a product with no monthly price, such as a block of API
  // calls; a `monthly` token for it throws like any figure not published.
  monthly?: number;
  annual?: number;
  annualPerMonth?: number;
  // The price of the first month on the monthly plan, when the vendor
  // discounts it. `monthly` stays the regular list price every later month.
  firstMonth?: number;
  // The single charge for a plan billed every six months, when the vendor
  // sells one. ZeroGEX has no six-month plan, so it has no counterpart.
  sixMonths?: number;
  // The price of a fixed block of requests, as the vendor lists it ("2,000
  // Volland API Calls, $500"), when it states no billing period. Recorded as
  // a pack rather than as monthly so the page never claims a period the
  // vendor did not. ZeroGEX sells no packs, so it has no counterpart.
  pack?: number;
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
  // SpotGamma's prices as its own checkout forms charged them on the date
  // below, which is what a subscriber pays. The pricing grid at `source`
  // contradicted itself that day: Essential's "$99/mo" headline sat over a
  // "First month $25, then $129/mo" line, and Alpha's "$299/mo" over "First
  // month $49, then $249/mo", while the monthly order forms
  // (/register/daily-note-subscriber/ and /register/spotgamma-alpha/) charged
  // $99 and $299 up front and on renewal with no first-month discount. So no
  // `firstMonth` is recorded, and the page tells readers to check the current
  // offer. Yearly: Essential $891 and Alpha $2,691, the same on the grid and
  // the annual forms. The grid prints those as $74/mo and $224/mo, which is
  // not the yearly total divided by twelve, so only the totals are kept and
  // the page says "about". The Institutional plan is sold through sales and
  // is not compared.
  spotgamma: {
    checked: '2026-10-11',
    source: 'https://spotgamma.com/subscribe-to-spotgamma/',
    plans: {
      essential: { monthly: 99, annual: 891 },
      alpha: { monthly: 299, annual: 2691 },
    },
  },
  // Volland's pricing page, read first-hand on the date below: six tiers, each
  // a monthly price. Its help center says the plans are monthly only ("We do
  // not offer daily, weekly, yearly, etc. plans"), so no yearly figure exists
  // to record. Exposure charts start at Swing, the 0DTE widget and delta decay
  // at 0DTE, the /ES and /NQ futures at Universe. `api` is the one priced item
  // on vol.land/api, "2,000 Volland API Calls" for $500, sold only to
  // subscribers on 0DTE, Insight, Universe or Institutional; the page states
  // no billing period, so it is a pack. Enterprise API access shows no price
  // and is not recorded.
  volland: {
    checked: '2026-11-28',
    source: 'https://vol.land/pricing',
    plans: {
      volhacks: { monthly: 99 },
      swing: { monthly: 150 },
      zerodte: { monthly: 250 },
      insight: { monthly: 400 },
      universe: { monthly: 1000 },
      institutional: { monthly: 5000 },
      api: { pack: 500 },
    },
  },
  // Unusual Whales' pricing page, read first-hand on the date below, while a
  // Black Friday sale took 25% off a monthly plan's first three months. These
  // are the list prices the page printed beside the sale prices: what the
  // plans cost outside the sale and what a renewal charges. Dashboard & Tools:
  // Retail Basic (the GEX heatmap, no True GEX), Retail Pro (True GEX for SPX
  // every 10 minutes), Retail Max (every minute). `apiStarter` is the cheapest
  // API plan, API Options Starter, which the pricing FAQ says is data-only,
  // with no website or app; `bundleBasic` is the cheapest plan with both,
  // Bundle Basic (Retail Max, Predictions and API Basic). The page sells
  // yearly plans as well; their prices were not recorded that day, so the
  // comparison page quotes monthly list prices and sends readers to the
  // vendor for yearly. Business plans are sold to companies and not compared.
  unusualwhales: {
    checked: '2026-11-28',
    source: 'https://unusualwhales.com/pricing',
    plans: {
      basic: { monthly: 50 },
      pro: { monthly: 75 },
      max: { monthly: 120 },
      apiStarter: { monthly: 99 },
      bundleBasic: { monthly: 199 },
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

// "2026-09-29" → "September 29, 2026" ("29. September 2026" in German). Read as
// a calendar date, never through the server's time zone.
export function formatCheckedDate(iso: string, locale: Locale = 'en'): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString(INTL_LOCALE[locale], {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// The date a competitor's figures were last checked, as the pages print it.
export function competitorCheckedLabel(id: CompetitorId, locale: Locale = 'en'): string {
  return formatCheckedDate(COMPETITOR_PRICES[id].checked, locale);
}

// A dollar figure on a translated page: the amount in that language's number
// format, then the sign ("1.188 $", "16,58 $"), as the translated articles
// write one. Grouped from four digits on, like the prose around it.
function formatTranslatedUsd(amount: number, fractionDigits: number, locale: Locale): string {
  const number = amount.toLocaleString(INTL_LOCALE[locale], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: 'always',
  });
  return `${number}\u00a0$`;
}

// Whole dollars without cents ("$39", "$1,188"), anything else to the cent
// ("$16.58", "$149.99"), the way the vendors quote them.
function formatUsd(amount: number, locale: Locale): string {
  const rounded = Math.round(amount * 100) / 100;
  if (locale !== 'en') return formatTranslatedUsd(rounded, Number.isInteger(rounded) ? 0 : 2, locale);
  return Number.isInteger(rounded)
    ? `$${rounded.toLocaleString('en-US')}`
    : `$${rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function competitorAmount(plan: CompetitorPlanPrice, cadence: ComparedCadence, perMonth: boolean): number | null {
  if (cadence === 'monthly') return plan.monthly ?? null;
  if (!perMonth) return plan.annual ?? null;
  if (plan.annualPerMonth !== undefined) return plan.annualPerMonth;
  return plan.annual !== undefined ? plan.annual / 12 : null;
}

function resolveToken(body: string, locale: Locale): string | null {
  const parts = body.split(':');
  if (parts.length === 2 && parts[1] === 'checked' && isCompetitorId(parts[0])) {
    return competitorCheckedLabel(parts[0], locale);
  }
  if (parts.length < 3 || parts.length > 4) return null;
  const [vendor, plan, cadence, unit] = parts;
  if (unit !== undefined && unit !== 'mo') return null;

  // A discounted first month, a six-month plan and a pack of requests are
  // competitor figures only, and each is already a single charge, so none
  // takes `:mo`.
  if (cadence === 'firstMonth' || cadence === 'sixMonths' || cadence === 'pack') {
    if (unit !== undefined || !isCompetitorId(vendor)) return null;
    const plans: Record<string, CompetitorPlanPrice> = COMPETITOR_PRICES[vendor].plans;
    const amount = Object.hasOwn(plans, plan) ? plans[plan][cadence] : undefined;
    return amount === undefined ? null : formatUsd(amount, locale);
  }

  if (!isComparedCadence(cadence)) return null;
  const perMonth = unit === 'mo';

  if (vendor === 'zgx') {
    if (!isBillableTier(plan)) return null;
    if (!perMonth) return formatUsd(LIST_PRICE_USD[plan][cadence], locale);
    // Always to the cent, as the pricing page prints a per-month figure.
    const amount = perMonthEquivalentUsd({ tier: plan, cadence });
    return locale === 'en' ? formatPerMonthUsd(amount) : formatTranslatedUsd(amount, 2, locale);
  }
  if (isCompetitorId(vendor)) {
    const plans: Record<string, CompetitorPlanPrice> = COMPETITOR_PRICES[vendor].plans;
    if (!Object.hasOwn(plans, plan)) return null;
    const amount = competitorAmount(plans[plan], cadence, perMonth);
    return amount === null ? null : formatUsd(amount, locale);
  }
  return null;
}

// Replaces every {{…}} in `content` with the price it names, formatted for the
// language the content is written in.
export function fillComparisonPrices(content: string, locale: Locale = 'en'): string {
  return content.replace(/\{\{([^{}]*)\}\}/g, (token, body: string) => {
    const value = resolveToken(body.trim(), locale);
    if (value === null) throw new Error(`fillComparisonPrices: unknown price token ${token}`);
    return value;
  });
}
