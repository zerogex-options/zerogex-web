'use client';

/**
 * The Flow Analysis page's one chart: the session's options flow on one
 * clock, in stacked panes that share a crosshair. The underlying's price;
 * net premium, with the call and put legs; the contracts each bar on each
 * side; and the put/call ratio. An events lane across the top carries the
 * numbered markers of the page's flow log. Behind the price line, optionally:
 * the strike ribbon (who crossed the spread at each strike, bar by bar;
 * core/flowStrikes) and the flip and walls.
 *
 * Drawn in pixels against the measured width (not a scaled viewBox), so type
 * stays the same size from a phone to a full-screen monitor. The height is the
 * caller's: the panes share whatever it is by weight, so the full-screen view
 * fills the window instead of floating a short chart in it.
 *
 * Zoom and pan the way the Gamma Chart does (core/flowChartView): Time and
 * Price buttons over the plot, Ctrl or Cmd + scroll or a pinch for time,
 * Shift + scroll or a scroll over the price scale for price, a drag to pan.
 * Every pane shares the time window, and each scale fits what is on screen,
 * so a zoomed-in hour spreads the strike lanes out as well as the bars.
 *
 * Geometry decisions live in core/flowAnalysis (paneLayout, valueDomain)
 * where they are tested; this file only draws.
 */

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import ZoomCluster from '@/components/ChartZoomCluster';
import { useChipInk, useLevelInk } from '@/hooks/useChartTheme';
import { useChartReadout } from '@/hooks/useChartReadout';
import { ET_HM, etMinuteOfDay, generateNiceTicks, trimEdgeTicks } from '@/core/technicalsCharts';
import { fmtLevel, priceDomain, spreadTags } from '@/core/technicalsSession';
import { inferStrikeStep, type RibbonTier } from '@/core/gexRibbons';
import { wheelAction } from '@/core/wheelZoom';
import {
  FIT_PRICE,
  WHEEL_STEP,
  ZOOM_STEP,
  applyPriceView,
  flowWindow,
  isFitPrice,
  panView,
  tickStepMinutes,
  zoomPrice,
  zoomView,
  type FlowPriceView,
  type FlowTimeView,
} from '@/core/flowChartView';
import {
  AUTO_SIZING,
  autoSizeContracts,
  buildStrikeRibbon,
  cellNear,
  cleanSizing,
  ribbonPriceDomain,
  strikeCellShown,
  strikeDotRadius,
  strikeFullNet,
  strikeLean,
  type StrikeCell,
  type StrikeDotSize,
  type StrikeLean,
  type StrikeSizing,
} from '@/core/flowStrikes';
import {
  bearishSide,
  bullishSide,
  fmtContracts,
  fmtContractsCompact,
  fmtUsdCompact,
  paneLayout,
  valueDomain,
  type FlowBar,
  type FlowEvent,
  type FlowEventTone,
  type FlowPaneKey,
} from '@/core/flowAnalysis';

const MONO = 'var(--font-mono)';

export interface FlowChartLayers {
  price: boolean;
  premium: boolean;
  /** The call and put premium lines inside the premium pane. */
  legs: boolean;
  contracts: boolean;
  pcr: boolean;
  events: boolean;
  /** The strike ribbon behind the price line. */
  strikes: boolean;
  /** The flip and the call and put walls across the price pane. */
  walls: boolean;
}

/** The dealer levels the walls layer draws: the Key Levels strip's read. */
export interface FlowLevels {
  flip: number | null;
  callWall: number | null;
  putWall: number | null;
}

interface Props {
  bars: FlowBar[];
  /** 09:30 ET of the session. */
  sessionStartMs: number;
  /** The end of the session's last bar slot. */
  sessionEndMs: number;
  barMs: number;
  /** Shade the part of the session still to come. */
  live: boolean;
  layers: FlowChartLayers;
  events: FlowEvent[];
  /** The whole drawing, in px. */
  height: number;
  compact: boolean;
  symbol: string;
  ariaLabel: string;
  /** Contracts bought and sold at each strike, by bar start (ms). */
  strikeCells?: ReadonlyMap<number, readonly StrikeCell[]> | null;
  /** The ribbon's size filter: the smallest dot it shows. */
  strikeSize?: StrikeDotSize;
  /** How the strike dots are sized: Auto, or the reader's own contract sizes. */
  strikeSizing?: StrikeSizing;
  /** Offered beside the price pane's label while the dots are drawn. */
  onStrikeSizing?: (next: StrikeSizing) => void;
  /** The live quote, for the newest bar's price between series reads. */
  livePrice?: number | null;
  levels?: FlowLevels | null;
}

const TONE_STROKE: Record<FlowEventTone, string> = {
  bullish: 'var(--color-bull)',
  bearish: 'var(--color-bear)',
  neutral: 'var(--color-hazy)',
};

const PANE_ORDER: FlowPaneKey[] = ['price', 'premium', 'contracts', 'pcr'];

// The ribbon's inks: the page's sides. A strike whose sides cancel exactly
// draws no dot and the readout skips it; the map covers every lean for the
// type's sake.
const LEAN_FILL: Record<StrikeLean, string> = {
  bullish: 'var(--color-bull)',
  bearish: 'var(--color-bear)',
  even: 'var(--text-muted)',
};
// A dot's size already says how hard a strike pressed, so its opacity only
// steps down a little with it: the big dots read solid, overlaps stay visible.
const DOT_TIER_OPACITY: Record<RibbonTier, number> = { strong: 0.85, mid: 0.72, weak: 0.58 };
const LEAN_WORDS: Record<StrikeLean, string> = {
  bullish: 'green: bullish',
  bearish: 'red: bearish',
  even: 'even',
};
// Where the dot sizes editor starts when nothing is known yet.
const SIZE_FALLBACK = { small: 50, medium: 250, large: 1000 };
const EDITOR_BTN: CSSProperties = {
  flex: 1,
  minHeight: 30,
  padding: '0 10px',
  fontFamily: MONO,
  fontSize: 11,
  color: 'var(--text-secondary)',
  background: 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-control, 2px)',
  cursor: 'pointer',
};

// The zoom is held in ms rather than bars, so switching between 5- and
// 1-minute bars keeps the same stretch of the session on screen.
interface HeldZoom {
  /** The symbol and session it belongs to: another one starts unzoomed. */
  key: string;
  time: { spanMs: number; endMs: number | null } | null;
  price: FlowPriceView;
}

type Domains = Record<FlowPaneKey, { min: number; max: number } | null>;

// Zoomed in on time, the price scale fits the prices on screen alone, with
// room for this many strike lanes at least: a wall a few strikes off would
// otherwise stretch the scale and keep the lanes as thin as the whole day's.
const ZOOMED_MIN_LANES = 8;

/**
 * Each pane's scale for these bars. A level near the prices joins the price
 * window; a far one gets an edge tag instead of squashing the line
 * (core/technicalsSession).
 */
