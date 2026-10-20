/**
 * The Flow Analysis chart's strike ribbon: who crossed the spread, strike by
 * strike, bar by bar, drawn behind the price.
 *
 * Every strike in the price window is a lane and every 5-minute bar drops one
 * orb in it: sized by the contracts that traded at that strike in that bar,
 * colored by which side led there. The bullish side is calls bought plus puts
 * sold, the bearish side puts bought plus calls sold, exactly as the rest of
 * the page counts them (core/flowAnalysis). A strike where neither side led
 * by much reads as two-way, in a neutral ink.
 *
 * The orbs are the Gamma Chart's GEX ribbon orbs (core/gexRibbons): the same
 * shape, lane cap and three opacity tiers, so the two ribbons read the same
 * way. What differs is what they encode: gamma there, contracts here.
 *
 * Pure: no React, no DOM. Rows come from /api/flow/by-strike.
 */

import {
  ellipsePath,
  inferStrikeStep,
  RIBBON_MIN_NORM,
  RIBBON_RY_FRACTION,
  RIBBON_RY_MAX,
  tierFor,
  type RibbonTier,
} from './gexRibbons.ts';
import { priceDomain } from './technicalsSession.ts';

/** One row of /api/flow/by-strike: a strike that traded in one bar. */
export interface FlowStrikeRow {
  /** Bar start, ISO-8601 UTC. */
  timestamp: string;
  strike: number | string;
  call_bought?: number | string | null;
  call_sold?: number | string | null;
  put_bought?: number | string | null;
  put_sold?: number | string | null;
}

export interface StrikeCell {
  strike: number;
  callsBought: number;
  callsSold: number;
  putsBought: number;
  putsSold: number;
  /** Every contract that traded at the strike in the bar. */
  volume: number;
  /** Calls bought plus puts sold. */
  bullish: number;
  /** Puts bought plus calls sold. */
  bearish: number;
  /** Bullish minus bearish: the strike's net flow in the bar. */
  net: number;
}

export type StrikeLean = 'bullish' | 'bearish' | 'even';

/**
 * A strike leads one way only when that side's lead is at least this share of
 * what traded there. Under it the strike is two-way: a 51/49 split is noise,
 * and the 09:30 auction, which has no side to go on, splits exactly even.
 */
export const STRIKE_EVEN_SHARE = 0.1;

/**
 * How many strike lanes the price window holds at least, when the ribbon is
 * on. A quiet session's range can be two strikes wide, which would leave the
 * ribbon two lanes to say anything in.
 */
export const STRIKE_MIN_LANES = 12;

