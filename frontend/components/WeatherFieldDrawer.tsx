'use client';

import { useMemo, useState } from 'react';

import WeatherFieldChart from '@/components/WeatherFieldChart';
import WeatherStateLegend from '@/components/WeatherStateLegend';
import { fieldSeries, fieldSpec, type WeatherFieldKey } from '@/core/weatherFields';
import type { HedgingFlowPayload } from '@/hooks/useHedgingFlow';
import type { GammaRegimeSeriesPayload } from '@/hooks/useGammaRegimeSeries';
import type { GammaWeatherSeriesPayload } from '@/hooks/useGammaWeatherSeries';

export interface WeatherFieldDrawerProps {
  field: WeatherFieldKey;
  flow: HedgingFlowPayload | null;
  regime: GammaRegimeSeriesPayload | null;
  series: GammaWeatherSeriesPayload | null;
  loading?: boolean;
  onClose: () => void;
}

/**
 * One field's session story, opened under the Gamma Weather header.
 *
 * The header is the live read and stays the live read. This is the audit
 * trail: it never changes a Weather state, and nothing here is classified
 * that was not already classified on the server when the bar printed.
 *
 * The chart itself lives in WeatherFieldChart, shared with the stacked view,
 * so the two ways into the same field cannot disagree about what it looks
 * like. What is left here is the frame: a title, a way out, and the legend.
 */
export default function WeatherFieldDrawer({
  field,
  flow,
  regime,
  series,
  loading = false,
  onClose,
}: WeatherFieldDrawerProps) {
  const spec = fieldSpec(field);
  const [hovered, setHovered] = useState<string | null>(null);
  const points = useMemo(() => fieldSeries(field, flow, regime), [field, flow, regime]);

  return (
    <div
      className="mt-3 rounded-xl border p-3"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface-subtle)',
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
          {spec.label} this session
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-xs max-sm:min-h-8"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label={`Close ${spec.label} chart`}
        >
          Close
        </button>
      </div>

      <WeatherFieldChart
        field={field}
        points={points}
        series={series}
        loading={loading}
        hovered={hovered}
        onHover={setHovered}
      />

      <WeatherStateLegend className="mt-2 border-t pt-2" />
    </div>
  );
}
