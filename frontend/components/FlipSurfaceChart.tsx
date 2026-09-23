'use client';

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Info } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import { useFlipSurface } from '@/hooks/useApiData';
import { useIsMobile } from '@/hooks/useIsMobile';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';
import ChartCaption from "./ChartCaption";

interface FlipSurfaceChartProps {
  symbol: string;
  horizons?: number[];
}

const DEFAULT_HORIZONS = [1, 3, 5, 10, 20, 60];

type Pads = { L: number; R: number; T: number; B: number };
const DESKTOP_PADS: Pads = {
  L: 56,
  // R reserves room for the color-bar (14px) plus its "+$X.XX" / "0" /
  // "-$X.XX" labels (~70px) and a ~22px gap to the plot.  The wall / spot /
  // contour legend now lives in a sidebar outside the canvas, so this is the
  // only legend the canvas itself has to budget for.
  R: 118,
  // T holds three staggered rows of reference-line labels (Put Wall →
  // Call Wall → Spot, top to bottom) above the plot.  ~16px per row + a
  // small bottom buffer keeps the lowest label from kissing the plot edge.
  T: 62,
  B: 44,
};
// Narrow (phone) layout. The 118px color-bar gutter and the 62px band of
// staggered 13px level labels left a ~150px plot on a 390px screen; there the
// color scale becomes a bar under the canvas and the level values a row above
// it (both HTML), and the plot takes the width back.
const NARROW_PADS: Pads = { L: 40, R: 10, T: 12, B: 40 };
// A finger held this long before it moves is a crosshair scrub, not a scroll.
const TOUCH_HOLD_MS = 260;

// Reference-line label rows.  Each tracks the y-coordinate (with
// textBaseline='bottom') for one type of guide so labels sitting close
// together horizontally never overprint each other.
const LABEL_ROW_PUT = 16;
const LABEL_ROW_CALL = 36;
const LABEL_ROW_SPOT = 56;

type RGB = { r: number; g: number; b: number };

// Diverging-cell colors.  Long-γ stabilizing side: deep navy (#2c4875).
// Short-γ destabilizing side: magenta (#bc5090).  Center transitions
// through near-white so the zero contour reads cleanly.
const POSITIVE_HUE: RGB = { r: 44, g: 72, b: 117 };
const ZERO_HUE: RGB = { r: 247, g: 247, b: 247 };
const NEGATIVE_HUE: RGB = { r: 188, g: 80, b: 144 };

// Reference-line colors mirrored from the Strike Profile chart on the
// Dealer Positioning page so the two read as a coherent pair.
const CALL_WALL_COLOR = 'var(--color-bull)';
const PUT_WALL_COLOR = 'var(--color-bear)';
const SPOT_COLOR = '#06B6D4';
const FLIP_COLOR = 'var(--color-warning)';

// A canvas cannot resolve CSS custom properties: `ctx.strokeStyle =
// 'var(--color-bull)'` is rejected and the previous style (black) stays, so
// the wall and flip lines drew black. Resolve them against the document at
// draw time instead.
function canvasColor(value: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(value);
  if (!m || typeof document === 'undefined') return value;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || value;
}

// Bigger / bolder typography for the reference-line labels so they pop
// against the navy / magenta gradient cells.
const REF_LABEL_FONT = 'bold 13px ui-sans-serif, system-ui, -apple-system, sans-serif';
// Thicker strokes for the same reason.
const WALL_LINE_WIDTH = 2.25;
const SPOT_LINE_WIDTH = 2.5;
const FLIP_LINE_WIDTH = 3;

function blend(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  };
}

function divergingColor(ratio: number): RGB {
  if (!Number.isFinite(ratio)) return ZERO_HUE;
  const r = Math.max(-1, Math.min(1, ratio));
  if (r >= 0) return blend(ZERO_HUE, POSITIVE_HUE, r);
  return blend(NEGATIVE_HUE, ZERO_HUE, 1 + r);
}

function rgbToCss({ r, g, b }: RGB): string {
  return `rgb(${r}, ${g}, ${b})`;
}

function formatHorizon(days: number): string {
  if (!Number.isFinite(days)) return '';
  if (days < 1) {
    const hours = days * 24;
    return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
  }
  return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
}

