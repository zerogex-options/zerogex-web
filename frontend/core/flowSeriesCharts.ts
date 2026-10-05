/**
 * Pure, React-free derivations for the "Options Flow" chart — the net
 * call/put premium + net volume instrument that headlines /flow-analysis and,
 * as a widget, a member's custom board.
 *
 * These transforms are the single source of truth shared by the Flow Analysis
 * page and the "Options Flow" My Dashboard widget, so a chart added to a board
 * computes its rows identically to the same chart on the page. Kept free of
 * React and `window` so the contract can be exercised directly under the Node
 * test runner, like core/gexStrikeCharts.ts and core/chartSettings.ts.
 *
 * One raw feed drives everything here:
 *   • /api/flow/series → 5-minute bars (1-minute with timeframe=1min) whose
 *     fields are already the session cumulatives the chart plots (see
 *     hooks/useFlowSeries). Nothing in this module accumulates; the mappers
 *     are field renames and the aligners only decide which session slots
 *     carry a value.
 *
 * Net Directional Premium moved down here once a second page drew it: the
 * Hedging Flow page shows it in compact form under the Weather panel, and two
 * copies of the same running total is how two pages end up disagreeing about
 * one number on one day. Put/Call Ratio and Net Position are still page-only,
 * and should move the same way if anything else ever needs them. All of them
 * share the session timeline, the time labels and the date-marker helper below
 * so every chart lines up.
 *
 * Deliberately import-free (bar erased type-only imports), like the other core
 * modules the Node test runner exercises directly.
 */

// A row of the Options Flow chart. One 5-minute session slot; every value is a
// running session cumulative, or null for a slot with nothing to plot (before
// the first bar, or after the last one — see alignFlowSeriesToTimeline).
export interface FlowTimeseriesRow {
  timestamp: string;
  time: string;
  callPremium: number | null;
  putPremium: number | null;
  netVolume: number | null;
  positiveNetVolume: number | null;
  negativeNetVolume: number | null;
  underlyingPrice: number | null;
}

/**
 * Which volume cumulative the bottom area plots: `directional` nets buys
 * against sells (net_volume_cum), `raw` plots total contracts traded
 * (raw_volume_cum).
 */
export type NetVolumeMode = 'raw' | 'directional';

/**
 * Control copy for each basis, shared by the chart's own selector and the
 * Flow Analysis page's control bar so the two can never drift.
 *
 * `raw` is deliberately NOT called "Raw Net": raw_volume_cum nets nothing. It
 * is every contract that changed hands — calls and puts, both sides of every
 * trade — so it is non-negative and only ever rises. Only `directional` is a
 * net, and only it can print below zero.
 */
export const NET_VOLUME_MODE_LABELS: Record<NetVolumeMode, string> = {
  directional: 'Directional',
  raw: 'Total Traded',
};

// The subset of a /api/flow/series row this module reads. Declared structurally
// rather than importing FlowSeriesPoint so the module stays free of the hooks
// layer (and of React) — a full FlowSeriesPoint satisfies it.
export type FlowSeriesRowLike = {
  timestamp: string;
  call_premium_cum: number;
  put_premium_cum: number;
  net_volume_cum: number;
  raw_volume_cum: number;
  underlying_price: number | null;
};

// ── Date / session helpers ────────────────────────────────────────────────────

/**
 * Round-trip a server ISO timestamp (`…00Z`) through `Date.toISOString()`
 * (`…00.000Z`) so chart-row keys match the session timeline built the same way.
 * Re-exported by hooks/useFlowSeries as `canonicalIso`, which is the name every
 * consumer of a FlowSeriesPoint already imports.
 */
export function canonicalTimestamp(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toISOString();
}

/** UTC ms for a given ET wall-clock time on `dateKey`, or null if unresolvable. */
export function getETTimeTimestamp(
  dateKey: string,
  etHour: number,
  etMinute: number,
): number | null {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return null;

  const etFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const candidateHours = Array.from(new Set([etHour + 4, etHour + 5])).filter(
    (h) => h >= 0 && h <= 23,
  );
  for (const utcHour of candidateHours) {
    const candidate = Date.UTC(y, m - 1, d, utcHour, etMinute);
    const parts = etFmt.formatToParts(new Date(candidate));
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
    const min = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
    if (h === etHour && min === etMinute) return candidate;
  }
  return null;
}

