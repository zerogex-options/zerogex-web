/**
 * Wall Ladder — the shared model behind the optional secondary Call/Put Walls
 * (C2, C3 · P2, P3) every gamma surface can draw.
 *
 * Until now each surface drew exactly one wall per side: the Gamma Chart's
 * CALL WALL / PUT WALL reference lines, the Strike Profile's key-level rail,
 * the Gamma Ladder's CW / PW row tags. The chain almost always has more than
 * one meaningful wall, and traders ask for the next one up and the next one
 * down. This module is the single source of truth for reading that ladder off
 * the API and for presenting it, so the dashboard widget and the full chart
 * page are showing the same entity rather than two look-alike derivations.
 *
 * The API does the ranking (src/analytics/walls.py in zerogex-oa) and ships
 * `call_walls` / `put_walls` on both `/api/gex/summary` and each
 * `/api/gex/strike-profile-timeseries` bucket, so the ladder follows the
 * expiration filter exactly as the primary wall does. Rank 1 is the primary
 * wall by construction on the server; `parseWallLadder` re-asserts that here
 * anyway, because a surface that resolved its primary wall from a different
 * source (a rewind bucket, a fallback to the live summary) could otherwise
 * label C1 at a price where it is drawing "Call Wall".
 *
 * Deliberately pure — no React, no fetching, no runtime imports — so it runs
 * under the Node test runner's type-stripping like the other core modules.
 * The React preference that decides how deep to draw lives beside it in
 * core/WallDepthContext.
 */

export type WallSide = 'call' | 'put';

/** One rung of the ladder, normalized from the API payload. */
export interface WallLevel {
  /** 1 = the primary Call/Put Wall, 2 = next strongest, and so on. */
  rank: number;
  /** 'C1' | 'C2' | 'P1' | 'P2' … — the name shown on every surface. */
  label: string;
  side: WallSide;
  strike: number;
  /**
   * Dollar gamma at the strike (per 1% move), or null when the server has no
   * ranked magnitude for it. Used to fade a thin C3, never to re-rank: the
   * server's order is authoritative.
   */
  strength: number | null;
}

/** The API's per-level shape, as it arrives on the wire. */
export interface WallLevelPayload {
  rank?: number | string | null;
  label?: string | null;
  strike?: number | string | null;
  strength?: number | string | null;
}

/**
 * How many walls per side a surface may draw. 1 is the historical behaviour
 * (primary wall only) and stays the default, so enabling this feature never
 * reshapes a chart the user didn't ask to change. 3 is the server's default
 * ladder depth; past that the deeper ranks are noise on a price axis.
 */
export const WALL_DEPTH_MIN = 1;
export const WALL_DEPTH_MAX = 3;
export const WALL_DEPTH_DEFAULT = WALL_DEPTH_MIN;

export type WallDepth = 1 | 2 | 3;

/** Clamp any stored/queried value to a depth the surfaces can actually draw. */
export function normalizeWallDepth(value: unknown): WallDepth {
  const n = typeof value === 'string' ? Number(value) : (value as number);
  if (!Number.isFinite(n)) return WALL_DEPTH_DEFAULT;
  const clamped = Math.min(WALL_DEPTH_MAX, Math.max(WALL_DEPTH_MIN, Math.round(n)));
  return clamped as WallDepth;
}

/** 'C2' / 'P3' — restated client-side only as the fallback when a payload
 *  arrives without the server's label (an older cached response). */
export function wallLabel(side: WallSide, rank: number): string {
  return `${side === 'call' ? 'C' : 'P'}${rank}`;
}

