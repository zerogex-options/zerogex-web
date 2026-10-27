/**
 * The Flow Analysis chart's strike ribbon: who crossed the spread, strike by
 * strike, bar by bar, drawn behind the price.
 *
 * Every strike in the price window is a lane and every bar (5-minute or
 * 1-minute) can drop one dot in it. A dot is the strike's net flow in the bar:
 * calls bought minus calls sold, plus puts sold minus puts bought. That is the
 * bullish side (calls bought plus puts sold) less the bearish side (puts
 * bought plus calls sold), exactly as the rest of the page counts them
 * (core/flowAnalysis). Green above zero, red below; a strike whose sides
 * cancel exactly draws nothing.
 *
 * Dots come in three sizes. On Auto they are measured against the day's own
 * flow, so they suit any symbol without setup but can step down a size as
 * bigger flow arrives. With the reader's own sizes, in contracts, a dot's size
 * is its net alone, so a minute keeps its dot once it closes. A size filter
 * hides the smaller dots either way.
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
  /** Calls bought plus puts sold. */
  bullish: number;
  /** Puts bought plus calls sold. */
  bearish: number;
  /** Bullish minus bearish: the strike's net flow in the bar. */
  net: number;
}

export type StrikeLean = 'bullish' | 'bearish' | 'even';

/** The ribbon's size filter: the smallest dot it shows. */
export type StrikeDotSize = 'all' | 'medium' | 'large';

/** The size filter's floor, as the smallest of the three sizes it keeps. */
const FILTER_MIN_TIER: Record<StrikeDotSize, RibbonTier> = { all: 'weak', medium: 'mid', large: 'strong' };
const TIER_ORDER: Record<RibbonTier, number> = { weak: 0, mid: 1, strong: 2 };

/**
 * How the dots are sized. Auto measures a strike against the day's own flow
 * (core/gexRibbons tierFor: medium from 15% of a full-size net, large from
 * half of it, nothing under 5%). Contracts are the reader's own: a dot is
 * small from `small` net contracts, medium from `medium`, large from `large`,
 * and nothing under `small`.
 */
export type StrikeSizing = { kind: 'auto' } | { kind: 'contracts'; small: number; medium: number; large: number };
export const AUTO_SIZING: StrikeSizing = { kind: 'auto' };

/**
 * Sizes as the reader typed them, made usable: whole contracts, at least 1,
 * in rising order. Anything unreadable is Auto.
 */
export function cleanSizing(small: number, medium: number, large: number): StrikeSizing {
  const vals = [small, medium, large].map((v) => Math.round(v));
  if (!vals.every((v) => Number.isFinite(v) && v >= 1)) return AUTO_SIZING;
  const [a, b, c] = vals.sort((x, y) => x - y);
  return { kind: 'contracts', small: a, medium: b, large: c };
}

/** Sizes as stored per browser: 'auto', or "small,medium,large". */
export function parseSizing(stored: string | null | undefined): StrikeSizing {
  const parts = (stored ?? '').split(',').map((v) => Number(v));
  return parts.length === 3 ? cleanSizing(parts[0], parts[1], parts[2]) : AUTO_SIZING;
}

export function sizingKey(sizing: StrikeSizing): string {
  return sizing.kind === 'auto' ? 'auto' : `${sizing.small},${sizing.medium},${sizing.large}`;
}

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

