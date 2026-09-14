/**
 * Pure, React-free derivations for the Gamma Chart's net-cumulative volume
 * pane — the second way GammaTerminalChart can draw the VOLUME strip under the
 * candles.
 *
 * The default pane is one stacked column per bar: uptick volume in green over
 * downtick volume in red, each bar independent of the last. This module backs
 * the other reading: a running session total of uptick MINUS downtick volume,
 * accumulated from the day's first bar, drawn as an area that sits above zero
 * while buyers have led the tape and below it once sellers have taken it back.
 * It is the same instrument the Options Flow chart's Directional net volume
 * draws (core/flowSeriesCharts), which is why both read the same way: green
 * above the line, red below, the color changing exactly where the curve
 * crosses zero.
 *
 * Kept free of React, `window` and the SVG geometry so the contract can be
 * exercised directly under the Node test runner, like core/flowSeriesCharts.ts
 * and core/gexStrikeCharts.ts. Callers map `x` (a bar index, fractional at an
 * interpolated zero crossing) and `value` into pixels themselves.
 */

import { etDateKeyFor } from './utils.ts';

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

/**
 * Indices at which a new ET trading day starts. Index 0 always qualifies for a
 * non-empty input (the first bar starts the first day). Partitioning is by ET
 * calendar date, the same key `cumulativeNetVolume` resets on, so a caller can
 * use these as the break points of the very series it accumulated.
 */
export function sessionStartIndices(bars: readonly { timestamp: string }[]): number[] {
  const starts: number[] = [];
  let prevKey: string | null = null;
  bars.forEach((bar, index) => {
    const key = etDateKeyFor(bar.timestamp);
    if (prevKey === null || key !== prevKey) starts.push(index);
    prevKey = key;
  });
  return starts;
}

/**
 * Running total of (upVolume − downVolume) through each bar, parallel to the
 * input.
 *
 * With `resetPerDay` (the default) the total restarts at zero on each ET
 * trading date, so an intraday chart spanning several sessions shows each
 * day's own accumulation rather than one line dragged across the week. Daily
 * candles are already one bar per session and pass `resetPerDay: false`, which
 * accumulates across the whole window.
 *
 * Non-finite volumes count as zero rather than poisoning the running total —
 * one bad bar from the feed must not blank the rest of the session.
 */
export function cumulativeNetVolume(
  bars: readonly UpDownVolumeBar[],
  opts: { resetPerDay?: boolean } = {},
): number[] {
  const resetPerDay = opts.resetPerDay ?? true;
  const out: number[] = [];
  let running = 0;
  let dayKey: string | null = null;
  for (const bar of bars) {
    if (resetPerDay) {
      const key = etDateKeyFor(bar.timestamp);
      if (dayKey !== null && key !== dayKey) running = 0;
      dayKey = key;
    }
    const up = Number.isFinite(bar.upVolume) ? bar.upVolume : 0;
    const down = Number.isFinite(bar.downVolume) ? bar.downVolume : 0;
    running += up - down;
    out.push(running);
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
 * `breaks` are indices at which a new run begins (day boundaries, typically
 * from `sessionStartIndices`): no segment spans one, so the reset at a session
 * start is a break in the area, not a cliff drawn across the day divider.
 * A single-bar run yields a one-point segment, which callers draw as a column
 * rather than a path — that is the shape of the first bar of a session.
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
