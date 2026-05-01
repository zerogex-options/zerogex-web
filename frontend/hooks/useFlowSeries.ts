import { useEffect, useRef, useState } from 'react';
import type { FlowSnapshot } from './useFlowByContract';

/**
 * Row shape returned by GET /api/flow/series. Each row is a single 5-minute
 * bar with server-computed session cumulatives for every field the Flow
 * Analysis page plots. The backend emits one row per 5-min slot from session
 * open to the latest bar that has data, with carry-forward values for quiet
 * bars flagged via `is_synthetic`. The frontend is a dumb renderer — no
 * accumulation, no gap-filling.
 *
 * See docs/flow-series-endpoint.md for the full contract.
 */
export interface FlowSeriesPoint {
  timestamp: string;
  bar_start: string;
  bar_end: string;
  call_premium_cum: number;
  put_premium_cum: number;
  call_volume_cum: number;
  put_volume_cum: number;
  net_volume_cum: number;
  raw_volume_cum: number;
  call_position_cum: number;
  put_position_cum: number;
  net_premium_cum: number;
  put_call_ratio: number | null;
  underlying_price: number | null;
  contract_count?: number;
  is_synthetic?: boolean;
}

/**
 * Round-trip a server ISO timestamp (`…00Z`) through `Date.toISOString()`
 * (`…00.000Z`) so chart-row keys match the client-side session timeline
 * built by `new Date(t).toISOString()`. Exported because every consumer of
 * FlowSeriesPoint that then keys data by timestamp hits the same issue.
 */
export function canonicalIso(ts: string): string {
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? ts : d.toISOString();
}

/**
 * Flow Snapshot (call/put volume, premium, net flow, put-call ratio,
 * underlying) derived from the most recent non-synthetic row in a
 * /api/flow/series response. Returns null when there's no usable row.
 * Drop-in replacement for `computeFlowSnapshot(rows, dateKey)` from the
 * legacy useFlowByContract path — same shape, sourced from the aggregated
 * endpoint so there's no client-side accumulation.
 */
export function snapshotFromSeries(rows: FlowSeriesPoint[] | null | undefined): FlowSnapshot | null {
  if (!rows || rows.length === 0) return null;
  let last: FlowSeriesPoint | null = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!rows[i].is_synthetic) {
      last = rows[i];
      break;
    }
  }
  if (!last) last = rows[rows.length - 1];
  const putCallRatio = last.put_call_ratio
    ?? (last.call_volume_cum > 0 ? last.put_volume_cum / last.call_volume_cum : 0);
  return {
    timestamp: canonicalIso(last.timestamp),
    callVolume: last.call_volume_cum,
    putVolume: last.put_volume_cum,
    callPremium: last.call_premium_cum,
    putPremium: last.put_premium_cum,
    netFlow: last.net_volume_cum,
    netPremium: last.net_premium_cum,
    putCallRatio,
    underlyingPrice: last.underlying_price,
  };
}

interface CacheEntry {
  rows: FlowSeriesPoint[];
  byTs: Map<string, number>;
  lastTimestampMs: number | null;
  lastFullRefreshMs: number | null;
}

const DEFAULT_INCREMENTAL_MS = 5_000;
const DEFAULT_FULL_REFRESH_MS = 5 * 60_000;
const STORAGE_PREFIX = 'zerogex:flowSeries:v1:';
const STORAGE_TTL_MS = 24 * 60 * 60_000;

const globalCache = new Map<string, CacheEntry>();
const inflightInitial = new Map<string, Promise<void>>();

export interface FlowSeriesFilters {
  strikes?: string[];
  expirations?: string[];
}

function normalizeFilters(filters: FlowSeriesFilters | undefined): {
  strikes: string[];
  expirations: string[];
} {
  const strikes = (filters?.strikes ?? []).slice().sort();
  const expirations = (filters?.expirations ?? []).slice().sort();
  return { strikes, expirations };
}

function buildCacheKey(symbol: string, session: 'current' | 'prior', filters: FlowSeriesFilters | undefined): string {
  const { strikes, expirations } = normalizeFilters(filters);
  return `${symbol}:${session}:${strikes.join(',')}:${expirations.join(',')}`;
}

function readFromStorage(cacheKey: string): FlowSeriesPoint[] | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; rows?: FlowSeriesPoint[] };
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > STORAGE_TTL_MS) return null;
    return parsed.rows;
  } catch {
    return null;
  }
}

function writeToStorage(cacheKey: string, rows: FlowSeriesPoint[]): void {
  try {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({ savedAt: Date.now(), rows });
    window.sessionStorage.setItem(STORAGE_PREFIX + cacheKey, payload);
  } catch {
    // Quota or serialization failure — fine, cache stays in-memory only.
  }
}

function createEntry(rows: FlowSeriesPoint[]): CacheEntry {
  const byTs = new Map<string, number>();
  let lastMs: number | null = null;
  rows.forEach((row, idx) => {
    if (row.timestamp) byTs.set(row.timestamp, idx);
    const ms = new Date(row.timestamp).getTime();
    if (Number.isFinite(ms) && (lastMs === null || ms > lastMs)) lastMs = ms;
  });
  return { rows, byTs, lastTimestampMs: lastMs, lastFullRefreshMs: Date.now() };
}

