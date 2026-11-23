/**
 * crownScope — the gamma ladder's two crowns: what each covers, and where it sits.
 *
 * A crown marks the heaviest dealer gamma among the strikes a ladder shows.
 * Every ladder carries two, and both are drawn whatever the Expiry filter is
 * set to, so a same-day trader never has to flip the filter back and forth to
 * see the other one (a member asked for exactly this after an expiration
 * Friday spent toggling between 0DTE and All):
 *
 *   • teal, the Pin Strike's color: the heaviest strike in TODAY'S expiration
 *     (0DTE). The pin is same-day by definition, so teal already reads
 *     "today's book".
 *   • violet, the GEX King's color: the heaviest strike across ALL
 *     expirations. Every other heaviest-strike marker on the site already
 *     wears it, and all of them cover more than today: the chart's GEX King
 *     line (the whole chain) and the Dealer Positioning heatmap's Near-term
 *     King (0-7 DTE).
 *
 * The rows follow the Expiry filter; the crowns don't. So a crown can sit on a
 * row whose own number is small: the row shows the expirations you picked, the
 * crown says where its own scope is heaviest, and its tooltip gives that
 * scope's figure. Both crowns are picked among the strikes on screen, never
 * from outside the ladder's window, so a crown always lands on a row. When both
 * pick the same strike, that row wears both.
 *
 * The rows' own data serves the crown that shares their scope. The other crown
 * comes from its own small read (see crownFeedsNeeded). While rewinding there
 * is no such read, only the strike history behind the rows, so only the crown
 * matching the Expiry pick can be drawn.
 *
 * Pure and runtime-self-contained, like every unit-tested module under core/,
 * so tests/crownScope.test.ts runs it under node's --experimental-strip-types.
 */

import { isRollingZeroDte } from './expirationPersistence.ts';

/** Which expirations a ladder column's ROWS cover. */
export type LadderExpiryScope = 'today' | 'all' | 'selected';

/** The two crowns, named by the expirations each one covers. */
export type CrownScope = 'today' | 'all';

/** Draw and key order: today's crown first, then the whole chain's. */
export const CROWN_SCOPES: readonly CrownScope[] = ['today', 'all'];

/**
 * Classify a ladder's expiration selection.
 *
 * `selection` uses the site-wide convention: empty = all expirations. Callers
 * pass the RECONCILED selection (useChartExpirations), where a rolling 0DTE
 * pick has already become today's date, or been dropped when nothing expires
 * today, leaving the whole chain. The rolling token itself is accepted too, so
 * an unreconciled pick still reads as today rather than as a picked date.
 *
 * @param selection the expirations the ladder's rows were fetched for
 * @param todayKey today's date in ET, as YYYY-MM-DD (etTodayDateKey)
 */
export function ladderExpiryScope(selection: readonly string[], todayKey: string): LadderExpiryScope {
  if (selection.length === 0) return 'all';
  if (selection.length === 1 && (selection[0] === todayKey || isRollingZeroDte(selection[0]))) return 'today';
  return 'selected';
}

/** One strike's gamma, as the ladder's rows carry it. */
export interface CrownCell {
  strike: number;
  net_gex: number;
}

/**
 * The per-strike gamma each crown is picked from. `null` means this view has
 * no data for that crown at all (nothing expires today; a rewind, a replay or
 * the delayed preview that only carries the rows' own expirations), so it is
 * not drawn and its header key says why. An empty list is "no data yet".
 */
export type LadderCrownSources = Record<CrownScope, readonly CrownCell[] | null>;

/**
 * Which crowns need a read of their own, on top of the rows'.
 *
 * The rows serve the crown that shares their scope; any other crown needs its
 * own data. Today's crown is only fetched when the chain lists a same-day
 * expiration. Rewinding there is no live read to take: the rows come from the
 * strike history, and seeding a second history per column just for a crown
 * would cost far more than the crown is worth.
 *
 * @param scope the rows' scope (ladderExpiryScope)
 * @param todayListed whether the symbol's chain lists today's date
 * @param rewinding whether the column shows a rewound bucket instead of live
 */
export function crownFeedsNeeded(
  scope: LadderExpiryScope,
  todayListed: boolean,
  rewinding: boolean,
): Record<CrownScope, boolean> {
  if (rewinding) return { today: false, all: false };
  return { today: todayListed && scope !== 'today', all: scope !== 'all' };
}

/**
 * Each crown's source: the rows themselves when the crown shares their scope,
 * otherwise the crown's own read (null when there is none).
 */
