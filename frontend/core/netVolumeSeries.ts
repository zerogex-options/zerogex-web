/**
 * Pure, React-free derivations for the Gamma Chart's net-cumulative volume
 * pane — the second way GammaTerminalChart can draw the VOLUME strip under the
 * candles.
 *
 * The default pane is one stacked column per bar: uptick volume in green over
 * downtick volume in red, each bar independent of the last. This module backs
 * the other reading: a running total of uptick MINUS downtick volume for a
 * SINGLE session — the most recent one in the series — drawn as an area that
 * sits above zero while buyers have led that session's tape and below it once
 * sellers have taken it back. Every bar before that session's open is flat
 * zero, so the pane reads as "this session so far" rather than a row of humps
 * from days that have already settled.
 * It is the same instrument the Options Flow chart's Directional net volume
 * draws (core/flowSeriesCharts), which is why both read the same way: green
 * above the line, red below, the color changing exactly where the curve
 * crosses zero — and, like it, both measure one session rather than a week.
 *
 * Kept free of React, `window` and the SVG geometry so the contract can be
 * exercised directly under the Node test runner, like core/flowSeriesCharts.ts
 * and core/gexStrikeCharts.ts. Callers map `x` (a bar index, fractional at an
 * interpolated zero crossing) and `value` into pixels themselves.
 */

import { etDateKeyFor, isFuturesTicker } from './utils.ts';

/** The subset of a chart bar this module reads. A full Bar satisfies it. */
export interface UpDownVolumeBar {
  timestamp: string;
  upVolume: number;
  downVolume: number;
}

/** Which way GammaTerminalChart draws its volume pane. */
export type VolumeMode = 'updown' | 'net';

/** Control copy, shared by the selector and the pane's own heading. */
export const VOLUME_MODE_LABELS: Record<VolumeMode, string> = {
  updown: 'Up/Down',
  net: 'Cumulative',
};

// ET wall-clock minutes past midnight, used only to place the futures session
// open. `hourCycle: 'h23'` is load-bearing: en-US with `hour12: false` renders
// midnight as "24", which would push every 00:00 ET bar into the NEXT session.
const ET_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** CME equity-index futures reopen at 18:00 ET into the next trade date. */
const FUTURES_SESSION_OPEN_MINUTES = 18 * 60;

/** The calendar day after a YYYY-MM-DD key, in the same format. */
function nextDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return key;
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * The trading session a bar belongs to, as a date key — the partition
 * `cumulativeNetVolume` and the chart's own day separators both read.
 *
 * Cash symbols (SPX, SPY, …) key on the ET calendar date: their tape starts in
 * the morning and is done by the evening, so the date IS the session. ES / NQ
 * do not — the CME session opens at 18:00 ET and settles the FOLLOWING day, so
 * an overnight bar is keyed to the date it settles on. Without that, a futures
 * chart would reset its running total at midnight, in the middle of the very
 * session it is measuring.
 *
 * Returns '' for a timestamp that cannot be parsed, which callers treat the way
 * they treat any other distinct key: as its own session.
 */
export function tradingSessionKeyFor(timestamp: string, symbol?: string | null): string {
  const key = etDateKeyFor(timestamp);
  if (!key || !isFuturesTicker(symbol)) return key;
  const parts = ET_TIME_FORMATTER.formatToParts(new Date(timestamp));
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? NaN);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? NaN);
  const minutes = hour * 60 + minute;
  if (!Number.isFinite(minutes) || minutes < FUTURES_SESSION_OPEN_MINUTES) return key;
  return nextDateKey(key);
}

/**
 * Index of the first bar of the LAST session in the series — where the running
 * total starts, and the one break the area has to honor.
 *
 * "Last" is relative to the series it is handed, not to the wall clock: pass
 * the bars through the chart's right edge and it resolves the session that edge
 * sits in, so a rewound or panned-back view measures the session it is actually
 * showing rather than blanking because the live day is off screen.
 *
 * 0 for an empty series, and for one that never leaves a single session.
 */
