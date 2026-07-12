'use client';

import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useForcedFlowCurve } from '@/hooks/useApiData';

interface ForcedFlowCurveChartProps {
  symbol?: string;
  spotRangePct?: number;
}

// Compact signed-USD formatter ($1.2B / $340M / $12K). Local to the file —
// the repo has no shared money util in core/, and every chart carries its own
// (see GexProfileChart.formatExposure, FlipTermStructureChart.formatGex).
function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return '--';
  if (value === 0) return '$0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(value >= 1000 ? 0 : 2);
}

interface CurveTooltipRow {
  price: number;
  total: number;
  gamma: number;
  charm: number;
  vanna: number;
}

function CurveTooltip({
  active,
  payload,
  bg,
  border,
  text,
  gammaColor,
  charmColor,
  vannaColor,
  totalColor,
}: {
  active?: boolean;
  payload?: Array<{ payload?: CurveTooltipRow }>;
  bg: string;
  border: string;
  text: string;
  gammaColor: string;
  charmColor: string;
  vannaColor: string;
  totalColor: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: '8px 12px',
        color: text,
        fontSize: 12,
        minWidth: 200,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Spot {formatPrice(row.price)}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px' }}>
        <span style={{ color: gammaColor }}>Gamma</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{formatCompactUsd(row.gamma)}</span>
        <span style={{ color: charmColor }}>Charm</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{formatCompactUsd(row.charm)}</span>
        <span style={{ color: vannaColor }}>Vanna</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{formatCompactUsd(row.vanna)}</span>
        <span style={{ color: totalColor, fontWeight: 600 }}>Total</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontWeight: 600 }}>
          {formatCompactUsd(row.total)}
        </span>
      </div>
    </div>
  );
}

