'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import { useFlipSurface } from '@/hooks/useApiData';
import ExpandableCard from './ExpandableCard';
import TooltipWrapper from './TooltipWrapper';

interface FlipSurfaceChartProps {
  symbol: string;
  horizons?: number[];
}

const DEFAULT_HORIZONS = [1, 3, 5, 10, 20, 60];

const PAD_L = 68;
const PAD_R = 110;
const PAD_T = 24;
const PAD_B = 44;

type RGB = { r: number; g: number; b: number };

const POSITIVE_HUE: RGB = { r: 37, g: 99, b: 235 };
const ZERO_HUE: RGB = { r: 247, g: 247, b: 247 };
const NEGATIVE_HUE: RGB = { r: 255, g: 77, b: 90 };

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
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;
  const mutedText = isDark ? colors.muted : 'var(--color-text-secondary)';

  const { data: surface, loading, error } = useFlipSurface(symbol, horizons, { refreshInterval: 7000 });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 420 });
  const [hover, setHover] = useState<{
    horizon: number;
    price: number;
    value: number;
  } | null>(null);

  // Track both width and height of the container so the canvas can fill the
  // card body when its sibling card stretches the row (CSS Grid stretch).
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.max(320, cr.width);
      const h = Math.max(320, cr.height);
      setSize({ w, h });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

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

    ctx.fillStyle = isDark ? colors.cardDark : colors.cardLight;
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

    // Walls — vertical strike lines colored by type.
    const callColor = isDark ? '#1BC47D' : '#0E8A55';
    const putColor = isDark ? '#FF8FA1' : '#C2374A';
    (surface.walls ?? []).forEach((wall) => {
      const wx = xForPrice(wall.strike);
      if (wx < PAD_L - 2 || wx > PAD_L + plotW + 2) return;
      const col = wall.type === 'call' ? callColor : putColor;
      ctx.save();
      ctx.strokeStyle = col;
      ctx.setLineDash([4, 3]);
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(wx, PAD_T);
      ctx.lineTo(wx, PAD_T + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.font = '10px ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `${wall.type === 'call' ? 'C' : 'P'} ${Math.round(wall.strike)}`,
        wx,
        PAD_T + 2,
      );
      ctx.restore();
    });

    // Spot vertical guide.
    const spot = surface.spot;
    if (Number.isFinite(spot)) {
      const sx = xForPrice(spot);
      ctx.save();
      ctx.strokeStyle = '#06B6D4';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, PAD_T);
      ctx.lineTo(sx, PAD_T + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#06B6D4';
      ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Spot ${formatUsd(spot, 0)}`, sx, PAD_T + plotH + 32);
      ctx.restore();
    }

    // Zero contour drawn explicitly from the flips array — one point per
    // resolved horizon; unresolved horizons break the polyline.
    const contourColor = isDark ? '#FFF1E6' : '#0F172A';
    ctx.save();
    ctx.strokeStyle = contourColor;
    ctx.lineWidth = 2;
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
    // Endpoints for each resolved flip.
    (surface.flips ?? []).forEach((f) => {
      if (!f.resolved || f.flip == null) return;
      const y = yForHorizon(f.horizon_days);
      if (y == null) return;
      const x = xForPrice(f.flip);
      ctx.fillStyle = contourColor;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
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
    ctx.fillText(`+${formatGex(clip)}`, legendX + legendW + 4, legendY + 4);
    ctx.fillText('0', legendX + legendW + 4, legendY + legendH / 2);
    ctx.fillText(`-${formatGex(clip)}`, legendX + legendW + 4, legendY + legendH - 4);
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

  const hasData =
    surface != null && Array.isArray(surface.profiles) && surface.profiles.length > 0;

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <div
        className="rounded-2xl p-6 h-full flex flex-col"
        style={{
          backgroundColor: isDark ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>
              HORIZON × PRICE CONTOUR
            </h3>
            <TooltipWrapper text="Signed dealer-GEX surface across hypothetical spot prices (x) and option horizons (y). Blue cells are long-gamma (stabilising), red cells are short-gamma (destabilising). The black line traces the zero crossing — the per-horizon gamma flip. Vertical guides mark current spot (cyan) and the heaviest call/put walls.">
              <Info size={14} />
            </TooltipWrapper>
          </div>
        </div>

        {error ? (
          <div className="flex-1 flex items-center justify-center text-sm" style={{ color: colors.bearish }}>
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
          <div
            ref={containerRef}
            className="flex-1"
            style={{ position: 'relative', width: '100%', minHeight: 320 }}
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
        )}

        {/* Wall legend */}
        {hasData && (
          <div
            className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] shrink-0"
            style={{ color: mutedText }}
          >
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: '#1BC47D' }} />
              Call wall
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: '#FF4D5A' }} />
              Put wall
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4"
                style={{
                  backgroundImage: 'repeating-linear-gradient(90deg, #06B6D4 0 4px, transparent 4px 8px)',
                  height: 2,
                }}
              />
              Spot
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4" style={{ backgroundColor: isDark ? '#FFF1E6' : '#0F172A' }} />
              Zero contour (flip)
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
