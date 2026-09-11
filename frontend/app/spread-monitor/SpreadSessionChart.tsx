'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
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

import { legendProps } from './chartLegend';

/**
 * How today's quoted widths moved, puts against calls.
 *
 * Two panels, one time axis — NOT one plot with two y-scales.
 *
 * The first version drew the no-market share on a second right-hand axis
 * beside the widths. That is the classic dual-axis mistake: the two scales
 * line up wherever the library happens to put them, so the chart invents a
 * relationship between "puts are 6% wide" and "8% of them have no bid" that
 * is an artefact of the layout rather than anything in the data. Splitting
 * them means every crossing a reader sees is real.
 *
 * They stay one instrument rather than two pictures because they share a
 * `syncId`: hovering either panel crosshairs the same bucket on both. That
 * requires identical margins and identical y-axis widths — Recharts aligns
 * synced charts by index, not by pixel, so a mismatched gutter slides one
 * plot against the other and the crosshair lands on a bucket the reader is
 * not looking at.
 *
 * Two lines and never one on the top panel. A blended median reports about
 * half of the effect this page exists to show: the days people complain
 * about are days when the puts widened and the calls did not, and a single
 * line splits the difference and shows a shrug. The call line is dashed —
 * the site's green/red pair sits in the 6-8 CVD separation band, which is
 * legal only with secondary encoding.
 *
 * Gaps are gaps: `connectNulls={false}`, so a bucket the feed missed shows
 * as a break rather than a line drawn through a period nobody measured.
 */

const SYNC_ID = 'zgx-spread-session';
const CALL_COLOR = 'var(--color-bull)';
const PUT_COLOR = 'var(--color-bear)';
const DEAD_COLOR = 'var(--color-king)';

/** Shared so the two panels align. See the syncId note above. */
const MARGIN = { top: 8, right: 8, bottom: 4, left: 8 } as const;
const Y_AXIS_WIDTH = 46;

interface ChartRow {
  bucket_start: string;
  putWidth: number | null;
  callWidth: number | null;
  putDead: number | null;
}

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

const TOOLTIP_PROPS = {
  contentStyle: {
    backgroundColor: 'var(--color-chart-tooltip-bg)',
    borderColor: 'var(--color-chart-tooltip-border)',
    borderRadius: 8,
    color: 'var(--color-chart-tooltip-text)',
  },
  labelStyle: { color: 'var(--color-chart-tooltip-text)', fontWeight: 600 },
  itemStyle: { color: 'var(--color-chart-tooltip-muted)' },
} as const;

export default function SpreadSessionChart({
  series,
  height = 240,
  deadHeight = 110,
}: {
  series: SpreadSeries;
  height?: number;
  deadHeight?: number;
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
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={rows} syncId={SYNC_ID} margin={MARGIN}>
          <CartesianGrid
            vertical={false}
            stroke="var(--color-chart-grid)"
            strokeOpacity={0.5}
          />
          {/* Hidden here, drawn once on the panel below — the two share it. */}
          <XAxis dataKey="bucket_start" hide />
          <YAxis
            tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
            stroke={axisStroke}
            tick={{ fontSize: 10 }}
            width={Y_AXIS_WIDTH}
          />
          <Tooltip
            {...TOOLTIP_PROPS}
            labelFormatter={(v) => safeTimeLabel(String(v))}
            formatter={(value, name) => {
              if (value == null) return ['—', name];
              const n = Number(value);
              if (!Number.isFinite(n)) return ['—', name];
              return [`${n.toFixed(2)}%`, name];
            }}
          />
          <Legend
            {...legendProps([
              { value: 'Puts (% of mid)', color: PUT_COLOR, shape: 'line' },
              {
                value: 'Calls (% of mid)',
                color: CALL_COLOR,
                shape: 'line',
                dasharray: '5 3',
              },
            ])}
          />
          <Line
            type="monotone"
            dataKey="putWidth"
            name="Puts (% of mid)"
            stroke={PUT_COLOR}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="callWidth"
            name="Calls (% of mid)"
            stroke={CALL_COLOR}
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

      <div className="mt-1">
        <div
          className="mb-1 text-[11px] font-semibold"
          style={{ color: 'var(--text-secondary)' }}
        >
          Share of puts with no market
        </div>
        <ResponsiveContainer width="100%" height={deadHeight}>
          <AreaChart data={rows} syncId={SYNC_ID} margin={MARGIN}>
            <CartesianGrid
              vertical={false}
              stroke="var(--color-chart-grid)"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="bucket_start"
              tickFormatter={safeTimeLabel}
              stroke={axisStroke}
              tick={{ fontSize: 10 }}
              minTickGap={40}
            />
            <YAxis
              domain={[0, 'auto']}
              tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
              stroke={axisStroke}
              tick={{ fontSize: 10 }}
              width={Y_AXIS_WIDTH}
            />
            <Tooltip
              {...TOOLTIP_PROPS}
              labelFormatter={(v) => safeTimeLabel(String(v))}
              formatter={(value, name) => {
                if (value == null) return ['—', name];
                const n = Number(value);
                if (!Number.isFinite(n)) return ['—', name];
                return [`${n.toFixed(1)}%`, name];
              }}
            />
            <Area
              type="monotone"
              dataKey="putDead"
              name="No bid, locked or crossed"
              stroke={DEAD_COLOR}
              strokeWidth={2}
              fill={DEAD_COLOR}
              fillOpacity={0.16}
              connectNulls={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
