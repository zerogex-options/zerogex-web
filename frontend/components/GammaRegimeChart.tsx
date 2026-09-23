'use client';

import { useMemo, useRef, useState } from 'react';
import {
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { robustDomain } from '@/core/regimeDomain';

import { getFiveMinuteSessionTimeline, safeTimeLabel } from '@/core/flowSeriesCharts';
import ChartHoverReadout, { readoutSide, type ReadoutRow } from '@/components/ChartHoverReadout';
import {
  HEDGING_PHONE_LEFT_AXIS,
  HEDGING_PHONE_MARGIN,
  HEDGING_PHONE_RIGHT_AXIS,
} from '@/components/HedgingFlowChart';
import { compactUsdTick } from '@/components/phoneAxisFormat';
import { useIsMobile } from '@/hooks/useIsMobile';
import { etDateKeyFor, etTodayDateKey } from '@/core/utils';
import type { GammaRegimeBar, GammaRegimeSeriesPayload } from '@/hooks/useGammaRegimeSeries';

/**
 * The structure half of the synchronized timeline.
 *
 * Hedging Flow says how hard the tape is pushing. This says whether the book
 * absorbs that push or amplifies it — the pairing Barrie described as a
 * terrain map, and the reason both charts carry the same `syncId`: hovering
 * either one crosshairs the same bar on the other, which is what makes them
 * one instrument instead of two pictures.
 *
 * Two lines, because collapsing them loses the distinction that matters:
 *
 * - `stability` — is near-spot gamma building or thinning? Positive means
 *   dealers hedge AGAINST moves (pinning, vol suppression); negative means
 *   the book has turned accelerant.
 * - `lean` — which side is it building on? Positive is supportive (building
 *   below spot / eroding above); negative is capping.
 *
 * A book can firm up symmetrically (stability up, lean flat) or roll its
 * gamma from below spot to above without changing near-spot totals at all
 * (lean down, stability flat). One line cannot say both.
 *
 * `mode` follows the flow panel rather than having its own control:
 * `rate` reads the rolling lens, `cumulative` the anchored one. Two toggles
 * that could disagree would let a reader compare a 30-minute flow rate
 * against a since-the-open structure change and think they lined up.
 */

export type RegimeMode = 'rate' | 'cumulative';

interface ChartRow {
  timestamp: string;
  stability: number | null;
  lean: number | null;
}

const SCORE = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
};

function alignToTimeline(bars: GammaRegimeBar[], mode: RegimeMode): ChartRow[] {
  const dateKey = bars.length > 0 ? etDateKeyFor(bars[bars.length - 1].timestamp) : etTodayDateKey();
  const timeline = getFiveMinuteSessionTimeline(dateKey || etTodayDateKey());
  const byTs = new Map(bars.map((b) => [b.timestamp, b]));

  return timeline.map((timestamp) => {
    const bar = byTs.get(timestamp);
    if (!bar) return { timestamp, stability: null, lean: null };
    return mode === 'rate'
      ? { timestamp, stability: bar.rolling_stability, lean: bar.rolling_lean }
      : { timestamp, stability: bar.anchored_stability, lean: bar.anchored_lean };
  });
}

export interface GammaRegimeChartProps {
  payload: GammaRegimeSeriesPayload;
  mode: RegimeMode;
  /** Shared with the flow chart so hovering either crosshairs both. */
  syncId?: string;
  height?: number;
  showLegend?: boolean;
  /** Lifted hover, shared with the flow chart above so both read one bar. */
  hoveredLabel?: string | null;
  onHoverChange?: (label: string | null) => void;
}

