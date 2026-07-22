"use client";

/**
 * GammaTerminalChart — ZeroGEX's proprietary price + dealer-gamma instrument.
 *
 * The whole reason this exists (and the reason it beats a generic price chart):
 * it fuses live candles with the dealer-gamma structure we compute nowhere
 * else. On one surface a trader sees WHERE price is AND where the market makers
 * are forced to trade against it — the Gamma Flip regime boundary, the Call and
 * Put Walls, Max Pain, and a price-aligned gamma-structure rail (a silhouette of
 * net dealer gamma by price, so the "walls" show up as literal bars beside the
 * candles). No public charting tool draws this because no public charting tool
 * has the positioning engine behind it.
 *
 * Rendering is hand-rolled SVG (no chart lib) for three reasons: pixel control
 * over the gamma overlays, zero new dependencies, and full theme reactivity —
 * every color is a CSS custom property, so the instrument re-skins instantly
 * across all twelve ZeroGEX palettes in light and dark.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { Activity, ChevronsRight, Crosshair, Info, Pause, Play, Repeat, Rewind } from "lucide-react";
import { useMarketQuote, useGEXProfile, useGEXSummary, useSessionCloses, type SessionClosesData } from "@/hooks/useApiData";
import { useMarketHistorical, type PriceBar } from "@/hooks/useMarketHistorical";
import { useStrikeProfileTimeseries, type StrikeProfileStrike } from "@/hooks/useStrikeProfileTimeseries";
import { useTechnicals } from "@/hooks/useTechnicals";
import { useTimeframe, type UnderlyingSymbol } from "@/core/TimeframeContext";
import { getPrimaryPriceChangeSummary } from "@/core/priceChange";
import { omitClosedMarketTimes, isIndexSymbol, isWithinRegularMarketHours } from "@/core/utils";
import { SYMBOLS } from "@/core/symbols";
import { useIsMobile } from "@/hooks/useIsMobile";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import MobileScrollableChart from "./MobileScrollableChart";

type ChartTimeframe = "1min" | "5min" | "15min" | "1hr" | "1day";
type PriceStyle = "candles" | "line" | "area";

const TIMEFRAMES: Array<{ value: ChartTimeframe; label: string; minutes: number }> = [
  { value: "1min", label: "1m", minutes: 1 },
  { value: "5min", label: "5m", minutes: 5 },
  { value: "15min", label: "15m", minutes: 15 },
  { value: "1hr", label: "1H", minutes: 60 },
  { value: "1day", label: "1D", minutes: 1440 },
];

// The interval one step finer than each candle, used to build the growing
// replay candle smoothly (same idea as /replay: a 5-min candle plays at 1-min
// resolution). 1-min has no finer supported interval, so it replays per-candle.
const SUB_INTERVAL: Record<ChartTimeframe, ChartTimeframe | null> = {
  "1min": null,
  "5min": "1min",
  "15min": "5min",
  "1hr": "15min",
  "1day": "1hr",
};
const tfMinutes = (tf: ChartTimeframe): number => TIMEFRAMES.find((t) => t.value === tf)?.minutes ?? 5;

interface Bar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  upVolume: number;
  downVolume: number;
}

interface OverlayState {
  levels: boolean; // gamma flip + call/put walls
  maxPain: boolean;
  vwap: boolean;
  rail: boolean; // gamma structure rail
  regime: boolean; // long/short gamma background zones
}

const DEFAULT_OVERLAYS: OverlayState = {
  levels: true,
  maxPain: true,
  vwap: true,
  rail: true,
  regime: true,
};

const OVERLAY_STORAGE_KEY = "zg.gammaChart.overlays.v1";
const STYLE_STORAGE_KEY = "zg.gammaChart.style.v1";

// ── Geometry (SVG viewBox coordinates; the SVG scales to its container) ──────
const VW = 1360;
const VH = 636;
const PAD_TOP = 46;
const PRICE_BOTTOM = 486;
const VOL_TOP = 508;
const VOL_BOTTOM = 586;
const TIME_AXIS_Y = 604; // clock-time row
const DATE_AXIS_Y = 620; // grouped trading-date row, below the times
const PLOT_LEFT = 16;
const PLOT_RIGHT = 1092;
const INNER_PAD_X = 12; // left inset before the first bar
// Right-side gutter reserved between the newest bar and the price axis, so the
// last candle is never hidden under the wall / gamma / last-price tags that
// sit on the axis. (Grid + level lines still run the full width to PLOT_RIGHT;
// only the bars are inset.)
const PAD_RIGHT = 82;
const AXIS_COL_X = PLOT_RIGHT + 10; // right-hand price axis / tag column

// View window (zoom + pan). We keep a deep pool of bars in memory and show a
// movable slice of it; the price axis auto-fits whatever is visible.
const POOL = 400; // bars retained for panning
const DEFAULT_COUNT = 90; // bars shown in the default, live-following view
const MIN_COUNT = 18; // most zoomed-in (time)
const ZOOM_FACTOR = 1.2;
// Vertical (price-axis) zoom. `zoom` is the fraction of the auto-fit price
// range shown: <1 stretches the candles (zoom in), >1 scrunches them (more
// range in the same height). `center` is null while auto-fitting, or a pinned
// price once the user scrunches / pans vertically.
const PRICE_ZOOM_MIN = 0.15;
const PRICE_ZOOM_MAX = 8;
const DEFAULT_PRICE_VIEW: { zoom: number; center: number | null } = { zoom: 1, center: null };
const RAIL_LEFT = 1190;
const RAIL_RIGHT = 1348;
const RAIL_CENTER = (RAIL_LEFT + RAIL_RIGHT) / 2;
const RAIL_HALF = (RAIL_RIGHT - RAIL_LEFT) / 2 - 10;

// ── Numeric helpers (shared shape with UnderlyingCandlesChart) ───────────────
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
  step: number;
}

function niceAxis(min: number, max: number, targetTicks: number): NiceAxis {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return { ticks: [Number.isFinite(min) ? min : 0], step: 1 };
  }
  const step = niceStep((max - min) / Math.max(1, targetTicks - 1));
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const count = Math.max(1, Math.round((niceMax - niceMin) / step) + 1);
  const ticks: number[] = [];
  for (let i = 0; i < count; i++) ticks.push(niceMin + i * step);
  return { ticks, step };
}

// SPY, QQQ and SPX all trade in cents, so every price readout uses two
// decimals. Rounding to whole dollars (as a $1+ tick step would imply)
// collapses a sub-dollar candle's O/H/L/C onto a single integer and reads as
// broken — the axis grid can be coarse, but the numbers a trader reads cannot.
function fmtPrice(p: number): string {
  return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtVol(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${Math.round(v)}`;
}

function fmtGex(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+" : "−";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function aggregateBars(data: Bar[], bucketMinutes: number, maxPoints: number): Bar[] {
  if (data.length === 0) return [];
  const sorted = [...data].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets = new Map<number, Bar[]>();
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
      const upVolume = bars.reduce((s, b) => s + b.upVolume, 0);
      const downVolume = bars.reduce((s, b) => s + b.downVolume, 0);
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

interface ProfilePoint {
  price: number;
  gex: number;
}

/**
 * A frozen, server-fetched view of everything the chart needs. Passed to the
 * chart for the public "delayed" mode: when present, the component renders from
 * it and does ZERO client-side fetching (all live hooks are disabled), so a
 * public visitor can never pull real-time data off the wire. Built on the
 * server from ~15-min ISR-cached `serverApiGet` calls.
 */
