'use client';

import { useMemo } from 'react';
import {
  Area,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  EMPTY,
  formatMultiple,
  formatPct,
  type SurfacePoint,
} from '@/core/spreadMonitor';

import { legendProps } from './chartLegend';

/**
 * Today's quoted width across the strikes, drawn on top of what this symbol
 * normally does at this time of day.
 *
 * Three series, and only three, because the question is a comparison and a
 * comparison with six lines on it is a table. Current is the prominent one;
 * the median is the reference it is read against; the shaded band is the
 * middle half of the distribution, which is what makes "outside normal"
 * visible without anyone having to read a number. The 10th-90th band was
 * specified as optional and is left out — a second envelope inside the first
 * turns the one thing this chart has to communicate into a gradient.
 *
 * Everything shares ONE y-axis, in percent of the option's own mid. The
 * percentile view swaps the whole chart to a 0-100 scale rather than adding a
 * second axis: two scales on one plot is how a reader ends up comparing a
 * width against a rank and believing the crossing point means something.
 *
 * Gaps are gaps. A slice with a current reading but no stored history draws
 * its current point and simply has no band under it — `connectNulls` is off
 * everywhere, so the median line breaks rather than ruling straight across a
 * region nobody has data for. The band cannot be interpolated either: Recharts
 * would happily fill between two defined endpoints, so the baseline series are
 * emitted as null on any slice whose history is missing.
 */

export type SurfaceMetric = 'spread' | 'percentile';

interface CurveRow {
  label: string;
  tick: string;
  center: number;
  current: number | null;
  median: number | null;
  /** `[p25, p75]` for the shaded band, or null where there is no history. */
  band: [number, number] | null;
  percentile: number | null;
  vsNormal: number | null;
  contracts: number;
  twoSided: number | null;
  sessions: number;
}

// "Current" is neither a side nor a verdict, so it wears neither vocabulary.
// Red would say "puts" on the calls chart, where the page's own moneyness
// curve has spent the whole scroll teaching that red means puts; green would
// say "tight" next to an expiry chart in which green means exactly that. The
// violet accent means only "the reading being placed", which is what it is.
const CURRENT_COLOR = 'var(--color-king)';
/** Shared by the Area and its legend swatch so the two cannot drift. */
const BAND_FILL_OPACITY = 0.14;
const NORMAL_COLOR = 'var(--color-chart-axis)';
const BAND_COLOR = 'var(--color-chart-axis)';

function toRows(points: readonly SurfacePoint[]): CurveRow[] {
  return points
    .map((point) => ({
      label: point.label,
      tick: `${point.center_pct > 0 ? '+' : ''}${point.center_pct.toFixed(1)}%`,
      center: point.center_pct,
      current: point.current_pct,
      median: point.historical_median_pct,
      band:
        point.historical_p25_pct != null && point.historical_p75_pct != null
          ? ([point.historical_p25_pct, point.historical_p75_pct] as [number, number])
          : null,
      percentile: point.percentile,
      vsNormal: point.vs_normal,
      contracts: point.contract_count,
      twoSided: point.two_sided_pct,
      sessions: point.sessions,
    }))
    .sort((a, b) => a.center - b.center);
}

function SurfaceTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: CurveRow }>;
  metric: SurfaceMetric;
}) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;

  const lines: Array<[string, string]> = [
    ['Current', formatPct(row.current)],
    ['Normal (median)', formatPct(row.median)],
    ['vs normal', formatMultiple(row.vsNormal)],
    [
      'Percentile',
      row.percentile != null ? `${row.percentile.toFixed(0)}th` : 'insufficient history',
    ],
    ['Two-sided', row.twoSided != null ? formatPct(row.twoSided, 0) : EMPTY],
    ['Contracts now', String(row.contracts)],
    ['Comparable sessions', String(row.sessions)],
  ];

  return (
    <div
      className="rounded-lg border px-3 py-2 text-[11px]"
      style={{
        backgroundColor: 'var(--color-chart-tooltip-bg)',
        borderColor: 'var(--color-chart-tooltip-border)',
        color: 'var(--color-chart-tooltip-text)',
      }}
    >
      <div className="mb-1 font-semibold">{row.label}</div>
      <table>
        <tbody>
          {lines.map(([name, value]) => (
            <tr key={name}>
              <td className="pr-3" style={{ color: 'var(--color-chart-tooltip-muted)' }}>
                {name}
              </td>
              <td className="tabular-nums text-right">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {metric === 'percentile' && row.percentile == null && (
        <div className="mt-1" style={{ color: 'var(--color-chart-tooltip-muted)' }}>
          Not enough stored sessions in this band to rank it.
        </div>
      )}
    </div>
  );
}

export default function SurfaceCurve({
  points,
  metric = 'spread',
  height = 300,
}: {
  points: readonly SurfacePoint[];
  metric?: SurfaceMetric;
  height?: number;
}) {
  const rows = useMemo(() => toRows(points), [points]);
  const atmTick = useMemo(
    () => rows.find((row) => Math.abs(row.center) < 0.01)?.tick ?? null,
    [rows],
  );
  const axisStroke = 'var(--color-chart-axis)';

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        No contracts quoted in this strike band.
      </div>
    );
  }

  const isPercentile = metric === 'percentile';
  const ranked = rows.filter((row) => row.percentile != null).length;

  if (isPercentile && ranked === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        No strike band in this scope has enough stored history to rank.
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
          domain={isPercentile ? [0, 100] : ['auto', 'auto']}
          tickFormatter={(v) =>
            isPercentile ? `${Number(v).toFixed(0)}` : `${Number(v).toFixed(1)}%`
          }
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          width={54}
        />
        <Tooltip content={<SurfaceTooltip metric={metric} />} />
        <Legend
          {...legendProps(
            isPercentile
              ? [{ value: 'Percentile vs own history', color: CURRENT_COLOR, shape: 'line' }]
              : [
                  { value: 'Current', color: CURRENT_COLOR, shape: 'line' },
                  {
                    value: 'Normal (median)',
                    color: NORMAL_COLOR,
                    shape: 'line',
                    dasharray: '4 3',
                  },
                  {
                    value: 'Usual range (25th-75th)',
                    color: BAND_COLOR,
                    shape: 'rect',
                    opacity: BAND_FILL_OPACITY,
                  },
                ],
          )}
        />

        {/* Spot. A category axis has no numeric zero to anchor to, so the ATM
            bucket is marked by name. */}
        {atmTick && (
          <ReferenceLine x={atmTick} stroke={axisStroke} opacity={0.5} strokeDasharray="3 3" />
        )}

        {isPercentile ? (
          <>
            {/* The two thresholds the rest of the page already uses for
                "wider than usual" and "tighter than usual", so this chart
                and the header cards cannot disagree about what they mean. */}
            <ReferenceLine y={80} stroke={axisStroke} opacity={0.35} strokeDasharray="2 4" />
            <ReferenceLine y={20} stroke={axisStroke} opacity={0.35} strokeDasharray="2 4" />
            <Line
              type="monotone"
              dataKey="percentile"
              name="Percentile vs own history"
              stroke={CURRENT_COLOR}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </>
        ) : (
          <>
            <Area
              dataKey="band"
              name="Usual range (25th-75th)"
              stroke="none"
              fill={BAND_COLOR}
              fillOpacity={BAND_FILL_OPACITY}
              connectNulls={false}
              isAnimationActive={false}
              activeDot={false}
            />
            <Line
              type="monotone"
              dataKey="median"
              name="Normal (median)"
              stroke={NORMAL_COLOR}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              name="Current"
              stroke={CURRENT_COLOR}
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </>
        )}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
