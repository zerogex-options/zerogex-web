/**
 * The Flow Analysis chart's strike ribbon: who crossed the spread, strike by
 * strike, bar by bar, drawn behind the price.
 *
 * Every strike in the price window is a lane and every bar (5-minute or
 * 1-minute) can drop one dot in it: a circle in one of three sizes by that
 * strike's net flow in the bar, green where the bullish side led and red where
 * the bearish side did. The bullish side is calls bought plus puts sold, the
 * bearish side puts bought plus calls sold, exactly as the rest of the page
 * counts them (core/flowAnalysis). A strike where neither side led by much is
 * two-way and draws nothing, and a size filter hides the smaller dots.
 *
 * The dots can instead read calls against puts, whoever bought or sold them:
 * green where more calls traded at the strike, red where more puts did. That
 * is how some traders' own charts read a strike, and it leans with the money
 * (calls trade most above the price, puts below), which the sides do not.
 *
 * Pure: no React, no DOM. Rows come from /api/flow/by-strike.
 */

import { ellipsePath, inferStrikeStep, RIBBON_MIN_NORM, tierFor, type RibbonTier } from './gexRibbons.ts';
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
  /** Calls traded, bought or sold. */
  calls: number;
  /** Puts traded, bought or sold. */
  puts: number;
  /** Calls bought plus puts sold. */
  bullish: number;
  /** Puts bought plus calls sold. */
  bearish: number;
  /** Bullish minus bearish: the strike's net flow in the bar. */
  net: number;
}

export type StrikeLean = 'bullish' | 'bearish' | 'even';

/** What a dot weighs: the bought and sold sides, or calls against puts. */
export type StrikeColorBy = 'sides' | 'callsPuts';

/**
 * A strike leads one way only when that side's lead is at least this share of
 * what traded there. Under it the strike is two-way and draws no dot: a 51/49
 * split is noise, and the 09:30 auction, which has no side to go on, splits
 * exactly even.
 */
export const STRIKE_EVEN_SHARE = 0.1;

/** The ribbon's size filter: the smallest dot it shows. */
export type StrikeDotSize = 'all' | 'medium' | 'large';

/**
 * Where each filter setting starts, as a share of the full-size net flow.
 * These are the three tiers the dots already come in (core/gexRibbons
 * tierFor), so Medium+ shows the medium and large dots and Large the large.
 */
export const STRIKE_SIZE_FLOOR: Record<StrikeDotSize, number> = {
  all: RIBBON_MIN_NORM,
  medium: 0.15,
  large: 0.5,
};

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

type LeanInput = Pick<StrikeCell, 'net' | 'volume'> & Partial<Pick<StrikeCell, 'calls' | 'puts'>>;

/** A strike's net in the bar: bullish minus bearish, or calls minus puts. */
export function cellNet(cell: LeanInput, by: StrikeColorBy = 'sides'): number {
  return by === 'callsPuts' ? (cell.calls ?? 0) - (cell.puts ?? 0) : cell.net;
}

/** 'bullish' reads green: the bullish side led, or more calls traded. */
export function strikeLean(cell: LeanInput, by: StrikeColorBy = 'sides'): StrikeLean {
  const net = cellNet(cell, by);
  if (!(cell.volume > 0) || Math.abs(net) < cell.volume * STRIKE_EVEN_SHARE) return 'even';
  return net > 0 ? 'bullish' : 'bearish';
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
    bar.set(strike, {
      strike,
      callsBought,
      callsSold,
      putsBought,
      putsSold,
      volume,
      calls: callsBought + callsSold,
      puts: putsBought + putsSold,
      bullish,
      bearish,
      net: bullish - bearish,
    });
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
  /** Weak tiers first, so the larger dots draw over the smaller ones. */
  paths: StrikeRibbonPath[];
  /** The net flow a dot is full size at: the session's, or the top of the cells on screen. */
  fullNet: number;
  /** A full-size dot's radius, in px. */
  dotR: number;
  strikeStep: number | null;
  /** Dots drawn (after the two-way cut and the size filter). */
  count: number;
}

// A large dot's radius, as a fraction of the strike gap and in px: it leaves
// clear space between lanes so each strike reads as its own row, and stops
// growing on a chart zoomed far enough that a lane is very tall.
const R_FRACTION = 0.42;
const R_MAX = 12;
const R_MIN = 1;
// Three sizes, one per tier, so small, medium and large tell apart at a glance
// rather than shading into each other.
const TIER_RADIUS: Record<RibbonTier, number> = { weak: 0.34, mid: 0.62, strong: 1 };
const FALLBACK_GAP = 12;
// A dot is full size at this quantile of the in-view net flows, not at the
// single largest: one block print would otherwise shrink every other dot on
// the chart to a speck. Small sets use the max, where a quantile means little.
const FULL_SIZE_QUANTILE = 0.98;
const QUANTILE_MIN_CELLS = 50;
const TIER_ORDER: Record<RibbonTier, number> = { weak: 0, mid: 1, strong: 2 };

