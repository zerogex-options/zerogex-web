/**
 * Exponential moving averages (EMAs) on the price chart.
 *
 * An EMA moves a fixed share of the way toward each new close: 2 / (length + 1)
 * of the gap. Recent closes count most, and older ones fade without ever
 * dropping out. The first value is the simple average of the first `length`
 * closes, which is how TradingView's ta.ema and most charting platforms seed
 * it, and nothing is drawn before that.
 *
 * Because of that seed, the line depends a little on where the history starts,
 * and the dependence shrinks by a factor of 1 - 2 / (length + 1) with every
 * bar. The chart keeps 400 candles for panning but loads up to 576, so the
 * older ones go in first as warm-up (emaWarmupCloses). Simulated on SPY-like
 * 5-minute bars, a 200 EMA started 576 candles back sits within about 4 cents
 * of one started years earlier; from 400 candles, about 11.
 *
 * Pure: no React, no DOM. The chart hands in closes and its own x / y mappers.
 */

/** Shortest and longest length the chart offers. A 200 EMA needs 200 candles to start. */
export const EMA_MIN_LENGTH = 2;
export const EMA_MAX_LENGTH = 200;

/** One of the chart's EMA lines: its length in candles, and whether it is drawn. */
export interface EmaLine {
  length: number;
  on: boolean;
}

/** The chart's three lines out of the box. */
export const EMA_DEFAULT_LINES: readonly EmaLine[] = Object.freeze([
  Object.freeze({ length: 13, on: true }),
  Object.freeze({ length: 40, on: true }),
  Object.freeze({ length: 200, on: true }),
]);

/** The weight each new close gets. */
export function emaAlpha(length: number): number {
  return 2 / (length + 1);
}

/**
 * The EMA at every close, aligned with `closes`: null until `length` closes
 * have been seen, then the simple average of those as the seed, then each new
 * close pulls the line `emaAlpha(length)` of the way toward it.
 *
 * A close that isn't a finite number is skipped: it doesn't count toward the
 * seed, and the line holds its last value across it.
 */
export function emaSeries(closes: readonly number[], length: number): Array<number | null> {
  const out: Array<number | null> = new Array(closes.length).fill(null);
  if (!Number.isInteger(length) || length < 1) return out;
  const alpha = emaAlpha(length);
  let seen = 0;
  let sum = 0;
  let ema: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    const c = closes[i];
    if (!Number.isFinite(c)) {
      out[i] = ema;
      continue;
    }
    if (ema == null) {
      seen += 1;
      sum += c;
      if (seen === length) ema = sum / length;
    } else {
      ema += alpha * (c - ema);
    }
    out[i] = ema;
  }
  return out;
}

/** One step: the EMA after `close`, from the value one bar before it. */
export function emaStep(prev: number, close: number, length: number): number {
  return prev + emaAlpha(length) * (close - prev);
}

/**
 * The warm-up: the close of every candle that starts before `beforeMs` (the
 * first candle the chart keeps), oldest first, built from the raw rows the way
 * the chart builds its own candles. A candle closes at its latest row.
 * `candleStart` maps a row's time to the start of the candle it belongs to.
 * Rows without a finite time or close are skipped.
 */
export function emaWarmupCloses(
  rows: ReadonlyArray<{ timestamp: string; close: number }>,
  beforeMs: number,
  candleStart: (ms: number) => number,
): number[] {
  const candles = new Map<number, { ms: number; close: number }>();
  for (const row of rows) {
    const ms = new Date(row.timestamp).getTime();
    if (!Number.isFinite(ms) || !Number.isFinite(row.close)) continue;
    const start = candleStart(ms);
    if (!(start < beforeMs)) continue;
    const cur = candles.get(start);
    if (!cur || ms >= cur.ms) candles.set(start, { ms, close: row.close });
  }
  return [...candles.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c.close);
}

/** SVG path data for one EMA through the bars, starting where it has a value. */
export function emaPath(
  values: readonly (number | null)[],
  xForIndex: (i: number) => number,
  yPrice: (p: number) => number,
): string {
  const parts: string[] = [];
  let drawing = false;
  values.forEach((v, i) => {
    if (v == null) {
      drawing = false;
      return;
    }
    parts.push(`${drawing ? 'L' : 'M'} ${xForIndex(i).toFixed(1)} ${yPrice(v).toFixed(1)}`);
    drawing = true;
  });
  return parts.join(' ');
}

/** Lowest and highest value across every line, for the price axis; null when there is none. */
export function emaRange(lines: ReadonlyArray<readonly (number | null)[]>): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const values of lines) {
    for (const v of values) {
      if (v == null) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

/**
 * A length the chart can draw: a whole number from EMA_MIN_LENGTH to
 * EMA_MAX_LENGTH. Anything else, including text, gives `fallback`.
 */
export function clampEmaLength(value: unknown, fallback: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(EMA_MAX_LENGTH, Math.max(EMA_MIN_LENGTH, Math.round(n)));
}

/**
 * The three lines from a saved blob. Each slot keeps whatever of its saved
 * length and switch is usable and falls back to the default for the rest, so a
 * blob from an older or newer build, or one edited by hand, can never break
 * the chart.
 */
export function parseEmaLines(raw: unknown): EmaLine[] {
  const saved = Array.isArray(raw) ? raw : [];
  return EMA_DEFAULT_LINES.map((def, i) => {
    const s = saved[i] as Partial<Record<keyof EmaLine, unknown>> | null | undefined;
    if (!s || typeof s !== 'object') return { ...def };
    return {
      length: clampEmaLength(s.length, def.length),
      on: typeof s.on === 'boolean' ? s.on : def.on,
    };
  });
}
