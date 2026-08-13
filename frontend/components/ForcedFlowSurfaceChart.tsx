'use client';

import { Info } from 'lucide-react';
import TooltipWrapper from './TooltipWrapper';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/core/ThemeContext';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useForcedFlowSessionSurface } from '@/hooks/useApiData';
import ChartCaption from './ChartCaption';

interface ForcedFlowSurfaceChartProps {
  symbol?: string;
  spotRangePct?: number;
}

const PAD_L = 66; // left gutter — price ticks (value + % from spot) live here
// PAD_R reserves room for the colour-bar (14px) + its "$X" / "0" / "-$X"
// labels (~66px) and a ~22px gap to the plot.
const PAD_R = 104;
const PAD_T = 22;
const PAD_B = 46; // bottom gutter — time (now → close) ticks + axis title
const CHART_H = 560; // taller than the old 440 so price (now on y) has room

// Zoom floor: never let a visible axis shrink below this fraction of its full
// data span (prevents zooming into a sliver of one cell).
const MIN_SPAN_FRAC = 0.06;

type RGB = { r: number; g: number; b: number };
type View = { pMin: number; pMax: number; tMin: number; tMax: number };

// Parse a CSS colour string (#hex, #rgb, rgb()/rgba()) — the values
// useChartTheme() reads out of the palette — into an {r,g,b} the canvas colour
// ramp can blend. Falls back to `fallback` if the string is empty (SSR) or
// unparseable, so the heatmap never renders with NaN channels.
function parseColor(input: string | undefined, fallback: RGB): RGB {
  if (!input) return fallback;
  const s = input.trim();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.slice(0, 6);
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if ([r, g, b].every((n) => Number.isFinite(n))) return { r, g, b };
    return fallback;
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((p) => parseFloat(p.trim()));
    if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
      return { r: parts[0], g: parts[1], b: parts[2] };
    }
  }
  return fallback;
}

function blend(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

// Diverging, zero-centred ramp: ratio ∈ [-1, 1]. +1 -> buy hue (bull),
// −1 -> sell hue (bear), 0 -> neutral midpoint.
function divergingColor(ratio: number, pos: RGB, zero: RGB, neg: RGB): RGB {
  if (!Number.isFinite(ratio)) return zero;
  const r = Math.max(-1, Math.min(1, ratio));
  if (r >= 0) return blend(zero, pos, r);
  return blend(neg, zero, 1 + r);
}

function rgbToCss({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return '--';
  if (value === 0) return '$0';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toFixed(value >= 1000 ? 0 : 2);
}

// A price tick label whose decimals track the tick step, so a zoomed-in axis
// shows finer prices without cluttering a zoomed-out one.
function formatTickPrice(value: number, step: number): string {
  const decimals = step < 1 ? 2 : step < 10 ? 1 : 0;
  return value.toFixed(decimals);
}

// Robust colour-scale ceiling: the Pth percentile of |value| across the grid,
// so the handful of 0DTE-settlement cells that saturate near the close can't
// wash out the near-spot detail the way a raw max does.
const CLIP_PERCENTILE = 0.9;

function percentileAbs(values: number[], p: number): number {
  const abs = values
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.abs(v))
    .sort((a, b) => a - b);
  if (!abs.length) return 1;
  const idx = Math.min(abs.length - 1, Math.max(0, Math.round(p * (abs.length - 1))));
  return abs[idx];
}

// A "nice" axis step (1 / 2 / 5 x 10^n) near `raw`, so ticks land on round
// numbers and always fit inside the view span, at any zoom level.
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const nice = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return nice * pow;
}

// Round a raw minute gap up to a friendly clock step for the time axis.
const MINUTE_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 720];
function niceMinuteStep(raw: number): number {
  for (const s of MINUTE_STEPS) if (raw <= s) return s;
  return 720;
}

// "45m" under an hour, "1h30" / "2h" above — for minutes-to-the-close labels.
function formatMinutes(mins: number): string {
  const m = Math.max(0, Math.round(mins));
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm ? `${h}h${mm}` : `${h}h`;
  }
  return `${m}m`;
}

// --------------------------------------------------------------------------- //
// Viewport helpers (data-space). A View is {pMin,pMax} price × {tMin,tMax} time;
// zoom/pan/stretch all reduce to these on one axis pair.
// --------------------------------------------------------------------------- //
function clampAxis(
  min: number,
  max: number,
  dMin: number,
  dMax: number,
): [number, number] {
  const dSpan = Math.max(1e-12, dMax - dMin);
  const span = Math.min(Math.max(max - min, dSpan * MIN_SPAN_FRAC), dSpan);
  const c = (min + max) / 2;
  let nMin = c - span / 2;
  let nMax = c + span / 2;
  if (nMin < dMin) { nMax += dMin - nMin; nMin = dMin; }
  if (nMax > dMax) { nMin -= nMax - dMax; nMax = dMax; }
  return [Math.max(dMin, nMin), Math.min(dMax, nMax)];
}

