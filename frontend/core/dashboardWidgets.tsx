'use client';

/**
 * Dashboard widget registry.
 *
 * Each entry turns a piece of the old hardcoded dashboard into an
 * individually placeable widget. Sizes are fixed per widget (the product
 * decision was to lock card/chart sizes), so there is no resize concept —
 * only ordering and show/hide.
 */

import { ReactNode } from 'react';
import MetricCard from '@/components/MetricCard';
import PriceDistanceMetricCard from '@/components/PriceDistanceMetricCard';
import VolatilityCard from '@/components/VolatilityCard';
import TradeBiasSection from '@/components/TradeBiasSection';
import { Theme } from '@/core/types';
import {
  DASHBOARD_WIDGET_IDS,
  DashboardWidgetId,
  isDashboardWidgetId,
} from '@/core/dashboardWidgetIds';

export type WidgetState = { id: DashboardWidgetId; visible: boolean };

type FlowSnapshot = {
  netFlow?: number;
  netPremium?: number;
  putCallRatio?: number;
} | null;

type PriceSummary = {
  displayPrice: number | null;
  change: number | null;
  changePercent: number | null;
  isPositive: boolean;
};

/** Everything a widget's render fn may need. Built once by the page from its hooks. */
export type DashboardWidgetCtx = {
  symbol: string;
  theme: Theme;
  gexData: {
    net_gex?: number | null;
    gamma_flip?: number | null;
    max_pain?: number | null;
    total_call_gex?: number | null;
    total_put_gex?: number | null;
    call_wall?: number | null;
    put_wall?: number | null;
  } | null;
  quoteData: { close?: number | null; volume?: number | null } | null;
  underlyingPrice: PriceSummary;
  compositeScore: number | undefined;
  compositeRegimeLabel: string;
  signaledTradeCount: number;
  cumulativePnl: number;
  winRate: number | null;
  winRateColor: string;
  latestFlowSnapshot: FlowSnapshot;
};

type WidgetKind = 'header' | 'card';

/**
 * Fixed Tailwind span classes. These MUST stay as complete literal strings —
 * Tailwind v4 generates utilities by scanning source for literal class names,
 * so a computed string like `lg:col-span-${n}` would never be emitted.
 */
const SPAN_CLASS = {
  full: 'col-span-1 md:col-span-2 lg:col-span-4',
  half: 'col-span-1 md:col-span-2 lg:col-span-2',
  quarter: 'col-span-1 md:col-span-1 lg:col-span-1',
} as const;

type WidgetSpan = keyof typeof SPAN_CLASS;

export type WidgetDef = {
  id: DashboardWidgetId;
  kind: WidgetKind;
  /** Human label shown in the "add widget" picker. */
  label: string;
  span: WidgetSpan;
  render: (ctx: DashboardWidgetCtx) => ReactNode;
};

export function spanClassFor(span: WidgetSpan): string {
  return SPAN_CLASS[span];
}

