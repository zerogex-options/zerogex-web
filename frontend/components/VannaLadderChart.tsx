'use client';

import { Info } from 'lucide-react';
import TooltipWrapper from './TooltipWrapper';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useForcedFlowVannaLadder } from '@/hooks/useApiData';

interface VannaLadderChartProps {
  symbol?: string;
}

// Compact signed-USD formatter ($1.2B / $340M / $12K). Local per the repo's
// per-chart convention (no shared money util in core/).
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

function formatVolPts(value: number): string {
  if (!Number.isFinite(value)) return '';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}`;
}

interface VannaTooltipRow {
  vol_change_pts: number;
  flow: number;
}

function VannaTooltip({
  active,
  payload,
  bg,
  border,
  text,
  bull,
  bear,
}: {
  active?: boolean;
  payload?: Array<{ payload?: VannaTooltipRow }>;
  bg: string;
  border: string;
  text: string;
  bull: string;
  bear: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const color = row.flow >= 0 ? bull : bear;
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: '8px 12px',
        color: text,
        fontSize: 12,
        minWidth: 170,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4 }}>VIX {formatVolPts(row.vol_change_pts)} pts</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '2px 12px' }}>
        <span style={{ color }}>{row.flow >= 0 ? 'Dealers buy' : 'Dealers sell'}</span>
        <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontWeight: 600 }}>
          {formatCompactUsd(Math.abs(row.flow))}
        </span>
      </div>
    </div>
  );
}

export default function VannaLadderChart({ symbol = 'SPY' }: VannaLadderChartProps) {
  const chart = useChartTheme();
  const { data, loading, error } = useForcedFlowVannaLadder(symbol, 15000);

  const curve = data?.curve ?? [];
  const hasData = curve.length > 0;

  // Headline reads the flow at the −1 VIX-point rung if the ladder carries it.
  const minusOne = useMemo(
    () => curve.find((p) => Math.abs(p.vol_change_pts + 1) < 1e-6) ?? null,
    [curve],
  );

  const textColor = 'var(--text-primary)';

  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${'var(--text-secondary)'}` }}
    >
      <div className="mb-1 flex items-baseline gap-2 flex-wrap">
        <h3 className="zg-h3" style={{ color: textColor }}>
          Vanna Ladder · Flow vs Vol
        </h3>
        <TooltipWrapper text="Dollars of stock dealers must trade if implied volatility shifts, with spot and time held fixed. Each rung steps IV up or down by one point; flow is zero at no change. A vol drop typically forces buying (the vanna grind that lifts markets on no news); a vol spike forces selling, which is part of why fear feeds on itself in a selloff.">
          <Info size={14} />
        </TooltipWrapper>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {symbol}
        </span>
      </div>

      {/* Headline: flow at a 1-point VIX drop. */}
      {hasData && minusOne != null && (
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          VIX −1 →{' '}
          <span className="font-bold" style={{ color: minusOne.flow >= 0 ? chart.bull : chart.bear }}>
            dealers must {minusOne.flow >= 0 ? 'buy' : 'sell'} {formatCompactUsd(Math.abs(minusOne.flow))}
          </span>
          .
        </p>
      )}
      {hasData && minusOne == null && (
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Forced dealer flow for each 1-point move in implied vol (VIX), spot held.
        </p>
      )}

      {error ? (
        <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: chart.bear }}>
          {error === 'No data available yet'
            ? `No vanna-ladder snapshot for ${symbol} yet.`
            : `Failed to load vanna ladder: ${error}`}
        </div>
      ) : loading && !data ? (
        <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading vanna ladder…
        </div>
      ) : !hasData ? (
        <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: 'var(--text-secondary)' }}>
          No vanna-ladder data available.
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={curve} margin={{ top: 16, right: 20, left: 16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.gridLine} opacity={0.6} />
              <XAxis
                dataKey="vol_change_pts"
                type="number"
                domain={['dataMin', 'dataMax']}
                stroke={chart.axisText}
                tick={{ fontSize: 11, fill: chart.axisText }}
                tickFormatter={(v) => formatVolPts(Number(v))}
                label={{
                  value: 'VIX change (pts)',
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
                cursor={{ fill: chart.gridLine, opacity: 0.3 }}
                content={
                  <VannaTooltip
                    bg={chart.tooltipBg}
                    border={chart.tooltipBorder}
                    text={chart.tooltipText}
                    bull={chart.bull}
                    bear={chart.bear}
                  />
                }
              />
              <ReferenceLine y={0} stroke={chart.text} opacity={0.4} />
              <Bar dataKey="flow" name="Forced flow" isAnimationActive={false}>
                {curve.map((p, i) => (
                  <Cell key={i} fill={p.flow >= 0 ? chart.bull : chart.bear} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {data?.timestamp && (
            <div className="mt-3 text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Snapshot {new Date(data.timestamp).toLocaleTimeString()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
