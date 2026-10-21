/**
 * Call and put centroids on the price chart — where the session's option
 * trading is centered.
 *
 * The call centroid is the average strike of the calls traded, weighted by how
 * many contracts traded at each strike; the put centroid is the same for puts.
 * Calls trade mostly at and above the price and puts at and below it, so the
 * two lines sit on either side of the tape and move with it. GET
 * /api/flow/centroids serves one row per 5-minute bar with two versions of
 * each side: the session so far, and only the last 15 minutes ("recent").
 *
 * Pure geometry: no React, no DOM. The chart hands in its bars, the rows it
 * polls and its own x / y mappers; this returns SVG path data.
 */

export interface FlowCentroidRow {
  timestamp: string; // 5-minute bar start, UTC
  call_centroid: number | null;
  put_centroid: number | null;
  call_centroid_recent: number | null;
  put_centroid_recent: number | null;
  call_volume: number;
  put_volume: number;
}

export interface CentroidPoint {
  call: number | null;
  put: number | null;
  callRecent: number | null;
  putRecent: number | null;
}

export type CentroidLine = keyof CentroidPoint;

export const CENTROID_BUCKET_MS = 5 * 60_000;

const level = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/**
 * The centroids each bar shows, aligned with `bars`: the newest 5-minute row
 * whose bucket overlaps the bar. A 15-minute or hourly candle therefore reads
 * the row that closes inside it, and every 1-minute candle reads the bucket it
 * falls in. A bar with no overlapping row (another session, after hours) is
 * null, which breaks the line there.
 */
export function centroidsForBars(
  bars: readonly { timestamp: string }[],
  rows: readonly FlowCentroidRow[] | null | undefined,
  barMinutes: number,
): Array<CentroidPoint | null> {
  if (!Array.isArray(rows) || rows.length === 0) return bars.map(() => null);
  const byBucket = new Map<number, CentroidPoint>();
  for (const r of rows) {
    const t = Date.parse(r.timestamp);
    if (!Number.isFinite(t)) continue;
    byBucket.set(Math.floor(t / CENTROID_BUCKET_MS) * CENTROID_BUCKET_MS, {
      call: level(r.call_centroid),
      put: level(r.put_centroid),
      callRecent: level(r.call_centroid_recent),
      putRecent: level(r.put_centroid_recent),
    });
  }
  const barMs = Math.max(1, barMinutes) * 60_000;
  return bars.map((bar) => {
    const start = Date.parse(bar.timestamp);
    if (!Number.isFinite(start)) return null;
    const first = Math.floor(start / CENTROID_BUCKET_MS) * CENTROID_BUCKET_MS;
    for (let k = Math.floor((start + barMs - 1) / CENTROID_BUCKET_MS) * CENTROID_BUCKET_MS; k >= first; k -= CENTROID_BUCKET_MS) {
      const point = byBucket.get(k);
      if (point) return point;
    }
    return null;
  });
}

/** SVG path data for one line through the bars, broken wherever it has no value. */
export function centroidPath(
  points: readonly (CentroidPoint | null)[],
  line: CentroidLine,
  xForIndex: (i: number) => number,
  yPrice: (p: number) => number,
): string {
  const parts: string[] = [];
  let drawing = false;
  points.forEach((p, i) => {
    const v = p ? p[line] : null;
    if (v == null) {
      drawing = false;
      return;
    }
    parts.push(`${drawing ? 'L' : 'M'} ${xForIndex(i).toFixed(1)} ${yPrice(v).toFixed(1)}`);
    drawing = true;
  });
  return parts.join(' ');
}

/** Lowest and highest value across every line, for the price axis; null when there is none. */
export function centroidRange(points: readonly (CentroidPoint | null)[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (!p) continue;
    for (const v of [p.call, p.put, p.callRecent, p.putRecent]) {
      if (v == null) continue;
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  return min <= max ? { min, max } : null;
}
