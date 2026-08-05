"use client";

/**
 * PairCandleChart — a plain, props-driven candlestick + volume chart.
 *
 * Forked from UnderlyingCandlesChart so the Ticker-Pair Comparison page can
 * stack two candle charts (one per ticker in the pair) with NO gamma overlays
 * and NO card/timeframe chrome. It is "the Gamma Chart without the levels
 * marked and the gamma chart on the right": the exact same hand-rolled SVG
 * hollow-OHLC candles + stacked up/down volume, driven entirely by the
 * `symbol` and `timeframe` props (unlike UnderlyingCandlesChart, which reads
 * the app-wide symbol/timeframe from context and wraps itself in a titled
 * ExpandableCard). The page owns the shared timeframe control, so this
 * component renders just the instrument.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useMarketQuote } from "@/hooks/useApiData";
import { useMarketHistorical } from "@/hooks/useMarketHistorical";
import { type ReplayCandle } from "@/hooks/usePairReplay";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import { omitClosedMarketTimes } from "@/core/utils";
import { type ChartTimeframe } from "./ChartTimeframeSelect";
import { useIsMobile } from "@/hooks/useIsMobile";
import MobileScrollableChart from "./MobileScrollableChart";

export interface CandleReplay {
  /** When true the chart renders the replay session up to `cursorTs` instead of live. */
  active: boolean;
  /** Per-minute session candles (1-min); aggregated to the timeframe here. */
  candles: ReplayCandle[];
  /** The shared playhead timestamp — the chart reveals candles up to it. */
  cursorTs: string | null;
  loading: boolean;
  /** Dealer-gamma levels drawn as price lines (spot, flip, walls, max pain). */
  levels: { spot: number | null; flip: number | null; call: number | null; put: number | null; pain: number | null };
}

const LEVEL_LINES: Array<{ key: "spot" | "flip" | "call" | "put" | "pain"; code: string; color: string }> = [
  { key: "spot", code: "SP", color: "var(--color-navy)" },
  { key: "flip", code: "GF", color: "var(--color-warning)" },
  { key: "call", code: "CW", color: "var(--color-bear)" },
  { key: "put", code: "PW", color: "var(--color-bull)" },
  { key: "pain", code: "MP", color: "var(--color-accent-hot)" },
];

interface CandleBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  upVolume: number;
  downVolume: number;
}

// How many aggregated candles to render. Mirrors TimeframeContext.getMaxDataPoints().
const MAX_POINTS = 90;

function niceStep(value: number): number {
  if (value <= 0 || !Number.isFinite(value)) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / exp;
  if (norm < 1.5) return 1 * exp;
  if (norm < 3) return 2 * exp;
  if (norm < 7) return 5 * exp;
  return 10 * exp;
}

interface NiceAxis {
  ticks: number[];
  niceMin: number;
  niceMax: number;
  step: number;
}

function niceAxis(min: number, max: number, targetTicks: number): NiceAxis {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    const center = Number.isFinite(min) ? min : 0;
    return { ticks: [center], niceMin: center, niceMax: center + 1, step: 1 };
  }
  const step = niceStep((max - min) / Math.max(1, targetTicks - 1));
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const count = Math.max(1, Math.round((niceMax - niceMin) / step) + 1);
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) ticks.push(niceMin + i * step);
  return { ticks, niceMin, niceMax, step };
}

