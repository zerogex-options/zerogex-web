'use client';

/**
 * The Gamma Chart's expiration filter, resolved once and shared.
 *
 * Two surfaces on /chart have to agree on exactly which expirations are in
 * play: the chart itself (whose flip/walls and rail come from the filtered
 * strike-profile timeseries) and the Playbook underneath it (which reads the
 * scenario off those same levels). If they resolved the filter separately they
 * could drift apart — a stale pick reconciled on one and not the other would
 * have the Playbook describing a different book than the lines above it, and it
 * would key a SECOND strike-profile-timeseries cache entry, doubling a fetch
 * that JOINs hundreds of thousands of rows.
 *
 * So the whole resolution lives here: the tab-shared selection
 * (useSharedExpirations) reconciled against the expirations this symbol can
 * actually serve, plus the `param` string the timeseries endpoint takes. Both
 * callers pass the same `param`, so they share one cache entry and one poll.
 */

import { useMemo } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useSharedExpirations } from '@/hooks/useSharedExpirations';
import { reconcileExpirations } from '@/core/expirationPersistence';
import { etTodayDateKey } from '@/core/utils';

export interface ChartExpirations {
  /** Future-dated expirations this symbol can serve, ascending. */
  available: string[];
  /** The active selection, reconciled to `available`. Empty = all expirations. */
  selection: string[];
  /** Update the tab-shared selection. */
  setSelection: (next: readonly string[]) => void;
  /** `expirations` param for /api/gex/strike-profile-timeseries: 'all' or a sorted, comma-joined set. */
  param: string;
  /** True when a strict subset of the chain is selected. */
  filtered: boolean;
}

export function useChartExpirations(symbol: string, enabled: boolean): ChartExpirations {
  const { selection, setSelection } = useSharedExpirations();

  const { data } = useApiData<string[] | null>(
    `/api/gex/expirations?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}&lookback_hours=168`,
    { refreshInterval: enabled ? 60000 : 0, enabled },
  );

  // Hoisted out of the memo below: the reconcile needs the same ET date key to
  // resolve a rolling 0DTE pick to a concrete expiration.
  const todayKey = etTodayDateKey();

  const available = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    return Array.from(
      new Set(list.filter((e): e is string => typeof e === 'string' && e >= todayKey)),
    ).sort();
  }, [data, todayKey]);

  // Reconcile the shared selection to what this symbol can actually show, so a
  // pick made on another chart (with a different expiry universe) never leaks a
  // missing expiration into the param, an expired pick collapses to "All", and
  // a rolling 0DTE pick becomes today's actual expiration.
  const effective = useMemo(
    () => reconcileExpirations(selection, available, todayKey),
    [selection, available, todayKey],
  );

  const param = effective.length === 0 ? 'all' : [...effective].sort().join(',');

  return {
    available,
    selection: effective,
    setSelection,
    param,
    filtered: effective.length > 0,
  };
}
