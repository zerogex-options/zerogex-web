/**
 * Running, per-session cache of dealer-positioning *levels* — gamma flip,
 * call wall, and put wall — so the Strike Profile chart's "rewind" feature can
 * replay where those levels sat at any earlier point in the session.
 *
 * Why this exists: `/api/gex/summary` only ever returns the *current* flip and
 * wall strikes (a snapshot). Gamma flip also has a true historical source
 * (`/api/gex/historical`), but the walls do not. So we keep our own running
 * buffer: while the chart is live we record the summary's flip/walls each time
 * they change, and `backfill()` seeds older buckets from any history we can get
 * (the historical-flip endpoint, which may also carry walls). The result is a
 * single timeline the chart can look up by timestamp while rewinding.
 *
 * The buffer is module-scoped and keyed by symbol so it survives component
 * remounts (fullscreen toggles, tab switches) within the same trading session,
 * and is wiped automatically when the ET session date rolls over.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';

export interface GexLevelSample {
  /** Bucket timestamp (ms epoch), floored to the minute. */
  t: number;
  flip: number | null;
  callWall: number | null;
  putWall: number | null;
}

/** A row shape loose enough to accept either a live summary or a history row. */
export interface GexLevelSource {
  timestamp?: string | null;
  gamma_flip?: number | string | null;
  call_wall?: number | string | null;
  put_wall?: number | string | null;
}

interface SessionBuffer {
  /** ET date (YYYY-MM-DD) of the session currently held; '' before first write. */
  sessionKey: string;
  /** bucketMs → sample. Collapsing to the minute bounds memory at ~390/session. */
  map: Map<number, GexLevelSample>;
  /** Sorted-ascending snapshot of `map`, rebuilt on each mutation. */
  samples: GexLevelSample[];
  /** Bumped on every mutation so subscribers re-render. */
  version: number;
  subscribers: Set<() => void>;
}

const buffers = new Map<string, SessionBuffer>();

// Collapse samples to one-minute buckets: at a 1s live poll that keeps the most
// recent value within each minute without unbounded growth.
const BUCKET_MS = 60_000;
// Hard cap so a pathological run (e.g. a 24h-open future) can't grow forever.
const MAX_BUCKETS = 1_600;

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

function getBuffer(symbol: string): SessionBuffer {
  let b = buffers.get(symbol);
  if (!b) {
    b = { sessionKey: '', map: new Map(), samples: [], version: 0, subscribers: new Set() };
    buffers.set(symbol, b);
  }
  return b;
}

function notify(b: SessionBuffer): void {
  b.version += 1;
  // Rebuild the sorted snapshot once per mutation so consumers get a stable
  // reference that only changes when the data does.
  b.samples = Array.from(b.map.values()).sort((p, q) => p.t - q.t);
  b.subscribers.forEach((fn) => fn());
}

// Adopt the incoming session on first write; wipe the buffer when the ET date
// actually rolls over so yesterday's levels never leak into today's rewind.
function ensureSession(b: SessionBuffer, key: string): void {
  if (b.sessionKey === '') {
    b.sessionKey = key;
    return;
  }
  if (b.sessionKey !== key) {
    b.sessionKey = key;
    b.map.clear();
  }
}

/**
 * Insert/merge one sample.
 *  - Live record (fillOnly=false): the latest reading within a minute wins; we
 *    only report a change when a value actually moved, so we don't thrash
 *    re-renders every second when the walls are flat.
 *  - Backfill (fillOnly=true): only fill fields that are still null, so a
 *    history seed never clobbers a value we recorded live.
 * Returns true when the buffer changed.
 */
function upsert(b: SessionBuffer, sample: GexLevelSample, fillOnly: boolean): boolean {
  const bm = bucketOf(sample.t);
  const existing = b.map.get(bm);

  if (!existing) {
    if (sample.flip == null && sample.callWall == null && sample.putWall == null) return false;
    b.map.set(bm, { t: bm, flip: sample.flip, callWall: sample.callWall, putWall: sample.putWall });
    if (b.map.size > MAX_BUCKETS) {
      const oldest = Math.min(...b.map.keys());
      b.map.delete(oldest);
    }
    return true;
  }

  const next: GexLevelSample = fillOnly
    ? {
        t: bm,
        flip: existing.flip ?? sample.flip,
        callWall: existing.callWall ?? sample.callWall,
        putWall: existing.putWall ?? sample.putWall,
      }
    : {
        t: bm,
        // A null in a fresh live reading means "no update", so keep the prior value.
        flip: sample.flip ?? existing.flip,
        callWall: sample.callWall ?? existing.callWall,
        putWall: sample.putWall ?? existing.putWall,
      };

  if (next.flip === existing.flip && next.callWall === existing.callWall && next.putWall === existing.putWall) {
    return false;
  }
  b.map.set(bm, next);
  return true;
}

