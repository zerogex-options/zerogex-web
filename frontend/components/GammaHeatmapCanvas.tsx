'use client';

import {
  ChevronDown,
  Clock,
  Info,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApiData, useGEXByStrike } from '@/hooks/useApiData';
import { useMarketHistorical } from '@/hooks/useMarketHistorical';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';
import { omitClosedMarketTimes } from '@/core/utils';

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Compute days-to-expiry from a YYYY-MM-DD expiration string against today in
// ET, anchoring both at UTC noon so timezone offsets can't round tomorrow down
// to 0DTE.
function computeDte(expiryStr: string | null | undefined): number | null {
  if (!expiryStr) return null;
  const m = expiryStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const expUtcNoon = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const tm = todayStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!tm) return null;
  const todayUtcNoon = Date.UTC(Number(tm[1]), Number(tm[2]) - 1, Number(tm[3]), 12);
  return Math.max(0, Math.round((expUtcNoon - todayUtcNoon) / 86400000));
}

const TIMEFRAME_OPTIONS = ['1m', '5m', '15m'] as const;
type ChartTf = (typeof TIMEFRAME_OPTIONS)[number];

function tfToApi(tf: ChartTf): string {
  return tf === '1m' ? '1min' : tf === '5m' ? '5min' : '15min';
}

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4.0;
const ZOOM_STEP = 1.43;

const DEFAULTS = {
  tf: '5m' as ChartTf,
  withPrev: false,
  selectedExpiry: 'all',
  zoomMul: 1.0,
  paused: false,
  showGrid: true,
};

// Padding in CSS pixels
const PAD_L = 56;
const PAD_R = 64;
const PAD_T = 36;
// Extra bottom padding so the time axis labels and the grouped date row fit
// without colliding with the plot area.
const PAD_B = 48;

