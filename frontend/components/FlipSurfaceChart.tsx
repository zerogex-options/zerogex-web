'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import { useFlipSurface } from '@/hooks/useApiData';
import { useIsMobile } from '@/hooks/useIsMobile';
import ExpandableCard from './ExpandableCard';
import MobileScrollableChart from './MobileScrollableChart';
import TooltipWrapper from './TooltipWrapper';

interface FlipSurfaceChartProps {
  symbol: string;
  horizons?: number[];
}

const DEFAULT_HORIZONS = [1, 3, 5, 10, 20, 60];

const PAD_L = 56;
// PAD_R reserves room for the colour-bar (14px) plus its "+$X.XX" / "0" /
// "-$X.XX" labels (~70px) and a ~22px gap to the plot.  The wall / spot /
// contour legend now lives in a sidebar outside the canvas, so this is the
// only legend the canvas itself has to budget for.
const PAD_R = 118;
// PAD_T holds three staggered rows of reference-line labels (Put Wall →
// Call Wall → Spot, top to bottom) above the plot.  ~16px per row + a
// small bottom buffer keeps the lowest label from kissing the plot edge.
const PAD_T = 62;
const PAD_B = 44;

// Reference-line label rows.  Each tracks the y-coordinate (with
// textBaseline='bottom') for one type of guide so labels sitting close
// together horizontally never overprint each other.
const LABEL_ROW_PUT = 16;
const LABEL_ROW_CALL = 36;
const LABEL_ROW_SPOT = 56;

type RGB = { r: number; g: number; b: number };

// Diverging-cell colours.  Long-γ stabilising side: deep navy (#2c4875).
// Short-γ destabilising side: magenta (#bc5090).  Centre transitions
// through near-white so the zero contour reads cleanly.
const POSITIVE_HUE: RGB = { r: 44, g: 72, b: 117 };
const ZERO_HUE: RGB = { r: 247, g: 247, b: 247 };
const NEGATIVE_HUE: RGB = { r: 188, g: 80, b: 144 };

