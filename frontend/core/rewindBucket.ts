/**
 * Which strike-profile bucket a rewound moment reads its dealer levels from.
 *
 * Rewind exists to answer "what did the book look like THEN", so the bucket it
 * resolves has to be one that existed at that moment. The chart's own rule was
 * the nearest bucket by absolute time distance, which is not that rule: the
 * buckets are five minutes apart and the replay clock is continuous, so an
 * anchor at 10:03 is nearer to 10:05 than to 10:00 and the chart drew the flip,
 * walls and pin as they were measured two minutes into that bar's future.
 * During playback the levels therefore moved BEFORE the tape that moved them,
 * which is the one thing a replay must not do.
 *
 * So resolution here is strictly backward-looking — the newest bucket at or
 * before the anchor — and the answer for a given anchor never depends on what
 * arrives later. It is the same rule the backend's own gap-fill states for the
 * same problem (`src/analytics/gamma_flip_carry.py`: "Strictly backward-looking
 * … which is what makes a gap-filled bar identical to the live write it stands
 * in for"), and the reason is the same on both sides.
 *
 * It is also bounded by the trading session, for the reason that module gives:
 * reaching back past the open for a level imports yesterday's market. An anchor
 * that sits before its session's first bucket resolves to nothing, and the
 * caller draws no levels rather than borrowing a reading from a session that
 * had already settled.
 *
 * Pure (no React, no fetching) so the ordering rule can be pinned by tests
 * rather than by scrubbing a chart.
 */
import { tradingSessionKeyFor } from './netVolumeSeries.ts';

/** The shape this resolver needs — the timeseries bucket carries much more. */
export interface RewindBucketLike {
  timestamp: string;
}

/**
 * The bucket whose levels a rewound anchor may draw, or `null` when the
 * session has none at or before it.
 *
 * @param buckets   strike-profile buckets; order is not assumed.
 * @param anchorTime the replay clock, in epoch ms.
 * @param symbol    the underlying, so ES / NQ overnight sessions are keyed to
 *                  the date they settle on rather than split at midnight ET
 *                  (see {@link tradingSessionKeyFor}).
 */
export function resolveRewindBucket<T extends RewindBucketLike>(
  buckets: readonly T[],
  anchorTime: number | null | undefined,
  symbol?: string | null,
): T | null {
  if (anchorTime == null || !Number.isFinite(anchorTime) || buckets.length === 0) return null;

  // The anchor's own session. Keyed off the anchor rather than off the newest
  // bucket, because rewind can sit in a session the live tip has already left.
  const anchorSession = tradingSessionKeyFor(new Date(anchorTime).toISOString(), symbol);

  let best: T | null = null;
  let bestTs = -Infinity;
  for (const bucket of buckets) {
    const ts = new Date(bucket.timestamp).getTime();
    // `> anchorTime` is the whole fix: a bucket measured after the moment being
    // replayed is not a reading about that moment.
    if (!Number.isFinite(ts) || ts > anchorTime) continue;
    if (tradingSessionKeyFor(bucket.timestamp, symbol) !== anchorSession) continue;
    if (ts > bestTs) {
      bestTs = ts;
      best = bucket;
    }
  }
  return best;
}
