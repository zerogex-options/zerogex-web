/**
 * Main Dashboard Page
 * Overview of key metrics with real-time data
 */

'use client';

import { useMemo } from 'react';
import { useGEXHistoricalContext, useGEXSummary, useMarketQuote, useSessionCloses, useVolatilityGauge } from '@/hooks/useApiData';
import { snapshotFromSeries, useFlowSeries } from '@/hooks/useFlowSeries';
import MetricCard from '@/components/MetricCard';
import PageShell from '@/components/layout/PageShell';
import SectionHead from '@/components/layout/SectionHead';
import HistoricalContextBadge from '@/components/HistoricalContextBadge';
import MarketMakerExposures from '@/components/MarketMakerExposures';
import PriceDistanceMetricCard from '@/components/PriceDistanceMetricCard';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import ProprietarySignalsSynthesis from '@/components/ProprietarySignalsSynthesis';
import { useTheme } from '@/core/ThemeContext';
import VolatilityCard from '@/components/VolatilityCard';
import TradeBiasSection from '@/components/TradeBiasSection';
import SignalsGuide from '@/components/SignalsGuide';
import TodaysReadCard from '@/components/TodaysReadCard';
import TrialStartedBanner from './TrialStartedBanner';
import { useTimeframe } from '@/core/TimeframeContext';
import { getPrimaryPriceChangeSummary } from '@/core/priceChange';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import { buildReportModel } from '@/app/live-bulletin/bulletinHelpers';
import { isIndexSymbol } from '@/core/utils';

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

