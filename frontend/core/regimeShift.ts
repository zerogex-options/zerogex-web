/**
 * Gamma Regime Shift — types and copy generation for the Gamma Shift page.
 *
 * The scoring lives in the API (`src/analytics/regime_shift.py`): the two
 * axes, the quadrant, the z-scores and the adverb all arrive already
 * computed, because the same code has to produce the stored per-session
 * history the strip renders. What lives HERE is the sentence — turning the
 * classified read into the line a trader takes in at a glance.
 *
 * Kept pure and framework-free (no React, no imports) so the copy rules run
 * under the Node test runner like core/sessionDelta.ts and core/strikeFilter.ts.
 * The headline is the product; it deserves tests, not a snapshot of a JSX tree.
 *
 * ---------------------------------------------------------------------------
 * A note on "bullish"
 * ---------------------------------------------------------------------------
 * The vernacular calls any positive-gamma regime "bullish", which conflates
 * two different things. Positive gamma near spot is STABILIZING — dealers
 * hedge against moves, vol compresses — regardless of which side of spot the
 * strikes sit on. Whether it is SUPPORTIVE depends entirely on where it
 * landed: gamma built below spot is a floor, the identical build above spot
 * is a ceiling. The copy here keeps those separate, which is why a session
 * can read "stabilizing, but capping" — a sentence the single-axis view
 * cannot express and traders regularly need.
 */

// ---------------------------------------------------------------------------
// API payload types
// ---------------------------------------------------------------------------

export type RegimeState =
  | 'FIRMING'
  | 'CAPPING'
  | 'FRAGILE_BID'
  | 'DETERIORATING'
  | 'QUIET';

/** How the z-scores were normalized — the card's confidence in its adverb. */
export type Normalization = 'trailing' | 'proxy' | 'none';

export type Lookback =
  | 'session'
  | '30m'
  | '1h'
  | '2h'
  | '4h'
  | 'prev_close'
  | 'prev_same_time'
  | 'week';

export type Lens = 'net' | 'positioning';

export interface RegimeLevels {
  timestamp?: string | null;
  spot?: number | null;
  gamma_flip?: number | null;
  call_wall?: number | null;
  put_wall?: number | null;
  max_pain?: number | null;
  net_gex_at_spot?: number | null;
  total_net_gex?: number | null;
}

export interface RegimeRead {
  state: RegimeState;
  adverb: string;
  lean_z: number;
  stability_z: number;
  magnitude: number;
  meaning: string;
  normalization: Normalization;
  sessions_in_window: number;
}

export interface ShiftScores {
  lean: number;
  stability: number;
  net_shift: number;
  gross_shift: number;
  sigma_price: number;
  /** Proximity-weighted |dealer gamma| the change was measured against. */
  near_spot_stock?: number;
  /** Trading hours the window spans — what the sigma was scaled by. */
  window_hours?: number;
}

/**
 * Whether the `positioning` lens can answer anything in THIS window.
 *
 * Open interest is a once-a-day settlement figure: the feed republishes the
 * same number all session, so an intraday A→B pair carries an identical OI at
 * every strike and the OI-driven component is zero at every strike — by
 * construction, not because dealers sat on their hands. A ribbon drawn from
 * that reads as "nothing was traded anywhere", which is a claim the data
 * cannot support, so the surface says what it cannot see instead.
 */
export interface PositioningSupport {
  resolved: boolean;
  oi_moved_strikes: number;
  strike_count: number;
}

export interface ShiftBand {
  low: number;
  high: number;
  share: number;
  resolved: boolean;
}

export interface ShiftStrike {
  strike: number;
  net_a: number;
  net_b: number;
  d_net: number;
  positioning: number;
  repricing: number;
  call_oi_delta: number;
  put_oi_delta: number;
}

export interface ExpiryScope {
  common: string[];
  common_count: number;
  expired: string[];
  expired_net_gex: number;
  expired_abs_gex: number;
  added: string[];
  added_net_gex: number;
}

export interface RolloffSummary {
  expiration: string;
  dte: number;
  net_gex: number;
  abs_gex: number;
  share: number;
  chain_abs_gex: number;
}

