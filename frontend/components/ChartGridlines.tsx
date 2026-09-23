'use client';

import { ReferenceLine } from 'recharts';

import { is30MinBoundary } from '@/core/flowSeriesCharts';

const GRID_STROKE_DASHARRAY = '2 4';
const GRID_OPACITY = 0.28;

/** True when `ts` lands on a whole hour. ET sits a whole number of hours off
 *  UTC, so a UTC :00 is an ET :00 (DST-safe without a zone lookup). */
function isHourBoundary(ts: string): boolean {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return false;
  return d.getUTCMinutes() === 0;
}

const MAJOR_TICK_ET_HOURS = new Set([10, 12, 14, 16]);

/** True when `ts` lands exactly on 10:00, 12:00, 14:00, or 16:00 ET — used
 *  to thin an intraday axis down to a handful of major markers: always on the
 *  compact /flow-analysis charts, and on a phone for the Options Flow chart,
 *  whose half-hour labels overprint below ~500px of plot. DST-safe via Intl. */
export function isMajorTwoHourTick(ts: string): boolean {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return false;
  if (d.getUTCMinutes() !== 0) return false;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hourCycle: 'h23',
    hour: '2-digit',
  }).formatToParts(d);
  const etHour = Number(parts.find((p) => p.type === 'hour')?.value);
  return MAJOR_TICK_ET_HOURS.has(etHour);
}

/**
 * Returns an array of ReferenceLine elements, one vertical dotted line at each
 * 30-minute boundary in the provided series — or each hour with
 * `everyMinutes = 60`, which a phone-width plot uses so the dots don't crowd
 * into a hatch.
 *
 * Shared by the Options Flow chart (page and My Dashboard widget alike) and the
 * compact charts on /flow-analysis, so every intraday chart draws the same
 * dotted gridline at the same slots the time labels mark.
 */
export function buildThirtyMinGridlines<T extends { timestamp: string }>(
  data: T[],
  stroke: string,
  keyPrefix: string,
  yAxisId?: string,
  everyMinutes: 30 | 60 = 30,
) {
  const onGrid = everyMinutes === 60 ? isHourBoundary : is30MinBoundary;
  return data
    .filter((row) => onGrid(row.timestamp))
    .map((row) => (
      <ReferenceLine
        key={`${keyPrefix}-${row.timestamp}`}
        x={row.timestamp}
        {...(yAxisId ? { yAxisId } : {})}
        stroke={stroke}
        strokeDasharray={GRID_STROKE_DASHARRAY}
        opacity={GRID_OPACITY}
      />
    ));
}
