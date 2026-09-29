// The prices quoted on the ZeroGEX-vs-competitor pages, in one place.
//
// ZeroGEX's side is read from the plan catalogue (core/billingPlans.ts), the
// same numbers the pricing page shows, so a price change can never leave a
// comparison page quoting the old figure. The competitor's side is a dated
// snapshot of its public pricing page. It cannot be read live, so the date is
// published next to it, and it is the thing to re-check before editing.
//
// Content names a price with a token that is filled at render:
//
//   {{zgx:basic:annual}}             "$199"    billed per period
//   {{zgx:basic:annual:mo}}          "$16.58"  the same, per month
//   {{bullflow:premium:annual}}      "$708"
//   {{bullflow:premium:annual:mo}}   "$59"
//   {{bullflow:checked}}             "September 29, 2026"
//
// An unknown or malformed token throws, so a typo fails
// tests/comparisonPrices.test.ts instead of reaching a reader as literal
// braces.
//
// Pure: no DB, no env, no `server-only`, so node --test can import it.

import {
  LIST_PRICE_USD,
  formatPerMonthUsd,
  isBillableTier,
  perMonthEquivalentUsd,
} from './billingPlans.ts';

// List prices from https://www.bullflow.io/pricing, before discounts and tax,
// as shown on the date below. The in-app price in Apple's App Store is higher
// and is not what this compares.
export const BULLFLOW_PRICES_CHECKED = '2026-09-29';

export type BullflowPlan = 'basic' | 'premium' | 'dataApi';
export type ComparedCadence = 'monthly' | 'annual';

export const BULLFLOW_LIST_PRICE_USD: Record<BullflowPlan, Record<ComparedCadence, number>> = {
  basic: { monthly: 39, annual: 396 },
  premium: { monthly: 69, annual: 708 },
  dataApi: { monthly: 129, annual: 1188 },
};

function isBullflowPlan(value: string): value is BullflowPlan {
  return value in BULLFLOW_LIST_PRICE_USD;
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

// Whole dollars without cents ("$39", "$1,188"), anything else to the cent
// ("$16.58"). Bullflow's page quotes whole dollars, and so does this.
function formatUsd(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded)
    ? `$${rounded.toLocaleString('en-US')}`
    : `$${rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function resolveToken(body: string): string | null {
  const parts = body.split(':');
  if (parts.length === 2 && parts[0] === 'bullflow' && parts[1] === 'checked') {
    return formatCheckedDate(BULLFLOW_PRICES_CHECKED);
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
  if (vendor === 'bullflow') {
    if (!isBullflowPlan(plan)) return null;
    const billed = BULLFLOW_LIST_PRICE_USD[plan][cadence];
    return formatUsd(perMonth && cadence === 'annual' ? billed / 12 : billed);
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
