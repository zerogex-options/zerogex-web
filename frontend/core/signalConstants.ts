/**
 * UnifiedSignalEngine thresholds and component weights.
 * Source of truth for all signal score display logic.
 */

/** Composite score range: -1.0 to +1.0 */
export const SIGNAL_SCORE_MIN = -1.0;
export const SIGNAL_SCORE_MAX = 1.0;

/** Trigger threshold — score must exceed this to open a new trade */
export const TRIGGER_THRESHOLD_DEFAULT = 0.58;
export const TRIGGER_THRESHOLD_HIGH_IV = 0.65; // IV rank > 0.70
export const TRIGGER_THRESHOLD_LOW_IV = 0.54; // IV rank < 0.25

/** Neutral zone — no edge inside this band */
export const NEUTRAL_BOUNDARY = 0.35;

/** Strength labels applied to normalized score (abs of composite) */
export const STRENGTH_HIGH = 0.82;
export const STRENGTH_MEDIUM = 0.64;

/** Direction flip threshold — close open trade when opposing signal hits this */
export const DIRECTION_FLIP_THRESHOLD = 0.55;

/** Component weights (sum to 1.0) */
export const SIGNAL_WEIGHTS = {
  gex_regime: 0.22,
  vol_expansion: 0.20,
  smart_money: 0.16,
  exhaustion: 0.15,
  gamma_flip: 0.15,
  put_call_ratio: 0.12,
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

/** Get the regime action label for a given composite score */
export function getRegimeLabel(compositeScore: number): string {
  const abs = Math.abs(compositeScore);
  const dir = compositeScore > 0 ? 'Bullish' : 'Bearish';
  if (abs >= TRIGGER_THRESHOLD_DEFAULT) return `Strong ${dir} — Open Trades`;
  if (abs >= NEUTRAL_BOUNDARY) return `${dir} — Monitor / Hold`;
  return 'Neutral — No Edge';
}
