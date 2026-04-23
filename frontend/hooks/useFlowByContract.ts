import { useEffect, useRef, useState } from 'react';

export interface FlowByContractPoint {
  timestamp?: string;
  time_window_start?: string;
  time_window_end?: string;
  interval_timestamp?: string | null;
  symbol?: string;
  option_type?: 'C' | 'P' | string;
  strike?: number | string;
  expiration?: string;
  cumulative_call_premium?: number | string;
  cumulative_put_premium?: number | string;
  cumulative_net_premium?: number | string;
  cumulative_net_volume?: number | string;
  cumulative_net_directional_volume?: number | string;
  cumulative_call_volume?: number | string;
  cumulative_put_volume?: number | string;
  cumulative_volume?: number | string;
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
}

const BAR_MS = 5 * 60_000;
const DEFAULT_REFRESH_MS = 30_000;

const globalCache = new Map<string, CacheEntry>();
const inflightInitial = new Map<string, Promise<void>>();

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

function getETDateKey(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Returns the ISO timestamp of the most recent row, or null. */
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

/** Returns the ET date key (YYYY-MM-DD) of the most recent row, or null. */
export function latestRowDateKey(rows: FlowByContractPoint[] | null | undefined): string | null {
  const ts = latestRowTimestamp(rows);
  if (!ts) return null;
  const key = getETDateKey(ts);
  return key || null;
}

/**
 * Produces a session-cumulative snapshot across every contract that traded in
 * the selected session. For each contract its latest observed cumulative row
 * is used (so contracts that stopped reporting partway through the session
 * still contribute their final totals).
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

  const latestByContract = new Map<string, FlowByContractPoint>();
  let latestTs: string | null = null;
  let latestMs = -Infinity;
  let latestUnderlying: number | null = null;
  let latestUnderlyingMs = -Infinity;

  for (const row of scoped) {
    const ts = rowTimestamp(row);
    if (!ts) continue;
    const ms = new Date(ts).getTime();
    if (!Number.isFinite(ms)) continue;

    const key = contractKey(row);
    const existing = latestByContract.get(key);
    if (!existing) {
      latestByContract.set(key, row);
    } else {
      const existingMs = new Date(rowTimestamp(existing)!).getTime();
      if (ms > existingMs) latestByContract.set(key, row);
    }

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

  let callVolume = 0;
  let putVolume = 0;
  let callPremium = 0;
  let putPremium = 0;
  let netFlow = 0;
  let netPremium = 0;

  for (const row of latestByContract.values()) {
    const isCall = row.option_type === 'C';
    const isPut = row.option_type === 'P';
    const rowCallVol =
      row.cumulative_call_volume != null
        ? Number(row.cumulative_call_volume)
        : isCall
          ? Number(row.cumulative_volume ?? 0)
          : 0;
    const rowPutVol =
      row.cumulative_put_volume != null
        ? Number(row.cumulative_put_volume)
        : isPut
          ? Number(row.cumulative_volume ?? 0)
          : 0;
    if (Number.isFinite(rowCallVol)) callVolume += rowCallVol;
    if (Number.isFinite(rowPutVol)) putVolume += rowPutVol;
    callPremium += Number(row.cumulative_call_premium ?? 0);
    putPremium += Number(row.cumulative_put_premium ?? 0);
    netFlow += Number(row.cumulative_net_volume ?? 0);
    netPremium += Number(row.cumulative_net_premium ?? 0);
  }

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
 * Returns a Map keyed by minute-floored ISO timestamp -> underlying_price.
 * When multiple contracts report a price for the same interval, the first
 * finite value wins (all contracts carry the same underlying per interval).
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

/** Stable identity for a contract regardless of timestamp. */
export function contractKey(row: FlowByContractPoint): string {
  const type = row.option_type ?? '';
  const strike = row.strike ?? '';
  const exp = row.expiration ?? '';
  return `${type}|${strike}|${exp}`;
}

export interface BarInfo {
  /** Minute-floored ISO timestamp of this bar. */
  timestamp: string;
  /** Contract rows observed in THIS bar only. */
  currentBarRows: FlowByContractPoint[];
  /** Carry-forward map: for each contract, the latest row at or before this bar. */
  carriedMap: Map<string, FlowByContractPoint>;
}

/**
 * Walks rows chronologically in bar order, maintaining a per-contract
 * carry-forward map. Lets callers compute session-cumulative aggregates that
 * include contracts which stopped reporting in earlier bars.
 */
export function forEachBarWithCarry(
  rows: FlowByContractPoint[],
  callback: (info: BarInfo) => void,
): void {
  const buckets = new Map<string, FlowByContractPoint[]>();
  for (const row of rows) {
    const ts = rowTimestamp(row);
    if (!ts) continue;
    const minute = normalizeToMinuteIso(ts);
    if (!minute) continue;
    const bucket = buckets.get(minute) ?? [];
    bucket.push(row);
    buckets.set(minute, bucket);
  }

  const sortedTs = Array.from(buckets.keys()).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );
  const carriedMap = new Map<string, FlowByContractPoint>();

  for (const ts of sortedTs) {
    const currentBarRows = buckets.get(ts)!;
    for (const row of currentBarRows) {
      carriedMap.set(contractKey(row), row);
    }
    callback({ timestamp: ts, currentBarRows, carriedMap });
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
  return { rows, byKey, lastTimestampMs: lastMs };
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

  return { rows: merged, byKey, lastTimestampMs: lastMs };
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
  refreshIntervalMs?: number;
  enabled?: boolean;
}

export function useFlowByContractCache(
  symbol: string,
  session: 'current' | 'prior',
  options: UseFlowByContractOptions = {},
) {
  const { refreshIntervalMs = DEFAULT_REFRESH_MS, enabled = true } = options;
  const cacheKey = `${symbol}:${session}`;
  const initialEntry = globalCache.get(cacheKey);

  const [rows, setRows] = useState<FlowByContractPoint[] | null>(
    initialEntry ? initialEntry.rows : null,
  );
  const [loading, setLoading] = useState<boolean>(!initialEntry && enabled);
  const [error, setError] = useState<string | null>(null);

  const cacheKeyRef = useRef(cacheKey);
  if (cacheKeyRef.current !== cacheKey) {
    cacheKeyRef.current = cacheKey;
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

        // If the merge reveals missing bars inside the session, backfill by
        // fetching the whole thing.
        if (hasInternalBarGaps(next.rows)) {
          await refetchFullSession();
          return;
        }

        globalCache.set(cacheKey, next);
        setRows(next.rows);
        setError(null);
      } catch {
        // Silent - keep showing cached data
      }
    };

    runInitial();

    if (refreshIntervalMs <= 0) return () => { cancelled = true; };
    const timer = setInterval(runIncremental, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [cacheKey, symbol, session, enabled, refreshIntervalMs]);

  return { rows, loading, error };
}