/**
 * Bar sizes /api/flow/series serves (its `timeframe` param). 5-minute is the
 * default everywhere; 1-minute carries the same session cumulatives, so a
 * 1-minute bar reads the same totals as the 5-minute bar it closes.
 */
export type FlowTimeframe = '5min' | '1min';

export const FLOW_TIMEFRAME_MINUTES: Record<FlowTimeframe, number> = {
  '5min': 5,
  '1min': 1,
};

/** Control copy for each bar size, shared by the page bar and the chart's own select. */
export const FLOW_TIMEFRAME_LABELS: Record<FlowTimeframe, string> = {
  '5min': '5 min',
  '1min': '1 min',
};

/**
 * Builds the ET session timeline for a trading date: 09:30 through 16:15 ET,
 * one slot every `stepMinutes`. The grid runs past the 16:00 bell because the
 * closing auction's prints land in the bars after it. Returns [] for a date
 * key the ET clock can't be resolved for, which callers treat as "no chart".
 *
 * The step must match the bar size of the rows aligned onto it: the aligners
 * match rows to slots by exact timestamp, so 1-minute rows on a 5-minute grid
 * would silently lose four bars in five.
 */
export function getSessionTimeline(dateKey: string, stepMinutes: number = 5): string[] {
  const openMs = getETTimeTimestamp(dateKey, 9, 30);
  const closeMs = getETTimeTimestamp(dateKey, 16, 15);
  if (openMs == null || closeMs == null || !(stepMinutes > 0)) return [];

  const timeline: string[] = [];
  for (let t = openMs; t <= closeMs; t += stepMinutes * 60_000) {
    timeline.push(new Date(t).toISOString());
  }
  return timeline;
}

/** The 5-minute session timeline: 82 slots, 09:30 through 16:15 ET. */
export function getFiveMinuteSessionTimeline(dateKey: string): string[] {
  return getSessionTimeline(dateKey, 5);
}

/**
 * Returns the millisecond timestamp of the latest row in `rows`, or -Infinity
 * if the array is empty. Used so alignment functions can tell "internal gap"
 * (carry-forward) slots apart from "trailing" (leave null) slots.
 */
export function latestRowMs<T extends { timestamp: string }>(rows: T[]): number {
  if (rows.length === 0) return -Infinity;
  const last = rows[rows.length - 1].timestamp;
  const ms = new Date(last).getTime();
  return Number.isFinite(ms) ? ms : -Infinity;
}

// ── Label helpers ─────────────────────────────────────────────────────────────

/** HH:MM in ET, or "--:--" for a missing / unparseable timestamp. */
export function safeTimeLabel(value?: string): string {
  if (!value) return '--:--';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '--:--'
    : d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'America/New_York',
      });
}

/** True when the timestamp falls on a :00 or :30 UTC minute boundary.
 *  Because ET market times are always at :30 offset (DST-safe), UTC :00/:30
 *  maps exactly to each half-hour boundary in ET. */
export function is30MinBoundary(ts: string): boolean {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return false;
  const m = d.getUTCMinutes();
  return m === 0 || m === 30;
}

/** True when `ts` lands on a whole hour. ET sits a whole number of hours off
 *  UTC, so a UTC :00 is an ET :00 (DST-safe without a zone lookup). */
export function isHourBoundary(ts: string): boolean {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return false;
  return d.getUTCMinutes() === 0;
}

const MAJOR_TICK_ET_HOURS = new Set([10, 12, 14, 16]);

/** True when `ts` lands exactly on 10:00, 12:00, 14:00, or 16:00 ET — used
 *  to thin an intraday axis down to a handful of major markers: always on the
 *  compact /flow-analysis charts, and on a phone anywhere half-hour labels
 *  overprint below ~500px of plot. DST-safe via Intl. */
export function isMajorTwoHourTick(ts: string): boolean {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return false;
  if (d.getUTCMinutes() !== 0) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    hour: '2-digit',
  }).formatToParts(d);
  const etHour = Number(parts.find((p) => p.type === 'hour')?.value);
  return MAJOR_TICK_ET_HOURS.has(etHour);
}

/** How often an intraday axis prints the clock. 120 is the phone rule: the
 *  major 10/12/14/16 ET marks only, because half-hour labels overprint below
 *  roughly 500px of plot. */
export type TimeTickEvery = 30 | 60 | 120;

