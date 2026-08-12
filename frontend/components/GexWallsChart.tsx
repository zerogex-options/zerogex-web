'use client';

import { useMemo, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';
import StrikeRangeScrollbar from './StrikeRangeScrollbar';
import ValueRangeScrollbar from './ValueRangeScrollbar';
import ResponsiveChartArea from './ResponsiveChartArea';
import ExpirationMultiSelect from './ExpirationMultiSelect';
import { useSharedExpirations } from '@/hooks/useSharedExpirations';
import { reconcileExpirations } from '@/core/expirationPersistence';
import { etTodayDateKey } from '@/core/utils';
import ChartCaption from "./ChartCaption";

// Each zoom click narrows / widens the visible strike range by this factor.
// 1.4 is roughly the geometric mean of 1 and 2, giving comfortable single-
// click steps without bouncing across the whole chain.
const X_ZOOM_STEP = 1.4;

// Pick a 1 / 2 / 5 × 10^k step that gives roughly `targetCount` ticks across
// the given range. The same cadence as the y-axis helpers elsewhere — yields
// labels like 580/585/590 rather than 581.5/583/584.5.
function niceStep(range: number, targetCount: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rough = range / Math.max(1, targetCount);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  if (norm < 1.5) return 1 * magnitude;
  if (norm < 3.5) return 2 * magnitude;
  if (norm < 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

// Generate evenly-spaced x-axis ticks across the visible strike range. Floor
// at step=1 so we never sub-divide a strike.
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

// Vertical (value-axis) zoom + scroll, mirroring the Gamma chart: the visible
// y-extent is a normalized window within the fit-all range [-1, 1]; zoom
// narrows/widens it and the value scrollbar shifts it.
const Y_ZOOM_STEP = 1.5;
const Y_ZOOM_MAX = 32;
const Y_FULL_VIEW: [number, number] = [-1, 1];
// Insets (top margin 8; bottom margin 8 + ~24 x-axis) to line the value
// scrollbar up with the plot band.
const PLOT_INSET_TOP = 8;
const PLOT_INSET_BOTTOM = 32;

// Expiration-gradient opacity (0DTE boldest → furthest faintest). Mirrors the
// Gamma chart.
const NEAR_OPACITY = 1;
const FAR_OPACITY = 0.4;

// Whole-day DTE between two YYYY-MM-DD keys (parsed at UTC midnight).
function dteBetweenKeys(todayKey: string, expKey: string): number | null {
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  const exp = Date.parse(`${expKey}T00:00:00Z`);
  if (Number.isNaN(today) || Number.isNaN(exp)) return null;
  return Math.round((exp - today) / 86_400_000);
}

// Fit-all half-extent: smallest nice-stepped multiple covering the max
// magnitude — the reference the normalized y-window maps onto.
function roundedMax(maxAbs: number): number {
  if (!Number.isFinite(maxAbs) || maxAbs <= 0) return 1;
  const step = niceStep(maxAbs, 4);
  return Math.ceil(maxAbs / step) * step;
}

// Nice-stepped ticks across an arbitrary (possibly off-center) [lo, hi] range.
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

interface OpenInterestRow {
  strike?: number | string;
  expiration?: string;
  option_type?: string | null;
  open_interest?: number | string | null;
  exposure?: number | string | null;
  call_oi?: number | string | null;
  put_oi?: number | string | null;
  call_exposure?: number | string | null;
  put_exposure?: number | string | null;
}

interface GexWallsChartProps {
  openInterestData?: OpenInterestRow[] | null;
  spotPrice?: number | string | null;
  byStrikeFallback?: Array<{ strike?: number | string; call_oi?: number | string | null; put_oi?: number | string | null }> | null;
}

type DisplayMode = 'oi' | 'notional';

type ChartRow = {
  strike: number;
  strikeLabel: string;
  callValue: number; // selected-expiration aggregate (>= 0) — also the fallback bar
  putValue: number; // selected-expiration aggregate (<= 0)
  // Stacked-by-expiration additions:
  callTotalAll?: number; // all-expiration total — tooltip % baseline (>= 0)
  putTotalAll?: number; // all-expiration total — tooltip % baseline (<= 0)
  // Dynamic per-expiration segments: `call__<exp>` (>= 0), `put__<exp>` (<= 0).
  [key: string]: number | string | undefined;
};

function asNum(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAxisValue(value: number, mode: DisplayMode): string {
  const abs = Math.abs(value);
  const isDollar = mode === 'notional';
  const prefix = isDollar ? '$' : '';
  if (abs >= 1e9) return `${prefix}${(value / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${prefix}${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${prefix}${(value / 1e3).toFixed(0)}k`;
  return `${prefix}${value.toFixed(isDollar ? 2 : 0)}`;
}

function formatTooltipValue(value: number, mode: DisplayMode): string {
  if (mode === 'notional') {
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return value.toLocaleString();
}

function modeLabel(mode: DisplayMode): string {
  if (mode === 'oi') return 'OI';
  return 'Notional';
}

function WallMapTooltip({
  active,
  payload,
  label,
  mode,
  stackExpirations,
  isSubset,
  dteLabel,
}: {
  active?: boolean;
  payload?: Array<{ payload?: ChartRow }>;
  label?: string | number;
  mode: DisplayMode;
  stackExpirations: string[];
  isSubset: boolean;
  dteLabel: (exp: string) => string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const unitLabel = modeLabel(mode);
  // Puts are stored negative (below the axis); OI / notional are positive
  // quantities, so the tooltip shows magnitudes.
  const callSel = Math.abs(Number(row.callValue ?? 0));
  const putSel = Math.abs(Number(row.putValue ?? 0));
  const callAll = Math.abs(Number(row.callTotalAll ?? row.callValue ?? 0));
  const putAll = Math.abs(Number(row.putTotalAll ?? row.putValue ?? 0));
  const callPct = isSubset && callAll > 0 ? (callSel / callAll) * 100 : null;
  const putPct = isSubset && putAll > 0 ? (putSel / putAll) * 100 : null;
  return (
    <div style={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', color: 'var(--color-chart-tooltip-text)', fontSize: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Strike {label}</div>
      <div style={{ color: 'var(--color-bull)' }}>
        Call {unitLabel}: {formatTooltipValue(callSel, mode)}
        {callPct != null && (
          <span style={{ opacity: 0.75 }}> · {callPct.toFixed(0)}% of {formatAxisValue(callAll, mode)}</span>
        )}
      </div>
      <div style={{ color: 'var(--color-bear)' }}>
        Put {unitLabel}: {formatTooltipValue(putSel, mode)}
        {putPct != null && (
          <span style={{ opacity: 0.75 }}> · {putPct.toFixed(0)}% of {formatAxisValue(putAll, mode)}</span>
        )}
      </div>
      {stackExpirations.length > 1 && (
        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--color-border)' }}>
          <div style={{ opacity: 0.7, marginBottom: 2 }}>By expiration (roll-off)</div>
          {stackExpirations.map((exp) => {
            const c = Number(row[`call__${exp}`] ?? 0);
            const p = Math.abs(Number(row[`put__${exp}`] ?? 0));
            if (c === 0 && p === 0) return null;
            return (
              <div key={exp} style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
                <span style={{ opacity: 0.85 }}>{dteLabel(exp)}</span>
                <span>
                  <span style={{ color: 'var(--color-bull)' }}>{formatAxisValue(c, mode)}</span>
                  <span style={{ opacity: 0.5 }}> / </span>
                  <span style={{ color: 'var(--color-bear)' }}>{formatAxisValue(p, mode)}</span>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GexWallsChart({ openInterestData, spotPrice, byStrikeFallback }: GexWallsChartProps) {
  const textColor = 'var(--text-primary)';
  const axisStroke = 'var(--color-text-primary)';
  const inputBg = 'var(--color-surface-subtle)';
  const inputBorder = 'var(--color-border)';

  const expirationOptions = useMemo(() => {
    const source = openInterestData || [];
    return Array.from(new Set(source.map((row) => String(row.expiration || '')).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  }, [openInterestData]);

  // Empty set = All (aggregate every expiration); a non-empty set sums the
  // per-strike call/put values across exactly those expirations. The selection
  // is shared and persisted across every expiration-filtering chart in the tab
  // (see useSharedExpirations), reconciled here to the expirations this chart
  // actually has so a stale/foreign pick drops out and simply reads as "All".
  const { selection, setSelection } = useSharedExpirations();
  const selectedExpirations = useMemo(
    () => reconcileExpirations(selection, expirationOptions),
    [selection, expirationOptions],
  );
  const [displayMode, setDisplayMode] = useState<DisplayMode>('oi');

  // Universe (ascending = nearest first) and the shown subset (empty = All).
  const allExpirationsSorted = expirationOptions;
  const isSubset = selectedExpirations.length > 0;
  const stackExpirations = useMemo(() => {
    if (!isSubset) return allExpirationsSorted;
    const sel = new Set(selectedExpirations);
    return allExpirationsSorted.filter((exp) => sel.has(exp));
  }, [allExpirationsSorted, selectedExpirations, isSubset]);

  const todayKey = etTodayDateKey();
  const dteLabel = (exp: string): string => {
    const dte = dteBetweenKeys(todayKey, exp);
    if (dte == null) return exp;
    return dte <= 0 ? '0DTE' : `${dte}DTE`;
  };

  // DTE-ranked opacity keyed on the FULL universe so a segment's shade is
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

  // strike -> expiration -> {call, put} in the active display unit.
  const perStrikeExp = useMemo(() => {
    const m = new Map<number, Map<string, { call: number; put: number }>>();
    (openInterestData || []).forEach((row) => {
      const strike = asNum(row.strike);
      if (!Number.isFinite(strike) || strike <= 0) return;
      const exp = String(row.expiration || '');
      if (!exp) return;
      let inner = m.get(strike);
      if (!inner) { inner = new Map(); m.set(strike, inner); }
      const cur = inner.get(exp) ?? { call: 0, put: 0 };
      const optionType = String(row.option_type || '').toUpperCase();
      // Notional = strike × 100 × OI, the standard position-size definition.
      const oi = asNum(row.open_interest);
      const value = displayMode === 'oi' ? oi : oi * 100 * strike;
      if (optionType.startsWith('C')) {
        cur.call += value;
      } else if (optionType.startsWith('P')) {
        cur.put += value;
      } else {
        const callOi = asNum(row.call_oi);
        const putOi = asNum(row.put_oi);
        if (displayMode === 'oi') { cur.call += callOi; cur.put += putOi; }
        else { cur.call += callOi * 100 * strike; cur.put += putOi * 100 * strike; }
      }
      inner.set(exp, cur);
    });
    return m;
  }, [openInterestData, displayMode]);

  const chartData = useMemo<ChartRow[]>(() => {
    const shownSet = new Set(stackExpirations);
    const rows: ChartRow[] = [];

    // A segment field for EVERY expiration (0 when not shown) so the <Bar> set
    // is constant across selection changes — recharts v3 stacks in mount order,
    // so a changing set scrambles the DTE order (see GexProfileChart).
    perStrikeExp.forEach((inner, strike) => {
      const row: ChartRow = { strike, strikeLabel: strike.toFixed(0), callValue: 0, putValue: 0 };
      let callSel = 0;
      let putSel = 0;
      let callAll = 0;
      let putAll = 0;
      inner.forEach((v) => { callAll += v.call; putAll += v.put; });
      allExpirationsSorted.forEach((exp) => {
        const v = shownSet.has(exp) ? inner.get(exp) : undefined;
        const c = v ? v.call : 0;
        const p = v ? v.put : 0;
        row[`call__${exp}`] = c;
        row[`put__${exp}`] = -Math.abs(p);
        callSel += c;
        putSel += Math.abs(p);
      });
      row.callValue = callSel;
      row.putValue = -putSel;
      // All-expiration totals kept only for the tooltip "% of total" readout;
      // the bars and axis use the selected aggregate.
      row.callTotalAll = callAll;
      row.putTotalAll = -Math.abs(putAll);
      rows.push(row);
    });

    // Fallback: only the aggregate by-strike snapshot is available (no
    // per-expiration OI rows) — render plain call/put bars, no stacking.
    if (rows.length === 0 && byStrikeFallback?.length) {
      const grouped = new Map<number, ChartRow>();
      byStrikeFallback.forEach((row) => {
        const strike = asNum(row.strike);
        if (!Number.isFinite(strike) || strike <= 0) return;
        const existing = grouped.get(strike) ?? { strike, strikeLabel: strike.toFixed(0), callValue: 0, putValue: 0 };
        const callOi = asNum(row.call_oi);
        const putOi = asNum(row.put_oi);
        if (displayMode === 'notional') {
          existing.callValue += callOi * 100 * strike;
          existing.putValue += putOi * 100 * strike;
        } else {
          existing.callValue += callOi;
          existing.putValue += putOi;
        }
        grouped.set(strike, existing);
      });
      return Array.from(grouped.values())
        .map((row) => ({ ...row, putValue: -Math.abs(row.putValue) }))
        .sort((a, b) => a.strike - b.strike);
    }

    return rows.sort((a, b) => a.strike - b.strike);
  }, [perStrikeExp, stackExpirations, allExpirationsSorted, byStrikeFallback, displayMode]);

  const spot = asNum(spotPrice);

  const closestStrike = useMemo(() => {
    if (spot <= 0 || !chartData.length) return null;
    const closest = chartData.reduce((best, row) =>
      Math.abs(row.strike - spot) < Math.abs(best.strike - spot) ? row : best,
    );
    return closest.strike;
  }, [spot, chartData]);

  // The full strike range available in the filtered data — the boundary of
  // how far out the user can pan / zoom out.
  const fullStrikeDomain = useMemo<[number, number] | null>(() => {
    if (chartData.length === 0) return null;
    const strikes = chartData.map((r) => r.strike).filter((s) => Number.isFinite(s));
    if (strikes.length === 0) return null;
    return [Math.min(...strikes), Math.max(...strikes)];
  }, [chartData]);

  // visibleDomain controls ONLY which slice of strikes the XAxis renders;
  // the chart container width and the YAxis stay put. `null` until data
  // arrives, then initialised to the full range (zoomed out).
  const [visibleDomain, setVisibleDomain] = useState<[number, number] | null>(null);

  if (fullStrikeDomain != null) {
    if (visibleDomain == null) {
      setVisibleDomain(fullStrikeDomain);
    } else if (
      visibleDomain[0] < fullStrikeDomain[0] ||
      visibleDomain[1] > fullStrikeDomain[1]
    ) {
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

  // Vertical value window in normalized units within the fit-all range [-1, 1].
  // Zoom narrows/widens it; the value scrollbar shifts it.
  const [yView, setYView] = useState<[number, number]>(Y_FULL_VIEW);
  const Y_MIN_HALF = 1 / Y_ZOOM_MAX;
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
  const isYFull = yView[0] <= -1 + 1e-6 && yView[1] >= 1 - 1e-6;
  const isYMaxZoom = (yView[1] - yView[0]) / 2 <= Y_MIN_HALF + 1e-9;
  const isDefaultView = isFullyZoomedOut && isYFull;

  // Explicit ticks at uniform-step strikes (1, 2, 5, 10… depending on the
  // visible range) so every tick lands on a clean integer and minTickGap
  // doesn't skip labels mid-axis.
  const xTicks = useMemo(() => {
    if (visibleDomain == null) return undefined;
    return selectStrikeTicks(visibleDomain);
  }, [visibleDomain]);

  // Symmetric value axis carved by the normalized y-window, so zoom + scroll
  // magnify the mirror bars. allowDataOverflow clips out-of-window bars.
  const { yDomain, yTicks } = useMemo(() => {
    let maxAbs = 0;
    chartData.forEach((row) => {
      // Scale to the SELECTED aggregate (the stacked segments sum to
      // callValue / putValue), so a filtered subset fills the panel the same
      // way the full view does — no all-expiration rescaling.
      maxAbs = Math.max(
        maxAbs,
        Math.abs(row.callValue),
        Math.abs(row.putValue),
      );
    });
    const fullMax = roundedMax(maxAbs);
    const [nLo, nHi] = yView;
    const domain: [number, number] = [nLo * fullMax, nHi * fullMax];
    return { yDomain: domain, yTicks: ticksInRange(domain[0], domain[1], 6) };
  }, [chartData, yView]);

  const renderLegend = () => (
    <div className="w-full flex flex-wrap justify-end items-center gap-x-4 gap-y-1 text-xs" style={{ color: textColor }}>
      <div className="flex items-center gap-1.5" title="Stacked by expiration — nearest (0DTE) boldest, furthest faintest">
        <span
          className="inline-block h-3 w-5 rounded-sm"
          style={{ background: 'linear-gradient(90deg, var(--color-bull) 0%, color-mix(in srgb, var(--color-bull) 40%, transparent) 100%)' }}
        />
        Call {modeLabel(displayMode)}
      </div>
      <div className="flex items-center gap-1.5" title="Stacked by expiration — nearest (0DTE) boldest, furthest faintest">
        <span
          className="inline-block h-3 w-5 rounded-sm"
          style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, color-mix(in srgb, var(--color-bear) 40%, transparent) 100%)' }}
        />
        Put {modeLabel(displayMode)}
      </div>
      <div className="flex items-center gap-1.5" title="0DTE (near) → highest DTE (far)">
        <span style={{ opacity: 0.7 }}>near</span>
        <span
          className="inline-block h-2 w-7 rounded-sm"
          style={{ background: 'linear-gradient(90deg, var(--text-muted) 0%, color-mix(in srgb, var(--text-muted) 25%, transparent) 100%)' }}
        />
        <span style={{ opacity: 0.7 }}>far</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4" style={{ backgroundColor: 'var(--color-gold)' }} />
        Spot
      </div>
    </div>
  );

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div
        className="rounded-2xl p-6"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid var(--border-default)`,
        }}
      >
        <div className="flex items-center justify-between gap-3 gap-y-2 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <h3 className="zg-h3" style={{ color: textColor }}>
              Open Interest by Strike
            </h3>
            <TooltipWrapper inlineInExpanded={false} text="Strike-level open interest by call/put. Calls plot above the axis, puts below, aligned on each strike. Each bar is stacked by expiration and shaded by time-to-expiry — the nearest expiration (0DTE) is boldest and the furthest is faintest — so you can read how much OI rolls off in N days. OI = open contracts outstanding (raw count); Notional = strike × 100 × OI (the dollar value of underlying that would change hands at exercise). When you filter to specific expirations, the solid bar is the selected expirations and a faint cap shows the rest, so the bar reads as a share of the all-expiration total at that strike — hover for the exact % and the per-expiration breakdown. The yellow dotted line marks spot at the nearest strike.">
              <Info size={14} />
            </TooltipWrapper>
            {/* Strike (X) and value (Y) zoom with a shared reset — same set
                the Gamma chart carries. */}
            <div
              className="ml-1 inline-flex items-center rounded border"
              style={{ borderColor: inputBorder, backgroundColor: inputBg }}
            >
              <span className="px-1.5 text-[10px] font-semibold select-none" style={{ color: 'var(--text-muted)' }}>X</span>
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={isFullyZoomedOut}
                title="Zoom out strikes (widen visible range)"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid ${inputBorder}` }}
              >
                <ZoomOut size={12} />
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom in strikes (narrow visible range)"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid ${inputBorder}` }}
              >
                <ZoomIn size={12} />
              </button>
            </div>
            <div
              className="inline-flex items-center rounded border"
              style={{ borderColor: inputBorder, backgroundColor: inputBg }}
            >
              <span className="px-1.5 text-[10px] font-semibold select-none" style={{ color: 'var(--text-muted)' }}>Y</span>
              <button
                type="button"
                onClick={handleYZoomOut}
                disabled={isYFull}
                title="Zoom out the value axis"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid ${inputBorder}` }}
              >
                <ZoomOut size={12} />
              </button>
              <button
                type="button"
                onClick={handleYZoomIn}
                disabled={isYMaxZoom}
                title="Zoom in the value axis (magnify the OI scale)"
                className="px-2 py-1 text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ color: 'var(--color-text-secondary)', borderLeft: `1px solid ${inputBorder}` }}
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
              style={{ borderColor: inputBorder, backgroundColor: inputBg, color: 'var(--color-text-secondary)' }}
            >
              <RotateCcw size={12} />
            </button>
          </div>
          <div className="flex items-center gap-3 mr-8">
            <ExpirationMultiSelect
              options={expirationOptions}
              selected={selectedExpirations}
              onChange={setSelection}
            />
            <div className="inline-flex rounded border" style={{ borderColor: inputBorder, backgroundColor: inputBg }}>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-semibold"
                style={{
                  color: displayMode === 'oi' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: displayMode === 'oi' ? 'var(--color-info-soft)' : 'transparent',
                }}
                onClick={() => setDisplayMode('oi')}
                title="Open interest (contracts outstanding)"
              >
                OI
              </button>
              <button
                type="button"
                className="px-2.5 py-1 text-xs font-semibold"
                style={{
                  color: displayMode === 'notional' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  backgroundColor: displayMode === 'notional' ? 'var(--color-info-soft)' : 'transparent',
                  borderLeft: `1px solid ${inputBorder}`,
                }}
                onClick={() => setDisplayMode('notional')}
                title="Notional value of position (strike × 100 × OI) — dollars of underlying that would change hands at exercise"
              >
                Notional
              </button>
            </div>
          </div>
        </div>

        {!chartData.length ? (
          <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--text-secondary)' }}>
            No open-interest data available for the selected expiration.
          </div>
        ) : (
          <ResponsiveChartArea mobileHeight={290} desktopHeight={340}>
            {(chartHeight) => (
            <div className="flex items-start gap-1.5">
              {/* Value (Y) scrollbar — padded to line up with the plot band. */}
              <div
                className="shrink-0"
                style={{ height: chartHeight, paddingTop: PLOT_INSET_TOP, paddingBottom: PLOT_INSET_BOTTOM }}
              >
                <ValueRangeScrollbar visibleNorm={yView} onChange={setYView} />
              </div>
              <div className="flex-1 min-w-0">
            <MobileScrollableChart>
              <ResponsiveContainer width="100%" height={chartHeight}>
              <ComposedChart data={chartData} stackOffset="sign" margin={{ top: 8, right: 12, left: 24, bottom: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--color-grid-line)" strokeWidth={1} />
                <XAxis dataKey="strike" type="number" domain={visibleDomain ?? ['dataMin', 'dataMax']} allowDataOverflow ticks={xTicks} padding={{ left: 20, right: 20 }} stroke={axisStroke} tick={{ fontSize: 11, fill: axisStroke }} tickFormatter={(v) => Math.round(Number(v)).toString()} minTickGap={22} />
                <YAxis
                  yAxisId="value"
                  domain={yDomain}
                  ticks={yTicks}
                  allowDataOverflow
                  stroke={axisStroke}
                  tick={{ fontSize: 11, fill: axisStroke }}
                  // Puts are stored negative (below the axis); show magnitudes on
                  // both sides so the mirror reads "500k … 0 … 500k".
                  tickFormatter={(v) => formatAxisValue(Math.abs(Number(v)), displayMode)}
                  label={{
                    value:
                      displayMode === 'oi'
                        ? 'Open Interest (contracts)'
                        : 'Notional ($ at exercise)',
                    angle: -90,
                    position: 'insideLeft',
                    offset: 8,
                    style: { fill: axisStroke, fontSize: 11, textAnchor: 'middle' },
                  }}
                />
                <Tooltip content={<WallMapTooltip mode={displayMode} stackExpirations={stackExpirations} isSubset={isSubset} dteLabel={dteLabel} />} />
                <Legend verticalAlign="top" align="right" content={renderLegend} wrapperStyle={{ top: 0, right: 0 }} />
                {/* Zero baseline for the mirror layout (calls up, puts down). */}
                <ReferenceLine yAxisId="value" y={0} stroke={axisStroke} opacity={0.4} />
                {/* Per-strike bars, stacked by expiration on one signed stack
                    (calls up, puts down). A <Bar> is emitted for EVERY
                    expiration (0 when not shown) so the set is constant and the
                    DTE order stays pinned nearest-at-baseline (Recharts stacks
                    series[0] at the baseline in registration = mount = JSX
                    order, never re-sorted). The axis scales to the SELECTED
                    aggregate so a subset fills the panel. Falls back to a plain
                    aggregate bar when there's no per-expiration OI. */}
                {allExpirationsSorted.map((exp) => (
                  <Bar
                    key={`call-${exp}`}
                    yAxisId="value"
                    stackId="oi"
                    dataKey={`call__${exp}`}
                    name={`Call ${modeLabel(displayMode)} ${dteLabel(exp)}`}
                    fill={'var(--color-bull)'}
                    fillOpacity={expirationOpacity.get(exp) ?? 1}
                    barSize={14}
                    isAnimationActive={false}
                  />
                ))}
                {allExpirationsSorted.map((exp) => (
                  <Bar
                    key={`put-${exp}`}
                    yAxisId="value"
                    stackId="oi"
                    dataKey={`put__${exp}`}
                    name={`Put ${modeLabel(displayMode)} ${dteLabel(exp)}`}
                    fill={'var(--color-bear)'}
                    fillOpacity={expirationOpacity.get(exp) ?? 1}
                    barSize={14}
                    isAnimationActive={false}
                  />
                ))}
                {allExpirationsSorted.length === 0 && (
                  <Bar yAxisId="value" stackId="oi" dataKey="callValue" name={`Call ${modeLabel(displayMode)}`} fill={'var(--color-bull)'} barSize={14} isAnimationActive={false} />
                )}
                {allExpirationsSorted.length === 0 && (
                  <Bar yAxisId="value" stackId="oi" dataKey="putValue" name={`Put ${modeLabel(displayMode)}`} fill={'var(--color-bear)'} barSize={14} isAnimationActive={false} />
                )}

                {closestStrike != null && (
                  <ReferenceLine yAxisId="value" x={closestStrike} stroke="var(--color-gold)" strokeDasharray="4 4" label={{ value: `Spot ${spot.toFixed(2)}`, fill: 'var(--color-gold)', position: 'top', fontSize: 11 }} />
                )}
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
