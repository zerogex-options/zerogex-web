'use client';

import { memo, useMemo } from 'react';
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { BacktestConePoint } from './types';

interface Props {
  cone: BacktestConePoint[];
  startingCapital: number;
}

interface ConeRow {
  i: number;
  band: [number, number]; // [p5, p95] — a range area
  p50: number;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function MonteCarloChartImpl({ cone, startingCapital }: Props) {
  const data: ConeRow[] = useMemo(
    () => cone.map((c) => ({ i: c.i, band: [c.p5, c.p95], p50: c.p50 })),
    [cone],
  );

  if (data.length === 0) {
    return (
      <div
        className="rounded-xl border p-8 text-center text-sm"
        style={{
          borderColor: 'var(--color-border)',
          background: 'var(--color-surface-subtle)',
          color: 'var(--color-text-secondary)',
          height: 280,
        }}
      >
        <div className="flex h-full items-center justify-center">
          Not enough trades for a Monte Carlo simulation.
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: 'var(--color-border)',
        background: 'var(--color-surface-subtle)',
        height: 280,
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
          <defs>
            <linearGradient id="mcBand" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.28} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
          <XAxis
            dataKey="i"
            type="number"
            domain={['dataMin', 'dataMax']}
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            stroke="var(--color-border)"
            height={28}
            label={{
              value: 'Trades',
              position: 'insideBottom',
              offset: -4,
              fill: 'var(--color-text-secondary)',
              fontSize: 11,
            }}
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
          <Tooltip content={<ConeTooltip />} />
          <Area
            type="monotone"
            dataKey="band"
            stroke="none"
            fill="url(#mcBand)"
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function ConeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ConeRow }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const [p5, p95] = point.band;
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
      <div className="font-mono">After {point.i} trades</div>
      <div className="mt-1 font-semibold">Median {formatCurrency(point.p50)}</div>
      <div className="mt-0.5 text-[var(--color-text-secondary)]">
        90% range {formatCurrency(p5)} – {formatCurrency(p95)}
      </div>
    </div>
  );
}

const MonteCarloChart = memo(MonteCarloChartImpl);
export default MonteCarloChart;
