/**
 * GEX Summary Page
 * Headline GEX numbers, key dealer levels, and options sentiment.
 */

'use client';

import PageShell from '@/components/layout/PageShell';
import { useGEXSummary, useMarketQuote } from '@/hooks/useApiData';
import MetricCard from '@/components/MetricCard';
import { LoadingCard } from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import FlipTermStructureChart from '@/components/FlipTermStructureChart';
import FlipSurfaceChart from '@/components/FlipSurfaceChart';
import GammaPulsePanel from '@/components/GammaPulsePanel';
import GexUnitToggle from '@/components/GexUnitToggle';
import { useTheme } from '@/core/ThemeContext';
import { useTimeframe } from '@/core/TimeframeContext';
import { GexUnit, GEX_UNIT_LABEL, gexScaleFactor, useGexUnit } from '@/core/GexUnitContext';
import { isIndexSymbol } from '@/core/utils';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

function formatGexValue(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '';
  if (abs >= 1e9) return `${sign}$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(value / 1e3).toFixed(0)}K`;
  return `${sign}$${value.toFixed(0)}`;
}

// Dollar GEX is stored in the "per 1% move" convention; the unit toggle
// (GexUnitContext) reinterprets it via gexScaleFactor. Display-only — the
// stored value is unchanged.
function formatGexInUnit(value: number | null | undefined, unit: GexUnit, spot: number): string {
  if (value == null) return '--';
  return formatGexValue(value * gexScaleFactor(unit, spot));
}

