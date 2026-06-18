'use client';

import { memo, useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BacktestEquityPoint } from './types';

interface Props {
  equity: BacktestEquityPoint[];
  startingCapital: number;
}

interface ChartPoint {
  ts: number;
  equity: number;
  drawdown_pct: number;
}

function formatAxisDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  });
}

function formatTooltipDate(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }) + ' ET';
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function EquityChartImpl({ equity, startingCapital }: Props) {
  const data: ChartPoint[] = useMemo(
    () =>
      equity
        .map((p) => ({ ts: Date.parse(p.t), equity: p.equity, drawdown_pct: p.drawdown_pct }))
        .filter((p) => Number.isFinite(p.ts)),
    [equity],
  );

  const lastEquity = data.length > 0 ? data[data.length - 1].equity : startingCapital;
  const up = lastEquity >= startingCapital;
  const lineColor = up ? 'var(--color-bull)' : 'var(--color-bear)';

  if (data.length === 0) {
    return (
      <div
        className="rounded-xl border p-8 text-center text-sm"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-surface-subtle)',
          color: 'var(--color-text-secondary)',
          height: 320,
        }}
      >
        <div className="flex h-full items-center justify-center">No equity data for this run.</div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)', height: 320 }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
              <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatAxisDate}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            stroke="var(--color-border)"
            height={28}
          />
          <YAxis
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => formatCurrency(v)}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            stroke="var(--color-border)"
            width={64}
          />
          <ReferenceLine
            y={startingCapital}
            stroke="var(--color-text-secondary)"
            strokeOpacity={0.5}
            strokeDasharray="4 4"
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="monotone"
            dataKey="equity"
            stroke={lineColor}
            strokeWidth={2}
            fill="url(#equityFill)"
            isAnimationActive={false}
            activeDot={{ r: 4, stroke: lineColor, fill: 'var(--color-surface)' }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-lg"
      style={{
        background: 'var(--color-chart-tooltip-bg)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-chart-tooltip-text)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div className="font-mono">{formatTooltipDate(point.ts)}</div>
      <div className="mt-1 font-semibold">{formatCurrency(point.equity)}</div>
      <div className="mt-0.5 text-[var(--color-text-secondary)]">
        Drawdown {point.drawdown_pct.toFixed(2)}%
      </div>
    </div>
  );
}

const EquityChart = memo(EquityChartImpl);
export default EquityChart;