export function lastSessionStartIndex(
  bars: readonly { timestamp: string }[],
  symbol?: string | null,
): number {
  if (bars.length === 0) return 0;
  const lastKey = tradingSessionKeyFor(bars[bars.length - 1].timestamp, symbol);
  for (let i = bars.length - 1; i >= 0; i--) {
    if (tradingSessionKeyFor(bars[i].timestamp, symbol) !== lastKey) return i + 1;
  }
  return 0;
}

/** How far back the running total reaches. */
export type CumulativeScope = 'session' | 'window';

/**
 * Running total of (upVolume − downVolume) through each bar, parallel to the
 * input.
 *
 * With the default `session` scope the total covers ONE session: it starts at
 * zero on the most recent session's first bar (`lastSessionStartIndex`) and
 * every bar before that open is exactly 0. An intraday chart spanning several
 * days therefore draws the live session's accumulation off a flat line, not a
 * hump per day — the reading is "where has this session's tape got to", and a
 * session that has already settled has nothing left to say about it. Zeroing
 * the prefix rather than dropping it keeps the result parallel to `bars`, so
 * callers index it by bar exactly as before, and it scales the pane to the
 * session on screen instead of to a bigger day beside it.
 *
 * `window` accumulates across the whole input with no reset — what daily
 * candles want, being one bar per session already.
 *
 * Non-finite volumes count as zero rather than poisoning the running total —
 * one bad bar from the feed must not blank the rest of the session.
 */
export function cumulativeNetVolume(
  bars: readonly UpDownVolumeBar[],
  opts: { scope?: CumulativeScope; symbol?: string | null } = {},
): number[] {
  const scope = opts.scope ?? 'session';
  const start = scope === 'session' ? lastSessionStartIndex(bars, opts.symbol) : 0;
  const out: number[] = bars.map(() => 0);
  let running = 0;
  for (let i = start; i < bars.length; i++) {
    const up = Number.isFinite(bars[i].upVolume) ? bars[i].upVolume : 0;
    const down = Number.isFinite(bars[i].downVolume) ? bars[i].downVolume : 0;
    running += up - down;
    out[i] = running;
  }
  return out;
}

/** One point of an area outline. `x` is a bar index, fractional at a crossing. */
export interface AreaPoint {
  x: number;
  value: number;
}

/** A run of the curve that stays on one side of zero. */
export interface AreaSegment {
  sign: 1 | -1;
  points: AreaPoint[];
}

/**
 * Split a value series into runs that never straddle zero, so an area chart
 * can fill green above the line and red below it with the color changing
 * exactly ON the axis rather than at the next bar.
 *
 * Where consecutive values have opposite signs the crossing is interpolated
 * and emitted as a zero-valued point ending one segment and starting the next,
 * so the two fills meet on the axis with no gap and no overlap. A value of
 * exactly zero is itself such a boundary. Segments are returned in bar order.
 *
 * `breaks` are indices at which a new run begins (a session open, typically
 * `lastSessionStartIndex`): no segment spans one, so the jump off zero at the
 * session's first bar is a break in the area, not a cliff drawn up from the
 * flat run before it. A single-bar run yields a one-point segment, which
 * callers draw as a column rather than a path — that is the shape of the first
 * bar of a session.
 */
export function signedAreaSegments(
  values: readonly number[],
  breaks: Iterable<number> = [],
): AreaSegment[] {
  const breakSet = new Set(breaks);
  const out: AreaSegment[] = [];
  let points: AreaPoint[] = [];
  let sign: 1 | -1 | 0 = 0;

  const flush = () => {
    if (sign !== 0 && points.length > 0) out.push({ sign, points });
    points = [];
    sign = 0;
  };

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (!Number.isFinite(value)) {
      flush();
      continue;
    }
    const isBreak = i > 0 && breakSet.has(i);
    if (isBreak) flush();

    const prev = i > 0 && !isBreak ? values[i - 1] : null;
    if (prev != null && Number.isFinite(prev) && ((prev > 0 && value < 0) || (prev < 0 && value > 0))) {
      // Straight-line crossing between the two bars: value = 0 at prev/(prev−v)
      // of the way across, which is where the fill must change color.
      const crossing: AreaPoint = { x: i - 1 + prev / (prev - value), value: 0 };
      points.push(crossing);
      flush();
      points.push(crossing);
    }

    const valueSign = value > 0 ? 1 : value < 0 ? -1 : 0;
    if (sign === 0 && valueSign !== 0) sign = valueSign;
    points.push({ x: i, value });

    // A bar sitting exactly on zero closes the run there; the next bar's sign
    // starts a fresh one from the same point.
    if (value === 0 && sign !== 0) {
      flush();
      points.push({ x: i, value: 0 });
    }
  }
  flush();
  return out;
}

