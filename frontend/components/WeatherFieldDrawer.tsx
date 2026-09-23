'use client';

import { useMemo, useState } from 'react';
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

import { robustDomain } from '@/core/regimeDomain';
import {
  changesForField,
  commentAt,
  fieldSeries,
  fieldSpec,
  type WeatherFieldKey,
} from '@/core/weatherFields';
import type { HedgingFlowPayload } from '@/hooks/useHedgingFlow';
import type { GammaRegimeSeriesPayload } from '@/hooks/useGammaRegimeSeries';
import type { GammaWeatherSeriesPayload } from '@/hooks/useGammaWeatherSeries';
import { safeTimeLabel } from '@/core/flowSeriesCharts';

const HEIGHT = 200;

function compact(value: number, unit: 'usd' | 'points'): string {
  if (unit === 'points') return `${value.toFixed(1)} pts`;
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

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
 * The numbers come from the two payloads the page already holds for the
 * charts below, so opening a drawer fetches only the comment trail. Reading
 * the same field from a second source is how a drawer ends up disagreeing
 * with the chart three inches beneath it.
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
  const marks = useMemo(
    () => changesForField(series?.changes ?? [], field).filter((c) => !c.opening),
    [series, field],
  );

  const rows = useMemo(
    () =>
      points.map((p) => ({
        bar_start: p.bar_start,
        label: safeTimeLabel(p.bar_start),
        value: p.value,
        smoothed: p.smoothed,
      })),
    [points],
  );

  // Named for what it is on this field. On Pressure the 3-bar average IS the
  // 15-minute clock, and calling it by the name the panel has always used
  // keeps it recognisable as the same line the chart below draws.
  const smootherName = field === 'pressure' ? '3-bar average' : '15-minute average';

  // Reuses the structure panel's rule so one spike cannot flatten the session.
  // The smoother is inside the raw series' range by construction, so it cannot
  // widen the domain and does not need to be fed in.
  const { domain } = useMemo(
    () => robustDomain(points.map((p) => ({ stability: p.value, lean: null }))),
    [points],
  );

  const barByLabel = useMemo(() => {
    const out = new Map<string, string>();
    for (const r of rows) out.set(r.label, r.bar_start);
    return out;
  }, [rows]);

  const valueByBar = useMemo(() => {
    const out = new Map<string, number>();
    for (const p of points) if (p.value != null) out.set(p.bar_start, p.value);
    return out;
  }, [points]);

  // The newest bar when the cursor is away, so the drawer reads as the live
  // story rather than going blank the moment the mouse leaves.
  //
  // Falls back to the weather series' own last bar when the field has no
  // numbers to chart. A session with no gamma flip has no cushion points, and
  // that is precisely when "No gamma flip in the profile" is the line the
  // reader needs: losing the trail along with the chart would hide the
  // explanation for the empty chart.
  const lastCharted = points.length ? points[points.length - 1].bar_start : null;
  const lastKnown = series?.bars.length ? series.bars[series.bars.length - 1].bar_start : null;
  const readAt = hovered ?? lastCharted ?? lastKnown;
  const comment = useMemo(
    () => commentAt(series?.bars ?? [], series?.changes ?? [], field, readAt),
    [series, field, readAt],
  );

  return (
    <div
      className="mt-3 rounded-xl border p-3"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-surface-subtle)',
      }}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold" style={{ color: 'var(--color-text-primary)' }}>
            {spec.label} this session
          </h4>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {spec.caption}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-3 text-[10px]">
            <span style={{ color: 'var(--color-king)' }}>— This bar</span>
            <span style={{ color: 'var(--color-info)' }}>— {smootherName}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded px-2 py-1 text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
          aria-label={`Close ${spec.label} chart`}
        >
          Close
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs italic" style={{ color: 'var(--color-text-secondary)' }}>
          {loading ? 'Loading this session…' : 'No bars for this field yet.'}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={HEIGHT}>
          <ComposedChart
            data={rows}
            margin={{ top: 6, right: 12, bottom: 4, left: 4 }}
            // activeLabel, matching the two charts below the header, so all
            // three read a hover the same way.
            onMouseMove={(state: { activeLabel?: string | number }) =>
              setHovered(
                state?.activeLabel != null ? barByLabel.get(String(state.activeLabel)) ?? null : null,
              )
            }
            onMouseLeave={() => setHovered(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.35} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
              minTickGap={40}
            />
            <YAxis
              domain={domain}
              width={64}
              tick={{ fontSize: 10, fill: 'var(--color-text-secondary)' }}
              tickFormatter={(v: number) => compact(v, spec.unit)}
            />
            {spec.zeroLine && <ReferenceLine y={0} stroke="var(--color-text-secondary)" />}
            <Tooltip content={() => null} cursor={{ stroke: 'var(--color-text-secondary)' }} />
            <Line
              type="monotone"
              dataKey="value"
              name="This bar"
              stroke="var(--color-king)"
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
                that matter among the ones that do not. */}
            {marks.map((c) => {
              const y = valueByBar.get(c.bar_start);
              if (y == null) return null;
              return (
                <ReferenceDot
                  key={`${c.field}-${c.kind}-${c.bar_start}`}
                  x={safeTimeLabel(c.bar_start)}
                  y={y}
                  r={3.5}
                  fill={c.field === 'state' ? 'var(--color-pin)' : 'var(--color-king)'}
                  stroke="var(--color-bg)"
                  strokeWidth={1}
                />
              );
            })}
          </ComposedChart>
        </ResponsiveContainer>
      )}

      <div
        className="mt-2 border-t pt-2 text-xs"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}
      >
        {comment.sentence ? (
          <>
            <p style={{ color: 'var(--color-text-primary)' }}>{comment.sentence}</p>
            {comment.line && (
              <p className="mt-1">
                <span style={{ color: comment.fresh ? 'var(--color-pin)' : undefined }}>
                  {comment.line}
                </span>
                {comment.lineAt && ` · ${safeTimeLabel(comment.lineAt)}`}
              </p>
            )}
          </>
        ) : (
          <p className="italic">{loading ? 'Loading the session trail…' : 'No trail yet.'}</p>
        )}
      </div>
    </div>
  );
}
