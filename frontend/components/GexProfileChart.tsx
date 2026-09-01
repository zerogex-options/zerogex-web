'use client';

import { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Info, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useGEXProfile } from '@/hooks/useApiData';
import { GEX_UNIT_LABEL, gexScaleFactor, useGexUnit } from '@/core/GexUnitContext';
import { extraWalls, parseWallLadder, wallRankDash, wallRankOpacity, type WallLevelPayload } from '@/core/wallLadder';
import { useWallDepth } from '@/core/WallDepthContext';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';
import StrikeRangeScrollbar from './StrikeRangeScrollbar';
import ValueRangeScrollbar from './ValueRangeScrollbar';
import ResponsiveChartArea from './ResponsiveChartArea';
import ExpirationMultiSelect from './ExpirationMultiSelect';
import WallDepthToggle from './WallDepthToggle';
import type { ZeroDteOption } from '@/hooks/useZeroDteOption';
import ChartCaption from "./ChartCaption";

// Each zoom click narrows / widens the visible strike range by this factor.
// 1.4 is roughly the geometric mean of 1 and 2, giving comfortable single-
// click steps without bouncing across the whole chain.
const X_ZOOM_STEP = 1.4;

// Vertical (value-axis) zoom + scroll. The visible y-extent is a normalized
// window within the fit-all range [-1, 1]; zoom narrows/widens the window
// (each click by this factor) and the scrollbar shifts it. Both value axes
// (bars + profile) share the one window, so out-of-range values clip and the
// two axes' zeros stay aligned. Y_ZOOM_MAX caps how far a single tall bar can
// be zoomed past before the window collapses to noise.
const Y_ZOOM_STEP = 1.5;
const Y_ZOOM_MAX = 32;
// Full normalized value window (fit-all view).
const Y_FULL_VIEW: [number, number] = [-1, 1];

// Bottom inset (margin 8 + ~30 x-axis) used to line the value scrollbar up
// with the plot band.
const PLOT_INSET_BOTTOM = 38;

interface StrikeRow {
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
}

/**
 * Per-(strike, expiration) dealer GEX in raw dollars per 1% move, used to
 * stack the bars by expiration and to compute each selection's share of the
 * all-expiration total at a strike. `callGex` is >= 0, `putGex` is <= 0.
 */
interface PerExpirationStrikeRow {
  strike: number;
  expiration: string;
  callGex: number;
  putGex: number;
}

interface GexProfileChartProps {
  symbol: string;
  strikeData: StrikeRow[];
  spotPrice?: number | null;
  gammaFlip?: number | null;
  callWall?: number | null;
  putWall?: number | null;
  /**
   * Ranked wall ladders from the same snapshot `callWall` / `putWall` came
   * from. Rank 1 repeats those, so these only ever ADD the optional secondary
   * walls (C2/C3 · P2/P3); omit them and the chart draws exactly the two wall
   * lines it always has.
   */
  callWalls?: WallLevelPayload[] | null;
  putWalls?: WallLevelPayload[] | null;
  expirationOptions?: string[];
  /** Selected expirations; empty array = All (aggregate across the chain). */
  selectedExpirations?: string[];
  onSelectedExpirationsChange?: (value: string[]) => void;
  /**
   * Rolling "0DTE" row for the expiration dropdown. Passed in rather than
   * derived here: this chart is controlled — its owner holds the selection —
   * and only the owner can say whether the rolling token is the active pick.
   */
  zeroDte?: ZeroDteOption;
  /**
   * Full per-(strike, expiration) GEX breakdown across ALL of
   * `expirationOptions` (never pre-filtered by the selection) — the stacked
   * bar segments and the "% of total at this strike" baseline are both built
   * from it.
   */
  perExpirationData?: PerExpirationStrikeRow[];
  /** Today's ET date key (YYYY-MM-DD) for labelling expirations by DTE. */
  todayKey?: string;
}

interface MergedRow {
  strike: number;
  callGex?: number;
  putGex?: number;
  netGex?: number;
  profileGex?: number;
  // Stacked-by-expiration additions (populated once perExpirationData is wired).
  callSelected?: number; // selected-expiration call GEX total at this strike (>= 0)
  putSelected?: number; // selected-expiration put GEX total (<= 0)
  callTotalAll?: number; // all-expiration call GEX total — tooltip % baseline (>= 0)
  putTotalAll?: number; // all-expiration put GEX total — tooltip % baseline (<= 0)
  // Dynamic per-expiration segments: `call__<exp>` (>= 0), `put__<exp>` (<= 0).
  [key: string]: number | undefined;
}

// Palette-aware — resolved from CSS variables per the active theme.
const PROFILE_LINE_COLOR = 'var(--color-gold)';
const PROFILE_FILL_COLOR = 'var(--color-gold-soft)';
const NET_LINE_COLOR = 'var(--text-muted)';

// Match the bar width used by GexWallsChart (OPEN INTEREST BY STRIKE) so the
// two stacked charts read as a cohesive pair.
const BAR_SIZE = 14;

// Expiration-gradient opacity: the nearest expiration (0DTE) renders at full
// strength, the furthest at FAR_OPACITY, interpolated by DTE rank so a bar's
// shading reads as a time-to-expiry ramp (bold = rolls off soonest).
const NEAR_OPACITY = 1;
const FAR_OPACITY = 0.4;

// Whole-day DTE between two YYYY-MM-DD keys, parsed at UTC midnight so the
// difference is a clean calendar-day count independent of the local offset.
function dteBetweenKeys(todayKey: string | undefined, expKey: string): number | null {
  if (!todayKey) return null;
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  const exp = Date.parse(`${expKey}T00:00:00Z`);
  if (Number.isNaN(today) || Number.isNaN(exp)) return null;
  return Math.round((exp - today) / 86_400_000);
}

// Vertical stagger (`dy`, in px, relative to the natural `position: 'top'`
// anchor) for the reference-line labels.  All four lines (Spot, Flip,
// Call Wall, Put Wall) sit at `position: 'top'`, which collapses their
// labels onto the same y when two strikes are close (e.g. Spot and Call
// Wall a couple of dollars apart).  Assigning each label its own row —
// 12px apart, fits within the 10px font + 2px gap — guarantees they
// stack neatly regardless of horizontal proximity.
//
// Order matches what a trader reads naturally: Spot in the eye-line
// closest to the plot top, with the directional walls bracketing it and
// Flip up top as the broader regime context.
const REF_LABEL_STAGGER = {
  putWall: -12,
  flip: -36,
  spot: 0,
  callWall: -24,
} as const;
// Top margin reserved for the stagger.  -36 is the highest dy used; add
// ~14px so even the topmost label has clearance from the chart bezel.
const REF_LABEL_TOP_MARGIN = 48;

