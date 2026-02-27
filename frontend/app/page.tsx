/**
 * Main Dashboard Page
 * Overview of key metrics with real-time data
 */

'use client';

import { useGEXSummary, useMarketQuote } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import LoadingSpinner, { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { useTheme } from '@/core/ThemeContext';

export default function DashboardPage() {
  const { theme } = useTheme();
  
  // Fetch data with different refresh intervals
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(5000);
  const { data: quoteData, loading: quoteLoading, error: quoteError } = useMarketQuote(1000);

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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="SPY Price"
            value={quoteData ? `$${quoteData.close.toFixed(2)}` : '--'}
            subtitle={quoteData ? `Vol: ${(quoteData.volume / 1000000).toFixed(1)}M` : ''}
            tooltip="Current SPY closing price. Calculation: Latest market price from real-time quote feed. Volume shows total shares traded today in millions. This is the most recent price at which SPY traded."
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
          <MetricCard
            title="Gamma Flip"
            value={gexData?.gamma_flip ? `$${gexData.gamma_flip.toFixed(2)}` : 'N/A'}
            subtitle="Dealer positioning"
            tooltip="Price level where dealer gamma exposure flips from positive to negative. Calculation: Strike where net GEX crosses zero. Above this level, dealers hedge by buying rallies and selling dips (dampening volatility). Below it, dealers sell rallies and buy dips (increasing volatility)."
            theme={theme}
            trend="neutral"
          />
          <MetricCard
            title="Max Pain"
            value={gexData?.max_pain ? `$${gexData.max_pain.toFixed(2)}` : 'N/A'}
            subtitle="Options expiry target"
            tooltip="Strike price where option holders lose the most value at expiration. Calculation: Price point where the sum of dollar value of all options (calls + puts) is minimized. Market makers may push price toward this level as expiration approaches to maximize their profits. Acts as a magnet for price."
            theme={theme}
            trend="neutral"
          />
        </div>
      </section>

      {/* GEX Metrics */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Gamma Exposure</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Call GEX"
            value={gexData ? `$${(gexData.total_call_gex / 1000000).toFixed(1)}M` : '--'}
            trend="bullish"
            tooltip="Total gamma exposure from call options. Calculation: Sum of (gamma × open interest × contract multiplier × spot price²) for all call strikes. Higher values indicate strong call positioning, which creates upside resistance as dealers hedge by selling into rallies."
            theme={theme}
          />
          <MetricCard
            title="Put GEX"
            value={gexData ? `$${(gexData.total_put_gex / 1000000).toFixed(1)}M` : '--'}
            trend="bearish"
            tooltip="Total gamma exposure from put options. Calculation: Sum of (gamma × open interest × contract multiplier × spot price²) for all put strikes. Higher values indicate strong put positioning, which creates downside support as dealers hedge by buying into selloffs."
            theme={theme}
          />
          <MetricCard
            title="Put/Call Ratio"
            value={gexData?.put_call_ratio ? gexData.put_call_ratio.toFixed(2) : '--'}
            trend={gexData && gexData.put_call_ratio > 1 ? 'bearish' : 'bullish'}
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
            subtitle="Heavy call open interest"
            tooltip="Strike with the highest concentration of call open interest, acting as resistance. Calculation: Strike with maximum total call OI weighted by gamma. As price approaches this level, dealers must sell shares to hedge their short gamma exposure, creating selling pressure. Price often struggles to break through this level."
            theme={theme}
            trend="bearish"
          />
          <MetricCard
            title="Put Wall (Support)"
            value={gexData?.put_wall ? `$${gexData.put_wall.toFixed(2)}` : 'N/A'}
            subtitle="Heavy put open interest"
            tooltip="Strike with the highest concentration of put open interest, acting as support. Calculation: Strike with maximum total put OI weighted by gamma. As price approaches this level, dealers must buy shares to hedge their short gamma exposure, creating buying pressure. Price often bounces off this level."
            theme={theme}
            trend="bullish"
          />
        </div>
      </section>

      {/* Data Freshness */}
      {gexData && (
        <div className="text-right text-sm text-gray-500">
          Last updated: {new Date(gexData.timestamp).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
