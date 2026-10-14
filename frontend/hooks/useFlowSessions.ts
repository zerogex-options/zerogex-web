import { useMemo } from 'react';

import { FLOW_SESSION_PICKER_DAYS } from '@/core/flowSessions';
import { useApiData } from './useApiData';

interface FlowSessionList {
  symbol: string;
  count: number;
  sessions: Array<{ date: string }>;
}

/**
 * The recent trading days that have flow for `symbol`, newest first, from
 * /api/flow/sessions — the days the Session pickers offer. Null until the
 * list loads, and stays null when the API does not serve it, which leaves
 * the pickers on Current / Prior (see flowSessionOptions).
 *
 * Refreshed every 5 minutes: the list changes once a day, when a new session
 * opens.
 */
export function useFlowSessions(symbol: string): string[] | null {
  const { data } = useApiData<FlowSessionList>(
    `/api/flow/sessions?symbol=${encodeURIComponent(symbol)}&limit=${FLOW_SESSION_PICKER_DAYS}`,
    { refreshInterval: 5 * 60_000 },
  );
  return useMemo(
    () => (Array.isArray(data?.sessions) ? data.sessions.map((s) => s.date) : null),
    [data],
  );
}
