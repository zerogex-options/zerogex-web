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

export interface GEXWallNode {
  strike: number;
  exposure: number;
  distance_from_spot: number;
  pct_from_spot: number;
}

export interface GEXWallsRow {
  timestamp: string;
  symbol: string;
  spot_price: number;
  call_wall: GEXWallNode | null;
  put_wall: GEXWallNode | null;
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

interface UseApiDataOptions<T = unknown> {
  refreshInterval?: number;
  enabled?: boolean;
  onError?: (error: string) => void;
  shouldAcceptData?: (nextData: T, prevData: T | null) => boolean;
}

const REFRESH_ACCELERATION_FACTOR = 0.5;
const MIN_REFRESH_INTERVAL_MS = 1000;

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


export interface GenericAccuracyPoint {
  strength?: string;
  timeframe?: SignalTimeframe | string;
  win_rate?: number;
  hit_rate?: number;
  accuracy?: number;
  rate?: number;
  profitability?: number;
  total_signals?: number;
  samples?: number;
  count?: number;
  bucket?: string;
  confidence?: string;
  label?: string;
}

export interface VolExpansionComponent {
  name: string;
  weight: number;
  raw_score: number;
  weighted_score: number;
  description: string;
  value?: number | null;
}

export interface VolExpansionSignalResponse {
  symbol: string;
  timestamp: string;
  score?: number;
  composite_score: number;
  max_possible_score: number;
  normalized_score: number;
  move_probability: number;
  expected_direction: 'up' | 'down' | 'neutral';
  expected_magnitude_pct: number;
  confidence: 'high' | 'medium' | 'low';
  catalyst_type: string;
  time_horizon: string;
  strategy_type: string;
  entry_window?: string | null;
  current_price?: number | null;
  net_gex?: number | null;
  gamma_flip?: number | null;
  max_pain?: number | null;
  put_call_ratio?: number | null;
  dealer_net_delta?: number | null;
  smart_money_direction?: 'up' | 'down' | 'neutral' | null;
  vwap_deviation_pct?: number | null;
  hours_to_next_expiry?: number | null;
  components: VolExpansionComponent[];
}

export interface PositionOptimizerSizingProfile {
  profile: string;
  contracts: number;
  max_risk_dollars: number;
  expected_value_dollars: number;
  constrained_by: string;
}

export interface PositionOptimizerCandidateComponent {
  name: string;
  weight: number;
  raw_score: number;
  weighted_score: number;
  description: string;
  value?: number | null;
}

export interface PositionOptimizerCandidate {
  rank: number;
  strategy_type: string;
  expiry: string;
  dte: number;
  strikes: string;
  option_type: string;
  entry_debit: number;
  entry_credit: number;
  width: number;
  max_profit: number;
  max_loss: number;
  risk_reward_ratio: number;
  probability_of_profit: number;
  expected_value: number;
  sharpe_like_ratio: number;
  liquidity_score: number;
  net_delta: number;
  net_gamma: number;
  net_theta: number;
  premium_efficiency: number;
  market_structure_fit: number;
  greek_alignment_score: number;
  edge_score: number;
  kelly_fraction: number;
  sizing_profiles: PositionOptimizerSizingProfile[];
  components: PositionOptimizerCandidateComponent[];
  reasoning: string[];
}

export interface PositionOptimizerSignalResponse {
  symbol: string;
  timestamp: string;
  signal_timestamp: string;
  signal_timeframe: SignalTimeframe;
  signal_direction: 'bullish' | 'bearish' | 'neutral';
  signal_strength: 'high' | 'medium' | 'low';
  trade_type: string;
  current_price: number;
  composite_score: number;
  max_possible_score: number;
  normalized_score: number;
  top_strategy_type: string;
  top_expiry: string;
  top_dte: number;
  top_strikes: string;
  top_probability_of_profit: number;
  top_expected_value: number;
  top_max_profit: number;
  top_max_loss: number;
  top_kelly_fraction: number;
  top_sharpe_like_ratio?: number | null;
  top_liquidity_score?: number | null;
  top_market_structure_fit?: number | null;
  top_reasoning: string[];
  candidates: PositionOptimizerCandidate[];
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

export function useApiData<T>(endpoint: string, options: UseApiDataOptions<T> = {}) {
  const { refreshInterval = 5000, enabled = true, onError, shouldAcceptData } = options;
  const effectiveRefreshInterval = refreshInterval > 0
    ? Math.max(MIN_REFRESH_INTERVAL_MS, Math.floor(refreshInterval * REFRESH_ACCELERATION_FACTOR))
    : 0;

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

      let accepted = true;
      setData((prev) => {
        if (shouldAcceptData && !shouldAcceptData(result, prev)) {
          accepted = false;
          return prev;
        }
        return result;
      });

      if (accepted) {
        setError(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      onError?.(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [endpoint, enabled, onError, shouldAcceptData]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    fetchData();

    if (effectiveRefreshInterval > 0) {
      const interval = setInterval(fetchData, effectiveRefreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, effectiveRefreshInterval, enabled]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}


function countValidGexStrikeRows(rows: GEXStrikeRow[] | null | undefined): number {
  if (!rows || rows.length === 0) return 0;
  return rows.filter((row) => Number.isFinite(Number(row?.strike)) && Number.isFinite(Number(row?.net_gex))).length;
}

function shouldAcceptGexStrikeSnapshot(next: GEXStrikeRow[], prev: GEXStrikeRow[] | null): boolean {
  if (!prev || prev.length === 0) return true;

  const prevCount = countValidGexStrikeRows(prev);
  const nextCount = countValidGexStrikeRows(next);

  if (prevCount < 20) return true;
  if (nextCount === 0) return false;

  const minimumExpected = Math.max(8, Math.floor(prevCount * 0.35));
  return nextCount >= minimumExpected;
}

function countSignalScoreComponents(response: SignalScoreResponse | null | undefined): number {
  const raw = response?.components;
  if (!raw) return 0;

  if (Array.isArray(raw)) {
    return raw.filter((component) => Number.isFinite(Number(component?.weight))).length;
  }

  if (typeof raw === 'object') {
    return Object.values(raw).filter((component) => Number.isFinite(Number(component?.weight))).length;
  }

  return 0;
}

function shouldAcceptSignalScoreSnapshot(next: SignalScoreResponse, prev: SignalScoreResponse | null): boolean {
  if (!prev) return true;

  const prevCount = countSignalScoreComponents(prev);
  const nextCount = countSignalScoreComponents(next);

  if (prevCount < 10) return true;

  const minimumExpected = Math.max(6, Math.floor(prevCount * 0.5));
  return nextCount >= minimumExpected;
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
  return useApiData<GEXStrikeRow[]>(`/api/gex/by-strike?symbol=${symbol}&limit=${limit}&sort_by=${sortBy}`, {
    refreshInterval,
    shouldAcceptData: shouldAcceptGexStrikeSnapshot,
  });
}

export function useGEXWalls(symbol = 'SPY', refreshInterval = 10000) {
  return useApiData<GEXWallsRow>(`/api/gex/walls?symbol=${symbol}`, { refreshInterval });
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
  return useApiData<VolatilityGaugeData>('/api/market/vix', { refreshInterval });
}


export function useTradesLive(symbol = 'SPY', refreshInterval = 5000) {
  return useApiData<unknown>(`/api/signals/trades-live?symbol=${symbol}`, { refreshInterval });
}

export function useTradesHistory(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<unknown>(`/api/signals/trades-history?symbol=${symbol}`, { refreshInterval });
}

export interface SignalScoreComponent {
  name: string;
  weight: number;
  score: number;
  contribution: number;
}

export interface SignalScoreResponse {
  underlying?: string;
  timestamp?: string;
  composite_score?: number;
  score?: number;
  normalized_score?: number;
  direction?: 'bullish' | 'bearish' | 'neutral';
  strength?: 'high' | 'medium' | 'low';
  trigger_threshold?: number;
  iv_rank?: number;
  components?: SignalScoreComponent[] | Record<string, { score?: number; weight?: number; value?: number; state?: string }>;
  [key: string]: unknown;
}

export function useSignalScore(symbol = 'SPY', refreshInterval = 10000) {
  return useApiData<SignalScoreResponse>(`/api/signals/score?underlying=${symbol}`, {
    refreshInterval,
    shouldAcceptData: shouldAcceptSignalScoreSnapshot,
  });
}

export interface SignalScoreHistoryPoint {
  timestamp: string;
  composite_score?: number;
  score?: number;
  normalized_score?: number;
  direction?: 'bullish' | 'bearish' | 'neutral';
  [key: string]: unknown;
}

export function useSignalScoreHistory(symbol = 'SPY', refreshInterval = 30000, limit = 100) {
  const encoded = encodeURIComponent(symbol);
  return useApiData<SignalScoreHistoryPoint[]>(
    `/api/signals/score-history?underlying=${encoded}&limit=${Math.max(1, Math.floor(limit))}`,
    { refreshInterval }
  );
}

export interface OptionContractRow {
  timestamp: string;
  underlying: string;
  strike: number;
  expiration: string;
  option_type: string;
  last: number | null;
  bid: number | null;
  ask: number | null;
  mid: number | null;
  volume: number | null;
  volume_delta: number | null;
  open_interest: number | null;
  ask_volume: number | null;
  mid_volume: number | null;
  bid_volume: number | null;
  implied_volatility: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  updated_at: string | null;
}

export function useOptionContract(
  underlying: string,
  expiration: string,
  strike: string,
  optionType: 'C' | 'P',
  refreshInterval = 30000,
) {
  const enabled = Boolean(underlying && expiration && strike);
  const params = new URLSearchParams({ underlying, expiration, strike, option_type: optionType });
  return useApiData<OptionContractRow[]>(
    `/api/option/contract?${params.toString()}`,
    { refreshInterval, enabled },
  );
}



export interface EodPressureSignalResponse {
  score?: number;
  direction?: 'bullish' | 'bearish' | 'neutral' | string;
  charm_at_spot?: number;
  pin_target?: number;
  pin_distance_pct?: number;
  gamma_regime?: 'positive' | 'negative' | string;
  time_ramp?: number;
  calendar_flags?: { opex?: boolean; quad_witching?: boolean } | Record<string, unknown>;
  [key: string]: unknown;
}

export interface ProprietarySignalSnapshot {
  underlying?: string;
  timestamp?: string;
  clamped_score?: number;
  weighted_score?: number;
  weight?: number;
  direction?: 'bullish' | 'bearish' | 'neutral' | string;
  score?: number;
  triggered?: boolean;
  signal?: string;
  context_values?: Record<string, unknown>;
  [key: string]: unknown;
}

export function useEodPressureSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<EodPressureSignalResponse>(`/api/signals/advanced/eod-pressure?symbol=${symbol}`, { refreshInterval });
}

export function useVolExpansionSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<VolExpansionSignalResponse>(`/api/signals/advanced/vol-expansion?symbol=${symbol}`, { refreshInterval });
}

export function useSqueezeSetupSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/advanced/squeeze-setup?underlying=${encodeURIComponent(symbol)}`,
    { refreshInterval },
  );
}

export function useTrapDetectionSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/advanced/trap-detection?underlying=${encodeURIComponent(symbol)}`,
    { refreshInterval },
  );
}

export function useZeroDtePositionImbalanceSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/advanced/0dte-position-imbalance?underlying=${encodeURIComponent(symbol)}`,
    { refreshInterval },
  );
}

export function useGammaVwapConfluenceSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/advanced/gamma-vwap-confluence?underlying=${encodeURIComponent(symbol)}`,
    { refreshInterval },
  );
}

