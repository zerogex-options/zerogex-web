'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { backtestAPI } from '@/core/api/endpoints';
import type {
  BacktestEquityPoint,
  BacktestMeta,
  BacktestRun,
  BacktestRunSummary,
  BacktestSpec,
  BacktestTradesPage,
} from './types';

const POLL_INTERVAL_MS = 1_500;
export const TRADES_PAGE_SIZE = 25;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function isTerminal(status: BacktestRun['status']): boolean {
  return status === 'completed' || status === 'failed';
}

export interface UseBacktestResult {
  // Meta
  meta: BacktestMeta | null;
  metaState: LoadState;
  metaError: string | null;

  // Recent runs
  recentRuns: BacktestRunSummary[];
  refreshRecentRuns: () => void;

  // Active run
  run: BacktestRun | null;
  running: boolean;
  submitError: string | null;

  // Results (loaded once a run completes)
  equity: BacktestEquityPoint[];
  trades: BacktestTradesPage | null;
  tradesPage: number;
  tradesLoading: boolean;

  // Actions
  submit: (spec: BacktestSpec) => Promise<void>;
  openRun: (runId: number) => void;
  setTradesPage: (page: number) => void;
}

export function useBacktest(): UseBacktestResult {
  const [meta, setMeta] = useState<BacktestMeta | null>(null);
  const [metaState, setMetaState] = useState<LoadState>('idle');
  const [metaError, setMetaError] = useState<string | null>(null);

  const [recentRuns, setRecentRuns] = useState<BacktestRunSummary[]>([]);

  const [run, setRun] = useState<BacktestRun | null>(null);
  const [running, setRunning] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [equity, setEquity] = useState<BacktestEquityPoint[]>([]);
  const [trades, setTrades] = useState<BacktestTradesPage | null>(null);
  const [tradesPage, setTradesPageState] = useState(0);
  const [tradesLoading, setTradesLoading] = useState(false);

  // Tracks the run id we're actively polling so stale timers (from a prior
  // run the user navigated away from) don't clobber fresh state.
  const activeRunRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // ---- Meta ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setMetaState('loading');
    backtestAPI
      .getMeta()
      .then((m) => {
        if (cancelled) return;
        setMeta(m);
        setMetaState('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setMetaError(err instanceof Error ? err.message : 'Failed to load backtest metadata');
        setMetaState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Recent runs --------------------------------------------------------
  const refreshRecentRuns = useCallback(() => {
    backtestAPI
      .listRuns()
      .then((runs) => setRecentRuns(runs))
      .catch(() => {
        // Recent runs are best-effort context; failures shouldn't surface.
      });
  }, []);

  useEffect(() => {
    refreshRecentRuns();
  }, [refreshRecentRuns]);

  // ---- Results (equity + first page of trades) ----------------------------
  const loadResults = useCallback(async (runId: number) => {
    setTradesLoading(true);
    try {
      const [eq, tr] = await Promise.all([
        backtestAPI.getEquity(runId),
        backtestAPI.getTrades(runId, TRADES_PAGE_SIZE, 0),
      ]);
      if (activeRunRef.current !== runId) return;
      setEquity(eq);
      setTrades(tr);
      setTradesPageState(0);
    } catch {
      // Leave whatever partial results we have; the run summary still renders.
    } finally {
      if (activeRunRef.current === runId) setTradesLoading(false);
    }
  }, []);

  // ---- Polling ------------------------------------------------------------
  const pollOnce = useCallback(
    async (runId: number) => {
      let next: BacktestRun;
      try {
        next = await backtestAPI.getRun(runId);
      } catch {
        // Transient error — retry on the next tick if still the active run.
        if (activeRunRef.current === runId) {
          pollTimerRef.current = window.setTimeout(() => void pollOnce(runId), POLL_INTERVAL_MS);
        }
        return;
      }
      if (activeRunRef.current !== runId) return;
      setRun(next);
      if (isTerminal(next.status)) {
        setRunning(false);
        clearPoll();
        refreshRecentRuns();
        if (next.status === 'completed') void loadResults(runId);
        return;
      }
      pollTimerRef.current = window.setTimeout(() => void pollOnce(runId), POLL_INTERVAL_MS);
    },
    [clearPoll, loadResults, refreshRecentRuns],
  );

  const beginRun = useCallback(
    (runId: number) => {
      clearPoll();
      activeRunRef.current = runId;
      setRunning(true);
      setEquity([]);
      setTrades(null);
      setTradesPageState(0);
      void pollOnce(runId);
    },
    [clearPoll, pollOnce],
  );

  const submit = useCallback(
    async (spec: BacktestSpec) => {
      setSubmitError(null);
      setRun(null);
      try {
        const created = await backtestAPI.createRun(spec);
        beginRun(created.run_id);
      } catch (err: unknown) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to start backtest');
        setRunning(false);
      }
    },
    [beginRun],
  );

  const openRun = useCallback(
    (runId: number) => {
      setSubmitError(null);
      beginRun(runId);
    },
    [beginRun],
  );

  // ---- Trade pagination ---------------------------------------------------
  const setTradesPage = useCallback((page: number) => {
    const runId = activeRunRef.current;
    if (runId == null || page < 0) return;
    setTradesPageState(page);
    setTradesLoading(true);
    backtestAPI
      .getTrades(runId, TRADES_PAGE_SIZE, page * TRADES_PAGE_SIZE)
      .then((tr) => {
        if (activeRunRef.current !== runId) return;
        setTrades(tr);
      })
      .catch(() => {
        // Keep the current page on failure.
      })
      .finally(() => {
        if (activeRunRef.current === runId) setTradesLoading(false);
      });
  }, []);

  useEffect(() => clearPoll, [clearPoll]);

  return {
    meta,
    metaState,
    metaError,
    recentRuns,
    refreshRecentRuns,
    run,
    running,
    submitError,
    equity,
    trades,
    tradesPage,
    tradesLoading,
    submit,
    openRun,
    setTradesPage,
  };
}
