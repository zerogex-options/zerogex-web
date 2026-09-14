'use client';

import { useMemo } from 'react';
import {
  Bar,
  ComposedChart,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { moneynessAxisLabel, type MoneynessBucket } from '@/core/spreadMonitor';

/**
 * Quoted width across strike distance — where in the chain the market thins.
 *
 * Laid out by SIGNED distance from spot, so it reads left-to-right like a
 * skew chart: downside strikes on the left, upside on the right, spot in
 * the middle. That orientation is what makes the shape legible at a
 * glance, because the complaint this page answers is not "spreads are
 * wide" but "the downside wing is wide" — a chart bucketed by unsigned
 * distance from ATM would fold the two wings on top of each other and
 * average exactly that away.
 *
 * Puts and calls are drawn as separate bars rather than one series per
 * bucket, because both are quoted at every strike and they routinely
 * disagree: at a strike 3% below spot the put is the hedge everyone wants
 * and the call is the one nobody does.
 *
 * A bucket with no tradable contracts renders as an absent bar, not a zero
 * one. Zero would read as "free to cross" — the exact opposite of "there
 * is no market here".
 */

interface CurveRow {
  label: string;
  /** Compact axis tick, e.g. `-4.0%`. */
  tick: string;
  /** Prose for the tooltip, e.g. `3.0-5.0% below`. */
  distance: string;
  center: number;
  putWidth: number | null;
  callWidth: number | null;
  putCount: number;
  callCount: number;
  putDead: number;
}

const CALL_COLOR = 'var(--color-bull)';
const PUT_COLOR = 'var(--color-bear)';

function toRows(puts: MoneynessBucket[], calls: MoneynessBucket[]): CurveRow[] {
  const byLabel = new Map<string, CurveRow>();
  const upsert = (bucket: MoneynessBucket): CurveRow => {
    const existing = byLabel.get(bucket.label);
    if (existing) return existing;
    const center = (bucket.moneyness_low_pct + bucket.moneyness_high_pct) / 2;
    const row: CurveRow = {
      label: bucket.label,
      tick: `${center > 0 ? '+' : ''}${center.toFixed(1)}%`,
      distance: moneynessAxisLabel(bucket),
      center,
      putWidth: null,
      callWidth: null,
      putCount: 0,
      callCount: 0,
      putDead: 0,
    };
    byLabel.set(bucket.label, row);
    return row;
  };

  for (const bucket of puts) {
    const row = upsert(bucket);
    row.putWidth = bucket.median_relative_spread_pct;
    row.putCount = bucket.contract_count;
    row.putDead = bucket.zero_bid_pct + bucket.crossed_or_locked_pct;
  }
  for (const bucket of calls) {
    const row = upsert(bucket);
    row.callWidth = bucket.median_relative_spread_pct;
    row.callCount = bucket.contract_count;
  }

  return [...byLabel.values()]
    .filter((row) => row.putCount > 0 || row.callCount > 0)
    .sort((a, b) => a.center - b.center);
}

export default function MoneynessCurve({
  puts,
  calls,
  height = 260,
}: {
  puts: MoneynessBucket[];
  calls: MoneynessBucket[];
  height?: number;
}) {
  const rows = useMemo(() => toRows(puts, calls), [puts, calls]);
  const atmTick = useMemo(
    () => rows.find((row) => Math.abs(row.center) < 0.01)?.tick ?? null,
    [rows],
  );
  const axisStroke = 'var(--color-chart-axis)';

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        No contracts quoted in the strike band.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
        <XAxis
          dataKey="tick"
          type="category"
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          interval="preserveStartEnd"
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
          labelFormatter={(_v, payload) => {
            const row = payload?.[0]?.payload as CurveRow | undefined;
            return row ? row.distance : 'Strike distance';
          }}
          formatter={(value, name) => {
            if (value == null) return ['no market', name];
            const n = Number(value);
            if (!Number.isFinite(n)) return ['no market', name];
            return [`${n.toFixed(2)}%`, name];
          }}
        />
        <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />

        {/* Spot. The whole shape is read relative to it, so the ATM bucket is
            marked by name — a category axis has no numeric zero to sit at. */}
        {atmTick && (
          <ReferenceLine x={atmTick} stroke={axisStroke} opacity={0.5} strokeDasharray="3 3" />
        )}

        <Bar
          dataKey="putWidth"
          name="Put spread (% of mid)"
          fill={PUT_COLOR}
          fillOpacity={0.75}
          isAnimationActive={false}
        />
        <Bar
          dataKey="callWidth"
          name="Call spread (% of mid)"
          fill={CALL_COLOR}
          fillOpacity={0.75}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