export type SignalEventName =
  | 'vol_expansion'
  | 'eod_pressure'
  | 'squeeze_setup'
  | 'trap_detection'
  | 'zero_dte_position_imbalance'
  | 'gamma_vwap_confluence'
  | 'tape_flow_bias'
  | 'skew_delta'
  | 'vanna_charm_flow'
  | 'dealer_delta_pressure'
  | 'gex_gradient'
  | 'positioning_trap';

export type SignalEventHorizon = '30m' | '60m' | '120m';

export interface SignalEventRow {
  underlying?: string;
  timestamp?: string;
  component_name?: string;
  score?: number;
  weighted_score?: number;
  weight?: number;
  direction?: 'bullish' | 'bearish' | 'neutral' | string;
  direction_flip?: boolean;
  inputs?: Record<string, unknown>;
  close?: number | null;
  horizon_close?: number | null;
  realized_return?: number | null;
  [key: string]: unknown;
}

export interface SignalEventsResponse {
  underlying?: string;
  signal_name?: string;
  horizon?: string;
  rows?: SignalEventRow[];
  count?: number;
  summary?: {
    flips?: number;
    bullish?: number;
    bearish?: number;
    neutral?: number;
    latest_timestamp?: string | null;
    latest_direction?: string | null;
  };
  [key: string]: unknown;
}

