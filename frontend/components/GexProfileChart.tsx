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
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import { useGEXProfile } from '@/hooks/useApiData';
import { useIsMobile } from '@/hooks/useIsMobile';
import { GEX_UNIT_LABEL, gexScaleFactor, useGexUnit } from '@/core/GexUnitContext';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';
import StrikeRangeScrollbar from './StrikeRangeScrollbar';
import ExpirationMultiSelect from './ExpirationMultiSelect';

// Each zoom click narrows / widens the visible strike range by this factor.
// 1.4 is roughly the geometric mean of 1 and 2, giving comfortable single-
// click steps without bouncing across the whole chain.
const X_ZOOM_STEP = 1.4;

interface StrikeRow {
  strike: number;
  netGex: number;
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
  expirationOptions?: string[];
  /** Selected expirations; empty array = All (aggregate across the chain). */
  selectedExpirations?: string[];
  onSelectedExpirationsChange?: (value: string[]) => void;
}

interface MergedRow {
  strike: number;
  callGex?: number;
  putGex?: number;
  netGex?: number;
  profileGex?: number;
}

// Palette-aware — resolved from CSS variables per the active theme.
const PROFILE_LINE_COLOR = 'var(--color-gold)';
const PROFILE_FILL_COLOR = 'var(--color-gold-soft)';
const NET_LINE_COLOR = 'var(--text-muted)';

// Match the bar width used by GexWallsChart (OPEN INTEREST & EXPOSURE BY
// STRIKE) so the two stacked charts read as a cohesive pair.
const BAR_SIZE = 14;

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

// Symmetric ticks anchored at zero: [-N*step, ..., -step, 0, step, ..., N*step].
// Caller picks `step` via niceStep so the labels read $1B, $2B, $3B etc.
function symmetricTicks(maxAbs: number, step: number): { ticks: number[]; domainMax: number } {
  if (!Number.isFinite(maxAbs) || maxAbs <= 0 || step <= 0) {
    return { ticks: [0], domainMax: 1 };
  }
  const upper = Math.ceil(maxAbs / step) * step;
  const ticks: number[] = [];
  // Floating-point safety: count rungs then multiply, instead of repeated
  // additions that drift (e.g. step=0.1 sums to 0.30000000000000004).
  const rungs = Math.round(upper / step);
  for (let i = -rungs; i <= rungs; i += 1) {
    ticks.push(i * step);
  }
  return { ticks, domainMax: upper };
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

  profile.forEach((p) => {
    if (!Number.isFinite(p.price) || !Number.isFinite(p.gex)) return;
    const nearest = findNearest(p.price);
    // When multiple profile samples snap to the same strike (denser
    // profile than strike grid) keep the one closest to its target —
    // this stays a true "profile-at-that-strike" reading instead of
    // averaging two samples from different sides of the bucket.
    const existing = nearest.profileGex;
    if (existing == null) {
      nearest.profileGex = p.gex;
    } else {
      const existingDist = Math.abs(nearest.strike - p.price);
      const newDist = Math.abs(nearest.strike - p.price);
      if (newDist < existingDist) nearest.profileGex = p.gex;
    }
  });

  return sortedStrikes;
}

