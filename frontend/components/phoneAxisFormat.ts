/**
 * Number formats for phone-width charts.
 *
 * A phone's value axis gets ~40px, not the 60–80px its desktop twin was sized
 * for, so "$135.0M" and "662.766" either clip or push the plot into a sliver.
 * These keep an axis label to 3–5 characters and a readout to one more digit
 * of precision. Desktop formatters are left as they were; callers switch on
 * their own phone flag.
 */

const trim = (v: number): string => (v >= 10 ? String(Math.round(v)) : String(parseFloat(v.toFixed(1))));

/** Axis money: sign first, at most one decimal and none past 10 —
 *  "$135M", "-$45M", "$2.5M", "$1.2B", "$250K". */
export function compactUsdTick(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}$${Math.round(abs / 1e3)}K`;
  return `${sign}$${Math.round(abs)}`;
}

/** Readout money, enough to compare two scrubbed points in a strip tooltip:
 *  "$98.4M", "-$4.2M", "$1.25B". */
export function compactUsdReadout(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

/**
 * Round ticks (1-2-5 steps) inside [lo, hi], about `count` of them — for an
 * axis whose domain is padded data (a price line), where Recharts would
 * otherwise tick the raw padded bounds ("655.134, 657.134, …").
 */
export function niceTicksWithin(lo: number, hi: number, count = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [];
  const raw = (hi - lo) / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi + step * 1e-9; t += step) {
    out.push(Number(t.toPrecision(12)));
  }
  return out;
}

/** Decimals a tick list needs to print distinctly: none for whole steps. */
export function tickDecimals(ticks: number[]): number {
  if (ticks.length < 2) return 0;
  const step = Math.abs(ticks[1] - ticks[0]);
  if (step >= 1) return 0;
  if (step >= 0.1) return 1;
  return 2;
}

/** Percent tick with only the decimals it needs — "1.5%", "2%", "0.25%". A
 *  0.5-step axis printed with no decimals labels two gridlines "1%". */
export function pctTick(v: number): string {
  return `${parseFloat(Number(v).toFixed(2))}%`;
}

/**
 * A round domain and its ticks for an axis with no domain of its own.
 *
 * The counterpart to niceTicksWithin. That one keeps a domain it was handed —
 * a deliberate clip, like the structure panel's quantile cap — and only labels
 * round values inside it. This one is for an axis whose bounds are nobody's
 * decision: it rounds the data extent OUTWARD to the tick step, so the domain
 * is guaranteed to contain every value plotted and no series can be clipped by
 * tidying the labels. Zero is always a tick, because the step divides it.
 *
 * Returns nulls for an empty or unusable extent, which the caller passes over
 * so Recharts keeps its own behavior.
 */
export function niceAxisAround(
  lo: number,
  hi: number,
  count = 5,
): { domain: [number, number]; ticks: number[] } | null {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return null;
  const span = hi - lo;
  if (span <= 0) return null;

  const raw = span / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag;

  const min = Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let t = min; t <= max + step * 1e-9; t += step) {
    ticks.push(Number(t.toPrecision(12)));
  }
  return { domain: [ticks[0], ticks[ticks.length - 1]], ticks };
}