/** Full name for a tooltip / legend: 'Call Wall' for C1, '2nd Call Wall' for C2. */
export function wallFullName(side: WallSide, rank: number): string {
  const noun = side === 'call' ? 'Call Wall' : 'Put Wall';
  if (rank <= 1) return noun;
  return `${rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`} ${noun}`;
}

// An empty string is absent data, not zero — the same coercion core/keyLevels
// uses, so a blank column never becomes a $0 strike.
function finite(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? Number(value) : (value as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

/** A wall is only real when it is a positive price (see core/keyLevels). */
function positiveLevel(value: unknown): number | null {
  const n = finite(value);
  return n != null && n > 0 ? n : null;
}

/**
 * Normalize an API ladder into ranked `WallLevel`s, with `primary` pinned to
 * rank 1.
 *
 * `primary` is whatever the surface is actually drawing as its Call/Put Wall
 * line. Surfaces resolve that with their own fallback chain — the Strike
 * Profile reads a rewind bucket and falls back to the live summary, the Gamma
 * Chart prefers the expiration-filtered bucket — and the ladder they hold may
 * have come from the other side of that chain. Pinning here means C1 and the
 * primary line can never name different strikes on the same axis, which is the
 * one way this feature could actively mislead.
 *
 * Ranks are renumbered after pinning, duplicates of the primary strike are
 * dropped, and the result is capped at `depth`. A short list means the chain
 * genuinely has no further wall on that side — callers render what they get
 * and never pad.
 */
export function parseWallLadder(
  raw: ReadonlyArray<WallLevelPayload> | null | undefined,
  side: WallSide,
  primary: number | null | undefined,
  depth: number = WALL_DEPTH_MAX,
): WallLevel[] {
  const cap = Math.max(0, Math.round(depth));
  if (cap === 0) return [];

  const parsed: Array<{ strike: number; strength: number | null; order: number }> = [];
  const seen = new Set<number>();
  (Array.isArray(raw) ? raw : []).forEach((entry, index) => {
    const strike = positiveLevel(entry?.strike);
    if (strike == null || seen.has(strike)) return;
    seen.add(strike);
    // Trust the server's rank for ordering; fall back to payload order so a
    // response without ranks still draws nearest-strongest first.
    parsed.push({ strike, strength: finite(entry?.strength), order: finite(entry?.rank) ?? index + 1 });
  });
  parsed.sort((a, b) => a.order - b.order);

  const head = positiveLevel(primary);
  const ordered = head == null
    ? parsed
    : [
        { strike: head, strength: parsed.find((p) => p.strike === head)?.strength ?? null, order: 0 },
        ...parsed.filter((p) => p.strike !== head),
      ];

  return ordered.slice(0, cap).map((entry, i) => ({
    rank: i + 1,
    label: wallLabel(side, i + 1),
    side,
    strike: entry.strike,
    strength: entry.strength,
  }));
}

/**
 * The ranks a surface draws IN ADDITION to its existing primary wall line.
 *
 * Every surface already renders C1/P1 as "Call Wall"/"Put Wall" with its own
 * styling, and those lines must keep looking exactly as they do today. So the
 * ladder's contribution is ranks 2..depth — nothing at depth 1, which is why
 * the default costs an existing user no visual change at all.
 */
export function extraWalls(ladder: readonly WallLevel[], depth: number): WallLevel[] {
  const cap = normalizeWallDepth(depth);
  return ladder.filter((w) => w.rank >= 2 && w.rank <= cap);
}

/**
 * Opacity for a secondary wall, so C2 reads as subordinate to the Call Wall
 * and C3 as subordinate to C2. A flat opacity across ranks would make three
 * lines of equal weight and turn the price axis into a ladder of equals, which
 * is exactly the wrong read: rank IS the message.
 */
export function wallRankOpacity(rank: number): number {
  if (rank <= 1) return 1;
  return rank === 2 ? 0.66 : 0.44;
}

/** Dash pattern for a secondary wall — finer than the primary's, so the
 *  hierarchy survives in a screenshot with no colour. */
export function wallRankDash(rank: number): string {
  return rank === 2 ? '2 4' : '1 4';
}

/** Distance from spot as a signed percent, for a secondary wall's tooltip.
 *  Null when either side is missing — never a misleading 0%. */
export function wallDistancePct(strike: number, spot: number | null | undefined): number | null {
  const s = finite(spot);
  if (s == null || s === 0) return null;
  return ((strike - s) / s) * 100;
}

/**
 * Tooltip / title copy for one rung: what it is, where it is, and how much
 * book is behind it. Same sentence on every surface.
 */
export function wallTooltip(level: WallLevel, spot: number | null | undefined): string {
  const pct = wallDistancePct(level.strike, spot);
  const where = pct == null
    ? ''
    : ` · ${pct >= 0 ? '+' : '-'}${Math.abs(pct).toFixed(2)}% from spot`;
  const size = level.strength == null || !Number.isFinite(level.strength)
    ? ''
    : ` · ${formatWallStrength(level.strength)} gamma`;
  return `${level.label} — ${wallFullName(level.side, level.rank)} at ${level.strike.toFixed(2)}${where}${size}`;
}

/** Compact dollar-gamma magnitude ($1.2B / $840M / $12K) for the tooltip. */
export function formatWallStrength(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}
