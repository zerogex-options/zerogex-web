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
 *   • /api/flow/series → 5-minute bars whose fields are already the session
 *     cumulatives the chart plots (see hooks/useFlowSeries). Nothing in this
 *     module accumulates; the mappers are field renames and the aligners only
 *     decide which session slots carry a value.
 *
 * The three compact charts further down the Flow Analysis page (Put/Call Ratio,
 * Net Directional Premium, Net Position) keep their own mappers on the page —
 * they are page-only — but share the session timeline, the time labels and the
 * date-marker helper below so every chart on that page lines up.
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
 * Which volume cumulative the net-volume area plots: `directional` nets buys
 * against sells (net_volume_cum), `raw` plots total contracts traded
 * (raw_volume_cum).
 */
export type NetVolumeMode = 'raw' | 'directional';

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
 * Builds the 5-minute ET session timeline for a trading date: 09:30 through
 * 16:15 ET, one slot every five minutes. The grid runs past the 16:00 bell
 * because the closing auction's prints land in the bars after it. Returns []
 * for a date key the ET clock can't be resolved for, which callers treat as
 * "no chart".
 */
export function getFiveMinuteSessionTimeline(dateKey: string): string[] {
  const openMs = getETTimeTimestamp(dateKey, 9, 30);
  const closeMs = getETTimeTimestamp(dateKey, 16, 15);
  if (openMs == null || closeMs == null) return [];

  const timeline: string[] = [];
  for (let t = openMs; t <= closeMs; t += 5 * 60_000) {
    timeline.push(new Date(t).toISOString());
  }
  return timeline;
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

/** True once a 5-minute bar's window has fully elapsed. */
export function isBarWindowComplete(timestamp: string, nowMs: number = Date.now()): boolean {
  const ms = new Date(timestamp).getTime();
  if (!Number.isFinite(ms)) return true;
  return nowMs >= ms + BAR_WINDOW_MS;
}

/**
 * Blanks an all-zero bar whose 5-minute window hasn't closed yet. The backend
 * emits a zeroed row the moment a bar opens, and plotting it drags every series
 * to the axis for the length of the bar; holding the previous value instead is
 * what the aligner does for every other quiet slot.
 */
export function maskIncompleteZeroFlowBars(
  rows: FlowTimeseriesRow[],
  nowMs: number = Date.now(),
): FlowTimeseriesRow[] {
  return rows.map((row) => {
    if (
      row.callPremium === 0 &&
      row.putPremium === 0 &&
      row.netVolume === 0 &&
      !isBarWindowComplete(row.timestamp, nowMs)
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
  return maskIncompleteZeroFlowBars(aligned, nowMs);
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
