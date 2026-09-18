// WHEN a decline happened, and whether that is why it never recovered.
//
// The question this exists to answer. `insufficient_funds` is 63 of 122
// declined invoices and $2,177.50 of $3,525.50 never collected — 62% of the
// loss — and it is the one category no acceptance product can touch, because
// nothing Stripe does puts money into somebody's account. What CAN move it is
// timing: an off-session charge needs the balance to be there at that moment,
// so a retry that lands before payday fails for the same reason the original
// did, and a retry window that closes before payday never gets a chance at all.
//
// WHAT THIS CAN AND CANNOT SEE. We do not know when any member is paid. What we
// can observe is when the charge landed, how long Stripe kept trying, and
// whether the dates it tried on straddled the two days most payrolls cluster
// around. That makes the payday test a PROXY and the module says so everywhere
// it reports one — it is evidence for a hypothesis, never proof of a mechanism.
//
// Volumes here are small. Every rate carries a Wilson interval for the same
// reason the acquisition-source cut does: at n = 63 split three ways, a ranking
// of point estimates is mostly noise, and the intervals are what stop somebody
// acting on it.

import { wilsonInterval, type DeclinedInvoice } from './paymentDeclines.ts';

/** Days of the month payroll clusters on. A proxy, and the whole caveat. */
export const PAYDAY_PROXY_DAYS: readonly number[] = [1, 15];

/** "1" -> "1st". Only ever applied to PAYDAY_PROXY_DAYS, so it stays small. */
export function ordinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export type TimingBucket = {
  key: string;
  label: string;
  invoices: number;
  recovered: number;
  lost: number;
  open: number;
  amountLost: number;
  /** recovered ÷ (recovered + lost). Null until something has resolved. */
  recoveryRate: number | null;
  /** 95% Wilson interval on that rate. Null when nothing has resolved. */
  recoveryRateInterval: { low: number; high: number } | null;
};

function bucketOf(key: string, label: string, invoices: readonly DeclinedInvoice[]): TimingBucket {
  const recovered = invoices.filter((i) => i.outcome === 'recovered').length;
  const lost = invoices.filter((i) => i.outcome === 'lost').length;
  const open = invoices.filter((i) => i.outcome === 'open').length;
  const resolved = recovered + lost;
  return {
    key,
    label,
    invoices: invoices.length,
    recovered,
    lost,
    open,
    // Money once per invoice, and only where the money is actually gone.
    amountLost: invoices.filter((i) => i.outcome === 'lost').reduce((sum, i) => sum + i.amount, 0),
    recoveryRate: resolved > 0 ? recovered / resolved : null,
    recoveryRateInterval: resolved > 0 ? wilsonInterval(recovered, resolved) : null,
  };
}

/**
 * ET calendar parts for an instant.
 *
 * ET is the house clock everywhere else in this codebase, so it is the clock
 * here too. It is worth being explicit that this is a compromise: a charge at
 * 00:30 ET on the 1st is still the 31st for a member in California, and their
 * payday is in their timezone, not ours. At day-range granularity that moves a
 * handful of invoices at most, and there is no better answer available — we do
 * not know where anybody banks.
 */
function etParts(iso: string): { day: number; weekday: string } | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    day: 'numeric',
    weekday: 'short',
  }).formatToParts(new Date(ms));
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  if (!Number.isFinite(day) || !weekday) return null;
  return { day, weekday };
}

const DAY_RANGES: ReadonlyArray<{ key: string; label: string; from: number; to: number }> = [
  { key: '1-5', label: '1st – 5th', from: 1, to: 5 },
  { key: '6-10', label: '6th – 10th', from: 6, to: 10 },
  { key: '11-15', label: '11th – 15th', from: 11, to: 15 },
  { key: '16-20', label: '16th – 20th', from: 16, to: 20 },
  { key: '21-25', label: '21st – 25th', from: 21, to: 25 },
  { key: '26-31', label: '26th – end', from: 26, to: 31 },
];

