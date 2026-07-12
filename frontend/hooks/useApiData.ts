/**
 * Custom hook for fetching data from ZeroGEX API
 * Handles loading, error states, and automatic refresh
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GEXHistoricalContext } from '@/core/types';
export type {
  GEXHistoricalContext,
  GEXHistoricalMetric,
  GEXHistoricalWindow,
  GEXHistoricalRegime,
} from '@/core/types';

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
  net_gex_at_spot?: number | null;
  gamma_flip?: number | null;
  // Raw nearest zero-crossing on the UN-DTE-weighted gamma profile — the
  // "nearest crossing to spot" convention competitor dashboards publish.
  // `gamma_flip` applies a horizon-occupancy ramp (down-weighting near-dated
  // 0DTE walls); this drops it, so near-dated walls can pull the crossing
  // toward spot and it can sit much closer to spot than the structural flip.
  // Null when the profile is one-signed / degraded.
  gamma_flip_raw?: number | null;
  // Fraction of spot the resolver's grid spanned to land the flip.
  // ~0.20 = default rung (stable regime level).  Larger means the
  // default rung had no qualifying interior crossing and the ladder
  // fell through to an expansion rung — visually distinguished on
  // the heatmap as a dashed/faint line so the chart doesn't suggest
  // these marginal-rung values are live regime boundaries.
  gamma_flip_span_used?: number | null;
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

export interface GEXProfilePoint {
  price: number;
  gex: number;
}

export interface GEXProfileRow {
  timestamp: string;
  symbol: string;
  spot_price: number;
  span_pct?: number | null;
  profile: GEXProfilePoint[];
  gamma_flip?: number | null;
  net_gex_at_spot?: number | null;
  call_wall?: number | null;
  put_wall?: number | null;
}

export interface MarketQuoteRow {
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
  // Index→future DISPLAY swap (outside cash session), ADDITIVE: the base
  // OHLC/close/session stay the cash index (so GEX/greeks/spot consumers are
  // unaffected). Only the header quote, quote card, and candle chart read
  // these. display_source='futures' flags the swap; data_symbol is the
  // future's badge ticker (e.g. 'ES'); futures_close is the future's last
  // price; futures_reference_close is the futures session-open baseline for
  // the overnight change. All absent on the normal index/ETF path.
  display_source?: string | null;
  data_symbol?: string | null;
  futures_close?: number | null;
  futures_reference_close?: number | null;
}

interface UseApiDataOptions<T = unknown> {
  refreshInterval?: number;
  enabled?: boolean;
  onError?: (error: string) => void;
  shouldAcceptData?: (nextData: T, prevData: T | null) => boolean;
}

const REFRESH_ACCELERATION_FACTOR = 0.5;
const MIN_REFRESH_INTERVAL_MS = 1000;

/**
 * Build a query string for an endpoint that takes an underlying symbol.
 * Different signal endpoints in the ZeroGEX API expect either `symbol` or
 * `underlying` as the query-parameter name; passing the wrong name silently
 * falls back to SPY on the server side. To stay robust regardless of which
 * parameter the endpoint cares about, every signal hook sends BOTH names
 * with the same value.
 */
function symbolQuery(
  symbol: string,
  extras: Record<string, string | number | undefined> = {},
): string {
  const params = new URLSearchParams();
  params.set('symbol', symbol);
  params.set('underlying', symbol);
  for (const [key, value] of Object.entries(extras)) {
    if (value == null) continue;
    params.set(key, String(value));
  }
  return params.toString();
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

export interface VolExpansionScoreHistoryPoint {
  timestamp: string;
  score: number;
}

export interface VolExpansionContextValues {
  net_gex: number;
  gex_regime: 'negative' | 'positive';
  expansion: number;
  direction: number;
  magnitude: number;
  expected_5min_move_bps: number | null;
  gex_readiness: number;
  pct_change_5bar: number | null;
  momentum_z: number | null;
  momentum: number | null;
  realized_sigma_bar: number | null;
  triggered: boolean;
  signal: 'bullish_expansion' | 'bearish_expansion' | 'none';
}

export interface VolExpansionSignalResponse {
  underlying: string;
  timestamp: string;
  score: number;
  clamped_score: number;
  weighted_score: number;
  weight: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  expansion: number | null;
  direction_score: number | null;
  magnitude: number | null;
  expected_5min_move_bps: number | null;
  context_values: VolExpansionContextValues;
  score_history: VolExpansionScoreHistoryPoint[];
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
  const [refetchToken, setRefetchToken] = useState(0);

  // Reset state synchronously when the endpoint changes so stale data from the
  // previous symbol is never displayed while the new request is in-flight.
  const prevEndpoint = useRef(endpoint);
  if (prevEndpoint.current !== endpoint) {
    prevEndpoint.current = endpoint;
    setData(null);
    setLoading(true);
    setError(null);
  }

  // Hold the latest callbacks in refs so they can change without tearing
  // down the fetch loop / aborting in-flight requests.
  const onErrorRef = useRef(onError);
  const shouldAcceptDataRef = useRef(shouldAcceptData);
  onErrorRef.current = onError;
  shouldAcceptDataRef.current = shouldAcceptData;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const fetchData = async () => {
      if (controller.signal.aborted) return;
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
        const response = await fetch(`${baseUrl}${endpoint}`, { signal: controller.signal });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('No data available yet');
          }
          throw new Error(`API error: ${response.status}`);
        }

        const rawResult = await response.json();
        if (controller.signal.aborted) return;

        const result = normalizeNumbers(rawResult) as T;

        let accepted = true;
        setData((prev) => {
          const accept = shouldAcceptDataRef.current;
          if (accept && !accept(result, prev)) {
            accepted = false;
            return prev;
          }
          return result;
        });

        if (accepted) {
          setError(null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
        setError(errorMessage);
        onErrorRef.current?.(errorMessage);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchData();

    const interval = effectiveRefreshInterval > 0
      ? setInterval(fetchData, effectiveRefreshInterval)
      : null;

    return () => {
      controller.abort();
      if (interval) clearInterval(interval);
    };
  }, [endpoint, enabled, effectiveRefreshInterval, refetchToken]);

  const refetch = useCallback(() => {
    setLoading(true);
    setRefetchToken((t) => t + 1);
  }, []);

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
  return useApiData<GEXSummaryRow>(`/api/gex/summary?${symbolQuery(symbol)}`, { refreshInterval });
}

