'use client';

/**
 * Feeds for the Gamma Shift page's three panels.
 *
 * Each is a thin `useApiData` wrapper over one server-computed endpoint. The
 * scoring, the classification and the normalization all happen in the API
 * (`src/analytics/regime_shift.py`) rather than here, for a reason worth
 * stating: the same code has to produce the stored per-session reads the
 * history strip renders. Two implementations of "what did dealer gamma do
 * today" would drift, and the strip would slowly stop agreeing with the
 * headline directly above it.
 *
 * Cadence: the analytics engine writes on a ~60s cycle with a ~5s server-side
 * cache, so polling faster than that only adds load. `useApiData` halves the
 * nominal interval (REFRESH_ACCELERATION_FACTOR), hence the doubled values.
 */

import { useMemo } from 'react';
import { useApiData } from './useApiData';
import type {
  ExpiryRolloffPayload,
  Lens,
  Lookback,
  RegimeHistoryPayload,
  RegimeShiftPayload,
} from '@/core/regimeShift';

// 20_000 -> ~10s effective. The card's numbers only change on the analytics
// cycle; a faster poll would re-render identical data.
const SHIFT_REFRESH_MS = 20_000;
// The expiring tranche changes only as OI is re-published; slower is fine.
const ROLLOFF_REFRESH_MS = 60_000;
// History gains at most one row per day, and today's row is rewritten by the
// refresh job on its own schedule. 600_000 -> ~5min effective.
const HISTORY_REFRESH_MS = 600_000;

export interface RegimeShiftOptions {
  /** Expiration scope, site-wide convention: empty (or omitted) = all. */
  expirations?: readonly string[];
  /** Total change vs the open-interest-driven component. */
  lens?: Lens;
  enabled?: boolean;
}

function expirationsParam(selection: readonly string[] | undefined): string {
  if (!selection || selection.length === 0) return 'all';
  return [...selection].sort().join(',');
}

export function useRegimeShift(
  symbol: string,
  lookback: Lookback,
  options: RegimeShiftOptions = {},
) {
  const { expirations, lens = 'net', enabled = true } = options;
  const url = useMemo(() => {
    const s = encodeURIComponent(symbol);
    const exp = encodeURIComponent(expirationsParam(expirations));
    return (
      `/api/gex/regime-shift?symbol=${s}&lookback=${encodeURIComponent(lookback)}` +
      `&expirations=${exp}&lens=${encodeURIComponent(lens)}`
    );
  }, [symbol, lookback, expirations, lens]);

  return useApiData<RegimeShiftPayload>(url, {
    refreshInterval: SHIFT_REFRESH_MS,
    enabled: enabled && !!symbol,
  });
}

export function useExpiryRolloff(symbol: string, enabled = true) {
  const url = useMemo(
    () => `/api/gex/expiry-rolloff?symbol=${encodeURIComponent(symbol)}`,
    [symbol],
  );
  return useApiData<ExpiryRolloffPayload>(url, {
    refreshInterval: ROLLOFF_REFRESH_MS,
    enabled: enabled && !!symbol,
  });
}

export function useRegimeHistory(symbol: string, limit = 30, enabled = true) {
  const url = useMemo(
    () => `/api/gex/regime-history?symbol=${encodeURIComponent(symbol)}&limit=${limit}`,
    [symbol, limit],
  );
  return useApiData<RegimeHistoryPayload>(url, {
    refreshInterval: HISTORY_REFRESH_MS,
    enabled: enabled && !!symbol,
  });
}
