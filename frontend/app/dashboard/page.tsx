/**
 * Main Dashboard Page
 * Overview of key metrics with real-time data. Layout is user-customizable
 * (reorder / show / hide); the default reproduces the original dashboard.
 */

'use client';

import { useGEXSummary, useMarketQuote, useSessionCloses, useSignalScore, useTradesHistory, useTradesLive } from '@/hooks/useApiData';
import { snapshotFromSeries, useFlowSeries } from '@/hooks/useFlowSeries';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import { getRegimeLabel } from '@/core/signalConstants';
import DashboardGrid from '@/components/DashboardGrid';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { useTheme } from '@/core/ThemeContext';
import { useTimeframe } from '@/core/TimeframeContext';
import { getPrimaryPriceChangeSummary } from '@/core/priceChange';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import type { DashboardWidgetCtx } from '@/core/dashboardWidgets';

function toRows(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const values = Object.values(data as Record<string, unknown>);
    const firstArray = values.find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray as Record<string, unknown>[];
  }
  return [];
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getTradeTimestamp(row: Record<string, unknown>): Date | null {
  const raw = row.closed_at ?? row.exit_at ?? row.opened_at ?? row.created_at ?? row.timestamp;
  if (typeof raw !== 'string') return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inTodayWindow(date: Date | null): boolean {
  if (!date) return false;
  const etDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  return etDate(date) === etDate(new Date());
}

function getTradePnl(row: Record<string, unknown>): number {
  const total = getNumber(row.total_pnl ?? row.pnl ?? row.net_pnl);
  if (total != null) return total;
  const realized = getNumber(row.realized_pnl) ?? 0;
  const unrealized = getNumber(row.unrealized_pnl) ?? 0;
  return realized + unrealized;
}

export default function DashboardPage() {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  const layout = useDashboardLayout();

  // Fetch data with different refresh intervals
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: sessionClosesData } = useSessionCloses(symbol, 60000, quoteData?.session ?? null);
  const { data: scoreData } = useSignalScore(symbol, PROPRIETARY_SIGNALS_REFRESH.compositeScoreMs);
  const { data: tradesData } = useTradesLive(symbol, PROPRIETARY_SIGNALS_REFRESH.liveTradesMs);
  const { data: tradesHistoryData } = useTradesHistory(symbol, PROPRIETARY_SIGNALS_REFRESH.tradeHistoryMs);
  const { rows: flowSeriesRows } = useFlowSeries(symbol, 'current', {
    incrementalMs: PROPRIETARY_SIGNALS_REFRESH.flowByTypeMs,
  });

  const liveRows = toRows(tradesData);
  const historyRows = toRows(tradesHistoryData);
  const todayHistoryRows = historyRows.filter((row) => inTodayWindow(getTradeTimestamp(row)));
  const signaledTradeRows = [...liveRows, ...todayHistoryRows];

  const cumulativePnl = signaledTradeRows.reduce((sum, row) => sum + getTradePnl(row), 0);
  const resolvedTradeOutcomes = signaledTradeRows
    .map((row) => getTradePnl(row))
    .filter((pnl) => Math.abs(pnl) > 1e-9);
  const winRate = resolvedTradeOutcomes.length > 0
    ? (resolvedTradeOutcomes.filter((pnl) => pnl > 0).length / resolvedTradeOutcomes.length) * 100
    : null;
  const winRateColor = winRate == null
    ? 'var(--color-text-secondary)'
    : winRate > 50
      ? 'var(--color-bull)'
      : winRate < 50
        ? 'var(--color-bear)'
        : 'var(--color-text-secondary)';

  const compositeScore = scoreData?.composite_score ?? scoreData?.score;
  const compositeRegimeLabel = typeof compositeScore === 'number' ? getRegimeLabel(compositeScore) : 'Awaiting signal data';

  const underlyingPrice = getPrimaryPriceChangeSummary({
    quoteClose: quoteData?.close,
    quoteSession: quoteData?.session,
    sessionCloses: sessionClosesData,
  });

  const latestFlowSnapshot = snapshotFromSeries(flowSeriesRows);

  // Show loading state only on initial load
  if (gexLoading && !gexData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </div>
    );
  }

  const ctx: DashboardWidgetCtx = {
    symbol,
    theme,
    gexData: gexData
      ? {
          net_gex: gexData.net_gex,
          gamma_flip: gexData.gamma_flip,
          max_pain: gexData.max_pain,
          total_call_gex: gexData.total_call_gex,
          total_put_gex: gexData.total_put_gex,
          call_wall: gexData.call_wall,
          put_wall: gexData.put_wall,
        }
      : null,
    quoteData: quoteData ? { close: quoteData.close, volume: quoteData.volume } : null,
    underlyingPrice: {
      displayPrice: underlyingPrice.displayPrice,
      change: underlyingPrice.change,
      changePercent: underlyingPrice.changePercent,
      isPositive: underlyingPrice.isPositive,
    },
    compositeScore: typeof compositeScore === 'number' ? compositeScore : undefined,
    compositeRegimeLabel,
    signaledTradeCount: signaledTradeRows.length,
    cumulativePnl,
    winRate,
    winRateColor,
    latestFlowSnapshot,
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {gexError && (
        <div className="mb-4">
          <ErrorMessage message={gexError} onRetry={refetchGex} />
        </div>
      )}

      <DashboardGrid ctx={ctx} layout={layout} />

      {gexData && (
        <div className="text-right text-sm text-[var(--text-muted)] mt-8">
          Last updated: {new Date(gexData.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
