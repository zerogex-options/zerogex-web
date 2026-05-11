/**
 * Central in-memory cache for /api/market/historical, keyed by
 * `${symbol}:${timeframe}`. One cache per (symbol, timeframe) pair is shared
 * across the whole app — every chart that previously called
 * `/api/market/historical` directly should subscribe through this hook.
 *
 * Lifecycle per cache entry:
 *   1. First subscriber arrives → kick off an immediate seed fetch
 *      (`window_units=576`) and start a 5-minute background reload that
 *      runs forever, with a random 0–5 min initial offset to keep reloads
 *      from all firing simultaneously across keys.
 *   2. While ≥1 subscriber is attached → 1-second poll fetches
 *      `window_units=1` and merges/upserts that bar into the cache.
 *   3. Last subscriber leaves → 1-second poll stops, but the 5-minute
 *      background reload keeps the cache fresh (so re-subscribing later
 *      is instant — no warm-up cost).
 *
 * Full-reload merge strategy is "replace-but-keep-newer": take the rows
 * from the 5-minute fetch, then append any rows from the previous cache
 * whose timestamps are strictly newer than the latest fetched bar — so
 * a 1-second poll that landed a brand-new bar an instant before the
 * 5-minute reload's response can't accidentally drop that bar.
 */

'use client';

import { useEffect, useState } from 'react';

export interface PriceBar {
  timestamp: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  price?: number;
  volume?: number;
  up_volume?: number | null;
  down_volume?: number | null;
}

interface CacheEntry {
  rows: PriceBar[];
  loading: boolean;
  error: string | null;
  hadSuccessfulSeed: boolean;
  subscribers: Set<() => void>;
  pollTimer: ReturnType<typeof setInterval> | null;
  reloadTimer: ReturnType<typeof setTimeout> | null;
  retryTimer: ReturnType<typeof setTimeout> | null;
  retryDelayMs: number;
  inflightSeed: Promise<void> | null;
}

const CACHE_BAR_LIMIT = 576;
const RELOAD_INTERVAL_MS = 5 * 60_000;
const POLL_INTERVAL_MS = 1_000;
// Backoff window for retrying a failed full-reload (e.g., transient 401s on
// the upstream). Without this, the cache stays empty until the next 5-minute
// background reload tick fires — which can be up to 5 minutes away — and
// the chart only shows whatever sparse bars the 1s poll has accumulated.
const RETRY_INITIAL_DELAY_MS = 2_000;
const RETRY_MAX_DELAY_MS = 30_000;

const caches = new Map<string, CacheEntry>();

function getCacheKey(symbol: string, timeframe: string): string {
  return `${symbol}:${timeframe}`;
}