/**
 * Resolve the levels in effect at `tMs`: for each field independently, take the
 * most recent non-null value at or before `tMs`, falling back to the nearest
 * later value if the rewind point predates any reading of that field. Pure, so
 * it's safe to call from render.
 */
export function levelsAt(samples: GexLevelSample[], tMs: number): GexLevelSample {
  if (samples.length === 0) return { t: tMs, flip: null, callWall: null, putWall: null };

  // Largest index whose bucket is <= tMs (samples are sorted ascending).
  let lo = 0;
  let hi = samples.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= tMs) lo = mid + 1;
    else hi = mid;
  }
  const baseIdx = lo - 1;

  const pick = (field: 'flip' | 'callWall' | 'putWall'): number | null => {
    for (let i = Math.min(baseIdx, samples.length - 1); i >= 0; i -= 1) {
      const v = samples[i][field];
      if (v != null) return v;
    }
    for (let i = baseIdx + 1; i < samples.length; i += 1) {
      const v = samples[i][field];
      if (v != null) return v;
    }
    return null;
  };

  return { t: tMs, flip: pick('flip'), callWall: pick('callWall'), putWall: pick('putWall') };
}

export interface UseGexLevelHistoryResult {
  /** Recorded samples, sorted ascending by time. */
  samples: GexLevelSample[];
  /** Seed older buckets from a history source (fills nulls only). */
  backfill: (rows: GexLevelSource[]) => void;
}

/**
 * Record the live summary's flip/walls into the per-symbol session buffer and
 * expose the accumulated timeline plus a backfill entry point.
 *
 * @param symbol  underlying symbol (one buffer per symbol)
 * @param live    the current GEX summary (flip + wall strikes)
 * @param record  whether to record (pass false while paused/rewinding so the
 *                frozen view doesn't keep appending)
 */
export function useGexLevelHistory(
  symbol: string,
  live: GexLevelSource | null | undefined,
  record: boolean,
): UseGexLevelHistoryResult {
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

  const liveTs = live?.timestamp ?? null;
  const liveFlip = live?.gamma_flip ?? null;
  const liveCall = live?.call_wall ?? null;
  const livePut = live?.put_wall ?? null;

  useEffect(() => {
    if (!record || !liveTs) return;
    const t = new Date(liveTs).getTime();
    if (!Number.isFinite(t)) return;
    ensureSession(b, etDateKey(t));
    const changed = upsert(
      b,
      { t, flip: numOrNull(liveFlip), callWall: numOrNull(liveCall), putWall: numOrNull(livePut) },
      false,
    );
    if (changed) notify(b);
  }, [b, record, liveTs, liveFlip, liveCall, livePut]);

  const backfill = useCallback(
    (rows: GexLevelSource[]) => {
      if (rows.length === 0) return;
      let latest = -Infinity;
      for (const r of rows) {
        if (!r.timestamp) continue;
        const t = new Date(r.timestamp).getTime();
        if (Number.isFinite(t) && t > latest) latest = t;
      }
      if (latest === -Infinity) return;
      ensureSession(b, etDateKey(latest));

      let changed = false;
      for (const r of rows) {
        if (!r.timestamp) continue;
        const t = new Date(r.timestamp).getTime();
        if (!Number.isFinite(t) || etDateKey(t) !== b.sessionKey) continue;
        const c = upsert(
          b,
          { t, flip: numOrNull(r.gamma_flip), callWall: numOrNull(r.call_wall), putWall: numOrNull(r.put_wall) },
          true,
        );
        changed = changed || c;
      }
      if (changed) notify(b);
    },
    [b],
  );

  // `b.samples` is the stable sorted snapshot rebuilt by notify() whenever the
  // buffer changes; bumpVersion (above) re-renders subscribers when it does.
  return { samples: b.samples, backfill };
}
