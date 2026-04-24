import { useEffect, useRef, useState } from 'react';

/**
 * Row shape returned by GET /api/flow/by-contract. Each row represents a
 * single 5-minute bar's contribution for one contract — the values are
 * per-bar deltas, NOT running cumulatives. Running totals are accumulated
 * client-side in the page builders.
 */
export interface FlowByContractPoint {
  timestamp?: string;
  time_window_start?: string;
  time_window_end?: string;
  interval_timestamp?: string | null;
  symbol?: string;
  option_type?: 'C' | 'P' | string;
  strike?: number | string;
  expiration?: string;
  dte?: number | string;
  raw_volume?: number | string;
  raw_premium?: number | string;
  net_volume?: number | string;
  net_premium?: number | string;
  underlying_price?: number | string | null;
}

export interface FlowSnapshot {
  timestamp: string;
  callVolume: number;
  putVolume: number;
  callPremium: number;
  putPremium: number;
  netFlow: number;
  netPremium: number;
  putCallRatio: number;
  underlyingPrice: number | null;
}

interface CacheEntry {
  rows: FlowByContractPoint[];
  byKey: Map<string, number>;
  lastTimestampMs: number | null;
  lastFullRefreshMs: number | null;
}

const BAR_MS = 5 * 60_000;
// Incremental intervals=1 polls land every few seconds to keep the latest
// bar fresh; the full-session refetch runs every 5 minutes to guarantee
// backfill and correct any drift between poll merges and API state.
const DEFAULT_INCREMENTAL_MS = 5_000;
const DEFAULT_FULL_REFRESH_MS = 5 * 60_000;
const STORAGE_PREFIX = 'zerogex:flowByContract:v2:';
const STORAGE_TTL_MS = 24 * 60 * 60_000;

const globalCache = new Map<string, CacheEntry>();
const inflightInitial = new Map<string, Promise<void>>();

function readFromStorage(cacheKey: string): FlowByContractPoint[] | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + cacheKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; rows?: FlowByContractPoint[] };
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > STORAGE_TTL_MS) return null;
    return parsed.rows;
  } catch {
    return null;
  }
}

function writeToStorage(cacheKey: string, rows: FlowByContractPoint[]): void {
  try {
    if (typeof window === 'undefined') return;
    const payload = JSON.stringify({ savedAt: Date.now(), rows });
    window.sessionStorage.setItem(STORAGE_PREFIX + cacheKey, payload);
  } catch {
    // Quota or serialization failure — fine, cache stays in-memory only.
  }
}

function coerceNumber(value: unknown): unknown {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return value;
    const n = Number(trimmed);
    if (Number.isFinite(n)) return n;
  }
  return value;
}

function normalizeRow(row: Record<string, unknown>): FlowByContractPoint {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'option_type') {
      // Canonicalize to 'C' or 'P' so downstream comparisons are reliable.
      const s = typeof v === 'string' ? v.trim().toUpperCase() : '';
      if (s === 'C' || s === 'CALL' || s === 'CALLS') out[k] = 'C';
      else if (s === 'P' || s === 'PUT' || s === 'PUTS') out[k] = 'P';
      else out[k] = s || v;
    } else if (k === 'symbol' || k === 'expiration' ||
        k === 'timestamp' || k === 'time_window_start' || k === 'time_window_end' ||
        k === 'interval_timestamp') {
      out[k] = v;
    } else {
      out[k] = coerceNumber(v);
    }
  }
  return out as FlowByContractPoint;
}

export function flowRowTimestamp(row: FlowByContractPoint): string | null {
  return (
    row.timestamp ||
    row.time_window_end ||
    row.interval_timestamp ||
    row.time_window_start ||
    null
  );
}

const rowTimestamp = flowRowTimestamp;

function normalizeToMinuteIso(ts: string): string | null {
  const ms = new Date(ts).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(Math.floor(ms / 60_000) * 60_000).toISOString();
}

// Floors a timestamp to the 5-minute bar boundary the backend aggregates at,
// so bucket keys line up exactly with the 09:30/09:35/09:40… session timeline
// rendered on Flow Analysis. Used by forEachBar so any off-boundary timestamp
// from the API still lands on the correct chart slot.
function normalizeToFiveMinuteIso(ts: string): string | null {
  const ms = new Date(ts).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(Math.floor(ms / BAR_MS) * BAR_MS).toISOString();
}

