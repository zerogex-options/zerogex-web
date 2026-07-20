'use client';

/**
 * Metric tiles for the customizable dashboard. Each is a tiny leaf that reads
 * the shared MyDashboardData context and renders the site-standard MetricCard /
 * PriceDistanceMetricCard — so a tile looks identical to its twin on the main
 * dashboard, and a board of tiles shares ONE set of data feeds.
 */

import MetricCard from '@/components/MetricCard';
import PriceDistanceMetricCard from '@/components/PriceDistanceMetricCard';
import HistoricalContextBadge from '@/components/HistoricalContextBadge';
import { getPrimaryPriceChangeSummary } from '@/core/priceChange';
import { isIndexSymbol } from '@/core/utils';
import { usePageT } from '@/core/LanguageContext';
import { useMyDashboardData } from './DashboardData';
import { dict } from './tiles.i18n';

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

export function PriceTile() {
  const t = usePageT(dict);
  const { symbol, theme, quote, sessionCloses } = useMyDashboardData();
  const underlyingPrice = getPrimaryPriceChangeSummary({
    quoteClose: quote?.close,
    quoteSession: quote?.session,
    sessionCloses,
    displaySource: quote?.display_source,
    futuresClose: quote?.futures_close,
    futuresReferenceClose: quote?.futures_reference_close,
  });
  const dashFuturesTicker =
    quote?.display_source === 'futures' ? quote?.data_symbol ?? 'FUT' : null;

  return (
    <MetricCard
      title={t('priceTitle', { symbol })}
      value={underlyingPrice.displayPrice != null ? `$${underlyingPrice.displayPrice.toFixed(2)}` : '--'}
      subtitle={
        <div className="flex flex-col gap-1">
          {dashFuturesTicker && (
            <span style={{ color: 'var(--color-brand-coral)', fontWeight: 600 }}>
              {t('priceFuturesLabel', { ticker: dashFuturesTicker })}
            </span>
          )}
          <span
            style={{
              color:
                underlyingPrice.change != null
                  ? underlyingPrice.isPositive
                    ? 'var(--color-bull)'
                    : 'var(--color-bear)'
                  : undefined,
            }}
          >
            {underlyingPrice.change != null && underlyingPrice.changePercent != null
              ? `${underlyingPrice.isPositive ? '+' : '-'}$${Math.abs(underlyingPrice.change).toFixed(2)} / ${underlyingPrice.isPositive ? '+' : '-'}${Math.abs(underlyingPrice.changePercent).toFixed(2)}%${dashFuturesTicker ? '' : ' vs previous'}`
              : t('priceAwaitingContext')}
          </span>
          {!isIndexSymbol(symbol) && (
            <span>{quote?.volume != null ? t('priceDayVol', { volume: Math.round(quote.volume).toLocaleString() }) : ''}</span>
          )}
        </div>
      }
      tooltip={t('priceTooltip', { symbol })}
      theme={theme}
      trend="neutral"
    />
  );
}

export function NetGexTile() {
  const t = usePageT(dict);
  const { theme, gex, historical } = useMyDashboardData();
  const netGex = gex?.net_gex_at_spot ?? gex?.net_gex;
  return (
    <MetricCard
      title={t('netGexTitle')}
      value={formatCompactUsd(netGex, true)}
      trend={(netGex ?? 0) > 0 ? 'bullish' : 'bearish'}
      tooltip={t('netGexTooltip')}
      theme={theme}
      contextBadge={
        <HistoricalContextBadge
          metric={historical?.metrics?.net_gex_at_spot}
          window="30d"
          trackingStartedAt={historical?.tracking_started_at}
        />
      }
    />
  );
}

export function GammaFlipTile() {
  const t = usePageT(dict);
  const { theme, gex, quote } = useMyDashboardData();
  return (
    <PriceDistanceMetricCard
      title={t('gammaFlipTitle')}
      level={gex?.gamma_flip}
      spotPrice={quote?.close}
      tooltip={t('gammaFlipTooltip')}
      theme={theme}
    />
  );
}

export function MaxPainTile() {
  const t = usePageT(dict);
  const { theme, gex, quote } = useMyDashboardData();
  return (
    <PriceDistanceMetricCard
      title={t('maxPainTitle')}
      level={gex?.max_pain}
      spotPrice={quote?.close}
      tooltip={t('maxPainTooltip')}
      theme={theme}
    />
  );
}

