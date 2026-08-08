'use client';

/**
 * Fleet Performance TREND — the slope, not the since-inception level.
 *
 * The hero's "Fleet NAV" delta is current/starting − 1: cumulative from
 * inception, so it stays anchored to the pre-fix drawdown (and to any large
 * loss that settled late) and hides whether the fleet is getting BETTER. This
 * shows the derivative instead, fed by GET /api/tradeworkz/performance-trend:
 *
 *   • Top pane — cumulative return since the window start (an epoch, not
 *     inception), fleet vs a SPY buy-hold, so "up" has to mean "up vs the
 *     tape". One %-axis (the dataviz "one axis per chart" rule; the two series
 *     are directly comparable returns, not mismatched units).
 *   • Bottom pane — per-session realized P&L bars, green/red by sign. Its own
 *     $-axis, aligned to the same dates via a matched YAxis width + margins.
 *   • Dashed verticals — dated engine/strategy changes (tw_change_log), so a
 *     change and the curve bending after it line up.
 *   • Chips — rolling win rate / profit factor / expectancy over a selectable
 *     window; this is the "is it improving" readout that should front the
 *     dashboard rather than lifetime NAV.
 */

import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtDate, fmtPct, fmtRatio, fmtSignedMoney, fmtSignedPct, toneVar } from './format';
import type { PerformanceTrend, TrendChange, TrendPoint, TrendRolling } from './types';

const Y_WIDTH = 56;
const MARGIN = { top: 8, right: 16, left: 0, bottom: 4 };

interface Props {
  data: PerformanceTrend;
}

