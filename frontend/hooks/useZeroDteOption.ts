'use client';

/**
 * The rolling "0DTE" row for an ExpirationMultiSelect, derived from whichever
 * expiration selection the caller is sitting in.
 *
 * Every expiration dropdown on the site is fed a RECONCILED selection — concrete
 * dates, resolved against that chart's own option list — because that is what
 * the chart is actually plotting. But "is the rolling token the active pick?"
 * can only be answered from the RAW stored intent, which reconciliation has by
 * then thrown away. This hook reads that raw intent from the same store the
 * dropdown writes to, so the 0DTE row shows checked when it should and the
 * dated rows do not.
 *
 * It reads through useSharedExpirations, which means it inherits that hook's
 * scoping for free: on a page it sees the tab-wide selection, and inside a My
 * Dashboard pane it sees THAT pane's own selection. One hook, both contexts.
 *
 * Callers whose selection is owned elsewhere (a controlled chart, or the
 * dashboard pane toolbar that owns the pinned/inherited distinction) build the
 * prop themselves instead — see DashboardPane.
 */

import { useCallback, useMemo } from 'react';
import { useSharedExpirations } from '@/hooks/useSharedExpirations';
import { ROLLING_ZERO_DTE, selectionIsRollingZeroDte } from '@/core/expirationPersistence';

export interface ZeroDteOption {
  active: boolean;
  onSelect: () => void;
  availableToday: boolean;
}

/**
 * @param options    The expiration universe this control is offering, already
 *                   filtered to current/future dates (chartExpirationOptions).
 * @param todayKey   The ET date key (YYYY-MM-DD), from etTodayDateKey().
 */
export function useZeroDteOption(options: readonly string[], todayKey: string): ZeroDteOption {
  const { selection, setSelection } = useSharedExpirations();
  const active = selectionIsRollingZeroDte(selection);
  // `options` is current/future only, so a plain membership test is the honest
  // question: does this chain have a contract expiring today at all?
  const availableToday = options.includes(todayKey);
  const onSelect = useCallback(() => setSelection([ROLLING_ZERO_DTE]), [setSelection]);
  return useMemo(
    () => ({ active, onSelect, availableToday }),
    [active, onSelect, availableToday],
  );
}
