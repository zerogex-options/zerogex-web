/**
 * Custom hook for fetching data from ZeroGEX API
 * Handles loading, error states, and automatic refresh
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

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
  return useApiData<any>(`/api/gex/summary?symbol=${symbol}`, { refreshInterval });
}

export function useGEXByStrike(symbol = 'SPY', limit = 50, refreshInterval = 10000) {
  return useApiData<any[]>(`/api/gex/by-strike?symbol=${symbol}&limit=${limit}`, { refreshInterval });
}

export function useMarketQuote(symbol = 'SPY', refreshInterval = 1000) {
  return useApiData<any>(`/api/market/quote?symbol=${symbol}`, { refreshInterval });
}

export function useOptionFlow(symbol = 'SPY', windowMinutes = 60, refreshInterval = 5000) {
  return useApiData<any[]>(`/api/flow/by-type?symbol=${symbol}&window_minutes=${windowMinutes}`, { refreshInterval });
}

export function useSmartMoneyFlow(symbol = 'SPY', limit = 10, windowMinutes = 60, refreshInterval = 10000) {
  return useApiData<any[]>(`/api/flow/smart-money?symbol=${symbol}&window_minutes=${windowMinutes}&limit=${limit}`, { refreshInterval });
}

export function usePreviousClose(symbol = 'SPY', refreshInterval = 60000) {
  return useApiData<{ symbol: string; previous_close: number; timestamp: string }>(
    `/api/market/previous-close?symbol=${symbol}`,
    { refreshInterval }
  );
}
