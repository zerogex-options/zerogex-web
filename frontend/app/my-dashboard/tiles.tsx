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
import { useMyDashboardData } from './DashboardData';

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
      title={`${symbol} Price`}
      value={underlyingPrice.displayPrice != null ? `$${underlyingPrice.displayPrice.toFixed(2)}` : '--'}
      subtitle={
        <div className="flex flex-col gap-1">
          {dashFuturesTicker && (
            <span style={{ color: 'var(--color-brand-coral)', fontWeight: 600 }}>
              ◆ {dashFuturesTicker} futures
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
              : 'Awaiting previous-close context'}
          </span>
          {!isIndexSymbol(symbol) && (
            <span>{quote?.volume != null ? `Day Vol: ${Math.round(quote.volume).toLocaleString()}` : ''}</span>
          )}
        </div>
      }
      tooltip={`Current ${symbol} price from the real-time quote feed.`}
      theme={theme}
      trend="neutral"
    />
  );
}

export function NetGexTile() {
  const { theme, gex, historical } = useMyDashboardData();
  const netGex = gex?.net_gex_at_spot ?? gex?.net_gex;
  return (
    <MetricCard
      title="Net GEX"
      value={formatCompactUsd(netGex, true)}
      trend={(netGex ?? 0) > 0 ? 'bullish' : 'bearish'}
      tooltip="Cumulative dealer gamma at the current spot price. Positive = dealers net long gamma (hedging dampens moves — pinning, mean-reversion, lower vol). Negative = dealers net short gamma (hedging amplifies moves — trending, higher vol). The regime flips at the gamma flip level."
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
  const { theme, gex, quote } = useMyDashboardData();
  return (
    <PriceDistanceMetricCard
      title="Gamma Flip"
      level={gex?.gamma_flip}
      spotPrice={quote?.close}
      tooltip="Price where aggregate net gamma changes sign. The card shows the live dollar and percent distance from the current underlying so you can judge whether spot is above or below the flip."
      theme={theme}
    />
  );
}

export function MaxPainTile() {
  const { theme, gex, quote } = useMyDashboardData();
  return (
    <PriceDistanceMetricCard
      title="Max Pain"
      level={gex?.max_pain}
      spotPrice={quote?.close}
      tooltip="Estimated strike where option-holder payout is minimized at expiry. The card shows the live dollar and percent distance from the current underlying so you can gauge how far spot is from the options pin."
      theme={theme}
    />
  );
}

export function CallGexTile() {
  const { theme, gex } = useMyDashboardData();
  return (
    <MetricCard
      title="Call GEX"
      value={formatCompactUsd(gex?.total_call_gex)}
      trend="neutral"
      tooltip="Total gamma exposure from call options. Higher values indicate strong call positioning, which creates upside resistance as dealers hedge by selling into rallies."
      theme={theme}
    />
  );
}

export function PutGexTile() {
  const { theme, gex } = useMyDashboardData();
  return (
    <MetricCard
      title="Put GEX"
      value={formatCompactUsd(gex?.total_put_gex)}
      trend="neutral"
      tooltip="Total gamma exposure from put options. Higher values indicate strong put positioning, which creates downside support as dealers hedge by buying into selloffs."
      theme={theme}
    />
  );
}

export function CallWallTile() {
  const { theme, gex, quote } = useMyDashboardData();
  return (
    <MetricCard
      title="Call Wall (Resistance)"
      value={gex?.call_wall != null ? `$${gex.call_wall.toFixed(2)}` : 'N/A'}
      subtitle={
        gex?.call_wall && quote?.close
          ? `${((gex.call_wall - quote.close) / quote.close) * 100 >= 0 ? '+' : ''}${(((gex.call_wall - quote.close) / quote.close) * 100).toFixed(1)}% from spot`
          : 'Heavy call open interest'
      }
      tooltip="Strike with the heaviest call open interest. Tends to act as resistance as dealers sell into rallies toward it."
      theme={theme}
      trend="bearish"
    />
  );
}

export function PutWallTile() {
  const { theme, gex, quote } = useMyDashboardData();
  return (
    <MetricCard
      title="Put Wall (Support)"
      value={gex?.put_wall != null ? `$${gex.put_wall.toFixed(2)}` : 'N/A'}
      subtitle={
        gex?.put_wall && quote?.close
          ? `${((gex.put_wall - quote.close) / quote.close) * 100 >= 0 ? '+' : ''}${(((gex.put_wall - quote.close) / quote.close) * 100).toFixed(1)}% from spot`
          : 'Heavy put open interest'
      }
      tooltip="Strike with the heaviest put open interest. Tends to act as support as dealers buy into selloffs toward it."
      theme={theme}
      trend="bullish"
    />
  );
}

export function NetFlowTile() {
  const { theme, flow } = useMyDashboardData();
  return (
    <MetricCard
      title="Net Flow"
      value={Number(flow?.netFlow ?? 0).toLocaleString()}
      subtitle="contracts"
      trend={Number(flow?.netFlow ?? 0) > 0 ? 'bullish' : 'bearish'}
      tooltip="Cumulative call volume minus put volume for the current session."
      theme={theme}
    />
  );
}

export function NetPremiumTile() {
  const { theme, flow } = useMyDashboardData();
  const netPremium = Number(flow?.netPremium ?? 0);
  return (
    <MetricCard
      title="Net Premium"
      value={`${netPremium < 0 ? '-' : ''}$${(Math.abs(netPremium) / 1_000_000).toFixed(2)}M`}
      trend={netPremium > 0 ? 'bullish' : 'bearish'}
      tooltip="Cumulative call premium minus put premium for the current session."
      theme={theme}
    />
  );
}

export function PutCallRatioTile() {
  const { theme, flow } = useMyDashboardData();
  const ratio = Number(flow?.putCallRatio ?? 0);
  return (
    <MetricCard
      title="Put/Call Ratio"
      value={ratio.toFixed(2)}
      trend={ratio > 1 ? 'bearish' : 'bullish'}
      tooltip="Cumulative put volume divided by cumulative call volume for the current session."
      theme={theme}
    />
  );
}

export function VixTile() {
  const { theme, vol, volIndex } = useMyDashboardData();
  return (
    <MetricCard
      title={`${volIndex} Level`}
      value={vol?.index != null ? vol.index.toFixed(2) : '--'}
      subtitle={
        vol?.level_label ? (
          <span className="capitalize">{`${vol.level_label} · ${vol.momentum_label ?? ''}`.trim()}</span>
        ) : (
          'Implied volatility'
        )
      }
      tooltip={`${volIndex} implied-volatility index — the market's expected 30-day volatility. Rising ${volIndex} signals fear / demand for protection; falling signals calm.`}
      theme={theme}
      trend="neutral"
    />
  );
}
