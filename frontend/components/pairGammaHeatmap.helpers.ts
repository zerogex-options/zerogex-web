/**
 * Pure selection helpers for the Pair Comparison Net-GEX ladder, split out of
 * PairGammaHeatmap.tsx so they carry no JSX/React and can be unit-tested under
 * the repo's `node --experimental-strip-types` runner.
 */

export interface StrikeCell {
  strike: number;
  net_gex: number;
}

/**
 * Narrow a strike list to its "active" strikes — the ones carrying dealer
 * gamma — when `activeOnly` is set.
 *
 * A strike with no open interest aggregates to EXACTLY net_gex 0: the backend
 * sums γ·OI per strike, so zero OI ⇒ zero gamma ⇒ zero GEX. Any strike that
 * carries OI is non-zero. So `net_gex !== 0` is an exact "has dealer
 * positioning" test and needs no separate OI field. This is what lets a
 * high-priced chain like NDX — which lists a fine ~10-pt strike grid but only
 * accrues OI on the round 25-pt strikes — fill the fixed ±N-row ladder window
 * with real levels instead of listed-but-empty strikes.
 *
 * Falls back to the full list when filtering would leave nothing (e.g. a
 * degraded after-hours snapshot whose strikes all read 0), so the ladder never
 * blanks out just because the book is momentarily empty. Non-finite net_gex is
 * treated as inactive (we can't confirm positioning) but is caught by the same
 * fallback, so an all-NaN column still renders.
 */
export function selectActiveCells<T extends StrikeCell>(
  cells: readonly T[],
  activeOnly: boolean,
): T[] {
  if (!activeOnly) return cells.slice();
  const active = cells.filter((c) => Number.isFinite(c.net_gex) && c.net_gex !== 0);
  return active.length > 0 ? active : cells.slice();
}
