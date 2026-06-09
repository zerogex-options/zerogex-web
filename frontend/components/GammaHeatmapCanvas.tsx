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
import { useApiData, useGEXByStrike, useMarketQuote } from '@/hooks/useApiData';
import { useMarketHistorical } from '@/hooks/useMarketHistorical';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import MobileScrollableChart from './MobileScrollableChart';
import { isWithinTradingHoursForSymbol, getMarketSession, isSessionLive } from '@/core/utils';

interface HeatmapCell { strike: number; net_gex: number; }
interface GammaBucket {
  timestamp: string;
  gamma_flip?: number | null;
  // Fraction of spot the resolver's grid spanned to land the flip
  // (see backend gex_summary.gamma_flip_span_used). Default-rung values
  // (≈0.20) render as a solid line; expansion-rung values render
  // dashed/faint so the chart doesn't suggest a marginal-rung flip is a
  // live regime boundary.
  gamma_flip_span_used?: number | null;
  heatmap: HeatmapCell[];
}
interface PriceDataPoint { timestamp: string; open?: number; high?: number; low?: number; close?: number; }
interface GexHistoricalPoint { timestamp: string; gamma_flip?: number | null; gamma_flip_span_used?: number | null; }

type RGB = { r: number; g: number; b: number };
const BEARISH: RGB = { r: 44, g: 72, b: 117 };   // negative GEX (cool)
const NEUTRAL: RGB = { r: 255, g: 246, b: 237 }; // zero (warm white)
const BULLISH: RGB = { r: 255, g: 133, b: 49 };  // positive GEX (warm)

