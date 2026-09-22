'use client';

/**
 * IntradayConeChart — the re-anchored cone for one fire, drawn against the
 * tape that followed it.
 *
 * The daily forecast band is one shape committed at the open. This is the
 * other question: from *here*, where does price stay for the next two hours?
 * Each fire anchors on its own bar and re-reads the dealer surface, so the
 * cone that matters is the one you were looking at — which is why the fire is
 * selectable rather than always the latest. Scrubbing back to 11:00 shows the
 * claim as it stood at 11:00, with the tape that came after it.
 *
 * Two encoding decisions worth naming:
 *
 * * **The cone is drawn as two stacked areas**, a transparent base at
 *   `band_low` and a visible span of `band_high − band_low`. Stacking is used
 *   rather than a range `dataKey` because a stacked pair renders identically
 *   across recharts versions and degrades to something sensible if a bound is
 *   ever null.
 * * **The band starts as a point at the anchor.** A cone that begins at full
 *   width would imply price could gap to the edge instantly; starting at spot
 *   and widening is what the horizon sigma actually says.
 *
 * The verdict strip under the chart reads held / broke / not scored per
 * horizon. "Not scored" is a real third state — a window that never produced
 * bars — and is deliberately not folded into either outcome.
 */

import { useMemo, useState } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useChartTheme } from '@/hooks/useChartTheme';
import Panel from '@/components/layout/Panel';
import {
  buildConePoints,
  buildSpotPath,
  coneDomain,
  conePriceDecimals,
  conePriceDomain,
  horizonVerdict,
  mergeConeSeries,
} from '@/core/coneChart';
import type { ConeFire, ConeSessionPayload } from '@/hooks/useIntradayCone';

const HORIZON_LABELS: Record<number, string> = {
  30: '+30m',
  60: '+1h',
  90: '+90m',
  120: '+2h',
};

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

function fmtPrice(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(2);
}

function VerdictChip({ horizon, theme }: { horizon: ConeFire['horizons'][number]; theme: ReturnType<typeof useChartTheme> }) {
  const label = HORIZON_LABELS[horizon.horizon_min] ?? `+${horizon.horizon_min}m`;

  const verdict = horizonVerdict(horizon);
  const color =
    verdict === 'held' ? theme.bull : verdict === 'broke' ? theme.bear : theme.textMuted;

  return (
    <div
      className="flex flex-col gap-0.5 rounded-sm px-2.5 py-1.5"
      style={{ border: `1px solid ${theme.border}`, background: theme.bgCard }}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: theme.text }}>
          {label}
        </span>
        <span className="text-[11px] font-medium" style={{ color }}>
          {verdict}
        </span>
      </div>
      <div className="text-[10px] tabular-nums" style={{ color: theme.textDim }}>
        {fmtPrice(horizon.band_low)}–{fmtPrice(horizon.band_high)}
        {horizon.hold_prob !== null ? ` · ${(horizon.hold_prob * 100).toFixed(0)}%` : ''}
      </div>
    </div>
  );
}