export function useGEXByStrike(
  symbol = 'SPY',
  limit = 50,
  refreshInterval = 10000,
  sortBy: 'distance' | 'impact' = 'distance'
) {
  return useApiData<GEXStrikeRow[]>(
    `/api/gex/by-strike?${symbolQuery(symbol, { limit, sort_by: sortBy })}`,
    {
      refreshInterval,
      shouldAcceptData: shouldAcceptGexStrikeSnapshot,
    },
  );
}

export function useGEXWalls(symbol = 'SPY', refreshInterval = 10000) {
  return useApiData<GEXWallsRow>(`/api/gex/walls?${symbolQuery(symbol)}`, { refreshInterval });
}

export function useGEXProfile(symbol = 'SPY', refreshInterval = 10000) {
  return useApiData<GEXProfileRow>(`/api/gex/profile?${symbolQuery(symbol)}`, { refreshInterval });
}

// Historical-context endpoint is read-cached server-side (10s TTL) and the
// distributions are pre-aggregated nightly into gex_historical_stats, so a
// slower poll cadence on the client side is fine — the current value
// inside the response still tracks the live gex_summary row via the
// "RECORD" override, and the badge doesn't need to flicker every second.
export function useGEXHistoricalContext(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<GEXHistoricalContext>(
    `/api/gex/historical-context?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export interface FlipTermStructureCurvePoint {
  horizon_days: number;
  flip: number | null;
  resolved: boolean;
  span_used: number;
  net_gex_at_spot: number | null;
}

export interface FlipTermStructureHistoricalPoint {
  horizon_days: number;
  realized_at: string | null;
  target_at: string;
  flip: number | null;
  span_used: number | null;
  skew_seconds: number | null;
}

export interface FlipTermStructureResponse {
  symbol: string;
  spot: number;
  timestamp: string;
  horizons_days: number[];
  curve: FlipTermStructureCurvePoint[];
  historical: FlipTermStructureHistoricalPoint[];
}

export function useFlipTermStructure(
  symbol = 'SPX',
  horizons: number[] = [1, 3, 5, 10, 20, 60],
  refreshInterval = 7000,
) {
  const horizonsParam = horizons.join(',');
  return useApiData<FlipTermStructureResponse>(
    `/api/gex/flip-term-structure?${symbolQuery(symbol, { horizons: horizonsParam })}`,
    { refreshInterval },
  );
}

export interface FlipSurfaceFlip {
  horizon_days: number;
  flip: number | null;
  resolved: boolean;
  span_used: number;
  net_gex_at_spot: number | null;
}

export interface FlipSurfaceWall {
  strike: number;
  type: 'call' | 'put';
  abs_dollar_gex: number;
}

export interface FlipSurfaceResponse {
  symbol: string;
  spot: number;
  timestamp: string;
  grid: number[];
  horizons_days: number[];
  profiles: number[][];
  flips: FlipSurfaceFlip[];
  walls: FlipSurfaceWall[];
}

export function useFlipSurface(
  symbol = 'SPX',
  horizons: number[] = [1, 3, 5, 10, 20, 60],
  options: {
    spanPct?: number;
    stepPct?: number;
    includeWalls?: boolean;
    refreshInterval?: number;
    enabled?: boolean;
  } = {},
) {
  const {
    spanPct = 0.2,
    stepPct = 0.0025,
    includeWalls = true,
    refreshInterval = 7000,
    enabled = true,
  } = options;
  const horizonsParam = horizons.join(',');
  return useApiData<FlipSurfaceResponse>(
    `/api/gex/flip-surface?${symbolQuery(symbol, {
      horizons: horizonsParam,
      span_pct: spanPct,
      step_pct: stepPct,
      include_walls: includeWalls ? 'true' : 'false',
    })}`,
    { refreshInterval, enabled },
  );
}

// ── Options premium (extrinsic-value) surface — Beta ──
// x = strike, y = expiration (DTE), z = extrinsic (premium − intrinsic,
// clamped ≥ 0). Backed by /api/gex/premium_surface.
export interface PremiumSurfaceStrike {
  strike: number;
  premium: number | null;
  intrinsic: number | null;
  extrinsic: number | null;
}

export interface PremiumSurfaceSlice {
  expiration: string;
  dte: number;
  strikes: PremiumSurfaceStrike[];
}

export interface PremiumSurfaceResponse {
  symbol: string;
  option_type: 'C' | 'P';
  spot_price: number;
  timestamp: string;
  expirations: string[];
  strikes: number[];
  surface: PremiumSurfaceSlice[];
  // Available bounds at the snapshot (unfiltered by the dte_max/strike_count
  // request) so dropdowns can size to the real chain. Clamped server-side to
  // the endpoint ceilings (DTE <= 365, strikes <= 100).
  available_max_dte: number;
  available_strike_count: number;
}

export function usePremiumSurface(
  symbol = 'SPY',
  optionType: 'C' | 'P' = 'C',
  options: {
    dteMax?: number;
    strikeCount?: number;
    refreshInterval?: number;
    enabled?: boolean;
  } = {},
) {
  const { dteMax = 60, strikeCount = 30, refreshInterval = 30000, enabled = true } = options;
  return useApiData<PremiumSurfaceResponse>(
    `/api/gex/premium_surface?${symbolQuery(symbol, {
      option_type: optionType,
      dte_max: dteMax,
      strike_count: strikeCount,
    })}`,
    { refreshInterval, enabled },
  );
}

// ── Shared /api/market/quote cache ──
// Header, dashboard Price card, Strike Profile spot line / tip-close
// merge, GEX Heatmap, and every other chart consumer all read the live
// quote.  Without a shared cache, each call site mounts its own
// setInterval and starts ticking from its mount time — the intervals
// are all 1Hz but phase-offset by milliseconds, so different cards
// visibly update at different sub-second moments and can land on
// different server snapshots.  This module-level cache lets every
// subscriber receive the same quote at the same instant from a single
// fetch loop whose period is the smallest interval any live
// subscriber asked for.
//
// refreshInterval = 0 ("paused"): the subscriber receives the cached
// snapshot plus the result of any initial fetch, then freezes — it
// doesn't drive the poll loop and doesn't react to further updates.
// Mirrors the pre-shared-cache behaviour of useApiData with
// refreshInterval=0 so chart pause / rewind continues to freeze the
// quote-driven candles and spot line as it always did.
interface MarketQuoteCacheEntry {
  data: MarketQuoteRow | null;
  loading: boolean;
  error: string | null;
  hasFetched: boolean;
  listeners: Set<() => void>;
  liveIntervals: Map<number, number>;
  pollTimer: ReturnType<typeof setInterval> | null;
  pollIntervalMs: number;
  inflight: AbortController | null;
}

const marketQuoteCache = new Map<string, MarketQuoteCacheEntry>();
let nextMarketQuoteSubscriberId = 0;

function getOrCreateMarketQuoteEntry(symbol: string): MarketQuoteCacheEntry {
  let entry = marketQuoteCache.get(symbol);
  if (!entry) {
    entry = {
      data: null,
      loading: true,
      error: null,
      hasFetched: false,
      listeners: new Set(),
      liveIntervals: new Map(),
      pollTimer: null,
      pollIntervalMs: 0,
      inflight: null,
    };
    marketQuoteCache.set(symbol, entry);
  }
  return entry;
}

async function fetchMarketQuote(symbol: string): Promise<void> {
  const entry = marketQuoteCache.get(symbol);
  if (!entry) return;
  if (entry.inflight) entry.inflight.abort();
  const controller = new AbortController();
  entry.inflight = controller;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    const endpoint = `/api/market/quote?${symbolQuery(symbol)}`;
    const response = await fetch(`${baseUrl}${endpoint}`, { signal: controller.signal });
    if (controller.signal.aborted) return;
    if (!response.ok) {
      throw new Error(response.status === 404 ? 'No data available yet' : `API error: ${response.status}`);
    }
    const raw = await response.json();
    if (controller.signal.aborted) return;
    entry.data = normalizeNumbers(raw) as MarketQuoteRow;
    entry.loading = false;
    entry.error = null;
    entry.hasFetched = true;
    entry.listeners.forEach((fn) => fn());
  } catch (err) {
    if (controller.signal.aborted) return;
    if (err instanceof DOMException && err.name === 'AbortError') return;
    entry.error = err instanceof Error ? err.message : 'Failed to fetch';
    entry.loading = false;
    entry.listeners.forEach((fn) => fn());
  } finally {
    if (entry.inflight === controller) entry.inflight = null;
  }
}

function ensureInitialMarketQuoteFetch(symbol: string): void {
  const entry = getOrCreateMarketQuoteEntry(symbol);
  if (!entry.hasFetched && !entry.inflight) {
    void fetchMarketQuote(symbol);
  }
}

function snapshotMarketQuote(entry: MarketQuoteCacheEntry): {
  data: MarketQuoteRow | null;
  loading: boolean;
  error: string | null;
} {
  return { data: entry.data, loading: entry.loading, error: entry.error };
}

// ---- Live-stream integration ----
//
// When the WebSocket quote stream (see core/quoteStream.ts) is up, it
// writes ticks into this cache via applyLiveQuote() below and sets the
// module-level `liveStreamActive` flag via setLiveStreamActive(). The
// poll-loop scheduler consults that flag and drops each symbol's poll
// cadence to a slow heartbeat — enough to detect a socket that
// silently died while the browser still thinks it's connected, but
// far below the 1Hz polling load. When the socket disconnects, the
// flag flips back to false and full-speed polling resumes
// transparently to every existing useMarketQuote consumer.

// Heartbeat cadence used while the live stream is serving a symbol.
// Chosen so cumulative-daily-volume (which the WS payload doesn't
// carry — it lives on a separate ``underlying_daily_volume`` join)
// stays fresh enough that the dashboard's "Day Vol" text doesn't
// look stuck, while still being 5× lighter than the pre-WS 1Hz poll.
const LIVE_MODE_HEARTBEAT_MS = 5_000;

// How long after the last WS tick to treat a symbol as "live-served."
// If nothing arrives within this window we downgrade THAT symbol
// back to full-rate polling — critical for correctness in two
// scenarios:
//   1. User selects SPX/QQQ but ingestion only streams SPY today.
//      The WS subscribes, gets no ticks, and we do NOT throttle poll
//      for SPX/QQQ — user sees full-rate updates.
//   2. Ingestion process crashes. WS stays connected (pongs still
//      flow), no NOTIFYs. Symbols that were live tick past their
//      TTL, everyone falls back to full-rate poll until ingestion
//      recovers.
// 6s covers the normal ~1s inter-tick during market hours with
// generous slack for a quiet illiquid minute.
const WS_SYMBOL_LIVE_TTL_MS = 6_000;

// Only symbols in this map have received a WS tick recently. The
// value is the wall-clock ms at which we started to consider the
// symbol live; a timeout demotes it back to poll-driven after
// WS_SYMBOL_LIVE_TTL_MS with no new tick. syncMarketQuotePoll gates
// on presence in this map — not on a global "live stream up" flag —
// so the WS being connected but not delivering ticks for a given
// symbol behaves the same as the WS being disconnected: full-rate
// poll for that symbol.
const wsLiveExpiresAt = new Map<string, number>();
const wsLiveDemoteTimers = new Map<string, ReturnType<typeof setTimeout>>();

function isSymbolWsLive(symbol: string): boolean {
  const expires = wsLiveExpiresAt.get(symbol);
  if (expires === undefined) return false;
  if (Date.now() >= expires) {
    wsLiveExpiresAt.delete(symbol);
    return false;
  }
  return true;
}

function markSymbolWsLive(symbol: string): void {
  const wasLive = isSymbolWsLive(symbol);
  wsLiveExpiresAt.set(symbol, Date.now() + WS_SYMBOL_LIVE_TTL_MS);
  const existing = wsLiveDemoteTimers.get(symbol);
  if (existing) clearTimeout(existing);
  wsLiveDemoteTimers.set(
    symbol,
    setTimeout(() => {
      wsLiveDemoteTimers.delete(symbol);
      wsLiveExpiresAt.delete(symbol);
      // Restore full-rate polling for this symbol. Runs even if the
      // WS is still connected — WS-connected-but-silent is exactly
      // the SPX/QQQ + ingestion-down failure mode we're guarding.
      syncMarketQuotePoll(symbol);
    }, WS_SYMBOL_LIVE_TTL_MS),
  );
  // Newly live: recompute the poll interval to heartbeat immediately.
  if (!wasLive) syncMarketQuotePoll(symbol);
}

// Kept as a bring-down knob (called by quoteStream.suspend()). When
// the socket goes away we clear all per-symbol live markers so every
// symbol's poll goes back to full rate on the next sync. No longer
// used as the sole gate on throttling; presence in wsLiveExpiresAt
// is authoritative.
export function setLiveStreamActive(active: boolean): void {
  if (active) return; // symbols are marked live only by real ticks
  // Socket dropped — demote every symbol back to poll-driven.
  wsLiveDemoteTimers.forEach((timer) => clearTimeout(timer));
  wsLiveDemoteTimers.clear();
  wsLiveExpiresAt.clear();
  marketQuoteCache.forEach((_entry, symbol) => {
    syncMarketQuotePoll(symbol);
  });
}

/**
 * Fold a WebSocket-delivered tick into the shared cache. Called by
 * the quoteStream singleton on every 'quote' frame. Fans out to every
 * subscriber via the same listeners.forEach() the HTTP poll uses — so
 * the header price, the price card, the strike-profile spot line, and
 * the candle-tip overlay update in one React commit.
 *
 * Merges into the existing row keeping the PREVIOUS value for any
 * field the incoming frame doesn't carry (null or undefined). This is
 * essential:
 *
 *   - `session`: the header, GEX heatmap, and candle tip overlay all
 *     read `quote.session` to decide whether to render the live tick.
 *     A tick without `session` used to clobber a good HTTP-poll value
 *     to null and disable every live overlay.
 *   - `volume`: WS payload carries per-bar up/down volume, not the
 *     cumulative daily volume the HTTP quote endpoint returns.
 *     Preserving prev keeps the dashboard's "Day Vol" reading intact.
 *   - `open/high/low/close`: null OHLC on a data hole or illiquid
 *     warmup tick would render $0.00; falling back to prev keeps the
 *     last known price on screen until a real tick lands.
 *
 * Applies only to null-ish (null or undefined) fields — a real numeric
 * 0 (a legitimate value for volume during pre-market) still wins.
 */
export type LiveQuoteIncoming = {
  symbol: string;
  timestamp: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  volume?: number | null;
  up_volume?: number | null;
  down_volume?: number | null;
  session?: string | null;
};

export function applyLiveQuote(symbol: string, incoming: LiveQuoteIncoming): void {
  const entry = getOrCreateMarketQuoteEntry(symbol);
  const prev = entry.data;
  const pickNumber = (
    inc: number | null | undefined,
    prevValue: number | null | undefined,
    fallback: number,
  ): number => {
    if (inc !== undefined && inc !== null) return inc;
    if (prevValue !== undefined && prevValue !== null) return prevValue;
    return fallback;
  };
  const pickNullable = <T>(inc: T | null | undefined, prevValue: T | null | undefined): T | null => {
    if (inc !== undefined && inc !== null) return inc;
    if (prevValue !== undefined && prevValue !== null) return prevValue;
    return null;
  };
  const merged: MarketQuoteRow = {
    symbol: incoming.symbol,
    timestamp: incoming.timestamp,
    open: pickNumber(incoming.open, prev?.open, prev?.open ?? 0),
    high: pickNumber(incoming.high, prev?.high, prev?.high ?? 0),
    low: pickNumber(incoming.low, prev?.low, prev?.low ?? 0),
    close: pickNumber(incoming.close, prev?.close, prev?.close ?? 0),
    volume: pickNullable(incoming.volume, prev?.volume),
    up_volume: pickNullable(incoming.up_volume, prev?.up_volume),
    down_volume: pickNullable(incoming.down_volume, prev?.down_volume),
    session: pickNullable(incoming.session, prev?.session),
  };
  entry.data = merged;
  entry.loading = false;
  entry.error = null;
  entry.hasFetched = true;
  entry.listeners.forEach((fn) => fn());
  // Mark this symbol as live — recomputes the poll cadence so the
  // symbol's HTTP polling drops to the heartbeat. Symbols the WS
  // hasn't served (SPX/QQQ when ingestion only streams SPY) never
  // enter this map and stay on full-rate polling.
  markSymbolWsLive(symbol);
}

function syncMarketQuotePoll(symbol: string): void {
  const entry = getOrCreateMarketQuoteEntry(symbol);
  let minInterval = Infinity;
  entry.liveIntervals.forEach((interval) => {
    if (interval > 0 && interval < minInterval) minInterval = interval;
  });
  const baseInterval = Number.isFinite(minInterval)
    ? Math.max(MIN_REFRESH_INTERVAL_MS, Math.floor(minInterval * REFRESH_ACCELERATION_FACTOR))
    : 0;
  // Per-symbol gating: the poll drops to heartbeat only when a WS
  // tick for THIS symbol arrived recently. A symbol the WS isn't
  // serving (SPX/QQQ before ingestion adds them; or ANY symbol
  // during an ingestion outage where the socket stays open but no
  // NOTIFYs flow) stays at full-rate polling, so users always see
  // fresh data regardless of what the WS is or isn't delivering.
  const requestedInterval =
    isSymbolWsLive(symbol) && baseInterval > 0
      ? Math.max(baseInterval, LIVE_MODE_HEARTBEAT_MS)
      : baseInterval;
  if (requestedInterval === entry.pollIntervalMs) return;
  if (entry.pollTimer) {
    clearInterval(entry.pollTimer);
    entry.pollTimer = null;
  }
  entry.pollIntervalMs = requestedInterval;
  if (requestedInterval > 0) {
    entry.pollTimer = setInterval(() => {
      void fetchMarketQuote(symbol);
    }, requestedInterval);
  }
}

export function useMarketQuote(symbol = 'SPY', refreshInterval = 1000) {
  const [state, setState] = useState(() => snapshotMarketQuote(getOrCreateMarketQuoteEntry(symbol)));

  // Synchronously swap snapshots when the symbol changes so stale data
  // from the previous symbol isn't briefly displayed during the effect
  // teardown / re-mount cycle.
  const trackedSymbolRef = useRef(symbol);
  if (trackedSymbolRef.current !== symbol) {
    trackedSymbolRef.current = symbol;
    setState(snapshotMarketQuote(getOrCreateMarketQuoteEntry(symbol)));
  }

  // Stable subscriber id so unmount cleanly removes this caller's
  // interval contribution without disturbing other subscribers.
  const idRef = useRef<number>(0);
  if (idRef.current === 0) idRef.current = ++nextMarketQuoteSubscriberId;
  const id = idRef.current;

  useEffect(() => {
    const entry = getOrCreateMarketQuoteEntry(symbol);
    ensureInitialMarketQuoteFetch(symbol);

    if (refreshInterval <= 0) {
      // Frozen subscriber: snapshot now; if no fetch has landed yet,
      // listen ONCE so the initial value gets through, then freeze.
      setState(snapshotMarketQuote(entry));
      if (entry.hasFetched) return;
      const oneShot = () => {
        setState(snapshotMarketQuote(entry));
        entry.listeners.delete(oneShot);
      };
      entry.listeners.add(oneShot);
      return () => {
        entry.listeners.delete(oneShot);
      };
    }

    // Live subscriber: contribute to the shared poll and receive every update.
    entry.liveIntervals.set(id, refreshInterval);
    syncMarketQuotePoll(symbol);

    const listener = () => setState(snapshotMarketQuote(entry));
    entry.listeners.add(listener);
    listener();

    // Acquire a WebSocket subscription for this symbol. Dynamic import
    // side-steps the circular-import risk between this module and
    // core/quoteStream.ts (which imports applyLiveQuote from here) and
    // keeps the WS bundle out of any consumer that never subscribes.
    // If the feature flag is off or ticket minting fails, `acquire()`
    // is a no-op and returns a no-op release function.
    let releaseStream: (() => void) | null = null;
    let released = false;
    void import('@/core/quoteStream').then(({ quoteStream }) => {
      if (released) return;
      releaseStream = quoteStream.acquire(symbol);
    });

    return () => {
      released = true;
      if (releaseStream) releaseStream();
      entry.listeners.delete(listener);
      entry.liveIntervals.delete(id);
      syncMarketQuotePoll(symbol);
    };
  }, [symbol, refreshInterval, id]);

  const refetch = useCallback(() => {
    void fetchMarketQuote(symbol);
  }, [symbol]);

  return { ...state, refetch };
}

export function useSmartMoneyFlow(symbol = 'SPY', limit = 10, session: 'current' | 'prior' = 'current', refreshInterval = 10000) {
  return useApiData<OptionFlowRow[]>(
    `/api/flow/smart-money?${symbolQuery(symbol, { session, limit })}`,
    { refreshInterval },
  );
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

export function useSessionCloses(
  symbol = 'SPY',
  refreshInterval = 60000,
  sessionTrigger?: string | null,
) {
  const result = useApiData<SessionClosesData>(
    `/api/market/session-closes?${symbolQuery(symbol)}`,
    { refreshInterval }
  );

  // The session-closes endpoint advances `current_session_close` from yesterday
  // to today exactly at 16:00 ET (and analogous boundaries for pre/AH). Polling
  // alone leaves up to a full refresh interval where `quoteData.session` has
  // already flipped but the close hasn't, briefly displaying yesterday's close
  // as the headline price. Forcing a refetch on every session change closes
  // that window.
  const { refetch } = result;
  useEffect(() => {
    if (sessionTrigger != null) {
      refetch();
    }
  }, [sessionTrigger, refetch]);

  return result;
}

export interface SessionLevelsData {
  symbol: string;
  /** True for cash indexes (SPX, NDX, …) — no pre-market print; all level fields are null. */
  is_index: boolean;
  /** ET date whose pre-market the premarket_* fields describe. Levels roll at 04:00 ET, not at the close. */
  trading_date: string | null;
  /** High of trading_date's 04:00–09:30 ET pre-market session (live while the pre-market is in progress). */
  premarket_high: number | null;
  premarket_low: number | null;
  /** ET date of the previous regular session the prev_session_* fields describe. */
  prev_session_date: string | null;
  /** High/low of the previous regular session (09:30–16:00 ET incl. the closing auction print). */
  prev_session_high: number | null;
  prev_session_low: number | null;
  source?: string | null;
  updated_at?: string | null;
}

/**
 * Pre-market + previous-session high/low for the chart level overlays.
 * Backed by /api/market/session-levels (the session-levels capture job with
 * a live 1-min-bar fallback). Pass `enabled=false` for index symbols — they
 * have no pre-market session, so there is nothing to fetch or draw.
 */
export function useSessionLevels(
  symbol = 'SPY',
  refreshInterval = 60000,
  enabled = true,
) {
  return useApiData<SessionLevelsData>(
    `/api/market/session-levels?${symbolQuery(symbol)}`,
    { refreshInterval, enabled },
  );
}

export function useTradeSignal(symbol = 'SPY', timeframe: SignalTimeframe = 'intraday', refreshInterval = 15000) {
  return useApiData<TradeSignalResponse>(
    `/api/signals/trade?${symbolQuery(symbol, { timeframe })}`,
    { refreshInterval },
  );
}

export function useSignalAccuracy(symbol = 'SPY', lookbackDays = 30, refreshInterval = 60000) {
  return useApiData<SignalAccuracyPoint[] | Record<string, unknown>>(
    `/api/signals/accuracy?${symbolQuery(symbol, { lookback_days: lookbackDays })}`,
    { refreshInterval }
  );
}

export interface VolatilityGaugeData {
  timestamp: string;
  index: number; // latest VIX/VXN quote (points)
  level: number;
  level_label: string;
  momentum: number;
  momentum_label: string;
  cache_bars: number;
  latest_bars?: Array<{ timestamp: string; close: number }>;
}

export type VolatilityIndex = 'VIX' | 'VXN';

// Volatility gauge. Defaults to VIX (S&P 500 implied vol); pass `index: 'VXN'`
// for the Nasdaq-100 gauge that's the correct implied-vol input for QQQ. The
// `index` arg is second so existing `useVolatilityGauge(refreshInterval)` calls
// keep working.
export function useVolatilityGauge(refreshInterval = 30000, index: VolatilityIndex = 'VIX') {
  return useApiData<VolatilityGaugeData>(`/api/market/volatility?ticker=${index}`, {
    refreshInterval,
  });
}


export function useTradesLive(symbol = 'SPY', refreshInterval = 5000) {
  return useApiData<unknown>(`/api/signals/trades-live?${symbolQuery(symbol)}`, { refreshInterval });
}

export function useTradesHistory(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<unknown>(`/api/signals/trades-history?${symbolQuery(symbol)}`, { refreshInterval });
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
  return useApiData<SignalScoreResponse>(`/api/signals/score?${symbolQuery(symbol)}`, {
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
  return useApiData<SignalScoreHistoryPoint[]>(
    `/api/signals/score-history?${symbolQuery(symbol, { limit: Math.max(1, Math.floor(limit)) })}`,
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
  const params = new URLSearchParams({
    symbol: underlying,
    underlying,
    expiration,
    strike,
    option_type: optionType,
  });
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
  return useApiData<EodPressureSignalResponse>(
    `/api/signals/advanced/eod-pressure?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useVolExpansionSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<VolExpansionSignalResponse>(
    `/api/signals/advanced/vol-expansion?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useSqueezeSetupSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/advanced/squeeze-setup?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useTrapDetectionSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/advanced/trap-detection?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useZeroDtePositionImbalanceSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/advanced/0dte-position-imbalance?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useGammaVwapConfluenceSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/advanced/gamma-vwap-confluence?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useRangeBreakImminenceSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/advanced/range-break-imminence?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useMarketPressureSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/advanced/market-pressure?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export interface SignalActionLeg {
  expiry: string;
  strike: number;
  right: 'C' | 'P' | string;
  side: 'BUY' | 'SELL' | string;
  qty: number;
}

export interface SignalActionPriceLevel {
  ref_price?: number;
  trigger?: string;
  kind?: string;
  level_name?: string;
  [key: string]: unknown;
}

export interface SignalActionNearMiss {
  pattern: string;
  missing: string[];
}

export interface SignalActionAlternative {
  pattern: string;
  reason: string;
}

export interface SignalActionResponse {
  underlying?: string;
  timestamp?: string;
  action?: string;
  pattern?: string;
  tier?: string;
  direction?: 'bullish' | 'bearish' | 'non_directional' | string;
  confidence?: number;
  size_multiplier?: number;
  max_hold_minutes?: number;
  legs?: SignalActionLeg[];
  entry?: SignalActionPriceLevel;
  target?: SignalActionPriceLevel;
  stop?: SignalActionPriceLevel;
  rationale?: string;
  context?: Record<string, unknown>;
  alternatives_considered?: SignalActionAlternative[];
  near_misses?: SignalActionNearMiss[];
  /** Persisted signal_action_cards row id — present on Trade Cards, omitted
   *  on STAND_DOWN. When present, the card has a stable /cards/{id}
   *  permalink with its own OpenGraph preview. */
  id?: number;
  [key: string]: unknown;
}

export function useSignalAction(symbol = 'SPY', refreshInterval = 60000) {
  return useApiData<SignalActionResponse>(
    `/api/signals/action?${symbolQuery(symbol)}`,
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
  | 'range_break_imminence'
  | 'market_pressure'
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
  const query = symbolQuery(symbol, {
    limit: Math.max(1, Math.min(1000, Math.floor(limit))),
    horizon,
  });
  return useApiData<SignalEventsResponse>(
    `/api/signals/${signalName}/events?${query}`,
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
  return useApiData<ConfluenceMatrixResponse>(
    `/api/signals/advanced/confluence-matrix?${symbolQuery(symbol, {
      lookback: Math.max(10, Math.min(2000, Math.floor(lookback))),
    })}`,
    { refreshInterval },
  );
}

export function useVolExpansionAccuracy(symbol = 'SPY', lookbackDays = 30, refreshInterval = 60000) {
  return useApiData<GenericAccuracyPoint[] | Record<string, unknown>>(
    `/api/signals/advanced/vol-expansion/accuracy?${symbolQuery(symbol, { lookback_days: lookbackDays })}`,
    { refreshInterval }
  );
}

export function usePositionOptimizerSignal(
  symbol = 'SPY',
  portfolioValue = 100000,
  refreshInterval = 15000,
) {
  return useApiData<PositionOptimizerSignalResponse>(
    `/api/signals/position-optimizer?${symbolQuery(symbol, { portfolio_value: portfolioValue })}`,
    { refreshInterval }
  );
}

export function usePositionOptimizerAccuracy(symbol = 'SPY', lookbackDays = 30, refreshInterval = 60000) {
  return useApiData<GenericAccuracyPoint[] | Record<string, unknown>>(
    `/api/signals/position-optimizer/accuracy?${symbolQuery(symbol, { lookback_days: lookbackDays })}`,
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
    `/api/signals/basic?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useTapeFlowBiasSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/tape-flow-bias?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useSkewDeltaSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/skew-delta?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useVannaCharmFlowSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/vanna-charm-flow?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useDealerDeltaPressureSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/dealer-delta-pressure?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useGexGradientSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/gex-gradient?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function usePositioningTrapSignal(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ProprietarySignalSnapshot>(
    `/api/signals/basic/positioning-trap?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export function useBasicConfluenceMatrix(symbol = 'SPY', lookback = 120, refreshInterval = 30000) {
  return useApiData<ConfluenceMatrixResponse>(
    `/api/signals/basic/confluence-matrix?${symbolQuery(symbol, {
      lookback: Math.max(10, Math.min(2000, Math.floor(lookback))),
    })}`,
    { refreshInterval },
  );
}

// ── Forced Flow (dealer forced-hedging attribution) — Phase 4 ──
// The "Forced Flow" endpoints model the dollars of stock dealers are
// mechanically forced to buy (+) or sell (−) to stay delta-hedged as the
// underlying moves (gamma), time decays (charm), or implied vol shifts
// (vanna). Backed by the /api/forced-flow/* API surface.

export interface ForcedFlowCurvePoint {
  price: number;
  total: number;
  gamma: number;
  charm: number;
  vanna: number;
}

export interface ForcedFlowCurveResponse {
  symbol: string;
  spot: number;
  timestamp: string;
  horizon_days: number;
  // Spot level at which the total forced flow crosses zero (dealers flip from
  // net buyers to net sellers). Null when the curve is one-signed across the
  // scanned range.
  zero_flow_level: number | null;
  curve: ForcedFlowCurvePoint[];
}

// Forced-flow reprice curve: total dealer hedging flow (and its gamma / charm /
// vanna attribution) as a function of a hypothetical spot, spanning
// spot_range_pct either side of the live spot.
export function useForcedFlowCurve(symbol = 'SPY', spotRangePct = 0.05, refreshInterval = 15000) {
  return useApiData<ForcedFlowCurveResponse>(
    `/api/forced-flow/curve?${symbolQuery(symbol, { spot_range_pct: spotRangePct })}`,
    { refreshInterval },
  );
}

export interface ForcedFlowCharmDecayPoint {
  days_elapsed: number;
  flow: number;
}

export interface ForcedFlowCharmDecayResponse {
  symbol: string;
  spot: number;
  timestamp: string;
  session_days: number;
  // Cumulative charm-driven forced flow ($) realised by the close if spot holds.
  close_flow_usd: number;
  curve: ForcedFlowCharmDecayPoint[];
}

// Cumulative charm-decay flow into the close — how time decay alone forces
// dealer hedging as the session runs down to 4 PM.
export function useForcedFlowCharmDecay(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ForcedFlowCharmDecayResponse>(
    `/api/forced-flow/charm-decay?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export interface ForcedFlowVannaLadderPoint {
  vol_change_pts: number;
  flow: number;
}

export interface ForcedFlowVannaLadderResponse {
  symbol: string;
  spot: number;
  timestamp: string;
  curve: ForcedFlowVannaLadderPoint[];
}

// Vanna ladder: dealer forced flow ($) as a function of a VIX/implied-vol
// change in points (−3 … +3), spot held.
export function useForcedFlowVannaLadder(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ForcedFlowVannaLadderResponse>(
    `/api/forced-flow/vanna-ladder?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}

export interface ForcedFlowLevelsResponse {
  symbol: string;
  spot: number;
  timestamp: string;
  gamma_flip: number | null;
  charm_flip: number | null;
  vanna_flip: number | null;
  zero_flow_level: number | null;
}

// The forced-flow regime map: the key spot levels (gamma / charm / vanna flip
// and the aggregate zero-flow level) that bound the dealer-hedging regime.
export function useForcedFlowLevels(symbol = 'SPY', refreshInterval = 15000) {
  return useApiData<ForcedFlowLevelsResponse>(
    `/api/forced-flow/levels?${symbolQuery(symbol)}`,
    { refreshInterval },
  );
}
