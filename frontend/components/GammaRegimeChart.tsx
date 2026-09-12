'use client';

import { useMemo, useState } from 'react';
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

import { getFiveMinuteSessionTimeline, safeTimeLabel } from '@/core/flowSeriesCharts';
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

/**
 * A y-domain that survives the close.
 *
 * Dealer gamma explodes as 0DTE time-to-expiry goes to zero, so the last
 * twenty minutes of a session routinely carry readings an order of magnitude
 * above everything before them. That spike is real, but on a linear axis it
 * sets the scale for the whole chart and flattens the other six hours into a
 * line sitting on zero — the session becomes unreadable in exchange for one
 * feature the reader can already see coming.
 *
 * So the default domain is built from a high quantile of |value| rather than
 * the maximum, and the outliers are allowed to run off the top. Nothing is
 * hidden: the caller renders a count of what is off scale and a control to
 * switch to the full range, because silently clipping a $3B print would be
 * its own kind of lie.
 */
const DOMAIN_QUANTILE = 0.95;
const DOMAIN_HEADROOM = 1.15;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)));
  return sorted[idx];
}

function robustDomain(rows: ChartRow[]): { domain: [number, number]; clipped: number } {
  const values = rows
    .flatMap((r) => [r.stability, r.lean])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return { domain: [-1, 1], clipped: 0 };

  const magnitudes = values.map(Math.abs).sort((a, b) => a - b);
  const cap = quantile(magnitudes, DOMAIN_QUANTILE) * DOMAIN_HEADROOM;
  const max = magnitudes[magnitudes.length - 1];

  // A session with no outliers should not be zoomed into: when the cap is
  // already close to the true max, just use the max and clip nothing.
  if (cap <= 0 || max <= cap * 1.05) {
    const bound = Math.max(max * DOMAIN_HEADROOM, 1);
    return { domain: [-bound, bound], clipped: 0 };
  }

  const clipped = values.filter((v) => Math.abs(v) > cap).length;
  return { domain: [-cap, cap], clipped };
}


export interface GammaRegimeChartProps {
  payload: GammaRegimeSeriesPayload;
  mode: RegimeMode;
  /** Shared with the flow chart so hovering either crosshairs both. */
  syncId?: string;
  height?: number;
  showLegend?: boolean;
}

export default function GammaRegimeChart({
  payload,
  mode,
  syncId,
  height = 200,
  showLegend = true,
}: GammaRegimeChartProps) {
  const [fullRange, setFullRange] = useState(false);
  const rows = useMemo(() => alignToTimeline(payload.bars, mode), [payload.bars, mode]);
  const { domain, clipped } = useMemo(() => robustDomain(rows), [rows]);

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
      <ResponsiveContainer width="100%" height={height}>
      {/*
        Margins must match HedgingFlowChart's exactly, and both axes must carry
        the same width. Recharts aligns synced charts by index, not by pixel —
        so a mismatched gutter slides one plot relative to the other and the
        crosshair lands on a bar the reader is not looking at.
      */}
      <ComposedChart data={rows} syncId={syncId} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
        <XAxis
          dataKey="timestamp"
          tickFormatter={safeTimeLabel}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          minTickGap={40}
        />
        <YAxis
          yAxisId="score"
          tickFormatter={SCORE}
          stroke={axisStroke}
          tick={{ fontSize: 10 }}
          width={62}
          domain={fullRange ? ['auto', 'auto'] : domain}
          allowDataOverflow={!fullRange}
        />
        {/* Mirrors the flow chart's price axis so the two plot areas are the
            same width. No series is drawn on it. */}
        <YAxis yAxisId="spacer" orientation="right" width={56} tick={false} axisLine={false} />

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
            return [SCORE(n), name];
          }}
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