export interface RegimeShiftPayload {
  symbol: string;
  lookback: Lookback;
  lookback_label: string;
  lens: Lens;
  spot: number;
  session_date: string;
  from: RegimeLevels;
  to: RegimeLevels;
  read: RegimeRead;
  scores: ShiftScores;
  band: ShiftBand;
  strikes: ShiftStrike[];
  strikes_truncated: boolean;
  expiry_scope: ExpiryScope;
  rolloff: RolloffSummary | null;
  /** Older API builds omit this; treat a missing block as "unknown". */
  positioning?: PositioningSupport;
}

export interface RolloffTranche {
  expiration: string;
  dte: number;
  net_gex: number;
  abs_gex: number;
  share: number;
}

export interface ExpiryRolloffPayload {
  symbol: string;
  as_of: string;
  session_date: string;
  spot: number | null;
  total_abs_gex: number;
  total_net_gex: number;
  next: { expiration: string; dte: number; net_gex: number; abs_gex: number; share: number };
  context: {
    percentile: number | null;
    verdict: string | null;
    sessions_in_window: number;
  };
  tranches: RolloffTranche[];
  tranches_folded: boolean;
  next_by_strike: Array<{ strike: number; net_gex: number }>;
}

export interface RegimeHistorySession {
  session_date: string;
  state: RegimeState;
  adverb: string;
  lean_z: number;
  stability_z: number;
  magnitude: number;
  lean_raw: number;
  stability_raw: number;
  net_shift: number | null;
  spot_open: number | null;
  spot_close: number | null;
  band_low: number | null;
  band_high: number | null;
  band_resolved: boolean;
  rolloff_share: number | null;
  rolloff_expiration: string | null;
  gamma_flip_open: number | null;
  gamma_flip_close: number | null;
  expired_expiration_count: number | null;
}

export interface RegimeHistoryPayload {
  symbol: string;
  sessions: RegimeHistorySession[];
  normalization: Normalization;
  sessions_in_window: number;
}

// ---------------------------------------------------------------------------
// State presentation
// ---------------------------------------------------------------------------

export interface StateMeta {
  /** Display name — the word on the chip. */
  label: string;
  /** Which CSS colour token carries this state. */
  tone: 'bull' | 'bear' | 'warning' | 'info' | 'muted';
  /**
   * Direction glyph. Present so the chip is never colour-alone: red and
   * green separate at ΔE 34 for normal vision but collapse to ~5 under
   * deuteranopia, and this card's entire job is direction.
   */
  glyph: string;
  /** The two axes in plain words, for the sub-chips under the state. */
  stability: 'stabilizing' | 'destabilizing' | 'unchanged';
  direction: 'supportive' | 'capping' | 'unchanged';
}

export const STATE_META: Record<RegimeState, StateMeta> = {
  FIRMING: {
    label: 'Firming',
    tone: 'bull',
    glyph: '↗',
    stability: 'stabilizing',
    direction: 'supportive',
  },
  CAPPING: {
    label: 'Capping',
    tone: 'info',
    glyph: '↘',
    stability: 'stabilizing',
    direction: 'capping',
  },
  FRAGILE_BID: {
    label: 'Fragile bid',
    tone: 'warning',
    glyph: '↗',
    stability: 'destabilizing',
    direction: 'supportive',
  },
  DETERIORATING: {
    label: 'Deteriorating',
    tone: 'bear',
    glyph: '↘',
    stability: 'destabilizing',
    direction: 'capping',
  },
  QUIET: {
    label: 'Quiet',
    tone: 'muted',
    glyph: '→',
    stability: 'unchanged',
    direction: 'unchanged',
  },
};

/** How far back the card is looking, as a phrase that can end a sentence. */
export const LOOKBACK_LABEL: Record<Lookback, string> = {
  '30m': 'Last 30m',
  '1h': 'Last 1h',
  '2h': 'Last 2h',
  '4h': 'Last 4h',
  session: 'Since open',
  prev_close: 'vs Prior close',
  prev_same_time: 'vs Yesterday',
  week: 'vs Last week',
};

/**
 * The lookbacks the page offers, in the order they appear.
 *
 * `prev_same_time` rather than `prev_close` is the day-over-day default:
 * dealer gamma has strong time-of-day seasonality (0DTE pinning at 15:55 is
 * structurally nothing like 09:35), so comparing noon today against
 * yesterday's close measures the clock as much as the book.
 */
