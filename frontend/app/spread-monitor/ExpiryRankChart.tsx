'use client';

import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatPct, type SurfaceDteRank } from '@/core/spreadMonitor';

/**
 * Where the current reading ranks, expiry by expiry — 0 to 100.
 *
 * Ranks rather than widths, which is the whole reason this chart exists
 * beside the by-expiration table further up the page. Plotted as widths,
 * 0DTE wins every day of the year and the chart says nothing; plotted as
 * ranks, a 0DTE bar at 99 beside four bars at 45 is the finding — the book
 * is broadly normal and the front expiry is not.
 *
 * A bucket with too little stored history gets no bar. It gets the words
 * "Insufficient history" where the bar would be, because a bar at any height
 * is a claim, and the shortest bar on a percentile axis is the strong claim
 * that this expiry is unusually TIGHT.
 *
 * Colour is a threshold read, not a scale: the same 80 / 20 cut the rest of
 * the page uses. The site's bull/green and bear/red measure ΔE 7.8 under
 * deuteranopia in light mode — inside the 6-8 band that is legal only with
 * secondary encoding — so every bar carries its percentile as a printed
 * number and the 80 / 20 guides are drawn behind them. Read the labels and
 * the chart still works with no colour at all.
 */

const HIGH = 80;
const LOW = 20;

const WIDE_COLOR = 'var(--color-bear)';
const TIGHT_COLOR = 'var(--color-bull)';
const NORMAL_COLOR = 'var(--color-chart-axis)';

function barColor(percentile: number): string {
  if (percentile >= HIGH) return WIDE_COLOR;
  if (percentile <= LOW) return TIGHT_COLOR;
  return NORMAL_COLOR;
}

/**
 * An ordinary bar is drawn faint, a flagged one solid.
 *
 * `--color-chart-axis` is the primary ink, which on a dark theme is very
 * nearly white: four ordinary expiries painted at the same strength as the
 * flagged one were the brightest thing in the panel, and the single red bar
 * that IS the finding had to compete with them. The brightness carries the
 * reading; the hue only names which direction it went.
 */
function barOpacity(percentile: number): number {
  return percentile >= HIGH || percentile <= LOW ? 0.85 : 0.3;
}

function RankTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SurfaceDteRank }>;
}) {
  const row = active ? payload?.[0]?.payload : undefined;
  if (!row) return null;
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
      {row.percentile == null ? (
        <div style={{ color: 'var(--color-chart-tooltip-muted)' }}>
          Only {row.sessions} comparable session{row.sessions === 1 ? '' : 's'} stored —
          not enough to rank.
        </div>
      ) : (
        <table>
          <tbody>
            <tr>
              <td className="pr-3" style={{ color: 'var(--color-chart-tooltip-muted)' }}>
                Percentile
              </td>
              <td className="tabular-nums text-right">{row.percentile.toFixed(0)}th</td>
            </tr>
            <tr>
              <td className="pr-3" style={{ color: 'var(--color-chart-tooltip-muted)' }}>
                Current
              </td>
              <td className="tabular-nums text-right">{formatPct(row.current_pct)}</td>
            </tr>
            <tr>
              <td className="pr-3" style={{ color: 'var(--color-chart-tooltip-muted)' }}>
                Normal
              </td>
              <td className="tabular-nums text-right">
                {formatPct(row.historical_median_pct)}
              </td>
            </tr>
            <tr>
              <td className="pr-3" style={{ color: 'var(--color-chart-tooltip-muted)' }}>
                Sessions
              </td>
              <td className="tabular-nums text-right">{row.sessions}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function ExpiryRankChart({
  ranks,
  height = 220,
}: {
  ranks: readonly SurfaceDteRank[];
  height?: number;
}) {
  const rows = ranks.map((rank) => ({
    ...rank,
    // Recharts skips a null bar entirely, which is what we want — the label
    // below carries the refusal instead.
    value: rank.percentile,
    note: rank.percentile == null ? 'Insufficient history' : '',
  }));
  const axisStroke = 'var(--color-chart-axis)';

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
        No expiries in this scope.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 16, right: 8, bottom: 4, left: 8 }}>
        <XAxis dataKey="label" stroke={axisStroke} tick={{ fontSize: 11 }} />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 20, 50, 80, 100]}
          tickFormatter={(v) => `${Number(v).toFixed(0)}`}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          width={36}
        />
        <Tooltip content={<RankTooltip />} cursor={{ fill: 'transparent' }} />

        <ReferenceLine y={HIGH} stroke={axisStroke} opacity={0.4} strokeDasharray="2 4" />
        <ReferenceLine y={LOW} stroke={axisStroke} opacity={0.4} strokeDasharray="2 4" />

        <Bar dataKey="value" isAnimationActive={false} radius={[3, 3, 0, 0]}>
          {rows.map((row) => (
            <Cell
              key={row.dte_scope}
              fill={row.percentile == null ? 'transparent' : barColor(row.percentile)}
              fillOpacity={row.percentile == null ? 0 : barOpacity(row.percentile)}
            />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            style={{ fontSize: 10, fill: 'var(--text-secondary)' }}
            formatter={(value: unknown) =>
              value == null ? '' : `${Number(value).toFixed(0)}`
            }
          />
        </Bar>

        {/* The refusal, drawn where the bar is not. A separate zero-height
            series so the text sits on the axis rather than floating at the
            height of a bar we are declining to draw. */}
        <Bar dataKey={() => 0} isAnimationActive={false} legendType="none">
          <LabelList
            dataKey="note"
            position="top"
            style={{ fontSize: 9, fill: 'var(--text-secondary)' }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