function fullSize(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length < QUANTILE_MIN_CELLS) return sorted[sorted.length - 1];
  return sorted[Math.min(sorted.length - 1, Math.floor(FULL_SIZE_QUANTILE * (sorted.length - 1)))];
}

/**
 * The net flow a dot is full size at, over the cells one side led inside
 * the price window. The chart takes it over the whole session, so zooming in
 * spreads the dots out without resizing them.
 */
export function strikeFullNet(
  cellsByBar: ReadonlyMap<number, readonly StrikeCell[]>,
  barStarts: readonly number[],
  dMin: number,
  dMax: number,
  by: StrikeColorBy = 'sides',
): number {
  const nets: number[] = [];
  for (const ms of barStarts) {
    for (const cell of cellsByBar.get(ms) ?? []) {
      if (cell.strike < dMin || cell.strike > dMax || strikeLean(cell, by) === 'even') continue;
      nets.push(Math.abs(cellNet(cell, by)));
    }
  }
  return fullSize(nets);
}

/** True for a cell the ribbon draws at this full size and filter setting. */
export function strikeCellShown(cell: StrikeCell, fullNet: number, size: StrikeDotSize = 'all', by: StrikeColorBy = 'sides'): boolean {
  if (strikeLean(cell, by) === 'even' || !(fullNet > 0)) return false;
  return Math.min(1, Math.abs(cellNet(cell, by)) / fullNet) >= STRIKE_SIZE_FLOOR[size];
}

/** A cell's dot radius in px, for the layer it is drawn in: one of three sizes. */
export function strikeDotRadius(
  cell: StrikeCell,
  layer: Pick<StrikeRibbonLayer, 'fullNet' | 'dotR'>,
  by: StrikeColorBy = 'sides',
): number {
  if (!(layer.fullNet > 0)) return R_MIN;
  const norm = Math.min(1, Math.abs(cellNet(cell, by)) / layer.fullNet);
  return Math.max(R_MIN, layer.dotR * TIER_RADIUS[tierFor(norm)]);
}

/**
 * The ribbon for the bars on screen. Each dot is a circle in one of three
 * sizes by the strike's net flow in the bar, so ordinary strikes stay small
 * and the few pressed hard stand out, as on a 1-minute chart they must.
 * Two-way strikes draw nothing; `size` hides the dots under its floor. `by`
 * picks what a dot weighs; `fullNet`, when given, is the full size to use
 * instead of the one the bars on screen would set.
 * Grouped per (lean, tier), so a whole session of dots costs six path nodes,
 * not thousands, and a hover that redraws the chart stays cheap.
 */
export function buildStrikeRibbon(
  cellsByBar: ReadonlyMap<number, readonly StrikeCell[]>,
  barStarts: readonly number[],
  geom: StrikeRibbonGeometry,
  size: StrikeDotSize = 'all',
  { by = 'sides', fullNet }: { by?: StrikeColorBy; fullNet?: number } = {},
): StrikeRibbonLayer {
  const inView: Array<{ ms: number; cell: StrikeCell }> = [];
  const strikes = new Set<number>();
  for (const ms of barStarts) {
    for (const cell of cellsByBar.get(ms) ?? []) {
      strikes.add(cell.strike);
      if (cell.strike < geom.dMin || cell.strike > geom.dMax || strikeLean(cell, by) === 'even') continue;
      inView.push({ ms, cell });
    }
  }
  const strikeStep = inferStrikeStep(strikes);
  // Full size is set by everything one side led, before the filter, so
  // switching to Large hides the smaller dots without growing the rest.
  const full = fullNet != null && fullNet > 0 ? fullNet : fullSize(inView.map((c) => Math.abs(cellNet(c.cell, by))));
  if (inView.length === 0 || full <= 0) return { paths: [], fullNet: 0, dotR: 0, strikeStep, count: 0 };

  const gapPx = strikeStep != null ? Math.abs(geom.yPrice(geom.dMin) - geom.yPrice(geom.dMin + strikeStep)) : FALLBACK_GAP;
  const layer = { fullNet: full, dotR: Math.max(R_MIN, Math.min(R_MAX, gapPx * R_FRACTION)) };

  const groups = new Map<string, StrikeRibbonPath & { parts: string[] }>();
  let drawn = 0;
  for (const { ms, cell } of inView) {
    const norm = Math.min(1, Math.abs(cellNet(cell, by)) / full);
    if (norm < STRIKE_SIZE_FLOOR[size]) continue;
    const r = strikeDotRadius(cell, layer, by);
    const tier = tierFor(norm);
    const lean = strikeLean(cell, by);
    const key = `${lean}|${tier}`;
    let g = groups.get(key);
    if (!g) {
      g = { lean, tier, d: '', parts: [] };
      groups.set(key, g);
    }
    g.parts.push(ellipsePath(geom.x(ms), geom.yPrice(cell.strike), r, r));
    drawn += 1;
  }
  const paths = Array.from(groups.values())
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier])
    .map(({ lean, tier, parts }) => ({ lean, tier, d: parts.join(' ') }));
  return { paths, ...layer, strikeStep, count: drawn };
}
