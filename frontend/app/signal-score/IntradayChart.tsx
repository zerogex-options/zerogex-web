'use client';

import { memo, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CompositeHistoryRow, getComponentLabel } from './data';
import { REGIME_BANDS, classifyRegime } from './regime';

interface Props {
  history: CompositeHistoryRow[];
  currentScore: number | null;
}

type Window = '1H' | 'TODAY' | '5D';

function etDateKey(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function filterByWindow(rows: CompositeHistoryRow[], win: Window): CompositeHistoryRow[] {
  if (rows.length === 0) return rows;
  const now = Date.now();
  if (win === '1H') {
    const cutoff = now - 60 * 60 * 1000;
    return rows.filter((r) => Date.parse(r.timestamp) >= cutoff);
  }
  if (win === 'TODAY') {
    const todayKey = etDateKey(now);
    const todayRows = rows.filter((r) => etDateKey(Date.parse(r.timestamp)) === todayKey);
    if (todayRows.length > 0) return todayRows;
    // No data for today (weekend / holiday / pre-engine). Freeze on the
    // most recent ET date in history so the chart shows the last
    // session instead of rendering empty.
    const lastKey = etDateKey(Date.parse(rows[rows.length - 1].timestamp));
    return rows.filter((r) => etDateKey(Date.parse(r.timestamp)) === lastKey);
  }
  if (win === '5D') {
    // Last 5 distinct ET dates that have data, regardless of calendar
    // gaps. Walking newest→oldest keeps weekend / holiday days out of
    // the count naturally.
    const keep = new Set<string>();
    for (let i = rows.length - 1; i >= 0 && keep.size < 5; i--) {
      keep.add(etDateKey(Date.parse(rows[i].timestamp)));
    }
    return rows.filter((r) => keep.has(etDateKey(Date.parse(r.timestamp))));
  }
  return rows;
}

function formatTooltipTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + ' ET';
}

function formatAxisTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

// Clock-friendly step sizes (ms), smallest first. Ticks snap to these
// boundaries so labels land on round times (10:00, 10:30, …).
const TICK_STEPS_MS = [
  60_000, // 1 min
  2 * 60_000,
  5 * 60_000,
  10 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000, // 1 hour
  2 * 60 * 60_000,
];
const MAX_TICK_INTERVALS = 8;

// Wall-clock ms elapsed since ET midnight, used to snap ticks to clock
// boundaries. The market session never spans a DST change, so within a
// single window real-ms and ET-wall-ms advance in lockstep.
function etMillisOfDay(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  return ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000 + (((ms % 1000) + 1000) % 1000);
}

// Even, clock-aligned tick positions across [min, max]. Picks the largest
// step that still yields a readable number of ticks, then snaps the first
// tick up to the next clock boundary at/after min.
function buildTimeTicks(min: number, max: number): number[] {
  const span = max - min;
  if (!(span > 0)) return [min];
  const step =
    TICK_STEPS_MS.find((s) => span / s <= MAX_TICK_INTERVALS) ?? TICK_STEPS_MS[TICK_STEPS_MS.length - 1];
  const into = etMillisOfDay(min) % step;
  const first = into === 0 ? min : min + (step - into);
  const ticks: number[] = [];
  for (let t = first; t <= max; t += step) ticks.push(t);
  return ticks;
}

interface ChartPoint {
  ts: number;
  composite: number;
  row: CompositeHistoryRow;
}

