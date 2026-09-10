'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getFiveMinuteSessionTimeline, safeTimeLabel } from '@/core/flowSeriesCharts';
import { etDateKeyFor, etTodayDateKey } from '@/core/utils';
import type {
  HedgingFlowBar,
  HedgingFlowFlip,
  HedgingFlowPayload,
} from '@/hooks/useHedgingFlow';

/**
 * The Hedging Flow panel.
 *
 * Two views of one quantity, because they answer different questions and a
 * single line cannot do both:
 *
 * - `cumulative` — where the session has leaned in total. Stacked call-side
 *   and put-side contributions, so you can see WHICH book is doing the
 *   pushing, with the net as a line on top.
 * - `rate` — how much pressure is being created right now, per bar, with the
 *   moving average over it. This is the view where "accelerates" and
 *   "reverses" are visible at all; the cumulative curve is an integral and
 *   moves too slowly to show a turn.
 *
 * Price rides the right axis in both, on the same 5-minute grid the Options
 * Flow chart uses, so the panels stack into one synchronized timeline.
 *
 * Flip markers are drawn on the rate view only. On the cumulative view they
 * would sit at points where the cumulative line is doing nothing visible,
 * which reads as noise rather than signal.
 */

type ViewMode = 'cumulative' | 'rate';

interface ChartRow {
  timestamp: string;
  callFlow: number | null;
  putFlow: number | null;
  netFlow: number | null;
  netFlowMa: number | null;
  price: number | null;
}

const USD = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

/**
 * Lay bars onto the full session grid so the x-axis matches every other chart
 * on the page even before the session fills in. Bars that have not happened
 * yet stay null rather than zero — a zero would draw a flat line through the
 * afternoon that looks like measured "no pressure".
 */
function alignToTimeline(bars: HedgingFlowBar[], mode: ViewMode): ChartRow[] {
  const dateKey = bars.length > 0 ? etDateKeyFor(bars[bars.length - 1].timestamp) : etTodayDateKey();
  const timeline = getFiveMinuteSessionTimeline(dateKey || etTodayDateKey());
  const byTs = new Map(bars.map((b) => [b.timestamp, b]));

  return timeline.map((timestamp) => {
    const bar = byTs.get(timestamp);
    if (!bar) {
      return { timestamp, callFlow: null, putFlow: null, netFlow: null, netFlowMa: null, price: null };
    }
    const cumulative = mode === 'cumulative';
    return {
      timestamp,
      callFlow: cumulative ? bar.cum_call_usd : bar.call_flow_usd,
      putFlow: cumulative ? bar.cum_put_usd : bar.put_flow_usd,
      netFlow: cumulative ? bar.cum_net_usd : bar.net_flow_usd,
      netFlowMa: cumulative ? null : bar.net_flow_ma_usd,
      price: bar.underlying_price,
    };
  });
}

function FlipBadge({ flip }: { flip: HedgingFlowFlip }) {
  const buying = flip.direction === 'to_buying';
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{
        // bull/bear-soft, not positive/negative-soft: --color-positive and
        // --color-negative are aliases of bull/bear, but no -soft alias
        // exists, so the badge rendered with no background at all.
        backgroundColor: buying ? 'var(--color-bull-soft)' : 'var(--color-bear-soft)',
        color: buying ? 'var(--color-positive)' : 'var(--color-negative)',
      }}
      title={`Swing across zero: ${USD(flip.magnitude_usd)}, ${flip.session_ratio.toFixed(1)}x the session's typical swing`}
    >
      {buying ? '▲' : '▼'} Flipped to {buying ? 'buying' : 'selling'} pressure at{' '}
      {safeTimeLabel(flip.bar_start)}
      {!flip.is_significant && (
        <span style={{ opacity: 0.7, fontWeight: 400 }}>(light)</span>
      )}
    </span>
  );
}

export interface HedgingFlowChartProps {
  payload: HedgingFlowPayload;
  /** Compact mode drops the controls and legend for dashboard-tile use. */
  compact?: boolean;
  /**
   * Lift the view mode when a page pairs this with the structure chart, so one
   * toggle drives both. Omitted, the chart owns its own mode — which is what
   * the standalone dashboard widget wants.
   */
  mode?: ViewMode;
  onModeChange?: (mode: ViewMode) => void;
  /** Shared with the structure chart so hovering either crosshairs both. */
  syncId?: string;
  /**
   * Hide this chart's time labels. Stacked synchronized panels should show ONE
   * axis, at the bottom of the stack: two sets of labels on identical
   * geometry can still pick different ticks, which reads as disagreement
   * between panels that are in fact aligned to the pixel.
   */
  hideTimeAxis?: boolean;
}