/** Declines grouped by the day of the month the FIRST attempt landed on. */
export function byDayOfMonth(invoices: readonly DeclinedInvoice[]): TimingBucket[] {
  return DAY_RANGES.map((range) =>
    bucketOf(
      range.key,
      range.label,
      invoices.filter((invoice) => {
        const parts = etParts(invoice.first.failedAt);
        return parts != null && parts.day >= range.from && parts.day <= range.to;
      }),
    ),
  ).filter((bucket) => bucket.invoices > 0);
}

const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export function byWeekday(invoices: readonly DeclinedInvoice[]): TimingBucket[] {
  return WEEKDAY_ORDER.map((weekday) =>
    bucketOf(
      weekday,
      weekday,
      invoices.filter((invoice) => etParts(invoice.first.failedAt)?.weekday === weekday),
    ),
  ).filter((bucket) => bucket.invoices > 0);
}

/**
 * How long Stripe actually kept trying, per invoice: first recorded failure to
 * last recorded failure, in whole days.
 *
 * This is the OBSERVED window, not the configured one. An invoice that failed
 * once and was never retried reads as 0 days, which is the truth about what
 * happened to it even when the policy would have allowed more.
 */
export function retryWindowDays(invoice: DeclinedInvoice): number | null {
  const from = Date.parse(invoice.first.failedAt);
  const to = Date.parse(invoice.last.failedAt);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, Math.round((to - from) / 86_400_000));
}

export type RetryWindowStats = {
  invoices: number;
  medianDays: number | null;
  maxDays: number | null;
  /** Invoices Stripe never retried at all. */
  singleAttempt: number;
};

export function retryWindowStats(invoices: readonly DeclinedInvoice[]): RetryWindowStats {
  const spans = invoices
    .map(retryWindowDays)
    .filter((days): days is number => days != null)
    .sort((a, b) => a - b);
  return {
    invoices: invoices.length,
    medianDays: spans.length > 0 ? spans[Math.floor((spans.length - 1) / 2)] : null,
    maxDays: spans.length > 0 ? spans[spans.length - 1] : null,
    singleAttempt: invoices.filter((invoice) => invoice.attempts.length === 1).length,
  };
}

/**
 * Did the dates Stripe tried on include a day payroll clusters around?
 *
 * THE PROXY, stated plainly: if being short of money is the reason these fail,
 * an invoice whose retry window crossed a payday had a chance the others never
 * got, and should recover better. If it does not, the money was not the timing —
 * and extending the retry window would buy nothing.
 *
 * Walks the window a day at a time rather than comparing endpoints, because a
 * window from the 28th to the 3rd crosses the 1st without either end being near
 * it. Capped so a malformed pair cannot spin.
 */
export function windowCrossedPayday(invoice: DeclinedInvoice): boolean | null {
  const from = Date.parse(invoice.first.failedAt);
  const to = Date.parse(invoice.last.failedAt);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return null;
  const days = Math.min(Math.round((to - from) / 86_400_000), 120);
  for (let i = 0; i <= days; i += 1) {
    const at = etParts(new Date(from + i * 86_400_000).toISOString());
    if (at != null && PAYDAY_PROXY_DAYS.includes(at.day)) return true;
  }
  return false;
}

export function byPaydayCrossing(invoices: readonly DeclinedInvoice[]): TimingBucket[] {
  const crossed: DeclinedInvoice[] = [];
  const missed: DeclinedInvoice[] = [];
  for (const invoice of invoices) {
    const hit = windowCrossedPayday(invoice);
    if (hit === true) crossed.push(invoice);
    else if (hit === false) missed.push(invoice);
  }
  return [
    bucketOf('crossed', 'Retries spanned the 1st or the 15th', crossed),
    bucketOf('missed', 'Retries never reached one', missed),
  ].filter((bucket) => bucket.invoices > 0);
}