// Zoom one axis by `factor` (>1 = zoom out) keeping `center` under the cursor.
function zoomAxis(
  min: number,
  max: number,
  center: number,
  factor: number,
  dMin: number,
  dMax: number,
): [number, number] {
  const dSpan = Math.max(1e-12, dMax - dMin);
  const cur = Math.max(1e-12, max - min);
  const span = Math.min(Math.max(cur * factor, dSpan * MIN_SPAN_FRAC), dSpan);
  const ratio = Math.min(1, Math.max(0, (center - min) / cur));
  let nMin = center - ratio * span;
  let nMax = nMin + span;
  if (nMin < dMin) { nMax += dMin - nMin; nMin = dMin; }
  if (nMax > dMax) { nMin -= nMax - dMax; nMax = dMax; }
  return [Math.max(dMin, nMin), Math.min(dMax, nMax)];
}

// Position one axis at a given span so that `center` lands at pixel-ratio `ratio`
// across the plot (used by drag-pan and pinch, which anchor a grabbed point).
function placeAxis(
  center: number,
  ratio: number,
  span: number,
  dMin: number,
  dMax: number,
): [number, number] {
  const dSpan = Math.max(1e-12, dMax - dMin);
  const s = Math.min(Math.max(span, dSpan * MIN_SPAN_FRAC), dSpan);
  let nMin = center - ratio * s;
  let nMax = nMin + s;
  if (nMin < dMin) { nMax += dMin - nMin; nMin = dMin; }
  if (nMax > dMax) { nMin -= nMax - dMax; nMax = dMax; }
  return [Math.max(dMin, nMin), Math.min(dMax, nMax)];
}

