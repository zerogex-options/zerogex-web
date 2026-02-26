/**
 * Custom hook for fetching data from ZeroGEX API
 * Handles loading, error states, and automatic refresh
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

interface UseApiDataOptions {
  refreshInterval?: number; // milliseconds
  enabled?: boolean; // enable/disable fetching
  onError?: (error: string) => void;
}

export function useApiData<T>(
  endpoint: string,
  options: UseApiDataOptions = {}
) {
  const { 
    refreshInterval = 5000, 
    enabled = true,
    onError 
  } = options;
  
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
      
      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      if (onError) onError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [endpoint, enabled, onError]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchData();

    // Set up polling if refresh interval provided
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

// Specialized hooks for common endpoints
export function useGEXSummary(refreshInterval = 5000) {
  return useApiData<any>('/api/gex/summary', { refreshInterval });
}

export function useGEXByStrike(limit = 50, refreshInterval = 10000) {
  return useApiData<any[]>(`/api/gex/by-strike?limit=${limit}`, { refreshInterval });
}

export function useMarketQuote(refreshInterval = 1000) {
  return useApiData<any>('/api/market/quote', { refreshInterval });
}

export function useOptionFlow(windowMinutes = 60, refreshInterval = 5000) {
  return useApiData<any[]>(`/api/flow/by-type?window_minutes=${windowMinutes}`, { refreshInterval });
}

export function useSmartMoneyFlow(limit = 10, refreshInterval = 10000) {
  return useApiData<any[]>(`/api/flow/smart-money?limit=${limit}`, { refreshInterval });
}