function formatExposure(value: number): string {
  const abs = Math.abs(value);
  if (!Number.isFinite(value) || abs === 0) return '0';
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

interface Denomination {
  divisor: number;
  suffix: string;
}

// Pick the denomination off the LARGER of the two axes (typically the
// profile axis — each profile point integrates the full chain) so both
// y-axes can share it.  Mixing M and B on stacked axes makes "is the
// profile bigger than the bars?" require mental arithmetic; one suffix
// makes the comparison visual.
function pickSharedDenomination(maxAbs: number): Denomination {
  if (maxAbs >= 1e9) return { divisor: 1e9, suffix: 'B' };
  if (maxAbs >= 1e6) return { divisor: 1e6, suffix: 'M' };
  if (maxAbs >= 1e3) return { divisor: 1e3, suffix: 'K' };
  return { divisor: 1, suffix: '' };
}

function formatTick(value: number, denom: Denomination): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '0';
  const scaled = value / denom.divisor;
  const abs = Math.abs(scaled);
  // 1 decimal place keeps the labels uniform width and matches the
  // user-visible style ($0.5B, $1.0B, $2.5B).  Drop to whole numbers
  // once we're past 10× the denomination so we don't overrun the axis
  // with redundant trailing zeros ("$12.0B" → "$12B").
  const text = abs >= 10 ? abs.toFixed(0) : abs.toFixed(1);
  return `${scaled < 0 ? '-' : ''}$${text}${denom.suffix}`;
}

function formatStrike(value: number): string {
  if (!Number.isFinite(value)) return '';
  return Math.round(value).toString();
}

// Two-decimal price used in the Spot / Flip / Wall reference-line labels
// so traders see the exact level, not a rounded integer.
function formatStrikePrecise(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(2);
}

// Generate evenly-spaced x-axis ticks across the visible strike range. Uses
// the same 1/2/5 × 10^k cadence as the y-axis helper, so the labels read
// 580/585/590 (range 30) or 580/600/620 (range 100) instead of recharts'
// data-driven extremes. Floor at step=1 so we never sub-divide a strike.
function selectStrikeTicks(visibleDomain: [number, number]): number[] {
  const [lo, hi] = visibleDomain;
  const range = hi - lo;
  if (range <= 0) return [];
  const step = Math.max(1, niceStep(range, 8));
  const start = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + 1e-9; v += step) {
    ticks.push(v);
  }
  return ticks;
}

// Pick a "nice" step (1, 2, 5 × 10^k) that lands ~targetCount ticks across
// the half-range.  Both y-axes need symmetric ticks centred on 0 with clean
// round values like $1B, $2B — recharts' default tick generator picks
// fractional values when the domain is set to data-driven extremes.
function niceStep(halfRange: number, targetCount: number): number {
  if (!Number.isFinite(halfRange) || halfRange <= 0) return 1;
  const rough = halfRange / Math.max(1, targetCount);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  if (norm < 1.5) return 1 * magnitude;
  if (norm < 3.5) return 2 * magnitude;
  if (norm < 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

// Fit-all half-extent for a value axis: the smallest nice-stepped multiple
// that covers the data's max magnitude. This is the reference the normalized
// y-window ([-1, 1]) maps onto — a window of [nLo, nHi] shows the value band
// [nLo × fullMax, nHi × fullMax].
function roundedMax(maxAbs: number): number {
  if (!Number.isFinite(maxAbs) || maxAbs <= 0) return 1;
  const step = niceStep(maxAbs, 4);
  return Math.ceil(maxAbs / step) * step;
}

// Nice-stepped ticks across an arbitrary [lo, hi] range (not necessarily
// symmetric — the y-window can be scrolled off-center). Mirrors the strike
// x-axis tick helper: pick a 1/2/5 × 10^k step for ~targetCount ticks, start
// at the first multiple ≥ lo, and count rungs to avoid float drift. A symmetric
// range still yields a tick exactly at 0.
function ticksInRange(lo: number, hi: number, targetCount: number): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [0];
  const step = niceStep(hi - lo, targetCount);
  if (!(step > 0)) return [0];
  const start = Math.ceil(lo / step) * step;
  const rungs = Math.max(0, Math.round((hi - start) / step));
  const ticks: number[] = [];
  for (let i = 0; i <= rungs; i += 1) ticks.push(start + i * step);
  return ticks;
}

// Spot-shift GEX profile points are sampled at the resolver's grid step
// (~0.5% of spot), which lands on fractional strikes. The per-strike bars
// live on integer-ish strikes. Merging on the same x-axis means snapping
// each profile sample to its nearest bar bucket — Recharts' ComposedChart
// only honors values that share a row in `data`.
function mergeProfileWithStrikes(
  strikes: StrikeRow[],
  profile: Array<{ price: number; gex: number }>,
): MergedRow[] {
  const map = new Map<string, MergedRow>();
  strikes.forEach((row) => {
    if (!Number.isFinite(row.strike)) return;
    map.set(row.strike.toFixed(4), {
      strike: row.strike,
      callGex: row.callGex,
      putGex: row.putGex,
      netGex: row.netGex,
    });
  });

  // Sort the per-strike axis once; each profile sample gets snapped to the
  // closest strike via binary search.  For SPX with ~70 strikes and ~80
  // profile points this is well under a millisecond.
  const sortedStrikes = Array.from(map.values()).sort((a, b) => a.strike - b.strike);
  if (sortedStrikes.length === 0) {
    // No strike data — render the profile alone so the chart still shows
    // something useful (smooth curve plus reference lines).
    profile.forEach((p) => {
      if (!Number.isFinite(p.price)) return;
      map.set(p.price.toFixed(4), { strike: p.price, profileGex: p.gex });
    });
    return Array.from(map.values()).sort((a, b) => a.strike - b.strike);
  }

  const findNearest = (target: number): MergedRow => {
    let lo = 0;
    let hi = sortedStrikes.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sortedStrikes[mid].strike < target) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0 && Math.abs(sortedStrikes[lo - 1].strike - target) < Math.abs(sortedStrikes[lo].strike - target)) {
      return sortedStrikes[lo - 1];
    }
    return sortedStrikes[lo];
  };

  // Track the snap distance of the sample currently held at each strike so a
  // closer sample can replace a farther one (denser profile than strike
  // grid).  Keyed by strike; only meaningful within this call.
  const snapDist = new Map<number, number>();
  profile.forEach((p) => {
    if (!Number.isFinite(p.price) || !Number.isFinite(p.gex)) return;
    const nearest = findNearest(p.price);
    const dist = Math.abs(nearest.strike - p.price);
    // When multiple profile samples snap to the same strike keep the one
    // closest to its target — a true "profile-at-that-strike" reading
    // instead of last-write-wins between two samples straddling the bucket.
    if (nearest.profileGex == null || dist < (snapDist.get(nearest.strike) ?? Infinity)) {
      nearest.profileGex = p.gex;
      snapDist.set(nearest.strike, dist);
    }
  });

  return sortedStrikes;
}

