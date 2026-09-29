'use client';

import { useMemo, useRef } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { nonNegativeDomain, robustDomain } from '@/core/regimeDomain';
import { segmentStops, stateSegments, weatherStateColor } from '@/core/weatherStateColors';
import {
  changesForField,
  commentAt,
  fieldSpec,
  type WeatherFieldKey,
  type WeatherFieldPoint,
} from '@/core/weatherFields';
import type { GammaWeatherSeriesPayload } from '@/hooks/useGammaWeatherSeries';
import { safeTimeLabel } from '@/core/flowSeriesCharts';
import { buildThirtyMinGridlines, sessionTimeTick } from '@/components/ChartGridlines';
import { compactUsdTick, niceTicksWithin } from '@/components/phoneAxisFormat';
import { useIsMobile } from '@/hooks/useIsMobile';

const FULL_HEIGHT = 200;
const COMPACT_HEIGHT = 104;

/**
 * An axis label for one field's unit.
 *
 * The minus sign goes before the dollar sign, not after it: dividing a negative
 * value and then prefixing "$" produced "$-1.00B", which is not how anyone
 * writes money and did not match the two charts below the header.
 *
 * Points print the decimals they need and no more. The cushion axis ticks on
 * whole points, so a fixed decimal made every label "10.0 pts".
 */
