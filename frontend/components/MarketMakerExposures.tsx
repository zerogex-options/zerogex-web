'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  ChevronDown,
  Clock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat,
  Rewind,
  RotateCcw,
  Settings2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  useApiData,
  useGEXSummary,
} from '@/hooks/useApiData';
import { useMarketHistorical } from '@/hooks/useMarketHistorical';
import { useStrikeProfileTimeseries } from '@/hooks/useStrikeProfileTimeseries';
import type { StrikeProfileBucket as StrikeProfileBucketRow } from '@/hooks/useStrikeProfileTimeseries';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import { omitClosedMarketTimes } from '@/core/utils';

interface StrikeAggregation {
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
  callOi: number;
  putOi: number;
}

const TIMEFRAME_OPTIONS = ['1m', '5m', '15m'] as const;
type ChartTf = (typeof TIMEFRAME_OPTIONS)[number];

function tfToApi(tf: ChartTf): string {
  return tf === '1m' ? '1min' : tf === '5m' ? '5min' : '15min';
}

// Render exactly this many candles on every interval so the chart looks the
// same (same candle chunkiness) regardless of timeframe. The visible time span
// therefore scales with the interval — that's intentional.
const TARGET_VISIBLE_CANDLES = 78;

// Window size constants live in ``useStrikeProfileTimeseries`` — that hook owns
// the seed fetch (~480 buckets for full-session rewind) and the 1Hz tip poll.

