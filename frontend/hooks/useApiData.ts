/**
 * Custom hook for fetching data from ZeroGEX API
 * Handles loading, error states, and automatic refresh
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

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
}

interface GEXStrikeRow {
  timestamp: string;
  symbol: string;
  strike: number;
  call_oi: number;
  put_oi: number;
  call_volume: number;
  put_volume: number;
  call_gex: number;
  put_gex: number;
  net_gex: number;
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
}

interface UseApiDataOptions {
  refreshInterval?: number;
  enabled?: boolean;
  onError?: (error: string) => void;
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

export function useGEXByStrike(symbol = 'SPY', limit = 50, refreshInterval = 10000) {
  return useApiData<GEXStrikeRow[]>(`/api/gex/by-strike?symbol=${symbol}&limit=${limit}`, { refreshInterval });
}

export function useMarketQuote(symbol = 'SPY', refreshInterval = 1000) {
  return useApiData<MarketQuoteRow>(`/api/market/quote?symbol=${symbol}`, { refreshInterval });
}

export function useOptionFlow(symbol = 'SPY', timeframe = '1min', windowUnits = 60, refreshInterval = 5000) {
  return useApiData<OptionFlowRow[]>(`/api/flow/by-type?symbol=${symbol}&timeframe=${timeframe}&window_units=${windowUnits}`, { refreshInterval });
}

export function useSmartMoneyFlow(symbol = 'SPY', limit = 10, timeframe = '1min', windowUnits = 60, refreshInterval = 10000) {
  return useApiData<OptionFlowRow[]>(`/api/flow/smart-money?symbol=${symbol}&timeframe=${timeframe}&window_units=${windowUnits}&limit=${limit}`, { refreshInterval });
}

export function usePreviousClose(symbol = 'SPY', refreshInterval = 60000) {
  return useApiData<{ symbol: string; previous_close: number; timestamp: string }>(
    `/api/market/previous-close?symbol=${symbol}`,
    { refreshInterval }
  );
}
