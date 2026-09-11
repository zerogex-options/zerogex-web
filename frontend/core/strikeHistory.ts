/**
 * Strike-history bucket lookup shared by the Gamma Terminal's ladders.
 *
 * The strike-profile timeseries is a list of 5-minute buckets, each carrying
 * every strike's dealer gamma as of that bucket. Two readers need "the bucket
 * for a moment": the ladder's reach-back (the newest bucket that has a book
 * at all, when the live tip is empty after the options close) and rewind (the
 * bucket at the chart's replay clock). Both are pure functions of the list.
 */

export interface HistoryBucketLike {
  timestamp: string;
  strikes?: Array<{ net_gamma?: number | string | null }> | null;
}

function num(v: number | string | null | undefined): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
}

/** True when any strike in the bucket carries dealer gamma (an empty or
 *  all-zero book — an ETF after the close — is not positioning). */
export function bucketHasPositioning(bucket: HistoryBucketLike | null | undefined): boolean {
  const strikes = bucket?.strikes;
  if (!Array.isArray(strikes)) return false;
  return strikes.some((s) => (num(s?.net_gamma) ?? 0) !== 0);
}

/** Bucket start in ms, or null when the timestamp is unusable. */
export function bucketMs(bucket: HistoryBucketLike): number | null {
  const t = new Date(bucket.timestamp).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * The bucket to show for a replay clock at `ms`: the newest positioned bucket
 * that starts at or before it (the book as it stood then). When the history
 * does not reach back that far — the comparison symbol's window is only as
 * deep as the server serves — the earliest positioned bucket after it, so
 * the ladder still shows a book and its label says which. Null when no
 * bucket carries positioning at all.
 */
export function bucketAtOrNearest<T extends HistoryBucketLike>(buckets: readonly T[], ms: number): T | null {
  let before: T | null = null;
  let beforeMs = -Infinity;
  let after: T | null = null;
  let afterMs = Infinity;
  for (const b of buckets) {
    if (!bucketHasPositioning(b)) continue;
    const t = bucketMs(b);
    if (t == null) continue;
    if (t <= ms) {
      if (t > beforeMs) {
        before = b;
        beforeMs = t;
      }
    } else if (t < afterMs) {
      after = b;
      afterMs = t;
    }
  }
  return before ?? after;
}

/** "YYYY-MM-DD" of an ISO timestamp in New York time, or null. */
export function etDateKeyOf(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}

/**
 * Day change of a rewound spot: against the previous session's close, which
 * is `current_session_close` while that session is still open (the served
 * pair has not rolled) and `prior_session_close` once today's close is being
 * served — i.e. when the bucket's ET date matches the served current close's
 * date. Null when either side is missing.
 */
export function rewoundChangePercent(
  spot: number | null,
  bucketIso: string,
  closes: {
    current_session_close: number;
    current_session_close_ts: string;
    prior_session_close: number;
  } | null | undefined,
): number | null {
  if (spot == null || !Number.isFinite(spot) || !closes) return null;
  const rolled = etDateKeyOf(closes.current_session_close_ts) === etDateKeyOf(bucketIso);
  const base = rolled ? closes.prior_session_close : closes.current_session_close;
  if (!Number.isFinite(base) || base === 0) return null;
  return ((spot - base) / base) * 100;
}
