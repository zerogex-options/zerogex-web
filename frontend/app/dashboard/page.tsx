/**
 * Main Dashboard Page
 * Overview of key metrics with real-time data
 */

'use client';

import { useGEXSummary, useMarketQuote, useSessionCloses, useSignalScore, useTradesLive, useVolExpansionSignal } from '@/hooks/useApiData';
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

export default function DashboardPage() {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  
  // Fetch data with different refresh intervals
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: sessionClosesData } = useSessionCloses(symbol, 60000);
  const { data: scoreData } = useSignalScore(symbol, 10000);
  const { data: tradesData } = useTradesLive(symbol, 5000);
  const { data: volExpansionData } = useVolExpansionSignal(symbol, 10000);

  const rows = toRows(tradesData);
  const bullishCount = rows.filter((row) => String(row.flow_bias ?? row.trade_side ?? row.direction ?? '').toLowerCase().includes('bull')).length;
  const bearishCount = rows.filter((row) => String(row.flow_bias ?? row.trade_side ?? row.direction ?? '').toLowerCase().includes('bear')).length;
  const directionalRows = bullishCount + bearishCount;
  const bullishPct = directionalRows > 0 ? (bullishCount / directionalRows) * 100 : null;
  const bearishPct = directionalRows > 0 ? (bearishCount / directionalRows) * 100 : null;
  const cumulativePnl = rows.reduce((sum, row) => {
    const totalPnl = getNumber(row.total_pnl);
    if (totalPnl != null) return sum + totalPnl;
    const realized = getNumber(row.realized_pnl) ?? 0;
    const unrealized = getNumber(row.unrealized_pnl) ?? 0;
    return sum + realized + unrealized;
  }, 0);

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
            value={gexData ? `$${(gexData.net_gex / 1000000).toFixed(1)}M` : '--'}
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
            title="Signaled Trades"
            value={rows.length}
            subtitle={directionalRows > 0
              ? `${bullishPct!.toFixed(0)}% bullish / ${bearishPct!.toFixed(0)}% bearish · PnL ${cumulativePnl >= 0 ? '+' : '-'}${formatUsd(Math.abs(cumulativePnl))}`
              : `No directional mix yet · PnL ${cumulativePnl >= 0 ? '+' : '-'}${formatUsd(Math.abs(cumulativePnl))}`}
            tooltip="Live signaled trade count for the selected underlying, with bullish/bearish split and cumulative active-trade PnL."
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
            value={gexData ? `$${(gexData.total_call_gex / 1000000).toFixed(1)}M` : '--'}
            trend="neutral"
            tooltip="Total gamma exposure from call options. Calculation: Sum of (gamma × open interest × contract multiplier × spot price²) for all call strikes. Higher values indicate strong call positioning, which creates upside resistance as dealers hedge by selling into rallies."
            theme={theme}
          />
          <MetricCard
            title="Put GEX"
            value={gexData ? `$${(gexData.total_put_gex / 1000000).toFixed(1)}M` : '--'}
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
            title="Put/Call Ratio"
            value={gexData?.put_call_ratio ? gexData.put_call_ratio.toFixed(2) : '--'}
            trend={gexData && (gexData.put_call_ratio ?? 0) > 1 ? 'bearish' : 'bullish'}
            tooltip="Ratio of put option volume to call option volume. Calculation: Total put volume divided by total call volume over the last hour. Values > 1.0 indicate more put buying (bearish sentiment). Values < 1.0 indicate more call buying (bullish sentiment). Extreme readings can signal reversals."
            theme={theme}
          />
        </div>
      </section>

      {/* Support/Resistance Levels */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Key Levels</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Call Wall (Resistance)"
            value={gexData?.call_wall ? `$${gexData.call_wall.toFixed(2)}` : 'N/A'}
            subtitle={
              gexData?.call_wall && quoteData?.close
                ? `${((gexData.call_wall - quoteData.close) / quoteData.close * 100) >= 0 ? '+' : ''}${((gexData.call_wall - quoteData.close) / quoteData.close * 100).toFixed(1)}% from spot`
                : 'Heavy call open interest'
            }
            tooltip="Strike with the highest concentration of call open interest, acting as resistance. Calculation: Strike with maximum total call OI weighted by gamma. As price approaches this level, dealers must sell shares to hedge their short gamma exposure, creating selling pressure. Price often struggles to break through this level."
            theme={theme}
            trend="bearish"
          />
          <MetricCard
            title="Put Wall (Support)"
            value={gexData?.put_wall ? `$${gexData.put_wall.toFixed(2)}` : 'N/A'}
            subtitle={
              gexData?.put_wall && quoteData?.close
                ? `${((gexData.put_wall - quoteData.close) / quoteData.close * 100) >= 0 ? '+' : ''}${((gexData.put_wall - quoteData.close) / quoteData.close * 100).toFixed(1)}% from spot`
                : 'Heavy put open interest'
            }
            tooltip="Strike with the highest concentration of put open interest, acting as support. Calculation: Strike with maximum total put OI weighted by gamma. As price approaches this level, dealers must buy shares to hedge their short gamma exposure, creating buying pressure. Price often bounces off this level."
            theme={theme}
            trend="bullish"
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