// Reference-line colours mirrored from the Strike Profile chart on the
// Dealer Positioning page so the two read as a coherent pair.
const CALL_WALL_COLOR = 'var(--color-bull)';
const PUT_WALL_COLOR = 'var(--color-bear)';
const SPOT_COLOR = '#06B6D4';
const FLIP_COLOR = 'var(--color-warning)';

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
  const [hover, setHover] = useState<{
    horizon: number;
    price: number;
    value: number;
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
    const rect = node.getBoundingClientRect();
    setSize({
      w: Math.max(320, rect.width),
      h: Math.max(320, rect.height),
    });
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.max(320, cr.width);
      const h = Math.max(320, cr.height);
      setSize({ w, h });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [containerMounted]);

  // Clip used for normalising the diverging colour map.  The 97th-percentile
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

    const plotW = Math.max(10, cssW - PAD_L - PAD_R);
    const plotH = Math.max(10, cssH - PAD_T - PAD_B);

    ctx.fillStyle = 'var(--bg-card)';
    ctx.fillRect(PAD_L, PAD_T, plotW, plotH);

    const grid = surface.grid;
    const horizonsList = surface.horizons_days;
    const profiles = surface.profiles;
    if (grid.length < 2 || horizonsList.length === 0) return;

    const gridMin = grid[0];
    const gridMax = grid[grid.length - 1];
    const xRange = Math.max(1e-9, gridMax - gridMin);
    const xForPrice = (p: number) => PAD_L + plotW * ((p - gridMin) / xRange);

    // Horizons rendered as equal-height bands.  Each profile row paints a
    // horizontal strip; the y-centre of each band carries the horizon label.
    const bandHeight = plotH / horizonsList.length;
    const yForBand = (idx: number) => PAD_T + bandHeight * idx;
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
    ctx.drawImage(off, 0, 0, T, S, PAD_L, PAD_T, plotW, plotH);

    // Walls — vertical strike lines colored by type.  Style mirrors the
    // Call/Put Wall reference lines on the Strike Profile chart
    // (bullish/bearish stroke, 2/4 dashed pattern) but with a thicker
    // line and a larger bold label.  Put-wall labels sit on the top
    // stagger row, call-wall labels on the next row down, so they never
    // overprint a Spot or Flip label sitting at a nearby strike.
    (surface.walls ?? []).forEach((wall) => {
      const wx = xForPrice(wall.strike);
      if (wx < PAD_L - 2 || wx > PAD_L + plotW + 2) return;
      const col = wall.type === 'call' ? CALL_WALL_COLOR : PUT_WALL_COLOR;
      const labelPrefix = wall.type === 'call' ? 'Call Wall' : 'Put Wall';
      const labelY = wall.type === 'call' ? LABEL_ROW_CALL : LABEL_ROW_PUT;
      ctx.save();
      ctx.strokeStyle = col;
      ctx.setLineDash([2, 4]);
      ctx.lineWidth = WALL_LINE_WIDTH;
      ctx.beginPath();
      ctx.moveTo(wx, PAD_T);
      ctx.lineTo(wx, PAD_T + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.font = REF_LABEL_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${labelPrefix}: ${wall.strike.toFixed(2)}`, wx, labelY);
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
      ctx.moveTo(sx, PAD_T);
      ctx.lineTo(sx, PAD_T + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = SPOT_COLOR;
      ctx.font = REF_LABEL_FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Spot: ${spot.toFixed(2)}`, sx, LABEL_ROW_SPOT);
      ctx.restore();
    }

    // Zero contour drawn explicitly from the flips array — one point per
    // resolved horizon; unresolved horizons break the polyline.  Style
    // mirrors the Flip reference line on the Strike Profile chart
    // (warning-orange stroke, 4/4 dash) with a thicker line and a larger
    // bold "Flip: XXX.XX" label anchored at the topmost resolved endpoint.
    ctx.save();
    ctx.strokeStyle = FLIP_COLOR;
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
      ctx.fillStyle = FLIP_COLOR;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
    // Label the topmost (shortest-horizon) resolved flip.  Same text style
    // as the wall and spot labels above the plot.
    const topFlip = (surface.flips ?? []).find(
      (f) => f.resolved && f.flip != null && Number.isFinite(f.flip),
    );
    if (topFlip?.flip != null) {
      const ty = yForHorizon(topFlip.horizon_days);
      const tx = ty != null ? xForPrice(topFlip.flip) : null;
      if (ty != null && tx != null) {
        ctx.fillStyle = FLIP_COLOR;
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
      ctx.fillText(formatHorizon(h), PAD_L - 8, y);
      // Band separators
      if (idx > 0) {
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD_L, yForBand(idx));
        ctx.lineTo(PAD_L + plotW, yForBand(idx));
        ctx.stroke();
      }
    });

    // X-axis tick labels — every ~5% of the grid span.
    const spotForTicks = Number.isFinite(spot) ? spot : (gridMin + gridMax) / 2;
    const xStep = spotForTicks * 0.05;
    let tickPrice = Math.ceil(gridMin / xStep) * xStep;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    while (tickPrice <= gridMax) {
      const tx = xForPrice(tickPrice);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, PAD_T);
      ctx.lineTo(tx, PAD_T + plotH);
      ctx.stroke();
      ctx.fillStyle = axisColor;
      ctx.fillText(formatUsd(tickPrice, 0), tx, PAD_T + plotH + 6);
      tickPrice += xStep;
    }
    ctx.restore();

    // Y-axis title.
    ctx.save();
    ctx.fillStyle = axisColor;
    ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(PAD_L - 50, PAD_T + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Horizon', 0, 0);
    ctx.restore();

    // X-axis title.
    ctx.save();
    ctx.fillStyle = axisColor;
    ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Hypothetical spot (USD)', PAD_L + plotW / 2, cssH - 4);
    ctx.restore();

    // Legend / colour bar on the right.
    const legendX = PAD_L + plotW + 22;
    const legendW = 14;
    const legendY = PAD_T + 8;
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
  }, [surface, size, isDark, clip]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!surface) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const plotW = size.w - PAD_L - PAD_R;
    const plotH = size.h - PAD_T - PAD_B;
    if (x < PAD_L || x > PAD_L + plotW || y < PAD_T || y > PAD_T + plotH) {
      setHover(null);
      return;
    }
    const grid = surface.grid;
    const horizonsList = surface.horizons_days;
    const tx = (x - PAD_L) / plotW;
    const price = grid[0] + tx * (grid[grid.length - 1] - grid[0]);
    const bandIdx = Math.min(
      horizonsList.length - 1,
      Math.max(0, Math.floor(((y - PAD_T) / plotH) * horizonsList.length)),
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
    setHover({ horizon, price: grid[nearest], value });
  };

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <div
        className="rounded-2xl p-6 h-full flex flex-col"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: `1px solid ${'var(--text-secondary)'}`,
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="zg-h3" style={{ color: textColor }}>
              HORIZON × PRICE CONTOUR
            </h3>
            <TooltipWrapper text="Signed dealer-GEX surface across hypothetical spot prices (x) and option horizons (y). Blue cells are long-gamma (stabilising), red cells are short-gamma (destabilising). The black line traces the zero crossing — the per-horizon gamma flip. Vertical guides mark current spot (cyan) and the heaviest call/put walls.">
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
          // wider than the available track in order to fit min-content —
          // which would let MobileScrollableChart's mobile-only min-width
          // leak into desktop sizing.  `minmax(0, 1fr)` clamps the min to
          // zero so the column is exactly the available track on desktop
          // even when the canvas is wrapped for mobile horizontal scroll.
          //
          // The canvas container itself gets an explicit pixel height (the
          // flex/h-full chain upstream has no concrete pixel anchor, so a
          // height:100% + minHeight rule was resolving to ~320px from the
          // intrinsic canvas fallback).  Width stays w-full so it expands
          // to fill the now-correctly-sized grid column (or the
          // 900px-min-width inner div on mobile).
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_140px] gap-3 flex-1">
            {/* On mobile the chart keeps a 900px min-width and scrolls
                horizontally inside the card instead of being squashed into
                the ~320px viewport.  md:min-w-0 + md:overflow-visible turns
                the wrapper into a no-op on tablet/desktop so it doesn't
                affect the desktop grid sizing. */}
            <MobileScrollableChart minWidthClass="min-w-[900px]">
              <div
                ref={containerRef}
                className="relative w-full h-full"
                style={{ height: isMobile ? 480 : 720 }}
              >
                <canvas
                  ref={canvasRef}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={() => setHover(null)}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    cursor: 'crosshair',
                  }}
                />
                {hover && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: PAD_L + 8,
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
            </MobileScrollableChart>

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
      </div>
    </ExpandableCard>
  );
}
