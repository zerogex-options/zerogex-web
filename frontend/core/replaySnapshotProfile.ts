/**
 * The "Net gamma by strike" strip on a replay snapshot's share card
 * (`app/replay/[symbol]/[date]/snapshot/[time]/opengraph-image.tsx`), built
 * from one `/api/replay/frame` minute.
 *
 * That endpoint returns one row per (strike, expiration), nearest spot first,
 * and its `strike_limit` counts ROWS: a strike near the money has a row for
 * every listed expiration (12 on ES in November 2026). The card used to draw
 * each row as its own bar, from the default 60 rows, so ES showed about five
 * strikes as a dozen bars apiece, each one expiration's value. Here every
 * strike's rows are added into one bar, the same sum the snapshot page and the
 * Gamma Ladder's since-open baseline make (`baselineNetByStrike`).
 *
 * Pure, importing only `./sessionDelta.ts` (itself import-free), so it runs
 * under the Node test runner.
 */
import { baselineNetByStrike, type FrameStrikeRow } from './sessionDelta.ts';

/**
 * Rows the card asks `/api/replay/frame` for: the endpoint's maximum, as the
 * ladder's baseline does. A minute's whole chain is well under it at today's
 * expiration counts, so the cut below is a safeguard that normally never runs.
 */
export const SNAPSHOT_PROFILE_ROW_LIMIT = 4000;

/** Bars on the strip: the strikes nearest spot. */
export const SNAPSHOT_PROFILE_MAX_STRIKES = 64;

export interface SnapshotProfileColumn {
  strike: number;
  net: number;
}

const toNum = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * One bar per strike, each that strike's net GEX summed across all of its
 * expirations, for the `maxStrikes` strikes nearest spot, low to high.
 *
 * "Nearest" is the endpoint's own order (rows come nearest spot first), so no
 * spot is needed and ES / NQ, whose prices are projected after the read, rank
 * exactly as the server did.
 *
 * When the read stopped at `rowLimit`, the strike at the cut may be missing
 * some expirations, and so may the strike the same distance away on the other
 * side of spot, whose rows sort among its own. Those are the last two distinct
 * strikes in the response, so both are left out. That is never a strike the
 * strip would otherwise show unless the read held fewer whole strikes than
 * `maxStrikes`, and at worst it drops one complete strike at the far edge.
 */
export function snapshotNetProfile(
  rows: readonly FrameStrikeRow[] | null | undefined,
  rowLimit: number = SNAPSHOT_PROFILE_ROW_LIMIT,
  maxStrikes: number = SNAPSHOT_PROFILE_MAX_STRIKES,
): SnapshotProfileColumn[] {
  if (!Array.isArray(rows) || rows.length === 0 || maxStrikes <= 0) return [];

  const cut = new Set<number>();
  if (rows.length >= rowLimit) {
    for (let i = rows.length - 1; i >= 0 && cut.size < 2; i -= 1) {
      const strike = toNum(rows[i]?.strike);
      if (Number.isFinite(strike)) cut.add(strike);
    }
  }

  // Distinct strikes in the order the endpoint returned them: nearest first.
  const nearest: number[] = [];
  const seen = new Set<number>();
  for (const row of rows) {
    const strike = toNum(row?.strike);
    if (!Number.isFinite(strike) || seen.has(strike) || cut.has(strike)) continue;
    seen.add(strike);
    nearest.push(strike);
    if (nearest.length === maxStrikes) break;
  }

  const totals = baselineNetByStrike(rows, []);
  return nearest
    .filter((strike) => totals.has(strike))
    .map((strike) => ({ strike, net: totals.get(strike) as number }))
    .sort((a, b) => a.strike - b.strike);
}
