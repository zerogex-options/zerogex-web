/**
 * GEX Summary Page
 * Headline GEX numbers, key dealer levels, and options sentiment.
 */

'use client';

import { useState } from 'react';
import { useGEXSummary, useMarketQuote } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import FlipTermStructureChart from '@/components/FlipTermStructureChart';
import FlipSurfaceChart from '@/components/FlipSurfaceChart';
import GammaPulsePanel from '@/components/GammaPulsePanel';
import { useTheme } from '@/core/ThemeContext';
import { useTimeframe } from '@/core/TimeframeContext';

function formatGexValue(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '';
  if (abs >= 1e9) return `${sign}$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(value / 1e3).toFixed(0)}K`;
  return `${sign}$${value.toFixed(0)}`;
}

// Dollar GEX is computed and stored in the "per 1% move" convention
// (γ × OI × 100 × S² × 0.01). The "per 1 point" convention some
// dashboards publish is the same exposure divided by (spot × 0.01),
// i.e. value × 100 / spot. This is purely a display reinterpretation —
// the stored value is unchanged.
type GexUnit = 'percent' | 'point';

function toPerPoint(perPercent: number, spot: number): number {
  if (!(spot > 0)) return perPercent;
  return (perPercent * 100) / spot;
}

function formatGexInUnit(value: number | null | undefined, unit: GexUnit, spot: number): string {
  if (value == null) return '--';
  return formatGexValue(unit === 'point' ? toPerPoint(value, spot) : value);
}

const GEX_UNIT_LABEL: Record<GexUnit, string> = {
  percent: 'per 1% move',
  point: 'per 1pt move',
};