export default function IntradayConeChart({
  payload,
  height = 340,
}: {
  payload: ConeSessionPayload | null;
  height?: number;
}) {
  const theme = useChartTheme();
  const fires = useMemo(() => payload?.fires ?? [], [payload]);
  const [selected, setSelected] = useState<number | null>(null);

  // Default to the latest fire, but let an explicit pick win — scrubbing back
  // is the point, so a poll landing mid-read must not yank the view forward.
  const index = selected === null ? fires.length - 1 : Math.min(selected, fires.length - 1);
  const fire = index >= 0 ? fires[index] : null;

  const { rows, domain, priceDomain, spotPoints, priceDecimals } = useMemo(() => {
    if (!fire) {
      return {
        rows: [], domain: null, priceDomain: null,
        spotPoints: 0, priceDecimals: 2,
      };
    }
    const path = buildSpotPath(fires);
    const merged = mergeConeSeries(buildConePoints(fire), path);
    return {
      rows: merged,
      domain: coneDomain(merged),
      priceDecimals: conePriceDecimals(fire.anchor_spot ?? 0),
      priceDomain: conePriceDomain(merged, [
        fire.call_wall,
        fire.put_wall,
        fire.gamma_flip,
      ]),
      spotPoints: path.length,
    };
  }, [fire, fires]);


  if (!payload || fires.length === 0 || !fire || !domain) {
    return (
      <Panel>
        <div className="text-[13px]" style={{ color: theme.textMuted }}>
          No cone has been committed for this session yet.
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-semibold" style={{ color: theme.text }}>
          Where does it stay from here?
        </h2>
        <div className="text-[11px] tabular-nums" style={{ color: theme.textMuted }}>
          {payload.symbol} · {payload.session_date} · {payload.n_fires} fires ·{' '}
          {payload.n_graded > 0
            ? `${payload.n_held}/${payload.n_graded} held`
            : 'none graded yet'}
        </div>
      </div>

      <div className="mt-1 text-[12px]" style={{ color: theme.textDim }}>
        Anchored {fire.forecast_ts ? fmtTime(Date.parse(fire.forecast_ts)) : '—'} at{' '}
        {fmtPrice(fire.anchor_spot)}
      </div>

      <div className="mt-4" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={domain}
              tickFormatter={fmtTime}
              tick={{ fontSize: 11, fill: theme.textMuted }}
              stroke={theme.border}
            />
            <YAxis
              // Explicit domain AND allowDataOverflow: see conePriceDomain.
              // The band is two stacked areas, whose baseline is zero, so
              // 'auto' anchors the axis at 0 and recharts would expand an
              // explicit domain back to it without the overflow flag.
              domain={priceDomain ?? ['auto', 'auto']}
              allowDataOverflow={priceDomain !== null}
              tick={{ fontSize: 11, fill: theme.textMuted }}
              stroke={theme.border}
              width={64}
              tickFormatter={(v: number) => v.toFixed(priceDecimals)}
            />
            <Tooltip
              contentStyle={{
                background: theme.bgCard,
                border: `1px solid ${theme.border}`,
                borderRadius: 2,
                fontSize: 12,
              }}
              labelFormatter={(v) => fmtTime(Number(v))}
              formatter={(value?: number, name?: string) => [
                fmtPrice(value),
                name === 'spot' ? 'price' : name ?? '',
              ]}
            />

            {/* The cone: a transparent base at band_low, a visible span above it. */}
            <Area
              dataKey="bandBase"
              stackId="cone"
              stroke="none"
              fill="none"
              isAnimationActive={false}
              connectNulls
            />
            <Area
              dataKey="bandSpan"
              stackId="cone"
              stroke={theme.accent}
              strokeWidth={1}
              fill={theme.accent}
              fillOpacity={0.16}
              isAnimationActive={false}
              connectNulls
              name="cone"
            />

            <Line
              dataKey="spot"
              stroke={theme.text}
              strokeWidth={1.5}
              // A line through one point draws nothing, so the session's
              // first fire would show a cone with no price on it at all.
              // Dots carry the early session until there is a path to draw.
              dot={spotPoints <= 3 ? { r: 2.5, fill: theme.text } : false}
              isAnimationActive={false}
              connectNulls
              name="spot"
            />

            {fire.call_wall !== null && (
              <ReferenceLine
                y={fire.call_wall}
                stroke={theme.bull}
                strokeDasharray="3 3"
                label={{ value: 'call wall', position: 'insideTopRight', fontSize: 10, fill: theme.bull }}
              />
            )}
            {fire.put_wall !== null && (
              <ReferenceLine
                y={fire.put_wall}
                stroke={theme.bear}
                strokeDasharray="3 3"
                label={{ value: 'put wall', position: 'insideBottomRight', fontSize: 10, fill: theme.bear }}
              />
            )}
            {fire.gamma_flip !== null && (
              <ReferenceLine
                y={fire.gamma_flip}
                stroke={theme.flip}
                strokeDasharray="2 4"
                label={{ value: 'flip', position: 'insideTopLeft', fontSize: 10, fill: theme.flip }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[...fire.horizons]
          .sort((a, b) => a.horizon_min - b.horizon_min)
          .map((h) => (
            <VerdictChip key={h.horizon_min} horizon={h} theme={theme} />
          ))}
      </div>

      {fires.length > 1 && (
        <div className="mt-4">
          <label
            className="text-[10px] uppercase tracking-wide"
            style={{ color: theme.textMuted }}
            htmlFor="cone-fire-scrub"
          >
            Scrub the session ({index + 1} of {fires.length})
          </label>
          <input
            id="cone-fire-scrub"
            type="range"
            min={0}
            max={fires.length - 1}
            value={index}
            onChange={(e) => setSelected(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </div>
      )}

      <p className="mt-4 max-w-[68ch] text-[11px] leading-relaxed" style={{ color: theme.textMuted }}>
        The percentage on each horizon is the chance price never leaves that
        band at any point in the window — not the chance it finishes inside.
        A path that pierces the band and comes back did not hold, and is
        graded as broken.
      </p>
    </Panel>
  );
}
