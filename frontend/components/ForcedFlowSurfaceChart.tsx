'use client';

import { Info } from 'lucide-react';
import TooltipWrapper from './TooltipWrapper';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@/core/ThemeContext';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useForcedFlowSurface } from '@/hooks/useApiData';
import ChartCaption from "./ChartCaption";

interface ForcedFlowSurfaceChartProps {
  symbol?: string;
  spotRangePct?: number;
}

const PAD_L = 60;
// PAD_R reserves room for the colour-bar (14px) + its "$X" / "0" / "-$X"
// labels (~66px) and a ~22px gap to the plot.
const PAD_R = 104;
const PAD_T = 20;
const PAD_B = 44;

type RGB = { r: number; g: number; b: number };

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
// −1 -> sell hue (bear), 0 -> neutral midpoint. Mirrors FlipSurfaceChart's
// divergingColor, parameterised by the live theme hues.
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

// A "nice" axis step (1 / 2 / 5 x 10^n) near `raw`, so price ticks land on round
// numbers and always fit inside the view span. (The old code hard-coded a 2.5%
// step, which exceeded the ±2% span and produced a single tick.)
function niceStep(raw: number): number {
  if (!(raw > 0)) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / pow;
  const nice = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
  return nice * pow;
}

export default function ForcedFlowSurfaceChart({
  symbol = 'SPY',
  spotRangePct = 0.02,
}: ForcedFlowSurfaceChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const chart = useChartTheme();
  const { data: surface, loading, error } = useForcedFlowSurface(symbol, spotRangePct, 15000);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 440 });
  const [hover, setHover] = useState<{ price: number; timeDays: number; value: number } | null>(null);

  const hasData =
    surface != null &&
    Array.isArray(surface.z) &&
    surface.z.length > 0 &&
    Array.isArray(surface.spots) &&
    surface.spots.length > 0 &&
    Array.isArray(surface.times_days) &&
    surface.times_days.length > 0;
  const containerMounted = hasData && !error;

  // Theme hues resolved once per render; the canvas effect depends on them so a
  // palette/theme flip repaints. Neutral midpoint = card background so zero-flow
  // cells melt into the surface on both light and dark themes.
  const posHue = useMemo(() => parseColor(chart.bull, { r: 27, g: 196, b: 125 }), [chart.bull]);
  const negHue = useMemo(() => parseColor(chart.bear, { r: 255, g: 90, b: 102 }), [chart.bear]);
  const zeroHue = useMemo(
    () => parseColor(chart.bgCard, isDark ? { r: 17, g: 24, b: 33 } : { r: 247, g: 247, b: 247 }),
    [chart.bgCard, isDark],
  );

  // The container only mounts once data lands, so wire up the ResizeObserver
  // when it actually attaches (mirrors FlipSurfaceChart).
  useEffect(() => {
    if (!containerMounted) return;
    const node = containerRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setSize({ w: Math.max(320, rect.width), h: Math.max(320, rect.height) });
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ w: Math.max(320, cr.width), h: Math.max(320, cr.height) });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [containerMounted]);

  // Incremental ("charm") surface: subtract the now-row baseline from every row
  // so the flat, time-invariant gamma ramp cancels out and what remains is the
  // EXTRA forced flow the passing of time creates — the whole point of the y
  // axis. zInc[i][j] = z[i][j] − z[i][0]; the top row (now) is exactly zero
  // (nothing forced yet) and colour builds toward the close.
  const zInc = useMemo<number[][]>(() => {
    if (!surface || !Array.isArray(surface.z)) return [];
    return surface.z.map((row) => {
      const base = Number(row?.[0]);
      const b = Number.isFinite(base) ? base : 0;
      return row.map((v) => (Number.isFinite(v) ? v - b : NaN));
    });
  }, [surface]);

  // Normalise the diverging map by a robust percentile of |zInc| (not the max),
  // so 0DTE-settlement spikes into the close don't crush the near-spot detail.
  const clip = useMemo(() => {
    const flat: number[] = [];
    zInc.forEach((row) => row.forEach((v) => flat.push(v)));
    return Math.max(1, percentileAbs(flat, CLIP_PERCENTILE));
  }, [zInc]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !surface || !hasData) return;

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

    const axisColor = chart.axisText || (isDark ? '#FFF1E6' : '#1E293B');
    const gridColor = chart.gridLine || (isDark ? 'rgba(255,241,230,0.10)' : 'rgba(15,23,42,0.10)');

    ctx.fillStyle = chart.bgCard || (isDark ? '#111821' : '#F7F7F7');
    ctx.fillRect(PAD_L, PAD_T, plotW, plotH);

    const spots = surface.spots;
    const times = surface.times_days;
    const z = surface.z; // raw total flow — used for the magnet ridge
    const zi = zInc; // incremental (charm) flow — what the colour shows
    const T = spots.length; // X (spot) — rows of z
    const S = times.length; // Y (time)  — columns of z
    if (T < 2 || S < 1) return;

    const xMin = spots[0];
    const xMax = spots[T - 1];
    const xRange = Math.max(1e-9, xMax - xMin);
    const xForPrice = (p: number) => PAD_L + plotW * ((p - xMin) / xRange);

    const tMax = Math.max(1e-9, times[S - 1] - times[0]);
    // Off-screen native-resolution heatmap (T×S), bilinearly upscaled. Row 0
    // (top) = now, row S-1 (bottom) = close, since times_days ascends 0→close.
    const off = document.createElement('canvas');
    off.width = T;
    off.height = S;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    const img = offCtx.createImageData(T, S);
    for (let s = 0; s < S; s++) {
      for (let x = 0; x < T; x++) {
        // zi is indexed [spotIndex][timeIndex] = [x][s]; row 0 (now) is zero.
        const v = Number(zi[x]?.[s]);
        const idx = (s * T + x) * 4;
        if (!Number.isFinite(v)) {
          img.data[idx + 3] = 0;
          continue;
        }
        const norm = Math.min(Math.abs(v) / clip, 1);
        const ratio = Math.sign(v) * Math.sqrt(norm);
        const c = divergingColor(ratio, posHue, zeroHue, negHue);
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

    // Spot vertical guide.
    const spot = surface.spot;
    if (Number.isFinite(spot) && spot >= xMin && spot <= xMax) {
      const sx = xForPrice(spot);
      ctx.save();
      // Neutral dashed reference — the magnet ridge (solid, blue) peels off it.
      ctx.strokeStyle = axisColor;
      ctx.globalAlpha = 0.7;
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, PAD_T);
      ctx.lineTo(sx, PAD_T + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = axisColor;
      ctx.font = 'bold 12px ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`Spot ${formatPrice(spot)}`, sx, PAD_T - 4);
      ctx.restore();
    }

    // Y axis — time bands (now → close), labelled by progress into the close.
    ctx.save();
    ctx.fillStyle = axisColor;
    ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const bandH = plotH / S;
    times.forEach((t, j) => {
      const y = PAD_T + bandH * j + bandH / 2;
      const frac = (t - times[0]) / tMax;
      const label = j === 0 ? 'now' : j === S - 1 ? 'close' : `${Math.round(frac * 100)}%`;
      ctx.fillText(label, PAD_L - 8, y);
      if (j > 0) {
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD_L, PAD_T + bandH * j);
        ctx.lineTo(PAD_L + plotW, PAD_T + bandH * j);
        ctx.stroke();
      }
    });

    // X axis — ~6 round-number price ticks across the view, each annotated with
    // its distance from spot in %, so the axis is readable at any span.
    const spotForTicks = Number.isFinite(spot) ? spot : (xMin + xMax) / 2;
    const xStep = niceStep((xMax - xMin) / 6);
    let tickPrice = Math.ceil(xMin / xStep) * xStep;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    while (tickPrice <= xMax) {
      const tx = xForPrice(tickPrice);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx, PAD_T);
      ctx.lineTo(tx, PAD_T + plotH);
      ctx.stroke();
      ctx.fillStyle = axisColor;
      ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.fillText(formatPrice(tickPrice), tx, PAD_T + plotH + 6);
      if (spotForTicks > 0) {
        const pct = (tickPrice / spotForTicks - 1) * 100;
        ctx.save();
        ctx.globalAlpha = 0.6;
        ctx.font = '9px ui-sans-serif, system-ui, -apple-system, sans-serif';
        ctx.fillText(`${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, tx, PAD_T + plotH + 19);
        ctx.restore();
      }
      tickPrice += xStep;
    }
    ctx.restore();

    // Magnet ridge — the zero-flow price traced across each time row. It is the
    // sign flip of the RAW total surface (z), not the incremental colour: at
    // "now" (top) it sits at spot, and if it drifts as the rows descend, that is
    // the clock pulling the magnet toward the close. Solid blue, matching how
    // "The Read" colours the magnet.
    const ridge: Array<{ x: number; y: number } | null> = times.map((_, j) => {
      let best: number | null = null;
      let bestDist = Infinity;
      for (let i = 0; i < T - 1; i++) {
        const y1 = Number(z[i]?.[j]);
        const y2 = Number(z[i + 1]?.[j]);
        if (!Number.isFinite(y1) || !Number.isFinite(y2)) continue;
        let cx: number | null = null;
        if (y1 === 0) cx = spots[i];
        else if (y1 * y2 < 0) cx = spots[i] + (spots[i + 1] - spots[i]) * (-y1) / (y2 - y1);
        if (cx != null) {
          const d = Math.abs(cx - spot);
          if (d < bestDist) {
            bestDist = d;
            best = cx;
          }
        }
      }
      if (best == null || best < xMin || best > xMax) return null;
      return { x: xForPrice(best), y: PAD_T + bandH * j + bandH / 2 };
    });
    ctx.save();
    ctx.strokeStyle = chart.info || '#06B6D4';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let penDown = false;
    ridge.forEach((pt) => {
      if (!pt) {
        penDown = false;
        return;
      }
      if (!penDown) {
        ctx.moveTo(pt.x, pt.y);
        penDown = true;
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    });
    ctx.stroke();
    const magnetEnd = [...ridge].reverse().find((p) => p != null) as
      | { x: number; y: number }
      | undefined;
    if (magnetEnd) {
      const rightHalf = magnetEnd.x > PAD_L + plotW / 2;
      ctx.fillStyle = chart.info || '#06B6D4';
      ctx.font = 'bold 10px ui-sans-serif, system-ui, -apple-system, sans-serif';
      ctx.textAlign = rightHalf ? 'right' : 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText('magnet', magnetEnd.x + (rightHalf ? -4 : 4), magnetEnd.y - 3);
    }
    ctx.restore();

    // Axis titles.
    ctx.save();
    ctx.fillStyle = axisColor;
    ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Spot price (USD)', PAD_L + plotW / 2, cssH - 4);
    ctx.translate(16, PAD_T + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Time into close ↓', 0, 0);
    ctx.restore();

    // Diverging colour bar. Top = +clip (dealers buy / bull), bottom = −clip
    // (dealers sell / bear), neutral midpoint at 0.
    const legendX = PAD_L + plotW + 22;
    const legendW = 14;
    const legendY = PAD_T + 8;
    const legendH = plotH - 16;
    const steps = 80;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const ratio = 1 - 2 * t; // top +1, bottom −1
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
  }, [surface, zInc, size, isDark, clip, hasData, posHue, negHue, zeroHue, chart.axisText, chart.gridLine, chart.bgCard, chart.info]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!surface || !hasData) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const plotW = size.w - PAD_L - PAD_R;
    const plotH = size.h - PAD_T - PAD_B;
    if (x < PAD_L || x > PAD_L + plotW || y < PAD_T || y > PAD_T + plotH) {
      setHover(null);
      return;
    }
    const spots = surface.spots;
    const times = surface.times_days;
    const price = spots[0] + ((x - PAD_L) / plotW) * (spots[spots.length - 1] - spots[0]);
    let nearest = 0;
    let bestDist = Infinity;
    for (let i = 0; i < spots.length; i++) {
      const d = Math.abs(spots[i] - price);
      if (d < bestDist) {
        bestDist = d;
        nearest = i;
      }
    }
    const bandIdx = Math.min(
      times.length - 1,
      Math.max(0, Math.floor(((y - PAD_T) / plotH) * times.length)),
    );
    // Match the displayed colour: the incremental (charm) flow — raw total at
    // this cell minus the now-row baseline.
    const raw = surface.z[nearest]?.[bandIdx];
    const base = surface.z[nearest]?.[0];
    const value = Number.isFinite(raw) && Number.isFinite(base) ? (raw as number) - (base as number) : NaN;
    if (!Number.isFinite(value)) {
      setHover(null);
      return;
    }
    setHover({ price: spots[nearest], timeDays: times[bandIdx], value });
  };

  const textColor = 'var(--text-primary)';
  const sessionDays = hasData && surface ? surface.times_days[surface.times_days.length - 1] : 0;

  return (
    <div
      className="rounded-2xl p-6"
      style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${'var(--text-secondary)'}` }}
    >
      <div className="mb-1 flex items-baseline gap-2 flex-wrap">
        <h3 className="zg-h3" style={{ color: textColor }}>
          Forced-Flow Surface · Spot × Time
        </h3>
        <TooltipWrapper text="Colour is the EXTRA forced dealer flow the passing of time creates — charm — at each hypothetical spot (columns) from now (top row) to the 4pm close (bottom row), over and above any spot move. It necessarily starts at zero now and builds into the close: green = the clock forces buying, red = forces selling. Read DOWN a column to watch time-pressure at one price grow into the bell; read ACROSS a row to compare prices at the same moment. The solid blue line is the magnet — the zero-flow price dealers have nothing to do at — and its drift shows where the clock is pulling the tape.">
          <Info size={14} />
        </TooltipWrapper>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {symbol}
        </span>
      </div>
      <p className="mb-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
        The <em>extra</em> dealer flow the clock forces as the session runs — at each hypothetical spot (x),
        from now (top) to the close (bottom).{' '}
        <span style={{ color: chart.bull, fontWeight: 600 }}>Green = time forces BUYING</span>,{' '}
        <span style={{ color: chart.bear, fontWeight: 600 }}>red = SELLING</span>; it starts at zero now and builds
        into the close. The blue line traces the magnet (zero-flow price).
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
        <div ref={containerRef} className="relative w-full" style={{ height: 440 }}>
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHover(null)}
            style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
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
                {sessionDays > 0
                  ? `${Math.round((hover.timeDays / sessionDays) * 100)}% to close`
                  : 'now'}
              </div>
              <div style={{ color: hover.value >= 0 ? chart.bull : chart.bear, fontWeight: 600 }}>
                {hover.value >= 0 ? 'clock buys ' : 'clock sells '}
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