/**
 * Map a net-cumulative series onto a pane, `top` and `bottom` being the pane's
 * y bounds in the caller's coordinate space (SVG y grows downward, so `top` is
 * the smaller number). Zero lands wherever the domain puts it: on the pane
 * floor for an all-positive session, part way up once the total has been
 * negative.
 */
export function netVolumeScale(
  values: readonly number[],
  opts: { top: number; bottom: number; padFraction?: number },
): { y: (value: number) => number; zeroY: number; min: number; max: number } {
  const { min, max } = netVolumeDomain(values, opts.padFraction);
  const y = (value: number) => opts.bottom - ((value - min) / (max - min)) * (opts.bottom - opts.top);
  return { y, zeroY: y(0), min, max };
}

/** The two paths one signed segment is drawn with. */
export interface AreaPath {
  sign: 1 | -1;
  /** Closed path: the curve, dropped to the zero line and back — the fill. */
  fill: string;
  /** Open path along the curve — the stroke on top. Empty for a single bar. */
  line: string;
}

/**
 * Turn signed segments into SVG path data: for each, the filled body between
 * the curve and the zero line, and the outline stroked over it.
 *
 * A single-bar run has no slope to draw, so it becomes a `columnWidth` column
 * standing on the zero line (and no outline) — which is what the first bar of
 * a session looks like before there is a second one to join it to.
 */
export function netVolumeAreaPaths(
  segments: readonly AreaSegment[],
  opts: {
    x: (index: number) => number;
    y: (value: number) => number;
    zeroY: number;
    columnWidth: number;
  },
): AreaPath[] {
  const round = (n: number) => n.toFixed(2);
  const zero = round(opts.zeroY);

  return segments.map(({ sign, points }) => {
    if (points.length < 2) {
      const center = opts.x(points[0].x);
      const left = round(center - opts.columnWidth / 2);
      const right = round(center + opts.columnWidth / 2);
      const top = round(opts.y(points[0].value));
      return { sign, fill: `M${left},${zero}L${right},${zero}L${right},${top}L${left},${top}Z`, line: '' };
    }
    const outline = points.map((p) => `${round(opts.x(p.x))},${round(opts.y(p.value))}`).join('L');
    const firstX = round(opts.x(points[0].x));
    const lastX = round(opts.x(points[points.length - 1].x));
    return { sign, fill: `M${outline}L${lastX},${zero}L${firstX},${zero}Z`, line: `M${outline}` };
  });
}

/**
 * Plot bounds for a net-cumulative series: always straddling zero (an area
 * measured from the axis has to show where the axis is), padded so the extreme
 * isn't clipped by its own stroke, and never collapsed to a zero-height range.
 * The zero side is left unpadded so an all-positive session sits on the floor
 * of the pane exactly the way the stacked columns do.
 */
export function netVolumeDomain(
  values: readonly number[],
  padFraction = 0.06,
): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const pad = (max - min) * padFraction;
  const padded = { min: min < 0 ? min - pad : 0, max: max > 0 ? max + pad : 0 };
  // Everything flat at zero (a session that hasn't traded, or a dead feed)
  // would divide by zero in the caller's scale; give it a nominal range.
  if (padded.max - padded.min < 1) return { min: padded.min, max: padded.min + 1 };
  return padded;
}