export default function ForcedFlowSurfaceChart({
  symbol = 'SPY',
  spotRangePct = 0.02,
}: ForcedFlowSurfaceChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const chart = useChartTheme();
  const { data: surface, loading, error } = useForcedFlowSessionSurface(symbol, spotRangePct, 15000);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 900, h: CHART_H });
  const [hover, setHover] = useState<{ price: number; mtc: number; value: number; isNow: boolean } | null>(null);
  const [zoomed, setZoomed] = useState(false);

  // When the instrument changes, clear the "zoomed" affordance. This is the
  // React adjust-state-on-prop-change pattern (runs during render, before paint);
  // the viewport refs themselves are reset in the effect below.
  const [renderedSymbol, setRenderedSymbol] = useState(symbol);
  if (renderedSymbol !== symbol) {
    setRenderedSymbol(symbol);
    setZoomed(false);
  }

  const hasData =
    surface != null &&
    Array.isArray(surface.z) &&
    surface.z.length > 0 &&
    Array.isArray(surface.prices) &&
    surface.prices.length > 0 &&
    Array.isArray(surface.columns) &&
    surface.columns.length > 0;
  const containerMounted = hasData && !error;

  const posHue = useMemo(() => parseColor(chart.bull, { r: 27, g: 196, b: 125 }), [chart.bull]);
  const negHue = useMemo(() => parseColor(chart.bear, { r: 255, g: 90, b: 102 }), [chart.bear]);
  const zeroHue = useMemo(
    () => parseColor(chart.bgCard, isDark ? { r: 17, g: 24, b: 33 } : { r: 247, g: 247, b: 247 }),
    [chart.bgCard, isDark],
  );

  // Robust colour-scale ceiling from the TOTAL forced-flow field: the 90th
  // percentile of |z| across every finite cell, so the handful of
  // settlement-saturated cells near the close can't wash out the near-spot
  // detail the way a raw max would.
  const clip = useMemo(() => {
    const flat: number[] = [];
    if (surface && Array.isArray(surface.z)) {
      for (const col of surface.z) {
        if (!Array.isArray(col)) continue;
        for (const v of col) if (Number.isFinite(v)) flat.push(v as number);
      }
    }
    return Math.max(1, percentileAbs(flat, CLIP_PERCENTILE));
  }, [surface]);

  // --- Viewport + gesture state (refs, so handlers never fight React state) ---
  const viewRef = useRef<View | null>(null); // null = full data bounds
  const boundsRef = useRef<View | null>(null);
  const zoomedRef = useRef(false);
  const drawRef = useRef<() => void>(() => {});
  const rafRef = useRef(0);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gesture = useRef<{
    mode: 'none' | 'pan' | 'scaleX' | 'scaleY' | 'pinch';
    startX: number;
    startY: number;
    startView: View;
    centerT: number;
    centerP: number;
    startDist: number;
    startMidX: number;
    startMidY: number;
  }>({ mode: 'none', startX: 0, startY: 0, startView: { pMin: 0, pMax: 0, tMin: 0, tMax: 0 }, centerT: 0, centerP: 0, startDist: 0, startMidX: 0, startMidY: 0 });

  const plotMetrics = useCallback(() => {
    const plotW = Math.max(10, size.w - PAD_L - PAD_R);
    const plotH = Math.max(10, size.h - PAD_T - PAD_B);
    return { plotW, plotH };
  }, [size]);

  const markZoomed = useCallback(() => {
    if (!zoomedRef.current) {
      zoomedRef.current = true;
      setZoomed(true);
    }
  }, []);

  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawRef.current();
    });
  }, []);

  const resetView = useCallback(() => {
    viewRef.current = null;
    zoomedRef.current = false;
    setZoomed(false);
    setHover(null);
    scheduleDraw();
  }, [scheduleDraw]);

  // ------------------------------------------------------------------------- //
  // Draw — reads the live viewport ref, so it repaints mid-gesture with no
  // React round-trip. X = session time as MINUTES-TO-CLOSE (open on the LEFT,
  // close on the RIGHT), Y = price (high at top).
  // ------------------------------------------------------------------------- //
  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || !surface || !hasData) return;
    const prices = surface.prices;           // ascending price grid (y)
    const columns = surface.columns;         // open→close, min_to_close DESC (x)
    const z = surface.z;                      // z[colIndex][priceIndex], + = BUY
    const T = prices.length;                  // price samples
    const S = columns.length;                 // session columns
    if (T < 2 || S < 1) return;

    const sessionOpen = surface.session_open_min_to_close > 0
      ? surface.session_open_min_to_close
      : Math.max(1e-9, Number(columns[0]?.min_to_close) || 1e-9);
    const nowMtc = Number.isFinite(surface.now_min_to_close) ? surface.now_min_to_close : 0;

    // Full data bounds. Price low→high; time is MINUTES-TO-CLOSE over
    // [0, session_open]: 0 = the close, session_open = the open.
    const bounds: View = { pMin: prices[0], pMax: prices[T - 1], tMin: 0, tMax: sessionOpen };
    boundsRef.current = bounds;
    // Resolve + clamp the live view against the current data bounds (spot drifts
    // intraday, so an absolute-price window can fall slightly out of range).
    let v = viewRef.current ?? { ...bounds };
    const [cpMin, cpMax] = clampAxis(v.pMin, v.pMax, bounds.pMin, bounds.pMax);
    const [ctMin, ctMax] = clampAxis(v.tMin, v.tMax, bounds.tMin, bounds.tMax);
    v = { pMin: cpMin, pMax: cpMax, tMin: ctMin, tMax: ctMax };
    if (viewRef.current) viewRef.current = v;
    const { pMin, pMax, tMin, tMax } = v;

    const dpr = window.devicePixelRatio || 1;
    const cssW = size.w;
    const cssH = size.h;
    cv.width = Math.floor(cssW * dpr);
    cv.height = Math.floor(cssH * dpr);
    cv.style.width = `${cssW}px`;
    cv.style.height = `${cssH}px`;

    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const { plotW, plotH } = plotMetrics();
    const axisColor = chart.axisText || (isDark ? '#FFF1E6' : '#1E293B');
    const gridColor = chart.gridLine || (isDark ? 'rgba(255,241,230,0.10)' : 'rgba(15,23,42,0.10)');

    ctx.fillStyle = chart.bgCard || (isDark ? '#111821' : '#F7F7F7');
    ctx.fillRect(PAD_L, PAD_T, plotW, plotH);

    // Data <-> pixel maps. Time is MINUTES-TO-CLOSE: the OPEN (large mtc) sits
    // at the LEFT edge and the CLOSE (mtc→0) at the RIGHT, so x DECREASES with
    // mtc — a horizontal flip vs. an ordinary increasing axis. Price is vertical
    // with the HIGH price at the top (standard chart).
    const pSpan = Math.max(1e-9, pMax - pMin);
    const tSpan = Math.max(1e-9, tMax - tMin);
    const xForTime = (t: number) => PAD_L + plotW * ((tMax - t) / tSpan);
    const yForPrice = (p: number) => PAD_T + plotH * ((pMax - p) / pSpan);

    // Shared vertical price-cell boundaries (midpoints between adjacent prices),
    // so the heatmap tiles with no seams. Price grid is ascending.
    const priceEdge = (i: number): number => {
      if (i <= 0) return prices[0] - (prices[1] - prices[0]) / 2;
      if (i >= T) return prices[T - 1] + (prices[T - 1] - prices[T - 2]) / 2;
      return (prices[i - 1] + prices[i]) / 2;
    };

    // --- Heatmap: one vertical strip per session column, cell-coloured by the
    // TOTAL forced flow z (green = dealers BUY, red = SELL). Columns sit at
    // their own min_to_close and the past vs future regions can be spaced
    // differently, so each strip runs from the midpoint to its LEFT neighbour to
    // the midpoint to its RIGHT neighbour (no uniform-spacing assumption).
    // Clipped to the plot so a zoomed view crops cleanly. --------------------
    ctx.save();
    ctx.beginPath();
    ctx.rect(PAD_L, PAD_T, plotW, plotH);
    ctx.clip();
    for (let c = 0; c < S; c++) {
      const mtc = Number(columns[c]?.min_to_close);
      if (!Number.isFinite(mtc)) continue;
      const xc = xForTime(mtc);
      const prevMtc = c > 0 ? Number(columns[c - 1].min_to_close) : NaN; // larger mtc → left
      const nextMtc = c < S - 1 ? Number(columns[c + 1].min_to_close) : NaN; // smaller mtc → right
      const xPrev = Number.isFinite(prevMtc) ? xForTime(prevMtc) : null;
      const xNext = Number.isFinite(nextMtc) ? xForTime(nextMtc) : null;
      let xR = xNext != null ? (xc + xNext) / 2 : (xPrev != null ? xc + (xc - xPrev) / 2 : xc + 4);
      let xL = xPrev != null ? (xc + xPrev) / 2 : (xNext != null ? xc - (xR - xc) : xc - 4);
      if (xR < xL) { const tmp = xL; xL = xR; xR = tmp; }
      if (xR < PAD_L || xL > PAD_L + plotW) continue; // wholly off-plot
      const wStrip = xR - xL + 0.75; // slight overlap hides sub-pixel seams
      const zcol = z[c];
      for (let i = 0; i < T; i++) {
        const val = Number(zcol?.[i]);
        if (!Number.isFinite(val)) continue;
        const yTop = yForPrice(priceEdge(i + 1)); // higher price → smaller y
        const yBot = yForPrice(priceEdge(i));
        const norm = Math.min(Math.abs(val) / clip, 1);
        const ratio = Math.sign(val) * Math.sqrt(norm);
        ctx.fillStyle = rgbToCss(divergingColor(ratio, posHue, zeroHue, negHue));
        ctx.fillRect(xL, yTop, wStrip, yBot - yTop + 0.75);
      }
    }
    ctx.restore();

    // --- Projection veil: everything RIGHT of "now" (mtc < now_min_to_close) is
    // a forecast, not realised — mute it with a subtle tint + diagonal hatch so
    // the eye reads the right side as modeled, not actual. -------------------
    const nowX = xForTime(nowMtc);
    const projLeft = Math.max(PAD_L, Math.min(PAD_L + plotW, nowX));
    const projRight = PAD_L + plotW;
    if (projRight - projLeft > 0.5) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(projLeft, PAD_T, projRight - projLeft, plotH);
      ctx.clip();
      ctx.fillStyle = isDark ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.08)';
      ctx.fillRect(projLeft, PAD_T, projRight - projLeft, plotH);
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = projLeft - plotH; x < projRight; x += 8) {
        ctx.moveTo(x, PAD_T + plotH);
        ctx.lineTo(x + plotH, PAD_T);
      }
      ctx.stroke();
      ctx.restore();
      if (projRight - projLeft > 60) {
        ctx.save();
        ctx.fillStyle = axisColor;
        ctx.globalAlpha = 0.7;
        ctx.font = '9px ui-sans-serif, system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('projection →', projLeft + 6, PAD_T + 4);
        ctx.restore();
      }
    }

    // --- Y axis: price ticks (value + % from spot) + horizontal grid. -------
    const spot = surface.spot;
    ctx.save();
    ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textBaseline = 'middle';
    const yStep = niceStep(pSpan / 6);
    for (let p = Math.ceil(pMin / yStep) * yStep; p <= pMax + 1e-6; p += yStep) {
      const py = yForPrice(p);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_L, py);
      ctx.lineTo(PAD_L + plotW, py);
      ctx.stroke();
      ctx.fillStyle = axisColor;
      ctx.textAlign = 'right';
      ctx.fillText(formatTickPrice(p, yStep), PAD_L - 6, py - 5);
      if (Number.isFinite(spot) && spot > 0) {
        const pct = (p / spot - 1) * 100;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.font = '9px ui-sans-serif, system-ui, -apple-system, sans-serif';
        ctx.fillText(`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, PAD_L - 6, py + 6);
        ctx.restore();
      }
    }
    ctx.restore();

    // --- X axis: minutes-to-the-close ticks. t IS min_to_close, so interior
    // ticks are the tick value itself; the two ends read "open" (left) and
    // "close" (right). The moving "now" marker is drawn separately below. -----
    ctx.save();
    ctx.fillStyle = axisColor;
    ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const drawXTick = (t: number, label: string) => {
      const tx = xForTime(t);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, PAD_T);
      ctx.lineTo(tx, PAD_T + plotH);
      ctx.stroke();
      ctx.fillStyle = axisColor;
      ctx.fillText(label, tx, PAD_T + plotH + 6);
    };
    const stepM = niceMinuteStep(Math.max(1e-6, (tMax - tMin) / 7));
    for (let m = Math.ceil(tMin / stepM) * stepM; m <= tMax + 1e-6; m += stepM) {
      if (m <= 0.5 || m >= sessionOpen - 0.5) continue; // the ends get the words
      if (m < tMin - 1e-9 || m > tMax + 1e-9) continue;
      drawXTick(m, formatMinutes(m));
    }
    if (0 >= tMin - 1e-9 && 0 <= tMax + 1e-9) drawXTick(0, 'close');
    if (sessionOpen >= tMin - 1e-9 && sessionOpen <= tMax + 1e-9) drawXTick(sessionOpen, 'open');
    ctx.restore();

    // --- Spot: horizontal dashed reference at the current price. ------------
    if (Number.isFinite(spot) && spot >= pMin && spot <= pMax) {
      const sy2 = yForPrice(spot);
      ctx.save();
      ctx.strokeStyle = axisColor;
      ctx.globalAlpha = 0.7;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(PAD_L, sy2);
      ctx.lineTo(PAD_L + plotW, sy2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = axisColor;
      ctx.font = 'bold 11px ui-sans-serif, system-ui, -apple-system, sans-serif';
      // Anchored at the LEFT (open) end so it never collides with the magnet
      // label, which sits at the RIGHT (close) end.
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Spot ${formatPrice(spot)}`, PAD_L + 6, sy2 - 3);
      ctx.restore();
    }

    // --- Magnet line: the zero-flow "pin" price per session column (blue),
    // drifting up/down as the session runs open→close (left→right). ----------
    ctx.save();
    ctx.strokeStyle = chart.info || '#06B6D4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let magPen = false;
    let lastMag: { x: number; y: number } | null = null;
    for (let c = 0; c < S; c++) {
      const col = columns[c];
      const mag = Number(col?.magnet);
      const mtc = Number(col?.min_to_close);
      if (col?.magnet == null || !Number.isFinite(mag) || !Number.isFinite(mtc)
          || mag < pMin || mag > pMax || mtc < tMin || mtc > tMax) {
        magPen = false;
        continue;
      }
      const pt = { x: xForTime(mtc), y: yForPrice(mag) };
      if (!magPen) { ctx.moveTo(pt.x, pt.y); magPen = true; } else { ctx.lineTo(pt.x, pt.y); }
      lastMag = pt;
    }
    ctx.stroke();
    if (lastMag) {
      const p = lastMag as { x: number; y: number };
      ctx.fillStyle = chart.info || '#06B6D4';
      ctx.font = 'bold 10px ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText('magnet', p.x - 4, p.y - 4);
    }
    ctx.restore();

    // --- Spot path: where price ACTUALLY went, over the PAST columns (amber).
    // A clearly visible realised-price line from the open up to "now". -------
    ctx.save();
    ctx.strokeStyle = chart.warning || '#F59E0B';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    let pastPen = false;
    let lastPast: { x: number; y: number } | null = null;
    for (let c = 0; c < S; c++) {
      const col = columns[c];
      if (!col?.is_past) { pastPen = false; continue; }
      const sp = Number(col.spot);
      const mtc = Number(col.min_to_close);
      if (!Number.isFinite(sp) || !Number.isFinite(mtc)
          || sp < pMin || sp > pMax || mtc < tMin || mtc > tMax) {
        pastPen = false;
        continue;
      }
      const pt = { x: xForTime(mtc), y: yForPrice(sp) };
      if (!pastPen) { ctx.moveTo(pt.x, pt.y); pastPen = true; } else { ctx.lineTo(pt.x, pt.y); }
      lastPast = pt;
    }
    ctx.stroke();
    if (lastPast) {
      const p = lastPast as { x: number; y: number };
      ctx.fillStyle = chart.warning || '#F59E0B';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // --- NOW marker: a distinct vertical line dividing the ACTUAL field (left)
    // from the PROJECTION (right), labelled "now" at the top. ----------------
    if (nowMtc >= tMin - 1e-9 && nowMtc <= tMax + 1e-9) {
      const nx = xForTime(nowMtc);
      ctx.save();
      ctx.strokeStyle = chart.text || axisColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(nx, PAD_T);
      ctx.lineTo(nx, PAD_T + plotH);
      ctx.stroke();
      ctx.fillStyle = chart.text || axisColor;
      ctx.font = 'bold 10px ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('now', nx, PAD_T - 1);
      ctx.restore();
    }

    // --- Axis titles. -------------------------------------------------------
    ctx.save();
    ctx.fillStyle = axisColor;
    ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Minutes to the close →', PAD_L + plotW / 2, cssH - 4);
    ctx.translate(14, PAD_T + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Spot price (USD)', 0, 0);
    ctx.restore();

    // --- Diverging colour bar. Top = +clip (buy), bottom = −clip (sell). ----
    const legendX = PAD_L + plotW + 22;
    const legendW = 14;
    const legendY = PAD_T + 8;
    const legendH = plotH - 16;
    const steps = 80;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const ratio = 1 - 2 * t;
      ctx.fillStyle = rgbToCss(divergingColor(ratio, posHue, zeroHue, negHue));
      ctx.fillRect(legendX, legendY + (legendH * i) / steps, legendW, legendH / steps + 1);
    }
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendW, legendH);
    ctx.fillStyle = axisColor;
    ctx.font = '10px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatCompactUsd(clip), legendX + legendW + 4, legendY + 4);
    ctx.fillText('0', legendX + legendW + 4, legendY + legendH / 2);
    ctx.fillText(formatCompactUsd(-clip), legendX + legendW + 4, legendY + legendH - 4);
    ctx.font = '9px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillText('buy', legendX + legendW + 4, legendY + 18);
    ctx.fillText('sell', legendX + legendW + 4, legendY + legendH - 18);
  }, [surface, clip, size, isDark, posHue, negHue, zeroHue, hasData, plotMetrics,
    chart.axisText, chart.gridLine, chart.bgCard, chart.info, chart.warning, chart.text]);

  // The container only mounts once data lands; wire the ResizeObserver then.
  useEffect(() => {
    if (!containerMounted) return;
    const node = containerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setSize({ w: Math.max(360, rect.width), h: Math.max(360, rect.height || CHART_H) });
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ w: Math.max(360, cr.width), h: Math.max(360, cr.height || CHART_H) });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [containerMounted]);

  // Drop any zoom window when the instrument changes (refs only — no setState —
  // so an old symbol's absolute-price window isn't clamped into the new one).
  useEffect(() => {
    viewRef.current = null;
    zoomedRef.current = false;
  }, [symbol]);

  // Keep the latest draw reachable from imperative gesture handlers, and repaint
  // on any data / size / theme change.
  useEffect(() => {
    drawRef.current = draw;
    draw();
  }, [draw]);

  // ------------------------------------------------------------------------- //
  // Interaction — pointer (mouse + touch), wheel, pinch. Data-space viewport.
  // ------------------------------------------------------------------------- //
  const xy = (e: { clientX: number; clientY: number }) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };

  const regionOf = useCallback((x: number, y: number): 'plot' | 'x' | 'y' | 'out' => {
    const { plotW, plotH } = plotMetrics();
    const inX = x >= PAD_L && x <= PAD_L + plotW;
    const inY = y >= PAD_T && y <= PAD_T + plotH;
    if (inX && inY) return 'plot';
    if (inX && y > PAD_T + plotH) return 'x';
    if (inY && x < PAD_L) return 'y';
    return 'out';
  }, [plotMetrics]);

  const viewOrBounds = useCallback(
    (): View => viewRef.current ?? boundsRef.current ?? { pMin: 0, pMax: 1, tMin: 0, tMax: 1 },
    [],
  );

  const timeAtX = useCallback((x: number, v: View) => {
    const { plotW } = plotMetrics();
    // t is MINUTES-TO-CLOSE with the axis visually flipped (open on the LEFT),
    // so screen-x increases as mtc DECREASES — invert accordingly. Kept as the
    // exact inverse of draw()'s xForTime so every gesture stays anchored.
    return v.tMax - ((x - PAD_L) / plotW) * (v.tMax - v.tMin);
  }, [plotMetrics]);
  const priceAtY = useCallback((y: number, v: View) => {
    const { plotH } = plotMetrics();
    return v.pMax - ((y - PAD_T) / plotH) * (v.pMax - v.pMin);
  }, [plotMetrics]);

  const applyZoom = useCallback((x: number, y: number, factor: number, axis: 'both' | 'x' | 'y') => {
    const b = boundsRef.current;
    if (!b) return;
    const v = { ...viewOrBounds() };
    if (axis === 'x' || axis === 'both') {
      const [tMin, tMax] = zoomAxis(v.tMin, v.tMax, timeAtX(x, v), factor, b.tMin, b.tMax);
      v.tMin = tMin; v.tMax = tMax;
    }
    if (axis === 'y' || axis === 'both') {
      const [pMin, pMax] = zoomAxis(v.pMin, v.pMax, priceAtY(y, v), factor, b.pMin, b.pMax);
      v.pMin = pMin; v.pMax = pMax;
    }
    viewRef.current = v;
    markZoomed();
    scheduleDraw();
  }, [markZoomed, scheduleDraw, timeAtX, priceAtY, viewOrBounds]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!hasData) return;
    e.preventDefault();
    const { x, y } = xy(e);
    const region = regionOf(x, y);
    if (region === 'out') return;
    const factor = e.deltaY > 0 ? 1.1 : 1 / 1.1; // scroll up = zoom in
    const axis = region === 'x' ? 'x' : region === 'y' ? 'y' : 'both';
    applyZoom(x, y, factor, axis);
  }, [hasData, regionOf, applyZoom]);

  // Wheel must be a non-passive native listener to preventDefault the page scroll.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !containerMounted) return;
    cv.addEventListener('wheel', handleWheel, { passive: false });
    return () => cv.removeEventListener('wheel', handleWheel);
  }, [handleWheel, containerMounted]);

  const setCursor = (c: string) => {
    if (canvasRef.current) canvasRef.current.style.cursor = c;
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!hasData) return;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const { x, y } = xy(e);
    pointers.current.set(e.pointerId, { x, y });
    const v = { ...viewOrBounds() };
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      gesture.current = {
        mode: 'pinch',
        startX: 0, startY: 0,
        startView: v,
        centerT: 0, centerP: 0,
        startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1,
        startMidX: (pts[0].x + pts[1].x) / 2,
        startMidY: (pts[0].y + pts[1].y) / 2,
      };
      gesture.current.centerT = timeAtX(gesture.current.startMidX, v);
      gesture.current.centerP = priceAtY(gesture.current.startMidY, v);
      setHover(null);
      return;
    }
    const region = regionOf(x, y);
    const mode = region === 'x' ? 'scaleX' : region === 'y' ? 'scaleY' : region === 'plot' ? 'pan' : 'none';
    gesture.current = {
      mode,
      startX: x, startY: y,
      startView: v,
      centerT: timeAtX(x, v),
      centerP: priceAtY(y, v),
      startDist: 0, startMidX: 0, startMidY: 0,
    };
    if (mode === 'pan') setCursor('grabbing');
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!hasData) return;
    const { x, y } = xy(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x, y });
    const g = gesture.current;
    const b = boundsRef.current;

    // Idle hover (no active gesture): update the read-out + cursor affordance.
    if (g.mode === 'none') {
      const region = regionOf(x, y);
      setCursor(region === 'plot' ? 'grab' : region === 'x' ? 'ew-resize' : region === 'y' ? 'ns-resize' : 'default');
      if (region !== 'plot' || !surface) { setHover(null); return; }
      const v = viewOrBounds();
      const price = priceAtY(y, v);
      const mtc = timeAtX(x, v);
      let ni = 0, nd = Infinity;
      for (let i = 0; i < surface.prices.length; i++) {
        const d = Math.abs(surface.prices[i] - price);
        if (d < nd) { nd = d; ni = i; }
      }
      let nc = 0, cd = Infinity;
      for (let c = 0; c < surface.columns.length; c++) {
        const d = Math.abs(surface.columns[c].min_to_close - mtc);
        if (d < cd) { cd = d; nc = c; }
      }
      const val = Number(surface.z[nc]?.[ni]);
      if (!Number.isFinite(val)) { setHover(null); return; }
      setHover({
        price: surface.prices[ni],
        mtc: surface.columns[nc].min_to_close,
        value: val,
        isNow: nc === surface.now_index,
      });
      return;
    }
    if (!b) return;

    if (g.mode === 'pinch') {
      if (pointers.current.size < 2) return;
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
      const scale = g.startDist / dist; // fingers apart -> scale<1 -> zoom in
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      const { plotW, plotH } = plotMetrics();
      const [tMin, tMax] = placeAxis(
        g.centerT, 1 - (midX - PAD_L) / plotW, (g.startView.tMax - g.startView.tMin) * scale, b.tMin, b.tMax);
      const [pMax2, pMin2] = (() => {
        const [a, c] = placeAxis(
          g.centerP, (midY - PAD_T) / plotH, (g.startView.pMax - g.startView.pMin) * scale, b.pMin, b.pMax);
        return [c, a]; // placeAxis returns [min,max]; price ratio is top-down
      })();
      viewRef.current = { tMin, tMax, pMin: Math.min(pMin2, pMax2), pMax: Math.max(pMin2, pMax2) };
      markZoomed();
      scheduleDraw();
      return;
    }

    if (g.mode === 'pan') {
      const { plotW, plotH } = plotMetrics();
      const dx = x - g.startX;
      const dy = y - g.startY;
      const tSpan = g.startView.tMax - g.startView.tMin;
      const pSpan = g.startView.pMax - g.startView.pMin;
      const [tMin, tMax] = (() => {
        // Axis is visually flipped (open on the LEFT), so a drag to the RIGHT
        // reveals EARLIER (larger-mtc) data — the opposite pixel-sign of a
        // normal increasing axis.
        let nMin = g.startView.tMin + (dx / plotW) * tSpan;
        let nMax = g.startView.tMax + (dx / plotW) * tSpan;
        if (nMin < b.tMin) { nMax += b.tMin - nMin; nMin = b.tMin; }
        if (nMax > b.tMax) { nMin -= nMax - b.tMax; nMax = b.tMax; }
        return [Math.max(b.tMin, nMin), Math.min(b.tMax, nMax)];
      })();
      const [pMin, pMax] = (() => {
        let nMin = g.startView.pMin + (dy / plotH) * pSpan;
        let nMax = g.startView.pMax + (dy / plotH) * pSpan;
        if (nMin < b.pMin) { nMax += b.pMin - nMin; nMin = b.pMin; }
        if (nMax > b.pMax) { nMin -= nMax - b.pMax; nMax = b.pMax; }
        return [Math.max(b.pMin, nMin), Math.min(b.pMax, nMax)];
      })();
      viewRef.current = { tMin, tMax, pMin, pMax };
      markZoomed();
      scheduleDraw();
      return;
    }

    if (g.mode === 'scaleX') {
      const dx = x - g.startX;
      const factor = Math.exp(-dx * 0.006); // drag right = zoom in
      const [tMin, tMax] = zoomAxis(g.startView.tMin, g.startView.tMax, g.centerT, factor, b.tMin, b.tMax);
      viewRef.current = { ...viewOrBounds(), tMin, tMax };
      markZoomed();
      scheduleDraw();
      return;
    }

    if (g.mode === 'scaleY') {
      const dy = y - g.startY;
      const factor = Math.exp(dy * 0.006); // drag down = zoom out
      const [pMin, pMax] = zoomAxis(g.startView.pMin, g.startView.pMax, g.centerP, factor, b.pMin, b.pMax);
      viewRef.current = { ...viewOrBounds(), pMin, pMax };
      markZoomed();
      scheduleDraw();
    }
  };

  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    canvasRef.current?.releasePointerCapture?.(e.pointerId);
    if (pointers.current.size === 0) {
      gesture.current.mode = 'none';
      setCursor('grab');
    } else if (pointers.current.size === 1 && gesture.current.mode === 'pinch') {
      // Drop back to a single-pointer pan from the remaining finger.
      const [only] = [...pointers.current.entries()];
      const v = { ...viewOrBounds() };
      gesture.current = {
        mode: 'pan', startX: only[1].x, startY: only[1].y, startView: v,
        centerT: timeAtX(only[1].x, v), centerP: priceAtY(only[1].y, v),
        startDist: 0, startMidX: 0, startMidY: 0,
      };
    }
  };

  const textColor = 'var(--text-primary)';

  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${'var(--text-secondary)'}` }}
    >
      <div className="mb-1 flex items-baseline gap-2 flex-wrap">
        <h3 className="zg-h3" style={{ color: textColor }}>
          Forced-Flow Field · Full Session
        </h3>
        <TooltipWrapper text="The whole trading session's dealer forced-flow field — price on the vertical axis, time running left→right from the OPEN to the 4pm CLOSE. Colour is the TOTAL forced flow dealers must hedge at each spot: green = forced to BUY, red = forced to SELL. LEFT of the 'now' line is the ACTUAL field the session has already printed; RIGHT of it (shaded) is a PROJECTION into the close. The blue line is the magnet — the zero-flow pin price; the amber line is where price ACTUALLY went; the dashed line is the current spot. Scroll to zoom, drag to pan, drag an axis to stretch just that axis, pinch on touch, double-click to reset.">
          <Info size={14} />
        </TooltipWrapper>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {symbol}
        </span>
        {zoomed && (
          <button
            type="button"
            onClick={resetView}
            className="ml-auto self-center rounded-md px-2 py-1 text-[11px] font-semibold"
            style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--text-secondary)' }}
          >
            Reset view
          </button>
        )}
      </div>
      <p className="mb-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
        The whole session&apos;s dealer forced-flow field, open → close (left→right) at each spot (vertical).{' '}
        <em>Left of <strong>now</strong> is the ACTUAL field; right is a PROJECTION into the close.</em>{' '}
        <span style={{ color: chart.bull, fontWeight: 600 }}>Green = dealers forced to BUY</span>,{' '}
        <span style={{ color: chart.bear, fontWeight: 600 }}>red = SELL</span>. Blue line = the magnet (zero-flow pin);{' '}
        <span style={{ color: chart.warning, fontWeight: 600 }}>amber = where price actually went</span>; dashed = spot.{' '}
        <span style={{ color: 'var(--text-muted)' }}>Scroll / drag to zoom &amp; pan · drag an axis to stretch it · double-click to reset.</span>
      </p>

      {error ? (
        <div className="flex items-center justify-center h-[360px] text-sm" style={{ color: chart.bear }}>
          {error === 'No data available yet'
            ? `No forced-flow surface for ${symbol} yet.`
            : `Failed to load surface: ${error}`}
        </div>
      ) : loading && !surface ? (
        <div className="flex items-center justify-center h-[360px] text-sm" style={{ color: 'var(--text-secondary)' }}>
          Loading surface…
        </div>
      ) : !hasData ? (
        <div className="flex items-center justify-center h-[360px] text-sm" style={{ color: 'var(--text-secondary)' }}>
          No forced-flow surface data available.
        </div>
      ) : (
        <div ref={containerRef} className="relative w-full" style={{ height: CHART_H }}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endPointer}
            onPointerCancel={endPointer}
            onPointerLeave={(e) => {
              if (gesture.current.mode === 'none') setHover(null);
              endPointer(e);
            }}
            onDoubleClick={resetView}
            style={{ display: 'block', width: '100%', height: '100%', cursor: 'grab', touchAction: 'none' }}
          />
          {hover && (
            <div
              style={{
                position: 'absolute',
                top: 8,
                left: PAD_L + 8,
                background: chart.tooltipBg,
                border: `1px solid ${chart.tooltipBorder}`,
                borderRadius: 8,
                padding: '6px 10px',
                color: chart.tooltipText,
                fontSize: 11,
                pointerEvents: 'none',
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
              }}
            >
              <div>
                {formatPrice(hover.price)} ·{' '}
                {hover.isNow ? 'now' : `${formatMinutes(hover.mtc)} to close`}
              </div>
              <div style={{ color: hover.value >= 0 ? chart.bull : chart.bear, fontWeight: 600 }}>
                {hover.value >= 0 ? 'buy ' : 'sell '}
                {formatCompactUsd(Math.abs(hover.value))}
              </div>
            </div>
          )}
        </div>
      )}

      {surface?.timestamp && hasData && (
        <div className="mt-3 text-right text-[11px]" style={{ color: 'var(--text-muted)' }}>
          Snapshot {new Date(surface.timestamp).toLocaleTimeString()}
        </div>
      )}
      <ChartCaption />
    </div>
  );
}