/**
 * True when `ts` should carry a clock label at the requested cadence.
 *
 * Every cadence is a subset of the 30- and 60-minute gridline slots, so a
 * label always lands on a gridline; at 120 the hourly gridlines between the
 * labels stay unlabeled, which is a minor/major axis rather than a mismatch.
 */
export function onTimeTickGrid(ts: string, everyMinutes: TimeTickEvery): boolean {
  if (everyMinutes === 120) return isMajorTwoHourTick(ts);
  if (everyMinutes === 60) return isHourBoundary(ts);
  return is30MinBoundary(ts);
}

/**
 * Maps the index of the FIRST row of each calendar date to that date's label,
 * so a chart spanning more than one session can print the date under the time.
 */
export function getDateMarkerMeta(timestamps: string[]): Map<number, string> {
  const groups = new Map<string, { first: number; last: number }>();

  timestamps.forEach((ts, idx) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const current = groups.get(key);
    if (!current) groups.set(key, { first: idx, last: idx });
    else groups.set(key, { first: current.first, last: idx });
  });

  const indexToLabel = new Map<number, string>();
  groups.forEach((g, label) => {
    indexToLabel.set(g.first, label);
  });

  return indexToLabel;
}

// ── FlowSeriesPoint → chart row mapping ───────────────────────────────────────

export function mapSeriesToFlowTimeseries(
  rows: FlowSeriesRowLike[],
  mode: NetVolumeMode,
): FlowTimeseriesRow[] {
  return rows.map((r) => {
    const netVolume = mode === 'raw' ? r.raw_volume_cum : r.net_volume_cum;
    const timestamp = canonicalTimestamp(r.timestamp);
    return {
      timestamp,
      time: safeTimeLabel(timestamp),
      callPremium: r.call_premium_cum,
      putPremium: r.put_premium_cum,
      netVolume,
      positiveNetVolume: netVolume > 0 ? netVolume : 0,
      negativeNetVolume: netVolume < 0 ? netVolume : 0,
      underlyingPrice: r.underlying_price,
    };
  });
}

/**
 * Aligns a cumulative timeseries to the session timeline. The chart plots
 * running session totals, so a 5-minute bar with no reported API activity
 * should hold the previous cumulative value rather than punch a hole in the
 * line. We only leave nulls for slots *after* the last real bar so the curve
 * doesn't extrapolate into future market time.
 */
export function alignFlowSeriesToTimeline(
  rows: FlowTimeseriesRow[],
  timeline: string[],
): FlowTimeseriesRow[] {
  const byTs = new Map(rows.map((r) => [r.timestamp, r]));
  const lastMs = latestRowMs(rows);

  let prev: FlowTimeseriesRow | null = null;
  return timeline.map((timestamp) => {
    const exact = byTs.get(timestamp);
    if (exact) {
      prev = exact;
      return exact;
    }
    const ms = new Date(timestamp).getTime();
    if (prev && Number.isFinite(ms) && ms < lastMs) {
      const netVolume = prev.netVolume;
      return {
        timestamp,
        time: safeTimeLabel(timestamp),
        callPremium: prev.callPremium,
        putPremium: prev.putPremium,
        netVolume,
        positiveNetVolume: netVolume != null && netVolume > 0 ? netVolume : 0,
        negativeNetVolume: netVolume != null && netVolume < 0 ? netVolume : 0,
        underlyingPrice: prev.underlyingPrice,
      } satisfies FlowTimeseriesRow;
    }
    return {
      timestamp,
      time: safeTimeLabel(timestamp),
      callPremium: null,
      putPremium: null,
      netVolume: null,
      positiveNetVolume: null,
      negativeNetVolume: null,
      underlyingPrice: null,
    } satisfies FlowTimeseriesRow;
  });
}

const BAR_WINDOW_MS = 5 * 60_000;

/** True once a bar's window (`barMs`, 5 minutes unless given) has fully elapsed. */
export function isBarWindowComplete(
  timestamp: string,
  nowMs: number = Date.now(),
  barMs: number = BAR_WINDOW_MS,
): boolean {
  const ms = new Date(timestamp).getTime();
  if (!Number.isFinite(ms)) return true;
  return nowMs >= ms + barMs;
}

/**
 * The bar length a session timeline was built with: the gap between its first
 * two slots, or 5 minutes for a timeline too short to say. Lets a derivation
 * that is handed only the timeline size its bar window to match.
 */
