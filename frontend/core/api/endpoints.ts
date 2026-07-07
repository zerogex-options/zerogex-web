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
import type {
  BacktestMeta,
  BacktestRun,
  BacktestRunCreated,
  BacktestRunSummary,
  BacktestSpec,
  BacktestTradesPage,
  BacktestEquityPoint,
  BacktestConfig,
  BacktestConfigSummary,
  BacktestSharedConfig,
  BacktestSweep,
  BacktestSweepAxis,
  BacktestSweepCreated,
  InsightsSource,
  PatternInsight,
} from '@/app/backtesting/types';

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
};

/**
 * Options Flow Endpoints
 */
export const flowAPI = {
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
   * Get the two most recently completed regular session closes (4:00 PM ET bars).
   */
  getSessionCloses: async (symbol: string = 'SPY'): Promise<{
    symbol: string;
    current_session_close: number;
    current_session_close_ts: string;
    prior_session_close: number;
    prior_session_close_ts: string;
  }> => {
    return apiClient.get(`/api/market/session-closes?symbol=${symbol}`);
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
 * Backtesting Endpoints (/api/backtest/*)
 */
export const backtestAPI = {
  /**
   * Get backtest metadata: available underlyings, patterns, data window,
   * and default fill/sizing parameters.
   */
  getMeta: async (): Promise<BacktestMeta> => {
    return apiClient.get<BacktestMeta>('/api/backtest/meta');
  },

  /**
   * Queue a new backtest run. Returns the run id and "queued" status (202).
   */
  createRun: async (spec: BacktestSpec): Promise<BacktestRunCreated> => {
    return apiClient.post<BacktestRunCreated>('/api/backtest/runs', spec);
  },

  /**
   * List recent run summaries.
   */
  listRuns: async (): Promise<BacktestRunSummary[]> => {
    return apiClient.get<BacktestRunSummary[]>('/api/backtest/runs');
  },

  /**
   * Fetch a single run's full status / summary (used while polling).
   */
  getRun: async (runId: number): Promise<BacktestRun> => {
    return apiClient.get<BacktestRun>(`/api/backtest/runs/${runId}`);
  },

  /**
   * Fetch a paginated page of a run's trade blotter.
   */
  getTrades: async (
    runId: number,
    limit: number,
    offset: number,
  ): Promise<BacktestTradesPage> => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return apiClient.get<BacktestTradesPage>(`/api/backtest/runs/${runId}/trades?${params}`);
  },

  /**
   * Fetch a run's equity curve.
   */
  getEquity: async (runId: number): Promise<BacktestEquityPoint[]> => {
    return apiClient.get<BacktestEquityPoint[]>(`/api/backtest/runs/${runId}/equity`);
  },

  // ---- Saved & shareable configs (Phase 6) ------------------------------

  /** Save the current spec under a name; returns its summary + share token. */
  saveConfig: async (name: string, spec: BacktestSpec): Promise<BacktestConfigSummary> => {
    return apiClient.post<BacktestConfigSummary>('/api/backtest/configs', { name, spec });
  },

  /** List the caller's saved configs. */
  listConfigs: async (): Promise<BacktestConfigSummary[]> => {
    return apiClient.get<BacktestConfigSummary[]>('/api/backtest/configs');
  },

  /** Fetch one saved config (incl. spec), scoped to its owner. */
  getConfig: async (configId: number): Promise<BacktestConfig> => {
    return apiClient.get<BacktestConfig>(`/api/backtest/configs/${configId}`);
  },

  /** Delete a saved config (owner only). */
  deleteConfig: async (configId: number): Promise<{ deleted: boolean }> => {
    return apiClient.delete<{ deleted: boolean }>(`/api/backtest/configs/${configId}`);
  },

  /** Public read-only fetch of a shared config by token (clone into the form). */
  getSharedConfig: async (token: string): Promise<BacktestSharedConfig> => {
    return apiClient.get<BacktestSharedConfig>(`/api/backtest/configs/shared/${token}`);
  },

  // ---- Parameter sweeps (Phase 6) ---------------------------------------

  /** Queue a parameter sweep: a base spec run across a grid of axes. */
  createSweep: async (
    spec: BacktestSpec,
    axes: BacktestSweepAxis[],
  ): Promise<BacktestSweepCreated> => {
    return apiClient.post<BacktestSweepCreated>('/api/backtest/sweeps', { spec, axes });
  },

  /** Fetch a sweep's header + per-cell status/metrics (used while polling). */
  getSweep: async (sweepId: number): Promise<BacktestSweep> => {
    return apiClient.get<BacktestSweep>(`/api/backtest/sweeps/${sweepId}`);
  },

  // ---- Pattern insights leaderboard -------------------------------------

  /**
   * Per-(pattern, underlying) measured stats for the /backtesting/insights
   * page. Source defaults to 'option_pnl' (realized P&L); 'underlying_touch'
   * returns the proxy rows without dollar economics. Optional underlying
   * narrows to one symbol.
   */
  getPatternInsights: async (
    source: InsightsSource = 'option_pnl',
    underlying?: string,
  ): Promise<PatternInsight[]> => {
    const params = new URLSearchParams({ source });
    if (underlying) params.set('underlying', underlying);
    return apiClient.get<PatternInsight[]>(
      `/api/backtest/insights/patterns?${params}`,
    );
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
