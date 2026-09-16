'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { dteLabel, type ExpirationSlice } from '@/core/spreadMonitor';

import { legendProps } from './chartLegend';

/**
 * The term structure of tradability: quoted width per expiration, puts beside
 * calls.
 *
 * Grouped bars rather than lines, because expirations are discrete listings
 * and not a continuum — a line between Wednesday and Friday implies a
 * Thursday reading that does not exist. Nearest expiry first, which is both
 * reading order and the order of interest.
 *
 * Two series and one y-axis. Contract counts and no-bid share ride in the
 * tooltip rather than on a second scale: a chart with two y-scales invents a
 * correlation by choosing where the scales line up, and the detail table
 * under this chart already carries every number exactly.
 *
 * Colour is the site's call/put convention (green/red), which sits in the
 * 6-8 CVD separation band — legal only with secondary encoding. Two things
 * provide it, neither of them colour: the pair is always ordered puts-then-
 * calls inside each group, and a 2px surface gap separates them. The table
 * below is the third belt, and the reason per-bar labels are left off — a
 * number on all ten bars would flood the chart to restate what the table
 * already says exactly.
 */

const CALL_COLOR = 'var(--color-bull)';
const PUT_COLOR = 'var(--color-bear)';

interface CurveRow {
  label: string;
  expiration: string;
  dte: number;
  puts: number | null;
  calls: number | null;
  putContracts: number;
  callContracts: number;
  putNoBid: number;
}

function toRows(slices: readonly ExpirationSlice[]): CurveRow[] {
  return slices.map((slice) => ({
    label: dteLabel(slice.dte),
    expiration: slice.expiration,
    dte: slice.dte,
    puts: slice.puts.median_relative_spread_pct,
    calls: slice.calls.median_relative_spread_pct,
    putContracts: slice.puts.contract_count,
    callContracts: slice.calls.contract_count,
    putNoBid: slice.puts.zero_bid_pct + slice.puts.crossed_or_locked_pct,
  }));
}

export default function ExpirationCurve({
  slices,
  height = 260,
}: {
  slices: readonly ExpirationSlice[];
  height?: number;
}) {
  const rows = useMemo(() => toRows(slices), [slices]);
  const axisStroke = 'var(--color-chart-axis)';

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        No expirations quoted in range.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 8 }} barGap={2}>
        {/* Recessive, horizontal only: vertical rules would compete with the
            group boundaries the bars already establish. */}
        <CartesianGrid
          vertical={false}
          stroke="var(--color-chart-grid)"
          strokeOpacity={0.5}
        />
        <XAxis dataKey="label" stroke={axisStroke} tick={{ fontSize: 10 }} />
        <YAxis
          tickFormatter={(v) => `${Number(v).toFixed(0)}%`}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          width={46}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-chart-grid)', fillOpacity: 0.25 }}
          contentStyle={{
            backgroundColor: 'var(--color-chart-tooltip-bg)',
            borderColor: 'var(--color-chart-tooltip-border)',
            borderRadius: 8,
            color: 'var(--color-chart-tooltip-text)',
          }}
          labelStyle={{ color: 'var(--color-chart-tooltip-text)', fontWeight: 600 }}
          itemStyle={{ color: 'var(--color-chart-tooltip-muted)' }}
          labelFormatter={(_v, payload) => {
            const row = payload?.[0]?.payload as CurveRow | undefined;
            if (!row) return 'Expiration';
            return `${row.expiration} · ${row.dte === 0 ? 'expires today' : `${row.dte} days out`}`;
          }}
          formatter={(value, name, entry) => {
            const row = entry?.payload as CurveRow | undefined;
            if (value == null || !Number.isFinite(Number(value))) {
              return ['no two-sided market', name];
            }
            const isPuts = name === 'Puts';
            const contracts = isPuts ? row?.putContracts : row?.callContracts;
            const suffix = contracts ? ` (${contracts} contracts)` : '';
            return [`${Number(value).toFixed(2)}%${suffix}`, name];
          }}
        />
        {/* Declared puts-first to match the within-group bar order. */}
        <Legend
          {...legendProps([
            { value: 'Puts', color: PUT_COLOR },
            { value: 'Calls', color: CALL_COLOR },
          ])}
        />

        {/* Puts first in every group, always — the fixed within-group order is
            what identifies the series without relying on hue. */}
        <Bar
          dataKey="puts"
          name="Puts"
          fill={PUT_COLOR}
          maxBarSize={24}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="calls"
          name="Calls"
          fill={CALL_COLOR}
          maxBarSize={24}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