export function CallGexTile() {
  const t = usePageT(dict);
  const { theme, gex } = useMyDashboardData();
  return (
    <MetricCard
      title={t('callGexTitle')}
      value={formatCompactUsd(gex?.total_call_gex)}
      trend="neutral"
      tooltip={t('callGexTooltip')}
      theme={theme}
    />
  );
}

export function PutGexTile() {
  const t = usePageT(dict);
  const { theme, gex } = useMyDashboardData();
  return (
    <MetricCard
      title={t('putGexTitle')}
      value={formatCompactUsd(gex?.total_put_gex)}
      trend="neutral"
      tooltip={t('putGexTooltip')}
      theme={theme}
    />
  );
}

export function CallWallTile() {
  const t = usePageT(dict);
  const { theme, gex, quote } = useMyDashboardData();
  return (
    <MetricCard
      title={t('callWallTitle')}
      value={gex?.call_wall != null ? `$${gex.call_wall.toFixed(2)}` : 'N/A'}
      subtitle={
        gex?.call_wall && quote?.close
          ? `${((gex.call_wall - quote.close) / quote.close) * 100 >= 0 ? '+' : ''}${(((gex.call_wall - quote.close) / quote.close) * 100).toFixed(1)}% from spot`
          : t('callWallSubtitle')
      }
      tooltip={t('callWallTooltip')}
      theme={theme}
      trend="bearish"
    />
  );
}

export function PutWallTile() {
  const t = usePageT(dict);
  const { theme, gex, quote } = useMyDashboardData();
  return (
    <MetricCard
      title={t('putWallTitle')}
      value={gex?.put_wall != null ? `$${gex.put_wall.toFixed(2)}` : 'N/A'}
      subtitle={
        gex?.put_wall && quote?.close
          ? `${((gex.put_wall - quote.close) / quote.close) * 100 >= 0 ? '+' : ''}${(((gex.put_wall - quote.close) / quote.close) * 100).toFixed(1)}% from spot`
          : t('putWallSubtitle')
      }
      tooltip={t('putWallTooltip')}
      theme={theme}
      trend="bullish"
    />
  );
}

export function NetFlowTile() {
  const t = usePageT(dict);
  const { theme, flow } = useMyDashboardData();
  return (
    <MetricCard
      title={t('netFlowTitle')}
      value={Number(flow?.netFlow ?? 0).toLocaleString()}
      subtitle={t('netFlowSubtitle')}
      trend={Number(flow?.netFlow ?? 0) > 0 ? 'bullish' : 'bearish'}
      tooltip={t('netFlowTooltip')}
      theme={theme}
    />
  );
}

export function NetPremiumTile() {
  const t = usePageT(dict);
  const { theme, flow } = useMyDashboardData();
  const netPremium = Number(flow?.netPremium ?? 0);
  return (
    <MetricCard
      title={t('netPremiumTitle')}
      value={`${netPremium < 0 ? '-' : ''}$${(Math.abs(netPremium) / 1_000_000).toFixed(2)}M`}
      trend={netPremium > 0 ? 'bullish' : 'bearish'}
      tooltip={t('netPremiumTooltip')}
      theme={theme}
    />
  );
}

export function PutCallRatioTile() {
  const t = usePageT(dict);
  const { theme, flow } = useMyDashboardData();
  const ratio = Number(flow?.putCallRatio ?? 0);
  return (
    <MetricCard
      title={t('putCallRatioTitle')}
      value={ratio.toFixed(2)}
      trend={ratio > 1 ? 'bearish' : 'bullish'}
      tooltip={t('putCallRatioTooltip')}
      theme={theme}
    />
  );
}

export function VixTile() {
  const t = usePageT(dict);
  const { theme, vol, volIndex } = useMyDashboardData();
  return (
    <MetricCard
      title={t('vixTitle', { volIndex })}
      value={vol?.index != null ? vol.index.toFixed(2) : '--'}
      subtitle={
        vol?.level_label ? (
          <span className="capitalize">{`${vol.level_label} · ${vol.momentum_label ?? ''}`.trim()}</span>
        ) : (
          t('vixSubtitleFallback')
        )
      }
      tooltip={t('vixTooltip', { volIndex })}
      theme={theme}
      trend="neutral"
    />
  );
}