/**
 * Merge a tail-window response (intervals=N) into the cached full series.
 * Incoming rows overwrite any cached rows at the same timestamp; new
 * timestamps are appended. The backend emits contiguous bars with
 * carry-forward cumulatives, so a tail merge naturally heals any local
 * drift between polls.
 */
function mergeTail(entry: CacheEntry, incoming: FlowSeriesPoint[]): CacheEntry {
  if (incoming.length === 0) return entry;

  const merged = entry.rows.slice();
  const byTs = new Map(entry.byTs);
  let lastMs = entry.lastTimestampMs;

  for (const row of incoming) {
    if (!row.timestamp) continue;
    const ms = new Date(row.timestamp).getTime();
    if (Number.isFinite(ms) && (lastMs === null || ms > lastMs)) lastMs = ms;

    const existingIdx = byTs.get(row.timestamp);
    if (existingIdx != null) {
      merged[existingIdx] = row;
    } else {
      byTs.set(row.timestamp, merged.length);
      merged.push(row);
    }
  }

  merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  byTs.clear();
  merged.forEach((row, idx) => byTs.set(row.timestamp, idx));

  return {
    rows: merged,
    byTs,
    lastTimestampMs: lastMs,
    lastFullRefreshMs: entry.lastFullRefreshMs,
  };
}

async function fetchSeries(
  symbol: string,
  session: 'current' | 'prior',
  filters: FlowSeriesFilters | undefined,
  intervals?: number,
): Promise<FlowSeriesPoint[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const params = new URLSearchParams({ symbol, underlying: symbol, session });
  const { strikes, expirations } = normalizeFilters(filters);
  if (strikes.length > 0) params.set('strikes', strikes.join(','));
  if (expirations.length > 0) params.set('expirations', expirations.join(','));
  if (intervals != null) params.set('intervals', String(intervals));

  const resp = await fetch(`${baseUrl}/api/flow/series?${params.toString()}`);
  if (!resp.ok) {
    if (resp.status === 404) throw new Error('No data available yet');
    throw new Error(`API error: ${resp.status}`);
  }
  const raw = await resp.json();
  if (!Array.isArray(raw)) return [];
  return raw as FlowSeriesPoint[];
}

export interface UseFlowSeriesOptions {
  /** Incremental tail-poll interval. Default 5 s. Set 0 to disable. */
  incrementalMs?: number;
  /** Full-session refetch interval. Default 5 min. Set 0 to disable. */
  fullRefreshMs?: number;
  enabled?: boolean;
  /** Server-side filters (strikes, expirations). Empty = unfiltered. */
  filters?: FlowSeriesFilters;
}

/**
 * Subscribes to a module-level cache of /api/flow/series rows for
 * `(symbol, session, filters)`. The server returns ready-to-render 5-minute
 * bars with session cumulatives already computed — this hook just polls,
 * merges tails, and hands back the latest snapshot.
 *
 * Dual polling:
 *   - incrementalMs (default 5s): intervals=1 pull of the tail bar
 *   - fullRefreshMs (default 5min): full series refetch
 *
 * Keyed per filter combination so toggling filter chips doesn't thrash the
 * unfiltered cache used by the other charts on the page.
 */
