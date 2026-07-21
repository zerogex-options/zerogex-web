/**
 * Bifurcated fetch for /api/gex/strike-profile-timeseries, mirroring the
 * pattern useMarketHistorical uses for /api/market/historical.
 *
 * Why bifurcate: a window_units=480 request JOINs ~720K rows in PG (480
 * rep_ts × ~50 strikes × ~30 expirations) and SUM-GROUP-BYs them down to
 * ~24K output rows.  Polling that at 1Hz wastes ~95% of the work — only
 * the live tip bucket actually changes between cycles (analytics writes
 * every ~60s).  Bifurcation gives us a one-time seed for full rewind
 * depth plus a tiny ``window_units=3`` poll for the live tip; together
 * the polling cost drops by ~150× without losing real-time updates.
 *
 * Lifecycle per cache entry (keyed by ``${symbol}:${timeframe}:${expirations}``):
 *   1. First subscriber arrives → kick off the seed fetch (full
 *      ``SEED_WINDOW_UNITS``) and start a background reload every
 *      ``RELOAD_INTERVAL_MS`` (handles all-day rewind depth as the
 *      session grows).
 *   2. While ≥1 subscriber is attached → 1-second poll fetches
 *      ``TIP_WINDOW_UNITS`` buckets, merges them onto the cached array.
 *   3. Last subscriber leaves → 1-second poll stops; background reload
 *      keeps the cache fresh so re-subscribing later is instant.
 *
 * The cache is module-scoped per (symbol, timeframe, expirations), so
 * remounts within the same selection are zero-cost.
 */

'use client';

import { useEffect, useState } from 'react';

export interface StrikeProfileStrike {
  strike?: number | string;
  call_gamma?: number | string | null;
  put_gamma?: number | string | null;
  net_gamma?: number | string | null;
  call_oi?: number | string | null;
  put_oi?: number | string | null;
}

export interface StrikeProfileBucket {
  timestamp: string;
  symbol?: string;
  open?: number | string | null;
  high?: number | string | null;
  low?: number | string | null;
  close?: number | string | null;
  gamma_flip?: number | string | null;
  call_wall?: number | string | null;
  put_wall?: number | string | null;
  strikes?: StrikeProfileStrike[];
}

interface CacheEntry {
  buckets: StrikeProfileBucket[];
  loading: boolean;
  error: string | null;
  hadSuccessfulSeed: boolean;
  subscribers: Set<() => void>;
  /**
   * Number of subscribers that want the 1Hz tip poll running.  The timer
   * runs iff this is > 0, so multiple subscribers with mixed pause states
   * resolve correctly: pausing one doesn't stop the poll for the others.
   */
  activePollers: number;
  pollTimer: ReturnType<typeof setInterval> | null;
  reloadTimer: ReturnType<typeof setTimeout> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  retryDelayMs: number;
  inflightSeed: Promise<void> | null;
}

// Seed window: the rewind range the chart actually exposes.  The Strike
// Profile shows a 78-candle visible window and lets the user scrub back 77
// candles from the live edge, so 78 GEX-data buckets is exactly the rewind
// depth.  Older context (the 77 OHLC backfill candles the chart pulls from
// /api/market/historical) doesn't need GEX data — it only fills the visible
// window's leftmost slots when the scrubber is at its leftmost position.
const SEED_WINDOW_UNITS = 78;
// Tip window: just enough to catch a bucket transition between polls.
// At 1Hz polling and a 1-min bucket boundary, the prior bucket can still
// be updated for ~1s after it closes (the analytics engine writes the
// final cycle into it), so we ask for 3 buckets to cover that boundary.
const TIP_WINDOW_UNITS = 3;
const RELOAD_INTERVAL_MS = 5 * 60_000;
const POLL_INTERVAL_MS = 1_000;
const RETRY_INITIAL_DELAY_MS = 2_000;
const RETRY_MAX_DELAY_MS = 30_000;

const caches = new Map<string, CacheEntry>();

function getCacheKey(symbol: string, timeframe: string, expirations: string): string {
  return `${symbol}:${timeframe}:${expirations}`;
}

function getOrCreateCache(symbol: string, timeframe: string, expirations: string): CacheEntry {
  const key = getCacheKey(symbol, timeframe, expirations);
  let entry = caches.get(key);
  if (!entry) {
    entry = {
      buckets: [],
      loading: false,
      error: null,
      hadSuccessfulSeed: false,
      subscribers: new Set(),
      activePollers: 0,
      pollTimer: null,
      reloadTimer: null,
      retryTimer: null,
      retryDelayMs: RETRY_INITIAL_DELAY_MS,
      inflightSeed: null,
    };
    caches.set(key, entry);
  }
  return entry;
}

function notifyListeners(entry: CacheEntry): void {
  entry.subscribers.forEach((fn) => fn());
}

function bucketTimestampMs(bucket: StrikeProfileBucket): number {
  const ms = new Date(bucket.timestamp).getTime();
  return Number.isFinite(ms) ? ms : -Infinity;
}

