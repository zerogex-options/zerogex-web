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

interface CacheEntry {
  rows: FlowByContractPoint[];
  byKey: Map<string, number>;
  lastTimestampMs: number | null;
}

const BAR_MS = 5 * 60_000;
const DEFAULT_REFRESH_MS = 30_000;
const MAX_INTERVALS = 120;

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
    if (k === 'symbol' || k === 'option_type' || k === 'expiration' ||
        k === 'timestamp' || k === 'time_window_start' || k === 'time_window_end' ||
        k === 'interval_timestamp') {
      out[k] = v;
    } else {
      out[k] = coerceNumber(v);
    }
  }
  return out as FlowByContractPoint;
}

function rowTimestamp(row: FlowByContractPoint): string | null {
  return (
    row.timestamp ||
    row.time_window_end ||
    row.interval_timestamp ||
    row.time_window_start ||
    null
  );
}

function rowKey(row: FlowByContractPoint): string | null {
  const ts = rowTimestamp(row);
  if (!ts) return null;
  const type = row.option_type ?? '';
  const strike = row.strike ?? '';
  const exp = row.expiration ?? '';
  return `${ts}|${type}|${strike}|${exp}`;
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

    const runIncremental = async (): Promise<void> => {
      const entry = globalCache.get(cacheKey);
      if (!entry) return;

      let intervalsNeeded = 1;
      if (entry.lastTimestampMs != null) {
        const gapBars = Math.floor((Date.now() - entry.lastTimestampMs) / BAR_MS);
        if (gapBars > 1) intervalsNeeded = Math.min(gapBars + 1, MAX_INTERVALS);
      }

      try {
        const incoming = await fetchByContract(symbol, session, intervalsNeeded);
        if (cancelled) return;
        if (incoming.length === 0) return;

        const current = globalCache.get(cacheKey);
        if (!current) return;
        const next = mergeIncremental(current, incoming);
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