export const LOOKBACK_ORDER: Lookback[] = [
  '1h',
  'session',
  'prev_same_time',
  'prev_close',
  'week',
];

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function compactDollars(abs: number): string {
  if (abs >= 1e9) return `$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(0)}K`;
  return `$${abs.toFixed(0)}`;
}

/** Compact dollars with an explicit sign, e.g. "+$1.2B" / "−$430M". */
export function formatSignedGex(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  if (value === 0) return '$0';
  return `${value > 0 ? '+' : '−'}${compactDollars(Math.abs(value))}`;
}

/**
 * Compact dollars with NO sign — for magnitudes.
 *
 * Absolute-gamma figures (a tranche's gross size, the chain total) are
 * magnitudes, not signed quantities. Rendering them through the signed
 * formatter prints "+$4.56B expiring", which reads as a gain when it is a
 * quantity leaving, and invites the reader to compare it against the signed
 * net right beside it as though the two were the same kind of number.
 */
export function formatGexMagnitude(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return compactDollars(Math.abs(value));
}

/** Strike label, dropping a trailing ".0". */
export function formatStrike(strike: number | null | undefined): string {
  if (strike == null || !Number.isFinite(strike)) return '—';
  return Number.isInteger(strike) ? String(strike) : strike.toFixed(strike < 50 ? 1 : 0);
}

export function formatZ(z: number | null | undefined): string {
  if (z == null || !Number.isFinite(z)) return '—';
  return `${z > 0 ? '+' : z < 0 ? '−' : ''}${Math.abs(z).toFixed(1)}σ`;
}