// Darker bullish / bearish for candle bodies on top of the heatmap.
// The standard colors.bullish (#1BC47D) and colors.bearish (#FF4D5A)
// wash out against the orange / warm-white centre of the heatmap
// gradient; these darker variants stay readable everywhere the
// candles overlay.  Neutral candles continue to use the theme's
// textPrimary so they pop against any cell colour.
const CANDLE_BULLISH = '#0A6E3E';
const CANDLE_BEARISH = '#8C1F2D';

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
// Right padding holds the vertical color legend plus its value labels.
const PAD_R = 96;
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
  const quoteInterval = paused ? 0 : 1000;

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

  const { data: gexData, loading, error } = useApiData<GammaBucket[]>(
    `/api/gex/heatmap?${symParam}&timeframe=${apiTf}&window_units=${fetchUnits}${expiryParam}`,
    { refreshInterval: heatmapInterval },
  );
  const { rows: priceRowsAll } = useMarketHistorical(symbol, apiTf);
  // Live quote for the tip-candle close merge.  Mirrors the Strike
  // Profile chart's behaviour: while the session is live (cash for
  // indexes, 04:00–20:00 for stocks/ETFs) ONLY the most recent slot's
  // close is overridden with /api/market/quote.close so the candle and
  // spot line move on the same 1Hz tick as the header.  open / high /
  // low remain exactly what the analytics engine wrote so the candle's
  // silhouette never widens past the bucket the engine recorded —
  // when a new bucket arrives the previous tip reverts cleanly to API
  // values.  Outside the live session the merge is skipped entirely.
  const { data: quote } = useMarketQuote(symbol, quoteInterval);
  const priceData: PriceDataPoint[] = useMemo(() => {
    const sliced = priceRowsAll.slice(-fetchUnits);
    if (sliced.length === 0) return sliced;
    if (!isSessionLive(quote?.session) || !quote) return sliced;
    const liveClose = Number(quote.close);
    if (!Number.isFinite(liveClose) || liveClose <= 0) return sliced;
    const tip = sliced[sliced.length - 1];
    return [...sliced.slice(0, -1), { ...tip, close: liveClose }];
  }, [priceRowsAll, fetchUnits, quote]);
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

  // Build the dense (time × strike) matrix on a REGULAR session-hour grid.
  //
  // The x-axis is one slot per bucket (every `cadenceMs`) across the
  // symbol's session — ETFs 04:00–20:00 ET, indices 09:30–16:00 ET. A
  // bucket with no GEX prints as a BLANK (transparent) column rather than
  // being collapsed away, so sparsity is visible. Candles are drawn
  // independently per slot (render effect), so a slot can show a candle
  // with no GEX or vice-versa. Nothing is filled/carried across time.
  //
  // All series are keyed by the CANONICAL (floored) bucket-ms
  // `floor(ms / cadenceMs) * cadenceMs`, so GEX, candles, and the slot grid
  // align regardless of any phase/format drift between feeds. (The earlier
  // 5m blank-out came from keying the slot grid off one feed's raw ms while
  // the matrix used another's — flooring removes that whole failure class.)
  const grid = useMemo(() => {
    const buckets = gexData || [];
    const cadenceMs = tf === '1m' ? 60_000 : tf === '5m' ? 300_000 : 900_000;
    const bucketOf = (ms: number) => Math.floor(ms / cadenceMs) * cadenceMs;

    const sparse = new Map<string, number>();
    const gexBucketMs = new Set<number>();
    const strikeSet = new Set<number>();
    buckets.forEach((b) => {
      const ms = bucketOf(new Date(b.timestamp).getTime());
      if (!Number.isFinite(ms)) return;
      (b.heatmap || []).forEach((c) => {
        const strike = Number(c.strike);
        if (!Number.isFinite(strike)) return;
        gexBucketMs.add(ms);
        strikeSet.add(strike);
        sparse.set(`${ms}|${strike}`, Number(c.net_gex));
      });
    });

    const priceMsSet = new Set<number>();
    (priceData || []).forEach((p) => {
      const ms = new Date(p.timestamp).getTime();
      if (Number.isFinite(ms)) priceMsSet.add(bucketOf(ms));
    });

    // Right edge = the freshest bucket of EITHER series, so a lagging GEX
    // feed or a stalled candle feed shows as a gap on one side instead of
    // truncating the other.
    let latestMs = -Infinity;
    gexBucketMs.forEach((ms) => { if (ms > latestMs) latestMs = ms; });
    priceMsSet.forEach((ms) => { if (ms > latestMs) latestMs = ms; });
    if (!Number.isFinite(latestMs)) return null;

    // Step back by the cadence from the latest bucket, keeping only
    // in-session slots for this symbol. Out-of-session slots (overnight,
    // weekends) are skipped so the axis hops session→session.
    const slotsMs: number[] = [];
    let t = latestMs;
    let guard = 0;
    const guardMax = maxPoints * 64 + 4096;
    while (slotsMs.length < maxPoints && guard < guardMax) {
      if (isWithinTradingHoursForSymbol(new Date(t), symbol)) slotsMs.push(t);
      t -= cadenceMs;
      guard += 1;
    }
    slotsMs.reverse();
    if (slotsMs.length === 0) return null;

    const reportedStrikes = Array.from(strikeSet).sort((a, b) => a - b);
    if (reportedStrikes.length < 2) return null;

    const minStrike = Math.floor(reportedStrikes[0]);
    const maxStrike = Math.ceil(reportedStrikes[reportedStrikes.length - 1]);
    const stride = maxStrike - minStrike + 1;

    const matrix = new Float32Array(slotsMs.length * stride);
    matrix.fill(NaN);

    slotsMs.forEach((ms, x) => {
      if (!gexBucketMs.has(ms)) return; // blank column — no GEX for this bucket
      const known: { strike: number; value: number }[] = [];
      reportedStrikes.forEach((s) => {
        const v = sparse.get(`${ms}|${s}`);
        if (v != null && Number.isFinite(v)) known.push({ strike: s, value: v });
      });
      if (known.length === 0) return;

      // Linear interpolation along the STRIKE axis only (within a populated
      // bucket). Smooths across strikes, never across time — gaps stay blank.
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
          const tt = span > 0 ? (s - left.strike) / span : 0;
          v = left.value + (right.value - left.value) * tt;
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
    // Diagnostic for the 5m-style regression: GEX buckets exist but none
    // landed on a slot → blank surface. Log the alignment state so a
    // recurrence is observable instead of silent.
    if (finiteAbs.length === 0 && gexBucketMs.size > 0 && typeof console !== 'undefined') {
      console.warn(
        '[gex-heatmap] empty surface despite', gexBucketMs.size,
        'GEX buckets — slot/bucket misalignment',
        { tf, slots: slotsMs.length, slotRange: [slotsMs[0], slotsMs[slotsMs.length - 1]], gexSample: Array.from(gexBucketMs).slice(0, 3) },
      );
    }
    const clip = Math.max(1, percentile(finiteAbs, 0.98));

    const timestamps = slotsMs.map((ms) => new Date(ms).toISOString());
    return { timestamps, slotsMs, minStrike, maxStrike, stride, matrix, clip };
  }, [gexData, priceData, maxPoints, tf, symbol]);

  // Threshold above which a cycle's gamma_flip_span_used (fraction of
  // spot the resolver's grid spanned) is considered an "expansion
  // rung" and rendered dashed instead of solid.  Mirrors the backend's
  // first-rung default (GAMMA_PROFILE_SPAN_LADDER[0] = 0.20); the
  // 0.205 margin tolerates float drift at the boundary.
  const FLIP_DEFAULT_RUNG_MAX = 0.205;

  const gammaFlipByMs = useMemo(() => {
    // One flip + span per bucket, keyed by canonical bucket-ms so it matches
    // the grid's slots.
    const cadenceMs = tf === '1m' ? 60_000 : tf === '5m' ? 300_000 : 900_000;
    const bucketOf = (ms: number) => Math.floor(ms / cadenceMs) * cadenceMs;
    const result = new Map<number, { value: number; expanded: boolean }>();
    (gexData || []).forEach((b) => {
      if (b.gamma_flip == null || !Number.isFinite(Number(b.gamma_flip))) return;
      const ms = bucketOf(new Date(b.timestamp).getTime());
      if (!Number.isFinite(ms)) return;
      const span = b.gamma_flip_span_used != null && Number.isFinite(Number(b.gamma_flip_span_used))
        ? Number(b.gamma_flip_span_used)
        : 0;
      result.set(ms, { value: Number(b.gamma_flip), expanded: span > FLIP_DEFAULT_RUNG_MAX });
    });
    if (result.size === 0) {
      // Fallback to /api/gex/historical (flat GEXSummary rows, one flip per
      // timestamp) when the heatmap window carries no resolved flip.
      (gexHistoricalData || []).forEach((row) => {
        if (row.gamma_flip == null || !Number.isFinite(Number(row.gamma_flip))) return;
        const ms = bucketOf(new Date(row.timestamp).getTime());
        if (!Number.isFinite(ms)) return;
        const span = row.gamma_flip_span_used != null && Number.isFinite(Number(row.gamma_flip_span_used))
          ? Number(row.gamma_flip_span_used)
          : 0;
        result.set(ms, { value: Number(row.gamma_flip), expanded: span > FLIP_DEFAULT_RUNG_MAX });
      });
    }
    return result;
  }, [gexData, gexHistoricalData, tf]);

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
    const gridColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.16)';

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

    // Vertical grid lines at the drawn time ticks (pairs with the horizontal
    // strike lines above so the toggle produces a full grid).
    if (showGrid) {
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      drawnTimeTicks.forEach((tk) => {
        ctx.moveTo(tk.px, PAD_T);
        ctx.lineTo(tk.px, PAD_T + plotH);
      });
      ctx.stroke();
    }

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

    // Underlying candlesticks on top of the heatmap.  Hollow-candle
    // convention: colour is close vs PREVIOUS candle's close (bullish /
    // bearish / theme-aware neutral on equal), fill is close vs OWN
    // open (hollow when close > open, filled otherwise).  Mirrors the
    // Strike Profile chart's logic so both tabs read the same way.
    if (priceData && priceData.length > 0) {
      const cadenceMs = tf === '1m' ? 60_000 : tf === '5m' ? 300_000 : 900_000;
      const priceByMs = new Map(priceData.map((p) => [Math.floor(new Date(p.timestamp).getTime() / cadenceMs) * cadenceMs, p]));
      const cellW = plotW / T;
      const candleW = Math.max(2, Math.min(8, cellW * 0.42));

      // Seed prevClose from the most recent price row strictly BEFORE
      // the first visible slot, so the leftmost visible candle's
      // colour rule isn't orphaned to neutral by the slot-window edge.
      let prevClose: number | null = null;
      const firstSlotMs = grid.slotsMs[0];
      for (let pi = priceData.length - 1; pi >= 0; pi -= 1) {
        const p = priceData[pi];
        const pMs = Math.floor(new Date(p.timestamp).getTime() / cadenceMs) * cadenceMs;
        if (pMs < firstSlotMs) {
          const c = Number(p.close ?? p.open);
          if (Number.isFinite(c)) prevClose = c;
          break;
        }
      }

      grid.slotsMs.forEach((ms, i) => {
        const row = priceByMs.get(ms);
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

        // Colour by close vs previous close.  Blank slots between
        // candles are bridged — prevClose only updates when a candle
        // is actually drawn, so a gap doesn't force the next candle
        // to neutral.  Darker bullish/bearish variants are used so the
        // candles stay readable against the heatmap's warm gradient
        // (Strike Profile uses the brighter colors.bullish/bearish
        // because its background is the card surface, not a heatmap).
        let color: string;
        if (prevClose == null || close === prevClose) {
          color = textPrimary;
        } else if (close > prevClose) {
          color = CANDLE_BULLISH;
        } else {
          color = CANDLE_BEARISH;
        }

        const hollow = close > open;
        const bodyTop = Math.min(yOpen, yClose);
        const bodyBottom = Math.max(yOpen, yClose);
        const bodyH = Math.max(1, bodyBottom - bodyTop);

        // Wick split at the body edges so an empty hollow body never
        // shows the wick passing through it.  Solid candles cover the
        // wick with their fill so the same split is harmless there.
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx, yHigh);
        ctx.lineTo(cx, bodyTop);
        ctx.moveTo(cx, bodyBottom);
        ctx.lineTo(cx, yLow);
        ctx.stroke();

        if (hollow) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.strokeRect(cx - candleW / 2, bodyTop, candleW, bodyH);
        } else {
          ctx.fillStyle = color;
          ctx.fillRect(cx - candleW / 2, bodyTop, candleW, bodyH);
        }

        prevClose = close;
      });
    }

    // Gamma flip line.  Drawn as TWO independent strokes:
    //   * solid + full-opacity for default-rung cycles (live regime level)
    //   * dashed + faint     for expansion-rung cycles (passed a wider
    //     geometric search — flip is not at a near-spot regime
    //     boundary; treat with caution).
    // The two paths break at NULL/out-of-bounds points and ALSO at
    // transitions between rung types, so a stretch of solid line never
    // visually connects to a stretch of dashed line — that connection
    // would imply a continuous regime when the resolver actually
    // changed its qualifying scan.
    if (gammaFlipByMs.size > 0) {
      const flipColor = (() => {
        if (typeof window !== 'undefined') {
          const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim();
          if (v) return v;
        }
        return colors.accent;
      })();
      const drawFlipPath = (expandedFilter: boolean) => {
        ctx.beginPath();
        let started = false;
        grid.slotsMs.forEach((ms, i) => {
          const entry = gammaFlipByMs.get(ms);
          const v = entry?.value;
          // Break the line at missing/unresolved timestamps AND at
          // values outside the visible y-axis range. A NULL flip means
          // the backend could not resolve a zero-gamma level for that
          // cycle (degraded/one-sided chain); drawing through it would
          // fabricate a level across unknown data. An out-of-bounds
          // value is the analogous failure mode for a
          // resolved-but-unactionable crossing — drawing it would
          // render the line off the plot box (the SPX 2026-05-20
          // pathology). Also break when the cycle's rung type does
          // not match this pass's filter, so the solid and dashed
          // paths never visually merge across a resolver-mode change.
          if (entry == null || v == null || !Number.isFinite(v) || v < yMin || v > yMax) {
            started = false;
            return;
          }
          if (entry.expanded !== expandedFilter) {
            started = false;
            return;
          }
          const py = yForStrike(v);
          const px = PAD_L + (i + 0.5) * (plotW / T);
          if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
        });
        ctx.stroke();
      };

      // Default-rung pass — solid, full opacity.
      ctx.save();
      ctx.setLineDash([]);
      ctx.lineWidth = 2.25;
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = flipColor;
      drawFlipPath(false);
      ctx.restore();

      // Expansion-rung pass — dashed, half opacity.
      ctx.save();
      ctx.setLineDash([6, 4]);
      ctx.lineWidth = 2.0;
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = flipColor;
      drawFlipPath(true);
      ctx.restore();
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
  }, [grid, bounds, priceData, gammaFlipByMs, theme, textPrimary, size, hover, showGrid, tf]);

  const tooltip = useMemo(() => {
    if (!hover || !grid || !bounds) return null;
    const plotW = Math.max(10, size.w - PAD_L - PAD_R);
    const plotH = Math.max(10, size.h - PAD_T - PAD_B);
    if (hover.x < PAD_L || hover.x > PAD_L + plotW || hover.y < PAD_T || hover.y > PAD_T + plotH) return null;

    const T = grid.timestamps.length;
    const xRatio = (hover.x - PAD_L) / plotW;
    const tIdx = Math.min(T - 1, Math.max(0, Math.floor(xRatio * T)));
    const ts = grid.timestamps[tIdx];
    const ms = grid.slotsMs[tIdx];

    const yRatio = (hover.y - PAD_T) / plotH;
    const strike = bounds.yMax - yRatio * (bounds.yMax - bounds.yMin);
    const sIdx = Math.round(strike) - grid.minStrike;
    const safeS = Math.min(grid.stride - 1, Math.max(0, sIdx));
    const value = grid.matrix[tIdx * grid.stride + safeS];

    const cadenceMs = tf === '1m' ? 60_000 : tf === '5m' ? 300_000 : 900_000;
    const priceRow = priceData?.find((p) => Math.floor(new Date(p.timestamp).getTime() / cadenceMs) * cadenceMs === ms);
    const gammaFlip = gammaFlipByMs.get(ms);
    return { ts, strike: Math.round(strike), value, priceRow, gammaFlip };
  }, [hover, grid, bounds, priceData, gammaFlipByMs, size, tf]);

  // ── Toolbar derived labels ──
  const expiryDisplay = selectedExpiry === 'all' ? 'All' : selectedExpiry;
  const dteSourceExpiry = selectedExpiry !== 'all' ? selectedExpiry : availableExpirations[0];
  const dteValue = computeDte(dteSourceExpiry);
  const dteLabel = dteValue != null ? `${dteValue}d` : '—';
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const latestTs = grid?.timestamps?.[grid.timestamps.length - 1];
  const updatedLabel = latestTs ? new Date(latestTs).toLocaleTimeString() : '—';

  // The heatmap is anchored on /api/gex/heatmap (gex_summary on the
  // backend) while the candlesticks come from /api/market/historical
  // (underlying_quotes). The re-anchor in OA commit 46fde74 decoupled
  // the two: the heatmap now keeps advancing even when the underlying
  // bar feed stalls, instead of freezing in lockstep. That decoupling
  // is the point — but a viewer with no context sees candles that lag
  // a moving heatmap and may wonder if the chart is broken. Surface
  // the gap as a small badge once it exceeds CANDLE_LAG_BADGE_MIN, so
  // it's named rather than mysterious. Computed entirely from data
  // already on the page (no extra fetch).
  //
  // Threshold sits above one bucket boundary at every supported
  // timeframe so a normal bucket-rollover skew (heatmap ticks first,
  // candles a tick later) doesn't flicker the badge on every cycle.
  const CANDLE_LAG_BADGE_MIN = 5;
  const candleLagMinutes = useMemo(() => {
    // Latest GEX bucket vs latest candle bucket, from the raw series (not the
    // grid, whose right edge is the freshest of the two). Positive => candles
    // trail the GEX surface.
    let latestGex = -Infinity;
    (gexData || []).forEach((b) => {
      const ms = new Date(b.timestamp).getTime();
      if (Number.isFinite(ms) && ms > latestGex) latestGex = ms;
    });
    let latestCandle = -Infinity;
    (priceData || []).forEach((p) => {
      const ms = new Date(p.timestamp).getTime();
      if (Number.isFinite(ms) && ms > latestCandle) latestCandle = ms;
    });
    if (!Number.isFinite(latestGex) || !Number.isFinite(latestCandle)) return null;
    const lagMs = latestGex - latestCandle;
    if (lagMs <= 0) return null; // candles caught up or ahead
    return Math.floor(lagMs / 60000);
  }, [gexData, priceData]);
  // When no session is trading (overnight, weekend, holiday) both feeds
  // are stale at their last close and the gap between them isn't
  // actionable — suppress the badge to avoid alarming users about an
  // "outage" when nothing is moving.
  const marketSession = getMarketSession();
  const marketActive =
    marketSession === 'open' ||
    marketSession === 'pre-market' ||
    marketSession === 'after-hours';
  const showCandleLagBadge =
    marketActive &&
    candleLagMinutes != null &&
    candleLagMinutes >= CANDLE_LAG_BADGE_MIN;

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
          {showCandleLagBadge && (
            <TooltipWrapper text="The heatmap is sourced from analytics (gex_summary) while candles come from the underlying bar feed (underlying_quotes). When the bar feed stalls — TradeStation stream-cap pressure, single-symbol bar outage, vendor reset hiccup — the heatmap keeps advancing while candles freeze. This badge surfaces that gap so the chart's right edge asymmetry is named instead of mysterious. Gap closes automatically once the bar feed recovers.">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded cursor-help"
                style={{ color: colors.warning, backgroundColor: 'rgba(245, 158, 11, 0.16)' }}
              >
                Candles {candleLagMinutes}m behind
              </span>
            </TooltipWrapper>
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
                {tooltip.gammaFlip != null && Number.isFinite(tooltip.gammaFlip.value) && (
                  <div>
                    Gamma Flip: ${tooltip.gammaFlip.value.toFixed(2)}
                    {tooltip.gammaFlip.expanded && (
                      <span style={{ opacity: 0.7 }}> (expanded scan)</span>
                    )}
                  </div>
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
          <span
            className="flex items-center gap-1.5"
            title="Dashed segments mark cycles where the default resolver scan (±20% of spot) found no near-spot regime boundary and the search expanded to ±35% / ±50%. Those expansion-rung flips are geometrically valid but live far from spot; treat them as marginal, not as the live regime level."
          >
            <svg width="22" height="6" aria-hidden="true">
              <line x1="0" x2="22" y1="3" y2="3" stroke="var(--accent-2)" strokeWidth="2" strokeDasharray="6,4" opacity="0.55" />
            </svg>
            <span style={{ color: textPrimary }}>Gamma Flip (expanded scan)</span>
          </span>
        </div>
        </>
      )}
    </div>
  );
}
