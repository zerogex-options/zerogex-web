/**
 * The GEX heatmap's Dots view (components/GammaHeatmapCanvas.tsx).
 *
 * The Surface view smooths net GEX into a continuous field. Dots keeps every
 * strike and interval apart: one dot per strike per interval, its area the
 * size of the net GEX there and its color the sign, with price drawn as a line
 * through it. The heaviest strikes read at a glance, without decoding shades.
 * A refunded member named Quant Data's Interval Map, which works this way, as
 * the chart they preferred to ours.
 *
 * Dots shows a set number of strikes around price rather than a price range,
 * and only as many recent intervals as fit at a readable dot size.
 *
 * Pure: no React, no DOM.
 */

export const HEATMAP_VIEWS = ['surface', 'dots'] as const;
export type HeatmapView = (typeof HEATMAP_VIEWS)[number];

export const HEATMAP_VIEW_LABEL: Record<HeatmapView, string> = {
  surface: 'Surface',
  dots: 'Dots',
};

/** The view the chart has always had, so nobody's chart changes until they ask. */
export const DEFAULT_HEATMAP_VIEW: HeatmapView = 'surface';

export function isHeatmapView(value: unknown): value is HeatmapView {
  return typeof value === 'string' && (HEATMAP_VIEWS as readonly string[]).includes(value);
}

export const DOT_STRIKE_COUNTS = [10, 20, 40] as const;
export type DotStrikeCount = (typeof DOT_STRIKE_COUNTS)[number];
export const DEFAULT_DOT_STRIKES: DotStrikeCount = 20;

export function isDotStrikeCount(value: unknown): value is DotStrikeCount {
  return typeof value === 'number' && (DOT_STRIKE_COUNTS as readonly number[]).includes(value);
}

/**
 * Narrowest column, in CSS px, that holds a dot whose size can be read. The
 * chart keeps 90 intervals (180 with the prior session): a wide desktop plot
 * fits them all, a laptop the latest ~70 (about six hours at 5m), a phone the
 * latest ~25. The Surface view and the 15m interval still show the whole day.
 */
export const MIN_DOT_COLUMN_PX = 12;

/** Index of the first interval to draw: the most recent ones that fit. */
export function dotWindowStart(slotCount: number, plotWidth: number): number {
  const fit = Math.max(1, Math.floor(plotWidth / MIN_DOT_COLUMN_PX));
  return Math.max(0, slotCount - fit);
}

/**
 * The strikes to draw as rows, ascending: the `count` reported strikes nearest
 * the middle of the window's price range, widened where needed so the whole
 * price path stays inside the rows. With no price, the middle of the chain.
 */
export function pickDotRows(
  strikes: readonly number[],
  priceLow: number | null,
  priceHigh: number | null,
  count: number,
): number[] {
  const sorted = strikes.filter(Number.isFinite).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return [];
  const hasPrice = priceLow != null && priceHigh != null && Number.isFinite(priceLow) && Number.isFinite(priceHigh);
  const center = hasPrice ? (priceLow + priceHigh) / 2 : sorted[Math.floor((n - 1) / 2)];

  let nearest = 0;
  for (let i = 1; i < n; i++) {
    if (Math.abs(sorted[i] - center) < Math.abs(sorted[nearest] - center)) nearest = i;
  }
  let lo = nearest;
  let hi = nearest;
  while (hi - lo + 1 < Math.min(count, n)) {
    if (lo === 0) hi++;
    else if (hi === n - 1) lo--;
    else if (center - sorted[lo - 1] <= sorted[hi + 1] - center) lo--;
    else hi++;
  }
  if (hasPrice) {
    while (lo > 0 && sorted[lo] > priceLow) lo--;
    while (hi < n - 1 && sorted[hi] < priceHigh) hi++;
  }
  return sorted.slice(lo, hi + 1);
}

/** The usual gap between rows (the median), so one odd gap can't skew it. */
export function rowStep(rows: readonly number[]): number {
  const gaps: number[] = [];
  for (let i = 1; i < rows.length; i++) gaps.push(rows[i] - rows[i - 1]);
  if (gaps.length === 0) return 1;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)] || 1;
}

/** Price range for `rows`: half a step past each end row, so edge dots aren't cut in half. */
export function dotRowBounds(rows: readonly number[]): { yMin: number; yMax: number } {
  const half = rowStep(rows) / 2;
  return { yMin: rows[0] - half, yMax: rows[rows.length - 1] + half };
}

/** The row nearest `price`. */
export function nearestRow(rows: readonly number[], price: number): number {
  let best = rows[0];
  for (const r of rows) if (Math.abs(r - price) < Math.abs(best - price)) best = r;
  return best;
}

/**
 * Dot radius for `value`. Area grows with |value| / clip, capped at `maxR`;
 * any nonzero value keeps at least `minR`, so a quiet strike still shows as
 * a speck of its sign. Zero when there is no value to draw.
 */
export function dotRadius(value: number, clip: number, maxR: number, minR = 1.1): number {
  if (!Number.isFinite(value) || value === 0 || !(clip > 0) || !(maxR > 0)) return 0;
  const norm = Math.min(1, Math.abs(value) / clip);
  return Math.min(maxR, Math.max(minR, maxR * Math.sqrt(norm)));
}
