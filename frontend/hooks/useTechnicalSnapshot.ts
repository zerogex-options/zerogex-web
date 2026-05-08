/**
 * Module-scope cache for the technicals page point-in-time signals
 * (`/api/technicals/vwap-deviation` and `/api/technicals/opening-range`).
 *
 * The endpoints return only the *current* snapshot, so the timeseries
 * shown on the technicals page is reconstructed by accumulating one
 * snapshot per minute on the client. Previously this only happened
 * while a user was viewing the page; navigating away or visiting a
 * fresh ticker meant starting from an empty chart. This hook applies
 * the same pattern as `useMarketHistorical` so the cache stays warm:
 *
 *   1. First subscriber for a (symbol, kind) pair → kick off an
 *      immediate fetch + start a 5-minute background reload that runs
 *      forever, with a random 0–5 min initial offset so simultaneously
 *      created caches don't all hit the API at the same instant.
 *   2. While ≥1 subscriber is attached → a faster foreground poll
 *      (every 5s) records snapshots so the live view stays in sync.
 *   3. Last subscriber leaves → foreground poll stops; the 5-minute
 *      reload keeps the cache warm so re-subscribing later is instant.
 *
 * History is persisted to localStorage per (symbol, kind, sessionDate)
 * so accumulated snapshots survive page reloads, and the in-memory
 * cache reseeds itself from there on the first subscription of a tab.
 */

'use client';

import { useEffect, useState } from 'react';
import { normalizeToMinute } from '@/core/utils';

export interface VwapDeviationRow {
  price: number;
  vwap: number;
  vwap_deviation_pct: number;
  vwap_position: string;
}

export interface OpeningRangeRow {
  current_price: number;
  orb_high: number;
  distance_above_orb_high: number;
  orb_low: number;
  distance_below_orb_low: number;
  orb_range: number;
  orb_status: string;
}

export interface VwapHistoryEntry {
  price: number;
  vwap: number;
}

export interface OrbHistoryEntry {
  price: number;
  high: number;
  low: number;
}

type SnapshotKind = 'vwap' | 'orb';

interface CacheEntry<L, H> {
  latest: L | null;
  history: Record<string, H>;
  sessionDateKey: string;
  loading: boolean;
  error: string | null;
  subscribers: Set<() => void>;
  pollTimer: ReturnType<typeof setInterval> | null;
  reloadTimer: ReturnType<typeof setTimeout> | null;
  inflight: Promise<void> | null;
}

const POLL_INTERVAL_MS = 5_000;
const RELOAD_INTERVAL_MS = 5 * 60_000;

const vwapCaches = new Map<string, CacheEntry<VwapDeviationRow, VwapHistoryEntry>>();
const orbCaches = new Map<string, CacheEntry<OpeningRangeRow, OrbHistoryEntry>>();

function safeNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getCurrentSessionDateKey(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  if (hour >= 4) return `${year}-${month}-${day}`;
  const yesterday = new Date(now.getTime() - 24 * 3_600_000);
  const yParts = fmt.formatToParts(yesterday);
  return `${yParts.find((p) => p.type === 'year')?.value ?? ''}-${yParts.find((p) => p.type === 'month')?.value ?? ''}-${yParts.find((p) => p.type === 'day')?.value ?? ''}`;
}

function vwapStorageKey(symbol: string, sessionDateKey: string): string {
  return `zgx_intraday_vwap_v1_${symbol}_${sessionDateKey}`;
}

function orbStorageKey(symbol: string, sessionDateKey: string): string {
  return `zgx_intraday_orb_v1_${symbol}_${sessionDateKey}`;
}

function loadHistoryFromStorage<H>(storageKey: string): Record<string, H> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, H>;
    }
    return {};
  } catch {
    return {};
  }
}

function persistHistoryToStorage<H>(storageKey: string, history: Record<string, H>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(history));
  } catch {
    /* localStorage may be full or disabled; ignore */
  }
}