export default function GreeksGEXPage() {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  // Fetch data with different refresh intervals
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const netGexAtSpot = gexData?.net_gex_at_spot ?? gexData?.net_gex ?? null;
  const netGexPositive = (netGexAtSpot ?? 0) >= 0;

  // Net/Call/Put GEX unit toggle. Stored values are "per 1% move"; the
  // toggle reinterprets them as "per 1 point move" (value × 100 / spot)
  // so the headline magnitude lines up with point-convention dashboards.
  const [gexUnit, setGexUnit] = useState<GexUnit>('percent');
  const gexSpot = quoteData?.close ?? gexData?.spot_price ?? 0;
  const unitLabel = GEX_UNIT_LABEL[gexUnit];

  // Show loading state only on initial load
  if (gexLoading && !gexData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">GEX Summary</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <LoadingCard />
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
      <h1 className="text-3xl font-bold mb-8">GEX Summary</h1>

      {/* Error Messages */}
      {gexError && (
        <div className="mb-4">
          <ErrorMessage message={gexError} onRetry={refetchGex} />
        </div>
      )}

      {/* GEX unit toggle: per 1% move (stored convention) vs per 1 point */}
      <div className="mb-4 flex items-center gap-3">
        <span className="text-sm text-[var(--text-muted)]">GEX unit:</span>
        <div className="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
          {(['percent', 'point'] as GexUnit[]).map((unit) => (
            <button
              key={unit}
              type="button"
              onClick={() => setGexUnit(unit)}
              aria-pressed={gexUnit === unit}
              className={`px-3 py-1.5 text-sm font-semibold transition-colors ${
                gexUnit === unit
                  ? 'bg-[var(--color-info-soft)] text-[var(--text-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {GEX_UNIT_LABEL[unit]}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--text-muted)]">
          Per-point = per-1% ÷ (spot × 0.01). Same exposure, different unit.
        </span>
      </div>

      {/* Top row: 4 cards */}
      <section className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title={`${symbol} Price`}
            value={quoteData ? `$${quoteData.close.toFixed(2)}` : '--'}
            subtitle={quoteData ? `Vol: ${(((quoteData.volume ?? 0) / 1000000)).toFixed(1)}M` : ''}
            tooltip={`Current ${symbol} price and volume from the real-time quote feed.`}
            theme={theme}
          />
          <MetricCard
            title="Net GEX"
            value={formatGexInUnit(netGexAtSpot, gexUnit, gexSpot)}
            subtitle={unitLabel}
            trend={netGexPositive ? 'bullish' : 'bearish'}
            tooltip="Cumulative dealer gamma at the current spot price (sign-consistent with the gamma flip). Positive = dealer long gamma (pinning, mean-reversion). Negative = dealer short gamma (trending, vol amplification). Shown per 1% move by default; toggle to per 1 point above."
            theme={theme}
          />
          <MetricCard
            title="Gamma Flip"
            value={gexData?.gamma_flip != null ? `$${gexData.gamma_flip.toFixed(2)}` : 'N/A'}
            subtitle={
              gexData?.gamma_flip_raw != null
                ? `Raw nearest: $${gexData.gamma_flip_raw.toFixed(2)}`
                : 'Dealer positioning'
            }
            tooltip="Structural gamma flip: the price where aggregate net gamma changes sign, resolved away from near-spot noise crossings. Above it dealers tend to dampen volatility; below it they amplify it. 'Raw nearest' is the nearest raw zero-crossing to spot (no structural gating) — the figure some dashboards publish; it can oscillate intraday on a lumpy book."
            theme={theme}
          />
          <MetricCard
            title="Max Pain"
            value={gexData?.max_pain != null ? `$${gexData.max_pain.toFixed(2)}` : 'N/A'}
            subtitle="Options expiry target"
            tooltip="Estimated strike where option-holder payout is minimized at expiry. Acts as a magnetic level into expiration."
            theme={theme}
          />
        </div>
      </section>

      {/* Bottom row: 5 cards */}
      <section className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard
            title="Call GEX"
            value={formatGexInUnit(gexData?.total_call_gex, gexUnit, gexSpot)}
            subtitle={unitLabel}
            trend="neutral"
            tooltip="Total gamma exposure from call options. Higher values create upside resistance as dealers hedge by selling into rallies. Shown per 1% move by default; toggle to per 1 point above."
            theme={theme}
          />
          <MetricCard
            title="Put GEX"
            value={formatGexInUnit(gexData?.total_put_gex, gexUnit, gexSpot)}
            subtitle={unitLabel}
            trend="neutral"
            tooltip="Total gamma exposure from put options. Higher values create downside support as dealers hedge by buying into selloffs. Shown per 1% move by default; toggle to per 1 point above."
            theme={theme}
          />
          <MetricCard
            title="Put/Call Ratio"
            value={gexData?.put_call_ratio != null ? gexData.put_call_ratio.toFixed(2) : '--'}
            trend={gexData && (gexData.put_call_ratio ?? 0) > 1 ? 'bearish' : 'bullish'}
            tooltip="Ratio of put volume to call volume. >1 leans bearish; <1 leans bullish."
            theme={theme}
          />
          <MetricCard
            title="Call Wall (Resistance)"
            value={gexData?.call_wall != null ? `$${gexData.call_wall.toFixed(2)}` : 'N/A'}
            subtitle={
              gexData?.call_wall && quoteData?.close
                ? `${((gexData.call_wall - quoteData.close) / quoteData.close * 100) >= 0 ? '+' : ''}${((gexData.call_wall - quoteData.close) / quoteData.close * 100).toFixed(1)}% from spot`
                : 'Heavy call open interest'
            }
            tooltip="Strike with the heaviest call open interest. Tends to act as resistance as dealers sell into rallies toward it."
            theme={theme}
            trend="bearish"
          />
          <MetricCard
            title="Put Wall (Support)"
            value={gexData?.put_wall != null ? `$${gexData.put_wall.toFixed(2)}` : 'N/A'}
            subtitle={
              gexData?.put_wall && quoteData?.close
                ? `${((gexData.put_wall - quoteData.close) / quoteData.close * 100) >= 0 ? '+' : ''}${((gexData.put_wall - quoteData.close) / quoteData.close * 100).toFixed(1)}% from spot`
                : 'Heavy put open interest'
            }
            tooltip="Strike with the heaviest put open interest. Tends to act as support as dealers buy into selloffs toward it."
            theme={theme}
            trend="bullish"
          />
        </div>
      </section>

      <section className="mb-8">
        <div className="grid grid-cols-1 gap-4">
          <FlipTermStructureChart symbol={symbol} />
          <FlipSurfaceChart symbol={symbol} />
        </div>
      </section>

      <section className="mb-8">
        <GammaPulsePanel symbol={symbol} />
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
