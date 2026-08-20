/**
 * Expiration gradient — the shared math behind the "colour graded by expiry"
 * bars: a per-(strike, expiration) split of the /api/gex/by-strike snapshot,
 * a DTE-ranked opacity ramp, and the per-strike shares that subdivide an
 * authoritative bar width into segments.
 *
 * The convention every consumer draws to (the GEX Strike Profile chart set it,
 * the Gamma Chart's rail follows it): the NEAREST expiration is anchored at the
 * zero baseline at full strength and the chain fans out toward the bar's tip,
 * fading to FAR opacity on the furthest expiration. Bold = rolls off soonest.
 *
 * Pure (no React / no window) so it unit-tests directly.
 */

/** Nearest expiration's opacity — full strength, drawn at the baseline. */
export const NEAR_OPACITY = 1;
/** Furthest expiration's opacity — faintest, drawn at the bar's tip. */
export const FAR_OPACITY = 0.4;

/** One expiration's share of a strike's per-side total. */
export interface ExpirationSegment {
  exp: string;
  /** Fraction of the bar (0..1); the segments of one side sum to 1. */
  frac: number;
}

/** Per-(strike, expiration) call/put magnitudes (absolute dollar gamma). */
export interface ExpirationCell {
  call: number;
  put: number;
}

export interface ExpirationSplit {
  /** strike(cents) → expiration → magnitudes. */
  perStrike: Map<number, Map<string, ExpirationCell>>;
  /** Expirations present in the snapshot, ascending = nearest-first (DTE rank). */
  expirations: string[];
}

/** A by-strike snapshot row, narrowed to the fields the split reads. */
export interface ByStrikeRowLike {
  strike: number | string | null | undefined;
  expiration?: string | null;
  call_gex?: number | string | null;
  put_gex?: number | string | null;
}

/**
 * Canonical YYYY-MM-DD key for an expiration, tolerant of a trailing time
 * component ("2026-08-15T00:00:00" → "2026-08-15"). Used to match a snapshot's
 * expirations against a (separately-sourced) selection.
 */
export function expDateKey(value: string | null | undefined): string {
  const m = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : String(value ?? '');
}

/**
 * Fold a by-strike snapshot into the per-(strike, expiration) split.
 * Strikes are keyed in cents so a lookup from a separately-sourced strike grid
 * can't miss on float drift, and expirations before `todayKey` (ET) are dropped
 * so a rolled-off contract can never occupy a slot on the ramp.
 */
export function buildExpirationSplit(
  rows: readonly ByStrikeRowLike[] | null | undefined,
  todayKey: string,
): ExpirationSplit {
  const perStrike = new Map<number, Map<string, ExpirationCell>>();
  const expirations = new Set<string>();
  (rows ?? []).forEach((row) => {
    const strike = Number(row?.strike);
    if (!Number.isFinite(strike)) return;
    const exp = expDateKey(row?.expiration);
    if (!exp || exp < todayKey) return; // current / future only
    expirations.add(exp);
    const key = Math.round(strike * 100);
    let inner = perStrike.get(key);
    if (!inner) {
      inner = new Map();
      perStrike.set(key, inner);
    }
    const cur = inner.get(exp) ?? { call: 0, put: 0 };
    cur.call += Math.abs(Number(row?.call_gex) || 0);
    cur.put += Math.abs(Number(row?.put_gex) || 0);
    inner.set(exp, cur);
  });
  return { perStrike, expirations: Array.from(expirations).sort((a, b) => a.localeCompare(b)) };
}

/**
 * DTE-ranked opacity for each expiration, linearly interpolated from
 * NEAR_OPACITY on the nearest to FAR_OPACITY on the furthest. Keyed on the FULL
 * snapshot universe (not the filtered subset) so a segment's shade stays stable
 * regardless of which expirations are filtered in. A lone expiration carries no
 * ramp information, so it renders at full strength.
 */
export function expirationOpacityRamp(
  expirationsNearestFirst: readonly string[],
  near: number = NEAR_OPACITY,
  far: number = FAR_OPACITY,
): Map<string, number> {
  const m = new Map<string, number>();
  const n = expirationsNearestFirst.length;
  expirationsNearestFirst.forEach((exp, i) => {
    const t = n <= 1 ? 0 : i / (n - 1);
    m.set(exp, near - t * (near - far));
  });
  return m;
}

/**
 * Narrow a snapshot's expiration universe to the shown subset, preserving the
 * nearest-first order. An empty selection means "All" → the whole universe.
 */
export function shownExpirations(
  universeNearestFirst: readonly string[],
  selected: readonly string[],
): string[] {
  if (selected.length === 0) return [...universeNearestFirst];
  const sel = new Set(selected.map(expDateKey));
  return universeNearestFirst.filter((e) => sel.has(e));
}

/**
 * Positional share array (as shipped by /api/replay/range) → segments.
 *
 * The server sends each expiration's fraction of a bar aligned by INDEX to a
 * nearest-first legend, which is far more compact than repeating date strings
 * on every strike of every minute. This rehydrates that into the same
 * `{exp, frac}` segments `expirationShares` produces, so both feeds render
 * through one code path.
 *
 * Zero-width slots are dropped (they'd draw nothing), and the surviving
 * fractions are re-normalised: the wire values are rounded for compactness, so
 * they can sum to slightly under or over 1 and would otherwise leave a sliver
 * of the bar unpainted or overshoot its tip. Returns an empty list when the
 * shares are missing, mismatched, or all zero — the caller then draws one
 * solid bar.
 */
export function sharesToSegments(
  shares: readonly number[] | null | undefined,
  legend: readonly string[],
): ExpirationSegment[] {
  if (!shares || shares.length === 0 || legend.length === 0) return [];
  const usable = Math.min(shares.length, legend.length);
  const segs: ExpirationSegment[] = [];
  let total = 0;
  for (let i = 0; i < usable; i += 1) {
    const frac = Number(shares[i]);
    if (!Number.isFinite(frac) || frac <= 0) continue;
    segs.push({ exp: legend[i], frac });
    total += frac;
  }
  if (total <= 0) return [];
  return segs.map((s) => ({ exp: s.exp, frac: s.frac / total }));
}

/**
 * One strike's per-side expiration shares, nearest-first. The caller multiplies
 * these by the AUTHORITATIVE bar width (from the strike-profile timeseries), so
 * the snapshot only ever supplies the split, never the magnitude — a truncated
 * or near-spot-only snapshot can't distort the level. Returns an empty list
 * when the side has no data at this strike (caller draws a plain solid bar).
 */
export function expirationShares(
  inner: Map<string, ExpirationCell> | undefined,
  shown: readonly string[],
  pick: (cell: ExpirationCell) => number,
): ExpirationSegment[] {
  if (!inner) return [];
  const segs: ExpirationSegment[] = [];
  let total = 0;
  shown.forEach((exp) => {
    const cell = inner.get(exp);
    const v = cell ? pick(cell) : 0;
    if (v > 0) {
      segs.push({ exp, frac: v });
      total += v;
    }
  });
  if (total <= 0) return [];
  return segs.map((s) => ({ exp: s.exp, frac: s.frac / total }));
}