function notifyListeners<L, H>(entry: CacheEntry<L, H>): void {
  entry.subscribers.forEach((fn) => fn());
}

function buildUrl(endpoint: string, symbol: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const sym = encodeURIComponent(symbol);
  return `${baseUrl}${endpoint}?symbol=${sym}&underlying=${sym}&timeframe=1min&window_units=20`;
}

async function fetchVwap(symbol: string): Promise<VwapDeviationRow | null> {
  const response = await fetch(buildUrl('/api/technicals/vwap-deviation', symbol));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0] || {};
  const out: VwapDeviationRow = {
    price: Number(first.price),
    vwap: Number(first.vwap),
    vwap_deviation_pct: Number(first.vwap_deviation_pct),
    vwap_position: String(first.vwap_position ?? ''),
  };
  return out;
}

async function fetchOrb(symbol: string): Promise<OpeningRangeRow | null> {
  const response = await fetch(buildUrl('/api/technicals/opening-range', symbol));
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0] || {};
  const out: OpeningRangeRow = {
    current_price: Number(first.current_price),
    orb_high: Number(first.orb_high),
    distance_above_orb_high: Number(first.distance_above_orb_high),
    orb_low: Number(first.orb_low),
    distance_below_orb_low: Number(first.distance_below_orb_low),
    orb_range: Number(first.orb_range),
    orb_status: String(first.orb_status ?? ''),
  };
  return out;
}

function ensureSessionRolloverVwap(symbol: string, entry: CacheEntry<VwapDeviationRow, VwapHistoryEntry>): void {
  const today = getCurrentSessionDateKey();
  if (entry.sessionDateKey === today) return;
  entry.sessionDateKey = today;
  entry.history = loadHistoryFromStorage<VwapHistoryEntry>(vwapStorageKey(symbol, today));
}

function ensureSessionRolloverOrb(symbol: string, entry: CacheEntry<OpeningRangeRow, OrbHistoryEntry>): void {
  const today = getCurrentSessionDateKey();
  if (entry.sessionDateKey === today) return;
  entry.sessionDateKey = today;
  entry.history = loadHistoryFromStorage<OrbHistoryEntry>(orbStorageKey(symbol, today));
}

function recordVwapSnapshot(
  symbol: string,
  entry: CacheEntry<VwapDeviationRow, VwapHistoryEntry>,
  latest: VwapDeviationRow,
): boolean {
  const price = safeNum(latest.price);
  const vwap = safeNum(latest.vwap);
  if (price == null || vwap == null) return false;
  const minute = normalizeToMinute(new Date().toISOString());
  if (!minute) return false;
  const existing = entry.history[minute];
  if (existing && existing.price === price && existing.vwap === vwap) return false;
  entry.history = { ...entry.history, [minute]: { price, vwap } };
  persistHistoryToStorage(vwapStorageKey(symbol, entry.sessionDateKey), entry.history);
  return true;
}

function recordOrbSnapshot(
  symbol: string,
  entry: CacheEntry<OpeningRangeRow, OrbHistoryEntry>,
  latest: OpeningRangeRow,
): boolean {
  const price = safeNum(latest.current_price);
  const high = safeNum(latest.orb_high);
  const low = safeNum(latest.orb_low);
  if (price == null || high == null || low == null) return false;
  const minute = normalizeToMinute(new Date().toISOString());
  if (!minute) return false;
  const existing = entry.history[minute];
  if (existing && existing.price === price && existing.high === high && existing.low === low) return false;
  entry.history = { ...entry.history, [minute]: { price, high, low } };
  persistHistoryToStorage(orbStorageKey(symbol, entry.sessionDateKey), entry.history);
  return true;
}