// Cumulative net-GEX-by-strike curve for a chosen set of expirations.  Walks
// strikes ascending and accumulates net dealer GEX into ``profileGex`` — the
// scoped stand-in for the full-chain spot-shift GEX Profile, which can't be
// rebuilt for a subset (no per-strike IV is persisted).  Its zero crossing is
// the scoped gamma flip and its value at spot is the scoped Net-GEX-at-spot,
// so the curve, the flip line and the bars stay mutually consistent — the
// "low→high cumulative curve" model the chart's header tooltip describes.
function cumulativeNetGexProfile(strikes: StrikeRow[]): MergedRow[] {
  const sorted = strikes
    .filter((row) => Number.isFinite(row.strike))
    .sort((a, b) => a.strike - b.strike);
  let cumulative = 0;
  return sorted.map((row) => {
    cumulative += Number.isFinite(row.netGex) ? row.netGex : 0;
    return {
      strike: row.strike,
      callGex: row.callGex,
      putGex: row.putGex,
      netGex: row.netGex,
      profileGex: cumulative,
    };
  });
}

// Zero crossing of an ascending cumulative curve — the gamma flip for the
// scoped cumulative profile above.  Mirrors the backend
// ``compute_gamma_flip_from_strikes`` (linear-interpolated sign change, exact
// zeros count, nearest-to-``ref`` wins on a lumpy multi-crossing book) so the
// per-expiration flip on this chart agrees with the Strike-Profile chart's.
// Scale-invariant in the y-values, so a gexUnit-scaled ``profileGex`` yields
// the same crossing price.  Returns ``null`` when the curve never crosses.
function cumulativeZeroCrossing(rows: MergedRow[], ref?: number | null): number | null {
  const pts = rows.filter(
    (r): r is MergedRow & { profileGex: number } =>
      Number.isFinite(r.strike) && r.profileGex != null && Number.isFinite(r.profileGex),
  );
  if (pts.length < 2) return null;
  const anchor =
    ref != null && Number.isFinite(ref) ? ref : pts[Math.floor(pts.length / 2)].strike;
  let best: number | null = null;
  let bestDist = Infinity;
  const consider = (x: number) => {
    const d = Math.abs(x - anchor);
    if (d < bestDist) {
      bestDist = d;
      best = x;
    }
  };
  for (let i = 0; i < pts.length - 1; i += 1) {
    const s1 = pts[i].strike;
    const c1 = pts[i].profileGex;
    const s2 = pts[i + 1].strike;
    const c2 = pts[i + 1].profileGex;
    if (c1 === 0) consider(s1);
    else if (c1 * c2 < 0) consider(s1 + ((s2 - s1) * -c1) / (c2 - c1));
  }
  if (pts[pts.length - 1].profileGex === 0) consider(pts[pts.length - 1].strike);
  return best;
}

