/**
 * UnifiedSignalEngine thresholds and component weights.
 * Source of truth for all signal score display logic.
 */

/** Composite score range: -100 to +100 */
export const SIGNAL_SCORE_MIN = -100;
export const SIGNAL_SCORE_MAX = 100;

/** Trigger threshold — normalized score must exceed this to open a new trade */
export const TRIGGER_THRESHOLD_DEFAULT = 0.58;
export const TRIGGER_THRESHOLD_HIGH_IV = 0.72; // IV rank > 0.70
export const TRIGGER_THRESHOLD_LOW_IV = 0.52; // IV rank < 0.25

/** Neutral zone — no edge inside this band */
export const NEUTRAL_BOUNDARY = 0.30;

/** Strength labels applied to normalized score (abs of composite / 100) */
export const STRENGTH_HIGH = 0.80;
export const STRENGTH_MEDIUM = 0.58;

/** Direction flip threshold — close open trade when opposing signal hits this */
export const DIRECTION_FLIP_THRESHOLD = 0.55;

/** Component weights (sum to 1.0) */
export const SIGNAL_WEIGHTS = {
  gex_regime: 0.18,
  smart_money: 0.16,
  vol_expansion: 0.16,
  opportunity_quality: 0.16,
  gamma_flip: 0.12,
  exhaustion: 0.12,
  put_call_ratio: 0.10,
} as const;

export type SignalComponent = keyof typeof SIGNAL_WEIGHTS;

/** Derive strength label from normalized (absolute) score */
export function getStrengthLabel(normalizedScore: number): 'high' | 'medium' | 'low' {
  if (normalizedScore >= STRENGTH_HIGH) return 'high';
  if (normalizedScore >= STRENGTH_MEDIUM) return 'medium';
  return 'low';
}

/** Derive direction label from composite score */
export function getDirectionLabel(compositeScore: number): 'bullish' | 'bearish' | 'neutral' {
  if (compositeScore > 0) return 'bullish';
  if (compositeScore < 0) return 'bearish';
  return 'neutral';
}

/** Get the regime action label for a given composite score (accepts -1..+1 from API) */
export function getRegimeLabel(compositeScore: number): string {
  const abs = Math.abs(compositeScore);
  const dir = compositeScore > 0 ? 'Bullish' : 'Bearish';
  if (abs >= 0.80) return `Strong ${dir} — High Conviction`;
  if (abs >= TRIGGER_THRESHOLD_DEFAULT) return `${dir} — Tradeable Signal`;
  if (abs >= NEUTRAL_BOUNDARY) return `${dir} — Below Trigger`;
  return 'Neutral — No Edge';
}
