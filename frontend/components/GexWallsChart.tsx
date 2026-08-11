'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Info, Move, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';
import StrikeRangeScrollbar from './StrikeRangeScrollbar';
import ValueRangeScrollbar from './ValueRangeScrollbar';
import ResponsiveChartArea from './ResponsiveChartArea';
import ExpirationMultiSelect from './ExpirationMultiSelect';
import { useSharedExpirations } from '@/hooks/useSharedExpirations';
import { reconcileExpirations } from '@/core/expirationPersistence';
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
// narrows/widens it and the value scrollbar / pan tool shift it.
const Y_ZOOM_STEP = 1.5;
const Y_ZOOM_MAX = 32;
const Y_FULL_VIEW: [number, number] = [-1, 1];
// Fixed pixel insets between the chart container and the plot area, for
// converting a drag in screen pixels into a domain shift. From the chart's
// layout: left margin 24 + YAxis width ~60 + right margin 12 → 96; top margin
// 8; bottom margin 8 + ~24 x-axis → 32.
const PLOT_INSET_X = 96;
const PLOT_INSET_TOP = 8;
const PLOT_INSET_BOTTOM = 32;

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
  callValue: number;
  putValue: number;
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
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number }>;
  label?: string;
  mode: DisplayMode;
}) {
  if (!active || !payload?.length) return null;
  const unitLabel = modeLabel(mode);
  return (
    <div style={{ background: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '8px 12px', color: 'var(--color-chart-tooltip-text)' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>Strike {label}</div>
      {payload.map((entry, i) => {
        // Puts are stored negative so they render below the axis; the tooltip
        // shows the magnitude (open interest / notional are positive quantities).
        if (entry.dataKey === 'callValue') {
          return <div key={i} style={{ color: 'var(--color-bull)' }}>Call {unitLabel}: {formatTooltipValue(Math.abs(Number(entry.value)), mode)}</div>;
        }
        if (entry.dataKey === 'putValue') {
          return <div key={i} style={{ color: 'var(--color-bear)' }}>Put {unitLabel}: {formatTooltipValue(Math.abs(Number(entry.value)), mode)}</div>;
        }
        return null;
      })}
    </div>
  );
}

export default function GexWallsChart({ openInterestData, spotPrice, byStrikeFallback }: GexWallsChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = 'var(--text-primary)';
  const axisStroke = 'var(--color-text-primary)';
  const gridStroke = isDark ? 'var(--color-text-secondary)' : 'var(--color-border)';
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

  const chartData = useMemo<ChartRow[]>(() => {
    const source = openInterestData || [];
    const selectedSet = new Set(selectedExpirations);
    const filtered =
      selectedExpirations.length === 0
        ? source
        : source.filter((row) => selectedSet.has(String(row.expiration || '')));
    const grouped = new Map<number, ChartRow>();

    filtered.forEach((row) => {
      const strike = asNum(row.strike);
      if (!Number.isFinite(strike) || strike <= 0) return;
      const existing = grouped.get(strike) ?? { strike, strikeLabel: strike.toFixed(0), callValue: 0, putValue: 0 };
      const optionType = String(row.option_type || '').toUpperCase();
      // Per-contract value for this row's display mode.  Notional is
      // strike × multiplier × OI — the dollar value of underlying
      // controlled if exercised at this strike, the standard derivative-
      // industry definition of position size.
      const oi = asNum(row.open_interest);
      const value = displayMode === 'oi' ? oi : oi * 100 * strike;

      if (optionType.startsWith('C')) {
        existing.callValue += value;
      } else if (optionType.startsWith('P')) {
        existing.putValue += value;
      } else {
        const callOi = asNum(row.call_oi);
        const putOi = asNum(row.put_oi);
        if (displayMode === 'oi') {
          existing.callValue += callOi;
          existing.putValue += putOi;
        } else {
          existing.callValue += callOi * 100 * strike;
          existing.putValue += putOi * 100 * strike;
        }
      }
      grouped.set(strike, existing);
    });

    let rows = Array.from(grouped.values());

    if (rows.length === 0 && byStrikeFallback?.length) {
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
      rows = Array.from(grouped.values());
    }

    // Puts render below the x-axis (calls up, puts down) — the mirror layout
    // matching the Gamma Exposure by Strike chart above. Negating here lets a
    // single stacked series center call-up / put-down on each strike.
    return rows
      .map((row) => ({ ...row, putValue: -Math.abs(row.putValue) }))
      .sort((a, b) => a.strike - b.strike);
  }, [openInterestData, selectedExpirations, displayMode, byStrikeFallback]);

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
  // Zoom narrows/widens it; the value scrollbar and pan tool shift it.
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

  // Symmetric value axis carved by the normalized y-window, so zoom/scroll/pan
  // magnify the mirror bars. allowDataOverflow clips out-of-window bars.
  const { yDomain, yTicks } = useMemo(() => {
    let maxAbs = 0;
    chartData.forEach((row) => {
      maxAbs = Math.max(maxAbs, Math.abs(row.callValue), Math.abs(row.putValue));
    });
    const fullMax = roundedMax(maxAbs);
    const [nLo, nHi] = yView;
    const domain: [number, number] = [nLo * fullMax, nHi * fullMax];
    return { yDomain: domain, yTicks: ticksInRange(domain[0], domain[1], 6) };
  }, [chartData, yView]);

  // Grab-and-drag pan tool (transform-based — GPU-composited during the drag,
  // committed to the strike + value window on release), mirroring the Gamma
  // chart. Toggled by the Move button; the scrollbars are the precise option.
  const [panMode, setPanMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    wrap: HTMLElement;
    startX: number;
    startY: number;
    startVis: [number, number];
    startYView: [number, number];
    fullDomain: [number, number];
    plotWidth: number;
    plotHeight: number;
    minDx: number;
    maxDx: number;
    minDy: number;
    maxDy: number;
  } | null>(null);
  const dragPosRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const dragFrameRef = useRef<number | null>(null);

  const beginDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!panMode || !visibleDomain || !fullStrikeDomain) return;
    const container = e.currentTarget;
    const wrap = container.querySelector('[data-pan-transform]');
    if (!(wrap instanceof HTMLElement)) return;
    const rect = container.getBoundingClientRect();
    const plotWidth = Math.max(1, rect.width - PLOT_INSET_X);
    const plotHeight = Math.max(1, rect.height - PLOT_INSET_TOP - PLOT_INSET_BOTTOM);
    const [s, e0] = visibleDomain;
    const xSpan = Math.max(1e-9, e0 - s);
    const [fLo, fHi] = fullStrikeDomain;
    const [lo, hi] = yView;
    const ySpan = Math.max(1e-9, hi - lo);
    dragRef.current = {
      wrap,
      startX: e.clientX,
      startY: e.clientY,
      startVis: visibleDomain,
      startYView: yView,
      fullDomain: fullStrikeDomain,
      plotWidth,
      plotHeight,
      maxDx: ((s - fLo) / xSpan) * plotWidth,
      minDx: -(((fHi - e0) / xSpan) * plotWidth),
      maxDy: ((1 - hi) / ySpan) * plotHeight,
      minDy: -(((1 + lo) / ySpan) * plotHeight),
    };
    dragPosRef.current = { dx: 0, dy: 0 };
    setIsDragging(true);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const st = dragRef.current;
      if (!st) return;
      const dx = Math.max(st.minDx, Math.min(st.maxDx, e.clientX - st.startX));
      const dy = Math.max(st.minDy, Math.min(st.maxDy, e.clientY - st.startY));
      dragPosRef.current = { dx, dy };
      if (dragFrameRef.current == null) {
        dragFrameRef.current = requestAnimationFrame(() => {
          dragFrameRef.current = null;
          const cur = dragRef.current;
          if (cur) cur.wrap.style.transform = `translate(${dragPosRef.current.dx}px, ${dragPosRef.current.dy}px)`;
        });
      }
    };
    const onUp = () => {
      const st = dragRef.current;
      if (!st) return;
      if (dragFrameRef.current != null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      const { dx, dy } = dragPosRef.current;
      const [s0, e0] = st.startVis;
      const xSpan = e0 - s0;
      const xShift = -(dx / st.plotWidth) * xSpan;
      let ns = s0 + xShift;
      let ne = e0 + xShift;
      const [fLo, fHi] = st.fullDomain;
      if (ns < fLo) { ns = fLo; ne = ns + xSpan; }
      if (ne > fHi) { ne = fHi; ns = ne - xSpan; }
      const [lo0, hi0] = st.startYView;
      const ySpan = hi0 - lo0;
      const yShift = (dy / st.plotHeight) * ySpan;
      let nlo = lo0 + yShift;
      let nhi = hi0 + yShift;
      if (nlo < -1) { nlo = -1; nhi = nlo + ySpan; }
      if (nhi > 1) { nhi = 1; nlo = nhi - ySpan; }
      st.wrap.style.transform = '';
      dragRef.current = null;
      setVisibleDomain([ns, ne]);
      setYView([nlo, nhi]);
      setIsDragging(false);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (dragFrameRef.current != null) cancelAnimationFrame(dragFrameRef.current);
    };
  }, []);

  const renderLegend = () => (
    <div className="w-full flex flex-wrap justify-end items-center gap-4 text-xs" style={{ color: textColor }}>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--color-bull)' }} />
        Call {modeLabel(displayMode)}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: 'var(--color-bear)' }} />
        Put {modeLabel(displayMode)}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4" style={{ backgroundColor: 'var(--color-gold)' }} />
        Spot (nearest strike)
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
            <TooltipWrapper inlineInExpanded={false} text="Strike-level open interest by call/put. OI = open contracts outstanding (raw count). Notional = strike × 100 × OI — the dollar value of underlying that would change hands if every contract at this strike were exercised (industry-standard option position notional). Calls plot above the axis, puts below, aligned on each strike. The yellow dotted line marks spot at the nearest strike.">
              <Info size={14} />
            </TooltipWrapper>
            {/* Strike (X) and value (Y) zoom, a shared reset, and the pan tool
                — same set the Gamma chart carries. */}
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
            <button
              type="button"
              onClick={() => setPanMode((v) => !v)}
              aria-pressed={panMode}
              title={panMode ? 'Pan tool on — drag the chart to move it; click to turn off' : 'Pan tool — drag the chart to move it in any direction'}
              className="inline-flex items-center rounded border px-2 py-1 text-xs"
              style={{
                borderColor: panMode ? 'var(--color-info)' : inputBorder,
                backgroundColor: panMode ? 'var(--color-info-soft)' : inputBg,
                color: panMode ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              <Move size={12} />
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
                {/* Clip + drag surface for the pan tool. The inner
                    data-pan-transform layer is translated directly on the DOM
                    during a drag, then reset when the window shift commits. */}
                <div
                  className="select-none"
                  onMouseDown={panMode ? beginDrag : undefined}
                  style={{
                    overflow: isDragging ? 'hidden' : undefined,
                    cursor: panMode ? (isDragging ? 'grabbing' : 'grab') : undefined,
                  }}
                >
                  <div data-pan-transform style={{ willChange: isDragging ? 'transform' : undefined }}>
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
                {/* Hidden while dragging so a stale tooltip doesn't ride along
                    with the transform. */}
                {!isDragging && <Tooltip content={<WallMapTooltip mode={displayMode} />} />}
                <Legend verticalAlign="top" align="right" content={renderLegend} wrapperStyle={{ top: 0, right: 0 }} />
                {/* Zero baseline for the mirror layout (calls up, puts down). */}
                <ReferenceLine yAxisId="value" y={0} stroke={axisStroke} opacity={0.4} />
                {/* Shared stackId centers the call-up / put-down pair on each
                    strike (aligned, not staggered side-by-side). */}
                <Bar yAxisId="value" stackId="oi" dataKey="callValue" name={`Call ${modeLabel(displayMode)}`} fill={'var(--color-bull)'} barSize={14} isAnimationActive={false} />
                <Bar yAxisId="value" stackId="oi" dataKey="putValue" name={`Put ${modeLabel(displayMode)}`} fill={'var(--color-bear)'} barSize={14} isAnimationActive={false} />

                {closestStrike != null && (
                  <ReferenceLine yAxisId="value" x={closestStrike} stroke="var(--color-gold)" strokeDasharray="4 4" label={{ value: `Spot ${spot.toFixed(2)}`, fill: 'var(--color-gold)', position: 'top', fontSize: 11 }} />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </MobileScrollableChart>
                  </div>
                </div>
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