export default function GreeksGEXPage() {
  const t = usePageT(dict);
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  // Fetch data with different refresh intervals
  const { data: gexData, loading: gexLoading, error: gexError, refetch: refetchGex } = useGEXSummary(symbol, 5000);
  const { data: quoteData } = useMarketQuote(symbol, 1000);
  const netGexAtSpot = gexData?.net_gex_at_spot ?? gexData?.net_gex ?? null;
  const netGexPositive = (netGexAtSpot ?? 0) >= 0;

  // Net/Call/Put GEX unit toggle (shared across all GEX views via
  // GexUnitContext). Stored values are "per 1% move"; the toggle
  // reinterprets them as "per 1 point move" so the headline magnitude
  // lines up with point-convention dashboards.
  const { gexUnit } = useGexUnit();
  // gexSpot MUST stay the cash index (never the future) — it scales the GEX
  // "per 1 point" conversion. The futures display swap is additive, so
  // quoteData.close is always the index; the futures price lives in
  // futures_close and is only read for the headline price below.
  const gexSpot = quoteData?.close ?? gexData?.spot_price ?? 0;
  const unitLabel = GEX_UNIT_LABEL[gexUnit];

  // Overnight index→future display swap for the headline price card only.
  const isFuturesQuote = quoteData?.display_source === 'futures';
  const quoteDisplayPrice =
    isFuturesQuote && quoteData?.futures_close != null
      ? quoteData.futures_close
      : quoteData?.close;
  const futuresTicker = isFuturesQuote ? quoteData?.data_symbol ?? 'FUT' : null;

  // Show loading state only on initial load
  if (gexLoading && !gexData) {
    return (
      <PageShell>
        <h1 className="text-3xl font-bold mb-8">{t('pageTitle')}</h1>
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
      </PageShell>
    );
  }

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-8">{t('pageTitle')}</h1>

      {/* Error Messages */}
      {gexError && (
        <div className="mb-4">
          <ErrorMessage message={gexError} onRetry={refetchGex} />
        </div>
      )}

      {/* GEX unit toggle: per 1% move (stored convention) vs per 1 point */}
      <div className="mb-4">
        <GexUnitToggle />
      </div>

      {/* Top row: 4 cards */}
      <section className="mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title={t('priceTitle', { symbol })}
            value={quoteData && quoteDisplayPrice != null ? `$${quoteDisplayPrice.toFixed(2)}` : '--'}
            subtitle={
              futuresTicker
                ? t('futuresSubtitle', { ticker: futuresTicker })
                : quoteData && !isIndexSymbol(symbol)
                  ? t('volSubtitle', { vol: (((quoteData.volume ?? 0) / 1000000)).toFixed(1) })
                  : ''
            }
            subtitleColor={futuresTicker ? 'var(--color-brand-coral)' : undefined}
            tooltip={
              futuresTicker
                ? t('futuresTooltip', { symbol, ticker: futuresTicker })
                : isIndexSymbol(symbol)
                  ? t('indexTooltip', { symbol })
                  : t('stockTooltip', { symbol })
            }
            theme={theme}
          />
          <MetricCard
            title={t('netGexTitle')}
            value={formatGexInUnit(netGexAtSpot, gexUnit, gexSpot)}
            subtitle={unitLabel}
            trend={netGexPositive ? 'bullish' : 'bearish'}
            tooltip={t('netGexTooltip')}
            theme={theme}
          />
          <MetricCard
            title={t('gammaFlipTitle')}
            value={gexData?.gamma_flip != null ? `$${gexData.gamma_flip.toFixed(2)}` : 'N/A'}
            subtitle={
              gexData?.gamma_flip_raw != null
                ? t('rawNearest', { value: `$${gexData.gamma_flip_raw.toFixed(2)}` })
                : t('dealerPositioning')
            }
            tooltip={t('gammaFlipTooltip')}
            theme={theme}
          />
          <MetricCard
            title={t('maxPainTitle')}
            value={gexData?.max_pain != null ? `$${gexData.max_pain.toFixed(2)}` : 'N/A'}
            subtitle={t('maxPainSubtitle')}
            tooltip={t('maxPainTooltip')}
            theme={theme}
          />
        </div>
      </section>

      {/* Bottom row: 5 cards */}
      <section className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard
            title={t('callGexTitle')}
            value={formatGexInUnit(gexData?.total_call_gex, gexUnit, gexSpot)}
            subtitle={unitLabel}
            trend="neutral"
            tooltip={t('callGexTooltip')}
            theme={theme}
          />
          <MetricCard
            title={t('putGexTitle')}
            value={formatGexInUnit(gexData?.total_put_gex, gexUnit, gexSpot)}
            subtitle={unitLabel}
            trend="neutral"
            tooltip={t('putGexTooltip')}
            theme={theme}
          />
          <MetricCard
            title={t('putCallRatioTitle')}
            value={gexData?.put_call_ratio != null ? gexData.put_call_ratio.toFixed(2) : '--'}
            trend={gexData && (gexData.put_call_ratio ?? 0) > 1 ? 'bearish' : 'bullish'}
            tooltip={t('putCallRatioTooltip')}
            theme={theme}
          />
          <MetricCard
            title={t('callWallTitle')}
            value={gexData?.call_wall != null ? `$${gexData.call_wall.toFixed(2)}` : 'N/A'}
            subtitle={
              gexData?.call_wall && quoteData?.close
                ? t('fromSpot', {
                    pct: `${((gexData.call_wall - quoteData.close) / quoteData.close * 100) >= 0 ? '+' : ''}${((gexData.call_wall - quoteData.close) / quoteData.close * 100).toFixed(1)}`,
                  })
                : t('callWallDefaultSubtitle')
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
                ? t('fromSpot', {
                    pct: `${((gexData.put_wall - quoteData.close) / quoteData.close * 100) >= 0 ? '+' : ''}${((gexData.put_wall - quoteData.close) / quoteData.close * 100).toFixed(1)}`,
                  })
                : t('putWallDefaultSubtitle')
            }
            tooltip={t('putWallTooltip')}
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
          {t('lastUpdated', { time: new Date(gexData.timestamp).toLocaleTimeString() })}
        </div>
      )}
    </PageShell>
  );
}
