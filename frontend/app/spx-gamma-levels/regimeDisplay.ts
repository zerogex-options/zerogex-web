// The regime badge on the free levels pages: each ticker card on the
// /<ticker>-gamma-levels pages and each panel on /gex-levels.
//
// Determined the same way as the live app's Today's Read (buildReportModel →
// detectRegime): by where spot sits relative to the gamma flip, with a ±0.25%
// "at the flip" band, and when the snapshot has no flip, by the sign of net GEX
// AT SPOT (never the whole-chain net-GEX total, which can carry the opposite
// sign). One shared methodology means the card badge and the Today's Read badge
// can never disagree for the same snapshot, and with no flip both match the Key
// Levels chip, which reads the same sign (core/gammaRegime longGammaAtSpot).
//
// Pure, with relative `.ts` imports, so the Node test runner covers it
// (tests/gexLevels.test.ts); gammaLevels.tsx itself can't be imported there.

import { detectRegime, type RegimeKey } from '../live-bulletin/bulletinHelpers.ts';
import { netGexAtSpotOrNull } from '../../core/gammaRegime.ts';

export type RegimeDisplay = {
  label: string;
  color: string;
  icon: 'up' | 'down' | 'flat' | 'none';
  body: string;
};

// The three fields the badge reads, as any summary shape carries them (the
// levels pages' GexSummary and the bulletin's GexSummaryInput both fit).
type RegimeInput =
  | { gamma_flip?: number | null; spot_price?: number | null; net_gex_at_spot?: number | null }
  | null
  | undefined;

export const REGIME_DISPLAY: Record<RegimeKey, RegimeDisplay> = {
  positive: {
    label: 'Positive gamma (suppressed vol)',
    color: 'var(--color-positive)',
    icon: 'up',
    body: 'Dealers are net long gamma at spot\u00a0- mean-reversion is favored, pinning is more likely, and hedging leans against breakouts.',
  },
  negative: {
    label: 'Negative gamma (amplified vol)',
    color: 'var(--color-negative)',
    icon: 'down',
    body: 'Dealers are net short gamma at spot\u00a0- moves can accelerate, and if a wall gives way, hedging adds to the break.',
  },
  neutral: {
    label: 'At the gamma flip',
    color: 'var(--color-warning)',
    icon: 'flat',
    body: 'Spot is sitting on the gamma flip\u00a0- the sign of dealer hedging is unstable here, and a small move tips the tape into the next regime.',
  },
  // Only when the snapshot has neither a flip nor net GEX at spot. A missing
  // flip alone is not this: the sign at spot still gives the regime.
  unresolved: {
    label: 'Gamma regime unresolved',
    color: 'var(--color-text-secondary)',
    icon: 'none',
    body:
      'This snapshot carried neither a gamma flip nor a reading of dealer gamma at spot, so it can’t say which regime spot is in. Read these levels as provisional\u00a0- it normally resolves again on a later snapshot.',
  },
};

// The body for a positive / negative regime read off net GEX at spot because no
// flip sits near spot. Same label, color and icon as with a flip, so the badge
// names the regime plainly; the body adds that there is no flip nearby, which
// is also why the Gamma flip row is blank. Not "provisional": a one-sided book
// with no nearby crossing is a finding, not a gap in the data.
const NO_FLIP_REGIME_BODY: Record<'positive' | 'negative', string> = {
  positive:
    'Dealers are net long gamma at spot, and no gamma flip sits near spot in this snapshot\u00a0- mean-reversion is favored, pinning is more likely, and hedging leans against breakouts.',
  negative:
    'Dealers are net short gamma at spot, and no gamma flip sits near spot in this snapshot\u00a0- moves can accelerate, and if a wall gives way, hedging adds to the break.',
};

/**
 * True when the snapshot has no flip but does have net GEX at spot: the regime
 * then comes off that sign, because no flip sits near spot.
 */
export function noFlipNearSpot(data: RegimeInput): boolean {
  const flip = data?.gamma_flip;
  const hasFlip = flip != null && Number.isFinite(flip);
  return !hasFlip && netGexAtSpotOrNull(data?.net_gex_at_spot) != null;
}

/**
 * The regime badge and body for one ticker's snapshot. Passes the snapshot's
 * net GEX at spot to detectRegime exactly as buildReportModel does for Today's
 * Read, so a snapshot with no flip shows the same positive / negative regime on
 * the card, the /gex-levels panel and Today's Read, instead of "unresolved".
 */
export function regimeDisplayFor(data: RegimeInput): RegimeDisplay {
  const key = detectRegime(data?.gamma_flip, data?.spot_price, netGexAtSpotOrNull(data?.net_gex_at_spot));
  if ((key === 'positive' || key === 'negative') && noFlipNearSpot(data)) {
    return { ...REGIME_DISPLAY[key], body: NO_FLIP_REGIME_BODY[key] };
  }
  return REGIME_DISPLAY[key];
}