export function crownSources(
  scope: LadderExpiryScope,
  rows: readonly CrownCell[],
  feeds: LadderCrownSources,
): LadderCrownSources {
  return {
    today: scope === 'today' ? rows : feeds.today,
    all: scope === 'all' ? rows : feeds.all,
  };
}

/** A crowned strike, with its gamma in the crown's own scope. */
export interface CrownPick {
  strike: number;
  netGex: number;
}

function pickOne(viewStrikes: readonly number[], source: readonly CrownCell[] | null): CrownPick | null {
  if (!source || source.length === 0) return null;
  const byStrike = new Map<number, number>();
  for (const c of source) {
    const strike = Number(c.strike);
    const gex = Number(c.net_gex);
    if (Number.isFinite(strike) && Number.isFinite(gex)) byStrike.set(strike, gex);
  }
  let best: CrownPick | null = null;
  for (const strike of viewStrikes) {
    const gex = byStrike.get(strike);
    if (gex == null || gex === 0) continue;
    // Strictly greater: on a tie the first strike in view keeps the crown.
    if (best == null || Math.abs(gex) > Math.abs(best.netGex)) best = { strike, netGex: gex };
  }
  return best;
}

/**
 * Pick each crown's strike among the strikes in view: the one whose gamma, in
 * that crown's own scope, is largest in size (long or short). A strike that
 * carries no gamma in the scope is never crowned, so a scope with nothing near
 * price draws no crown rather than crowning an empty row.
 *
 * @param viewStrikes the strikes the ladder shows
 * @param sources each crown's per-strike gamma (crownSources)
 */
export function pickCrowns(
  viewStrikes: readonly number[],
  sources: LadderCrownSources,
): Record<CrownScope, CrownPick | null> {
  return {
    today: pickOne(viewStrikes, sources.today),
    all: pickOne(viewStrikes, sources.all),
  };
}

/** Teal: the same-day Pin Strike's color. */
export const CROWN_TODAY_COLOR = 'var(--color-pin)';
/** Violet: the GEX King's color. */
export const CROWN_WIDER_COLOR = 'var(--color-king)';

/** A crown's fill. */
export function crownColor(scope: CrownScope): string {
  return scope === 'today' ? CROWN_TODAY_COLOR : CROWN_WIDER_COLOR;
}

/** A crown's short name, for its key in the ladder's header. */
export function crownScopeShort(scope: CrownScope): string {
  return scope === 'today' ? '0DTE' : 'All exp.';
}

function scopePhrase(scope: CrownScope): string {
  return scope === 'today' ? "today's expiration only (0DTE)" : 'all expirations';
}

/**
 * What a crowned strike is, for its tooltip and aria-label. On the volume
 * basis the crowns weight gamma by the session's traded contracts, like the
 * rows, so they mark where the most gamma traded rather than the heaviest
 * dealer gamma.
 */
export function crownLabel(scope: CrownScope, basis: 'oi' | 'volume' = 'oi'): string {
  const what = basis === 'volume' ? 'Heaviest gamma traded this session' : 'Heaviest dealer gamma in view';
  return `${what}, from ${scopePhrase(scope)}`;
}

/**
 * Whether a crown is on the ladder right now: drawn on a row, unavailable in
 * this view (its source is null), or available but with nothing in view to
 * crown (still loading, or no gamma from that scope near price).
 */
export type CrownState = 'shown' | 'unavailable' | 'none-in-view';

/** The header key's tooltip: what this crown covers, and why it's missing when it is. */
export function crownKeyTitle(scope: CrownScope, state: CrownState = 'shown'): string {
  const base =
    scope === 'today'
      ? "Teal crown: the heaviest strike in view from today's expiration only (0DTE), in the Pin Strike's color."
      : "Violet crown: the heaviest strike in view across all expirations, in the GEX King's color.";
  const rule = ' It shows whatever the Expiry filter is set to; the rows follow the filter.';
  if (state === 'unavailable') {
    return (
      base +
      (scope === 'today'
        ? " Not shown here: nothing expires today, or this view only carries the rows' own expirations (Rewind, Replay and the free preview)."
        : ' Not shown here: while rewinding, only the crown matching the Expiry pick is drawn.')
    );
  }
  if (state === 'none-in-view') {
    return (
      base +
      rule +
      (scope === 'today'
        ? " No strike in view carries gamma from today's expiration right now."
        : ' No strike in view carries gamma right now.')
    );
  }
  return base + rule;
}
