'use client';

import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { SpreadHistoryRow } from '@/core/spreadMonitor';

import { legendProps } from './chartLegend';

/**
 * The trailing daily record — what turns a number into a judgement.
 *
 * "Puts are 6.2% wide" is not actionable on its own, because nobody carries a
 * reference for what 6.2% means on this chain. "Puts are 6.2% wide and they
 * have not been above 3% since June" is. This is the only place on the page
 * that can say the second thing.
 *
 * Three marks, and the asymmetry is deliberate:
 *
 * - **Puts** carry both a median line and a shaded band up to their p90.
 *   The gap between them IS a reading: both rising is a chain that got
 *   uniformly worse, only the band rising is one whose wings blew out while
 *   the money stayed orderly — a different market, and the more common.
 * - **Calls** carry a median line only. They are the control, not the
 *   subject: the question this page exists for is whether the PUTS have gone
 *   wide, and that is only answerable against a reference that didn't. A
 *   second band would double the ink to answer a question nobody asked.
 *
 * The call line is dashed. Green and red sit in the 6-8 CVD separation band
 * (measured, not guessed), which is legal only with secondary encoding —
 * here the dash pattern, which survives every form of colour blindness and
 * greyscale printing.
 *
 * One y-axis. Both series are the same measure in the same unit, which is
 * the only reason they may share a plot at all.
 */

interface HistoryRow {
  trading_date: string;
  putMedian: number | null;
  putP90: number | null;
  /** Recharts stacks an Area on the value below it, so this is the DELTA. */
  putTail: number | null;
  callMedian: number | null;
}

function toRows(
  putRows: readonly SpreadHistoryRow[],
  callRows: readonly SpreadHistoryRow[],
): HistoryRow[] {
  const callsByDate = new Map(callRows.map((r) => [r.trading_date, r]));
  return putRows.map((row) => {
    const median = row.median_relative_spread_pct;
    const p90 = row.p90_relative_spread_pct;
    return {
      trading_date: row.trading_date,
      putMedian: median,
      putP90: p90,
      putTail: median != null && p90 != null ? Math.max(0, p90 - median) : null,
      callMedian:
        callsByDate.get(row.trading_date)?.median_relative_spread_pct ?? null,
    };
  });
}

function dayLabel(value: string): string {
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function SpreadHistoryChart({
  putRows,
  callRows = [],
  height = 260,
}: {
  putRows: readonly SpreadHistoryRow[];
  callRows?: readonly SpreadHistoryRow[];
  height?: number;
}) {
  const data = useMemo(() => toRows(putRows, callRows), [putRows, callRows]);
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
        <CartesianGrid
          vertical={false}
          stroke="var(--color-chart-grid)"
          strokeOpacity={0.5}
        />
        <XAxis
          dataKey="trading_date"
          tickFormatter={dayLabel}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          minTickGap={30}
        />
        <YAxis
          tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          width={46}
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
            // The band carries a delta; report the true p90 the reader sees.
            if (name === 'Put tail (worst 10%)') {
              const p90 = (entry?.payload as HistoryRow | undefined)?.putP90;
              return [p90 == null ? '—' : `${p90.toFixed(2)}%`, name];
            }
            if (value == null) return ['—', name];
            const n = Number(value);
            if (!Number.isFinite(n)) return ['—', name];
            return [`${n.toFixed(2)}%`, name];
          }}
        />
        <Legend
          {...legendProps([
            { value: 'Puts (typical)', color: 'var(--color-bear)', shape: 'line' },
            { value: 'Put tail (worst 10%)', color: 'var(--color-bear)' },
            {
              value: 'Calls (typical)',
              color: 'var(--color-bull)',
              shape: 'line',
              dasharray: '5 3',
            },
          ])}
        />

        {/* Invisible base of the stack: the band starts at the put median. */}
        <Area
          type="monotone"
          dataKey="putMedian"
          stackId="band"
          stroke="none"
          fill="none"
          legendType="none"
          tooltipType="none"
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="putTail"
          stackId="band"
          name="Put tail (worst 10%)"
          stroke="none"
          fill="var(--color-bear)"
          fillOpacity={0.16}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="putMedian"
          name="Puts (typical)"
          stroke="var(--color-bear)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="callMedian"
          name="Calls (typical)"
          stroke="var(--color-bull)"
          strokeWidth={2}
          strokeDasharray="5 3"
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={false}
          connectNulls={false}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