async function performVwapFetch(symbol: string): Promise<void> {
  const entry = vwapCaches.get(symbol);
  if (!entry) return;
  ensureSessionRolloverVwap(symbol, entry);
  try {
    const latest = await fetchVwap(symbol);
    if (latest != null) {
      entry.latest = latest;
      recordVwapSnapshot(symbol, entry, latest);
    }
    entry.error = null;
    entry.loading = false;
    notifyListeners(entry);
  } catch (err) {
    entry.loading = false;
    if (entry.latest == null && Object.keys(entry.history).length === 0) {
      entry.error = err instanceof Error ? err.message : 'Failed to fetch VWAP';
    }
    notifyListeners(entry);
  }
}

async function performOrbFetch(symbol: string): Promise<void> {
  const entry = orbCaches.get(symbol);
  if (!entry) return;
  ensureSessionRolloverOrb(symbol, entry);
  try {
    const latest = await fetchOrb(symbol);
    if (latest != null) {
      entry.latest = latest;
      recordOrbSnapshot(symbol, entry, latest);
    }
    entry.error = null;
    entry.loading = false;
    notifyListeners(entry);
  } catch (err) {
    entry.loading = false;
    if (entry.latest == null && Object.keys(entry.history).length === 0) {
      entry.error = err instanceof Error ? err.message : 'Failed to fetch ORB';
    }
    notifyListeners(entry);
  }
}

function getOrCreateVwapCache(symbol: string): CacheEntry<VwapDeviationRow, VwapHistoryEntry> {
  let entry = vwapCaches.get(symbol);
  if (!entry) {
    const sessionDateKey = getCurrentSessionDateKey();
    entry = {
      latest: null,
      history: loadHistoryFromStorage<VwapHistoryEntry>(vwapStorageKey(symbol, sessionDateKey)),
      sessionDateKey,
      loading: false,
      error: null,
      subscribers: new Set(),
      pollTimer: null,
      reloadTimer: null,
      inflight: null,
    };
    vwapCaches.set(symbol, entry);
  }
  return entry;
}

function getOrCreateOrbCache(symbol: string): CacheEntry<OpeningRangeRow, OrbHistoryEntry> {
  let entry = orbCaches.get(symbol);
  if (!entry) {
    const sessionDateKey = getCurrentSessionDateKey();
    entry = {
      latest: null,
      history: loadHistoryFromStorage<OrbHistoryEntry>(orbStorageKey(symbol, sessionDateKey)),
      sessionDateKey,
      loading: false,
      error: null,
      subscribers: new Set(),
      pollTimer: null,
      reloadTimer: null,
      inflight: null,
    };
    orbCaches.set(symbol, entry);
  }
  return entry;
}

function ensureSeed(kind: SnapshotKind, symbol: string): void {
  if (kind === 'vwap') {
    const entry = getOrCreateVwapCache(symbol);
    if (entry.inflight) return;
    if (entry.latest != null) return;
    entry.loading = true;
    entry.inflight = performVwapFetch(symbol).finally(() => {
      entry.inflight = null;
    });
    return;
  }
  const entry = getOrCreateOrbCache(symbol);
  if (entry.inflight) return;
  if (entry.latest != null) return;
  entry.loading = true;
  entry.inflight = performOrbFetch(symbol).finally(() => {
    entry.inflight = null;
  });
}

function ensureBackgroundReload(kind: SnapshotKind, symbol: string): void {
  if (kind === 'vwap') {
    const entry = getOrCreateVwapCache(symbol);
    if (entry.reloadTimer !== null) return;
    const initialDelay = Math.random() * RELOAD_INTERVAL_MS;
    const tick = () => {
      performVwapFetch(symbol);
      entry.reloadTimer = setTimeout(tick, RELOAD_INTERVAL_MS);
    };
    entry.reloadTimer = setTimeout(tick, initialDelay);
    return;
  }
  const entry = getOrCreateOrbCache(symbol);
  if (entry.reloadTimer !== null) return;
  const initialDelay = Math.random() * RELOAD_INTERVAL_MS;
  const tick = () => {
    performOrbFetch(symbol);
    entry.reloadTimer = setTimeout(tick, RELOAD_INTERVAL_MS);
  };
  entry.reloadTimer = setTimeout(tick, initialDelay);
}

