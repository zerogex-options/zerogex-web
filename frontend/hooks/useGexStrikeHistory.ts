/**
 * Running, per-session DVR of *per-strike* dealer-positioning data — net GEX,
 * call/put GEX, and call/put OI — so the Strike Profile chart's rewind can
 * replay the middle "Gamma" and right "Positions" panels, not just price and
 * the key levels.
 *
 * Why a recorder (and only a recorder): `/api/gex/by-strike` and
 * `/api/market/open-interest` are snapshot-only, and the one historical
 * per-strike source — the `/api/gex/heatmap` grid — reports net GEX on a
 * *different basis* than the live by-strike aggregation (e.g. it doesn't sum
 * across expirations the way the panels do with "Expiry All"), so mixing it in
 * makes the rewound bars jump scale relative to the live view. We therefore
 * record the live aggregation as it ticks and treat that as the single source
 * of truth, which keeps every rewound frame on the same basis as "now".
 *
 * Keeping it light (the reason this doesn't cripple anything):
 *   - Samples are collapsed into one-minute buckets; the latest reading wins
 *     within a bucket, so the buffer is bounded by session length (~390 buckets
 *     for a full 1m RTH session, far fewer at 5m/15m) rather than by the 1s
 *     poll rate. A hard MAX_BUCKETS cap and an ET-session-rollover wipe keep it
 *     from growing without bound.
 *   - Recording replaces only the current bucket each tick (~200 strikes), and
 *     reads happen only while scrubbing. The buffer is module-scoped per symbol
 *     so it survives remounts within a session.
 *
 * Coverage: the Gamma and Positions panels rewind back to when recording began
 * (page open); earlier scrub points resolve to the nearest recording. Use
 * `coverageStartMs` to message that boundary in the UI.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

export interface StrikeAgg {
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
  callOi: number;
  putOi: number;
}

interface SymbolBuffer {
  sessionKey: string;
  /** bucketMs → recorded per-strike aggregation. */
  buckets: Map<number, StrikeAgg[]>;
  /** Ascending bucket keys, kept sorted for binary-search lookups. */
  sortedKeys: number[];
  version: number;
  subscribers: Set<() => void>;
}

const buffers = new Map<string, SymbolBuffer>();

const BUCKET_MS = 60_000;
// A full 1m RTH session is ~390 one-minute buckets; 600 leaves headroom for
// extended hours without letting a long-lived tab grow unbounded.
const MAX_BUCKETS = 600;

const etDateFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' });

function bucketOf(ms: number): number {
  return Math.floor(ms / BUCKET_MS) * BUCKET_MS;
}

function etDateKey(ms: number): string {
  return etDateFmt.format(new Date(ms));
}

function getBuffer(symbol: string): SymbolBuffer {
  let b = buffers.get(symbol);
  if (!b) {
    b = { sessionKey: '', buckets: new Map(), sortedKeys: [], version: 0, subscribers: new Set() };
    buffers.set(symbol, b);
  }
  return b;
}

function notify(b: SymbolBuffer): void {
  b.version += 1;
  b.subscribers.forEach((fn) => fn());
}

function ensureSession(b: SymbolBuffer, key: string): void {
  if (b.sessionKey === '') {
    b.sessionKey = key;
    return;
  }
  if (b.sessionKey !== key) {
    b.sessionKey = key;
    b.buckets.clear();
    b.sortedKeys = [];
  }
}

// Binary-insert a key into the ascending sortedKeys array.
function insertKey(b: SymbolBuffer, bm: number): void {
  let lo = 0;
  let hi = b.sortedKeys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (b.sortedKeys[mid] < bm) lo = mid + 1;
    else hi = mid;
  }
  b.sortedKeys.splice(lo, 0, bm);
}

function enforceCap(b: SymbolBuffer): void {
  while (b.sortedKeys.length > MAX_BUCKETS) {
    const oldest = b.sortedKeys.shift();
    if (oldest != null) b.buckets.delete(oldest);
  }
}

/** Record the live per-strike aggregation into the current minute bucket. */
function recordLive(b: SymbolBuffer, tMs: number, strikes: StrikeAgg[]): boolean {
  ensureSession(b, etDateKey(tMs));
  const bm = bucketOf(tMs);
  // Clone so later mutations of the source array can't alter the recording.
  const snapshot = strikes.map((s) => ({ ...s }));
  const existed = b.buckets.has(bm);
  b.buckets.set(bm, snapshot);
  if (!existed) {
    insertKey(b, bm);
    enforceCap(b);
    return true; // structural change → notify so subscribers re-render
  }
  // Same-bucket overwrite: live rendering doesn't read the buffer, so no notify.
  return false;
}

/** Resolve the recorded snapshot at or before `tMs` (falling forward if none). */
function snapshotAt(b: SymbolBuffer, tMs: number): StrikeAgg[] | null {
  if (b.sortedKeys.length === 0) return null;
  const target = bucketOf(tMs);
  // Largest key <= target.
  let lo = 0;
  let hi = b.sortedKeys.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (b.sortedKeys[mid] <= target) lo = mid + 1;
    else hi = mid;
  }
  const key = lo > 0 ? b.sortedKeys[lo - 1] : b.sortedKeys[0];
  return b.buckets.get(key) ?? null;
}

export interface UseGexStrikeHistoryResult {
  /** Look up the recorded per-strike snapshot in effect at a timestamp. */
  snapshotAt: (tMs: number) => StrikeAgg[] | null;
  /** Earliest time for which per-strike data was recorded, or null. */
  coverageStartMs: number | null;
}

/**
 * Record the live per-strike aggregation and expose a lookup for the rewind
 * feature.
 *
 * @param symbol  buffer key (caller passes symbol+expiry so each filter view
 *                gets its own consistent timeline)
 * @param strikes the current per-strike aggregation (what the panels render)
 * @param tMs     timestamp of `strikes` (ms epoch), or null to skip recording
 * @param record  whether to record (pass false while paused/rewinding)
 */
export function useGexStrikeHistory(
  symbol: string,
  strikes: StrikeAgg[],
  tMs: number | null,
  record: boolean,
): UseGexStrikeHistoryResult {
  const b = getBuffer(symbol);
  const [, bumpVersion] = useState(0);

  useEffect(() => {
    const fn = () => bumpVersion((n) => n + 1);
    b.subscribers.add(fn);
    fn();
    return () => {
      b.subscribers.delete(fn);
    };
  }, [b]);

  useEffect(() => {
    if (!record || tMs == null || !Number.isFinite(tMs) || strikes.length === 0) return;
    if (recordLive(b, tMs, strikes)) notify(b);
  }, [b, record, tMs, strikes]);

  const lookup = useCallback((t: number) => snapshotAt(b, t), [b]);

  const coverageStartMs = b.sortedKeys.length > 0 ? b.sortedKeys[0] : null;

  return { snapshotAt: lookup, coverageStartMs };
}
