'use client';

/**
 * usePairReplay — buffers one symbol's replay session into the browser so the
 * Pair Comparison scrubber can replay it with zero per-frame network calls
 * (mirrors the /replay page's single-round-trip pattern, but fetched
 * client-side through the /api/replay BFF passthrough).
 *
 * Two reads, split so the two columns agree on a day before either loads one:
 *   1. usePairReplaySessions: /api/replay/sessions?symbol=X&limit=… for each
 *      symbol → the days both can replay (core/pairReplaySessions), newest
 *      first. The page picks one: the newest unless the member chose another.
 *   2. usePairReplay: /api/replay/range?symbol=X&date=… for that day → every
 *      per-minute frame + candle.
 *
 * Replay frames carry the dealer-gamma levels (gamma_flip, call/put walls,
 * max_pain) and the per-strike Net GEX, but NOT spot — so callers derive the
 * per-minute spot from the aligned candle close, exactly like ReplayScrubber.
 */

import { useState } from 'react';
import { useApiData } from './useApiData';
import { etTodayDateKey } from '@/core/utils';
import { pairReplaySessionOptions, SESSION_LIST_LIMIT } from '@/core/pairReplaySessions';

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
  up_volume?: number | null;
  down_volume?: number | null;
  volume?: number | null;
}

interface ReplaySessionList {
  symbol: string;
  count: number;
  sessions: Array<{
    date: string;
    bar_count: number;
    first_ts: string | null;
    last_ts: string | null;
    // False once the day's per-strike rows have aged out, null when the API
    // couldn't check, absent on an API from before the field.
    has_strikes?: boolean | null;
  }>;
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

export interface PairReplaySessions {
  /** Days both columns can replay with their ladders, newest first. */
  dates: string[];
  /** True until both symbols' lists have answered (or failed). */
  loading: boolean;
  /** Set only when both lists are in, a list failed, and no day can be offered. */
  error: string | null;
}

// Slightly wider than the replay default (0.04) so the scrubbed column spans a
// comparable strike band to the live /gex/heatmap column it replaces.
const STRIKE_BAND_PCT = 0.05;

// A list that has neither answered nor failed is still in flight. useApiData's
// own `loading` stays false through the first fetch after `enabled` turns on,
// so it can't say that alone.
function pending(list: { data: unknown; loading: boolean; error: string | null }): boolean {
  return list.loading || (list.data == null && list.error == null);
}

// The sessions one symbol lists, has_strikes and all; empty while loading or
// when the list failed.
function listedSessions(list: ReplaySessionList | null): ReplaySessionList['sessions'] {
  return list?.sessions ?? [];
}

/**
 * The replay days both symbols can serve, for the session menu.
 *
 * Each list is fetched once per symbol: it only grows when a new session
 * opens, and the newest session's own minutes keep arriving through
 * usePairReplay's poll.
 */
export function usePairReplaySessions(sym1: string, sym2: string, enabled: boolean): PairReplaySessions {
  const list1 = useApiData<ReplaySessionList>(
    `/api/replay/sessions?symbol=${encodeURIComponent(sym1)}&limit=${SESSION_LIST_LIMIT}`,
    { refreshInterval: 0, enabled },
  );
  const list2 = useApiData<ReplaySessionList>(
    `/api/replay/sessions?symbol=${encodeURIComponent(sym2)}&limit=${SESSION_LIST_LIMIT}`,
    { refreshInterval: 0, enabled },
  );

  const listed = pairReplaySessionOptions(listedSessions(list1.data), listedSessions(list2.data), etTodayDateKey());
  const loading = enabled && (pending(list1) || pending(list2));

  // A symbol change refetches that symbol's list. Until it is back, keep
  // offering the days already on screen: resolved against a half-loaded pair,
  // the day being replayed would vanish for a moment, and the column whose
  // symbol did NOT change would drop its buffered session and fetch it again.
  // (Adjusting state during render, React's pattern for state derived from a
  // previous render; the guard makes it settle in one pass.)
  const [dates, setDates] = useState<string[]>(listed);
  if (!loading && !sameDates(dates, listed)) setDates(listed);

  return {
    dates,
    loading,
    // Only once both lists are in: a failed list is covered by the other one.
    error: !loading && listed.length === 0 ? list1.error || list2.error : null,
  };
}

function sameDates(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((d, i) => d === b[i]);
}

/**
 * @param date     the session to buffer (YYYY-MM-DD); nothing loads while null.
 * @param enabled  arm the buffer (fetch + keep the session in memory).
 * @param poll     while actively scrubbing the newest session, poll so new
 *                 minutes append; when merely armed (e.g. after exiting to live),
 *                 or on an earlier session, the buffer is kept without re-fetching.
 */
export function usePairReplay(
  symbol: string,
  date: string | null,
  enabled: boolean,
  poll = false,
): PairReplayData {
  const sym = encodeURIComponent(symbol);

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
    loading: enabled && !!date && pending({ data: range, loading: rangeLoading, error: rangeError }),
    error: rangeError,
  };
}
