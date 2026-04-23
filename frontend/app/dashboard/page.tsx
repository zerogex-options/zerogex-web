/**
 * Main Dashboard Page
 * Overview of key metrics with real-time data
 */

'use client';

import { useGEXSummary, useMarketQuote, useSessionCloses, useSignalScore, useTradesHistory, useTradesLive, useVolExpansionSignal } from '@/hooks/useApiData';
import { useFlowByContractCache, computeFlowSnapshot } from '@/hooks/useFlowByContract';
import { getRegimeLabel } from '@/core/signalConstants';
import MetricCard from '@/components/MetricCard';
import PriceDistanceMetricCard from '@/components/PriceDistanceMetricCard';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { useTheme } from '@/core/ThemeContext';
import UnderlyingCandlesChart from '@/components/UnderlyingCandlesChart';
import VolatilityCard from '@/components/VolatilityCard';
import { useTimeframe } from '@/core/TimeframeContext';
import { getPrimaryPriceChangeSummary } from '@/core/priceChange';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';

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

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatCompactUsd(value: number | null | undefined, showPositiveSign = false): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : showPositiveSign ? '+' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
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
  
  // Fetch data with different refresh intervals
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: sessionClosesData } = useSessionCloses(symbol, 60000);
  const { data: scoreData } = useSignalScore(symbol, PROPRIETARY_SIGNALS_REFRESH.compositeScoreMs);
  const { data: tradesData } = useTradesLive(symbol, PROPRIETARY_SIGNALS_REFRESH.liveTradesMs);
  const { data: tradesHistoryData } = useTradesHistory(symbol, PROPRIETARY_SIGNALS_REFRESH.tradeHistoryMs);
  const { data: volExpansionData } = useVolExpansionSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.volExpansionMs);
  const { rows: flowByContractRows } = useFlowByContractCache(symbol, 'current', {
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

  const volExpansionScore = typeof volExpansionData?.score === 'number'
    ? volExpansionData.score
    : typeof volExpansionData?.composite_score === 'number'
      ? volExpansionData.composite_score
      : null;
  const volExpansionStatus = volExpansionScore == null
    ? 'Awaiting regime data'
    : volExpansionScore >= 70
      ? 'Bullish Expansion'
      : volExpansionScore >= 30
        ? 'Amplification'
        : volExpansionScore > -30
          ? 'Neutral'
          : volExpansionScore > -70
            ? 'Downside Pressure'
            : 'Bearish Expansion';

  const underlyingPrice = getPrimaryPriceChangeSummary({
    quoteClose: quoteData?.close,
    quoteSession: quoteData?.session,
    sessionCloses: sessionClosesData,
  });

  const latestFlowSnapshot = computeFlowSnapshot(flowByContractRows);

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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Error Messages */}
      {gexError && (
        <div className="mb-4">
          <ErrorMessage message={gexError} onRetry={refetchGex} />
        </div>
      )}

      {/* Market Overview */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Market Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start">
          <MetricCard
            title={`${symbol} Price`}
            value={underlyingPrice.displayPrice != null ? `$${underlyingPrice.displayPrice.toFixed(2)}` : '--'}
            subtitle={(
              <div className="flex flex-col gap-1">
                <span
                  style={{
                    color: underlyingPrice.change != null
                      ? (underlyingPrice.isPositive ? 'var(--color-bull)' : 'var(--color-bear)')
                      : undefined,
                  }}
                >
                  {underlyingPrice.change != null && underlyingPrice.changePercent != null
                    ? `${underlyingPrice.isPositive ? '+' : '-'}$${Math.abs(underlyingPrice.change).toFixed(2)} / ${underlyingPrice.isPositive ? '+' : '-'}${Math.abs(underlyingPrice.changePercent).toFixed(2)}% vs previous`
                    : 'Awaiting previous-close context'}
                </span>
                <span>{quoteData?.volume != null ? `Day Vol: ${Math.round(quoteData.volume).toLocaleString()}` : ''}</span>
              </div>
            )}
            tooltip={`Current ${symbol} closing price from the real-time quote feed.`}
            theme={theme}
            trend="neutral"
          />
          <MetricCard
            title="Net GEX"
            value={formatCompactUsd(gexData?.net_gex, true)}
            trend={gexData && gexData.net_gex > 0 ? 'bullish' : 'bearish'}
            tooltip="Net Gamma Exposure across all strikes. Calculation: Sum of all call gamma minus put gamma, scaled by notional value. Positive GEX means dealers are net short gamma (bullish - creates resistance to price movement). Negative GEX means dealers are net long gamma (bearish - amplifies price swings)."
            theme={theme}
          />
          <PriceDistanceMetricCard
            title="Gamma Flip"
            level={gexData?.gamma_flip}
            spotPrice={quoteData?.close}
            tooltip="Price where aggregate net gamma changes sign. The card also shows the live dollar and percent distance from the current underlying so you can quickly judge whether spot is above or below the flip."
            theme={theme}
          />
          <PriceDistanceMetricCard
            title="Max Pain"
            level={gexData?.max_pain}
            spotPrice={quoteData?.close}
            tooltip="Estimated strike where option-holder payout is minimized at expiry. The card also shows the live dollar and percent distance from the current underlying so you can gauge how far spot is from the options pin."
            theme={theme}
          />
        </div>
      </section>


      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Proprietary Signals</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Composite Score"
            value={typeof compositeScore === 'number' ? compositeScore.toFixed(2) : '--'}
            subtitle={compositeRegimeLabel}
            tooltip="UnifiedSignalEngine composite signal score and current actionable regime label."
            theme={theme}
            trend={typeof compositeScore !== 'number' ? 'neutral' : compositeScore > 0 ? 'bullish' : compositeScore < 0 ? 'bearish' : 'neutral'}
          />
          <MetricCard
            title="Signaled Trades Today"
            value={signaledTradeRows.length}
            subtitle={(
              <span>
                PnL{' '}
                <span style={{ color: cumulativePnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                  {cumulativePnl >= 0 ? '+' : '-'}{formatUsd(Math.abs(cumulativePnl))}
                </span>
                {' · Win Rate '}
                <span style={{ color: winRateColor }}>
                  {winRate != null ? `${winRate.toFixed(0)}%` : '—'}
                </span>
              </span>
            )}
            tooltip="Uses the same Trade Stream composition as Signaled Trades with Today selected: all live trades plus today's historical trades, showing cumulative PnL and win rate for today." 
            theme={theme}
            trend={cumulativePnl > 0 ? 'bullish' : cumulativePnl < 0 ? 'bearish' : 'neutral'}
          />
          <MetricCard
            title="Volatility Expansion"
            value={volExpansionScore != null ? volExpansionScore.toFixed(1) : '--'}
            subtitle={volExpansionStatus}
            subtitleColor={
              volExpansionScore == null ? undefined
              : volExpansionScore >= 70 ? 'var(--color-bull)'
              : volExpansionScore >= 30 ? 'var(--color-positive)'
              : volExpansionScore > -30 ? 'var(--color-warning)'
              : volExpansionScore > -70 ? 'var(--color-negative)'
              : 'var(--color-bear)'
            }
            tooltip="Volatility expansion regime score (−100 to +100). Bullish Expansion (+70 to +100), Amplification (+30 to +70), Neutral (−30 to +30), Downside Pressure (−70 to −30), Bearish Expansion (−100 to −70)."
            theme={theme}
            trend={volExpansionScore == null ? 'neutral' : volExpansionScore >= 30 ? 'bullish' : volExpansionScore <= -30 ? 'bearish' : 'neutral'}
          />
        </div>
      </section>

      {/* Volatility Monitor */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Volatility Monitor</h2>
        <VolatilityCard />
      </section>

      <section className="mb-8">
        <UnderlyingCandlesChart />
      </section>

      {/* GEX Metrics */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Gamma Exposure</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Call GEX"
            value={formatCompactUsd(gexData?.total_call_gex)}
            trend="neutral"
            tooltip="Total gamma exposure from call options. Calculation: Sum of (gamma × open interest × contract multiplier × spot price²) for all call strikes. Higher values indicate strong call positioning, which creates upside resistance as dealers hedge by selling into rallies."
            theme={theme}
          />
          <MetricCard
            title="Put GEX"
            value={formatCompactUsd(gexData?.total_put_gex)}
            trend="neutral"
            tooltip="Total gamma exposure from put options. Calculation: Sum of (gamma × open interest × contract multiplier × spot price²) for all put strikes. Higher values indicate strong put positioning, which creates downside support as dealers hedge by buying into selloffs."
            theme={theme}
          />
        </div>
      </section>

      {/* Options Sentiment */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Options Sentiment</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Net Flow"
            value={Number(latestFlowSnapshot?.netFlow ?? 0).toLocaleString()}
            subtitle="contracts"
            trend={Number(latestFlowSnapshot?.netFlow ?? 0) > 0 ? "bullish" : "bearish"}
            tooltip="Cumulative call volume minus put volume for the current session."
            theme={theme}
          />
          <MetricCard
            title="Net Premium"
            value={`${Number(latestFlowSnapshot?.netPremium ?? 0) < 0 ? '-' : ''}$${(Math.abs(Number(latestFlowSnapshot?.netPremium ?? 0)) / 1_000_000).toFixed(2)}M`}
            trend={Number(latestFlowSnapshot?.netPremium ?? 0) > 0 ? "bullish" : "bearish"}
            tooltip="Cumulative call premium minus put premium for the current session."
            theme={theme}
          />
          <MetricCard
            title="Put/Call Ratio"
            value={Number(latestFlowSnapshot?.putCallRatio ?? 0).toFixed(2)}
            trend={Number(latestFlowSnapshot?.putCallRatio ?? 0) > 1 ? 'bearish' : 'bullish'}
            tooltip="Cumulative put volume divided by cumulative call volume for the current session."
            theme={theme}
          />
        </div>
      </section>

      {/* Data Freshness */}
      {gexData && (
        <div className="text-right text-sm text-[var(--text-muted)]">
          Last updated: {new Date(gexData.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
