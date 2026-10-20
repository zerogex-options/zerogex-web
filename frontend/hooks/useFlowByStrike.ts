'use client';

/**
 * Contracts bought and sold at each strike, per 5-minute bar, for the Flow
 * Analysis chart's strike ribbon (core/flowStrikes). Reads /api/flow/by-strike.
 *
 * A full read when the ribbon is switched on and every five minutes, and a
 * two-bar tail every ten seconds while the session trades: the API slices that
 * tail from its own cached full session, so polling it costs the database
 * nothing extra. A finished session is read once.
 *
 * Kept in memory only. Nothing goes to session storage, so the first render on
 * a reload is the server's (no rows) and hydrates cleanly.
 */

import { useEffect, useState } from 'react';
import { mergeStrikeRows, type FlowStrikeRow } from '@/core/flowStrikes';
import { flowSessionParams, isClosedFlowSession, type FlowSession } from '@/core/flowSessions';
import { etTodayDateKey } from '@/core/utils';

const TAIL_MS = 10_000;
const FULL_MS = 5 * 60_000;
const TAIL_BARS = 2;
const FETCH_TIMEOUT_MS = 10_000;

export interface FlowByStrikeFilters {
  strikes?: readonly string[];
  expirations?: readonly string[];
}

interface Entry {
  rows: FlowStrikeRow[];
  fetchedAt: number;
}

const cache = new Map<string, Entry>();

function keyFor(symbol: string, session: FlowSession, strikes: string, expirations: string): string {
  return `${symbol.toUpperCase()}|${session}|${strikes}|${expirations}`;
}

async function fetchRows(
  symbol: string,
  session: FlowSession,
  strikes: string,
  expirations: string,
  intervals: number | null,
  signal: AbortSignal,
): Promise<FlowStrikeRow[]> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  const params = new URLSearchParams({ symbol, underlying: symbol, ...flowSessionParams(session) });
  if (strikes) params.set('strikes', strikes);
  if (expirations) params.set('expirations', expirations);
  if (intervals != null) params.set('intervals', String(intervals));
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => timeout.abort();
  signal.addEventListener('abort', onAbort);
  try {
    const resp = await fetch(`${baseUrl}/api/flow/by-strike?${params.toString()}`, { signal: timeout.signal });
    // No such symbol, or an API that predates the endpoint: no ribbon.
    if (resp.status === 404) return [];
    if (!resp.ok) throw new Error(`API error: ${resp.status}`);
    const raw = await resp.json();
    return Array.isArray(raw) ? (raw as FlowStrikeRow[]) : [];
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onAbort);
  }
}

export function useFlowByStrike(
  symbol: string,
  session: FlowSession,
  { filters, enabled = true }: { filters?: FlowByStrikeFilters; enabled?: boolean } = {},
): { rows: FlowStrikeRow[] | null; loading: boolean } {
  const strikes = (filters?.strikes ?? []).slice().sort().join(',');
  const expirations = (filters?.expirations ?? []).slice().sort().join(',');
  const key = keyFor(symbol, session, strikes, expirations);

  const [state, setState] = useState<{ key: string; enabled: boolean; rows: FlowStrikeRow[] | null }>(() => ({
    key,
    enabled,
    rows: enabled ? (cache.get(key)?.rows ?? null) : null,
  }));
  // A new symbol, session or filter set, or the ribbon switched back on,
  // starts from its own cache entry rather than painting the previous one's
  // strikes. Adjusted during render so the stale strikes never paint.
  if (state.key !== key || state.enabled !== enabled) {
    setState({ key, enabled, rows: enabled ? (cache.get(key)?.rows ?? null) : null });
  }

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let cancelled = false;
    const closed = isClosedFlowSession(session, etTodayDateKey());

    const publish = (rows: FlowStrikeRow[]) => {
      cache.set(key, { rows, fetchedAt: Date.now() });
      if (!cancelled) setState({ key, enabled: true, rows });
    };

    const full = async () => {
      try {
        publish(await fetchRows(symbol, session, strikes, expirations, null, controller.signal));
      } catch {
        // Keep whatever is drawn; the next read tries again.
      }
    };
    const tail = async () => {
      const entry = cache.get(key);
      if (!entry) {
        await full();
        return;
      }
      try {
        const rows = await fetchRows(symbol, session, strikes, expirations, TAIL_BARS, controller.signal);
        publish(mergeStrikeRows(cache.get(key)?.rows ?? entry.rows, rows));
      } catch {
        // As above.
      }
    };

    const entry = cache.get(key);
    if (!entry || Date.now() - entry.fetchedAt > FULL_MS) void full();

    const timers: ReturnType<typeof setInterval>[] = [];
    if (!closed) {
      timers.push(setInterval(() => void tail(), TAIL_MS));
      timers.push(setInterval(() => void full(), FULL_MS));
    }
    return () => {
      cancelled = true;
      controller.abort();
      timers.forEach(clearInterval);
    };
  }, [enabled, key, symbol, session, strikes, expirations]);

  const rows = enabled && state.key === key && state.enabled ? state.rows : null;
  return { rows, loading: enabled && rows == null };
}