function formatUsd(value: number): string {
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

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

function SectionHeader({ children }: { children: ReactNode }) {
  return <h2 className="text-2xl font-semibold">{children}</h2>;
}

const WIDGETS: WidgetDef[] = [
  {
    id: 'sec-market',
    kind: 'header',
    label: 'Heading: Market Overview',
    span: 'full',
    render: () => <SectionHeader>Market Overview</SectionHeader>,
  },
  {
    id: 'price',
    kind: 'card',
    label: 'Underlying Price',
    span: 'quarter',
    render: (ctx) => (
      <MetricCard
        title={`${ctx.symbol} Price`}
        value={ctx.underlyingPrice.displayPrice != null ? `$${ctx.underlyingPrice.displayPrice.toFixed(2)}` : '--'}
        subtitle={(
          <div className="flex flex-col gap-1">
            <span
              style={{
                color: ctx.underlyingPrice.change != null
                  ? (ctx.underlyingPrice.isPositive ? 'var(--color-bull)' : 'var(--color-bear)')
                  : undefined,
              }}
            >
              {ctx.underlyingPrice.change != null && ctx.underlyingPrice.changePercent != null
                ? `${ctx.underlyingPrice.isPositive ? '+' : '-'}$${Math.abs(ctx.underlyingPrice.change).toFixed(2)} / ${ctx.underlyingPrice.isPositive ? '+' : '-'}${Math.abs(ctx.underlyingPrice.changePercent).toFixed(2)}% vs previous`
                : 'Awaiting previous-close context'}
            </span>
            <span>{ctx.quoteData?.volume != null ? `Day Vol: ${Math.round(ctx.quoteData.volume).toLocaleString()}` : ''}</span>
          </div>
        )}
        tooltip={`Current ${ctx.symbol} closing price from the real-time quote feed.`}
        theme={ctx.theme}
        trend="neutral"
      />
    ),
  },
  {
    id: 'net-gex',
    kind: 'card',
    label: 'Net GEX',
    span: 'quarter',
    render: (ctx) => (
      <MetricCard
        title="Net GEX"
        value={formatCompactUsd(ctx.gexData?.net_gex, true)}
        trend={ctx.gexData && ctx.gexData.net_gex != null && ctx.gexData.net_gex > 0 ? 'bullish' : 'bearish'}
        tooltip="Cumulative dealer gamma at the current spot price (the value of the same low→high cumulative-net-GEX curve whose zero crossing is the gamma flip, so it stays sign-consistent with it). Positive = dealers net long gamma (hedging dampens moves — pinning, mean-reversion, lower vol). Negative = dealers net short gamma (hedging amplifies moves — trending, higher vol). The regime flips at the gamma flip level."
        theme={ctx.theme}
      />
    ),
  },
  {
    id: 'gamma-flip',
    kind: 'card',
    label: 'Gamma Flip',
    span: 'quarter',
    render: (ctx) => (
      <PriceDistanceMetricCard
        title="Gamma Flip"
        level={ctx.gexData?.gamma_flip}
        spotPrice={ctx.quoteData?.close}
        tooltip="Price where aggregate net gamma changes sign. The card also shows the live dollar and percent distance from the current underlying so you can quickly judge whether spot is above or below the flip."
        theme={ctx.theme}
      />
    ),
  },
  {
    id: 'max-pain',
    kind: 'card',
    label: 'Max Pain',
    span: 'quarter',
    render: (ctx) => (
      <PriceDistanceMetricCard
        title="Max Pain"
        level={ctx.gexData?.max_pain}
        spotPrice={ctx.quoteData?.close}
        tooltip="Estimated strike where option-holder payout is minimized at expiry. The card also shows the live dollar and percent distance from the current underlying so you can gauge how far spot is from the options pin."
        theme={ctx.theme}
      />
    ),
  },
  {
    id: 'sec-trade-bias',
    kind: 'header',
    label: 'Heading: Trade Bias Engine',
    span: 'full',
    render: () => <SectionHeader>Trade Bias Engine</SectionHeader>,
  },
  {
    id: 'trade-bias',
    kind: 'card',
    label: 'Trade Bias Engine',
    span: 'full',
    render: () => <TradeBiasSection />,
  },
  {
    id: 'sec-signals',
    kind: 'header',
    label: 'Heading: Proprietary Signals',
    span: 'full',
    render: () => <SectionHeader>Proprietary Signals</SectionHeader>,
  },
  {
    id: 'composite-score',
    kind: 'card',
    label: 'Composite Score',
    span: 'quarter',
    render: (ctx) => (
      <MetricCard
        title="Composite Score"
        value={typeof ctx.compositeScore === 'number' ? ctx.compositeScore.toFixed(2) : '--'}
        subtitle={ctx.compositeRegimeLabel}
        tooltip="UnifiedSignalEngine composite signal score and current actionable regime label."
        theme={ctx.theme}
        trend={typeof ctx.compositeScore !== 'number' ? 'neutral' : ctx.compositeScore > 0 ? 'bullish' : ctx.compositeScore < 0 ? 'bearish' : 'neutral'}
      />
    ),
  },
  {
    id: 'signaled-trades',
    kind: 'card',
    label: 'Signaled Trades Today',
    span: 'quarter',
    render: (ctx) => (
      <MetricCard
        title="Signaled Trades Today"
        value={ctx.signaledTradeCount}
        subtitle={(
          <span>
            PnL{' '}
            <span style={{ color: ctx.cumulativePnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
              {ctx.cumulativePnl >= 0 ? '+' : '-'}{formatUsd(Math.abs(ctx.cumulativePnl))}
            </span>
            {' · Win Rate '}
            <span style={{ color: ctx.winRateColor }}>
              {ctx.winRate != null ? `${ctx.winRate.toFixed(0)}%` : '—'}
            </span>
          </span>
        )}
        tooltip="Uses the same Trade Stream composition as Signaled Trades with Today selected: all live trades plus today's historical trades, showing cumulative PnL and win rate for today."
        theme={ctx.theme}
        trend={ctx.cumulativePnl > 0 ? 'bullish' : ctx.cumulativePnl < 0 ? 'bearish' : 'neutral'}
      />
    ),
  },
  {
    id: 'sec-volatility',
    kind: 'header',
    label: 'Heading: Volatility Monitor',
    span: 'full',
    render: () => <SectionHeader>Volatility Monitor</SectionHeader>,
  },
  {
    id: 'volatility',
    kind: 'card',
    label: 'Volatility Monitor',
    span: 'half',
    render: () => <VolatilityCard />,
  },
  {
    id: 'sec-gamma',
    kind: 'header',
    label: 'Heading: Gamma Exposure',
    span: 'full',
    render: () => <SectionHeader>Gamma Exposure</SectionHeader>,
  },
  {
    id: 'call-gex',
    kind: 'card',
    label: 'Call GEX',
    span: 'quarter',
    render: (ctx) => (
      <MetricCard
        title="Call GEX"
        value={formatCompactUsd(ctx.gexData?.total_call_gex)}
        trend="neutral"
        tooltip="Total gamma exposure from call options. Calculation: Sum of (gamma × open interest × contract multiplier × spot price²) for all call strikes. Higher values indicate strong call positioning, which creates upside resistance as dealers hedge by selling into rallies."
        theme={ctx.theme}
      />
    ),
  },
  {
    id: 'put-gex',
    kind: 'card',
    label: 'Put GEX',
    span: 'quarter',
    render: (ctx) => (
      <MetricCard
        title="Put GEX"
        value={formatCompactUsd(ctx.gexData?.total_put_gex)}
        trend="neutral"
        tooltip="Total gamma exposure from put options. Calculation: Sum of (gamma × open interest × contract multiplier × spot price²) for all put strikes. Higher values indicate strong put positioning, which creates downside support as dealers hedge by buying into selloffs."
        theme={ctx.theme}
      />
    ),
  },
  {
    id: 'call-wall',
    kind: 'card',
    label: 'Call Wall (Resistance)',
    span: 'quarter',
    render: (ctx) => (
      <MetricCard
        title="Call Wall (Resistance)"
        value={ctx.gexData?.call_wall != null ? `$${ctx.gexData.call_wall.toFixed(2)}` : 'N/A'}
        subtitle={
          ctx.gexData?.call_wall && ctx.quoteData?.close
            ? `${((ctx.gexData.call_wall - ctx.quoteData.close) / ctx.quoteData.close * 100) >= 0 ? '+' : ''}${((ctx.gexData.call_wall - ctx.quoteData.close) / ctx.quoteData.close * 100).toFixed(1)}% from spot`
            : 'Heavy call open interest'
        }
        tooltip="Strike with the heaviest call open interest. Tends to act as resistance as dealers sell into rallies toward it."
        theme={ctx.theme}
        trend="bearish"
      />
    ),
  },
  {
    id: 'put-wall',
    kind: 'card',
    label: 'Put Wall (Support)',
    span: 'quarter',
    render: (ctx) => (
      <MetricCard
        title="Put Wall (Support)"
        value={ctx.gexData?.put_wall != null ? `$${ctx.gexData.put_wall.toFixed(2)}` : 'N/A'}
        subtitle={
          ctx.gexData?.put_wall && ctx.quoteData?.close
            ? `${((ctx.gexData.put_wall - ctx.quoteData.close) / ctx.quoteData.close * 100) >= 0 ? '+' : ''}${((ctx.gexData.put_wall - ctx.quoteData.close) / ctx.quoteData.close * 100).toFixed(1)}% from spot`
            : 'Heavy put open interest'
        }
        tooltip="Strike with the heaviest put open interest. Tends to act as support as dealers buy into selloffs toward it."
        theme={ctx.theme}
        trend="bullish"
      />
    ),
  },
  {
    id: 'sec-sentiment',
    kind: 'header',
    label: 'Heading: Options Sentiment',
    span: 'full',
    render: () => <SectionHeader>Options Sentiment</SectionHeader>,
  },
  {
    id: 'net-flow',
    kind: 'card',
    label: 'Net Flow',
    span: 'quarter',
    render: (ctx) => (
      <MetricCard
        title="Net Flow"
        value={Number(ctx.latestFlowSnapshot?.netFlow ?? 0).toLocaleString()}
        subtitle="contracts"
        trend={Number(ctx.latestFlowSnapshot?.netFlow ?? 0) > 0 ? 'bullish' : 'bearish'}
        tooltip="Cumulative call volume minus put volume for the current session."
        theme={ctx.theme}
      />
    ),
  },
  {
    id: 'net-premium',
    kind: 'card',
    label: 'Net Premium',
    span: 'quarter',
    render: (ctx) => (
      <MetricCard
        title="Net Premium"
        value={`${Number(ctx.latestFlowSnapshot?.netPremium ?? 0) < 0 ? '-' : ''}$${(Math.abs(Number(ctx.latestFlowSnapshot?.netPremium ?? 0)) / 1_000_000).toFixed(2)}M`}
        trend={Number(ctx.latestFlowSnapshot?.netPremium ?? 0) > 0 ? 'bullish' : 'bearish'}
        tooltip="Cumulative call premium minus put premium for the current session."
        theme={ctx.theme}
      />
    ),
  },
  {
    id: 'put-call-ratio',
    kind: 'card',
    label: 'Put/Call Ratio',
    span: 'quarter',
    render: (ctx) => (
      <MetricCard
        title="Put/Call Ratio"
        value={Number(ctx.latestFlowSnapshot?.putCallRatio ?? 0).toFixed(2)}
        trend={Number(ctx.latestFlowSnapshot?.putCallRatio ?? 0) > 1 ? 'bearish' : 'bullish'}
        tooltip="Cumulative put volume divided by cumulative call volume for the current session."
        theme={ctx.theme}
      />
    ),
  },
];

export const DASHBOARD_WIDGETS: WidgetDef[] = WIDGETS;

const WIDGET_BY_ID = new Map<string, WidgetDef>(WIDGETS.map((w) => [w.id, w]));

export function getWidgetDef(id: string): WidgetDef | undefined {
  return WIDGET_BY_ID.get(id);
}

/** Default layout = registry order, everything visible. */
export function defaultLayout(): WidgetState[] {
  return DASHBOARD_WIDGET_IDS.map((id) => ({ id, visible: true }));
}

/**
 * Reconcile a stored layout against the current registry:
 * - drop ids that no longer exist
 * - keep stored order + visibility for known ids
 * - append any registry widgets the stored layout never saw (visible),
 *   so shipping a new widget surfaces it instead of hiding it forever
 */
export function reconcileLayout(stored: ReadonlyArray<{ id: string; visible: boolean }> | null | undefined): WidgetState[] {
  if (!stored || stored.length === 0) return defaultLayout();

  const seen = new Set<string>();
  const result: WidgetState[] = [];
  for (const entry of stored) {
    if (!isDashboardWidgetId(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push({ id: entry.id, visible: entry.visible !== false });
  }
  for (const id of DASHBOARD_WIDGET_IDS) {
    if (!seen.has(id)) result.push({ id, visible: true });
  }
  return result;
}
