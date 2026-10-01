// The quarter's gross subscription revenue and the Folds of Honor donation it
// owes, computed from Stripe invoices over the ordinary (free) API. Replaces the
// Stripe Sigma query the quarterly reminder used to hand the operator: Sigma is
// a paid add-on, and the list-invoices endpoint answers the same question.
//
// Kept PURE (no Stripe import, structural reads only) so the tally is
// unit-tested without a network, same discipline as core/stripeInvoice.ts.
//
// What counts, matching the public pledge on /giving ("3% of gross
// subscription revenue, before taxes and payment-processing fees"):
//
//   * an invoice with status=paid whose PAID instant falls inside the quarter
//     (UTC), so a renewal created on Sep 30 and paid Oct 1 lands in the quarter
//     the money moved in;
//   * that bills a subscription: new, renewal, and the prorated charge for a
//     mid-period upgrade (billing_reason subscription_update) alike;
//   * at amount_paid, which is what the customer was actually charged. Stripe's
//     fee is not subtracted, and refunds are reported beside the total rather
//     than netted out of it.
//
// Anything else paid in the window is counted under `excluded` so nothing is
// silently dropped.

import { readInvoicePaidAtUnix, readInvoiceRefundedAmount, readInvoiceSubscriptionId } from './stripeInvoice.ts';

export type Quarter = {
  label: string; // "Q3 2026"
  startIso: string; // "2026-07-01"
  endIso: string; // "2026-09-30" (last day, inclusive)
  startUnix: number; // 2026-07-01T00:00:00Z
  endUnixExclusive: number; // 2026-10-01T00:00:00Z
};

function quarterOf(year: number, quarterZeroBased: number): Quarter {
  const startMonth = quarterZeroBased * 3;
  const start = Date.UTC(year, startMonth, 1);
  const nextStart = Date.UTC(year, startMonth + 3, 1);
  const lastDay = Date.UTC(year, startMonth + 3, 0);
  return {
    label: `Q${quarterZeroBased + 1} ${year}`,
    startIso: new Date(start).toISOString().slice(0, 10),
    endIso: new Date(lastDay).toISOString().slice(0, 10),
    startUnix: start / 1000,
    endUnixExclusive: nextStart / 1000,
  };
}

// The calendar quarter that most recently CLOSED relative to `now`: on
// 2026-10-05 that is Q3 2026, on 2027-01-05 it is Q4 2026.
export function closingQuarterFor(now: Date): Quarter {
  const current = Math.floor(now.getUTCMonth() / 3);
  return current === 0
    ? quarterOf(now.getUTCFullYear() - 1, 3)
    : quarterOf(now.getUTCFullYear(), current - 1);
}

export function parseQuarterLabel(label: string): Quarter {
  const m = /^Q([1-4])\s+(\d{4})$/.exec(label.trim());
  if (!m) throw new Error(`Invalid quarter "${label}". Expected a label like "Q3 2026".`);
  return quarterOf(Number(m[2]), Number(m[1]) - 1);
}

export type ReasonLine = { reason: string; count: number; cents: number };

export type QuarterRevenue = {
  quarter: Quarter;
  pledgePct: number;
  // What the donation is computed on.
  grossCents: number;
  invoiceCount: number;
  byReason: ReasonLine[];
  // Informational, already INSIDE grossCents. Not subtracted.
  taxCents: number;
  refundedCents: number;
  refundUnknownCount: number; // invoices whose refund state could not be read
  // Paid in the window but not subscription billing (e.g. a one-off invoice).
  excluded: { count: number; cents: number };
  // Paid in a currency other than USD. Kept out of grossCents, never converted.
  nonUsd: { count: number; currencies: string[] };
  // pledgePct of grossCents, rounded UP to the cent so the pledge is never
  // shorted by rounding.
  donationCents: number;
};

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function sumAmounts(list: unknown): number | null {
  if (!Array.isArray(list)) return null;
  let total = 0;
  for (const entry of list) total += num(obj(entry)?.amount) ?? 0;
  return total;
}

// Sales tax collected on the invoice. acacia: `tax` (or `total_tax_amounts`);
// basil and later: `total_taxes`.
function readInvoiceTaxCents(inv: Record<string, unknown>): number {
  return num(inv.tax) ?? sumAmounts(inv.total_taxes) ?? sumAmounts(inv.total_tax_amounts) ?? 0;
}

