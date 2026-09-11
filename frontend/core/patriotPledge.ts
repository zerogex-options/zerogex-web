// The September 11 25th-anniversary Folds of Honor drive.
//
// A one-time, time-boxed commitment that sits ON TOP of the standing 3% pledge
// (core/giving.ts, content/giving/totals.json):
//
//   • 25% off the first 12 months, every tier and cadence.
//   • 100% of the FIRST MONTH we actually collect from any subscription
//     started inside the window goes to Folds of Honor. Annual subscribers
//     fund the equivalent — one twelfth of their annual payment.
//
// The 100% supersedes the standing 3% for that first invoice only; from the
// second invoice onward those subscriptions fall back to the normal 3%. It is
// deliberately never additive — we don't donate 103% of anything.
//
// Pure module: no DB, no Stripe, no `server-only`, no env reads at import, so
// the ad copy, the /giving page, the tally script and the unit tests all agree
// on one set of numbers instead of each re-deriving them.

import type { BillableTier, BillingCadence } from '@/core/pricing';

// ── The window ────────────────────────────────────────────────────────────────
// Opens 00:00 ET on September 11, 2026 (the 25th anniversary) and closes at the
// end of Sunday, September 14 — Patriot Day weekend. September is EDT (UTC−4),
// so ET midnight is 04:00 UTC.
export const PATRIOT_PLEDGE_START_ISO = '2026-09-11T04:00:00.000Z';
export const PATRIOT_PLEDGE_END_ISO = '2026-09-15T03:59:59.999Z';

// Display labels, kept next to the ISO values so they cannot drift.
export const PATRIOT_PLEDGE_START_LABEL = 'September 11, 2026';
export const PATRIOT_PLEDGE_END_LABEL = 'September 14, 2026';
export const PATRIOT_PLEDGE_DEADLINE_LABEL = 'September 14, 11:59 PM ET';

// The attribution code the X ads and organic posts carry (`?ref=HONOR25`).
// Resolves to a Stripe coupon through the env-driven campaign system in
// core/campaigns.ts — STRIPE_CAMPAIGN_HONOR25_MONTHLY / _ANNUAL. Buyers who
// arrive without it still get the same rate from the site-wide promo window
// (PROMO_END_AT); the code exists so paid traffic is attributable.
export const PATRIOT_PLEDGE_CODE = 'HONOR25';

export const PATRIOT_PLEDGE_DISCOUNT_PCT = 25;
// Months the discount rides for a monthly subscriber. The annual coupon is
// `once` — one discounted year is the same 12 months of relief.
export const PATRIOT_PLEDGE_DISCOUNT_MONTHS = 12;
export const PATRIOT_PLEDGE_DONATION_PCT = 100;

// The standing pledge this one temporarily replaces, mirrored from
// content/giving/totals.json so copy can name both numbers in one breath.
export const STANDING_PLEDGE_PCT = 3;

export const PATRIOT_PLEDGE_PARTNER = 'Folds of Honor';

// One central gate, so every surface that mentions the drive — pricing banner,
// /giving, checkout, the tally script — flips together instead of each
// comparing `Date.now()` itself.
export function isPatriotPledgeOpen(now: number = Date.now()): boolean {
  const startMs = Date.parse(PATRIOT_PLEDGE_START_ISO);
  const endMs = Date.parse(PATRIOT_PLEDGE_END_ISO);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
  return now >= startMs && now <= endMs;
}

// Whether a subscription created at `startedAtMs` earned the 100% first-month
// donation. Keyed on when the SUBSCRIPTION started, not when its first invoice
// was collected: the default 7-day trial means a sub that signs up on the 11th
// is not charged until the 18th, well after the window shuts. Judging by the
// invoice date would silently drop every trialing signup — i.e. nearly all of
// them — out of the pledge we advertised.
export function qualifiesForPledge(startedAtMs: number): boolean {
  return isPatriotPledgeOpen(startedAtMs);
}

// ── Money ─────────────────────────────────────────────────────────────────────
// All amounts are USD cents (integers). Dollars-as-floats round badly once you
// take 25% off $199 and then divide by 12, and this arithmetic ends up in a
// public ledger and a check to a charity, so it stays in cents throughout.

function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

// List price in cents per (tier, cadence) — the pre-discount amount Stripe
// charges. Mirrors DEFAULT_AMOUNTS in core/pricing.ts, but as the real invoice
// amount rather than the monthly-normalized figure that module compares on.
export const LIST_PRICE_CENTS: Record<BillableTier, Record<BillingCadence, number>> = {
  basic: { monthly: 3_900, annual: 19_900 },
  pro: { monthly: 5_900, annual: 29_900 },
};

// What the subscriber actually pays on their first invoice, after the 25%.
export function discountedPriceCents(tier: BillableTier, cadence: BillingCadence): number {
  const list = LIST_PRICE_CENTS[tier][cadence];
  return roundHalfUp(list * (1 - PATRIOT_PLEDGE_DISCOUNT_PCT / 100));
}

// What Folds of Honor receives from one subscription's first collected invoice.
//
// Monthly: the whole thing — 100% of the first month.
// Annual:  one twelfth of the annual payment, the "equivalent" of that same
//          first month. The other eleven twelfths stay with the business and
//          continue to carry the standing 3%.
//
// Computed off the DISCOUNTED amount because that is what we actually collect;
// donating 100% of a list price we never charged would be a number we made up.
// Stripe's processing fee (~2.9% + 30¢) is NOT deducted — it comes out of our
// side, so the charity receives the full gross receipt.
export function pledgedDonationCents(
  tier: BillableTier,
  cadence: BillingCadence,
): number {
  const collected = discountedPriceCents(tier, cadence);
  if (cadence === 'annual') return roundHalfUp(collected / 12);
  return collected;
}

// Generic form for the tally script, which reads real collected amounts off
// Stripe invoices rather than assuming everyone paid list-minus-25. Handles
// partial/prorated invoices, a coupon that didn't attach, and comped rows.
export function donationFromCollectedCents(
  collectedCents: number,
  cadence: BillingCadence,
): number {
  if (!Number.isFinite(collectedCents) || collectedCents <= 0) return 0;
  const cents = Math.floor(collectedCents);
  if (cadence === 'annual') return roundHalfUp(cents / 12);
  return cents;
}

export type PledgeInvoice = {
  // Stripe invoice id, carried through so the published ledger is auditable
  // line by line rather than as one opaque total.
  invoiceId: string;
  cadence: BillingCadence;
  collectedCents: number;
};

export type PledgeTally = {
  invoiceCount: number;
  collectedCents: number;
  donationCents: number;
  // Per-invoice donations, rounded individually. Summing rounded lines (rather
  // than rounding one big sum) is what makes the ledger reconcile: every row
  // the receipt page shows adds up to exactly the amount we sent.
  lines: Array<PledgeInvoice & { donationCents: number }>;
};

// Total owed to Folds of Honor across every qualifying first invoice.
export function tallyPledge(invoices: ReadonlyArray<PledgeInvoice>): PledgeTally {
  const lines = invoices.map((inv) => ({
    ...inv,
    donationCents: donationFromCollectedCents(inv.collectedCents, inv.cadence),
  }));
  let collectedCents = 0;
  let donationCents = 0;
  for (const line of lines) {
    collectedCents += Math.max(0, Math.floor(line.collectedCents));
    donationCents += line.donationCents;
  }
  return { invoiceCount: lines.length, collectedCents, donationCents, lines };
}

export function formatUsdCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