function IntradayChartImpl({ history, currentScore }: Props) {
  const [win, setWin] = useState<Window>('TODAY');

  const data: ChartPoint[] = useMemo(() => {
    const filtered = filterByWindow(history, win);
    return filtered.map((row) => ({ ts: Date.parse(row.timestamp), composite: row.composite, row }));
  }, [history, win]);

  const xTicks = useMemo(() => {
    if (data.length === 0) return [];
    return buildTimeTicks(data[0].ts, data[data.length - 1].ts);
  }, [data]);

  const lineColor = classifyRegime(currentScore).color;

  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <WindowSelector value={win} onChange={setWin} />
        <div
          className="rounded-xl border p-8 text-center text-sm"
          style={{
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface-subtle)',
            color: 'var(--color-text-secondary)',
            height: 320,
          }}
        >
          <div className="flex h-full items-center justify-center">
            No data for today yet — markets open at 09:30 ET.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <WindowSelector value={win} onChange={setWin} />
      <div
        className="rounded-xl border p-3"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)', height: 320 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={xTicks}
              interval={0}
              tickFormatter={formatAxisTime}
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
              stroke="var(--color-border)"
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
              stroke="var(--color-border)"
              width={36}
            />
            {REGIME_BANDS.map((b) => (
              <ReferenceArea key={b.regime.key} y1={b.from} y2={b.to} fill={b.regime.color} fillOpacity={0.15} />
            ))}
            <ReferenceLine y={20} stroke="var(--color-text-secondary)" strokeOpacity={0.4} strokeDasharray="3 3" />
            <ReferenceLine y={40} stroke="var(--color-text-secondary)" strokeOpacity={0.4} strokeDasharray="3 3" />
            <ReferenceLine y={50} stroke="var(--color-text-secondary)" strokeOpacity={0.6} />
            <ReferenceLine y={70} stroke="var(--color-text-secondary)" strokeOpacity={0.4} strokeDasharray="3 3" />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="composite"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, stroke: lineColor, fill: 'var(--color-surface)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const IntradayChart = memo(IntradayChartImpl);
export default IntradayChart;

function WindowSelector({ value, onChange }: { value: Window; onChange: (w: Window) => void }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <button
        type="button"
        onClick={() => onChange('1H')}
        className={`rounded-md border px-2 py-1 ${value === '1H' ? 'font-semibold' : 'text-[var(--color-text-secondary)]'}`}
        style={{ borderColor: 'var(--color-border)', background: value === '1H' ? 'var(--color-surface-elevated)' : 'transparent' }}
      >
        1H
      </button>
      <button
        type="button"
        onClick={() => onChange('TODAY')}
        className={`rounded-md border px-2 py-1 ${value === 'TODAY' ? 'font-semibold' : 'text-[var(--color-text-secondary)]'}`}
        style={{ borderColor: 'var(--color-border)', background: value === 'TODAY' ? 'var(--color-surface-elevated)' : 'transparent' }}
      >
        Today
      </button>
      <button
        type="button"
        onClick={() => onChange('5D')}
        className={`rounded-md border px-2 py-1 ${value === '5D' ? 'font-semibold' : 'text-[var(--color-text-secondary)]'}`}
        style={{ borderColor: 'var(--color-border)', background: value === '5D' ? 'var(--color-surface-elevated)' : 'transparent' }}
      >
        5D
      </button>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const regime = classifyRegime(point.composite);
  const top3 = [...point.row.components]
    .filter((c) => c.contribution != null)
    .sort((a, b) => Math.abs((b.contribution ?? 0)) - Math.abs((a.contribution ?? 0)))
    .slice(0, 3);
  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-lg"
      style={{
        background: 'var(--color-chart-tooltip-bg)',
        borderColor: 'var(--color-border)',
        color: 'var(--color-chart-tooltip-text)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div className="font-mono">{formatTooltipTime(point.ts)}</div>
      <div className="mt-1 flex items-center gap-1.5 font-semibold" style={{ color: regime.color }}>
        <span aria-hidden>{regime.glyph}</span>
        <span>{point.composite.toFixed(2)}</span>
        <span className="font-normal opacity-80">· {regime.label}</span>
      </div>
      {top3.length > 0 && (
        <div className="mt-1.5 space-y-0.5">
          {top3.map((c) => {
            const label = getComponentLabel(c.key);
            const val = c.contribution ?? 0;
            return (
              <div key={c.key} className="flex items-center justify-between gap-3">
                <span className="text-[var(--color-text-secondary)]">{label.title}</span>
                <span style={{ color: val >= 0 ? '#16A34A' : '#DC2626' }}>
                  {val >= 0 ? '+' : ''}{val.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
