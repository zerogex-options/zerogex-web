'use client';

import { memo, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { humanize } from '@/core/signalHelpers';
import { TradeBiasHistoryRow } from './data';

// Signed-bias sibling of the Composite Score IntradayChart: same axis / tick /
// tooltip machinery, but on a -100..+100 domain with a 0 baseline (bullish
// above, bearish below) and a marker at every tick where an override fired.

interface Props {
  history: TradeBiasHistoryRow[];
  currentBias: number | null;
}

type Window = '1H' | 'TODAY' | '5D';

function etDateKey(ms: number): string {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function filterByWindow(rows: TradeBiasHistoryRow[], win: Window): TradeBiasHistoryRow[] {
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
    // No data for today (weekend / holiday / pre-engine) — freeze on the most
    // recent ET date so the chart shows the last session, not an empty panel.
    const lastKey = etDateKey(Date.parse(rows[rows.length - 1].timestamp));
    return rows.filter((r) => etDateKey(Date.parse(r.timestamp)) === lastKey);
  }
  if (win === '5D') {
    const keep = new Set<string>();
    for (let i = rows.length - 1; i >= 0 && keep.size < 5; i--) {
      keep.add(etDateKey(Date.parse(rows[i].timestamp)));
    }
    return rows.filter((r) => keep.has(etDateKey(Date.parse(r.timestamp))));
  }
  return rows;
}

function formatTooltipTime(ms: number): string {
  return (
    new Date(ms).toLocaleTimeString('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }) + ' ET'
  );
}

function formatAxisTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatAxisDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  });
}

const TICK_STEPS_MS = [
  60_000,
  2 * 60_000,
  5 * 60_000,
  10 * 60_000,
  15 * 60_000,
  30 * 60_000,
  60 * 60_000,
  2 * 60 * 60_000,
];
const MAX_TICK_INTERVALS = 8;

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

function biasColor(v: number | null): string {
  if (v == null) return 'var(--color-warning)';
  if (v > 5) return 'var(--color-bull)';
  if (v < -5) return 'var(--color-bear)';
  return 'var(--color-warning)';
}

function directionLabel(v: number): string {
  if (v > 5) return 'Long';
  if (v < -5) return 'Short';
  return 'Neutral';
}

interface ChartPoint {
  ts: number;
  bias: number;
  row: TradeBiasHistoryRow;
}

function IntradayBiasChartImpl({ history, currentBias }: Props) {
  const [win, setWin] = useState<Window>('TODAY');

  const data: ChartPoint[] = useMemo(() => {
    const filtered = filterByWindow(history, win);
    return filtered.map((row) => ({ ts: Date.parse(row.timestamp), bias: row.biasScore, row }));
  }, [history, win]);

  const xTicks = useMemo(() => {
    if (data.length === 0) return [];
    return buildTimeTicks(data[0].ts, data[data.length - 1].ts);
  }, [data]);

  const dateMarkerTicks = useMemo(() => {
    const set = new Set<number>();
    let prev: string | null = null;
    for (const t of xTicks) {
      const key = etDateKey(t);
      if (key !== prev) {
        set.add(t);
        prev = key;
      }
    }
    return set;
  }, [xTicks]);

  const overridePoints = useMemo(() => data.filter((d) => d.row.overrideActive), [data]);

  const renderXTick = (props: {
    x?: number | string;
    y?: number | string;
    payload?: { value?: number | string };
  }) => {
    const x = Number(props?.x ?? 0);
    const y = Number(props?.y ?? 0);
    const value = Number(props?.payload?.value ?? NaN);
    if (!Number.isFinite(value)) return <g transform={`translate(${x},${y})`} />;
    const time = formatAxisTime(value);
    const date = dateMarkerTicks.has(value) ? formatAxisDate(value) : null;
    return (
      <g transform={`translate(${x},${y})`}>
        <text dy={12} textAnchor="middle" fill="var(--color-text-secondary)" fontSize={11}>
          {time}
        </text>
        {date ? (
          <text dy={26} textAnchor="middle" fill="var(--color-text-secondary)" fontSize={10} opacity={0.75}>
            {date}
          </text>
        ) : null}
      </g>
    );
  };

  const lineColor = biasColor(currentBias);

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
            No bias history for today yet — markets open at 09:30 ET.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <WindowSelector value={win} onChange={setWin} />
        {overridePoints.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: 'var(--color-info)', border: '1px solid var(--color-surface)' }}
            />
            Override ({overridePoints.length})
          </div>
        )}
      </div>
      <div
        className="rounded-xl border p-3"
        style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)', height: 320 }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 16, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              ticks={xTicks}
              interval={0}
              tick={renderXTick}
              height={38}
              stroke="var(--color-border)"
            />
            <YAxis
              domain={[-100, 100]}
              ticks={[-100, -50, 0, 50, 100]}
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
              stroke="var(--color-border)"
              width={40}
            />
            {/* Bullish zone above the 0-line, bearish below. */}
            <ReferenceArea y1={0} y2={100} fill="var(--color-bull)" fillOpacity={0.1} />
            <ReferenceArea y1={-100} y2={0} fill="var(--color-bear)" fillOpacity={0.1} />
            <ReferenceLine y={50} stroke="var(--color-text-secondary)" strokeOpacity={0.4} strokeDasharray="3 3" />
            <ReferenceLine y={-50} stroke="var(--color-text-secondary)" strokeOpacity={0.4} strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke="var(--color-text-secondary)" strokeOpacity={0.7} />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="bias"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              activeDot={{ r: 4, stroke: lineColor, fill: 'var(--color-surface)' }}
            />
            {overridePoints.map((d) => (
              <ReferenceDot
                key={d.ts}
                x={d.ts}
                y={d.bias}
                r={3.5}
                fill="var(--color-info)"
                stroke="var(--color-surface)"
                strokeWidth={1}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

const IntradayBiasChart = memo(IntradayBiasChartImpl);
export default IntradayBiasChart;

function WindowSelector({ value, onChange }: { value: Window; onChange: (w: Window) => void }) {
  const opts: Window[] = ['1H', 'TODAY', '5D'];
  const label: Record<Window, string> = { '1H': '1H', TODAY: 'Today', '5D': '5D' };
  return (
    <div className="flex items-center gap-2 text-xs">
      {opts.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-md border px-2 py-1 ${value === o ? 'font-semibold' : 'text-[var(--color-text-secondary)]'}`}
          style={{
            borderColor: 'var(--color-border)',
            background: value === o ? 'var(--color-surface-elevated)' : 'transparent',
          }}
        >
          {label[o]}
        </button>
      ))}
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
  const color = biasColor(point.bias);
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
      <div className="mt-1 flex items-center gap-1.5 font-semibold" style={{ color }}>
        <span>
          {point.bias >= 0 ? '+' : ''}
          {point.bias.toFixed(1)}
        </span>
        <span className="font-normal opacity-80">· {directionLabel(point.bias)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-3 text-[var(--color-text-secondary)]">
        <span>{humanize(point.row.marketState)}</span>
        <span className="capitalize">{point.row.state}</span>
      </div>
      {point.row.overrideActive && (
        <div className="mt-1 font-semibold" style={{ color: 'var(--color-info)' }}>
          ● Override active
        </div>
      )}
    </div>
  );
}
