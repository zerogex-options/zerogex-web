/**
 * crownScope — the color a gamma ladder's crown wears, and why.
 *
 * The crown marks the heaviest dealer gamma in a ladder's view, over whichever
 * expirations the ladder is showing. That scope is the one thing a reader can't
 * see from the crown itself, and it changes what the crown means: the heaviest
 * strike in today's options is often not the heaviest across the chain. So the
 * crown is filled with the color of the level it shares a scope with:
 *
 *   • today's expiration alone → teal, the Pin Strike's color. The pin is
 *     same-day by definition, so teal already reads "today's book".
 *   • anything else → violet, the GEX King's color. Every other heaviest-strike
 *     marker on the site already wears it, and all of them cover more than
 *     today: the chart's GEX King line (the whole chain) and the Dealer
 *     Positioning heatmap's Near-term King (0-7 DTE).
 *
 * Two colors, not one per scope: a picked set of dates shares violet with "all"
 * because the rule a reader has to hold is the simple one, teal means today
 * only. The header's key names the exact scope ("0DTE", "All exp.",
 * "Selected"), and the crown's tooltip spells it out.
 *
 * Pure and runtime-self-contained, like every unit-tested module under core/,
 * so tests/crownScope.test.ts runs it under node's --experimental-strip-types.
 */

import { isRollingZeroDte } from './expirationPersistence.ts';

/** Which expirations a ladder column's rows cover. */
export type LadderExpiryScope = 'today' | 'all' | 'selected';

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

/** Teal: the same-day Pin Strike's color. */
export const CROWN_TODAY_COLOR = 'var(--color-pin)';
/** Violet: the GEX King's color. */
export const CROWN_WIDER_COLOR = 'var(--color-king)';

/** The crown's fill for a scope. */
export function crownColor(scope: LadderExpiryScope): string {
  return scope === 'today' ? CROWN_TODAY_COLOR : CROWN_WIDER_COLOR;
}

/** The scope's short name, for the key in the ladder's header. */
export function crownScopeShort(scope: LadderExpiryScope): string {
  if (scope === 'today') return '0DTE';
  if (scope === 'all') return 'All exp.';
  return 'Selected';
}

function scopePhrase(scope: LadderExpiryScope): string {
  if (scope === 'today') return "today's expiration only (0DTE)";
  if (scope === 'all') return 'all expirations';
  return 'the expirations you selected';
}

/**
 * What the crowned strike is, for its tooltip and aria-label. On the volume
 * basis the rows weight gamma by the session's traded contracts, so the crown
 * marks where the most gamma traded rather than the heaviest dealer gamma.
 */
export function crownLabel(scope: LadderExpiryScope, basis: 'oi' | 'volume' = 'oi'): string {
  const what = basis === 'volume' ? 'Heaviest gamma traded this session' : 'Heaviest dealer gamma in view';
  return `${what}, from ${scopePhrase(scope)}`;
}

/** The header key's tooltip: what this column's crown covers, and the rule. */
export function crownKeyTitle(scope: LadderExpiryScope): string {
  return (
    `Crown: the heaviest strike in this ladder's view, from ${scopePhrase(scope)}. ` +
    "Teal when the ladder shows only today's expiration (the Pin Strike's color), " +
    "violet for all expirations or a selection (the GEX King's color)."
  );
}