export function timelineStepMs(timeline: string[]): number {
  if (timeline.length < 2) return BAR_WINDOW_MS;
  const step = new Date(timeline[1]).getTime() - new Date(timeline[0]).getTime();
  return Number.isFinite(step) && step > 0 ? step : BAR_WINDOW_MS;
}

/**
 * Blanks an all-zero bar whose window hasn't closed yet. The backend emits a
 * zeroed row the moment a bar opens, and plotting it drags every series to the
 * axis for the length of the bar; holding the previous value instead is what
 * the aligner does for every other quiet slot.
 */
export function maskIncompleteZeroFlowBars(
  rows: FlowTimeseriesRow[],
  nowMs: number = Date.now(),
  barMs: number = BAR_WINDOW_MS,
): FlowTimeseriesRow[] {
  return rows.map((row) => {
    if (
      row.callPremium === 0 &&
      row.putPremium === 0 &&
      row.netVolume === 0 &&
      !isBarWindowComplete(row.timestamp, nowMs, barMs)
    ) {
      return {
        ...row,
        callPremium: null,
        putPremium: null,
        netVolume: null,
        positiveNetVolume: null,
        negativeNetVolume: null,
      };
    }
    return row;
  });
}

/**
 * The whole Options Flow derivation in one call: /api/flow/series rows in,
 * timeline-aligned chart rows out. The page and the widget both go through
 * here, which is what keeps a board tile identical to the page chart.
 *
 * Returns [] when the session timeline can't be built (an unparseable date
 * key), so callers render their own "no data" state rather than a bare axis.
 */
export function optionsFlowSeries(
  rows: FlowSeriesRowLike[] | null | undefined,
  sessionTimeline: string[],
  mode: NetVolumeMode,
  nowMs: number = Date.now(),
): FlowTimeseriesRow[] {
  if (sessionTimeline.length === 0) return [];
  const base = mapSeriesToFlowTimeseries(rows ?? [], mode);
  const aligned = alignFlowSeriesToTimeline(base, sessionTimeline);
  return maskIncompleteZeroFlowBars(aligned, nowMs, timelineStepMs(sessionTimeline));
}

// ── Axis helpers ──────────────────────────────────────────────────────────────

/** Computes a clean axis step that gives roughly 6 ticks over the given range. */
export function getDynamicStep(min: number, max: number): number {
  const range = Math.max(1, Math.abs(max - min));
  const rawStep = range / 6;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let step: number;
  if (normalized < 1.5) step = 1 * magnitude;
  else if (normalized < 3.5) step = 2 * magnitude;
  else if (normalized < 7.5) step = 5 * magnitude;
  else step = 10 * magnitude;
  return Math.max(1, step);
}

export function roundToStep(value: number, step: number, mode: 'up' | 'down'): number {
  if (!Number.isFinite(value)) return 0;
  if (mode === 'down') return Math.floor(value / step) * step;
  return Math.ceil(value / step) * step;
}

/**
 * Generates an array of evenly-spaced, human-readable tick values spanning
 * [min, max]. Uses getDynamicStep to pick a clean interval.
 */
export function generateNiceTicks(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return [min];
  const step = getDynamicStep(min, max);
  const start = roundToStep(min, step, 'down');
  const ticks: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t = parseFloat((start + i * step).toPrecision(12));
    ticks.push(t);
    if (t >= max) break;
  }
  return ticks;
}

/** Padded [min, max] price domain for the underlying line, or auto when empty. */
export function getUnderlyingDomain(
  rows: FlowTimeseriesRow[],
): readonly [number, number] | readonly ['auto', 'auto'] {
  const prices = rows
    .map((r) => r.underlyingPrice)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  if (prices.length === 0) return ['auto', 'auto'] as const;

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const span = Math.max(0.01, maxPrice - minPrice);
  const padding = span * 0.03;

  return [minPrice - padding, maxPrice + padding] as const;
}

/** Left gutter wide enough for the price axis labels the data actually needs. */
export function getDynamicLeftMargin(rows: FlowTimeseriesRow[]): number {
  const prices = rows
    .map((r) => r.underlyingPrice)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

  if (prices.length === 0) return 86;

  const maxAbs = Math.max(...prices.map((v) => Math.abs(v)));
  const digits = Math.max(3, Math.floor(Math.log10(Math.max(1, maxAbs))) + 1);
  return Math.max(86, Math.min(120, 52 + digits * 10));
}

