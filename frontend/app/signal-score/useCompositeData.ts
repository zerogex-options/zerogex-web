'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CompositeHistoryRow, CompositePayload, parseHistory, parsePayload } from './data';
import { getMarketSession } from '@/core/utils';

const HISTORY_LIMIT = 390;
const REFOCUS_HISTORY_REFRESH_MS = 2 * 60 * 1000;

type ConnectionState = 'idle' | 'live' | 'stale' | 'disconnected';

export interface CompositeState {
  payload: CompositePayload | null;
  history: CompositeHistoryRow[];
  lastUpdatedAt: number | null;
  intervalMs: number;
  connection: ConnectionState;
  loading: boolean;
  refetch: () => void;
}

function pickIntervalMs(): number {
  const session = getMarketSession();
  if (session === 'open') return 5_000;
  if (session === 'pre-market' || session === 'after-hours') return 30_000;
  return 5 * 60 * 1000;
}

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
}

export function useCompositeData(symbol: string): CompositeState {
  const [payload, setPayload] = useState<CompositePayload | null>(null);
  const [history, setHistory] = useState<CompositeHistoryRow[]>([]);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [intervalMs, setIntervalMs] = useState<number>(pickIntervalMs());
  const [connection, setConnection] = useState<ConnectionState>('idle');
  const [loading, setLoading] = useState(true);

  const consecutiveFailuresRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const tickClockRef = useRef<number | null>(null);
  const symbolRef = useRef(symbol);
  const lastHiddenAtRef = useRef<number | null>(null);

  const fetchScore = useCallback(async (sym: string): Promise<boolean> => {
    try {
      const res = await fetch(`${apiBaseUrl()}/api/signals/score?underlying=${encodeURIComponent(sym)}`);
      if (!res.ok) {
        if (res.status === 404) {
          if (symbolRef.current === sym) {
            setPayload({ composite: null, components: [] });
            setLastUpdatedAt(Date.now());
            setConnection('live');
          }
          return true;
        }
        throw new Error(`API error ${res.status}`);
      }
      const json = await res.json();
      if (symbolRef.current !== sym) return true;
      const parsed = parsePayload(json);
      setPayload(parsed);
      setLastUpdatedAt(Date.now());
      setConnection('live');
      consecutiveFailuresRef.current = 0;
      // Append to in-memory history if we received a fresh tick.
      const ts = (json && typeof json === 'object' && 'timestamp' in json && typeof (json as { timestamp?: unknown }).timestamp === 'string')
        ? (json as { timestamp: string }).timestamp
        : new Date().toISOString();
      if (parsed.composite != null) {
        setHistory((prev) => {
          if (prev.length > 0 && prev[prev.length - 1].timestamp === ts) return prev;
          const next = [...prev, { timestamp: ts, composite: parsed.composite as number, components: parsed.components }];
          // Cap in-memory history to avoid unbounded growth.
          if (next.length > 5000) next.splice(0, next.length - 5000);
          return next;
        });
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const fetchHistory = useCallback(async (sym: string) => {
    try {
      const res = await fetch(
        `${apiBaseUrl()}/api/signals/score-history?underlying=${encodeURIComponent(sym)}&limit=${HISTORY_LIMIT}`,
      );
      if (!res.ok) return;
      const json = await res.json();
      if (symbolRef.current !== sym) return;
      const rows = parseHistory(json);
      setHistory(rows);
    } catch {
      // history is best-effort; the live tick stream will rebuild it
    }
  }, []);

  // runFetchCycle/scheduleRetry call each other, so capture the latest in a ref
  // to break the dependency cycle without sacrificing correctness.
  const runFetchCycleRef = useRef<(sym: string) => Promise<void>>(async () => {});

  const scheduleRetry = useCallback((sym: string) => {
    if (retryTimerRef.current != null) window.clearTimeout(retryTimerRef.current);
    const fail = consecutiveFailuresRef.current;
    const delay = Math.min(30_000, 1_000 * Math.pow(2, Math.max(0, fail - 1)));
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      void runFetchCycleRef.current(sym);
    }, delay);
  }, []);

  const runFetchCycle = useCallback(
    async (sym: string) => {
      const ok = await fetchScore(sym);
      if (symbolRef.current !== sym) return;
      setLoading(false);
      if (!ok) {
        consecutiveFailuresRef.current += 1;
        if (consecutiveFailuresRef.current >= 2) {
          setConnection('disconnected');
        }
        scheduleRetry(sym);
      }
    },
    [fetchScore, scheduleRetry],
  );

  useEffect(() => {
    runFetchCycleRef.current = runFetchCycle;
  }, [runFetchCycle]);

  // Symbol change: reset state and bootstrap fresh.
  useEffect(() => {
    symbolRef.current = symbol;
    setPayload(null);
    setHistory([]);
    setLastUpdatedAt(null);
    setConnection('idle');
    setLoading(true);
    consecutiveFailuresRef.current = 0;
    void fetchHistory(symbol).then(() => runFetchCycle(symbol));
    return () => {
      if (retryTimerRef.current != null) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [symbol, fetchHistory, runFetchCycle]);

  // Adaptive interval: pick based on market session, recheck every minute.
  useEffect(() => {
    const recompute = () => setIntervalMs(pickIntervalMs());
    recompute();
    const id = window.setInterval(recompute, 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Main polling loop. Pauses while document is hidden.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.hidden) return;
    if (pollTimerRef.current != null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    pollTimerRef.current = window.setInterval(() => {
      void runFetchCycle(symbolRef.current);
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
        const sym = symbolRef.current;
        if (idleMs > REFOCUS_HISTORY_REFRESH_MS) {
          void fetchHistory(sym);
        }
        void runFetchCycle(sym);
        if (pollTimerRef.current != null) window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = window.setInterval(() => {
          void runFetchCycle(symbolRef.current);
        }, intervalMs);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [intervalMs, fetchHistory, runFetchCycle]);

  const refetch = useCallback(() => {
    setLoading(true);
    consecutiveFailuresRef.current = 0;
    void fetchHistory(symbolRef.current).then(() => runFetchCycle(symbolRef.current));
  }, [fetchHistory, runFetchCycle]);

  return {
    payload,
    history,
    lastUpdatedAt,
    intervalMs,
    connection,
    loading,
    refetch,
  };
}