function formatUsd(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '--';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function formatGex(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

// Nice 1/2/5 × 10^k price step at or above `raw` — spaces the narrow layout's
// x labels to what fits instead of a fixed 5% of spot (which overprinted).
function nicePriceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / magnitude;
  if (norm <= 1) return magnitude;
  if (norm <= 2) return 2 * magnitude;
  if (norm <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

// CSS gradient matching the canvas color map, short γ (left) → long γ
// (right), for the narrow layout's horizontal color scale.
const SCALE_GRADIENT_CSS = (() => {
  const stops: string[] = [];
  for (let i = 0; i <= 8; i++) {
    const ratio = -1 + (2 * i) / 8;
    stops.push(`${rgbToCss(divergingColor(ratio))} ${(i / 8) * 100}%`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
})();

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

export default function FlipSurfaceChart({
  symbol,
  horizons = DEFAULT_HORIZONS,
}: FlipSurfaceChartProps) {
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const isDark = theme === 'dark';
  const textColor = 'var(--text-primary)';
  const mutedText = isDark ? 'var(--text-secondary)' : 'var(--color-text-secondary)';

  const { data: surface, loading, error } = useFlipSurface(symbol, horizons, { refreshInterval: 7000 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 420 });
  // Narrow (phone) layout — see NARROW_PADS.
  const narrow = isMobile && size.w < 700;
  const pads = narrow ? NARROW_PADS : DESKTOP_PADS;
  // `touch`: put down by a finger; the readout then pins to the top on the
  // side away from the finger (`fx` = the finger's x in the canvas).
  const [hover, setHover] = useState<{
    horizon: number;
    price: number;
    value: number;
    touch?: boolean;
    fx?: number;
  } | null>(null);

  // The chart's container is only rendered once surface data arrives — before
  // that the card shows a loading / error / empty state instead.  The ref is
  // therefore null on the first mount, so the ResizeObserver setup must
  // re-run when the container actually attaches; otherwise the canvas stays
  // pinned to the initial {800, 420} fallback no matter how big the card
  // grows, leaving the chart marooned in the card's top-left quadrant.
  const hasData =
    surface != null && Array.isArray(surface.profiles) && surface.profiles.length > 0;
  const containerMounted = hasData && !error;

  // Track both width and height of the container so the canvas can fill the
  // card body when its sibling card stretches the row (CSS Grid stretch).
  useEffect(() => {
    if (!containerMounted) return;
    const node = containerRef.current;
    if (!node) return;
    // Seed `size` from the freshly-mounted container so the first paint
    // already uses the real layout dimensions instead of the {800, 420}
    // fallback while we wait for the first ResizeObserver callback.
    // (A 260px floor rather than 320: a 360px phone gives the canvas ~296px,
    // and a canvas wider than its card spills past the screen edge.)
    const rect = node.getBoundingClientRect();
    setSize({
      w: Math.max(260, rect.width),
      h: Math.max(320, rect.height),
    });
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.max(260, cr.width);
      const h = Math.max(320, cr.height);
      setSize({ w, h });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [containerMounted]);

  // Clip used for normalizing the diverging color map.  The 97th-percentile
  // bound stops one extreme cell from washing out everything else.
  const clip = useMemo(() => {
    if (!surface) return 1;
    const abs: number[] = [];
    surface.profiles.forEach((row) => row.forEach((v) => {
      if (Number.isFinite(v)) abs.push(Math.abs(v));
    }));
    return Math.max(1, percentile(abs, 0.97));
  }, [surface]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !surface) return;

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

    const plotW = Math.max(10, cssW - pads.L - pads.R);
    const plotH = Math.max(10, cssH - pads.T - pads.B);

    ctx.fillStyle = canvasColor('var(--bg-card)');
    ctx.fillRect(pads.L, pads.T, plotW, plotH);

    const grid = surface.grid;
    const horizonsList = surface.horizons_days;
    const profiles = surface.profiles;
    if (grid.length < 2 || horizonsList.length === 0) return;

    const gridMin = grid[0];
    const gridMax = grid[grid.length - 1];
    const xRange = Math.max(1e-9, gridMax - gridMin);
    const xForPrice = (p: number) => pads.L + plotW * ((p - gridMin) / xRange);

    // Horizons rendered as equal-height bands.  Each profile row paints a
    // horizontal strip; the y-center of each band carries the horizon label.
    const bandHeight = plotH / horizonsList.length;
    const yForBand = (idx: number) => pads.T + bandHeight * idx;
    const yForHorizon = (h: number) => {
      const idx = horizonsList.indexOf(h);
      if (idx < 0) return null;
      return yForBand(idx) + bandHeight / 2;
    };

    // Off-screen heatmap rendered at native (Ngrid × Nhorizons) resolution,
    // then upscaled with bilinear smoothing for a soft contour-like look.
    const T = grid.length;
    const S = horizonsList.length;
    const off = document.createElement('canvas');
    off.width = T;
    off.height = S;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    const img = offCtx.createImageData(T, S);
    for (let s = 0; s < S; s++) {
      const row = profiles[s] ?? [];
      for (let x = 0; x < T; x++) {
        const v = Number(row[x]);
        const idx = (s * T + x) * 4;
        if (!Number.isFinite(v)) {
          img.data[idx + 3] = 0;
          continue;
        }
        const norm = Math.min(Math.abs(v) / clip, 1);
        const ratio = Math.sign(v) * Math.sqrt(norm);
        const c = divergingColor(ratio);
        img.data[idx] = c.r;
        img.data[idx + 1] = c.g;
        img.data[idx + 2] = c.b;
        img.data[idx + 3] = 255;
      }
    }
    offCtx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, T, S, pads.L, pads.T, plotW, plotH);

    // Walls — vertical strike lines colored by type.  Style mirrors the
    // Call/Put Wall reference lines on the Strike Profile chart
    // (bullish/bearish stroke, 2/4 dashed pattern) but with a thicker
    // line and a larger bold label.  Put-wall labels sit on the top
    // stagger row, call-wall labels on the next row down, so they never
    // overprint a Spot or Flip label sitting at a nearby strike.
    (surface.walls ?? []).forEach((wall) => {
      const wx = xForPrice(wall.strike);
      if (wx < pads.L - 2 || wx > pads.L + plotW + 2) return;
      const col = canvasColor(wall.type === 'call' ? CALL_WALL_COLOR : PUT_WALL_COLOR);
      const labelPrefix = wall.type === 'call' ? 'Call Wall' : 'Put Wall';
      const labelY = wall.type === 'call' ? LABEL_ROW_CALL : LABEL_ROW_PUT;
      ctx.save();
      ctx.strokeStyle = col;
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = WALL_LINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(wx, pads.T);
      ctx.lineTo(wx, pads.T + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      // The narrow layout lists the level values in a row above the canvas.
      if (!narrow) {
        ctx.fillStyle = col;
        ctx.font = REF_LABEL_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`${labelPrefix}: ${wall.strike.toFixed(2)}`, wx, labelY);
      }
      ctx.restore();
    });

    // Spot vertical guide.  Style mirrors the Spot reference line on the
    // Strike Profile chart (cyan stroke, 4/4 dash) with a thicker line and
    // a larger bold label.  Label sits on the bottom stagger row so it
    // never overprints a Call/Put Wall label at a nearby strike.
    const spot = surface.spot;
    if (Number.isFinite(spot)) {
      const sx = xForPrice(spot);
      ctx.save();
      ctx.strokeStyle = SPOT_COLOR;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = SPOT_LINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(sx, pads.T);
      ctx.lineTo(sx, pads.T + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      if (!narrow) {
        ctx.fillStyle = SPOT_COLOR;
        ctx.font = REF_LABEL_FONT;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Spot: ${spot.toFixed(2)}`, sx, LABEL_ROW_SPOT);
      }
      ctx.restore();
    }

    // Zero contour drawn explicitly from the flips array — one point per
    // resolved horizon; unresolved horizons break the polyline.  Style
    // mirrors the Flip reference line on the Strike Profile chart
    // (warning-orange stroke, 4/4 dash) with a thicker line and a larger
    // bold "Flip: XXX.XX" label anchored at the topmost resolved endpoint.
    ctx.save();
    ctx.strokeStyle = canvasColor(FLIP_COLOR);
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = FLIP_LINE_WIDTH;
    ctx.beginPath();
    let drawing = false;
    (surface.flips ?? []).forEach((f) => {
      const y = yForHorizon(f.horizon_days);
      if (y == null) return;
      if (!f.resolved || f.flip == null || !Number.isFinite(f.flip)) {
        drawing = false;
        return;
      }
      const x = xForPrice(f.flip);
      if (drawing) {
        ctx.lineTo(x, y);
      } else {
        ctx.moveTo(x, y);
        drawing = true;
      }
    });
    ctx.stroke();
    ctx.setLineDash([]);
    // Endpoints for each resolved flip.
    (surface.flips ?? []).forEach((f) => {
      if (!f.resolved || f.flip == null) return;
      const y = yForHorizon(f.horizon_days);
      if (y == null) return;
      const x = xForPrice(f.flip);
      ctx.fillStyle = canvasColor(FLIP_COLOR);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    // Label the topmost (shortest-horizon) resolved flip.  Same text style
    // as the wall and spot labels above the plot.
    const topFlip = (surface.flips ?? []).find(
      (f) => f.resolved && f.flip != null && Number.isFinite(f.flip),
    );
    if (!narrow && topFlip?.flip != null) {
      const ty = yForHorizon(topFlip.horizon_days);
      const tx = ty != null ? xForPrice(topFlip.flip) : null;
      if (ty != null && tx != null) {
        ctx.fillStyle = canvasColor(FLIP_COLOR);
        ctx.font = REF_LABEL_FONT;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`Flip: ${topFlip.flip.toFixed(2)}`, tx + 8, ty);
      }
    }
    ctx.restore();

    // Axes — Y labels (horizons) and X labels (prices).
    const axisColor = isDark ? '#FFF1E6' : '#1E293B';
    const gridColor = isDark ? 'rgba(255,241,230,0.10)' : 'rgba(15,23,42,0.10)';

    ctx.save();
    ctx.fillStyle = axisColor;
    ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    horizonsList.forEach((h, idx) => {
      const y = yForBand(idx) + bandHeight / 2;
      ctx.fillText(formatHorizon(h), pads.L - 8, y);
      // Band separators
      if (idx > 0) {
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pads.L, yForBand(idx));
        ctx.lineTo(pads.L + plotW, yForBand(idx));
        ctx.stroke();
      }
    });

    // X-axis tick labels — every ~5% of the grid span.
    // Desktop: every 5% of spot. Narrow: a round price step aiming for a
    // label every ~45px, since 5% steps overprinted into one run of digits on
    // a phone.
    const spotForTicks = Number.isFinite(spot) ? spot : (gridMin + gridMax) / 2;
    const xStep = narrow
      ? nicePriceStep((gridMax - gridMin) / Math.max(2, Math.floor(plotW / 45)))
      : spotForTicks * 0.05;
    let tickPrice = Math.ceil(gridMin / xStep) * xStep;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    while (tickPrice <= gridMax) {
      const tx = xForPrice(tickPrice);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, pads.T);
      ctx.lineTo(tx, pads.T + plotH);
      ctx.stroke();
      ctx.fillStyle = axisColor;
      ctx.fillText(formatUsd(tickPrice, 0), tx, pads.T + plotH + 6);
      tickPrice += xStep;
    }
    ctx.restore();

    // Y-axis title (the narrow layout's 40px gutter only fits the ticks).
    if (!narrow) {
      ctx.save();
      ctx.fillStyle = axisColor;
      ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.translate(pads.L - 50, pads.T + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Horizon', 0, 0);
      ctx.restore();
    }

    // X-axis title.
    ctx.save();
    ctx.fillStyle = axisColor;
    ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Hypothetical spot (USD)', pads.L + plotW / 2, cssH - 4);
    ctx.restore();

    // Legend / color bar on the right (the narrow layout's is HTML, below).
    if (narrow) return;
    const legendX = pads.L + plotW + 22;
    const legendW = 14;
    const legendY = pads.T + 8;
    const legendH = plotH - 16;
    const steps = 80;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const ratio = 1 - 2 * t; // top = +1 (long γ), bottom = -1 (short γ)
      const c = divergingColor(ratio);
      ctx.fillStyle = rgbToCss(c);
      ctx.fillRect(legendX, legendY + (legendH * i) / steps, legendW, legendH / steps + 1);
    }
    ctx.strokeStyle = isDark ? 'rgba(255,241,230,0.4)' : 'rgba(15,23,42,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, legendW, legendH);
    ctx.fillStyle = axisColor;
    ctx.font = '10px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // formatGex already emits the sign, so pass +clip / -clip directly
    // instead of prepending another "+"/"-" (which produced "++$X.XX" /
    // "-+$X.XX" at the extremes).
    ctx.fillText(formatGex(clip), legendX + legendW + 4, legendY + 4);
    ctx.fillText('0', legendX + legendW + 4, legendY + legendH / 2);
    ctx.fillText(formatGex(-clip), legendX + legendW + 4, legendY + legendH - 4);
    ctx.font = '9px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.fillText('long γ', legendX + legendW + 4, legendY + 18);
    ctx.fillText('short γ', legendX + legendW + 4, legendY + legendH - 18);
  }, [surface, size, isDark, clip, narrow, pads]);

  // Reads the (horizon, price) cell under a client point — shared by the mouse
  // hover and the touch inspect. A finger's point is clamped into the plot so
  // a touch at its edge still reads the edge cell.
  const inspectAt = (clientX: number, clientY: number, el: HTMLCanvasElement, touch: boolean) => {
    if (!surface) return;
    const rect = el.getBoundingClientRect();
    const plotW = size.w - pads.L - pads.R;
    const plotH = size.h - pads.T - pads.B;
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    if (touch) {
      x = Math.min(pads.L + plotW, Math.max(pads.L, x));
      y = Math.min(pads.T + plotH - 0.5, Math.max(pads.T, y));
    }
    if (x < pads.L || x > pads.L + plotW || y < pads.T || y > pads.T + plotH) {
      setHover(null);
      return;
    }
    const grid = surface.grid;
    const horizonsList = surface.horizons_days;
    const tx = (x - pads.L) / plotW;
    const price = grid[0] + tx * (grid[grid.length - 1] - grid[0]);
    const bandIdx = Math.min(
      horizonsList.length - 1,
      Math.max(0, Math.floor(((y - pads.T) / plotH) * horizonsList.length)),
    );
    const horizon = horizonsList[bandIdx];
    // Nearest grid index for the (h, p) reading.
    let nearest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < grid.length; i++) {
      const d = Math.abs(grid[i] - price);
      if (d < bestDist) {
        bestDist = d;
        nearest = i;
      }
    }
    const value = surface.profiles[bandIdx]?.[nearest];
    if (value == null || !Number.isFinite(value)) {
      setHover(null);
      return;
    }
    setHover(touch ? { horizon, price: grid[nearest], value, touch: true, fx: x } : { horizon, price: grid[nearest], value });
  };

  // Mobile browsers replay a tap as mouse events a moment later; the touch
  // handlers already acted on it, so the mouse path sits out for a beat.
  const lastTouchAtRef = useRef(0);
  const fromRecentTouch = () => Date.now() - lastTouchAtRef.current < 800;

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (fromRecentTouch()) return;
    inspectAt(e.clientX, e.clientY, e.currentTarget, false);
  };

  // ── Touch ── a tap reads the cell under the finger (a tap while a readout
  // is up lifts it); a press-and-hold or a sideways drag scrubs the readout
  // across the surface. A plain vertical swipe still scrolls the page
  // (touch-action: pan-y). Mouse input keeps the hover it always had.
  const touchRef = useRef<{
    id: number;
    mode: 'pending' | 'scrub' | 'scroll';
    startX: number;
    startY: number;
    startAt: number;
    hadHover: boolean;
  } | null>(null);
  // Kept apart from the gesture state, which no effect reads: the pending
  // hold timer and whether the chart has claimed the touch (so the native
  // touchmove listener keeps the page still while a finger scrubs).
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchClaimedRef = useRef(false);
  const clearHold = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };
  useEffect(
    () => () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    },
    [],
  );
  useEffect(() => {
    if (!containerMounted) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const onTouchMove = (e: TouchEvent) => {
      if (touchClaimedRef.current && e.cancelable) e.preventDefault();
    };
    cv.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => cv.removeEventListener('touchmove', onTouchMove);
  }, [containerMounted]);

  const handleTouchDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== 'touch') return;
    lastTouchAtRef.current = Date.now();
    if (touchRef.current) return;
    const el = e.currentTarget;
    touchRef.current = {
      id: e.pointerId,
      mode: 'pending',
      startX: e.clientX,
      startY: e.clientY,
      startAt: Date.now(),
      hadHover: hover != null,
    };
    const x = e.clientX;
    const y = e.clientY;
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      const cur = touchRef.current;
      if (!cur || cur.mode !== 'pending') return;
      cur.mode = 'scrub';
      touchClaimedRef.current = true;
      inspectAt(x, y, el, true);
    }, TOUCH_HOLD_MS);
  };

  const handleTouchMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const t = touchRef.current;
    if (e.pointerType !== 'touch' || !t || t.id !== e.pointerId) return;
    lastTouchAtRef.current = Date.now();
    if (t.mode === 'scrub') {
      inspectAt(e.clientX, e.clientY, e.currentTarget, true);
      return;
    }
    if (t.mode !== 'pending') return;
    const dx = e.clientX - t.startX;
    const dy = e.clientY - t.startY;
    // Held long enough before moving: a scrub, even if the hold timer has not
    // had its turn yet on a busy main thread.
    const held = Date.now() - t.startAt >= TOUCH_HOLD_MS && (Math.abs(dx) > 2 || Math.abs(dy) > 2);
    if (!held && Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
      clearHold();
      t.mode = 'scroll';
      return;
    }
    if (held || Math.abs(dx) > 8) {
      clearHold();
      t.mode = 'scrub';
      touchClaimedRef.current = true;
      inspectAt(e.clientX, e.clientY, e.currentTarget, true);
    }
  };

  const handleTouchEnd = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const t = touchRef.current;
    if (e.pointerType !== 'touch' || !t || t.id !== e.pointerId) return;
    lastTouchAtRef.current = Date.now();
    clearHold();
    if (e.type === 'pointerup' && t.mode === 'pending') {
      if (t.hadHover) setHover(null);
      else inspectAt(e.clientX, e.clientY, e.currentTarget, true);
    }
    touchRef.current = null;
    touchClaimedRef.current = false;
  };

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <div
        className="rounded-2xl p-4 sm:p-6 h-full flex flex-col"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid var(--border-default)`,
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="zg-h3" style={{ color: textColor }}>
              Horizon × Price Contour
            </h3>
            <TooltipWrapper text="Signed dealer-GEX surface across hypothetical spot prices (x) and option horizons (y). Blue cells are long-gamma (stabilizing), red cells are short-gamma (destabilizing). The black line traces the zero crossing — the per-horizon gamma flip. Vertical guides mark current spot (cyan) and the heaviest call/put walls.">
              <Info size={14} />
            </TooltipWrapper>
          </div>
        </div>

        {error ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--color-bear)' }}>
            {error === 'No data available yet'
              ? `No usable option snapshot for ${symbol} — check ingestion.`
              : `Backend error: ${error}`}
          </div>
        ) : loading && !surface ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: mutedText }}>
            Loading surface…
          </div>
        ) : !hasData ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: mutedText }}>
            No surface data available.
          </div>
        ) : (
          // Body: canvas (left) + vertical legend sidebar (right).
          //
          // grid-cols-[minmax(0,1fr)_140px] is critical here.  Plain `1fr`
          // expands to `minmax(auto, 1fr)`, and `auto` lets the column be
          // wider than the available track in order to fit min-content (a
          // sized canvas has one).  `minmax(0, 1fr)` clamps the min to zero
          // so the column is exactly the available track.
          //
          // The canvas container itself gets an explicit pixel height (the
          // flex/h-full chain upstream has no concrete pixel anchor, so a
          // height:100% + minHeight rule was resolving to ~320px from the
          // intrinsic canvas fallback).  Width stays w-full so it expands
          // to fill the grid column.
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_140px] gap-3 flex-1">
            {/* The canvas is drawn at the card's own width on every layout
                (it used to sit at a 900px min-width inside a sideways
                scroller on a phone); see NARROW_PADS for the phone layout,
                whose level values and color scale ride HTML rows around it. */}
            <div className="h-full w-full min-w-0">
              {narrow && surface && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2 text-[11px] tabular-nums">
                  {(surface.walls ?? [])
                    .slice()
                    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'put' ? -1 : 1))
                    .map((wall) => (
                      <span key={`${wall.type}-${wall.strike}`} style={{ color: wall.type === 'call' ? CALL_WALL_COLOR : PUT_WALL_COLOR }}>
                        {wall.type === 'call' ? 'Call Wall' : 'Put Wall'} {wall.strike.toFixed(2)}
                      </span>
                    ))}
                  {Number.isFinite(surface.spot) && (
                    <span style={{ color: SPOT_COLOR }}>Spot {surface.spot.toFixed(2)}</span>
                  )}
                  {(() => {
                    const top = (surface.flips ?? []).find((f) => f.resolved && f.flip != null && Number.isFinite(f.flip));
                    return top?.flip != null ? (
                      <span style={{ color: FLIP_COLOR }}>Flip ({formatHorizon(top.horizon_days)}) {top.flip.toFixed(2)}</span>
                    ) : null;
                  })()}
                </div>
              )}
              <div
                ref={containerRef}
                className="relative w-full h-full"
                style={{ height: isMobile ? 480 : 720 }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => {
                    if (!fromRecentTouch()) setHover(null);
                  }}
                  onPointerDown={handleTouchDown}
                  onPointerMove={handleTouchMove}
                  onPointerUp={handleTouchEnd}
                  onPointerCancel={handleTouchEnd}
                  onContextMenu={(e) => {
                    // A long press is the readout here, not the browser's menu.
                    if (touchRef.current) e.preventDefault();
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    cursor: 'crosshair',
                    // A finger's vertical swipe scrolls the page; taps and
                    // holds are the chart's own (see the touch handlers).
                    touchAction: 'pan-y',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none',
                  }}
                />
                {hover && (
                  <div
                    style={{
                      position: 'absolute',
                      // A finger's readout pins to the side away from it.
                      ...(hover.touch
                        ? (hover.fx ?? 0) > size.w / 2
                          ? { top: 8, left: 8 }
                          : { top: 8, right: 8 }
                        : { top: 8, left: pads.L + 8 }),
                      background: 'var(--color-chart-tooltip-bg)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                      padding: '6px 10px',
                      color: 'var(--color-chart-tooltip-text)',
                      fontSize: 11,
                      pointerEvents: 'none',
                      fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                    }}
                  >
                    <div>{formatHorizon(hover.horizon)} · {formatUsd(hover.price, 0)}</div>
                    <div
                      style={{
                        color: hover.value >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
                        fontWeight: 600,
                      }}
                    >
                      {formatGex(hover.value)} / 1% move
                    </div>
                  </div>
                )}
              </div>
              {narrow && (
                <div className="flex items-center gap-2 mt-2 text-[11px] tabular-nums" style={{ color: mutedText }}>
                  <span>short γ {formatGex(-clip)}</span>
                  <span className="h-2.5 flex-1 rounded-sm" style={{ background: SCALE_GRADIENT_CSS }} aria-hidden />
                  <span>{formatGex(clip)} long γ</span>
                </div>
              )}
            </div>

            {/* Vertical legend sidebar — Call/Put Wall, Spot, Zero contour
                (flip).  Styles mirror the swatches on the Strike Profile
                chart so the two pages read as a pair. */}
            <div
              className="rounded-md border p-3 text-xs flex flex-col gap-2 self-start"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-surface-subtle)',
                color: textColor,
              }}
            >
              <div className="font-semibold uppercase tracking-wider text-[10px]" style={{ color: mutedText }}>
                Legend
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-0.5 w-5 shrink-0"
                  style={{
                    backgroundImage: `repeating-linear-gradient(90deg, ${CALL_WALL_COLOR} 0 2px, transparent 2px 6px)`,
                    height: 2,
                  }}
                />
                <span>Call wall</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-0.5 w-5 shrink-0"
                  style={{
                    backgroundImage: `repeating-linear-gradient(90deg, ${PUT_WALL_COLOR} 0 2px, transparent 2px 6px)`,
                    height: 2,
                  }}
                />
                <span>Put wall</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-0.5 w-5 shrink-0"
                  style={{
                    backgroundImage: `repeating-linear-gradient(90deg, ${SPOT_COLOR} 0 4px, transparent 4px 8px)`,
                    height: 2,
                  }}
                />
                <span>Spot</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-0.5 w-5 shrink-0"
                  style={{
                    backgroundImage: `repeating-linear-gradient(90deg, ${FLIP_COLOR} 0 4px, transparent 4px 8px)`,
                    height: 2,
                  }}
                />
                <span>Zero contour (flip)</span>
              </div>
            </div>
          </div>
        )}

        {surface?.timestamp && (
          <div className="mt-3 text-right text-[11px] shrink-0" style={{ color: mutedText }}>
            Snapshot: {new Date(surface.timestamp).toLocaleTimeString()}
          </div>
        )}
        <ChartCaption />
      </div>
    </ExpandableCard>
  );
}