export interface UseVwapSnapshotResult {
  latest: VwapDeviationRow | null;
  history: Record<string, VwapHistoryEntry>;
  sessionDateKey: string;
  loading: boolean;
  error: string | null;
}

export interface UseOrbSnapshotResult {
  latest: OpeningRangeRow | null;
  history: Record<string, OrbHistoryEntry>;
  sessionDateKey: string;
  loading: boolean;
  error: string | null;
}

function vwapSnapshot(entry: CacheEntry<VwapDeviationRow, VwapHistoryEntry>): UseVwapSnapshotResult {
  return {
    latest: entry.latest,
    history: entry.history,
    sessionDateKey: entry.sessionDateKey,
    loading: entry.loading || (entry.latest == null && entry.error == null && Object.keys(entry.history).length === 0),
    error: entry.error,
  };
}

function orbSnapshot(entry: CacheEntry<OpeningRangeRow, OrbHistoryEntry>): UseOrbSnapshotResult {
  return {
    latest: entry.latest,
    history: entry.history,
    sessionDateKey: entry.sessionDateKey,
    loading: entry.loading || (entry.latest == null && entry.error == null && Object.keys(entry.history).length === 0),
    error: entry.error,
  };
}

export function useVwapSnapshot(symbol: string): UseVwapSnapshotResult {
  const [state, setState] = useState<UseVwapSnapshotResult>(() => vwapSnapshot(getOrCreateVwapCache(symbol)));
  const [trackedSymbol, setTrackedSymbol] = useState(symbol);

  if (trackedSymbol !== symbol) {
    setTrackedSymbol(symbol);
    setState(vwapSnapshot(getOrCreateVwapCache(symbol)));
  }

  useEffect(() => {
    const entry = getOrCreateVwapCache(symbol);
    ensureSessionRolloverVwap(symbol, entry);
    ensureSeed('vwap', symbol);
    ensureBackgroundReload('vwap', symbol);

    const listener = () => setState(vwapSnapshot(entry));
    entry.subscribers.add(listener);
    listener();

    if (entry.pollTimer === null) {
      entry.pollTimer = setInterval(() => performVwapFetch(symbol), POLL_INTERVAL_MS);
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

export function useOrbSnapshot(symbol: string): UseOrbSnapshotResult {
  const [state, setState] = useState<UseOrbSnapshotResult>(() => orbSnapshot(getOrCreateOrbCache(symbol)));
  const [trackedSymbol, setTrackedSymbol] = useState(symbol);

  if (trackedSymbol !== symbol) {
    setTrackedSymbol(symbol);
    setState(orbSnapshot(getOrCreateOrbCache(symbol)));
  }

  useEffect(() => {
    const entry = getOrCreateOrbCache(symbol);
    ensureSessionRolloverOrb(symbol, entry);
    ensureSeed('orb', symbol);
    ensureBackgroundReload('orb', symbol);

    const listener = () => setState(orbSnapshot(entry));
    entry.subscribers.add(listener);
    listener();

    if (entry.pollTimer === null) {
      entry.pollTimer = setInterval(() => performOrbFetch(symbol), POLL_INTERVAL_MS);
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
 * Kick off the 5-min background reload for a symbol's VWAP/ORB caches
 * without keeping a foreground subscription. Used by the global
 * pre-warm component so caches start filling for every supported
 * ticker as soon as the app mounts, not only after the first visit
 * to the technicals page.
 */
export function prewarmTechnicalSnapshots(symbol: string): void {
  ensureSeed('vwap', symbol);
  ensureSeed('orb', symbol);
  ensureBackgroundReload('vwap', symbol);
  ensureBackgroundReload('orb', symbol);
}