export function formatPercent(fraction: number | null | undefined, digits = 0): string {
  if (fraction == null || !Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** "764–770" when the band resolved, otherwise null. */
export function formatBand(band: ShiftBand | null | undefined): string | null {
  if (!band || !band.resolved) return null;
  const low = formatStrike(band.low);
  const high = formatStrike(band.high);
  return low === high ? low : `${low}–${high}`;
}

// ---------------------------------------------------------------------------
// The repositioning lens
// ---------------------------------------------------------------------------

/**
 * Whether the *positioning* lens has anything to show in this window.
 *
 * Only meaningful when that lens is selected — on the `net` lens the answer is
 * irrelevant and this returns true so the ordinary copy runs.
 *
 * Open interest is published once a day, at settlement. Within a session the
 * feed republishes the same number, so an intraday A→B pair has
 * `oi_b − oi_a === 0` at every strike and the OI-driven component of the
 * change is exactly zero everywhere. The ribbon then draws a flat line of
 * minimum-height bars, which reads as "dealers touched nothing all day" — the
 * strongest possible claim, made from an absence of data.
 *
 * A missing `positioning` block (an older API build) is treated as resolved:
 * the old rendering is wrong but not misleading in a NEW way, and inventing a
 * warning from a field that is not there would be its own guess.
 */
export function positioningResolved(payload: RegimeShiftPayload): boolean {
  if (payload.lens !== 'positioning') return true;
  if (!payload.positioning) return true;
  return payload.positioning.resolved;
}

/** Cross-session lookbacks, the ones that straddle a settlement. */
const CROSS_SESSION_LOOKBACKS: readonly Lookback[] = [
  'prev_same_time',
  'prev_close',
  'week',
];

export function isCrossSession(lookback: Lookback): boolean {
  return CROSS_SESSION_LOOKBACKS.includes(lookback);
}

/**
 * Why the repositioning lens is empty, and what to do about it.
 *
 * Names the mechanism rather than the symptom: a reader told "open interest
 * only republishes at settlement" understands why every intraday window looks
 * like this and stops re-checking, where one told "no data" tries again in an
 * hour and gets the same blank chart.
 */
export function describePositioningGap(payload: RegimeShiftPayload): string {
  const crossSession = isCrossSession(payload.lookback);
  if (crossSession) {
    return (
      'Open interest has not moved at any strike between these two snapshots, ' +
      'so there is no repositioning to attribute — the whole change is the ' +
      'existing book re-pricing.'
    );
  }
  return (
    'Open interest is published once a day at settlement, so a window inside ' +
    'one session cannot see contracts open or close. Compare against a prior ' +
    'session to read repositioning.'
  );
}

// ---------------------------------------------------------------------------
// The headline
// ---------------------------------------------------------------------------

/**
 * The one-line read.
 *
 * Shape: what dealers did, how much (the server's adverb), and where. The
 * band is only named when it resolved — quoting a range for a change spread
 * across the chain would invent a level that is not there, which is exactly
 * the failure mode that makes a generated headline untrustworthy.
 */
export function buildHeadline(payload: RegimeShiftPayload): string {
  const { read, band } = payload;
  const where = formatBand(band);
  const at = where ? ` into ${where}` : '';
  const across = where ? ` across ${where}` : '';

  // With no denominator every z is 0, so `classify` lands on QUIET — which
  // would print "No meaningful repositioning" for a session nobody measured.
  // That is the one sentence on this card that must never be guessed at: it
  // is the claim a reader acts on by NOT looking further.
  if (read.normalization === 'none') {
    return 'Not enough history to size this shift.';
  }

  if (read.state === 'QUIET' && !positioningResolved(payload)) {
    return 'No repositioning visible in this window.';
  }

  switch (read.state) {
    case 'FIRMING':
      return `Dealers ${read.adverb} added support${at}.`;
    case 'CAPPING':
      return `Dealers ${read.adverb} built a ceiling${across}.`;
    case 'FRAGILE_BID':
      return `Support ${read.adverb} improved${across}, but the cushion thinned.`;
    case 'DETERIORATING':
      return `Dealer gamma ${read.adverb} shortened${across}.`;
    case 'QUIET':
    default:
      return 'No meaningful repositioning.';
  }
}

/**
 * The supporting line: the regime crossing if there was one, else the axes.
 *
 * A gamma-flip crossing is the single highest-signal event on this card —
 * it is the moment the market changes which way dealers hedge — so it takes
 * the slot whenever it happens, ahead of the (always-true) axis summary.
 */
export function buildSubhead(payload: RegimeShiftPayload): string {
  const { from, to, read } = payload;
  const crossing = describeFlipCrossing(from, to);
  if (crossing) return crossing;

  const meta = STATE_META[read.state];
  if (read.normalization === 'none') {
    return 'The direction is measured; the size is not, until sessions accumulate.';
  }
  if (read.state === 'QUIET' && !positioningResolved(payload)) {
    return describePositioningGap(payload);
  }
  if (read.state === 'QUIET') {
    return 'Walls and flip held. The prior read still applies.';
  }
  return `Near-spot gamma is ${meta.stability}, and the change landed ${
    meta.direction === 'supportive' ? 'below spot' : 'above spot'
  }.`;
}

/**
 * "Spot crossed above the gamma flip" and friends, or null when it did not.
 *
 * Compares spot to the flip at BOTH ends rather than watching the flip level
 * alone: the flip sliding 3 points is noise if spot slid with it, and the
 * thing that actually changed the regime is which side of it price sits on.
 */
export function describeFlipCrossing(
  from: RegimeLevels,
  to: RegimeLevels,
): string | null {
  const beforeAbove = sideOfFlip(from);
  const afterAbove = sideOfFlip(to);
  if (beforeAbove == null || afterAbove == null || beforeAbove === afterAbove) {
    return null;
  }
  return afterAbove
    ? 'Spot crossed above the gamma flip — dealers are long gamma here now.'
    : 'Spot crossed below the gamma flip — dealers are short gamma here now.';
}

function sideOfFlip(levels: RegimeLevels): boolean | null {
  const spot = levels.spot;
  const flip = levels.gamma_flip;
  if (spot == null || flip == null || !Number.isFinite(spot) || !Number.isFinite(flip)) {
    return null;
  }
  return spot >= flip;
}

/**
 * The caveat line, or null when there is nothing to disclose.
 *
 * A day-over-day comparison always drops the tranche that expired overnight
 * (see the API's expiry-aware diff). Saying so is not a footnote — a reader
 * told "$1.4B expired and is excluded" trusts the rest of the card far more
 * than one told nothing, and it pre-empts the obvious "why doesn't this match
 * the raw totals?" question.
 */
export function buildExpiryCaveat(scope: ExpiryScope | null | undefined): string | null {
  if (!scope) return null;
  const parts: string[] = [];
  if (scope.expired.length > 0) {
    parts.push(
      `${scope.expired.join(', ')} expired in between (${formatSignedGex(
        scope.expired_net_gex,
      )}) and is excluded`,
    );
  }
  if (scope.added.length > 0) {
    parts.push(`${scope.added.join(', ')} was newly listed and is excluded`);
  }
  if (parts.length === 0) return null;
  return `Compared on ${scope.common_count} common ${
    scope.common_count === 1 ? 'expiry' : 'expiries'
  } — ${parts.join('; ')}.`;
}

/** How confident the magnitude claim is, or null when it needs no caveat. */
export function buildNormalizationNote(read: RegimeRead): string | null {
  if (read.normalization === 'trailing') return null;
  if (read.normalization === 'proxy') {
    return `Magnitude is provisional — only ${read.sessions_in_window} stored ${
      read.sessions_in_window === 1 ? 'session' : 'sessions'
    }, so it is scaled against the chain's own volatility instead of this symbol's shift history.`;
  }
  return 'No history yet to size this against — the direction is measured, the magnitude is not.';
}

// ---------------------------------------------------------------------------
// Roll-off copy
// ---------------------------------------------------------------------------

/**
 * "38% of dealer gamma expires today — heavy, 94th percentile."
 *
 * The share stands on its own before any history exists; the ranking is
 * appended only once there are enough stored sessions to mean something.
 */
export function buildRolloffSentence(payload: ExpiryRolloffPayload): string {
  const share = formatPercent(payload.next.share);
  const when = payload.next.dte === 0 ? 'at today’s close' : `in ${payload.next.dte}d`;
  const base = `${share} of dealer gamma expires ${when}`;
  const { verdict, percentile } = payload.context;
  if (!verdict || percentile == null) {
    return `${base}.`;
  }
  return `${base} — ${verdict} for ${payload.symbol} (${ordinal(
    Math.round(percentile * 100),
  )} percentile).`;
}

/**
 * What the expiring tranche was DOING, so its removal is interpretable.
 *
 * A net-positive tranche leaving means the stabilizing gamma is what goes;
 * a net-negative one leaving means the accelerant does. Same headline share,
 * opposite consequence for tomorrow, and the share alone cannot tell them
 * apart because it is measured on absolute gamma.
 */
export function buildRolloffConsequence(payload: ExpiryRolloffPayload): string {
  const net = payload.next.net_gex;
  if (!Number.isFinite(net) || net === 0) {
    return 'The expiring tranche is roughly balanced — its removal is close to neutral.';
  }
  return net > 0
    ? `It is net long gamma (${formatSignedGex(
        net,
      )}), so the stabilizing side is what leaves — expect a looser tape after.`
    : `It is net short gamma (${formatSignedGex(
        net,
      )}), so the accelerant is what leaves — expect a calmer tape after.`;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

// ---------------------------------------------------------------------------
// Level rows
// ---------------------------------------------------------------------------

/**
 * A before → after row for the levels column.
 *
 * `direction` is which way the NUMBER moved; `sense` is whether that is good
 * for the tape. They are not the same thing — a gamma flip dropping is a
 * falling number and a bullish event — and binding them to one field is what
 * makes every flip-crossing row render the wrong colour.
 */
export interface LevelRow {
  key: string;
  label: string;
  before: string;
  after: string;
  direction: 'up' | 'down' | 'flat';
  sense: 'good' | 'bad' | 'flat';
  note: string;
}

const LEVEL_EPSILON = 1e-9;

export function buildLevelRows(payload: RegimeShiftPayload): LevelRow[] {
  const { from, to, spot } = payload;
  const rows: LevelRow[] = [];

  const flipBefore = from.gamma_flip;
  const flipAfter = to.gamma_flip;
  if (flipBefore != null && flipAfter != null) {
    const direction = compare(flipAfter, flipBefore);
    // A flip BELOW spot means the market is in long-gamma territory, which is
    // the stabilizing regime — so "good" tracks the side of spot, not the
    // direction the level moved.
    const belowSpot = spot > 0 && flipAfter <= spot;
    const wasBelowSpot = spot > 0 && flipBefore <= spot;
    rows.push({
      key: 'flip',
      label: 'Gamma flip',
      before: formatStrike(flipBefore),
      after: formatStrike(flipAfter),
      direction,
      sense: belowSpot === wasBelowSpot ? 'flat' : belowSpot ? 'good' : 'bad',
      note: belowSpot ? 'below spot — long gamma' : 'above spot — short gamma',
    });
  }

  const putBefore = from.put_wall;
  const putAfter = to.put_wall;
  if (putBefore != null && putAfter != null) {
    const direction = compare(putAfter, putBefore);
    rows.push({
      key: 'put_wall',
      label: 'Put wall',
      before: formatStrike(putBefore),
      after: formatStrike(putAfter),
      direction,
      sense: direction === 'flat' ? 'flat' : direction === 'up' ? 'good' : 'bad',
      note:
        direction === 'up'
          ? 'floor lifted'
          : direction === 'down'
            ? 'support gave way'
            : 'support held',
    });
  }

  const callBefore = from.call_wall;
  const callAfter = to.call_wall;
  if (callBefore != null && callAfter != null) {
    const direction = compare(callAfter, callBefore);
    rows.push({
      key: 'call_wall',
      label: 'Call wall',
      before: formatStrike(callBefore),
      after: formatStrike(callAfter),
      direction,
      sense: direction === 'flat' ? 'flat' : direction === 'up' ? 'good' : 'bad',
      note:
        direction === 'up'
          ? 'ceiling loosened'
          : direction === 'down'
            ? 'ceiling pulled in'
            : 'ceiling held',
    });
  }

  const gexBefore = from.net_gex_at_spot;
  const gexAfter = to.net_gex_at_spot;
  if (gexBefore != null && gexAfter != null) {
    const direction = compare(gexAfter, gexBefore);
    rows.push({
      key: 'net_gex_at_spot',
      label: 'γ at spot',
      before: formatSignedGex(gexBefore),
      after: formatSignedGex(gexAfter),
      direction,
      sense: direction === 'flat' ? 'flat' : direction === 'up' ? 'good' : 'bad',
      note: gexAfter >= 0 ? 'dealers long gamma here' : 'dealers short gamma here',
    });
  }

  // On the repositioning lens in a window with no open-interest change, the
  // net shift is 0 for the same structural reason the ribbon is empty — and
  // "$0" sitting in a tile beside four real levels reads as a measurement.
  if (!positioningResolved(payload)) {
    rows.push({
      key: 'net_shift',
      label: 'Net shift',
      before: '',
      after: '—',
      direction: 'flat',
      sense: 'flat',
      note: 'no open-interest change to attribute',
    });
    return rows;
  }

  rows.push({
    key: 'net_shift',
    label: 'Net shift',
    before: '',
    after: formatSignedGex(payload.scores.net_shift),
    direction: compare(payload.scores.net_shift, 0),
    sense:
      payload.read.state === 'QUIET'
        ? 'flat'
        : payload.scores.net_shift >= 0
          ? 'good'
          : 'bad',
    note: 'added − shed, every strike',
  });

  return rows;
}

function compare(after: number, before: number): 'up' | 'down' | 'flat' {
  const delta = after - before;
  if (Math.abs(delta) <= LEVEL_EPSILON) return 'flat';
  return delta > 0 ? 'up' : 'down';
}

// ---------------------------------------------------------------------------
// Ribbon scaling
// ---------------------------------------------------------------------------

/**
 * Bar height for one strike on the "where the change landed" ribbon, 0..1.
 *
 * Two decisions worth stating, because the obvious implementation of each is
 * wrong for this chart:
 *
 * 1. `reference` is a STABLE scale (the payload's gross shift), not the day's
 *    own biggest bar. Normalizing to the local max makes a dead session and a
 *    violent one render identically, which defeats the point of a glanceable
 *    strip.
 * 2. The curve is a power of 0.6, not linear. One $1.2B strike against a
 *    handful of $40M ones flattens every other bar to a hairline on a linear
 *    scale; the compression keeps them visible while preserving order.
 */
export function ribbonHeight(value: number, reference: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(reference) || reference <= 0) return 0;
  const ratio = Math.abs(value) / reference;
  return Math.min(1, Math.pow(ratio, 0.6));
}

/**
 * The scale a ribbon should normalize against.
 *
 * Uses the mean |change| per strike across the window, times a constant, so
 * one outlier strike does not set the scale for the rest — and so the same
 * symbol on two different days renders comparably.
 */
export function ribbonReference(strikes: ShiftStrike[], lens: Lens): number {
  if (strikes.length === 0) return 1;
  const values = strikes.map((s) => Math.abs(lens === 'net' ? s.d_net : s.positioning));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  // 6x the mean puts a typical session's largest strike near the top of the
  // track without clipping, while a quiet session stays visibly small.
  return Math.max(mean * 6, 1);
}
