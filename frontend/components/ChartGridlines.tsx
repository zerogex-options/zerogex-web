'use client';

import { ReferenceLine } from 'recharts';

import {
  is30MinBoundary,
  isHourBoundary,
  onTimeTickGrid,
  safeTimeLabel,
  type TimeTickEvery,
} from '@/core/flowSeriesCharts';

const GRID_STROKE_DASHARRAY = '2 4';
const GRID_OPACITY = 0.28;

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

/**
 * A Recharts `tick` renderer for an intraday axis keyed on an ISO timestamp:
 * the clock on round boundaries, nothing at all on the bars in between.
 *
 * Recharts' own `minTickGap` picks evenly spaced *indices*, so a session that
 * opens at 09:30 on a five-minute grid gets labeled 09:45, 10:15, 10:45 — the
 * right cadence on the wrong phase. That makes "was that before 11:00?" into
 * arithmetic, and it lets two stacked charts pick different starting indices
 * and so disagree about where 11:00 falls, which is the one thing a shared
 * crosshair is supposed to guarantee.
 *
 * Requires `interval={0}` on the axis so every bar is offered to the renderer;
 * the ones that are not on the grid draw nothing. Every cadence here is a
 * subset of buildThirtyMinGridlines' 30- and 60-minute slots, so a label always
 * lands on a gridline; on a phone, where the labels thin to the 2-hour marks,
 * the hourly gridlines in between stay unlabeled.
 */
export function sessionTimeTick(stroke: string, everyMinutes: TimeTickEvery = 30) {
  return function SessionTimeTick(props: {
    x?: number | string;
    y?: number | string;
    payload?: { value?: string | number };
  }) {
    const x = Number(props?.x ?? 0);
    const y = Number(props?.y ?? 0);
    const ts = String(props?.payload?.value ?? '');
    if (!onTimeTickGrid(ts, everyMinutes)) return <g transform={`translate(${x},${y})`} />;
    return (
      <g transform={`translate(${x},${y})`}>
        <line x1={0} y1={0} x2={0} y2={4} stroke={stroke} strokeWidth={1} opacity={0.6} />
        <text dy={14} textAnchor="middle" fill={stroke} fontSize={10}>
          {safeTimeLabel(ts)}
        </text>
      </g>
    );
  };
}