// ── Net Directional Premium ───────────────────────────────────────────────────
//
// The session's running net call-minus-put premium, split into a positive and a
// negative series so the area can be filled on the correct side of zero.
//
// These lived on the Flow Analysis page while it was the only thing that drew
// them. The Hedging Flow page now shows the same chart in compact form, and two
// copies of "net directional premium" is how one page ends up disagreeing with
// another about the same number on the same day.

export interface NetDirectionalPremiumRow {
  timestamp: string;
  premium: number | null;
  positivePremium: number | null;
  negativePremium: number | null;
}

/**
 * The two fields this derivation reads, declared structurally like
 * FlowSeriesRowLike above so the module stays free of the hooks layer. A full
 * FlowSeriesPoint satisfies it.
 */
export type PremiumSeriesRowLike = {
  timestamp: string;
  net_premium_cum: number;
};

/** A field rename. Nothing accumulates here; net_premium_cum already has. */
export function mapSeriesToPremiumRows(rows: PremiumSeriesRowLike[]): NetDirectionalPremiumRow[] {
  return rows.map((r) => {
    const premium = r.net_premium_cum;
    return {
      timestamp: canonicalTimestamp(r.timestamp),
      premium,
      positivePremium: premium > 0 ? premium : null,
      negativePremium: premium < 0 ? premium : null,
    };
  });
}

/**
 * Onto the session grid, holding the previous cumulative through an internal
 * gap and leaving nulls after the last real bar. A running total should not
 * punch a hole in the line for a quiet five minutes, and it should not
 * extrapolate into market time that has not happened.
 */
export function alignPremiumToTimeline(
  rows: NetDirectionalPremiumRow[],
  timeline: string[],
): NetDirectionalPremiumRow[] {
  const byTs = new Map(rows.map((r) => [r.timestamp, r]));
  const lastMs = latestRowMs(rows);

  let prev: NetDirectionalPremiumRow | null = null;
  return timeline.map((timestamp) => {
    const exact = byTs.get(timestamp);
    if (exact) {
      prev = exact;
      return exact;
    }
    const ms = new Date(timestamp).getTime();
    if (prev && Number.isFinite(ms) && ms < lastMs) {
      const premium = prev.premium;
      return {
        timestamp,
        premium,
        positivePremium: premium != null && premium > 0 ? premium : null,
        negativePremium: premium != null && premium < 0 ? premium : null,
      };
    }
    return { timestamp, premium: null, positivePremium: null, negativePremium: null };
  });
}

/**
 * Inserts an interpolated zero-crossing row between any two adjacent rows whose
 * premium values straddle zero. Without it the positive and negative areas each
 * start or end at the bar boundary rather than at the actual crossing, which
 * renders as a visible step where the line crosses the axis.
 */
export function insertPremiumZeroCrossings(
  rows: NetDirectionalPremiumRow[],
): NetDirectionalPremiumRow[] {
  const result: NetDirectionalPremiumRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i];
    result.push(cur);
    const next = rows[i + 1];
    if (!next) continue;
    const a = cur.premium;
    const b = next.premium;
    if (a == null || b == null) continue;
    if ((a > 0 && b < 0) || (a < 0 && b > 0)) {
      const tA = new Date(cur.timestamp).getTime();
      const tB = new Date(next.timestamp).getTime();
      if (Number.isFinite(tA) && Number.isFinite(tB) && tB > tA) {
        const ratio = Math.abs(a) / (Math.abs(a) + Math.abs(b));
        const tCrossMs = tA + (tB - tA) * ratio;
        result.push({
          timestamp: new Date(tCrossMs).toISOString(),
          premium: 0,
          positivePremium: 0,
          negativePremium: 0,
        });
      }
    }
  }
  return result;
}

/** The whole Net Directional Premium derivation in one call. */
export function netDirectionalPremiumSeries(
  rows: PremiumSeriesRowLike[] | null | undefined,
  sessionTimeline: string[],
): NetDirectionalPremiumRow[] {
  if (sessionTimeline.length === 0) return [];
  return insertPremiumZeroCrossings(
    alignPremiumToTimeline(mapSeriesToPremiumRows(rows ?? []), sessionTimeline),
  );
}
