/**
 * gammaPlaybook — resolves the "Where do we expect the underlying to go?"
 * scenario from the levels the Gamma Chart is currently drawing.
 *
 * The Playbook is a 2×2: gamma regime (positive / negative) × the wall price is
 * approaching (up → Call Wall / down → Put Wall). Which of the four cells is
 * the RIGHT one is not a preference — it is a reading of the live book for the
 * symbol and expirations the user has selected on the chart. This module turns
 * those levels into that reading, so the matrix highlights the cell the trader
 * is actually in instead of a hardcoded default.
 *
 * Everything here is pure (no React, no fetching) so the resolution rules are
 * unit-testable under Node — see tests/gammaPlaybook.test.ts.
 *
 * Two rules carry the whole thing:
 *
 *   • Regime — the sign of dealer gamma at spot. The caller resolves it with
 *     the SAME helper that drives the chart's LONG/SHORT badge
 *     (`longGammaAtSpot` in core/gammaRegime) and passes the answer in as
 *     `longGamma`, so the Playbook can never contradict the badge sitting a few
 *     hundred pixels above it, and this module stays runtime-self-contained for
 *     node's --experimental-strip-types runner (the convention every
 *     unit-tested module under core/ follows). `atSpotGammaForPlaybook` below
 *     is the one piece of that pipeline the Playbook owns: an
 *     expiration-filtered book must NOT be read through the whole-chain at-spot
 *     value.
 *
 *   • Approach — the wall in play, i.e. the level price interacts with next.
 *     Proximity decides: the wall nearer to spot wins, whichever side of it
 *     price sits on (a Call Wall just broken is still the level being fought
 *     over — `beyondWall` says so). The session drift only breaks a near-tie
 *     between two roughly equidistant walls, and only when it is decisive;
 *     momentum never overrides a materially closer wall, because that is the
 *     level price trades against first however the day has leaned.
 */

export type PlaybookRegime = 'positive' | 'negative';
/** 'up' → approaching the Call Wall, 'down' → approaching the Put Wall. */
export type PlaybookApproach = 'up' | 'down';

/** How the regime was read. */
export type RegimeBasis =
  /** Sign of dealer gamma at spot (the chart's LONG/SHORT badge value). */
  | 'at-spot-gamma'
  /** Geometric fallback: spot vs the gamma flip. */
  | 'spot-vs-flip';

/** How the wall in play was picked. */
export type ApproachBasis =
  /** The nearer of the two walls to spot. */
  | 'nearest-wall'
  /** Only one wall resolved on this book. */
  | 'only-wall'
  /** The walls are near-equidistant; the session drift broke the tie. */
  | 'drift-tiebreak';

export interface PlaybookLevels {
  /** Current underlying price. */
  spot: number | null;
  /** Call Wall. */
  callWall: number | null;
  /** Put Wall. */
  putWall: number | null;
  /**
   * The modeled long-gamma sign at spot — pass `longGammaAtSpot()` from
   * core/gammaRegime so the Playbook's row always matches the chart's
   * LONG/SHORT badge. Null when the regime is genuinely unknown.
   */
  longGamma: boolean | null;
  /**
   * The at-spot dealer-gamma value that produced `longGamma`, or null when it
   * was unavailable (or withheld — see {@link atSpotGammaForPlaybook}) and the
   * sign came from the geometric spot-vs-flip read instead. Used only to report
   * which basis the row rests on.
   */
  netGexAtSpot: number | null;
  /**
   * Session change (last minus the most recent completed regular close), used
   * only to break a near-tie between two equidistant walls. Null when unknown.
   */
  drift?: number | null;
}

export interface PlaybookWall {
  side: 'call' | 'put';
  level: number;
  /** Signed distance from spot to the wall (positive above, negative below). */
  distance: number;
  /** |distance| as a percentage of spot. */
  distancePct: number;
}