// Cached at the module level so hot paths don't pay the Intl formatter cost
// for every row. Bounded so long-running sessions don't leak.
const etDateKeyCache = new Map<string, string>();
const ET_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
function getETDateKey(ts: string): string {
  const cached = etDateKeyCache.get(ts);
  if (cached != null) return cached;
  const d = new Date(ts);
  const key = Number.isNaN(d.getTime()) ? '' : ET_DATE_FORMATTER.format(d);
  if (etDateKeyCache.size > 20_000) etDateKeyCache.clear();
  etDateKeyCache.set(ts, key);
  return key;
}

export function etDateKeyFor(ts: string | null | undefined): string {
  if (!ts) return '';
  return getETDateKey(ts);
}

export function latestRowTimestamp(rows: FlowByContractPoint[] | null | undefined): string | null {
  if (!rows || rows.length === 0) return null;
  let latestTs: string | null = null;
  let latestMs = -Infinity;
  for (const row of rows) {
    const ts = rowTimestamp(row);
    if (!ts) continue;
    const ms = new Date(ts).getTime();
    if (Number.isFinite(ms) && ms > latestMs) {
      latestMs = ms;
      latestTs = ts;
    }
  }
  return latestTs;
}

export function latestRowDateKey(rows: FlowByContractPoint[] | null | undefined): string | null {
  const ts = latestRowTimestamp(rows);
  if (!ts) return null;
  const key = getETDateKey(ts);
  return key || null;
}

/**
 * Produces a session-cumulative snapshot by summing per-bar contributions
 * across every contract and bar in the selected session.
 *   callVolume   = Σ raw_volume where option_type === 'C'
 *   putVolume    = Σ raw_volume where option_type === 'P'
 *   callPremium  = Σ net_premium where option_type === 'C'
 *   putPremium   = Σ net_premium where option_type === 'P'
 *   netFlow      = Σ net_volume across all contracts
 *   netPremium   = Σ net_premium across all contracts
 *   putCallRatio = putVolume / callVolume
 *   underlyingPrice = the most recent bar's underlying_price
 */
export function computeFlowSnapshot(
  rows: FlowByContractPoint[] | null | undefined,
  dateKey?: string,
): FlowSnapshot | null {
  if (!rows || rows.length === 0) return null;

  const scoped = dateKey
    ? rows.filter((r) => {
        const ts = rowTimestamp(r);
        return ts ? getETDateKey(ts) === dateKey : false;
      })
    : rows;
  if (scoped.length === 0) return null;

  let callVolume = 0;
  let putVolume = 0;
  let callPremium = 0;
  let putPremium = 0;
  let netFlow = 0;
  let netPremium = 0;
  let latestTs: string | null = null;
  let latestMs = -Infinity;
  let latestUnderlying: number | null = null;
  let latestUnderlyingMs = -Infinity;

  for (const row of scoped) {
    const ts = rowTimestamp(row);
    if (!ts) continue;
    const ms = new Date(ts).getTime();
    if (!Number.isFinite(ms)) continue;

    const rv = Number(row.raw_volume ?? 0);
    const nv = Number(row.net_volume ?? 0);
    const np = Number(row.net_premium ?? 0);
    if (row.option_type === 'C') {
      if (Number.isFinite(rv)) callVolume += rv;
      if (Number.isFinite(np)) callPremium += np;
    } else if (row.option_type === 'P') {
      if (Number.isFinite(rv)) putVolume += rv;
      if (Number.isFinite(np)) putPremium += np;
    }
    if (Number.isFinite(nv)) netFlow += nv;
    if (Number.isFinite(np)) netPremium += np;

    if (ms > latestMs) {
      latestMs = ms;
      latestTs = ts;
    }
    if (row.underlying_price != null && ms >= latestUnderlyingMs) {
      const u = Number(row.underlying_price);
      if (Number.isFinite(u)) {
        latestUnderlying = u;
        latestUnderlyingMs = ms;
      }
    }
  }

  if (!latestTs) return null;

  return {
    timestamp: latestTs,
    callVolume,
    putVolume,
    callPremium,
    putPremium,
    netFlow,
    netPremium,
    putCallRatio: callVolume > 0 ? putVolume / callVolume : 0,
    underlyingPrice: latestUnderlying,
  };
}

/**
 * Map of minute-floored ISO timestamp -> underlying_price for use by pages
 * that need to overlay the underlying price on top of their own chart data.
 */
