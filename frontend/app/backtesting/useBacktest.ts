'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { backtestAPI } from '@/core/api/endpoints';
import type {
  BacktestEquityPoint,
  BacktestMeta,
  BacktestRun,
  BacktestRunSummary,
  BacktestSpec,
  BacktestSweep,
  BacktestSweepAxis,
  BacktestTradesPage,
} from './types';

const POLL_INTERVAL_MS = 1_500;
// Stop polling a run after this long, or after this many consecutive fetch
// failures, so a stuck/lost run surfaces an error instead of spinning forever.
const POLL_MAX_MS = 10 * 60_000;
const POLL_MAX_ERRORS = 8;
export const TRADES_PAGE_SIZE = 25;

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function isTerminal(status: BacktestRun['status']): boolean {
  return status === 'completed' || status === 'failed';
}

/** Whether the results pane is showing a single run or a parameter sweep. */
export type ResultView = 'run' | 'sweep';

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
  pollError: string | null;

  // Results (loaded once a run completes)
  equity: BacktestEquityPoint[];
  trades: BacktestTradesPage | null;
  tradesPage: number;
  tradesLoading: boolean;

  // Parameter sweep
  view: ResultView;
  sweep: BacktestSweep | null;
  sweepRunning: boolean;

  // Actions
  submit: (spec: BacktestSpec) => Promise<void>;
  submitSweep: (spec: BacktestSpec, axes: BacktestSweepAxis[]) => Promise<void>;
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
  const [pollError, setPollError] = useState<string | null>(null);

  const [equity, setEquity] = useState<BacktestEquityPoint[]>([]);
  const [trades, setTrades] = useState<BacktestTradesPage | null>(null);
  const [tradesPage, setTradesPageState] = useState(0);
  const [tradesLoading, setTradesLoading] = useState(false);

  const [view, setView] = useState<ResultView>('run');
  const [sweep, setSweep] = useState<BacktestSweep | null>(null);
  const [sweepRunning, setSweepRunning] = useState(false);

  // Tracks the run id we're actively polling so stale timers (from a prior
  // run the user navigated away from) don't clobber fresh state.
  const activeRunRef = useRef<number | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const pollStartRef = useRef<number>(0);
  const pollErrorsRef = useRef<number>(0);
  const activeSweepRef = useRef<number | null>(null);
  const sweepTimerRef = useRef<number | null>(null);

  const clearPoll = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const clearSweepPoll = useCallback(() => {
    if (sweepTimerRef.current != null) {
      window.clearTimeout(sweepTimerRef.current);
      sweepTimerRef.current = null;
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
  const giveUpPolling = useCallback(
    (message: string) => {
      clearPoll();
      setRunning(false);
      setPollError(message);
    },
    [clearPoll],
  );

  const pollOnce = useCallback(
    async (runId: number) => {
      // Bound total polling time so a run stuck in 'running' can't spin forever.
      if (Date.now() - pollStartRef.current > POLL_MAX_MS) {
        if (activeRunRef.current === runId) {
          giveUpPolling('Stopped waiting after 10 minutes — reopen the run to check its status.');
        }
        return;
      }
      let next: BacktestRun;
      try {
        next = await backtestAPI.getRun(runId);
        pollErrorsRef.current = 0;
      } catch {
        if (activeRunRef.current !== runId) return;
        pollErrorsRef.current += 1;
        if (pollErrorsRef.current >= POLL_MAX_ERRORS) {
          giveUpPolling('Lost connection to the run. Check your network and reopen it.');
          return;
        }
        // Transient error — retry on the next tick.
        pollTimerRef.current = window.setTimeout(() => void pollOnce(runId), POLL_INTERVAL_MS);
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
    [clearPoll, giveUpPolling, loadResults, refreshRecentRuns],
  );

  const beginRun = useCallback(
    (runId: number) => {
      clearPoll();
      // A single run takes over the results pane from any active sweep.
      clearSweepPoll();
      activeSweepRef.current = null;
      setSweepRunning(false);
      setSweep(null);
      setView('run');
      activeRunRef.current = runId;
      setRunning(true);
      setPollError(null);
      pollStartRef.current = Date.now();
      pollErrorsRef.current = 0;
      setEquity([]);
      setTrades(null);
      setTradesPageState(0);
      void pollOnce(runId);
    },
    [clearPoll, clearSweepPoll, pollOnce],
  );

  // ---- Sweep polling ------------------------------------------------------
  const pollSweepOnce = useCallback(
    async (sweepId: number) => {
      let next: BacktestSweep;
      try {
        next = await backtestAPI.getSweep(sweepId);
      } catch {
        if (activeSweepRef.current === sweepId) {
          sweepTimerRef.current = window.setTimeout(
            () => void pollSweepOnce(sweepId),
            POLL_INTERVAL_MS,
          );
        }
        return;
      }
      if (activeSweepRef.current !== sweepId) return;
      setSweep(next);
      if (next.status === 'completed') {
        setSweepRunning(false);
        clearSweepPoll();
        return;
      }
      sweepTimerRef.current = window.setTimeout(
        () => void pollSweepOnce(sweepId),
        POLL_INTERVAL_MS,
      );
    },
    [clearSweepPoll],
  );

  const submitSweep = useCallback(
    async (spec: BacktestSpec, axes: BacktestSweepAxis[]) => {
      setSubmitError(null);
      // A sweep takes over the results pane from any active single run.
      clearPoll();
      activeRunRef.current = null;
      setRunning(false);
      setRun(null);
      setSweep(null);
      setView('sweep');
      try {
        const created = await backtestAPI.createSweep(spec, axes);
        clearSweepPoll();
        activeSweepRef.current = created.sweep_id;
        setSweepRunning(true);
        void pollSweepOnce(created.sweep_id);
      } catch (err: unknown) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to start sweep');
        setSweepRunning(false);
      }
    },
    [clearPoll, clearSweepPoll, pollSweepOnce],
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
  useEffect(() => clearSweepPoll, [clearSweepPoll]);

  return {
    meta,
    metaState,
    metaError,
    recentRuns,
    refreshRecentRuns,
    run,
    running,
    submitError,
    pollError,
    equity,
    trades,
    tradesPage,
    tradesLoading,
    view,
    sweep,
    sweepRunning,
    submit,
    submitSweep,
    openRun,
    setTradesPage,
  };
}
