// Pin Strike — presentation helpers.
//
// Pin Strike is the reachable 0DTE strike with the strongest modeled positive
// (restoring) dealer gamma into expiration (see the backend
// src/analytics/pin_strike.py). It is a distinct dealer-positioning metric,
// not a wall / flip / max-pain / king-node.
//
// The UI stays deliberately conservative: show the strike (or a dash when
// there is no active pin), and — as optional secondary metadata — a strength
// label derived from the pin *confidence* (the normalized dominance of the
// best pin over the other viable pins).
//
// Confidence is used for the label rather than the raw pin score because it is
// scale-free (0..1) across SPY / QQQ / SPX / NDX; a raw-score threshold would
// be underlying-dependent. Server-side magnitude suppression already happens
// via PIN_STRIKE_MIN_SCORE, so a pin that reaches the client is above that
// floor. These thresholds are the single, clearly-named place to tune the
// user-facing strength buckets.

export const PIN_STRENGTH_STRONG_MIN_CONFIDENCE = 0.5;
export const PIN_STRENGTH_MODERATE_MIN_CONFIDENCE = 0.33;

// Single source of truth for the Pin Strike line/marker color across every
// surface. The teal is defined once as `--color-pin` in globals.css (theme-
// consistent, deliberately distinct from the green/red walls, azure flip, gold
// max-pain and violet King). Contexts that resolve CSS vars use
// PIN_STRIKE_COLOR_VAR; contexts that need a literal color string — hex-only
// module constants (MarketMakerExposures) and the rasterized-to-PNG bulletin,
// whose serializer does not resolve `var(--…)` — use PIN_STRIKE_COLOR_HEX.
export const PIN_STRIKE_COLOR_VAR = 'var(--color-pin)';
export const PIN_STRIKE_COLOR_HEX = '#14B8A6';

export type PinStrength = 'none' | 'weak' | 'moderate' | 'strong';

/** The em-dash empty state used across the level tiles (never render 0/NaN). */
export const PIN_STRIKE_EMPTY = '—';

/** Classify pin strength from the confidence, or `none` when there is no pin. */
export function classifyPinStrength(
  pinStrike: number | null | undefined,
  pinConfidence: number | null | undefined,
): PinStrength {
  // A non-positive strike is never a real pin — treat it as no pin so the UI
  // never renders "$0.00" or a misleading fallback (the spec's "do not display
  // 0" rule). The backend only ever emits positive strikes for an active pin.
  if (pinStrike == null || !Number.isFinite(pinStrike) || pinStrike <= 0) return 'none';
  const c = pinConfidence ?? 0;
  if (c >= PIN_STRENGTH_STRONG_MIN_CONFIDENCE) return 'strong';
  if (c >= PIN_STRENGTH_MODERATE_MIN_CONFIDENCE) return 'moderate';
  return 'weak';
}

const STRENGTH_LABEL: Record<PinStrength, string> = {
  none: 'No active pin',
  weak: 'Weak',
  moderate: 'Moderate',
  strong: 'Strong',
};

/** Human label for a pin-strength bucket. */
export function pinStrengthLabel(strength: PinStrength): string {
  return STRENGTH_LABEL[strength];
}

/**
 * The Pin's label on a CHART LINE: "Pin · Strong" for an active pin, and a bare
 * "Pin" only when there is no pin to qualify at all. A missing confidence still
 * classifies (as Weak, via `classifyPinStrength`) rather than dropping the
 * suffix — the same answer `pinStrikeSubtitle` gives the tiles, so one pin
 * cannot read two ways depending on which surface you are looking at.
 *
 * Separate from `pinStrikeSubtitle`, which is the *tile* copy and spells the
 * confidence out as a percent; a line label has to stay short enough to sit in
 * a stack of level tags without pushing the others off the plot. Shared so the
 * live chart and the replay can't drift into naming the same level differently
 * — callers that render level tags in caps (the Gamma Terminal chart) simply
 * upper-case the result.
 */
export function pinLineLabel(
  pinStrike: number | null | undefined,
  pinConfidence: number | null | undefined,
): string {
  const strength = classifyPinStrength(pinStrike, pinConfidence);
  return strength === 'none' ? 'Pin' : `Pin · ${STRENGTH_LABEL[strength]}`;
}

/**
 * Format the Pin Strike value for a tile — a dollar-prefixed strike, or the
 * em-dash empty state when there is no active pin. Never returns `0`/`NaN`.
 */
export function formatPinStrike(pinStrike: number | null | undefined): string {
  if (pinStrike == null || !Number.isFinite(pinStrike) || pinStrike <= 0) return PIN_STRIKE_EMPTY;
  return `$${pinStrike.toFixed(2)}`;
}

/**
 * Secondary tile subtitle: "Strong · 62%" when a pin is active, or a short
 * "No active pin" when it is not. Confidence is shown as a whole percent.
 */
export function pinStrikeSubtitle(
  pinStrike: number | null | undefined,
  pinConfidence: number | null | undefined,
): string {
  const strength = classifyPinStrength(pinStrike, pinConfidence);
  if (strength === 'none') return STRENGTH_LABEL.none;
  const pct = pinConfidence != null ? ` · ${Math.round(pinConfidence * 100)}%` : '';
  return `Pin strength: ${STRENGTH_LABEL[strength]}${pct}`;
}

/** The shared tooltip copy for the Pin Strike metric. */
export const PIN_STRIKE_TOOLTIP =
  'Pin Strike estimates the nearby 0DTE strike with the strongest combination ' +
  'of positive dealer-gamma stabilization and the probability of price reaching ' +
  'that area before expiration. It is a modeled pinning level, not a guaranteed ' +
  'price target.';
