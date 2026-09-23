'use client';

import { useApiData } from '@/hooks/useApiData';

/**
 * The session's Gamma Weather history from GET /api/gex/weather-series.
 *
 * The companion to `useGammaWeather`, which answers what the panel reads now.
 * This answers what happened while nobody was looking. Both go through the
 * same loader and classifier on the server, so a bar described here and the
 * same bar in the header cannot disagree.
 *
 * Inherits the estimated-not-observed caveat from the hedging flow underneath
 * it, in `disclosure`. A history view is exactly where that could get quietly
 * dropped, so it travels with the data.
 */
export interface GammaWeatherSeriesBar {
  bar_start: string;
  state: string;
  label: string;
  sentence: string;
  pressure: string;
  structure: string;
  gamma_trend: string;
  lean_side: string | null;
  cushion: string;
  cushion_band: string | null;
  persistence: string;
  persistence_label: string;
  age_bars: number;
  age_minutes: number | null;
  age: string | null;
  age_label: string | null;
  pending_state: string | null;
  pending_label: string | null;
  pending_bars: number;
}

/**
 * A moment the panel said something new.
 *
 * Not one per bar. An entry exists only where a label actually moved, so a
 * quiet afternoon in one state is a line or two rather than fifty identical
 * ones. `field` says which header field it belongs under, so an open drawer
 * shows only its own story.
 */
export interface GammaWeatherChange {
  bar_start: string;
  field: string;
  kind: string;
  text: string;
  opening: boolean;
}

export interface GammaWeatherSeriesPayload {
  symbol: string;
  session: string;
  bars: GammaWeatherSeriesBar[];
  changes: GammaWeatherChange[];
  confirm_bars: number;
  basis: string;
  disclosure: string;
}

/** Bars only move once per five minutes; polling faster re-fetches an identical answer. */
const DEFAULT_REFRESH_MS = 30_000;

export interface UseGammaWeatherSeriesOptions {
  /** Fetch only while a drawer is open. */
  enabled?: boolean;
  /**
   * An explicit ET trading day. Mirrors useGammaWeather: a dated page must
   * ask for its own session, or the drawer would narrate today underneath a
   * historical chart, which is the kind of wrong that looks completely fine.
   */
  date?: string | null;
  refreshMs?: number;
}

export function useGammaWeatherSeries(
  symbol: string,
  options: UseGammaWeatherSeriesOptions = {},
) {
  const { enabled = true, date = null, refreshMs = DEFAULT_REFRESH_MS } = options;
  const params = new URLSearchParams({ symbol });
  if (date) params.set('date', date);

  // Fetched only while a drawer is open. The header does not need the history
  // and most visits never open one, so there is no reason to carry a session
  // of sentences on every poll. A completed day never changes, so a dated read
  // does not poll at all.
  const { data, loading, error, errorStatus, refetch } = useApiData<GammaWeatherSeriesPayload>(
    `/api/gex/weather-series?${params.toString()}`,
    { refreshInterval: date ? 0 : refreshMs, enabled },
  );

  return {
    data,
    loading,
    error,
    /** True when the session simply has no complete bar yet. */
    notReady: errorStatus === 409,
    errorStatus,
    refetch,
  };
}
