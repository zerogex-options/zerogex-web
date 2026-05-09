/**
 * Module-scope cache for the unified `/api/technicals` endpoint that
 * powers the intraday-tools page (VWAP, ORB, volume spikes, momentum
 * divergence). The endpoint returns the full session of 5-minute bars
 * in one payload so a single subscription drives every card and chart
 * on the page.
 *
 * Lifecycle per cached symbol:
 *   1. First subscriber arrives → kick off an immediate seed fetch
 *      (full payload) and start a 5-minute background reload that runs
 *      forever, with a random 0–5 min initial offset so simultaneously
 *      created caches don't all hit the API at the same instant.
 *   2. While ≥1 subscriber is attached → a 1-second foreground poll
 *      requests `interval=3` (just the most recent few bars) and
 *      upserts those into the cache, so the live view updates in real
 *      time without re-fetching the whole session payload.
 *   3. Last subscriber leaves → 1-second poll stops, but the 5-minute
 *      background reload keeps the cache warm so re-subscribing later
 *      is instant.
 */

'use client';

import { useEffect, useState } from 'react';

export interface TechnicalsVwapDeviation {
  vwap: number | null;
  vwap_deviation_pct: number | null;
  vwap_position: string | null;
}

export interface TechnicalsOpeningRange {
  orb_high: number | null;
  orb_low: number | null;
  orb_range: number | null;
  distance_above_orb_high: number | null;
  distance_below_orb_low: number | null;
  orb_pct: number | null;
  orb_status: string | null;
}

export interface TechnicalsVolumeSpike {
  current_volume: number | null;
  avg_volume: number | null;
  volume_sigma: number | null;
  volume_ratio: number | null;
  buying_pressure_pct: number | null;
  volume_class: string | null;
}

export interface TechnicalsMomentumDivergence {
  chg_5m: number | null;
  opt_flow: number | null;
  divergence_signal: string | null;
}

export interface TechnicalsBar {
  time_et: string;
  timestamp: string;
  close: number | null;
  volume: number | null;
  vwap_deviation: TechnicalsVwapDeviation;
  opening_range: TechnicalsOpeningRange;
  volume_spike: TechnicalsVolumeSpike;
  momentum_divergence: TechnicalsMomentumDivergence;
}

export interface TechnicalsResponse {
  symbol: string;
  asset_type: string;
  session_date: string;
  session_start_et: string;
  session_end_et: string;
  volume_proxy: unknown;
  bars: TechnicalsBar[];
}

interface TechnicalsMeta {
  symbol: string;
  asset_type: string;
  session_date: string;
  session_start_et: string;
  session_end_et: string;
  volume_proxy: unknown;
}

interface CacheEntry {
  meta: TechnicalsMeta | null;
  bars: Map<string, TechnicalsBar>;
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
  subscribers: Set<() => void>;
  pollTimer: ReturnType<typeof setInterval> | null;
  reloadTimer: ReturnType<typeof setTimeout> | null;
  inflight: Promise<void> | null;
}

const POLL_INTERVAL_MS = 1_000;
const RELOAD_INTERVAL_MS = 5 * 60_000;
const INCREMENTAL_INTERVAL_PARAM = 3;

const caches = new Map<string, CacheEntry>();

function getOrCreateCache(symbol: string): CacheEntry {
  let entry = caches.get(symbol);
  if (!entry) {
    entry = {
      meta: null,
      bars: new Map(),
      fetchedAt: null,
      loading: false,
      error: null,
      subscribers: new Set(),
      pollTimer: null,
      reloadTimer: null,
      inflight: null,
    };
    caches.set(symbol, entry);
  }
  return entry;
}

function notifyListeners(entry: CacheEntry): void {
  entry.subscribers.forEach((fn) => fn());
}

function buildUrl(symbol: string, interval?: number): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const params = new URLSearchParams({ symbol, underlying: symbol });
  if (interval != null) params.set('interval', String(interval));
  return `${baseUrl}/api/technicals?${params.toString()}`;
}

async function fetchTechnicals(symbol: string, interval?: number): Promise<TechnicalsResponse> {
  const response = await fetch(buildUrl(symbol, interval));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return (await response.json()) as TechnicalsResponse;
}

function tsMs(ts: string | null | undefined): number {
  if (!ts) return -Infinity;
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) ? ms : -Infinity;
}

function applyResponse(entry: CacheEntry, payload: TechnicalsResponse, mode: 'replace' | 'merge'): void {
  if (payload && typeof payload === 'object') {
    entry.meta = {
      symbol: payload.symbol,
      asset_type: payload.asset_type,
      session_date: payload.session_date,
      session_start_et: payload.session_start_et,
      session_end_et: payload.session_end_et,
      volume_proxy: payload.volume_proxy,
    };
  }

  const incoming = Array.isArray(payload?.bars) ? payload.bars : [];

  if (mode === 'replace') {
    const next = new Map<string, TechnicalsBar>();
    for (const bar of incoming) {
      if (bar?.timestamp) next.set(bar.timestamp, bar);
    }
    // Replace-but-keep-newer: preserve any cached bars strictly newer than the
    // latest fetched bar, so a 1-second incremental poll that just landed a
    // brand-new bar an instant before the 5-minute reload's response can't
    // accidentally drop that bar.
    const lastIncomingMs = incoming.length ? tsMs(incoming[incoming.length - 1]?.timestamp) : -Infinity;
    if (Number.isFinite(lastIncomingMs)) {
      for (const [ts, bar] of entry.bars) {
        if (next.has(ts)) continue;
        if (tsMs(ts) > lastIncomingMs) next.set(ts, bar);
      }
    }
    entry.bars = next;
  } else {
    for (const bar of incoming) {
      if (bar?.timestamp) entry.bars.set(bar.timestamp, bar);
    }
  }

  entry.fetchedAt = Date.now();
}