function flowDomains(
  rows: readonly FlowBar[],
  {
    legs,
    ribbonOn,
    strikeStep,
    levels,
    minLanes,
  }: { legs: boolean; ribbonOn: boolean; strikeStep: number | null; levels: Array<number | null>; minLanes?: number },
): Domains {
  const prices: number[] = [];
  const premiums: number[] = [0];
  const ratios: number[] = [];
  let volMax = 0;
  for (const b of rows) {
    if (b.price != null) prices.push(b.price);
    premiums.push(b.netPremium);
    if (legs) premiums.push(b.callPremium, b.putPremium);
    if (b.putCallRatio != null) ratios.push(b.putCallRatio);
    volMax = Math.max(volMax, bullishSide(b.bar), bearishSide(b.bar));
  }
  const v = volMax > 0 ? volMax * 1.08 : 1;
  return {
    price: ribbonOn
      ? ribbonPriceDomain(prices, levels, strikeStep, minLanes)
      : levels.some((l) => l != null)
        ? priceDomain(prices, levels)
        : valueDomain(prices, null, 0.06),
    premium: valueDomain(premiums, null, 0.08),
    contracts: { min: -v, max: v },
    // A put/call wandering by a few hundredths is flat; draw it flat.
    pcr: valueDomain(ratios, 1, 0.12, 0.2),
  };
}

// A wheel's delta in px, whatever unit the browser counted it in.
function wheelPx(e: WheelEvent): number {
  return e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
}

interface Tag {
  key: string;
  label: string;
  y: number;
  color: string;
  outline?: boolean;
  /** A level off the price window, pinned to its edge with an arrow. */
  edge?: 'top' | 'bottom';
  title?: string;
}

/** A strike as a reader writes it: 665, or 6,745.25 for a projected one. */
function fmtStrike(strike: number): string {
  return Number.isInteger(strike) ? strike.toLocaleString('en-US') : fmtLevel(strike);
}

/** Split a series where it crosses zero, so the area above and below it fills exactly. */
function withZeroCrossings(pts: Array<{ x: number; v: number }>): Array<{ x: number; v: number }> {
  const out: Array<{ x: number; v: number }> = [];
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i];
    out.push(a);
    const b = pts[i + 1];
    if (b && ((a.v > 0 && b.v < 0) || (a.v < 0 && b.v > 0))) {
      const t = a.v / (a.v - b.v);
      out.push({ x: a.x + (b.x - a.x) * t, v: 0 });
    }
  }
  return out;
}

