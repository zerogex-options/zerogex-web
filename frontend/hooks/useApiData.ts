/**
 * Custom hook for fetching data from ZeroGEX API
 * Handles loading, error states, and automatic refresh
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface OptionFlowRow {
  time_window_start: string;
  time_window_end: string;
  interval_timestamp?: string | null;
  symbol: string;
  option_type?: string | null;
  strike?: number | null;
  total_volume: number;
  total_premium: number;
  avg_iv?: number | null;
  net_delta?: number | null;
  sentiment?: string | null;
  unusual_activity_score?: number | null;
}

interface GEXSummaryRow {
  timestamp: string;
  symbol: string;
  spot_price: number;
  total_call_gex: number;
  total_put_gex: number;
  net_gex: number;
  gamma_flip?: number | null;
  max_pain?: number | null;
  call_wall?: number | null;
  put_wall?: number | null;
  put_call_ratio?: number | null;
}

interface GEXStrikeRow {
  timestamp: string;
  symbol: string;
  strike: number;
  expiration: string;
  call_oi: number;
  put_oi: number;
  call_volume: number;
  put_volume: number;
  call_gex: number;
  put_gex: number;
  net_gex: number;
  vanna_exposure?: number | null;
  charm_exposure?: number | null;
  spot_price: number;
  distance_from_spot: number;
}

interface MarketQuoteRow {
  timestamp: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
  up_volume?: number | null;
  down_volume?: number | null;
  session?: string | null;
}

interface UseApiDataOptions {
  refreshInterval?: number;
  enabled?: boolean;
  onError?: (error: string) => void;
}

export type SignalTimeframe = 'intraday' | 'swing' | 'multi_day';

interface SignalComponent {
  name: string;
  weight: number;
  score: number;
  description: string;
  value?: number | null;
  applicable?: boolean;
}

interface TradeIdea {
  trade_type: string;
  rationale: string;
  target_expiry: string;
  suggested_strikes: string;
  estimated_win_pct: number;
}

export interface TradeSignalResponse {
  symbol: string;
  timeframe: SignalTimeframe;
  timestamp: string;
  current_price: number;
  composite_score: number;
  max_possible_score: number;
  normalized_score: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: 'high' | 'medium' | 'low';
  estimated_win_pct: number;
  components: SignalComponent[];
  trade_idea: TradeIdea;
  net_gex?: number | null;
  gamma_flip?: number | null;
  price_vs_flip?: number | null;
  vwap?: number | null;
  vwap_deviation_pct?: number | null;
  put_call_ratio?: number | null;
  dealer_net_delta?: number | null;
  smart_money_direction?: 'bullish' | 'bearish' | 'neutral' | null;
  unusual_volume_detected?: boolean;
  orb_breakout_direction?: 'bullish' | 'bearish' | 'neutral' | null;
}

export interface SignalAccuracyPoint {
  strength: string;
  timeframe: SignalTimeframe;
  win_rate: number;
  total_signals: number;
  wins?: number;
  losses?: number;
}

function normalizeNumbers(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeNumbers);
  }

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeNumbers(v);
    }
    return out;
  }

  if (typeof value === 'string') {
    const maybeNumber = Number(value);
    if (Number.isFinite(maybeNumber) && value.trim() !== '') {
      return maybeNumber;
    }
  }

  return value;
}

export function useApiData<T>(endpoint: string, options: UseApiDataOptions = {}) {
  const { refreshInterval = 5000, enabled = true, onError } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset state synchronously when the endpoint changes so stale data from the
  // previous symbol is never displayed while the new request is in-flight.
  const prevEndpoint = useRef(endpoint);
  if (prevEndpoint.current !== endpoint) {
    prevEndpoint.current = endpoint;
    setData(null);
    setLoading(true);
    setError(null);
  }

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}${endpoint}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('No data available yet');
        }
        throw new Error(`API error: ${response.status}`);
      }

      const rawResult = await response.json();
      const result = normalizeNumbers(rawResult) as T;
      setData(result);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [endpoint, enabled, onError]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    fetchData();

    if (refreshInterval > 0) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, enabled]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}

export function useGEXSummary(symbol = 'SPY', refreshInterval = 5000) {
  return useApiData<GEXSummaryRow>(`/api/gex/summary?symbol=${symbol}`, { refreshInterval });
}

export function useGEXByStrike(
  symbol = 'SPY',
  limit = 50,
  refreshInterval = 10000,
  sortBy: 'distance' | 'impact' = 'distance'
) {
  return useApiData<GEXStrikeRow[]>(`/api/gex/by-strike?symbol=${symbol}&limit=${limit}&sort_by=${sortBy}`, { refreshInterval });
}

export function useMarketQuote(symbol = 'SPY', refreshInterval = 1000) {
  return useApiData<MarketQuoteRow>(`/api/market/quote?symbol=${symbol}`, { refreshInterval });
}

export interface FlowByTypePoint {
  timestamp: string;
  symbol: string;
  call_volume: number;
  call_premium: number;
  put_volume: number;
  put_premium: number;
  net_volume: number;
  net_premium: number;
  underlying_price?: number | null;
}

export function useOptionFlow(symbol = 'SPY', session: 'current' | 'prior' = 'current', refreshInterval = 5000) {
  return useApiData<FlowByTypePoint[]>(`/api/flow/by-type?symbol=${symbol}&session=${session}`, { refreshInterval });
}

export function useSmartMoneyFlow(symbol = 'SPY', limit = 10, session: 'current' | 'prior' = 'current', refreshInterval = 10000) {
  return useApiData<OptionFlowRow[]>(`/api/flow/smart-money?symbol=${symbol}&session=${session}&limit=${limit}`, { refreshInterval });
}

export interface SessionClosesData {
  symbol: string;
  /** Most recent completed regular-session close (4 PM ET). During market hours this is yesterday's close; during AH/PM it is today's close. */
  current_session_close: number;
  current_session_close_ts: string;
  /** The regular-session close that precedes current_session_close (used for the row-1 change calculation). */
  prior_session_close: number;
  prior_session_close_ts: string;
}

export function useSessionCloses(symbol = 'SPY', refreshInterval = 60000) {
  return useApiData<SessionClosesData>(
    `/api/market/session-closes?symbol=${symbol}`,
    { refreshInterval }
  );
}

export function useTradeSignal(symbol = 'SPY', timeframe: SignalTimeframe = 'intraday', refreshInterval = 15000) {
  return useApiData<TradeSignalResponse>(`/api/signals/trade?symbol=${symbol}&timeframe=${timeframe}`, { refreshInterval });
}

export function useSignalAccuracy(symbol = 'SPY', lookbackDays = 30, refreshInterval = 60000) {
  return useApiData<SignalAccuracyPoint[] | Record<string, unknown>>(
    `/api/signals/accuracy?symbol=${symbol}&lookback_days=${lookbackDays}`,
    { refreshInterval }
  );
}

export interface VolatilityGaugeData {
  timestamp: string;
  vix: number;
  level: number;
  level_label: string;
  momentum: number;
  momentum_label: string;
  cache_bars: number;
  latest_bars?: Array<{ timestamp: string; close: number }>;
}

export function useVolatilityGauge(refreshInterval = 30000) {
  return useApiData<VolatilityGaugeData>('/api/volatility/gauge', { refreshInterval });
}
