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
// `annualPerMonth` the per-month rate on yearly billing. Vendors usually state
// one or the other; record only what the source says, and the per-month rate is
// derived from the total when only the total is known.
export type CompetitorPlanPrice = {
  monthly: number;
  annual?: number;
  annualPerMonth?: number;
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
  // The API plan as Quant Data's help center states it: "Flat $149.99/mo
  // ($124.99 annual)", in an article dated July 2, 2026. Its platform
  // subscription is not recorded: it has not been read first-hand from its
  // pricing page. Add it here, with the date, once it has.
  quantdata: {
    checked: '2026-09-30',
    source:
      'https://help.quantdata.us/en/articles/15807345-gamma-exposure-gex-api-python-quickstart-dealer-positioning-guide',
    plans: {
      api: { monthly: 149.99, annualPerMonth: 124.99 },
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