export function buildUnderlyingPriceMap(rows: FlowByContractPoint[] | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  if (!rows) return out;
  for (const row of rows) {
    if (row.underlying_price == null) continue;
    const ts = rowTimestamp(row);
    if (!ts) continue;
    const minute = normalizeToMinuteIso(ts);
    if (!minute || out.has(minute)) continue;
    const u = Number(row.underlying_price);
    if (Number.isFinite(u)) out.set(minute, u);
  }
  return out;
}

function rowKey(row: FlowByContractPoint): string | null {
  const ts = rowTimestamp(row);
  if (!ts) return null;
  const ck = contractKey(row);
  return `${ts}|${ck ?? ''}`;
}

export function contractKey(row: FlowByContractPoint): string {
  const type = row.option_type ?? '';
  const strike = row.strike ?? '';
  const exp = row.expiration ?? '';
  return `${type}|${strike}|${exp}`;
}

export interface BarInfo {
  /** ISO timestamp floored to the 5-minute bar boundary (09:30, 09:35, …). */
  timestamp: string;
  /** Contract rows that fall in this 5-minute bar. */
  rows: FlowByContractPoint[];
}

/**
 * Walks rows chronologically one 5-minute bar at a time. Each bar contains
 * only the rows that landed in it (no carry-forward — the new API exposes
 * per-bar deltas rather than cumulatives, so callers accumulate themselves).
 */
