'use client';

import { useMemo } from 'react';

import { useApiData } from '@/hooks/useApiData';
import { canonicalTimestamp } from '@/core/flowSeriesCharts';

/**
 * One 5-minute bar of estimated hedging pressure from GET /api/flow/hedging.
 *
 * Every `*_usd` value is USD of stock a delta-flat hedge implies, positive for
 * BUYING — the same sign convention and units as the Forced Flow engine, so
 * the modeled and estimated sources can sit on one axis without conversion.
 *
 * `call_flow_usd` / `put_flow_usd` split by which option type PRODUCED the
 * pressure, not by the direction of it. Customers selling puts push the net
 * positive and land in `put_flow_usd` — which is why the chart colours these
 * by contributed pressure rather than painting puts bearish.
 *
 * `net_flow_ma_usd` is null until the smoothing window fills, and
 * `classified_ratio` is the share of the bar's volume that carried an
 * aggressor classification. A low ratio means a thin sample behind that bar.
 */
export interface HedgingFlowBar {
  timestamp: string;
  bar_start: string;
  bar_end: string;
  call_flow_usd: number;
  put_flow_usd: number;
  net_flow_usd: number;
  net_flow_ma_usd: number | null;
  cum_call_usd: number;
  cum_put_usd: number;
  cum_net_usd: number;
  underlying_price: number | null;
  contract_count: number;
  classified_ratio: number | null;
  is_synthetic: boolean;
}

/**
 * A sign change in estimated hedging pressure.
 *
 * `kind: 'rate'` is the immediate push turning over, read off the smoothed
 * per-bar series — the frequent, actionable one. `kind: 'cumulative'` is the
 * session's whole lean crossing zero: rare, and context rather than a trigger.
 *
 * `magnitude_usd` is the SWING across zero, not the level at it (a series is
 * near zero at the moment it crosses zero, by definition), and `session_ratio`
 * scores that swing against the session's typical swing.
 */
export interface HedgingFlowFlip {
  bar_start: string;
  kind: 'rate' | 'cumulative';
  direction: 'to_buying' | 'to_selling';
  magnitude_usd: number;
  session_ratio: number;
  is_significant: boolean;
  underlying_price: number | null;
}

export interface HedgingFlowPayload {
  symbol: string;
  session: string;
  /** Always `aggressor_inferred` today — see `disclosure`. */
  basis: string;
  /**
   * The caveat this series ships with, authored server-side. Render it. The
   * estimate assumes the passive side of each classified print was a market
   * maker, which is unvalidated, and the terminology rules forbid any surface
   * presenting it as observed dealer flow.
   */
  disclosure: string;
  smoothing_bars: number;
  bars: HedgingFlowBar[];
  flips: HedgingFlowFlip[];
}

export interface UseHedgingFlowOptions {
  /** Expirations to include, ISO dates. Today's date alone isolates 0DTE. */
  expirations?: readonly string[];
  /** Trailing SMA length in 5-minute bars for the rate line and flip detection. */
  smoothing?: number;
  refreshMs?: number;
}

const DEFAULT_REFRESH_MS = 15_000;

function buildEndpoint(symbol: string, options: UseHedgingFlowOptions): string {
  const params = new URLSearchParams({ symbol });
  if (options.expirations && options.expirations.length > 0) {
    params.set('expirations', [...options.expirations].sort().join(','));
  }
  if (options.smoothing != null) {
    params.set('smoothing', String(options.smoothing));
  }
  return `/api/flow/hedging?${params.toString()}`;
}

/**
 * Estimated hedging pressure for a symbol's current session.
 *
 * Returns bars OLDEST-FIRST — the wire order is newest-first to match
 * /api/flow/series, but every consumer here is a chart, and charts read left
 * to right. Timestamps are canonicalised so rows key identically to the
 * Options Flow series and the two can be joined bar-for-bar.
 */
export function useHedgingFlow(symbol: string, options: UseHedgingFlowOptions = {}) {
  const { refreshMs = DEFAULT_REFRESH_MS } = options;
  const endpoint = buildEndpoint(symbol, options);

  const { data, loading, error, errorStatus, refetch } = useApiData<HedgingFlowPayload>(
    endpoint,
    { refreshInterval: refreshMs },
  );

  const payload = useMemo(() => {
    if (!data) return null;
    return {
      ...data,
      bars: [...(data.bars ?? [])]
        .map((bar) => ({ ...bar, timestamp: canonicalTimestamp(bar.timestamp) }))
        .reverse(),
      flips: (data.flips ?? []).map((flip) => ({
        ...flip,
        bar_start: canonicalTimestamp(flip.bar_start),
      })),
    } satisfies HedgingFlowPayload;
  }, [data]);

  return { data: payload, loading, error, errorStatus, refetch };
}

/** The most recent bar carrying real (non-carried-forward) flow, or null. */
export function latestRealBar(payload: HedgingFlowPayload | null): HedgingFlowBar | null {
  if (!payload || payload.bars.length === 0) return null;
  for (let i = payload.bars.length - 1; i >= 0; i--) {
    if (!payload.bars[i].is_synthetic) return payload.bars[i];
  }
  return payload.bars[payload.bars.length - 1];
}

/**
 * The most recent rate flip, which is what an alert badge should show.
 * Cumulative crossings are deliberately excluded: they describe the session's
 * lean rather than the current push, and conflating them would make the badge
 * mean two different things on different days.
 */
export function latestRateFlip(payload: HedgingFlowPayload | null): HedgingFlowFlip | null {
  if (!payload) return null;
  const rateFlips = payload.flips.filter((f) => f.kind === 'rate');
  return rateFlips.length > 0 ? rateFlips[rateFlips.length - 1] : null;
}
