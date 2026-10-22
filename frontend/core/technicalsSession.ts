/**
 * The Technicals page's session read, as pure functions: where price sits in
 * the opening range, what price did around that range through the session,
 * and the one newest-first event list that the page's table and its chart
 * markers share (so a numbered marker and its row can never disagree).
 *
 * No React, no DOM. The page hands in its candles (/api/market/historical,
 * the same bars the Gamma Terminal draws) and its technicals bars
 * (/api/technicals: VWAP, the opening range, volume spikes, momentum).
 */

import type { TechnicalsBar } from '../hooks/useTechnicals';
import { technicalsLabel } from './technicalsCharts.ts';

/**
 * "Near" the high or low is the outer fifth of the range. Mirrors the
 * backend's orb_status rule (src/api/queries/technicals.py in zerogex-oa), so
 * the zone drawn here and the status the dashboard tile prints agree.
 */
export const ORB_NEAR_FRACTION = 0.2;

export type OrbZone = 'above' | 'nearHigh' | 'inside' | 'nearLow' | 'below';

export const ORB_ZONE_LABEL: Record<OrbZone, string> = {
  above: 'Above the range',
  nearHigh: 'Near the high',
  inside: 'Inside',
  nearLow: 'Near the low',
  below: 'Below the range',
};

function finite(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function orbZone(
  price: number | null | undefined,
  high: number | null | undefined,
  low: number | null | undefined,
): OrbZone | null {
  const p = finite(price);
  const h = finite(high);
  const l = finite(low);
  if (p == null || h == null || l == null || h < l) return null;
  if (p > h) return 'above';
  if (p < l) return 'below';
  const range = h - l;
  if (p >= h - ORB_NEAR_FRACTION * range) return 'nearHigh';
  if (p <= l + ORB_NEAR_FRACTION * range) return 'nearLow';
  return 'inside';
}

/**
 * The position bar gives each side of the range a margin for "beyond it"; the
 * range itself spans [ORB_BAR_OUTER, 1 - ORB_BAR_OUTER]. Price past the
 * margin pins to the bar's end rather than leaving it.
 */
export const ORB_BAR_OUTER = 0.1;

export function orbBarPosition(
  price: number | null | undefined,
  high: number | null | undefined,
  low: number | null | undefined,
): number | null {
  const p = finite(price);
  const h = finite(high);
  const l = finite(low);
  if (p == null || h == null || l == null || !(h > l)) return null;
  const t = (p - l) / (h - l);
  const pos = ORB_BAR_OUTER + t * (1 - 2 * ORB_BAR_OUTER);
  return Math.min(1, Math.max(0, pos));
}

// ── What price did around the range ─────────────────────────────────────────

export interface Candle {
  /** Bar start, epoch ms. */
  ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export type OrbEventKind = 'breakout' | 'breakdown' | 'backInside' | 'furthest' | 'testHigh' | 'testLow';

export interface OrbEvent {
  kind: OrbEventKind;
  ms: number;
  price: number;
  /** backInside: which side price came back from; furthest: which side it ran. */
  side?: 'above' | 'below';
  /** backInside: minutes between the break and the close back inside. */
  minutes?: number;
  /** furthest: how far past the broken edge, in multiples of the range. */
  multiple?: number;
  /** furthest: the move is still going (no close back inside yet). */
  ongoing?: boolean;
}

/**
 * Breaks are decided on closes (as the backend's status is); the furthest
 * point and edge tests use the wicks. A test is logged once per touch: bars
 * that keep poking the same edge after the first one don't add rows.
 */
export function deriveOrbLog(candles: readonly Candle[], high: number, low: number, rangeEndMs: number): OrbEvent[] {
  const range = high - low;
  if (!(range > 0)) return [];
  const events: OrbEvent[] = [];
  let state: 'inside' | 'above' | 'below' = 'inside';
  let breakMs = 0;
  let extreme: { ms: number; price: number } | null = null;
  let testing = false;

  const furthest = (side: 'above' | 'below', ongoing: boolean): OrbEvent | null => {
    if (!extreme) return null;
    const past = side === 'above' ? extreme.price - high : low - extreme.price;
    return { kind: 'furthest', ms: extreme.ms, price: extreme.price, side, multiple: past / range, ...(ongoing ? { ongoing } : {}) };
  };
  const breakTo = (c: Candle, side: 'above' | 'below') => {
    events.push({ kind: side === 'above' ? 'breakout' : 'breakdown', ms: c.ms, price: c.close });
    state = side;
    breakMs = c.ms;
    extreme = { ms: c.ms, price: side === 'above' ? c.high : c.low };
  };

  const sorted = [...candles].filter((c) => c.ms >= rangeEndMs).sort((a, b) => a.ms - b.ms);
  for (const c of sorted) {
    if (state === 'inside') {
      if (c.close > high) {
        breakTo(c, 'above');
        testing = false;
        continue;
      }
      if (c.close < low) {
        breakTo(c, 'below');
        testing = false;
        continue;
      }
      const testsHigh = c.high > high;
      const testsLow = c.low < low;
      if (testsHigh || testsLow) {
        if (!testing) {
          events.push(testsHigh ? { kind: 'testHigh', ms: c.ms, price: c.high } : { kind: 'testLow', ms: c.ms, price: c.low });
        }
        testing = true;
      } else {
        testing = false;
      }
      continue;
    }

    const side = state;
    if (extreme && (side === 'above' ? c.high > extreme.price : c.low < extreme.price)) {
      extreme = { ms: c.ms, price: side === 'above' ? c.high : c.low };
    }
    const backIn = side === 'above' ? c.close <= high : c.close >= low;
    if (!backIn) continue;
    const far = furthest(side, false);
    if (far) events.push(far);
    const throughOtherSide = side === 'above' ? c.close < low : c.close > high;
    if (throughOtherSide) {
      breakTo(c, side === 'above' ? 'below' : 'above');
    } else {
      events.push({ kind: 'backInside', ms: c.ms, price: c.close, side, minutes: Math.round((c.ms - breakMs) / 60_000) });
      state = 'inside';
      extreme = null;
      testing = false;
    }
  }
  if (state !== 'inside') {
    const far = furthest(state, true);
    if (far) events.push(far);
  }
  return events;
}

// ── The event list ──────────────────────────────────────────────────────────

export type SessionEventTone = 'warning' | 'bullish' | 'bearish' | 'range' | 'neutral';

export interface SessionEvent {
  id: string;
  ms: number;
  title: string;
  detail: string | null;
  price: number | null;
  /** Close minus the previous bar's close, in price units (not a percent). */
  chg5m: number | null;
  tone: SessionEventTone;
  /**
   * The side a divergence's label names ("Bullish divergence" → bullish), so
   * the title can carry it in color: the two titles differ by one word and
   * share the warning dot. Null for every other event.
   */
  side: 'bullish' | 'bearish' | null;
  /** Chart marker number, 1 = earliest; null for rows without a marker. */
  marker: number | null;
  /** Which side of the candle the marker sits on. */
  markerSide: 'above' | 'below' | null;
}

/** "Bearish Divergence (Price Up, Puts Buying)" → ["Bearish divergence", "price up, puts buying"]. */
function splitFeedLabel(raw: string): [string, string | null] {
  const words = technicalsLabel(raw);
  const open = words.indexOf(' (');
  const head = open >= 0 ? words.slice(0, open) : words;
  const tail = open >= 0 ? words.slice(open + 2).replace(/\)\s*$/, '') : null;
  const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return [sentence(head), tail ? tail.toLowerCase() : null];
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Divergences, weak moves, volume spikes and the range's breaks, newest
 * first. Confirmations (price and options flow agreeing) and neutral bars are
 * left out: they are the ordinary case, and listing every one buried the
 * events worth reading. Divergences and range breaks carry chart markers.
 */
export function buildSessionEvents(
  bars: readonly TechnicalsBar[],
  orbLog: readonly OrbEvent[],
  inWindow: (iso: string) => boolean = () => true,
): SessionEvent[] {
  const chgByMs = new Map<number, number | null>();
  const events: SessionEvent[] = [];

  for (const bar of bars) {
    if (!bar?.timestamp) continue;
    const ms = new Date(bar.timestamp).getTime();
    if (!Number.isFinite(ms)) continue;
    const chg = num(bar.momentum_divergence?.chg_5m);
    chgByMs.set(ms, chg);
    if (!inWindow(bar.timestamp)) continue;
    const price = num(bar.close);

    const signal = bar.momentum_divergence?.divergence_signal ?? null;
    if (signal) {
      const lower = technicalsLabel(signal).toLowerCase();
      const isDivergence = lower.includes('divergence');
      const isWeak = lower.startsWith('weak');
      if (isDivergence || isWeak) {
        const [title, detail] = splitFeedLabel(signal);
        const up = lower.includes('price up') || lower.startsWith('weak rally') || (chg ?? 0) > 0;
        events.push({
          id: `momentum-${ms}`,
          ms,
          title,
          detail,
          price,
          chg5m: chg,
          tone: isDivergence ? 'warning' : 'neutral',
          side: !isDivergence ? null : lower.startsWith('bullish') ? 'bullish' : lower.startsWith('bearish') ? 'bearish' : null,
          marker: null,
          markerSide: isDivergence ? (up ? 'above' : 'below') : null,
        });
      }
    }

    const spike = bar.volume_spike;
    const cls = spike?.volume_class ?? null;
    if (cls && !cls.toLowerCase().includes('normal')) {
      const sigma = num(spike?.volume_sigma);
      const buying = num(spike?.buying_pressure_pct);
      const parts: string[] = [];
      if (sigma != null) parts.push(`${sigma.toFixed(1)}σ`);
      if (buying != null) parts.push(buying >= 50 ? `${Math.round(buying)}% buying` : `${Math.round(100 - buying)}% selling`);
      events.push({
        id: `volume-${ms}`,
        ms,
        title: 'Volume spike',
        detail: parts.length ? parts.join(' · ') : null,
        price,
        chg5m: chg,
        tone: buying == null ? 'neutral' : buying >= 50 ? 'bullish' : 'bearish',
        side: null,
        marker: null,
        markerSide: null,
      });
    }
  }

  for (const e of orbLog) {
    const base = { ms: e.ms, price: e.price, chg5m: chgByMs.get(e.ms) ?? null, tone: 'range' as const, side: null, marker: null };
    switch (e.kind) {
      case 'breakout':
        events.push({ ...base, id: `orb-${e.kind}-${e.ms}`, title: 'Broke above the opening range', detail: null, markerSide: 'above' });
        break;
      case 'breakdown':
        events.push({ ...base, id: `orb-${e.kind}-${e.ms}`, title: 'Broke below the opening range', detail: null, markerSide: 'below' });
        break;
      case 'backInside':
        events.push({
          ...base,
          id: `orb-${e.kind}-${e.ms}`,
          title: 'Back inside the opening range',
          detail: `${e.side === 'above' ? 'breakout' : 'breakdown'} failed after ${e.minutes ?? 0} min`,
          markerSide: e.side ?? null,
        });
        break;
      case 'furthest':
        events.push({
          ...base,
          id: `orb-${e.kind}-${e.ms}`,
          title: e.ongoing ? 'Furthest so far' : 'Furthest move',
          detail: `${(e.multiple ?? 0).toFixed(2)}× the range ${e.side === 'above' ? 'above' : 'below'}`,
          markerSide: null,
        });
        break;
      case 'testHigh':
        events.push({ ...base, id: `orb-${e.kind}-${e.ms}`, title: 'Tested the high', detail: 'closed inside', markerSide: null });
        break;
      case 'testLow':
        events.push({ ...base, id: `orb-${e.kind}-${e.ms}`, title: 'Tested the low', detail: 'closed inside', markerSide: null });
        break;
    }
  }

  // Markers number in time order, so the chart reads left to right 1, 2, 3.
  // Ties at the same bar keep a stable order: range events, then momentum.
  const chronological = [...events].sort((a, b) => a.ms - b.ms || a.id.localeCompare(b.id));
  let n = 0;
  for (const e of chronological) {
    if (e.markerSide) e.marker = ++n;
  }
  return chronological.reverse();
}

// ── Chart geometry ──────────────────────────────────────────────────────────

/**
 * Spread price tags down the axis so none overlap: each keeps its own y when
 * it can, otherwise it sits `gap` below the one above it, and a stack that
 * runs off the bottom is pushed back up as a whole. Returns ys in input order.
 */
export function spreadTags(ys: readonly number[], gap: number, top: number, bottom: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const placed = order.map((o) => Math.min(Math.max(o.y, top), bottom));
  for (let k = 1; k < placed.length; k += 1) placed[k] = Math.max(placed[k], placed[k - 1] + gap);
  const overflow = placed.length ? placed[placed.length - 1] - bottom : 0;
  if (overflow > 0) {
    placed[placed.length - 1] -= overflow;
    for (let k = placed.length - 2; k >= 0; k -= 1) placed[k] = Math.min(placed[k], placed[k + 1] - gap);
  }
  const out = new Array<number>(ys.length);
  order.forEach((o, k) => {
    out[o.i] = placed[k];
  });
  return out;
}

/**
 * The price window: the session's candles, VWAP and opening range, padded,
 * then widened to take in any gamma level within half the data's span of it.
 * A level further out than that would squash the candles into a sliver, so it
 * is left off-scale and the chart flags it at the edge instead.
 */
export function priceDomain(
  dataValues: readonly number[],
  levels: readonly (number | null | undefined)[],
): { min: number; max: number } | null {
  const vals = dataValues.filter((v) => Number.isFinite(v));
  if (vals.length === 0) return null;
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  const span = Math.max(max - min, max * 0.001);
  for (const l of levels) {
    const v = finite(l ?? null);
    if (v == null) continue;
    if (v >= min - span * 0.5 && v <= max + span * 0.5) {
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
  }
  const pad = Math.max((max - min) * 0.06, max * 0.0002);
  return { min: min - pad, max: max + pad };
}

// ── Formatting ──────────────────────────────────────────────────────────────

/** The Gamma Terminal's price format: grouped, two decimals, no currency sign. */
export function fmtLevel(value: number | null | undefined): string {
  const v = finite(value);
  return v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** An unsigned distance in price units: "7.75". */
export function fmtDistance(value: number | null | undefined): string {
  const v = finite(value);
  return v == null ? '—' : Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