function isSubscriptionBilling(inv: Record<string, unknown>): boolean {
  const reason = typeof inv.billing_reason === 'string' ? inv.billing_reason : '';
  return reason.startsWith('subscription') || readInvoiceSubscriptionId(inv) != null;
}

export function donationCentsFor(grossCents: number, pledgePct: number): number {
  // Whole basis points keep the multiply in integers, so an exact cent amount
  // is not nudged up a cent by floating-point noise.
  const basisPoints = Math.round(pledgePct * 100);
  return Math.ceil((grossCents * basisPoints) / 10_000);
}

export function tallyQuarterRevenue(
  invoices: Iterable<unknown>,
  quarter: Quarter,
  pledgePct: number,
): QuarterRevenue {
  const reasons = new Map<string, ReasonLine>();
  const nonUsdCurrencies = new Set<string>();
  const result: QuarterRevenue = {
    quarter,
    pledgePct,
    grossCents: 0,
    invoiceCount: 0,
    byReason: [],
    taxCents: 0,
    refundedCents: 0,
    refundUnknownCount: 0,
    excluded: { count: 0, cents: 0 },
    nonUsd: { count: 0, currencies: [] },
    donationCents: 0,
  };

  for (const raw of invoices) {
    const inv = obj(raw);
    if (!inv || inv.status !== 'paid') continue;
    const amountPaid = num(inv.amount_paid) ?? 0;
    if (amountPaid <= 0) continue; // a fully discounted period: no money moved

    const paidAt = readInvoicePaidAtUnix(inv);
    if (paidAt == null || paidAt < quarter.startUnix || paidAt >= quarter.endUnixExclusive) continue;

    const currency = typeof inv.currency === 'string' ? inv.currency.toLowerCase() : '';
    if (currency !== 'usd') {
      result.nonUsd.count += 1;
      nonUsdCurrencies.add(currency || 'unknown');
      continue;
    }

    if (!isSubscriptionBilling(inv)) {
      result.excluded.count += 1;
      result.excluded.cents += amountPaid;
      continue;
    }

    result.invoiceCount += 1;
    result.grossCents += amountPaid;
    result.taxCents += readInvoiceTaxCents(inv);

    const refunded = readInvoiceRefundedAmount(inv);
    if (refunded == null) result.refundUnknownCount += 1;
    else result.refundedCents += Math.min(refunded, amountPaid);

    const reason = typeof inv.billing_reason === 'string' && inv.billing_reason ? inv.billing_reason : 'unknown';
    const line = reasons.get(reason) ?? { reason, count: 0, cents: 0 };
    line.count += 1;
    line.cents += amountPaid;
    reasons.set(reason, line);
  }

  result.byReason = [...reasons.values()].sort((a, b) => b.cents - a.cents);
  result.nonUsd.currencies = [...nonUsdCurrencies].sort();
  result.donationCents = donationCentsFor(result.grossCents, pledgePct);
  return result;
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

// The plain-text breakdown, shared by `make foh-revenue` and the reminder email
// so both say exactly the same thing.
export function formatQuarterRevenue(r: QuarterRevenue): string[] {
  const lines = [
    `${r.quarter.label} (${r.quarter.startIso} to ${r.quarter.endIso}, UTC)`,
    ``,
    `  Gross subscription revenue:  ${formatCents(r.grossCents)}  (${r.invoiceCount} paid invoice${r.invoiceCount === 1 ? '' : 's'})`,
  ];
  for (const line of r.byReason) {
    lines.push(`    ${line.reason.padEnd(26)} ${String(line.count).padStart(4)}   ${formatCents(line.cents)}`);
  }
  if (r.taxCents > 0) lines.push(`  Includes sales tax:          ${formatCents(r.taxCents)}`);
  if (r.refundedCents > 0) lines.push(`  Later refunded (not subtracted): ${formatCents(r.refundedCents)}`);
  if (r.refundUnknownCount > 0) {
    lines.push(`  Refund state unreadable on ${r.refundUnknownCount} invoice(s); check them in the Dashboard.`);
  }
  if (r.excluded.count > 0) {
    lines.push(`  Not counted (paid, but not subscription billing): ${r.excluded.count} invoice(s), ${formatCents(r.excluded.cents)}`);
  }
  if (r.nonUsd.count > 0) {
    lines.push(`  Not counted (non-USD: ${r.nonUsd.currencies.join(', ')}): ${r.nonUsd.count} invoice(s)`);
  }
  lines.push(``);
  lines.push(`  Donation (${r.pledgePct}%, rounded up to the cent): ${formatCents(r.donationCents)}`);
  return lines;
}