export interface ChartSnapshot {
  symbol: string;
  timeframe: ChartTimeframe;
  generatedAt: string | null;
  bars: PriceBar[];
  quote: {
    close: number | null;
    session: string | null;
    timestamp: string | null;
    display_source?: string | null;
    futures_close?: number | null;
    futures_reference_close?: number | null;
  } | null;
  sessionCloses: SessionClosesData | null;
  gamma: { flip: number | null; callWall: number | null; putWall: number | null; maxPain: number | null; netGexAtSpot: number | null };
  /** Cumulative GEX-profile curve (fallback rail source). */
  profile: ProfilePoint[];
  /** Per-strike net gamma for the delayed rail, so the public view draws the
   *  same net-gamma-by-strike density the live/rewind rail does. */
  strikes?: StrikeProfileStrike[] | null;
  vwap: number | null;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function GammaTerminalChart({
  className = "",
  snapshot = null,
  delayed: delayedProp = false,
}: {
  className?: string;
  snapshot?: ChartSnapshot | null;
  /** Force delayed (public) mode even without a snapshot, so a failed snapshot
   *  fetch degrades to an empty delayed chart rather than live client polling. */
  delayed?: boolean;
}) {
  const delayed = delayedProp || !!snapshot;
  const live = !delayed;
  const { symbol: ctxSymbol, setSymbol } = useTimeframe();
  const symbol = snapshot ? snapshot.symbol : ctxSymbol;
  const isMobile = useIsMobile();
  const [timeframeState, setTimeframe] = useState<ChartTimeframe>("5min");
  const timeframe = snapshot ? snapshot.timeframe : timeframeState;
  const [style, setStyle] = useState<PriceStyle>("candles");
  const [overlays, setOverlays] = useState<OverlayState>(DEFAULT_OVERLAYS);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<{ count: number; offset: number }>({ count: DEFAULT_COUNT, offset: 0 });
  const [priceView, setPriceView] = useState<{ zoom: number; center: number | null }>(DEFAULT_PRICE_VIEW);

  // ── Rewind (session replay) ── Live-only. When active the chart freezes at
  // `rewindTime` and shows price + dealer gamma "as it looked" then; playback
  // steps the anchor forward. The gamma structure comes from the strike-profile
  // timeseries (only fetched once rewind is entered, so it adds no idle load).
  const [rewindActive, setRewindActive] = useState(false);
  const [rewindTime, setRewindTime] = useState<number | null>(null);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 4 | 16>(1);
  // Sticky preference: when on, playback wraps back to the earliest replayable
  // bar at the live edge instead of stopping (kept across enter/exit rewind).
  const [playbackLoop, setPlaybackLoop] = useState(false);
  // Vertical domain captured when rewind is entered. While rewinding we freeze
  // the y-axis to this instead of re-fitting to the scrubbed bars, so the price
  // scale never jumps as you scrub — the user still zooms/pans it by hand.
  const [frozenAxis, setFrozenAxis] = useState<{ mid: number; half: number } | null>(null);

  // Snap the view back to the live default whenever the instrument or timeframe
  // changes. This is the React-sanctioned "adjust state during render on a prop
  // change" pattern (same shape the data hooks use), so it needs no effect.
  const [viewKey, setViewKey] = useState(`${symbol}:${timeframe}`);
  if (viewKey !== `${symbol}:${timeframe}`) {
    setViewKey(`${symbol}:${timeframe}`);
    setView({ count: DEFAULT_COUNT, offset: 0 });
    setPriceView(DEFAULT_PRICE_VIEW);
    setRewindActive(false);
    setRewindTime(null);
    setPlaybackActive(false);
    setFrozenAxis(null);
  }

  // Restore persisted view preferences once on mount. Server and the first
  // client render intentionally use the defaults; we only reconcile from
  // localStorage after mount so there is no hydration mismatch. The rule below
  // guards against cascading-render setState in effects, which is exactly (and
  // only) what this one-time hydration does on purpose.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const rawO = localStorage.getItem(OVERLAY_STORAGE_KEY);
      if (rawO) setOverlays((cur) => ({ ...cur, ...JSON.parse(rawO) }));
      const rawS = localStorage.getItem(STYLE_STORAGE_KEY);
      if (rawS === "candles" || rawS === "line" || rawS === "area") setStyle(rawS);
    } catch {
      /* ignore malformed prefs */
    }
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(OVERLAY_STORAGE_KEY, JSON.stringify(overlays));
    } catch {
      /* storage unavailable */
    }
  }, [overlays, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STYLE_STORAGE_KEY, style);
    } catch {
      /* storage unavailable */
    }
  }, [style, hydrated]);

  const intervalMinutes = TIMEFRAMES.find((t) => t.value === timeframe)?.minutes ?? 5;

  // ── Data ── Live mode polls the API; delayed mode renders a frozen server
  // snapshot and does zero client fetching (every hook disabled via `live`).
  // allow_futures only for NON-index symbols. ETFs (SPY/QQQ) trade extended
  // hours, so opting in returns their after-hours bars — the fix for "not live
  // after hours". Cash indexes (SPX/NDX) don't trade past the cash close and we
  // deliberately do NOT swap in their future: the chart just freezes at the
  // 16:00 ET close until the next cash session opens.
  const symbolIsIndex = isIndexSymbol(symbol);
  const { rows: liveRows, loading: liveLoading, error: liveError } = useMarketHistorical(symbol, timeframe, !symbolIsIndex, live);
  const { data: quote } = useMarketQuote(symbol, 1000, live);
  const { data: liveSessionCloses } = useSessionCloses(symbol, 60000, quote?.session ?? null, live);
  const { data: gexProfile } = useGEXProfile(symbol, 10000, live);
  const { data: gexSummary } = useGEXSummary(symbol, 5000, live);
  const technicals = useTechnicals(symbol, live);
  // Per-strike dealer gamma over time. Enabled for the whole live session (not
  // just rewind) so the live rail is drawn from the SAME per-strike source the
  // rewind rail uses — the two now read identically. Paused (no 1s tip poll)
  // while rewinding since we hold it frozen; polled otherwise so the live tip
  // stays fresh. Never enabled in delayed mode (the snapshot supplies strikes).
  // Pinned to 5-min buckets; anchors resolve by timestamp so they align with
  // candles of any timeframe. Seeding here also makes entering rewind instant.
  const { buckets: gexBuckets } = useStrikeProfileTimeseries(symbol, "5min", "all", rewindActive, live);

  const dataAll = snapshot ? snapshot.bars : liveRows;
  const loading = snapshot ? false : liveLoading;
  const error = snapshot ? null : liveError;
  const liveClose = snapshot ? snapshot.quote?.close ?? null : quote?.close ?? null;
  const session = snapshot ? snapshot.quote?.session ?? null : quote?.session ?? null;
  const quoteTs = snapshot ? snapshot.quote?.timestamp ?? null : quote?.timestamp ?? null;
  const sessionCloses = snapshot ? snapshot.sessionCloses : liveSessionCloses;

  const data = useMemo(() => dataAll.slice(-POOL), [dataAll]);

  // ── Sub-interval bars for SMOOTH candle replay ── While rewinding a
  // candlestick chart, the current (right-edge) candle is rebuilt from the
  // next-finer interval up to the replay clock, so it grows sub-step by sub-step
  // instead of snapping in fully formed (the /replay technique, generalized to
  // every timeframe). Only fetched while it's needed: live + rewinding + candles
  // + a finer interval exists (1-min has none, so it replays per-candle).
  const subTf = SUB_INTERVAL[timeframe];
  const subEnabled = live && rewindActive && style === "candles" && subTf != null;
  const { rows: subRowsRaw } = useMarketHistorical(symbol, subTf ?? timeframe, !symbolIsIndex, subEnabled);
  const subBars = useMemo(() => {
    if (!subEnabled) return [] as Array<{ ms: number; open: number; high: number; low: number; close: number; up: number; down: number }>;
    const rows = omitClosedMarketTimes(subRowsRaw || [], (d) => d.timestamp);
    return rows
      .map((d) => {
        const close = Number(d.close ?? d.price ?? 0);
        const open = Number(d.open ?? close);
        const high = Number(d.high ?? Math.max(open, close));
        const low = Number(d.low ?? Math.min(open, close));
        const volume = Number(d.volume ?? 0);
        const apiUp = d.up_volume ?? null;
        const apiDown = d.down_volume ?? null;
        const isUp = close >= open;
        const up = apiUp != null && apiDown != null ? Number(apiUp) : isUp ? volume : 0;
        const down = apiUp != null && apiDown != null ? Number(apiDown) : isUp ? 0 : volume;
        return { ms: new Date(d.timestamp).getTime(), open, high, low, close, up, down };
      })
      .filter((b) => Number.isFinite(b.ms))
      .sort((a, b) => a.ms - b.ms);
  }, [subEnabled, subRowsRaw]);

  // Stage 1 — normalize + aggregate history (expensive; independent of the tick).
  const historicalBars = useMemo(() => {
    const filtered = omitClosedMarketTimes(data || [], (d) => d.timestamp);
    const seed = filtered[0]?.close ?? filtered[0]?.price ?? 0;
    const normalized = filtered.reduce(
      (acc, d) => {
        const close = d.close ?? d.price ?? acc.prevClose;
        const open = d.open ?? acc.prevClose;
        const high = d.high ?? Math.max(open, close);
        const low = d.low ?? Math.min(open, close);
        const volume = d.volume ?? 0;
        const apiUp = d.up_volume ?? null;
        const apiDown = d.down_volume ?? null;
        const up = close >= open;
        const upVolume = apiUp !== null && apiDown !== null ? apiUp : up ? volume : 0;
        const downVolume = apiUp !== null && apiDown !== null ? apiDown : up ? 0 : volume;
        acc.rows.push({ timestamp: d.timestamp, open, high, low, close, volume: upVolume + downVolume, upVolume, downVolume });
        acc.prevClose = close;
        return acc;
      },
      { rows: [] as Bar[], prevClose: seed },
    );
    return aggregateBars(normalized.rows, intervalMinutes, POOL);
  }, [data, intervalMinutes]);

  // Stage 2 — overlay the live tick onto the tip bar (same bucket-scoped,
  // history-authoritative rules proven out in UnderlyingCandlesChart). This is
  // the full pool; the visible window is sliced from it below.
  const allBars = useMemo(() => {
    if (historicalBars.length === 0) return historicalBars;
    if (delayed || rewindActive || liveClose == null || !session || session === "closed") return historicalBars;
    const tip = historicalBars[historicalBars.length - 1];
    const bucketMs = intervalMinutes * 60 * 1000;
    const tipStartMs = new Date(tip.timestamp).getTime();
    if (!Number.isFinite(tipStartMs)) return historicalBars;
    const tipEndMs = tipStartMs + bucketMs;
    const quoteTsMs = quoteTs ? new Date(quoteTs).getTime() : NaN;
    if (!Number.isFinite(quoteTsMs) || quoteTsMs < tipStartMs || quoteTsMs >= tipEndMs) return historicalBars;
    if (liveClose === tip.close) return historicalBars;
    const patched = historicalBars.slice();
    patched[patched.length - 1] = {
      ...tip,
      close: liveClose,
      high: Math.max(tip.high, liveClose),
      low: Math.min(tip.low, liveClose),
    };
    return patched;
  }, [historicalBars, liveClose, session, quoteTs, intervalMinutes, delayed, rewindActive]);

  // ── Zoom + pan: derive the visible window from the view state. `offset` is
  // how many bars are hidden to the RIGHT of the view (0 = live edge, so the
  // window follows new bars). `count` is how many bars are visible.
  const total = allBars.length;
  const effCount = total === 0 ? 0 : clamp(view.count, MIN_COUNT, Math.max(MIN_COUNT, total));
  const maxOffset = Math.max(0, total - effCount);
  const effOffset = clamp(view.offset, 0, maxOffset);

  // ── Rewind window bounds ── The strike-profile timeseries only covers the
  // recent session(s). Index the buckets by time and find the earliest pool bar
  // it covers. Rewind may never go left of that bar (walls/flip/rail would have
  // no data there) nor so far that fewer than a full screen of candles remains —
  // so the SAME number of candles is always on screen at any zoom/interval.
  const gexByTs = useMemo(() => {
    const m = new Map<number, (typeof gexBuckets)[number]>();
    for (const b of gexBuckets) {
      const t = new Date(b.timestamp).getTime();
      if (Number.isFinite(t)) m.set(t, b);
    }
    return m;
  }, [gexBuckets]);
  const gexMinTs = useMemo(() => {
    let m = Infinity;
    for (const t of gexByTs.keys()) if (t < m) m = t;
    return Number.isFinite(m) ? m : null;
  }, [gexByTs]);
  const firstGexIdx = useMemo(() => {
    if (gexMinTs == null) return null;
    for (let i = 0; i < allBars.length; i++) {
      const t = new Date(allBars[i].timestamp).getTime();
      if (Number.isFinite(t) && t >= gexMinTs) return i;
    }
    return allBars.length > 0 ? allBars.length - 1 : null;
  }, [gexMinTs, allBars]);
  // Left bound for the rewind anchor (its right-edge bar index): keep a full
  // window of `effCount` candles AND stay within the GEX-covered range.
  const rewindMinIdx = Math.max(
    0,
    Math.min(Math.max(0, total - 1), Math.max(effCount - 1, firstGexIdx ?? effCount - 1)),
  );

  // Rewind pins the window's right edge to the bar CONTAINING `rewindTime` (the
  // floor bucket — so the replay clock can sit part-way through the current
  // candle while it builds), clamped into the replayable range; live view pins
  // it to the newest bar (minus pan).
  const rewindEdgeIdx = useMemo(() => {
    if (!rewindActive || rewindTime == null || allBars.length === 0) return null;
    let idx = 0;
    for (let i = 0; i < allBars.length; i++) {
      const t = new Date(allBars[i].timestamp).getTime();
      if (!Number.isFinite(t)) continue;
      if (t <= rewindTime) idx = i;
      else break;
    }
    return clamp(idx, rewindMinIdx, Math.max(0, allBars.length - 1));
  }, [rewindActive, rewindTime, allBars, rewindMinIdx]);

  const viewEnd = rewindEdgeIdx != null ? Math.min(total, rewindEdgeIdx + 1) : total - effOffset;
  const viewStart = Math.max(0, viewEnd - effCount);

  // The right-edge candle rebuilt from sub-interval bars up to the replay clock,
  // so it GROWS during playback instead of snapping in fully formed. Null when
  // not applicable (line/area style, no sub-data, or 1-min) → the full candle is
  // used as-is.
  const partialCurrentBar = useMemo<Bar | null>(() => {
    if (!rewindActive || style !== "candles" || rewindEdgeIdx == null || rewindTime == null || subBars.length === 0) return null;
    const cur = allBars[rewindEdgeIdx];
    if (!cur) return null;
    const startMs = new Date(cur.timestamp).getTime();
    const endMs = startMs + intervalMinutes * 60 * 1000;
    const limit = Math.min(rewindTime, endMs - 1);
    let open: number | null = null;
    let close: number | null = null;
    let high = -Infinity;
    let low = Infinity;
    let up = 0;
    let down = 0;
    for (const s of subBars) {
      if (s.ms < startMs) continue;
      if (s.ms > limit || s.ms >= endMs) break;
      if (open == null) open = s.open;
      close = s.close;
      if (s.high > high) high = s.high;
      if (s.low < low) low = s.low;
      up += s.up;
      down += s.down;
    }
    if (open == null || close == null) return null;
    return {
      timestamp: cur.timestamp,
      open,
      high: Number.isFinite(high) ? high : Math.max(open, close),
      low: Number.isFinite(low) ? low : Math.min(open, close),
      close,
      volume: up + down,
      upVolume: up,
      downVolume: down,
    };
  }, [rewindActive, style, rewindEdgeIdx, rewindTime, subBars, allBars, intervalMinutes]);

  const bars = useMemo(() => {
    const base = allBars.slice(viewStart, viewEnd);
    if (partialCurrentBar && base.length > 0) {
      const copy = base.slice();
      copy[copy.length - 1] = partialCurrentBar;
      return copy;
    }
    return base;
  }, [allBars, viewStart, viewEnd, partialCurrentBar]);
  const atLiveEdge = !rewindActive && effOffset === 0;
  const isCustomView =
    view.offset !== 0 || view.count !== DEFAULT_COUNT || priceView.zoom !== 1 || priceView.center !== null;

  // The gamma structure at the rewound moment: the exact bucket for the anchor
  // bar if one exists (aligned timeframes), else the nearest bucket in time.
  // Keyed off the CLAMPED anchor, so it tracks the bar actually on the right
  // edge — that's why the walls / flip now move as you scrub.
  const rewindBucket = useMemo(() => {
    if (!rewindActive || rewindTime == null || gexBuckets.length === 0) return null;
    const exact = gexByTs.get(rewindTime);
    if (exact) return exact;
    let best: (typeof gexBuckets)[number] | null = null;
    let bestDist = Infinity;
    for (const b of gexBuckets) {
      const t = new Date(b.timestamp).getTime();
      if (!Number.isFinite(t)) continue;
      const d = Math.abs(t - rewindTime);
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    return best;
  }, [rewindActive, rewindTime, gexBuckets, gexByTs]);

  // Session-anchored VWAP for the rewound moment, computed from the pool bars
  // (Σ typical-price × volume ÷ Σ volume over the anchor bar's regular session,
  // up to that bar). The timeseries doesn't carry VWAP, so rather than hide it
  // during rewind we reconstruct it — it reads as the live VWAP would have at
  // that time. Null when there's no volume to weight by.
  const rewindVwap = useMemo(() => {
    if (!rewindActive || rewindEdgeIdx == null) return null;
    const anchor = allBars[rewindEdgeIdx];
    if (!anchor) return null;
    const day = etDayKey(anchor.timestamp);
    let pv = 0;
    let vol = 0;
    for (let i = 0; i <= rewindEdgeIdx; i++) {
      const b = allBars[i];
      if (etDayKey(b.timestamp) !== day || !isWithinRegularMarketHours(b.timestamp)) continue;
      const v = Number(b.volume) || 0;
      if (v <= 0) continue;
      pv += ((b.high + b.low + b.close) / 3) * v;
      vol += v;
    }
    return vol > 0 ? pv / vol : null;
  }, [rewindActive, rewindEdgeIdx, allBars]);

  // ── Gamma levels ── Rewind takes flip/walls from the historical bucket, Max
  // Pain from the bucket's per-strike OI and VWAP from the bars; net-GEX-at-spot
  // isn't recoverable from the timeseries, so it's hidden while rewinding.
  const flip = rewindBucket
    ? coerceNum(rewindBucket.gamma_flip)
    : snapshot ? snapshot.gamma.flip : num(gexProfile?.gamma_flip ?? gexSummary?.gamma_flip);
  const callWall = rewindBucket
    ? coerceNum(rewindBucket.call_wall)
    : snapshot ? snapshot.gamma.callWall : num(gexProfile?.call_wall ?? gexSummary?.call_wall);
  const putWall = rewindBucket
    ? coerceNum(rewindBucket.put_wall)
    : snapshot ? snapshot.gamma.putWall : num(gexProfile?.put_wall ?? gexSummary?.put_wall);
  // Max Pain isn't a stored field on the timeseries buckets, but their
  // per-strike open interest is — so during rewind we recover the historical
  // Max Pain from that OI (textbook min-writer-payout strike) instead of
  // dropping it. Live/delayed paths use the served value.
  const maxPain = rewindActive
    ? rewindBucket
      ? computeMaxPain(rewindBucket.strikes)
      : null
    : snapshot ? snapshot.gamma.maxPain : num(gexSummary?.max_pain);
  const netGexAtSpot = rewindActive ? null : snapshot ? snapshot.gamma.netGexAtSpot : num(gexProfile?.net_gex_at_spot ?? gexSummary?.net_gex);
  const vwap = rewindActive ? rewindVwap : snapshot ? snapshot.vwap : num(technicals.latest?.vwap_deviation?.vwap);

  // The most-recent per-strike bucket that actually carries gamma — the live
  // rail's source. Walk back from the tip so an empty / all-zero after-hours
  // bucket doesn't blank the rail (the last real surface stays drawn).
  const liveGexBucket = useMemo(() => {
    for (let i = gexBuckets.length - 1; i >= 0; i--) {
      const b = gexBuckets[i];
      if (Array.isArray(b.strikes) && b.strikes.some((s) => coerceNum(s.net_gamma))) return b;
    }
    return null;
  }, [gexBuckets]);

  const profilePoints = useMemo<ProfilePoint[]>(() => {
    // The rail is a Gaussian-smoothed net-gamma-by-strike density (two lobes at
    // the put-side / call-side walls). Live and rewind draw from the SAME
    // per-strike source (the strike-profile timeseries) so they render
    // identically — only the bucket differs (the rewound moment vs the live
    // tip). Raw per-strike values are discrete and sign-alternating between
    // neighbours, so rewindRailCurve smooths them into the clean silhouette.
    const strikeBucket = rewindBucket ?? (live ? liveGexBucket : null);
    if (strikeBucket) return rewindRailCurve(strikeBucket.strikes);
    // Delayed snapshot: per-strike if present, else the served cumulative curve.
    if (snapshot) return snapshot.strikes ? rewindRailCurve(snapshot.strikes) : snapshot.profile;
    // Fallback while the timeseries seeds: the cumulative GEX-profile curve.
    const raw = gexProfile?.profile;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((p) => ({ price: Number(p.price), gex: Number(p.gex) }))
      .filter((p) => Number.isFinite(p.price) && Number.isFinite(p.gex))
      .sort((a, b) => a.price - b.price);
  }, [gexProfile, snapshot, rewindBucket, liveGexBucket, live]);

  // ── Price/change readout ─────────────────────────────────────────────────
  const priceSummary = getPrimaryPriceChangeSummary({
    quoteClose: snapshot ? snapshot.quote?.close : quote?.close,
    quoteSession: session,
    sessionCloses,
    displaySource: snapshot ? snapshot.quote?.display_source : quote?.display_source,
    futuresClose: snapshot ? snapshot.quote?.futures_close : quote?.futures_close,
    futuresReferenceClose: snapshot ? snapshot.quote?.futures_reference_close : quote?.futures_reference_close,
  });

  // ── Crosshair state ──────────────────────────────────────────────────────
  const [hover, setHover] = useState<{ idx: number; price: number; px: number; py: number; w: number; h: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startOffset: number;
    startCenter: number;
    startSpan: number;
    startPriceManual: boolean;
    startZoom: number;
    axisZone: boolean;
    priceEngaged: boolean;
    moved: boolean;
  } | null>(null);
  const [dragging, setDragging] = useState(false);
  // True while dragging the right-hand price scale (vertical zoom) or hovering
  // over it — drives the ns-resize cursor, TradingView-style.
  const [axisZoomActive, setAxisZoomActive] = useState(false);
  const [overAxis, setOverAxis] = useState(false);

  // ── Domain / scales ──────────────────────────────────────────────────────
  const layout = useMemo(() => {
    if (bars.length === 0) return null;
    const lows = bars.map((b) => b.low);
    const highs = bars.map((b) => b.high);
    let dMin = Math.min(...lows);
    let dMax = Math.max(...highs);
    const barSpan = Math.max(dMax - dMin, dMax * 0.001, 0.01);
    // Fold in gamma levels that sit within ~1.2 bar-spans of the tape so the
    // walls/flip stay visible without a far Max Pain blowing out the scale.
    const band = barSpan * 1.2;
    const includable = [flip, callWall, putWall, vwap].filter((v): v is number => v != null);
    for (const v of includable) {
      if (v >= dMin - band && v <= dMax + band) {
        dMin = Math.min(dMin, v);
        dMax = Math.max(dMax, v);
      }
    }
    const pad = (dMax - dMin) * 0.06 || dMax * 0.01;
    dMin -= pad;
    dMax += pad;

    // Auto-fit domain complete. Apply the manual vertical zoom/pan on top:
    // scrunch by priceView.zoom around a center (priceView.center, or the
    // auto midpoint while still auto-fitting).
    const autoMin = dMin;
    const autoMax = dMax;
    const autoMid = (autoMin + autoMax) / 2;
    const autoHalf = Math.max((autoMax - autoMin) / 2, 1e-6);
    // While rewinding, freeze the vertical scale to the domain captured at
    // rewind entry so scrubbing never moves the y-axis; live view fits to the
    // visible bars. Manual zoom/pan (priceView) still applies on top of either.
    const frozen = rewindActive ? frozenAxis : null;
    const baseMid = frozen ? frozen.mid : autoMid;
    const baseHalf = frozen ? frozen.half : autoHalf;
    const half = baseHalf * priceView.zoom;
    const center = priceView.center ?? baseMid;
    dMin = center - half;
    dMax = center + half;

    const n = bars.length;
    // Asymmetric insets: a small left pad, and a wide right gutter (PAD_RIGHT)
    // so the newest bar sits clear of the axis price tags.
    const xStep = (PLOT_RIGHT - PLOT_LEFT - INNER_PAD_X - PAD_RIGHT) / Math.max(1, n - 1);
    const candleWidth = Math.max(2, Math.min(15, xStep * 0.62));
    const maxVol = Math.max(...bars.map((b) => b.volume), 1);
    const priceAxis = niceAxis(dMin, dMax, 6);

    const xForIndex = (i: number) => PLOT_LEFT + INNER_PAD_X + i * xStep;
    const yPrice = (p: number) => PAD_TOP + (1 - (p - dMin) / (dMax - dMin)) * (PRICE_BOTTOM - PAD_TOP);
    const priceForY = (y: number) => dMin + (1 - (y - PAD_TOP) / (PRICE_BOTTOM - PAD_TOP)) * (dMax - dMin);
    const yVol = (v: number) => VOL_BOTTOM - (v / maxVol) * (VOL_BOTTOM - VOL_TOP);

    return { dMin, dMax, autoMid, autoHalf, xStep, candleWidth, maxVol, priceAxis, xForIndex, yPrice, priceForY, yVol, n };
  }, [bars, flip, callWall, putWall, vwap, priceView.zoom, priceView.center, rewindActive, frozenAxis]);

  // Rail silhouette geometry (net dealer gamma by price, aligned to the y-axis).
  const rail = useMemo(() => {
    if (!layout || profilePoints.length < 2) return null;
    const pts = profilePoints.filter((p) => p.price >= layout.dMin && p.price <= layout.dMax);
    if (pts.length < 2) return null;
    const maxAbs = Math.max(...pts.map((p) => Math.abs(p.gex)), 1);
    const xFor = (gex: number) => RAIL_CENTER + clamp(gex / maxAbs, -1, 1) * RAIL_HALF;
    const yFor = (price: number) => layout.yPrice(price);

    const posPath =
      `M ${RAIL_CENTER} ${yFor(pts[0].price)} ` +
      pts.map((p) => `L ${xFor(Math.max(0, p.gex)).toFixed(1)} ${yFor(p.price).toFixed(1)}`).join(" ") +
      ` L ${RAIL_CENTER} ${yFor(pts[pts.length - 1].price)} Z`;
    const negPath =
      `M ${RAIL_CENTER} ${yFor(pts[0].price)} ` +
      pts.map((p) => `L ${xFor(Math.min(0, p.gex)).toFixed(1)} ${yFor(p.price).toFixed(1)}`).join(" ") +
      ` L ${RAIL_CENTER} ${yFor(pts[pts.length - 1].price)} Z`;
    const edge = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.gex).toFixed(1)} ${yFor(p.price).toFixed(1)}`).join(" ");

    // Peaks — the call-side and put-side extrema (the literal "walls").
    let callPeak = pts[0];
    let putPeak = pts[0];
    for (const p of pts) {
      if (p.gex > callPeak.gex) callPeak = p;
      if (p.gex < putPeak.gex) putPeak = p;
    }
    return { pts, maxAbs, xFor, yFor, posPath, negPath, edge, callPeak, putPeak };
  }, [layout, profilePoints]);

  // Interpolate net dealer gamma at an arbitrary price (for the crosshair).
  const gexAtPrice = useCallback(
    (price: number): number | null => {
      const pts = profilePoints;
      if (pts.length === 0) return null;
      if (price <= pts[0].price) return pts[0].gex;
      if (price >= pts[pts.length - 1].price) return pts[pts.length - 1].gex;
      for (let i = 1; i < pts.length; i++) {
        if (price <= pts[i].price) {
          const a = pts[i - 1];
          const b = pts[i];
          const t = (price - a.price) / Math.max(1e-9, b.price - a.price);
          return a.gex + t * (b.gex - a.gex);
        }
      }
      return pts[pts.length - 1].gex;
    },
    [profilePoints],
  );

  // Day-boundary separators for the time axis.
  const dateMarkers = useMemo(() => {
    const markers: Array<{ index: number; label: string }> = [];
    let prevKey = "";
    bars.forEach((bar, index) => {
      const dt = new Date(bar.timestamp);
      const key = dt.toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
      if (key === prevKey) return;
      prevKey = key;
      markers.push({ index, label: dt.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }) });
    });
    return markers;
  }, [bars]);

  // Contiguous runs of visible bars that share an ET trading date, so a single
  // date label can be centered under each day's span (the row below the times).
  const dateGroups = useMemo(() => {
    const groups: Array<{ startIdx: number; endIdx: number; label: string }> = [];
    const keyFmt = (ts: string) => new Date(ts).toLocaleDateString("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
    const labelFmt = (ts: string) => new Date(ts).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });
    let curKey = "";
    let start = 0;
    bars.forEach((b, i) => {
      const key = keyFmt(b.timestamp);
      if (i === 0) {
        curKey = key;
        start = 0;
      } else if (key !== curKey) {
        groups.push({ startIdx: start, endIdx: i - 1, label: labelFmt(bars[start].timestamp) });
        curKey = key;
        start = i;
      }
    });
    if (bars.length > 0) groups.push({ startIdx: start, endIdx: bars.length - 1, label: labelFmt(bars[start].timestamp) });
    return groups;
  }, [bars]);

  const handlePointerDown = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = (e.clientX - rect.left) * (VW / Math.max(1, rect.width));
    // A drag that starts on the right-hand price scale zooms the y-axis
    // (TradingView-style) rather than panning.
    const axisZone = vx > PLOT_RIGHT && vx < RAIL_LEFT;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffset: effOffset,
      startCenter: layout ? (layout.dMin + layout.dMax) / 2 : 0,
      startSpan: layout ? layout.dMax - layout.dMin : 1,
      startPriceManual: priceView.center !== null || priceView.zoom !== 1,
      startZoom: priceView.zoom,
      axisZone,
      priceEngaged: false,
      moved: false,
    };
    if (axisZone) setAxisZoomActive(true);
  };

  const handlePointerMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!layout || bars.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const drag = dragRef.current;
    if (drag) {
      const dxScreen = e.clientX - drag.startX;
      const dyScreen = e.clientY - drag.startY;
      // Price-scale drag → vertical zoom about the current center. Drag up
      // zooms in (candles stretch), drag down zooms out (compress).
      if (drag.axisZone) {
        if (!drag.moved && Math.abs(dyScreen) > 2) {
          drag.moved = true;
          setDragging(true);
          setHover(null);
        }
        if (drag.moved) {
          const factor = Math.exp(dyScreen * 0.006);
          const nextZoom = clamp(drag.startZoom * factor, PRICE_ZOOM_MIN, PRICE_ZOOM_MAX);
          setPriceView((pv) => (pv.zoom === nextZoom ? pv : { zoom: nextZoom, center: pv.center }));
        }
        return;
      }
      if (!drag.moved && Math.hypot(dxScreen, dyScreen) > 3) {
        drag.moved = true;
        setDragging(true);
        setHover(null);
      }
      if (drag.moved) {
        // Horizontal → time pan. Dragging the tape right reveals older bars.
        const dxView = dxScreen * (VW / Math.max(1, rect.width));
        const dBars = Math.round(dxView / Math.max(1e-9, layout.xStep));
        const nextOffset = clamp(drag.startOffset + dBars, 0, maxOffset);
        setView((v) => (v.offset === nextOffset ? v : { ...v, offset: nextOffset }));

        // Vertical → price pan. Keep price auto-fitting during ordinary
        // horizontal panning; only engage manual price mode once the user has
        // already scrunched, or the gesture turns clearly vertical.
        const verticalGesture = Math.abs(dyScreen) > Math.abs(dxScreen) && Math.abs(dyScreen) > 6;
        if (drag.startPriceManual || drag.priceEngaged || verticalGesture) {
          drag.priceEngaged = true;
          const dyView = dyScreen * (VH / Math.max(1, rect.height));
          const dPrice = (dyView * drag.startSpan) / (PRICE_BOTTOM - PAD_TOP);
          const lo = layout.autoMid - layout.autoHalf * 6;
          const hi = layout.autoMid + layout.autoHalf * 6;
          const nextCenter = clamp(drag.startCenter + dPrice, lo, hi);
          setPriceView((pv) => (pv.center === nextCenter ? pv : { zoom: pv.zoom, center: nextCenter }));
        }
        return;
      }
    }
    const vx = (e.clientX - rect.left) * (VW / Math.max(1, rect.width));
    const vy = (e.clientY - rect.top) * (VH / Math.max(1, rect.height));
    // Over the price scale (not dragging): show the ns-resize affordance and
    // suppress the crosshair, so the drag-to-zoom target reads clearly.
    const inAxis = vx > PLOT_RIGHT && vx < RAIL_LEFT;
    if (inAxis) {
      if (!overAxis) setOverAxis(true);
      setHover(null);
      return;
    }
    if (overAxis) setOverAxis(false);
    const idx = Math.round((vx - PLOT_LEFT - INNER_PAD_X) / Math.max(1e-9, layout.xStep));
    const clampedIdx = Math.max(0, Math.min(bars.length - 1, idx));
    const price = layout.priceForY(clamp(vy, PAD_TOP, PRICE_BOTTOM));
    setHover({ idx: clampedIdx, price, px: e.clientX - rect.left, py: e.clientY - rect.top, w: rect.width, h: rect.height });
  };

  const endDrag = () => {
    dragRef.current = null;
    if (dragging) setDragging(false);
    if (axisZoomActive) setAxisZoomActive(false);
  };

  const handlePointerLeave = () => {
    setHover(null);
    if (overAxis) setOverAxis(false);
    endDrag();
  };

  const resetView = () => {
    setView({ count: DEFAULT_COUNT, offset: 0 });
    setPriceView(DEFAULT_PRICE_VIEW);
    setHover(null);
  };

  // Time zoom about the current view center (used by the on-screen buttons).
  const zoomTimeCentered = (factor: number) => {
    setHover(null);
    setView((v) => {
      if (total <= 1) return v;
      const curCount = clamp(v.count, MIN_COUNT, Math.max(MIN_COUNT, total));
      const curOffset = clamp(v.offset, 0, Math.max(0, total - curCount));
      const center = total - curOffset - curCount / 2;
      const newCount = clamp(Math.round(curCount * factor), MIN_COUNT, total);
      const newStart = Math.round(center - newCount / 2);
      const newOffset = clamp(total - (newStart + newCount), 0, Math.max(0, total - newCount));
      return { count: newCount, offset: newOffset };
    });
  };

  // Vertical (price) zoom — scrunch/expand about the current center.
  const zoomPrice = (factor: number) => {
    setPriceView((pv) => ({ zoom: clamp(pv.zoom * factor, PRICE_ZOOM_MIN, PRICE_ZOOM_MAX), center: pv.center }));
  };

  // Wheel: over the candles → time zoom (anchored on the bar under the cursor);
  // over the price axis / rail, or with Shift held → vertical price zoom.
  // Attached natively with { passive: false } so preventDefault actually stops
  // the page from scrolling (React's synthetic onWheel can be passive).
  useEffect(() => {
    const el = svgRef.current;
    if (!el || total <= 1) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const vx = (e.clientX - rect.left) * (VW / Math.max(1, rect.width));
      const factor = e.deltaY < 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
      if (e.shiftKey || vx > PLOT_RIGHT) {
        setPriceView((pv) => ({ zoom: clamp(pv.zoom * factor, PRICE_ZOOM_MIN, PRICE_ZOOM_MAX), center: pv.center }));
        return;
      }
      setHover(null);
      const curCount = clamp(view.count, MIN_COUNT, Math.max(MIN_COUNT, total));
      const curOffset = clamp(view.offset, 0, Math.max(0, total - curCount));
      const curEnd = total - curOffset;
      const curStart = Math.max(0, curEnd - curCount);
      const curVisible = Math.max(1, curEnd - curStart);
      const curXStep = (PLOT_RIGHT - PLOT_LEFT - INNER_PAD_X - PAD_RIGHT) / Math.max(1, curVisible - 1);
      const rel = clamp((vx - PLOT_LEFT - INNER_PAD_X) / Math.max(1e-9, curXStep), 0, curVisible - 1);
      const cursorAbs = curStart + rel;
      const f = curVisible > 1 ? rel / (curVisible - 1) : 0.5;
      const newCount = clamp(Math.round(curCount * factor), MIN_COUNT, total);
      const newStart = Math.round(cursorAbs - f * (newCount - 1));
      const newOffset = clamp(total - (newStart + newCount), 0, Math.max(0, total - newCount));
      setView({ count: newCount, offset: newOffset });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view.count, view.offset, total]);

  // ── Rewind controls ──────────────────────────────────────────────────────
  // Keep the latest bars in a ref so the playback interval can read them
  // without being torn down and recreated on every live tick.
  const allBarsRef = useRef(allBars);
  const rewindTimeRef = useRef(rewindTime);
  const rewindMinIdxRef = useRef(rewindMinIdx);
  const playbackLoopRef = useRef(playbackLoop);
  const subBarsRef = useRef(subBars);
  useEffect(() => {
    allBarsRef.current = allBars;
    rewindTimeRef.current = rewindTime;
    rewindMinIdxRef.current = rewindMinIdx;
    playbackLoopRef.current = playbackLoop;
    subBarsRef.current = subBars;
  });

  const enterRewind = () => {
    if (allBars.length < MIN_COUNT) return;
    // Freeze the y-axis to the current auto-fit domain so scrubbing doesn't move
    // it (the user can still adjust it by hand afterwards).
    if (layout) setFrozenAxis({ mid: layout.autoMid, half: layout.autoHalf });
    // Anchor at the earliest replayable bar (full window + GEX coverage) so Play
    // has the longest runway. Set the clock to that candle's END so it opens on
    // a fully-formed candle; playback then builds the next one forward.
    const startIdx = clamp(allBars.length - 1 - Math.max(effCount, 60), rewindMinIdx, allBars.length - 1);
    setRewindTime(barStartMs(allBars, startIdx) + intervalMinutes * 60 * 1000 - 1);
    setRewindActive(true);
    setPlaybackActive(false);
    setHover(null);
  };

  const exitRewind = () => {
    setRewindActive(false);
    setRewindTime(null);
    setPlaybackActive(false);
    setFrozenAxis(null);
    setView((v) => ({ ...v, offset: 0 }));
  };

  // Scrub lands on a fully-formed candle (clock = the candle's end), so dragging
  // shows each candle complete; Play then builds forward from there.
  const scrubToIndex = (idx: number) => {
    const arr = allBarsRef.current;
    if (arr.length === 0) return;
    const clamped = clamp(idx, rewindMinIdx, arr.length - 1);
    setRewindTime(barStartMs(arr, clamped) + intervalMinutes * 60 * 1000 - 1);
    setPlaybackActive(false);
  };

  // Playback. For a candlestick chart on a timeframe with a finer interval, the
  // clock advances by that SUB-interval (walking real sub-bars, so session gaps
  // are skipped) and the right-edge candle grows smoothly; otherwise (line/area,
  // or 1-min) it advances one full candle per step. The per-candle pace is held
  // roughly constant (~700ms/candle at 1×) regardless of how many sub-steps that
  // candle is built from. Reads bars/anchor/subs from refs so the interval isn't
  // recreated on every tick, and calls setState directly so it stays pure.
  useEffect(() => {
    if (!rewindActive || !playbackActive) return;
    const bucketMs = intervalMinutes * 60 * 1000;
    const smooth = style === "candles" && subTf != null;
    const subMs = smooth && subTf ? tfMinutes(subTf) * 60 * 1000 : bucketMs;
    const stepsPerCandle = Math.max(1, Math.round(bucketMs / subMs));
    // Target one candle every ~700ms / speed, spread across its sub-steps. Past
    // MIN_TICK the tick rate is capped and we advance MULTIPLE units per tick
    // instead — so 4× and 16× stay genuinely 4×/16× (a plain tick-rate cut would
    // floor them to the same speed) without flooding React with re-renders.
    const MIN_TICK = 60;
    const msPerUnit = 700 / stepsPerCandle / playbackSpeed;
    const unitsPerTick = Math.max(1, Math.ceil(MIN_TICK / msPerUnit));
    const tickMs = Math.max(MIN_TICK, Math.round(msPerUnit * unitsPerTick));
    const id = setInterval(() => {
      const arr = allBarsRef.current;
      const subs = subBarsRef.current;
      const prev = rewindTimeRef.current;
      const minIdx = rewindMinIdxRef.current;
      if (arr.length === 0 || prev == null) return;
      // Smooth mode with sub-bars not yet loaded: hold until they arrive rather
      // than fast-forwarding whole candles at the sub-step tick rate.
      if (smooth && subs.length === 0) return;
      const lastIdx = arr.length - 1;
      const liveEdge = barStartMs(arr, lastIdx) + bucketMs - 1;
      let next: number | null;
      if (smooth) {
        // Advance unitsPerTick real sub-bars past the clock (skips closed-hours
        // gaps, since sub-bars are session-only).
        let startI = -1;
        for (let i = 0; i < subs.length; i++) {
          if (subs[i].ms > prev) {
            startI = i;
            break;
          }
        }
        next = startI < 0 ? null : subs[Math.min(subs.length - 1, startI + unitsPerTick - 1)].ms;
      } else {
        // Per-candle: jump unitsPerTick candles forward (to the candle's end).
        let idx = 0;
        for (let i = 0; i < arr.length; i++) {
          const t = barStartMs(arr, i);
          if (Number.isFinite(t) && t <= prev) idx = i;
          else break;
        }
        next = idx >= lastIdx ? null : barStartMs(arr, Math.min(lastIdx, idx + unitsPerTick)) + bucketMs - 1;
      }
      if (next == null || next > liveEdge) {
        // Reached the live edge: loop back to the earliest replayable candle and
        // keep playing, or (loop off) stop pinned to the latest bar.
        if (playbackLoopRef.current && minIdx < lastIdx) {
          setRewindTime(barStartMs(arr, minIdx));
        } else {
          setPlaybackActive(false);
          setRewindTime(liveEdge);
        }
        return;
      }
      // Never fall left of the replayable range.
      const minTime = barStartMs(arr, minIdx);
      setRewindTime(next < minTime ? minTime : next);
    }, tickMs);
    return () => clearInterval(id);
  }, [rewindActive, playbackActive, playbackSpeed, style, subTf, intervalMinutes]);

  // ── Loading / error / empty ──────────────────────────────────────────────
  if (loading && bars.length === 0) {
    return (
      <div className={`zg-feature-shell ${className}`} style={{ minHeight: 420, display: "grid", placeItems: "center" }}>
        <LoadingSpinner />
      </div>
    );
  }
  if (error && bars.length === 0) {
    return (
      <div className={`zg-feature-shell ${className}`} style={{ padding: 24 }}>
        <ErrorMessage message={error} />
      </div>
    );
  }
  if (!layout || bars.length === 0) {
    return (
      <div className={`zg-feature-shell ${className}`} style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)" }}>
        No price data available for {symbol}
      </div>
    );
  }

  const { xForIndex, yPrice, yVol, priceAxis, candleWidth, xStep } = layout;
  const lastBar = bars[bars.length - 1];
  const lastIdx = bars.length - 1;
  // The true latest bar (pool tip) — used for the accent "last price" line and
  // tag so they stay anchored to the current price even when panned into
  // history, where the last *visible* bar is older.
  const liveTip = allBars[allBars.length - 1] ?? lastBar;
  // Clamp to the visible range: a zoom can shrink bars.length while a stale
  // hover index from the previous (wider) window is still set, and indexing
  // bars[activeIdx - 1] out of range below would otherwise throw.
  const activeIdx = hover ? Math.max(0, Math.min(hover.idx, bars.length - 1)) : lastIdx;
  const activeBar = bars[activeIdx] ?? lastBar;
  const activePrevClose = activeIdx > 0 ? bars[activeIdx - 1].close : activeBar.open;
  // During rewind, "spot" is the rewound bar's close (so the regime read
  // reflects that moment); otherwise it's the live price.
  const spot = rewindActive ? lastBar.close : priceSummary.displayPrice ?? liveTip.close;

  const inDomain = (v: number | null): v is number => v != null && v >= layout.dMin && v <= layout.dMax;
  const regimeUnknown = flip == null;
  const longGammaNow = netGexAtSpot != null ? netGexAtSpot >= 0 : flip != null && spot >= flip;

  // Level definitions rendered as reference lines + right-axis tags.
  type LevelDef = { key: string; label: string; value: number | null; color: string; dash: string; show: boolean };
  const levelDefs: LevelDef[] = [
    { key: "flip", label: "FLIP", value: flip, color: "var(--heat-mid)", dash: "7 4", show: overlays.levels },
    { key: "call", label: "CALL WALL", value: callWall, color: "var(--color-bull)", dash: "3 4", show: overlays.levels },
    { key: "put", label: "PUT WALL", value: putWall, color: "var(--color-bear)", dash: "3 4", show: overlays.levels },
    { key: "pain", label: "MAX PAIN", value: maxPain, color: "var(--color-gold)", dash: "1 5", show: overlays.maxPain },
    { key: "vwap", label: "VWAP", value: vwap, color: "var(--color-hazy)", dash: "6 5", show: overlays.vwap },
  ];

  // Confluence: is spot pinned to a level (within 0.12%)? Emphasize if so.
  const confluenceKey = (() => {
    let best: { key: string; d: number } | null = null;
    for (const l of levelDefs) {
      if (!l.show || l.value == null) continue;
      const d = Math.abs(l.value - spot) / Math.max(1e-9, spot);
      if (d < 0.0012 && (!best || d < best.d)) best = { key: l.key, d };
    }
    return best?.key ?? null;
  })();

  // Left-side level name chips, de-collided horizontally: when two chips would
  // land on the same line they're placed side by side (each shifted right past
  // any already-placed chip it vertically overlaps) instead of stacking on top
  // of each other. Only in-domain levels get a chip; out-of-range levels are
  // shown by their arrowed axis tag alone.
  const chipPlacements = (() => {
    const CHIP_H = 16;
    const GAP = 5;
    const visible = levelDefs
      .filter((l): l is LevelDef & { value: number } => l.show && l.value != null && inDomain(l.value))
      .map((l) => ({ key: l.key, label: l.label, color: l.color, y: clamp(yPrice(l.value), PAD_TOP + 1, PRICE_BOTTOM - 1), w: labelWidth(l.label) }))
      .sort((a, b) => a.y - b.y);
    const placed: Array<{ key: string; label: string; color: string; y: number; w: number; x: number }> = [];
    for (const c of visible) {
      let x = PLOT_LEFT + 6;
      for (const p of placed) {
        if (Math.abs(p.y - c.y) < CHIP_H) x = Math.max(x, p.x + p.w + GAP);
      }
      placed.push({ ...c, x });
    }
    return placed;
  })();

  // Line/area path for the close series (used by line + area styles).
  const closePath = bars.map((b, i) => `${i === 0 ? "M" : "L"} ${xForIndex(i).toFixed(1)} ${yPrice(b.close).toFixed(1)}`).join(" ");
  const areaPath = `${closePath} L ${xForIndex(lastIdx).toFixed(1)} ${PRICE_BOTTOM} L ${xForIndex(0).toFixed(1)} ${PRICE_BOTTOM} Z`;
  const seriesUp = lastBar.close >= bars[0].open;
  const seriesColor = seriesUp ? "var(--color-bull)" : "var(--color-bear)";

  const timeLabelEvery = Math.max(1, Math.ceil(bars.length / (isMobile ? 4 : 9)));

  // Crosshair-price gamma context for the floating readout.
  const hoverGex = hover ? gexAtPrice(hover.price) : null;
  const nearestLevel = hover
    ? levelDefs
        .filter((l) => l.value != null)
        .map((l) => ({ label: l.label, value: l.value as number, color: l.color, dist: Math.abs((l.value as number) - hover.price) }))
        .sort((a, b) => a.dist - b.dist)[0] ?? null
    : null;

  const sessionBadge = rewindActive
    ? { label: "◀ REWIND", color: "var(--color-accent-hot)" }
    : delayed
      ? { label: "◷ DELAYED ~15 MIN", color: "var(--color-warning)" }
      : sessionLabel(session);

  return (
    <div className={`zg-feature-shell zg-gc-rise ${className}`} style={{ overflow: "hidden" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-4 p-4 sm:p-5"
        style={{ borderBottom: "1px solid var(--border-default)", background: "var(--bg-subtle)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Symbol + live price */}
          <div className="flex items-end gap-4">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="zg-eyebrow" style={{ color: "var(--color-brand-primary)" }}>
                  ZeroGEX Gamma Chart
                </span>
                {sessionBadge && (
                  <span className="zg-chip" style={{ ["--chip-color" as string]: sessionBadge.color }}>
                    {sessionBadge.label}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-3 mt-1">
                <span style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)", lineHeight: 1 }}>
                  {symbol}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 28, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {spot != null ? fmtPrice(spot) : "--"}
                </span>
                {!rewindActive && priceSummary.change != null && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 15,
                      fontWeight: 600,
                      color: priceSummary.isPositive ? "var(--color-bull)" : "var(--color-bear)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {priceSummary.isPositive ? "+" : ""}
                    {priceSummary.change.toFixed(2)}
                    {priceSummary.changePercent != null && ` (${priceSummary.isPositive ? "+" : ""}${priceSummary.changePercent.toFixed(2)}%)`}
                  </span>
                )}
                {rewindActive && rewindTime != null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--color-accent-hot)", fontVariantNumeric: "tabular-nums" }}>
                    {new Date(rewindTime).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} ET
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Regime chip */}
          <div className="flex items-center gap-2">
            <div
              className="flex flex-col items-end px-3 py-1.5"
              style={{
                border: `1px solid ${regimeUnknown ? "var(--border-default)" : longGammaNow ? "var(--color-bull)" : "var(--color-bear)"}`,
                borderRadius: "var(--radius-control)",
                background: regimeUnknown
                  ? "transparent"
                  : `color-mix(in srgb, ${longGammaNow ? "var(--color-bull)" : "var(--color-bear)"} 10%, transparent)`,
              }}
            >
              <span className="zg-eyebrow" style={{ color: "var(--text-muted)", fontSize: 9 }}>
                Dealer Gamma @ Spot
              </span>
              <div className="flex items-center gap-1.5">
                <Activity size={13} style={{ color: regimeUnknown ? "var(--text-muted)" : longGammaNow ? "var(--color-bull)" : "var(--color-bear)" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", color: regimeUnknown ? "var(--text-secondary)" : longGammaNow ? "var(--color-bull)" : "var(--color-bear)" }}>
                  {regimeUnknown ? "—" : longGammaNow ? "LONG Γ" : "SHORT Γ"}
                </span>
                {netGexAtSpot != null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
                    {fmtGex(netGexAtSpot)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {/* Symbol + timeframe — switchable when live; in the delayed public
              snapshot they're fixed (switching needs data the snapshot lacks),
              so we show an unlock CTA instead. */}
          {live ? (
            <>
              <div className="zg-gc-seg" role="tablist" aria-label="Symbol">
                {SYMBOLS.map((s) => (
                  <button key={s} type="button" className="zg-gc-seg-btn" data-active={s === symbol} onClick={() => setSymbol(s as UnderlyingSymbol)} aria-pressed={s === symbol}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="zg-gc-seg" role="tablist" aria-label="Timeframe">
                {TIMEFRAMES.map((t) => (
                  <button key={t.value} type="button" className="zg-gc-seg-btn" data-active={t.value === timeframe} onClick={() => setTimeframe(t.value)} aria-pressed={t.value === timeframe}>
                    {t.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <span className="zg-chip" style={{ ["--chip-color" as string]: "var(--text-secondary)" }}>
                {symbol} · {TIMEFRAMES.find((t) => t.value === timeframe)?.label}
              </span>
              <a
                href="/register"
                className="zg-gc-pill"
                data-active
                style={{ ["--pill-color" as string]: "var(--color-warning)", textDecoration: "none" }}
              >
                Unlock live · all symbols & timeframes →
              </a>
            </>
          )}
          {/* Price style */}
          <div className="zg-gc-seg" role="tablist" aria-label="Price style">
            {(["candles", "line", "area"] as PriceStyle[]).map((s) => (
              <button key={s} type="button" className="zg-gc-seg-btn" data-active={s === style} onClick={() => setStyle(s)} aria-pressed={s === style}>
                {s === "candles" ? "Candle" : s === "line" ? "Line" : "Area"}
              </button>
            ))}
          </div>

          <div className="hidden sm:block" style={{ width: 1, height: 22, background: "var(--border-default)" }} />

          {/* Overlay pills */}
          <OverlayPill label="Gamma Levels" color="var(--heat-mid)" active={overlays.levels} onClick={() => setOverlays((o) => ({ ...o, levels: !o.levels }))} />
          <OverlayPill label="Gamma Rail" color="var(--color-bull)" active={overlays.rail} onClick={() => setOverlays((o) => ({ ...o, rail: !o.rail }))} />
          <OverlayPill label="Regime" color="var(--color-accent-hot)" active={overlays.regime} onClick={() => setOverlays((o) => ({ ...o, regime: !o.regime }))} />
          <OverlayPill label="VWAP" color="var(--color-hazy)" active={overlays.vwap} onClick={() => setOverlays((o) => ({ ...o, vwap: !o.vwap }))} />
          <OverlayPill label="Max Pain" color="var(--color-gold)" active={overlays.maxPain} onClick={() => setOverlays((o) => ({ ...o, maxPain: !o.maxPain }))} />

          <div className="ml-auto flex items-center gap-2">
            {isCustomView && (
              <button
                type="button"
                onClick={resetView}
                title="Reset zoom & pan to the live view"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "5px 11px",
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid var(--color-accent-hot)",
                  color: "var(--color-accent-hot)",
                  background: "color-mix(in srgb, var(--color-accent-hot) 12%, transparent)",
                  cursor: "pointer",
                }}
              >
                ⟲ Reset
              </button>
            )}
            <div className="hidden md:flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
              <Crosshair size={13} />
              <span className="zg-eyebrow" style={{ fontSize: 10 }}>
                Scroll zoom · drag pan · hover for gamma
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chart body ─────────────────────────────────────────────────── */}
      <div ref={containerRef} className="relative" style={{ background: "var(--bg-card)" }}>
        <MobileScrollableChart minWidthClass="min-w-[1000px]" initialScroll="end">
          <svg
            ref={svgRef}
            width="100%"
            viewBox={`0 0 ${VW} ${VH}`}
            preserveAspectRatio="xMinYMin meet"
            style={{
              aspectRatio: `${VW} / ${VH}`,
              display: "block",
              width: "100%",
              cursor: axisZoomActive || overAxis ? "ns-resize" : dragging ? "grabbing" : "crosshair",
              userSelect: "none",
              // Let the mobile wrapper scroll horizontally: don't reserve
              // horizontal-swipe gestures for the SVG (there's no touch-drag
              // handler). Desktop mouse zoom/pan is unaffected by touch-action.
              touchAction: "auto",
            }}
            onMouseMove={handlePointerMove}
            onMouseDown={handlePointerDown}
            onMouseUp={endDrag}
            onMouseLeave={handlePointerLeave}
            onDoubleClick={resetView}
          >
            <defs>
              <linearGradient id="zg-gc-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={seriesColor} stopOpacity={0.32} />
                <stop offset="100%" stopColor={seriesColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="zg-gc-rail-pos" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--color-bull)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="var(--color-bull)" stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id="zg-gc-rail-neg" x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor="var(--color-bear)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="var(--color-bear)" stopOpacity={0.55} />
              </linearGradient>
              <clipPath id="zg-gc-plot-clip">
                <rect x={PLOT_LEFT} y={PAD_TOP} width={PLOT_RIGHT - PLOT_LEFT} height={PRICE_BOTTOM - PAD_TOP} />
              </clipPath>
            </defs>

            {/* Regime zones */}
            {overlays.regime && !regimeUnknown && inDomain(flip) && (
              <g>
                <rect x={PLOT_LEFT} y={PAD_TOP} width={PLOT_RIGHT - PLOT_LEFT} height={Math.max(0, yPrice(flip) - PAD_TOP)} fill="color-mix(in srgb, var(--color-bull) 7%, transparent)" />
                <rect x={PLOT_LEFT} y={yPrice(flip)} width={PLOT_RIGHT - PLOT_LEFT} height={Math.max(0, PRICE_BOTTOM - yPrice(flip))} fill="color-mix(in srgb, var(--color-bear) 7%, transparent)" />
                <text x={(PLOT_LEFT + PLOT_RIGHT) / 2} y={PAD_TOP + 15} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} letterSpacing="0.16em" fill="var(--color-bull)" opacity={0.65}>
                  LONG &#915; · PINNING
                </text>
                <text x={(PLOT_LEFT + PLOT_RIGHT) / 2} y={PRICE_BOTTOM - 9} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} letterSpacing="0.16em" fill="var(--color-bear)" opacity={0.65}>
                  SHORT &#915; · TRENDING
                </text>
              </g>
            )}
            {overlays.regime && !regimeUnknown && !inDomain(flip) && (
              <text x={(PLOT_LEFT + PLOT_RIGHT) / 2} y={PAD_TOP + 15} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} letterSpacing="0.16em" fill={longGammaNow ? "var(--color-bull)" : "var(--color-bear)"} opacity={0.65}>
                {longGammaNow ? "LONG Γ · PINNING REGIME" : "SHORT Γ · TRENDING REGIME"}
              </text>
            )}

            {/* Price grid + right axis labels */}
            {priceAxis.ticks.map((p) => {
              const y = yPrice(p);
              if (y < PAD_TOP - 0.5 || y > PRICE_BOTTOM + 0.5) return null;
              return (
                <g key={`grid-${p}`}>
                  <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} stroke="var(--color-grid-line)" strokeWidth={1} />
                  <text x={AXIS_COL_X} y={y + 3.5} fontFamily="var(--font-mono)" fontSize={11} fill="var(--text-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {fmtPrice(p)}
                  </text>
                </g>
              );
            })}

            {/* ── Gamma structure rail ──────────────────────────────────── */}
            {overlays.rail && rail && (
              <g>
                <rect x={RAIL_LEFT - 6} y={PAD_TOP} width={RAIL_RIGHT - RAIL_LEFT + 12} height={PRICE_BOTTOM - PAD_TOP} fill="color-mix(in srgb, var(--text-primary) 3%, transparent)" />
                <text x={(RAIL_LEFT + RAIL_RIGHT) / 2} y={PAD_TOP - 6} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} letterSpacing="0.12em" fill="var(--text-muted)">
                  DEALER GAMMA BY STRIKE
                </text>
                {/* zero baseline */}
                <line x1={RAIL_CENTER} x2={RAIL_CENTER} y1={PAD_TOP} y2={PRICE_BOTTOM} stroke="var(--border-strong)" strokeWidth={1} opacity={0.5} />
                {/* silhouette */}
                <path d={rail.posPath} fill="url(#zg-gc-rail-pos)" />
                <path d={rail.negPath} fill="url(#zg-gc-rail-neg)" />
                <path d={rail.edge} fill="none" stroke="var(--text-secondary)" strokeWidth={1} opacity={0.35} />
                {/* flip zero-crossing tie-line to the plot */}
                {inDomain(flip) && (
                  <line x1={RAIL_LEFT - 6} x2={RAIL_RIGHT} y1={yPrice(flip)} y2={yPrice(flip)} stroke="var(--heat-mid)" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
                )}
                {/* peak markers */}
                {[{ p: rail.callPeak, c: "var(--color-bull)", side: 1 }, { p: rail.putPeak, c: "var(--color-bear)", side: -1 }].map(({ p, c }, i) => (
                  <g key={`peak-${i}`}>
                    <circle cx={rail.xFor(p.gex)} cy={rail.yFor(p.price)} r={2.6} fill={c} />
                  </g>
                ))}
              </g>
            )}

            {/* ── Price series ──────────────────────────────────────────── */}
            <g clipPath="url(#zg-gc-plot-clip)">
              {style === "area" && <path d={areaPath} fill="url(#zg-gc-area)" />}
              {(style === "line" || style === "area") && <path d={closePath} fill="none" stroke={seriesColor} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />}
              {style === "candles" &&
                bars.map((b, i) => {
                  const x = xForIndex(i);
                  const prevClose = i > 0 ? bars[i - 1].close : b.open;
                  const isUp = b.close >= prevClose;
                  const isHollow = b.close >= b.open;
                  const c = isUp ? "var(--color-bull)" : "var(--color-bear)";
                  const openY = yPrice(b.open);
                  const closeY = yPrice(b.close);
                  const highY = yPrice(b.high);
                  const lowY = yPrice(b.low);
                  const bodyY = Math.min(openY, closeY);
                  const bodyH = Math.max(1, Math.abs(openY - closeY));
                  return (
                    <g key={b.timestamp}>
                      {/* Wick drawn as two segments — high→body-top and
                          body-bottom→low — so it never crosses the interior of
                          a hollow (transparent) candle body. */}
                      <line x1={x} x2={x} y1={highY} y2={bodyY} stroke={c} strokeWidth={1} opacity={0.9} />
                      <line x1={x} x2={x} y1={bodyY + bodyH} y2={lowY} stroke={c} strokeWidth={1} opacity={0.9} />
                      <rect
                        x={x - candleWidth / 2}
                        y={bodyY}
                        width={candleWidth}
                        height={bodyH}
                        fill={isHollow ? "transparent" : c}
                        stroke={c}
                        strokeWidth={1.1}
                      />
                    </g>
                  );
                })}
            </g>

            {/* ── Gamma level reference lines (in-domain only) ──────────── */}
            {levelDefs.map((l) => {
              if (!l.show || l.value == null || !inDomain(l.value)) return null;
              const y = clamp(yPrice(l.value), PAD_TOP + 1, PRICE_BOTTOM - 1);
              const emphasized = confluenceKey === l.key;
              return (
                <line key={`levelline-${l.key}`} x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} stroke={l.color} strokeWidth={emphasized ? 2 : 1.3} strokeDasharray={l.dash} opacity={emphasized ? 1 : 0.85} />
              );
            })}

            {/* ── Level name chips, de-collided so they never overlap ────── */}
            {chipPlacements.map((c) => (
              <g key={`chip-${c.key}`} transform={`translate(${c.x}, ${c.y})`}>
                <rect x={0} y={-8} width={c.w} height={16} rx={2} fill="var(--bg-card)" stroke={c.color} strokeWidth={1} opacity={0.95} />
                <text x={6} y={3.5} fontFamily="var(--font-mono)" fontSize={9.5} letterSpacing="0.08em" fill={c.color} fontWeight={600}>
                  {c.label}
                </text>
              </g>
            ))}

            {/* ── Last-price line + live cursor (tag drawn in declutter pass) ── */}
            {(() => {
              const y = clamp(yPrice(liveTip.close), PAD_TOP, PRICE_BOTTOM);
              const x = xForIndex(lastIdx);
              const isLive = !delayed && !rewindActive && !!session && session !== "closed";
              return (
                <g>
                  <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y} y2={y} stroke="var(--color-accent-hot)" strokeWidth={1} strokeDasharray="2 3" opacity={0.8} />
                  {/* The dot marks the live bar — only shown when it's on screen
                      (i.e. at the live edge, not scrolled back into history). */}
                  {atLiveEdge && isLive && <circle className="zg-gc-ping" cx={x} cy={y} r={4} fill="none" stroke="var(--color-accent-hot)" strokeWidth={1.5} />}
                  {atLiveEdge && <circle className={isLive ? "zg-gc-dot" : ""} cx={x} cy={y} r={3.4} fill="var(--color-accent-hot)" />}
                </g>
              );
            })()}

            {/* ── Right-axis price tags — decluttered so clustered levels stay
                 legible (last price + every visible gamma level, spread just
                 enough to never overlap, the way a pro terminal's axis does). ── */}
            {(() => {
              const raw = [
                ...levelDefs
                  .filter((l): l is typeof l & { value: number } => l.show && l.value != null)
                  .map((l) => ({
                    key: l.key,
                    y: clamp(yPrice(l.value), PAD_TOP + 1, PRICE_BOTTOM - 1),
                    value: fmtPrice(l.value),
                    bg: l.color,
                    strong: false,
                    arrow: (!inDomain(l.value) ? (l.value > layout.dMax ? "up" : "down") : null) as "up" | "down" | null,
                  })),
                {
                  key: "last",
                  y: clamp(yPrice(liveTip.close), PAD_TOP, PRICE_BOTTOM),
                  value: fmtPrice(liveTip.close),
                  bg: "var(--color-accent-hot)",
                  strong: true,
                  arrow: null as "up" | "down" | null,
                },
              ];
              return spreadTags(raw, 16, PAD_TOP + 2, PRICE_BOTTOM - 2).map((t) => (
                <PriceTag key={t.key} x={AXIS_COL_X - 6} y={t.yAdj} value={t.value} bg={t.bg} strong={t.strong} arrow={t.arrow} />
              ));
            })()}

            {/* ── Volume pane ───────────────────────────────────────────── */}
            <g>
              <text x={PLOT_LEFT + 4} y={VOL_TOP + 11} fontFamily="var(--font-mono)" fontSize={9.5} letterSpacing="0.12em" fill="var(--text-muted)">
                VOLUME
                {symbolIsIndex && <tspan fill="var(--color-warning)" fontSize={8.5}>{"   ·  PROXY (EST.)"}</tspan>}
                {symbolIsIndex && (
                  <title>{`${symbol} is a cash index — it doesn't trade, so this volume is a derived proxy, not native index volume.`}</title>
                )}
              </text>
              {bars.map((b, i) => {
                const x = xForIndex(i);
                const w = Math.max(1.5, candleWidth);
                const downTop = yVol(b.downVolume);
                const upTop = yVol(b.upVolume + b.downVolume);
                const dim = hover ? (i === activeIdx ? 1 : 0.5) : 0.72;
                return (
                  <g key={`vol-${b.timestamp}`} opacity={dim}>
                    {b.downVolume > 0 && <rect x={x - w / 2} y={downTop} width={w} height={Math.max(0.6, VOL_BOTTOM - downTop)} fill="var(--color-bear)" />}
                    {b.upVolume > 0 && <rect x={x - w / 2} y={upTop} width={w} height={Math.max(0.6, downTop - upTop)} fill="var(--color-bull)" />}
                  </g>
                );
              })}
              <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={VOL_BOTTOM} y2={VOL_BOTTOM} stroke="var(--border-default)" strokeWidth={1} />
            </g>

            {/* ── Time axis + day separators ────────────────────────────── */}
            {bars.map((b, i) => {
              if (i % timeLabelEvery !== 0) return null;
              const x = xForIndex(i);
              const label =
                timeframe === "1day"
                  ? new Date(b.timestamp).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" })
                  : new Date(b.timestamp).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
              return (
                <text key={`t-${b.timestamp}`} x={x} y={TIME_AXIS_Y} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {label}
                </text>
              );
            })}
            {timeframe !== "1day" &&
              dateMarkers.map((m) => {
                if (m.index === 0) return null;
                const x = xForIndex(m.index) - xStep / 2;
                return <line key={`dm-${m.index}`} x1={x} x2={x} y1={PAD_TOP} y2={VOL_BOTTOM} stroke="var(--border-default)" strokeWidth={1} strokeDasharray="2 4" opacity={0.5} />;
              })}
            {/* ── Grouped trading-date row (below the times) ─────────────── */}
            {timeframe !== "1day" &&
              (() => {
                let lastRight = -Infinity;
                return dateGroups.map((g) => {
                  const labelW = g.label.length * 6 + 8;
                  const cx = clamp((xForIndex(g.startIdx) + xForIndex(g.endIdx)) / 2, PLOT_LEFT + labelW / 2, PLOT_RIGHT - labelW / 2);
                  // Skip a date that would collide with the previous one so a
                  // cluster of short day-spans doesn't overprint.
                  if (cx - labelW / 2 < lastRight + 6) return null;
                  lastRight = cx + labelW / 2;
                  return (
                    <text key={`dg-${g.startIdx}`} x={cx} y={DATE_AXIS_Y} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={600} letterSpacing="0.04em" fill="var(--text-secondary)">
                      {g.label}
                    </text>
                  );
                });
              })()}

            {/* ── Crosshair ─────────────────────────────────────────────── */}
            {hover && (() => {
              const crossY = clamp(yPrice(hover.price), PAD_TOP, PRICE_BOTTOM);
              return (
                <g pointerEvents="none">
                  <line x1={xForIndex(activeIdx)} x2={xForIndex(activeIdx)} y1={PAD_TOP} y2={VOL_BOTTOM} stroke="var(--text-secondary)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
                  <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={crossY} y2={crossY} stroke="var(--text-secondary)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
                  <PriceTag x={AXIS_COL_X - 6} y={crossY} value={fmtPrice(hover.price)} bg="var(--text-secondary)" />
                </g>
              );
            })()}
          </svg>
        </MobileScrollableChart>

        {/* ── In-plot legend (OHLC of active bar) ───────────────────────── */}
        <div className="pointer-events-none absolute left-3 top-3 sm:left-4 sm:top-4">
          <div
            className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-2.5 py-1.5"
            style={{ background: "color-mix(in srgb, var(--bg-card) 82%, transparent)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-control)", backdropFilter: "blur(3px)" }}
          >
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{symbol}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{TIMEFRAMES.find((t) => t.value === timeframe)?.label}</span>
            {(["O", activeBar.open, "H", activeBar.high, "L", activeBar.low, "C", activeBar.close] as const).map((v, i) =>
              typeof v === "string" ? (
                <span key={`k-${i}`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>{v}</span>
              ) : (
                <span key={`v-${i}`} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600, color: activeBar.close >= activePrevClose ? "var(--color-bull)" : "var(--color-bear)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtPrice(v)}
                </span>
              ),
            )}
          </div>
        </div>

        {/* ── Floating crosshair readout (price × gamma) ────────────────── */}
        {hover && (
          <div
            className="pointer-events-none absolute z-20"
            style={{
              left: hover.px + 16 + 210 > hover.w ? Math.max(8, hover.px - 210) : hover.px + 16,
              top: Math.max(8, Math.min(hover.py + 14, hover.h - 172)),
              minWidth: 196,
            }}
          >
            <div style={{ background: "var(--color-chart-tooltip-bg)", border: "1px solid var(--color-chart-tooltip-border)", borderRadius: "var(--radius-control)", boxShadow: "var(--shadow-pop)", padding: "9px 11px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>
                {new Date(activeBar.timestamp).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} ET
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5" style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                <Row k="O" v={fmtPrice(activeBar.open)} />
                <Row k="H" v={fmtPrice(activeBar.high)} />
                <Row k="L" v={fmtPrice(activeBar.low)} />
                <Row k="C" v={fmtPrice(activeBar.close)} color={activeBar.close >= activePrevClose ? "var(--color-bull)" : "var(--color-bear)"} />
                <Row k="Vol" v={fmtVol(activeBar.volume)} />
              </div>
              <div style={{ height: 1, background: "var(--border-subtle)", margin: "7px 0" }} />
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: "var(--color-brand-primary)", marginBottom: 4 }}>GAMMA @ {fmtPrice(hover.price)}</div>
              {hoverGex != null ? (
                <div className="flex items-center justify-between" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Net dealer &#915;</span>
                  <span style={{ fontWeight: 600, color: hoverGex >= 0 ? "var(--color-bull)" : "var(--color-bear)" }}>{fmtGex(hoverGex)}</span>
                </div>
              ) : (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>No gamma data</div>
              )}
              {hoverGex != null && (
                <div className="flex items-center justify-between" style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 2 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Regime</span>
                  <span style={{ fontWeight: 600, color: hoverGex >= 0 ? "var(--color-bull)" : "var(--color-bear)" }}>{hoverGex >= 0 ? "Long Γ" : "Short Γ"}</span>
                </div>
              )}
              {nearestLevel && (
                <div className="flex items-center justify-between" style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 2 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{nearestLevel.label}</span>
                  <span style={{ fontWeight: 600, color: nearestLevel.color }}>
                    {nearestLevel.dist <= 0 ? "at" : `${fmtPrice(nearestLevel.dist)} away`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── On-screen controls: jump-to-latest + zoom (time + price) ──── */}
        <div className="absolute z-20 flex flex-col items-end gap-1.5" style={{ right: 12, bottom: 12 }}>
          {!atLiveEdge && (
            <button
              type="button"
              onClick={() => {
                if (rewindActive) {
                  exitRewind();
                } else {
                  setView((v) => ({ ...v, offset: 0 }));
                  setHover(null);
                }
              }}
              title={rewindActive ? "Return to live" : "Jump to the latest bar"}
              aria-label={rewindActive ? "Return to live" : "Jump to the latest bar"}
              style={{
                display: "grid",
                placeItems: "center",
                width: 30,
                height: 30,
                borderRadius: 999,
                border: "1px solid var(--color-accent-hot)",
                color: "var(--color-accent-hot)",
                background: "color-mix(in srgb, var(--color-accent-hot) 14%, transparent)",
                backdropFilter: "blur(3px)",
                cursor: "pointer",
              }}
            >
              <ChevronsRight size={17} />
            </button>
          )}
          <ZoomCluster label="Time" onIn={() => zoomTimeCentered(1 / ZOOM_FACTOR)} onOut={() => zoomTimeCentered(ZOOM_FACTOR)} />
          <ZoomCluster label="Price" onIn={() => zoomPrice(1 / ZOOM_FACTOR)} onOut={() => zoomPrice(ZOOM_FACTOR)} />
        </div>
      </div>

      {/* ── Rewind / session-replay bar (live mode only) ─────────────────── */}
      {live && (
        <div className="flex items-center gap-2 px-4 py-2" style={{ borderTop: "1px solid var(--border-default)", background: "var(--bg-subtle)" }}>
          {!rewindActive ? (
            <>
              <button type="button" onClick={enterRewind} className="zg-gc-pill" style={{ ["--pill-color" as string]: "var(--color-accent-hot)" }}>
                <Rewind size={13} /> Rewind
              </button>
              <span className="zg-eyebrow hidden sm:inline" style={{ fontSize: 9.5, color: "var(--text-muted)" }}>
                Replay how price &amp; dealer gamma moved through the session
              </span>
            </>
          ) : (
            <>
              <button type="button" onClick={exitRewind} className="zg-gc-pill" data-active style={{ ["--pill-color" as string]: "var(--color-bull)" }}>
                ● Live
              </button>
              <button
                type="button"
                onClick={() => setPlaybackActive((p) => !p)}
                aria-label={playbackActive ? "Pause playback" : "Play forward"}
                title={playbackActive ? "Pause playback" : "Play forward"}
                style={{ display: "grid", placeItems: "center", width: 28, height: 26, borderRadius: "var(--radius-control)", border: "1px solid var(--border-strong)", color: "var(--text-primary)", background: "var(--bg-card)", cursor: "pointer" }}
              >
                {playbackActive ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                type="button"
                onClick={() => setPlaybackLoop((v) => !v)}
                aria-label={playbackLoop ? "Disable loop" : "Enable loop"}
                aria-pressed={playbackLoop}
                title={playbackLoop ? "Loop on — replays continuously (click to disable)" : "Loop off — click to replay continuously"}
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: 28,
                  height: 26,
                  borderRadius: "var(--radius-control)",
                  border: `1px solid ${playbackLoop ? "var(--color-accent-hot)" : "var(--border-strong)"}`,
                  color: playbackLoop ? "var(--color-accent-hot)" : "var(--text-primary)",
                  background: playbackLoop ? "color-mix(in srgb, var(--color-accent-hot) 16%, transparent)" : "var(--bg-card)",
                  cursor: "pointer",
                }}
              >
                <Repeat size={13} />
              </button>
              <div className="zg-gc-seg" aria-label="Playback speed">
                {([1, 4, 16] as const).map((s) => (
                  <button key={s} type="button" className="zg-gc-seg-btn" data-active={playbackSpeed === s} onClick={() => setPlaybackSpeed(s)}>
                    {s}×
                  </button>
                ))}
              </div>
              <input
                type="range"
                min={rewindMinIdx}
                max={Math.max(rewindMinIdx, total - 1)}
                value={rewindEdgeIdx ?? Math.max(rewindMinIdx, total - 1)}
                onChange={(e) => scrubToIndex(Number(e.target.value))}
                aria-label="Rewind scrubber"
                className="flex-1"
                style={{ accentColor: "var(--color-accent-hot)", minWidth: 80 }}
              />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-secondary)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                {rewindTime != null
                  ? `${new Date(rewindTime).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} ET`
                  : ""}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Footer legend ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5" style={{ borderTop: "1px solid var(--border-default)", background: "var(--bg-subtle)" }}>
        <LegendDot color="var(--heat-mid)" label="Gamma Flip" />
        <LegendDot color="var(--color-bull)" label="Call Wall" />
        <LegendDot color="var(--color-bear)" label="Put Wall" />
        <LegendDot color="var(--color-gold)" label="Max Pain" />
        <LegendDot color="var(--color-hazy)" label="VWAP" />
        <LegendDot color="var(--color-accent-hot)" label="Last" />
        <div className="ml-auto flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <Info size={12} />
          <span className="zg-eyebrow" style={{ fontSize: 9.5 }}>
            Dealer gamma computed by ZeroGEX · {delayed ? "delayed ~15 min" : "updates live"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────
function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Like num() but coerces the number-or-string values the timeseries buckets
// carry (keeps null/empty as null rather than Number('') === 0).
function coerceNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? Number(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

// Textbook Max Pain: the strike that minimizes total in-the-money option value
// (writers' payout) across the chain — Σ callOI·(K−s) for s<K plus Σ putOI·(s−K)
// for s>K. Recovers a historical Max Pain from a rewound bucket's per-strike OI,
// which the timeseries doesn't carry as a first-class field.
function computeMaxPain(strikes: StrikeProfileStrike[] | undefined): number | null {
  if (!Array.isArray(strikes)) return null;
  const rows = strikes
    .map((s) => ({ k: coerceNum(s.strike), c: coerceNum(s.call_oi) ?? 0, p: coerceNum(s.put_oi) ?? 0 }))
    .filter((r): r is { k: number; c: number; p: number } => r.k != null)
    .sort((a, b) => a.k - b.k);
  if (rows.length < 3 || !rows.some((r) => r.c > 0 || r.p > 0)) return null;
  let bestK: number | null = null;
  let bestLoss = Infinity;
  for (const cand of rows) {
    let loss = 0;
    for (const r of rows) {
      if (r.k < cand.k) loss += r.c * (cand.k - r.k);
      else if (r.k > cand.k) loss += r.p * (r.k - cand.k);
    }
    if (loss < bestLoss) {
      bestLoss = loss;
      bestK = cand.k;
    }
  }
  return bestK;
}

// Rebuild the gamma rail for a rewound moment from a bucket's per-strike net
// gamma. The live rail draws a smooth net-gamma-by-price density (two lobes
// peaking at the put-side / call-side walls); the raw bucket strikes are the
// same quantity but discrete and sign-alternating between neighbours, so plotted
// directly they read as a jagged, center-crossing silhouette (the "funky" rail).
// We convolve them with a Gaussian (bandwidth ≈ the strike spacing) onto a fine
// price grid to recover that clean silhouette, preserving the sign convention
// (positive net gamma → long-Γ lobe, green/right — same as the live rail).
function rewindRailCurve(strikes: StrikeProfileStrike[] | undefined): ProfilePoint[] {
  const rows = (strikes ?? [])
    .map((s) => ({ price: coerceNum(s.strike), ng: coerceNum(s.net_gamma) }))
    .filter((s): s is { price: number; ng: number } => s.price != null && s.ng != null)
    .sort((a, b) => a.price - b.price);
  if (rows.length < 2) return [];
  const lo = rows[0].price;
  const hi = rows[rows.length - 1].price;
  const span = hi - lo;
  if (!(span > 0)) return [];
  // Kernel bandwidth from the median strike gap (falls back to a fraction of the
  // span for irregular chains) so the smoothing tracks the strike granularity.
  const gaps: number[] = [];
  for (let i = 1; i < rows.length; i++) gaps.push(rows[i].price - rows[i - 1].price);
  gaps.sort((a, b) => a - b);
  const medGap = gaps[Math.floor(gaps.length / 2)] || span / rows.length;
  const sigma = Math.max(medGap * 1.1, span / 120);
  const N = 96;
  const out: ProfilePoint[] = [];
  for (let i = 0; i < N; i++) {
    const price = lo + (span * i) / (N - 1);
    let acc = 0;
    for (const r of rows) {
      const d = (price - r.price) / sigma;
      acc += r.ng * Math.exp(-0.5 * d * d);
    }
    out.push({ price, gex: acc });
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Epoch-ms of a bar's (bucket-start) timestamp. Module-scoped so the playback
// interval can use it without becoming an effect dependency.
function barStartMs(arr: Bar[], idx: number): number {
  return new Date(arr[idx].timestamp).getTime();
}

// ET calendar-day key (YYYY-MM-DD in America/New_York) — used to anchor the
// rewind VWAP to the correct trading day.
const ET_DAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" });
function etDayKey(ts: string): string {
  const d = new Date(ts);
  return Number.isFinite(d.getTime()) ? ET_DAY_FMT.format(d) : "";
}

function labelWidth(label: string): number {
  return 14 + label.length * 5.6;
}

/**
 * Vertical label de-collision for the right-hand price axis. Sorts tags by
 * their true y, then makes two passes — push overlapping tags down, then pull
 * the cluster back inside the bottom bound — so no two tags overlap while each
 * stays as close as possible to the price it marks. Returns the input objects
 * augmented with `yAdj` (the tag's drawn y); the reference line itself keeps
 * its true y, exactly like TradingView's axis.
 */
function spreadTags<T extends { y: number }>(items: T[], gap: number, top: number, bottom: number): Array<T & { yAdj: number }> {
  const arr = items.map((it) => ({ ...it, yAdj: it.y })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < arr.length; i++) {
    if (arr[i].yAdj < arr[i - 1].yAdj + gap) arr[i].yAdj = arr[i - 1].yAdj + gap;
  }
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].yAdj > bottom) arr[i].yAdj = bottom;
    if (i < arr.length - 1 && arr[i].yAdj > arr[i + 1].yAdj - gap) arr[i].yAdj = arr[i + 1].yAdj - gap;
    if (arr[i].yAdj < top) arr[i].yAdj = top;
  }
  return arr;
}

function sessionLabel(session: string | null | undefined): { label: string; color: string } | null {
  if (!session) return null;
  const s = session.toLowerCase();
  if (s === "open" || s === "regular") return { label: "● LIVE", color: "var(--color-bull)" };
  if (s === "pre" || s === "premarket") return { label: "PRE-MKT", color: "var(--color-warning)" };
  if (s === "ah" || s === "afterhours" || s === "post") return { label: "AFTER-HRS", color: "var(--color-warning)" };
  if (s === "closed") return { label: "CLOSED", color: "var(--text-muted)" };
  return { label: session.toUpperCase(), color: "var(--text-secondary)" };
}

function PriceTag({ x, y, value, bg, strong = false, arrow = null }: { x: number; y: number; value: string; bg: string; strong?: boolean; arrow?: "up" | "down" | null }) {
  const w = 8 + value.length * 6.6 + (arrow ? 8 : 0);
  const h = strong ? 18 : 15;
  return (
    <g transform={`translate(${x - w}, ${y})`}>
      <rect x={0} y={-h / 2} width={w} height={h} rx={2} fill={bg} />
      <text x={w / 2} y={strong ? 4 : 3.5} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={strong ? 12 : 10.5} fontWeight={strong ? 700 : 600} fill="var(--text-inverse)" style={{ fontVariantNumeric: "tabular-nums" }}>
        {arrow === "up" ? "▲ " : arrow === "down" ? "▼ " : ""}
        {value}
      </text>
    </g>
  );
}

function Row({ k, v, color }: { k: string; v: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span style={{ color: "var(--text-muted)" }}>{k}</span>
      <span style={{ color: color ?? "var(--text-primary)", fontWeight: 600 }}>{v}</span>
    </div>
  );
}

function OverlayPill({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className="zg-gc-pill" data-active={active} onClick={onClick} style={{ ["--pill-color" as string]: color }} aria-pressed={active}>
      <span className="zg-gc-swatch" />
      {label}
    </button>
  );
}

const zoomBtnStyle: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 15,
  fontWeight: 700,
  lineHeight: 1,
  width: 22,
  height: 20,
  display: "grid",
  placeItems: "center",
  borderRadius: "var(--radius-control)",
  border: "1px solid var(--border-default)",
  background: "var(--bg-subtle)",
  color: "var(--text-secondary)",
  cursor: "pointer",
};

function ZoomCluster({ label, onIn, onOut }: { label: string; onIn: () => void; onOut: () => void }) {
  return (
    <div
      className="flex items-center gap-1"
      style={{
        background: "color-mix(in srgb, var(--bg-card) 88%, transparent)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-control)",
        padding: "3px 5px",
        backdropFilter: "blur(3px)",
      }}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", width: 34, textAlign: "right", paddingRight: 2 }}>
        {label}
      </span>
      <button type="button" onClick={onOut} aria-label={`Zoom out (${label})`} title={`Zoom out (${label})`} style={zoomBtnStyle}>
        −
      </button>
      <button type="button" onClick={onIn} aria-label={`Zoom in (${label})`} title={`Zoom in (${label})`} style={zoomBtnStyle}>
        +
      </button>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-secondary)", letterSpacing: "0.03em" }}>
      <span style={{ width: 12, height: 2, background: color, display: "inline-block", borderRadius: 1 }} />
      {label}
    </span>
  );
}