export function forEachBar(
  rows: FlowByContractPoint[],
  callback: (info: BarInfo) => void,
): void {
  const buckets = new Map<string, FlowByContractPoint[]>();
  for (const row of rows) {
    const ts = rowTimestamp(row);
    if (!ts) continue;
    const bar = normalizeToFiveMinuteIso(ts);
    if (!bar) continue;
    const bucket = buckets.get(bar) ?? [];
    bucket.push(row);
    buckets.set(bar, bucket);
  }

  const sortedTs = Array.from(buckets.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  for (const ts of sortedTs) {
    callback({ timestamp: ts, rows: buckets.get(ts)! });
  }
}

function createEntry(rows: FlowByContractPoint[]): CacheEntry {
  const byKey = new Map<string, number>();
  let lastMs: number | null = null;
  rows.forEach((row, idx) => {
    const key = rowKey(row);
    if (key) byKey.set(key, idx);
    const ts = rowTimestamp(row);
    if (ts) {
      const ms = new Date(ts).getTime();
      if (Number.isFinite(ms) && (lastMs === null || ms > lastMs)) lastMs = ms;
    }
  });
  return { rows, byKey, lastTimestampMs: lastMs, lastFullRefreshMs: Date.now() };
}

function mergeIncremental(entry: CacheEntry, incoming: FlowByContractPoint[]): CacheEntry {
  if (incoming.length === 0) return entry;

  const merged = entry.rows.slice();
  const byKey = new Map(entry.byKey);
  let lastMs = entry.lastTimestampMs;

  for (const row of incoming) {
    const key = rowKey(row);
    const ts = rowTimestamp(row);
    if (ts) {
      const ms = new Date(ts).getTime();
      if (Number.isFinite(ms) && (lastMs === null || ms > lastMs)) lastMs = ms;
    }
    if (!key) {
      merged.push(row);
      continue;
    }
    const existingIdx = byKey.get(key);
    if (existingIdx != null) {
      merged[existingIdx] = row;
    } else {
      byKey.set(key, merged.length);
      merged.push(row);
    }
  }

  return {
    rows: merged,
    byKey,
    lastTimestampMs: lastMs,
    lastFullRefreshMs: entry.lastFullRefreshMs,
  };
}

/**
 * True when the cached series has any missing 5-minute bar between its first
 * and last observed bars. Used to trigger a full-session refetch.
 */
function hasInternalBarGaps(rows: FlowByContractPoint[]): boolean {
  const bars = new Set<number>();
  for (const row of rows) {
    const ts = rowTimestamp(row);
    if (!ts) continue;
    const ms = new Date(ts).getTime();
    if (!Number.isFinite(ms)) continue;
    bars.add(Math.floor(ms / BAR_MS) * BAR_MS);
  }
  if (bars.size < 2) return false;
  const sorted = Array.from(bars).sort((a, b) => a - b);
  const expectedCount = Math.round((sorted[sorted.length - 1] - sorted[0]) / BAR_MS) + 1;
  return sorted.length < expectedCount;
}

async function fetchByContract(
  symbol: string,
  session: 'current' | 'prior',
  intervals?: number,
): Promise<FlowByContractPoint[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  const params = new URLSearchParams({ symbol, session });
  if (intervals != null) params.set('intervals', String(intervals));

  const resp = await fetch(`${baseUrl}/api/flow/by-contract?${params.toString()}`);
  if (!resp.ok) {
    if (resp.status === 404) throw new Error('No data available yet');
    throw new Error(`API error: ${resp.status}`);
  }
  const raw = await resp.json();
  if (!Array.isArray(raw)) return [];
  return raw.map((r) => normalizeRow(r as Record<string, unknown>));
}

export interface UseFlowByContractOptions {
  /** Incremental poll interval (intervals=1). Default 30s. */
  incrementalMs?: number;
  /** Full-session refetch interval. Default 5 minutes. */
  fullRefreshMs?: number;
  enabled?: boolean;
}

/**
 * Subscribes to a shared, module-level cache of /api/flow/by-contract rows
 * for (symbol, session). Drives two independent background timers:
 *   - intervals=1 every incrementalMs (default 30s) to pick up the latest bar
 *   - full session every fullRefreshMs (default 5min) so any drift is healed
 *
 * Consumers render directly from the cache — the timers run asynchronously
 * and don't block the UI. Switching pages or symbols does not discard the
 * cache, so subsequent visits render instantly.
 */
export function useFlowByContractCache(
  symbol: string,
  session: 'current' | 'prior',
  options: UseFlowByContractOptions = {},
) {
  const {
    incrementalMs = DEFAULT_INCREMENTAL_MS,
    fullRefreshMs = DEFAULT_FULL_REFRESH_MS,
    enabled = true,
  } = options;
  const cacheKey = `${symbol}:${session}`;

  // Hydrate from sessionStorage on first subscribe if memory cache is empty.
  if (!globalCache.has(cacheKey)) {
    const stored = readFromStorage(cacheKey);
    if (stored && stored.length > 0) {
      globalCache.set(cacheKey, createEntry(stored));
    }
  }
  const initialEntry = globalCache.get(cacheKey);

  const [rows, setRows] = useState<FlowByContractPoint[] | null>(
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
      if (globalCache.has(cacheKey)) {
        const entry = globalCache.get(cacheKey)!;
        if (!cancelled) {
          setRows(entry.rows);
          setLoading(false);
        }
        return;
      }

      let pending = inflightInitial.get(cacheKey);
      if (!pending) {
        pending = (async () => {
          try {
            const data = await fetchByContract(symbol, session);
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
        setError(e instanceof Error ? e.message : 'Failed to fetch flow data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const refetchFullSession = async (): Promise<boolean> => {
      try {
        const data = await fetchByContract(symbol, session);
        if (cancelled) return false;
        globalCache.set(cacheKey, createEntry(data));
        writeToStorage(cacheKey, data);
        setRows(data);
        setError(null);
        return true;
      } catch (e) {
        if (cancelled) return false;
        setError(e instanceof Error ? e.message : 'Failed to fetch flow data');
        return false;
      }
    };

    const runIncremental = async (): Promise<void> => {
      const entry = globalCache.get(cacheKey);
      if (!entry) {
        await refetchFullSession();
        return;
      }

      // Any gap beyond a single bar -> refetch full session so we backfill
      // the whole day, not just the tail.
      if (entry.lastTimestampMs != null) {
        const gapMs = Date.now() - entry.lastTimestampMs;
        if (gapMs > 2 * BAR_MS) {
          await refetchFullSession();
          return;
        }
      }

      try {
        const incoming = await fetchByContract(symbol, session, 1);
        if (cancelled) return;
        if (incoming.length === 0) return;

        const current = globalCache.get(cacheKey);
        if (!current) return;
        const next = mergeIncremental(current, incoming);

        if (hasInternalBarGaps(next.rows)) {
          await refetchFullSession();
          return;
        }

        globalCache.set(cacheKey, next);
        writeToStorage(cacheKey, next.rows);
        setRows(next.rows);
        setError(null);
      } catch {
        // Silent - keep showing cached data
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
  }, [cacheKey, symbol, session, enabled, incrementalMs, fullRefreshMs]);

  return { rows, loading, error };
}
