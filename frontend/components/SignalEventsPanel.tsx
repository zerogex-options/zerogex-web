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
import {
  alignedTimeTicksMs,
  etPartsFromMs,
  formatEtTime,
  getNumber,
} from '@/core/signalHelpers';
import ChartTimeAxisTick from './ChartTimeAxisTick';
import MobileScrollableChart from './MobileScrollableChart';

interface SignalEventsPanelProps {
  signalName: SignalEventName;
  symbol: string;
  title?: string;
}

const HORIZONS: SignalEventHorizon[] = ['30m', '60m', '120m'];

// Zoom toggle options. `minutes === null` ("All") keeps every row after the
// session-window crop, otherwise the chart is clipped to the last N minutes
// of data (ending at the most recent event).
const ZOOM_OPTIONS: ReadonlyArray<{ label: string; minutes: number | null }> = [
  { label: '30m', minutes: 30 },
  { label: '1h', minutes: 60 },
  { label: '2h', minutes: 120 },
  { label: '4h', minutes: 240 },
  { label: '1d', minutes: 1440 },
  { label: 'All', minutes: null },
];

type ZoomMinutes = number | null;

// Signals that only produce a meaningful score during a specific ET wall-clock
// window. Outside the window the backend forces score to 0, so we crop the
// chart to the most recent session's window and (when zoom = All) pin the
// x-axis to the full window even if data hasn't reached the edges yet.
//
// Keep ET minutes-of-day inclusive on both ends (e.g. 14:30 → 16:00 covers
// 14:30:00–16:00:00 ET).
const SIGNAL_SESSION_WINDOWS_ET: Partial<Record<SignalEventName, { startMin: number; endMin: number; label: string }>> = {
  eod_pressure: { startMin: 14 * 60 + 30, endMin: 16 * 60, label: '14:30–16:00 ET' },
  zero_dte_position_imbalance: { startMin: 9 * 60 + 30, endMin: 16 * 60, label: '09:30–16:00 ET' },
};

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

