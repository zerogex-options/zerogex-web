/**
 * Greeks & GEX Analysis Page
 * Detailed gamma exposure analysis by strike
 */

'use client';

import { useGEXSummary, useMarketQuote } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import LoadingSpinner, { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import { useTheme } from '@/core/ThemeContext';
import { useTimeframe } from '@/core/TimeframeContext';

export default function GreeksGEXPage() {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  // Fetch data with different refresh intervals
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData, loading: quoteLoading, error: quoteError } = useMarketQuote(symbol, 1000);

  // Show loading state only on initial load
  if (gexLoading && !gexData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Greeks & GEX</h1>
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
      <h1 className="text-3xl font-bold mb-8">Greeks & GEX Analysis</h1>

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
            subtitle={quoteData ? `Vol: ${(((quoteData.volume ?? 0) / 1000000)).toFixed(1)}M` : ''}
            tooltip="Current SPY price and volume"
            theme={theme}
          />
          <MetricCard
            title="Net GEX"
            value={gexData ? `$${(gexData.net_gex / 1000000).toFixed(1)}M` : '--'}
            trend={gexData && gexData.net_gex > 0 ? 'bullish' : 'bearish'}
            tooltip="Net gamma exposure across all strikes"
            theme={theme}
          />
          <MetricCard
            title="Gamma Flip"
            value={gexData?.gamma_flip ? `$${gexData.gamma_flip.toFixed(2)}` : 'N/A'}
            subtitle="Dealer positioning"
            tooltip="Price level where dealer gamma flips from positive to negative"
            theme={theme}
          />
          <MetricCard
            title="Max Pain"
            value={gexData?.max_pain ? `$${gexData.max_pain.toFixed(2)}` : 'N/A'}
            subtitle="Options expiry target"
            tooltip="Strike price where option holders experience maximum loss"
            theme={theme}
          />
        </div>
      </section>

      {/* GEX Metrics */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Gamma Exposure</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <MetricCard
            title="Call GEX"
            value={gexData ? `$${(gexData.total_call_gex / 1000000).toFixed(1)}M` : '--'}
            trend="neutral"
            tooltip="Total gamma exposure from call options"
            theme={theme}
          />
          <MetricCard
            title="Put GEX"
            value={gexData ? `$${(gexData.total_put_gex / 1000000).toFixed(1)}M` : '--'}
            trend="neutral"
            tooltip="Total gamma exposure from put options"
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
            tooltip="Ratio of put volume to call volume"
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
            tooltip="Strike with highest call open interest acting as resistance"
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
            tooltip="Strike with highest put open interest acting as support"
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
