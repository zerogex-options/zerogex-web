'use client';

/**
 * Phone-width time-axis helpers for the signal charts.
 *
 * The desktop tick (ChartTimeAxisTick) prints "10:30 AM" over a date and
 * relies on ~6 hand-built ticks having ~150px each. A phone plot is ~230px
 * wide, so the same six labels overprint into an unreadable smear. On a
 * phone the charts keep the same clock-aligned tick candidates but thin them
 * to a handful (`thinTicks`) and print them shorter (this tick): 24-hour ET
 * time ("13:30", as the MSI and Trade Bias charts already do), with the date
 * under the first tick of each day — or the date alone when the ticks are a
 * day apart, where "12:00 AM" carries no information.
 */

import { etPartsFromMs, formatEtDate } from '@/core/signalHelpers';

const TIME_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function formatEtClock24(ms: number): string {
  if (!Number.isFinite(ms)) return '';
  return TIME_FMT.format(new Date(ms));
}

/**
 * Keep at most `max` of `ticks`, evenly strided, always including the first.
 * The ticks are already on round clock boundaries, so every k-th of them is
 * still on one.
 */
export function thinTicks(ticks: number[], max: number): number[] {
  if (ticks.length <= max || max < 1) return ticks;
  const stride = Math.ceil(ticks.length / max);
  return ticks.filter((_, i) => i % stride === 0);
}

/** First tick of each ET calendar day, keyed as strings (Recharts payload values). */
export function firstTickOfEachDay(ticks: number[]): Set<string> {
  const set = new Set<string>();
  let lastDay = '';
  for (const ms of ticks) {
    const { day } = etPartsFromMs(ms);
    if (day && day !== lastDay) {
      set.add(String(ms));
      lastDay = day;
    }
  }
  return set;
}

interface CompactTimeAxisTickProps {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
  dateTicks: Set<string>;
  /** Ticks are whole days apart: print the date only. */
  daily?: boolean;
}

export default function CompactTimeAxisTick({ x = 0, y = 0, payload, dateTicks, daily = false }: CompactTimeAxisTickProps) {
  const raw = payload?.value;
  const ms = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(ms)) return <g transform={`translate(${x},${y})`} />;
  const date = daily || dateTicks.has(String(raw)) ? formatEtDate(ms) : '';
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fill="var(--color-text-secondary)" fontSize={10}>
        {daily ? date : formatEtClock24(ms)}
      </text>
      {!daily && date && (
        <text x={0} y={0} dy={24} textAnchor="middle" fill="var(--color-text-secondary)" fontSize={10} fontWeight={600}>
          {date}
        </text>
      )}
    </g>
  );
}
