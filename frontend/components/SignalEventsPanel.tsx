'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
  ComposedChart,
  Line,
  Bar,
  Scatter,
} from 'recharts';
import { useSignalEvents, type SignalEventName, type SignalEventHorizon } from '@/hooks/useApiData';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import { computeTimeTicks, firstTicksOfEtDay, formatEtTime, getNumber } from '@/core/signalHelpers';
import ChartTimeAxisTick from './ChartTimeAxisTick';
import MobileScrollableChart from './MobileScrollableChart';

interface SignalEventsPanelProps {
  signalName: SignalEventName;
  symbol: string;
  title?: string;
}

const HORIZONS: SignalEventHorizon[] = ['30m', '60m', '120m'];

// Allowed x-axis tick increments (minutes). Picked so labels land on familiar
// boundaries: 1/2/5/10/15/30 min, 1/2/3/4/6/12 hr, then day boundaries.
const TIME_STEP_CANDIDATES = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 720, 1440];

function pickTimeStepMinutes(spanMinutes: number, targetTicks = 6): number {
  const raw = spanMinutes / Math.max(1, targetTicks);
  for (const c of TIME_STEP_CANDIDATES) {
    if (c >= raw) return c;
  }
  return TIME_STEP_CANDIDATES[TIME_STEP_CANDIDATES.length - 1];
}

// Pick a 1/2/2.5/5/10 × 10^n step so tick labels are round (e.g. 25, 50,
// 0.005, 0.5%) regardless of the underlying data magnitude.
function niceStep(range: number, targetTicks: number): number {
  const raw = range / Math.max(1, targetTicks);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / magnitude;
  let nice: number;
  if (norm < 1.5) nice = 1;
  else if (norm < 3) nice = 2;
  else if (norm < 4) nice = 2.5;
  else if (norm < 7.5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

// Build a domain + tick list that always brackets the data on round step
// boundaries and always includes zero so the reference line stays visible.
function niceScale(rawMin: number, rawMax: number, targetTicks = 5): {
  domain: [number, number];
  ticks: number[];
} {
  let lo = Number.isFinite(rawMin) ? Math.min(rawMin, 0) : 0;
  let hi = Number.isFinite(rawMax) ? Math.max(rawMax, 0) : 0;
  if (lo === hi) {
    const eps = Math.abs(lo) > 0 ? Math.abs(lo) * 0.1 : 1;
    lo -= eps;
    hi += eps;
  }
  const step = niceStep(hi - lo, targetTicks);
  const niceLo = Math.floor(lo / step) * step;
  const niceHi = Math.ceil(hi / step) * step;
  const decimals = step < 1 ? Math.min(10, Math.max(0, -Math.floor(Math.log10(step)) + 2)) : 6;
  const count = Math.max(1, Math.round((niceHi - niceLo) / step));
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Number((niceLo + i * step).toFixed(decimals)));
  }
  return { domain: [niceLo, niceHi], ticks };
}