function getOrCreateCache(symbol: string, timeframe: string): CacheEntry {
  const key = getCacheKey(symbol, timeframe);
  let entry = caches.get(key);
  if (!entry) {
    entry = {
      rows: [],
      loading: false,
      error: null,
      hadSuccessfulSeed: false,
      subscribers: new Set(),
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

function rowTimestampMs(row: PriceBar): number {
  const ms = new Date(row.timestamp).getTime();
  return Number.isFinite(ms) ? ms : -Infinity;
}

/**
 * Merge an updated quote for the live (in-progress) bar into the cached bar.
 *
 * The intraday API can return an updated `open` (or omit `high`/`low`) for the
 * live bar on every poll; that would visually "jump" the bar each tick. A real
 * candle's open is fixed at the bar's start, so we keep the cached open once
 * set, only widen high/low past the cached extremes, and let close (and the
 * cumulative volume fields) update freely.
 */
function mergeLiveBar(cached: PriceBar, incoming: PriceBar): PriceBar {
  const cachedOpen = Number(cached.open);
  const incomingOpen = Number(incoming.open);
  const cachedHigh = Number(cached.high);
  const incomingHigh = Number(incoming.high);
  const cachedLow = Number(cached.low);
  const incomingLow = Number(incoming.low);
  const incomingClose = Number(incoming.close ?? incoming.price);
  const cachedClose = Number(cached.close ?? cached.price);

  const open = Number.isFinite(cachedOpen)
    ? cachedOpen
    : Number.isFinite(incomingOpen)
      ? incomingOpen
      : Number.isFinite(cachedClose)
        ? cachedClose
        : incomingClose;

  const candidatesHigh = [cachedHigh, incomingHigh, incomingClose, cachedClose].filter(Number.isFinite);
  const candidatesLow = [cachedLow, incomingLow, incomingClose, cachedClose].filter(Number.isFinite);
  const high = candidatesHigh.length ? Math.max(...candidatesHigh) : incomingClose;
  const low = candidatesLow.length ? Math.min(...candidatesLow) : incomingClose;

  return {
    ...incoming,
    timestamp: cached.timestamp,
    open,
    high,
    low,
    close: Number.isFinite(incomingClose) ? incomingClose : cachedClose,
  };
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

function buildUrl(symbol: string, timeframe: string, windowUnits: number): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const sym = encodeURIComponent(symbol);
  const tf = encodeURIComponent(timeframe);
  return `${baseUrl}/api/market/historical?symbol=${sym}&underlying=${sym}&timeframe=${tf}&window_units=${windowUnits}`;
}

async function fetchBars(symbol: string, timeframe: string, windowUnits: number): Promise<PriceBar[]> {
  const response = await fetch(buildUrl(symbol, timeframe, windowUnits));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const raw = await response.json();
  const normalized = normalizeNumbers(raw);
  if (!Array.isArray(normalized)) return [];
  return normalized as PriceBar[];
}

function cancelRetry(entry: CacheEntry): void {
  if (entry.retryTimer !== null) {
    clearTimeout(entry.retryTimer);
    entry.retryTimer = null;
  }
  entry.retryDelayMs = RETRY_INITIAL_DELAY_MS;
}

function scheduleRetry(symbol: string, timeframe: string, entry: CacheEntry): void {
  if (entry.retryTimer !== null) return;
  const delay = entry.retryDelayMs;
  entry.retryDelayMs = Math.min(entry.retryDelayMs * 2, RETRY_MAX_DELAY_MS);
  entry.retryTimer = setTimeout(() => {
    entry.retryTimer = null;
    if (entry.inflightSeed) return;
    entry.inflightSeed = performFullReload(symbol, timeframe).finally(() => {
      entry.inflightSeed = null;
    });
  }, delay);
}

async function performFullReload(symbol: string, timeframe: string): Promise<void> {
  const entry = caches.get(getCacheKey(symbol, timeframe));
  if (!entry) return;
  try {
    const fetched = await fetchBars(symbol, timeframe, CACHE_BAR_LIMIT);
    const sorted = [...fetched].sort((a, b) => rowTimestampMs(a) - rowTimestampMs(b));
    const lastFetchedMs = sorted.length ? rowTimestampMs(sorted[sorted.length - 1]) : -Infinity;

    // Preserve the live bar's accumulated OHLC: if the latest fetched bar
    // matches a cached bar, merge so the cached open/high/low aren't reset by
    // whatever the API reports for the in-progress bar this instant.
    if (sorted.length > 0) {
      const cachedAtSameTs = entry.rows.find((r) => rowTimestampMs(r) === lastFetchedMs);
      if (cachedAtSameTs) {
        sorted[sorted.length - 1] = mergeLiveBar(cachedAtSameTs, sorted[sorted.length - 1]);
      }
    }

    // Replace-but-keep-newer: preserve any cached bars strictly newer than the
    // latest fetched bar so a just-arrived 1s-poll bar doesn't get dropped.
    const tail = entry.rows.filter((r) => rowTimestampMs(r) > lastFetchedMs);
    entry.rows = [...sorted, ...tail];
    entry.error = null;
    entry.loading = false;
    entry.hadSuccessfulSeed = true;
    cancelRetry(entry);
    notifyListeners(entry);
  } catch (err) {
    if (entry.rows.length === 0) {
      entry.error = err instanceof Error ? err.message : 'Failed to fetch market data';
      entry.loading = false;
      notifyListeners(entry);
    }
    // Retry on backoff until we get at least one successful full reload, so a
    // transient upstream error (e.g., 401) on the initial seed doesn't leave
    // the cache empty while the 1s poll trickles in a handful of bars until
    // the next 5-minute background reload tick fires. Once the seed has
    // succeeded once, we trust the regular 5-min reload cadence and let
    // transient failures fall through silently.
    if (!entry.hadSuccessfulSeed) {
      scheduleRetry(symbol, timeframe, entry);
    }
  }
}

async function pollLatestBar(symbol: string, timeframe: string): Promise<void> {
  const entry = caches.get(getCacheKey(symbol, timeframe));
  if (!entry) return;
  try {
    // Fetch a small tail (not just 1 bar) so that a bar boundary crossing
    // between polls doesn't cause us to skip the bar that just completed.
    const fetched = await fetchBars(symbol, timeframe, 3);
    if (fetched.length === 0) return;
    const sorted = [...fetched].sort((a, b) => rowTimestampMs(a) - rowTimestampMs(b));

    let changed = false;
    let updatedRows = entry.rows;
    const lastCachedMs = updatedRows.length ? rowTimestampMs(updatedRows[updatedRows.length - 1]) : -Infinity;

    for (const incoming of sorted) {
      const ms = rowTimestampMs(incoming);
      if (!Number.isFinite(ms)) continue;
      const idx = updatedRows.findIndex((r) => rowTimestampMs(r) === ms);
      if (idx >= 0) {
        // Merge into the cached bar so the in-progress open/high/low stay
        // anchored to the values we've been accumulating between polls.
        const merged = mergeLiveBar(updatedRows[idx], incoming);
        if (merged !== updatedRows[idx]) {
          updatedRows = [...updatedRows];
          updatedRows[idx] = merged;
          changed = true;
        }
      } else if (ms > lastCachedMs) {
        updatedRows = [...updatedRows, incoming];
        changed = true;
      }
    }

    if (changed) {
      entry.rows = updatedRows;
      notifyListeners(entry);
    }
  } catch {
    // Silent failure; we'll try again on the next 1s tick.
  }
}

function ensureSeed(symbol: string, timeframe: string, entry: CacheEntry): void {
  if (entry.rows.length > 0 || entry.inflightSeed) return;
  entry.loading = true;
  entry.inflightSeed = performFullReload(symbol, timeframe).finally(() => {
    entry.inflightSeed = null;
  });
}

function ensureBackgroundReload(symbol: string, timeframe: string, entry: CacheEntry): void {
  if (entry.reloadTimer !== null) return;
  // Random 0–5 min initial offset so simultaneously-created caches don't all
  // hit the API at the same instant on every reload boundary.
  const initialDelay = Math.random() * RELOAD_INTERVAL_MS;
  const tick = () => {
    performFullReload(symbol, timeframe);
    entry.reloadTimer = setTimeout(tick, RELOAD_INTERVAL_MS);
  };
  entry.reloadTimer = setTimeout(tick, initialDelay);
}

export interface UseMarketHistoricalResult {
  rows: PriceBar[];
  loading: boolean;
  error: string | null;
}

function snapshot(entry: CacheEntry): UseMarketHistoricalResult {
  return {
    rows: entry.rows,
    loading: entry.loading || (entry.rows.length === 0 && !entry.error),
    error: entry.error,
  };
}

export function useMarketHistorical(symbol: string, timeframe: string): UseMarketHistoricalResult {
  const cacheKey = getCacheKey(symbol, timeframe);
  const [state, setState] = useState<UseMarketHistoricalResult>(() => snapshot(getOrCreateCache(symbol, timeframe)));
  const [trackedKey, setTrackedKey] = useState(cacheKey);

  // React-recommended "derived state" pattern: when the input key changes,
  // synchronously swap to the new cache's snapshot so we don't briefly render
  // the previous cache's data.
  if (trackedKey !== cacheKey) {
    setTrackedKey(cacheKey);
    setState(snapshot(getOrCreateCache(symbol, timeframe)));
  }

  useEffect(() => {
    const entry = getOrCreateCache(symbol, timeframe);

    ensureSeed(symbol, timeframe, entry);
    ensureBackgroundReload(symbol, timeframe, entry);

    const listener = () => setState(snapshot(entry));
    entry.subscribers.add(listener);
    listener();

    if (entry.pollTimer === null) {
      entry.pollTimer = setInterval(() => pollLatestBar(symbol, timeframe), POLL_INTERVAL_MS);
    }

    return () => {
      entry.subscribers.delete(listener);
      if (entry.subscribers.size === 0 && entry.pollTimer !== null) {
        clearInterval(entry.pollTimer);
        entry.pollTimer = null;
      }
    };
  }, [symbol, timeframe]);

  return state;
}
