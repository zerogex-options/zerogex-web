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
// best pin over the other viable pins). A pin far from price is labeled FAR
// in place of that strength word (see "Far pins" below).

import { isStockSymbol, volatilityIndexFor } from './symbols.ts';

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

// ---------------------------------------------------------------------------
// Far pins — how far the pin sits from price
// ---------------------------------------------------------------------------
//
// The model looks for its pin across every listed 0DTE strike within ±2.5
// expected moves of spot, and only positive (restoring) dealer gamma counts.
// In a short-gamma book there is little of that near price, so the strike that
// wins can be a distant pocket. And because the strength label is the winner's
// SHARE of the field, not its distance or size, a lone distant candidate can
// read STRONG. A teal "PIN · STRONG" line 90 points above a falling tape looks
// like a target. It is the opposite: the model saying there is no stabilizing
// gamma anywhere near price.
//
// So a far pin is still SHOWN (the help page promises the pin is hidden only
// when the model returns none), but every surface labels it FAR in place of
// its strength and draws it dimmed. Everything below decides "far" once, so no
// two surfaces can disagree about the same pin.
//
// Far is measured in daily expected moves: the ±1σ move implied vol prices for
// one session, the half-width of the band the chart's Expected Range overlay
// draws (spot × VIX ÷ 100 × √(1/252), VXN for the Nasdaq-100 names; see
// buildExpectedRange in app/live-bulletin/bulletinHelpers.ts). One threshold
// in those units holds across SPX, SPY, ES, NDX, QQQ and NQ, where a point
// count could not. Where there is no vol reading (the replay pages, chart
// rewind, the free gamma-levels pages, single stocks) a percent-of-spot
// fallback stands in.
//
// Calibrated on the Daily Replay, November 2026 (ES on Nov 4, 10, 12, 13 and
// 16; NQ, SPY and QQQ on Nov 12-13), with each day's VIX. At 0.75 expected
// moves the far state covered half of Nov 13 and all of Nov 16, the sessions
// a member reported as useless for intraday ES (pins 89-150 points above price
// against a ~93-point move), and 0-9% of the ordinary ES sessions, where the
// pin sat a typical 10-60 points away. Every STRONG or MODERATE label on Nov 16
// was on a pin this rule calls far.

/**
 * A pin farther from spot than this many daily expected moves reads as far.
 *
 * Three-quarters of the ±1σ daily move. Half a move (about 47 ES points at a
 * VIX of 20) is a distance price covers on most sessions: it would have called
 * two-thirds of an ordinary session (Nov 10) far. A full move would have let
 * the case that prompted this through (Nov 16 at noon: 89 points, 0.94 of a
 * move, labeled STRONG).
 *
 * The yardstick is a whole session's move and does not shrink into the close,
 * so late in the day a pin can be out of reach in the time left without
 * reading far. Kept that way on purpose: it is the band the Expected Range
 * overlay draws, so a trader can see the rule on the chart.
 */
export const PIN_FAR_EXPECTED_MOVES = 0.75;

/**
 * The fallback, in percent of spot, for when no expected move is available.
 *
 * Set where the expected-move rule lands when vol is a little above ordinary
 * (VIX about 21, VXN about 26), so the fallback errs toward NOT calling a pin
 * far: across the calibration sessions above it never flagged a pin the
 * expected-move rule would have left alone, and agreed with it on 89-100% of
 * minutes. The Nasdaq-100 names move more than the S&P (VXN runs about a
 * quarter above VIX), and a single stock about twice as much as an index, so
 * each gets proportionally more room.
 */
export const PIN_FAR_FALLBACK_PCT = {
  sp500: 1,
  nasdaq100: 1.25,
  stock: 2,
} as const;

/** The fallback cutoff for `symbol`, in percent of spot. */
export function pinFarFallbackPct(symbol: string | null | undefined): number {
  if (isStockSymbol(symbol)) return PIN_FAR_FALLBACK_PCT.stock;
  return volatilityIndexFor(symbol) === 'VXN' ? PIN_FAR_FALLBACK_PCT.nasdaq100 : PIN_FAR_FALLBACK_PCT.sp500;
}

/** Which rule decided whether a pin is far. */
export type PinFarBasis = 'expected-move' | 'percent';

/** How far the pin sits from spot, and whether that counts as far. */
export interface PinDistance {
  /** Pin minus spot, in price units: positive when the pin is above spot. */
  points: number;
  /** The same distance as a signed percent of spot. */
  pct: number;
  /** |pin − spot| ÷ the daily expected move; null under the percent fallback. */
  expectedMoves: number | null;
  basis: PinFarBasis;
  /** The cutoff the rule applied, in percent of spot. */
  thresholdPct: number;
  /** True when the pin sits farther from spot than the cutoff. */
  far: boolean;
}

