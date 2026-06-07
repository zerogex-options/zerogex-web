/**
 * Running, per-session DVR of *per-strike* dealer-positioning data — net GEX,
 * call/put GEX, and call/put OI — so the Strike Profile chart's rewind can
 * replay the middle "Gamma" and right "Positions" panels, not just price and
 * the key levels.
 *
 * Why a recorder: `/api/gex/by-strike` and `/api/market/open-interest` are
 * snapshot-only (no date params), so there is no way to fetch historical
 * call/put split or OI per strike. We therefore record the live aggregation as
 * it ticks. The one field that *does* have history is net GEX per strike, via
 * the strike×time `/api/gex/heatmap` grid — `backfillNet()` seeds that across
 * the whole session.
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
 * Coverage: net GEX rewinds across the full session (heatmap backfill); the
 * call/put split and OI rewind back to when recording began (page open). Use
 * `liveCoverageStartMs` to message that boundary in the UI.
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

export interface StrikeSnapshot {
  /** Bucket timestamp (ms epoch) the snapshot resolved to. */
  t: number;
  strikes: StrikeAgg[];
  /** Whether this snapshot carries call/put GEX split (live-recorded). */
  hasSplit: boolean;
  /** Whether this snapshot carries call/put OI (live-recorded). */
  hasOi: boolean;
}

/** A heatmap time bucket: per-strike net GEX over time (backfill source). */
export interface HeatmapNetBucket {
  timestamp?: string | null;
  heatmap?: Array<{ strike?: number | string | null; net_gex?: number | string | null }> | null;
}

interface StrikeCell {
  netGex: number | null;
  callGex: number | null;
  putGex: number | null;
  callOi: number | null;
  putOi: number | null;
}

interface StrikeBucket {
  t: number;
  cells: Map<number, StrikeCell>;
  /** True once recorded from the live by-strike feed (has split + OI). */
  live: boolean;
}

interface SymbolBuffer {
  sessionKey: string;
  buckets: Map<number, StrikeBucket>;
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

function numOrNull(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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

// Enforce the bucket cap by evicting the oldest buckets.
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
  const cells = new Map<number, StrikeCell>();
  for (const s of strikes) {
    if (!Number.isFinite(s.strike)) continue;
    cells.set(s.strike, {
      netGex: Number.isFinite(s.netGex) ? s.netGex : null,
      callGex: Number.isFinite(s.callGex) ? s.callGex : null,
      putGex: Number.isFinite(s.putGex) ? s.putGex : null,
      callOi: Number.isFinite(s.callOi) ? s.callOi : null,
      putOi: Number.isFinite(s.putOi) ? s.putOi : null,
    });
  }
  if (cells.size === 0) return false;
  const existed = b.buckets.has(bm);
  b.buckets.set(bm, { t: bm, cells, live: true });
  if (!existed) {
    insertKey(b, bm);
    enforceCap(b);
    return true; // structural change → notify so subscribers re-render
  }
  // Same-bucket overwrite: live rendering doesn't read the buffer, so no notify.
  return false;
}

/** Seed per-strike net GEX from the heatmap grid, never overwriting live data. */
function backfillNet(b: SymbolBuffer, rows: HeatmapNetBucket[]): boolean {
  if (rows.length === 0) return false;
  let latest = -Infinity;
  for (const r of rows) {
    if (!r.timestamp) continue;
    const t = new Date(r.timestamp).getTime();
    if (Number.isFinite(t) && t > latest) latest = t;
  }
  if (latest === -Infinity) return false;
  ensureSession(b, etDateKey(latest));

  let changed = false;
  for (const r of rows) {
    if (!r.timestamp || !r.heatmap) continue;
    const t = new Date(r.timestamp).getTime();
    if (!Number.isFinite(t) || etDateKey(t) !== b.sessionKey) continue;
    const bm = bucketOf(t);
    const existing = b.buckets.get(bm);
    // Live buckets are authoritative; don't let a net-only seed clobber them.
    if (existing?.live) continue;

    const bucket: StrikeBucket = existing ?? { t: bm, cells: new Map(), live: false };
    for (const cell of r.heatmap) {
      const strike = numOrNull(cell.strike);
      if (strike == null) continue;
      const ng = numOrNull(cell.net_gex);
      const cur = bucket.cells.get(strike);
      if (!cur) {
        bucket.cells.set(strike, { netGex: ng, callGex: null, putGex: null, callOi: null, putOi: null });
        changed = true;
      } else if (cur.netGex == null && ng != null) {
        cur.netGex = ng;
        changed = true;
      }
    }
    if (!existing && bucket.cells.size > 0) {
      b.buckets.set(bm, bucket);
      insertKey(b, bm);
      changed = true;
    }
  }
  if (changed) enforceCap(b);
  return changed;
}

/** Resolve the recorded snapshot at or before `tMs` (falling forward if none). */
function snapshotAt(b: SymbolBuffer, tMs: number): StrikeSnapshot | null {
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
  const bucket = b.buckets.get(key);
  if (!bucket) return null;

  let hasSplit = false;
  let hasOi = false;
  const strikes: StrikeAgg[] = [];
  bucket.cells.forEach((cell, strike) => {
    if (cell.callGex != null || cell.putGex != null) hasSplit = true;
    if (cell.callOi != null || cell.putOi != null) hasOi = true;
    strikes.push({
      strike,
      netGex: cell.netGex ?? 0,
      callGex: cell.callGex ?? 0,
      putGex: cell.putGex ?? 0,
      callOi: cell.callOi ?? 0,
      putOi: cell.putOi ?? 0,
    });
  });
  // Match the live aggregation's ordering (strike descending).
  strikes.sort((p, q) => q.strike - p.strike);
  return { t: key, strikes, hasSplit, hasOi };
}

export interface UseGexStrikeHistoryResult {
  /** Look up the recorded per-strike snapshot in effect at a timestamp. */
  snapshotAt: (tMs: number) => StrikeSnapshot | null;
  /** Seed per-strike net GEX from the heatmap grid (full-session history). */
  backfillNet: (rows: HeatmapNetBucket[]) => void;
  /** Earliest time for which call/put split + OI were recorded, or null. */
  liveCoverageStartMs: number | null;
}

/**
 * Record the live per-strike aggregation and expose lookup/backfill entry
 * points for the rewind feature.
 *
 * @param symbol  underlying symbol (one buffer per symbol)
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

  const backfill = useCallback(
    (rows: HeatmapNetBucket[]) => {
      if (backfillNet(b, rows)) notify(b);
    },
    [b],
  );

  const lookup = useCallback((t: number) => snapshotAt(b, t), [b]);

  let liveCoverageStartMs: number | null = null;
  for (const key of b.sortedKeys) {
    if (b.buckets.get(key)?.live) {
      liveCoverageStartMs = key;
      break;
    }
  }

  return { snapshotAt: lookup, backfillNet: backfill, liveCoverageStartMs };
}
