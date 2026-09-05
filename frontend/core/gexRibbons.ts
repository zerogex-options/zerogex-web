/**
 * GEX ribbons — per-strike dealer gamma through time, drawn behind the tape.
 *
 * For every visible bar and every strike inside the price window, one ellipse
 * ("orb") sized by that strike's |net gamma| in the analytics bucket the bar
 * falls in and tinted by sign. Across a session the heavy strikes read as
 * continuous ribbons running along the candles — the walls literally lie on
 * the tape — while thin strikes fade to slivers and empty ones stay blank.
 *
 * Pure geometry: no React, no DOM. The chart hands in its bars, the
 * strike-profile buckets it already polls for the rail, and its own x / y
 * mappers; this returns SVG path data grouped per (strike, sign, tier) so a
 * session of ~1,000 orbs costs a few dozen nodes, not a thousand.
 */

export interface RibbonBar {
  /** Bar start, ISO-8601. */
  timestamp: string;
}

export interface RibbonBucketStrike {
  strike?: number | string;
  net_gamma?: number | string | null;
}

export interface RibbonBucket {
  /** Bucket start, ISO-8601 — the strike-profile timeseries grid. */
  timestamp: string;
  strikes?: RibbonBucketStrike[];
}

/** The chart's own mappers, in its viewBox units. */
export interface RibbonGeometry {
  xForIndex: (i: number) => number;
  yPrice: (price: number) => number;
  /** Horizontal distance between adjacent bars. */
  xStep: number;
  /** Visible price window. */
  dMin: number;
  dMax: number;
}

export type RibbonTier = 'strong' | 'mid' | 'weak';

export interface RibbonPath {
  strike: number;
  positive: boolean;
  tier: RibbonTier;
  /** SVG path data: every orb of this (strike, sign, tier) group. */
  d: string;
}

export interface RibbonLayer {
  paths: RibbonPath[];
  /** Largest |net gamma| in view — the orb that fills its lane. */
  maxAbs: number;
  /** Inferred strike spacing of the chain, or null when unknowable. */
  strikeStep: number | null;
  /** Orbs drawn (after the noise floor). */
  count: number;
}

/** The strike-profile timeseries the chart polls is on a 5-minute grid. */
export const RIBBON_BUCKET_MS = 5 * 60_000;

/** Opacity per magnitude tier — three tiers keep the group count small. */
export const RIBBON_TIER_OPACITY: Record<RibbonTier, number> = {
  strong: 0.82,
  mid: 0.48,
  weak: 0.22,
};

/** Below this fraction of the strongest orb in view, draw nothing. */
export const RIBBON_MIN_NORM = 0.03;

// Half-width as a fraction of the bar slot: a hair of gap between orbs so a
// ribbon still reads as a string of prints, not a bar.
const RX_FRACTION = 0.44;
// Half-height cap as a fraction of the strike gap — never touches a neighbour.
const RY_FRACTION = 0.46;
// Near-linear size curve: the walls fill their lane, mid-weight strikes stay
// visible but clearly smaller, and the tape underneath keeps the lead.
const RY_EXPONENT = 0.85;
const RY_MIN = 0.7;
const RX_MIN = 0.6;
// Fallback strike gap (viewBox px) when the chain has a single strike in view.
const FALLBACK_GAP = 12;

function num(v: number | string | null | undefined): number | null {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : null;
}

/** Floor a bar start (ms) onto the bucket grid the ribbons are keyed by. */
export function ribbonBucketKey(ms: number, bucketMs: number = RIBBON_BUCKET_MS): number {
  return Math.floor(ms / bucketMs) * bucketMs;
}

/** Smallest positive gap between distinct strikes — the chain's strike step. */
export function inferStrikeStep(strikes: Iterable<number>): number | null {
  const sorted = Array.from(new Set(Array.from(strikes).filter((s) => Number.isFinite(s)))).sort((a, b) => a - b);
  let best = Infinity;
  for (let i = 1; i < sorted.length; i += 1) best = Math.min(best, sorted[i] - sorted[i - 1]);
  return Number.isFinite(best) && best > 0 ? best : null;
}

