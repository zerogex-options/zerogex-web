'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMarketSession } from '@/core/utils';
import {
  parseBiasHistory,
  parseBiasPayload,
  TradeBiasHistoryRow,
  TradeBiasPayload,
} from './data';

// Same cadence envelope as the Composite Score hook — the engine persists
// Trade Bias every cycle, so a trading day is ~390 rows; cover the chart's
// multi-day window with headroom.
const HISTORY_LIMIT = 2000;
const HISTORY_LOOKBACK_DAYS = 8;
const REFOCUS_HISTORY_REFRESH_MS = 2 * 60 * 1000;

type ConnectionState = 'idle' | 'live' | 'stale' | 'disconnected';

export interface TradeBiasState {
  payload: TradeBiasPayload | null;
  history: TradeBiasHistoryRow[];
  lastUpdatedAt: number | null;
  intervalMs: number;
  connection: ConnectionState;
  loading: boolean;
  historyLoaded: boolean;
  // True when the API returned 404 for this (symbol, tenor) — the engine has
  // no rows yet. Distinct from a transient fetch failure.
  noData: boolean;
  refetch: () => void;
}

function pickIntervalMs(): number {
  const session = getMarketSession();
  if (session === 'open') return 5_000;
  if (session === 'pre-market' || session === 'after-hours') return 30_000;
  return 5 * 60 * 1000;
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
}