export interface PlaybookScenario {
  /** Null when the book is too degraded to read a regime. */
  regime: PlaybookRegime | null;
  /** Null when neither wall is known. */
  approach: PlaybookApproach | null;
  regimeBasis: RegimeBasis | null;
  approachBasis: ApproachBasis | null;
  /** The wall the approach refers to, when it is known. */
  wall: PlaybookWall | null;
  /**
   * True when price has already traded THROUGH the wall in play (spot above the
   * Call Wall, or below the Put Wall). The matrix cell still reads correctly —
   * that wall is the live level — but the caller should flag that price is on
   * the far side of it.
   */
  beyondWall: boolean;
  /** True when both axes resolved, i.e. a cell can be highlighted. */
  resolved: boolean;
}

/**
 * Walls this close together (as a ratio of their distances from spot) count as
 * equidistant — neither is meaningfully "the next level", so the drift decides.
 */
export const NEAR_TIE_RATIO = 1.25;

/**
 * Minimum |session change| as a fraction of spot for the drift to be treated as
 * a direction rather than noise (5 bps).
 */
export const DRIFT_EPSILON_PCT = 0.0005;

function finite(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * The at-spot dealer-gamma value the Playbook may read, given the chart's
 * expiration filter.
 *
 * `net_gex_at_spot` is served for the WHOLE chain. When the user filters the
 * chart to a subset of expirations, the flip and walls on screen (and therefore
 * the Playbook's levels) describe only that subset — so reading the regime off
 * the chain-wide value would pin the row to the unfiltered book and make the
 * Playbook deaf to the expiration picker, which is exactly the selection this
 * component is supposed to follow. Filtered → null, which sends
 * `longGammaAtSpot` to its geometric spot-vs-FILTERED-flip fallback.
 */
export function atSpotGammaForPlaybook(netGexAtSpot: number | null, filtered: boolean): number | null {
  if (filtered) return null;
  return finite(netGexAtSpot);
}

function wallOf(side: 'call' | 'put', level: number, spot: number): PlaybookWall {
  const distance = level - spot;
  return {
    side,
    level,
    distance,
    distancePct: spot > 0 ? Math.abs(distance / spot) * 100 : 0,
  };
}

/**
 * Resolve the Playbook cell for a set of levels.
 *
 * Either axis can come back null (an unresolvable flip on a one-signed book, a
 * chain with no walls yet); callers render the matrix un-highlighted rather
 * than guessing a direction. `resolved` is the "we have a cell" flag.
 */
export function resolvePlaybookScenario(levels: PlaybookLevels): PlaybookScenario {
  const spot = finite(levels.spot);
  const callWall = finite(levels.callWall);
  const putWall = finite(levels.putWall);
  const drift = finite(levels.drift ?? null);
  const netGexAtSpot = finite(levels.netGexAtSpot);

  const longGamma = levels.longGamma;
  const regime: PlaybookRegime | null = longGamma == null ? null : longGamma ? 'positive' : 'negative';
  const regimeBasis: RegimeBasis | null =
    longGamma == null ? null : netGexAtSpot != null ? 'at-spot-gamma' : 'spot-vs-flip';

  const { approach, approachBasis, wall } = resolveApproach({ spot, callWall, putWall, drift });

  return {
    regime,
    approach,
    regimeBasis,
    approachBasis,
    wall,
    beyondWall: wall != null && (wall.side === 'call' ? wall.distance < 0 : wall.distance > 0),
    resolved: regime != null && approach != null,
  };
}

function resolveApproach({
  spot,
  callWall,
  putWall,
  drift,
}: {
  spot: number | null;
  callWall: number | null;
  putWall: number | null;
  drift: number | null;
}): { approach: PlaybookApproach | null; approachBasis: ApproachBasis | null; wall: PlaybookWall | null } {
  if (spot == null) return { approach: null, approachBasis: null, wall: null };

  const call = callWall != null ? wallOf('call', callWall, spot) : null;
  const put = putWall != null ? wallOf('put', putWall, spot) : null;

  // Only one wall resolved on this book — it is the level in play by default.
  if (call && !put) return { approach: 'up', approachBasis: 'only-wall', wall: call };
  if (put && !call) return { approach: 'down', approachBasis: 'only-wall', wall: put };
  if (!call || !put) return { approach: null, approachBasis: null, wall: null };

  const upDistance = Math.abs(call.distance);
  const downDistance = Math.abs(put.distance);
  const ratio = Math.max(upDistance, downDistance) / Math.max(1e-9, Math.min(upDistance, downDistance));
  const driftDecisive = drift != null && spot > 0 && Math.abs(drift) / spot >= DRIFT_EPSILON_PCT;

  // Near-equidistant walls: neither is meaningfully "next", so the day's
  // direction of travel picks the one price is actually walking into.
  if (ratio <= NEAR_TIE_RATIO && driftDecisive) {
    return drift > 0
      ? { approach: 'up', approachBasis: 'drift-tiebreak', wall: call }
      : { approach: 'down', approachBasis: 'drift-tiebreak', wall: put };
  }

  return upDistance <= downDistance
    ? { approach: 'up', approachBasis: 'nearest-wall', wall: call }
    : { approach: 'down', approachBasis: 'nearest-wall', wall: put };
}

/**
 * Human label for an expiration selection, for the "reading X for Y" line.
 * An empty selection is the whole chain ("all expirations"); a single
 * same-day pick reads as 0DTE, which is the distinction traders care about.
 *
 * @param selection the reconciled expiration selection ([] = all)
 * @param todayKey today's ET calendar date as YYYY-MM-DD
 */
export function expirationScopeLabel(selection: readonly string[], todayKey: string): string {
  if (selection.length === 0) return 'all expirations';
  if (selection.length === 1) {
    return selection[0] === todayKey ? `0DTE (${selection[0]})` : `the ${selection[0]} expiration`;
  }
  const sorted = [...selection].sort();
  return `${sorted.length} expirations (${sorted[0]} → ${sorted[sorted.length - 1]})`;
}

const PRICE_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Level formatted for prose (2dp, thousands-separated). */
export function formatLevel(value: number): string {
  return PRICE_FORMAT.format(value);
}

/**
 * One plain sentence explaining WHY this cell is highlighted — the auto-select
 * has to show its work, or it reads as a magic default the trader can't check
 * against the chart above it.
 */
export function describePlaybookScenario(
  scenario: PlaybookScenario,
  context: { symbol: string; expirationLabel: string; spot: number | null; flip: number | null },
): string {
  const { symbol, expirationLabel } = context;
  const scope = `${symbol} · ${expirationLabel}`;

  if (!scenario.resolved) {
    return `${scope}: not enough resolved gamma structure to place a cell — pick the read manually.`;
  }

  const spot = finite(context.spot);
  const flip = finite(context.flip);
  const regimeClause =
    scenario.regimeBasis === 'at-spot-gamma'
      ? `dealer gamma at spot is ${scenario.regime === 'positive' ? 'positive (long γ)' : 'negative (short γ)'}`
      : flip != null && spot != null
        ? `spot ${formatLevel(spot)} is ${spot >= flip ? 'above' : 'below'} the Gamma Flip at ${formatLevel(flip)}`
        : `the book reads ${scenario.regime === 'positive' ? 'long' : 'short'} gamma`;

  const wall = scenario.wall;
  const wallName = wall?.side === 'call' ? 'Call Wall' : 'Put Wall';
  let wallClause: string;
  if (!wall) {
    wallClause = 'no wall is resolved';
  } else if (scenario.beyondWall) {
    wallClause = `price has traded through the ${wallName} at ${formatLevel(wall.level)} (now ${wall.distancePct.toFixed(2)}% ${wall.distance < 0 ? 'below' : 'above'} spot), so that level is the one in play`;
  } else if (scenario.approachBasis === 'drift-tiebreak') {
    wallClause = `the walls sit near-equidistant and the session is ${scenario.approach === 'up' ? 'higher' : 'lower'}, pointing at the ${wallName} at ${formatLevel(wall.level)}`;
  } else if (scenario.approachBasis === 'only-wall') {
    wallClause = `the only resolved wall is the ${wallName} at ${formatLevel(wall.level)} (${wall.distancePct.toFixed(2)}% away)`;
  } else {
    wallClause = `the nearer wall is the ${wallName} at ${formatLevel(wall.level)} (${wall.distancePct.toFixed(2)}% away)`;
  }

  return `${scope}: ${regimeClause}, and ${wallClause}.`;
}
