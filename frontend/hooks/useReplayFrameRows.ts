'use client';

/**
 * useReplayFrameRows — the per-(strike, expiration) dealer-gamma book as it
 * stood at a past moment, read from /api/replay/frame.
 *
 * What it is for: the Gamma Chart's rail color-grades each call / put bar by
 * expiration. Live, the split comes from the /api/gex/by-strike snapshot,
 * which only exists for "now". Rewound, the bars come from a strike-profile
 * bucket that carries no per-expiration dimension, so the split has to come
 * from the book as it was at that bucket's time — which is exactly what a
 * replay frame is: gex_by_strike rows, one per (strike, expiration), resolved
 * at-or-before the requested instant. The same rows the Daily Replay's
 * snapshot permalink grades its bars from.
 *
 * Built for a scrubber, so three things matter:
 *   • One request out at a time. Dragging across fifty buckets must not fire
 *     fifty requests; when the request in flight lands, the hook fetches
 *     whatever moment the caller is on by then, and nothing in between.
 *   • A small module-scoped cache, so scrubbing back over a moment already
 *     read (or a playback loop) costs nothing.
 *   • While the next moment loads, the last one read stays up rather than
 *     blanking — the split only partitions a bar, so a moment-old split is a
 *     far better stand-in than a flicker to solid bars on every bucket.
 *     Callers check `ts` against the moment they draw and decide whether the
 *     held rows are close enough (the chart never borrows another session's).
 */

import { useEffect, useRef, useState } from 'react';
import type { ByStrikeRowLike } from '@/core/expirationGradient';

export interface ReplayFrameRows {
  symbol: string;
  /** The instant these rows were requested for (ISO). */
  ts: string;
  rows: ByStrikeRowLike[];
}

// The frame's rows are per (strike, expiration), so strike_limit counts those
// rows. 4000 is the value the gamma ladder's session baseline already reads
// this endpoint with: it spans the price band around spot on a dense chain.
const STRIKE_LIMIT = 4000;
// Enough for a stretch of scrubbing back and forth without holding a whole
// session of frames in memory (each entry is up to STRIKE_LIMIT rows).
const CACHE_MAX = 24;
// After a failed read (an outage, a symbol the replay store doesn't carry),
// leave that symbol alone for a while instead of retrying on every bucket.
const FAILURE_COOLDOWN_MS = 30_000;

const cache = new Map<string, ByStrikeRowLike[]>();
const inflight = new Map<string, Promise<boolean>>();
const failedUntil = new Map<string, number>();

function frameUrl(symbol: string, iso: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  const s = encodeURIComponent(symbol);
  return `${baseUrl}/api/replay/frame?symbol=${s}&ts=${encodeURIComponent(iso)}&strike_limit=${STRIKE_LIMIT}`;
}

function remember(url: string, rows: ByStrikeRowLike[]): void {
  cache.set(url, rows);
  // Map iterates in insertion order, so the first key is the oldest.
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

// Only the four fields the split reads are kept, so a cached frame costs a
// fraction of the payload it came from.
function narrow(payload: unknown): ByStrikeRowLike[] {
  const strikes = (payload as { strikes?: unknown } | null)?.strikes;
  if (!Array.isArray(strikes)) return [];
  const out: ByStrikeRowLike[] = [];
  for (const raw of strikes) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    out.push({
      strike: r.strike as ByStrikeRowLike['strike'],
      expiration: typeof r.expiration === 'string' ? r.expiration : null,
      call_gex: r.call_gex as ByStrikeRowLike['call_gex'],
      put_gex: r.put_gex as ByStrikeRowLike['put_gex'],
    });
  }
  return out;
}

/** Fetches one frame into the cache. Resolves true when the cache now holds it.
 *  Two charts asking for the same moment share one request. */
function load(symbol: string, url: string): Promise<boolean> {
  let pending = inflight.get(url);
  if (!pending) {
    pending = fetchFrame(symbol, url).finally(() => inflight.delete(url));
    inflight.set(url, pending);
  }
  return pending;
}

async function fetchFrame(symbol: string, url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    // No frame at or before that instant is an answer, not an outage: cache it
    // empty so the moment draws plain bars without being asked for again.
    if (response.status === 404) {
      remember(url, []);
      return true;
    }
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    remember(url, narrow(await response.json()));
    return true;
  } catch {
    failedUntil.set(symbol, Date.now() + FAILURE_COOLDOWN_MS);
    return false;
  }
}

/**
 * The frame rows for `ts` (an ISO instant), or null when there is nothing to
 * draw from yet. `ts` null switches the hook off: nothing is fetched and null
 * is returned. While `ts`'s frame loads, the last frame this hook read for the
 * same symbol is returned instead; check `ts` on the result.
 */
export function useReplayFrameRows(symbol: string, ts: string | null): ReplayFrameRows | null {
  const url = ts ? frameUrl(symbol, ts) : null;
  const [held, setHeld] = useState<ReplayFrameRows | null>(null);
  // Bumped whenever a read finishes, so the effect looks again at where the
  // caller is NOW and fetches that if it has moved on.
  const [settled, setSettled] = useState(0);
  const busy = useRef(false);

  useEffect(() => {
    if (!url || !ts || cache.has(url) || busy.current) return;
    if (Date.now() < (failedUntil.get(symbol) ?? 0)) return;
    busy.current = true;
    void load(symbol, url).then((ok) => {
      busy.current = false;
      const rows = ok ? cache.get(url) : undefined;
      if (rows) setHeld({ symbol, ts, rows });
      setSettled((n) => n + 1);
    });
  }, [url, ts, symbol, settled]);

  if (!url || !ts) return null;
  const hit = cache.get(url);
  if (hit) return { symbol, ts, rows: hit };
  return held && held.symbol === symbol ? held : null;
}