function ProfileTooltip({
  active,
  payload,
  label,
  spotPrice,
  stackExpirations,
  isSubset,
  dteLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload?: MergedRow }>;
  label?: number | string;
  spotPrice?: number | null;
  stackExpirations: string[];
  isSubset: boolean;
  dteLabel: (exp: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const strike = typeof label === 'number' ? label : Number(label);
  const distance =
    Number.isFinite(strike) && spotPrice != null && Number.isFinite(spotPrice)
      ? strike - spotPrice
      : null;

  // Selected-expiration totals (fall back to the plain aggregate if the
  // per-expiration breakdown hasn't been wired), and the all-expiration
  // baseline the selection is a percentage of.
  const callSel = row.callSelected ?? row.callGex ?? 0;
  const putSel = row.putSelected ?? row.putGex ?? 0;
  const callAll = row.callTotalAll ?? callSel;
  const putAll = row.putTotalAll ?? putSel;
  const net = row.netGex;
  const profile = row.profileGex;
  const callPct = isSubset && Math.abs(callAll) > 0 ? (callSel / callAll) * 100 : null;
  const putPct = isSubset && Math.abs(putAll) > 0 ? (putSel / putAll) * 100 : null;

  return (
    <div
      style={{
        background: 'var(--color-chart-tooltip-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '8px 12px',
        color: 'var(--color-chart-tooltip-text)',
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>
        Strike {formatStrike(strike)}
        {distance != null && (
          <span style={{ opacity: 0.7, marginLeft: 6, fontWeight: 400 }}>
            ({distance >= 0 ? '+' : ''}
            {distance.toFixed(2)} vs spot)
          </span>
        )}
      </div>
      <div style={{ color: 'var(--color-bull)' }}>
        Call GEX: {formatExposure(callSel)}
        {callPct != null && (
          <span style={{ opacity: 0.75 }}> · {callPct.toFixed(0)}% of {formatExposure(callAll)}</span>
        )}
      </div>
      <div style={{ color: 'var(--color-bear)' }}>
        Put GEX: {formatExposure(putSel)}
        {putPct != null && (
          <span style={{ opacity: 0.75 }}> · {putPct.toFixed(0)}% of {formatExposure(putAll)}</span>
        )}
      </div>
      {net != null && (
        <div style={{ color: 'var(--color-text-primary)' }}>Net GEX: {formatExposure(Number(net))}</div>
      )}
      {profile != null && (
        <div style={{ color: PROFILE_LINE_COLOR }}>
          GEX Profile: {formatExposure(Number(profile))}
        </div>
      )}
      {stackExpirations.length > 1 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
          <div style={{ opacity: 0.7, marginBottom: 2 }}>By expiration (roll-off)</div>
          {stackExpirations.map((exp) => {
            const c = Number(row[`call__${exp}`] ?? 0);
            const p = Number(row[`put__${exp}`] ?? 0);
            if (c === 0 && p === 0) return null;
            return (
              <div key={exp} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <span style={{ opacity: 0.85 }}>{dteLabel(exp)}</span>
                <span>
                  <span style={{ color: 'var(--color-bull)' }}>{formatExposure(c)}</span>
                  <span style={{ opacity: 0.5 }}> / </span>
                  <span style={{ color: 'var(--color-bear)' }}>{formatExposure(p)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GexProfileChart({
  symbol,
  strikeData,
  spotPrice,
  gammaFlip,
  callWall,
  putWall,
  callWalls,
  putWalls,
  expirationOptions,
  selectedExpirations,
  onSelectedExpirationsChange,
  zeroDte,
  perExpirationData,
  todayKey,
}: GexProfileChartProps) {
  const { gexUnit } = useGexUnit();
  // Secondary walls to draw beside the primary pair, from the SAME snapshot the
  // caller took callWall / putWall from and pinned to those values at rank 1 —
  // so C2 can never appear on a chart whose "Call Wall" line came from a
  // different frame. Empty at the default depth of 1.
  const { wallDepth } = useWallDepth();
  const secondaryWalls = useMemo(
    () => [
      ...extraWalls(parseWallLadder(callWalls, 'call', callWall), wallDepth),
      ...extraWalls(parseWallLadder(putWalls, 'put', putWall), wallDepth),
    ],
    [callWalls, putWalls, callWall, putWall, wallDepth],
  );
  const textColor = 'var(--text-primary)';
  const axisStroke = 'var(--color-text-primary)';

  // The profile endpoint is keyed (underlying, timestamp) and refreshed
  // each analytics cycle (~30-60s).  10s polling keeps it in step with
  // gex/by-strike without hammering a dataset that changes far less
  // often than the per-bar quote feed.
  const { data: profileData, loading, error } = useGEXProfile(symbol, 10000);

  // A non-empty selection scopes the whole chart to those expirations.
  const isSubsetSelection = (selectedExpirations?.length ?? 0) > 0;

  // Expiration universe (ascending = nearest first) and the subset actually
  // stacked: the whole universe when "All", else just the picked expirations.
  const allExpirationsSorted = useMemo(
    () => [...(expirationOptions ?? [])].sort((a, b) => a.localeCompare(b)),
    [expirationOptions],
  );
  const stackExpirations = useMemo(() => {
    const sel = selectedExpirations ?? [];
    if (sel.length === 0) return allExpirationsSorted;
    const selSet = new Set(sel);
    return allExpirationsSorted.filter((exp) => selSet.has(exp));
  }, [allExpirationsSorted, selectedExpirations]);

  // DTE-ranked opacity, keyed on the FULL universe so a segment's shade is
  // stable regardless of which expirations are filtered in.
  const expirationOpacity = useMemo(() => {
    const m = new Map<string, number>();
    const n = allExpirationsSorted.length;
    allExpirationsSorted.forEach((exp, i) => {
      const t = n <= 1 ? 0 : i / (n - 1);
      m.set(exp, NEAR_OPACITY - t * (NEAR_OPACITY - FAR_OPACITY));
    });
    return m;
  }, [allExpirationsSorted]);

  const dteLabel = useMemo(() => {
    return (exp: string): string => {
      const dte = dteBetweenKeys(todayKey, exp);
      if (dte == null) return exp;
      return dte <= 0 ? '0DTE' : `${dte}DTE`;
    };
  }, [todayKey]);

  // strike -> expiration -> {callGex, putGex} lookup for the bar segments and
  // the all-expiration % baseline. Built from the unfiltered per-expiration
  // feed so the baseline is the true total even while a subset is displayed.
  const perStrikeExp = useMemo(() => {
    const m = new Map<number, Map<string, { callGex: number; putGex: number }>>();
    (perExpirationData ?? []).forEach((r) => {
      if (!Number.isFinite(r.strike)) return;
      let inner = m.get(r.strike);
      if (!inner) {
        inner = new Map();
        m.set(r.strike, inner);
      }
      const cur = inner.get(r.expiration) ?? { callGex: 0, putGex: 0 };
      cur.callGex += r.callGex;
      cur.putGex += r.putGex;
      inner.set(r.expiration, cur);
    });
    return m;
  }, [perExpirationData]);

  // Stored GEX is "per 1% move"; the unit toggle scales every dollar value
  // (bars + profile) by one factor (×100/spot for per-point).  Applying it
  // here, at the single data source the axes/bars/tooltip all read from,
  // keeps the y-axis ticks, bar heights and tooltip consistent.
  const gexFactor = gexScaleFactor(gexUnit, spotPrice);
  const merged = useMemo<MergedRow[]>(() => {
    // GEX Profile curve source:
    //   * "All" → the persisted full-chain spot-shift profile from
    //     /api/gex/profile (its zero crossing is the canonical gamma flip and
    //     its value at spot the headline Net-GEX-at-spot).
    //   * a specific set → the cumulative net-GEX curve built from that set's
    //     own bars, since the spot-shift profile can't be rebuilt for a
    //     subset (no per-strike IV persisted).  Keeps the curve, flip and
    //     bars mutually consistent for the selection.
    const base = isSubsetSelection
      ? cumulativeNetGexProfile(strikeData)
      : mergeProfileWithStrikes(strikeData, profileData?.profile ?? []);

    return base.map((row) => {
      const out: MergedRow = {
        strike: row.strike,
        callGex: row.callGex != null ? row.callGex * gexFactor : row.callGex,
        putGex: row.putGex != null ? row.putGex * gexFactor : row.putGex,
        netGex: row.netGex != null ? row.netGex * gexFactor : row.netGex,
        profileGex: row.profileGex != null ? row.profileGex * gexFactor : row.profileGex,
      };

      // Per-expiration segments + the selected / all-expiration totals used
      // for stacking and the "% of total at this strike" readout. Puts are
      // forced negative so they stack downward regardless of source sign.
      const inner = perStrikeExp.get(row.strike);
      let callSel = 0;
      let putSelMag = 0;
      let callAll = 0;
      let putAllMag = 0;
      if (inner) {
        inner.forEach((v) => {
          callAll += v.callGex;
          putAllMag += Math.abs(v.putGex);
        });
      }
      // Emit a segment field for EVERY expiration in the universe (0 when not
      // shown), not just the selected ones — so the set of <Bar> elements never
      // changes as the selection toggles. Recharts stacks with offsetSign
      // (series[0] at the baseline) in graphical-item registration = mount = JSX
      // order, which is never re-sorted; a constant, nearest-first bar set keeps
      // the shortest DTE pinned to the baseline (boldest) and stacks outward.
      const shownSet = new Set(stackExpirations);
      allExpirationsSorted.forEach((exp) => {
        const v = shownSet.has(exp) ? inner?.get(exp) : undefined;
        const c = v ? v.callGex : 0;
        const pMag = v ? Math.abs(v.putGex) : 0;
        out[`call__${exp}`] = c * gexFactor;
        out[`put__${exp}`] = -pMag * gexFactor;
        callSel += c;
        putSelMag += pMag;
      });
      out.callSelected = callSel * gexFactor;
      out.putSelected = -putSelMag * gexFactor;
      // All-expiration totals are kept only for the tooltip's "% of total"
      // readout — the bars and axis use the selected aggregate, not these.
      out.callTotalAll = callAll * gexFactor;
      out.putTotalAll = -putAllMag * gexFactor;
      return out;
    });
  }, [strikeData, profileData?.profile, gexFactor, isSubsetSelection, perStrikeExp, stackExpirations, allExpirationsSorted]);

  // Flip drawn on the chart = zero crossing of the GEX Profile curve above,
  // so the flip line always sits exactly where the curve crosses zero.
  //   * "All" → the canonical persisted flip passed in via ``gammaFlip``
  //     (the zero crossing of the spot-shift profile; matches the headline
  //     metric and /api/gex/summary — no regression).
  //   * a specific set → the zero crossing of the scoped cumulative curve.
  const effectiveGammaFlip = useMemo(
    () => (isSubsetSelection ? cumulativeZeroCrossing(merged, spotPrice) : gammaFlip ?? null),
    [isSubsetSelection, merged, spotPrice, gammaFlip],
  );

  // The full strike range available in the data — the boundary of how far
  // out the user can pan / zoom out. Recomputed from merged so it stays in
  // step with the option chain (rarely changes intraday).
  const fullStrikeDomain = useMemo<[number, number] | null>(() => {
    if (merged.length === 0) return null;
    const strikes = merged.map((r) => r.strike).filter((s) => Number.isFinite(s));
    if (strikes.length === 0) return null;
    return [Math.min(...strikes), Math.max(...strikes)];
  }, [merged]);

  // visibleDomain controls ONLY which slice of strikes the XAxis renders.
  // The chart container stays the same width and the YAxis stays pinned —
  // changing the domain just shifts/narrows which strikes appear inside it.
  // `null` means "no data yet"; once data lands we initialise to the full
  // range so the chart starts zoomed out.
  const [visibleDomain, setVisibleDomain] = useState<[number, number] | null>(null);

  // Adjust state during render to initialise / expand the bounds when the
  // option chain grows. We deliberately don't shrink visibleDomain on
  // out-of-range — the user's chosen window is what they want to see.
  if (fullStrikeDomain != null) {
    if (visibleDomain == null) {
      setVisibleDomain(fullStrikeDomain);
    } else if (
      visibleDomain[0] < fullStrikeDomain[0] ||
      visibleDomain[1] > fullStrikeDomain[1]
    ) {
      // Clamp window inside the (possibly shrunk) full range.
      const start = Math.max(fullStrikeDomain[0], visibleDomain[0]);
      const end = Math.min(fullStrikeDomain[1], visibleDomain[1]);
      if (end > start) setVisibleDomain([start, end]);
    }
  }

  const handleZoomIn = () => {
    if (!visibleDomain || !fullStrikeDomain) return;
    const [start, end] = visibleDomain;
    const center = (start + end) / 2;
    const newHalfWidth = (end - start) / 2 / X_ZOOM_STEP;
    let newStart = center - newHalfWidth;
    let newEnd = center + newHalfWidth;
    newStart = Math.max(fullStrikeDomain[0], newStart);
    newEnd = Math.min(fullStrikeDomain[1], newEnd);
    // Don't let the window collapse to nothing — leave at least a few
    // strikes worth of room so the chart remains readable.
    const fullSpan = fullStrikeDomain[1] - fullStrikeDomain[0];
    const minSpan = Math.max(1, fullSpan * 0.02);
    if (newEnd - newStart < minSpan) return;
    setVisibleDomain([newStart, newEnd]);
  };

  const handleZoomOut = () => {
    if (!visibleDomain || !fullStrikeDomain) return;
    const [start, end] = visibleDomain;
    const center = (start + end) / 2;
    const newHalfWidth = ((end - start) / 2) * X_ZOOM_STEP;
    let newStart = center - newHalfWidth;
    let newEnd = center + newHalfWidth;
    if (newStart < fullStrikeDomain[0]) {
      newStart = fullStrikeDomain[0];
      newEnd = Math.min(fullStrikeDomain[1], newStart + 2 * newHalfWidth);
    }
    if (newEnd > fullStrikeDomain[1]) {
      newEnd = fullStrikeDomain[1];
      newStart = Math.max(fullStrikeDomain[0], newEnd - 2 * newHalfWidth);
    }
    setVisibleDomain([newStart, newEnd]);
  };

  // Visible value window in normalized units within the fit-all range [-1, 1].
  // Zoom narrows/widens it (both value axes scale together); dragging the plot
  // up/down shifts it. [-1, 1] = fit-all default.
  const [yView, setYView] = useState<[number, number]>(Y_FULL_VIEW);
  const Y_MIN_HALF = 1 / Y_ZOOM_MAX; // narrowest half-window => deepest zoom
  const handleYZoomIn = () => {
    const [lo, hi] = yView;
    const center = (lo + hi) / 2;
    const newHalf = ((hi - lo) / 2) / Y_ZOOM_STEP;
    if (newHalf < Y_MIN_HALF) return;
    setYView([center - newHalf, center + newHalf]);
  };
  const handleYZoomOut = () => {
    const [lo, hi] = yView;
    const center = (lo + hi) / 2;
    const span = Math.min(2, (hi - lo) * Y_ZOOM_STEP);
    let newLo = center - span / 2;
    let newHi = center + span / 2;
    if (newLo < -1) { newLo = -1; newHi = newLo + span; }
    if (newHi > 1) { newHi = 1; newLo = newHi - span; }
    setYView([newLo, newHi]);
  };

  const handleResetView = () => {
    if (fullStrikeDomain) setVisibleDomain(fullStrikeDomain);
    setYView(Y_FULL_VIEW);
  };

  const isFullyZoomedOut =
    visibleDomain != null &&
    fullStrikeDomain != null &&
    visibleDomain[0] <= fullStrikeDomain[0] + 1e-6 &&
    visibleDomain[1] >= fullStrikeDomain[1] - 1e-6;

  // Value-window state: full (can't zoom out further) and max zoom (can't zoom
  // in further). The reset control is meaningful when EITHER axis is off default.
  const isYFull = yView[0] <= -1 + 1e-6 && yView[1] >= 1 - 1e-6;
  const isYMaxZoom = (yView[1] - yView[0]) / 2 <= Y_MIN_HALF + 1e-9;
  const isDefaultView = isFullyZoomedOut && isYFull;

  // Explicit ticks at uniform-step strikes (1, 2, 5, 10… depending on the
  // visible range) so every tick lands on a clean integer and recharts'
  // minTickGap doesn't skip labels mid-axis.
  const xTicks = useMemo(() => {
    if (visibleDomain == null) return undefined;
    return selectStrikeTicks(visibleDomain);
  }, [visibleDomain]);

  // Two y-axes: the bars and Net GEX share the LEFT scale (per-strike
  // dealer dollar GEX), the spot-shift profile sits on the RIGHT scale
  // (the same units but typically an order of magnitude larger because
  // each profile point integrates the entire chain at the hypothetical
  // spot).  Mixing them on a single axis squishes the bars into a flat
  // line at zero — matches the screenshot reference's two-axis layout.
  //
  // Both axes use nice-stepped ticks (1/2/5 × 10^k) so the labels read $1B,
  // $2B, $3B etc. instead of the data-driven extremes recharts would otherwise
  // pick (e.g. $884.1M, -$1.1B). The normalized y-window (`yView`) then carves
  // the visible band out of each axis's fit-all extent — the same window on
  // both, so their zeros stay aligned as you zoom/scroll vertically.
  const { strikeTicks, strikeDomain, profileTicks, profileDomain, denom } = useMemo(() => {
    let strikeAbs = 0;
    let profileAbs = 0;
    merged.forEach((row) => {
      // Scale the bar axis to the SELECTED aggregate (the stacked segments sum
      // to callGex / putGex), so a filtered subset fills the panel the same way
      // the full view does — no all-expiration rescaling that would shrink a
      // subset to a sliver.
      if (row.callGex != null) strikeAbs = Math.max(strikeAbs, Math.abs(row.callGex));
      if (row.putGex != null) strikeAbs = Math.max(strikeAbs, Math.abs(row.putGex));
      if (row.netGex != null) strikeAbs = Math.max(strikeAbs, Math.abs(row.netGex));
      if (row.profileGex != null) profileAbs = Math.max(profileAbs, Math.abs(row.profileGex));
    });
    // Fit-all half-extents, then the visible band = window × extent. A window
    // of [-1, 1] recovers the full symmetric axis; a narrower/off-center window
    // zooms/scrolls, with out-of-range bars and curve clipped via
    // allowDataOverflow.
    const strikeFullMax = roundedMax(strikeAbs);
    const profileFullMax = roundedMax(profileAbs);
    const [nLo, nHi] = yView;
    const strikeDomain: [number, number] = [nLo * strikeFullMax, nHi * strikeFullMax];
    const profileDomain: [number, number] = [nLo * profileFullMax, nHi * profileFullMax];
    // ~8 ticks across the visible band keeps ~4 per side at the full view.
    const strikeTicks = ticksInRange(strikeDomain[0], strikeDomain[1], 8);
    const profileTicks = ticksInRange(profileDomain[0], profileDomain[1], 8);
    // Single denomination shared across both axes so the smaller scale (bars)
    // renders as e.g. "$0.5B" instead of "$500.0M" when the larger scale
    // (profile) is in billions.
    const denom = pickSharedDenomination(
      Math.max(Math.abs(strikeDomain[0]), Math.abs(strikeDomain[1]), Math.abs(profileDomain[0]), Math.abs(profileDomain[1])),
    );
    return { strikeTicks, strikeDomain, profileTicks, profileDomain, denom };
  }, [merged, yView]);

  const hasData = merged.length > 0;

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid var(--border-default)`,
        }}
      >
        {/* Header: a controls row (title, unit badge, strike/value zoom, and the
            expiration selector) with a dedicated legend row beneath it — so the
            legend never reflows onto a second line when the expiration selection
            changes, and the value-axis zoom controls have somewhere to sit. */}
        <div className="mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap gap-y-2">
          <div className="flex items-center gap-2">
            <h3 className="zg-h3" style={{ color: textColor }}>
              Gamma Exposure by Strike
            </h3>
            <TooltipWrapper inlineInExpanded={false} text="Per-strike dealer GEX bars (left axis) overlaid with the GEX Profile curve (right axis). Calls plot up, puts down, aligned on each strike. Each bar is stacked by expiration and shaded by time-to-expiry — the nearest expiration (0DTE) is boldest and the furthest is faintest — so you can read how much gamma rolls off in N days. GEX here is dollar gamma per 1% spot move (γ × 100 × spot² × 0.01), the industry-standard normalization that compares cleanly across underlyings. When you filter to specific expirations, the solid bar is the selected expirations' gamma and a faint cap shows the rest, so the bar reads as a share of the all-expiration total at that strike — hover for the exact % (e.g. 0DTE = $900M, 90% of the $1B at that strike). The profile curve is the shared primitive whose zero crossing is the gamma flip and whose value at spot is the Net GEX at Spot. With All expirations the curve is the full-chain spot-shift profile (flip matches the headline metric); with a subset the bars, curve, walls and flip all scope to that set (the curve becomes the selected expirations' cumulative net-GEX, so its zero crossing is still the flip). Reference lines mark spot, the gamma flip, and the call/put walls.">
              <Info size={14} />
            </TooltipWrapper>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--color-info-soft)' }}
              title="Dollar GEX unit — change it with the GEX unit toggle"
            >
              {GEX_UNIT_LABEL[gexUnit]}
            </span>
            {/* Strike (X) and value (Y) zoom, plus a shared reset. Same
                magnifier per axis; the X / Y prefix says which one it drives. */}
            <div
              className="ml-1 inline-flex items-center rounded border"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-subtle)' }}
            >
              <span className="px-1.5 text-[10px] font-semibold select-none" style={{ color: 'var(--text-muted)' }}>X</span>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={isFullyZoomedOut}
                title="Zoom out strikes (widen visible range)"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid var(--color-border)` }}
              >
                <ZoomOut size={12} />
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom in strikes (narrow visible range)"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid var(--color-border)` }}
              >
                <ZoomIn size={12} />
              </button>
            </div>
            <div
              className="inline-flex items-center rounded border"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-subtle)' }}
            >
              <span className="px-1.5 text-[10px] font-semibold select-none" style={{ color: 'var(--text-muted)' }}>Y</span>
              <button
                type="button"
                onClick={handleYZoomOut}
                disabled={isYFull}
                title="Zoom out the value axis"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid var(--color-border)` }}
              >
                <ZoomOut size={12} />
              </button>
              <button
                type="button"
                onClick={handleYZoomIn}
                disabled={isYMaxZoom}
                title="Zoom in the value axis (magnify the gamma scale to inspect small bars)"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid var(--color-border)` }}
              >
                <ZoomIn size={12} />
              </button>
            </div>
            <button
              type="button"
              onClick={handleResetView}
              disabled={isDefaultView}
              title="Reset zoom (both axes)"
              className="inline-flex items-center rounded border px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-subtle)', color: 'var(--color-text-secondary)' }}
            >
              <RotateCcw size={12} />
            </button>
          </div>
          {/* pr-14 keeps the expiration selector clear of the absolutely-
              positioned Expand button in the card's top-right corner. */}
          <div className="flex items-center gap-2 pr-14" style={{ color: textColor }}>
            {expirationOptions && onSelectedExpirationsChange && (
              <ExpirationMultiSelect
                options={expirationOptions}
                selected={selectedExpirations ?? []}
                onChange={onSelectedExpirationsChange}
                zeroDte={zeroDte}
              />
            )}
            {/* Only offered when the caller actually supplies a ladder — a
                depth switch that can't change anything is worse than none. */}
            {(callWalls?.length || putWalls?.length) ? <WallDepthToggle /> : null}
          </div>
          </div>
          {/* Legend row — on its own line so it never reflows onto a second
              line the way it did when it shared the title row. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-2.5" style={{ color: textColor }}>
            <div
              className="flex items-center gap-1.5"
              title="Stacked by expiration — nearest (0DTE) boldest, furthest faintest"
            >
              <span
                className="inline-block h-3 w-5 rounded-sm"
                style={{ background: 'linear-gradient(90deg, var(--color-bull) 0%, color-mix(in srgb, var(--color-bull) 40%, transparent) 100%)' }}
              />
              Call GEX
            </div>
            <div
              className="flex items-center gap-1.5"
              title="Stacked by expiration — nearest (0DTE) boldest, furthest faintest"
            >
              <span
                className="inline-block h-3 w-5 rounded-sm"
                style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, color-mix(in srgb, var(--color-bear) 40%, transparent) 100%)' }}
              />
              Put GEX
            </div>
            <div className="flex items-center gap-1.5" title="0DTE (near) → highest DTE (far)">
              <span style={{ opacity: 0.7 }}>near</span>
              <span
                className="inline-block h-2 w-8 rounded-sm"
                style={{ background: 'linear-gradient(90deg, var(--text-muted) 0%, color-mix(in srgb, var(--text-muted) 25%, transparent) 100%)' }}
              />
              <span style={{ opacity: 0.7 }}>far</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ backgroundColor: NET_LINE_COLOR }} />
              Net GEX
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ backgroundColor: PROFILE_LINE_COLOR }} />
              GEX Profile
            </div>
          </div>
        </div>

        {/* The error / loading gates below apply only to the /api/gex/profile
            spot-shift curve, which drives the chart ONLY for "All".  With a
            specific expiration set the curve, bars, walls and flip are all
            built from ``strikeData`` (already in hand), so a profile-endpoint
            error or first-fetch delay must not blank the subset chart —
            fall straight through to the hasData check. */}
        {!isSubsetSelection && error ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--color-bear)' }}>
            Failed to load GEX profile: {error}
          </div>
        ) : !isSubsetSelection && loading && !profileData ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--text-secondary)' }}>
            Loading GEX profile…
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--text-secondary)' }}>
            No GEX profile data available.
          </div>
        ) : (
          <ResponsiveChartArea>
            {(chartHeight) => (
            <div className="flex items-start gap-1.5">
              {/* Value (Y) scrollbar — padded to line up with the plot band. */}
              <div
                className="shrink-0"
                style={{ height: chartHeight, paddingTop: REF_LABEL_TOP_MARGIN, paddingBottom: PLOT_INSET_BOTTOM }}
              >
                <ValueRangeScrollbar visibleNorm={yView} onChange={setYView} />
              </div>
              <div className="flex-1 min-w-0">
            <MobileScrollableChart>
              <ResponsiveContainer width="100%" height={chartHeight}>
              {/* Each YAxis track (width=84 below) reserves room for the
                  rotated axis title AND the tick labels with ~25px of
                  clear separation between them.  Outer margin is small
                  because the YAxis width is doing the spacing work.
                  Top margin is enlarged to hold the staggered
                  reference-line labels (see REF_LABEL_STAGGER). */}
              <ComposedChart
                data={merged}
                stackOffset="sign"
                margin={{ top: REF_LABEL_TOP_MARGIN, right: 16, left: 16, bottom: 8 }}
              >
                <CartesianGrid vertical={false} stroke="var(--color-grid-line)" strokeWidth={1} />
                <XAxis
                  dataKey="strike"
                  type="number"
                  domain={visibleDomain ?? ['dataMin', 'dataMax']}
                  allowDataOverflow
                  ticks={xTicks}
                  padding={{ left: 8, right: 8 }}
                  stroke={axisStroke}
                  tick={{ fontSize: 11, fill: axisStroke }}
                  tickFormatter={(v) => formatStrike(Number(v))}
                  minTickGap={28}
                  label={{
                    value: 'Strikes',
                    position: 'insideBottom',
                    offset: -4,
                    fill: axisStroke,
                    fontSize: 11,
                  }}
                />
                <YAxis
                  yAxisId="strike"
                  // Wider YAxis track so the rotated title sits fully
                  // inside the YAxis area (offset is measured inward
                  // from the outer edge) with ~25px of clear space
                  // between the title and the tick labels.
                  width={84}
                  domain={strikeDomain}
                  // Clip bars/line to the (possibly y-zoomed) domain instead of
                  // letting recharts expand it back to fit the data.
                  allowDataOverflow
                  ticks={strikeTicks}
                  stroke={axisStroke}
                  tick={{ fontSize: 11, fill: axisStroke }}
                  tickFormatter={(v) => formatTick(Number(v), denom)}
                  label={{
                    value: 'Gamma Exposure (per 1% move)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 12,
                    style: { fill: axisStroke, fontSize: 11, textAnchor: 'middle' },
                  }}
                />
                {/* Right axis colour matches the left so the two y-scales read
                    as a pair; the profile curve and its legend swatch are
                    enough to associate the right axis with the profile
                    series visually. */}
                <YAxis
                  yAxisId="profile"
                  orientation="right"
                  width={84}
                  domain={profileDomain}
                  allowDataOverflow
                  ticks={profileTicks}
                  stroke={axisStroke}
                  tick={{ fontSize: 11, fill: axisStroke }}
                  tickFormatter={(v) => formatTick(Number(v), denom)}
                  label={{
                    value: `GEX Profile (${GEX_UNIT_LABEL[gexUnit]})`,
                    angle: -90,
                    position: 'insideRight',
                    offset: 12,
                    style: { fill: axisStroke, fontSize: 11, textAnchor: 'middle' },
                  }}
                />
                <Tooltip
                  content={
                    <ProfileTooltip
                      spotPrice={spotPrice ?? null}
                      stackExpirations={stackExpirations}
                      isSubset={isSubsetSelection}
                      dteLabel={dteLabel}
                    />
                  }
                />

                {/* Zero line for the bar axis, drawn first so bars/lines paint over it. */}
                <ReferenceLine yAxisId="strike" y={0} stroke={axisStroke} opacity={0.4} />

                {/* Filled GEX-Profile curve.  Drawn first so the bars and net-GEX
                    line render on top, matching the screenshot reference.
                    "All" is the dense spot-shift profile → monotone (smooth);
                    a subset is the strike-granular cumulative net-GEX curve,
                    drawn piecewise-linear so the rendered zero crossing lands
                    exactly on the flip line (which is the linear-interpolated
                    crossing of the same points). */}
                <Area
                  yAxisId="profile"
                  type={isSubsetSelection ? 'linear' : 'monotone'}
                  dataKey="profileGex"
                  name="GEX Profile"
                  stroke={PROFILE_LINE_COLOR}
                  strokeWidth={1.5}
                  fill={PROFILE_FILL_COLOR}
                  isAnimationActive={false}
                  connectNulls
                  dot={false}
                />

                {/* Per-strike bars, stacked by expiration on one signed stack
                    so calls push up and puts push down aligned on the strike
                    (stackOffset="sign").

                    ORDER INVARIANT: a <Bar> is emitted for EVERY expiration in
                    the universe (nearest first), always — unselected ones just
                    carry 0. Recharts stacks with offsetSign, which places
                    series[0] (the first dataKey) AT the zero baseline; dataKeys
                    follow the graphical items' registration order, which is the
                    mount = JSX order and is never re-sorted. Keeping the bar set
                    constant (all expirations, 0 when unselected) therefore pins
                    the nearest DTE to the baseline and stacks outward to the
                    furthest, matching the opacity ramp (nearest boldest → far
                    faintest). The axis scales to the SELECTED aggregate so a
                    filtered subset fills the panel like the full view. */}
                {allExpirationsSorted.map((exp) => (
                  <Bar
                    key={`call-${exp}`}
                    yAxisId="strike"
                    stackId="gex"
                    dataKey={`call__${exp}`}
                    name={`Call GEX ${dteLabel(exp)}`}
                    fill={'var(--color-bull)'}
                    fillOpacity={expirationOpacity.get(exp) ?? 1}
                    barSize={BAR_SIZE}
                    isAnimationActive={false}
                  />
                ))}
                {allExpirationsSorted.map((exp) => (
                  <Bar
                    key={`put-${exp}`}
                    yAxisId="strike"
                    stackId="gex"
                    dataKey={`put__${exp}`}
                    name={`Put GEX ${dteLabel(exp)}`}
                    fill={'var(--color-bear)'}
                    fillOpacity={expirationOpacity.get(exp) ?? 1}
                    barSize={BAR_SIZE}
                    isAnimationActive={false}
                  />
                ))}
                {allExpirationsSorted.length === 0 && (
                  <Bar
                    yAxisId="strike"
                    stackId="gex"
                    dataKey="callGex"
                    name="Call GEX"
                    fill={'var(--color-bull)'}
                    barSize={BAR_SIZE}
                    isAnimationActive={false}
                  />
                )}
                {allExpirationsSorted.length === 0 && (
                  <Bar
                    yAxisId="strike"
                    stackId="gex"
                    dataKey="putGex"
                    name="Put GEX"
                    fill={'var(--color-bear)'}
                    barSize={BAR_SIZE}
                    isAnimationActive={false}
                  />
                )}

                {/* Net GEX per strike as a thin line — same axis as the bars
                    so it tracks the bar magnitudes, not the profile. */}
                <Line
                  yAxisId="strike"
                  type="monotone"
                  dataKey="netGex"
                  name="Net GEX"
                  stroke={NET_LINE_COLOR}
                  strokeWidth={1.25}
                  dot={false}
                  isAnimationActive={false}
                />

                {spotPrice != null && Number.isFinite(spotPrice) && (
                  <ReferenceLine
                    yAxisId="strike"
                    x={spotPrice}
                    stroke="var(--color-hazy)"
                    strokeDasharray="4 4"
                    label={{
                      value: `Spot: ${formatStrikePrecise(spotPrice)}`,
                      position: 'top',
                      dy: REF_LABEL_STAGGER.spot,
                      fill: 'var(--color-hazy)',
                      fontSize: 10,
                    }}
                  />
                )}
                {effectiveGammaFlip != null && Number.isFinite(effectiveGammaFlip) && (
                  <ReferenceLine
                    yAxisId="strike"
                    x={effectiveGammaFlip}
                    stroke={'var(--color-warning)'}
                    strokeDasharray="4 4"
                    label={{
                      value: `Flip: ${formatStrikePrecise(effectiveGammaFlip)}`,
                      position: 'top',
                      dy: REF_LABEL_STAGGER.flip,
                      fill: 'var(--color-warning)',
                      fontSize: 10,
                    }}
                  />
                )}
                {callWall != null && Number.isFinite(callWall) && (
                  <ReferenceLine
                    yAxisId="strike"
                    x={callWall}
                    stroke={'var(--color-bull)'}
                    strokeDasharray="2 4"
                    label={{
                      value: `Call Wall: ${formatStrikePrecise(callWall)}`,
                      position: 'top',
                      dy: REF_LABEL_STAGGER.callWall,
                      fill: 'var(--color-bull)',
                      fontSize: 10,
                    }}
                  />
                )}
                {putWall != null && Number.isFinite(putWall) && (
                  <ReferenceLine
                    yAxisId="strike"
                    x={putWall}
                    stroke={'var(--color-bear)'}
                    strokeDasharray="2 4"
                    label={{
                      value: `Put Wall: ${formatStrikePrecise(putWall)}`,
                      position: 'top',
                      dy: REF_LABEL_STAGGER.putWall,
                      fill: 'var(--color-bear)',
                      fontSize: 10,
                    }}
                  />
                )}
                {/* Secondary walls (C2/C3 · P2/P3) — same hue as their primary,
                    stepped down in opacity and dash weight by rank, and labelled
                    with the short ladder name so they don't crowd the axis with
                    a second "Call Wall". They share the primary's stagger row:
                    the ladder ranks are strikes apart, so their labels don't
                    collide with each other, and a shared row keeps the reserved
                    top margin unchanged. */}
                {secondaryWalls.map((wall) => (
                  <ReferenceLine
                    key={wall.label}
                    yAxisId="strike"
                    x={wall.strike}
                    stroke={wall.side === 'call' ? 'var(--color-bull)' : 'var(--color-bear)'}
                    strokeDasharray={wallRankDash(wall.rank)}
                    strokeOpacity={wallRankOpacity(wall.rank)}
                    label={{
                      value: `${wall.label}: ${formatStrikePrecise(wall.strike)}`,
                      position: 'top',
                      dy: wall.side === 'call' ? REF_LABEL_STAGGER.callWall : REF_LABEL_STAGGER.putWall,
                      fill: wall.side === 'call' ? 'var(--color-bull)' : 'var(--color-bear)',
                      fillOpacity: wallRankOpacity(wall.rank),
                      fontSize: 10,
                    }}
                  />
                ))}
              </ComposedChart>
              </ResponsiveContainer>
            </MobileScrollableChart>
                {visibleDomain && fullStrikeDomain && (
                  <div className="mt-2 px-2">
                    <StrikeRangeScrollbar
                      visibleDomain={visibleDomain}
                      fullDomain={fullStrikeDomain}
                      onChange={setVisibleDomain}
                    />
                  </div>
                )}
              </div>
            </div>
            )}
          </ResponsiveChartArea>
        )}
        <ChartCaption />
      </div>
    </ExpandableCard>
  );
}