function count(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function strikeLean(cell: Pick<StrikeCell, 'net' | 'volume'>): StrikeLean {
  if (!(cell.volume > 0) || Math.abs(cell.net) < cell.volume * STRIKE_EVEN_SHARE) return 'even';
  return cell.net > 0 ? 'bullish' : 'bearish';
}

/** The rows as cells, keyed by bar start (ms), each bar's cells strike-ascending. */
export function strikeCellsByBar(rows: readonly FlowStrikeRow[]): Map<number, StrikeCell[]> {
  const byBar = new Map<number, Map<number, StrikeCell>>();
  for (const row of rows) {
    const ms = new Date(row.timestamp).getTime();
    const strike = typeof row.strike === 'number' ? row.strike : parseFloat(String(row.strike));
    if (!Number.isFinite(ms) || !Number.isFinite(strike)) continue;
    const callsBought = count(row.call_bought);
    const callsSold = count(row.call_sold);
    const putsBought = count(row.put_bought);
    const putsSold = count(row.put_sold);
    const volume = callsBought + callsSold + putsBought + putsSold;
    if (volume <= 0) continue;
    const bullish = callsBought + putsSold;
    const bearish = putsBought + callsSold;
    let bar = byBar.get(ms);
    if (!bar) {
      bar = new Map();
      byBar.set(ms, bar);
    }
    // A repeated (bar, strike) is a newer read of the same bar: it replaces.
    bar.set(strike, { strike, callsBought, callsSold, putsBought, putsSold, volume, bullish, bearish, net: bullish - bearish });
  }
  const out = new Map<number, StrikeCell[]>();
  for (const [ms, cells] of byBar) out.set(ms, Array.from(cells.values()).sort((a, b) => a.strike - b.strike));
  return out;
}

/**
 * Fold a tail read into the session's rows. Every bar the tail carries is
 * replaced whole, because a strike can only gain contracts as a bar fills and
 * the tail is the newer read of it; bars the tail does not carry are kept.
 */
export function mergeStrikeRows(prev: readonly FlowStrikeRow[], tail: readonly FlowStrikeRow[]): FlowStrikeRow[] {
  if (tail.length === 0) return prev.slice();
  const tailBars = new Set<number>();
  for (const row of tail) {
    const ms = new Date(row.timestamp).getTime();
    if (Number.isFinite(ms)) tailBars.add(ms);
  }
  const kept = prev.filter((row) => !tailBars.has(new Date(row.timestamp).getTime()));
  return [...kept, ...tail];
}

/** The strike nearest `price` among a bar's cells, if it is within half a strike step. */
export function cellNear(cells: readonly StrikeCell[] | undefined, price: number, strikeStep: number | null): StrikeCell | null {
  if (!cells || cells.length === 0 || !Number.isFinite(price)) return null;
  let best: StrikeCell | null = null;
  let bestD = Infinity;
  for (const c of cells) {
    const d = Math.abs(c.strike - price);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  const reach = strikeStep != null && strikeStep > 0 ? strikeStep / 2 : Infinity;
  return best && bestD <= reach ? best : null;
}

/**
 * The price window when the ribbon is on: the session's prices, widened about
 * their middle to at least `minLanes` strikes, then the price pane's usual
 * rule (core/technicalsSession priceDomain): a level close enough to that
 * window joins it, and the window is padded. Widening first lets a wall a
 * strike or two past a quiet session's range sit on the scale with its lanes.
 */
export function ribbonPriceDomain(
  prices: readonly number[],
  levels: readonly (number | null | undefined)[],
  strikeStep: number | null,
  minLanes: number = STRIKE_MIN_LANES,
): { min: number; max: number } | null {
  const vals = prices.filter((v) => Number.isFinite(v));
  if (vals.length === 0 || strikeStep == null || !(strikeStep > 0)) return priceDomain(prices, levels);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const minSpan = strikeStep * minLanes;
  if (hi - lo >= minSpan) return priceDomain(vals, levels);
  const mid = (lo + hi) / 2;
  return priceDomain([...vals, mid - minSpan / 2, mid + minSpan / 2], levels);
}

export interface StrikeRibbonGeometry {
  /** Centre of a bar starting at `ms`, in px. */
  x: (ms: number) => number;
  yPrice: (price: number) => number;
  /** Width of one bar slot, in px. */
  slotW: number;
  /** Visible price window. */
  dMin: number;
  dMax: number;
}

export interface StrikeRibbonPath {
  lean: StrikeLean;
  tier: RibbonTier;
  /** SVG path data: every orb of this (lean, tier) group. */
  d: string;
}

export interface StrikeRibbonLayer {
  paths: StrikeRibbonPath[];
  /** The volume an orb is full size at: the top of the in-view cells, see below. */
  fullVolume: number;
  strikeStep: number | null;
  /** Orbs drawn (after the noise floor). */
  count: number;
}

// Half-width as a fraction of the bar slot, as on the GEX ribbon.
const RX_FRACTION = 0.44;
const RX_MIN = 0.6;
const RY_MIN = 1;
const FALLBACK_GAP = 12;
// An orb is full size at this quantile of the cell volumes in view, not at the
// single largest: one block print would otherwise shrink every other orb on
// the chart to a sliver. Small sets use the max, where a quantile means little.
const FULL_SIZE_QUANTILE = 0.98;
const QUANTILE_MIN_CELLS = 50;

function fullSizeVolume(volumes: number[]): number {
  if (volumes.length === 0) return 0;
  const sorted = volumes.slice().sort((a, b) => a - b);
  if (sorted.length < QUANTILE_MIN_CELLS) return sorted[sorted.length - 1];
  return sorted[Math.min(sorted.length - 1, Math.floor(FULL_SIZE_QUANTILE * (sorted.length - 1)))];
}

/**
 * The ribbon for the bars on screen, grouped per (lean, tier) so a whole
 * session of orbs costs nine path nodes, not thousands, and a hover that
 * redraws the chart stays cheap.
 */
export function buildStrikeRibbon(
  cellsByBar: ReadonlyMap<number, readonly StrikeCell[]>,
  barStarts: readonly number[],
  geom: StrikeRibbonGeometry,
): StrikeRibbonLayer {
  const inView: Array<{ ms: number; cell: StrikeCell }> = [];
  const strikes = new Set<number>();
  for (const ms of barStarts) {
    for (const cell of cellsByBar.get(ms) ?? []) {
      strikes.add(cell.strike);
      if (cell.strike < geom.dMin || cell.strike > geom.dMax) continue;
      inView.push({ ms, cell });
    }
  }
  const strikeStep = inferStrikeStep(strikes);
  const full = fullSizeVolume(inView.map((c) => c.cell.volume));
  if (inView.length === 0 || full <= 0) return { paths: [], fullVolume: 0, strikeStep, count: 0 };

  const gapPx = strikeStep != null ? Math.abs(geom.yPrice(geom.dMin) - geom.yPrice(geom.dMin + strikeStep)) : FALLBACK_GAP;
  const maxRy = Math.max(RY_MIN, Math.min(RIBBON_RY_MAX, gapPx * RIBBON_RY_FRACTION));
  const rx = Math.max(RX_MIN, geom.slotW * RX_FRACTION);

  const groups = new Map<string, StrikeRibbonPath & { parts: string[] }>();
  let drawn = 0;
  for (const { ms, cell } of inView) {
    const norm = Math.min(1, cell.volume / full);
    if (norm < RIBBON_MIN_NORM) continue;
    const ry = Math.max(RY_MIN, maxRy * norm);
    const tier = tierFor(norm);
    const lean = strikeLean(cell);
    const key = `${lean}|${tier}`;
    let g = groups.get(key);
    if (!g) {
      g = { lean, tier, d: '', parts: [] };
      groups.set(key, g);
    }
    g.parts.push(ellipsePath(geom.x(ms), geom.yPrice(cell.strike), rx, ry));
    drawn += 1;
  }
  const paths = Array.from(groups.values()).map(({ lean, tier, parts }) => ({ lean, tier, d: parts.join(' ') }));
  return { paths, fullVolume: full, strikeStep, count: drawn };
}