export function useFlowSeries(
  symbol: string,
  session: 'current' | 'prior',
  options: UseFlowSeriesOptions = {},
) {
  const {
    incrementalMs = DEFAULT_INCREMENTAL_MS,
    fullRefreshMs = DEFAULT_FULL_REFRESH_MS,
    enabled = true,
    filters,
  } = options;

  const cacheKey = buildCacheKey(symbol, session, filters);

  if (!globalCache.has(cacheKey)) {
    const stored = readFromStorage(cacheKey);
    if (stored && stored.length > 0) {
      globalCache.set(cacheKey, createEntry(stored));
    }
  }
  const initialEntry = globalCache.get(cacheKey);

  const [rows, setRows] = useState<FlowSeriesPoint[] | null>(
    initialEntry ? initialEntry.rows : null,
  );
  const [loading, setLoading] = useState<boolean>(!initialEntry && enabled);
  const [error, setError] = useState<string | null>(null);

  const cacheKeyRef = useRef(cacheKey);
  if (cacheKeyRef.current !== cacheKey) {
    cacheKeyRef.current = cacheKey;
    if (!globalCache.has(cacheKey)) {
      const stored = readFromStorage(cacheKey);
      if (stored && stored.length > 0) globalCache.set(cacheKey, createEntry(stored));
    }
    const seed = globalCache.get(cacheKey);
    setRows(seed ? seed.rows : null);
    setLoading(!seed && enabled);
    setError(null);
  }

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const runInitial = async (): Promise<void> => {
      // Render any cached rows immediately so the page paints without waiting
      // on the network — but always issue a fresh full-session fetch below.
      // Skipping the fetch when the cache is non-empty (the previous behavior)
      // left the chart pinned to whatever sessionStorage happened to hold —
      // a partial bar window from earlier in the day, a stale prior session,
      // or a transient incomplete server response — until the next
      // refetchFullSession tick (up to fullRefreshMs / 5 min away).
      if (globalCache.has(cacheKey)) {
        const entry = globalCache.get(cacheKey)!;
        if (!cancelled) {
          setRows(entry.rows);
          setLoading(false);
        }
      }

      let pending = inflightInitial.get(cacheKey);
      if (!pending) {
        pending = (async () => {
          try {
            const data = await fetchSeries(symbol, session, filters);
            globalCache.set(cacheKey, createEntry(data));
            writeToStorage(cacheKey, data);
          } finally {
            inflightInitial.delete(cacheKey);
          }
        })();
        inflightInitial.set(cacheKey, pending);
      }

      try {
        await pending;
        if (cancelled) return;
        const entry = globalCache.get(cacheKey);
        setRows(entry ? entry.rows : []);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch flow series');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const refetchFullSession = async (): Promise<void> => {
      try {
        const data = await fetchSeries(symbol, session, filters);
        if (cancelled) return;
        globalCache.set(cacheKey, createEntry(data));
        writeToStorage(cacheKey, data);
        setRows(data);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch flow series');
      }
    };

    const runIncremental = async (): Promise<void> => {
      const entry = globalCache.get(cacheKey);
      if (!entry) {
        await refetchFullSession();
        return;
      }

      try {
        const incoming = await fetchSeries(symbol, session, filters, 1);
        if (cancelled) return;
        if (incoming.length === 0) return;

        const current = globalCache.get(cacheKey);
        if (!current) return;
        const next = mergeTail(current, incoming);

        globalCache.set(cacheKey, next);
        writeToStorage(cacheKey, next.rows);
        setRows(next.rows);
        setError(null);
      } catch {
        // Silent — keep showing cached data.
      }
    };

    runInitial();

    const timers: ReturnType<typeof setInterval>[] = [];
    if (incrementalMs > 0) {
      timers.push(setInterval(runIncremental, incrementalMs));
    }
    if (fullRefreshMs > 0) {
      timers.push(setInterval(refetchFullSession, fullRefreshMs));
    }
    return () => {
      cancelled = true;
      timers.forEach((t) => clearInterval(t));
    };
    // Serialized filter key is embedded in cacheKey, so that covers filter churn.
  }, [cacheKey, symbol, session, enabled, incrementalMs, fullRefreshMs, filters]);

  return { rows, loading, error };
}

/**
 * Response shape for the companion /api/flow/contracts endpoint — the
 * distinct strikes and expirations active in the selected session. Used to
 * populate the Flow Analysis filter chips without consuming the legacy
 * per-contract feed.
 */
export interface FlowContractOptions {
  strikes: number[];
  expirations: string[];
}

const contractsCache = new Map<string, FlowContractOptions>();

async function fetchContractOptions(
  symbol: string,
  session: 'current' | 'prior',
): Promise<FlowContractOptions> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const params = new URLSearchParams({ symbol, underlying: symbol, session });
  const resp = await fetch(`${baseUrl}/api/flow/contracts?${params.toString()}`);
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  const raw = (await resp.json()) as Partial<FlowContractOptions>;
  return {
    strikes: Array.isArray(raw.strikes) ? raw.strikes : [],
    expirations: Array.isArray(raw.expirations) ? raw.expirations : [],
  };
}

export interface UseFlowContractOptionsResult {
  options: FlowContractOptions;
  loading: boolean;
  error: string | null;
}

/**
 * Polls /api/flow/contracts for the distinct strikes/expirations in the
 * selected session. Refreshed every 5 minutes — the set only grows slowly
 * as new contracts print during the day.
 *
 * Returns `{ options, loading, error }` so callers can render proper
 * loading / error states on their filter dropdowns. `loading` is only true
 * on the first fetch; subsequent refetches keep the prior options visible
 * and update them in place.
 */
export function useFlowContractOptions(
  symbol: string,
  session: 'current' | 'prior',
  enabled: boolean = true,
): UseFlowContractOptionsResult {
  const cacheKey = `${symbol}:${session}`;
  const cached = contractsCache.get(cacheKey);
  const [options, setOptions] = useState<FlowContractOptions>(
    cached ?? { strikes: [], expirations: [] },
  );
  const [loading, setLoading] = useState<boolean>(!cached && enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const run = async (isInitial: boolean) => {
      try {
        const next = await fetchContractOptions(symbol, session);
        if (cancelled) return;
        contractsCache.set(cacheKey, next);
        setOptions(next);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to fetch contract options');
      } finally {
        if (!cancelled && isInitial) setLoading(false);
      }
    };

    run(true);
    const timer = setInterval(() => run(false), DEFAULT_FULL_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cacheKey, symbol, session, enabled]);

  return { options, loading, error };
}