export function useSignalEvents(
  signalName: SignalEventName,
  symbol = 'SPY',
  options: { limit?: number; horizon?: SignalEventHorizon; refreshInterval?: number; enabled?: boolean } = {},
) {
  const { limit = 100, horizon = '60m', refreshInterval = 30000, enabled = true } = options;
  const params = new URLSearchParams({
    symbol,
    limit: String(Math.max(1, Math.min(1000, Math.floor(limit)))),
    horizon,
  });
  return useApiData<SignalEventsResponse>(
    `/api/signals/${signalName}/events?${params.toString()}`,
    { refreshInterval, enabled },
  );
}

export interface ConfluenceMatrixCell {
  observations?: number;
  active_observations?: number;
  agreement_count?: number;
  disagreement_count?: number;
  neutral_count?: number;
  agreement_ratio?: number | null;
  disagreement_ratio?: number | null;
  net_confluence?: number | null;
}

export interface ConfluenceMatrixResponse {
  underlying?: string;
  lookback?: number;
  components?: string[];
  row_order?: string[];
  matrix?: Record<string, Record<string, ConfluenceMatrixCell>>;
  sample_count?: number;
  latest_timestamp?: string | null;
  [key: string]: unknown;
}

export function useConfluenceMatrix(symbol = 'SPY', lookback = 120, refreshInterval = 30000) {
  const params = new URLSearchParams({
    symbol,
    lookback: String(Math.max(10, Math.min(2000, Math.floor(lookback)))),
  });
  return useApiData<ConfluenceMatrixResponse>(
    `/api/signals/advanced/confluence-matrix?${params.toString()}`,
    { refreshInterval },
  );
}

