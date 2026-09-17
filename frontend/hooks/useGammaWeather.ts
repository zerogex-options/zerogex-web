'use client';

import { useApiData } from '@/hooks/useApiData';

/**
 * The combined current-state read from GET /api/gex/weather.
 *
 * A market-health classification, not a directional signal, an entry or exit,
 * or a recommendation. It inherits the estimated-not-observed caveat from the
 * hedging flow it reads; combining inputs does not upgrade that, and
 * `disclosure` carries the wording.
 *
 * `components` arrives with the verdict on purpose. A panel that shows only a
 * conclusion cannot be checked, and this one sits directly above the charts
 * that produced it precisely so it can be.
 */
export interface GammaWeatherComponents {
  pressure_bar_usd: number | null;
  pressure_avg_usd: number | null;
  lean: number | null;
  stability: number | null;
  gamma_trend: number | null;
  cushion_pts: number | null;
  cushion_state: string | null;
  cushion_rate_pts: number | null;
  spot: number | null;
  gamma_flip: number | null;
}

export interface GammaWeatherPayload {
  symbol: string;
  session: string;
  bar_start: string | null;
  /** STABLE_BID | SUPPORTED_DIP | FRAGILE_RALLY | UNSTABLE | MIXED */
  state: string;
  label: string;
  sentence: string;
  /** BUYING | SELLING | MIXED */
  pressure: string;
  /** PINNING | ACCELERATIVE | FLAT — the rolling view. */
  structure: string;
  /** The same classification over the since-open window. */
  gamma_trend: string;
  /** SUPPORTIVE | CAPPING */
  lean_side: string | null;
  /** A modifier on the state, never a competing state. */
  cushion: string;
  /** PULSE | DEVELOPING | ESTABLISHED — how settled the pressure direction is. */
  persistence: string;
  /** DEVELOPING | ESTABLISHED | CONFIRMED | DURABLE, with the clock alongside. */
  age_label: string | null;
  age_minutes: number | null;
  age_bars: number;
  cushion_summary: string | null;
  components: GammaWeatherComponents;
  basis: string;
  disclosure: string;
}

const DEFAULT_REFRESH_MS = 30_000;

/**
 * Polls at the structure cadence rather than the flow cadence: the read is
 * recomputed from two materialized series that only move once per bar, so a
 * faster poll would re-fetch an identical answer.
 *
 * A 409 is not a failure. It means no bar yet carries both hedging flow and
 * gamma structure for this session, which happens at the open and after a
 * cold engine. Callers should say "not yet" rather than "error", so the
 * status is surfaced alongside the message.
 */
export function useGammaWeather(symbol: string, refreshMs: number = DEFAULT_REFRESH_MS) {
  const { data, loading, error, errorStatus, refetch } = useApiData<GammaWeatherPayload>(
    `/api/gex/weather?symbol=${encodeURIComponent(symbol)}`,
    { refreshInterval: refreshMs },
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