export default function ForcedFlowCurveChart({
  symbol = 'SPY',
  spotRangePct = 0.05,
}: ForcedFlowCurveChartProps) {
  const chart = useChartTheme();
  const { data, loading, error } = useForcedFlowCurve(symbol, spotRangePct, 15000);

  // Attribution bands use the palette's 5-series ramp; the total-reprice line
  // rides on top in the neutral foreground colour so it reads as the
  // aggregate, not a fourth band.
  const gammaColor = chart.series[0];
  const charmColor = chart.series[2];
  const vannaColor = chart.series[3];
  const totalColor = chart.text;

  const curve = data?.curve ?? [];
  const hasData = curve.length > 0;

  // Where the dealer flow flips sign — the headline the reader wants fastest.
  const flowAtSpot = useMemo<number | null>(() => {
    if (!data || !hasData) return null;
    let nearest = curve[0];
    let best = Math.abs(curve[0].price - data.spot);
    for (const p of curve) {
      const d = Math.abs(p.price - data.spot);
      if (d < best) {
        best = d;
        nearest = p;
      }
    }
    return nearest.total;
  }, [data, curve, hasData]);

  const textColor = 'var(--text-primary)';

  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${'var(--text-secondary)'}` }}
    >
      <div className="mb-1 flex items-baseline gap-2 flex-wrap">
        <h3 className="zg-h3" style={{ color: textColor }}>
          Forced Dealer Flow · Reprice Curve
        </h3>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {symbol}
        </span>
      </div>
      <p className="mb-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
        Dollars of stock dealers must <span style={{ color: chart.bull, fontWeight: 600 }}>BUY (+)</span> /{' '}
        <span style={{ color: chart.bear, fontWeight: 600 }}>SELL (−)</span> to stay delta-hedged as spot moves —
        split into gamma, charm and vanna. The total line crosses zero where dealers flip from buyers to sellers.
      </p>

      {/* Headline: flow at spot + the zero-flow pivot. */}
      {hasData && (
        <div className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1">
          {flowAtSpot != null && (
            <div>
              <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Flow at spot
              </span>{' '}
              <span
                className="text-lg font-bold"
                style={{ color: flowAtSpot >= 0 ? chart.bull : chart.bear }}
              >
                {flowAtSpot >= 0 ? 'buy ' : 'sell '}
                {formatCompactUsd(Math.abs(flowAtSpot))}
              </span>
            </div>
          )}
          <div>
            <span className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Zero-flow level
            </span>{' '}
            <span className="text-lg font-bold" style={{ color: chart.warning }}>
              {data?.zero_flow_level != null ? formatPrice(data.zero_flow_level) : 'none in range'}
            </span>
          </div>
        </div>
      )}

      {error ? (
        <div className="flex items-center justify-center h-[320px] text-sm" style={{ color: chart.bear }}>
          {error === 'No data available yet'
            ? `No forced-flow snapshot for ${symbol} yet.`
            : `Failed to load forced flow: ${error}`}
        </div>
      ) : loading && !data ? (
        <div className="flex items-center justify-center h-[320px] text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading forced flow…
        </div>
      ) : !hasData ? (
        <div className="flex items-center justify-center h-[320px] text-sm" style={{ color: 'var(--text-secondary)' }}>
          No forced-flow data available.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={380}>
            {/* stackOffset="sign" piles positive bands above zero and negative
                bands below it, so the signed gamma/charm/vanna attribution
                reads correctly around the y=0 pivot. */}
            <ComposedChart
              data={curve}
              stackOffset="sign"
              margin={{ top: 16, right: 20, left: 16, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridLine} opacity={0.6} />
              <XAxis
                dataKey="price"
                type="number"
                domain={['dataMin', 'dataMax']}
                stroke={chart.axisText}
                tick={{ fontSize: 11, fill: chart.axisText }}
                tickFormatter={(v) => formatPrice(Number(v))}
                label={{
                  value: 'Spot price',
                  position: 'insideBottom',
                  offset: -4,
                  fill: chart.axisText,
                  fontSize: 11,
                }}
              />
              <YAxis
                stroke={chart.axisText}
                width={72}
                tick={{ fontSize: 11, fill: chart.axisText }}
                tickFormatter={(v) => formatCompactUsd(Number(v))}
                label={{
                  value: 'Forced flow ($)',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 8,
                  style: { fill: chart.axisText, fontSize: 11, textAnchor: 'middle' },
                }}
              />
              <Tooltip
                content={
                  <CurveTooltip
                    bg={chart.tooltipBg}
                    border={chart.tooltipBorder}
                    text={chart.tooltipText}
                    gammaColor={gammaColor}
                    charmColor={charmColor}
                    vannaColor={vannaColor}
                    totalColor={totalColor}
                  />
                }
              />

              {/* Horizontal zero line — the buy/sell divide. Drawn first so the
                  bands and total line paint over it. */}
              <ReferenceLine y={0} stroke={chart.text} strokeWidth={1.5} opacity={0.5} />

              {/* Stacked signed attribution bands. */}
              <Area
                type="monotone"
                dataKey="gamma"
                name="Gamma"
                stackId="flow"
                stroke={gammaColor}
                fill={gammaColor}
                fillOpacity={0.35}
                strokeWidth={1}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="charm"
                name="Charm"
                stackId="flow"
                stroke={charmColor}
                fill={charmColor}
                fillOpacity={0.35}
                strokeWidth={1}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="vanna"
                name="Vanna"
                stackId="flow"
                stroke={vannaColor}
                fill={vannaColor}
                fillOpacity={0.35}
                strokeWidth={1}
                isAnimationActive={false}
              />

              {/* Exact total reprice on top. */}
              <Line
                type="monotone"
                dataKey="total"
                name="Total"
                stroke={totalColor}
                strokeWidth={2.25}
                dot={false}
                isAnimationActive={false}
              />

              {/* Vertical spot marker. */}
              {data?.spot != null && Number.isFinite(data.spot) && (
                <ReferenceLine
                  x={data.spot}
                  stroke={chart.info}
                  strokeDasharray="4 4"
                  label={{ value: 'Spot', position: 'top', fill: chart.info, fontSize: 10 }}
                />
              )}
              {/* Vertical zero-flow (dealer buy→sell flip) marker. */}
              {data?.zero_flow_level != null && Number.isFinite(data.zero_flow_level) && (
                <ReferenceLine
                  x={data.zero_flow_level}
                  stroke={chart.warning}
                  strokeDasharray="5 3"
                  label={{ value: 'Zero-flow', position: 'top', fill: chart.warning, fontSize: 10 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs" style={{ color: textColor }}>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: gammaColor }} /> Gamma
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: charmColor }} /> Charm
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: vannaColor }} /> Vanna
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ backgroundColor: totalColor }} /> Total
            </span>
          </div>

          {data?.timestamp && (
            <div className="mt-3 text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Horizon {data.horizon_days}d · Snapshot {new Date(data.timestamp).toLocaleTimeString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
