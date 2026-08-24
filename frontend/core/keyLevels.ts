/**
 * Key Levels — the shared, pure model behind every "at a glance" readout of the
 * dealer-positioning levels the Gamma Chart draws.
 *
 * One trader question ("where are the levels right now?") was answered in three
 * different places with three slightly different formats: the Call/Put Wall
 * cards on the main dashboard, the Gamma Flip / Max Pain cards
 * (PriceDistanceMetricCard), and the Pin Strike card on /greeks-gex. This module
 * is the single source of truth for the *presentation* of those levels — the
 * value string, the distance-from-spot string, and the empty state — so the
 * top-of-page strip, the My Dashboard widget and the existing cards can never
 * drift apart.
 *
 * It is deliberately pure (no React, no fetching): the levels themselves come
 * from useGammaPlaybook, which resolves them exactly as the chart does for the
 * symbol and expirations the trader has selected.
 *
 * The empty-state rule is load-bearing and matches core/pinStrike: a level that
 * the book cannot resolve renders an em-dash plus a short reason. Never a blank
 * cell, and never `$0.00` — a zero strike would read as a real level.
 */

/**
 * The em-dash empty state. Must stay identical to core/pinStrike's
 * PIN_STRIKE_EMPTY — a unit test asserts the two agree. It is restated rather
 * than imported because every core module covered by the Node test runner is
 * runtime-dependency-free (type-stripping resolves no bare specifiers), and
 * that convention is worth more than sharing one character.
 */
export const KEY_LEVEL_EMPTY = '—';

export type KeyLevelId = 'spot' | 'flip' | 'pin' | 'callWall' | 'putWall' | 'maxPain';

export interface KeyLevelDistance {
  /** True when the level sits at or above spot (or the change is positive). */
  isAbove: boolean;
  delta: number;
  pct: number;
  /** "+$2.15" — signed dollars, 2dp, exactly as the wall cards render it. */
  deltaLabel: string;
  /** "+0.35%" — signed percent, 2dp. */
  pctLabel: string;
  /** "above spot" / "below spot" (or the caller's own basis wording). */
  relationLabel: string;
  /** "+$2.15 / +0.35% above spot" — the wall-card subtitle, verbatim. */
  label: string;
}

export interface KeyLevel {
  id: KeyLevelId;
  /** Full card label ("Gamma Flip"). */
  label: string;
  /** Raw level, or null when the book could not resolve it. */
  value: number | null;
  /** "$612.34", or KEY_LEVEL_EMPTY when there is no level. */
  valueLabel: string;
  /** Distance from spot, or null (no level, or no spot to measure against). */
  distance: KeyLevelDistance | null;
  /** Shown in place of the distance when there is none. Never blank. */
  emptyNote: string | null;
  /** Optional secondary metadata (Pin Strike's strength bucket). */
  note: string | null;
  tooltip: string;
}