export default function GammaRegimeChart({
  payload,
  mode,
  syncId,
  height = 250,
  showLegend = true,
  hoveredLabel: controlledHover,
  onHoverChange,
}: GammaRegimeChartProps) {
  const [fullRange, setFullRange] = useState(false);
  const isMobile = useIsMobile();
  // See HedgingFlowChart: a tap ends in an emulated mouseleave.
  const lastTouchAtRef = useRef(0);
  const [uncontrolledHover, setUncontrolledHover] = useState<string | null>(null);
  const hoveredLabel = controlledHover !== undefined ? controlledHover : uncontrolledHover;
  const setHovered = onHoverChange ?? setUncontrolledHover;
  const rows = useMemo(() => alignToTimeline(payload.bars, mode), [payload.bars, mode]);
  const { domain, clipped } = useMemo(() => robustDomain(rows), [rows]);

  const hoverIndex = hoveredLabel ? rows.findIndex((r) => r.timestamp === hoveredLabel) : -1;
  const hovered = hoverIndex >= 0 ? rows[hoverIndex] : null;
  const readoutRows: ReadoutRow[] = hovered
    ? [
        {
          label: 'Stability',
          value: hovered.stability == null ? '—' : SCORE(hovered.stability),
          color: 'var(--color-king)',
        },
        {
          label: 'Lean',
          value: hovered.lean == null ? '—' : SCORE(hovered.lean),
          color: 'var(--color-pin)',
        },
      ]
    : [];

  const axisStroke = 'var(--color-text-primary)';

  if (payload.bars.length === 0) {
    return (
      <div className="py-6 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        No structure reading for this session yet.
      </div>
    );
  }

  return (
    <>
      <div className="relative">
      {hovered && (
        <ChartHoverReadout
          title={safeTimeLabel(hovered.timestamp)}
          rows={readoutRows}
          side={readoutSide(hoverIndex, rows.length)}
          top={showLegend ? 22 : 4}
        />
      )}
      <ResponsiveContainer width="100%" height={height}>
      {/*
        Margins must match HedgingFlowChart's exactly, and both axes must carry
        the same width. Recharts aligns synced charts by index, not by pixel —
        so a mismatched gutter slides one plot relative to the other and the
        crosshair lands on a bar the reader is not looking at.
      */}
      <ComposedChart
        data={rows}
        syncId={syncId}
        margin={isMobile ? HEDGING_PHONE_MARGIN : { top: 8, right: 8, bottom: 4, left: 8 }}
        onMouseMove={(state: { activeLabel?: string | number }) =>
          setHovered(state?.activeLabel != null ? String(state.activeLabel) : null)
        }
        // A dragging finger fires no mouse events (see HedgingFlowChart).
        onTouchStart={() => {
          lastTouchAtRef.current = Date.now();
        }}
        onTouchMove={(state: { activeLabel?: string | number }) => {
          lastTouchAtRef.current = Date.now();
          setHovered(state?.activeLabel != null ? String(state.activeLabel) : null);
        }}
        onMouseLeave={() => {
          if (Date.now() - lastTouchAtRef.current < 1000) return;
          setHovered(null);
        }}
      >
        <XAxis
          dataKey="timestamp"
          tickFormatter={safeTimeLabel}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          minTickGap={40}
        />
        <YAxis
          yAxisId="score"
          tickFormatter={isMobile ? compactUsdTick : SCORE}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          width={isMobile ? HEDGING_PHONE_LEFT_AXIS : 62}
          domain={fullRange ? ['auto', 'auto'] : domain}
          allowDataOverflow={!fullRange}
        />
        {/* Mirrors the flow chart's price axis so the two plot areas are the
            same width. No series is drawn on it. */}
        <YAxis yAxisId="spacer" orientation="right" width={isMobile ? HEDGING_PHONE_RIGHT_AXIS : 56} tick={false} axisLine={false} />

        {/* Cursor line only; the values are drawn in a corner instead of
            floating over the plot. See ChartHoverReadout. */}
        <Tooltip
          content={() => null}
          cursor={{ stroke: axisStroke, strokeWidth: 1, strokeOpacity: 0.7 }}
        />

        {showLegend && (
          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />
        )}

        {/* Zero is the whole reading: above it stabilizing, below accelerant. */}
        <ReferenceLine yAxisId="score" y={0} stroke={axisStroke} opacity={0.6} />

        <Line
          yAxisId="score"
          type="monotone"
          dataKey="stability"
          name="Stability (pinning ↔ accelerant)"
          stroke="var(--color-king)"
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
        <Line
          yAxisId="score"
          type="monotone"
          dataKey="lean"
          name="Lean (supportive ↔ capping)"
          stroke="var(--color-pin)"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          connectNulls={false}
        />
        </ComposedChart>
      </ResponsiveContainer>
      </div>

      {clipped > 0 && (
        <button
          type="button"
          onClick={() => setFullRange((v) => !v)}
          className="mt-1 text-[11px] underline underline-offset-2"
          style={{ color: 'var(--color-text-secondary)' }}
          title="Gamma explodes as 0DTE expiry approaches, so readings into the close routinely dwarf the rest of the session."
        >
          {fullRange
            ? 'Scaled to the full range. Fit to session'
            : `${clipped} reading${clipped === 1 ? '' : 's'} off scale near the close. Show full range`}
        </button>
      )}
    </>
  );
}