export default function PerformanceTrendChart({ data }: Props) {
  const windows = data.windows?.length ? data.windows : [5, 10, 20];
  // Default to the middle window (a 10-session read balances responsiveness
  // against noise); fall back to the first if fewer are configured.
  const [win, setWin] = useState<number>(windows[Math.min(1, windows.length - 1)]);

  const series = useMemo(() => data.series ?? [], [data.series]);
  const rolling: TrendRolling | null =
    data.headline?.windows?.[String(win)] ??
    series[series.length - 1]?.rolling?.[String(win)] ??
    null;

  // Snap each change date to the first trading session on/after it, so the
  // marker lands on a real category value on the (categorical) x-axis.
  const markers = useMemo(() => snapChanges(data.changes ?? [], series), [data.changes, series]);

  if (series.length < 2) {
    return (
      <div className="h-52 flex items-center justify-center text-xs text-[var(--color-text-secondary)]">
        The performance trend appears here once the fleet has at least two closed sessions.
      </div>
    );
  }

  // Bar (right) axis gets generous top headroom so per-session P&L bars occupy
  // the lower band and stay clear of the cumulative-return lines above them.
  const pnlAbsSpan = Math.max(1, ...series.map((p) => Math.abs(p.realized_pnl)));
  const pnlFloor = Math.min(0, ...series.map((p) => p.realized_pnl));
  const pnlDomain: [number, number] = [pnlFloor - pnlAbsSpan * 0.12, pnlAbsSpan * 2.6];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <RollingChips rolling={rolling} win={win} />
        <WindowToggle windows={windows} current={win} onChange={setWin} />
      </div>

      {/* Single plot: cumulative return lines (left %-axis) + per-session P&L
          bars (right $-axis) share one x-axis, so the change markers line up
          across both. */}
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={series} margin={{ ...MARGIN, top: 20, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.5} />
            <XAxis
              dataKey="session_date"
              tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
              tickFormatter={fmtDate}
              interval="preserveStartEnd"
              minTickGap={40}
              stroke="var(--color-border)"
            />
            <YAxis
              yAxisId="pct"
              orientation="left"
              width={Y_WIDTH}
              tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
              tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${(v * 100).toFixed(0)}%`}
              stroke="var(--color-border)"
            />
            <YAxis
              yAxisId="pnl"
              orientation="right"
              width={Y_WIDTH}
              domain={pnlDomain}
              tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
              tickFormatter={(v: number) => fmtSignedMoney(v)}
              stroke="var(--color-border)"
            />
            <ReferenceLine yAxisId="pct" y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
            <Tooltip
              cursor={{ stroke: 'var(--color-info)', strokeWidth: 1, strokeDasharray: '3 3' }}
              content={<TrendTooltip />}
            />
            <Bar
              yAxisId="pnl"
              dataKey="realized_pnl"
              name="Session P&L"
              maxBarSize={22}
              isAnimationActive={false}
            >
              {series.map((p) => (
                <Cell
                  key={p.session_date}
                  fill={p.realized_pnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)'}
                  fillOpacity={0.7}
                />
              ))}
            </Bar>
            <Line
              yAxisId="pct"
              dataKey="spy_cum_return_pct"
              name="SPY buy-hold"
              type="monotone"
              stroke="var(--color-text-secondary)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              yAxisId="pct"
              dataKey="fleet_cum_return_pct"
              name="Fleet"
              type="monotone"
              stroke="var(--color-info)"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            {markers.map((m, i) => (
              <ReferenceLine
                key={m.date}
                yAxisId="pct"
                x={m.snapped}
                stroke="var(--color-info)"
                strokeDasharray="4 3"
                strokeOpacity={0.85}
                label={{
                  value: String(i + 1),
                  position: 'top',
                  fontSize: 11,
                  fontWeight: 700,
                  fill: 'var(--color-info)',
                }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {markers.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
          {markers.map((m, i) => (
            <span key={m.date} className="inline-flex items-center gap-1.5 text-[11px]">
              <span
                className="inline-flex items-center justify-center rounded-full text-[9px] font-bold flex-shrink-0"
                style={{
                  width: 15,
                  height: 15,
                  border: '1px solid var(--color-info)',
                  color: 'var(--color-info)',
                }}
              >
                {i + 1}
              </span>
              <span className="text-[var(--color-text-primary)] font-medium">{fmtDate(m.date)}</span>
              <span className="text-[var(--color-text-secondary)]">{m.label}</span>
            </span>
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-[11px] text-[var(--color-text-secondary)] leading-relaxed">
        Lines = cumulative realized return since the window start (left axis):{' '}
        <span style={{ color: 'var(--color-info)' }}>fleet</span> vs{' '}
        <span className="text-[var(--color-text-primary)]">SPY buy-hold</span> (dashed). Bars =
        per-session realized P&amp;L (right axis). Numbered markers are engine / strategy changes,
        keyed above. Rebased to the window start, so the pre-fix drawdown does not anchor the view.
      </p>
    </div>
  );
}

function RollingChips({ rolling, win }: { rolling: TrendRolling | null; win: number }) {
  if (!rolling) return <div />;
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">
        Trailing {win} sessions
      </span>
      <Chip label="Realized" value={fmtSignedMoney(rolling.realized_pnl)} tone={toneVar(rolling.realized_pnl)} />
      <Chip label="Win rate" value={fmtPct(rolling.win_rate, 0)} />
      <Chip label="Profit factor" value={fmtRatio(rolling.profit_factor)} tone={pfTone(rolling.profit_factor)} />
      <Chip
        label="Expectancy"
        value={rolling.expectancy === null ? '—' : `${fmtSignedMoney(rolling.expectancy)}/trade`}
        tone={toneVar(rolling.expectancy)}
      />
    </div>
  );
}

function Chip({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</span>
      <span className="text-sm font-semibold tabular-nums" style={{ color: tone ?? 'var(--color-text-primary)' }}>
        {value}
      </span>
    </span>
  );
}

function WindowToggle({
  windows,
  current,
  onChange,
}: {
  windows: number[];
  current: number;
  onChange: (w: number) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full p-1"
      style={{ backgroundColor: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)' }}
    >
      {windows.map((w) => {
        const active = w === current;
        return (
          <button
            key={w}
            onClick={() => onChange(w)}
            className="text-xs px-3 py-1.5 rounded-full transition-colors font-medium"
            style={{
              backgroundColor: active ? 'var(--color-info)' : 'transparent',
              color: active ? 'var(--color-on-info, #ffffff)' : 'var(--color-text-secondary)',
            }}
          >
            {w}d
          </button>
        );
      })}
    </div>
  );
}

interface TooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ dataKey: string; value: number | null; payload: TrendPoint }>;
}

function TrendTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  return (
    <div
      className="p-3 rounded-xl text-xs"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        minWidth: 180,
      }}
    >
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
        {fmtDate(String(label))} · {p.trades} trade{p.trades === 1 ? '' : 's'}
      </div>
      <Row label="Session P&L" value={fmtSignedMoney(p.realized_pnl)} tone={toneVar(p.realized_pnl)} />
      <Row label="Fleet (cum.)" value={fmtSignedPct(p.fleet_cum_return_pct)} tone={toneVar(p.fleet_cum_return_pct)} />
      <Row label="SPY (cum.)" value={fmtSignedPct(p.spy_cum_return_pct)} />
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className="tabular-nums" style={{ color: tone ?? 'var(--color-text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

/** Profit factor > 1 is green, < 1 red, n/a neutral. */
function pfTone(pf: number | null): string {
  if (pf === null || !Number.isFinite(pf)) return 'var(--color-text-secondary)';
  if (pf > 1) return 'var(--color-bull)';
  if (pf < 1) return 'var(--color-bear)';
  return 'var(--color-text-secondary)';
}

interface Marker {
  date: string;
  snapped: string;
  label: string;
}

/** Snap each change to the first session on/after its date (markers must land
 *  on a real category value; a change on a non-trading day snaps forward). */
function snapChanges(changes: TrendChange[], series: TrendPoint[]): Marker[] {
  const dates = series.map((s) => s.session_date);
  const out: Marker[] = [];
  for (const c of changes) {
    const snapped = dates.find((d) => d >= c.date);
    if (snapped) out.push({ date: c.date, snapped, label: c.label });
  }
  return out;
}
