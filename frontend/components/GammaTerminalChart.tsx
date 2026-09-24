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

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Activity, Camera, ChevronDown, ChevronsRight, HelpCircle, Info, Moon, Pause, Play, Repeat, Rewind, SlidersHorizontal, Sun } from "lucide-react";
import TooltipWrapper from "./TooltipWrapper";
import FuturesContractBadge from "./FuturesContractBadge";
import SymbolSelect from "./SymbolSelect";
import { useApiData, useMarketQuote, useGEXByStrike, useGEXProfile, useGEXSummary, useSessionCloses, type SessionClosesData, type VolatilityGaugeData } from "@/hooks/useApiData";
import { useMarketHistorical, type PriceBar } from "@/hooks/useMarketHistorical";
import { useStrikeProfileTimeseries, type StrikeProfileStrike } from "@/hooks/useStrikeProfileTimeseries";
import { useTechnicals } from "@/hooks/useTechnicals";
import { useTimeframe, type UnderlyingSymbol } from "@/core/TimeframeContext";
import { getPrimaryPriceChangeSummary, getExtendedHoursRow } from "@/core/priceChange";
import { resolvePriceSession } from "@/core/sessionCloses";
import { futuresDelayLabel } from "@/core/futuresDataStatus";
import { omitClosedMarketTimes, shouldOmitClosedMarketTimes, isIndexSymbol, isWithinRegularMarketHours, etTodayDateKey, etTradingDateLabel, omitOutOfHoursForSymbol } from "@/core/utils";
import { SYMBOLS } from "@/core/symbols";
import { wheelAction } from "@/core/wheelZoom";
import {
  cumulativeNetVolume,
  lastSessionStartIndex,
  netVolumeAreaPaths,
  netVolumeScale,
  signedAreaSegments,
  VOLUME_MODE_LABELS,
  type VolumeMode,
} from "@/core/netVolumeSeries";
import { seriesRollNote, summarizeSeriesContracts } from "@/core/futuresContract";
import { useCoarsePointer, useIsMobile } from "@/hooks/useIsMobile";
import LoadingSpinner from "./LoadingSpinner";
import ErrorMessage from "./ErrorMessage";
import ExpirationMultiSelect from "./ExpirationMultiSelect";
import { useSharedExpirations } from "@/hooks/useSharedExpirations";
import { useZeroDteOption } from "@/hooks/useZeroDteOption";
import { selectionIsRollingZeroDte } from "@/core/expirationPersistence";
import { chartSvgToPngBlob, downloadBlob, resolvedBackground } from "@/core/chartImageExport";
import { useChipInk } from "@/hooks/useChartTheme";
import { useChartExpirations } from "@/hooks/useChartExpirations";
import { useLinkedPriceAxis } from "@/core/linkedPriceAxis";
import { netGexAtSpotOrNull, atSpotGammaForScope, aboveFlipBandIsLong, offScaleBandIsLong } from "@/core/gammaRegime";
import { firstLevel, levelOrNull } from "@/core/levelValue";
import { computeMaxPainFromStrikes } from "@/core/keyLevels";
import { flipStatusChip } from "@/core/flipStatusChip";
import { resolveRewindBucket } from "@/core/rewindBucket";
import { pinLineLabel } from "@/core/pinStrike";
import { barClock, formatBarDuration } from "@/core/barClock";
import { buildRibbonLayer, ribbonBucketKey, tierFor, RIBBON_MIN_NORM, RIBBON_TIER_OPACITY } from "@/core/gexRibbons";
import {
  buildExpirationSplit,
  expirationOpacityRamp,
  expirationShares,
  shownExpirations,
  type ExpirationSegment,
} from "@/core/expirationGradient";
import { buildExpectedRange, type HorizonKey } from "@/app/live-bulletin/bulletinHelpers";
import { volatilityIndexFor } from '@/core/symbols';

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
  king: boolean; // GEX King (whole-chain heaviest-gamma strike)
  pin: boolean; // pin strike (reachable 0DTE positive-gamma pin)
  vwap: boolean;
  rail: boolean; // gamma structure rail
  regime: boolean; // long/short gamma background zones
  expectedRange: boolean; // IV-derived ±1σ expected-range band (Daily/Weekly/Monthly)
  barTimer: boolean; // countdown + elapsed on the forming candle
  ribbons: boolean; // GEX ribbons: per-strike dealer gamma through time, behind the tape
}

const DEFAULT_OVERLAYS: OverlayState = {
  levels: true,
  maxPain: true,
  pin: true,
  vwap: true,
  rail: true,
  regime: true,
  // Off by default: a new overlay shouldn't reshape every existing user's chart
  // unasked. The stored-prefs merge leaves them false for returning users too.
  king: false,
  // That reasoning still holds for Expected Range, and this stays false. What it
  // does not cover is discoverability: off-by-default made the band hard to FIND
  // rather than merely quiet, and a daily user asked for an IV expected-range
  // high/low by name without knowing the pill was already on their toolbar. That
  // is answered by the title on the pill below, which costs a returning user
  // nothing; flipping this to true would redraw every existing chart to answer
  // one person's question.
  expectedRange: false,
  barTimer: false,
  ribbons: false,
};

const OVERLAY_STORAGE_KEY = "zg.gammaChart.overlays.v1";
const STYLE_STORAGE_KEY = "zg.gammaChart.style.v1";
// Persisted volume pane view: stacked up/down columns, or the running net
// cumulative (see core/netVolumeSeries).
const VOLUME_MODE_STORAGE_KEY = "zg.gammaChart.volumeMode.v1";
// Persisted Expected-range horizon (Daily / Weekly / Monthly) for the overlay.
const ER_HORIZON_STORAGE_KEY = "zg.gammaChart.erHorizon.v1";
// Persisted ribbon opacity multiplier (see RIBBON_OPACITY_DEFAULT).
const RIBBON_OPACITY_STORAGE_KEY = "zg.gammaChart.ribbonOpacity.v1";

// ── Geometry (SVG viewBox coordinates; the SVG scales to its container) ──────
//
// Two canvases. DESKTOP is the fixed 1360×636 board the instrument was drawn
// on, scaled to whatever width the card has. That scaling is fine on a monitor
// and ruinous on a phone: at 358px wide every 11-unit label renders at under
// 3px. It used to be rescued by a 1000px minimum width inside a sideways
// scroller, which made the chart something you swiped around rather than read.
//
// COMPACT is built for the width it is drawn at, one viewBox unit per CSS px,
// so the same 10–11 unit labels are real 10–11px text. It is portrait-shaped
// (taller than wide, capped by the viewport's height), keeps the price tags
// inside the axis column instead of hanging an 82-unit gutter over the plot,
// and narrows the rail. It applies to a card under 900px on a phone-sized
// viewport or a touch screen, and to one under 700px driven by a mouse; wider
// desktop cards get the desktop board drawn at their own width (see
// desktopCanvas).
//
// The field names are the SCREAMING_CASE constants they replaced, destructured
// back into locals at the top of the component, so the drawing code reads the
// same either way.
interface ChartCanvas {
  compact: boolean;
  VW: number;
  VH: number;
  PAD_TOP: number;
  PRICE_BOTTOM: number;
  VOL_TOP: number;
  VOL_BOTTOM: number;
  TIME_AXIS_Y: number; // clock-time row
  DATE_AXIS_Y: number; // grouped trading-date row, below the times
  PLOT_LEFT: number;
  PLOT_RIGHT: number;
  INNER_PAD_X: number; // left inset before the first bar
  // Right-side gutter reserved between the newest bar and the price axis, so
  // the last candle is never hidden under the wall / gamma / last-price tags
  // that sit on the axis. (Grid + level lines still run the full width to
  // PLOT_RIGHT; only the bars are inset.)
  PAD_RIGHT: number;
  // The inline rail's column. Its center and half-width are derived per
  // instance (see `railCenter` / `railHalf`), because a panelled rail spans its
  // own element instead of this column.
  RAIL_LEFT: number;
  RAIL_RIGHT: number;
  // Terminal mode (hideRail): the tape runs out to where the rail used to end,
  // keeping the same-width axis / tag column beside it.
  PLOT_RIGHT_NO_RAIL: number;
  // Offset from the plot edge to the axis labels (`axisColX`).
  AXIS_LABEL_GAP: number;
}

const DESKTOP_CANVAS: ChartCanvas = {
  compact: false,
  VW: 1360,
  VH: 636,
  PAD_TOP: 46,
  PRICE_BOTTOM: 486,
  VOL_TOP: 508,
  VOL_BOTTOM: 586,
  TIME_AXIS_Y: 604,
  DATE_AXIS_Y: 620,
  PLOT_LEFT: 16,
  PLOT_RIGHT: 1092,
  INNER_PAD_X: 12,
  PAD_RIGHT: 82,
  RAIL_LEFT: 1172,
  RAIL_RIGHT: 1352,
  PLOT_RIGHT_NO_RAIL: 1352 - (1172 - 1092),
  AXIS_LABEL_GAP: 10,
};

// The shortest the width-aware desktop board gets (see desktopCanvas).
const DESKTOP_MIN_VH = 460;
// The full-width board's rail, which is the only one its title fits.
const DESKTOP_RAIL_W = DESKTOP_CANVAS.RAIL_RIGHT - DESKTOP_CANVAS.RAIL_LEFT;
// Narrowest card (CSS px) a mouse-driven desktop draws the desktop board at.
// Below it the board's fixed axis column and gutters would leave the tape a
// sliver, so the compact canvas takes over there too.
const DESKTOP_MIN_WIDTH = 700;

/**
 * The desktop board at the card's own width. The 1360-unit board used to be
 * scaled down to fit its card, and no desktop page gives it 1360px: beside
 * the ladders on the Terminal page (550-1080px) and on the Dashboard
 * (690-1210px) its 10-11 unit labels rendered at 4-9px. Narrower than the
 * board, the frame now narrows to the card instead (1 unit = 1 CSS px): the
 * tape and the rail give up the width, the axis column and the type keep
 * their size, and the height steps down in proportion, to a floor. At 1360
 * this returns the board unchanged.
 */
function desktopCanvas(width: number): ChartCanvas {
  const D = DESKTOP_CANVAS;
  if (width >= D.VW) return D;
  const VW = Math.round(width);
  const VH = Math.max(DESKTOP_MIN_VH, Math.round((D.VH * VW) / D.VW));
  // The same stack as the board, measured up from its bottom edge.
  const DATE_AXIS_Y = VH - (D.VH - D.DATE_AXIS_Y);
  const TIME_AXIS_Y = VH - (D.VH - D.TIME_AXIS_Y);
  const VOL_BOTTOM = VH - (D.VH - D.VOL_BOTTOM);
  const VOL_TOP = VOL_BOTTOM - (D.VOL_BOTTOM - D.VOL_TOP);
  const PRICE_BOTTOM = VOL_TOP - (D.VOL_TOP - D.PRICE_BOTTOM);
  const RAIL_RIGHT = VW - (D.VW - D.RAIL_RIGHT);
  const railW = D.RAIL_RIGHT - D.RAIL_LEFT;
  const RAIL_LEFT = RAIL_RIGHT - Math.round(Math.min(railW, Math.max(130, (VW * railW) / D.VW)));
  const axisW = D.RAIL_LEFT - D.PLOT_RIGHT;
  return {
    ...D,
    VW,
    VH,
    PRICE_BOTTOM,
    VOL_TOP,
    VOL_BOTTOM,
    TIME_AXIS_Y,
    DATE_AXIS_Y,
    PLOT_RIGHT: RAIL_LEFT - axisW,
    RAIL_LEFT,
    RAIL_RIGHT,
    PLOT_RIGHT_NO_RAIL: RAIL_RIGHT - axisW,
  };
}

// Widest card (CSS px) that still gets the compact canvas.
const COMPACT_MAX_WIDTH = 900;
// Price column on the compact canvas: axis labels, with the price tags
// right-aligned inside it (a 9-character NDX tag is ~67 units).
const COMPACT_AXIS_W = 68;

/**
 * The compact canvas for a card `width` CSS px wide. Portrait screens get a
 * tall board (about 1.3× as tall as wide — a phone has height to spare and the
 * price pane is what it is for); a phone turned to landscape has ~350px of
 * height, so there the board is short and wide. Keyed on orientation rather
 * than on the measured viewport height, which a phone's collapsing address bar
 * changes on every scroll.
 */
function compactCanvas(width: number, landscape: boolean): ChartCanvas {
  const VW = Math.max(300, Math.round(width));
  const VH = landscape
    ? Math.min(420, Math.max(330, Math.round(VW * 0.62)))
    : Math.min(640, Math.max(400, Math.round(VW * 1.3)));
  const DATE_AXIS_Y = VH - 7;
  const TIME_AXIS_Y = VH - 21;
  const VOL_BOTTOM = VH - 34;
  const VOL_TOP = VOL_BOTTOM - 48;
  const PRICE_BOTTOM = VOL_TOP - 16;
  const RAIL_RIGHT = VW - 4;
  const RAIL_LEFT = RAIL_RIGHT - Math.round(Math.min(110, Math.max(58, VW * 0.17)));
  const PLOT_RIGHT = RAIL_LEFT - COMPACT_AXIS_W;
  return {
    compact: true,
    VW,
    VH,
    // Room for the regime caption; the OHLC readout sits above the canvas
    // rather than over it on this canvas.
    PAD_TOP: 26,
    PRICE_BOTTOM,
    VOL_TOP,
    VOL_BOTTOM,
    TIME_AXIS_Y,
    DATE_AXIS_Y,
    PLOT_LEFT: 6,
    PLOT_RIGHT,
    INNER_PAD_X: 6,
    PAD_RIGHT: 12,
    RAIL_LEFT,
    RAIL_RIGHT,
    PLOT_RIGHT_NO_RAIL: RAIL_RIGHT - COMPACT_AXIS_W,
    AXIS_LABEL_GAP: 5,
  };
}

// View window (zoom + pan). We keep a deep pool of bars in memory and show a
// movable slice of it; the price axis auto-fits whatever is visible.
const POOL = 400; // bars retained for panning
const DEFAULT_COUNT = 90; // bars shown in the default, live-following view
// The compact canvas has ~270 units of tape against the desktop board's ~990,
// so it opens on fewer bars (five hours of 5-minute candles) — each candle
// stays a readable few px wide. Pinch or the Time buttons widen it.
const COMPACT_DEFAULT_COUNT = 60;
const MIN_COUNT = 18; // most zoomed-in (time)
const ZOOM_FACTOR = 1.2;
// Vertical (price-axis) zoom. `zoom` is the fraction of the auto-fit price
// range shown: <1 stretches the candles (zoom in), >1 scrunches them (more
// range in the same height). `center` is null while auto-fitting, or a pinned
// price once the user scrunches / pans vertically.
const PRICE_ZOOM_MIN = 0.15;
const PRICE_ZOOM_MAX = 8;
const DEFAULT_PRICE_VIEW: { zoom: number; center: number | null } = { zoom: 1, center: null };
// Ribbon colors — neon orbs: a saturated hue blooms around each orb (blurred
// copy underneath) and a hot, near-white rim sits on top; the body is a
// bright mix of the two. Sign keeps the ladder's warm (dealer long gamma) /
// cool (short gamma) convention. Tokens live in globals.css with per-theme
// values; the fallbacks are the dark-theme neon set.
const RIBBON_POS_GLOW = "var(--ribbon-pos-glow, #FFB300)";
const RIBBON_POS_CORE = "var(--ribbon-pos-core, #FFF1B8)";
const RIBBON_NEG_GLOW = "var(--ribbon-neg-glow, #7C6CFF)";
const RIBBON_NEG_CORE = "var(--ribbon-neg-core, #E4E0FF)";
const RIBBON_POS_BODY = `color-mix(in srgb, ${RIBBON_POS_CORE} 45%, ${RIBBON_POS_GLOW})`;
const RIBBON_NEG_BODY = `color-mix(in srgb, ${RIBBON_NEG_CORE} 45%, ${RIBBON_NEG_GLOW})`;
// Bloom strength per magnitude tier (the crisp orb itself uses
// RIBBON_TIER_OPACITY from core/gexRibbons).
const RIBBON_GLOW_OPACITY: Record<"strong" | "mid" | "weak", number> = { strong: 0.5, mid: 0.25, weak: 0.1 };
// Blur radius of the bloom, in viewBox units (~2 CSS px at typical widths).
const RIBBON_GLOW_BLUR = 2.8;
// User-adjustable opacity multiplier over every ribbon channel (body, bloom,
// rim). 1 is the tuned look; the default sits a notch under it so the tape
// leads by default and a reader who wants the ribbons louder can turn them up.
const RIBBON_OPACITY_DEFAULT = 0.9;
const RIBBON_OPACITY_MIN = 0.1;
const RIBBON_OPACITY_MAX = 1.5;
const clampRibbonOpacity = (v: number) => Math.min(RIBBON_OPACITY_MAX, Math.max(RIBBON_OPACITY_MIN, v));
// The reading guide behind the legend's info icon — every visual channel of
// the ribbons, in the order a reader meets them: what an orb is, then height,
// opacity, colour, and how a lane evolves.
const RIBBON_GUIDE =
  "GEX ribbons: every strike is a horizontal lane, and every bar drops one orb in it. " +
  "HEIGHT is that strike's net dealer gamma in the bar's 5-minute analytics bucket, as a share of the heaviest " +
  "strike on screen — an orb never exceeds its lane and is capped so zooming the price axis does not balloon it. " +
  "OPACITY steps with the same share: faint below 15%, medium to 50%, solid above; orbs under 5% are not drawn. " +
  "COLOR is the sign: gold means dealers are net LONG gamma at the strike (they sell into strength and buy weakness " +
  "there — a magnet and a brake), violet means net SHORT (they chase — an accelerant). " +
  "A fat lane that persists all session is a wall; a lane thickening is positioning building, thinning is eroding, " +
  "and a lane changing colour is the strike flipping sides. Hover a bar on a lane to read the exact strike and value. " +
  "History covers the polled strike window, so earlier bars stay blank. " +
  "The slider beside the Ribbons pill scales the overall opacity.";

// ── Gamma-by-strike rail view ── the rail draws either the smoothed net
// silhouette (default, existing behavior) or discrete per-strike bars: NET
// (one signed bar), SPLIT (separate call + put bars) or COMBINED (split bars
// plus a net overlay), mirroring the GEX Strike Profile chart.
type RailMode = "silhouette" | "net" | "split" | "combined";
interface RailStrike {
  price: number;
  callGex: number;
  putGex: number;
  netGex: number;
}
const RAIL_STORAGE_KEY = "zg.gammaChart.rail.v1";
// Net-overlay bar color for "combined" mode — violet, distinct from bull/bear.
const NET_BAR_COLOR = "#7C3AED";
// Base opacity every rail bar (and every expiry segment within one) is drawn at.
const RAIL_BAR_OPACITY = 0.85;
// Below this per-strike vertical slot (px) the on-bar $ labels are suppressed;
// zoom the price axis to spread the strikes apart and they reappear.
const RAIL_LABEL_MIN_SLOT = 12;

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

// Net cumulative volume is a signed quantity, and a "+" is what separates
// "buyers are up 1.2M contracts on the day" from a plain volume count.
function fmtVolSigned(v: number): string {
  return `${v >= 0 ? "+" : "−"}${fmtVol(Math.abs(v))}`;
}

function fmtGex(v: number): string {
  const abs = Math.abs(v);
  const sign = v >= 0 ? "+" : "−";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

// The exact instant a quote is "as of", rendered to the second in ET. Both the
// live and the ~15-min-delayed views show this so it's unambiguous how fresh
// the headline price is (the delayed view's headline is intentionally stale, so
// the timestamp is what tells a visitor it's from ~15 min ago, not right now).
// The timeZone + locale are pinned, so server and client format identically —
// no hydration mismatch on the delayed (server-rendered) snapshot.
function fmtEtStamp(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return (
    d.toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }) + " ET"
  );
}

// Wall-clock time (to the second, ET) for the LIVE view's "updated …" line.
// The streamed quote's own `timestamp` is minute-aligned (always :00), so
// rendering it makes a real-time feed look like it only ticks once a minute.
// Instead we stamp the instant each fresh tick lands on the client, which
// advances every second the tape is moving — honestly conveying "live".
function fmtEtClock(d: Date | null): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return (
    d.toLocaleTimeString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }) + " ET"
  );
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
/** The terminal headline's futures chip — shared by the display-swap badge and
 *  the contract chip that replaces it on a natively-served ES / NQ chart, so
 *  the two never differ in shape. */
const FUTURES_CHIP_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.04em",
  color: "var(--color-brand-coral)",
  border: "1px solid var(--color-brand-coral)",
  borderRadius: 3,
  padding: "1px 5px",
  lineHeight: 1.4,
};

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
    data_symbol?: string | null;
    futures_close?: number | null;
    futures_reference_close?: number | null;
    data_contract?: string | null;
    data_contract_expiry?: string | null;
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

/**
 * Where the tape sits on screen, in CSS px from the top edge of the chart card,
 * reported through `onGeometry` so a surface mounting instruments beside the
 * chart (the Gamma Terminal's ladders) can pin its rows to the same y. Measured
 * from the rendered SVG, not derived: the viewBox scales with the container.
 */
export interface ChartGeometry {
  /** Top / bottom of the price plot band. */
  plotTop: number;
  plotBottom: number;
  /** y of the live spot price, null when spot is unknown. */
  spotY: number | null;
  /** Rendered height of the whole chart card. */
  height: number;
}