function normalizeNumbers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeNumbers);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeNumbers(v);
    }
    return out;
  }
  if (typeof value === 'string') {
    const maybeNumber = Number(value);
    if (Number.isFinite(maybeNumber) && value.trim() !== '') return maybeNumber;
  }
  return value;
}

function buildUrl(symbol: string, timeframe: string, expirations: string, windowUnits: number): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  const sym = encodeURIComponent(symbol);
  const tf = encodeURIComponent(timeframe);
  const exp = encodeURIComponent(expirations);
  return (
    `${baseUrl}/api/gex/strike-profile-timeseries` +
    `?symbol=${sym}&underlying=${sym}&timeframe=${tf}&window_units=${windowUnits}&expirations=${exp}`
  );
}

async function fetchBuckets(
  symbol: string,
  timeframe: string,
  expirations: string,
  windowUnits: number,
): Promise<StrikeProfileBucket[]> {
  const response = await fetch(buildUrl(symbol, timeframe, expirations, windowUnits));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const raw = await response.json();
  const normalized = normalizeNumbers(raw);
  if (!Array.isArray(normalized)) return [];
  return normalized as StrikeProfileBucket[];
}

function cancelRetry(entry: CacheEntry): void {
  if (entry.retryTimer !== null) {
    clearTimeout(entry.retryTimer);
    entry.retryTimer = null;
  }
  entry.retryDelayMs = RETRY_INITIAL_DELAY_MS;
}

function scheduleRetry(
  symbol: string, timeframe: string, expirations: string, entry: CacheEntry,
): void {
  if (entry.retryTimer !== null) return;
  const delay = entry.retryDelayMs;
  entry.retryDelayMs = Math.min(entry.retryDelayMs * 2, RETRY_MAX_DELAY_MS);
  entry.retryTimer = setTimeout(() => {
    entry.retryTimer = null;
    if (entry.inflightSeed) return;
    entry.inflightSeed = performFullReload(symbol, timeframe, expirations).finally(() => {
      entry.inflightSeed = null;
    });
  }, delay);
}

async function performFullReload(symbol: string, timeframe: string, expirations: string): Promise<void> {
  const entry = caches.get(getCacheKey(symbol, timeframe, expirations));
  if (!entry) return;
  try {
    const fetched = await fetchBuckets(symbol, timeframe, expirations, SEED_WINDOW_UNITS);
    const sorted = [...fetched].sort((a, b) => bucketTimestampMs(a) - bucketTimestampMs(b));
    const lastFetchedMs = sorted.length ? bucketTimestampMs(sorted[sorted.length - 1]) : -Infinity;

    // Replace-but-keep-newer: preserve any cached buckets strictly newer
    // than the latest fetched bucket so a just-arrived 1s-poll tip doesn't
    // get dropped by a background reload that ran a beat behind.
    const tail = entry.buckets.filter((b) => bucketTimestampMs(b) > lastFetchedMs);
    entry.buckets = [...sorted, ...tail];
    entry.error = null;
    entry.loading = false;
    entry.hadSuccessfulSeed = true;
    cancelRetry(entry);
    notifyListeners(entry);
  } catch (err) {
    if (entry.buckets.length === 0) {
      entry.error = err instanceof Error ? err.message : 'Failed to fetch strike profile data';
      entry.loading = false;
      notifyListeners(entry);
    }
    if (!entry.hadSuccessfulSeed) {
      scheduleRetry(symbol, timeframe, expirations, entry);
    }
  }
}

async function pollTipBucket(symbol: string, timeframe: string, expirations: string): Promise<void> {
  const entry = caches.get(getCacheKey(symbol, timeframe, expirations));
  if (!entry) return;
  // Don't kick a tip poll while the heavy seed is still in flight — the
  // seed will produce a complete state including the live tip, so the
  // tip poll would race and possibly clobber the seed's tail.
  if (entry.inflightSeed) return;
  try {
    const fetched = await fetchBuckets(symbol, timeframe, expirations, TIP_WINDOW_UNITS);
    if (fetched.length === 0) return;
    const sorted = [...fetched].sort((a, b) => bucketTimestampMs(a) - bucketTimestampMs(b));

    let changed = false;
    let updatedBuckets = entry.buckets;
    const lastCachedMs = updatedBuckets.length
      ? bucketTimestampMs(updatedBuckets[updatedBuckets.length - 1])
      : -Infinity;

    for (const incoming of sorted) {
      const ms = bucketTimestampMs(incoming);
      if (!Number.isFinite(ms)) continue;
      const idx = updatedBuckets.findIndex((b) => bucketTimestampMs(b) === ms);
      if (idx >= 0) {
        // Always overwrite — the incoming bucket carries the most recent
        // strikes / walls / flip / OHLC for that bucket_ts.  Unlike the
        // candle-merge in useMarketHistorical (which preserves the open
        // across a flickering API), the analytics engine writes one
        // snapshot per cycle so the incoming bucket IS the truth.
        updatedBuckets = [...updatedBuckets];
        updatedBuckets[idx] = incoming;
        changed = true;
      } else if (ms > lastCachedMs) {
        updatedBuckets = [...updatedBuckets, incoming];
        changed = true;
      }
    }

    if (changed) {
      entry.buckets = updatedBuckets;
      notifyListeners(entry);
    }
  } catch {
    // Silent failure; the next 1s tick will retry.
  }
}