export function useTradeBiasData(symbol: string, tenor: string): TradeBiasState {
  const [payload, setPayload] = useState<TradeBiasPayload | null>(null);
  const [history, setHistory] = useState<TradeBiasHistoryRow[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [intervalMs, setIntervalMs] = useState<number>(pickIntervalMs());
  const [connection, setConnection] = useState<ConnectionState>('idle');
  const [loading, setLoading] = useState(true);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [noData, setNoData] = useState(false);

  const consecutiveFailuresRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const tickClockRef = useRef<number | null>(null);
  // Keyed by "symbol|tenor" so a fetch that resolves after a switch is discarded.
  const keyRef = useRef(`${symbol}|${tenor}`);
  const lastHiddenAtRef = useRef<number | null>(null);
  const lifetimeAbortRef = useRef<AbortController | null>(null);

  const isAbortError = (err: unknown): boolean =>
    typeof err === 'object' && err != null && (err as { name?: unknown }).name === 'AbortError';

  const fetchBias = useCallback(async (sym: string, ten: string): Promise<boolean> => {
    const key = `${sym}|${ten}`;
    try {
      const params = new URLSearchParams();
      params.set('underlying', sym);
      params.set('tenor', ten);
      const signal = lifetimeAbortRef.current?.signal;
      const res = await fetch(`${apiBaseUrl()}/api/signals/trade-bias?${params.toString()}`, { signal });
      if (!res.ok) {
        if (res.status === 404) {
          // No bias computed for this (symbol, tenor) yet.
          if (keyRef.current === key) {
            setPayload(null);
            setNoData(true);
            setLastUpdatedAt(Date.now());
            setConnection('live');
          }
          return true;
        }
        throw new Error(`API error ${res.status}`);
      }
      const json = await res.json();
      if (keyRef.current !== key) return true;
      const parsed = parseBiasPayload(json);
      setPayload(parsed);
      setNoData(false);
      setLastUpdatedAt(Date.now());
      setConnection('live');
      consecutiveFailuresRef.current = 0;
      // Append to in-memory history on a fresh tick.
      const ts = parsed.timestamp ?? new Date().toISOString();
      if (parsed.biasScore != null) {
        setHistory((prev) => {
          if (prev.length > 0 && prev[prev.length - 1].timestamp === ts) return prev;
          const next = [
            ...prev,
            {
              timestamp: ts,
              biasScore: parsed.biasScore as number,
              marketState: parsed.marketState,
              state: parsed.state,
              overrideActive: parsed.overrideActive,
            },
          ];
          if (next.length > 5000) next.splice(0, next.length - 5000);
          return next;
        });
      }
      return true;
    } catch (err) {
      if (isAbortError(err)) return true;
      return false;
    }
  }, []);

  const fetchHistory = useCallback(async (sym: string, ten: string) => {
    const key = `${sym}|${ten}`;
    try {
      const params = new URLSearchParams();
      params.set('underlying', sym);
      params.set('tenor', ten);
      params.set('limit', String(HISTORY_LIMIT));
      params.set('lookback_days', String(HISTORY_LOOKBACK_DAYS));
      const signal = lifetimeAbortRef.current?.signal;
      const res = await fetch(
        `${apiBaseUrl()}/api/signals/trade-bias-history?${params.toString()}`,
        { signal },
      );
      if (!res.ok) return;
      const json = await res.json();
      if (keyRef.current !== key) return;
      const rows = parseBiasHistory(json);
      setHistory((prev) => {
        if (prev.length === 0 || rows.length === 0) return rows;
        const lastHistoryMs = Date.parse(rows[rows.length - 1].timestamp);
        if (!Number.isFinite(lastHistoryMs)) return rows;
        const newer = prev.filter((r) => Date.parse(r.timestamp) > lastHistoryMs);
        return newer.length > 0 ? [...rows, ...newer] : rows;
      });
    } catch {
      // history is best-effort; the live tick stream rebuilds it
    } finally {
      if (keyRef.current === key) setHistoryLoaded(true);
    }
  }, []);

  const runFetchCycleRef = useRef<(sym: string, ten: string) => Promise<void>>(async () => {});

  const scheduleRetry = useCallback((sym: string, ten: string) => {
    if (retryTimerRef.current != null) window.clearTimeout(retryTimerRef.current);
    const fail = consecutiveFailuresRef.current;
    const delay = Math.min(30_000, 1_000 * Math.pow(2, Math.max(0, fail - 1)));
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      void runFetchCycleRef.current(sym, ten);
    }, delay);
  }, []);

  const runFetchCycle = useCallback(
    async (sym: string, ten: string) => {
      const ok = await fetchBias(sym, ten);
      if (keyRef.current !== `${sym}|${ten}`) return;
      setLoading(false);
      if (!ok) {
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 2) setConnection('disconnected');
        scheduleRetry(sym, ten);
      }
    },
    [fetchBias, scheduleRetry],
  );

  useEffect(() => {
    runFetchCycleRef.current = runFetchCycle;
  }, [runFetchCycle]);

  // Symbol/tenor change: reset and bootstrap fresh.
  useEffect(() => {
    keyRef.current = `${symbol}|${tenor}`;
    setPayload(null);
    setHistory([]);
    setLastUpdatedAt(null);
    setConnection('idle');
    setLoading(true);
    setHistoryLoaded(false);
    setNoData(false);
    consecutiveFailuresRef.current = 0;
    lifetimeAbortRef.current?.abort();
    const controller = new AbortController();
    lifetimeAbortRef.current = controller;
    void fetchHistory(symbol, tenor);
    void runFetchCycle(symbol, tenor);
    return () => {
      if (retryTimerRef.current != null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      controller.abort();
    };
  }, [symbol, tenor, fetchHistory, runFetchCycle]);

  // Adaptive interval based on market session, rechecked every minute.
  useEffect(() => {
    const recompute = () => setIntervalMs(pickIntervalMs());
    recompute();
    const id = window.setInterval(recompute, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Main polling loop. Pauses while the document is hidden.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.hidden) return;
    if (pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollTimerRef.current = window.setInterval(() => {
      const [sym, ten] = keyRef.current.split('|');
      void runFetchCycle(sym, ten);
    }, intervalMs);
    return () => {
      if (pollTimerRef.current != null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [intervalMs, runFetchCycle]);

  // Re-render every second so "Ns ago" + stale detection update live.
  useEffect(() => {
    tickClockRef.current = window.setInterval(() => {
      setConnection((prev) => {
        if (prev === 'disconnected') return prev;
        if (lastUpdatedAt == null) return prev;
        const age = Date.now() - lastUpdatedAt;
        if (age > intervalMs * 2) return 'stale';
        return 'live';
      });
    }, 1000);
    return () => {
      if (tickClockRef.current != null) window.clearInterval(tickClockRef.current);
    };
  }, [intervalMs, lastUpdatedAt]);

  // Visibility / focus handling: pause while hidden, refetch on return.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.hidden) {
        lastHiddenAtRef.current = Date.now();
        if (pollTimerRef.current != null) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
      } else {
        const idleMs = lastHiddenAtRef.current != null ? Date.now() - lastHiddenAtRef.current : 0;
        lastHiddenAtRef.current = null;
        const [sym, ten] = keyRef.current.split('|');
        if (idleMs > REFOCUS_HISTORY_REFRESH_MS) void fetchHistory(sym, ten);
        void runFetchCycle(sym, ten);
        if (pollTimerRef.current != null) window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = window.setInterval(() => {
          const [s, t] = keyRef.current.split('|');
          void runFetchCycle(s, t);
        }, intervalMs);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [intervalMs, fetchHistory, runFetchCycle]);

  const refetch = useCallback(() => {
    setLoading(true);
    consecutiveFailuresRef.current = 0;
    const [sym, ten] = keyRef.current.split('|');
    void fetchHistory(sym, ten);
    void runFetchCycle(sym, ten);
  }, [fetchHistory, runFetchCycle]);

  return {
    payload,
    history,
    lastUpdatedAt,
    intervalMs,
    connection,
    loading,
    historyLoaded,
    noData,
    refetch,
  };
}