/** The chart's replay clock, reported through `onRewind` so instruments beside
 *  the chart (the Gamma Terminal's ladders) can show the book as of the same
 *  moment. `time` is the clock in ms while rewinding, null when live. */
export interface RewindState {
  active: boolean;
  time: number | null;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function GammaTerminalChart({
  className = "",
  snapshot = null,
  delayed: delayedProp = false,
  hideRail = false,
  centerPriceOnSpot = false,
  storageScope,
  overlayDefaults,
  onGeometry,
  onRewind,
  strikePanelTarget = null,
  strikePanelBand = null,
  railControlsTarget = null,
}: {
  className?: string;
  snapshot?: ChartSnapshot | null;
  /** Force delayed (public) mode even without a snapshot, so a failed snapshot
   *  fetch degrades to an empty delayed chart rather than live client polling. */
  delayed?: boolean;
  /** Terminal mode: drop the gamma-structure rail column (a ladder beside the
   *  chart carries that information) and give its width to the tape. */
  hideRail?: boolean;
  /** Hold the live spot at the vertical center of the tape, so instruments
   *  beside the chart that are centered on spot line up with it. */
  centerPriceOnSpot?: boolean;
  /** Suffix for the persisted view preferences, so a surface with its own
   *  defaults never rewrites /chart's saved view (or the reverse). */
  storageScope?: string;
  /** Overlay defaults for this surface; a saved view still wins after hydration. */
  overlayDefaults?: Partial<OverlayState>;
  /** Receives the tape's on-screen geometry whenever it changes. */
  onGeometry?: (geometry: ChartGeometry) => void;
  /** Receives the replay clock whenever rewind starts, moves, or ends. */
  onRewind?: (state: RewindState) => void;
  /**
   * Draw the gamma-structure rail HERE instead of inside the chart's own SVG.
   *
   * The Gamma Terminal keeps one layout — tape on the left, a panel beside it —
   * and lets the reader choose what the panel holds: two gamma ladders, or this
   * rail. So the rail has to leave the chart's right-hand column and become a
   * panel of its own, WITHOUT leaving the component: every number it draws
   * (the live bucket vs the rewound one vs the delayed snapshot, the expiry
   * scope, the per-expiration split) is derived here, and a second component
   * re-deriving it is a second chance to disagree with the tape it sits beside.
   *
   * So the chart portals the rail into the element the page gives it. The page
   * owns where that element sits — it positions it across the tape's own price
   * band, so a strike's bar is level with that price on the candles — and the
   * chart owns what is drawn in it and at what scale. The rail's x geometry
   * becomes per-instance (see `railCenter` / `railHalf`): inline it spans its
   * old column, in a panel it spans the element, with the viewBox shaped to the
   * element's aspect so nothing is stretched.
   *
   * Null (the default) keeps the rail inline, which is what /dashboard,
   * /my-dashboard and the public gamma-levels pages still mount.
   */
  strikePanelTarget?: HTMLElement | null;
  /**
   * Where the chart's price band sits inside `strikePanelTarget`, in CSS px
   * from that element's top — `top` to the tape's first price, `height` for
   * the band itself.
   *
   * This is what ties the panel to the tape: one px-per-price scale is derived
   * from it and used for the whole element, so a strike lands at exactly the
   * height that price has on the candles. The element is taller than the band
   * (it fills its card, while the band is only as tall as the tape, which
   * starts below the chart's header), and that surplus is not padding: the
   * panel keeps the same scale through it and draws the strikes that sit just
   * above and just below the visible tape, which is precisely where the wall
   * you are about to run into tends to be.
   *
   * Null — a stacked layout, with no chart band beside it to match — falls back
   * to fitting the visible price domain to the element.
   */
  strikePanelBand?: { top: number; height: number } | null;
  /** Where to put the rail's own view controls (Silhouette / Net / Split /
   *  Combined + Labels) when the rail is panelled — they belong on the panel,
   *  not on the toolbar of a chart that is no longer drawing it. */
  railControlsTarget?: HTMLElement | null;
}) {
  const delayed = delayedProp || !!snapshot;
  const live = !delayed;

  // ── Canvas ── desktop board or compact (see ChartCanvas). Chosen from the
  // card's measured width, so it is decided on the client: the server and the
  // first client render both draw the desktop board, and a layout effect swaps
  // in the compact one before the browser paints. On a phone the unmeasured
  // board is kept invisible by CSS until then (.zg-gc-canvas in globals.css),
  // so it never flashes at 3px text.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rootEl, setRootEl] = useState<HTMLDivElement | null>(null);
  const setRootNode = useCallback((el: HTMLDivElement | null) => {
    rootRef.current = el;
    setRootEl(el);
  }, []);
  const [box, setBox] = useState<{ w: number; landscape: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!rootEl) return;
    const measure = () => {
      const w = rootEl.clientWidth;
      const landscape = window.innerWidth > window.innerHeight;
      setBox((cur) => (cur && Math.abs(cur.w - w) < 1 && cur.landscape === landscape ? cur : { w, landscape }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(rootEl);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", measure);
    };
  }, [rootEl]);
  const isMobile = useIsMobile();
  const coarsePointer = useCoarsePointer();
  // A phone or touch screen: the gesture grammar and the touch copy apply.
  const touchUi = isMobile || coarsePointer;
  const canvas = useMemo(() => {
    if (!box || box.w <= 0) return DESKTOP_CANVAS;
    if (box.w < (touchUi ? COMPACT_MAX_WIDTH : DESKTOP_MIN_WIDTH)) return compactCanvas(box.w, box.landscape);
    return desktopCanvas(box.w);
  }, [box, touchUi]);
  const {
    compact,
    VW,
    VH,
    PAD_TOP,
    PRICE_BOTTOM,
    VOL_TOP,
    VOL_BOTTOM,
    TIME_AXIS_Y,
    DATE_AXIS_Y,
    PLOT_LEFT,
    PLOT_RIGHT,
    INNER_PAD_X,
    PAD_RIGHT,
    RAIL_LEFT,
    RAIL_RIGHT,
    PLOT_RIGHT_NO_RAIL,
    AXIS_LABEL_GAP,
  } = canvas;
  const defaultCount = compact ? COMPACT_DEFAULT_COUNT : DEFAULT_COUNT;
  // The compact toolbar's Layers panel (closed until asked for).
  const [layersOpen, setLayersOpen] = useState(false);
  const layersPanelId = useId();

  // Per-instance plot geometry: without the rail the tape widens to where the
  // rail used to end and the axis / tag column moves out with it.
  const plotRight = hideRail ? PLOT_RIGHT_NO_RAIL : PLOT_RIGHT;
  const axisColX = plotRight + AXIS_LABEL_GAP;
  const axisRight = hideRail ? VW : RAIL_LEFT;
  // Where a price tag's RIGHT edge sits. The desktop board hangs its tags off
  // the plot edge, over the PAD_RIGHT gutter; the compact canvas has no width
  // for that gutter, so its tags ride inside the axis column instead, the way a
  // phone trading app draws them.
  const tagX = compact ? axisRight - 1 : axisColX - 6;
  const { symbol: ctxSymbol, setSymbol } = useTimeframe();
  const symbol = snapshot ? snapshot.symbol : ctxSymbol;
  // On a linked split board the price axis is shared with the other half — see
  // core/linkedPriceAxis. Null everywhere else, and every path below falls back
  // to this chart's own private `priceView` when it is.
  const priceLink = useLinkedPriceAxis();
  const linkedView = priceLink ? priceLink.view : null;
  // The window every linked chart on THIS symbol shares — the union of what
  // each would auto-fit to on its own. Null when unlinked, or when this chart
  // is the only one on its symbol (nothing to reconcile with).
  const linkedBase = priceLink ? priceLink.domains.get(symbol) ?? null : null;
  // Price tags are filled with a level's own colour, so their text is picked
  // per chip rather than from the theme's inverse ink.
  const chipInk = useChipInk();
  const [timeframeState, setTimeframe] = useState<ChartTimeframe>("5min");
  const timeframe = snapshot ? snapshot.timeframe : timeframeState;
  const [style, setStyle] = useState<PriceStyle>("candles");
  const [volumeMode, setVolumeMode] = useState<VolumeMode>("updown");
  const [overlays, setOverlays] = useState<OverlayState>(() => ({ ...DEFAULT_OVERLAYS, ...overlayDefaults }));

  // ── Where the rail is drawn ──────────────────────────────────────────────
  // Inline (the default) it occupies its own column inside the chart's SVG.
  // Panelled (`strikePanelTarget`) it is portalled out to an element the page
  // positions beside the tape, and the chart's own column is gone.
  const inPanel = !!strikePanelTarget;
  // The panel's pixel box, so the viewBox can be shaped to its aspect and the
  // bars are never stretched. Measured rather than assumed: the page sizes the
  // element from the chart's reported geometry, which moves with the layout.
  const [panelBox, setPanelBox] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = strikePanelTarget;
    // Nothing to measure, and nothing to clear: `panelBox` is only read while a
    // target exists, so a stale box is never drawn from.
    if (!el) return;
    // ResizeObserver fires once on observe, so the first measurement arrives
    // from the observer rather than from a synchronous setState in this body.
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setPanelBox((cur) =>
        cur && Math.abs(cur.width - r.width) < 0.5 && Math.abs(cur.height - r.height) < 0.5
          ? cur
          : { width: r.width, height: r.height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [strikePanelTarget]);
  // The panel's viewBox, in the chart's own y units — which is the whole trick:
  // `yPrice` is then correct inside the panel with no adjustment at all, so a
  // strike is drawn at the height its price has on the tape.
  //
  // `u` is the one scale: chart y-units per CSS px, taken from the band the
  // page reports. Everything else follows from it, which is also why nothing is
  // ever stretched — width and height are converted by the same number, so the
  // viewBox always has the element's aspect.
  const PANEL_VB_H = PRICE_BOTTOM - PAD_TOP;
  const panelVb = (() => {
    if (!panelBox || panelBox.height <= 0) {
      return { y: PAD_TOP, h: PANEL_VB_H, w: RAIL_RIGHT - RAIL_LEFT };
    }
    if (strikePanelBand && strikePanelBand.height > 0) {
      const u = PANEL_VB_H / strikePanelBand.height;
      return { y: PAD_TOP - strikePanelBand.top * u, h: panelBox.height * u, w: Math.max(60, panelBox.width * u) };
    }
    // No band to match: fit the tape's price band to the element instead.
    return { y: PAD_TOP, h: PANEL_VB_H, w: Math.max(60, PANEL_VB_H * (panelBox.width / panelBox.height)) };
  })();
  const railLeft = inPanel ? 0 : RAIL_LEFT;
  const railRight = inPanel ? panelVb.w : RAIL_RIGHT;
  const railCenter = (railLeft + railRight) / 2;
  const railHalf = (railRight - railLeft) / 2 - 10;
  // Inline, the rail is an overlay the reader toggles off. Panelled, it IS the
  // panel — the page's own view switch put it there, so an overlay pill that
  // could empty the panel would be a second, contradictory control.
  const railOn = inPanel || (overlays.rail && !hideRail);
  const [erHorizon, setErHorizon] = useState<HorizonKey>("daily");
  const [ribbonOpacity, setRibbonOpacity] = useState(RIBBON_OPACITY_DEFAULT);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<{ count: number; offset: number }>({ count: DEFAULT_COUNT, offset: 0 });
  // The live view's bar count follows the canvas: when the compact canvas is
  // swapped in after measuring (or out again on a resize), an untouched view
  // takes that canvas's default. A view the reader has zoomed or panned is left
  // alone. Adjusted during render, like the symbol/timeframe reset below.
  const [viewDefault, setViewDefault] = useState(DEFAULT_COUNT);
  if (viewDefault !== defaultCount) {
    setViewDefault(defaultCount);
    setView((v) => (v.count === viewDefault && v.offset === 0 ? { count: defaultCount, offset: 0 } : v));
  }
  const [priceView, setPriceView] = useState<{ zoom: number; center: number | null }>(DEFAULT_PRICE_VIEW);
  // The zoom/pan actually on screen, wherever it is stored. Gesture handlers
  // read this so a drag on the half that ISN'T driving still starts from what
  // that half is showing.
  const effPriceZoom = priceLink ? (linkedView?.zoom ?? 1) : priceView.zoom;
  const priceIsManual = priceLink
    ? linkedView !== null
    : priceView.center !== null || priceView.zoom !== 1;
  // Client-stamped instant of the latest live quote tick — drives the realtime
  // "updated HH:MM:SS ET" line (see fmtEtClock). Null until the first tick and
  // in delayed mode; never used server-side, so no hydration mismatch.
  const [liveUpdatedAt, setLiveUpdatedAt] = useState<Date | null>(null);

  // ── Rewind (session replay) ── Live-only. When active the chart freezes at
  // `rewindTime` and shows price + dealer gamma "as it looked" then; playback
  // steps the anchor forward. The gamma structure comes from the strike-profile
  // timeseries (only fetched once rewind is entered, so it adds no idle load).
  const [rewindActive, setRewindActive] = useState(false);
  const [rewindTime, setRewindTime] = useState<number | null>(null);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 4 | 8 | 16>(1);
  // Sticky preference: when on, playback wraps back to the earliest replayable
  // bar at the live edge instead of stopping (kept across enter/exit rewind).
  const [playbackLoop, setPlaybackLoop] = useState(false);
  // Vertical domain captured when rewind is entered. While rewinding we freeze
  // the y-axis to this instead of re-fitting to the scrubbed bars, so the price
  // scale never jumps as you scrub — the user still zooms/pans it by hand.
  const [frozenAxis, setFrozenAxis] = useState<{ mid: number; half: number } | null>(null);

  // ── Gamma-by-strike rail view ── mode (smoothed silhouette vs per-strike
  // bars), the on-bar $ labels toggle, and an expiration filter — an inline
  // GEX-by-strike profile matching the GEX Strike Profile chart. The delayed
  // snapshot ships the net silhouette but no per-strike call/put split and can't
  // refetch, so bar modes + the expiry filter are live-only (see effectiveRailMode).
  const [railMode, setRailMode] = useState<RailMode>("silhouette");
  const [railLabels, setRailLabels] = useState(false);
  // Expiration filter for the gamma-by-strike rail. Shared + persisted across
  // every expiration-filtering chart in the tab (see useSharedExpirations);
  // empty = all (aggregate the whole chain). The READ side is resolved further
  // down by useChartExpirations (reconciled to this chart's live expirations, so
  // a foreign/stale pick can't request a missing expiry); only the setter is
  // taken straight from the store, because the symbol-change reset below fires
  // during render, ahead of that call.
  const { selection: rawRailExpiries, setSelection: setRailExpiries } = useSharedExpirations();
  const effectiveRailMode: RailMode = live ? railMode : "silhouette";

  // Snap the view back to the live default whenever the instrument or timeframe
  // changes. This is the React-sanctioned "adjust state during render on a prop
  // change" pattern (same shape the data hooks use), so it needs no effect.
  const [viewKey, setViewKey] = useState(`${symbol}:${timeframe}`);
  if (viewKey !== `${symbol}:${timeframe}`) {
    setViewKey(`${symbol}:${timeframe}`);
    setView({ count: defaultCount, offset: 0 });
    setPriceView(DEFAULT_PRICE_VIEW);
    setRewindActive(false);
    setRewindTime(null);
    setPlaybackActive(false);
    setFrozenAxis(null);
  }

  // Clear the expiration filter when the instrument changes (a QQQ expiry is
  // meaningless for SPY); timeframe changes keep it (same option chain).
  //
  // The rolling 0DTE token is the exception, and survives: "whatever expires
  // today" means the same thing on every chain, so the reason for clearing does
  // not apply to it. Clearing it here would quietly widen a 0DTE board to the
  // whole chain the first time the user switched symbols.
  const [railExpSym, setRailExpSym] = useState(symbol);
  if (railExpSym !== symbol) {
    setRailExpSym(symbol);
    if (!selectionIsRollingZeroDte(rawRailExpiries)) setRailExpiries([]);
  }

  // Persisted-preference keys. A surface that mounts this chart beside other
  // instruments (the Gamma Terminal) scopes them so its defaults — ribbons on,
  // no rail — never leak into /chart's saved view, and vice versa.
  const overlayKey = storageScope ? `${OVERLAY_STORAGE_KEY}.${storageScope}` : OVERLAY_STORAGE_KEY;
  const styleKey = storageScope ? `${STYLE_STORAGE_KEY}.${storageScope}` : STYLE_STORAGE_KEY;
  const volumeModeKey = storageScope ? `${VOLUME_MODE_STORAGE_KEY}.${storageScope}` : VOLUME_MODE_STORAGE_KEY;
  const erKey = storageScope ? `${ER_HORIZON_STORAGE_KEY}.${storageScope}` : ER_HORIZON_STORAGE_KEY;
  const railKey = storageScope ? `${RAIL_STORAGE_KEY}.${storageScope}` : RAIL_STORAGE_KEY;
  const ribbonOpacityKey = storageScope ? `${RIBBON_OPACITY_STORAGE_KEY}.${storageScope}` : RIBBON_OPACITY_STORAGE_KEY;

  // Restore persisted view preferences once on mount. Server and the first
  // client render intentionally use the defaults; we only reconcile from
  // localStorage after mount so there is no hydration mismatch. The rule below
  // guards against cascading-render setState in effects, which is exactly (and
  // only) what this one-time hydration does on purpose.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const rawO = localStorage.getItem(overlayKey);
      if (rawO) setOverlays((cur) => ({ ...cur, ...JSON.parse(rawO) }));
      const rawS = localStorage.getItem(styleKey);
      if (rawS === "candles" || rawS === "line" || rawS === "area") setStyle(rawS);
      const rawV = localStorage.getItem(volumeModeKey);
      if (rawV === "updown" || rawV === "net") setVolumeMode(rawV);
      const rawH = localStorage.getItem(erKey);
      if (rawH === "daily" || rawH === "weekly" || rawH === "monthly") setErHorizon(rawH);
      const rawA = localStorage.getItem(ribbonOpacityKey);
      if (rawA != null) {
        const parsed = parseFloat(rawA);
        if (Number.isFinite(parsed)) setRibbonOpacity(clampRibbonOpacity(parsed));
      }
      const rawR = localStorage.getItem(railKey);
      if (rawR) {
        const parsed = JSON.parse(rawR);
        if (parsed && typeof parsed === "object") {
          if (parsed.mode === "silhouette" || parsed.mode === "net" || parsed.mode === "split" || parsed.mode === "combined") {
            setRailMode(parsed.mode);
          }
          if (typeof parsed.labels === "boolean") setRailLabels(parsed.labels);
        }
      }
    } catch {
      /* ignore malformed prefs */
    }
    setHydrated(true);
  }, [overlayKey, styleKey, volumeModeKey, erKey, railKey, ribbonOpacityKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(overlayKey, JSON.stringify(overlays));
    } catch {
      /* storage unavailable */
    }
  }, [overlays, hydrated, overlayKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(styleKey, style);
    } catch {
      /* storage unavailable */
    }
  }, [style, hydrated, styleKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(volumeModeKey, volumeMode);
    } catch {
      /* storage unavailable */
    }
  }, [volumeMode, hydrated, volumeModeKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(erKey, erHorizon);
    } catch {
      /* storage unavailable */
    }
  }, [erHorizon, hydrated, erKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(railKey, JSON.stringify({ mode: railMode, labels: railLabels }));
    } catch {
      /* storage unavailable */
    }
  }, [railMode, railLabels, hydrated, railKey]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(ribbonOpacityKey, String(ribbonOpacity));
    } catch {
      /* storage unavailable */
    }
  }, [ribbonOpacity, hydrated, ribbonOpacityKey]);

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
  // Expected-range band inputs. QQQ/NDX take VXN, SPX/SPY take VIX — the same
  // implied-vol mapping the Live Bulletin uses. Live-only: the delayed public
  // snapshot does zero client fetching, so the band simply hides there (exactly
  // as the Bulletin hides it when the vol index is unavailable).
  const volIndex: "VIX" | "VXN" = volatilityIndexFor(symbol);
  const { data: volGauge } = useApiData<VolatilityGaugeData>(
    `/api/market/volatility?ticker=${volIndex}`,
    { refreshInterval: live ? 30000 : 0, enabled: live },
  );
  const vix = live ? volGauge?.index ?? null : null;
  // Per-strike dealer gamma over time. Enabled for the whole live session (not
  // just rewind) so the live rail is drawn from the SAME per-strike source the
  // rewind rail uses — the two now read identically. Paused (no 1s tip poll)
  // while rewinding since we hold it frozen; polled otherwise so the live tip
  // stays fresh. Never enabled in delayed mode (the snapshot supplies strikes).
  // Pinned to 5-min buckets; anchors resolve by timestamp so they align with
  // candles of any timeframe. Seeding here also makes entering rewind instant.
  // Available expirations (future-dated, ascending) for the multi-select, the
  // reconciled selection, and the endpoint param — resolved by the shared hook
  // so the Playbook under the chart reads the exact same filtered book (and
  // shares this chart's strike-profile-timeseries cache entry).
  //
  // `railExpParam`: empty selection = all (aggregate the whole chain), else the
  // sorted, comma-joined set. Drives the rail bars and — when a subset is
  // chosen — the flip/walls, so the lines match the bars.
  const {
    available: availableExpiries,
    selection: effectiveRailExpiries,
    param: railExpParam,
    filtered: filteredExp,
  } = useChartExpirations(symbol, live);
  const { buckets: gexBuckets } = useStrikeProfileTimeseries(symbol, "5min", railExpParam, rewindActive, live);

  const dataAll = snapshot ? snapshot.bars : liveRows;
  const loading = snapshot ? false : liveLoading;
  const error = snapshot ? null : liveError;
  const liveClose = snapshot ? snapshot.quote?.close ?? null : quote?.close ?? null;
  const session = snapshot ? snapshot.quote?.session ?? null : quote?.session ?? null;
  const quoteTs = snapshot ? snapshot.quote?.timestamp ?? null : quote?.timestamp ?? null;
  const sessionCloses = snapshot ? snapshot.sessionCloses : liveSessionCloses;
  // Overnight index→future display swap (see priceChange.ts / SessionBadge).
  // When active, the headline shows the FUTURE's price/change and the session
  // badge reads FUTURES — the "same spot" a cash-closed index would read CLOSED.
  // The chart candles + price marker deliberately stay on the cash tape.
  const displaySource = snapshot ? snapshot.quote?.display_source ?? null : quote?.display_source ?? null;
  const futuresSwap = displaySource === "futures";
  // ES / NQ only: the feed's own age. `session` describes the CME calendar, so
  // it reads "open" through the whole futures session and would light the LIVE
  // pill on top of a delayed feed. Freshness is a separate axis and the badge
  // has to read it, or the chart claims to be live while the header beside it
  // says the same tape is ten minutes old. Absent on every cash symbol.
  const feedStale = !snapshot && quote?.stale === true;
  const feedAgeSeconds = !snapshot && typeof quote?.data_age_seconds === "number"
    ? quote.data_age_seconds
    : null;
  const futuresTicker = futuresSwap
    ? (snapshot ? snapshot.quote?.data_symbol : quote?.data_symbol) ?? null
    : null;
  // Which CME contract the headline price is. Read off the quote on BOTH
  // futures paths — the overnight swap above and a natively-served ES / NQ
  // chart, which sets none of the swap fields — because "NQ 29,302.25" with no
  // contract beside it is exactly what readers were comparing against another
  // platform's different contract. Absent on every cash symbol, and on a
  // response that predates the field, in which case nothing extra renders.
  const contractCode =
    (snapshot ? snapshot.quote?.data_contract : quote?.data_contract) ?? null;
  const contractExpiry =
    (snapshot ? snapshot.quote?.data_contract_expiry : quote?.data_contract_expiry) ?? null;

  // Stamp the wall-clock instant each fresh live tick lands, so the header can
  // show a realtime "updated HH:MM:SS ET" that advances with the tape instead of
  // the streamed quote's minute-aligned (:00) timestamp. Keyed on the quote's
  // mutable fields so it re-stamps only when price/volume actually moves (the
  // poll fires ~every second in regular hours). Delayed mode renders a frozen
  // snapshot and is never stamped. Deliberate, self-limited setState-in-effect:
  // it fires at most at the ~1s tick cadence, not in a render cascade.
  const liveQuoteKey =
    live && quote ? `${quote.timestamp}|${quote.close}|${quote.high}|${quote.low}|${quote.volume ?? ""}` : null;
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (liveQuoteKey == null) return;
    setLiveUpdatedAt(new Date());
  }, [liveQuoteKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const data = useMemo(() => dataAll.slice(-POOL), [dataAll]);

  // The bars' own contracts, which are per-row and can differ across the pool:
  // a multi-day futures range spanning a roll really does hold two contracts,
  // and the step in price where they meet is cost of carry rather than a market
  // move. Saying so on the chart is cheaper than answering "your chart has a
  // gap in it" once a quarter. Null on a single-contract range, which is the
  // ordinary case, and on every cash series.
  const contractRollNote = useMemo(
    () => seriesRollNote(summarizeSeriesContracts(data)),
    [data],
  );

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
    const rows = omitOutOfHoursForSymbol(subRowsRaw || [], (d) => d.timestamp, symbol);
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
  }, [subEnabled, subRowsRaw, symbol]);

  // Stage 1 — normalize + aggregate history (expensive; independent of the tick).
  const historicalBars = useMemo(() => {
    // Daily bars are whole-session markers stamped at UTC midnight; filtering
    // them by intraday ET hours would drop every Monday (see
    // shouldOmitClosedMarketTimes). Only intraday series need the filter.
    const filtered = shouldOmitClosedMarketTimes(intervalMinutes)
      ? omitOutOfHoursForSymbol(data || [], (d) => d.timestamp, symbol)
      : data || [];
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
  }, [data, intervalMinutes, symbol]);

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
  // How far back Rewind can actually go, as a clock time.
  //
  // The scrubber simply stops at rewindMinIdx, and a control that stops with
  // no explanation reads as missing data rather than a bounded window — the
  // same failure mode as a level that draws nothing. So name the boundary
  // before the user hits it, and point at the tool that does cover the whole
  // session. The bound is the strike-profile history the chart holds, which is
  // a fixed number of buckets ending at the live tip, NOT "since the open".
  const rewindFloorLabel = useMemo(() => {
    const ts = allBars[rewindMinIdx]?.timestamp;
    if (!ts) return null;
    const t = new Date(ts).getTime();
    if (!Number.isFinite(t)) return null;
    return new Date(t).toLocaleString("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }, [allBars, rewindMinIdx]);

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

  // ── Net cumulative volume (the volume pane's second view) ────────────────
  // A running session total of uptick MINUS downtick volume, drawn as an area
  // off a zero line — green while buyers have led the session's tape, red once
  // sellers have taken it back. Same instrument, and the same read, as the
  // Options Flow chart's Directional net volume.
  //
  // It measures ONE session: the total starts at zero on the most recent
  // session's opening bar and every bar before that open reads flat zero, so
  // the pane is "where this session's tape has got to" rather than a hump per
  // day, and the pane's scale belongs to the session on screen instead of being
  // squashed by a busier day beside it.
  //
  // "Most recent" is resolved through the RIGHT EDGE, not the wall clock: the
  // total is accumulated over every bar up to the edge, so a rewound or
  // panned-back view measures the session that edge sits in (the live view's
  // own curve, at the zoom that shows it) instead of blanking out because the
  // live session is off screen. That is also why a cumulative may never be
  // accumulated from the left edge of the viewport: it would print a different
  // number for the same bar at every zoom. The replay's growing edge candle is
  // substituted the same way `bars` substitutes it, so the total fills in with
  // the replay instead of snapping. Daily candles are one bar per session
  // already, so they accumulate across the whole window instead.
  const netVolume = useMemo(() => {
    if (volumeMode !== "net" || bars.length === 0) return null;
    const throughEdge = allBars.slice(0, viewEnd);
    if (partialCurrentBar && throughEdge.length > 0) throughEdge[throughEdge.length - 1] = partialCurrentBar;
    const scope = timeframe === "1day" ? "window" : "session";
    const values = cumulativeNetVolume(throughEdge, { scope, symbol }).slice(viewStart, viewEnd);
    if (values.length === 0) return null;
    // Viewport-relative index of the session's first bar — 0 when the open is
    // already off to the left. `bars` ends on the same edge bar `throughEdge`
    // does, so the two agree on which session is the last one.
    const sessionStart = scope === "session" ? lastSessionStartIndex(bars, symbol) : 0;
    return {
      values,
      sessionStart,
      segments: signedAreaSegments(values, [sessionStart]),
      scale: netVolumeScale(values, { top: VOL_TOP, bottom: VOL_BOTTOM }),
      last: values[values.length - 1],
    };
  }, [volumeMode, bars, allBars, viewStart, viewEnd, partialCurrentBar, timeframe, symbol, VOL_TOP, VOL_BOTTOM]);

  const atLiveEdge = !rewindActive && effOffset === 0;
  const isCustomView = view.offset !== 0 || view.count !== defaultCount || priceIsManual;

  // The gamma structure at the rewound moment: the newest bucket at or before
  // the anchor, within the anchor's own session. Keyed off the CLAMPED anchor,
  // so it tracks the bar actually on the right edge — that's why the walls /
  // flip move as you scrub.
  //
  // This used to take the NEAREST bucket in either direction, which on a
  // five-minute grid and a continuous replay clock meant an anchor at 10:03
  // read 10:05: the levels moved before the tape that moved them. The rule is
  // core/rewindBucket's now, and strictly backward-looking — see its header.
  // `null` when the anchor sits before its session's first bucket, and the
  // levels below draw nothing rather than borrowing a settled session's.
  const rewindBucket = useMemo(
    () => (rewindActive ? resolveRewindBucket(gexBuckets, rewindTime, symbol) : null),
    [rewindActive, rewindTime, gexBuckets, symbol],
  );

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

  // The most-recent per-strike bucket that actually carries gamma — the live
  // rail's source. Walk back from the tip so an empty / all-zero after-hours
  // bucket doesn't blank the rail (the last real surface stays drawn).
  const liveGexBucket = useMemo(() => {
    for (let i = gexBuckets.length - 1; i >= 0; i--) {
      const b = gexBuckets[i];
      if (Array.isArray(b.strikes) && b.strikes.some((s) => levelOrNull(s.net_gamma))) return b;
    }
    return null;
  }, [gexBuckets]);

  // ── Gamma levels ── Rewind takes flip/walls/pin from the historical bucket,
  // Max Pain from the bucket's per-strike OI and VWAP from the bars;
  // net-GEX-at-spot isn't recoverable from the timeseries, so it's hidden
  // whenever the levels come from a bucket (see netGexAtSpot below). When
  // an expiration filter is active the LIVE flip/walls also come from the
  // filtered timeseries bucket (the endpoint aggregates to the selected
  // expirations), so the level lines track the filtered bars — not the
  // all-expiration summary.
  //
  // The whole-chain branch reads the profile first and the summary second
  // through `firstLevel`, which coerces EACH source before falling through.
  // Written as `coerce(profile ?? summary)` the `??` sits inside the coercion and
  // only fires on a null/undefined profile value, so any other unusable answer
  // consumed the fallback and blanked the level while the summary beside it
  // was serving a perfectly good one (see core/levelValue). That branch is
  // load-bearing here: /api/gex/profile LEFT JOINs gex_summary on an exact
  // timestamp match, so it returns a null flip on any write skew between the
  // two tables and the fallback is taken routinely.
  //
  // `rewindActive` decides the branch rather than `rewindBucket ?? …`: a
  // rewound anchor with no bucket behind it must draw NOTHING, never fall
  // through to the live tip's levels. That fall-through was unreachable while
  // the nearest-match always returned something; strict backward resolution
  // makes it reachable, and a live flip on a rewound bar is exactly the
  // cross-scope contradiction the rest of this block is built to avoid.
  const levelBucket = rewindActive ? rewindBucket : (filteredExp && live ? liveGexBucket : null);
  const flip = levelBucket
    ? levelOrNull(levelBucket.gamma_flip)
    : snapshot ? snapshot.gamma.flip : firstLevel(gexProfile?.gamma_flip, gexSummary?.gamma_flip);
  const callWall = levelBucket
    ? levelOrNull(levelBucket.call_wall)
    : snapshot ? snapshot.gamma.callWall : firstLevel(gexProfile?.call_wall, gexSummary?.call_wall);
  const putWall = levelBucket
    ? levelOrNull(levelBucket.put_wall)
    : snapshot ? snapshot.gamma.putWall : firstLevel(gexProfile?.put_wall, gexSummary?.put_wall);
  // Max Pain isn't a stored field on the timeseries buckets, but their
  // per-strike open interest is — so during rewind we recover the historical
  // Max Pain from that OI (textbook min-writer-payout strike) instead of
  // dropping it. Live/delayed paths use the served value.
  const maxPain = rewindActive
    ? rewindBucket
      ? computeMaxPainFromStrikes(rewindBucket.strikes)
      : null
    : filteredExp && live && liveGexBucket
      ? computeMaxPainFromStrikes(liveGexBucket.strikes)
      : snapshot ? snapshot.gamma.maxPain : levelOrNull(gexSummary?.max_pain);
  // Sign-consistent at-spot dealer gamma (drives the LONG/SHORT badge). Only
  // the spot-shift profile's net_gex_at_spot is used; we deliberately DON'T
  // fall back to gexSummary.net_gex (the whole-chain total), which can carry
  // the opposite sign and would let the badge contradict the gamma flip. When
  // the point value is absent the badge falls back to the geometric
  // spot-vs-flip read (see longGammaNow), not an opposite-signed total.
  //
  // Withheld whenever `flip` above did NOT come from the live whole-chain
  // spot-shift profile — i.e. while rewinding, and while an expiration filter
  // has the flip coming off `levelBucket`. net_gex_at_spot is always served
  // whole-chain, so pairing it with a subset's (or an earlier moment's) flip
  // reads two different books at once: the badge could say SHORT with price
  // sitting above the flip drawn beside it, and because the bands take their
  // orientation from the badge that inverts the whole regime shading. The
  // Playbook below the chart already applies this rule to the same levels
  // (atSpotGammaForPlaybook); atSpotGammaForScope is the shared statement of
  // it, so the two surfaces can't drift apart again.
  const netGexAtSpot = atSpotGammaForScope(
    snapshot ? snapshot.gamma.netGexAtSpot : netGexAtSpotOrNull(gexProfile?.net_gex_at_spot),
    rewindActive || levelBucket != null,
  );
  // Pin Strike — reachable 0DTE positive-gamma pin, drawn during rewind from
  // the bucket's stored value (the server ships the same per-cycle pin the
  // Daily Replay reads, as of the bucket's close).
  //
  // rewindBucket, NOT levelBucket: levelBucket also fires for a LIVE
  // expiration filter, and the pin must stay whole-chain there — it is
  // 0DTE-by-construction, so it doesn't follow the Expiry selector on any
  // surface (see the note in useGammaPlaybook). Falling back to the summary
  // when there's no bucket keeps it live-sourced alongside flip/walls while
  // the timeseries seeds.
  //
  // Null (no active pin, or a session predating the pin) draws NO LINE —
  // every levelDefs consumer skips a null value. Never a 0 on the axis.
  const pinStrike = rewindActive
    ? rewindBucket ? levelOrNull(rewindBucket.pin_strike) : null
    : levelOrNull(gexSummary?.pin_strike);
  // Confidence rides the SAME source as the pin itself, so the strength shown
  // on the line can never describe a different moment than the line it
  // annotates: the rewound bucket's stored value while rewinding, the live
  // summary otherwise.
  const pinConfidence = rewindActive
    ? rewindBucket ? levelOrNull(rewindBucket.pin_confidence) : null
    : levelOrNull(gexSummary?.pin_confidence);
  // "PIN · STRONG" / "· MODERATE" / "· WEAK" — the Key Levels strength moved
  // onto the chart, so the conviction travels with the level instead of living
  // only in the tile strip. The wording is core/pinStrike's, shared with the
  // Daily Replay chart's pin line and built on the same classifier the tile
  // strip uses, so no two surfaces can disagree about the same pin. Upper-cased
  // here because this chart's level tags are caps. With no active pin there is
  // nothing to qualify and the chip reads "PIN", exactly as before.
  const pinLabel = pinLineLabel(pinStrike, pinConfidence).toUpperCase();
  // GEX King — the whole-chain heaviest-|net-gamma| strike.
  //
  // rewindBucket, NOT levelBucket — exactly like the Pin above: levelBucket
  // also fires for a LIVE expiration filter, and the King must stay
  // whole-chain there, because narrowing it to a subset of expirations would
  // not filter it, it would make it a different metric wearing the same name.
  // While rewinding it comes from the bucket's own stored value, so a replayed
  // moment shows the King as it stood then rather than today's.
  //
  // Still null on the delayed public snapshot, which carries no King at all.
  // Null draws no line — never a 0 on the axis.
  const gexKing = rewindActive
    ? rewindBucket ? levelOrNull(rewindBucket.max_gamma_strike) : null
    : snapshot
      ? null
      : levelOrNull(gexSummary?.max_gamma_strike);
  const vwap = rewindActive ? rewindVwap : snapshot ? snapshot.vwap : levelOrNull(technicals.latest?.vwap_deviation?.vwap);

  const profilePoints = useMemo<ProfilePoint[]>(() => {
    // The rail is a Gaussian-smoothed net-gamma-by-strike density (two lobes at
    // the put-side / call-side walls). Live and rewind draw from the SAME
    // per-strike source (the strike-profile timeseries) so they render
    // identically — only the bucket differs (the rewound moment vs the live
    // tip). Raw per-strike values are discrete and sign-alternating between
    // neighbors, so rewindRailCurve smooths them into the clean silhouette.
    // Same rewind guard the levels above use: while rewinding, the rail is the
    // rewound bucket's or nothing. Falling through to the live tip would draw
    // today's gamma surface beside a rewound candle — and unlike a missing
    // level, a wrong rail is not visibly missing.
    const strikeBucket = rewindActive ? rewindBucket : (live ? liveGexBucket : null);
    if (strikeBucket) return rewindRailCurve(strikeBucket.strikes);
    if (rewindActive) return [];
    // Delayed snapshot: per-strike if present, else the served cumulative curve.
    if (snapshot) return snapshot.strikes ? rewindRailCurve(snapshot.strikes) : snapshot.profile;
    // Fallback while the timeseries seeds: the cumulative GEX-profile curve.
    const raw = gexProfile?.profile;
    if (!Array.isArray(raw)) return [];
    return raw
      .map((p) => ({ price: Number(p.price), gex: Number(p.gex) }))
      .filter((p) => Number.isFinite(p.price) && Number.isFinite(p.gex))
      .sort((a, b) => a.price - b.price);
  }, [gexProfile, snapshot, rewindActive, rewindBucket, liveGexBucket, live]);

  // ── Price/change readout ─────────────────────────────────────────────────
  // Three readings, TradingView-style (see priceChange.ts):
  //
  //  • headline — the big number + change in the header. The change is always
  //    vs the PREVIOUS cash-session close: live during the cash session; the
  //    frozen 4 PM close + that session's day-change in pre/after-hours and when
  //    closed. When the index→future swap is active it becomes the FUTURE's
  //    price vs the future's own 4 PM print. (Default preferLiveExtendedHours.)
  //
  //  • extRow — the ETF-only second line in pre-market / after-hours: the live
  //    extended-hours price vs the MOST-RECENT cash close (current_session_close).
  //
  //  • tape — the price the chart MARKER + regime sit on. It tracks the live
  //    tape drawn beside it (ETFs draw live extended bars → live quote close);
  //    indexes freeze at the 16:00 cash close, and we show futures headline-only
  //    — so the futures fields are OMITTED here and the marker never jumps to
  //    the future, falling back to current_session_close outside the cash session.
  const quoteClose = snapshot ? snapshot.quote?.close : quote?.close;
  // The session these three readings are computed with. It is `session` except in the
  // first minutes of after-hours, while /api/market/session-closes still answers with
  // the pre-16:00 pair: that payload is the open-session shape and is read as one, so
  // the headline stays on the live tape against the previous close instead of falling
  // back a whole session to yesterday's (see core/sessionCloses.ts). Everything else
  // here — the badge, the LIVE pill, the tip-candle merge — keeps reading `session`.
  const priceSession = resolvePriceSession(session, sessionCloses, quoteTs);
  const headline = getPrimaryPriceChangeSummary({
    quoteClose,
    quoteSession: priceSession,
    sessionCloses,
    displaySource,
    futuresClose: snapshot ? snapshot.quote?.futures_close : quote?.futures_close,
    futuresReferenceClose: snapshot ? snapshot.quote?.futures_reference_close : quote?.futures_reference_close,
  });
  const tape = getPrimaryPriceChangeSummary({
    quoteClose,
    quoteSession: priceSession,
    sessionCloses,
    preferLiveExtendedHours: true,
  });
  const isExtendedHours = priceSession === "pre-market" || priceSession === "after-hours";
  // ETFs/stocks only — indexes have no extended-hours tape (they show futures or
  // "closed" outside the cash session), and the futures swap owns the headline.
  const showExtendedRow = isExtendedHours && !symbolIsIndex && !futuresSwap;
  const extRow = getExtendedHoursRow(quoteClose, sessionCloses?.current_session_close);
  const extIcon = session === "pre-market" ? "sun" : "moon";

  // ── Crosshair state ──────────────────────────────────────────────────────
  // `touch`: the crosshair was put down by a finger. Its readout then pins to
  // the top of the chart instead of trailing the point, which the hand covers.
  const [hover, setHover] = useState<{ idx: number; price: number; px: number; py: number; w: number; h: number; touch?: boolean } | null>(null);
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

  // Terminal mode: the price the tape is held centered on. The live quote when
  // there is one, else the newest visible bar's close.
  const centerSpot = centerPriceOnSpot ? (liveClose ?? (bars.length ? bars[bars.length - 1].close : null)) : null;

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
    // Terminal mode: symmetric about spot, wide enough to keep every visible
    // bar, so spot sits at the vertical center of the tape and the ladders
    // beside it (centered on spot by construction) line up with it.
    if (centerSpot != null && Number.isFinite(centerSpot)) {
      const halfSpan = Math.max(centerSpot - dMin, dMax - centerSpot, barSpan * 0.5);
      dMin = centerSpot - halfSpan;
      dMax = centerSpot + halfSpan;
    }

    // Auto-fit domain complete. Apply the manual vertical zoom/pan on top:
    // scrunch by priceView.zoom around a center (priceView.center, or the
    // auto midpoint while still auto-fitting).
    const autoMin = dMin;
    const autoMax = dMax;
    // Raw, purely data-derived auto-fit. Reported to the link as-is (see the
    // effect below) — it must never depend on what the link hands back, or the
    // report and the shared window would chase each other.
    const autoMid = (autoMin + autoMax) / 2;
    const autoHalf = Math.max((autoMax - autoMin) / 2, 1e-6);
    // The window the manual zoom/pan is applied to. Three sources, in order:
    // the axis frozen at rewind entry (so scrubbing never moves the y-axis);
    // the window shared with the other half of a linked board (so two expiries
    // of one symbol start out on identical price bands); or this chart's own
    // auto-fit.
    const frozen = rewindActive ? frozenAxis : null;
    const shared = frozen ? null : linkedBase;
    const baseMid = frozen ? frozen.mid : shared ? (shared.min + shared.max) / 2 : autoMid;
    const baseHalf = frozen
      ? frozen.half
      : shared
        ? Math.max((shared.max - shared.min) / 2, 1e-6)
        : autoHalf;
    // Linked charts take their zoom/pan from the link, held relative to the
    // base window so it means the same thing on both halves. Unlinked charts
    // keep the private absolute-center view they always had.
    let half: number;
    let center: number;
    if (priceLink) {
      half = baseHalf * (linkedView?.zoom ?? 1);
      center = baseMid + (linkedView?.centerRel ?? 0) * baseHalf;
    } else {
      half = baseHalf * priceView.zoom;
      center = priceView.center ?? baseMid;
    }
    dMin = center - half;
    dMax = center + half;

    const n = bars.length;
    // Asymmetric insets: a small left pad, and a wide right gutter (PAD_RIGHT)
    // so the newest bar sits clear of the axis price tags.
    const xStep = (plotRight - PLOT_LEFT - INNER_PAD_X - PAD_RIGHT) / Math.max(1, n - 1);
    const candleWidth = Math.max(2, Math.min(15, xStep * 0.62));
    const maxVol = Math.max(...bars.map((b) => b.volume), 1);
    const priceAxis = niceAxis(dMin, dMax, 6);

    const xForIndex = (i: number) => PLOT_LEFT + INNER_PAD_X + i * xStep;
    const yPrice = (p: number) => PAD_TOP + (1 - (p - dMin) / (dMax - dMin)) * (PRICE_BOTTOM - PAD_TOP);
    const priceForY = (y: number) => dMin + (1 - (y - PAD_TOP) / (PRICE_BOTTOM - PAD_TOP)) * (dMax - dMin);
    const yVol = (v: number) => VOL_BOTTOM - (v / maxVol) * (VOL_BOTTOM - VOL_TOP);

    return { dMin, dMax, autoMid, autoHalf, baseMid, baseHalf, xStep, candleWidth, maxVol, priceAxis, xForIndex, yPrice, priceForY, yVol, n };
  }, [bars, flip, callWall, putWall, vwap, priceView.zoom, priceView.center, rewindActive, frozenAxis, priceLink, linkedView, linkedBase, centerSpot, plotRight, PLOT_LEFT, INNER_PAD_X, PAD_RIGHT, PAD_TOP, PRICE_BOTTOM, VOL_TOP, VOL_BOTTOM]);

  // Terminal mode: report where the tape's price band and the live spot sit, in
  // CSS px from the card's top edge, so the ladders beside the chart can pin
  // their spot row to the same y. Re-measured whenever the layout or the SVG's
  // rendered size changes; only a real move is reported.
  const geometryRef = useRef<ChartGeometry | null>(null);
  // While rewinding the tape's "spot" is the rewound edge bar, so anything
  // pinned to it (the ladders' spot row) follows the replay, not the live print.
  const spotForGeometry = rewindActive
    ? (bars.length ? bars[bars.length - 1].close : null)
    : (liveClose ?? (bars.length ? bars[bars.length - 1].close : null));
  useEffect(() => {
    if (!onGeometry) return;
    const svg = svgRef.current;
    const root = rootRef.current;
    if (!svg || !root || !layout) return;
    const report = () => {
      const sRect = svg.getBoundingClientRect();
      const rRect = root.getBoundingClientRect();
      if (sRect.width <= 0) return;
      const scale = sRect.width / VW;
      const top = sRect.top - rRect.top;
      const next: ChartGeometry = {
        plotTop: top + PAD_TOP * scale,
        plotBottom: top + PRICE_BOTTOM * scale,
        spotY: spotForGeometry != null ? top + layout.yPrice(spotForGeometry) * scale : null,
        height: rRect.height,
      };
      const prev = geometryRef.current;
      const same = (a: number | null, b: number | null) => (a == null && b == null) || (a != null && b != null && Math.abs(a - b) < 0.5);
      if (prev && same(prev.plotTop, next.plotTop) && same(prev.plotBottom, next.plotBottom) && same(prev.spotY, next.spotY) && same(prev.height, next.height)) return;
      geometryRef.current = next;
      onGeometry(next);
    };
    report();
    const ro = new ResizeObserver(report);
    ro.observe(svg);
    ro.observe(root);
    return () => ro.disconnect();
  }, [onGeometry, layout, spotForGeometry, VW, PAD_TOP, PRICE_BOTTOM]);

  // Broadcast the replay clock so a surface can show the book as of the same
  // moment. Fires on enter, every scrub / playback step, and exit.
  useEffect(() => {
    onRewind?.({ active: rewindActive, time: rewindActive ? rewindTime : null });
  }, [onRewind, rewindActive, rewindTime]);

  // GEX ribbons — the per-strike gamma history behind the tape, from the same
  // 5-min strike-profile buckets the rail and rewind read (live only; the
  // delayed snapshot carries no history). Pure geometry in core/gexRibbons.
  const ribbonLayer = useMemo(() => {
    if (!layout || !live || !overlays.ribbons || gexBuckets.length === 0) return null;
    return buildRibbonLayer(bars, gexBuckets, {
      xForIndex: layout.xForIndex,
      yPrice: layout.yPrice,
      xStep: layout.xStep,
      dMin: layout.dMin,
      dMax: layout.dMax,
    });
  }, [layout, live, overlays.ribbons, gexBuckets, bars]);

  // Publish this chart's own auto-fit domain so the link can union it with the
  // other half's (see core/linkedPriceAxis). Reports the RAW auto values, which
  // are data-derived and unaffected by whatever window the link hands back — so
  // this settles in one pass instead of oscillating. Withdrawn on unmount, and
  // whenever the chart leaves a linked board.
  const autoMid = layout?.autoMid ?? null;
  const autoHalf = layout?.autoHalf ?? null;
  const linkKey = useId();
  const reportDomain = priceLink?.reportDomain;
  useEffect(() => {
    if (!reportDomain) return;
    if (autoMid == null || autoHalf == null) {
      reportDomain(linkKey, null);
      return;
    }
    reportDomain(linkKey, { symbol, min: autoMid - autoHalf, max: autoMid + autoHalf });
    return () => reportDomain(linkKey, null);
  }, [reportDomain, linkKey, symbol, autoMid, autoHalf]);

  // Every price zoom / pan goes through one of these two. On a linked board
  // they write the shared view — a zoom multiplier plus a pan relative to the
  // shared base window — so both halves move together; otherwise they update
  // this chart's own axis exactly as before. They are split by axis so that
  // zooming never disturbs the pan and vice versa, in either mode.
  const commitPriceZoom = (nextZoom: number) => {
    if (priceLink) {
      priceLink.setView({ zoom: nextZoom, centerRel: linkedView?.centerRel ?? 0 });
      return;
    }
    setPriceView((pv) => (pv.zoom === nextZoom ? pv : { zoom: nextZoom, center: pv.center }));
  };

  const commitPriceCenter = (nextCenter: number) => {
    if (priceLink) {
      if (!layout) return;
      priceLink.setView({
        zoom: linkedView?.zoom ?? 1,
        centerRel: layout.baseHalf ? (nextCenter - layout.baseMid) / layout.baseHalf : 0,
      });
      return;
    }
    setPriceView((pv) => (pv.center === nextCenter ? pv : { zoom: pv.zoom, center: nextCenter }));
  };

  // The price range the rail covers. Inline it is exactly the tape's visible
  // domain — the rail is a column of the chart and shows what the chart shows.
  // Panelled it is the panel's own extent, which reaches past the tape at both
  // ends, so the strikes just off-screen are drawn instead of cropped.
  const railDomain = useMemo(() => {
    if (!layout) return null;
    if (!inPanel) return { min: layout.dMin, max: layout.dMax };
    return { max: layout.priceForY(panelVb.y), min: layout.priceForY(panelVb.y + panelVb.h) };
  }, [layout, inPanel, panelVb.y, panelVb.h]);

  // Rail silhouette geometry (net dealer gamma by price, aligned to the y-axis).
  const rail = useMemo(() => {
    if (!layout || !railDomain || profilePoints.length < 2) return null;
    const pts = profilePoints.filter((p) => p.price >= railDomain.min && p.price <= railDomain.max);
    if (pts.length < 2) return null;
    const maxAbs = Math.max(...pts.map((p) => Math.abs(p.gex)), 1);
    const xFor = (gex: number) => railCenter + clamp(gex / maxAbs, -1, 1) * railHalf;
    const yFor = (price: number) => layout.yPrice(price);

    const posPath =
      `M ${railCenter} ${yFor(pts[0].price)} ` +
      pts.map((p) => `L ${xFor(Math.max(0, p.gex)).toFixed(1)} ${yFor(p.price).toFixed(1)}`).join(" ") +
      ` L ${railCenter} ${yFor(pts[pts.length - 1].price)} Z`;
    const negPath =
      `M ${railCenter} ${yFor(pts[0].price)} ` +
      pts.map((p) => `L ${xFor(Math.min(0, p.gex)).toFixed(1)} ${yFor(p.price).toFixed(1)}`).join(" ") +
      ` L ${railCenter} ${yFor(pts[pts.length - 1].price)} Z`;
    const edge = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.gex).toFixed(1)} ${yFor(p.price).toFixed(1)}`).join(" ");

    // Peaks — the call-side and put-side extrema (the literal "walls").
    let callPeak = pts[0];
    let putPeak = pts[0];
    for (const p of pts) {
      if (p.gex > callPeak.gex) callPeak = p;
      if (p.gex < putPeak.gex) putPeak = p;
    }
    return { pts, maxAbs, xFor, yFor, posPath, negPath, edge, callPeak, putPeak };
  }, [layout, railDomain, profilePoints, railCenter, railHalf]);

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

  // ── Per-strike gamma bars (net / split / combined) ── the discrete
  // gamma-by-strike profile drawn inline in the rail column when the rail is
  // switched off its smoothed silhouette. call_gamma/put_gamma/net_gamma are the
  // signed dollar-gamma quantities the timeseries carries (call ≥ 0, put ≤ 0,
  // net = call + put). Live/rewind only; the delayed snapshot ships net but no
  // per-strike call/put split, so effectiveRailMode is pinned to silhouette there.
  const railStrikes = useMemo<RailStrike[]>(() => {
    const bucket = rewindActive ? rewindBucket : (live ? liveGexBucket : null);
    const src = bucket?.strikes ?? null;
    if (!Array.isArray(src)) return [];
    return src
      .map((s) => ({
        price: levelOrNull(s.strike) ?? NaN,
        callGex: levelOrNull(s.call_gamma) ?? 0,
        putGex: levelOrNull(s.put_gamma) ?? 0,
        netGex: levelOrNull(s.net_gamma) ?? 0,
      }))
      .filter((s) => Number.isFinite(s.price))
      .sort((a, b) => a.price - b.price);
  }, [rewindActive, rewindBucket, liveGexBucket, live]);

  // ── Per-expiration gradient for the rail bars ──
  // The strike-profile timeseries sums gamma server-side across the selected
  // expirations, so its buckets carry no per-expiration dimension. The
  // /api/gex/by-strike snapshot IS broken out per expiration, so it supplies
  // the *split* that subdivides each authoritative call/put bar into DTE-ranked
  // segments — nearest expiration anchored at the zero baseline (boldest),
  // fanning out to the furthest at the bar's tip (faintest). Exactly the ramp
  // the GEX Strike Profile chart draws.
  //
  // Only fetched when it can actually be drawn: live, rail on, and in one of
  // the call/put bar modes (Net is a single signed bar — a per-expiration net
  // can flip sign, so it has no meaningful stack, same as the Strike Profile).
  // The snapshot is "now", so scrubbing back through rewind drops to the
  // bucket's plain aggregate bars.
  const railStackEnabled =
    live && railOn && !rewindActive &&
    (effectiveRailMode === "split" || effectiveRailMode === "combined");
  // limit / sort match the GEX Strike Profile's call so the two pages hit the
  // identical URL (and therefore the same server-side read cache).
  const { data: gexByStrikeRows } = useGEXByStrike(symbol, 200, railStackEnabled ? 10000 : 0, "impact", railStackEnabled);

  const todayKey = etTodayDateKey();
  // Placed here rather than beside availableExpiries above: it needs todayKey,
  // and both sit at the component's top level so the hook order is stable.
  const railZeroDte = useZeroDteOption(availableExpiries, todayKey);

  // strike(cents) → normalized expiration → call/put magnitudes, plus the
  // snapshot's expiration universe (nearest-first = DTE rank).
  const { perStrike: railPerStrikeExp, expirations: railByStrikeExps } = useMemo(
    () => buildExpirationSplit(gexByStrikeRows, todayKey),
    [gexByStrikeRows, todayKey],
  );

  // DTE-ranked opacity keyed on the FULL snapshot universe so a segment's shade
  // stays stable regardless of which expirations are filtered in.
  const railExpOpacity = useMemo(() => expirationOpacityRamp(railByStrikeExps), [railByStrikeExps]);

  // The shown subset (nearest-first). Empty selection = All → whole universe.
  const railStackExpiries = useMemo(
    () => shownExpirations(railByStrikeExps, effectiveRailExpiries),
    [railByStrikeExps, effectiveRailExpiries],
  );

  // Per-strike, per-side expiration SHARES (nearest→furthest DTE) among the
  // shown expirations. These subdivide the authoritative timeseries bar width —
  // the by-strike snapshot only supplies the *split*, never the magnitude, so a
  // truncated/near-spot snapshot can't distort the levels: the segments always
  // sum back to the real aggregate bar. A side with no by-strike data at a
  // strike yields an empty list → that side renders as a single solid bar.
  const railStackedByStrike = useMemo(() => {
    const m = new Map<number, { call: ExpirationSegment[]; put: ExpirationSegment[] }>();
    railPerStrikeExp.forEach((inner, key) => {
      m.set(key, {
        call: expirationShares(inner, railStackExpiries, (c) => c.call),
        put: expirationShares(inner, railStackExpiries, (c) => c.put),
      });
    });
    return m;
  }, [railPerStrikeExp, railStackExpiries]);

  const railStackingActive = railStackEnabled && railStackedByStrike.size > 0;

  // Draws one call/put bar as its expiration stack: `totalWidth` is the
  // authoritative aggregate width and `segs` the by-strike shares partitioning
  // it, so the segments always sum back to the real bar. dir = +1 grows right
  // (calls), -1 left (puts); the nearest DTE sits at the zero baseline
  // (boldest), the furthest at the tip. Returns null when there's no
  // per-expiration split (caller draws the plain aggregate bar instead).
  const railStackSegments = (
    keyPrefix: string,
    segs: ExpirationSegment[],
    dir: 1 | -1,
    totalWidth: number,
    y: number,
    barH: number,
    fill: string,
  ): ReactNode[] | null => {
    if (segs.length === 0 || !(totalWidth > 0)) return null;
    // With a single expiration shown the DTE ramp carries no information, so
    // render it at full strength rather than its (dimmer) absolute-DTE shade.
    const singleShown = railStackExpiries.length <= 1;
    const rects: ReactNode[] = [];
    const yTop = y - barH / 2;
    let cursor = railCenter;
    segs.forEach(({ exp, frac }) => {
      const w = totalWidth * frac;
      if (!(w > 0)) return;
      rects.push(
        <rect
          key={`${keyPrefix}-${exp}`}
          x={dir > 0 ? cursor : cursor - w}
          y={yTop}
          width={w}
          height={barH}
          fill={fill}
          opacity={(singleShown ? 1 : railExpOpacity.get(exp) ?? 1) * RAIL_BAR_OPACITY}
        />,
      );
      cursor += dir * w;
    });
    return rects.length ? rects : null;
  };

  // Bar geometry: an x-scale max per mode, a bar thickness from the median
  // vertical strike spacing, and a density gate for the on-bar $ labels.
  const railBars = useMemo(() => {
    if (!layout || !railDomain || effectiveRailMode === "silhouette") return null;
    const inView = railStrikes.filter((s) => s.price >= railDomain.min && s.price <= railDomain.max);
    if (inView.length === 0) return null;
    const maxAbs =
      effectiveRailMode === "net"
        ? Math.max(...inView.map((s) => Math.abs(s.netGex)), 1)
        : effectiveRailMode === "split"
          ? Math.max(...inView.flatMap((s) => [Math.abs(s.callGex), Math.abs(s.putGex)]), 1)
          : Math.max(...inView.flatMap((s) => [Math.abs(s.callGex), Math.abs(s.putGex), Math.abs(s.netGex)]), 1);
    const wFor = (v: number) => (Math.abs(v) / maxAbs) * railHalf;
    const ys = inView.map((s) => layout.yPrice(s.price)).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < ys.length; i++) gaps.push(ys[i] - ys[i - 1]);
    gaps.sort((a, b) => a - b);
    const slot = gaps.length ? gaps[Math.floor(gaps.length / 2)] : PRICE_BOTTOM - PAD_TOP;
    const barH = Math.max(1.5, Math.min(11, slot * 0.6));
    const showLabels = railLabels && slot >= RAIL_LABEL_MIN_SLOT;
    return { inView, maxAbs, wFor, barH, showLabels };
  }, [layout, railDomain, railStrikes, effectiveRailMode, railLabels, railHalf, PAD_TOP, PRICE_BOTTOM]);

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

  // Mobile browsers replay a tap as mousedown/mousemove/mouseup a moment
  // later. The touch handlers below already acted on it, so the mouse path
  // sits out for a beat after any touch rather than acting on it twice.
  const lastTouchAtRef = useRef(0);
  const fromRecentTouch = () => Date.now() - lastTouchAtRef.current < 800;

  const handlePointerDown = (e: MouseEvent<SVGSVGElement>) => {
    if (fromRecentTouch()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = (e.clientX - rect.left) * (VW / Math.max(1, rect.width));
    // A drag that starts on the right-hand price scale zooms the y-axis
    // (TradingView-style) rather than panning.
    const axisZone = vx > plotRight && vx < axisRight;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startOffset: effOffset,
      startCenter: layout ? (layout.dMin + layout.dMax) / 2 : 0,
      startSpan: layout ? layout.dMax - layout.dMin : 1,
      startPriceManual: priceIsManual,
      startZoom: effPriceZoom,
      axisZone,
      priceEngaged: false,
      moved: false,
    };
    if (axisZone) setAxisZoomActive(true);
  };

  const handlePointerMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!layout || bars.length === 0 || fromRecentTouch()) return;
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
          commitPriceZoom(clamp(drag.startZoom * factor, PRICE_ZOOM_MIN, PRICE_ZOOM_MAX));
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
          commitPriceCenter(clamp(drag.startCenter + dPrice, lo, hi));
        }
        return;
      }
    }
    const vx = (e.clientX - rect.left) * (VW / Math.max(1, rect.width));
    const vy = (e.clientY - rect.top) * (VH / Math.max(1, rect.height));
    // Over the price scale (not dragging): show the ns-resize affordance and
    // suppress the crosshair, so the drag-to-zoom target reads clearly.
    const inAxis = vx > plotRight && vx < axisRight;
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
    // A touch crosshair is meant to stay put after the finger lifts; the
    // replayed mouseleave from the tap must not take it straight back down.
    if (fromRecentTouch()) return;
    setHover(null);
    if (overAxis) setOverAxis(false);
    endDrag();
  };

  // ── Touch ────────────────────────────────────────────────────────────────
  // A finger gets its own grammar, because a touchscreen has no hover and no
  // wheel. The SVG claims only horizontal gestures (touch-action: pan-y), so a
  // vertical swipe still scrolls the page, while:
  //   • a horizontal drag pans through time,
  //   • two fingers pinch the time axis in and out about their midpoint,
  //   • a press-and-hold drops the crosshair, and the held finger scrubs it,
  //   • a tap drops the crosshair where it lands, and a tap on a chart already
  //     showing one lifts it.
  // The crosshair outlives the finger so its readout can actually be read.
  // Mouse and pen input never reach these handlers.
  const touchRef = useRef<{
    points: Map<number, { x: number; y: number }>;
    mode: "pending" | "pan" | "scrub" | "pinch" | "spent";
    startX: number;
    startY: number;
    startOffset: number;
    pinchDist: number;
    pinchCount: number;
    pinchOffset: number;
    pinchAnchorVx: number;
    holdTimer: ReturnType<typeof setTimeout> | null;
    hadHover: boolean;
  } | null>(null);

  const hoverAtClient = (clientX: number, clientY: number, rect: DOMRect, touch: boolean) => {
    if (!layout || bars.length === 0) return;
    const vx = (clientX - rect.left) * (VW / Math.max(1, rect.width));
    const vy = (clientY - rect.top) * (VH / Math.max(1, rect.height));
    const idx = Math.round((vx - PLOT_LEFT - INNER_PAD_X) / Math.max(1e-9, layout.xStep));
    const clampedIdx = Math.max(0, Math.min(bars.length - 1, idx));
    const price = layout.priceForY(clamp(vy, PAD_TOP, PRICE_BOTTOM));
    setHover({ idx: clampedIdx, price, px: clientX - rect.left, py: clientY - rect.top, w: rect.width, h: rect.height, touch });
  };

  // Time zoom by `factor` about a viewBox x, from a captured starting view —
  // the pinch's anchor stays under the fingers for the whole gesture instead
  // of drifting as each frame compounds on the last.
  const zoomTimeFrom = (anchorVx: number, startCount: number, startOffset: number, factor: number) => {
    if (total <= 1) return;
    const curCount = clamp(startCount, MIN_COUNT, Math.max(MIN_COUNT, total));
    const curOffset = clamp(startOffset, 0, Math.max(0, total - curCount));
    const curEnd = total - curOffset;
    const curStart = Math.max(0, curEnd - curCount);
    const curVisible = Math.max(1, curEnd - curStart);
    const curXStep = (plotRight - PLOT_LEFT - INNER_PAD_X - PAD_RIGHT) / Math.max(1, curVisible - 1);
    const rel = clamp((anchorVx - PLOT_LEFT - INNER_PAD_X) / Math.max(1e-9, curXStep), 0, curVisible - 1);
    const anchorAbs = curStart + rel;
    const f = curVisible > 1 ? rel / (curVisible - 1) : 0.5;
    const newCount = clamp(Math.round(curCount * factor), MIN_COUNT, total);
    const newStart = Math.round(anchorAbs - f * (newCount - 1));
    const newOffset = clamp(total - (newStart + newCount), 0, Math.max(0, total - newCount));
    setView((v) => (v.count === newCount && v.offset === newOffset ? v : { count: newCount, offset: newOffset }));
  };

  const clearHold = () => {
    const t = touchRef.current;
    if (t?.holdTimer) {
      clearTimeout(t.holdTimer);
      t.holdTimer = null;
    }
  };

  const handleTouchDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch" || !layout) return;
    lastTouchAtRef.current = Date.now();
    const svg = e.currentTarget;
    let t = touchRef.current;
    if (!t) {
      t = {
        points: new Map(),
        mode: "pending",
        startX: e.clientX,
        startY: e.clientY,
        startOffset: effOffset,
        pinchDist: 0,
        pinchCount: effCount,
        pinchOffset: effOffset,
        pinchAnchorVx: 0,
        holdTimer: null,
        hadHover: hover != null,
      };
      touchRef.current = t;
    }
    t.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* the pointer may already be gone */
    }
    if (t.points.size === 1) {
      // Held still long enough, it is a crosshair rather than a pan.
      const x = e.clientX;
      const y = e.clientY;
      t.holdTimer = setTimeout(() => {
        const cur = touchRef.current;
        if (!cur || cur.mode !== "pending") return;
        cur.mode = "scrub";
        cur.holdTimer = null;
        hoverAtClient(x, y, svg.getBoundingClientRect(), true);
      }, 260);
    } else if (t.points.size === 2) {
      clearHold();
      const [a, b] = [...t.points.values()];
      const rect = svg.getBoundingClientRect();
      t.mode = "pinch";
      t.pinchDist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      t.pinchCount = effCount;
      t.pinchOffset = effOffset;
      t.pinchAnchorVx = ((a.x + b.x) / 2 - rect.left) * (VW / Math.max(1, rect.width));
      setHover(null);
    }
  };

  const handleTouchMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const t = touchRef.current;
    if (e.pointerType !== "touch" || !t || !t.points.has(e.pointerId) || !layout) return;
    lastTouchAtRef.current = Date.now();
    t.points.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = e.currentTarget.getBoundingClientRect();
    if (t.mode === "pinch") {
      if (t.points.size < 2) return;
      const [a, b] = [...t.points.values()];
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      // Fingers apart → fewer bars (zoom in); together → more.
      zoomTimeFrom(t.pinchAnchorVx, t.pinchCount, t.pinchOffset, t.pinchDist / dist);
      return;
    }
    if (t.mode === "scrub") {
      hoverAtClient(e.clientX, e.clientY, rect, true);
      return;
    }
    const dx = e.clientX - t.startX;
    if (t.mode === "pending") {
      if (Math.abs(dx) < 8) return;
      clearHold();
      t.mode = "pan";
      t.startX = e.clientX;
      t.startOffset = effOffset;
      setHover(null);
      return;
    }
    if (t.mode === "pan") {
      // Dragging the tape right reveals older bars, as with the mouse.
      const dxView = (e.clientX - t.startX) * (VW / Math.max(1, rect.width));
      const dBars = Math.round(dxView / Math.max(1e-9, layout.xStep));
      const nextOffset = clamp(t.startOffset + dBars, 0, maxOffset);
      setView((v) => (v.offset === nextOffset ? v : { ...v, offset: nextOffset }));
    }
  };

  const handleTouchEnd = (e: ReactPointerEvent<SVGSVGElement>) => {
    const t = touchRef.current;
    if (e.pointerType !== "touch" || !t) return;
    lastTouchAtRef.current = Date.now();
    const wasTap = e.type === "pointerup" && t.mode === "pending" && t.points.size === 1;
    t.points.delete(e.pointerId);
    clearHold();
    if (wasTap) {
      if (t.hadHover) setHover(null);
      else hoverAtClient(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), true);
    }
    if (t.points.size === 0) {
      touchRef.current = null;
    } else if (t.mode === "pinch") {
      // One finger left after a pinch: ignore it until it lifts, rather than
      // letting it turn into a pan that jumps from wherever it now sits.
      t.mode = "spent";
    }
  };

  const resetView = () => {
    setView({ count: defaultCount, offset: 0 });
    setPriceView(DEFAULT_PRICE_VIEW);
    priceLink?.setView(null);
    setHover(null);
  };

  // ── PNG export ──────────────────────────────────────────────────────────
  // Snapshot the instrument exactly as it stands — same overlays, same zoom,
  // same expiry filter — the way TradingView's camera does. The raster comes
  // off the SVG's viewBox, so the file is the board as drawn for this card, at
  // 2x: 1360x636 in a card at least that wide, the card's own width below it.
  const [exportState, setExportState] = useState<"idle" | "working" | "error">("idle");

  const downloadPng = async () => {
    const svg = svgRef.current;
    if (!svg) return;
    setExportState("working");
    try {
      // Drop the crosshair before serializing: a hover readout frozen into a
      // saved image is a value from whenever the mouse happened to be there.
      // Moving to this button usually clears it via the SVG's pointer-leave,
      // but a touch tap or a keyboard activation never fires that — and the
      // clear has to be COMMITTED before we read the DOM, so wait a frame
      // rather than serializing the tree React has not re-rendered yet.
      if (hover) {
        setHover(null);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
      const blob = await chartSvgToPngBlob(svg, {
        background: resolvedBackground(containerRef.current),
      });
      const stamp = etTodayDateKey();
      downloadBlob(blob, `zerogex-${symbol.toLowerCase()}-${timeframe}-${stamp}.png`);
      setExportState("idle");
    } catch (err) {
      console.error("Failed to export chart PNG", err);
      setExportState("error");
      setTimeout(() => setExportState("idle"), 2500);
    }
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
    commitPriceZoom(clamp(effPriceZoom * factor, PRICE_ZOOM_MIN, PRICE_ZOOM_MAX));
  };

  // The wheel listener below is attached natively and re-attached only when the
  // TIME view changes, so anything it calls must be reached through a ref —
  // closing over zoomPrice directly would freeze the price zoom at whatever it
  // was when the listener was last attached, and every wheel tick would scale
  // that same stale value instead of compounding.
  const zoomPriceRef = useRef(zoomPrice);
  useEffect(() => {
    zoomPriceRef.current = zoomPrice;
  });

  // Wheel. A bare wheel is left alone so the page scrolls — see core/wheelZoom
  // for why. Ctrl/Cmd (or trackpad pinch) → time zoom, anchored on the bar
  // under the cursor; Shift, or the cursor over the price axis / rail →
  // vertical price zoom. Attached natively with { passive: false } so that
  // preventDefault actually stops the page on the gestures we DO claim
  // (React's synthetic onWheel can be passive).
  useEffect(() => {
    const el = svgRef.current;
    if (!el || total <= 1) return;
    const onWheel = (e: WheelEvent) => {
      // A horizontal trackpad swipe carries no deltaY; zooming on it would
      // pick a direction out of thin air.
      if (e.deltaY === 0) return;
      const rect = el.getBoundingClientRect();
      const vx = (e.clientX - rect.left) * (VW / Math.max(1, rect.width));
      const action = wheelAction({
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey,
        overPriceAxis: vx > plotRight,
      });
      if (action === "page-scroll") return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
      if (action === "zoom-price") {
        zoomPriceRef.current(factor);
        return;
      }
      setHover(null);
      const curCount = clamp(view.count, MIN_COUNT, Math.max(MIN_COUNT, total));
      const curOffset = clamp(view.offset, 0, Math.max(0, total - curCount));
      const curEnd = total - curOffset;
      const curStart = Math.max(0, curEnd - curCount);
      const curVisible = Math.max(1, curEnd - curStart);
      const curXStep = (plotRight - PLOT_LEFT - INNER_PAD_X - PAD_RIGHT) / Math.max(1, curVisible - 1);
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
  }, [view.count, view.offset, total, plotRight, VW, PLOT_LEFT, INNER_PAD_X, PAD_RIGHT]);

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
    // it (the user can still adjust it by hand afterward).
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

  // ── Bar timer ── How far the forming candle is through its own window, as a
  // countdown beside the last price and an elapsed/remaining line in the
  // crosshair readout. Only meaningful when we are actually looking at a candle
  // that is still forming: a delayed snapshot's tip is the newest bar we HAVE
  // rather than the newest that exists, a stale futures feed is not printing
  // into it, and rewind or a panned-back view is parked on a closed one.
  const liveBarTimestamp = allBars.length > 0 ? allBars[allBars.length - 1].timestamp : null;
  // Same predicate the pinging live-price dot asserts, hoisted so the two can't
  // drift: a timer counting down beside a dot that says the tape is dead (or
  // vice versa) is worse than either signal alone.
  const feedIsLive = !delayed && !rewindActive && !feedStale && !!session && session !== "closed";
  const barTimerLive = overlays.barTimer && feedIsLive && atLiveEdge;
  // Ticks only while the timer is on screen — a chart with it switched off, or
  // parked in history, must not re-render once a second for nothing.
  const [barClockNow, setBarClockNow] = useState<number>(() => Date.now());
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!barTimerLive) return;
    // Re-read immediately: the stored instant went stale while the timer was
    // hidden, and without this the first second after switching it on would
    // count from whenever the chart last happened to tick.
    setBarClockNow(Date.now());
    const id = setInterval(() => setBarClockNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [barTimerLive]);
  /* eslint-enable react-hooks/set-state-in-effect */
  const liveBarClock = barTimerLive ? barClock(liveBarTimestamp, timeframe, barClockNow) : null;

  // SVG <defs> ids must be unique per mounted chart: My Dashboard can hold two
  // Gamma Charts side by side, and duplicate ids would make both instances
  // resolve url(#…) to whichever rendered first. Strip the non-alphanumerics
  // React's useId adds so the value is safe inside a url(#…) reference.
  const defsId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const AREA_GRADIENT_ID = `zg-gc-area-${defsId}`;
  const RAIL_POS_GRADIENT_ID = `zg-gc-rail-pos-${defsId}`;
  const RAIL_NEG_GRADIENT_ID = `zg-gc-rail-neg-${defsId}`;
  const PLOT_CLIP_ID = `zg-gc-plot-clip-${defsId}`;
  const RIBBON_GLOW_ID = `zg-gc-ribbon-glow-${defsId}`;

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
  const spot = rewindActive ? lastBar.close : tape.displayPrice ?? liveTip.close;

  // Expected-range band (±1σ implied move) built from the same helper the Live
  // Bulletin uses, so the on-chart upper/lower levels match the Bulletin card
  // exactly. Live-only, and hidden during rewind (the vol index is a live "now"
  // read, not the rewound moment). Returns null when spot or vix is missing.
  const erModel =
    overlays.expectedRange && !rewindActive && vix != null && spot != null
      ? buildExpectedRange({ spot, vix, volIndex, horizon: erHorizon, callWall, putWall })
      : null;

  const inDomain = (v: number | null): v is number => v != null && v >= layout.dMin && v <= layout.dMax;
  const regimeUnknown = flip == null;
  const longGammaNow = netGexAtSpot != null ? netGexAtSpot >= 0 : flip != null && spot >= flip;
  // Shaded regime bands take their orientation from the badge, not from raw
  // geometry: the band that CONTAINS spot always matches longGammaNow, so the
  // shading can't contradict the "Dealer Gamma @ Spot" badge on a lumpy /
  // non-monotonic book (see core/gammaRegime). Reduces to "long above the flip,
  // short below" on a monotonic book.
  const aboveBandIsLong = aboveFlipBandIsLong(spot, flip, longGammaNow);
  // Where the two regime bands meet, in plot coordinates. When the flip sits
  // inside the visible price range that's the flip line itself. When it sits
  // OUTSIDE it — zoomed in, panned away, or a flip simply far from the tape —
  // the split collapses onto an edge instead of the shading disappearing:
  // every visible price is then on ONE side of the flip, so that side's band
  // fills the plot and the other is zero-height. A flip above the top of the
  // scale leaves only the below-flip band on screen; a flip below the bottom
  // leaves only the above-flip band.
  const regimeSplitY =
    flip == null
      ? null
      : inDomain(flip)
        ? yPrice(flip)
        : flip > layout.dMax
          ? PAD_TOP
          : PRICE_BOTTOM;
  // Regime of the single band on screen when the flip is off-scale — same
  // aboveBandIsLong orientation as the split above, so the off-scale label
  // always agrees with the tint drawn under it.
  const offScaleRegimeIsLong =
    flip == null ? aboveBandIsLong : offScaleBandIsLong(flip, layout.dMin, aboveBandIsLong);

  // Level definitions rendered as reference lines + right-axis tags.
  type LevelDef = { key: string; label: string; value: number | null; color: string; dash: string; show: boolean };
  const levelDefs: LevelDef[] = [
    { key: "flip", label: "FLIP", value: flip, color: "var(--color-flip)", dash: "7 4", show: overlays.levels },
    // Walls are colored by what the LEVEL does, not by the instrument behind
    // it: the call wall is resistance (bear) and the put wall is support
    // (bull). That matches the articles ("Why the call wall acts as
    // resistance" / "Why the put wall often coincides with support") and the
    // rest of the app — PairCandleChart, GammaShiftLadder and PairGammaHeatmap
    // all already draw the walls this way. The instrument convention (calls
    // green / puts red) still applies where a mark means call-vs-put
    // QUANTITY, such as the gamma rail below and GexWallsChart.
    { key: "call", label: "CALL WALL", value: callWall, color: "var(--color-bear)", dash: "3 4", show: overlays.levels },
    { key: "put", label: "PUT WALL", value: putWall, color: "var(--color-bull)", dash: "3 4", show: overlays.levels },
    { key: "pain", label: "MAX PAIN", value: maxPain, color: "var(--color-maxpain)", dash: "1 5", show: overlays.maxPain },
    { key: "king", label: "GEX KING", value: gexKing, color: "var(--color-king)", dash: "5 3", show: overlays.king },
    { key: "pin", label: pinLabel, value: pinStrike, color: "var(--color-pin)", dash: "2 3", show: overlays.pin },
    { key: "vwap", label: "VWAP", value: vwap, color: "var(--color-hazy)", dash: "6 5", show: overlays.vwap },
    { key: "er-high", label: "ER HIGH", value: erModel?.high ?? null, color: "var(--color-info)", dash: "2 5", show: overlays.expectedRange && erModel != null },
    { key: "er-low", label: "ER LOW", value: erModel?.low ?? null, color: "var(--color-info)", dash: "2 5", show: overlays.expectedRange && erModel != null },
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
    // Two coincident levels (a Pin sitting exactly on the Call Wall, say) land
    // on one row as "CALL WALL" "PIN · WEAK", and at 5px they read as a single
    // compound phrase — a support ticket where the reader took "WEAK" to be
    // qualifying the wall. Each chip has its own bordered box, so the fix is
    // just enough air between boxes for them to read as two labels. Cheap at
    // this plot width: ~70px per chip against ~1076px of plot, so even five
    // colliding levels stay well inside the right edge.
    const GAP = 10;
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

  // Flip status chip — why there is no FLIP line. The flip is the one level
  // whose ABSENCE is itself a question: users see an empty plot where they
  // expected a line and can't tell whether the level is off the visible scale
  // or simply wasn't resolved. The arrowed axis tag (off-scale) and the "—" in
  // the regime badge (unresolved) both answer it, but neither sits where the
  // user is looking. This says it in place.
  //   * off scale   → flip color, arrow toward it, price included so the chip
  //                   is self-sufficient
  //   * no crossing → muted, and names the SCOPE: an Expiry filter is active
  //                   and the selected expirations have no crossing of their
  //                   own. Handed `filteredExp` because that is exactly the
  //                   condition under which `flip` above came off a filtered
  //                   bucket, whose level the backend rebuilt from the subset's
  //                   strikes alone. Not a miss, and not fixed by waiting.
  //   * unresolved  → muted, no price, and the same amber "?" the dashboard
  //                   card and the Key Levels strip put beside an empty level,
  //                   carrying the same explainer (core/keyLevels): the resolver
  //                   DECLINED to publish, and on ES / NQ which chain missed.
  // Label and copy are pure (core/flipStatusChip); only the placement is the
  // chart's. Pinned to the edge the flip lies beyond, so the chip points at the
  // off-screen level rather than floating mid-plot. Two things already own the
  // top-left of the plot: the OHLC readout (an absolutely-positioned div
  // painted OVER the svg — a chip up there is invisible, not just crowded) and
  // the centered off-scale regime caption. So the top slot sits below both, and
  // either blank-flip case — neither has a direction to point in, and neither
  // gets a caption since the regime band needs a flip — is parked at the bottom
  // edge, the one corner nothing else claims. De-collided against the level chips the same
  // way they de-collide against each other: shifted right past any chip whose
  // row this one would land in.
  const flipChip = (() => {
    if (!overlays.levels) return null;
    const aboveView = flip != null && flip > layout.dMax;
    const chip = flipStatusChip({
      flip,
      onScreen: inDomain(flip),
      aboveView,
      formatPrice: fmtPrice,
      symbol,
      filtered: filteredExp,
    });
    if (!chip) return null;
    const y = chip.kind === "off-scale" && aboveView ? PAD_TOP + 46 : PRICE_BOTTOM - 10;
    const x = chipPlacements.reduce(
      (acc, c) => (Math.abs(c.y - y) < 16 ? Math.max(acc, c.x + c.w + 5) : acc),
      PLOT_LEFT + 6,
    );
    // Keyed off off-scale rather than off a single blank kind: both blank-flip
    // chips are muted and dashed, because neither has a line on the plot to
    // match a color to.
    const drawn = chip.kind === "off-scale";
    return { ...chip, x, y, w: labelWidth(chip.label), drawn, color: drawn ? "var(--color-flip)" : "var(--text-muted)" };
  })();

  // Line/area path for the close series (used by line + area styles).
  const closePath = bars.map((b, i) => `${i === 0 ? "M" : "L"} ${xForIndex(i).toFixed(1)} ${yPrice(b.close).toFixed(1)}`).join(" ");
  const areaPath = `${closePath} L ${xForIndex(lastIdx).toFixed(1)} ${PRICE_BOTTOM} L ${xForIndex(0).toFixed(1)} ${PRICE_BOTTOM} Z`;
  const seriesUp = lastBar.close >= bars[0].open;
  const seriesColor = seriesUp ? "var(--color-bull)" : "var(--color-bear)";

  // About one clock label per 64 units of compact tape; nine across the board.
  // About one clock label per 64 units of compact tape, and one per 110 on the
  // desktop board, where the full-width board fits its nine.
  const timeLabelTarget = compact
    ? Math.max(3, Math.floor((plotRight - PLOT_LEFT) / 64))
    : Math.min(9, Math.max(4, Math.floor((plotRight - PLOT_LEFT) / 110)));
  const timeLabelEvery = Math.max(1, Math.ceil(bars.length / timeLabelTarget));

  // Crosshair-price gamma context for the floating readout.
  const hoverGex = hover ? gexAtPrice(hover.price) : null;
  // The ribbon orb under the cursor: the hovered bar's bucket, the strike lane
  // nearest the hovered price (within half a lane), its net gamma and its
  // weight against the heaviest strike on screen — the same numbers the orb
  // was drawn from, so the readout explains exactly what is on the tape.
  const hoverRibbon = (() => {
    if (!hover || !ribbonLayer || ribbonLayer.maxAbs <= 0) return null;
    const bar = bars[hover.idx];
    if (!bar) return null;
    const ms = new Date(bar.timestamp).getTime();
    if (!Number.isFinite(ms)) return null;
    const bucket = gexByTs.get(ribbonBucketKey(ms));
    if (!bucket || !Array.isArray(bucket.strikes)) return null;
    const halfLane = (ribbonLayer.strikeStep ?? 1) / 2;
    let best: { strike: number; net: number } | null = null;
    for (const row of bucket.strikes) {
      const strike = levelOrNull(row.strike);
      const net = levelOrNull(row.net_gamma);
      if (strike == null || net == null || net === 0) continue;
      const dist = Math.abs(strike - hover.price);
      if (dist > halfLane) continue;
      if (!best || dist < Math.abs(best.strike - hover.price)) best = { strike, net };
    }
    if (!best) return null;
    const norm = Math.abs(best.net) / ribbonLayer.maxAbs;
    return { ...best, norm, tier: tierFor(norm), drawn: norm >= RIBBON_MIN_NORM };
  })();
  const nearestLevel = hover
    ? levelDefs
        .filter((l) => l.value != null)
        .map((l) => ({ label: l.label, value: l.value as number, color: l.color, dist: Math.abs((l.value as number) - hover.price) }))
        .sort((a, b) => a.dist - b.dist)[0] ?? null
    : null;

  // Session chip. The futures swap takes over the "same spot" a cash-closed
  // index would read CLOSED: FUTURES when the future is trading, CLOSED only
  // when the index is outside the cash session AND no future is available.
  const sessionBadge = rewindActive
    ? { label: "◀ REWIND", color: "var(--color-accent-hot)" }
    : delayed
      ? { label: "◷ DELAYED ~15 MIN", color: "var(--color-warning)" }
      : feedStale
        ? { label: `◷ ${futuresDelayLabel(feedAgeSeconds)}`, color: "var(--color-warning)" }
        : futuresSwap
          ? { label: "◆ FUTURES", color: "var(--color-brand-coral)" }
          : sessionLabel(session);

  // Freshness line under the headline price.
  //  • Delayed: the snapshot's repaired "as of" (the delayed tape's freshest
  //    bar, full date + time), so a visitor sees it's ~15 min old — not frozen.
  //  • Live + trading session: the realtime instant the last tick landed, to the
  //    second, so the stream doesn't look like it only refreshes once a minute.
  //  • Live + market closed: nothing is streaming, so show the last print's data
  //    time ("as of") rather than a bogus live clock.
  const dataStamp = fmtEtStamp(quoteTs); // data time (minute-aligned)
  const liveStamp = fmtEtClock(liveUpdatedAt); // realtime tick receipt, to the second
  // The overnight future is actively trading even though the cash index reports
  // session='closed', so treat the futures swap as a live session for freshness.
  //  • Live session but a DELAYED feed (ES/NQ on the delayed CME package): the
  //    wall-clock receipt is the moment the poll returned, not the moment the
  //    price traded. Showing it to the second next to a ten-minute-old price is
  //    the most precise-looking lie on the page, so fall back to the bar's own
  //    time, which is what "as of" has always meant here.
  const liveSessionActive =
    !delayed && !rewindActive && !feedStale && (futuresSwap || (!!session && !/closed/i.test(session)));
  const freshnessLabel = delayed
    ? dataStamp && `Delayed quote · as of ${dataStamp}`
    : liveSessionActive
      ? liveStamp && `Updated ${liveStamp}`
      : dataStamp && `As of ${dataStamp}`;

  // Header big number: the headline reading (live during the cash session; the
  // frozen 4 PM close in pre/after-hours; the future when swapped) — or the
  // scrub bar's close while rewinding. Change/percent come from `headline` too.
  const headlinePrice = rewindActive ? spot : headline.displayPrice ?? spot;

  // ── Gamma structure rail (net silhouette or per-strike bars) ────────────
  // Built here rather than inline in the SVG below because it has two homes:
  // the chart's own rail column, and — when the page panels it — a portal of
  // its own beside the tape. Same node, same numbers, two mounts.
  // The rail's own view controls — the four gamma-by-strike views and the
  // on-bar $ labels. Live only: the delayed snapshot carries no per-strike
  // call/put split, so `effectiveRailMode` is pinned to the silhouette there
  // and a mode switch would be a control over nothing.
  const railViewControls = live ? (
    <>
      <div className="zg-gc-seg" role="tablist" aria-label="Gamma rail view">
        {([
          ["silhouette", "Silhouette"],
          ["net", "Net"],
          ["split", "Split"],
          ["combined", "Combined"],
        ] as Array<[RailMode, string]>).map(([m, lbl]) => (
          <button key={m} type="button" className="zg-gc-seg-btn" data-active={railMode === m} onClick={() => setRailMode(m)} aria-pressed={railMode === m}>
            {lbl}
          </button>
        ))}
      </div>
      {railMode !== "silhouette" && (
        <OverlayPill label="Labels" color="var(--text-secondary)" active={railLabels} onClick={() => setRailLabels((v) => !v)} />
      )}
    </>
  ) : null;

  const railGradSuffix = inPanel ? "-panel" : "";
  const railGroup =
    railOn && (effectiveRailMode === "silhouette" ? rail : railBars) ? (
      <g>
        {/* Inline, the rail is a column inside the chart and needs its own
            ground and title. Panelled, the page supplies the card and a real
            HTML header above it, so both would be a card drawn inside a card. */}
        {!inPanel && (
          <>
            <rect x={railLeft - 6} y={PAD_TOP} width={railRight - railLeft + 12} height={PRICE_BOTTOM - PAD_TOP} fill="color-mix(in srgb, var(--text-primary) 3%, transparent)" />
            {compact ? (
              // A ~60-unit column cannot carry the full title (or its mode
              // suffixes — the Layers panel names the mode); one word does.
              <text x={(railLeft + railRight) / 2} y={PAD_TOP - 8} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9} letterSpacing="0.1em" fill={filteredExp ? "var(--color-warning)" : "var(--text-muted)"}>
                GAMMA
              </text>
            ) : (
            // Centred over the full-width rail. A rail narrowed to its card
            // (desktopCanvas) cannot hold the title, which ran off the board's
            // right edge, so there it right-aligns to the rail and extends
            // left over the empty axis column instead.
            <text
              x={railRight - railLeft < DESKTOP_RAIL_W ? railRight : (railLeft + railRight) / 2}
              y={PAD_TOP - 6}
              textAnchor={railRight - railLeft < DESKTOP_RAIL_W ? "end" : "middle"}
              fontFamily="var(--font-mono)"
              fontSize={10}
              letterSpacing="0.12em"
              fill="var(--text-muted)"
            >
              DEALER GAMMA BY STRIKE
              {effectiveRailMode !== "silhouette" && (
                <tspan fill="var(--text-secondary)">{`  ·  ${effectiveRailMode === "net" ? "NET" : effectiveRailMode === "split" ? "CALL / PUT" : "COMBINED"}`}</tspan>
              )}
              {railStackingActive && <tspan fill="var(--text-muted)">{"  ·  BY EXPIRY"}</tspan>}
              {filteredExp && <tspan fill="var(--color-warning)">{"  ·  FILTERED"}</tspan>}
              {railZeroDte.widenedToAll && (
                <tspan fill="var(--color-warning)">{"  ·  ALL EXPIRIES (NO 0DTE TODAY)"}</tspan>
              )}
            </text>
            )}
          </>
        )}
        {/* zero baseline */}
        <line
          x1={railCenter}
          x2={railCenter}
          y1={inPanel ? panelVb.y : PAD_TOP}
          y2={inPanel ? panelVb.y + panelVb.h : PRICE_BOTTOM}
          stroke="var(--border-strong)"
          strokeWidth={1}
          opacity={0.5}
        />

        {/* smoothed net silhouette */}
        {effectiveRailMode === "silhouette" && rail && (
          <>
            <path d={rail.posPath} fill={`url(#${RAIL_POS_GRADIENT_ID}${railGradSuffix})`} />
            <path d={rail.negPath} fill={`url(#${RAIL_NEG_GRADIENT_ID}${railGradSuffix})`} />
            <path d={rail.edge} fill="none" stroke="var(--text-secondary)" strokeWidth={1} opacity={0.35} />
            {[{ p: rail.callPeak, c: "var(--color-bull)" }, { p: rail.putPeak, c: "var(--color-bear)" }].map(({ p, c }, i) => (
              <circle key={`peak-${i}`} cx={rail.xFor(p.gex)} cy={rail.yFor(p.price)} r={2.6} fill={c} />
            ))}
          </>
        )}

        {/* discrete per-strike bars */}
        {effectiveRailMode !== "silhouette" &&
          railBars &&
          railBars.inView.map((s) => {
            const y = yPrice(s.price);
            const h = railBars.barH;
            if (effectiveRailMode === "net") {
              const w = railBars.wFor(s.netGex);
              const pos = s.netGex >= 0;
              const c = pos ? "var(--color-bull)" : "var(--color-bear)";
              return (
                <g key={`bar-${s.price}`}>
                  <rect x={pos ? railCenter : railCenter - w} y={y - h / 2} width={Math.max(0, w)} height={h} fill={c} opacity={0.85} />
                  {railBars.showLabels && s.netGex !== 0 && (
                    <RailBarLabel x={clamp((pos ? railCenter + w : railCenter - w) + (pos ? 3 : -3), railLeft + 2, railRight - 2)} y={y + 3} anchor={pos ? "start" : "end"} text={fmtGex(s.netGex)} />
                  )}
                </g>
              );
            }
            const cw = railBars.wFor(s.callGex);
            const pw = railBars.wFor(s.putGex);
            const netW = railBars.wFor(s.netGex);
            const netPos = s.netGex >= 0;
            // Live edge → subdivide the authoritative call/put widths
            // by expiration (nearest at the baseline, faintest at the
            // tip); otherwise, or at a strike the snapshot doesn't
            // cover, draw the single aggregate bars.
            const st = railStackingActive ? railStackedByStrike.get(Math.round(s.price * 100)) : undefined;
            const callSegs = st
              ? railStackSegments(`callseg-${s.price}`, st.call, 1, Math.max(0, cw), y, h, "var(--color-bull)")
              : null;
            const putSegs = st
              ? railStackSegments(`putseg-${s.price}`, st.put, -1, Math.max(0, pw), y, h, "var(--color-bear)")
              : null;
            return (
              <g key={`bar-${s.price}`}>
                {callSegs ?? (
                  <rect x={railCenter} y={y - h / 2} width={Math.max(0, cw)} height={h} fill="var(--color-bull)" opacity={RAIL_BAR_OPACITY} />
                )}
                {putSegs ?? (
                  <rect x={railCenter - pw} y={y - h / 2} width={Math.max(0, pw)} height={h} fill="var(--color-bear)" opacity={RAIL_BAR_OPACITY} />
                )}
                {/* Net overlay: same thickness as the call/put bars (the
                    split tip still shows past it), matching the GEX Strike
                    Profile's Combined view. */}
                {effectiveRailMode === "combined" && s.netGex !== 0 && (
                  <rect x={netPos ? railCenter : railCenter - netW} y={y - h / 2} width={Math.max(0, netW)} height={h} fill={NET_BAR_COLOR} opacity={0.85} />
                )}
                {railBars.showLabels && s.callGex !== 0 && (
                  <RailBarLabel x={clamp(railCenter + cw + 3, railLeft + 2, railRight - 2)} y={y + 3} anchor="start" text={fmtGex(s.callGex)} />
                )}
                {railBars.showLabels && s.putGex !== 0 && (
                  <RailBarLabel x={clamp(railCenter - pw - 3, railLeft + 2, railRight - 2)} y={y + 3} anchor="end" text={fmtGex(s.putGex)} />
                )}
              </g>
            );
          })}

        {/* Flip zero-crossing tie-line. Inline it reaches back past the rail's
            ground toward the plot; in a panel there is nothing to reach to, so
            it stays inside the box. */}
        {inDomain(flip) && (
          <line x1={inPanel ? railLeft : railLeft - 6} x2={railRight} y1={yPrice(flip)} y2={yPrice(flip)} stroke="var(--color-flip)" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
        )}
      </g>
    ) : null;

  // ── Toolbar pieces ── one set of controls, laid out as a single wrapping
  // row on the desktop board and as a compact bar + Layers panel on phones
  // (see the Controls block below).
  const symbolTfControls = (
    <>
          {/* Symbol + timeframe — switchable when live; in the delayed public
              snapshot they're fixed (switching needs data the snapshot lacks),
              so we show an unlock CTA instead. */}
          {live ? (
            <>
              {compact ? (
                // Seven symbols as buttons are a row of their own on a phone;
                // the native picker is one control, and the platform's wheel.
                <SymbolSelect value={symbol as UnderlyingSymbol} onChange={(s) => setSymbol(s)} ariaLabel="Symbol" />
              ) : (
                <div className="zg-gc-seg" role="tablist" aria-label="Symbol">
                  {SYMBOLS.map((s) => (
                    <button key={s} type="button" className="zg-gc-seg-btn" data-active={s === symbol} onClick={() => setSymbol(s as UnderlyingSymbol)} aria-pressed={s === symbol}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
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
    </>
  );
  const styleControl = (
    <>
          {/* Price style */}
          <div className="zg-gc-seg" role="tablist" aria-label="Price style">
            {(["candles", "line", "area"] as PriceStyle[]).map((s) => (
              <button key={s} type="button" className="zg-gc-seg-btn" data-active={s === style} onClick={() => setStyle(s)} aria-pressed={s === style}>
                {s === "candles" ? "Candle" : s === "line" ? "Line" : "Area"}
              </button>
            ))}
          </div>

    </>
  );
  const volumeControl = (
    <>
          {/* Volume pane view. Carries a visible "VOL" label because the
              buttons sit beside the price-style ones and "Cumulative" has to
              say what it is cumulative OF. */}
          <div className="flex items-center gap-1.5">
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--text-muted)" }}>Vol</span>
            <div className="zg-gc-seg" role="tablist" aria-label="Volume pane">
              {(["updown", "net"] as VolumeMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  className="zg-gc-seg-btn"
                  data-active={m === volumeMode}
                  onClick={() => setVolumeMode(m)}
                  aria-pressed={m === volumeMode}
                  title={
                    m === "updown"
                      ? "Uptick volume (green) stacked over downtick volume (red), one column per bar."
                      : "Running total of uptick minus downtick volume for the current session only — it starts at zero on the session's opening bar, and earlier sessions read flat zero. Above zero (green) buyers have led the tape; below it (red) sellers have."
                  }
                >
                  {VOLUME_MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

    </>
  );
  const overlayControls = (
    <>
          {/* Overlay pills */}
          <OverlayPill label="Gamma Levels" color="var(--color-flip)" active={overlays.levels} onClick={() => setOverlays((o) => ({ ...o, levels: !o.levels }))} />
          {!hideRail && (
            <OverlayPill label="Gamma Rail" color="var(--color-bull)" active={overlays.rail} onClick={() => setOverlays((o) => ({ ...o, rail: !o.rail }))} />
          )}
          {live && (
            <OverlayPill label="Ribbons" color={RIBBON_POS_GLOW} active={overlays.ribbons} onClick={() => setOverlays((o) => ({ ...o, ribbons: !o.ribbons }))} title="GEX ribbons — per-strike dealer gamma through time, behind the tape. Gold = long gamma, violet = short; height and opacity = weight. Key and reading guide in the legend below; hover a lane for the exact value." />
          )}
          {live && overlays.ribbons && (
            <RibbonOpacityControl value={ribbonOpacity} onChange={setRibbonOpacity} />
          )}
          <OverlayPill label="Regime" color="var(--color-accent-hot)" active={overlays.regime} onClick={() => setOverlays((o) => ({ ...o, regime: !o.regime }))} />
          <OverlayPill label="VWAP" color="var(--color-hazy)" active={overlays.vwap} onClick={() => setOverlays((o) => ({ ...o, vwap: !o.vwap }))} />
          <OverlayPill label="Max Pain" color="var(--color-maxpain)" active={overlays.maxPain} onClick={() => setOverlays((o) => ({ ...o, maxPain: !o.maxPain }))} />
          <OverlayPill label="GEX King" color="var(--color-king)" active={overlays.king} onClick={() => setOverlays((o) => ({ ...o, king: !o.king }))} />
          <OverlayPill label="Pin Strike" color="var(--color-pin)" active={overlays.pin} onClick={() => setOverlays((o) => ({ ...o, pin: !o.pin }))} />
          {/* Bar Timer — live-only. The delayed public snapshot is a frozen tip,
              so a countdown on it would be counting down someone else's candle. */}
          {live && (
            <OverlayPill label="Bar Timer" color="var(--color-accent-hot)" active={overlays.barTimer} onClick={() => setOverlays((o) => ({ ...o, barTimer: !o.barTimer }))} />
          )}
          {/* Expected Range — live-only (the delayed public snapshot carries no
              vol index). The Daily/Weekly/Monthly selector appears once it's on. */}
          {live && (
            <OverlayPill label="Expected Range" color="var(--color-info)" active={overlays.expectedRange} onClick={() => setOverlays((o) => ({ ...o, expectedRange: !o.expectedRange }))} title="Expected Range — the implied-volatility ±1σ band, drawn as ER HIGH / ER LOW dashed lines around a shaded zone, bracketing roughly 68% of outcomes. Built from VIX on SPX/SPY and VXN on QQQ/NDX; a Daily / Weekly / Monthly selector appears once it's on. Live only — the delayed snapshot carries no vol index." />
          )}
          {live && overlays.expectedRange && (
            <div className="zg-gc-seg" role="tablist" aria-label="Expected range horizon">
              {([
                ["daily", "Daily"],
                ["weekly", "Weekly"],
                ["monthly", "Monthly"],
              ] as Array<[HorizonKey, string]>).map(([h, lbl]) => (
                <button key={h} type="button" className="zg-gc-seg-btn" data-active={erHorizon === h} onClick={() => setErHorizon(h)} aria-pressed={erHorizon === h}>
                  {lbl}
                </button>
              ))}
            </div>
          )}

    </>
  );
  const railExpiryControls = (
    <>
          {/* Gamma-by-strike rail view: silhouette vs per-strike bars, on-bar
              labels, and an expiration filter — live only (the delayed snapshot
              lacks the per-strike call/put split and can't refetch). */}
          {live && (
            <>
              <div className="hidden sm:block" style={{ width: 1, height: 22, background: "var(--border-default)" }} />
              {/* Panelled, these ride the panel instead (portalled at the
                  bottom of this component) — the rail's view is a control of
                  the thing being drawn, so it belongs wherever that is. */}
              {railOn && !inPanel && railViewControls}
              <ExpirationMultiSelect
                options={availableExpiries}
                selected={effectiveRailExpiries}
                onChange={setRailExpiries}
                label="Expiry"
                disabled={availableExpiries.length === 0}
                zeroDte={railZeroDte}
              />
              {/* A 0DTE pick with no same-day expiry resolves to nothing, and
                  nothing means All — so the levels below are whole-chain while
                  the control still says 0DTE. Say it out loud, next to the
                  control that caused it and again on the chart itself. */}
              {railZeroDte.widenedToAll && (
                <span
                  className="zg-chip"
                  style={{ ["--chip-color" as string]: "var(--color-warning)" }}
                  title="No same-day expiration in this chain today (weekend, holiday, or no 0DTE contract). The levels and rail are aggregated across ALL expirations, not today's book."
                >
                  No 0DTE today · showing all expiries
                </span>
              )}
            </>
          )}

    </>
  );
  const activeLayerCount = [
    overlays.levels,
    !hideRail && overlays.rail,
    live && overlays.ribbons,
    overlays.regime,
    overlays.vwap,
    overlays.maxPain,
    overlays.king,
    overlays.pin,
    live && overlays.barTimer,
    live && overlays.expectedRange,
  ].filter(Boolean).length;
  const viewActions = (
    <>

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
            <button
              type="button"
              onClick={downloadPng}
              disabled={exportState === "working"}
              title="Save this chart as a PNG image"
              aria-label="Save this chart as a PNG image"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                padding: "5px 11px",
                borderRadius: "var(--radius-pill)",
                border: `1px solid ${exportState === "error" ? "var(--color-bear)" : "var(--border-default)"}`,
                color: exportState === "error" ? "var(--color-bear)" : "var(--text-secondary)",
                background: "var(--bg-subtle)",
                cursor: exportState === "working" ? "progress" : "pointer",
                opacity: exportState === "working" ? 0.6 : 1,
              }}
            >
              <Camera size={13} />
              {exportState === "error" ? "Failed" : exportState === "working" ? "Saving…" : "Save"}
            </button>
    </>
  );

  return (
    <div ref={setRootNode} className={`zg-feature-shell zg-gc-rise ${className}`} style={{ overflow: "hidden" }}>
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
                {/* The pointer-interaction hint lives here rather than in the
                    controls row below: as a line of text there it was wide
                    enough to wrap the row onto a second line the moment the
                    expiry filter grew (an "All" pill becoming a date), which
                    pushed the chart down and knocked a split board's two halves
                    out of alignment. */}
                <TooltipWrapper
                  text={
                    touchUi
                      ? "Drag the chart sideways to pan through time and pinch to zoom. Tap anywhere — or press and hold, then slide — to put down a crosshair and read dealer gamma at that price; tap again to clear it. The Time and Price steppers under the chart give finer control, and Reset snaps back to the live view."
                      : "Scroll to zoom, drag to pan, and hover anywhere on the chart to read dealer gamma at that price. Use the Time and Price steppers at the bottom-right for finer control, or Reset to snap back to the live view."
                  }
                />
                {sessionBadge && (
                  <span className="zg-chip" style={{ ["--chip-color" as string]: sessionBadge.color }}>
                    {sessionBadge.label}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1">
                <span style={{ fontFamily: "var(--font-display)", fontSize: compact ? 25 : 30, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text-primary)", lineHeight: 1 }}>
                  {symbol}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: compact ? 24 : 28, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                  {headlinePrice != null ? fmtPrice(headlinePrice) : "--"}
                </span>
                {!rewindActive && futuresTicker && (
                  <FuturesContractBadge
                    contract={contractCode}
                    expiry={contractExpiry}
                    note={contractRollNote}
                    fallbackTitle={`Outside the cash session — showing ${futuresTicker} futures for ${symbol}`}
                    style={FUTURES_CHIP_STYLE}
                  >
                    ◆ {futuresTicker} FUT
                  </FuturesContractBadge>
                )}
                {!rewindActive && !futuresTicker && (
                  <FuturesContractBadge
                    contract={contractCode}
                    expiry={contractExpiry}
                    note={contractRollNote}
                    style={FUTURES_CHIP_STYLE}
                  />
                )}
                {!rewindActive && headline.change != null && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 15,
                      fontWeight: 600,
                      color: headline.isPositive ? "var(--color-bull)" : "var(--color-bear)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {headline.isPositive ? "+" : ""}
                    {headline.change.toFixed(2)}
                    {headline.changePercent != null && ` (${headline.isPositive ? "+" : ""}${headline.changePercent.toFixed(2)}%)`}
                  </span>
                )}
                {rewindActive && rewindTime != null && (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--color-accent-hot)", fontVariantNumeric: "tabular-nums" }}>
                    {new Date(rewindTime).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} ET
                  </span>
                )}
              </div>
              {/* ETF pre-market / after-hours: the live extended-hours price and
                  its change vs the MOST-RECENT cash close, on a second line
                  under the regular quote (mirrors the header row-2). */}
              {!rewindActive && showExtendedRow && extRow.price != null && extRow.change != null && extRow.changePercent != null && (
                <div
                  className="flex items-center gap-1.5 mt-1"
                  title={`${session === "pre-market" ? "Pre-market" : "After-hours"} price vs most-recent cash close`}
                >
                  {extIcon === "moon"
                    ? <Moon size={11} style={{ color: "var(--text-secondary)" }} />
                    : <Sun size={11} style={{ color: "var(--text-secondary)" }} />}
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", opacity: 0.85, fontVariantNumeric: "tabular-nums" }}>
                    {fmtPrice(extRow.price)}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: extRow.isPositive ? "var(--color-bull)" : "var(--color-bear)", fontVariantNumeric: "tabular-nums" }}>
                    {extRow.isPositive ? "+" : ""}{extRow.change.toFixed(2)} ({extRow.isPositive ? "+" : ""}{extRow.changePercent.toFixed(2)}%)
                  </span>
                </div>
              )}
              {/* Freshness line (to the second, ET). Live shows the realtime
                  instant the last tick landed; delayed shows the frozen "as of".
                  Shown in both modes so freshness is never ambiguous; hidden
                  during rewind, which prints its own scrub time above. */}
              {!rewindActive && freshnessLabel && (
                <span
                  className="mt-1 flex items-center gap-1.5"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}
                >
                  {liveSessionActive && (
                    <span
                      className="zg-gc-dot"
                      style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-bull)", flex: "0 0 auto" }}
                      aria-hidden
                    />
                  )}
                  {freshnessLabel}
                </span>
              )}
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

        {/* Controls. The desktop board lays every control out in one wrapping
            row. The compact canvas cannot afford that — on a phone the row ran
            to fourteen lines, two screens of buttons above the chart — so it
            keeps symbol, timeframe and the view actions in sight and folds the
            layers (style, volume, overlays, rail, expiry) into a panel. */}
        {compact ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">{symbolTfControls}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="zg-gc-pill"
                data-active={layersOpen}
                aria-expanded={layersOpen}
                aria-controls={layersPanelId}
                onClick={() => setLayersOpen((v) => !v)}
                style={{ ["--pill-color" as string]: "var(--text-primary)" }}
              >
                <SlidersHorizontal size={13} aria-hidden />
                Layers
                <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{activeLayerCount}</span>
                <ChevronDown size={13} aria-hidden style={{ transform: layersOpen ? "rotate(180deg)" : undefined, transition: "transform var(--dur-2) var(--ease-standard)" }} />
              </button>
              <div className="ml-auto flex items-center gap-2">{viewActions}</div>
            </div>
            {layersOpen && (
              <div id={layersPanelId} className="flex flex-wrap items-center gap-2 pt-1">
                {styleControl}
                {volumeControl}
                {overlayControls}
                {railExpiryControls}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {symbolTfControls}
            {styleControl}
            {volumeControl}
            <div className="hidden sm:block" style={{ width: 1, height: 22, background: "var(--border-default)" }} />
            {overlayControls}
            {railExpiryControls}
            <div className="ml-auto flex items-center gap-2">{viewActions}</div>
          </div>
        )}
      </div>

      {/* ── Chart body ─────────────────────────────────────────────────── */}
      <div ref={containerRef} className="relative" style={{ background: "var(--bg-card)" }}>
          {compact && (
            <div
              className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 px-3 pt-2 pb-1"
              style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontVariantNumeric: "tabular-nums", borderBottom: "1px solid var(--border-subtle)" }}
            >
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{symbol}</span>
              <span style={{ color: "var(--text-muted)" }}>{TIMEFRAMES.find((t) => t.value === timeframe)?.label}</span>
              {(["O", activeBar.open, "H", activeBar.high, "L", activeBar.low, "C", activeBar.close] as const).map((v, i) =>
                typeof v === "string" ? (
                  <span key={`ck-${i}`} style={{ color: "var(--text-muted)", marginRight: -6 }}>{v}</span>
                ) : (
                  <span key={`cv-${i}`} style={{ fontWeight: 600, color: activeBar.close >= activePrevClose ? "var(--color-bull)" : "var(--color-bear)" }}>
                    {fmtPrice(v)}
                  </span>
                ),
              )}
            </div>
          )}
          {/* The wrapper is exactly the SVG's box (block SVG, width 100%, fixed
              aspect ratio), so an HTML element placed in percentages of it
              lands on a viewBox coordinate at any width — the one overlay that
              has to track a point INSIDE the plot rather than a corner of the
              card. */}
          <div className="relative">
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
              WebkitUserSelect: "none",
              // A finger's vertical swipe scrolls the page; horizontal drags and
              // pinches are the chart's own (see the touch handlers). Desktop
              // mouse zoom/pan is unaffected by touch-action.
              touchAction: "pan-y",
              WebkitTouchCallout: "none",
            }}
            className="zg-gc-canvas"
            data-measured={box ? "true" : undefined}
            onMouseMove={handlePointerMove}
            onMouseDown={handlePointerDown}
            onMouseUp={endDrag}
            onMouseLeave={handlePointerLeave}
            onPointerDown={handleTouchDown}
            onPointerMove={handleTouchMove}
            onPointerUp={handleTouchEnd}
            onPointerCancel={handleTouchEnd}
            onContextMenu={(e) => {
              // A long press is the crosshair here, not the browser's menu.
              if (touchRef.current) e.preventDefault();
            }}
            onDoubleClick={resetView}
          >
            <defs>
              <linearGradient id={AREA_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={seriesColor} stopOpacity={0.32} />
                <stop offset="100%" stopColor={seriesColor} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={RAIL_POS_GRADIENT_ID} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--color-bull)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="var(--color-bull)" stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id={RAIL_NEG_GRADIENT_ID} x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor="var(--color-bear)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="var(--color-bear)" stopOpacity={0.55} />
              </linearGradient>
              {/* Bloom for the neon ribbons: one blur over the whole glow group,
                  so a session of orbs costs a single filter pass. The region
                  is padded past the group's box so the blur is not clipped. */}
              <filter id={RIBBON_GLOW_ID} x="-5%" y="-15%" width="110%" height="130%" colorInterpolationFilters="sRGB">
                <feGaussianBlur stdDeviation={RIBBON_GLOW_BLUR} />
              </filter>
              <clipPath id={PLOT_CLIP_ID}>
                <rect x={PLOT_LEFT} y={PAD_TOP} width={plotRight - PLOT_LEFT} height={PRICE_BOTTOM - PAD_TOP} />
              </clipPath>
            </defs>

            {/* Regime zones — the band containing spot matches the "Dealer
                Gamma @ Spot" badge (aboveBandIsLong), so the shading never
                contradicts the badge on a lumpy / non-monotonic book. Drawn
                whenever a flip is known, including when the flip itself is off
                the visible scale: then the split (regimeSplitY) sits on an edge
                and the one on-screen band tints the whole plot. */}
            {overlays.regime && !regimeUnknown && regimeSplitY != null && (
              <g>
                <rect x={PLOT_LEFT} y={PAD_TOP} width={plotRight - PLOT_LEFT} height={Math.max(0, regimeSplitY - PAD_TOP)} fill={`color-mix(in srgb, ${aboveBandIsLong ? "var(--color-bull)" : "var(--color-bear)"} 7%, transparent)`} />
                <rect x={PLOT_LEFT} y={regimeSplitY} width={plotRight - PLOT_LEFT} height={Math.max(0, PRICE_BOTTOM - regimeSplitY)} fill={`color-mix(in srgb, ${aboveBandIsLong ? "var(--color-bear)" : "var(--color-bull)"} 7%, transparent)`} />
                {/* The compact canvas drops the captions: its tape is too
                    short for one not to land on a wall line or a level chip,
                    and the tint plus the header's "Dealer Gamma @ Spot" chip
                    already say which band is which. */}
                {compact ? null : inDomain(flip) ? (
                  <>
                    <text x={(PLOT_LEFT + plotRight) / 2} y={PAD_TOP + 15} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} letterSpacing="0.16em" fill={aboveBandIsLong ? "var(--color-bull)" : "var(--color-bear)"} opacity={0.65}>
                      {aboveBandIsLong ? "LONG Γ · PINNING" : "SHORT Γ · TRENDING"}
                    </text>
                    <text x={(PLOT_LEFT + plotRight) / 2} y={PRICE_BOTTOM - 9} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} letterSpacing="0.16em" fill={aboveBandIsLong ? "var(--color-bear)" : "var(--color-bull)"} opacity={0.65}>
                      {aboveBandIsLong ? "SHORT Γ · TRENDING" : "LONG Γ · PINNING"}
                    </text>
                  </>
                ) : (
                  <text x={(PLOT_LEFT + plotRight) / 2} y={PAD_TOP + 15} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} letterSpacing="0.16em" fill={offScaleRegimeIsLong ? "var(--color-bull)" : "var(--color-bear)"} opacity={0.65}>
                    {offScaleRegimeIsLong ? "LONG Γ · PINNING REGIME" : "SHORT Γ · TRENDING REGIME"}
                  </text>
                )}
              </g>
            )}

            {/* Price grid + right axis labels */}
            {priceAxis.ticks.map((p) => {
              const y = yPrice(p);
              if (y < PAD_TOP - 0.5 || y > PRICE_BOTTOM + 0.5) return null;
              return (
                <g key={`grid-${p}`}>
                  <line x1={PLOT_LEFT} x2={plotRight} y1={y} y2={y} stroke="var(--color-grid-line)" strokeWidth={1} />
                  {/* Compact: right-aligned to the same edge as the price tags,
                      so a tag on a gridline covers its label outright instead
                      of leaving the first digits peeking out beside it. */}
                  <text
                    x={compact ? axisRight - 5 : axisColX}
                    y={y + 3.5}
                    textAnchor={compact ? "end" : "start"}
                    fontFamily="var(--font-mono)"
                    fontSize={compact ? 10.5 : 11}
                    fill="var(--text-muted)"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {fmtPrice(p)}
                  </text>
                </g>
              );
            })}

            {/* ── GEX ribbons — per-strike dealer gamma through time, behind the
                tape. One orb per bar per strike, sized by |net gamma|; warm =
                dealer long gamma, cool = short. The walls read as ribbons
                running along the session. Grouped paths, not per-orb nodes. */}
            {ribbonLayer && ribbonLayer.paths.length > 0 && (
              <g clipPath={`url(#${PLOT_CLIP_ID})`} pointerEvents="none" aria-hidden>
                {/* Bloom: the saturated hue, blurred, under everything. */}
                <g className="zg-gc-ribbon-glow" filter={`url(#${RIBBON_GLOW_ID})`}>
                  {ribbonLayer.paths.map((p) => (
                    <path
                      key={`ribbon-glow-${p.strike}-${p.positive ? "p" : "n"}-${p.tier}`}
                      d={p.d}
                      fill={p.positive ? RIBBON_POS_GLOW : RIBBON_NEG_GLOW}
                      opacity={Math.min(1, RIBBON_GLOW_OPACITY[p.tier] * ribbonOpacity)}
                    />
                  ))}
                </g>
                {/* Tube: bright body with a hot rim. */}
                {ribbonLayer.paths.map((p) => (
                  <path
                    key={`ribbon-${p.strike}-${p.positive ? "p" : "n"}-${p.tier}`}
                    d={p.d}
                    fill={p.positive ? RIBBON_POS_BODY : RIBBON_NEG_BODY}
                    stroke={p.positive ? RIBBON_POS_CORE : RIBBON_NEG_CORE}
                    strokeWidth={0.7}
                    strokeOpacity={Math.min(1, 0.5 * ribbonOpacity)}
                    opacity={Math.min(1, RIBBON_TIER_OPACITY[p.tier] * ribbonOpacity)}
                  />
                ))}
              </g>
            )}

            {!inPanel && railGroup}

            {/* ── Price series ──────────────────────────────────────────── */}
            <g clipPath={`url(#${PLOT_CLIP_ID})`}>
              {style === "area" && <path d={areaPath} fill={`url(#${AREA_GRADIENT_ID})`} />}
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

            {/* ── Expected-range band: a subtle wash between the ER lines ── */}
            {overlays.expectedRange && erModel && (() => {
              const yHi = clamp(yPrice(erModel.high), PAD_TOP, PRICE_BOTTOM);
              const yLo = clamp(yPrice(erModel.low), PAD_TOP, PRICE_BOTTOM);
              const h = yLo - yHi;
              if (!(h > 0)) return null;
              return <rect x={PLOT_LEFT} y={yHi} width={plotRight - PLOT_LEFT} height={h} fill="var(--color-info)" opacity={0.06} pointerEvents="none" />;
            })()}

            {/* ── Gamma level reference lines (in-domain only) ──────────── */}
            {levelDefs.map((l) => {
              if (!l.show || l.value == null || !inDomain(l.value)) return null;
              const y = clamp(yPrice(l.value), PAD_TOP + 1, PRICE_BOTTOM - 1);
              const emphasized = confluenceKey === l.key;
              return (
                <line key={`levelline-${l.key}`} x1={PLOT_LEFT} x2={plotRight} y1={y} y2={y} stroke={l.color} strokeWidth={emphasized ? 2 : 1.3} strokeDasharray={l.dash} opacity={emphasized ? 1 : 0.85} />
              );
            })}

            {/* ── Level name chips, de-collided so they never overlap ──────
                 The label is --text-primary, not the level colour: a 9.5px
                 glyph in the level's own colour on a --bg-card chip cleared
                 4.5:1 in only 105 of 192 palette/level combinations, down to
                 2.36:1. The border keeps the colour, and the chip sits on the
                 level's own line, so nothing about the association is lost. */}
            {chipPlacements.map((c) => (
              <g key={`chip-${c.key}`} transform={`translate(${c.x}, ${c.y})`}>
                <rect x={0} y={-8} width={c.w} height={16} rx={2} fill="var(--bg-card)" stroke={c.color} strokeWidth={1} opacity={0.95} />
                <text x={6} y={3.5} fontFamily="var(--font-mono)" fontSize={9.5} letterSpacing="0.08em" fill="var(--text-primary)" fontWeight={600}>
                  {c.label}
                </text>
              </g>
            ))}

            {/* ── Flip status chip — why there is no FLIP line (see flipChip) ──
                 The chip body carries the same copy as a native title so the
                 story is there even where the HTML "?" mark beside it is not
                 (a PNG export, a still). */}
            {flipChip && (
              <g transform={`translate(${flipChip.x}, ${flipChip.y})`} opacity={0.9}>
                <rect x={0} y={-8} width={flipChip.w} height={16} rx={2} fill="var(--bg-card)" stroke={flipChip.color} strokeWidth={1} strokeDasharray={flipChip.drawn ? undefined : "2 2"} opacity={0.95} />
                {/* Same as the level chips: the border carries the colour and
                    the dash carries the drawn/unresolved state, so the label
                    itself can be legible. Unresolved stays muted on purpose. */}
                <text x={6} y={3.5} fontFamily="var(--font-mono)" fontSize={9.5} letterSpacing="0.08em" fill={flipChip.drawn ? "var(--text-primary)" : "var(--text-muted)"} fontWeight={600}>
                  {flipChip.label}
                </text>
                <title>{flipChip.tooltip}</title>
              </g>
            )}

            {/* ── Last-price line + live cursor (tag drawn in declutter pass) ── */}
            {(() => {
              const y = clamp(yPrice(liveTip.close), PAD_TOP, PRICE_BOTTOM);
              const x = xForIndex(lastIdx);
              // feedStale: the pinging dot asserts "this bar is trading right now".
              // On a delayed feed the tip is the newest bar we have, not the newest
              // bar that exists, so the dashed last-price line stays and the ping goes.
              const isLive = feedIsLive;
              return (
                <g>
                  <line x1={PLOT_LEFT} x2={plotRight} y1={y} y2={y} stroke="var(--color-accent-hot)" strokeWidth={1} strokeDasharray="2 3" opacity={0.8} />
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
              const tags = spreadTags(raw, 16, PAD_TOP + 2, PRICE_BOTTOM - 2);
              // The countdown hangs off the last-price tag's DECLUTTERED y, not
              // its raw one, so it stays glued to the tag when a clustered
              // gamma level has pushed that tag off the price line.
              const lastTagY = tags.find((t) => t.key === "last")?.yAdj ?? null;
              return (
                <>
                  {tags.map((t) => (
                    <PriceTag key={t.key} x={tagX} y={t.yAdj} value={t.value} bg={t.bg} ink={chipInk(t.bg)} strong={t.strong} arrow={t.arrow} />
                  ))}
                  {liveBarClock && lastTagY != null && (
                    <BarCountdownTag
                      x={tagX}
                      // Below the tag by default, flipped above it when the last
                      // price is riding the bottom of the range — clamping into
                      // the gutter instead would stack the two on the same row.
                      y={lastTagY + 17 <= PRICE_BOTTOM - 2 ? lastTagY + 17 : lastTagY - 17}
                      label={formatBarDuration(liveBarClock.remainingMs, "ceil")}
                      progress={liveBarClock.progress}
                    />
                  )}
                </>
              );
            })()}

            {/* ── Volume pane ───────────────────────────────────────────── */}
            <g>
              <text x={PLOT_LEFT + 4} y={VOL_TOP + 11} fontFamily="var(--font-mono)" fontSize={9.5} letterSpacing="0.12em" fill="var(--text-muted)">
                VOLUME
                {/* The pane names its own view, so a PNG export of the
                    cumulative reading can't be mistaken for the columns. */}
                {netVolume && <tspan>{"  ·  NET CUMULATIVE"}</tspan>}
                {netVolume && (
                  <tspan dx={10} fill={netVolume.last >= 0 ? "var(--color-bull)" : "var(--color-bear)"}>
                    {fmtVolSigned(netVolume.last)}
                  </tspan>
                )}
                {symbolIsIndex && <tspan fill="var(--color-warning)">{"   ·  PROXY (EST.)"}</tspan>}
                {symbolIsIndex && (
                  <title>{`${symbol} is a cash index — it doesn't trade, so this volume is a derived proxy, not native index volume.`}</title>
                )}
              </text>
              {netVolume ? (
                <>
                  {/* Zero line first: the area is measured off it, so it reads
                      as the axis the fills hang from rather than a gridline. */}
                  <line x1={PLOT_LEFT} x2={plotRight} y1={netVolume.scale.zeroY} y2={netVolume.scale.zeroY} stroke="var(--text-muted)" strokeWidth={1} opacity={0.55} />
                  {netVolumeAreaPaths(netVolume.segments, {
                    x: xForIndex,
                    y: netVolume.scale.y,
                    zeroY: netVolume.scale.zeroY,
                    columnWidth: Math.max(1.5, candleWidth),
                  }).map((area, i) => {
                    const color = area.sign > 0 ? "var(--color-bull)" : "var(--color-bear)";
                    return (
                      <g key={`nv-${i}`}>
                        <path d={area.fill} fill={color} opacity={0.45} />
                        {area.line && <path d={area.line} fill="none" stroke={color} strokeWidth={1.25} />}
                      </g>
                    );
                  })}
                </>
              ) : (
                bars.map((b, i) => {
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
                })
              )}
              <line x1={PLOT_LEFT} x2={plotRight} y1={VOL_BOTTOM} y2={VOL_BOTTOM} stroke="var(--border-default)" strokeWidth={1} />
            </g>

            {/* ── Time axis + day separators ────────────────────────────── */}
            {bars.map((b, i) => {
              if (i % timeLabelEvery !== 0) return null;
              const x = xForIndex(i);
              const label =
                timeframe === "1day"
                  ? etTradingDateLabel(b.timestamp)
                  : new Date(b.timestamp).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hour12: false });
              // Held inside the plot so the first and last labels are not cut
              // in half by the canvas edge (a 5-char clock label is ~32 wide).
              const half = label.length * 3.1 + 1;
              return (
                <text key={`t-${b.timestamp}`} x={clamp(x, PLOT_LEFT + half, plotRight - half)} y={TIME_AXIS_Y} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={10} fill="var(--text-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
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
                  const cx = clamp((xForIndex(g.startIdx) + xForIndex(g.endIdx)) / 2, PLOT_LEFT + labelW / 2, plotRight - labelW / 2);
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
                  <line x1={PLOT_LEFT} x2={plotRight} y1={crossY} y2={crossY} stroke="var(--text-secondary)" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
                  <PriceTag x={tagX} y={crossY} value={fmtPrice(hover.price)} bg="var(--text-secondary)" ink={chipInk("var(--text-secondary)")} />
                </g>
              );
            })()}
          </svg>
          {/* ── The "?" beside an unresolved flip chip ──────────────────────
               An SVG <title> nobody knows to hover for is indistinguishable
               from no explanation at all, which is what turns a blank flip into
               "is your feed broken?" mail. So the unresolved chip gets the same
               amber HelpCircle + TooltipWrapper the dashboard card and the Key
               Levels strip use — same mark, same color, same copy — placed
               just past the chip's right edge, on its center line. It is HTML
               rather than SVG so it reads at the UI's own 14px at any chart
               width, and so it stays out of PNG exports (a mark that promises
               a hover is noise in a still). Percentages of the wrapper map
               straight to viewBox units. A sibling of the SVG, not a child,
               so the chart's crosshair / drag-pan / double-click handlers
               never see a pointer that is on the mark. */}
          {flipChip?.explain && (
            <div
              className="absolute z-20 flex items-center"
              style={{
                left: `${((flipChip.x + flipChip.w + 4) / VW) * 100}%`,
                top: `${(flipChip.y / VH) * 100}%`,
                transform: "translateY(-50%)",
                color: "var(--color-warning)",
                lineHeight: 0,
              }}
            >
              <TooltipWrapper text={flipChip.tooltip} inlineInExpanded={false}>
                <HelpCircle size={14} strokeWidth={2.5} aria-hidden="true" />
              </TooltipWrapper>
            </div>
          )}
          </div>

        {/* ── In-plot legend (OHLC of active bar) ─────────────────────────
             Floats over the board's top-left corner on the desktop canvas; the
             compact canvas has no corner to spare, so there it is a strip of
             its own directly above the plot (see `ohlcStrip`). */}
        {!compact && (
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
        )}

        {/* ── Floating crosshair readout (price × gamma) ────────────────── */}
        {hover && (
          <div
            className="pointer-events-none absolute z-20"
            style={
              hover.touch
                ? // A finger covers the point it is on, so a touch readout pins
                  // to the top of the chart, in the half AWAY from the crosshair.
                  {
                    top: 8 + (compact ? 30 : 0),
                    ...(hover.px > hover.w / 2 ? { left: 8 } : { right: 8 }),
                    minWidth: 184,
                    maxWidth: "min(260px, calc(100% - 16px))",
                  }
                : {
                    left: hover.px + 16 + 210 > hover.w ? Math.max(8, hover.px - 210) : hover.px + 16,
                    top: Math.max(8, Math.min(hover.py + 14, hover.h - 172)),
                    minWidth: 196,
                  }
            }
          >
            <div style={{ background: "var(--color-chart-tooltip-bg)", border: "1px solid var(--color-chart-tooltip-border)", borderRadius: "var(--radius-control)", boxShadow: "var(--shadow-pop)", padding: "9px 11px" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", marginBottom: 5 }}>
                {timeframe === "1day"
                  ? etTradingDateLabel(activeBar.timestamp)
                  : `${new Date(activeBar.timestamp).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })} ET`}
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5" style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                <Row k="O" v={fmtPrice(activeBar.open)} />
                <Row k="H" v={fmtPrice(activeBar.high)} />
                <Row k="L" v={fmtPrice(activeBar.low)} />
                <Row k="C" v={fmtPrice(activeBar.close)} color={activeBar.close >= activePrevClose ? "var(--color-bull)" : "var(--color-bear)"} />
                <Row k="Vol" v={fmtVol(activeBar.volume)} />
                {netVolume && (
                  /* Before the session opened there is no running total to
                     report — a dash, not a "+0" that reads like a measurement. */
                  activeIdx < netVolume.sessionStart ? (
                    <Row k="Net" v="—" color="var(--text-muted)" />
                  ) : (
                    <Row
                      k="Net"
                      v={fmtVolSigned(netVolume.values[activeIdx] ?? 0)}
                      color={(netVolume.values[activeIdx] ?? 0) >= 0 ? "var(--color-bull)" : "var(--color-bear)"}
                    />
                  )
                )}
              </div>
              {liveBarClock && activeBar.timestamp === liveBarTimestamp && (
                <div style={{ marginTop: 6 }}>
                  <div
                    className="flex items-center justify-between gap-2"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontVariantNumeric: "tabular-nums" }}
                  >
                    <span style={{ color: "var(--text-muted)" }}>{formatBarDuration(liveBarClock.elapsedMs)} elapsed</span>
                    <span style={{ color: "var(--color-accent-hot)", fontWeight: 600 }}>
                      {formatBarDuration(liveBarClock.remainingMs, "ceil")} left
                    </span>
                  </div>
                  <div style={{ height: 2, borderRadius: 1, marginTop: 3, background: "color-mix(in srgb, var(--color-accent-hot) 20%, transparent)" }}>
                    <div
                      style={{
                        height: 2,
                        borderRadius: 1,
                        width: `${Math.round(liveBarClock.progress * 100)}%`,
                        background: "var(--color-accent-hot)",
                      }}
                    />
                  </div>
                </div>
              )}
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
              {hoverRibbon && (
                <>
                  <div style={{ height: 1, background: "var(--border-subtle)", margin: "7px 0" }} />
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", color: hoverRibbon.net >= 0 ? RIBBON_POS_GLOW : RIBBON_NEG_GLOW, marginBottom: 4 }}>
                    RIBBON · {fmtPrice(hoverRibbon.strike)} STRIKE
                  </div>
                  <div className="flex items-center justify-between" style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>
                    <span style={{ color: "var(--text-secondary)" }}>Net dealer &#915;</span>
                    <span style={{ fontWeight: 600, color: hoverRibbon.net >= 0 ? RIBBON_POS_GLOW : RIBBON_NEG_GLOW }}>{fmtGex(hoverRibbon.net)}</span>
                  </div>
                  <div className="flex items-center justify-between" style={{ fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 2 }}>
                    <span style={{ color: "var(--text-secondary)" }}>{hoverRibbon.net >= 0 ? "Long Γ · magnet / brake" : "Short Γ · accelerant"}</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {hoverRibbon.drawn ? `${hoverRibbon.tier} · ${Math.round(hoverRibbon.norm * 100)}%` : "under floor"}
                    </span>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--text-muted)", marginTop: 3 }}>
                    share of the heaviest strike on screen
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── On-screen controls: jump-to-latest + zoom (time + price) ────
             On the compact canvas the steppers leave the plot (they sat on the
             newest volume bars) for the strip under the chart; only the
             jump-to-latest button stays, over the bottom of the price pane. */}
        <div
          className="absolute z-20 flex flex-col items-end gap-1.5"
          style={compact ? { right: 8, top: `${(PRICE_BOTTOM / VH) * 100}%`, transform: "translateY(-100%)", marginTop: -6 } : { right: 12, bottom: 12 }}
        >
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
          {!compact && (
            <>
              <ZoomCluster label="Time" onIn={() => zoomTimeCentered(1 / ZOOM_FACTOR)} onOut={() => zoomTimeCentered(ZOOM_FACTOR)} hint="Ctrl + scroll" />
              <ZoomCluster label="Price" onIn={() => zoomPrice(1 / ZOOM_FACTOR)} onOut={() => zoomPrice(ZOOM_FACTOR)} hint="Shift + scroll" />
            </>
          )}
        </div>
      </div>

      {/* Compact: the gesture key and the zoom steppers, under the plot. */}
      {compact && (
        <div
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-3 py-2"
          style={{ borderTop: "1px solid var(--border-subtle)", background: "var(--bg-card)" }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.04em", color: "var(--text-muted)" }}>
            {touchUi
              ? "Drag to pan · pinch to zoom · tap or hold for the crosshair"
              : "Drag to pan · Ctrl + scroll to zoom · hover for the crosshair"}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <ZoomCluster large label="Time" onIn={() => zoomTimeCentered(1 / ZOOM_FACTOR)} onOut={() => zoomTimeCentered(ZOOM_FACTOR)} />
            <ZoomCluster large label="Price" onIn={() => zoomPrice(1 / ZOOM_FACTOR)} onOut={() => zoomPrice(ZOOM_FACTOR)} />
          </div>
        </div>
      )}

      {/* ── Rewind / session-replay bar (live mode only) ─────────────────── */}
      {live && (
        <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-2" style={{ borderTop: "1px solid var(--border-default)", background: "var(--bg-subtle)" }}>
          {!rewindActive ? (
            // The blurb that used to sit beside this button is now the button's
            // own hover tooltip — it explained the control, so it belongs on it.
            <button
              type="button"
              onClick={enterRewind}
              title="Replay how price & dealer gamma moved through the session"
              className="zg-gc-pill"
              style={{ ["--pill-color" as string]: "var(--color-accent-hot)" }}
            >
              <Rewind size={13} /> Rewind
            </button>
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
                {([1, 4, 8, 16] as const).map((s) => (
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
              {rewindFloorLabel && (
                <a
                  href={`/replay/${symbol}/${etTodayDateKey()}`}
                  title={`Rewind reaches back to ${rewindFloorLabel} ET — the strike-profile history this chart holds, which is a fixed window ending at the live tip rather than the whole session. Daily Replay carries every minute from the open.`}
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--text-secondary)",
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                    textDecoration: "underline dotted",
                    textUnderlineOffset: 3,
                  }}
                >
                  back to {rewindFloorLabel} · full session
                </a>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Footer legend ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5" style={{ borderTop: "1px solid var(--border-default)", background: "var(--bg-subtle)" }}>
        <LegendDot color="var(--color-flip)" label="Gamma Flip" />
        <LegendDot color="var(--color-bear)" label="Call Wall" />
        <LegendDot color="var(--color-bull)" label="Put Wall" />
        <LegendDot color="var(--color-maxpain)" label="Max Pain" />
        <LegendDot color="var(--color-pin)" label="Pin Strike" />
        <LegendDot color="var(--color-hazy)" label="VWAP" />
        <LegendDot color="var(--color-accent-hot)" label="Last" />
        {live && overlays.ribbons && <RibbonKey />}
        {railStackingActive && (
          <span
            className="flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-secondary)", letterSpacing: "0.03em" }}
            title="Each rail bar is split by expiration: the nearest expiration sits at the zero line (boldest) and the furthest fans out to the tip (faintest)"
          >
            <span>near</span>
            <span
              style={{
                width: 28,
                height: 8,
                display: "inline-block",
                borderRadius: 2,
                background: "linear-gradient(90deg, var(--text-primary) 0%, color-mix(in srgb, var(--text-primary) 25%, transparent) 100%)",
              }}
            />
            <span>far</span>
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <Info size={12} />
          <span className="zg-eyebrow" style={{ fontSize: 9.5 }}>
            Dealer gamma computed by ZeroGEX ·{" "}
            {delayed
              ? "delayed ~15 min"
              : feedStale
                ? `price feed ${futuresDelayLabel(feedAgeSeconds).toLowerCase()}`
                : "updates live"}
          </span>
        </div>
      </div>

      {/* ── Panelled rail ────────────────────────────────────────────────
          The page gave us an element across the tape's price band, so the rail
          is drawn there instead of in the chart's own column. The viewBox
          spans the SAME band (PAD_TOP..PRICE_BOTTOM), so `yPrice` puts a strike
          at the identical height it has on the candles — this is what makes a
          bar line up with its price on the tape — while the width is shaped to
          the element's aspect so `preserveAspectRatio="none"` scales x and y by
          the same factor and nothing is stretched.

          The gradients are re-declared here rather than referenced across from
          the chart's own <defs>: a url(#id) does resolve document-wide, but
          that would quietly make this panel depend on the chart's SVG still
          being mounted, which is exactly the coupling a portal should not add. */}
      {inPanel && strikePanelTarget
        ? createPortal(
            <svg
              width="100%"
              height="100%"
              viewBox={`${railLeft} ${panelVb.y} ${railRight - railLeft} ${panelVb.h}`}
              preserveAspectRatio="none"
              style={{ display: "block", overflow: "visible" }}
              role="img"
              aria-label="Dealer gamma by strike"
            >
              <defs>
                <linearGradient id={`${RAIL_POS_GRADIENT_ID}-panel`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--color-bull)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--color-bull)" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id={`${RAIL_NEG_GRADIENT_ID}-panel`} x1="1" y1="0" x2="0" y2="0">
                  <stop offset="0%" stopColor="var(--color-bear)" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="var(--color-bear)" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              {railGroup}
            </svg>,
            strikePanelTarget,
          )
        : null}

      {/* The rail's view controls follow it: on the panel when it is panelled,
          on this toolbar when it is not (see the toolbar block above). */}
      {inPanel && railControlsTarget ? createPortal(railViewControls, railControlsTarget) : null}
    </div>
  );
}

// ── Small presentational helpers ─────────────────────────────────────────────
// Rebuild the gamma rail for a rewound moment from a bucket's per-strike net
// gamma. The live rail draws a smooth net-gamma-by-price density (two lobes
// peaking at the put-side / call-side walls); the raw bucket strikes are the
// same quantity but discrete and sign-alternating between neighbors, so plotted
// directly they read as a jagged, center-crossing silhouette (the "funky" rail).
// We convolve them with a Gaussian (bandwidth ≈ the strike spacing) onto a fine
// price grid to recover that clean silhouette, preserving the sign convention
// (positive net gamma → long-Γ lobe, green/right — same as the live rail).
function rewindRailCurve(strikes: StrikeProfileStrike[] | undefined): ProfilePoint[] {
  const rows = (strikes ?? [])
    .map((s) => ({ price: levelOrNull(s.strike), ng: levelOrNull(s.net_gamma) }))
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

// On-bar $ gamma label for the per-strike rail bars. A halo (stroke painted
// under the fill) keeps it legible over the bars and the plot grid alike.
//
// The text is --text-primary rather than the bar's own bull/bear: at 8.5px on
// the halo's --bg-card that colour cleared 4.5:1 in only 24 of 48 palette/side
// combinations, down to 2.36:1. The label is drawn hard against the end of the
// bar it belongs to, and calls sit right of the rail centre while puts sit
// left, so which bar a number belongs to was never the colour's job.
function RailBarLabel({ x, y, anchor, text }: { x: number; y: number; anchor: "start" | "end"; text: string }) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontFamily="var(--font-mono)"
      fontSize={8.5}
      fontWeight={600}
      fill="var(--text-primary)"
      style={{ paintOrder: "stroke", stroke: "var(--bg-card)", strokeWidth: 2.5, fontVariantNumeric: "tabular-nums" } as CSSProperties}
    >
      {text}
    </text>
  );
}

// `ink` is the price's colour. It has to be judged against this tag's own fill
// rather than against the page, because a level's colour does not follow the
// theme — see useChipInk. Callers pass chipInk(bg).
function PriceTag({ x, y, value, bg, ink, strong = false, arrow = null }: { x: number; y: number; value: string; bg: string; ink: string; strong?: boolean; arrow?: "up" | "down" | null }) {
  const w = 8 + value.length * 6.6 + (arrow ? 8 : 0);
  const h = strong ? 18 : 15;
  return (
    <g transform={`translate(${x - w}, ${y})`}>
      <rect x={0} y={-h / 2} width={w} height={h} rx={2} fill={bg} />
      <text x={w / 2} y={strong ? 4 : 3.5} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={strong ? 12 : 10.5} fontWeight={strong ? 700 : 600} fill={ink} style={{ fontVariantNumeric: "tabular-nums" }}>
        {arrow === "up" ? "▲ " : arrow === "down" ? "▼ " : ""}
        {value}
      </text>
    </g>
  );
}

/**
 * Time left in the forming candle, hung under the last-price tag in the axis
 * gutter — the terminal convention, and the reason it sits there rather than
 * over the plot: it reads as part of the price column, not as another overlay.
 * The rule underneath fills left-to-right as the candle runs out.
 */
function BarCountdownTag({ x, y, label, progress }: { x: number; y: number; label: string; progress: number }) {
  const w = Math.max(34, 10 + label.length * 6.6);
  const h = 14;
  const filled = Math.max(0, Math.min(1, progress)) * (w - 4);
  return (
    <g transform={`translate(${x - w}, ${y})`} role="img">
      <title>{`${label} left in this candle`}</title>
      <rect x={0} y={-h / 2} width={w} height={h} rx={2} fill="var(--bg-card)" stroke="var(--color-accent-hot)" strokeWidth={0.8} opacity={0.95} />
      <text x={w / 2} y={2} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={9.5} fontWeight={600} fill="var(--color-accent-hot)" style={{ fontVariantNumeric: "tabular-nums" }}>
        {label}
      </text>
      <rect x={2} y={h / 2 - 2.6} width={w - 4} height={1.4} rx={0.7} fill="var(--color-accent-hot)" opacity={0.18} />
      {filled > 0 && <rect x={2} y={h / 2 - 2.6} width={filled} height={1.4} rx={0.7} fill="var(--color-accent-hot)" opacity={0.85} />}
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

// Opacity slider for the ribbons — the one continuous control in the toolbar,
// styled to sit beside the pills: a mono label, a short native range (keyboard
// and screen-reader friendly for free), and the value read out as a percent.
function RibbonOpacityControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = Math.round(value * 100);
  return (
    <label
      className="flex items-center gap-1.5"
      title="Ribbon opacity — scales the orbs, their glow and their rim together. 100% is the tuned look; the default sits a notch under it so the tape leads."
      style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.04em", color: "var(--text-secondary)", height: 26, padding: "0 8px", border: "1px solid var(--border-default)", borderRadius: "var(--radius-control)", background: "var(--bg-card)" }}
    >
      <span style={{ textTransform: "uppercase" }}>Opacity</span>
      <input
        type="range"
        min={Math.round(RIBBON_OPACITY_MIN * 100)}
        max={Math.round(RIBBON_OPACITY_MAX * 100)}
        step={5}
        value={pct}
        onChange={(e) => onChange(clampRibbonOpacity(Number(e.target.value) / 100))}
        aria-label="Ribbon opacity"
        aria-valuetext={`${pct}%`}
        style={{ width: 76, accentColor: RIBBON_POS_GLOW, cursor: "pointer" }}
      />
      <span style={{ minWidth: 34, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--text-primary)" }}>{pct}%</span>
    </label>
  );
}

function OverlayPill({ label, color, active, onClick, title }: { label: string; color: string; active: boolean; onClick: () => void; title?: string }) {
  return (
    <button type="button" className="zg-gc-pill" data-active={active} onClick={onClick} style={{ ["--pill-color" as string]: color }} aria-pressed={active} title={title}>
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

function ZoomCluster({ label, onIn, onOut, hint, large = false }: { label: string; onIn: () => void; onOut: () => void; hint?: string; large?: boolean }) {
  // A bare wheel scrolls the page now, so the modifier gesture only exists if
  // something tells the reader about it. These buttons are that something.
  const suffix = hint ? ` — or ${hint}` : "";
  // `large`: finger-sized steppers for the compact canvas.
  const btn = large ? { ...zoomBtnStyle, width: 34, height: 30, fontSize: 17 } : zoomBtnStyle;
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
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)", width: large ? "auto" : 34, textAlign: "right", paddingRight: 2 }}>
        {label}
      </span>
      <button type="button" onClick={onOut} aria-label={`Zoom out (${label})`} title={`Zoom out (${label})${suffix}`} style={btn}>
        −
      </button>
      <button type="button" onClick={onIn} aria-label={`Zoom in (${label})`} title={`Zoom in (${label})${suffix}`} style={btn}>
        +
      </button>
    </div>
  );
}

// A tiny orb for the legend key, drawn like the tape's (an ellipse, not a dot).
function KeyOrb({ fill, ry, opacity }: { fill: string; ry: number; opacity: number }) {
  return (
    <svg width={14} height={12} viewBox="0 0 14 12" aria-hidden style={{ display: "inline-block", flex: "0 0 auto" }}>
      <ellipse cx={7} cy={6} rx={5.5} ry={ry} fill={fill} opacity={opacity} />
    </svg>
  );
}

// Legend key for the GEX ribbons: colour (sign), then the height + opacity
// scale (weight), then the full reading guide behind an info icon.
function RibbonKey() {
  return (
    <span
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1"
      style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-secondary)", letterSpacing: "0.03em" }}
    >
      <span style={{ color: "var(--text-muted)" }}>Ribbons</span>
      <span className="flex items-center gap-1 whitespace-nowrap" title="Gold: dealers net long gamma at the strike — a magnet and a brake">
        <KeyOrb fill={RIBBON_POS_GLOW} ry={4.5} opacity={0.9} />
        long &#915;
      </span>
      <span className="flex items-center gap-1 whitespace-nowrap" title="Violet: dealers net short gamma at the strike — an accelerant">
        <KeyOrb fill={RIBBON_NEG_GLOW} ry={4.5} opacity={0.9} />
        short &#915;
      </span>
      <span
        className="flex items-center gap-1 whitespace-nowrap"
        title="Height and opacity: the strike's net dealer gamma as a share of the heaviest strike on screen — a sliver is a light strike, a full lane is the wall"
      >
        <span className="flex items-center" style={{ gap: 1 }}>
          <KeyOrb fill="var(--text-primary)" ry={1.3} opacity={RIBBON_TIER_OPACITY.weak + 0.15} />
          <KeyOrb fill="var(--text-primary)" ry={2.8} opacity={RIBBON_TIER_OPACITY.mid + 0.15} />
          <KeyOrb fill="var(--text-primary)" ry={4.5} opacity={RIBBON_TIER_OPACITY.strong + 0.1} />
        </span>
        light &#8594; heavy
      </span>
      <TooltipWrapper text={RIBBON_GUIDE} />
    </span>
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