export default function SignalEventsPanel({ signalName, symbol, title = 'Event Timeline' }: SignalEventsPanelProps) {
  const [horizon, setHorizon] = useState<SignalEventHorizon>('60m');
  const { data, loading, error } = useSignalEvents(signalName, symbol, {
    horizon,
    limit: 150,
    refreshInterval: PROPRIETARY_SIGNALS_REFRESH.signalEventsMs,
  });

  const rows = useMemo(() => {
    const raw = data?.rows ?? [];
    return [...raw]
      .map((row) => {
        const score = getNumber(row.score) ?? 0;
        const flip = row.direction_flip === true;
        const direction = String(row.direction ?? 'neutral').toLowerCase();
        return {
          time: String(row.timestamp ?? ''),
          score,
          flipScore: flip ? score : null,
          flipBullish: flip && direction === 'bullish' ? score : null,
          flipBearish: flip && direction === 'bearish' ? score : null,
          realized: getNumber(row.realized_return),
        };
      })
      .filter((row) => row.time)
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [data]);

  // X-axis ticks are pinned to round time boundaries (5min, 15min, 1hr…)
  // chosen from the span of the visible data, with a date label rendered on
  // the first tick of each ET calendar day.
  const timeTicks = useMemo(() => {
    if (rows.length === 0) return [];
    const stamps = rows.map((r) => r.time);
    if (stamps.length < 2) return stamps;
    const startMs = new Date(stamps[0]).getTime();
    const endMs = new Date(stamps[stamps.length - 1]).getTime();
    const spanMin = Number.isFinite(startMs) && Number.isFinite(endMs)
      ? Math.max(1, Math.round((endMs - startMs) / 60000))
      : 60;
    const step = pickTimeStepMinutes(spanMin, 6);
    return computeTimeTicks(stamps, step);
  }, [rows]);

  const dateTicks = useMemo(() => firstTicksOfEtDay(timeTicks), [timeTicks]);

  // Each y-axis is scaled to its own data. Score and realized return live on
  // very different magnitudes, so we no longer mirror them around a shared
  // center — the 0 reference line is drawn against the score axis only.
  const scoreScale = useMemo(() => {
    let lo = 0;
    let hi = 0;
    for (const r of rows) {
      if (Number.isFinite(r.score)) {
        if (r.score < lo) lo = r.score;
        if (r.score > hi) hi = r.score;
      }
    }
    return niceScale(lo, hi, 5);
  }, [rows]);

  const realizedScale = useMemo(() => {
    let lo = 0;
    let hi = 0;
    let any = false;
    for (const r of rows) {
      if (typeof r.realized === 'number' && Number.isFinite(r.realized)) {
        any = true;
        if (r.realized < lo) lo = r.realized;
        if (r.realized > hi) hi = r.realized;
      }
    }
    if (!any) {
      return { domain: [-0.01, 0.01] as [number, number], ticks: [-0.01, -0.005, 0, 0.005, 0.01] };
    }
    return niceScale(lo, hi, 5);
  }, [rows]);

  const summary = data?.summary ?? {};

  return (
    <section className="zg-feature-shell p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Historical score path with forward realized return at the chosen horizon. Triangles mark direction flips.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {data?.summary && (
            <div className="flex items-center gap-3 text-[11px] text-[var(--color-text-secondary)]">
              <span>Flips: <span className="text-[var(--color-text-primary)] font-semibold">{summary.flips ?? 0}</span></span>
              <span className="text-[var(--color-bull)]">Bull {summary.bullish ?? 0}</span>
              <span className="text-[var(--color-bear)]">Bear {summary.bearish ?? 0}</span>
              <span>Flat {summary.neutral ?? 0}</span>
            </div>
          )}
          <div className="inline-flex rounded-lg border border-[var(--color-border)] overflow-hidden">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizon(h)}
                className="px-2.5 py-1 text-[11px] font-semibold"
                style={{
                  background: horizon === h ? 'var(--color-warning)' : 'var(--color-surface)',
                  color: horizon === h ? 'var(--color-surface)' : 'var(--color-text-secondary)',
                }}
              >
                {h}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4" style={{ height: 320 }}>
        {rows.length > 0 ? (
          <MobileScrollableChart>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="time"
                ticks={timeTicks}
                interval={0}
                height={44}
                tick={<ChartTimeAxisTick dateTicks={dateTicks} />}
                stroke="var(--color-border)"
              />
              <YAxis
                yAxisId="score"
                domain={scoreScale.domain}
                ticks={scoreScale.ticks}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                stroke="var(--color-border)"
                width={40}
              />
              <YAxis
                yAxisId="ret"
                orientation="right"
                domain={realizedScale.domain}
                ticks={realizedScale.ticks}
                tickFormatter={(v: number) => `${(v * 100).toFixed(2)}%`}
                tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
                stroke="var(--color-border)"
                width={60}
              />
              <Tooltip content={<EventsTooltip />} />
              <ReferenceLine yAxisId="score" y={0} stroke="var(--color-text-secondary)" strokeOpacity={0.4} />
              <Bar yAxisId="ret" dataKey="realized" name="Realized" fill="var(--color-border)" opacity={0.6} />
              <Line yAxisId="score" type="monotone" dataKey="score" name="Score" stroke="var(--color-warning)" strokeWidth={2} dot={false} />
              <Scatter yAxisId="score" dataKey="flipBullish" name="Flip ↑" fill="var(--color-bull)" shape="triangle" />
              <Scatter yAxisId="score" dataKey="flipBearish" name="Flip ↓" fill="var(--color-bear)" shape="triangle" />
            </ComposedChart>
          </ResponsiveContainer>
          </MobileScrollableChart>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-sm text-[var(--color-text-secondary)] gap-1">
            <div>Unable to load event history.</div>
            <div className="text-xs opacity-80">{error}</div>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">Loading event history…</div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">No event history yet.</div>
        )}
      </div>
    </section>
  );
}

interface EventsTooltipRow {
  label: string;
  value: string;
  valueColor?: string;
}

interface EventsTooltipPayloadItem {
  name?: string;
  value?: number | string | null;
}

function EventsTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: EventsTooltipPayloadItem[];
  label?: string | number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const rows: EventsTooltipRow[] = [];
  const seen = new Set<string>();
  for (const item of payload) {
    const name = item?.name;
    if (typeof name !== 'string' || !name) continue;
    if (seen.has(name)) continue;
    const raw = item?.value;
    if (raw == null) continue;
    if (name === 'Realized') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      rows.push({
        label: 'Realized',
        value: `${(raw * 100).toFixed(3)}%`,
        valueColor: raw >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
      });
      seen.add(name);
      continue;
    }
    if (name === 'Score') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      rows.push({
        label: 'Score',
        value: raw.toFixed(2),
        valueColor: 'var(--color-chart-tooltip-text)',
      });
      seen.add(name);
      continue;
    }
    if (name === 'Flip ↑' || name === 'Flip ↓') {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) continue;
      rows.push({
        label: name,
        value: raw.toFixed(2),
        valueColor: name === 'Flip ↑' ? 'var(--color-bull)' : 'var(--color-bear)',
      });
      seen.add(name);
      continue;
    }
  }

  if (rows.length === 0) return null;

  const headerLabel =
    typeof label === 'string' || typeof label === 'number'
      ? formatEtTime(label)
      : '';

  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-lg"
      style={{
        background: 'var(--color-chart-tooltip-bg)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-chart-tooltip-text)',
        fontVariantNumeric: 'tabular-nums',
        minWidth: 180,
      }}
    >
      {headerLabel && (
        <div className="font-mono mb-1.5" style={{ color: 'var(--color-chart-tooltip-text)' }}>
          {headerLabel}
        </div>
      )}
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <span style={{ color: 'var(--color-chart-tooltip-muted)' }}>{row.label}</span>
            <span
              className="font-semibold"
              style={{ color: row.valueColor ?? 'var(--color-chart-tooltip-text)' }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