export function tierFor(norm: number): RibbonTier {
  if (norm >= 0.5) return 'strong';
  if (norm >= 0.15) return 'mid';
  return 'weak';
}

/** One ellipse as absolute SVG path data (two arcs), so many can share a path. */
export function ellipsePath(cx: number, cy: number, rx: number, ry: number): string {
  const x0 = (cx - rx).toFixed(1);
  const x1 = (cx + rx).toFixed(1);
  const y = cy.toFixed(1);
  const r = `${rx.toFixed(2)} ${ry.toFixed(2)}`;
  return `M ${x0} ${y} A ${r} 0 1 0 ${x1} ${y} A ${r} 0 1 0 ${x0} ${y} Z`;
}

/**
 * Build the ribbon layer for the bars on screen.
 *
 * Each bar reads the bucket whose grid slot contains the bar's start: a 1-min
 * bar shares its 5-min bucket with its four neighbours (the ribbon repeats),
 * a 15-min or hourly bar reads the bucket at its own start. Bars with no
 * bucket (older than the polled window) draw nothing — gaps stay blank.
 */
export function buildRibbonLayer(
  bars: readonly RibbonBar[],
  buckets: readonly RibbonBucket[],
  geom: RibbonGeometry,
  bucketMs: number = RIBBON_BUCKET_MS,
): RibbonLayer {
  const byKey = new Map<number, Map<number, number>>();
  const allStrikes = new Set<number>();
  for (const b of buckets) {
    const t = new Date(b.timestamp).getTime();
    if (!Number.isFinite(t)) continue;
    const m = new Map<number, number>();
    for (const s of b.strikes ?? []) {
      const strike = num(s.strike);
      const net = num(s.net_gamma);
      if (strike == null || net == null) continue;
      m.set(strike, net);
      allStrikes.add(strike);
    }
    byKey.set(ribbonBucketKey(t, bucketMs), m);
  }
  const strikeStep = inferStrikeStep(allStrikes);

  const cells: Array<{ i: number; strike: number; net: number }> = [];
  let maxAbs = 0;
  bars.forEach((bar, i) => {
    const t = new Date(bar.timestamp).getTime();
    if (!Number.isFinite(t)) return;
    const m = byKey.get(ribbonBucketKey(t, bucketMs));
    if (!m) return;
    for (const [strike, net] of m) {
      if (net === 0 || strike < geom.dMin || strike > geom.dMax) continue;
      cells.push({ i, strike, net });
      maxAbs = Math.max(maxAbs, Math.abs(net));
    }
  });
  if (cells.length === 0 || maxAbs <= 0) return { paths: [], maxAbs: 0, strikeStep, count: 0 };

  const gapPx =
    strikeStep != null ? Math.abs(geom.yPrice(geom.dMin) - geom.yPrice(geom.dMin + strikeStep)) : FALLBACK_GAP;
  const maxRy = Math.max(RY_MIN, gapPx * RY_FRACTION);
  const rx = Math.max(RX_MIN, geom.xStep * RX_FRACTION);

  const groups = new Map<string, { strike: number; positive: boolean; tier: RibbonTier; parts: string[] }>();
  let count = 0;
  for (const c of cells) {
    const norm = Math.abs(c.net) / maxAbs;
    if (norm < RIBBON_MIN_NORM) continue;
    const ry = Math.max(RY_MIN, maxRy * Math.pow(norm, RY_EXPONENT));
    const tier = tierFor(norm);
    const positive = c.net > 0;
    const key = `${c.strike}|${positive ? 'p' : 'n'}|${tier}`;
    let g = groups.get(key);
    if (!g) {
      g = { strike: c.strike, positive, tier, parts: [] };
      groups.set(key, g);
    }
    g.parts.push(ellipsePath(geom.xForIndex(c.i), geom.yPrice(c.strike), rx, ry));
    count += 1;
  }
  const paths = Array.from(groups.values()).map((g) => ({
    strike: g.strike,
    positive: g.positive,
    tier: g.tier,
    d: g.parts.join(' '),
  }));
  return { paths, maxAbs, strikeStep, count };
}
