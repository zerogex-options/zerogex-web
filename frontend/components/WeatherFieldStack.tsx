'use client';

import { useCallback, useMemo, useState } from 'react';

import WeatherFieldChart from '@/components/WeatherFieldChart';
import WeatherStateLegend from '@/components/WeatherStateLegend';
import { getFiveMinuteSessionTimeline } from '@/core/flowSeriesCharts';
import {
  WEATHER_FIELDS,
  alignFieldToTimeline,
  commentAt,
  fieldSeries,
  sessionDateKey,
  type WeatherFieldKey,
} from '@/core/weatherFields';
import type { HedgingFlowPayload } from '@/hooks/useHedgingFlow';
import type { GammaRegimeSeriesPayload } from '@/hooks/useGammaRegimeSeries';
import type { GammaWeatherSeriesPayload } from '@/hooks/useGammaWeatherSeries';

/** Ties the five charts to one cursor. Any stable string does. */
const SYNC_ID = 'gamma-weather-stack';

export interface WeatherFieldStackProps {
  flow: HedgingFlowPayload | null;
  regime: GammaRegimeSeriesPayload | null;
  series: GammaWeatherSeriesPayload | null;
  loading?: boolean;
  /** Scrolled to when a header chip is clicked. */
  focus?: WeatherFieldKey | null;
}

/**
 * All five fields at once, in header order, under one clock.
 *
 * The accordion was right while the drawer was being proved: one chart at a
 * time keeps the question small. It is the wrong shape for the job it grew
 * into, which is scanning a session rather than interrogating a field. Five
 * lines sharing one color language and one cursor answer "what happened
 * today" in a glance; five clicks answer it in a minute.
 *
 * Every chart is the same WeatherFieldChart the one-at-a-time view renders, so
 * a field cannot look like one thing here and another there.
 *
 * ONE session grid for all five. Pressure comes off the flow series and the
 * other four off the structure series, and the two can differ in length and
 * start. Recharts syncs charts by row INDEX, so unaligned series would put the
 * crosshair on 11:45 in one chart and 11:20 in the next, which defeats the
 * only reason to stack them.
 */
export default function WeatherFieldStack({
  flow,
  regime,
  series,
  loading = false,
  focus = null,
}: WeatherFieldStackProps) {
  // Lifted here, so one cursor drives all five charts and all five strips.
  const [hovered, setHovered] = useState<string | null>(null);
  const onHover = useCallback((bar: string | null) => setHovered(bar), []);

  const timeline = useMemo(() => {
    const dateKey = sessionDateKey(flow, regime);
    return dateKey ? getFiveMinuteSessionTimeline(dateKey) : [];
  }, [flow, regime]);

  const pointsByField = useMemo(() => {
    const out = new Map<WeatherFieldKey, ReturnType<typeof fieldSeries>>();
    for (const spec of WEATHER_FIELDS) {
      out.set(spec.key, alignFieldToTimeline(fieldSeries(spec.key, flow, regime), timeline));
    }
    return out;
  }, [flow, regime, timeline]);

  // The Weather state is one reading for the whole panel, so it belongs beside
  // the legend rather than repeated under all five charts. Any field resolves
  // it: `field` only picks which line accompanies it, and that is dropped here.
  //
  // Only while scrubbing. At the live end this is the banner three inches
  // above, and worse than redundant: the banner classifies the latest bar the
  // two series have in COMMON while this series can be one bar ahead, so the
  // two would sometimes print different states on the same screen and the
  // reader would have no way to tell which was wrong.
  const stateAt = useMemo(() => {
    if (!hovered) return null;
    return commentAt(series?.bars ?? [], series?.changes ?? [], 'pressure', hovered).state;
  }, [series, hovered]);

  return (
    <div
      className="mt-3 rounded-xl border p-3"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface-subtle)',
      }}
    >
      {/* Once, above all five, rather than five times. */}
      <div
        className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b pb-2"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <WeatherStateLegend />
        {stateAt && (
          <p className="text-[11px]" style={{ color: 'var(--color-text-primary)' }}>
            At the cursor: {stateAt}
          </p>
        )}
      </div>

      {WEATHER_FIELDS.map((spec, i) => (
        <div
          key={spec.key}
          id={`weather-chart-${spec.key}`}
          className="scroll-mt-24"
          style={{
            // The clock is drawn once, under the bottom chart. Four charts'
            // worth of repeated axis labels is height spent saying the same
            // thing four times, and the stack shares one x-grid anyway.
            // Wider than the gap between a chart and its own strip, or a
            // reader cannot tell whether a strip belongs to the chart above it
            // or the one below.
            marginBottom: i === WEATHER_FIELDS.length - 1 ? 0 : 22,
            // A held chip dims the others rather than hiding them: the reader
            // asked to look at one line, not to lose the rest of the session.
            opacity: focus && focus !== spec.key ? 0.55 : 1,
            transition: 'opacity 150ms',
          }}
        >
          <WeatherFieldChart
            field={spec.key}
            points={pointsByField.get(spec.key) ?? []}
            series={series}
            loading={loading}
            hovered={hovered}
            onHover={onHover}
            compact
            showTimeAxis={i === WEATHER_FIELDS.length - 1}
            showState={false}
            syncId={SYNC_ID}
          />
        </div>
      ))}
    </div>
  );
}