export default function FlowSessionChart({
  bars: seriesBars,
  sessionStartMs,
  sessionEndMs,
  barMs,
  live,
  layers,
  events,
  height,
  compact,
  symbol,
  ariaLabel,
  strikeCells = null,
  strikeSize = 'all',
  strikeSizing = AUTO_SIZING,
  onStrikeSizing,
  livePrice = null,
  levels = null,
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const readout = useChartReadout(wrapRef);
  const { index: hoverIdx, setIndex: setHoverIdx } = readout;
  // The price under the pointer, for the strike it is over.
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);
  const chipInk = useChipInk();
  const levelInk = useLevelInk();
  const clipId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const zoomKey = `${symbol}|${sessionStartMs}`;
  const [held, setHeld] = useState<HeldZoom>({ key: zoomKey, time: null, price: FIT_PRICE });
  const zoom: HeldZoom = held.key === zoomKey ? held : { key: zoomKey, time: null, price: FIT_PRICE };
  // A drag or a pinch in progress, and the view it started from.
  const dragRef = useRef<{
    id: number;
    x0: number;
    y0: number;
    time: FlowTimeView | null;
    price: FlowPriceView;
    /** The price at the middle of the scale, and price per px, when it began. */
    mid: number;
    perPx: number;
    inPrice: boolean;
    touch: boolean;
    moved: boolean;
  } | null>(null);
  const touchesRef = useRef(new Map<number, number>());
  const pinchRef = useRef<{ d0: number; time: FlowTimeView | null; anchor: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  // The dot sizes editor: the boxes as typed while it is open, null when shut.
  const [sizeDraft, setSizeDraft] = useState<{ small: string; medium: string; large: string } | null>(null);
  const sizesRef = useRef<HTMLDivElement | null>(null);
  const sizesOpen = sizeDraft != null;
  useEffect(() => {
    if (!sizesOpen) return;
    const onPress = (e: PointerEvent) => {
      if (sizesRef.current && e.target instanceof Node && sizesRef.current.contains(e.target)) return;
      setSizeDraft(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSizeDraft(null);
    };
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [sizesOpen]);

  // On a live session the newest bar's price follows the live quote between
  // series reads, so the line's end and its tag move every second.
  const bars = useMemo(() => {
    const newest = seriesBars[seriesBars.length - 1];
    if (!live || livePrice == null || !Number.isFinite(livePrice) || !newest || newest.price === livePrice) return seriesBars;
    return [...seriesBars.slice(0, -1), { ...newest, price: livePrice }];
  }, [seriesBars, live, livePrice]);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const TAG_W = compact ? 64 : 84;
  const AXIS_H = 22;
  const LANE_H = layers.events && events.length > 0 ? 22 : 0;
  const PANE_GAP = compact ? 12 : 16;
  // Axis numbers get a gutter of their own: the session's tallest bars are the
  // open's, right where labels inside the plot would sit on them.
  const AXIS_W = compact ? 36 : 46;
  const plotW = Math.max(0, width - AXIS_W - TAG_W - 6);
  const plotR = AXIS_W + plotW;
  const panesTop = LANE_H ? LANE_H + 6 : 4;
  const panesBottom = Math.max(panesTop + 40, height - AXIS_H);


  const spanMs = Math.max(barMs, sessionEndMs - sessionStartMs);
  const slots = Math.max(1, Math.round(spanMs / barMs));
  // The window on screen, in bar slots from the open. `edge` is the slot just
  // past the newest bar, which a zoomed-in view follows.
  const edge = bars.length > 0 ? (bars[bars.length - 1].ms - sessionStartMs) / barMs + 1 : 0;
  const timeView: FlowTimeView | null = zoom.time
    ? { span: zoom.time.spanMs / barMs, end: zoom.time.endMs == null ? null : (zoom.time.endMs - sessionStartMs) / barMs }
    : null;
  const zoomed = timeView != null;
  const win = flowWindow(timeView, slots, edge);
  const winStart = win.start;
  const winEnd = win.end;
  const slotW = plotW / win.span;
  const x = (ms: number) => AXIS_W + ((ms - sessionStartMs) / barMs + 0.5 - winStart) * slotW;
  // The bar slot under a px, in the window's own units (for anchoring a zoom).
  const slotAt = (px: number) => winStart + (Math.min(plotR, Math.max(AXIS_W, px)) - AXIS_W) / Math.max(1e-9, slotW);

  // The bars a zoomed window shows, with one past each edge so lines run off
  // the plot rather than stopping short of it.
  const visibleBars = useMemo(() => {
    if (!zoomed) return bars;
    return bars.filter((b) => {
      const slot = (b.ms - sessionStartMs) / barMs;
      return slot >= winStart - 1 && slot <= winEnd + 1;
    });
  }, [zoomed, bars, sessionStartMs, barMs, winStart, winEnd]);

  // ── Strikes and levels ──────────────────────────────────────────────────
  const ribbonOn = layers.price && layers.strikes && strikeCells != null && strikeCells.size > 0;
  const strikeStep = useMemo(() => {
    if (!strikeCells) return null;
    const all: number[] = [];
    for (const cells of strikeCells.values()) for (const c of cells) all.push(c.strike);
    return inferStrikeStep(all);
  }, [strikeCells]);
  const wallsOn = layers.price && layers.walls && levels != null;
  const flip = wallsOn ? levels.flip : null;
  const callWall = wallsOn ? levels.callWall : null;
  const putWall = wallsOn ? levels.putWall : null;

  // ── Domains ─────────────────────────────────────────────────────────────
  // The whole session's, which the strike dots take their full size from so a
  // zoom spreads them out without resizing them; and the window's, which every
  // pane draws to, with the reader's own price zoom and pan on top.
  const sessionDomains = useMemo(
    () => flowDomains(bars, { legs: layers.legs, ribbonOn, strikeStep, levels: [flip, callWall, putWall] }),
    [bars, layers.legs, ribbonOn, strikeStep, flip, callWall, putWall],
  );
  const domains = useMemo(() => {
    const fit = zoomed
      ? flowDomains(visibleBars, { legs: layers.legs, ribbonOn, strikeStep, levels: [], minLanes: ZOOMED_MIN_LANES })
      : sessionDomains;
    return fit.price && !isFitPrice(zoom.price) ? { ...fit, price: applyPriceView(fit.price, zoom.price) } : fit;
  }, [zoomed, visibleBars, sessionDomains, layers.legs, ribbonOn, strikeStep, zoom.price]);

  // A pane with nothing to draw (no underlying price on the rows, say) hands
  // its height to the others rather than sitting blank.
  const shownKey = PANE_ORDER.filter((k) => layers[k] && domains[k] != null).join(',');
  const bands = useMemo(
    () =>
      paneLayout(shownKey ? (shownKey.split(',') as FlowPaneKey[]) : [], panesTop, panesBottom - panesTop, PANE_GAP),
    [shownKey, panesTop, panesBottom, PANE_GAP],
  );

  // On Auto, the size a dot is full at, over the whole session. Keyed on the
  // scale's numbers rather than its object, which a live price tick renews.
  const sessionMin = sessionDomains.price?.min ?? null;
  const sessionMax = sessionDomains.price?.max ?? null;
  const ribbonFull = useMemo(() => {
    if (!ribbonOn || !strikeCells || sessionMin == null || sessionMax == null) return 0;
    return strikeFullNet(strikeCells, seriesBars.map((b) => b.ms), sessionMin, sessionMax);
  }, [ribbonOn, strikeCells, seriesBars, sessionMin, sessionMax]);

  // The bar starts on screen, from the series bars: a live price tick moves
  // the price line, not which bars the dots are in.
  const windowStarts = useMemo(() => {
    const starts = seriesBars.map((b) => b.ms);
    if (!zoomed) return starts;
    return starts.filter((ms) => {
      const slot = (ms - sessionStartMs) / barMs;
      return slot >= winStart - 1 && slot <= winEnd + 1;
    });
  }, [zoomed, seriesBars, sessionStartMs, barMs, winStart, winEnd]);

  // The ribbon, built once per data or layout change rather than on every
  // hover or price tick: a session of SPX strikes is thousands of orbs.
  const priceMin = domains.price?.min ?? null;
  const priceMax = domains.price?.max ?? null;
  const ribbon = useMemo(() => {
    const band = bands.find((b) => b.key === 'price');
    if (!ribbonOn || !strikeCells || priceMin == null || priceMax == null || !band || band.height <= 0 || plotW <= 0) return null;
    return buildStrikeRibbon(
      strikeCells,
      windowStarts,
      {
        x: (ms) => AXIS_W + ((ms - sessionStartMs) / barMs + 0.5 - winStart) * slotW,
        yPrice: (v) => band.top + ((priceMax - v) / (priceMax - priceMin)) * band.height,
        dMin: priceMin,
        dMax: priceMax,
      },
      strikeSize,
      { sizing: strikeSizing, fullNet: ribbonFull },
    );
  }, [ribbonOn, strikeCells, windowStarts, priceMin, priceMax, bands, plotW, slotW, AXIS_W, sessionStartMs, barMs, winStart, strikeSize, strikeSizing, ribbonFull]);

  // ── Zoom and pan ────────────────────────────────────────────────────────
  const toHeldTime = (next: FlowTimeView | null): HeldZoom['time'] =>
    next ? { spanMs: next.span * barMs, endMs: next.end == null ? null : sessionStartMs + next.end * barMs } : null;
  const commitTime = (next: FlowTimeView | null) => setHeld({ key: zoomKey, time: toHeldTime(next), price: zoom.price });
  const commitPrice = (next: FlowPriceView) => setHeld({ key: zoomKey, time: zoom.time, price: next });
  const zoomTimeBy = (factor: number, anchor: number | null) => commitTime(zoomView(timeView, factor, anchor, slots, edge));
  const zoomPriceBy = (factor: number) => commitPrice(zoomPrice(zoom.price, factor));
  const resetZoom = () => setHeld({ key: zoomKey, time: null, price: FIT_PRICE });
  const customView = zoomed || !isFitPrice(zoom.price);
  const priceBandNow = bands.find((b) => b.key === 'price') ?? null;

  // A bare wheel scrolls the page (core/wheelZoom); Ctrl or Cmd, or a
  // trackpad pinch, zooms time about the bar under the pointer; Shift, or the
  // pointer over the price scale, zooms the price.
  const onWheel = (e: WheelEvent) => {
    const wrap = wrapRef.current;
    if (!wrap || e.deltaY === 0 || plotW <= 0) return;
    const rect = wrap.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const inPrice = priceBandNow != null && py >= priceBandNow.top && py <= priceBandNow.top + priceBandNow.height;
    const action = wheelAction({
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      shiftKey: e.shiftKey,
      overPriceAxis: inPrice && (px < AXIS_W || px > plotR),
    });
    if (action === 'page-scroll') return;
    e.preventDefault();
    // A notch of a mouse wheel is one full step; a trackpad's small deltas
    // are a fraction of one, so a pinch zooms smoothly instead of leaping.
    const step = Math.min(WHEEL_STEP, Math.exp(Math.abs(wheelPx(e)) * 0.004));
    const factor = e.deltaY < 0 ? 1 / step : step;
    if (action === 'zoom-price') {
      if (priceBandNow) zoomPriceBy(factor);
      return;
    }
    setHoverIdx(null);
    zoomTimeBy(factor, slotAt(px));
  };
  // Attached natively, not as a React prop, so preventDefault can stop the
  // page on the gestures the chart does claim; the listener reads the latest
  // handler through a ref, so it never zooms from a stale view.
  useEffect(() => {
    wheelRef.current = onWheel;
  });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => wheelRef.current(e);
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  if (width === 0 || bars.length === 0) {
    return <div ref={wrapRef} style={{ width: '100%', height }} aria-hidden="true" />;
  }

  const bandOf = (key: FlowPaneKey) => bands.find((b) => b.key === key) ?? null;
  const yIn = (key: FlowPaneKey) => {
    const band = bandOf(key);
    const d = domains[key];
    if (!band || !d) return null;
    return (v: number) => band.top + ((d.max - v) / (d.max - d.min)) * band.height;
  };

  const last = bars[bars.length - 1];
  const nowX = x(last.ms) + slotW / 2;
  const bodyW = Math.max(1, Math.min(9, slotW * 0.66));

  // ── Time axis ───────────────────────────────────────────────────────────
  // The ET clock is read once: a session never spans a DST change, so every
  // other minute is an offset from the open. Zoomed in, the step narrows to
  // keep a label every 70px or so.
  const stepMin = zoomed
    ? tickStepMinutes(slotW / (barMs / 60_000), compact ? 64 : 72)
    : compact
      ? 120
      : spanMs / 3_600_000 <= 7
        ? 60
        : 120;
  const openMinute = etMinuteOfDay(sessionStartMs);
  const timeTicks: Array<{ ms: number; label: string }> = [];
  if (openMinute >= 0) {
    for (let off = 0; off * 60_000 < spanMs; off += 1) {
      const m = openMinute + off;
      if (m % stepMin !== 0) continue;
      const ms = sessionStartMs + off * 60_000;
      // A label half off the plot reads as a clipped number; drop it.
      const tx = x(ms) - slotW / 2;
      if (zoomed && (tx < AXIS_W + 14 || tx > plotR - 14)) continue;
      timeTicks.push({ ms, label: `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` });
    }
  }
  const axisTop = panesBottom;

  // ── Pointer ─────────────────────────────────────────────────────────────
  // The crosshair follows a hovering mouse or a finger, as it always has. A
  // drag pans a zoomed-in chart instead: sideways through time, and up and
  // down through a zoomed price scale with a mouse; two fingers pinch time.
  const onPointer = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    if (px < AXIS_W || px > plotR) {
      setHoverIdx(null);
      return;
    }
    const py = e.clientY - rect.top;
    const pb = bandOf('price');
    const dp = domains.price;
    setHoverPrice(
      ribbonOn && pb && dp && py >= pb.top && py <= pb.top + pb.height
        ? dp.max - ((py - pb.top) / pb.height) * (dp.max - dp.min)
        : null,
    );
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < bars.length; i += 1) {
      const d = Math.abs(x(bars[i].ms) - px);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    setHoverIdx(best);
  };
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === 'touch') {
      touchesRef.current.set(e.pointerId, e.clientX);
      if (touchesRef.current.size === 2) {
        const [a, b] = Array.from(touchesRef.current.values());
        const left = e.currentTarget.getBoundingClientRect().left;
        pinchRef.current = { d0: Math.max(1, Math.abs(a - b)), time: timeView, anchor: slotAt((a + b) / 2 - left) };
        dragRef.current = null;
        setHoverIdx(null);
        return;
      }
    } else if (e.button !== 0) {
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const py = e.clientY - rect.top;
    const pb = bandOf('price');
    const dp = domains.price;
    const inPrice = pb != null && py >= pb.top && py <= pb.top + pb.height;
    dragRef.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      time: timeView,
      price: zoom.price,
      mid: dp ? (dp.min + dp.max) / 2 : 0,
      perPx: dp && pb ? (dp.max - dp.min) / Math.max(1, pb.height) : 0,
      inPrice,
      touch: e.pointerType === 'touch',
      moved: false,
    };
    // A mouse holds on to a drag that runs off the chart; a finger already does.
    if (e.pointerType === 'mouse' && (zoomed || (inPrice && !isFitPrice(zoom.price)))) e.currentTarget.setPointerCapture(e.pointerId);
    onPointer(e);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (touchesRef.current.has(e.pointerId)) touchesRef.current.set(e.pointerId, e.clientX);
    const pinch = pinchRef.current;
    if (pinch && touchesRef.current.size >= 2) {
      const [a, b] = Array.from(touchesRef.current.values());
      commitTime(zoomView(pinch.time, pinch.d0 / Math.max(1, Math.abs(a - b)), pinch.anchor, slots, edge));
      return;
    }
    const drag = dragRef.current;
    if (drag && drag.id === e.pointerId && (e.pointerType !== 'mouse' || (e.buttons & 1) === 1)) {
      const dx = e.clientX - drag.x0;
      const dy = e.clientY - drag.y0;
      const panTime = drag.time != null;
      // Vertical drags on a phone scroll the page, so price pans by mouse.
      const panPrice = !drag.touch && drag.inPrice && !isFitPrice(drag.price);
      if (!drag.moved && Math.max(Math.abs(dx), Math.abs(dy)) > 4 && ((panTime && Math.abs(dx) >= Math.abs(dy)) || panPrice)) {
        drag.moved = true;
        setDragging(true);
        setHoverIdx(null);
      }
      if (drag.moved) {
        setHeld({
          key: zoomKey,
          time: panTime ? toHeldTime(panView(drag.time, dx / Math.max(1e-9, slotW), slots, edge)) : zoom.time,
          // Content follows the hand: dragging down brings higher prices into view.
          price: panPrice ? { zoom: drag.price.zoom, center: drag.mid + dy * drag.perPx } : zoom.price,
        });
        return;
      }
    }
    onPointer(e);
  };
  const endGesture = (e: ReactPointerEvent<SVGSVGElement>) => {
    touchesRef.current.delete(e.pointerId);
    if (touchesRef.current.size < 2) pinchRef.current = null;
    if (dragRef.current?.id === e.pointerId) {
      dragRef.current = null;
      setDragging(false);
    }
  };
  const hover = hoverIdx != null && !dragging ? bars[hoverIdx] ?? null : null;
  // Only a dot that is drawn answers the pointer: an even strike, dust under
  // the smallest size, or one the size filter hides reads as empty lane.
  const hoverCell =
    hover && ribbonOn && hoverPrice != null && ribbon
      ? cellNear(
          strikeCells?.get(hover.ms)?.filter((c) => strikeCellShown(c, ribbon, strikeSize)),
          hoverPrice,
          strikeStep,
        )
      : null;
  const hoverLean: StrikeLean = hoverCell ? strikeLean(hoverCell) : 'even';
  // Each side of the chain on its own, as the dot's rule reads them: calls
  // bought less sold count for the dot, puts bought less sold against it.
  const hoverCallNet = hoverCell ? hoverCell.callsBought - hoverCell.callsSold : 0;
  const hoverPutNet = hoverCell ? hoverCell.putsBought - hoverCell.putsSold : 0;

  // ── Panes ───────────────────────────────────────────────────────────────
  // A backing behind the label's own text, so a level or a ribbon lane that
  // runs along the top of a pane passes under it rather than through it.
  // Mono at 9px with 0.1em tracking is ~6.3px a character.
  const paneLabel = (text: string, top: number, extra?: ReactNode) => (
    <g>
      <rect x={AXIS_W + 1} y={top + 1} width={text.length * 6.3 + 6} height={13} fill="var(--bg-card)" fillOpacity={0.88} />
      <text x={AXIS_W + 4} y={top + 10} fontFamily={MONO} fontSize={9} letterSpacing="0.1em" fill="var(--text-muted)" stroke="var(--bg-card)" strokeWidth={3} paintOrder="stroke">
        {text}
        {extra}
      </text>
    </g>
  );

  const grid = (key: FlowPaneKey, fmt: (v: number) => string) => {
    const band = bandOf(key);
    const d = domains[key];
    const y = yIn(key);
    if (!band || !d || !y) return null;
    const ticks = trimEdgeTicks(generateNiceTicks(d.min, d.max)).filter((t) => y(t) > band.top + 6 && y(t) < band.top + band.height - 2);
    // At least ~22px between labels: thin to multiples of a wider step, which
    // keeps the zero line labelled on the two-sided panes.
    const stepVal = ticks.length > 1 ? ticks[1] - ticks[0] : 0;
    const stepPx = ticks.length > 1 ? Math.abs(y(ticks[0]) - y(ticks[1])) : Infinity;
    const every = Math.max(1, Math.ceil(22 / stepPx));
    const thin = every > 1 && stepVal > 0 ? ticks.filter((t) => Math.round(t / stepVal) % every === 0) : ticks;
    return (
      <g>
        {thin.map((t) => (
          <g key={`g-${key}-${t}`}>
            <line x1={AXIS_W} x2={plotR} y1={y(t)} y2={y(t)} stroke="var(--color-grid-line)" strokeWidth={1} />
            <text x={AXIS_W - 6} y={y(t) + 3.5} textAnchor="end" fontFamily={MONO} fontSize={10} fill="var(--text-muted)">
              {fmt(t)}
            </text>
          </g>
        ))}
      </g>
    );
  };

  const tags: Tag[] = [];
  // Grids sit outside the plot's clip so their numbers keep the gutter; the
  // series inside it, so a zoomed-in line runs off the edge rather than over
  // the axis.
  const grids: ReactNode[] = [];
  const panes: ReactNode[] = [];
  // A series' latest value off a zoomed scale: pinned to the pane's edge with
  // an arrow, the way an off-scale level is.
  const seriesTag = (key: FlowPaneKey, v: number, label: string): Pick<Tag, 'label' | 'y' | 'edge'> => {
    const band = bandOf(key);
    const y = yIn(key);
    if (!band || !y) return { label, y: 0 };
    const at = y(v);
    if (at < band.top) return { label: `▲ ${label}`, y: band.top, edge: 'top' };
    if (at > band.top + band.height) return { label: `▼ ${label}`, y: band.top + band.height, edge: 'bottom' };
    return { label, y: at };
  };

  // Price
  const priceBand = bandOf('price');
  const yPrice = yIn('price');
  if (priceBand && yPrice) {
    const d = domains.price!;
    const pts = visibleBars.filter((b) => b.price != null).map((b) => `${x(b.ms).toFixed(1)},${yPrice(b.price as number).toFixed(1)}`);
    // The flip and walls: a line where the level is on the scale, an edge tag
    // with an arrow where it is not, and its name above the line.
    const walls: Array<{ key: string; name: string; value: number; color: string; dash: string; w: number }> = [];
    if (callWall != null) walls.push({ key: 'callWall', name: 'CALL WALL', value: callWall, color: 'var(--color-bear)', dash: '6 4', w: 1.2 });
    if (putWall != null) walls.push({ key: 'putWall', name: 'PUT WALL', value: putWall, color: 'var(--color-bull)', dash: '6 4', w: 1.2 });
    if (flip != null) walls.push({ key: 'flip', name: 'FLIP', value: flip, color: 'var(--color-flip)', dash: '8 4', w: 1.4 });
    const onScale = walls.filter((l) => l.value >= d.min && l.value <= d.max);
    // A name sits above its line, or below it where the pane's own label
    // leaves no room above; one that would land on another is skipped (its
    // tag still carries the price).
    const names = onScale
      .map((l) => {
        const ly = yPrice(l.value);
        return { ...l, ly: ly - 4 < priceBand.top + 14 ? ly + 11 : ly - 4 };
      })
      .sort((a, b) => a.ly - b.ly);
    const drawnNames: typeof names = [];
    for (const n of names) {
      if (drawnNames.every((o) => Math.abs(o.ly - n.ly) >= 11)) drawnNames.push(n);
    }
    grids.push(<g key="price">{grid('price', (v) => fmtLevel(v).replace(/\.00$/, ''))}</g>);
    panes.push(
      <g key="price" clipPath={`url(#${clipId}-price)`}>
        {ribbon?.paths.map((r) => (
          <path key={`rib-${r.lean}-${r.tier}`} d={r.d} fill={LEAN_FILL[r.lean]} fillOpacity={DOT_TIER_OPACITY[r.tier]} />
        ))}
        {onScale.map((l) => (
          <line key={`lvl-${l.key}`} x1={AXIS_W} x2={plotR} y1={yPrice(l.value)} y2={yPrice(l.value)} stroke={l.color} strokeWidth={l.w} strokeDasharray={l.dash} />
        ))}
        {pts.length > 1 && <polyline points={pts.join(' ')} fill="none" stroke="var(--text-primary)" strokeOpacity={0.85} strokeWidth={1.5} strokeLinejoin="round" />}
        {drawnNames.map((n) => (
          <text key={`lvl-name-${n.key}`} x={plotR - 4} y={n.ly} textAnchor="end" fontFamily={MONO} fontSize={9} letterSpacing="0.1em" fill={levelInk(n.color)} stroke="var(--bg-card)" strokeWidth={3} paintOrder="stroke">
            {n.name}
          </text>
        ))}
        {paneLabel(`PRICE · ${symbol}`, priceBand.top)}
      </g>,
    );
    for (const l of walls) {
      const edge = l.value > d.max ? 'top' : l.value < d.min ? 'bottom' : undefined;
      tags.push({
        key: l.key,
        label: `${edge === 'top' ? '▲ ' : edge === 'bottom' ? '▼ ' : ''}${fmtLevel(l.value)}`,
        y: edge === 'top' ? priceBand.top : edge === 'bottom' ? priceBand.top + priceBand.height : yPrice(l.value),
        color: l.color,
        edge,
        title: `${l.name.toLowerCase().replace(/^./, (c) => c.toUpperCase())} ${fmtLevel(l.value)}${edge ? ', off the visible scale' : ''}`,
      });
    }
    if (last.price != null) tags.push({ key: 'last', ...seriesTag('price', last.price, fmtLevel(last.price)), color: 'var(--color-accent-hot)' });
  }

  // Net premium
  const premBand = bandOf('premium');
  const yPrem = yIn('premium');
  if (premBand && yPrem) {
    const y0 = yPrem(0);
    const pts = withZeroCrossings(visibleBars.map((b) => ({ x: x(b.ms), v: b.netPremium })));
    const first = pts[0];
    const end = pts[pts.length - 1];
    const area = (pick: (v: number) => number) =>
      `M${first.x.toFixed(1)},${y0.toFixed(1)} ` + pts.map((p) => `L${p.x.toFixed(1)},${yPrem(pick(p.v)).toFixed(1)}`).join(' ') + ` L${end.x.toFixed(1)},${y0.toFixed(1)} Z`;
    const line = (pick: (b: FlowBar) => number) => visibleBars.map((b) => `${x(b.ms).toFixed(1)},${yPrem(pick(b)).toFixed(1)}`).join(' ');
    grids.push(<g key="premium">{grid('premium', (v) => fmtUsdCompact(v).replace('.0M', 'M'))}</g>);
    panes.push(
      <g key="premium">
        <line x1={AXIS_W} x2={plotR} y1={y0} y2={y0} stroke="var(--text-secondary)" strokeOpacity={0.55} strokeWidth={1} />
        <path d={area((v) => Math.max(0, v))} fill="var(--color-bull)" fillOpacity={0.16} />
        <path d={area((v) => Math.min(0, v))} fill="var(--color-bear)" fillOpacity={0.16} />
        {layers.legs && visibleBars.length > 1 && (
          <>
            <polyline points={line((b) => b.callPremium)} fill="none" stroke="var(--color-bull)" strokeWidth={1.2} strokeOpacity={0.8} />
            <polyline points={line((b) => b.putPremium)} fill="none" stroke="var(--color-bear)" strokeWidth={1.2} strokeOpacity={0.8} />
          </>
        )}
        {visibleBars.length > 1 && <polyline points={line((b) => b.netPremium)} fill="none" stroke="var(--text-primary)" strokeWidth={1.8} strokeLinejoin="round" />}
        {paneLabel(
          'NET PREMIUM',
          premBand.top,
          layers.legs ? (
            <>
              <tspan fill="var(--text-muted)">{'  ·  '}</tspan>
              <tspan fill="var(--color-bull)">CALLS</tspan>
              <tspan fill="var(--text-muted)">{' / '}</tspan>
              <tspan fill="var(--color-bear)">PUTS</tspan>
            </>
          ) : null,
        )}
      </g>,
    );
    tags.push({
      key: 'net',
      ...seriesTag('premium', last.netPremium, fmtUsdCompact(last.netPremium, true)),
      color: last.netPremium >= 0 ? 'var(--color-bull)' : 'var(--color-bear)',
    });
    if (layers.legs) {
      tags.push({ key: 'calls', ...seriesTag('premium', last.callPremium, fmtUsdCompact(last.callPremium, true)), color: 'var(--color-bull)', outline: true });
      tags.push({ key: 'puts', ...seriesTag('premium', last.putPremium, fmtUsdCompact(last.putPremium, true)), color: 'var(--color-bear)', outline: true });
    }
  }

  // Contracts per bar, by side
  const volBand = bandOf('contracts');
  const yVol = yIn('contracts');
  if (volBand && yVol) {
    const y0 = yVol(0);
    grids.push(<g key="contracts">{grid('contracts', (v) => fmtContractsCompact(Math.abs(v)))}</g>);
    panes.push(
      <g key="contracts">
        {visibleBars.map((b) => {
          const cx = x(b.ms) - bodyW / 2;
          const cb = b.bar.callsBought;
          const ps = b.bar.putsSold;
          const pb = b.bar.putsBought;
          const cs = b.bar.callsSold;
          return (
            <g key={`v-${b.ms}`}>
              <rect x={cx} y={yVol(cb)} width={bodyW} height={Math.max(0, y0 - yVol(cb))} fill="var(--color-bull)" fillOpacity={0.85} />
              <rect x={cx} y={yVol(cb + ps)} width={bodyW} height={Math.max(0, yVol(cb) - yVol(cb + ps))} fill="var(--color-bull)" fillOpacity={0.38} />
              <rect x={cx} y={y0} width={bodyW} height={Math.max(0, yVol(-pb) - y0)} fill="var(--color-bear)" fillOpacity={0.85} />
              <rect x={cx} y={yVol(-pb)} width={bodyW} height={Math.max(0, yVol(-(pb + cs)) - yVol(-pb))} fill="var(--color-bear)" fillOpacity={0.38} />
            </g>
          );
        })}
        <line x1={AXIS_W} x2={plotR} y1={y0} y2={y0} stroke="var(--text-secondary)" strokeOpacity={0.55} strokeWidth={1} />
        {paneLabel(
          compact ? 'CONTRACTS / BAR' : 'CONTRACTS PER BAR',
          volBand.top,
          compact ? null : (
            <>
              <tspan fill="var(--text-muted)">{'  ·  '}</tspan>
              <tspan fill="var(--color-bull)">▲ CALLS BOUGHT + PUTS SOLD</tspan>
              <tspan fill="var(--text-muted)">{'   '}</tspan>
              <tspan fill="var(--color-bear)">▼ PUTS BOUGHT + CALLS SOLD</tspan>
            </>
          ),
        )}
      </g>,
    );
  }

  // Put/call
  const pcrBand = bandOf('pcr');
  const yPcr = yIn('pcr');
  if (pcrBand && yPcr) {
    const d = domains.pcr!;
    const pts = visibleBars.filter((b) => b.putCallRatio != null).map((b) => `${x(b.ms).toFixed(1)},${yPcr(b.putCallRatio as number).toFixed(1)}`);
    grids.push(<g key="pcr">{grid('pcr', (v) => v.toFixed(2))}</g>);
    panes.push(
      <g key="pcr">
        {d.min <= 1 && d.max >= 1 && (
          <line x1={AXIS_W} x2={plotR} y1={yPcr(1)} y2={yPcr(1)} stroke="var(--text-secondary)" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="4 3" />
        )}
        {pts.length > 1 && <polyline points={pts.join(' ')} fill="none" stroke="var(--color-info)" strokeWidth={1.6} strokeLinejoin="round" />}
        {paneLabel('PUT / CALL', pcrBand.top)}
      </g>,
    );
    if (last.putCallRatio != null) {
      tags.push({ key: 'pcr', ...seriesTag('pcr', last.putCallRatio, last.putCallRatio.toFixed(2)), color: 'var(--color-info)', outline: true });
    }
  }

  // Tags spread within their own pane, so a premium tag never lands in the price pane.
  const placedTags = tags.map((t) => ({ ...t }));
  for (const band of bands) {
    const inBand = placedTags.filter((t) => t.y >= band.top - 1 && t.y <= band.top + band.height + 1);
    const ys = spreadTags(inBand.map((t) => t.y), 16, band.top + 7, band.top + band.height - 7);
    inBand.forEach((t, i) => {
      t.y = ys[i];
    });
  }

  // Event markers, spread so neighbours never sit on each other.
  // In marker order, which is time order with same-bar ties settled, so 1 sits left of 2.
  const shownEvents = layers.events
    ? [...events].filter((e) => !zoomed || (x(e.ms) >= AXIS_W && x(e.ms) <= plotR)).sort((a, b) => a.marker - b.marker)
    : [];
  const markerXs = spreadTags(shownEvents.map((e) => x(e.ms)), 18, AXIS_W + 9, Math.max(AXIS_W + 9, plotR - 9));

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        style={{ display: 'block', touchAction: 'pan-y', cursor: dragging ? 'grabbing' : zoomed ? 'grab' : undefined }}
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={endGesture}
        onPointerLeave={(e) => {
          if (!dragRef.current) readout.onPointerLeave(e);
        }}
        onPointerCancel={(e) => {
          endGesture(e);
          readout.onPointerCancel();
        }}
      >
        <defs>
          <clipPath id={`${clipId}-plot`}>
            {/* The plot and its axis gutter; only the tag column is kept out. */}
            <rect x={0} y={0} width={plotR} height={axisTop} />
          </clipPath>
          <clipPath id={`${clipId}-data`}>
            {/* The plot alone: a zoomed-in series stops at the axis. */}
            <rect x={AXIS_W} y={0} width={plotW} height={axisTop} />
          </clipPath>
          {priceBand && (
            <clipPath id={`${clipId}-price`}>
              {/* The price pane alone: a zoomed price scale keeps its line and dots in it. */}
              <rect x={AXIS_W} y={priceBand.top} width={plotW} height={priceBand.height} />
            </clipPath>
          )}
        </defs>

        {/* The part of the session still to come */}
        {live && nowX < plotR && (
          <g>
            <rect x={Math.max(AXIS_W, nowX)} y={panesTop - 4} width={plotR - Math.max(AXIS_W, nowX)} height={axisTop - panesTop + 4} fill="var(--bg-subtle)" fillOpacity={0.55} />
            {nowX >= AXIS_W && <line x1={nowX} x2={nowX} y1={panesTop - 4} y2={axisTop} stroke="var(--border-default)" strokeWidth={1} />}
          </g>
        )}

        <g clipPath={`url(#${clipId}-plot)`}>{grids}</g>
        <g clipPath={`url(#${clipId}-data)`}>{panes}</g>

        {/* Pane separators */}
        {bands.slice(1).map((b) => (
          <line key={`sep-${b.key}`} x1={0} x2={width} y1={b.top - PANE_GAP / 2} y2={b.top - PANE_GAP / 2} stroke="var(--border-subtle)" strokeWidth={1} />
        ))}

        {/* Events lane */}
        {shownEvents.length > 0 && (
          <g>
            <line x1={AXIS_W} x2={plotR} y1={LANE_H - 1} y2={LANE_H - 1} stroke="var(--border-subtle)" strokeWidth={1} />
            {shownEvents.map((e, i) => {
              const mx = markerXs[i];
              const tx = x(e.ms);
              const stroke = TONE_STROKE[e.tone];
              return (
                <g key={`m-${e.id}`}>
                  <title>{`${e.marker}. ${ET_HM.format(new Date(e.ms))} ET · ${e.title}${e.detail ? ` · ${e.detail}` : ''}`}</title>
                  <line x1={tx} x2={tx} y1={LANE_H - 1} y2={panesTop} stroke={stroke} strokeOpacity={0.6} strokeWidth={1} />
                  <circle cx={mx} cy={10} r={8} fill="var(--bg-card)" stroke={stroke} strokeWidth={1.4} />
                  <text x={mx} y={13.5} textAnchor="middle" fontFamily={MONO} fontSize={10} fontWeight={600} fill="var(--text-primary)">
                    {e.marker}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* Hover crosshair, and a dot on each series at that bar */}
        {hover && (
          <g pointerEvents="none">
            <line x1={x(hover.ms)} x2={x(hover.ms)} y1={panesTop - 4} y2={axisTop} stroke="var(--text-muted)" strokeOpacity={0.6} strokeWidth={1} strokeDasharray="3 3" />
            {yPrice && hover.price != null && <circle cx={x(hover.ms)} cy={yPrice(hover.price)} r={3} fill="var(--text-primary)" />}
            {yPrice && hoverCell && ribbon && (
              <circle cx={x(hover.ms)} cy={yPrice(hoverCell.strike)} r={strikeDotRadius(hoverCell, ribbon) + 3} fill="none" stroke="var(--text-primary)" strokeWidth={1.2} />
            )}
            {yPrem && <circle cx={x(hover.ms)} cy={yPrem(hover.netPremium)} r={3} fill="var(--text-primary)" />}
            {yPcr && hover.putCallRatio != null && <circle cx={x(hover.ms)} cy={yPcr(hover.putCallRatio)} r={3} fill="var(--color-info)" />}
          </g>
        )}

        {/* Right-edge tags: the latest value of each series */}
        {placedTags.map((t) => (
          <g key={`tag-${t.key}`}>
            <rect
              x={plotR + 4}
              y={t.y - 7.5}
              width={TAG_W - 2}
              height={15}
              rx={2}
              fill={t.outline ? 'var(--bg-card)' : t.color}
              stroke={t.outline ? t.color : 'none'}
              strokeWidth={t.outline ? 1 : 0}
            />
            <text
              x={plotR + 4 + (TAG_W - 2) / 2}
              y={t.y + 3.5}
              textAnchor="middle"
              fontFamily={MONO}
              fontSize={compact ? 9 : 10}
              fontWeight={600}
              fill={t.outline ? 'var(--text-primary)' : chipInk(t.color)}
            >
              {t.label}
            </text>
            {t.title && <title>{t.title}</title>}
          </g>
        ))}

        {/* Time axis */}
        <g transform={`translate(0, ${axisTop})`}>
          <line x1={AXIS_W} x2={plotR} y1={0.5} y2={0.5} stroke="var(--border-default)" strokeWidth={1} />
          {timeTicks.map((t) => {
            const tx = x(t.ms) - slotW / 2;
            return (
              <g key={`t-${t.ms}`}>
                <line x1={tx} x2={tx} y1={0} y2={5} stroke="var(--text-muted)" strokeWidth={1} />
                <text x={tx} y={16} textAnchor="middle" fontFamily={MONO} fontSize={10} fill="var(--text-muted)">
                  {t.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hover && (
        <div
          className="zg-panel"
          style={{
            position: 'absolute',
            top: panesTop + 4,
            left: x(hover.ms) > AXIS_W + plotW / 2 ? AXIS_W + 8 : undefined,
            right: x(hover.ms) > AXIS_W + plotW / 2 ? undefined : TAG_W + 14,
            padding: '8px 10px',
            pointerEvents: 'none',
            fontFamily: MONO,
            fontSize: 11,
            fontVariantNumeric: 'tabular-nums',
            minWidth: compact ? 196 : 232,
            boxShadow: 'var(--shadow-pop)',
          }}
        >
          <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{ET_HM.format(new Date(hover.ms))} ET</div>
          {hoverCell && (
              <div style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: 'var(--text-primary)' }}>At {fmtStrike(hoverCell.strike)}</span>
                  <span style={{ color: hoverLean === 'even' ? 'var(--text-muted)' : LEAN_FILL[hoverLean] }}>{LEAN_WORDS[hoverLean]}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', columnGap: 10, marginTop: 2 }}>
                  <span />
                  <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>bought</span>
                  <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>sold</span>
                  <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>net</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Calls</span>
                  <span style={{ textAlign: 'right' }}>{fmtContracts(hoverCell.callsBought)}</span>
                  <span style={{ textAlign: 'right' }}>{fmtContracts(hoverCell.callsSold)}</span>
                  <span style={{ textAlign: 'right', color: hoverCallNet > 0 ? 'var(--color-bull)' : hoverCallNet < 0 ? 'var(--color-bear)' : undefined }}>
                    {fmtContracts(hoverCallNet, true)}
                  </span>
                  <span style={{ color: 'var(--text-secondary)' }}>Puts</span>
                  <span style={{ textAlign: 'right' }}>{fmtContracts(hoverCell.putsBought)}</span>
                  <span style={{ textAlign: 'right' }}>{fmtContracts(hoverCell.putsSold)}</span>
                  {/* Puts bought are the bearish side, so a positive put net reads red. */}
                  <span style={{ textAlign: 'right', color: hoverPutNet > 0 ? 'var(--color-bear)' : hoverPutNet < 0 ? 'var(--color-bull)' : undefined }}>
                    {fmtContracts(hoverPutNet, true)}
                  </span>
                </div>
                <Row
                  k="Dot: calls net − puts net"
                  v={fmtContracts(hoverCell.net, true)}
                  color={hoverCell.net > 0 ? 'var(--color-bull)' : hoverCell.net < 0 ? 'var(--color-bear)' : undefined}
                  top
                />
              </div>
          )}
          {hover.price != null && <Row k="Price" v={fmtLevel(hover.price)} />}
          <Row k="Net premium" v={fmtUsdCompact(hover.netPremium, true)} color={hover.netPremium >= 0 ? 'var(--color-bull)' : 'var(--color-bear)'} />
          <Row k="  calls" v={fmtUsdCompact(hover.callPremium, true)} muted />
          <Row k="  puts" v={fmtUsdCompact(hover.putPremium, true)} muted />
          <Row k="Net flow" v={fmtContracts(hover.netFlow, true)} color={hover.netFlow >= 0 ? 'var(--color-bull)' : 'var(--color-bear)'} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 10, marginTop: 4, paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ color: 'var(--text-muted)' }}>{hoverCell ? 'All strikes' : 'This bar'}</span>
            <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>bought</span>
            <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>sold</span>
            <span style={{ color: 'var(--text-secondary)' }}>Calls</span>
            <span style={{ textAlign: 'right' }}>{fmtContracts(hover.bar.callsBought)}</span>
            <span style={{ textAlign: 'right' }}>{fmtContracts(hover.bar.callsSold)}</span>
            <span style={{ color: 'var(--text-secondary)' }}>Puts</span>
            <span style={{ textAlign: 'right' }}>{fmtContracts(hover.bar.putsBought)}</span>
            <span style={{ textAlign: 'right' }}>{fmtContracts(hover.bar.putsSold)}</span>
          </div>
          {hover.putCallRatio != null && <Row k="Put/call" v={hover.putCallRatio.toFixed(2)} top />}
        </div>
      )}

      {/* The dot sizes: on the price pane's label line, beside the dots they
          size, so the toolbar above keeps its length at every width. */}
      {ribbonOn && priceBand && onStrikeSizing && (
        <div
          ref={sizesRef}
          style={{ position: 'absolute', left: AXIS_W + 1 + `PRICE · ${symbol}`.length * 6.3 + 6 + 4, top: priceBand.top + 1, zIndex: 3 }}
        >
          <button
            type="button"
            aria-expanded={sizesOpen}
            aria-haspopup="dialog"
            onClick={() => {
              if (sizesOpen) {
                setSizeDraft(null);
                return;
              }
              const start =
                strikeSizing.kind === 'contracts' ? strikeSizing : (autoSizeContracts(ribbonFull) ?? SIZE_FALLBACK);
              setSizeDraft({ small: String(start.small), medium: String(start.medium), large: String(start.large) });
            }}
            title="Set the dot sizes in net contracts, or leave them on Auto"
            style={{
              height: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 5px',
              border: 'none',
              cursor: 'pointer',
              background: 'color-mix(in srgb, var(--bg-card) 88%, transparent)',
              fontFamily: MONO,
              fontSize: 9,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
            }}
          >
            <span>Dot sizes</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              {strikeSizing.kind === 'contracts'
                ? [strikeSizing.small, strikeSizing.medium, strikeSizing.large].map((v) => fmtContracts(v)).join(' · ')
                : 'Auto'}
            </span>
          </button>
          {sizeDraft && (
            <form
              role="dialog"
              aria-label="Dot sizes"
              className="zg-panel"
              onSubmit={(e) => {
                e.preventDefault();
                const next = cleanSizing(Number(sizeDraft.small), Number(sizeDraft.medium), Number(sizeDraft.large));
                onStrikeSizing(next);
                setSizeDraft(null);
              }}
              style={{
                position: 'absolute',
                top: 18,
                left: 0,
                width: compact ? 214 : 236,
                padding: '10px 12px',
                boxShadow: 'var(--shadow-pop)',
                fontFamily: MONO,
                fontSize: 11,
                display: 'grid',
                gap: 6,
              }}
            >
              <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Dot sizes, in net contracts
              </div>
              {(
                [
                  ['small', 'Small from'],
                  ['medium', 'Medium from'],
                  ['large', 'Large from'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, color: 'var(--text-secondary)' }}>
                  {label}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={sizeDraft[key]}
                    onChange={(e) => setSizeDraft({ ...sizeDraft, [key]: e.target.value })}
                    style={{
                      width: 92,
                      padding: '3px 6px',
                      fontFamily: MONO,
                      fontSize: 12,
                      textAlign: 'right',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-control)',
                    }}
                  />
                </label>
              ))}
              <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                {/* The page's own toggle look: Apply as the pressed one. */}
                <button
                  type="submit"
                  className="zg-btn"
                  style={{
                    ...EDITOR_BTN,
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    background: 'color-mix(in srgb, var(--color-navy, var(--color-info)) 18%, transparent)',
                  }}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="zg-btn"
                  onClick={() => {
                    onStrikeSizing(AUTO_SIZING);
                    setSizeDraft(null);
                  }}
                  style={EDITOR_BTN}
                >
                  Auto
                </button>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 10, lineHeight: 1.45 }}>
                Your own sizes keep each minute&apos;s dot once it closes. Auto measures against the day&apos;s flow, so a dot can shrink as bigger flow arrives.
              </div>
            </form>
          )}
        </div>
      )}

      {/* Zoom: over the bottom left of the plot, the oldest corner of the
          lowest pane, out of the way of the newest bars and the readout. */}
      <div
        className="flex items-center gap-1.5"
        style={{ position: 'absolute', left: AXIS_W + 6, bottom: AXIS_H + 6, zIndex: 2 }}
      >
        <ZoomCluster
          large={compact}
          label="Time"
          onIn={() => zoomTimeBy(1 / ZOOM_STEP, null)}
          onOut={() => zoomTimeBy(ZOOM_STEP, null)}
          hint={compact ? undefined : 'Ctrl + scroll'}
        />
        {!compact && priceBandNow && (
          <ZoomCluster label="Price" onIn={() => zoomPriceBy(1 / ZOOM_STEP)} onOut={() => zoomPriceBy(ZOOM_STEP)} hint="Shift + scroll" />
        )}
        {customView && (
          <button
            type="button"
            onClick={resetZoom}
            title="Back to the whole session, with the price scale fitting itself again"
            style={{
              fontFamily: MONO,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              padding: compact ? '7px 11px' : '5px 11px',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid var(--color-accent-hot)',
              color: 'var(--color-accent-hot)',
              background: 'color-mix(in srgb, var(--color-accent-hot) 12%, transparent)',
              cursor: 'pointer',
            }}
          >
            ⟲ Reset
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, color, muted = false, top = false }: { k: string; v: string; color?: string; muted?: boolean; top?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: top ? 4 : 0 }}>
      <span style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)', whiteSpace: 'pre' }}>{k}</span>
      <span style={{ color: color ?? (muted ? 'var(--text-secondary)' : 'var(--text-primary)') }}>{v}</span>
    </div>
  );
}
