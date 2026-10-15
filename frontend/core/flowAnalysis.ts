/**
 * The Flow Analysis page's session read, as pure functions: the bars it draws,
 * the contracts bought and sold on each side, the one-line read above the
 * chart, and the newest-first flow log whose rows the chart's markers number.
 *
 * No React, no DOM. The page hands in its /api/flow/series rows (see
 * hooks/useFlowSeries and docs/flow-series-endpoint.md) and everything here is
 * derived from their session cumulatives.
 *
 * ── Bought and sold ──────────────────────────────────────────────────────────
 * The feed carries, per option type, the session's contracts traded
 * (`call_volume_cum`) and its net position (`call_position_cum` = bought minus
 * sold). The backend's aggressor split makes bought + sold equal the volume:
 * a print at or near the ask is bought, at or near the bid sold, and mid prints
 * are shared out in proportion to that contract's ask:bid split for the bar
 * (flow_contract_facts in zerogex-oa). So the two sides fall out exactly:
 *
 *   bought = (volume + position) / 2        sold = volume - bought
 *
 * A bar whose prints were all at the mid has no split to share them by; there
 * the backend nets them to zero, and this splits them evenly, which keeps
 * bought + sold equal to the volume the Call Volume total reports.
 *
 * The bullish side is calls bought plus puts sold, the bearish side puts
 * bought plus calls sold: the same signing `net_volume_cum` uses, so bullish
 * minus bearish is exactly the Net Flow number.
 */

import { etMinuteOfDay } from './technicalsCharts.ts';

/** The fields of a /api/flow/series row this module reads. */
export type FlowRowLike = {
  timestamp: string;
  call_premium_cum: number;
  put_premium_cum: number;
  call_volume_cum: number;
  put_volume_cum: number;
  net_volume_cum: number;
  raw_volume_cum: number;
  call_position_cum: number;
  put_position_cum: number;
  net_premium_cum: number;
  put_call_ratio: number | null;
  underlying_price: number | null;
};

/** Contracts by who crossed the spread. */
export interface SideCounts {
  callsBought: number;
  callsSold: number;
  putsBought: number;
  putsSold: number;
}