export default function DashboardPage() {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  
  // Fetch data with different refresh intervals
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: historicalContext } = useGEXHistoricalContext(symbol, 15000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const { data: sessionClosesData } = useSessionCloses(symbol, 60000, quoteData?.session ?? null);
  const { rows: flowSeriesRows } = useFlowSeries(symbol, 'current', {
    incrementalMs: PROPRIETARY_SIGNALS_REFRESH.flowByTypeMs,
  });

  // "Today's Read" — auto-generated regime headline + lead paragraph reusing
  // the live-bulletin model so the dashboard's at-a-glance summary stays in
  // sync with the operator-facing bulletin and any downstream surfaces.
  // QQQ's correct implied-vol input is VXN; SPX/SPY use VIX.
  const volIndex: 'VIX' | 'VXN' = symbol === 'QQQ' ? 'VXN' : 'VIX';
  const { data: volGauge } = useVolatilityGauge(30000, volIndex);
  const todaysReadModel = useMemo(
    () =>
      buildReportModel({
        symbol,
        spot: quoteData?.close ?? gexData?.spot_price ?? null,
        priorClose: sessionClosesData?.current_session_close ?? null,
        summary: gexData ?? null,
        vix: volGauge?.index ?? null,
        volIndex,
        horizon: 'daily',
      }),
    [
      symbol,
      quoteData?.close,
      gexData,
      sessionClosesData?.current_session_close,
      volGauge?.index,
      volIndex,
    ],
  );

  const underlyingPrice = getPrimaryPriceChangeSummary({
    quoteClose: quoteData?.close,
    quoteSession: quoteData?.session,
    sessionCloses: sessionClosesData,
    displaySource: quoteData?.display_source,
    futuresClose: quoteData?.futures_close,
    futuresReferenceClose: quoteData?.futures_reference_close,
  });
  // Overnight index→future display swap: headline price card only. The GEX
  // spot, flip/max-pain distances, and Day Vol all stay on the cash index.
  const dashFuturesTicker =
    quoteData?.display_source === 'futures' ? quoteData?.data_symbol ?? 'FUT' : null;

  const latestFlowSnapshot = snapshotFromSeries(flowSeriesRows);

  // Desk-readout masthead values — the dashboard's focal point.
  const netGexAtSpot = gexData?.net_gex_at_spot ?? gexData?.net_gex ?? null;
  const longGamma = (netGexAtSpot ?? 0) >= 0;
  const flipLevel = gexData?.gamma_flip ?? null;
  const spotForFlip = underlyingPrice.displayPrice ?? quoteData?.close ?? gexData?.spot_price ?? null;
  const flipDist = flipLevel != null && spotForFlip != null ? spotForFlip - flipLevel : null;
  const flipPct = flipLevel != null && spotForFlip != null && flipLevel !== 0 ? ((spotForFlip - flipLevel) / flipLevel) * 100 : null;

  // Show loading state only on initial load
  if (gexLoading && !gexData) {
    return (
      <PageShell>
        <h1 className="zg-h1 mb-8">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
          <LoadingCard />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <TrialStartedBanner />
      {/* Desk readout — the dashboard's focal point: an oversized signed Net
          GEX with the regime word, flanked by spot and the gamma flip. */}
      <div className="zg-panel mb-8">
        <div className="flex flex-col md:flex-row">
          <div className="p-5 md:w-60 shrink-0">
            <div className="zg-eyebrow" style={{ color: 'var(--text-secondary)' }}>{symbol} · Spot</div>
            <div className="zg-metric" style={{ fontSize: 30, marginTop: 6 }}>
              {underlyingPrice.displayPrice != null ? `$${underlyingPrice.displayPrice.toFixed(2)}` : '--'}
            </div>
            <div
              className="zg-mono"
              style={{ fontSize: 12, marginTop: 4, color: underlyingPrice.change != null ? (underlyingPrice.isPositive ? 'var(--color-bull)' : 'var(--color-bear)') : 'var(--text-secondary)' }}
            >
              {underlyingPrice.change != null && underlyingPrice.changePercent != null
                ? `${underlyingPrice.isPositive ? '+' : '-'}$${Math.abs(underlyingPrice.change).toFixed(2)} · ${underlyingPrice.isPositive ? '+' : '-'}${Math.abs(underlyingPrice.changePercent).toFixed(2)}%`
                : '—'}
            </div>
          </div>
          <div className="p-5 flex-1 md:border-l" style={{ borderColor: 'var(--border-default)' }}>
            <div className="zg-eyebrow" style={{ color: 'var(--text-secondary)' }}>Net GEX at spot</div>
            <div
              className="zg-metric"
              style={{ fontSize: 'clamp(40px, 5.5vw, 66px)', lineHeight: 1.02, marginTop: 4, color: netGexAtSpot == null ? 'var(--text-primary)' : longGamma ? 'var(--color-bull)' : 'var(--color-bear)' }}
            >
              {formatCompactUsd(netGexAtSpot, true)}
            </div>
            <div style={{ marginTop: 10 }}>
              <span className="zg-label" style={{ color: netGexAtSpot == null ? 'var(--text-secondary)' : longGamma ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                {netGexAtSpot == null ? 'Regime —' : longGamma ? 'Long gamma' : 'Short gamma'}
              </span>
              <span className="zg-small" style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>
                {netGexAtSpot == null ? '' : longGamma ? 'dealers dampen — pinning, mean-reversion' : 'dealers accelerate — trending, vol expansion'}
              </span>
            </div>
          </div>
          <div className="p-5 md:w-60 shrink-0 md:border-l" style={{ borderColor: 'var(--border-default)' }}>
            <div className="zg-eyebrow" style={{ color: 'var(--text-secondary)' }}>Gamma Flip</div>
            <div className="zg-metric" style={{ fontSize: 30, marginTop: 6 }}>
              {flipLevel != null ? `$${flipLevel.toFixed(2)}` : '--'}
            </div>
            <div className="zg-mono" style={{ fontSize: 12, marginTop: 4, color: 'var(--text-secondary)' }}>
              {flipDist != null && flipPct != null
                ? `spot ${flipDist >= 0 ? '+' : ''}${flipDist.toFixed(2)} · ${flipPct >= 0 ? '+' : ''}${flipPct.toFixed(2)}%`
                : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Today's Read — at-a-glance regime summary above everything else, so a
          visitor lands on the dashboard and gets the structural read before
          the raw metric cards. Composed from the same buildReportModel used
          by /live-bulletin so the prose stays in lockstep with the operator
          surface. */}
      <div className="mb-8">
        <TodaysReadCard model={todaysReadModel} bulletinLink />
      </div>

      {/* Error Messages */}
      {gexError && (
        <div className="mb-4">
          <ErrorMessage message={gexError} onRetry={refetchGex} />
        </div>
      )}

      {/* Market Overview */}
      <section className="mb-8">
        <SectionHead title="Market Overview" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
          {/* Left column: 4 cards stacked, each sized to its content. */}
          <div className="md:col-span-1 grid grid-cols-1 gap-4 content-start">
            <MetricCard
              title={`${symbol} Price`}
              value={underlyingPrice.displayPrice != null ? `$${underlyingPrice.displayPrice.toFixed(2)}` : '--'}
              subtitle={(
                <div className="flex flex-col gap-1">
                  {dashFuturesTicker && (
                    <span style={{ color: 'var(--color-brand-coral)', fontWeight: 600 }}>
                      ◆ {dashFuturesTicker} futures
                    </span>
                  )}
                  <span
                    style={{
                      color: underlyingPrice.change != null
                        ? (underlyingPrice.isPositive ? 'var(--color-bull)' : 'var(--color-bear)')
                        : undefined,
                    }}
                  >
                    {underlyingPrice.change != null && underlyingPrice.changePercent != null
                      ? `${underlyingPrice.isPositive ? '+' : '-'}$${Math.abs(underlyingPrice.change).toFixed(2)} / ${underlyingPrice.isPositive ? '+' : '-'}${Math.abs(underlyingPrice.changePercent).toFixed(2)}%${dashFuturesTicker ? '' : ' vs previous'}`
                      : 'Awaiting previous-close context'}
                  </span>
                  {!isIndexSymbol(symbol) && (
                    <span>{quoteData?.volume != null ? `Day Vol: ${Math.round(quoteData.volume).toLocaleString()}` : ''}</span>
                  )}
                </div>
              )}
              tooltip={`Current ${symbol} closing price from the real-time quote feed.`}
              theme={theme}
              trend="neutral"
            />
            <MetricCard
              title="Net GEX"
              value={formatCompactUsd(gexData?.net_gex_at_spot ?? gexData?.net_gex, true)}
              trend={(gexData?.net_gex_at_spot ?? gexData?.net_gex ?? 0) > 0 ? 'bullish' : 'bearish'}
              tooltip="Cumulative dealer gamma at the current spot price (the value of the same low→high cumulative-net-GEX curve whose zero crossing is the gamma flip, so it stays sign-consistent with it). Positive = dealers net long gamma (hedging dampens moves — pinning, mean-reversion, lower vol). Negative = dealers net short gamma (hedging amplifies moves — trending, higher vol). The regime flips at the gamma flip level."
              theme={theme}
              contextBadge={
                <HistoricalContextBadge
                  metric={historicalContext?.metrics?.net_gex_at_spot}
                  window="30d"
                  trackingStartedAt={historicalContext?.tracking_started_at}
                />
              }
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
          {/* The chart fills cols 2-4 by absolute-positioning inside the grid
              cell — that keeps the SVG's natural max-content from pushing the
              row tracks past the card column's stacked height, so the tile
              matches the 4-card column's size exactly. */}
          <div className="md:col-span-3 md:relative">
            <div className="md:absolute md:inset-0">
              <MarketMakerExposures compact />
            </div>
          </div>
        </div>
      </section>


      {/* How-to-read explainer (collapsed by default) */}
      <SignalsGuide current="trade-bias" />

      {/* Trade Bias Engine */}
      <TradeBiasSection />

      {/* Proprietary Signals + Volatility Monitor side-by-side.
          Proprietary takes 8/12 cols so its MSI-on-top + Breadth/Regime-below
          layout has room; Vol Monitor takes 4/12 with its gauges stacked
          vertically to fill the narrower sidebar. Both sections use
          flex-col + flex-1 inside so the inner content stretches to match
          the taller section, keeping the two columns visually flush. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-stretch">
        <section className="lg:col-span-8 flex flex-col">
          <h3 className="zg-h3 mb-4">Proprietary Signals</h3>
          <div className="flex-1 min-h-0">
            <ProprietarySignalsSynthesis />
          </div>
        </section>

        <section className="lg:col-span-4 flex flex-col">
          <h3 className="zg-h3 mb-4">Volatility Monitor</h3>
          <div className="flex-1 min-h-0">
            <VolatilityCard stacked />
          </div>
        </section>
      </div>

      {/* Positioning & Flow — full-width section: 4-wide gamma row on top,
          3-wide flow row below. Merged from the prior 'Gamma Exposure' (4
          cards) and 'Options Sentiment' (3 cards) sections so the related
          dealer/flow metrics live under one header. */}
      <section className="mb-8">
        <SectionHead title="Positioning & Flow" />
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        </div>
      </section>

      {/* Data Freshness */}
      {gexData && (
        <div className="text-right text-sm text-[var(--text-muted)]">
          Last updated: {new Date(gexData.timestamp).toLocaleTimeString()}
        </div>
      )}
    </PageShell>
  );
}
