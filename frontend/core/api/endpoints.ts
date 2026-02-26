/**
 * API Endpoints for ZeroGEX Backend
 */

import { apiClient } from './clients';
import type {
  GEXSummary,
  GEXByStrike,
  OptionFlow,
  UnderlyingQuote,
  HealthStatus,
} from '@/core/types';

/**
 * GEX (Gamma Exposure) Endpoints
 */
export const gexAPI = {
  /**
   * Get latest GEX summary
   */
  getSummary: async (): Promise<GEXSummary> => {
    return apiClient.get<GEXSummary>('/api/gex/summary');
  },

  /**
   * Get GEX by strike for a specific symbol
   */
  getByStrike: async (symbol: string = 'SPY'): Promise<GEXByStrike[]> => {
    return apiClient.get<GEXByStrike[]>(`/api/gex/by-strike?symbol=${symbol}`);
  },

  /**
   * Get historical GEX data
   */
  getHistorical: async (
    symbol: string = 'SPY',
    startDate?: string,
    endDate?: string
  ): Promise<GEXSummary[]> => {
    const params = new URLSearchParams({ symbol });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    return apiClient.get<GEXSummary[]>(`/api/gex/historical?${params}`);
  },
};

/**
 * Options Flow Endpoints
 */
export const flowAPI = {
  /**
   * Get latest option flow by type (calls vs puts)
   */
  getByType: async (): Promise<OptionFlow[]> => {
    return apiClient.get<OptionFlow[]>('/api/flow/by-type');
  },

  /**
   * Get option flow by strike
   */
  getByStrike: async (symbol: string = 'SPY'): Promise<OptionFlow[]> => {
    return apiClient.get<OptionFlow[]>(`/api/flow/by-strike?symbol=${symbol}`);
  },

  /**
   * Get smart money flow (unusual activity)
   */
  getSmartMoney: async (): Promise<OptionFlow[]> => {
    return apiClient.get<OptionFlow[]>('/api/flow/smart-money');
  },
};

/**
 * Market Data Endpoints
 */
export const marketAPI = {
  /**
   * Get latest underlying quote
   */
  getQuote: async (symbol: string = 'SPY'): Promise<UnderlyingQuote> => {
    return apiClient.get<UnderlyingQuote>(`/api/market/quote?symbol=${symbol}`);
  },

  /**
   * Get historical quotes
   */
  getHistoricalQuotes: async (
    symbol: string = 'SPY',
    startDate?: string,
    endDate?: string
  ): Promise<UnderlyingQuote[]> => {
    const params = new URLSearchParams({ symbol });
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    return apiClient.get<UnderlyingQuote[]>(`/api/market/historical?${params}`);
  },
};

/**
 * System Health Endpoint
 */
export const healthAPI = {
  /**
   * Check backend health status
   */
  getStatus: async (): Promise<HealthStatus> => {
    return apiClient.get<HealthStatus>('/api/health');
  },
};
