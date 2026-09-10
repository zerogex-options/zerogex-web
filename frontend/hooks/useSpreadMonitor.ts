'use client';

import { useApiData } from '@/hooks/useApiData';
import type {
  SpreadCompare,
  SpreadHistory,
  SpreadSeries,
  SpreadSnapshot,
} from '@/core/spreadMonitor';

/**
 * The four Spread Monitor reads, each on its own cadence.
 *
 * Splitting them is the point. The snapshot changes with every chain write
 * and is what the header cards read; the daily history changes once a
 * session. Polling them together would either re-fetch a quarter of daily
 * rollup rows every fifteen seconds or leave the live cards stale, and the
 * page needs neither.
 */

/** Live quote conditions: as fresh as the chain behind it. */
const SNAPSHOT_REFRESH_MS = 15_000;
/** The session shape only gains a point per bucket. */
const SERIES_REFRESH_MS = 60_000;
/** One row per session — nothing to gain from polling inside a day. */
const HISTORY_REFRESH_MS = 300_000;

export interface SpreadScopeOptions {
  /** Max days to expiration included in the measured chain. */
  dteMax?: number;
  /** Half-width of the strike band around spot, in percent. */
  moneynessBandPct?: number;
  /**
   * False stops the fetch entirely. Used for ES / NQ, which carry no option
   * chain here and which the API answers 400 for — a state the page can
   * recognise before asking, so it should not ask.
   */
  enabled?: boolean;
}

function scopeParams(options: SpreadScopeOptions): URLSearchParams {
  const params = new URLSearchParams();
  if (options.dteMax != null) params.set('dte_max', String(options.dteMax));
  if (options.moneynessBandPct != null) {
    params.set('moneyness_band_pct', String(options.moneynessBandPct));
  }
  return params;
}

export function useSpreadSnapshot(symbol: string, options: SpreadScopeOptions = {}) {
  const params = scopeParams(options);
  params.set('symbol', symbol);
  return useApiData<SpreadSnapshot>(`/api/market/spreads?${params.toString()}`, {
    refreshInterval: SNAPSHOT_REFRESH_MS,
    enabled: options.enabled ?? true,
  });
}

export function useSpreadSeries(
  symbol: string,
  options: SpreadScopeOptions & { bucketMinutes?: number; session?: 'current' | 'prior' } = {},
) {
  const params = scopeParams(options);
  params.set('symbol', symbol);
  if (options.bucketMinutes != null) {
    params.set('bucket_minutes', String(options.bucketMinutes));
  }
  if (options.session) params.set('session', options.session);
  return useApiData<SpreadSeries>(`/api/market/spreads/series?${params.toString()}`, {
    refreshInterval: SERIES_REFRESH_MS,
    enabled: options.enabled ?? true,
  });
}

/**
 * The cross-symbol table.
 *
 * `symbols` is sorted before it reaches the query string so two callers
 * asking for the same set share one endpoint URL — which is the key
 * `useApiData` resets its state on, and which the API caches by.
 */
export function useSpreadCompare(
  symbols: readonly string[],
  options: SpreadScopeOptions = {},
) {
  const params = scopeParams(options);
  params.set('symbols', [...symbols].sort().join(','));
  return useApiData<SpreadCompare>(`/api/market/spreads/compare?${params.toString()}`, {
    refreshInterval: SNAPSHOT_REFRESH_MS,
    enabled: options.enabled ?? true,
  });
}

/**
 * Trailing daily history for one side of the book.
 *
 * An empty `rows` array is a normal answer, not a failure: the rollup is
 * seeded by a backfill, and a deployment that has not run one yet has a
 * working page with no baseline. Callers must render that as "no history
 * yet", never as an error.
 */
export function useSpreadHistory(
  symbol: string,
  optionType: 'C' | 'P' | 'A' = 'P',
  days = 60,
  enabled = true,
) {
  const params = new URLSearchParams({
    symbol,
    option_type: optionType,
    days: String(days),
  });
  return useApiData<SpreadHistory>(`/api/market/spreads/history?${params.toString()}`, {
    refreshInterval: HISTORY_REFRESH_MS,
    enabled,
  });
}
