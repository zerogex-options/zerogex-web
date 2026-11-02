// Wire-shape normalisation for the two Hedging Flow series.
//
// The endpoints answer newest-first, matching every other series endpoint.
// Every consumer is a chart, and charts read left to right — so somebody has
// to reverse them, and somebody has to canonicalise the timestamps so a flow
// bar and a structure bar for the same five minutes key identically.
//
// That somebody used to be the hooks, which was fine while the only way to
// reach these series was a browser poll. The dated permalinks fetch them on
// the server instead, and a second copy of this reshaping would be a silent
// way for the live page and the historical one to disagree about which bar is
// which. Pure and React-free, like core/flowSeriesCharts.ts, so both sides of
// the RSC boundary can call it.

// Relative, with the extension, like every other sibling import in core/:
// the node --experimental-strip-types loader the test suite runs under does
// not resolve the `@/` alias, and a module the tests cannot import is a module
// the tests cannot check. The type imports below are erased, so they may keep
// the alias.
import { canonicalTimestamp, getSessionTimeline, type FlowTimeframe } from './flowSeriesCharts.ts';
import type { HedgingFlowPayload } from '@/hooks/useHedgingFlow';
import type { GammaRegimeSeriesPayload } from '@/hooks/useGammaRegimeSeries';

export interface HedgingFlowQuery {
  /** Expirations to include, ISO dates. The session's own date isolates 0DTE. */
  expirations?: readonly string[];
  /** Trailing SMA length in bars of `timeframe`. Omitted, the API uses 15 minutes. */
  smoothing?: number;
  /** An explicit ET trading day, `YYYY-MM-DD`, for a historical session. */
  date?: string;
  /** Bar size. Omitted or '5min', the request is the 5-minute one it has always been. */
  timeframe?: FlowTimeframe;
}

/** The /api/flow/hedging request for one symbol. */
export function hedgingFlowEndpoint(symbol: string, query: HedgingFlowQuery = {}): string {
  const params = new URLSearchParams({ symbol });
  if (query.date) {
    params.set('date', query.date);
  }
  if (query.expirations && query.expirations.length > 0) {
    params.set('expirations', [...query.expirations].sort().join(','));
  }
  if (query.timeframe === '1min') {
    params.set('timeframe', '1min');
  }
  if (query.smoothing != null) {
    params.set('smoothing', String(query.smoothing));
  }
  return `/api/flow/hedging?${params.toString()}`;
}

/**
 * Minutes per bar in a payload. The API names its `timeframe`; a payload from
 * before it did is 5-minute, which is all the API served then.
 */
export function hedgingFlowBarMinutes(payload: Pick<HedgingFlowPayload, 'timeframe'> | null | undefined): number {
  return payload?.timeframe === '1min' ? 1 : 5;
}

/**
 * The flow chart's grid for one bar size: a slot per bar start from 09:30 ET
 * through 16:15, the API's last bar on either size (82 or 406 slots).
 *
 * Both sizes end on the 16:15 bar because of how the structure chart under
 * the flow chart is drawn. It has lines only, so Recharts spaces its 82 bars
 * as points from edge to edge: 09:30 at the left of the plot, 16:15 at the
 * right. A 1-minute grid over the same 09:30 to 16:15 lands every minute
 * within about a pixel of that chart's time for it. Running the minutes on to
 * 16:19, to cover the 16:15 bar's full five minutes, measured 9px off by the
 * close in a browser, about four and a half minutes against the time axis.
 */
export function hedgingFlowTimeline(dateKey: string, barMinutes: number): string[] {
  return getSessionTimeline(dateKey, barMinutes);
}

/**
 * Index of the slot whose bar contains `label`: the last slot starting at or
 * before it. -1 when `label` is before the first slot or does not parse.
 *
 * This is what lets a 1-minute chart and a 5-minute one share a crosshair. A
 * 5-minute label is itself a minute, so the 1-minute chart lands on that
 * minute exactly; a 1-minute label such as 10:03 lands the 5-minute chart on
 * the 10:00 bar that contains it. On two grids of one bar size it is an exact
 * match, the same answer as matching by position.
 */
export function barIndexAt(slots: readonly string[], label: string | null | undefined): number {
  if (!label) return -1;
  const target = Date.parse(label);
  if (Number.isNaN(target)) return -1;
  let lo = 0;
  let hi = slots.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (Date.parse(slots[mid]) <= target) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

/** Oldest-first bars with canonical timestamps, or null for a null payload. */
export function normalizeHedgingFlow(
  data: HedgingFlowPayload | null | undefined,
): HedgingFlowPayload | null {
  if (!data) return null;
  return {
    ...data,
    bars: [...(data.bars ?? [])]
      .map((bar) => ({ ...bar, timestamp: canonicalTimestamp(bar.timestamp) }))
      .reverse(),
    // Flips are not reversed: they are events keyed by bar, not a series, and
    // `latestRateFlip` reads the LAST one — which the wire already orders
    // oldest-first within its own array.
    flips: (data.flips ?? []).map((flip) => ({
      ...flip,
      bar_start: canonicalTimestamp(flip.bar_start),
    })),
  } satisfies HedgingFlowPayload;
}

/** The structure series, reshaped to share the flow series' axis exactly. */
export function normalizeGammaRegime(
  data: GammaRegimeSeriesPayload | null | undefined,
): GammaRegimeSeriesPayload | null {
  if (!data) return null;
  return {
    ...data,
    bars: [...(data.bars ?? [])]
      .map((bar) => ({ ...bar, timestamp: canonicalTimestamp(bar.timestamp) }))
      .reverse(),
  } satisfies GammaRegimeSeriesPayload;
}