/**
 * Measure the pin against spot and decide whether it is far.
 *
 * `expectedMove` is the ±1σ daily move in price units, the Daily Expected
 * Range's half-width (`dailyExpectedMove` in app/live-bulletin/bulletinHelpers).
 * Pass null or leave it out where there is no vol reading, and the percent
 * fallback for `symbol` decides instead.
 *
 * Null when there is no pin (null, non-finite or non-positive, the same rule
 * `classifyPinStrength` applies) or no usable spot to measure from, so a
 * caller can never call a pin far on a missing price.
 */
export function pinDistance(args: {
  pinStrike: number | null | undefined;
  spot: number | null | undefined;
  expectedMove?: number | null;
  symbol?: string | null;
}): PinDistance | null {
  const { pinStrike, spot, expectedMove } = args;
  if (pinStrike == null || !Number.isFinite(pinStrike) || pinStrike <= 0) return null;
  if (spot == null || !Number.isFinite(spot) || spot <= 0) return null;
  const points = pinStrike - spot;
  const pct = (points / spot) * 100;
  if (expectedMove != null && Number.isFinite(expectedMove) && expectedMove > 0) {
    const expectedMoves = Math.abs(points) / expectedMove;
    return {
      points,
      pct,
      expectedMoves,
      basis: 'expected-move',
      thresholdPct: ((PIN_FAR_EXPECTED_MOVES * expectedMove) / spot) * 100,
      far: expectedMoves > PIN_FAR_EXPECTED_MOVES,
    };
  }
  const thresholdPct = pinFarFallbackPct(args.symbol);
  return {
    points,
    pct,
    expectedMoves: null,
    basis: 'percent',
    thresholdPct,
    far: Math.abs(pct) > thresholdPct,
  };
}

/** The word a far pin carries in place of its strength. */
export const PIN_FAR_LABEL = 'Far';

/**
 * A far pin's line opacity, shared so every chart fades it the same amount:
 * well below the ~0.85 an ordinary level line draws at. Only the line fades;
 * the label stays at full strength so the word FAR itself reads clearly.
 */
export const PIN_FAR_LINE_OPACITY = 0.35;

/** The short line a far pin's tile shows under its distance. */
export const PIN_FAR_NOTE = 'Far · no nearby pin';

/** "1.19% above spot" — unsigned percent and a side, never a bare sign. */
function pinSideLabel(distance: PinDistance): string {
  return `${Math.abs(distance.pct).toFixed(2)}% ${distance.points >= 0 ? 'above' : 'below'} spot`;
}

