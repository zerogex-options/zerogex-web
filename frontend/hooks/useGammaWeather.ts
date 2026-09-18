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
  /** PULSE | BUILDING | PERSISTENT — how settled the pressure direction is. */
  persistence: string;
  /** NEW | ESTABLISHED | CONFIRMED | MATURE — how long the state has held. */
  age: string | null;
  /**
   * Display wording for the two ladders, served alongside the codes exactly
   * as `label` is served alongside `state`. Render these rather than mapping
   * the codes here: this panel used to keep its own copy of both maps, and a
   * rename on the server left the copy matching nothing and printed the raw
   * code at the user.
   */
  persistence_label: string;
  age_label: string | null;
  /**
   * The state this bar would read without confirmation, when it differs from
   * the one holding the header. The header waits for a new state to repeat
   * `confirm_bars` times; this is the early read that waiting would otherwise
   * hide, and `pending_bars` is how far through that wait it is.
   */
  pending_state: string | null;
  pending_label: string | null;
  pending_bars: number;
  confirm_bars: number;
  age_minutes: number | null;
  age_bars: number;
  cushion_summary: string | null;
  components: GammaWeatherComponents;
  basis: string;
  disclosure: string;
}

const DEFAULT_REFRESH_MS = 30_000;

export interface UseGammaWeatherOptions {
  /** An explicit ET trading day, `YYYY-MM-DD`, for a historical session. */
  date?: string;
  refreshMs?: number;
}

/**
 * Polls at the structure cadence rather than the flow cadence: the read is
 * recomputed from two materialized series that only move once per bar, so a
 * faster poll would re-fetch an identical answer. With `date` set it does not
 * poll — a closed session's verdict is final.
 *
 * Nothing about the classification is stored; the server derives it on read
 * from the two series. So a dated read is not a stored verdict being replayed,
 * it is today's thresholds applied to that day's bars — which is deliberate,
 * and means retuning a threshold reclassifies the whole archive rather than
 * leaving old sessions labelled by a rule that is no longer live.
 *
 * A 409 is not a failure. It means no bar carries both hedging flow and gamma
 * structure for this session, which happens at the open and after a cold
 * engine. Callers should say "not yet" rather than "error", so the status is
 * surfaced alongside the message. On a historical session the same 409 means
 * "never did" rather than "not yet".
 */
export function useGammaWeather(symbol: string, options: UseGammaWeatherOptions = {}) {
  const { date, refreshMs = DEFAULT_REFRESH_MS } = options;
  const params = new URLSearchParams({ symbol });
  if (date) params.set('date', date);

  const { data, loading, error, errorStatus, refetch } = useApiData<GammaWeatherPayload>(
    `/api/gex/weather?${params.toString()}`,
    { refreshInterval: date ? 0 : refreshMs },
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