function toNumber(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatExposure(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toFixed(0);
}

function niceStep(range: number, targetCount = 10): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rough = range / Math.max(1, targetCount);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / magnitude;
  if (norm < 1.5) return 1 * magnitude;
  if (norm < 3.5) return 2 * magnitude;
  if (norm < 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Compute days-to-expiry by comparing the contract's expiration date to today's
// date in ET. Anchoring both at UTC noon avoids timezone-induced off-by-one
// (parsing "2026-05-05" as UTC midnight would put it 5 hours behind any
// afternoon-ET viewer and round to 0 for tomorrow's expiry).
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

// SVG layout constants — sized to fit on a standard desktop without scrolling.
const CW = 1200;
const CH = 648;
const PLOT_TOP = 24;
// Compact mode keeps the grouped date row (just below the time labels at
// ``PLOT_BOTTOM + 34``) but still drops the middle/right panel-axis labels —
// so its bottom padding only needs to fit the time + date rows, not the panel
// axis titles the full layout reserves space for too.
const PLOT_BOTTOM_FULL = CH - 72;
const PLOT_BOTTOM_COMPACT = CH - 52;

const LEFT_X = 0;
const LEFT_W_FULL = 540;
// In compact mode the middle and right panels are hidden, so the candles
// panel expands across the bulk of the viewBox. This keeps the dashboard
// tile visually filled with chart content instead of letterboxed.
const LEFT_W_COMPACT = 1056;
const STRIKE_W = 64;
const GAP = 12;
const MID_W = 280;

const SPOT_LINE = '#06B6D4';
const KEY_LEVEL = '#F5C24A';
const FLIP_LINE = '#FFB44A';

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 4.0;
const ZOOM_STEP = 1.43; // ≈ 1/0.7
// At zoomMul = 1.0 the visible half-range equals yAnchor.halfRange — sized to
// the displayed candles' wick spread around spot — so the chart opens at the
// most zoomed-in level that still frames the session's high and low. Used as
// the compact-mode default so the dashboard tile fits the entire visible
// session without cropping the wicks.
const ZOOM_FIT_RANGE = 1.0;

const DEFAULTS = {
  tf: '5m' as ChartTf,
  withPrev: false,
  selectedExpiry: 'all',
  zoomMul: 1.6,
  paused: false,
  gexMode: 'split' as 'split' | 'net',
  showOiDots: true,
  showGrid: true,
};

interface MarketMakerExposuresProps {
  /**
   * When true, hides the middle "Gamma (Call / Put)" panel and the right
   * "Positions" panel, leaving just the candlestick price chart with strike
   * labels and key-level overlays. Used by the dashboard's Market Overview
   * tile to fit the chart into a roughly square space alongside the metric
   * cards.
   */
  compact?: boolean;
}

export default function MarketMakerExposures({ compact = false }: MarketMakerExposuresProps = {}) {
  const { theme } = useTheme();
  const { symbol } = useTimeframe();
  const LEFT_W = compact ? LEFT_W_COMPACT : LEFT_W_FULL;
  const STRIKE_X = LEFT_X + LEFT_W;
  const MID_X = STRIKE_X + STRIKE_W + GAP;
  const RIGHT_X = MID_X + MID_W + GAP;
  const RIGHT_W = compact ? 0 : CW - RIGHT_X;
  const PLOT_BOTTOM = compact ? PLOT_BOTTOM_COMPACT : PLOT_BOTTOM_FULL;
  const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
  const isDark = theme === 'dark';
  const textPrimary = isDark ? colors.light : colors.dark;
  const cardBg = isDark ? colors.cardDark : colors.cardLight;
  const border = colors.muted;
  const subtle = colors.muted;
  const gridStroke = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const popoverBg = isDark ? '#0f2935' : '#FFFFFF';

  const defaultZoomMul = compact ? ZOOM_FIT_RANGE : DEFAULTS.zoomMul;

  // ── User-controlled view state ──
  const [tf, setTf] = useState<ChartTf>(DEFAULTS.tf);
  const [withPrev, setWithPrev] = useState<boolean>(DEFAULTS.withPrev);
  const [selectedExpiry, setSelectedExpiry] = useState<string>(DEFAULTS.selectedExpiry);
  const [zoomMul, setZoomMul] = useState<number>(defaultZoomMul);
  const [paused, setPaused] = useState<boolean>(DEFAULTS.paused);
  // ── Rewind state ──
  // When active, the chart freezes (paused) and a scrubber lets the user move
  // the candlestick chart's right edge back through the session's plot points.
  // The selected point is anchored to a candle *timestamp* (not an array index)
  // so it stays put even if the shared historical cache appends a new bar.
  const [rewindActive, setRewindActive] = useState<boolean>(false);
  const [rewindTime, setRewindTime] = useState<number | null>(null);
  // ── Rewind playback state ──
  // Only meaningful while ``rewindActive`` is true.  Playback advances the
  // scrubber forward one candle per tick at a rate derived from
  // ``playbackSpeed``; on reaching the live edge it either stops or loops
  // back to the leftmost rewindable position depending on ``playbackLoop``.
  const [playbackActive, setPlaybackActive] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const [playbackLoop, setPlaybackLoop] = useState<boolean>(false);
  const [gexMode, setGexMode] = useState<'split' | 'net'>(DEFAULTS.gexMode);
  const [showOiDots, setShowOiDots] = useState<boolean>(DEFAULTS.showOiDots);
  const [showGrid, setShowGrid] = useState<boolean>(DEFAULTS.showGrid);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [expiryOpen, setExpiryOpen] = useState<boolean>(false);
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // Anchor for the price (y) axis: captured ONCE after spot AND at least one
  // candle are available, then held stable so the chart doesn't shift as live
  // quotes/candles arrive. `spot` is the y-axis center; `halfRange` is the
  // un-zoomed half-span derived from the candle spread at capture time. Final
  // halfRange = anchor.halfRange × zoomMul, so user zoom still works. Waiting
  // for a candle lets zoomMul = 1.0 (the compact-mode default) frame the
  // session's high and low instead of freezing at the spot-only fallback.
  // Cleared by Reset or by switching symbol — both should re-anchor.
  const [yAnchor, setYAnchor] = useState<{ spot: number; halfRange: number } | null>(null);

  // Click-and-drag pan offset for the price axis. Positive values shift the
  // visible price window UP (so the candles slide DOWN on screen, revealing
  // higher prices at the top) — i.e. grab-pan semantics. Reset by Reset and
  // when the underlying symbol changes (alongside ``yAnchor``).
  const [yPanOffset, setYPanOffset] = useState<number>(0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  // Transient pan-start snapshot held in a ref so per-frame mouse moves don't
  // each trigger a re-render of the start values themselves.
  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    yPanOffsetStart: number;
  } | null>(null);

  const resetAll = () => {
    setTf(DEFAULTS.tf);
    setWithPrev(DEFAULTS.withPrev);
    setSelectedExpiry(DEFAULTS.selectedExpiry);
    setZoomMul(defaultZoomMul);
    setPaused(DEFAULTS.paused);
    setRewindActive(false);
    setRewindTime(null);
    setPlaybackActive(false);
    setPlaybackSpeed(1);
    setPlaybackLoop(false);
    setGexMode(DEFAULTS.gexMode);
    setShowOiDots(DEFAULTS.showOiDots);
    setShowGrid(DEFAULTS.showGrid);
    setYAnchor(null);
    setYPanOffset(0);
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

  // ── Pause-aware polling intervals (passing 0 disables the interval after the initial fetch).
  // Default to 1s on every hook so candles, gamma bars, and OI bars all tick in real time.
  const summaryInterval = paused ? 0 : 1000;
  // Expirations universe changes at most once per trading day, so a long
  // refresh interval is fine and saves bandwidth on a frequently-mounted chart.
  const expirationsInterval = paused ? 0 : 30_000;

  // ── Live snapshot hooks ──
  // useGEXSummary feeds the "Updated" label and supplies fallback values for
  // the key levels (gamma_flip / call_wall / put_wall) when the timeseries
  // bucket has nulls on its first-emit cycle.  useMarketQuote is no longer
  // needed for candle data — the price chart pulls OHLC from
  // /api/market/historical below, which is the dedicated tape source.
  const { data: gexSummary } = useGEXSummary(symbol, summaryInterval);

  // Expiry dropdown universe.  Sourced from a dedicated lightweight endpoint
  // that scans a TRAILING WINDOW of gex_by_strike — NOT just the latest
  // snapshot the live /api/gex/by-strike endpoint returns.  Why: post-close
  // (e.g. 18:10 ET on Monday) the analytics engine stops writing rows for
  // today's expired 0DTE contracts, so today's expiration vanishes from the
  // latest snapshot.  The rewind feature still has data from earlier in the
  // day when those contracts were live, so today's date needs to stay in the
  // dropdown for the rest of the trading shift.
  const { data: gexExpirations } = useApiData<string[] | null>(
    `/api/gex/expirations?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`,
    { refreshInterval: expirationsInterval },
  );

  // ── Strike-Profile timeseries: GEX data only ──
  // Per-bucket flip / call & put walls / per-strike gamma & OI on a common
  // 5-minute time axis.  We do NOT read OHLC from these buckets anymore —
  // the engine seeds new buckets from the price at write time (not the
  // actual first observed tick in the window), so the API-reported open
  // can sit several ticks off the prior close until the engine refines on
  // its next 1-2 cycles, painting a transient gap.  Candle OHLC comes from
  // /api/market/historical below, which is the dedicated tape source and
  // handles intra-bar merging correctly via useMarketHistorical.
  //
  // The hook keeps its seed (full-session rewind depth) + 1Hz tip-poll
  // pattern so the live edge's GEX data ticks in real time.
  const expirationsParam = selectedExpiry === 'all' ? 'all' : selectedExpiry;
  const { buckets: strikeProfileBuckets } = useStrikeProfileTimeseries(
    symbol, tfToApi(tf), expirationsParam, paused,
  );

  // ── Candles: /api/market/historical ──
  // Single source of truth for OHLC.  useMarketHistorical's pollLatestBar
  // updates the live tip bar's close on every 1s tick while pinning the
  // open at bar start and widening high/low only when the live close
  // sticks out — the same intra-bar semantics a real candlestick chart
  // wants, with none of the analytics-engine-seeding quirks the strike-
  // profile timeseries exhibits.
  const { rows: marketHistoricalAll } = useMarketHistorical(symbol, tfToApi(tf));
  const candleBuckets = useMemo(() => {
    return omitClosedMarketTimes(marketHistoricalAll, (b) => b.timestamp)
      .filter((b) => {
        const o = toNumber(b.open ?? b.close);
        return o != null && o > 0;
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [marketHistoricalAll]);

  // ── Strike-Profile bucket lookup by timestamp ──
  // Candles and GEX data come from different endpoints with different
  // history depths (~576 candle bars from /api/market/historical vs ~78
  // GEX buckets from /api/gex/strike-profile-timeseries), so they're no
  // longer index-aligned.  Index by candle timestamp for the rewind +
  // live-edge lookups: for any candle's timestamp, gexByTs returns the
  // matching strike-profile bucket if one exists, or undefined for
  // candles that predate the GEX window (Gamma / Positions panels stay
  // empty in that case, same UX as the prior backfill zone).
  const gexByTs = useMemo(() => {
    const map = new Map<number, StrikeProfileBucketRow>();
    for (const b of strikeProfileBuckets) {
      const ms = new Date(b.timestamp).getTime();
      if (Number.isFinite(ms)) map.set(ms, b);
    }
    return map;
  }, [strikeProfileBuckets]);

  // First candle index whose timestamp has a matching GEX bucket.  Clamps
  // the rewind scrubber's left edge so the user can never drag it into the
  // candles-only history zone (where the Gamma / Positions panels would
  // render blank — the symptom previously reported as "goes back about
  // half way then blanks out" on 1-min).  Past this index every candle has
  // GEX data, so the right panels always render something.
  const firstGexBucketIndex = useMemo(() => {
    for (let i = 0; i < candleBuckets.length; i += 1) {
      const ms = new Date(candleBuckets[i].timestamp).getTime();
      if (Number.isFinite(ms) && gexByTs.has(ms)) return i;
    }
    return 0;
  }, [candleBuckets, gexByTs]);

  // Expiry dropdown universe — straight pass-through of the dedicated
  // /api/gex/expirations endpoint, which already ASC-sorts and deduplicates
  // server-side.  Defensive normalisation (trim, drop empties) guards
  // against an empty-string entry from a malformed cache row, but the
  // endpoint should never return one.
  const availableExpirations = useMemo<string[]>(() => {
    if (!Array.isArray(gexExpirations)) return [];
    const out: string[] = [];
    for (const raw of gexExpirations) {
      const exp = String(raw ?? '').trim();
      if (exp) out.push(exp);
    }
    return out;
  }, [gexExpirations]);

  // Map one bucket's strikes payload into the existing StrikeAggregation
  // shape the Gamma / Positions panels render.  ``call_gamma`` /
  // ``put_gamma`` / ``net_gamma`` from the API carry the same dollar-gamma
  // quantities the live by-strike endpoint calls call_gex / put_gex /
  // net_gex, so they map straight through to ``callGex`` / ``putGex`` /
  // ``netGex`` with no recomputation.
  const bucketToStrikeAggregations = (
    bucket: StrikeProfileBucketRow | null,
  ): StrikeAggregation[] => {
    if (!bucket || !Array.isArray(bucket.strikes)) return [];
    return bucket.strikes
      .map((row): StrikeAggregation | null => {
        const strike = toNumber(row.strike);
        if (strike == null) return null;
        return {
          strike,
          callGex: toNumber(row.call_gamma) ?? 0,
          putGex: toNumber(row.put_gamma) ?? 0,
          netGex: toNumber(row.net_gamma) ?? 0,
          callOi: Math.max(0, Math.trunc(toNumber(row.call_oi) ?? 0)),
          putOi: Math.max(0, Math.trunc(toNumber(row.put_oi) ?? 0)),
        };
      })
      .filter((s): s is StrikeAggregation => s != null)
      .sort((a, b) => b.strike - a.strike);
  };

  // Live strike-aggregation snapshot: walk strikeProfileBuckets back-to-front
  // and pick the most-recent bucket that actually carries non-zero per-strike
  // gamma.  The analytics engine keeps emitting buckets through extended
  // hours (so the OHLC fields stay current for the candle alignment
  // downstream), but stops populating per-strike gamma once the regular
  // session is over — and depending on the cycle it'll either ship an empty
  // strikes array or an array of strike rows with all-zero gex values.
  // Either way the Gamma / Positions panels would blank at the live edge if
  // we trusted the literal last bucket.  Walking back to the latest bucket
  // with real values keeps the panels populated with the session's closing
  // GEX surface while in extended hours.
  const liveGexBucket = useMemo<StrikeProfileBucketRow | null>(() => {
    for (let i = strikeProfileBuckets.length - 1; i >= 0; i -= 1) {
      const b = strikeProfileBuckets[i];
      if (!Array.isArray(b.strikes) || b.strikes.length === 0) continue;
      const hasGex = b.strikes.some((s) => {
        const cg = Number(s.call_gamma);
        const pg = Number(s.put_gamma);
        const ng = Number(s.net_gamma);
        return (
          (Number.isFinite(cg) && cg !== 0) ||
          (Number.isFinite(pg) && pg !== 0) ||
          (Number.isFinite(ng) && ng !== 0)
        );
      });
      if (hasGex) return b;
    }
    return null;
  }, [strikeProfileBuckets]);
  const strikeAggregations = useMemo<StrikeAggregation[]>(
    () => bucketToStrikeAggregations(liveGexBucket),
    [liveGexBucket],
  );

  // Y-axis anchor fallback for the brief moment before any candle has loaded.
  // Normal path reads from visibleCandles[last].close (which is the live tip
  // bar from useMarketHistorical, kept fresh by its 1s pollLatestBar) — this
  // fallback only matters during the historical-seed-loading phase.
  const spot = useMemo(() => {
    const tipClose = candleBuckets.length > 0
      ? toNumber(candleBuckets[candleBuckets.length - 1].close)
      : null;
    const summaryClose = toNumber(gexSummary?.spot_price);
    if (tipClose != null) return tipClose;
    if (summaryClose != null) return summaryClose;
    return null;
  }, [candleBuckets, gexSummary]);

  // Thin projection of candleBuckets onto the chart's candle shape.  No
  // live merge layered on here: useMarketHistorical's pollLatestBar already
  // pins the live tip bar's open at bar start, widens high/low only when
  // the live close sticks out, and updates the close on every 1s poll.
  // candleBuckets is already RTH-clipped, OHLC-validated and ASCENDING.
  const allCandles = useMemo(() => {
    return candleBuckets.map((b) => ({
      timestamp: b.timestamp,
      open: Number(b.open ?? b.close ?? 0),
      close: Number(b.close ?? b.open ?? 0),
      high: Number(b.high ?? b.close ?? 0),
      low: Number(b.low ?? b.close ?? 0),
    }));
  }, [candleBuckets]);

  const nyDateFmt = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    [],
  );

  const todaySessionDate = useMemo(() => {
    if (allCandles.length === 0) return '';
    return nyDateFmt.format(new Date(allCandles[allCandles.length - 1].timestamp));
  }, [allCandles, nyDateFmt]);

  // Resolve the rewind anchor (a timestamp) to an index into allCandles. The
  // index becomes the right edge of the rendered window, so the chart shows the
  // session "as it looked" at that moment. Returns null when not rewinding,
  // which makes every downstream calc fall back to the live (latest) edge.
  const rewindIndex = useMemo(() => {
    if (!rewindActive || rewindTime == null || allCandles.length === 0) return null;
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < allCandles.length; i += 1) {
      const t = new Date(allCandles[i].timestamp).getTime();
      if (!Number.isFinite(t)) continue;
      const dist = Math.abs(t - rewindTime);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }, [rewindActive, rewindTime, allCandles]);

  const visibleCandles = useMemo(() => {
    if (allCandles.length === 0) return allCandles;
    // Normally render the latest TARGET_VISIBLE_CANDLES so the chart's right edge
    // tracks "now" regardless of session boundaries. While rewinding, the right
    // edge is pinned to the scrubbed candle instead, revealing the chart as it
    // appeared at that earlier point. With-Prev controls the opacity of
    // prior-session bars in the render pass instead of dropping them.
    const rightEdge = rewindIndex != null ? rewindIndex : allCandles.length - 1;
    const start = Math.max(0, rightEdge - TARGET_VISIBLE_CANDLES + 1);
    return allCandles.slice(start, rightEdge + 1);
  }, [allCandles, rewindIndex]);

  // Track the symbol that produced the current anchor so we can clear it
  // when the user switches underlying (SPY → QQQ etc.) — the old spot would
  // place the y-axis nowhere near the new price.
  const [anchorSymbol, setAnchorSymbol] = useState<string | null>(null);

  // "Adjust state during render" — React's recommended pattern for derived
  // state that needs to react to prop changes without an effect. The two
  // guards prevent infinite loops: symbol change runs once per change, and
  // anchor capture runs once per (re-)anchor cycle.
  if (anchorSymbol !== symbol) {
    setAnchorSymbol(symbol);
    setYAnchor(null);
    setYPanOffset(0);
    // A rewound point on the old symbol's timeline is meaningless on the new
    // one, so drop back to live when the underlying changes.
    setRewindActive(false);
    setRewindTime(null);
  }

  if (yAnchor == null && spot != null && spot > 0 && visibleCandles.length > 0) {
    const prices: number[] = [];
    visibleCandles.forEach((c) => prices.push(c.high, c.low));
    prices.push(spot);
    const baseSpread = Math.max(Math.max(...prices) - spot, spot - Math.min(...prices));
    const halfRange = Math.max(baseSpread, spot * 0.012);
    setYAnchor({ spot, halfRange });
  }

  const yBounds = useMemo(() => {
    // Preferred path: use the captured anchor. Center stays fixed at the
    // spot-at-load value plus the user's pan offset; only zoom changes the
    // half-range. yPanOffset lets the user grab-pan the price axis without
    // disturbing the anchor itself, so quotes ticking in still don't re-fit
    // the y-bounds while the user is exploring a different strike band.
    if (yAnchor != null) {
      const halfRange = yAnchor.halfRange * zoomMul;
      const center = yAnchor.spot + yPanOffset;
      return { yMin: center - halfRange, yMax: center + halfRange };
    }

    // Pre-anchor fallback (first render before the effect runs). Mirrors the
    // legacy data-driven sizing so the chart still has something to render
    // for the brief moment before yAnchor is set.
    const prices: number[] = [];
    visibleCandles.forEach((c) => prices.push(c.high, c.low));
    if (spot != null) prices.push(spot);

    if (prices.length === 0 && strikeAggregations.length === 0) return null;

    if (spot != null && spot > 0) {
      const baseSpread = prices.length > 0
        ? Math.max(Math.max(...prices) - spot, spot - Math.min(...prices))
        : spot * 0.02;
      const halfRange = Math.max(baseSpread, spot * 0.012) * zoomMul;
      const center = spot + yPanOffset;
      return { yMin: center - halfRange, yMax: center + halfRange };
    }

    if (prices.length > 0) {
      const pMin = Math.min(...prices);
      const pMax = Math.max(...prices);
      const center = (pMin + pMax) / 2 + yPanOffset;
      const halfRange = Math.max((pMax - pMin) / 2, center * 0.02) * zoomMul;
      return { yMin: center - halfRange, yMax: center + halfRange };
    }

    return {
      yMin: Math.min(...strikeAggregations.map((s) => s.strike)),
      yMax: Math.max(...strikeAggregations.map((s) => s.strike)),
    };
  }, [yAnchor, visibleCandles, strikeAggregations, spot, zoomMul, yPanOffset]);

  const yForPrice = (price: number): number => {
    if (!yBounds) return PLOT_TOP;
    const { yMin, yMax } = yBounds;
    return PLOT_TOP + (1 - (price - yMin) / Math.max(1e-9, yMax - yMin)) * PLOT_HEIGHT;
  };

  const strikeLabels = useMemo(() => {
    if (!yBounds) return [];
    const { yMin, yMax } = yBounds;
    const step = niceStep(yMax - yMin, 11);
    const start = Math.ceil(yMin / step) * step;
    const labels: number[] = [];
    for (let v = start; v <= yMax; v += step) {
      labels.push(Number(v.toFixed(2)));
    }
    return labels;
  }, [yBounds]);

  // At the right edge (most recent plot point) the rewind matches the live
  // view exactly because both read the same bucket — the timeseries' tip.
  // Only once scrubbed left do we swap in an earlier bucket's strikes / walls.
  const atRewindRightEdge = rewindIndex == null || rewindIndex >= allCandles.length - 1;

  // While rewinding (and off the right edge), swap the live tip GEX bucket
  // for the scrubbed one so the Gamma / Positions panels and the flip /
  // wall lines replay alongside the candles.  Candles and GEX buckets
  // aren't index-aligned anymore (separate endpoints, different history
  // depths), so look the GEX bucket up by the rewound candle's timestamp.
  const rewoundBucket = useMemo<StrikeProfileBucketRow | null>(() => {
    if (!rewindActive || atRewindRightEdge || rewindIndex == null) return null;
    const candle = allCandles[rewindIndex];
    if (!candle) return null;
    const ms = new Date(candle.timestamp).getTime();
    return Number.isFinite(ms) ? (gexByTs.get(ms) ?? null) : null;
  }, [rewindActive, atRewindRightEdge, rewindIndex, allCandles, gexByTs]);
  // ``null`` (not ``[]``) for an empty or all-zero bucket so
  // ``effStrikeAggregations`` can fall through to the live snapshot —
  // otherwise scrubbing into the after-hours zone (where buckets exist
  // for OHLC alignment but carry no real per-strike gamma) would blank
  // the Gamma / Positions panels.
  const rewoundStrikes = useMemo(() => {
    if (!rewoundBucket) return null;
    const aggs = bucketToStrikeAggregations(rewoundBucket);
    const hasGex = aggs.some(
      (s) => s.callGex !== 0 || s.putGex !== 0 || s.netGex !== 0,
    );
    return hasGex ? aggs : null;
  }, [rewoundBucket]);
  const effStrikeAggregations = rewoundStrikes ?? strikeAggregations;

  const visibleStrikes = useMemo(() => {
    if (!yBounds) return [] as StrikeAggregation[];
    return effStrikeAggregations.filter((s) => s.strike >= yBounds.yMin && s.strike <= yBounds.yMax);
  }, [effStrikeAggregations, yBounds]);

  const gammaXMax = useMemo(() => {
    if (visibleStrikes.length === 0) return 1;
    return Math.max(
      1,
      ...visibleStrikes.map((s) => Math.max(Math.abs(s.callGex), Math.abs(s.putGex), Math.abs(s.netGex))),
    );
  }, [visibleStrikes]);

  const positionsXMax = useMemo(() => {
    if (visibleStrikes.length === 0) return 1;
    return Math.max(1, ...visibleStrikes.map((s) => Math.max(Math.abs(s.callOi), Math.abs(s.putOi))));
  }, [visibleStrikes]);

  const timeBounds = useMemo(() => {
    if (visibleCandles.length === 0) return null;
    const times = visibleCandles.map((c) => new Date(c.timestamp).getTime()).filter(Number.isFinite);
    if (times.length === 0) return null;
    return { tMin: Math.min(...times), tMax: Math.max(...times) };
  }, [visibleCandles]);

  // Index-based time positioning: candles are placed at evenly spaced slots so
  // any time interval missing an underlying price is omitted from the x-axis
  // entirely (no horizontal gap). Time labels snap to the nearest candle index.
  const candleIndexByTime = useMemo(() => {
    const map = new Map<number, number>();
    visibleCandles.forEach((c, i) => {
      const t = new Date(c.timestamp).getTime();
      if (Number.isFinite(t)) map.set(t, i);
    });
    return map;
  }, [visibleCandles]);

  const xForIndex = (idx: number): number => {
    if (visibleCandles.length === 0) return LEFT_X;
    const usableW = LEFT_W - 24;
    const ratio = visibleCandles.length === 1 ? 0.5 : idx / (visibleCandles.length - 1);
    return LEFT_X + 12 + ratio * usableW;
  };

  const xForTime = (t: number): number => {
    if (visibleCandles.length === 0) return LEFT_X;
    const direct = candleIndexByTime.get(t);
    if (direct != null) return xForIndex(direct);
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < visibleCandles.length; i += 1) {
      const ct = new Date(visibleCandles[i].timestamp).getTime();
      const dist = Math.abs(ct - t);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return xForIndex(bestIdx);
  };

  // Bucket every visible candle by ET trading day so the x-axis can render
  // both a row of clock-aligned time labels and a grouped date label spanning
  // the candles that belong to that session.
  const candleDateGroups = useMemo(() => {
    if (visibleCandles.length === 0) return [] as Array<{ startIdx: number; endIdx: number; dateKey: string }>;
    const groups: Array<{ startIdx: number; endIdx: number; dateKey: string }> = [];
    const dateKeyFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    let currentKey = '';
    let currentStart = 0;
    visibleCandles.forEach((c, idx) => {
      const key = dateKeyFmt.format(new Date(c.timestamp));
      if (idx === 0) {
        currentKey = key;
        currentStart = 0;
      } else if (key !== currentKey) {
        groups.push({ startIdx: currentStart, endIdx: idx - 1, dateKey: currentKey });
        currentKey = key;
        currentStart = idx;
      }
    });
    groups.push({ startIdx: currentStart, endIdx: visibleCandles.length - 1, dateKey: currentKey });
    return groups;
  }, [visibleCandles]);

  const timeLabels = useMemo(() => {
    if (visibleCandles.length === 0) return [] as Array<{ t: number; label: string }>;
    const out: Array<{ t: number; label: string }> = [];

    // Clock-aligned time ticks in ET. The step is a "normal" round interval
    // (15m, 30m, 1h, 2h…) chosen so the visible window fits ~7 evenly spaced
    // labels regardless of timeframe — so 1m reads "09:30, 09:45, 10:00…" and
    // 15m reads "10:00, 13:00, 16:00…" rather than irregular sample-dependent
    // times. The grouped date row below carries the session date(s).
    const intervalMin = tf === '1m' ? 1 : tf === '5m' ? 5 : 15;
    const spanMin = visibleCandles.length * intervalMin;
    const NICE_STEPS_MIN = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 360, 720];
    const stepMin =
      NICE_STEPS_MIN.find((s) => s >= spanMin / 7) ?? NICE_STEPS_MIN[NICE_STEPS_MIN.length - 1];

    const etFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const minutesOfDayET = (d: Date) => {
      const parts = etFmt.formatToParts(d);
      const h = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
      const m = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
      return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : -1;
    };
    visibleCandles.forEach((c) => {
      const d = new Date(c.timestamp);
      const mod = minutesOfDayET(d);
      if (mod < 0 || mod % stepMin !== 0) return;
      out.push({
        t: d.getTime(),
        label: etFmt.format(d),
      });
    });
    return out;
  }, [visibleCandles, tf]);

  // The spot line is anchored to the latest visible candle's close so it
  // always reads the same number as the rightmost candle paints.  Falls
  // back to the bootstrap spot (gex summary's spot_price) when no candles
  // have loaded yet.
  const chartSpot = useMemo(() => {
    if (visibleCandles.length > 0) {
      const last = visibleCandles[visibleCandles.length - 1];
      if (Number.isFinite(last.close)) return last.close;
    }
    return spot;
  }, [visibleCandles, spot]);

  // Resolve the flip / call wall / put wall to draw.  While rewinding (and off
  // the right edge), read them from the scrubbed bucket directly — same
  // 1:1 index relationship the strikes use above.  At the right edge / when
  // live, fall back to the live tip bucket so the most-recent frame matches
  // "now".  Each field independently falls back to the live summary if the
  // bucket has no recorded value (rare — typically when the analytics writer
  // hadn't resolved the flip yet on that cycle).
  const levelSourceBucket = rewoundBucket ?? liveGexBucket;
  const effFlip = toNumber(levelSourceBucket?.gamma_flip) ?? toNumber(gexSummary?.gamma_flip);
  const effCallWall = toNumber(levelSourceBucket?.call_wall) ?? toNumber(gexSummary?.call_wall);
  const effPutWall = toNumber(levelSourceBucket?.put_wall) ?? toNumber(gexSummary?.put_wall);

  const keyLevels = useMemo(() => {
    if (!yBounds) return [] as Array<{ y: number; price: number; color: string; label: string; emphasized?: boolean }>;
    const yFor = (price: number) =>
      PLOT_TOP + (1 - (price - yBounds.yMin) / Math.max(1e-9, yBounds.yMax - yBounds.yMin)) * PLOT_HEIGHT;
    const items: Array<{ y: number; price: number; color: string; label: string; emphasized?: boolean }> = [];
    if (effFlip != null && Number.isFinite(effFlip)) {
      items.push({ y: yFor(effFlip), price: effFlip, color: FLIP_LINE, label: 'Gamma Flip' });
    }
    if (effCallWall != null && Number.isFinite(effCallWall)) {
      items.push({ y: yFor(effCallWall), price: effCallWall, color: KEY_LEVEL, label: 'Call Wall' });
    }
    if (chartSpot != null) {
      items.push({ y: yFor(chartSpot), price: chartSpot, color: SPOT_LINE, label: 'Spot', emphasized: true });
    }
    if (effPutWall != null && Number.isFinite(effPutWall)) {
      items.push({ y: yFor(effPutWall), price: effPutWall, color: KEY_LEVEL, label: 'Put Wall' });
    }
    return items;
  }, [effFlip, effCallWall, effPutWall, chartSpot, yBounds, PLOT_HEIGHT]);

  // ── Hover tracking for tooltips/crosshair ──
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  type HoverState = {
    pxX: number;
    pxY: number;
    svgX: number;
    svgY: number;
    panel: 'left' | 'middle' | 'right' | null;
  };
  const [hover, setHover] = useState<HoverState | null>(null);

  const onSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();

    // While panning, translate the cursor's vertical displacement into a price
    // delta and shift the y-axis center. Using the SVG's screen height (mapped
    // through the viewBox ratio) keeps the cursor visually anchored to the
    // grabbed price level regardless of the chart's rendered size.
    if (isPanning && panStartRef.current && yBounds) {
      const screenPlotHeight = (rect.height * PLOT_HEIGHT) / CH;
      if (screenPlotHeight > 0) {
        const dyPx = e.clientY - panStartRef.current.clientY;
        const dPrice = (dyPx / screenPlotHeight) * (yBounds.yMax - yBounds.yMin);
        setYPanOffset(panStartRef.current.yPanOffsetStart + dPrice);
      }
      // Suppress hover tooltips/crosshair while actively dragging — they
      // distract from the pan gesture and lag behind the cursor anyway.
      setHover(null);
      return;
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;
    const pxX = e.clientX - containerRect.left;
    const pxY = e.clientY - containerRect.top;
    const svgX = ((e.clientX - rect.left) / Math.max(1, rect.width)) * CW;
    const svgY = ((e.clientY - rect.top) / Math.max(1, rect.height)) * CH;
    let panel: HoverState['panel'] = null;
    if (svgY >= PLOT_TOP && svgY <= PLOT_BOTTOM) {
      if (svgX >= LEFT_X && svgX <= LEFT_X + LEFT_W) panel = 'left';
      else if (!compact && svgX >= MID_X && svgX <= MID_X + MID_W) panel = 'middle';
      else if (!compact && svgX >= RIGHT_X && svgX <= RIGHT_X + RIGHT_W) panel = 'right';
    }
    setHover({ pxX, pxY, svgX, svgY, panel });
  };

  // Pan gesture entry: left-button mouse-down anywhere on the chart captures
  // the starting position and current pan offset so the move handler can
  // compute deltas relative to where the user first grabbed.
  const onSvgMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      yPanOffsetStart: yPanOffset,
    };
    setIsPanning(true);
    setHover(null);
  };

  // Document-level mouseup so the gesture cleanly terminates even when the
  // user releases the button outside the SVG (e.g. drags off the bottom edge).
  useEffect(() => {
    if (!isPanning) return;
    const onUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };
    document.addEventListener('mouseup', onUp);
    return () => document.removeEventListener('mouseup', onUp);
  }, [isPanning]);

  // Mouse-wheel zoom. Attached imperatively with ``{ passive: false }`` so
  // ``preventDefault`` can suppress the page from scrolling underneath the
  // chart. Each wheel notch multiplies/divides ``zoomMul`` by ZOOM_STEP, the
  // same delta the toolbar's +/- buttons use.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      const factor = e.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setZoomMul((v) => clamp(v * factor, ZOOM_MIN, ZOOM_MAX));
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);

  // Linear scans — cheap enough to compute on every render without useMemo, and
  // avoids tripping the manual-memoization lint rule on the inline closures.
  const hoveredCandle = (() => {
    if (!hover || hover.panel !== 'left' || !timeBounds || visibleCandles.length === 0) return null;
    let best: (typeof visibleCandles)[number] | null = null;
    let bestDist = Infinity;
    for (const c of visibleCandles) {
      const cx = xForTime(new Date(c.timestamp).getTime());
      const dist = Math.abs(cx - hover.svgX);
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    return best;
  })();

  const hoveredStrike = (() => {
    if (!hover || (hover.panel !== 'middle' && hover.panel !== 'right') || visibleStrikes.length === 0) return null;
    let best: (typeof visibleStrikes)[number] | null = null;
    let bestDist = Infinity;
    for (const s of visibleStrikes) {
      const sy = yForPrice(s.strike);
      const dist = Math.abs(sy - hover.svgY);
      if (dist < bestDist) {
        bestDist = dist;
        best = s;
      }
    }
    return best;
  })();

  const expiryDisplay = selectedExpiry === 'all' ? 'All' : selectedExpiry;
  const dteSourceExpiry = selectedExpiry !== 'all' ? selectedExpiry : availableExpirations[0];
  const dteValue = computeDte(dteSourceExpiry);
  // With all expirations selected there's no single DTE to show, so mirror the
  // expiry chip and display "All" instead of the front-month's days-to-expiry.
  const dteLabel = selectedExpiry === 'all' ? 'All' : dteValue != null ? `${dteValue}d` : '—';
  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const updatedLabel = useMemo(() => {
    // The latest candle bar's timestamp lives at bar-start precision (e.g.
    // 16:00 for the 16:00-16:05 5m bucket), so prefer the gex summary's
    // analytics-write timestamp when present — it ticks once per engine
    // cycle and reads closer to "now" in the header.
    const ts = gexSummary?.timestamp || candleBuckets[candleBuckets.length - 1]?.timestamp;
    return ts ? new Date(ts).toLocaleTimeString() : '—';
  }, [gexSummary, candleBuckets]);

  // ── Rewind scrubber wiring ──
  // The slider runs over allCandles indices, clamped on both ends:
  //   * upper end (rewindMax) is the live tip (allCandles.length - 1);
  //   * lower end (rewindMin) is the LATER of:
  //       (a) ``TARGET_VISIBLE_CANDLES - 1`` candles back from the live edge —
  //           the 78-candle visible window's rewind depth, using the older
  //           candles in /api/market/historical as left-side context; and
  //       (b) the first candle whose timestamp has a matching GEX bucket —
  //           so the user can never drag past the GEX-data boundary into a
  //           region where the gamma / positions panels would blank out.
  //           At 1-min, the strike-profile API sometimes returns fewer than
  //           78 buckets (sparse analytics cycle), and without this clamp
  //           the scrubber's leftmost positions would point at candles with
  //           no matching GEX data.
  // Toggling rewind on freezes live updates and seeds the anchor at "now";
  // toggling off resumes live.
  const REWIND_MAX_DEPTH = TARGET_VISIBLE_CANDLES - 1;
  const rewindMax = Math.max(0, allCandles.length - 1);
  const rewindMin = Math.max(firstGexBucketIndex, rewindMax - REWIND_MAX_DEPTH);
  const rewindValue = clamp(rewindIndex != null ? rewindIndex : rewindMax, rewindMin, rewindMax);
  const rewindCandle = allCandles[rewindValue];
  const tsFmt = (ts: string | number | undefined): string => {
    if (ts == null) return '—';
    const d = new Date(ts);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleString('en-US', {
          timeZone: 'America/New_York',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
  };
  const rewindLabel = rewindCandle ? tsFmt(rewindCandle.timestamp) : '—';
  const rewindStartLabel = allCandles[rewindMin] ? tsFmt(allCandles[rewindMin].timestamp) : '—';
  const rewindEndLabel = allCandles[rewindMax] ? tsFmt(allCandles[rewindMax].timestamp) : '—';
  const rewindFillPct = rewindMax > rewindMin ? ((rewindValue - rewindMin) / (rewindMax - rewindMin)) * 100 : 100;
  const rewindTrackBg = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
  const rewindAvailable = rewindMax > rewindMin;

  const toggleRewind = () => {
    if (rewindActive) {
      // Resume live updates and snap the right edge back to "now".  Also
      // stop playback — it's only meaningful inside rewind mode, so leaving
      // it engaged would silently restart on the next rewind toggle.
      setRewindActive(false);
      setRewindTime(null);
      setPlaybackActive(false);
      setPaused(false);
      return;
    }
    // Activating rewind freezes the chart and anchors the scrubber at the most
    // recent plot point so the user can drag back toward the session start.
    const last = allCandles[allCandles.length - 1];
    setRewindActive(true);
    setRewindTime(last ? new Date(last.timestamp).getTime() : null);
    setPaused(true);
  };

  const onRewindScrub = (raw: number) => {
    const idx = clamp(Math.round(raw), rewindMin, rewindMax);
    const candle = allCandles[idx];
    if (candle) setRewindTime(new Date(candle.timestamp).getTime());
  };

  // ── Rewind playback driver ──
  // Advances the rewind scrubber forward one candle per tick at the
  // selected speed.  When the scrubber reaches the live edge (rewindMax)
  // the next tick either jumps back to the leftmost rewindable position
  // (loop) or stops playback (one-shot).  The interval is suspended
  // whenever rewind mode is off, playback is paused, or there's no
  // rewindable range — so the cleanup never fires from a stale closure.
  useEffect(() => {
    if (!rewindActive || !playbackActive) return;
    if (rewindMax <= rewindMin) return;
    // Base tick: 1× = two candles per second.  Calibrated against the prior
    // 1000ms base which was reported as "extremely slow" — at this base, 4×
    // (~125ms / candle) is fast-scrub territory and 1× is comfortable review.
    const BASE_TICK_MS = 500;
    const intervalMs = Math.max(50, Math.round(BASE_TICK_MS / playbackSpeed));
    const id = setInterval(() => {
      // Functional update so the tick always reads the latest rewindTime
      // even if the user scrubbed manually since the interval was scheduled.
      setRewindTime((prevTime) => {
        if (allCandles.length === 0) return prevTime;
        // Resolve prevTime → current index inside allCandles.
        let currentIdx = rewindMax;
        if (prevTime != null) {
          let bestDist = Infinity;
          for (let i = 0; i < allCandles.length; i += 1) {
            const t = new Date(allCandles[i].timestamp).getTime();
            if (!Number.isFinite(t)) continue;
            const dist = Math.abs(t - prevTime);
            if (dist < bestDist) {
              bestDist = dist;
              currentIdx = i;
            }
          }
        }
        let nextIdx = currentIdx + 1;
        if (nextIdx > rewindMax) {
          if (playbackLoop) {
            nextIdx = rewindMin;
          } else {
            // Defer the playbackActive flip out of the setRewindTime
            // updater so React doesn't see a setState inside a setState.
            setTimeout(() => setPlaybackActive(false), 0);
            return prevTime;
          }
        }
        const nextCandle = allCandles[nextIdx];
        return nextCandle ? new Date(nextCandle.timestamp).getTime() : prevTime;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [
    rewindActive,
    playbackActive,
    playbackSpeed,
    playbackLoop,
    allCandles,
    rewindMin,
    rewindMax,
  ]);

  if (!yBounds) {
    return (
      <div
        className="rounded-2xl p-12 text-center"
        style={{ backgroundColor: cardBg, border: `1px solid ${border}`, color: subtle }}
      >
        Loading market maker exposures…
      </div>
    );
  }

  const toolbarBtnStyle = (active = false): React.CSSProperties => ({
    border: `1px solid ${border}`,
    color: active ? textPrimary : subtle,
    backgroundColor: active ? 'var(--color-info-soft)' : 'transparent',
  });
  const toolbarBtnClass = 'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors';

  const containerStyle: React.CSSProperties = fullscreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        borderRadius: 0,
        // In compact mode the layout is flex-column so the SVG region absorbs
        // the remaining viewport — overflow stays hidden so the chart fits
        // the browser window cleanly rather than scrolling.
        overflow: compact ? 'hidden' : 'auto',
        backgroundColor: cardBg,
        border: 'none',
        ...(compact
          ? { display: 'flex', flexDirection: 'column' as const }
          : {}),
      }
    : {
        backgroundColor: cardBg,
        border: `1px solid ${border}`,
        overflow: 'hidden',
        // In compact mode, fill the parent (the dashboard's grid cell) and
        // let the SVG region absorb whatever vertical space the toolbar
        // doesn't claim, so the whole tile matches the card column's height.
        ...(compact
          ? { height: '100%', width: '100%', display: 'flex', flexDirection: 'column' as const }
          : {}),
      };

  const popoverStyle: React.CSSProperties = {
    backgroundColor: popoverBg,
    border: `1px solid ${border}`,
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  };

  const isPrevSession = (ts: string): boolean => {
    if (!todaySessionDate) return false;
    return nyDateFmt.format(new Date(ts)) !== todaySessionDate;
  };

  return (
    <div className="rounded-2xl" style={containerStyle}>
      {/* Title bar — hidden in compact mode (the expand button moves into the
          toolbar below to reclaim the row's vertical space). */}
      {!compact && (
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: `1px solid ${border}`, color: textPrimary }}
        >
          <div className="text-sm font-semibold tracking-wide">{symbol} Strike Profile</div>
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
      )}

      {/* Toolbar */}
      <div className={`flex flex-wrap items-center gap-2 px-5 pt-3 pb-3 ${compact ? 'shrink-0' : ''}`}>
        {/* Date label (informational, no nav — historical date selection requires a backend date param) */}
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
            title="Filter by expiration"
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

        {/* DTE label (auto-derived) */}
        <div className={toolbarBtnClass} style={toolbarBtnStyle()} title="Days to expiry for the selected expiration (All when no single expiry is selected)">
          <span>DTE {dteLabel}</span>
        </div>

        {/* Gamma display mode toggle — hidden in compact mode (no middle panel to control) */}
        {!compact && (
          <button
            type="button"
            onClick={() => setGexMode((m) => (m === 'split' ? 'net' : 'split'))}
            className={toolbarBtnClass}
            style={toolbarBtnStyle(gexMode === 'net')}
            title={`Gamma mode: ${gexMode === 'split' ? 'Call/Put split' : 'Net only'} (click to toggle)`}
          >
            <BarChart3 size={12} />
            <span>{gexMode === 'split' ? 'Split' : 'Net'}</span>
          </button>
        )}

        {/* Timeframe selector */}
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

        {/* With Prev */}
        <button
          type="button"
          title="Overlay the previous trading session's candles"
          onClick={() => setWithPrev((v) => !v)}
          className={toolbarBtnClass}
          style={toolbarBtnStyle(withPrev)}
        >
          <span>With Prev</span>
        </button>

        {/* Zoom out */}
        <button
          type="button"
          title="Zoom out (wider strike/price range)"
          onClick={() => setZoomMul((v) => clamp(v * ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className={toolbarBtnClass}
          style={toolbarBtnStyle()}
          disabled={zoomMul >= ZOOM_MAX - 1e-6}
        >
          <ZoomOut size={12} />
        </button>

        {/* Zoom in */}
        <button
          type="button"
          title="Zoom in (tighter strike/price range)"
          onClick={() => setZoomMul((v) => clamp(v / ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
          className={toolbarBtnClass}
          style={toolbarBtnStyle()}
          disabled={zoomMul <= ZOOM_MIN + 1e-6}
        >
          <ZoomIn size={12} />
        </button>

        {/* Pause / Play */}
        <button
          type="button"
          title={paused ? 'Resume live updates' : 'Pause live updates'}
          onClick={() => setPaused((v) => !v)}
          className={toolbarBtnClass}
          style={toolbarBtnStyle(paused)}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
        </button>

        {/* Rewind — freezes the chart and reveals a scrubber to replay the
            session back to any earlier plot point. Hidden in compact mode
            (the dashboard tile has no room for the scrubber strip). */}
        {!compact && (
          <button
            type="button"
            title={rewindActive ? 'Exit rewind (return to live)' : 'Rewind through the session'}
            onClick={toggleRewind}
            className={toolbarBtnClass}
            style={toolbarBtnStyle(rewindActive)}
            disabled={!rewindActive && !rewindAvailable}
          >
            <Rewind size={12} />
            <span>Rewind</span>
          </button>
        )}

        {/* Reset all */}
        <button
          type="button"
          title="Reset all settings to default"
          onClick={resetAll}
          className={toolbarBtnClass}
          style={toolbarBtnStyle()}
        >
          <RotateCcw size={12} />
        </button>

        {/* Fullscreen toggle — in compact mode the title bar is hidden, so
            the expand button lives here in the toolbar instead. */}
        {compact && (
          <button
            type="button"
            title={fullscreen ? 'Exit fullscreen (Esc)' : 'Enter fullscreen'}
            onClick={() => setFullscreen((v) => !v)}
            className={toolbarBtnClass}
            style={toolbarBtnStyle(fullscreen)}
          >
            {fullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        )}

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
              {!compact && (
                <label className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer hover:bg-[color:var(--color-info-soft)]" style={{ color: textPrimary }}>
                  <input
                    type="checkbox"
                    checked={showOiDots}
                    onChange={(e) => setShowOiDots(e.target.checked)}
                  />
                  <span>Show OI dots</span>
                </label>
              )}
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
          {rewindActive ? (
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded flex items-center gap-1"
              style={{ color: SPOT_LINE, backgroundColor: 'rgba(6, 182, 212, 0.16)' }}
            >
              <Rewind size={10} />
              Rewinding
            </span>
          ) : (
            paused && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                style={{ color: colors.warning, backgroundColor: 'rgba(245, 158, 11, 0.16)' }}
              >
                Paused
              </span>
            )
          )}
          <span>Updated {updatedLabel}</span>
        </div>
      </div>

      {/* Composite chart */}
      <div
        ref={containerRef}
        className={`relative px-2 pb-2 ${compact ? 'flex-1 min-h-0 overflow-hidden' : 'overflow-x-auto'}`}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CW} ${CH}`}
          preserveAspectRatio="xMidYMid meet"
          className={`block ${compact ? 'h-full w-full' : 'w-full'}`}
          style={{
            ...(compact ? {} : { minWidth: 760 }),
            cursor: isPanning ? 'grabbing' : 'grab',
            // Let mobile browsers own touch scrolling — the chart has no
            // touch handlers of its own (only mouse-driven click-and-drag
            // y-pan, which still works on desktop), so ``touch-action: none``
            // was blocking both the non-compact view's horizontal scroll
            // through the ``overflow-x-auto`` container AND the page's
            // vertical scroll when a touch landed on the dashboard tile.
            touchAction: 'pan-x pan-y',
          }}
          onMouseMove={onSvgMouseMove}
          onMouseDown={onSvgMouseDown}
          onMouseLeave={() => {
            if (!isPanning) setHover(null);
          }}
        >
          {/* Shared horizontal grid + strike labels */}
          {strikeLabels.map((p) => {
            const y = yForPrice(p);
            return (
              <g key={`grid-${p}`}>
                {showGrid && (
                  <>
                    <line x1={LEFT_X} x2={STRIKE_X} y1={y} y2={y} stroke={gridStroke} />
                    {!compact && (
                      <>
                        <line x1={MID_X} x2={MID_X + MID_W} y1={y} y2={y} stroke={gridStroke} />
                        <line x1={RIGHT_X} x2={RIGHT_X + RIGHT_W} y1={y} y2={y} stroke={gridStroke} />
                      </>
                    )}
                  </>
                )}
                <text
                  x={STRIKE_X + STRIKE_W / 2}
                  y={y + 3.5}
                  textAnchor="middle"
                  fontSize={11}
                  fill={subtle}
                  fontFamily="ui-sans-serif, system-ui, -apple-system, sans-serif"
                >
                  {p.toFixed(0)}
                </text>
              </g>
            );
          })}

          {/* ── LEFT PANEL: candlestick price chart ── */}
          {visibleCandles.length === 0 ? (
            <text
              x={LEFT_X + LEFT_W / 2}
              y={(PLOT_TOP + PLOT_BOTTOM) / 2}
              textAnchor="middle"
              fontSize={12}
              fill={subtle}
            >
              No price data available
            </text>
          ) : (
            (() => {
              const xStep = (LEFT_W - 24) / Math.max(1, visibleCandles.length - 1);
              const baseCandleW = Math.max(2, Math.min(8, xStep * 0.6));
              // Resolve the candle that precedes the visible window so the
              // leftmost visible candle's color rule (close vs PREVIOUS close)
              // has a real predecessor instead of falling to neutral just
              // because it sits at the edge of the rendered slice.
              const firstVisibleIdx = visibleCandles.length > 0
                ? allCandles.findIndex((ac) => ac.timestamp === visibleCandles[0].timestamp)
                : -1;
              const closeBeforeFirstVisible = firstVisibleIdx > 0
                ? allCandles[firstVisibleIdx - 1].close
                : null;
              return visibleCandles.map((c, i) => {
                const x = xForTime(new Date(c.timestamp).getTime());
                const yO = yForPrice(c.open);
                const yC = yForPrice(c.close);
                const yH = yForPrice(c.high);
                const yL = yForPrice(c.low);

                // ── Color: close vs PREVIOUS candle's close ──
                // > prior close → bullish, < prior close → bearish,
                // == prior close (or no prior available) → neutral.
                // The neutral colour tracks the theme so it stays visible
                // in both light and dark modes.
                const prevClose = i > 0
                  ? visibleCandles[i - 1].close
                  : closeBeforeFirstVisible;
                let color: string;
                if (prevClose == null || c.close === prevClose) {
                  color = textPrimary;
                } else if (c.close > prevClose) {
                  color = colors.bullish;
                } else {
                  color = colors.bearish;
                }

                // ── Fill: close vs OPEN ──
                // close > open  → hollow (stroke-only body)
                // close < open  → filled (solid body)
                // close == open → doji; body height clamps to 1 px and
                //                 renders as a horizontal line, always
                //                 filled (nothing to hollow out).
                const hollow = c.close > c.open;

                const bodyTop = Math.min(yO, yC);
                const bodyH = Math.max(1, Math.abs(yO - yC));
                const bodyBottom = bodyTop + bodyH;
                const isHovered = hoveredCandle?.timestamp === c.timestamp;
                const candleW = isHovered ? baseCandleW * 1.6 : baseCandleW;
                const wickWidth = isHovered ? 1.6 : 1;
                const opacity = isPrevSession(c.timestamp) && !withPrev ? 0.35 : 1;
                // For hollow candles split the wick into top (high → body
                // top) and bottom (body bottom → low) segments so the empty
                // body doesn't reveal the wick passing through it.  Solid
                // candles cover the wick with their fill, so a single
                // high → low line is fine.  Dojis keep the full wick on
                // purpose — that's what gives them the familiar "+" look.
                return (
                  <g key={`cdl-${i}-${c.timestamp}`} opacity={opacity}>
                    {hollow ? (
                      <>
                        <line x1={x} x2={x} y1={yH} y2={bodyTop} stroke={color} strokeWidth={wickWidth} />
                        <line x1={x} x2={x} y1={bodyBottom} y2={yL} stroke={color} strokeWidth={wickWidth} />
                      </>
                    ) : (
                      <line x1={x} x2={x} y1={yH} y2={yL} stroke={color} strokeWidth={wickWidth} />
                    )}
                    <rect
                      x={x - candleW / 2}
                      y={bodyTop}
                      width={candleW}
                      height={bodyH}
                      fill={hollow ? 'none' : color}
                      stroke={color}
                      strokeWidth={hollow ? 1 : 0}
                    />
                  </g>
                );
              });
            })()
          )}

          {/* Time axis labels */}
          {timeLabels.map((tl) => (
            <text
              key={`tlbl-${tl.t}`}
              x={xForTime(tl.t)}
              y={PLOT_BOTTOM + 18}
              textAnchor="middle"
              fontSize={11}
              fill={subtle}
            >
              {tl.label}
            </text>
          ))}

          {/* Grouped date row beneath the time labels, centered under each
              session's span of candles. Skips groups that are too narrow to
              fit a label. */}
          {(candleDateGroups.length > 1 || (candleDateGroups.length === 1 && visibleCandles.length > 1))
            ? candleDateGroups.map((g) => {
                if (visibleCandles.length === 0) return null;
                const startX = xForIndex(g.startIdx);
                const endX = xForIndex(g.endIdx);
                const centerX = (startX + endX) / 2;
                if (endX - startX < 40) return null;
                const sampleTs = visibleCandles[g.startIdx]?.timestamp;
                if (!sampleTs) return null;
                const label = new Date(sampleTs).toLocaleDateString('en-US', {
                  timeZone: 'America/New_York',
                  month: 'short',
                  day: 'numeric',
                });
                return (
                  <text
                    key={`dlbl-${g.dateKey}-${g.startIdx}`}
                    x={centerX}
                    y={PLOT_BOTTOM + 34}
                    textAnchor="middle"
                    fontSize={10}
                    fill={subtle}
                    opacity={0.85}
                  >
                    {label}
                  </text>
                );
              })
            : null}

          {/* ── MIDDLE PANEL: Gamma horizontal bars ── */}
          {!compact && (
            <line
              x1={MID_X + MID_W / 2}
              x2={MID_X + MID_W / 2}
              y1={PLOT_TOP}
              y2={PLOT_BOTTOM}
              stroke={subtle}
              opacity={0.35}
            />
          )}
          {!compact && visibleStrikes.map((s) => {
            const y = yForPrice(s.strike);
            const barH = Math.max(2, Math.min(10, (PLOT_HEIGHT / Math.max(1, visibleStrikes.length)) * 0.55));
            const isHovered = hoveredStrike?.strike === s.strike && hover?.panel === 'middle';
            const barOpacity = isHovered ? 1 : hoveredStrike && hover?.panel === 'middle' ? 0.55 : 0.95;
            if (gexMode === 'net') {
              const w = (Math.abs(s.netGex) / gammaXMax) * (MID_W / 2);
              const positive = s.netGex >= 0;
              return (
                <g key={`gex-${s.strike}`}>
                  {showOiDots && (
                    <circle cx={MID_X + MID_W / 2} cy={y} r={1.4} fill={subtle} opacity={0.55} />
                  )}
                  {s.netGex !== 0 && (
                    <rect
                      x={positive ? MID_X + MID_W / 2 : MID_X + MID_W / 2 - Math.max(0, w)}
                      y={y - barH / 2}
                      width={Math.max(0, w)}
                      height={barH}
                      fill={positive ? colors.bullish : colors.bearish}
                      opacity={barOpacity}
                    />
                  )}
                </g>
              );
            }
            const callW = (Math.abs(s.callGex) / gammaXMax) * (MID_W / 2);
            const putW = (Math.abs(s.putGex) / gammaXMax) * (MID_W / 2);
            return (
              <g key={`gex-${s.strike}`}>
                {showOiDots && (
                  <circle cx={MID_X + MID_W / 2} cy={y} r={1.4} fill={subtle} opacity={0.55} />
                )}
                {s.callGex !== 0 && (
                  <rect
                    x={MID_X + MID_W / 2}
                    y={y - barH / 2}
                    width={Math.max(0, callW)}
                    height={barH}
                    fill={colors.bullish}
                    opacity={barOpacity}
                  />
                )}
                {s.putGex !== 0 && (
                  <rect
                    x={MID_X + MID_W / 2 - Math.max(0, putW)}
                    y={y - barH / 2}
                    width={Math.max(0, putW)}
                    height={barH}
                    fill={colors.bearish}
                    opacity={barOpacity}
                  />
                )}
              </g>
            );
          })}
          {!compact && (
            <>
              <text x={MID_X} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="start">
                -{formatExposure(gammaXMax)}
              </text>
              <text x={MID_X + MID_W / 2} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="middle">
                0
              </text>
              <text x={MID_X + MID_W} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="end">
                {formatExposure(gammaXMax)}
              </text>
              <text
                x={MID_X + MID_W / 2}
                y={PLOT_BOTTOM + 38}
                fontSize={11}
                fill={textPrimary}
                textAnchor="middle"
                fontWeight={600}
              >
                Gamma {gexMode === 'split' ? '(Call / Put)' : '(Net)'}
              </text>
            </>
          )}

          {/* ── RIGHT PANEL: Positions horizontal bars ── */}
          {!compact && (
            <line
              x1={RIGHT_X + RIGHT_W / 2}
              x2={RIGHT_X + RIGHT_W / 2}
              y1={PLOT_TOP}
              y2={PLOT_BOTTOM}
              stroke={subtle}
              opacity={0.35}
            />
          )}
          {!compact && visibleStrikes.map((s) => {
            const y = yForPrice(s.strike);
            const barH = Math.max(2, Math.min(10, (PLOT_HEIGHT / Math.max(1, visibleStrikes.length)) * 0.55));
            const callW = (s.callOi / positionsXMax) * (RIGHT_W / 2);
            const putW = (s.putOi / positionsXMax) * (RIGHT_W / 2);
            const isHovered = hoveredStrike?.strike === s.strike && hover?.panel === 'right';
            const barOpacity = isHovered ? 1 : hoveredStrike && hover?.panel === 'right' ? 0.55 : 0.95;
            return (
              <g key={`pos-${s.strike}`}>
                {s.callOi > 0 && (
                  <rect
                    x={RIGHT_X + RIGHT_W / 2}
                    y={y - barH / 2}
                    width={Math.max(0, callW)}
                    height={barH}
                    fill={colors.bullish}
                    opacity={barOpacity}
                  />
                )}
                {s.putOi > 0 && (
                  <rect
                    x={RIGHT_X + RIGHT_W / 2 - Math.max(0, putW)}
                    y={y - barH / 2}
                    width={Math.max(0, putW)}
                    height={barH}
                    fill={colors.bearish}
                    opacity={barOpacity}
                  />
                )}
              </g>
            );
          })}
          {!compact && (
            <>
              <text x={RIGHT_X} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="start">
                -{formatExposure(positionsXMax)}
              </text>
              <text x={RIGHT_X + RIGHT_W / 2} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="middle">
                0
              </text>
              <text x={RIGHT_X + RIGHT_W} y={PLOT_BOTTOM + 18} fontSize={10} fill={subtle} textAnchor="end">
                {formatExposure(positionsXMax)}
              </text>
              <text
                x={RIGHT_X + RIGHT_W / 2}
                y={PLOT_BOTTOM + 38}
                fontSize={11}
                fill={textPrimary}
                textAnchor="middle"
                fontWeight={600}
              >
                Positions
              </text>
            </>
          )}

          {/* ── Shared horizontal price level lines (drawn last so they sit on top) ── */}
          {(() => {
            // Filter to in-bounds levels and stagger their labels vertically so
            // overlapping pills always remain readable. The line itself stays
            // at the original y; a thin leader connects it to the offset pill.
            const inBounds = keyLevels.filter((lvl) => lvl.y >= PLOT_TOP && lvl.y <= PLOT_BOTTOM);
            const sorted = [...inBounds].sort((a, b) => a.y - b.y);
            const PILL_H = 16;
            const MIN_GAP = PILL_H + 2;
            const minY = PLOT_TOP + PILL_H / 2;
            const maxY = PLOT_BOTTOM - PILL_H / 2;
            const positioned = sorted.map((lvl) => ({ ...lvl, labelY: lvl.y }));

            // Top-down: never let a label sit above the previous one's bottom edge.
            for (let i = 0; i < positioned.length; i++) {
              if (i === 0) {
                positioned[i].labelY = Math.max(minY, positioned[i].labelY);
              } else {
                positioned[i].labelY = Math.max(positioned[i].labelY, positioned[i - 1].labelY + MIN_GAP);
              }
            }
            // Bottom-up: clamp to plot bottom and push earlier labels up if needed.
            for (let i = positioned.length - 1; i >= 0; i--) {
              if (positioned[i].labelY > maxY) positioned[i].labelY = maxY;
              if (i > 0 && positioned[i - 1].labelY > positioned[i].labelY - MIN_GAP) {
                positioned[i - 1].labelY = positioned[i].labelY - MIN_GAP;
              }
            }

            return positioned.map((lvl, i) => {
              const text = `${lvl.label} ${lvl.price.toFixed(2)}`;
              const pillW = Math.max(72, text.length * 5.6);
              const pillX = CW - pillW - 2;
              const lineEndX = pillX - 8;
              const offset = Math.abs(lvl.labelY - lvl.y) > 0.5;
              return (
                <g key={`lvl-${i}-${lvl.price}`}>
                  <line
                    x1={LEFT_X}
                    x2={lineEndX}
                    y1={lvl.y}
                    y2={lvl.y}
                    stroke={lvl.color}
                    strokeDasharray={lvl.emphasized ? '5 3' : '4 4'}
                    strokeWidth={lvl.emphasized ? 1.4 : 1}
                    opacity={0.85}
                  />
                  {offset && (
                    <line
                      x1={lineEndX}
                      x2={pillX}
                      y1={lvl.y}
                      y2={lvl.labelY}
                      stroke={lvl.color}
                      strokeWidth={1}
                      opacity={0.65}
                    />
                  )}
                  <rect
                    x={pillX}
                    y={lvl.labelY - PILL_H / 2}
                    width={pillW}
                    height={PILL_H}
                    rx={3}
                    fill={lvl.color}
                    opacity={lvl.emphasized ? 1 : 0.92}
                  />
                  <text
                    x={pillX + pillW / 2}
                    y={lvl.labelY + 3.5}
                    fontSize={10}
                    textAnchor="middle"
                    fill="#0b1620"
                    fontWeight={700}
                  >
                    {text}
                  </text>
                </g>
              );
            });
          })()}

          {/* ── Crosshair (drawn after levels so it overlays everything) ── */}
          {hover && hover.panel && (
            <g pointerEvents="none">
              <line
                x1={LEFT_X}
                x2={CW}
                y1={hover.svgY}
                y2={hover.svgY}
                stroke={subtle}
                strokeDasharray="3 3"
                opacity={0.55}
              />
              {hover.panel === 'left' && hoveredCandle && (
                <line
                  x1={xForTime(new Date(hoveredCandle.timestamp).getTime())}
                  x2={xForTime(new Date(hoveredCandle.timestamp).getTime())}
                  y1={PLOT_TOP}
                  y2={PLOT_BOTTOM}
                  stroke={subtle}
                  strokeDasharray="3 3"
                  opacity={0.55}
                />
              )}
              {(hover.panel === 'middle' || hover.panel === 'right') && hoveredStrike && (
                <line
                  x1={LEFT_X}
                  x2={CW}
                  y1={yForPrice(hoveredStrike.strike)}
                  y2={yForPrice(hoveredStrike.strike)}
                  stroke={subtle}
                  strokeDasharray="3 3"
                  opacity={0.75}
                />
              )}
            </g>
          )}
        </svg>

        {/* Tooltip */}
        {hover && (hoveredCandle || hoveredStrike) && (() => {
          const TOOLTIP_W = 200;
          const placeRight = hover.svgX < CW * 0.65;
          const tooltipLeft = placeRight ? hover.pxX + 14 : Math.max(8, hover.pxX - TOOLTIP_W - 14);
          const tooltipTop = Math.max(8, hover.pxY - 12);
          return (
            <div
              className="absolute z-20 pointer-events-none rounded-md px-3 py-2 text-xs"
              style={{
                left: tooltipLeft,
                top: tooltipTop,
                width: TOOLTIP_W,
                backgroundColor: popoverBg,
                border: `1px solid ${border}`,
                color: textPrimary,
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              }}
            >
              {hover.panel === 'left' && hoveredCandle && (
                <>
                  <div className="font-semibold mb-1">
                    {new Date(hoveredCandle.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="font-mono tabular-nums">
                    O {hoveredCandle.open.toFixed(2)} &nbsp; H {hoveredCandle.high.toFixed(2)}
                  </div>
                  <div className="font-mono tabular-nums">
                    L {hoveredCandle.low.toFixed(2)} &nbsp; C {hoveredCandle.close.toFixed(2)}
                  </div>
                  <div
                    className="font-mono tabular-nums mt-1"
                    style={{
                      color: hoveredCandle.close >= hoveredCandle.open ? colors.bullish : colors.bearish,
                    }}
                  >
                    {hoveredCandle.close - hoveredCandle.open >= 0 ? '+' : ''}
                    {(hoveredCandle.close - hoveredCandle.open).toFixed(2)} (
                    {(((hoveredCandle.close - hoveredCandle.open) / Math.max(1e-9, hoveredCandle.open)) * 100).toFixed(2)}%)
                  </div>
                </>
              )}
              {hover.panel === 'middle' && hoveredStrike && (
                <>
                  <div className="font-semibold mb-1">Strike ${hoveredStrike.strike.toFixed(2)}</div>
                  {gexMode === 'split' ? (
                    <>
                      <div className="font-mono tabular-nums" style={{ color: colors.bullish }}>
                        Call GEX: {formatExposure(hoveredStrike.callGex)}
                      </div>
                      <div className="font-mono tabular-nums" style={{ color: colors.bearish }}>
                        Put GEX: {formatExposure(hoveredStrike.putGex)}
                      </div>
                      <div className="font-mono tabular-nums mt-1" style={{ color: subtle }}>
                        Net: {formatExposure(hoveredStrike.netGex)}
                      </div>
                    </>
                  ) : (
                    <div
                      className="font-mono tabular-nums"
                      style={{ color: hoveredStrike.netGex >= 0 ? colors.bullish : colors.bearish }}
                    >
                      Net GEX: {formatExposure(hoveredStrike.netGex)}
                    </div>
                  )}
                </>
              )}
              {hover.panel === 'right' && hoveredStrike && (
                <>
                  <div className="font-semibold mb-1">Strike ${hoveredStrike.strike.toFixed(2)}</div>
                  <div className="font-mono tabular-nums" style={{ color: colors.bullish }}>
                    Call OI: {hoveredStrike.callOi.toLocaleString()}
                  </div>
                  <div className="font-mono tabular-nums" style={{ color: colors.bearish }}>
                    Put OI: {hoveredStrike.putOi.toLocaleString()}
                  </div>
                  <div className="font-mono tabular-nums mt-1" style={{ color: subtle }}>
                    Net: {(hoveredStrike.callOi - hoveredStrike.putOi).toLocaleString()}
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Rewind scrubber — a scroll bar with a circle slider that appears only
          while rewind is active. Dragging it moves the chart's right edge from
          the most recent plot point (right) back to the session start (left). */}
      {!compact && rewindActive && (
        <div className="px-5 pt-2 pb-3" style={{ borderTop: `1px solid ${border}` }}>
          <div className="flex items-center justify-between mb-1.5 text-[11px]">
            <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wider" style={{ color: SPOT_LINE }}>
              <Rewind size={12} />
              Rewind
              <span className="font-normal normal-case tracking-normal" style={{ color: subtle }}>
                · price, levels, gamma &amp; positions
              </span>
            </span>
            <span className="font-mono tabular-nums" style={{ color: textPrimary }}>
              {rewindLabel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={rewindMin}
              max={rewindMax}
              step={1}
              value={rewindValue}
              onChange={(e) => onRewindScrub(Number(e.target.value))}
              aria-label="Rewind to a point earlier in the session"
              className="flex-1 h-2 cursor-pointer appearance-none rounded-full outline-none
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-[#06B6D4]
                [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white
                [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab
                [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4
                [&::-moz-range-thumb]:rounded-full
                [&::-moz-range-thumb]:bg-[#06B6D4]
                [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white
                [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:border-solid"
              style={{
                background: `linear-gradient(to right, ${SPOT_LINE} 0%, ${SPOT_LINE} ${rewindFillPct}%, ${rewindTrackBg} ${rewindFillPct}%, ${rewindTrackBg} 100%)`,
              }}
            />
            {/* Playback controls — play/pause toggle, loop toggle, speed cycle.
                Disabled when there's no rewindable range so a no-op click can't
                start an interval that immediately stops. */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setPlaybackActive((v) => !v)}
                disabled={!rewindAvailable}
                className={toolbarBtnClass}
                style={toolbarBtnStyle(playbackActive)}
                title={playbackActive ? 'Pause playback' : 'Play forward from the current scrubber position'}
                aria-label={playbackActive ? 'Pause rewind playback' : 'Play rewind playback'}
              >
                {playbackActive ? <Pause size={12} /> : <Play size={12} />}
              </button>
              <button
                type="button"
                onClick={() => setPlaybackLoop((v) => !v)}
                className={toolbarBtnClass}
                // Active loop uses the rewind-cyan accent (same colour the
                // "Rewinding" pill uses up in the toolbar) so it reads as
                // distinctly engaged at a glance — the default toolbar
                // active-state was too subtle for a sticky toggle that
                // changes how playback terminates.
                style={
                  playbackLoop
                    ? {
                        border: `1px solid ${SPOT_LINE}`,
                        color: SPOT_LINE,
                        backgroundColor: 'rgba(6, 182, 212, 0.18)',
                        boxShadow: `0 0 0 1px rgba(6, 182, 212, 0.35) inset`,
                        fontWeight: 600,
                      }
                    : toolbarBtnStyle(false)
                }
                title={playbackLoop ? 'Loop on (click to disable)' : 'Loop off (click to enable continuous playback)'}
                aria-label={playbackLoop ? 'Disable loop' : 'Enable loop'}
                aria-pressed={playbackLoop}
              >
                <Repeat size={12} />
              </button>
              <button
                type="button"
                onClick={() => setPlaybackSpeed((s) => (s === 1 ? 2 : s === 2 ? 4 : 1))}
                className={toolbarBtnClass}
                style={toolbarBtnStyle(playbackSpeed !== 1)}
                title={`Playback speed: ${playbackSpeed}× (click to cycle 1× → 2× → 4×)`}
                aria-label={`Playback speed ${playbackSpeed}x, click to cycle`}
              >
                <span className="font-mono tabular-nums">{playbackSpeed}×</span>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1 text-[10px]" style={{ color: subtle }}>
            <span>Earliest · {rewindStartLabel}</span>
            <span>Most recent · {rewindEndLabel}</span>
          </div>
        </div>
      )}

      {/* Legend strip — hidden in compact mode to reclaim vertical space. */}
      {!compact && (
      <div
        className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-2 text-xs"
        style={{ borderTop: `1px solid ${border}`, color: subtle }}
      >
        <span className="flex items-center gap-1.5" title="Current spot price for the underlying">
          <svg width="22" height="6" aria-hidden="true">
            <line x1="0" x2="22" y1="3" y2="3" stroke={SPOT_LINE} strokeDasharray="5 3" strokeWidth="1.6" />
          </svg>
          <span style={{ color: textPrimary }}>Spot</span>
        </span>
        <span className="flex items-center gap-1.5" title="Price where dealer net gamma flips sign — above it dealers dampen volatility, below it they amplify it">
          <svg width="22" height="6" aria-hidden="true">
            <line x1="0" x2="22" y1="3" y2="3" stroke={FLIP_LINE} strokeDasharray="4 4" strokeWidth="1.2" />
          </svg>
          <span style={{ color: textPrimary }}>Gamma Flip</span>
        </span>
        <span className="flex items-center gap-1.5" title="Strike with the heaviest call OI — tends to act as resistance">
          <svg width="22" height="6" aria-hidden="true">
            <line x1="0" x2="22" y1="3" y2="3" stroke={KEY_LEVEL} strokeDasharray="4 4" strokeWidth="1.2" />
          </svg>
          <span style={{ color: textPrimary }}>Call Wall</span>
        </span>
        <span className="flex items-center gap-1.5" title="Strike with the heaviest put OI — tends to act as support">
          <svg width="22" height="6" aria-hidden="true">
            <line x1="0" x2="22" y1="3" y2="3" stroke={KEY_LEVEL} strokeDasharray="4 4" strokeWidth="1.2" />
          </svg>
          <span style={{ color: textPrimary }}>Put Wall</span>
        </span>
        <span className="ml-auto">Hover any panel for details</span>
      </div>
      )}

      {/* Bottom strip — hidden in compact mode to reclaim vertical space. */}
      {!compact && (
      <div
        className="flex items-center justify-between px-5 py-2 text-xs"
        style={{ borderTop: `1px solid ${border}`, color: subtle }}
      >
        <span>Powered by ZeroGEX</span>
        <span>Gamma / Positions</span>
      </div>
      )}
    </div>
  );
}