function finite(value: unknown): number | null {
  // An empty string is absent data, not zero — the same coercion the chart's
  // own bucket reader uses, so a blank column never becomes a $0 strike.
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/**
 * A level is only real when it is a positive price. The backend emits null for
 * an unresolved flip / wall / pin, but a defensive zero check keeps a degraded
 * payload from rendering "$0.00" as if it were a level (see core/pinStrike).
 */
function positiveLevel(value: number | null | undefined): number | null {
  const n = finite(value);
  return n != null && n > 0 ? n : null;
}

/** "$612.34", or the em-dash empty state. Never "$0.00", never "NaN". */
export function formatKeyLevelValue(value: number | null | undefined): string {
  const n = positiveLevel(value);
  return n == null ? KEY_LEVEL_EMPTY : `$${n.toFixed(2)}`;
}

/**
 * Distance from spot in the wall cards' own format — the shared implementation
 * behind PriceDistanceMetricCard's subtitle and the Key Levels strip.
 *
 * Returns null when either side is missing, so callers render their own
 * "why is this empty" note rather than a misleading zero distance.
 */
export function keyLevelDistance(
  level: number | null | undefined,
  spot: number | null | undefined,
  relation: { above: string; below: string } = { above: 'above spot', below: 'below spot' },
): KeyLevelDistance | null {
  const l = finite(level);
  const s = finite(spot);
  if (l == null || s == null || s === 0) return null;

  const delta = l - s;
  const pct = (delta / s) * 100;
  const isAbove = delta >= 0;
  const deltaLabel = `${isAbove ? '+' : '-'}$${Math.abs(delta).toFixed(2)}`;
  const pctLabel = `${isAbove ? '+' : '-'}${Math.abs(pct).toFixed(2)}%`;
  const relationLabel = isAbove ? relation.above : relation.below;

  return {
    isAbove,
    delta,
    pct,
    deltaLabel,
    pctLabel,
    relationLabel,
    label: `${deltaLabel} / ${pctLabel} ${relationLabel}`,
  };
}

/**
 * Session change for the Spot card, shaped like a level distance so the strip
 * renders one uniform subtitle line. Built from the change the tape already
 * computed (core/priceChange) rather than re-deriving it.
 */
function spotChangeDistance(
  change: number | null | undefined,
  changePercent: number | null | undefined,
): KeyLevelDistance | null {
  const d = finite(change);
  const p = finite(changePercent);
  if (d == null || p == null) return null;
  const isAbove = d >= 0;
  const deltaLabel = `${isAbove ? '+' : '-'}$${Math.abs(d).toFixed(2)}`;
  const pctLabel = `${isAbove ? '+' : '-'}${Math.abs(p).toFixed(2)}%`;
  const relationLabel = 'vs prior close';
  return {
    isAbove,
    delta: d,
    pct: p,
    deltaLabel,
    pctLabel,
    relationLabel,
    label: `${deltaLabel} / ${pctLabel} ${relationLabel}`,
  };
}

/**
 * Max Pain from a bucket's per-strike open interest — the strike that minimizes
 * total in-the-money option value (writers' payout) across the chain:
 * Σ callOI·(K−s) for s<K plus Σ putOI·(s−K) for s>K.
 *
 * Lives here rather than inside the chart because the chart, the Playbook and
 * the Key Levels surfaces all have to agree on the number when an expiration
 * filter is active: the served summary's max_pain is whole-chain, so a filtered
 * view has to recompute it from the filtered book or it would contradict the
 * line drawn on the chart. Structurally typed so core stays free of hook types.
 */
export function computeMaxPainFromStrikes(
  strikes: ReadonlyArray<{
    strike?: number | string;
    call_oi?: number | string | null;
    put_oi?: number | string | null;
  }> | undefined | null,
): number | null {
  if (!Array.isArray(strikes)) return null;
  const rows = strikes
    .map((s) => ({ k: finite(s.strike), c: finite(s.call_oi) ?? 0, p: finite(s.put_oi) ?? 0 }))
    .filter((r): r is { k: number; c: number; p: number } => r.k != null)
    .sort((a, b) => a.k - b.k);
  if (rows.length < 3 || !rows.some((r) => r.c > 0 || r.p > 0)) return null;
  let bestK: number | null = null;
  let bestLoss = Infinity;
  for (const cand of rows) {
    let loss = 0;
    for (const r of rows) {
      if (r.k < cand.k) loss += r.c * (cand.k - r.k);
      else if (r.k > cand.k) loss += r.p * (r.k - cand.k);
    }
    if (loss < bestLoss) {
      bestLoss = loss;
      bestK = cand.k;
    }
  }
  return bestK;
}

/**
 * The Pin Strike card's inputs. Its strike is a level like any other, but its
 * strength copy and confidence thresholds belong to core/pinStrike — so the
 * caller composes them there and passes the result in, keeping this module free
 * of runtime imports and keeping the pin's rules in one place.
 */
export interface KeyLevelPinInput {
  strike: number | null | undefined;
  /** "Pin strength: Strong" for an active pin; null when there is none. */
  note: string | null;
  /** Shown when there is no pin at all — pinStrengthLabel('none'). */
  absentLabel: string;
  tooltip: string;
}

export interface KeyLevelsInput {
  spot: number | null | undefined;
  /** Session change for the Spot card (core/priceChange's tape reading). */
  spotChange?: number | null;
  spotChangePercent?: number | null;
  flip: number | null | undefined;
  pin: KeyLevelPinInput;
  callWall: number | null | undefined;
  putWall: number | null | undefined;
  maxPain: number | null | undefined;
}

const TOOLTIPS: Record<Exclude<KeyLevelId, 'pin'>, string> = {
  spot: 'The underlying price every distance below is measured from — the same tape reading the chart’s price marker rides.',
  flip: 'Price where aggregate net dealer gamma changes sign. Above it dealers dampen moves (pinning); below it they amplify them (trending).',
  callWall: 'Strike with the heaviest call open interest. Tends to act as resistance as dealers sell into rallies toward it.',
  putWall: 'Strike with the heaviest put open interest. Tends to act as support as dealers buy into selloffs toward it.',
  maxPain: 'Estimated strike where option-holder payout is minimized at expiry — the options pin.',
};

/**
 * Reason copy for a card with no distance to show, in PriceDistanceMetricCard's
 * own precedence: a missing spot is reported as a missing spot (the level may
 * be perfectly fine), and only then is the level itself called unresolved.
 */
function emptyNoteFor(hasLevel: boolean, hasSpot: boolean): string {
  if (!hasSpot) return 'Awaiting price';
  return hasLevel ? 'Awaiting price' : 'Unresolved this snapshot';
}

/**
 * The ordered set of levels the Key Levels surfaces render.
 *
 * Spot leads because it is the reference every other row is measured against;
 * then the regime boundary (Flip), then the pin and the two walls, then Max
 * Pain. Every level is always returned — a missing one carries the em-dash and
 * its reason, so the strip's shape doesn't jump around as the book resolves.
 */
export function buildKeyLevels(input: KeyLevelsInput): KeyLevel[] {
  const spot = positiveLevel(input.spot);
  const hasSpot = spot != null;

  const priced = (
    id: Exclude<KeyLevelId, 'spot' | 'pin'>,
    label: string,
    value: number | null | undefined,
  ): KeyLevel => {
    const level = positiveLevel(value);
    const distance = keyLevelDistance(level, spot);
    return {
      id,
      label,
      value: level,
      valueLabel: formatKeyLevelValue(level),
      distance,
      emptyNote: distance ? null : emptyNoteFor(level != null, hasSpot),
      note: null,
      tooltip: TOOLTIPS[id],
    };
  };

  const pin = positiveLevel(input.pin.strike);
  const pinDistance = keyLevelDistance(pin, spot);
  // Only when there is a price to attach it to — a change line under an
  // em-dash would be a move in a price we are not showing.
  const spotDistance = hasSpot
    ? spotChangeDistance(input.spotChange, input.spotChangePercent)
    : null;

  return [
    {
      id: 'spot',
      label: 'Spot',
      value: spot,
      valueLabel: formatKeyLevelValue(spot),
      distance: spotDistance,
      emptyNote: spotDistance ? null : hasSpot ? 'Awaiting change context' : 'Awaiting price',
      note: null,
      tooltip: TOOLTIPS.spot,
    },
    priced('flip', 'Gamma Flip', input.flip),
    {
      id: 'pin',
      label: 'Pin Strike',
      value: pin,
      valueLabel: formatKeyLevelValue(pin),
      distance: pinDistance,
      // "No active pin" is the honest empty state ONLY when there is no pin —
      // a resolved pin with no spot to measure against is a missing price.
      emptyNote: pinDistance ? null : pin == null ? input.pin.absentLabel : emptyNoteFor(true, hasSpot),
      // Strength is the Pin's own metadata, not a distance — carried separately
      // so the compact strip can put it in the title without a second line.
      note: pin == null ? null : input.pin.note,
      tooltip: input.pin.tooltip,
    },
    priced('callWall', 'Call Wall', input.callWall),
    priced('putWall', 'Put Wall', input.putWall),
    priced('maxPain', 'Max Pain', input.maxPain),
  ];
}

/**
 * The dealer-gamma regime chip that heads the strip. Deliberately a plain
 * label + the app's existing bull/bear tone — the colour-coded regime rewrite
 * is a separate track, so this reuses what already exists and adds no scheme.
 */
export interface KeyLevelsRegime {
  label: string;
  /** null when the regime is genuinely unknown — render nothing, not a guess. */
  long: boolean | null;
  detail: string;
}

export function keyLevelsRegime(longGamma: boolean | null): KeyLevelsRegime | null {
  if (longGamma == null) return null;
  return {
    long: longGamma,
    label: longGamma ? 'Long γ' : 'Short γ',
    detail: longGamma
      ? 'Dealers are modeled long gamma at spot — hedging dampens moves (pinning).'
      : 'Dealers are modeled short gamma at spot — hedging amplifies moves (trending).',
  };
}
