/**
 * Strike-filter preference + selection primitives for the per-strike GEX views
 * (the Pair Comparison ladder and the Gamma Exposure snapshot table).
 *
 * "Active" hides strikes carrying no dealer positioning so a high-priced chain
 * like NDX — which lists a fine ~10-pt strike grid but only accrues open
 * interest on the round 25-pt strikes — fills the view with real levels instead
 * of listed-but-empty strikes. The preference is a single persisted global so
 * every per-strike GEX surface stays consistent, mirroring GexUnitContext.
 *
 * This module is pure (no JSX, no React, no imports) so it stays usable from the
 * `node --experimental-strip-types` test runner; the React context in
 * StrikeFilterContext.tsx is a thin wrapper over the persistence helpers here.
 */

export type StrikeFilterMode = "active" | "all";

export const STRIKE_FILTER_STORAGE_KEY = "zgx_strike_filter";

const DEFAULT_MODE: StrikeFilterMode = "active";

/**
 * Coerce a stored/raw value to a mode. Only the explicit "all" opt-out turns
 * the filter off; anything else (missing key, legacy value, corruption) lands
 * on the intended default so the view is never accidentally left unfiltered.
 */
export function parseStrikeFilter(raw: string | null | undefined): StrikeFilterMode {
  return raw === "all" ? "all" : DEFAULT_MODE;
}

/** SSR-safe read of the persisted preference (default on the server / when
 *  storage is unavailable). */
export function readStoredStrikeFilter(): StrikeFilterMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    return parseStrikeFilter(window.localStorage.getItem(STRIKE_FILTER_STORAGE_KEY));
  } catch {
    return DEFAULT_MODE;
  }
}

/** SSR-safe write; silently no-ops when storage is unavailable (private mode). */
export function writeStoredStrikeFilter(mode: StrikeFilterMode): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STRIKE_FILTER_STORAGE_KEY, mode);
  } catch {
    // Private-mode / disabled storage — in-memory preference only.
  }
}

/**
 * Narrow a list to its "active" members when `activeOnly` is set, per an
 * `isActive` predicate. Falls back to the full list when filtering would leave
 * nothing (e.g. a degraded after-hours snapshot with no positioning yet), so a
 * view never blanks out just because the book is momentarily empty.
 */
export function selectActive<T>(
  items: readonly T[],
  activeOnly: boolean,
  isActive: (item: T) => boolean,
): T[] {
  if (!activeOnly) return items.slice();
  const active = items.filter(isActive);
  return active.length > 0 ? active : items.slice();
}

export interface StrikeCell {
  strike: number;
  net_gex: number;
}

/**
 * Ladder-specific active filter. The heatmap payload carries only net GEX, but
 * a no-OI strike aggregates to EXACTLY net_gex 0 (γ·OI sums to 0) while any
 * strike with OI is non-zero — so `net_gex !== 0` is an exact "has dealer
 * positioning" test with no OI field needed.
 */
export function selectActiveCells<T extends StrikeCell>(cells: readonly T[], activeOnly: boolean): T[] {
  return selectActive(cells, activeOnly, (c) => Number.isFinite(c.net_gex) && c.net_gex !== 0);
}