export default function GammaHeatmapCanvas() {
  const { theme } = useTheme();
  const { getMaxDataPoints, symbol } = useTimeframe();
  const isDark = theme === 'dark';
  const textPrimary = isDark ? colors.light : colors.dark;
  const cardBg = isDark ? colors.cardDark : colors.cardLight;
  const border = colors.muted;
  const subtle = colors.muted;
  const popoverBg = isDark ? '#0f2935' : '#FFFFFF';

  // ── User-controlled view state ──
  const [tf, setTf] = useState<ChartTf>(DEFAULTS.tf);
  const [withPrev, setWithPrev] = useState<boolean>(DEFAULTS.withPrev);
  const [selectedExpiry, setSelectedExpiry] = useState<string>(DEFAULTS.selectedExpiry);
  const [zoomMul, setZoomMul] = useState<number>(DEFAULTS.zoomMul);
  const [paused, setPaused] = useState<boolean>(DEFAULTS.paused);
  const [showGrid, setShowGrid] = useState<boolean>(DEFAULTS.showGrid);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [expiryOpen, setExpiryOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  const resetAll = () => {
    setTf(DEFAULTS.tf);
    setWithPrev(DEFAULTS.withPrev);
    setSelectedExpiry(DEFAULTS.selectedExpiry);
    setZoomMul(DEFAULTS.zoomMul);
    setPaused(DEFAULTS.paused);
    setShowGrid(DEFAULTS.showGrid);
  };

  const expiryRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!expiryOpen && !settingsOpen) return;
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (expiryOpen && !expiryRef.current?.contains(target)) setExpiryOpen(false);
      if (settingsOpen && !settingsRef.current?.contains(target)) setSettingsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [expiryOpen, settingsOpen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  // ── Pause-aware polling intervals — 1s on every hook so the heatmap stays live. ──
  const heatmapInterval = paused ? 0 : 1000;
  const historicalInterval = paused ? 0 : 1000;
  const byStrikeInterval = paused ? 0 : 10000; // only used to source expiration list

  const baseMaxPoints = getMaxDataPoints();
  // With-Prev doubles the time window so the heatmap reaches into the prior session.
  const maxPoints = withPrev ? baseMaxPoints * 2 : baseMaxPoints;
  // Over-fetch so symbols whose data is only available during regular hours
  // (e.g., SPX index) still have enough bars to fill `maxPoints` visible cells
  // after the price-availability filter trims them down. Capped at 300 to
  // match the API's `window_units` ceiling on these endpoints.
  const fetchUnits = Math.min(300, maxPoints * 3);

  const symParam = `symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`;
  const expiryParam = selectedExpiry !== 'all' ? `&expiration=${encodeURIComponent(selectedExpiry)}` : '';
  const apiTf = tfToApi(tf);

  const { data: gexData, loading, error } = useApiData<GammaDataPoint[]>(
    `/api/gex/heatmap?${symParam}&timeframe=${apiTf}&window_units=${fetchUnits}${expiryParam}`,
    { refreshInterval: heatmapInterval },
  );
  const { rows: priceRowsAll } = useMarketHistorical(symbol, apiTf);
  const priceData: PriceDataPoint[] = useMemo(
    () => priceRowsAll.slice(-fetchUnits),
    [priceRowsAll, fetchUnits],
  );
  const { data: gexHistoricalData } = useApiData<GexHistoricalPoint[]>(
    `/api/gex/historical?${symParam}&timeframe=${apiTf}&window_units=${maxPoints}`,
    { refreshInterval: historicalInterval },
  );
  const { data: gexByStrike } = useGEXByStrike(symbol, 200, byStrikeInterval, 'impact');

  const availableExpirations = useMemo(() => {
    const exps = new Set<string>();
    (gexByStrike || []).forEach((row) => {
      const exp = String(row.expiration || '').trim();
      if (exp) exps.add(exp);
    });
    return Array.from(exps).sort();
  }, [gexByStrike]);

  // Build the dense (time × strike) matrix once per fetch.
  const grid = useMemo(() => {
    const rows = (gexData || []).slice(-5000);
    if (rows.length === 0) return null;

    const priceTsSet = new Set<string>();
    (priceData || []).forEach((p) => {
      const close = Number(p.close ?? p.open);
      if (Number.isFinite(close) && close > 0) priceTsSet.add(p.timestamp);
    });

    // Only trim the heatmap to timestamps that also have underlying price
    // data when price coverage is high enough to be trustworthy. Sparse
    // price caches (e.g., a 1s poll trickling in bars after a failed seed
    // fetch) would otherwise collapse the visible heatmap to just the
    // handful of cached price timestamps, even when full heatmap data is
    // available. The filter still does its job — masking pre-market cells
    // for RTH-only symbols like SPX — once the price cache is dense.
    const heatmapTimestamps = Array.from(new Set(rows.map((r) => r.timestamp)));
    const priceCoverage = heatmapTimestamps.length > 0
      ? heatmapTimestamps.filter((ts) => priceTsSet.has(ts)).length / heatmapTimestamps.length
      : 0;
    const applyPriceFilter = priceTsSet.size > 0 && priceCoverage >= 0.5;

    const timestamps = omitClosedMarketTimes(heatmapTimestamps.sort(), (ts) => ts)
      .filter((ts) => !applyPriceFilter || priceTsSet.has(ts))
      .slice(-maxPoints);
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
  }, [gexData, maxPoints, priceData]);

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
    // Margin is the ±2% baseline scaled by the user-controlled zoom (default 1.0).
    const margin = 0.02 * zoomMul;
    const yMin = priceMin * (1 - margin);
    const yMax = priceMax * (1 + margin);
    if (yMax - yMin < 1) {
      return { yMin: grid.minStrike, yMax: grid.maxStrike };
    }
    return { yMin, yMax };
  }, [grid, priceData, zoomMul]);

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
      if (showGrid) {
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(PAD_L, py);
        ctx.lineTo(PAD_L + plotW, py);
        ctx.stroke();
      }
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    // Time labels at clock-aligned intervals (e.g., every 30/60/120 minutes in
    // ET) rather than every Nth data point — that way labels read as
    // "09:30, 10:00, 10:30…" instead of irregular times that drift with the
    // sample count and any gaps in the data.
    const tickStepMinutes = tf === '1m' ? 30 : tf === '5m' ? 60 : 120;
    const minutesOfDayET = (d: Date) => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d);
      const h = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
      const m = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
      return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : -1;
    };
    const dateKeyET = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);

    type TimeTick = { i: number; px: number; label: string };
    const timeTicks: TimeTick[] = [];
    type DateGroup = { startI: number; endI: number; label: string };
    const dateGroups: DateGroup[] = [];
    let groupStart = 0;
    let groupDateKey = '';

    for (let i = 0; i < T; i++) {
      const d = new Date(grid.timestamps[i]);
      const mod = minutesOfDayET(d);
      const dk = dateKeyET(d);
      if (i === 0) {
        groupDateKey = dk;
      } else if (dk !== groupDateKey) {
        dateGroups.push({ startI: groupStart, endI: i - 1, label: groupDateKey });
        groupStart = i;
        groupDateKey = dk;
      }
      if (mod >= 0 && mod % tickStepMinutes === 0) {
        timeTicks.push({
          i,
          px: PAD_L + (i + 0.5) * (plotW / T),
          label: d.toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          }),
        });
      }
    }
    dateGroups.push({ startI: groupStart, endI: T - 1, label: groupDateKey });

    // Drop labels that would visually collide (minimum ~52px gap between centers).
    const minLabelGap = 52;
    let lastDrawnX = Number.NEGATIVE_INFINITY;
    const drawnTimeTicks: TimeTick[] = [];
    timeTicks.forEach((tk) => {
      if (tk.px - lastDrawnX < minLabelGap) return;
      drawnTimeTicks.push(tk);
      lastDrawnX = tk.px;
    });

    drawnTimeTicks.forEach((tk) => {
      ctx.fillText(tk.label, tk.px, PAD_T + plotH + 6);
    });

    // Grouped date row centered under each day's span of time ticks. Skip
    // groups that are too narrow to fit even a compact label.
    if (dateGroups.length > 0) {
      ctx.fillStyle = isDark ? 'rgba(255,241,230,0.65)' : 'rgba(30,41,59,0.65)';
      ctx.font = '10px ui-sans-serif, system-ui, -apple-system, sans-serif';
      dateGroups.forEach((g) => {
        const startPx = PAD_L + (g.startI + 0.5) * (plotW / T);
        const endPx = PAD_L + (g.endI + 0.5) * (plotW / T);
        const centerPx = (startPx + endPx) / 2;
        const groupWidth = endPx - startPx;
        if (groupWidth < 48) return;
        const dateLabel = new Date(`${g.label}T12:00:00Z`).toLocaleDateString('en-US', {
          timeZone: 'America/New_York',
          month: 'short',
          day: 'numeric',
        });
        ctx.fillText(dateLabel, centerPx, PAD_T + plotH + 22);
      });
      // Restore default fill color so subsequent draws aren't tinted.
      ctx.fillStyle = axisColor;
      ctx.font = '11px ui-sans-serif, system-ui, -apple-system, sans-serif';
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
        // Break the line at missing/unresolved timestamps instead of
        // bridging them with a straight segment. A NULL flip means the
        // backend could not resolve a zero-gamma level for that cycle
        // (degraded/one-sided chain); drawing through it would fabricate
        // a level across unknown data — the failure mode this whole line
        // is meant to expose. A real gap is the honest rendering.
        if (v == null || !Number.isFinite(v)) { started = false; return; }
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
  }, [grid, bounds, priceData, gammaFlipByTs, theme, size, hover, showGrid, tf]);

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

  // ── Toolbar derived labels ──
  const expiryDisplay = selectedExpiry === 'all' ? 'All' : selectedExpiry;
  const dteSourceExpiry = selectedExpiry !== 'all' ? selectedExpiry : availableExpirations[0];
  const dteValue = computeDte(dteSourceExpiry);
  const dteLabel = dteValue != null ? `${dteValue}d` : '—';
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const latestTs = grid?.timestamps?.[grid.timestamps.length - 1];
  const updatedLabel = latestTs ? new Date(latestTs).toLocaleTimeString() : '—';

  if (loading && !gexData) return <LoadingSpinner size="lg" />;
  if (error) return <ErrorMessage message={error} />;

  const toolbarBtnClass = 'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors';
  const toolbarBtnStyle = (active = false): React.CSSProperties => ({
    border: `1px solid ${border}`,
    color: active ? textPrimary : subtle,
    backgroundColor: active ? 'var(--color-info-soft)' : 'transparent',
  });
  const containerStyle: React.CSSProperties = fullscreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        borderRadius: 0,
        overflow: 'auto',
        backgroundColor: cardBg,
        border: 'none',
      }
    : {
        backgroundColor: cardBg,
        border: `1px solid ${border}`,
        overflow: 'hidden',
      };
  const popoverStyle: React.CSSProperties = {
    backgroundColor: popoverBg,
    border: `1px solid ${border}`,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  };

  return (
    <div className="rounded-lg" style={containerStyle}>
      {/* Title bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: `1px solid ${border}`, color: textPrimary }}
      >
        <div className="flex items-center gap-2 text-sm font-semibold tracking-wide">
          <span>{symbol} GEX Heatmap Timeseries</span>
          <TooltipWrapper text="Canvas-rendered, bilinear-smoothed time-series heatmap of net dealer GEX by strike. Color scale is clipped at the 98th percentile of |GEX| with a signed-sqrt mapping so the ATM peak doesn't wash out the rest of the chain. The y-axis is cropped to ±2% of the underlying price range (scaled by the zoom buttons). Candlesticks show the underlying OHLC and the colored line marks the gamma flip.">
            <Info size={14} />
          </TooltipWrapper>
        </div>
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          title={fullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
          className="rounded-md p-1.5 transition-colors hover:bg-[color:var(--color-info-soft)]"
          style={{ color: subtle }}
        >
          {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-5 pt-3 pb-3">
        <div className={toolbarBtnClass} style={toolbarBtnStyle()} title="Current trading date">
          <Clock size={12} />
          <span>{todayLabel}</span>
        </div>

        {/* Expiry dropdown */}
        <div ref={expiryRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setExpiryOpen((v) => !v);
              setSettingsOpen(false);
            }}
            className={toolbarBtnClass}
            style={toolbarBtnStyle(selectedExpiry !== 'all')}
            title="Filter by expiration (best-effort — depends on /api/gex/heatmap supporting the param)"
            disabled={availableExpirations.length === 0}
          >
            <span>Expiry {expiryDisplay}</span>
            <ChevronDown size={12} />
          </button>
          {expiryOpen && (
            <div
              className="absolute top-full left-0 mt-1 rounded-md py-1 z-30"
              style={{ ...popoverStyle, minWidth: 160, maxHeight: 260, overflowY: 'auto' }}
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedExpiry('all');
                  setExpiryOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[color:var(--color-info-soft)]"
                style={{
                  color: selectedExpiry === 'all' ? textPrimary : subtle,
                  fontWeight: selectedExpiry === 'all' ? 600 : 400,
                }}
              >
                All expirations
              </button>
              {availableExpirations.map((exp) => (
                <button
                  key={exp}
                  type="button"
                  onClick={() => {
                    setSelectedExpiry(exp);
                    setExpiryOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[color:var(--color-info-soft)]"
                  style={{
                    color: selectedExpiry === exp ? textPrimary : subtle,
                    fontWeight: selectedExpiry === exp ? 600 : 400,
                  }}
                >
                  {exp}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={toolbarBtnClass} style={toolbarBtnStyle()} title="Days to expiry (front month or selected)">
          <span>DTE {dteLabel}</span>
        </div>

        <div className="inline-flex rounded-md overflow-hidden" style={{ border: `1px solid ${border}` }}>
          {TIMEFRAME_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setTf(option)}
              className="px-2.5 py-1.5 text-xs font-semibold"
              style={{
                color: option === tf ? textPrimary : subtle,
                backgroundColor: option === tf ? 'var(--color-info-soft)' : 'transparent',
              }}
            >
              {option}
            </button>
          ))}
        </div>

        <button
          type="button"
          title="Double the time window so the heatmap reaches into the prior session"
          onClick={() => setWithPrev((v) => !v)}
          className={toolbarBtnClass}
          style={toolbarBtnStyle(withPrev)}
        >
          <span>With Prev</span>
        </button>

        <button
          type="button"
          title="Zoom out (wider price-range margin)"
          onClick={() => setZoomMul((v) => clamp(v * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className={toolbarBtnClass}
          style={toolbarBtnStyle()}
          disabled={zoomMul >= ZOOM_MAX - 1e-6}
        >
          <ZoomOut size={12} />
        </button>
        <button
          type="button"
          title="Zoom in (tighter price-range margin)"
          onClick={() => setZoomMul((v) => clamp(v / ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className={toolbarBtnClass}
          style={toolbarBtnStyle()}
          disabled={zoomMul <= ZOOM_MIN + 1e-6}
        >
          <ZoomIn size={12} />
        </button>

        <button
          type="button"
          title={paused ? 'Resume live updates' : 'Pause live updates'}
          onClick={() => setPaused((v) => !v)}
          className={toolbarBtnClass}
          style={toolbarBtnStyle(paused)}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
        </button>

        <button
          type="button"
          title="Reset all settings to default"
          onClick={resetAll}
          className={toolbarBtnClass}
          style={toolbarBtnStyle()}
        >
          <RotateCcw size={12} />
        </button>

        {/* Settings */}
        <div ref={settingsRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setSettingsOpen((v) => !v);
              setExpiryOpen(false);
            }}
            title="Display settings"
            className={toolbarBtnClass}
            style={toolbarBtnStyle(settingsOpen)}
          >
            <Settings2 size={12} />
          </button>
          {settingsOpen && (
            <div
              className="absolute top-full right-0 mt-1 rounded-md py-2 z-30"
              style={{ ...popoverStyle, minWidth: 200 }}
            >
              <label className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-[color:var(--color-info-soft)]" style={{ color: textPrimary }}>
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                <span>Show grid lines</span>
              </label>
              <div className="border-t mt-1 pt-1" style={{ borderColor: border }}>
                <button
                  type="button"
                  onClick={() => {
                    resetAll();
                    setSettingsOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-[color:var(--color-info-soft)] flex items-center gap-2"
                  style={{ color: textPrimary }}
                >
                  <RotateCcw size={12} />
                  <span>Reset all settings</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ml-auto text-xs flex items-center gap-2" style={{ color: subtle }}>
          {paused && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ color: colors.warning, backgroundColor: 'rgba(245, 158, 11, 0.16)' }}
            >
              Paused
            </span>
          )}
          <span>Updated {updatedLabel}</span>
        </div>
      </div>

      {/* Heatmap canvas */}
      {!grid ? (
        <div className="px-5 py-12 text-center" style={{ color: subtle }}>
          No heatmap data available
        </div>
      ) : (
        <>
        <MobileScrollableChart minWidthClass="min-w-[900px]">
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
        </MobileScrollableChart>
        {/* Legend strip */}
        <div
          className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-2 text-xs"
          style={{ borderTop: `1px solid ${border}`, color: subtle }}
        >
          <span
            className="flex items-center gap-1.5"
            title="Price where dealer net gamma flips sign — above it dealers dampen volatility, below it they amplify it"
          >
            <svg width="22" height="6" aria-hidden="true">
              <line x1="0" x2="22" y1="3" y2="3" stroke="var(--accent-2)" strokeWidth="2.25" />
            </svg>
            <span style={{ color: textPrimary }}>Gamma Flip</span>
          </span>
        </div>
        </>
      )}
    </div>
  );
}