/** Trims a trailing ".0": "1%" and "1.25%", not "1.00%". */
function trimPct(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * The full explanation of a far pin, for a tooltip or a card's hover title:
 * how far it is, by which rule, and what it means.
 *
 *   "Far from spot: 1.19% above spot, 0.94 of the daily expected move. ..."
 *   "Far from spot: 1.19% above spot, more than the 1% that counts as far
 *    without a live volatility reading. ..."
 */
export function pinFarDetail(distance: PinDistance): string {
  const how =
    distance.expectedMoves != null
      ? `${pinSideLabel(distance)}, ${distance.expectedMoves.toFixed(2)} of the daily expected move`
      : `${pinSideLabel(distance)}, more than the ${trimPct(distance.thresholdPct)}% that counts as far without a live volatility reading`;
  return (
    `Far from spot: ${how}. There is no nearby pin: too little positive dealer gamma ` +
    'sits near price, so the model’s best candidate is a distant one. In short ' +
    'gamma that means nothing nearby is stabilizing price. Read the level as context, ' +
    'not a target.'
  );
}

/**
 * The far explanation in one line, for a level list with room for a sentence
 * but not a paragraph (the free gamma-levels card and table):
 *
 *   "Far: 1.19% above spot · no nearby pin. With little positive dealer gamma
 *    near price, the model's best pin is a distant strike: context, not a
 *    target."
 */
export function pinFarHint(distance: PinDistance): string {
  return (
    `${PIN_FAR_LABEL}: ${pinSideLabel(distance)} · no nearby pin. With little positive ` +
    'dealer gamma near price, the model’s best pin is a distant strike: context, not a target.'
  );
}

/** Pin strength, or `far` when the pin sits far from spot. */
export type PinDisplay = PinStrength | 'far';

/**
 * What a surface should call this pin: its strength bucket, `far` in place of
 * any strength when `distance` says so, or `none` when there is no pin. The
 * one place the far rule overrides the strength word, so STRONG or MODERATE
 * can never be printed on a far pin.
 */
export function classifyPinDisplay(
  pinStrike: number | null | undefined,
  pinConfidence: number | null | undefined,
  distance?: PinDistance | null,
): PinDisplay {
  const strength = classifyPinStrength(pinStrike, pinConfidence);
  if (strength === 'none') return 'none';
  return distance?.far ? 'far' : strength;
}

/**
 * The Pin's label on a CHART LINE: "Pin · Strong" for an active pin, and a bare
 * "Pin" only when there is no pin to qualify at all. A missing confidence still
 * classifies (as Weak, via `classifyPinStrength`) rather than dropping the
 * suffix — the same answer `pinStrikeSubtitle` gives the tiles, so one pin
 * cannot read two ways depending on which surface you are looking at.
 *
 * A far pin reads "Pin · Far" whatever its strength (see `pinDistance`); pass
 * the distance for the same pin and spot the line is drawn against.
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
  distance?: PinDistance | null,
): string {
  const display = classifyPinDisplay(pinStrike, pinConfidence, distance);
  if (display === 'none') return 'Pin';
  return `Pin · ${display === 'far' ? PIN_FAR_LABEL : STRENGTH_LABEL[display]}`;
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
 *
 * A far pin reads "Far: 1.19% above spot · no nearby pin" instead, with no
 * strength word and no percent: the confidence is the winner's share of the
 * field, and a lone distant candidate scores high on that by default, so the
 * number is the misleading half of the old subtitle, not context for it.
 */
export function pinStrikeSubtitle(
  pinStrike: number | null | undefined,
  pinConfidence: number | null | undefined,
  distance?: PinDistance | null,
): string {
  const display = classifyPinDisplay(pinStrike, pinConfidence, distance);
  if (display === 'none') return STRENGTH_LABEL.none;
  if (display === 'far') {
    // `far` is only ever returned with a distance; the bare word is a guard.
    return distance ? `${PIN_FAR_LABEL}: ${pinSideLabel(distance)} · no nearby pin` : PIN_FAR_LABEL;
  }
  const pct = pinConfidence != null ? ` · ${Math.round(pinConfidence * 100)}%` : '';
  return `Pin strength: ${STRENGTH_LABEL[display]}${pct}`;
}

/** The shared tooltip copy for the Pin Strike metric. */
/** The session-path facts behind the stability note. */
export interface PinStabilityRead {
  held_pin: number;
  held_since: string;
  net_migration: number;
  distinct_values: number;
  /** False while the pin standing now has not yet settled at its strike. */
  current_established: boolean;
}

/** Strikes are discrete; a trailing ".0" on every reading is noise. */
function trimStrike(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

/**
 * One line describing what the pin has DONE this session.
 *
 * Three shapes, because they are genuinely different reads:
 *
 *   • settled, never moved  → "Held since 09:41"
 *   • settled, has moved    → "-30 pts today · held since 14:05"
 *   • not settled yet       → "Held 7675 since 09:30"
 *
 * A migrated pin leads with the signed distance, since that is the fact a
 * trader watching the level walk away needs first, and the distance is measured
 * from the session's opening settled level — "how far has this traveled", not
 * "how big was the last hop".
 *
 * The third shape names the strike explicitly, and that is the point: while the
 * current pin is provisional the card's headline value and the settled level
 * are DIFFERENT numbers, so "Held since 09:30" alone would read as if the
 * headline value had held since the open. A one-minute tick at the bell is not
 * a migration, and it must not be dressed as one.
 *
 * Returns null when there is nothing to say — no reading, or a timestamp that
 * will not parse — so the caller renders nothing rather than a zeroed line.
 */
export function pinStabilityNote(
  stability: PinStabilityRead | null | undefined,
): string | null {
  if (!stability) return null;
  const t = new Date(stability.held_since);
  if (Number.isNaN(t.getTime())) return null;
  const held = t.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (!stability.current_established) {
    return `Held ${trimStrike(stability.held_pin)} since ${held}`;
  }
  if (!(stability.distinct_values > 1) || stability.net_migration === 0) {
    return `Held since ${held}`;
  }
  // U+2212 minus, not a hyphen: this sits next to prices in a tabular column.
  const move = stability.net_migration;
  const sign = move > 0 ? '+' : '\u2212';
  return `${sign}${trimStrike(Math.abs(move))} pts today \u00b7 held since ${held}`;
}

export const PIN_STRIKE_TOOLTIP =
  'Pin Strike estimates the nearby 0DTE strike with the strongest combination ' +
  'of positive dealer-gamma stabilization and the probability of price reaching ' +
  'that area before expiration. It is a modeled pinning level, not a guaranteed ' +
  'price target. Strength measures how far the winning strike DOMINATES the ' +
  'other viable strikes, not how large its gamma is\u00a0- so "Weak" means the ' +
  'gamma is spread across a neighborhood rather than concentrated on one ' +
  'strike, not that the level is insignificant. A pin more than about three-' +
  'quarters of a daily expected move from price is labeled "Far" instead: ' +
  'there is no nearby pin, and in short gamma that means no stabilizing ' +
  'gamma near price.';
