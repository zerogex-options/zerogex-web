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

import type { SpreadHistoryRow } from '@/core/spreadMonitor';

/**
 * The trailing daily record — what turns a number into a judgement.
 *
 * "Puts are 6.2% wide" is not actionable on its own, because nobody carries
 * a reference for what 6.2% means on this chain. "Puts are 6.2% wide and
 * they have not been above 3% since June" is. This chart is the only place
 * on the page that can say the second thing, and it is the reason the
 * daily rollup exists at all.
 *
 * Median and p90 are both drawn, filled between, because the gap between
 * them IS a reading. A session where both rise is a chain that got
 * uniformly worse; one where only p90 rises is a chain whose wings blew
 * out while the money stayed orderly — a different market, and the more
 * common of the two.
 */

interface HistoryRow {
  trading_date: string;
  median: number | null;
  p90: number | null;
  /** Recharts stacks an Area on the value below it, so this is the DELTA. */
  tail: number | null;
  zeroBid: number;
}

function toRows(rows: SpreadHistoryRow[]): HistoryRow[] {
  return rows.map((row) => {
    const median = row.median_relative_spread_pct;
    const p90 = row.p90_relative_spread_pct;
    return {
      trading_date: row.trading_date,
      median,
      p90,
      tail: median != null && p90 != null ? Math.max(0, p90 - median) : null,
      zeroBid: row.zero_bid_pct,
    };
  });
}

function dayLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SpreadHistoryChart({
  rows,
  height = 240,
}: {
  rows: SpreadHistoryRow[];
  height?: number;
}) {
  const data = useMemo(() => toRows(rows), [rows]);
  const axisStroke = 'var(--color-chart-axis)';

  if (data.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        No session history recorded yet. The daily record builds one row per trading day,
        so the comparison against past sessions appears once it has days to compare.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
        <XAxis
          dataKey="trading_date"
          tickFormatter={dayLabel}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          minTickGap={30}
        />
        <YAxis
          tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          width={54}
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
          labelFormatter={(v) => dayLabel(String(v))}
          formatter={(value, name, entry) => {
            // The stacked band carries a delta; report the true p90 the
            // reader is looking at rather than the height of the shaded part.
            if (name === 'Worst 10% of contracts') {
              const p90 = (entry?.payload as HistoryRow | undefined)?.p90;
              return [p90 == null ? '—' : `${p90.toFixed(2)}%`, name];
            }
            if (value == null) return ['—', name];
            const n = Number(value);
            if (!Number.isFinite(n)) return ['—', name];
            return [`${n.toFixed(2)}%`, name];
          }}
        />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />

        {/* Invisible base of the stack: the band starts at the median. */}
        <Area
          type="monotone"
          dataKey="median"
          stackId="band"
          stroke="none"
          fill="none"
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="tail"
          stackId="band"
          name="Worst 10% of contracts"
          stroke="none"
          fill="var(--color-bear)"
          fillOpacity={0.16}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="median"
          name="Typical contract"
          stroke="var(--color-bear)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