export default function HedgingFlowChart({
  payload,
  compact = false,
  mode: controlledMode,
  onModeChange,
  syncId,
  hideTimeAxis = false,
}: HedgingFlowChartProps) {
  const [uncontrolledMode, setUncontrolledMode] = useState<ViewMode>('rate');
  const mode = controlledMode ?? uncontrolledMode;
  const setMode = onModeChange ?? setUncontrolledMode;
  const [onlySignificant, setOnlySignificant] = useState(true);

  const rows = useMemo(() => alignToTimeline(payload.bars, mode), [payload.bars, mode]);

  // Same 3% padding convention as getUnderlyingDomain, computed locally: that
  // helper takes a FlowTimeseriesRow, and fabricating six unrelated null
  // fields to borrow fifteen lines of min/max would couple this panel to a
  // row shape it has nothing to do with.
  const priceDomain = useMemo((): readonly [number, number] | readonly ['auto', 'auto'] => {
    const prices = rows
      .map((r) => r.price)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (prices.length === 0) return ['auto', 'auto'] as const;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = Math.max(0.01, max - min) * 0.03;
    return [min - padding, max + padding] as const;
  }, [rows]);

  // Rate-view flips only (see the component docstring for why).
  const flipMarkers = useMemo(() => {
    if (mode !== 'rate') return [];
    return payload.flips
      .filter((f) => f.kind === 'rate')
      .filter((f) => !onlySignificant || f.is_significant);
  }, [payload.flips, mode, onlySignificant]);

  const latestFlip = flipMarkers.length > 0 ? flipMarkers[flipMarkers.length - 1] : null;

  // Both themes resolve this token themselves, so the axis needs no branch.
  const axisStroke = 'var(--color-text-primary)';

  if (payload.bars.length === 0) {
    return (
      <div className="py-8 text-center" style={{ color: 'var(--color-text-secondary)' }}>
        No hedging flow for this session yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {(['rate', 'cumulative'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors"
                style={{
                  borderColor: mode === m ? 'var(--color-info)' : 'var(--color-border)',
                  backgroundColor: mode === m ? 'var(--color-info-soft)' : 'transparent',
                  color: mode === m ? 'var(--color-info)' : 'var(--color-text-secondary)',
                }}
              >
                {m === 'rate' ? 'Pressure rate' : 'Session cumulative'}
              </button>
            ))}
          </div>

          {mode === 'rate' && (
            <label
              className="flex cursor-pointer items-center gap-2 text-xs"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <input
                type="checkbox"
                checked={onlySignificant}
                onChange={(e) => setOnlySignificant(e.target.checked)}
              />
              Significant flips only
            </label>
          )}
        </div>
      )}

      {latestFlip && !compact && (
        <div>
          <FlipBadge flip={latestFlip} />
        </div>
      )}

      <ResponsiveContainer width="100%" height={compact ? 220 : 360}>
        <ComposedChart data={rows} syncId={syncId} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <XAxis
            dataKey="timestamp"
            tickFormatter={safeTimeLabel}
            stroke={axisStroke}
            tick={hideTimeAxis ? false : { fontSize: 10 }}
            height={hideTimeAxis ? 8 : undefined}
            minTickGap={40}
          />
          <YAxis
            yAxisId="flow"
            tickFormatter={USD}
            stroke={axisStroke}
            tick={{ fontSize: 10 }}
            width={62}
          />
          <YAxis
            yAxisId="price"
            orientation="right"
            domain={priceDomain}
            stroke={axisStroke}
            tick={{ fontSize: 10 }}
            width={56}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--color-chart-tooltip-bg)',
              borderColor: 'var(--color-border)',
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
              return [name === 'Price' ? `$${n.toFixed(2)}` : USD(n), name];
            }}
          />

          {!compact && <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />}

          {/* Zero is the axis that matters here: above it dealers are buying. */}
          <ReferenceLine yAxisId="flow" y={0} stroke={axisStroke} opacity={0.6} />

          {mode === 'cumulative' ? (
            <>
              <Area
                yAxisId="flow"
                type="monotone"
                dataKey="callFlow"
                name="Call-driven"
                stackId="flow"
                stroke="var(--color-positive)"
                fill="var(--color-positive)"
                fillOpacity={0.25}
                connectNulls={false}
              />
              <Area
                yAxisId="flow"
                type="monotone"
                dataKey="putFlow"
                name="Put-driven"
                stackId="flow"
                stroke="var(--color-negative)"
                fill="var(--color-negative)"
                fillOpacity={0.25}
                connectNulls={false}
              />
              <Line
                yAxisId="flow"
                type="monotone"
                dataKey="netFlow"
                name="Net hedging pressure"
                stroke="var(--color-info)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </>
          ) : (
            <>
              <Bar
                yAxisId="flow"
                dataKey="netFlow"
                name="Pressure this bar"
                fill="var(--color-info)"
                fillOpacity={0.35}
                isAnimationActive={false}
              />
              <Line
                yAxisId="flow"
                type="monotone"
                dataKey="netFlowMa"
                name={`${payload.smoothing_bars}-bar average`}
                stroke="var(--color-info)"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </>
          )}

          <Line
            yAxisId="price"
            type="monotone"
            dataKey="price"
            name="Price"
            stroke="var(--color-warning)"
            strokeWidth={1.5}
            dot={false}
            connectNulls
          />

          {flipMarkers.map((flip) => (
            <ReferenceDot
              key={`${flip.kind}-${flip.bar_start}`}
              yAxisId="flow"
              x={flip.bar_start}
              y={0}
              r={4}
              fill={
                flip.direction === 'to_buying'
                  ? 'var(--color-positive)'
                  : 'var(--color-negative)'
              }
              stroke="var(--color-surface)"
              strokeWidth={1.5}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/*
        Server-authored and non-negotiable. The estimate rests on the
        passive-side-is-a-market-maker assumption, which is under test rather
        than established, so the surface has to say so.
      */}
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
        {payload.disclosure}
      </p>
    </div>
  );
}