export interface FlowBar {
  /** Bar start, epoch ms. */
  ms: number;
  /** Session totals through the end of this bar. */
  cum: SideCounts;
  callVolume: number;
  putVolume: number;
  /** Net premium dollars, bought minus sold, per option type. */
  callPremium: number;
  putPremium: number;
  /** callPremium - putPremium: positive leans bullish. */
  netPremium: number;
  /** Bullish side minus bearish side, in contracts (net_volume_cum). */
  netFlow: number;
  putCallRatio: number | null;
  price: number | null;
  /** This bar alone, never negative. */
  bar: SideCounts;
  /** This bar alone: the change in net premium. */
  barNetPremium: number;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function numOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Bought and sold from a volume and a bought-minus-sold position, as integers that sum to the volume. */
export function splitSides(volume: number, position: number): { bought: number; sold: number } {
  const v = Math.max(0, Math.round(num(volume)));
  const p = Math.max(-v, Math.min(v, num(position)));
  const bought = Math.round((v + p) / 2);
  return { bought, sold: v - bought };
}

export function bullishSide(s: SideCounts): number {
  return s.callsBought + s.putsSold;
}

export function bearishSide(s: SideCounts): number {
  return s.putsBought + s.callsSold;
}

export function sideTotal(s: SideCounts): number {
  return s.callsBought + s.callsSold + s.putsBought + s.putsSold;
}

const ZERO_SIDES: SideCounts = { callsBought: 0, callsSold: 0, putsBought: 0, putsSold: 0 };

/**
 * The rows as bars, oldest first: one per bar start, each with its session
 * totals and what traded in that bar alone.
 *
 * A row whose volume total is BELOW one already seen is dropped. Session
 * volume only rises, so such a row is a bar the backend has opened but not yet
 * written (the 5-minute snapshot answers a just-opened bar with zeros until
 * the engine's next cycle); plotting it would drop every line to zero for the
 * length of the bar.
 */
export function buildFlowBars(rows: readonly FlowRowLike[] | null | undefined): FlowBar[] {
  if (!rows || rows.length === 0) return [];
  const byMs = new Map<number, FlowRowLike>();
  for (const r of rows) {
    const ms = Date.parse(r?.timestamp ?? '');
    if (Number.isFinite(ms)) byMs.set(ms, r);
  }
  const ordered = [...byMs.entries()].sort((a, b) => a[0] - b[0]);
  const bars: FlowBar[] = [];
  let maxVolume = -Infinity;
  let prev: FlowBar | null = null;
  for (const [ms, r] of ordered) {
    const total = num(r.raw_volume_cum) || num(r.call_volume_cum) + num(r.put_volume_cum);
    if (total < maxVolume) continue;
    maxVolume = total;
    const calls = splitSides(r.call_volume_cum, r.call_position_cum);
    const puts = splitSides(r.put_volume_cum, r.put_position_cum);
    const cum: SideCounts = { callsBought: calls.bought, callsSold: calls.sold, putsBought: puts.bought, putsSold: puts.sold };
    const base = prev?.cum ?? ZERO_SIDES;
    const netPremium = num(r.net_premium_cum);
    const bar: FlowBar = {
      ms,
      cum,
      callVolume: Math.max(0, Math.round(num(r.call_volume_cum))),
      putVolume: Math.max(0, Math.round(num(r.put_volume_cum))),
      callPremium: num(r.call_premium_cum),
      putPremium: num(r.put_premium_cum),
      netPremium,
      netFlow: Math.round(num(r.net_volume_cum)),
      putCallRatio: numOrNull(r.put_call_ratio),
      price: numOrNull(r.underlying_price),
      bar: {
        callsBought: Math.max(0, cum.callsBought - base.callsBought),
        callsSold: Math.max(0, cum.callsSold - base.callsSold),
        putsBought: Math.max(0, cum.putsBought - base.putsBought),
        putsSold: Math.max(0, cum.putsSold - base.putsSold),
      },
      barNetPremium: netPremium - (prev?.netPremium ?? 0),
    };
    bars.push(bar);
    prev = bar;
  }
  return bars;
}

// ── The read ────────────────────────────────────────────────────────────────

export type FlowRegime = 'riskOn' | 'riskOff' | 'twoWay';

export const FLOW_REGIME_LABEL: Record<FlowRegime, string> = {
  riskOn: 'Risk-on',
  riskOff: 'Risk-off',
  twoWay: 'Two-way',
};

/**
 * Below these shares a lean is too small to call. Contracts: net flow under 1%
 * of everything traded. Premium: net premium under 5% of the call and put
 * premium together. Shares rather than dollar and contract floors, so the
 * read means the same thing on SPY, on SPX and on a quiet single name.
 */
export const FLOW_LEAN_MIN_CONTRACT_SHARE = 0.01;
export const FLOW_LEAN_MIN_PREMIUM_SHARE = 0.05;

export interface FlowRead {
  /** Start of the latest bar. */
  asOfMs: number;
  totals: SideCounts;
  callVolume: number;
  putVolume: number;
  totalVolume: number;
  callPremium: number;
  putPremium: number;
  netPremium: number;
  netFlow: number;
  bullish: number;
  bearish: number;
  putCallRatio: number | null;
  price: number | null;
  regime: FlowRegime;
  regimeDetail: string;
  /** What traded in the latest bar, which may still be filling. */
  last: SideCounts;
  lastVolume: number;
  lastNetPremium: number;
}

export function flowRegime(netPremium: number, callPremium: number, putPremium: number, netFlow: number, totalVolume: number): { regime: FlowRegime; detail: string } {
  const premScale = Math.abs(callPremium) + Math.abs(putPremium);
  const premSmall = premScale <= 0 || Math.abs(netPremium) < FLOW_LEAN_MIN_PREMIUM_SHARE * premScale;
  const flowSmall = totalVolume <= 0 || Math.abs(netFlow) < FLOW_LEAN_MIN_CONTRACT_SHARE * totalVolume;
  if (premSmall && flowSmall) return { regime: 'twoWay', detail: 'no clear lean either way' };
  if (netPremium > 0 && netFlow > 0) return { regime: 'riskOn', detail: 'premium and contracts both lean bullish' };
  if (netPremium < 0 && netFlow < 0) return { regime: 'riskOff', detail: 'premium and contracts both lean bearish' };
  const prem = netPremium > 0 ? 'bullish' : netPremium < 0 ? 'bearish' : 'flat';
  const flow = netFlow > 0 ? 'bullish' : netFlow < 0 ? 'bearish' : 'flat';
  return { regime: 'twoWay', detail: `premium leans ${prem}, contracts ${flow}` };
}

export function flowRead(bars: readonly FlowBar[]): FlowRead | null {
  const b = bars[bars.length - 1];
  if (!b) return null;
  const totalVolume = b.callVolume + b.putVolume;
  const { regime, detail } = flowRegime(b.netPremium, b.callPremium, b.putPremium, b.netFlow, totalVolume);
  return {
    asOfMs: b.ms,
    totals: b.cum,
    callVolume: b.callVolume,
    putVolume: b.putVolume,
    totalVolume,
    callPremium: b.callPremium,
    putPremium: b.putPremium,
    netPremium: b.netPremium,
    netFlow: b.netFlow,
    bullish: bullishSide(b.cum),
    bearish: bearishSide(b.cum),
    putCallRatio: b.putCallRatio ?? (b.callVolume > 0 ? b.putVolume / b.callVolume : null),
    price: b.price,
    regime,
    regimeDetail: detail,
    last: b.bar,
    lastVolume: sideTotal(b.bar),
    lastNetPremium: b.barNetPremium,
  };
}

// ── The flow log ────────────────────────────────────────────────────────────

export type FlowEventKind = 'flowTurn' | 'premiumTurn' | 'pcrCross' | 'burst';
export type FlowEventTone = 'bullish' | 'bearish' | 'neutral';

export interface FlowEvent {
  id: string;
  ms: number;
  kind: FlowEventKind;
  title: string;
  detail: string | null;
  tone: FlowEventTone;
  price: number | null;
  /** Chart marker number, 1 = earliest. */
  marker: number;
}

/** No turns are called in the first ten minutes, when every total is small and swings sign on a single print. */
export const FLOW_EVENT_START_ET_MINUTE = 9 * 60 + 40;
/** A turn needs the new side to lead by this share of what has traded (contracts) or of the call and put premium (dollars). */
export const FLOW_TURN_CONTRACT_SHARE = 0.005;
export const FLOW_TURN_PREMIUM_SHARE = 0.03;
/** The put/call band the ratio has to leave, either side of 1, to count as crossing it. */
export const PCR_BAND = 0.05;
/** A burst: a bar at least this many times the median of the bars before it. */
export const BURST_MULTIPLE = 2.5;
/** The most bursts listed in a session, the biggest first to make the cut. */
export const BURST_LIMIT = 6;

const fmtInt = (n: number) => Math.round(n).toLocaleString('en-US');

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * The session's notable flow, newest first, each row numbered for its chart
 * marker (1 = earliest, so the chart reads left to right):
 *
 *  - Net flow turning from bullish to bearish or back, once the new side
 *    leads by FLOW_TURN_CONTRACT_SHARE of what has traded. The session's
 *    first lean is the baseline, not a turn: the read above the chart
 *    already says which way the session leans.
 *  - Net premium doing the same, by FLOW_TURN_PREMIUM_SHARE.
 *  - The put/call ratio crossing 1, once it is PCR_BAND past it.
 *  - Bursts: a bar of at least BURST_MULTIPLE times the median of the
 *    previous hour's bars (it needs a half hour of them first), the biggest
 *    BURST_LIMIT of the session.
 *
 * The thresholds are hysteresis, not filters: a total wandering back and forth
 * across zero by a few contracts is the ordinary case and lists nothing.
 */
export function buildFlowEvents(bars: readonly FlowBar[], barMinutes: number): FlowEvent[] {
  const events: Omit<FlowEvent, 'marker'>[] = [];
  let flowSide = 0;
  let premSide = 0;
  let pcrSide = 0;
  const hourBars = Math.max(1, Math.round(60 / Math.max(1, barMinutes)));
  const minBaseline = Math.max(1, Math.round(30 / Math.max(1, barMinutes)));
  const bursts: Array<{ event: Omit<FlowEvent, 'marker'>; multiple: number }> = [];

  bars.forEach((b, i) => {
    const minute = etMinuteOfDay(b.ms);
    const callable = minute >= FLOW_EVENT_START_ET_MINUTE;
    const traded = b.callVolume + b.putVolume;

    // Net flow.
    const flowThreshold = FLOW_TURN_CONTRACT_SHARE * traded;
    const flowNow = b.netFlow > flowThreshold ? 1 : b.netFlow < -flowThreshold ? -1 : 0;
    if (callable && flowNow !== 0 && flowSide !== 0 && flowNow !== flowSide) {
      events.push({
        id: `flow-${b.ms}`,
        ms: b.ms,
        kind: 'flowTurn',
        title: flowNow > 0 ? 'Net flow turned bullish' : 'Net flow turned bearish',
        detail: `${b.netFlow > 0 ? '+' : '-'}${fmtInt(Math.abs(b.netFlow))} contracts`,
        tone: flowNow > 0 ? 'bullish' : 'bearish',
        price: b.price,
      });
    }
    if (flowNow !== 0) flowSide = flowNow;

    // Net premium.
    const premThreshold = FLOW_TURN_PREMIUM_SHARE * (Math.abs(b.callPremium) + Math.abs(b.putPremium));
    const premNow = premThreshold > 0 ? (b.netPremium > premThreshold ? 1 : b.netPremium < -premThreshold ? -1 : 0) : 0;
    if (callable && premNow !== 0 && premSide !== 0 && premNow !== premSide) {
      events.push({
        id: `premium-${b.ms}`,
        ms: b.ms,
        kind: 'premiumTurn',
        title: premNow > 0 ? 'Net premium turned bullish' : 'Net premium turned bearish',
        detail: fmtUsdCompact(b.netPremium, true),
        tone: premNow > 0 ? 'bullish' : 'bearish',
        price: b.price,
      });
    }
    if (premNow !== 0) premSide = premNow;

    // Put/call across 1.
    const r = b.putCallRatio;
    const pcrNow = r == null ? 0 : r > 1 + PCR_BAND ? 1 : r < 1 - PCR_BAND ? -1 : 0;
    if (callable && pcrNow !== 0 && pcrSide !== 0 && pcrNow !== pcrSide) {
      events.push({
        id: `pcr-${b.ms}`,
        ms: b.ms,
        kind: 'pcrCross',
        title: pcrNow > 0 ? 'Put/call rose above 1' : 'Put/call fell below 1',
        detail: r != null ? r.toFixed(2) : null,
        tone: pcrNow > 0 ? 'bearish' : 'bullish',
        price: b.price,
      });
    }
    if (pcrNow !== 0) pcrSide = pcrNow;

    // Bursts.
    if (callable && i >= minBaseline) {
      const prior = bars.slice(Math.max(0, i - hourBars), i).map((x) => sideTotal(x.bar));
      const base = median(prior);
      const size = sideTotal(b.bar);
      if (base > 0 && size >= BURST_MULTIPLE * base) {
        const bull = bullishSide(b.bar);
        const share = size > 0 ? bull / size : 0.5;
        bursts.push({
          event: {
            id: `burst-${b.ms}`,
            ms: b.ms,
            kind: 'burst',
            title: 'Volume burst',
            detail: `${(size / base).toFixed(1)}× the last hour · ${share >= 0.5 ? `${Math.round(share * 100)}% bullish side` : `${Math.round((1 - share) * 100)}% bearish side`}`,
            tone: share >= 0.55 ? 'bullish' : share <= 0.45 ? 'bearish' : 'neutral',
            price: b.price,
          },
          multiple: size / base,
        });
      }
    }
  });

  bursts
    .sort((a, b) => b.multiple - a.multiple || a.event.ms - b.event.ms)
    .slice(0, BURST_LIMIT)
    .forEach((b) => events.push(b.event));

  // Markers number in time order; ties at one bar keep a fixed kind order.
  const KIND_ORDER: Record<FlowEventKind, number> = { flowTurn: 0, premiumTurn: 1, pcrCross: 2, burst: 3 };
  const chronological = events.sort((a, b) => a.ms - b.ms || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  return chronological.map((e, i) => ({ ...e, marker: i + 1 })).reverse();
}

// ── Chart geometry ──────────────────────────────────────────────────────────

export type FlowPaneKey = 'price' | 'premium' | 'contracts' | 'pcr';

/** How the chart's height is shared between its panes. */
export const FLOW_PANE_WEIGHT: Record<FlowPaneKey, number> = {
  price: 0.9,
  premium: 1.3,
  contracts: 1.0,
  pcr: 0.55,
};

/**
 * Pane bands for the shown panes, top to bottom, sharing `height` by weight
 * with `gap` between them. Whole pixels, and the last band ends exactly at
 * `top + height`, so hiding a pane hands its height to the others rather than
 * leaving a hole.
 */
export function paneLayout(
  shown: readonly FlowPaneKey[],
  top: number,
  height: number,
  gap: number,
): Array<{ key: FlowPaneKey; top: number; height: number }> {
  if (shown.length === 0 || height <= 0) return [];
  const usable = Math.max(0, height - gap * (shown.length - 1));
  const weight = shown.reduce((s, k) => s + FLOW_PANE_WEIGHT[k], 0);
  const out: Array<{ key: FlowPaneKey; top: number; height: number }> = [];
  let y = top;
  shown.forEach((key, i) => {
    const last = i === shown.length - 1;
    const h = last ? top + height - y : Math.round((usable * FLOW_PANE_WEIGHT[key]) / weight);
    out.push({ key, top: y, height: Math.max(0, h) });
    y += h + gap;
  });
  return out;
}

/**
 * A padded value window for a pane. `minSpan` keeps a near-flat series from
 * being blown up to fill the pane (a put/call ratio drifting between 1.12 and
 * 1.14 is flat, and should look it). `anchor` (1 for put/call) is then taken
 * in when it sits within half the span of the data, so its reference line
 * shows without flattening the series into a sliver.
 */
export function valueDomain(
  values: readonly number[],
  anchor: number | null = null,
  padShare = 0.08,
  minSpan = 0,
): { min: number; max: number } | null {
  const vals = values.filter((v) => Number.isFinite(v));
  if (vals.length === 0) return null;
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max - min < minSpan) {
    const mid = (max + min) / 2;
    min = mid - minSpan / 2;
    max = mid + minSpan / 2;
  }
  const span0 = max - min;
  if (anchor != null && anchor >= min - span0 * 0.5 && anchor <= max + span0 * 0.5) {
    min = Math.min(min, anchor);
    max = Math.max(max, anchor);
  }
  let span = max - min;
  if (!(span > 0)) {
    const mag = Math.abs(max) || 1;
    span = mag * 0.02;
    min -= span / 2;
    max += span / 2;
  }
  const pad = span * padShare;
  return { min: min - pad, max: max + pad };
}

// ── Formatting ──────────────────────────────────────────────────────────────

/** "$12.4M", "-$860K", "+$3.1B" with `signed`. */
export function fmtUsdCompact(value: number | null | undefined, signed = false): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** "238,410"; "+64,190" with `signed`. */
export function fmtContracts(value: number | null | undefined, signed = false): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : signed && value > 0 ? '+' : '';
  return `${sign}${Math.round(Math.abs(value)).toLocaleString('en-US')}`;
}

/** "238K", "3.4M", "-12K": axis labels. */
export function fmtContractsCompact(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(0)}K`;
  return `${sign}${Math.round(abs)}`;
}

/** A share as a whole percent, "58%". */
export function fmtShare(part: number, whole: number): string {
  if (!(whole > 0) || !Number.isFinite(part)) return '—';
  return `${Math.round((part / whole) * 100)}%`;
}
