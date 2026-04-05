/**
 * Main Dashboard Page
 * Overview of key metrics with real-time data
 */

'use client';

import { useGEXSummary, useMarketQuote, useSignalScore } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import PriceDistanceMetricCard from '@/components/PriceDistanceMetricCard';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { useTheme } from '@/core/ThemeContext';
import UnderlyingCandlesChart from '@/components/UnderlyingCandlesChart';
import VolatilityCard from '@/components/VolatilityCard';
import { useTimeframe } from '@/core/TimeframeContext';
import { colors } from '@/core/colors';

export default function DashboardPage() {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  
  // Fetch data with different refresh intervals
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: scoreData } = useSignalScore(symbol, 10000);

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
            value={quoteData ? `$${quoteData.close.toFixed(2)}` : '--'}
            subtitle={quoteData ? `Vol: ${(((quoteData.volume ?? 0) / 1000000)).toFixed(1)}M` : ''}
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
        <h2 className="text-2xl font-semibold mb-4">Signal Score</h2>
        <div className="rounded-2xl border border-[var(--color-border)] p-6 bg-[var(--color-surface)]">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div
              className="lg:col-span-2 rounded-2xl border p-6"
              style={{
                backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
                borderColor: colors.muted,
                boxShadow: theme === 'dark'
                  ? '0 4px 12px var(--color-info-soft), 0 1px 3px var(--color-info-soft)'
                  : '0 4px 12px var(--color-info-soft), 0 1px 3px var(--border-subtle)',
              }}
            >
              <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Current Market Feel</div>
              <div
                className="text-6xl font-black leading-none"
                style={{
                  color:
                    typeof (scoreData?.composite_score ?? scoreData?.score) === 'number'
                      ? ((scoreData?.composite_score ?? scoreData?.score)! > 0 ? 'var(--color-bull)' : (scoreData?.composite_score ?? scoreData?.score)! < 0 ? 'var(--color-bear)' : 'var(--color-warning)')
                      : 'var(--color-text-primary)',
                }}
              >
                {typeof (scoreData?.composite_score ?? scoreData?.score) === 'number' ? (scoreData?.composite_score ?? scoreData?.score)!.toFixed(2) : '--'}
              </div>
              <div className="mt-2 text-lg font-semibold">
                {typeof (scoreData?.composite_score ?? scoreData?.score) === 'number'
                  ? ((scoreData?.composite_score ?? scoreData?.score)! > 0 ? 'Bullish Trading Environment' : (scoreData?.composite_score ?? scoreData?.score)! < 0 ? 'Bearish Trading Environment' : 'Neutral Trading Environment')
                  : 'Awaiting signal data'}
              </div>
              <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
                This is the top-level regime signal for trade selection. Readings near +100 indicate strong risk-on pressure; readings near -100 indicate strong risk-off pressure.
              </p>
            </div>

            <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-semibold">Score Spectrum</div>
                <div className="text-xs text-[var(--color-text-secondary)]">Range: -100 to +100</div>
              </div>

              <div className="relative mt-4">
                <div
                  className="h-4 rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, var(--color-bear) 0%, #d98572 25%, var(--color-warning) 50%, #75cfa1 75%, var(--color-bull) 100%)',
                  }}
                />
                <div
                  className="absolute -top-2 h-8 w-0.5 bg-[var(--color-text-primary)]"
                  style={{
                    left:
                      typeof (scoreData?.composite_score ?? scoreData?.score) === 'number'
                        ? `${Math.max(0, Math.min(100, (((scoreData?.composite_score ?? scoreData?.score)! + 100) / 200) * 100))}%`
                        : '50%',
                    transform: 'translateX(-50%)',
                  }}
                />
              </div>

              <div className="mt-3 grid grid-cols-5 text-[11px] text-[var(--color-text-secondary)]">
                <span className="text-left">-100</span>
                <span className="text-center">-50</span>
                <span className="text-center">0</span>
                <span className="text-center">+50</span>
                <span className="text-right">+100</span>
              </div>

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]">
                  <div className="font-semibold text-[var(--color-bear)]">Bearish Zone</div>
                  <div className="text-[var(--color-text-secondary)] mt-1">-100 to -25: favor downside continuation and defensive structures.</div>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]">
                  <div className="font-semibold text-[var(--color-warning)]">Neutral Zone</div>
                  <div className="text-[var(--color-text-secondary)] mt-1">-24 to +24: mixed tape, prioritize confirmation and smaller size.</div>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]">
                  <div className="font-semibold text-[var(--color-bull)]">Bullish Zone</div>
                  <div className="text-[var(--color-text-secondary)] mt-1">+25 to +100: favor upside continuation and pullback entries.</div>
                </div>
              </div>
            </div>
          </div>
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
