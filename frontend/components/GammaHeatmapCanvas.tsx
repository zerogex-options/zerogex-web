'use client';

import { Info } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';
import { omitClosedMarketTimes } from '@/core/utils';
import ChartTimeframeSelect, { type ChartTimeframe } from './ChartTimeframeSelect';

interface GammaDataPoint { timestamp: string; strike: number; net_gex: number; gamma_flip?: number | null; }
interface PriceDataPoint { timestamp: string; open?: number; high?: number; low?: number; close?: number; }
interface GexHistoricalPoint { timestamp: string; gamma_flip?: number | null; }

type RGB = { r: number; g: number; b: number };
const BEARISH: RGB = { r: 44, g: 72, b: 117 };   // negative GEX (cool)
const NEUTRAL: RGB = { r: 255, g: 246, b: 237 }; // zero (warm white)
const BULLISH: RGB = { r: 255, g: 133, b: 49 };  // positive GEX (warm)

const blend = (a: RGB, b: RGB, t: number): RGB => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

// ratio in [-1, 1]
function colorForRatio(ratio: number): RGB {
  if (ratio >= 0) return blend(NEUTRAL, BULLISH, Math.min(1, ratio));
  return blend(BEARISH, NEUTRAL, Math.min(1, 1 + ratio));
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx];
}

// Padding in CSS pixels
const PAD_L = 56;
const PAD_R = 64;
const PAD_T = 36;
const PAD_B = 32;

