/**
 * The Strike Panel's hover card — the pure half.
 *
 * On the Gamma Terminal the chart's gamma rail is portalled into a panel beside
 * the tape (GammaTerminalChart's `strikePanelTarget`). Hovering it, or tapping
 * it on a touch screen, puts up a readout card built like the candlestick
 * chart's crosshair card beside it: the strike under the pointer, its call, put
 * and net dealer gamma and open interest, how heavy it is against the rest of
 * the panel, the key levels on it, and (in the Split / Combined views) how it
 * breaks down by expiration.
 *
 * Every number on the card is one the rail was drawn from. This module only
 * decides which of them the pointer is on, how they read, and where the card
 * sits. The card lives INSIDE the panel, whose card clips anything hanging out
 * of it, so its placement works from the card's measured size rather than an
 * estimate of it (the lesson core/tooltipPlacement records).
 *
 * Pure (no React / no window) so it unit-tests directly.
 */

import type { ExpirationSegment } from './expirationGradient.ts';

/** One strike the panel draws, in the shape the card reads. */
export interface PanelStrikeRow {
  price: number;
  /**
   * Signed dollar gamma per side (calls ≥ 0, puts ≤ 0), as the rail draws
   * them. Null where the source carries no call/put split (the delayed public
   * snapshot ships net gamma only), so the card leaves the sides out instead of
   * printing a zero that reads like a measurement.
   */
  callGex: number | null;
  putGex: number | null;
  netGex: number;
  /** Open interest in contracts; null where the source omits it. */
  callOi: number | null;
  putOi: number | null;
}

/**
 * The strike nearest `price`: the one the pointer is on. The panel always snaps
 * to a strike, as the GEX Strike Profile does, so the guide line and the card
 * describe a bar that is actually drawn rather than a price between two of
 * them. Ties go to the first row. Null when there are no strikes or the price
 * is not a number.
 */
export function nearestStrike<T extends { price: number }>(rows: readonly T[], price: number): T | null {
  if (!Number.isFinite(price)) return null;
  let best: T | null = null;
  let bestDist = Infinity;
  for (const row of rows) {
    if (!Number.isFinite(row.price)) continue;
    const dist = Math.abs(row.price - price);
    if (dist < bestDist) {
      best = row;
      bestDist = dist;
    }
  }
  return best;
}

/**
 * A strike's |net gamma| as a share (0..1) of the heaviest strike among `rows`.
 * That says "how big is this one" in a unit that means the same thing on SPY
 * and on NDX, where the dollar figures differ by an order of magnitude. Null
 * when nothing among `rows` carries gamma.
 */
export function shareOfPeak(rows: readonly { netGex: number }[], netGex: number): number | null {
  if (!Number.isFinite(netGex)) return null;
  let peak = 0;
  for (const row of rows) {
    const v = Math.abs(row.netGex);
    if (Number.isFinite(v) && v > peak) peak = v;
  }
  if (!(peak > 0)) return null;
  return Math.min(1, Math.abs(netGex) / peak);
}

/** A key level, as the card names it. */
export interface CardLevel {
  label: string;
  value: number | null;
}

/**
 * The key levels the card names for a strike: every level sitting on it (a
 * Call Wall and the GEX King often share one), each with `dist` 0. When none
 * does, the nearest level and its distance, which is what the candlestick
 * readout's level row shows for a price. Empty when there are no levels.
 */
export function levelsForStrike<T extends CardLevel>(
  levels: readonly T[],
  strike: number,
): Array<T & { value: number; dist: number }> {
  const known = levels
    .filter((l): l is T & { value: number } => l.value != null && Number.isFinite(l.value))
    .map((l) => ({ ...l, dist: Math.abs(l.value - strike) }));
  // Walls, Max Pain, the King and the Pin are strikes, so "on it" is equality;
  // the tolerance only absorbs a served "580.0000001".
  const tol = 1e-6 * Math.max(1, Math.abs(strike));
  const on = known.filter((l) => l.dist <= tol).map((l) => ({ ...l, dist: 0 }));
  if (on.length > 0) return on;
  const nearest = known.sort((a, b) => a.dist - b.dist)[0];
  return nearest ? [nearest] : [];
}

/** One expiration's slice of a strike's call and put gamma. */
export interface ExpiryBreakdownRow {
  exp: string;
  /** Signed dollar gamma, in the same sign convention as the strike's sides. */
  call: number;
  put: number;
}

/** The expirations past the listed ones, folded into one row. */
export interface ExpiryBreakdownRest {
  count: number;
  call: number;
  put: number;
}

/**
 * A strike's call and put gamma split by expiration, nearest first: the
 * numbers behind the segments the Split / Combined bars are drawn in.
 *
 * The segments are shares of the authoritative per-side total (see
 * core/expirationGradient: the by-strike snapshot supplies the split, never the
 * magnitude), so each row is `total × share`. Rows follow `order` (the shown
 * expirations, nearest first), and an expiration with nothing at this strike on
 * either side is skipped.
 *
 * A chain can run to thirty expirations and the card has to fit in half a
 * panel, so the nearest `maxRows` are listed (they roll off soonest, which is
 * what the ramp is for) and everything after them is folded into `rest`. The
 * listed rows plus `rest` always sum back to the bar.
 *
 * Null when there is nothing to break down: no split at this strike, or one
 * expiration carrying all of it, which would only repeat the totals above it.
 */