function ensureSeed(symbol: string, timeframe: string, expirations: string, entry: CacheEntry): void {
  if (entry.buckets.length > 0 || entry.inflightSeed) return;
  entry.loading = true;
  entry.inflightSeed = performFullReload(symbol, timeframe, expirations).finally(() => {
    entry.inflightSeed = null;
  });
}

function ensureBackgroundReload(
  symbol: string, timeframe: string, expirations: string, entry: CacheEntry,
): void {
  if (entry.reloadTimer !== null) return;
  // Random 0–5 min offset so multiple caches don't all hit the API at
  // the same instant on each reload boundary.
  const initialDelay = Math.random() * RELOAD_INTERVAL_MS;
  const tick = () => {
    performFullReload(symbol, timeframe, expirations);
    entry.reloadTimer = setTimeout(tick, RELOAD_INTERVAL_MS);
  };
  entry.reloadTimer = setTimeout(tick, initialDelay);
}

export interface UseStrikeProfileTimeseriesResult {
  buckets: StrikeProfileBucket[];
  loading: boolean;
  error: string | null;
}

function snapshot(entry: CacheEntry): UseStrikeProfileTimeseriesResult {
  return {
    buckets: entry.buckets,
    loading: entry.loading || (entry.buckets.length === 0 && !entry.error),
    error: entry.error,
  };
}

/**
 * Subscribe to the per-(symbol, timeframe, expirations) Strike-Profile
 * timeseries cache.  Triggers a seed fetch on first subscription and a
 * 1Hz tip-poll while ≥1 subscriber is attached AND not paused.
 *
 * ``paused`` mirrors the chart's "Pause" / "Rewind" UX: while true the
 * tip poll is suspended (so the visible buckets don't tick), but the
 * seed and background reload still run so re-subscribing later /
 * resuming gets fresh data without a full reload.
 */
const FROZEN_TIMESERIES: UseStrikeProfileTimeseriesResult = { buckets: [], loading: false, error: null };

export function useStrikeProfileTimeseries(
  symbol: string,
  timeframe: string,
  expirations: string,
  paused: boolean = false,
  enabled: boolean = true,
): UseStrikeProfileTimeseriesResult {
  const cacheKey = getCacheKey(symbol, timeframe, expirations);
  const [state, setState] = useState<UseStrikeProfileTimeseriesResult>(
    () => snapshot(getOrCreateCache(symbol, timeframe, expirations)),
  );
  const [trackedKey, setTrackedKey] = useState(cacheKey);

  // React-recommended "derived state" pattern: when the input key changes,
  // synchronously swap to the new cache's snapshot so we don't briefly
  // render the previous cache's data.
  if (trackedKey !== cacheKey) {
    setTrackedKey(cacheKey);
    setState(snapshot(getOrCreateCache(symbol, timeframe, expirations)));
  }

  useEffect(() => {
    // Disabled (e.g. the public delayed chart): do no network at all.
    if (!enabled) return;
    const entry = getOrCreateCache(symbol, timeframe, expirations);

    ensureSeed(symbol, timeframe, expirations, entry);
    ensureBackgroundReload(symbol, timeframe, expirations, entry);

    const listener = () => setState(snapshot(entry));
    entry.subscribers.add(listener);
    listener();

    return () => {
      entry.subscribers.delete(listener);
    };
  }, [symbol, timeframe, expirations, enabled]);

  // Tip poll runs in a separate effect so toggling ``paused`` flips it on
  // and off without re-running the seed.  The poll is module-shared via the
  // cache entry's pollTimer; activePollers tracks how many subscribers want
  // it running so a paused subscriber doesn't stop the timer for a
  // concurrent unpaused one.
  useEffect(() => {
    if (!enabled || paused) return;
    const entry = getOrCreateCache(symbol, timeframe, expirations);
    entry.activePollers += 1;
    if (entry.pollTimer === null) {
      entry.pollTimer = setInterval(
        () => pollTipBucket(symbol, timeframe, expirations),
        POLL_INTERVAL_MS,
      );
    }
    return () => {
      entry.activePollers -= 1;
      if (entry.activePollers <= 0 && entry.pollTimer !== null) {
        clearInterval(entry.pollTimer);
        entry.pollTimer = null;
      }
    };
  }, [symbol, timeframe, expirations, paused, enabled]);

  return enabled ? state : FROZEN_TIMESERIES;
}