async function performFullReload(symbol: string): Promise<void> {
  const entry = caches.get(symbol);
  if (!entry) return;
  try {
    const payload = await fetchTechnicals(symbol);
    applyResponse(entry, payload, 'replace');
    entry.error = null;
    entry.loading = false;
    notifyListeners(entry);
  } catch (err) {
    entry.loading = false;
    if (entry.bars.size === 0) {
      entry.error = err instanceof Error ? err.message : 'Failed to fetch technicals';
    }
    notifyListeners(entry);
  }
}

async function performIncrementalPoll(symbol: string): Promise<void> {
  const entry = caches.get(symbol);
  if (!entry) return;
  try {
    const payload = await fetchTechnicals(symbol, INCREMENTAL_INTERVAL_PARAM);
    applyResponse(entry, payload, 'merge');
    notifyListeners(entry);
  } catch {
    // Silent failure; the next 1s tick will retry.
  }
}

function ensureSeed(symbol: string): void {
  const entry = getOrCreateCache(symbol);
  if (entry.inflight) return;
  if (entry.bars.size > 0) return;
  entry.loading = true;
  entry.inflight = performFullReload(symbol).finally(() => {
    entry.inflight = null;
  });
}

function ensureBackgroundReload(symbol: string): void {
  const entry = getOrCreateCache(symbol);
  if (entry.reloadTimer !== null) return;
  const initialDelay = Math.random() * RELOAD_INTERVAL_MS;
  const tick = () => {
    performFullReload(symbol);
    entry.reloadTimer = setTimeout(tick, RELOAD_INTERVAL_MS);
  };
  entry.reloadTimer = setTimeout(tick, initialDelay);
}

export interface UseTechnicalsResult {
  bars: TechnicalsBar[];
  latest: TechnicalsBar | null;
  symbol: string | null;
  assetType: string | null;
  sessionDate: string | null;
  sessionStartEt: string | null;
  sessionEndEt: string | null;
  /** Epoch ms timestamp of the most recent successful fetch (full or incremental). */
  fetchedAt: number | null;
  loading: boolean;
  error: string | null;
}

function snapshot(entry: CacheEntry): UseTechnicalsResult {
  const bars = Array.from(entry.bars.values()).sort((a, b) => tsMs(a.timestamp) - tsMs(b.timestamp));
  const latest = bars.length > 0 ? bars[bars.length - 1] : null;
  return {
    bars,
    latest,
    symbol: entry.meta?.symbol ?? null,
    assetType: entry.meta?.asset_type ?? null,
    sessionDate: entry.meta?.session_date ?? null,
    sessionStartEt: entry.meta?.session_start_et ?? null,
    sessionEndEt: entry.meta?.session_end_et ?? null,
    fetchedAt: entry.fetchedAt,
    loading: entry.loading || (bars.length === 0 && !entry.error),
    error: entry.error,
  };
}

export function useTechnicals(symbol: string): UseTechnicalsResult {
  const [state, setState] = useState<UseTechnicalsResult>(() => snapshot(getOrCreateCache(symbol)));
  const [trackedSymbol, setTrackedSymbol] = useState(symbol);

  if (trackedSymbol !== symbol) {
    setTrackedSymbol(symbol);
    setState(snapshot(getOrCreateCache(symbol)));
  }

  useEffect(() => {
    const entry = getOrCreateCache(symbol);
    ensureSeed(symbol);
    ensureBackgroundReload(symbol);

    const listener = () => setState(snapshot(entry));
    entry.subscribers.add(listener);
    listener();

    if (entry.pollTimer === null) {
      entry.pollTimer = setInterval(() => performIncrementalPoll(symbol), POLL_INTERVAL_MS);
    }

    return () => {
      entry.subscribers.delete(listener);
      if (entry.subscribers.size === 0 && entry.pollTimer !== null) {
        clearInterval(entry.pollTimer);
        entry.pollTimer = null;
      }
    };
  }, [symbol]);

  return state;
}

/**
 * Kick off the 5-min background reload for a symbol's technicals cache
 * without keeping a foreground subscription. Used by the global
 * pre-warm component so caches start filling for every supported
 * ticker as soon as the app mounts, not only after the first visit
 * to the technicals page.
 */
export function prewarmTechnicals(symbol: string): void {
  ensureSeed(symbol);
  ensureBackgroundReload(symbol);
}