function priceLabel(p: number, step: number): string {
  const decimals = step >= 1 ? 0 : step >= 0.1 ? 1 : 2;
  return `$${p.toFixed(decimals)}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function aggregateBars(
  data: CandleBar[],
  bucketMinutes: number,
  maxPoints: number,
): CandleBar[] {
  if (data.length === 0) return [];
  const sorted = [...data].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets = new Map<number, CandleBar[]>();

  sorted.forEach((bar) => {
    const t = new Date(bar.timestamp).getTime();
    const bucket = Math.floor(t / bucketMs) * bucketMs;
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(bar);
  });

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .slice(-maxPoints)
    .map(([bucket, bars]) => {
      const upVolume = bars.reduce((sum, b) => sum + b.upVolume, 0);
      const downVolume = bars.reduce((sum, b) => sum + b.downVolume, 0);
      return {
        timestamp: new Date(bucket).toISOString(),
        open: bars[0].open,
        close: bars[bars.length - 1].close,
        high: Math.max(...bars.map((b) => b.high)),
        low: Math.min(...bars.map((b) => b.low)),
        volume: upVolume + downVolume,
        upVolume,
        downVolume,
      };
    });
}

const EMPTY_BARS: CandleBar[] = [];
const EMPTY_REPLAY_CANDLES: ReplayCandle[] = [];

interface RawRow {
  timestamp: string;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  close?: number | null;
  price?: number | null;
  volume?: number | null;
  up_volume?: number | null;
  down_volume?: number | null;
}

// Normalize raw historical rows into gap-filled CandleBars (closed-market times
// dropped, missing fields carried forward from the prior close, up/down volume
// split). Shared by the live path and the replay pre-session fill.
function normalizeRows(rows: RawRow[]): CandleBar[] {
  const filtered = omitClosedMarketTimes(rows || [], (d) => d.timestamp);
  let prevClose = filtered[0]?.close ?? filtered[0]?.price ?? 0;
  const out: CandleBar[] = [];
  for (const d of filtered) {
    const close = d.close ?? d.price ?? prevClose;
    const open = d.open ?? prevClose;
    const high = d.high ?? Math.max(open, close);
    const low = d.low ?? Math.min(open, close);
    const volume = d.volume ?? 0;
    const apiUp = d.up_volume ?? null;
    const apiDown = d.down_volume ?? null;
    const up = close >= open;
    const upVolume = apiUp !== null && apiDown !== null ? apiUp : up ? volume : 0;
    const downVolume = apiUp !== null && apiDown !== null ? apiDown : up ? 0 : volume;
    out.push({ timestamp: d.timestamp, open, high, low, close, volume: upVolume + downVolume, upVolume, downVolume });
    prevClose = close;
  }
  return out;
}

// Build the replay tape as a FIXED-width window ending at the playhead. The
// session's 1-min candles are revealed up to the cursor (so the cursor's bucket
// grows minute-by-minute — 1-min imposed on a 5-min bar, one tick at a time),
// and complete pre-session history is prepended so a constant `windowCount`
// bars always show: at the session open the window reaches back into prior
// sessions instead of starting nearly empty, with the playhead pinned to the
// right edge like a rewound live chart. Kept a module function so the React
// Compiler memoizes it on its args.
function buildReplayBars(
  sessionCandles: ReplayCandle[],
  histBars: CandleBar[],
  cursorTs: string | null,
  bucketMinutes: number,
  windowCount: number,
): CandleBar[] {
  const cursorMs = cursorTs ? Date.parse(cursorTs) : Number.POSITIVE_INFINITY;
  const reached: CandleBar[] = [];
  let sessionStartMs = Number.POSITIVE_INFINITY;
  for (const c of sessionCandles) {
    if (c.open == null || c.high == null || c.low == null || c.close == null) continue;
    const t = Date.parse(c.timestamp);
    if (!Number.isFinite(t)) continue;
    if (t < sessionStartMs) sessionStartMs = t;
    if (t > cursorMs) continue;
    const up = c.close >= c.open;
    const vol = c.volume ?? 0;
    const hasSplit = c.up_volume != null && c.down_volume != null;
    const upVolume = hasSplit ? (c.up_volume as number) : up ? vol : 0;
    const downVolume = hasSplit ? (c.down_volume as number) : up ? 0 : vol;
    reached.push({
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: upVolume + downVolume,
      upVolume,
      downVolume,
    });
  }
  if (reached.length === 0) return EMPTY_BARS;
  // Complete history strictly before the session open — the fill-back that keeps
  // the bar count constant. Filtered here so the session comes only from the
  // authoritative replay candles (no double-count at the seam).
  const fill = histBars.filter((b) => {
    const t = Date.parse(b.timestamp);
    return Number.isFinite(t) && t < sessionStartMs;
  });
  return aggregateBars([...fill, ...reached], bucketMinutes, windowCount);
}

interface PairCandleChartProps {
  symbol: string;
  timeframe: ChartTimeframe;
  /** Optional label override for the chart heading (defaults to the symbol). */
  label?: string;
  /** Render flush (no card border/background) so it can sit inside a shell. */
  embedded?: boolean;
  /** When provided + active, the chart scrubs the replay session in lockstep. */
  replay?: CandleReplay;
}

export default function PairCandleChart({ symbol, timeframe, label, embedded = false, replay }: PairCandleChartProps) {
  const isMobile = useIsMobile();
  const { data: quote } = useMarketQuote(symbol, 1000);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const replayActive = replay?.active ?? false;

  // Both-axis zoom/pan view: xZoom = fraction of bars visible (1 = all), xPan =
  // bars hidden on the right, yZoom = price-band multiplier (1 = auto-fit), yPan
  // = fractional vertical shift. Wheel zooms time (Shift = price) toward the
  // cursor; drag pans both.
  const [view, setView] = useState({ xZoom: 1, xPan: 0, yZoom: 1, yPan: 0 });
  const dragRef = useRef<{ startPx: number; startPy: number; startXPan: number; startYPan: number; moved: boolean } | null>(null);
  const wheelCleanupRef = useRef<null | (() => void)>(null);
  // Live geometry snapshot for the imperative wheel handler (so it never needs
  // to re-subscribe and never reads stale closures).
  const ctxRef = useRef({
    total: 0, startIdx: 0, xStep: 1, effLo: 0, effHi: 1, fitCenter: 0, fitHalf: 1,
    width: 1100, height: 440, padLeft: 60, padTop: 18, plotW: 1, plotH: 1, plotX0: 67, innerW: 1, minBars: 6,
  });
  const clipId = `pcc-clip-${useId().replace(/[^a-zA-Z0-9-]/g, "")}`;

  const intervalMinutes =
    timeframe === "1min" ? 1 : timeframe === "5min" ? 5 : timeframe === "15min" ? 15 : timeframe === "1hr" ? 60 : 1440;

  const { rows: dataAll, loading, error } = useMarketHistorical(symbol, timeframe);
  const data = useMemo(() => dataAll.slice(-MAX_POINTS), [dataAll]);

  // Stage 1 — aggregate the historical rows (independent of the live tick).
  const historicalBars = useMemo(
    () => aggregateBars(normalizeRows(data), intervalMinutes, MAX_POINTS),
    [data, intervalMinutes],
  );

  // Stage 2 — reconcile the live quote with the historical tip bar. Same
  // bucket-scoped, monotonic-widening, history-authoritative rules as
  // UnderlyingCandlesChart (see that file for the full rationale).
  const liveBars = useMemo(() => {
    if (historicalBars.length === 0) return historicalBars;
    const liveClose = quote?.close ?? null;
    if (liveClose == null || !quote?.session || quote.session === "closed") {
      return historicalBars;
    }
    const tip = historicalBars[historicalBars.length - 1];
    const bucketMs = intervalMinutes * 60 * 1000;
    const tipStartMs = new Date(tip.timestamp).getTime();
    if (!Number.isFinite(tipStartMs)) return historicalBars;
    const tipEndMs = tipStartMs + bucketMs;

    const quoteTsMs = quote.timestamp ? new Date(quote.timestamp).getTime() : NaN;
    if (!Number.isFinite(quoteTsMs) || quoteTsMs < tipStartMs || quoteTsMs >= tipEndMs) {
      return historicalBars;
    }
    if (liveClose === tip.close) return historicalBars;

    const patched = historicalBars.slice();
    patched[patched.length - 1] = {
      ...tip,
      close: liveClose,
      high: Math.max(tip.high, liveClose),
      low: Math.min(tip.low, liveClose),
    };
    return patched;
  }, [historicalBars, quote, intervalMinutes]);

  // Replay reveals the session up to the playhead and prepends the full
  // historical cache (~hundreds of bars) as pre-session fill so a constant
  // window always shows; live uses the reconciled live bars.
  const fullHistBars = replayActive ? normalizeRows(dataAll) : EMPTY_BARS;
  const replayBars = replayActive
    ? buildReplayBars(replay?.candles ?? EMPTY_REPLAY_CANDLES, fullHistBars, replay?.cursorTs ?? null, intervalMinutes, MAX_POINTS)
    : EMPTY_BARS;
  const bars = replayActive ? replayBars : liveBars;

  const dateMarkers = useMemo(() => {
    const markers: Array<{ index: number; label: string; key: string }> = [];
    let previousDateKey = "";
    bars.forEach((bar, index) => {
      const dt = new Date(bar.timestamp);
      const dateKey = dt.toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      if (dateKey === previousDateKey) return;
      previousDateKey = dateKey;
      markers.push({
        index,
        key: bar.timestamp,
        label: dt.toLocaleDateString("en-US", {
          timeZone: "America/New_York",
          month: "short",
          day: "numeric",
        }),
      });
    });
    return markers;
  }, [bars]);

  // ── Layout (price only; the volume panel was removed) ──
  const width = 1100;
  const height = timeframe === "1day" ? 480 : 440;
  const padLeft = 60;
  // Show dealer-gamma levels on the candles in BOTH live and replay; reserve a
  // right gutter for their value tags so the labels sit beside the candles, not
  // over them. If no level is available the gutter collapses.
  const hasLevels =
    !!replay?.levels &&
    LEVEL_LINES.some((l) => {
      const v = replay.levels[l.key];
      return v != null && Number.isFinite(v);
    });
  const padRight = hasLevels ? 64 : 16;
  const padTop = 18;
  const priceAreaBottom = height - 42;
  const plotW = width - padLeft - padRight;
  const plotH = priceAreaBottom - padTop;
  const MIN_BARS = 6;

  // ── Visible window (time zoom + pan) ──
  const total = bars.length;
  const visibleCount = Math.max(Math.min(MIN_BARS, total), Math.min(total, Math.round(total * view.xZoom)));
  const maxPanBars = Math.max(0, total - visibleCount);
  const panBars = clamp(Math.round(view.xPan), 0, maxPanBars);
  const endIdx = total - panBars;
  const startIdx = Math.max(0, endIdx - visibleCount);
  const visibleBars = bars.slice(startIdx, endIdx);
  const vLen = visibleBars.length;
  // Inset the candle plotting area by a half-candle margin on each side so the
  // first and last candle bodies render fully instead of being clipped in half
  // at the plot edges. Grid/level lines still span the full [padLeft, width-padRight].
  const edgeInset = 7;
  const plotX0 = padLeft + edgeInset;
  const innerW = Math.max(1, plotW - 2 * edgeInset);
  const xStep = innerW / Math.max(1, vLen - 1);
  const candleWidth = Math.max(2, Math.min(12, xStep * 0.6));
  const xForVis = (i: number) => plotX0 + i * xStep;

  // ── Price band (auto-fit the visible bars, then apply Y zoom/pan) ──
  let priceLo = Number.POSITIVE_INFINITY;
  let priceHi = Number.NEGATIVE_INFINITY;
  for (const b of visibleBars) {
    if (b.low < priceLo) priceLo = b.low;
    if (b.high > priceHi) priceHi = b.high;
  }
  if (!Number.isFinite(priceLo) || !Number.isFinite(priceHi) || priceHi <= priceLo) {
    const midp = Number.isFinite(priceLo) ? priceLo : 0;
    priceLo = midp - 1;
    priceHi = midp + 1;
  }
  const basePad = (priceHi - priceLo) * 0.06 || 1;
  const fitLo = priceLo - basePad;
  const fitHi = priceHi + basePad;
  const fitCenter = (fitLo + fitHi) / 2;
  const fitHalf = (fitHi - fitLo) / 2;
  const bandCenter = fitCenter + view.yPan * (fitHi - fitLo);
  const bandHalf = Math.max(1e-6, fitHalf * view.yZoom);
  const effLo = bandCenter - bandHalf;
  const effHi = bandCenter + bandHalf;
  const yPrice = (p: number) => padTop + (1 - (p - effLo) / Math.max(1e-9, effHi - effLo)) * plotH;
  const priceAxis = niceAxis(effLo, effHi, 5);

  // Hover target stored as a GLOBAL bar index so it survives zoom/pan.
  const fallbackIdx = Math.max(0, total - 1);
  const resolvedIdx = hoveredIdx !== null ? clamp(hoveredIdx, 0, fallbackIdx) : fallbackIdx;
  const hovered = bars[resolvedIdx] ?? null;
  const hoverVis = resolvedIdx - startIdx;
  const showHoverLine = hoveredIdx !== null && hoverVis >= 0 && hoverVis < vLen;

  const isZoomed =
    view.xZoom < 0.999 || view.xPan > 0.001 || Math.abs(view.yZoom - 1) > 0.001 || Math.abs(view.yPan) > 0.001;

  // Keep the wheel handler's geometry snapshot fresh (post-commit; wheel events
  // are user-driven, so there's no lag).
  useEffect(() => {
    ctxRef.current = { total, startIdx, xStep, effLo, effHi, fitCenter, fitHalf, width, height, padLeft, padTop, plotW, plotH, plotX0, innerW, minBars: MIN_BARS };
  });

  // Wheel zoom via a callback ref so it attaches when the SVG actually mounts
  // (after the loading/empty states); { passive: false } lets us stop page scroll.
  const attachSvg = useCallback((node: SVGSVGElement | null) => {
    if (wheelCleanupRef.current) {
      wheelCleanupRef.current();
      wheelCleanupRef.current = null;
    }
    if (!node) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const c = ctxRef.current;
      const rect = node.getBoundingClientRect();
      const px = ((e.clientX - rect.left) / Math.max(1, rect.width)) * c.width;
      const py = ((e.clientY - rect.top) / Math.max(1, rect.height)) * c.height;
      const zoomIn = e.deltaY < 0;
      if (e.shiftKey) {
        setView((prev) => {
          const factor = zoomIn ? 0.85 : 1 / 0.85;
          const newYZoom = clamp(prev.yZoom * factor, 0.05, 5);
          const frac = clamp((py - c.padTop) / Math.max(1e-9, c.plotH), 0, 1);
          const priceAtCursor = c.effHi - frac * (c.effHi - c.effLo);
          const half2 = c.fitHalf * newYZoom;
          const center2 = priceAtCursor + half2 * (2 * frac - 1);
          const newYPan = c.fitHalf > 0 ? (center2 - c.fitCenter) / (c.fitHalf * 2) : 0;
          return { ...prev, yZoom: newYZoom, yPan: clamp(newYPan, -6, 6) };
        });
      } else {
        setView((prev) => {
          const factor = zoomIn ? 0.82 : 1 / 0.82;
          const minZoom = c.total > 0 ? Math.min(1, c.minBars / c.total) : 1;
          const newXZoom = clamp(prev.xZoom * factor, minZoom, 1);
          const newVisible = Math.max(c.minBars, Math.min(c.total, Math.round(c.total * newXZoom)));
          const idxAtCursor = c.startIdx + (px - c.plotX0) / Math.max(1e-9, c.xStep);
          const newXStep = c.innerW / Math.max(1, newVisible - 1);
          const newStart = idxAtCursor - (px - c.plotX0) / Math.max(1e-9, newXStep);
          const newPan = c.total - (newStart + newVisible);
          const maxPan2 = Math.max(0, c.total - newVisible);
          return { ...prev, xZoom: newXZoom, xPan: clamp(newPan, 0, maxPan2) };
        });
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    wheelCleanupRef.current = () => node.removeEventListener("wheel", onWheel);
  }, []);

  const beginDrag = (e: MouseEvent<SVGSVGElement>) => {
    dragRef.current = { startPx: e.clientX, startPy: e.clientY, startXPan: panBars, startYPan: view.yPan, moved: false };
  };
  const handleMove = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const d = dragRef.current;
    if (d) {
      const dxPx = e.clientX - d.startPx;
      const dyPx = e.clientY - d.startPy;
      if (Math.abs(dxPx) > 2 || Math.abs(dyPx) > 2) d.moved = true;
      const dxView = (dxPx / Math.max(1, rect.width)) * width;
      const dyView = (dyPx / Math.max(1, rect.height)) * height;
      const barsDelta = dxView / Math.max(1e-9, xStep);
      setView((prev) => {
        const vc = Math.max(Math.min(MIN_BARS, total), Math.min(total, Math.round(total * prev.xZoom)));
        const maxPan2 = Math.max(0, total - vc);
        const yPanDelta = (dyView / Math.max(1e-9, plotH)) * prev.yZoom;
        return { ...prev, xPan: clamp(d.startXPan + barsDelta, 0, maxPan2), yPan: clamp(d.startYPan + yPanDelta, -6, 6) };
      });
      return;
    }
    const xView = ((e.clientX - rect.left) / Math.max(1, rect.width)) * width;
    const iVis = Math.round((xView - plotX0) / Math.max(1e-9, xStep));
    setHoveredIdx(startIdx + clamp(iVis, 0, Math.max(0, vLen - 1)));
  };
  const endDrag = () => {
    dragRef.current = null;
  };
  const handleLeave = () => {
    dragRef.current = null;
    setHoveredIdx(null);
  };
  const resetView = () => setView({ xZoom: 1, xPan: 0, yZoom: 1, yPan: 0 });
  const zoomTime = (dir: 1 | -1) =>
    setView((prev) => {
      const factor = dir > 0 ? 0.7 : 1 / 0.7;
      const minZoom = total > 0 ? Math.min(1, MIN_BARS / total) : 1;
      return { ...prev, xZoom: clamp(prev.xZoom * factor, minZoom, 1) };
    });

  const heading = label ?? quote?.symbol ?? symbol;
  // Embedded charts sit inside a shell, so they drop their own card chrome and
  // render flush; standalone charts keep the bordered card.
  const cardStyle = embedded
    ? {}
    : { backgroundColor: "var(--bg-card)", border: "1px solid var(--border-default)" };
  const cardClass = embedded ? "" : "rounded-lg";
  const showLoading = (replayActive ? replay?.loading : loading) && bars.length === 0;

  if (showLoading) {
    return (
      <div className={`${cardClass} p-6`} style={cardStyle}>
        <LoadingSpinner />
      </div>
    );
  }
  if (!replayActive && error) {
    return (
      <div className={`${cardClass} p-6`} style={cardStyle}>
        <ErrorMessage message={error} />
      </div>
    );
  }
  if (bars.length === 0) {
    return (
      <div className={`${cardClass} p-6 text-center`} style={{ ...cardStyle, color: "var(--text-secondary)" }}>
        {replayActive ? `No replay data for ${symbol}` : `No ${symbol} timeseries data available`}
      </div>
    );
  }

  const isLive = quote?.session && quote.session !== "closed";
  const headerClose = replayActive ? bars[bars.length - 1]?.close ?? null : quote?.close ?? null;
  const badge = replayActive
    ? { text: "REPLAY", color: "var(--color-accent-hot)", bg: "color-mix(in srgb, var(--color-accent-hot) 16%, transparent)" }
    : isLive
      ? { text: "LIVE", color: "var(--color-bull)", bg: "var(--color-bull-soft)" }
      : { text: "CLOSED", color: "var(--text-muted)", bg: "var(--color-surface-subtle)" };

  return (
    <div className={`${cardClass} p-4`} style={cardStyle}>
      <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{heading}</h3>
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ color: badge.color, backgroundColor: badge.bg }}
          >
            {badge.text}
          </span>
          {headerClose != null && (
            <span className="text-sm font-mono" style={{ color: "var(--text-secondary)" }}>
              ${headerClose.toFixed(2)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hovered && (
            <div
              className="text-[11px] rounded px-2 py-1 font-mono pointer-events-none whitespace-nowrap"
              style={{
                backgroundColor: "var(--color-chart-tooltip-bg)",
                border: "1px solid var(--color-border)",
                color: "var(--color-chart-tooltip-text)",
              }}
            >
              O {hovered.open.toFixed(2)} · H {hovered.high.toFixed(2)} · L {hovered.low.toFixed(2)} · C {hovered.close.toFixed(2)}
            </div>
          )}
          <div className="inline-flex overflow-hidden rounded-md" style={{ border: "1px solid var(--border-default)" }} role="group" aria-label="Zoom controls">
            <button type="button" onClick={() => zoomTime(-1)} title="Zoom out (time)" aria-label="Zoom out" className="px-2 py-1 transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-secondary)" }}>
              <ZoomOut size={13} />
            </button>
            <button type="button" onClick={() => zoomTime(1)} title="Zoom in (time)" aria-label="Zoom in" className="px-2 py-1 transition-colors hover:bg-[var(--bg-hover)]" style={{ color: "var(--text-secondary)", borderLeft: "1px solid var(--border-default)" }}>
              <ZoomIn size={13} />
            </button>
            <button type="button" onClick={resetView} disabled={!isZoomed} title="Reset zoom" aria-label="Reset zoom" className="px-2 py-1 transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed" style={{ color: "var(--text-secondary)", borderLeft: "1px solid var(--border-default)" }}>
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      </div>
      <MobileScrollableChart>
        <div className="relative w-full">
          <svg
            ref={attachSvg}
            width="100%"
            height="100%"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMinYMin meet"
            style={{ aspectRatio: `${width} / ${height}`, cursor: "crosshair" }}
            className="block w-full select-none"
            onMouseDown={beginDrag}
            onMouseMove={handleMove}
            onMouseUp={endDrag}
            onMouseLeave={handleLeave}
          >
            <defs>
              <clipPath id={clipId}>
                <rect x={padLeft} y={padTop} width={plotW} height={plotH} />
              </clipPath>
            </defs>

            <text x="13" y={(padTop + priceAreaBottom) / 2} transform={`rotate(-90, 13, ${(padTop + priceAreaBottom) / 2})`} fontSize="11" fill="var(--text-secondary)">
              Price
            </text>

            {priceAxis.ticks.map((price) => {
              const y = yPrice(price);
              if (y < padTop - 0.5 || y > priceAreaBottom + 0.5) return null;
              return (
                <g key={`p-${price}`}>
                  <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="var(--text-secondary)" opacity={0.18} />
                  <text x={padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-secondary)">
                    {priceLabel(price, priceAxis.step)}
                  </text>
                </g>
              );
            })}

            {/* Price-dependent marks are clipped to the plot box so a Y-zoom never
                spills past the axes. */}
            <g clipPath={`url(#${clipId})`}>
              {visibleBars.map((b, i) => {
                const x = xForVis(i);
                const prevClose = i > 0 ? visibleBars[i - 1].close : startIdx > 0 ? bars[startIdx - 1].close : b.open;
                const isUp = b.close > prevClose;
                const isHollow = b.close > b.open;
                const col = isUp ? "var(--color-bull)" : "var(--color-bear)";
                const openY = yPrice(b.open);
                const closeY = yPrice(b.close);
                const highY = yPrice(b.high);
                const lowY = yPrice(b.low);
                const bodyY = Math.min(openY, closeY);
                const bodyH = Math.max(1, Math.abs(openY - closeY));
                return (
                  <g key={b.timestamp}>
                    {/* Upper + lower wicks only — no segment across the body, so a
                        hollow (up) candle doesn't show a line through its middle. */}
                    <line x1={x} x2={x} y1={highY} y2={bodyY} stroke={col} strokeWidth={1} />
                    <line x1={x} x2={x} y1={bodyY + bodyH} y2={lowY} stroke={col} strokeWidth={1} />
                    <rect
                      x={x - candleWidth / 2}
                      y={bodyY}
                      width={candleWidth}
                      height={bodyH}
                      fill={isHollow ? "transparent" : col}
                      stroke={col}
                      strokeWidth={1}
                    />
                  </g>
                );
              })}

              {showHoverLine && (
                <line
                  x1={xForVis(hoverVis)}
                  x2={xForVis(hoverVis)}
                  y1={padTop}
                  y2={priceAreaBottom}
                  stroke="var(--text-secondary)"
                  opacity={0.5}
                  strokeDasharray="3,3"
                  pointerEvents="none"
                />
              )}
            </g>

            {/* Dealer-gamma levels (spot / flip / walls / max pain) on the
                candles, live and replay — the line spans the candle area; the
                value tag lives in the right margin (outside the clip) so labels
                never overlap the candles. */}
            {LEVEL_LINES.map(({ key, code, color }) => {
                const v = replay?.levels?.[key];
                if (v == null || !Number.isFinite(v) || v < effLo || v > effHi) return null;
                const y = yPrice(v);
                const tagX = width - padRight + 3;
                const tagW = padRight - 6;
                return (
                  <g key={`lvl-${key}`}>
                    <line x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke={color} strokeWidth={1} strokeDasharray="5 3" opacity={0.85} />
                    <rect x={tagX} y={y - 7} width={tagW} height={14} rx={2} fill={`color-mix(in srgb, ${color} 16%, var(--bg-card))`} stroke={color} strokeWidth={0.75} />
                    <text x={tagX + tagW / 2} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight={700} fontFamily="var(--font-mono)" fill={color}>
                      {code} {v.toFixed(Math.abs(v) >= 1000 ? 0 : 2)}
                    </text>
                  </g>
                );
              })}

            {/* Time axis — day separators for visible bars + spaced time/date labels. */}
            {(() => {
              const els: ReactNode[] = [];
              for (const marker of dateMarkers) {
                const vi = marker.index - startIdx;
                if (vi < 0 || vi >= vLen) continue;
                const x = xForVis(vi);
                els.push(<line key={`dsep-${marker.key}`} x1={x} x2={x} y1={padTop} y2={priceAreaBottom} stroke="var(--text-secondary)" opacity={0.2} />);
              }
              let lastLabeledX = Number.NEGATIVE_INFINITY;
              const minGap = isMobile ? 64 : 46;
              visibleBars.forEach((b, i) => {
                const x = xForVis(i);
                if (x - lastLabeledX < minGap) return;
                lastLabeledX = x;
                const dt = new Date(b.timestamp);
                const lbl =
                  timeframe === "1day"
                    ? dt.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })
                    : dt.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
                els.push(
                  <text key={`xl-${b.timestamp}`} x={x} y={priceAreaBottom + 16} fontSize={isMobile ? "8" : "10"} textAnchor="middle" fill="var(--text-secondary)">
                    {lbl}
                  </text>,
                );
              });
              return els;
            })()}

            <line x1={padLeft} x2={width - padRight} y1={priceAreaBottom} y2={priceAreaBottom} stroke="var(--text-secondary)" opacity={0.4} />
          </svg>
        </div>
      </MobileScrollableChart>
    </div>
  );
}