export function useVolExpansionAccuracy(symbol = 'SPY', lookbackDays = 30, refreshInterval = 60000) {
  return useApiData<GenericAccuracyPoint[] | Record<string, unknown>>(
    `/api/signals/advanced/vol-expansion/accuracy?symbol=${symbol}&lookback_days=${lookbackDays}`,
    { refreshInterval }
  );
}

export function usePositionOptimizerSignal(
  symbol = 'SPY',
  portfolioValue = 100000,
  refreshInterval = 15000,
) {
  const params = new URLSearchParams({
    symbol,
    portfolio_value: String(portfolioValue),
  });

  return useApiData<PositionOptimizerSignalResponse>(
    `/api/signals/position-optimizer?${params.toString()}`,
    { refreshInterval }
  );
}

export function usePositionOptimizerAccuracy(symbol = 'SPY', lookbackDays = 30, refreshInterval = 60000) {
  return useApiData<GenericAccuracyPoint[] | Record<string, unknown>>(
    `/api/signals/position-optimizer/accuracy?symbol=${symbol}&lookback_days=${lookbackDays}`,
    { refreshInterval }
  );
}

export type BasicSignalName =
  | 'tape_flow_bias'
  | 'skew_delta'
  | 'vanna_charm_flow'
  | 'dealer_delta_pressure'
  | 'gex_gradient'
  | 'positioning_trap';

export interface BasicSignalBundleEntry {
  score?: number | null;
  clamped_score?: number | null;
  direction?: 'bullish' | 'bearish' | 'neutral' | string | null;
  timestamp?: string | null;
  context_values?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface BasicSignalsBundleResponse {
  underlying?: string;
  signals?: Partial<Record<BasicSignalName, BasicSignalBundleEntry | null>>;
  [key: string]: unknown;
}

export function useBasicSignalsBundle(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<BasicSignalsBundleResponse>(
    `/api/signals/basic?symbol=${encodeURIComponent(symbol)}`,
    { refreshInterval },
  );
}

export function useTapeFlowBiasSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/tape-flow-bias?symbol=${encodeURIComponent(symbol)}`,
    { refreshInterval },
  );
}

export function useSkewDeltaSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/skew-delta?symbol=${encodeURIComponent(symbol)}`,
    { refreshInterval },
  );
}

export function useVannaCharmFlowSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/vanna-charm-flow?symbol=${encodeURIComponent(symbol)}`,
    { refreshInterval },
  );
}

export function useDealerDeltaPressureSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/dealer-delta-pressure?symbol=${encodeURIComponent(symbol)}`,
    { refreshInterval },
  );
}

export function useGexGradientSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/gex-gradient?symbol=${encodeURIComponent(symbol)}`,
    { refreshInterval },
  );
}

export function usePositioningTrapSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/positioning-trap?symbol=${encodeURIComponent(symbol)}`,
    { refreshInterval },
  );
}

export function useBasicConfluenceMatrix(symbol = 'SPY', lookback = 120, refreshInterval = 30000) {
  const params = new URLSearchParams({
    symbol,
    lookback: String(Math.max(10, Math.min(2000, Math.floor(lookback)))),
  });
  return useApiData<ConfluenceMatrixResponse>(
    `/api/signals/basic/confluence-matrix?${params.toString()}`,
    { refreshInterval },
  );
}
