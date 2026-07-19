'use client';

/**
 * Shared live-data context for the customizable dashboard.
 *
 * useApiData does NOT dedupe across hook instances — every instance runs its
 * own fetch loop. A board with a dozen metric tiles each calling useGEXSummary
 * would open a dozen identical polling loops. So the common feeds are fetched
 * ONCE here and read from context by the lightweight metric tiles.
 *
 * Each feed's polling is gated by which feeds the active widgets actually need
 * (`activeFeeds`): a needed feed polls at its live cadence, an unneeded one is
 * set to a single fetch (interval 0) so a panel-only or nearly-empty board
 * doesn't hammer the 1 Hz quote endpoint for nothing.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useTheme } from '@/core/ThemeContext';
import { useTimeframe } from '@/core/TimeframeContext';
import type { UnderlyingSymbol } from '@/core/symbolPersistence';
import type { Theme } from '@/core/types';
import {
  useGEXHistoricalContext,
  useGEXSummary,
  useMarketQuote,
  useSessionCloses,
  useSignalScore,
  useVolatilityGauge,
  type SignalScoreResponse,
  type VolatilityGaugeData,
  type VolatilityIndex,
} from '@/hooks/useApiData';
import { snapshotFromSeries, useFlowSeries } from '@/hooks/useFlowSeries';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';

// snapshotFromSeries returns `FlowSnapshot | null`; derive the non-null shape
// rather than reaching into the internal useFlowByContract module.
type FlowSnapshot = NonNullable<ReturnType<typeof snapshotFromSeries>>;
// Derive the live-data shapes from the hooks themselves so the context always
// matches exactly what the API layer returns (the hook rows are internal,
// non-exported interfaces).
type GexData = ReturnType<typeof useGEXSummary>['data'];
type HistoricalData = ReturnType<typeof useGEXHistoricalContext>['data'];

export type FeedKey =
  | 'gex'
  | 'quote'
  | 'sessionCloses'
  | 'flow'
  | 'vol'
  | 'historical'
  | 'signalScore';

type QuoteData = ReturnType<typeof useMarketQuote>['data'];
type SessionClosesData = ReturnType<typeof useSessionCloses>['data'];

export type DashboardDataValue = {
  symbol: UnderlyingSymbol;
  theme: Theme;
  gex: GexData;
  gexLoading: boolean;
  gexError: string | null;
  refetchGex: () => void;
  historical: HistoricalData;
  quote: QuoteData;
  sessionCloses: SessionClosesData;
  flow: FlowSnapshot | null;
  vol: VolatilityGaugeData | null;
  volIndex: VolatilityIndex;
  signalScore: SignalScoreResponse | null;
};

const DashboardDataContext = createContext<DashboardDataValue | null>(null);

export function MyDashboardDataProvider({
  activeFeeds,
  children,
}: {
  activeFeeds: ReadonlySet<FeedKey>;
  children: ReactNode;
}) {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();

  // Interval 0 = one fetch then idle (useApiData still runs once but stops
  // polling). Live cadence only for feeds a present widget consumes.
  const needsQuote = activeFeeds.has('quote') || activeFeeds.has('sessionCloses');
  const gexOn = activeFeeds.has('gex');
  const histOn = activeFeeds.has('historical');
  const volOn = activeFeeds.has('vol');
  const scoreOn = activeFeeds.has('signalScore');
  const closesOn = activeFeeds.has('sessionCloses');

  const {
    data: gex,
    loading: gexLoading,
    error: gexError,
    refetch: refetchGex,
  } = useGEXSummary(symbol, gexOn ? 5000 : 0);
  const { data: historical } = useGEXHistoricalContext(symbol, histOn ? 15000 : 0);
  const { data: quote } = useMarketQuote(symbol, needsQuote ? 1000 : 0);
  const { data: sessionCloses } = useSessionCloses(
    symbol,
    closesOn ? 60000 : 0,
    quote?.session ?? null,
  );

  const volIndex: VolatilityIndex = symbol === 'QQQ' ? 'VXN' : 'VIX';
  const { data: vol } = useVolatilityGauge(volOn ? 30000 : 0, volIndex);
  const { data: signalScore } = useSignalScore(symbol, scoreOn ? 10000 : 0);

  const { rows: flowRows } = useFlowSeries(symbol, 'current', {
    incrementalMs: PROPRIETARY_SIGNALS_REFRESH.flowByTypeMs,
  });
  const flow = useMemo(() => snapshotFromSeries(flowRows), [flowRows]);

  const value = useMemo<DashboardDataValue>(
    () => ({
      symbol,
      theme,
      gex: gex ?? null,
      gexLoading,
      gexError,
      refetchGex,
      historical: historical ?? null,
      quote,
      sessionCloses,
      flow,
      vol: vol ?? null,
      volIndex,
      signalScore: signalScore ?? null,
    }),
    [
      symbol,
      theme,
      gex,
      gexLoading,
      gexError,
      refetchGex,
      historical,
      quote,
      sessionCloses,
      flow,
      vol,
      volIndex,
      signalScore,
    ],
  );

  return <DashboardDataContext.Provider value={value}>{children}</DashboardDataContext.Provider>;
}

export function useMyDashboardData(): DashboardDataValue {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error('useMyDashboardData must be used within MyDashboardDataProvider');
  }
  return ctx;
}
