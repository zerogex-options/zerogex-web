'use client';

/**
 * One Flow Analysis session, read for its chart: the bars, the read and the
 * flow log behind the page's Session chart, on the session's own clock and
 * narrowed to the contracts picked.
 *
 * The page and the My Dashboard "Flow Analysis - Session" widget both read
 * through here, so the tile's chart is the page's chart rather than a copy
 * that can drift from it. Everything reads /api/flow/series (useFlowSeries)
 * through core/flowAnalysis.
 *
 * Strike picks are the caller's: the page has a picker for them, a tile has
 * none. The expiration picks are the shared ones (useSharedExpirations): the
 * browser tab's on the page, the board pane's in a tile, which is how a tile
 * follows its board's Expiration setting.
 */

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useFlowSessions } from '@/hooks/useFlowSessions';
import { sessionDateKeyFromSeries, useFlowContractOptions, useFlowSeries } from '@/hooks/useFlowSeries';
import { useSharedExpirations } from '@/hooks/useSharedExpirations';
import { etTodayDateKey } from '@/core/utils';
import { reconcileExpirations } from '@/core/expirationPersistence';
import { isFlowSessionDate, type FlowSession } from '@/core/flowSessions';
import { FLOW_TIMEFRAME_MINUTES, getETTimeTimestamp, type FlowTimeframe } from '@/core/flowSeriesCharts';
import { buildFlowBars, buildFlowEvents, flowRead, type FlowBar, type FlowEvent, type FlowRead } from '@/core/flowAnalysis';
import { scopeSummary } from './ContractScope';

const noopSubscribe = () => () => {};
const NO_STRIKES: ReadonlySet<string> = new Set();

export interface FlowSessionData {
  symbol: string;
  flowSession: FlowSession;
  timeframe: FlowTimeframe;
  barMinutes: number;
  barMs: number;
  /** False on the server and the hydrating render, which paint no cached rows. */
  hydrated: boolean;
  todayKey: string;
  /** The session's own ET date. */
  dateKey: string;
  /** The sessions on offer, newest first, once known. */
  flowSessionDays: string[] | null;

  // ── Which contracts ──
  strikeOptions: string[];
  expirationOptions: string[];
  contractsLoading: boolean;
  contractsError: string | null;
  /** Whose chain the contracts are: SPX for ES, NDX for NQ, else the symbol's own. */
  chainSymbol: string;
  /** The shared expiration picks as stored, a rolling 0DTE pick unresolved. */
  sharedExpirations: string[];
  setSharedExpirations: (next: readonly string[]) => void;
  effectiveStrikes: Set<string>;
  /** The expiration picks resolved against this session's chain. */
  effectiveExpirations: Set<string>;
  filtered: boolean;
  serverFilters: { strikes: string[]; expirations: string[] };
  /** Which contracts are read, in words: "every contract", or the picks. */
  summary: string;
  /** A remembered pick still waiting on the chain's expirations to resolve. */
  scopePending: boolean;

  // ── The rows ──
  loading: boolean;
  /** A first load that failed, or a refresh's error over the rows it kept. */
  loadError: string | null;
  /** A first load that failed: there are no rows to show. */
  failed: boolean;
  bars: FlowBar[];
  read: FlowRead | null;
  events: FlowEvent[];
  /** Nothing to draw yet, and still loading. */
  showInitialLoading: boolean;

  // ── The clock ──
  /** 09:30 ET of the session. */
  sessionStartMs: number;
  /** The end of the session's last bar slot. */
  sessionEndMs: number;
  haveWindow: boolean;
  /** Still trading: today's session, before its last bar has closed. */
  live: boolean;
}