export function expiryBreakdown(input: {
  callGex: number;
  putGex: number;
  call: readonly ExpirationSegment[];
  put: readonly ExpirationSegment[];
  order: readonly string[];
  maxRows: number;
}): { rows: ExpiryBreakdownRow[]; rest: ExpiryBreakdownRest | null } | null {
  const callFrac = new Map(input.call.map((s) => [s.exp, s.frac]));
  const putFrac = new Map(input.put.map((s) => [s.exp, s.frac]));
  const all: ExpiryBreakdownRow[] = [];
  for (const exp of input.order) {
    const cf = callFrac.get(exp) ?? 0;
    const pf = putFrac.get(exp) ?? 0;
    if (!(cf > 0) && !(pf > 0)) continue;
    all.push({ exp, call: input.callGex * cf, put: input.putGex * pf });
  }
  if (all.length < 2) return null;
  // Folding a single expiration into a "+1 later" row saves nothing, so the
  // cap only bites when it removes at least two.
  const cap = Math.max(1, Math.floor(input.maxRows));
  if (all.length <= cap + 1) return { rows: all, rest: null };
  const later = all.slice(cap);
  return {
    rows: all.slice(0, cap),
    rest: {
      count: later.length,
      call: later.reduce((s, r) => s + r.call, 0),
      put: later.reduce((s, r) => s + r.put, 0),
    },
  };
}

const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Days to expiry as the chip the GEX Strike Profile's breakdown shows: "0DTE",
 * "3DTE". Both keys are ET calendar dates (`todayKey` is etTodayDateKey()),
 * compared at UTC noon so no offset or DST change can round a day away. An
 * unparseable key comes back as it was given.
 */
export function dteLabel(exp: string, todayKey: string): string {
  const e = DATE_KEY_RE.exec(exp);
  const t = DATE_KEY_RE.exec(todayKey);
  if (!e || !t) return exp;
  const expNoon = Date.UTC(Number(e[1]), Number(e[2]) - 1, Number(e[3]), 12);
  const todayNoon = Date.UTC(Number(t[1]), Number(t[2]) - 1, Number(t[3]), 12);
  return `${Math.max(0, Math.round((expNoon - todayNoon) / 86_400_000))}DTE`;
}

/**
 * Which book the card is reading, for its header. The panel draws whatever the
 * Expiry filter leaves, and nothing else on the panel says which that is.
 *
 * `selection` is the reconciled selection (empty = the whole chain). A rolling
 * 0DTE pick is named as one, and on a day with no same-day expiry as the whole
 * chain it has widened to, because that is what the numbers then are.
 */
export function expiryScopeLabel(input: {
  selection: readonly string[];
  zeroDte?: { active: boolean; availableToday: boolean } | null;
}): string {
  if (input.zeroDte?.active) return input.zeroDte.availableToday ? '0DTE' : 'All expiries · no 0DTE today';
  if (input.selection.length === 0) return 'All expiries';
  if (input.selection.length === 1) return `Exp ${input.selection[0]}`;
  return `${input.selection.length} expiries`;
}

/** Pointer-to-card gap, CSS px: the candlestick readout's offset. */
export const READOUT_GAP = 14;
/** Card-to-panel-edge inset, CSS px. */
export const READOUT_INSET = 6;

export interface ReadoutBox {
  width: number;
  height: number;
}

/**
 * Where the card goes inside the panel, in CSS px from the panel's top-left.
 *
 * The panel's card clips anything that hangs out of it, so the card stays
 * inside on all four sides whenever it fits at all. Within that:
 *  - A mouse puts it beside the pointer and a little below, the way the
 *    candlestick readout sits: to the right, or to the left once the right
 *    runs out. When the panel is too narrow to seat it on either side, it goes
 *    fully below or fully above the pointer instead, so it never covers the
 *    strike being read.
 *  - A finger (`pinned`) covers the point it is on, so the card pins to the
 *    corner away from it, the candlestick readout's touch rule.
 */
export function readoutPlacement(
  pointer: { x: number; y: number },
  panel: ReadoutBox,
  card: ReadoutBox,
  pinned = false,
): { left: number; top: number } {
  const maxLeft = Math.max(READOUT_INSET, panel.width - card.width - READOUT_INSET);
  const maxTop = Math.max(READOUT_INSET, panel.height - card.height - READOUT_INSET);
  const clampLeft = (v: number) => Math.min(maxLeft, Math.max(READOUT_INSET, v));
  const clampTop = (v: number) => Math.min(maxTop, Math.max(READOUT_INSET, v));

  if (pinned) {
    return {
      left: pointer.x > panel.width / 2 ? READOUT_INSET : maxLeft,
      top: pointer.y > panel.height / 2 ? READOUT_INSET : maxTop,
    };
  }

  const rightOf = pointer.x + READOUT_GAP;
  if (rightOf + card.width <= panel.width - READOUT_INSET) {
    return { left: rightOf, top: clampTop(pointer.y + READOUT_GAP) };
  }
  const leftOf = pointer.x - READOUT_GAP - card.width;
  if (leftOf >= READOUT_INSET) {
    return { left: leftOf, top: clampTop(pointer.y + READOUT_GAP) };
  }

  const left = clampLeft(pointer.x - card.width / 2);
  const below = pointer.y + READOUT_GAP;
  if (below + card.height <= panel.height - READOUT_INSET) return { left, top: below };
  const above = pointer.y - READOUT_GAP - card.height;
  if (above >= READOUT_INSET) return { left, top: above };
  // Taller than the room on either side of the pointer: all that is left is to
  // stay inside the panel, on the side with more room.
  return { left, top: clampTop(pointer.y > panel.height / 2 ? above : below) };
}