/** Green above zero, red below; sides that cancel exactly are even and draw nothing. */
export function strikeLean(cell: Pick<StrikeCell, 'net'>): StrikeLean {
  if (cell.net > 0) return 'bullish';
  return cell.net < 0 ? 'bearish' : 'even';
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

/** What a layer sizes its dots by. */
export interface StrikeScale {
  sizing: StrikeSizing;
  /** On Auto, the net flow a dot is full size at; unused with contract sizes. */
  fullNet: number;
}

export interface StrikeRibbonLayer extends StrikeScale {
  /** Weak tiers first, so the larger dots draw over the smaller ones. */
  paths: StrikeRibbonPath[];
  /** A large dot's radius, in px. */
  dotR: number;
  strikeStep: number | null;
  /** Dots drawn (after the size filter). */
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
// On Auto a dot is full size at this quantile of the in-view net flows, not
// at the single largest: one block print would otherwise shrink every other
// dot on the chart to a speck. Small sets use the max, where a quantile means
// little.
const FULL_SIZE_QUANTILE = 0.98;
const QUANTILE_MIN_CELLS = 50;

function fullSize(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  if (sorted.length < QUANTILE_MIN_CELLS) return sorted[sorted.length - 1];
  return sorted[Math.min(sorted.length - 1, Math.floor(FULL_SIZE_QUANTILE * (sorted.length - 1)))];
}

/**
 * On Auto, the net flow a dot is full size at, over the cells with a net
 * inside the price window. The chart takes it over the whole session, so
 * zooming in spreads the dots out without resizing them.
 */
export function strikeFullNet(
  cellsByBar: ReadonlyMap<number, readonly StrikeCell[]>,
  barStarts: readonly number[],
  dMin: number,
  dMax: number,
): number {
  const nets: number[] = [];
  for (const ms of barStarts) {
    for (const cell of cellsByBar.get(ms) ?? []) {
      if (cell.strike < dMin || cell.strike > dMax || cell.net === 0) continue;
      nets.push(Math.abs(cell.net));
    }
  }
  return fullSize(nets);
}

/**
 * The three sizes Auto would draw at a full size, in net contracts: where its
 * small, medium and large dots start. A starting point for the reader's own.
 */
export function autoSizeContracts(fullNet: number): { small: number; medium: number; large: number } | null {
  if (!(fullNet > 0)) return null;
  // Two significant figures: 1,234 reads as 1,200, a number someone would type.
  const nice = (v: number) => {
    if (v < 10) return Math.max(1, Math.ceil(v));
    const mag = 10 ** (Math.floor(Math.log10(v)) - 1);
    return Math.round(v / mag) * mag;
  };
  return { small: nice(fullNet * RIBBON_MIN_NORM), medium: nice(fullNet * 0.15), large: nice(fullNet * 0.5) };
}

/** A cell's size at this scale, or null when it is too small to draw at all. */
export function strikeTier(cell: Pick<StrikeCell, 'net'>, scale: StrikeScale): RibbonTier | null {
  const net = Math.abs(cell.net);
  if (!(net > 0)) return null;
  if (scale.sizing.kind === 'contracts') {
    const { small, medium, large } = scale.sizing;
    if (net >= large) return 'strong';
    if (net >= medium) return 'mid';
    return net >= small ? 'weak' : null;
  }
  if (!(scale.fullNet > 0)) return null;
  const norm = Math.min(1, net / scale.fullNet);
  return norm >= RIBBON_MIN_NORM ? tierFor(norm) : null;
}

/** True for a cell the ribbon draws at this scale and filter setting. */
export function strikeCellShown(cell: Pick<StrikeCell, 'net'>, scale: StrikeScale, size: StrikeDotSize = 'all'): boolean {
  const tier = strikeTier(cell, scale);
  return tier != null && TIER_ORDER[tier] >= TIER_ORDER[FILTER_MIN_TIER[size]];
}

/** A cell's dot radius in px, for the layer it is drawn in: one of three sizes. */
export function strikeDotRadius(cell: Pick<StrikeCell, 'net'>, layer: Pick<StrikeRibbonLayer, 'sizing' | 'fullNet' | 'dotR'>): number {
  const tier = strikeTier(cell, layer);
  return tier ? Math.max(R_MIN, layer.dotR * TIER_RADIUS[tier]) : R_MIN;
}

/**
 * The ribbon for the bars on screen. Each dot is a circle in one of three
 * sizes by the strike's net flow in the bar, so ordinary strikes stay small
 * and the few pressed hard stand out, as on a 1-minute chart they must.
 * `size` hides the dots under its floor. `sizing` is Auto or the reader's own
 * contract sizes; on Auto, `fullNet`, when given, is the full size to use
 * instead of the one the bars on screen would set.
 * Grouped per (lean, tier), so a whole session of dots costs six path nodes,
 * not thousands, and a hover that redraws the chart stays cheap.
 */
export function buildStrikeRibbon(
  cellsByBar: ReadonlyMap<number, readonly StrikeCell[]>,
  barStarts: readonly number[],
  geom: StrikeRibbonGeometry,
  size: StrikeDotSize = 'all',
  { sizing = AUTO_SIZING, fullNet }: { sizing?: StrikeSizing; fullNet?: number } = {},
): StrikeRibbonLayer {
  const inView: Array<{ ms: number; cell: StrikeCell }> = [];
  const strikes = new Set<number>();
  for (const ms of barStarts) {
    for (const cell of cellsByBar.get(ms) ?? []) {
      strikes.add(cell.strike);
      if (cell.strike < geom.dMin || cell.strike > geom.dMax || cell.net === 0) continue;
      inView.push({ ms, cell });
    }
  }
  const strikeStep = inferStrikeStep(strikes);
  // On Auto, full size is set by every strike with a net, before the filter,
  // so switching to Large hides the smaller dots without growing the rest.
  const full =
    sizing.kind !== 'auto' ? 0 : fullNet != null && fullNet > 0 ? fullNet : fullSize(inView.map((c) => Math.abs(c.cell.net)));
  if (inView.length === 0 || (sizing.kind === 'auto' && full <= 0)) {
    return { paths: [], sizing, fullNet: 0, dotR: 0, strikeStep, count: 0 };
  }

  const gapPx = strikeStep != null ? Math.abs(geom.yPrice(geom.dMin) - geom.yPrice(geom.dMin + strikeStep)) : FALLBACK_GAP;
  const layer = { sizing, fullNet: full, dotR: Math.max(R_MIN, Math.min(R_MAX, gapPx * R_FRACTION)) };

  const groups = new Map<string, StrikeRibbonPath & { parts: string[] }>();
  let drawn = 0;
  for (const { ms, cell } of inView) {
    if (!strikeCellShown(cell, layer, size)) continue;
    const tier = strikeTier(cell, layer) as RibbonTier;
    const r = strikeDotRadius(cell, layer);
    const lean = strikeLean(cell);
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