export function useFlowSessionData({
  symbol,
  flowSession,
  timeframe,
  selectedStrikes = NO_STRIKES,
}: {
  symbol: string;
  flowSession: FlowSession;
  timeframe: FlowTimeframe;
  /** The page's strike picks. A dashboard tile has none. */
  selectedStrikes?: ReadonlySet<string>;
}): FlowSessionData {
  const todayKey = etTodayDateKey();

  // The clock, to the half minute: only the close needs it.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Session and bar size ─────────────────────────────────────────────────
  const flowSessionDays = useFlowSessions(symbol);
  const barMinutes = FLOW_TIMEFRAME_MINUTES[timeframe];
  const barMs = barMinutes * 60_000;

  // Every contract's rows. The hook paints rows this tab cached on its first
  // render, which the server never has: held back for the hydrating render,
  // the page matches the server's HTML, and the cached rows paint on the next.
  const allSeries = useFlowSeries(symbol, flowSession, { timeframe });
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const allRows = hydrated ? allSeries.rows : null;
  const allLoading = hydrated ? allSeries.loading : true;
  const allError = hydrated ? allSeries.error : null;
  // The session's own ET date. It lays a past session out on its own clock,
  // and it is what a rolling 0DTE pick means here: the contracts that expired
  // that day, not today's.
  const dateKey = isFlowSessionDate(flowSession)
    ? flowSession
    : allRows && allRows.length > 0
      ? sessionDateKeyFromSeries(allRows)
      : (flowSessionDays?.[flowSession === 'current' ? 0 : 1] ?? todayKey);

  // ── Which contracts ──────────────────────────────────────────────────────
  const {
    options: contractOptions,
    loading: contractsLoading,
    error: contractsError,
    chainSymbol,
  } = useFlowContractOptions(symbol, flowSession);
  const strikeOptions = useMemo(() => contractOptions.strikes.map((n) => String(n)), [contractOptions]);
  const expirationOptions = useMemo(() => contractOptions.expirations.slice().sort(), [contractOptions]);
  const { selection: sharedExpirations, setSelection: setSharedExpirations } = useSharedExpirations();
  const effectiveStrikes = useMemo(() => new Set(strikeOptions.filter((v) => selectedStrikes.has(v))), [strikeOptions, selectedStrikes]);
  // Through the shared reconcile, the one place the rolling 0DTE pick resolves:
  // here to the session's same-day expiration, which is today's only when the
  // session is today's.
  const effectiveExpirations = useMemo(
    () => new Set(reconcileExpirations(sharedExpirations, expirationOptions, dateKey)),
    [sharedExpirations, expirationOptions, dateKey],
  );
  const filtered = effectiveStrikes.size > 0 || effectiveExpirations.size > 0;
  const serverFilters = useMemo(
    () => ({ strikes: Array.from(effectiveStrikes), expirations: Array.from(effectiveExpirations) }),
    [effectiveStrikes, effectiveExpirations],
  );
  const summary = scopeSummary(Array.from(effectiveStrikes), Array.from(effectiveExpirations), dateKey);
  // A read of the whole chain while a remembered pick waits on the chain's
  // expirations to resolve would be thrown away a moment later.
  const scopePending = contractsLoading && (sharedExpirations.length > 0 || selectedStrikes.size > 0);

  // ── The rows ─────────────────────────────────────────────────────────────
  const scopedSeries = useFlowSeries(symbol, flowSession, {
    timeframe,
    filters: serverFilters,
    enabled: filtered,
  });
  const scopedRows = hydrated ? scopedSeries.rows : null;
  const scopedLoading = hydrated ? scopedSeries.loading : true;
  const scopedError = hydrated ? scopedSeries.error : null;
  const rows = filtered ? scopedRows : allRows;
  const loading = filtered ? scopedLoading : allLoading;
  // A first load that failed. A refresh that fails later keeps the rows it had.
  const loadError = filtered ? scopedError : allError;
  const failed = loadError != null && rows == null;
  const bars = useMemo<FlowBar[]>(() => buildFlowBars(rows), [rows]);
  const read = useMemo(() => flowRead(bars), [bars]);
  const events = useMemo<FlowEvent[]>(() => buildFlowEvents(bars, barMinutes), [bars, barMinutes]);

  const sessionStartMs = getETTimeTimestamp(dateKey, 9, 30) ?? NaN;
  const sessionEndMs = (getETTimeTimestamp(dateKey, 16, 15) ?? NaN) + barMs;
  const haveWindow = Number.isFinite(sessionStartMs) && Number.isFinite(sessionEndMs);
  // Still trading: today's session, before its last bar has closed. After the
  // close the day reads as final, as a past session does.
  const live = flowSession === 'current' && dateKey === todayKey && nowMs < sessionEndMs;

  return {
    symbol,
    flowSession,
    timeframe,
    barMinutes,
    barMs,
    hydrated,
    todayKey,
    dateKey,
    flowSessionDays,
    strikeOptions,
    expirationOptions,
    contractsLoading,
    contractsError,
    chainSymbol,
    sharedExpirations,
    setSharedExpirations,
    effectiveStrikes,
    effectiveExpirations,
    filtered,
    serverFilters,
    summary,
    scopePending,
    loading,
    loadError,
    failed,
    bars,
    read,
    events,
    showInitialLoading: loading && bars.length === 0,
    sessionStartMs,
    sessionEndMs,
    haveWindow,
    live,
  };
}
