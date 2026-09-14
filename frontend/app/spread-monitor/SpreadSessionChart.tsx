'use client';

import { useMemo } from 'react';
import {
  Area,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { safeTimeLabel } from '@/core/flowSeriesCharts';
import type { SpreadSeries } from '@/core/spreadMonitor';

/**
 * How today's quoted widths moved, puts against calls.
 *
 * Two lines and never one. A blended median reports roughly half of the
 * effect the page exists to show: the days people complain about are days
 * when the puts widened and the calls did not, and a single line splits
 * the difference and shows a shrug.
 *
 * The shaded band underneath is the share of contracts with NO two-sided
 * market. It sits on its own right-hand axis because it is not a width and
 * must not be read against one — it is the population that HAS no width,
 * and a chain can hold a flat median while a fifth of it quietly goes
 * no-bid. Watching the lines alone would miss that entirely.
 *
 * Gaps are gaps: `connectNulls={false}`, so a bucket the feed missed shows
 * as a break rather than a straight line drawn through a period nobody
 * measured.
 */

interface ChartRow {
  bucket_start: string;
  putWidth: number | null;
  callWidth: number | null;
  putDead: number | null;
}

const CALL_COLOR = 'var(--color-bull)';
const PUT_COLOR = 'var(--color-bear)';
const DEAD_COLOR = 'var(--color-king)';

function toRows(series: SpreadSeries): ChartRow[] {
  return series.bars.map((bar) => ({
    bucket_start: bar.bucket_start,
    putWidth: bar.puts?.median_relative_spread_pct ?? null,
    callWidth: bar.calls?.median_relative_spread_pct ?? null,
    putDead:
      bar.puts == null
        ? null
        : Number((bar.puts.zero_bid_pct + bar.puts.crossed_or_locked_pct).toFixed(2)),
  }));
}

export default function SpreadSessionChart({
  series,
  height = 280,
}: {
  series: SpreadSeries;
  height?: number;
}) {
  const rows = useMemo(() => toRows(series), [series]);
  const axisStroke = 'var(--color-chart-axis)';

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        No quote readings for this session yet — the series fills in one point per{' '}
        {series.bucket_minutes}-minute bucket as the session runs.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
        <XAxis
          dataKey="bucket_start"
          tickFormatter={safeTimeLabel}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          minTickGap={40}
        />
        <YAxis
          yAxisId="width"
          tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          width={54}
        />
        <YAxis
          yAxisId="dead"
          orientation="right"
          domain={[0, 100]}
          tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          width={44}
        />

        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-chart-tooltip-bg)',
            borderColor: 'var(--color-chart-tooltip-border)',
            borderRadius: 8,
            color: 'var(--color-chart-tooltip-text)',
          }}
          labelStyle={{ color: 'var(--color-chart-tooltip-text)', fontWeight: 600 }}
          itemStyle={{ color: 'var(--color-chart-tooltip-muted)' }}
          labelFormatter={(v) => safeTimeLabel(String(v))}
          formatter={(value, name) => {
            if (value == null) return ['—', name];
            const n = Number(value);
            if (!Number.isFinite(n)) return ['—', name];
            return [`${n.toFixed(2)}%`, name];
          }}
        />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />

        <Area
          yAxisId="dead"
          type="monotone"
          dataKey="putDead"
          name="Puts with no market (right)"
          stroke={DEAD_COLOR}
          strokeWidth={1}
          fill={DEAD_COLOR}
          fillOpacity={0.14}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="width"
          type="monotone"
          dataKey="putWidth"
          name="Put spread (% of mid)"
          stroke={PUT_COLOR}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          yAxisId="width"
          type="monotone"
          dataKey="callWidth"
          name="Call spread (% of mid)"
          stroke={CALL_COLOR}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
