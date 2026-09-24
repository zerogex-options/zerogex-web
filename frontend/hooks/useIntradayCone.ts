'use client';

import { useApiData } from '@/hooks/useApiData';

/**
 * The intraday re-anchored cone, from GET /api/cone/*.
 *
 * The daily forecast commits one band before the open and is graded at 16:05.
 * This is its intraday counterpart: every 15 minutes the writer re-anchors on
 * the current bar, re-reads the current dealer surface, and commits a band
 * plus a hold probability for each horizon that can still complete before the
 * bell.
 *
 * `hold_prob` means P(price never leaves the band at ANY point during the
 * window) — not P(inside the band at the end). The difference is the whole
 * design: a path can exit at +40m, come back, and close inside, and a
 * terminal-value probability would call that a win while the trader who got
 * stopped out knows better. `held` grades it the same way.
 */

/** One horizon's claim, and its verdict once the window matured. */
export interface ConeHorizon {
  horizon_min: number;
  target_ts: string | null;
  band_low: number | null;
  band_high: number | null;
  hold_prob: number | null;
  sigma: number | null;
  /**
   * True once the claim has been through the grader. Note that `graded` can
   * be true with `held` still null — that is the ABANDONED state, a window
   * that never produced bars. It is deliberately neither outcome, and renders
   * as "not scored" rather than being counted either way.
   */
  graded: boolean;
  held: boolean | null;
  window_low: number | null;
  window_high: number | null;
  brier: number | null;
}

/** One fire: an anchor, the surface it was conditioned on, and its legs. */
export interface ConeFire {
  forecast_ts: string | null;
  anchor_spot: number | null;
  elapsed_min: number | null;
  call_wall: number | null;
  put_wall: number | null;
  gamma_flip: number | null;
  gamma_mult: number | null;
  model_version: string | null;
  horizons: ConeHorizon[];
}

export interface ConeSessionPayload {
  symbol: string;
  session_date: string;
  fires: ConeFire[];
  n_fires: number;
  n_claims: number;
  n_graded: number;
  n_held: number;
}

/** One row of the reliability table: what happened inside one confidence band. */
export interface ReliabilityBucket {
  bucket_low: number;
  bucket_high: number;
  n: number;
  predicted: number;
  realized: number;
  /** realized − predicted. Negative is overconfident. */
  gap: number;
}

export interface ConeScoreBlock {
  n: number;
  hold_rate?: number;
  mean_predicted?: number;
  brier: number | null;
  /**
   * Brier of the honest strawman: always predict the base rate. The cone has
   * to score BELOW this (lower Brier is better) to have earned anything.
   */
  baseline_brier: number | null;
  /** Null until the sample can support a verdict — never a hopeful default. */
  brier_skill: number | null;
  min_brier_skill?: number;
  beats_baseline: boolean | null;
  calibration_error: number | null;
  reliability: ReliabilityBucket[];
  sufficient_sample?: boolean;
  min_sample?: number;
}

export interface ConeReliabilityPayload {
  symbol: string;
  window_sessions: number;
  sessions_covered: number;
  first_session: string | null;
  last_session: string | null;
  overall: ConeScoreBlock;
  by_horizon: Record<string, ConeScoreBlock>;
  definition: string;
}

/** A session's cones. Polls while live; static for a past date. */
export function useConeSession(symbol: string, sessionDate?: string, refreshMs = 60_000) {
  const day = sessionDate ?? 'today';
  const path =
    day === 'today'
      ? `/api/cone/latest?symbol=${encodeURIComponent(symbol)}`
      : `/api/cone/session/${day}?symbol=${encodeURIComponent(symbol)}`;
  return useApiData<ConeSessionPayload>(path, {
    refreshInterval: sessionDate ? 0 : refreshMs,
  });
}

/** A session's full set of fires — what the chart draws. */
export function useConeFires(symbol: string, sessionDate: string, refreshMs = 60_000) {
  return useApiData<ConeSessionPayload>(
    `/api/cone/session/${sessionDate}?symbol=${encodeURIComponent(symbol)}`,
    { refreshInterval: refreshMs },
  );
}

/**
 * The receipt. Static enough to poll rarely — it aggregates immutable graded
 * claims, so nothing in it changes between grader runs.
 */
export function useConeReliability(symbol: string, window = 30) {
  return useApiData<ConeReliabilityPayload>(
    `/api/cone/reliability?symbol=${encodeURIComponent(symbol)}&window=${window}`,
    { refreshInterval: 0 },
  );
}
