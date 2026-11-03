/**
 * The gamma ladders' basis: what each strike's gamma is weighted by.
 *
 * `oi` (the default) is the dealer book every other gamma surface shows:
 * γ × open interest. `volume` weights the same per-contract gamma by the
 * contracts traded in the session instead (/api/gex/volume-gamma-by-strike),
 * so the ladder shows where the session's gamma is trading, including
 * positions the once-a-day open interest can't see yet. Same units and signs
 * as the open-interest ladder (calls +, puts −), so the two read on one scale.
 *
 * It is an activity map, not positioning: volume can't tell an opening trade
 * from a closing one, or who was on each side. The rest of the ladder (the
 * regime chip, the flip and walls in the header and on the rows) stays on the
 * open-interest book.
 *
 * Pure (no React, no runtime imports) so the contract runs under the Node test
 * runner like core/sessionDelta.ts.
 */

// ── Persisted display preference ────────────────────────────────────────────
// One persisted global, like the strike filter and Session Δ, so the Gamma
// Terminal, Pair Comparison and the dashboard ladder tile move together.

export type LadderBasis = 'oi' | 'volume';

export const LADDER_BASIS_STORAGE_KEY = 'zgx_ladder_basis';

const DEFAULT_LADDER_BASIS: LadderBasis = 'oi';

/** Only an explicit "volume" switches the basis; anything else (missing key,
 *  legacy value, corruption) lands on the open-interest default. */
export function parseLadderBasis(raw: string | null | undefined): LadderBasis {
  return raw === 'volume' ? 'volume' : DEFAULT_LADDER_BASIS;
}

/** SSR-safe read of the persisted preference. */
export function readStoredLadderBasis(): LadderBasis {
  if (typeof window === 'undefined') return DEFAULT_LADDER_BASIS;
  try {
    return parseLadderBasis(window.localStorage.getItem(LADDER_BASIS_STORAGE_KEY));
  } catch {
    return DEFAULT_LADDER_BASIS;
  }
}

/** SSR-safe write; silently no-ops when storage is unavailable (private mode). */
export function writeStoredLadderBasis(basis: LadderBasis): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LADDER_BASIS_STORAGE_KEY, basis);
  } catch {
    // Private-mode / disabled storage — in-memory preference only.
  }
}

// ── /api/gex/volume-gamma-by-strike ─────────────────────────────────────────

/** One strike of the response. Dollar figures per 1% move, like Net GEX. */
export interface VolumeGammaStrike {
  strike?: number | string | null;
  call_gex?: number | string | null;
  put_gex?: number | string | null;
  net_gex?: number | string | null;
  call_volume?: number | string | null;
  put_volume?: number | string | null;
}

export interface VolumeGammaResponse {
  symbol?: string;
  /** The snapshot the strikes come from. */
  timestamp?: string | null;
  spot_price?: number | string | null;
  strikes?: VolumeGammaStrike[] | null;
}

/**
 * The read for one ladder column. `expirationsParam` is the same string the
 * open-interest tip sends ("all", or the selection's dates sorted and
 * comma-joined), so both bases describe the same expirations.
 */
export function volumeGammaUrl(symbol: string, expirationsParam: string): string {
  const params = new URLSearchParams();
  params.set('symbol', symbol);
  params.set('underlying', symbol);
  params.set('expirations', expirationsParam || 'all');
  return `/api/gex/volume-gamma-by-strike?${params.toString()}`;
}

function num(v: number | string | null | undefined): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
}

/** Ladder cells from the response: one per strike, its net volume-weighted
 *  gamma in the `net_gex` slot the ladder renders. A strike with no gamma
 *  traded reads 0, which the Active strike filter hides like an empty strike
 *  on the open-interest ladder. */
export function volumeLadderCells(
  resp: VolumeGammaResponse | null | undefined,
): Array<{ strike: number; net_gex: number }> {
  const out: Array<{ strike: number; net_gex: number }> = [];
  for (const s of resp?.strikes ?? []) {
    const strike = num(s?.strike);
    if (strike == null || strike <= 0) continue;
    out.push({ strike, net_gex: num(s?.net_gex) ?? 0 });
  }
  return out;
}