// Smallest 1/2/2.5/5/10 × 10^n value that is >= `value`. Used to round a
// data-driven minimum step up to a "nice" tick increment.
function niceStepCeil(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / magnitude;
  let nice: number;
  if (norm <= 1) nice = 1;
  else if (norm <= 2) nice = 2;
  else if (norm <= 2.5) nice = 2.5;
  else if (norm <= 5) nice = 5;
  else nice = 10;
  return nice * magnitude;
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

function roundTick(value: number, step: number): number {
  const decimals = step < 1 ? Math.min(10, Math.max(0, -Math.floor(Math.log10(step)) + 2)) : 6;
  return Number(value.toFixed(decimals));
}

// "Primary" nice scale for the score axis: data-driven, always includes zero,
// and guarantees at least one tick above AND below zero so a secondary axis
// can share the same 0 crossing position.
function niceScalePrimary(rawMin: number, rawMax: number, targetTicks = 5): {
  domain: [number, number];
  ticks: number[];
  step: number;
  ticksBelow: number;
  ticksAbove: number;
} {
  let lo = Number.isFinite(rawMin) ? Math.min(rawMin, 0) : 0;
  let hi = Number.isFinite(rawMax) ? Math.max(rawMax, 0) : 0;
  if (lo === hi) {
    const eps = Math.abs(lo) > 0 ? Math.abs(lo) * 0.1 : 1;
    lo -= eps;
    hi += eps;
  }
  const step = niceStep(hi - lo, targetTicks);
  let niceLo = Math.floor(lo / step) * step;
  let niceHi = Math.ceil(hi / step) * step;
  // Always reserve at least one tick on each side of zero so the right axis
  // can align its zero crossing to the same fraction of chart height.
  if (niceLo >= 0) niceLo = -step;
  if (niceHi <= 0) niceHi = step;
  const ticksBelow = Math.round(-niceLo / step);
  const ticksAbove = Math.round(niceHi / step);
  const ticks: number[] = [];
  for (let i = -ticksBelow; i <= ticksAbove; i++) {
    ticks.push(roundTick(i * step, step));
  }
  return { domain: [niceLo, niceHi], ticks, step, ticksBelow, ticksAbove };
}

// "Aligned" scale for the right axis: reuses the primary axis's tick counts
// above/below zero so the 0 line lands on the same pixel row. The right
// axis's own step is chosen as the smallest nice value that lets those
// counts bracket the data, which keeps labels on round percentage values
// (e.g. 0.25%/0.50%/1.00%) while scaling to fit the secondary data.
function niceScaleAligned(
  rawMin: number,
  rawMax: number,
  ticksBelow: number,
  ticksAbove: number,
  fallbackStep: number,
): { domain: [number, number]; ticks: number[] } {
  const maxNeg = Math.max(0, -Math.min(rawMin, 0));
  const maxPos = Math.max(0, Math.max(rawMax, 0));
  const minStepNeg = ticksBelow > 0 ? maxNeg / ticksBelow : 0;
  const minStepPos = ticksAbove > 0 ? maxPos / ticksAbove : 0;
  const minStep = Math.max(minStepNeg, minStepPos);
  const step = minStep > 0 ? niceStepCeil(minStep) : fallbackStep;
  const niceLo = -ticksBelow * step;
  const niceHi = ticksAbove * step;
  const ticks: number[] = [];
  for (let i = -ticksBelow; i <= ticksAbove; i++) {
    ticks.push(roundTick(i * step, step));
  }
  return { domain: [niceLo, niceHi], ticks };
}

export default function SignalEventsPanel({ signalName, symbol, title = 'Event Timeline' }: SignalEventsPanelProps) {
  const [horizon, setHorizon] = useState<SignalEventHorizon>('60m');
  const [zoom, setZoom] = useState<ZoomMinutes>(null);
  const sessionWindow = SIGNAL_SESSION_WINDOWS_ET[signalName] ?? null;
  const { data, loading, error } = useSignalEvents(signalName, symbol, {
    horizon,
    limit: 150,
    refreshInterval: PROPRIETARY_SIGNALS_REFRESH.signalEventsMs,
  });

  // All rows returned by the API, normalized and sorted oldest-first.
  const allRows = useMemo(() => {
    const raw = data?.rows ?? [];
    return [...raw]
      .map((row) => {
        const score = getNumber(row.score) ?? 0;
        const flip = row.direction_flip === true;
        const direction = String(row.direction ?? 'neutral').toLowerCase();
        const timeStr = String(row.timestamp ?? '');
        const timeMs = new Date(timeStr).getTime();
        return {
          time: timeStr,
          timeMs,
          score,
          flipScore: flip ? score : null,
          flipBullish: flip && direction === 'bullish' ? score : null,
          flipBearish: flip && direction === 'bearish' ? score : null,
          realized: getNumber(row.realized_return),
        };
      })
      .filter((row) => row.time && Number.isFinite(row.timeMs))
      .sort((a, b) => a.timeMs - b.timeMs);
  }, [data]);

  // Step 1: drop rows that fall outside the signal's ET session window,
  // then keep only the most recent ET date that has any in-window event.
  // For continuous signals this is a no-op.
  const sessionRows = useMemo(() => {
    if (!sessionWindow) return allRows;
    const inWindow = allRows.filter((r) => {
      const { minuteOfDay } = etPartsFromMs(r.timeMs);
      return minuteOfDay >= sessionWindow.startMin && minuteOfDay <= sessionWindow.endMin;
    });
    if (inWindow.length === 0) return inWindow;
    const latestDay = etPartsFromMs(inWindow[inWindow.length - 1].timeMs).day;
    return inWindow.filter((r) => etPartsFromMs(r.timeMs).day === latestDay);
  }, [allRows, sessionWindow]);

  // Step 2: apply the zoom toggle by clipping to the last N minutes of data.
  const visibleRows = useMemo(() => {
    if (zoom === null || sessionRows.length === 0) return sessionRows;
    const latestMs = sessionRows[sessionRows.length - 1].timeMs;
    const cutoff = latestMs - zoom * 60_000;
    return sessionRows.filter((r) => r.timeMs >= cutoff);
  }, [sessionRows, zoom]);

  // X-axis runs on a numeric (epoch-ms) scale so ticks can be synthesized at
  // exact ET wall-clock boundaries (e.g. :15/:30/:45/:00) regardless of when
  // event data actually lands. For window-gated signals on zoom = All, pin
  // the domain to the full session window so empty edges still show even
  // before the first/last in-window event has been logged today.
  const xDomain = useMemo<[number, number] | null>(() => {
    if (visibleRows.length === 0) return null;
    const firstMs = visibleRows[0].timeMs;
    const lastMs = visibleRows[visibleRows.length - 1].timeMs;
    if (sessionWindow && zoom === null) {
      const ref = etPartsFromMs(lastMs);
      const anchor = lastMs - ref.secondOfMinute * 1000;
      const startMs = anchor + (sessionWindow.startMin - ref.minuteOfDay) * 60_000;
      const endMs = anchor + (sessionWindow.endMin - ref.minuteOfDay) * 60_000;
      return [startMs, endMs];
    }
    if (firstMs === lastMs) return [firstMs - 60_000, lastMs + 60_000];
    return [firstMs, lastMs];
  }, [visibleRows, sessionWindow, zoom]);

  const timeTicks = useMemo(() => {
    if (!xDomain) return [];
    const [startMs, endMs] = xDomain;
    const spanMin = Math.max(1, Math.round((endMs - startMs) / 60_000));
    const step = pickTimeStepMinutes(spanMin, 6);
    let ticks = alignedTimeTicksMs(startMs, endMs, step);
    // Very short spans may not contain a boundary at the chosen step — drop
    // to the next smaller candidate until we have at least two ticks.
    let idx = TIME_STEP_CANDIDATES.indexOf(step) - 1;
    while (ticks.length < 2 && idx >= 0) {
      ticks = alignedTimeTicksMs(startMs, endMs, TIME_STEP_CANDIDATES[idx]);
      idx -= 1;
    }
    return ticks;
  }, [xDomain]);

  // First tick of each ET calendar day, keyed by the stringified ms value
  // so ChartTimeAxisTick's `dateTicks.has(String(payload.value))` lookup
  // resolves correctly under the numeric x-axis.
  const dateTicks = useMemo(() => {
    const set = new Set<string>();
    let lastDay = '';
    for (const ms of timeTicks) {
      const { day } = etPartsFromMs(ms);
      if (day && day !== lastDay) {
        set.add(String(ms));
        lastDay = day;
      }
    }
    return set;
  }, [timeTicks]);

  // Score (left) scale drives the layout: its tick counts above/below zero
  // are reused by the right axis so the 0 line lands at the same chart row
  // on both — eliminating the "right-axis zero drifts when toggling horizon"
  // problem.
  const scoreScale = useMemo(() => {
    let lo = 0;
    let hi = 0;
    for (const r of visibleRows) {
      if (Number.isFinite(r.score)) {
        if (r.score < lo) lo = r.score;
        if (r.score > hi) hi = r.score;
      }
    }
    return niceScalePrimary(lo, hi, 5);
  }, [visibleRows]);

  const realizedScale = useMemo(() => {
    let lo = 0;
    let hi = 0;
    let any = false;
    for (const r of visibleRows) {
      if (typeof r.realized === 'number' && Number.isFinite(r.realized)) {
        any = true;
        if (r.realized < lo) lo = r.realized;
        if (r.realized > hi) hi = r.realized;
      }
    }
    return niceScaleAligned(
      any ? lo : -0.005,
      any ? hi : 0.005,
      scoreScale.ticksBelow,
      scoreScale.ticksAbove,
      0.005,
    );
  }, [visibleRows, scoreScale]);

  const barSize = useMemo(() => {
    if (visibleRows.length === 0) return 4;
    return Math.max(2, Math.min(8, Math.floor(800 / visibleRows.length)));
  }, [visibleRows]);

  const summary = data?.summary ?? {};

  return (
    <section className="zg-feature-shell p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Score path (left axis) with each event&apos;s underlying price move from its timestamp to {horizon} later (right axis). Triangles mark direction flips.
            {sessionWindow && (
              <> Cropped to the {sessionWindow.label} session window.</>
            )}
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
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Range</span>
            <div className="inline-flex rounded-lg border border-[var(--color-border)] overflow-hidden">
              {ZOOM_OPTIONS.map((opt) => {
                const active = zoom === opt.minutes;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setZoom(opt.minutes)}
                    className="px-2.5 py-1 text-[11px] font-semibold"
                    style={{
                      background: active ? 'var(--color-warning)' : 'var(--color-surface)',
                      color: active ? 'var(--color-surface)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-secondary)]">Horizon</span>
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
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4" style={{ height: 320 }}>
        {visibleRows.length > 0 ? (
          <MobileScrollableChart>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={visibleRows} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                type="number"
                dataKey="timeMs"
                domain={xDomain ?? ['dataMin', 'dataMax']}
                ticks={timeTicks}
                interval={0}
                height={44}
                tick={<ChartTimeAxisTick dateTicks={dateTicks} />}
                stroke="var(--color-border)"
                allowDuplicatedCategory={false}
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
              <Bar yAxisId="ret" dataKey="realized" name="Realized" fill="var(--color-border)" opacity={0.6} barSize={barSize} />
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
        ) : sessionRows.length > 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">No events in the selected range.</div>
        ) : sessionWindow ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--color-text-secondary)]">No events in the {sessionWindow.label} window yet.</div>
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