function ProfileTooltip({
  active,
  payload,
  label,
  spotPrice,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; color?: string }>;
  label?: number | string;
  spotPrice?: number | null;
}) {
  if (!active || !payload?.length) return null;
  const strike = typeof label === 'number' ? label : Number(label);
  const distance =
    Number.isFinite(strike) && spotPrice != null && Number.isFinite(spotPrice)
      ? strike - spotPrice
      : null;
  const findValue = (key: string) =>
    payload.find((entry) => entry.dataKey === key)?.value;
  const call = findValue('callGex');
  const put = findValue('putGex');
  const net = findValue('netGex');
  const profile = findValue('profileGex');
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
      {call != null && (
        <div style={{ color: 'var(--color-bull)' }}>Call GEX: {formatExposure(Number(call))}</div>
      )}
      {put != null && (
        <div style={{ color: 'var(--color-bear)' }}>Put GEX: {formatExposure(Number(put))}</div>
      )}
      {net != null && (
        <div style={{ color: 'var(--color-text-primary)' }}>Net GEX: {formatExposure(Number(net))}</div>
      )}
      {profile != null && (
        <div style={{ color: PROFILE_LINE_COLOR }}>
          GEX Profile: {formatExposure(Number(profile))}
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
  expirationOptions,
  selectedExpirations,
  onSelectedExpirationsChange,
}: GexProfileChartProps) {
  const { theme } = useTheme();
  const { gexUnit } = useGexUnit();
  const isMobile = useIsMobile();
  const isDark = theme === 'dark';
  const textColor = 'var(--text-primary)';
  const axisStroke = 'var(--color-text-primary)';
  const gridStroke = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  // The profile endpoint is keyed (underlying, timestamp) and refreshed
  // each analytics cycle (~30-60s).  10s polling keeps it in step with
  // gex/by-strike without hammering a dataset that changes far less
  // often than the per-bar quote feed.
  const { data: profileData, loading, error } = useGEXProfile(symbol, 10000);

  // Stored GEX is "per 1% move"; the unit toggle scales every dollar value
  // (bars + spot-shift profile) by one factor (×100/spot for per-point).
  // Applying it here, at the single data source the axes/bars/tooltip all
  // read from, keeps the y-axis ticks, bar heights and tooltip consistent.
  const gexFactor = gexScaleFactor(gexUnit, spotPrice);
  const merged = useMemo<MergedRow[]>(() => {
    const profile = profileData?.profile ?? [];
    const rows = mergeProfileWithStrikes(strikeData, profile);
    if (gexFactor === 1) return rows;
    return rows.map((r) => ({
      ...r,
      callGex: r.callGex != null ? r.callGex * gexFactor : r.callGex,
      putGex: r.putGex != null ? r.putGex * gexFactor : r.putGex,
      netGex: r.netGex != null ? r.netGex * gexFactor : r.netGex,
      profileGex: r.profileGex != null ? r.profileGex * gexFactor : r.profileGex,
    }));
  }, [strikeData, profileData?.profile, gexFactor]);

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

  const handleResetView = () => {
    if (!fullStrikeDomain) return;
    setVisibleDomain(fullStrikeDomain);
  };

  const isFullyZoomedOut =
    visibleDomain != null &&
    fullStrikeDomain != null &&
    visibleDomain[0] <= fullStrikeDomain[0] + 1e-6 &&
    visibleDomain[1] >= fullStrikeDomain[1] - 1e-6;

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
  // Both axes use symmetric nice-stepped ticks (1/2/5 × 10^k) so the
  // labels read $1B, $2B, $3B etc. instead of the data-driven extremes
  // recharts would otherwise pick (e.g. $884.1M, -$1.1B).
  const { strikeTicks, strikeDomain, profileTicks, profileDomain, denom } = useMemo(() => {
    let strikeAbs = 0;
    let profileAbs = 0;
    merged.forEach((row) => {
      if (row.callGex != null) strikeAbs = Math.max(strikeAbs, Math.abs(row.callGex));
      if (row.putGex != null) strikeAbs = Math.max(strikeAbs, Math.abs(row.putGex));
      if (row.netGex != null) strikeAbs = Math.max(strikeAbs, Math.abs(row.netGex));
      if (row.profileGex != null) profileAbs = Math.max(profileAbs, Math.abs(row.profileGex));
    });
    // ~4 ticks per side keeps the y-axis legible without crowding labels
    // at smaller chart heights.
    const strikeStep = niceStep(strikeAbs, 4);
    const profileStep = niceStep(profileAbs, 4);
    const strike = symmetricTicks(strikeAbs, strikeStep);
    const profile = symmetricTicks(profileAbs, profileStep);
    // Single denomination shared across both axes so the smaller scale
    // (bars) renders as e.g. "$0.5B" instead of "$500.0M" when the
    // larger scale (profile) is in billions.
    return {
      strikeTicks: strike.ticks,
      strikeDomain: [-strike.domainMax, strike.domainMax] as [number, number],
      profileTicks: profile.ticks,
      profileDomain: [-profile.domainMax, profile.domainMax] as [number, number],
      denom: pickSharedDenomination(Math.max(strike.domainMax, profile.domainMax)),
    };
  }, [merged]);

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
        {/* Header: title on the left, legend top-right above the plot area so
            it never collides with reference-line labels or profile peaks. */}
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="zg-h3" style={{ color: textColor }}>
              Gamma Exposure by Strike
            </h3>
            <TooltipWrapper text="Per-strike dealer GEX bars (left axis) overlaid with the spot-shift GEX Profile curve (right axis). GEX here is dollar gamma per 1% spot move (γ × 100 × spot² × 0.01), the industry-standard normalization — used here because it compares cleanly across underlyings of different price levels. This is the same fundamental quantity shown as '$ Gamma' in the Open Interest & Exposure by Strike chart below, just measured per 1% spot move instead of per $1 spot move (they differ by a factor of spot × 0.01). The profile curve is the shared primitive whose zero crossing is the gamma flip and whose value at spot is the headline Net GEX at Spot. Reference lines mark spot, the gamma flip, and the call/put walls.">
              <Info size={14} />
            </TooltipWrapper>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: 'var(--text-muted)', backgroundColor: 'var(--color-info-soft)' }}
              title="Dollar GEX unit — change it with the GEX unit toggle"
            >
              {GEX_UNIT_LABEL[gexUnit]}
            </span>
            <div
              className="ml-1 inline-flex rounded border"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-surface-subtle)' }}
            >
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={isFullyZoomedOut}
                title="Zoom out (widen visible strike range)"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <ZoomOut size={12} />
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom in (narrow visible strike range)"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid var(--color-border)` }}
              >
                <ZoomIn size={12} />
              </button>
              <button
                type="button"
                onClick={handleResetView}
                disabled={isFullyZoomedOut}
                title="Reset to full strike range"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid var(--color-border)` }}
              >
                <RotateCcw size={12} />
              </button>
            </div>
          </div>
          <div
            // pr-14 reserves room for the absolutely-positioned Expand
            // button (right-3, ~36px wide) in the card's top-right corner,
            // so the rightmost legend entry never tucks under it.
            className="flex flex-wrap items-center gap-4 text-xs pr-14"
            style={{ color: textColor }}
          >
            {expirationOptions && onSelectedExpirationsChange && (
              <ExpirationMultiSelect
                options={expirationOptions}
                selected={selectedExpirations ?? []}
                onChange={onSelectedExpirationsChange}
              />
            )}
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--color-bull)' }} />
              Call GEX
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--color-bear)' }} />
              Put GEX
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

        {error ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--color-bear)' }}>
            Failed to load GEX profile: {error}
          </div>
        ) : loading && !profileData ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--text-secondary)' }}>
            Loading GEX profile…
          </div>
        ) : !hasData ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--text-secondary)' }}>
            No GEX profile data available.
          </div>
        ) : (
          <MobileScrollableChart>
            <ResponsiveContainer width="100%" height={isMobile ? 320 : 420}>
              {/* Each YAxis track (width=84 below) reserves room for the
                  rotated axis title AND the tick labels with ~25px of
                  clear separation between them.  Outer margin is small
                  because the YAxis width is doing the spacing work.
                  Top margin is enlarged to hold the staggered
                  reference-line labels (see REF_LABEL_STAGGER). */}
              <ComposedChart
                data={merged}
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
                <Tooltip content={<ProfileTooltip spotPrice={spotPrice ?? null} />} />

                {/* Zero line for the bar axis, drawn first so bars/lines paint over it. */}
                <ReferenceLine yAxisId="strike" y={0} stroke={axisStroke} opacity={0.4} />

                {/* Filled GEX-Profile curve.  Drawn first so the bars and net-GEX
                    line render on top, matching the screenshot reference. */}
                <Area
                  yAxisId="profile"
                  type="monotone"
                  dataKey="profileGex"
                  name="GEX Profile"
                  stroke={PROFILE_LINE_COLOR}
                  strokeWidth={1.5}
                  fill={PROFILE_FILL_COLOR}
                  isAnimationActive={false}
                  connectNulls
                  dot={false}
                />

                {/* Per-strike bars: calls push up (positive), puts push down. */}
                <Bar
                  yAxisId="strike"
                  dataKey="callGex"
                  name="Call GEX"
                  fill={'var(--color-bull)'}
                  barSize={BAR_SIZE}
                  isAnimationActive={false}
                />
                <Bar
                  yAxisId="strike"
                  dataKey="putGex"
                  name="Put GEX"
                  fill={'var(--color-bear)'}
                  barSize={BAR_SIZE}
                  isAnimationActive={false}
                />

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
                {gammaFlip != null && Number.isFinite(gammaFlip) && (
                  <ReferenceLine
                    yAxisId="strike"
                    x={gammaFlip}
                    stroke={'var(--color-warning)'}
                    strokeDasharray="4 4"
                    label={{
                      value: `Flip: ${formatStrikePrecise(gammaFlip)}`,
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
              </ComposedChart>
            </ResponsiveContainer>
          </MobileScrollableChart>
        )}
        {hasData && visibleDomain && fullStrikeDomain && (
          <div className="mt-2 px-2">
            <StrikeRangeScrollbar
              visibleDomain={visibleDomain}
              fullDomain={fullStrikeDomain}
              onChange={setVisibleDomain}
            />
          </div>
        )}
      </div>
    </ExpandableCard>
  );
}