function compact(value: number, unit: 'usd' | 'points'): string {
  if (unit === 'points') return `${parseFloat(value.toFixed(1))} pts`;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export interface WeatherFieldChartProps {
  field: WeatherFieldKey;
  /** Oldest first. The stacked view aligns these to the session grid first. */
  points: WeatherFieldPoint[];
  series: GammaWeatherSeriesPayload | null;
  loading?: boolean;
  /**
   * Hover lives in the caller, not here, so five stacked charts read one
   * cursor. A chart standing alone owns its own state and passes it straight
   * back down.
   */
  hovered: string | null;
  onHover: (bar: string | null) => void;
  /** Shorter, no caption, tighter gutters. The stacked reading. */
  compact?: boolean;
  /** Only the last chart in a stack draws the clock; the rest share it. */
  showTimeAxis?: boolean;
  /** Recharts syncs by row index, so a stack must be aligned before it syncs. */
  syncId?: string;
  /**
   * Whether the strip carries the Weather state as well as the field's own
   * line. False in a stack: the state is one reading for the whole panel, so
   * five charts would print the same sentence five times, which is the exact
   * redundancy the short form was introduced to remove. The stack prints it
   * once instead.
   */
  showState?: boolean;
}

/**
 * One field's session, as a colored line with its comment strip.
 *
 * Extracted from the drawer so the stacked view and the one-at-a-time view
 * cannot drift apart. Two implementations of "the Lean chart" is how a page
 * ends up with two answers for the same field depending on which control the
 * reader used to get there.
 *
 * Draws only what it is given. It never classifies anything and never fetches:
 * the numbers are the payloads the page already holds for the charts below the
 * header, and the comments come from the server's own change list.
 */
export default function WeatherFieldChart({
  field,
  points,
  series,
  loading = false,
  hovered,
  onHover,
  compact: isCompact = false,
  showTimeAxis = true,
  syncId,
  showState = true,
}: WeatherFieldChartProps) {
  const spec = fieldSpec(field);
  const isMobile = useIsMobile();
  // A tap ends in an emulated mouseleave, which would snap the trail straight
  // back to the latest bar; a leave right after a touch is ignored.
  const lastTouchAtRef = useRef(0);

  const marks = useMemo(
    () => changesForField(series?.changes ?? [], field).filter((c) => !c.opening),
    [series, field],
  );

  // `timestamp`, not `bar_start`, so a row is the same shape the two charts
  // below the header plot and the shared gridline builder already takes.
  const rows = useMemo(
    () =>
      points.map((p) => ({
        timestamp: p.bar_start,
        value: p.value,
        smoothed: p.smoothed,
      })),
    [points],
  );

  // Named for what it is on this field. On Pressure the 3-bar average IS the
  // 15-minute clock, and calling it by the name the panel has always used
  // keeps it recognizable as the same line the chart below draws.
  const smootherName = field === 'pressure' ? '3-bar average' : '15-minute average';

  // Reuses the structure panel's rule so one spike cannot flatten the session,
  // but only for the fields where crossing zero is the story: that rule is
  // symmetric about zero, and Flip Cushion is absolute room before crossing
  // and never prints below it. See nonNegativeDomain.
  const domain = useMemo(
    () =>
      spec.zeroLine
        ? robustDomain(points.map((p) => ({ stability: p.value, lean: null }))).domain
        : nonNegativeDomain(points.map((p) => p.value)),
    [points, spec.zeroLine],
  );

  // Round gridlines. The domain is padded data, so Recharts would otherwise
  // divide it into five equal parts and label them $70.2M and -$79.8M: numbers
  // nobody can hold in their head or compare between two sessions.
  const yTicks = useMemo(
    () => niceTicksWithin(domain[0], domain[1], isMobile || isCompact ? 3 : 5),
    [domain, isMobile, isCompact],
  );

  // The confirmed headline per bar, which is what colors the line. Using the
  // headline rather than the raw read is what stops a forming candidate from
  // recoloring anything before it confirms: pending lives on its own field.
  const stateByBar = useMemo(() => {
    const out = new Map<string, string>();
    for (const bar of series?.bars ?? []) out.set(bar.bar_start, bar.state);
    return out;
  }, [series]);

  const segments = useMemo(
    () => stateSegments(points.map((p) => stateByBar.get(p.bar_start) ?? null)),
    [points, stateByBar],
  );
  const stops = useMemo(() => segmentStops(segments, points.length), [segments, points.length]);
  const gradientId = `weather-field-${field}`;

  const valueByBar = useMemo(() => {
    const out = new Map<string, number>();
    for (const p of points) if (p.value != null) out.set(p.bar_start, p.value);
    return out;
  }, [points]);

  // The newest bar when the cursor is away, so this reads as the live story
  // rather than going blank the moment the mouse leaves.
  //
  // Falls back to the weather series' own last bar when the field has no
  // numbers to chart. A session with no gamma flip has no cushion points, and
  // that is precisely when "No gamma flip in the profile" is the line the
  // reader needs: losing the trail along with the chart would hide the
  // explanation for the empty chart.
  const scrubbing = hovered != null;
  const charted = useMemo(() => points.filter((p) => p.value != null), [points]);
  const lastCharted = charted.length ? charted[charted.length - 1].bar_start : null;
  const lastKnown = series?.bars.length ? series.bars[series.bars.length - 1].bar_start : null;
  const readAt = hovered ?? lastCharted ?? lastKnown;
  const comment = useMemo(
    () => commentAt(series?.bars ?? [], series?.changes ?? [], field, readAt),
    [series, field, readAt],
  );

  const height = isCompact ? COMPACT_HEIGHT : FULL_HEIGHT;
  const hasBars = charted.length > 0;

  return (
    <div>
      {isCompact ? (
        <p className="text-[11px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {spec.label}
        </p>
      ) : (
        <div>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {spec.caption}
          </p>
          <p className="mt-0.5 text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
            Line colored by Weather state. The dimmer line is the {smootherName.toLowerCase()}.
          </p>
        </div>
      )}

      {!hasBars ? (
        <p
          className="py-6 text-center text-xs italic"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {loading ? 'Loading this session…' : 'No bars for this field yet.'}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart
            data={rows}
            syncId={syncId}
            margin={
              isMobile
                ? { top: 6, right: 4, bottom: 4, left: 0 }
                : { top: 6, right: 12, bottom: 4, left: 4 }
            }
            // activeLabel, matching the two charts below the header, so every
            // chart on the page reads a hover the same way.
            onMouseMove={(state: { activeLabel?: string | number }) =>
              onHover(state?.activeLabel != null ? String(state.activeLabel) : null)
            }
            // A dragging finger fires no mouse events, so the trail line under
            // the chart would otherwise stay on the tapped bar.
            onTouchStart={() => {
              lastTouchAtRef.current = Date.now();
            }}
            onTouchMove={(state: { activeLabel?: string | number }) => {
              lastTouchAtRef.current = Date.now();
              onHover(state?.activeLabel != null ? String(state.activeLabel) : null);
            }}
            onMouseLeave={() => {
              if (Date.now() - lastTouchAtRef.current < 1000) return;
              onHover(null);
            }}
          >
            {/* Horizontals only. The verticals are drawn below at the same
                clock boundaries the axis labels, because CartesianGrid would
                otherwise put one on every bar: interval={0} offers the axis all
                eighty-one of them so the tick renderer can pick. */}
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border)"
              opacity={0.35}
              vertical={false}
            />
            <XAxis
              dataKey="timestamp"
              interval={0}
              tickLine={false}
              height={showTimeAxis ? undefined : 4}
              tick={
                showTimeAxis
                  ? sessionTimeTick('var(--color-text-secondary)', isMobile ? 120 : 30)
                  : false
              }
            />
            {buildThirtyMinGridlines(
              rows,
              'var(--color-border)',
              `weather-field-${field}`,
              undefined,
              isMobile ? 60 : 30,
            )}
            <YAxis
              domain={domain}
              {...(yTicks.length > 1 ? { ticks: yTicks } : {})}
              width={isMobile ? 46 : 64}
              tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
              // A phone's 46px gutter cannot hold "40 pts" and wraps it onto two
              // lines. The unit is already in the caption and the label above,
              // so the axis drops it rather than stacking it.
              tickFormatter={(v: number) => {
                if (!isMobile) return compact(v, spec.unit);
                return spec.unit === 'usd' ? compactUsdTick(v) : String(parseFloat(v.toFixed(1)));
              }}
            />
            {spec.zeroLine && <ReferenceLine y={0} stroke="var(--color-text-secondary)" />}
            <Tooltip content={() => null} cursor={{ stroke: 'var(--color-text-secondary)' }} />
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                {stops.map((stop, i) => (
                  <stop
                    key={`${stop.offset}-${i}`}
                    offset={`${(stop.offset * 100).toFixed(4)}%`}
                    stopColor={stop.color}
                  />
                ))}
              </linearGradient>
            </defs>
            <Line
              type="monotone"
              dataKey="value"
              name="This bar"
              stroke={stops.length ? `url(#${gradientId})` : 'var(--color-king)'}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            {/* The background clock, drawn behind the operating series: thinner
                and dimmer, because it is context rather than the read. Null
                until its window fills, and never bridged across a gap, so a
                hole in the data cannot be smoothed into a line. */}
            <Line
              type="monotone"
              dataKey="smoothed"
              name={smootherName}
              stroke="var(--color-info)"
              strokeWidth={1.5}
              strokeOpacity={0.75}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
            {/* Only real changes are marked. A dot on every bar would be the
                comment spam the spec rules out, and would hide the moments
                that matter among the ones that do not.

                Half the radius they were drawn at before the line carried the
                Weather state, ring halved with them: left at 1px it takes a
                third of the dot's width and the mark reads hollow instead of
                solid. The ring still earns its keep, because the dot is the new
                state's color and would otherwise dissolve into the segment it
                opens. */}
            {marks.map((c) => {
              const y = valueByBar.get(c.bar_start);
              if (y == null) return null;
              return (
                <ReferenceDot
                  key={`${c.field}-${c.kind}-${c.bar_start}`}
                  x={c.bar_start}
                  y={y}
                  r={1.75}
                  fill={weatherStateColor(stateByBar.get(c.bar_start))}
                  stroke="var(--color-bg)"
                  strokeWidth={0.5}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* The field's own line leads in both modes. At the live end that is
          all there is, because the banner above already says the rest.
          Scrubbing adds the Weather state as it stood, which is the one thing
          the banner cannot show, in the compact form rather than the full
          sentence: the sentence opens with "Hedging pressure is ..." and reads
          as Pressure's comment when it sits under the Lean chart. */}
      <div
        className="mt-1 border-t pt-1 text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
      >
        {!comment.state && (
          <p className="italic">{loading ? 'Loading the session trail…' : 'No trail yet.'}</p>
        )}

        {comment.state && (
          <>
            <p style={{ color: 'var(--color-text-primary)' }}>
              {comment.line ? (
                <>
                  <span style={{ color: comment.fresh ? 'var(--color-pin)' : undefined }}>
                    {comment.line}
                  </span>
                  {comment.lineAt && (
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      {` · ${safeTimeLabel(comment.lineAt)}`}
                    </span>
                  )}
                </>
              ) : (
                <span className="italic" style={{ color: 'var(--color-text-secondary)' }}>
                  Nothing has changed on this field yet.
                  {!scrubbing && !isCompact && ' Hover the chart for the read at a time.'}
                </span>
              )}
            </p>
            {scrubbing && showState && <p className="mt-0.5">Weather: {comment.state}</p>}
          </>
        )}
      </div>
    </div>
  );
}