export default function GammaHeatmapCanvas() {
  const { theme } = useTheme();
  const { getMaxDataPoints, symbol } = useTimeframe();
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('5min');
  const maxPoints = getMaxDataPoints();

  const symParam = `symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`;
  const { data: gexData, loading, error } = useApiData<GammaDataPoint[]>(
    `/api/gex/heatmap?${symParam}&timeframe=${timeframe}&window_units=${maxPoints}`,
    { refreshInterval: 5000 },
  );
  const { data: priceData } = useApiData<PriceDataPoint[]>(
    `/api/market/historical?${symParam}&timeframe=${timeframe}&window_units=${maxPoints}`,
    { refreshInterval: 5000 },
  );
  const { data: gexHistoricalData } = useApiData<GexHistoricalPoint[]>(
    `/api/gex/historical?${symParam}&timeframe=${timeframe}&window_units=${maxPoints}`,
    { refreshInterval: 5000 },
  );

  // Build the dense (time × strike) matrix once per fetch.
  const grid = useMemo(() => {
    const rows = (gexData || []).slice(-5000);
    if (rows.length === 0) return null;

    const timestamps = omitClosedMarketTimes(
      Array.from(new Set(rows.map((r) => r.timestamp))).sort(),
      (ts) => ts,
    ).slice(-maxPoints);
    if (timestamps.length === 0) return null;

    const reportedStrikes = Array.from(new Set(rows.map((r) => Number(r.strike))))
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    if (reportedStrikes.length < 2) return null;

    const minStrike = Math.floor(reportedStrikes[0]);
    const maxStrike = Math.ceil(reportedStrikes[reportedStrikes.length - 1]);
    const stride = maxStrike - minStrike + 1;

    const sparse = new Map<string, number>();
    rows.forEach((r) => {
      sparse.set(`${r.timestamp}|${Number(r.strike)}`, Number(r.net_gex));
    });

    const matrix = new Float32Array(timestamps.length * stride);
    matrix.fill(NaN);

    timestamps.forEach((ts, x) => {
      const known: { strike: number; value: number }[] = [];
      reportedStrikes.forEach((s) => {
        const v = sparse.get(`${ts}|${s}`);
        if (v != null && Number.isFinite(v)) known.push({ strike: s, value: v });
      });
      if (known.length === 0) return;

      // Linear interpolation along the strike axis to fill every integer strike.
      let kIdx = 0;
      for (let s = minStrike; s <= maxStrike; s++) {
        while (kIdx < known.length - 1 && known[kIdx + 1].strike <= s) kIdx++;
        const left = known[kIdx];
        const right = known[Math.min(known.length - 1, kIdx + 1)];
        let v: number;
        if (s <= left.strike) v = left.value;
        else if (s >= right.strike) v = right.value;
        else {
          const span = right.strike - left.strike;
          const t = span > 0 ? (s - left.strike) / span : 0;
          v = left.value + (right.value - left.value) * t;
        }
        matrix[x * stride + (s - minStrike)] = v;
      }
    });

    // Robust color clip so the ATM mega-spike doesn't wash out everything else.
    const finiteAbs: number[] = [];
    for (let i = 0; i < matrix.length; i++) {
      const v = matrix[i];
      if (Number.isFinite(v)) finiteAbs.push(Math.abs(v));
    }
    const clip = Math.max(1, percentile(finiteAbs, 0.98));

    return { timestamps, minStrike, maxStrike, stride, matrix, clip };
  }, [gexData, maxPoints]);

  const gammaFlipByTs = useMemo(() => {
    const fromHeatmap = new Map<string, number[]>();
    (gexData || []).forEach((row) => {
      if (row.gamma_flip == null || !Number.isFinite(Number(row.gamma_flip))) return;
      const arr = fromHeatmap.get(row.timestamp) ?? [];
      arr.push(Number(row.gamma_flip));
      fromHeatmap.set(row.timestamp, arr);
    });
    const result = new Map<string, number>();
    fromHeatmap.forEach((vals, ts) => {
      const avg = vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length);
      result.set(ts, avg);
    });
    if (result.size === 0) {
      (gexHistoricalData || []).forEach((row) => {
        if (row.gamma_flip == null || !Number.isFinite(Number(row.gamma_flip))) return;
        result.set(row.timestamp, Number(row.gamma_flip));
      });
    }
    return result;
  }, [gexData, gexHistoricalData]);

  // Crop the y-axis to ±2% of the underlying price range so the chart reads
  // less flattened. Falls back to the full strike range when price data is missing.
  const bounds = useMemo(() => {
    if (!grid) return null;
    const prices: number[] = [];
    (priceData || []).forEach((p) => {
      [p.high, p.low, p.close, p.open].forEach((v) => {
        const n = Number(v);
        if (Number.isFinite(n)) prices.push(n);
      });
    });
    if (prices.length === 0) {
      return { yMin: grid.minStrike, yMax: grid.maxStrike };
    }
    const priceMin = Math.min(...prices);
    const priceMax = Math.max(...prices);
    const yMin = priceMin * 0.98;
    const yMax = priceMax * 1.02;
    if (yMax - yMin < 1) {
      return { yMin: grid.minStrike, yMax: grid.maxStrike };
    }
    return { yMin, yMax };
  }, [grid, priceData]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 1300, h: 720 });
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      const w = Math.max(320, cr.width);
      const h = Math.max(360, Math.min(820, w * 0.55));
      setSize({ w, h });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !grid || !bounds) return;

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

    const isDark = theme === 'dark';
    const plotW = Math.max(10, cssW - PAD_L - PAD_R);
    const plotH = Math.max(10, cssH - PAD_T - PAD_B);

    ctx.fillStyle = isDark ? colors.cardDark : colors.cardLight;
    ctx.fillRect(PAD_L, PAD_T, plotW, plotH);

    const T = grid.timestamps.length;
    const S = grid.stride;
    const { yMin, yMax } = bounds;
    const yRange = Math.max(1e-9, yMax - yMin);
    const yForStrike = (s: number) => PAD_T + plotH * (1 - (s - yMin) / yRange);

    // Render the (time × strike) value matrix into a small offscreen canvas, then
    // upscale with bilinear smoothing to produce the SpotGamma-style soft heatmap.
    const off = document.createElement('canvas');
    off.width = T;
    off.height = S;
    const offCtx = off.getContext('2d');
    if (!offCtx) return;
    const img = offCtx.createImageData(T, S);

    for (let x = 0; x < T; x++) {
      for (let yStrike = 0; yStrike < S; yStrike++) {
        const v = grid.matrix[x * S + yStrike];
        const py = S - 1 - yStrike; // higher strike → smaller pixel y
        const idx = (py * T + x) * 4;
        if (!Number.isFinite(v)) {
          img.data[idx + 3] = 0;
          continue;
        }
        const norm = Math.min(Math.abs(v) / grid.clip, 1);
        const ratio = Math.sign(v) * Math.sqrt(norm);
        const c = colorForRatio(ratio);
        img.data[idx] = c.r;
        img.data[idx + 1] = c.g;
        img.data[idx + 2] = c.b;
        img.data[idx + 3] = 255;
      }
    }
    offCtx.putImageData(img, 0, 0);

    // Map the offscreen image (which only spans [minStrike, maxStrike]) into
    // the visible strike range (yMin..yMax). When the y-axis extends past the
    // available strike data, the heatmap is drawn into a sub-rect of the plot
    // and the rest stays empty.
    const heatmapTop = Math.min(grid.maxStrike, yMax);
    const heatmapBottom = Math.max(grid.minStrike, yMin);
    const sy = grid.maxStrike - heatmapTop;
    const sh = Math.max(0, heatmapTop - heatmapBottom);
    const dy = yForStrike(heatmapTop);
    const dh = Math.max(0, yForStrike(heatmapBottom) - dy);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (sh > 0 && dh > 0) {
      ctx.drawImage(off, 0, sy, T, sh, PAD_L, dy, plotW, dh);
    }

    // Axes
    const axisColor = isDark ? '#FFF1E6' : '#1E293B';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

    ctx.fillStyle = axisColor;
    ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const labelLow = Math.ceil(yMin);
    const labelHigh = Math.floor(yMax);
    const labelSpan = Math.max(1, labelHigh - labelLow);
    const labelStep = Math.max(1, Math.ceil((labelSpan + 1) / 12));
    for (let s = labelLow; s <= labelHigh; s += labelStep) {
      const py = yForStrike(s);
      ctx.fillText(`$${s}`, PAD_L - 6, py);
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD_L, py);
      ctx.lineTo(PAD_L + plotW, py);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const tStep = Math.max(1, Math.ceil(T / 10));
    for (let i = 0; i < T; i += tStep) {
      const px = PAD_L + (i + 0.5) * (plotW / T);
      const ts = grid.timestamps[i];
      const label = new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      ctx.fillText(label, px, PAD_T + plotH + 6);
    }

    // Underlying candlesticks on top of the heatmap.
    if (priceData && priceData.length > 0) {
      const priceByTs = new Map(priceData.map((p) => [p.timestamp, p]));
      const cellW = plotW / T;
      const candleW = Math.max(2, Math.min(8, cellW * 0.42));
      grid.timestamps.forEach((ts, i) => {
        const row = priceByTs.get(ts);
        if (!row) return;
        const open = Number(row.open ?? row.close);
        const close = Number(row.close ?? row.open);
        const high = Number(row.high ?? close);
        const low = Number(row.low ?? close);
        if (!Number.isFinite(open) || !Number.isFinite(close) || !Number.isFinite(high) || !Number.isFinite(low)) return;

        const cx = PAD_L + (i + 0.5) * cellW;
        const yOpen = yForStrike(open);
        const yClose = yForStrike(close);
        const yHigh = yForStrike(high);
        const yLow = yForStrike(low);
        const up = close >= open;
        const c = up ? colors.bullish : colors.bearish;
        const bodyTop = Math.min(yOpen, yClose);
        const bodyBottom = Math.max(yOpen, yClose);
        const bodyH = Math.max(1, bodyBottom - bodyTop);

        ctx.strokeStyle = c;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, yHigh);
        ctx.lineTo(cx, bodyTop);
        ctx.moveTo(cx, bodyBottom);
        ctx.lineTo(cx, yLow);
        ctx.stroke();

        ctx.fillStyle = c;
        ctx.fillRect(cx - candleW / 2, bodyTop, candleW, bodyH);
      });
    }

    // Gamma flip line.
    if (gammaFlipByTs.size > 0) {
      const flipColor = (() => {
        if (typeof window !== 'undefined') {
          const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim();
          if (v) return v;
        }
        return colors.accent;
      })();
      ctx.beginPath();
      let started = false;
      grid.timestamps.forEach((ts, i) => {
        const v = gammaFlipByTs.get(ts);
        if (v == null || !Number.isFinite(v)) return;
        const py = yForStrike(v);
        const px = PAD_L + (i + 0.5) * (plotW / T);
        if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
      });
      ctx.lineWidth = 2.25;
      ctx.strokeStyle = flipColor;
      ctx.stroke();
    }

    // Vertical color legend on the right edge.
    const legendX = PAD_L + plotW + 14;
    const legendW = 14;
    const legendY = PAD_T;
    const legendH = plotH;
    const grad = ctx.createLinearGradient(0, legendY, 0, legendY + legendH);
    const stops = 9;
    for (let i = 0; i <= stops; i++) {
      const ratio = i / stops;
      const r = 1 - 2 * ratio;
      const c = colorForRatio(r);
      grad.addColorStop(ratio, `rgb(${c.r},${c.g},${c.b})`);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(legendX, legendY, legendW, legendH);
    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
    ctx.strokeRect(legendX + 0.5, legendY + 0.5, legendW - 1, legendH - 1);

    const fmt = (v: number) => {
      const abs = Math.abs(v);
      if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
      if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
      if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
      return v.toFixed(0);
    };
    ctx.fillStyle = axisColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${fmt(grid.clip)}`, legendX + legendW + 4, legendY + 4);
    ctx.fillText('0', legendX + legendW + 4, legendY + legendH / 2);
    ctx.fillText(`-${fmt(grid.clip)}`, legendX + legendW + 4, legendY + legendH - 4);

    // Crosshair
    if (hover) {
      const inX = hover.x >= PAD_L && hover.x <= PAD_L + plotW;
      const inY = hover.y >= PAD_T && hover.y <= PAD_T + plotH;
      if (inX && inY) {
        ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(PAD_L, hover.y);
        ctx.lineTo(PAD_L + plotW, hover.y);
        ctx.moveTo(hover.x, PAD_T);
        ctx.lineTo(hover.x, PAD_T + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }, [grid, bounds, priceData, gammaFlipByTs, theme, size, hover]);

  const tooltip = useMemo(() => {
    if (!hover || !grid || !bounds) return null;
    const plotW = Math.max(10, size.w - PAD_L - PAD_R);
    const plotH = Math.max(10, size.h - PAD_T - PAD_B);
    if (hover.x < PAD_L || hover.x > PAD_L + plotW || hover.y < PAD_T || hover.y > PAD_T + plotH) return null;

    const T = grid.timestamps.length;
    const xRatio = (hover.x - PAD_L) / plotW;
    const tIdx = Math.min(T - 1, Math.max(0, Math.floor(xRatio * T)));
    const ts = grid.timestamps[tIdx];

    const yRatio = (hover.y - PAD_T) / plotH;
    const strike = bounds.yMax - yRatio * (bounds.yMax - bounds.yMin);
    const sIdx = Math.round(strike) - grid.minStrike;
    const safeS = Math.min(grid.stride - 1, Math.max(0, sIdx));
    const value = grid.matrix[tIdx * grid.stride + safeS];

    const priceRow = priceData?.find((p) => p.timestamp === ts);
    const gammaFlip = gammaFlipByTs.get(ts);
    return { ts, strike: Math.round(strike), value, priceRow, gammaFlip };
  }, [hover, grid, bounds, priceData, gammaFlipByTs, size]);

  if (loading && !gexData) return <LoadingSpinner size="lg" />;
  if (error) return <ErrorMessage message={error} />;
  if (!grid) {
    return (
      <div className="rounded-lg p-8 text-center" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}>
        <p style={{ color: colors.muted }}>No heatmap data available</p>
      </div>
    );
  }

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div
        className="rounded-lg overflow-hidden"
        style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h3 className="text-xl font-bold" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>
            GEX Heatmap (Smooth)
          </h3>
          <TooltipWrapper text="Canvas-rendered, bilinear-smoothed time-series heatmap of net dealer GEX by strike. The color scale is clipped at the 98th percentile of |GEX| with a signed-sqrt mapping so the ATM peak doesn't wash out the rest of the chain. The y-axis is cropped to ±2% of the underlying price range. Candlesticks show the underlying OHLC and the colored line marks the gamma flip.">
            <Info size={14} />
          </TooltipWrapper>
        </div>

        <ChartTimeframeSelect value={timeframe} onChange={setTimeframe} className="px-4 pt-1 pb-2 flex justify-end" />

        <div ref={containerRef} className="relative w-full px-4 pb-4">
          <canvas
            ref={canvasRef}
            className="block w-full"
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            }}
            onMouseLeave={() => setHover(null)}
          />
          {tooltip && hover && (
            <div
              className="absolute z-10 rounded-lg px-3 py-2 text-xs pointer-events-none"
              style={{
                left: Math.min(size.w - 220, hover.x + 16),
                top: Math.max(0, hover.y - 12),
                backgroundColor: 'var(--color-chart-tooltip-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-chart-tooltip-text)',
                boxShadow: '0 8px 24px var(--color-info-soft)',
              }}
            >
              <div className="font-semibold">{new Date(tooltip.ts).toLocaleString()}</div>
              <div>Strike: ${tooltip.strike}</div>
              <div>
                Net GEX: {Number.isFinite(tooltip.value)
                  ? `${(tooltip.value / 1_000_000).toFixed(2)}M`
                  : '—'}
              </div>
              {tooltip.priceRow && (
                <div>
                  O:{Number(tooltip.priceRow.open ?? tooltip.priceRow.close ?? 0).toFixed(2)}
                  {' '}H:{Number(tooltip.priceRow.high ?? tooltip.priceRow.close ?? 0).toFixed(2)}
                  {' '}L:{Number(tooltip.priceRow.low ?? tooltip.priceRow.close ?? 0).toFixed(2)}
                  {' '}C:{Number(tooltip.priceRow.close ?? tooltip.priceRow.open ?? 0).toFixed(2)}
                </div>
              )}
              {tooltip.gammaFlip != null && Number.isFinite(tooltip.gammaFlip) && (
                <div>Gamma Flip: ${tooltip.gammaFlip.toFixed(2)}</div>
              )}
            </div>
          )}
        </div>
      </div>
    </ExpandableCard>
  );
}
