'use client';

/**
 * usePairReplay — buffers one symbol's most-recent replayable session into the
 * browser so the Pair Comparison scrubber can replay it with zero per-frame
 * network calls (mirrors the /replay page's single-round-trip pattern, but
 * fetched client-side through the /api/replay BFF passthrough).
 *
 * Two chained reads:
 *   1. /api/replay/sessions?symbol=X&limit=1  → newest session date.
 *   2. /api/replay/range?symbol=X&date=…      → every per-minute frame + candle.
 *
 * Replay frames carry the dealer-gamma levels (gamma_flip, call/put walls,
 * max_pain) and the per-strike Net GEX, but NOT spot — so callers derive the
 * per-minute spot from the aligned candle close, exactly like ReplayScrubber.
 */

import { useApiData } from './useApiData';

export interface ReplayFrame {
  timestamp: string;
  gamma_flip: number | null;
  call_wall: number | null;
  put_wall: number | null;
  max_pain: number | null;
  strikes: Array<{ strike: number | null; net_gex: number | null }>;
}

export interface ReplayCandle {
  timestamp: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
}

interface ReplaySessionList {
  symbol: string;
  count: number;
  sessions: Array<{ date: string; bar_count: number; first_ts: string | null; last_ts: string | null }>;
}

interface ReplayRangePayload {
  symbol: string;
  date: string;
  timeframe: string;
  is_today: boolean;
  count: number;
  frames: ReplayFrame[];
  candles: ReplayCandle[];
}

export interface PairReplayData {
  symbol: string;
  date: string | null;
  isToday: boolean;
  frames: ReplayFrame[];
  candles: ReplayCandle[];
  loading: boolean;
  error: string | null;
}

// Slightly wider than the replay default (0.04) so the scrubbed column spans a
// comparable strike band to the live /gex/heatmap column it replaces.
const STRIKE_BAND_PCT = 0.05;

/**
 * @param enabled  arm the buffer (fetch + keep the session in memory).
 * @param poll     while actively scrubbing an in-progress session, poll so new
 *                 minutes append; when merely armed (e.g. after exiting to live)
 *                 the buffer is kept without re-fetching.
 */
export function usePairReplay(symbol: string, enabled: boolean, poll = false): PairReplayData {
  const sym = encodeURIComponent(symbol);

  // Newest session date. Fetched once — the latest replayable date doesn't
  // change within a page view (a new session only appears next trading day).
  const {
    data: sessions,
    loading: sessionsLoading,
    error: sessionsError,
  } = useApiData<ReplaySessionList>(`/api/replay/sessions?symbol=${sym}&limit=1`, {
    refreshInterval: 0,
    enabled,
  });

  const date = sessions?.sessions?.[0]?.date ?? null;

  // The whole session's frames + candles. While actively scrubbing, poll gently
  // so an in-progress ("today") session keeps appending fresh minutes; once the
  // user is back on live the buffer is simply retained (refreshInterval 0).
  const {
    data: range,
    loading: rangeLoading,
    error: rangeError,
  } = useApiData<ReplayRangePayload>(
    date
      ? `/api/replay/range?symbol=${sym}&date=${date}&timeframe=1min&strike_band_pct=${STRIKE_BAND_PCT}`
      : `/api/replay/range?symbol=${sym}`,
    { refreshInterval: poll ? 60000 : 0, enabled: enabled && !!date },
  );

  return {
    symbol,
    date,
    isToday: range?.is_today ?? false,
    frames: range?.frames ?? [],
    candles: range?.candles ?? [],
    loading: enabled && (sessionsLoading || (!!date && rangeLoading)),
    error: sessionsError || rangeError,
  };
}
