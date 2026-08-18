'use client';

import { ReferenceLine } from 'recharts';

import { is30MinBoundary } from '@/core/flowSeriesCharts';

const GRID_STROKE_DASHARRAY = '2 4';
const GRID_OPACITY = 0.28;

/**
 * Returns an array of ReferenceLine elements, one vertical dotted line at each
 * 30-minute boundary in the provided series.
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
) {
  return data
    .filter((row) => is30MinBoundary(row.timestamp))
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
