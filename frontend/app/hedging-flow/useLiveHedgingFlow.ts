'use client';

import { useEffect, useMemo, useState } from 'react';

import type { FlowTimeframe } from '@/core/flowSeriesCharts';
import { sessionHasClosed } from '@/core/sessionClosed';
import { etTodayDateKey } from '@/core/utils';
import { useHedgingFlow } from '@/hooks/useHedgingFlow';
import { useGammaRegimeSeries } from '@/hooks/useGammaRegimeSeries';
import { useGammaWeather } from '@/hooks/useGammaWeather';

import type { HedgingFlowPanelsProps } from './HedgingFlowPanels';

/**
 * The LIVE Hedging Flow session: every poll the panels need, the 0DTE toggle
 * and the 5 min / 1 min choice. `/hedging-flow` and the Fuseline Radar both
 * draw HedgingFlowPanels from this, so the section under the radar is the
 * page itself, never a copy that drifts from it.
 *
 * The 0DTE toggle is the expirations filter carrying today's date, which is
 * also why it can honestly report "no 0DTE today": when today is not an expiry
 * the filter resolves to nothing rather than silently substituting Friday.
 *
 * The 5 min / 1 min buttons switch the flow chart and its cards only. The
 * 5-minute series is fetched either way, because Gamma Weather is built on
 * 5-minute bars; the 1-minute one is a second request, made only while it is
 * on screen.
 *
 * `sessionClosed` turns true at the 16:00 ET close (and stays true overnight,
 * on weekends and on holidays, when the newest read is an earlier session's),
 * so Gamma Weather can say its read is the session's final one instead of
 * presenting it as current.
 *
 * `enabled: false` holds every read, for a surface that can hide the section.
 * `symbol` must already be an option-chain symbol (optionChainSymbolFor): the
 * API refuses /api/flow/hedging for a future.
 */
export function useLiveHedgingFlow(symbol: string, { enabled = true }: { enabled?: boolean } = {}) {
  const [zeroDteOnly, setZeroDteOnly] = useState(false);
  const [timeframe, setTimeframe] = useState<FlowTimeframe>('5min');

  const sessionDateKey = etTodayDateKey();
  const expirations = useMemo(
    () => (zeroDteOnly ? [sessionDateKey] : undefined),
    [zeroDteOnly, sessionDateKey],
  );

  const { data, loading, error, refetch } = useHedgingFlow(symbol, { expirations, enabled });
  const minute = useHedgingFlow(symbol, {
    expirations,
    timeframe: '1min',
    enabled: enabled && timeframe === '1min',
  });
  // Deliberately unfiltered by expiration: dealer gamma structure is a
  // property of the whole book, and scoping it to 0DTE would answer a
  // different question than the flow panel above it appears to be asking.
  const { data: regime, loading: regimeLoading } = useGammaRegimeSeries(symbol, { enabled });
  // Unfiltered by the 0DTE toggle, same as the structure series.
  const { data: weather, notReady: weatherNotReady } = useGammaWeather(symbol, { enabled });

  // A slow clock is enough: it only has to notice the close.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const sessionClosed = sessionHasClosed(weather?.session ?? data?.session, now);

  const panelProps: HedgingFlowPanelsProps = {
    symbol,
    sessionDateKey,
    data,
    regime,
    weather,
    weatherNotReady,
    zeroDteOnly,
    loading,
    regimeLoading,
    error,
    onRetry: refetch,
    chartData: timeframe === '1min' ? minute.data : null,
    chartError: timeframe === '1min' && !minute.data ? minute.error : null,
    timeframe,
    onTimeframeChange: setTimeframe,
    sessionClosed,
  };

  return { zeroDteOnly, setZeroDteOnly, panelProps };
}
