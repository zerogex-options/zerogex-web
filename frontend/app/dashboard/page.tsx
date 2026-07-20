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
import Collapsible from '@/components/Collapsible';
import TrialStartedBanner from './TrialStartedBanner';
import { useTimeframe } from '@/core/TimeframeContext';
import { useDensity } from '@/core/DensityContext';
import { getPrimaryPriceChangeSummary } from '@/core/priceChange';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import { buildReportModel } from '@/app/live-bulletin/bulletinHelpers';
import { isIndexSymbol } from '@/core/utils';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

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

function DensityToggle() {
  const { density, setDensity } = useDensity();
  const t = usePageT(dict);
  return (
    <div
      className="inline-flex rounded-md border overflow-hidden text-xs"
      style={{ borderColor: 'var(--color-border)' }}
      role="group"
      aria-label={t('densityAriaLabel')}
    >
      {(['simple', 'detailed'] as const).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => setDensity(d)}
          className="px-3 py-1.5 font-medium capitalize"
          aria-pressed={density === d}
          style={{
            background: density === d ? 'var(--color-info-soft)' : 'transparent',
            color: density === d ? 'var(--color-info)' : 'var(--color-text-secondary)',
          }}
        >
          {d}
        </button>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  const { density, detailed } = useDensity();
  const t = usePageT(dict);

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

  // Show loading state only on initial load
  if (gexLoading && !gexData) {
    return (
      <PageShell>
        <h1 className="zg-h1 mb-8">{t('dashboardTitle')}</h1>
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

      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="zg-h1">{t('dashboardTitle')}</h1>
        <DensityToggle />
      </div>

      {/* Today's Read — the auto-generated regime prose. Collapsed by default in
          Simple mode so the dashboard opens glance-first; the compact Trade Bias
          summary below carries the at-a-glance directional read. Composed from
          the same buildReportModel as /live-bulletin so the two stay in sync. */}
      <Collapsible
        key={`todays-read-${density}`}
        title={t('todaysReadTitle')}
        subtitle={t('todaysReadSubtitle')}
        defaultOpen={detailed}
      >
        <TodaysReadCard model={todaysReadModel} bulletinLink />
      </Collapsible>

      {/* Error Messages */}
      {gexError && (
        <div className="mb-4">
          <ErrorMessage message={gexError} onRetry={refetchGex} />
        </div>
      )}

      {/* Market Overview */}
      <section className="mb-8">
        <SectionHead title={t('marketOverviewTitle')} />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-stretch">
          {/* Left column: 4 cards stacked, each sized to its content. */}
          <div className="md:col-span-1 grid grid-cols-1 gap-4 content-start">
            <MetricCard
              title={t('symbolPriceTitle', { symbol })}
              value={underlyingPrice.displayPrice != null ? `$${underlyingPrice.displayPrice.toFixed(2)}` : '--'}
              subtitle={(
                <div className="flex flex-col gap-1">
                  {dashFuturesTicker && (
                    <span style={{ color: 'var(--color-brand-coral)', fontWeight: 600 }}>
                      {t('futuresLabel', { ticker: dashFuturesTicker })}
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
                      ? `${underlyingPrice.isPositive ? '+' : '-'}$${Math.abs(underlyingPrice.change).toFixed(2)} / ${underlyingPrice.isPositive ? '+' : '-'}${Math.abs(underlyingPrice.changePercent).toFixed(2)}%${dashFuturesTicker ? '' : t('vsPrevious')}`
                      : t('awaitingPrevClose')}
                  </span>
                  {!isIndexSymbol(symbol) && (
                    <span>{quoteData?.volume != null ? t('dayVolLabel', { value: Math.round(quoteData.volume).toLocaleString() }) : ''}</span>
                  )}
                </div>
              )}
              tooltip={t('priceTooltip', { symbol })}
              theme={theme}
              trend="neutral"
            />
            <MetricCard
              title={t('netGexTitle')}
              value={formatCompactUsd(gexData?.net_gex_at_spot ?? gexData?.net_gex, true)}
              trend={(gexData?.net_gex_at_spot ?? gexData?.net_gex ?? 0) > 0 ? 'bullish' : 'bearish'}
              tooltip={t('netGexTooltip')}
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
              title={t('gammaFlipTitle')}
              level={gexData?.gamma_flip}
              spotPrice={quoteData?.close}
              tooltip={t('gammaFlipTooltip')}
              theme={theme}
            />
            <PriceDistanceMetricCard
              title={t('maxPainTitle')}
              level={gexData?.max_pain}
              spotPrice={quoteData?.close}
              tooltip={t('maxPainTooltip')}
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


      {/* Trade Bias — compact glance-first summary; the full regime / bias /
          playbook breakdown + the Intraday/Swing horizon now live on the
          dedicated /trade-bias page. */}
      <TradeBiasSection compact />

      {/* How-to-read explainer (collapsed by default) */}
      <SignalsGuide current="trade-bias" />

      {/* Proprietary Signals + Volatility Monitor — the detailed synthesis.
          Collapsed by default in Simple mode; expanded in Detailed. Proprietary
          takes 8/12 cols; Vol Monitor 4/12 with gauges stacked. */}
      <Collapsible
        key={`signals-vol-${density}`}
        title={t('signalsVolTitle')}
        subtitle={t('signalsVolSubtitle')}
        defaultOpen={detailed}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <section className="lg:col-span-8 flex flex-col">
            <h3 className="zg-h3 mb-4">{t('proprietarySignalsHeading')}</h3>
            <div className="flex-1 min-h-0">
              <ProprietarySignalsSynthesis />
            </div>
          </section>

          <section className="lg:col-span-4 flex flex-col">
            <h3 className="zg-h3 mb-4">{t('volatilityMonitorHeading')}</h3>
            <div className="flex-1 min-h-0">
              <VolatilityCard stacked />
            </div>
          </section>
        </div>
      </Collapsible>

      {/* Positioning & Flow — dealer gamma walls (4-wide) + session flow
          (3-wide). Collapsed by default in Simple mode. */}
      <Collapsible
        key={`positioning-${density}`}
        title={t('positioningTitle')}
        subtitle={t('positioningSubtitle')}
        defaultOpen={detailed}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              title={t('callGexTitle')}
              value={formatCompactUsd(gexData?.total_call_gex)}
              trend="neutral"
              tooltip={t('callGexTooltip')}
              theme={theme}
            />
            <MetricCard
              title={t('putGexTitle')}
              value={formatCompactUsd(gexData?.total_put_gex)}
              trend="neutral"
              tooltip={t('putGexTooltip')}
              theme={theme}
            />
            <MetricCard
              title={t('callWallTitle')}
              value={gexData?.call_wall != null ? `$${gexData.call_wall.toFixed(2)}` : 'N/A'}
              subtitle={
                gexData?.call_wall && quoteData?.close
                  ? `${((gexData.call_wall - quoteData.close) / quoteData.close * 100) >= 0 ? '+' : ''}${((gexData.call_wall - quoteData.close) / quoteData.close * 100).toFixed(1)}${t('fromSpotSuffix')}`
                  : t('callWallFallback')
              }
              tooltip={t('callWallTooltip')}
              theme={theme}
              trend="bearish"
            />
            <MetricCard
              title={t('putWallTitle')}
              value={gexData?.put_wall != null ? `$${gexData.put_wall.toFixed(2)}` : 'N/A'}
              subtitle={
                gexData?.put_wall && quoteData?.close
                  ? `${((gexData.put_wall - quoteData.close) / quoteData.close * 100) >= 0 ? '+' : ''}${((gexData.put_wall - quoteData.close) / quoteData.close * 100).toFixed(1)}${t('fromSpotSuffix')}`
                  : t('putWallFallback')
              }
              tooltip={t('putWallTooltip')}
              theme={theme}
              trend="bullish"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title={t('netFlowTitle')}
              value={Number(latestFlowSnapshot?.netFlow ?? 0).toLocaleString()}
              subtitle={t('netFlowSubtitle')}
              trend={Number(latestFlowSnapshot?.netFlow ?? 0) > 0 ? "bullish" : "bearish"}
              tooltip={t('netFlowTooltip')}
              theme={theme}
            />
            <MetricCard
              title={t('netPremiumTitle')}
              value={`${Number(latestFlowSnapshot?.netPremium ?? 0) < 0 ? '-' : ''}$${(Math.abs(Number(latestFlowSnapshot?.netPremium ?? 0)) / 1_000_000).toFixed(2)}M`}
              trend={Number(latestFlowSnapshot?.netPremium ?? 0) > 0 ? "bullish" : "bearish"}
              tooltip={t('netPremiumTooltip')}
              theme={theme}
            />
            <MetricCard
              title={t('putCallRatioTitle')}
              value={Number(latestFlowSnapshot?.putCallRatio ?? 0).toFixed(2)}
              trend={Number(latestFlowSnapshot?.putCallRatio ?? 0) > 1 ? 'bearish' : 'bullish'}
              tooltip={t('putCallRatioTooltip')}
              theme={theme}
            />
          </div>
        </div>
      </Collapsible>

      {/* Data Freshness */}
      {gexData && (
        <div className="text-right text-sm text-[var(--text-muted)]">
          {t('lastUpdatedLabel', { time: new Date(gexData.timestamp).toLocaleTimeString() })}
        </div>
      )}
    </PageShell>
  );
}
