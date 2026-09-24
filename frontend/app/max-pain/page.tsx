"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApiData, useGEXSummary } from "@/hooks/useApiData";
import { useMarketHistorical } from "@/hooks/useMarketHistorical";
import MetricCard from "@/components/MetricCard";
import PageShell from "@/components/layout/PageShell";
import PageHeader from "@/components/layout/PageHeader";
import ChartPanel from "@/components/layout/ChartPanel";
import SectionHead from "@/components/layout/SectionHead";
import { FilterSelect } from "@/components/controls/Filters";
import ChartTooltipShell, { ChartTooltipRow, CHART_TOOLTIP_PROPS } from "@/components/ChartTooltipShell";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import RegimeSummaryBanner from "@/components/RegimeSummaryBanner";
import { useTimeframe } from "@/core/TimeframeContext";
import ChartTimeframeSelect, { type ChartTimeframe } from "@/components/ChartTimeframeSelect";
import { useTheme } from "@/core/ThemeContext";
import { etTodayDateKey, omitOutOfHoursForSymbol, shouldOmitClosedMarketTimes } from "@/core/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMeasuredWidth } from "@/components/useMeasuredWidth";

interface MaxPainPoint {
  settlement_price: number;
  call_notional: number;
  put_notional: number;
}

interface MaxPainExpiration {
  expiration: string;
  max_pain: number;
  strikes: MaxPainPoint[];
}

interface MaxPainCurrentResponse {
  timestamp: string;
  symbol: string;
  underlying_price: number;
  max_pain: number;
  expirations: MaxPainExpiration[];
}

interface MaxPainTimeRow {
  timestamp?: string;
  max_pain: number;
}

interface MarketHistoryRow {
  timestamp: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  price?: number;
}

function safeNum(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nearestCandle(ts: string, prices: MarketHistoryRow[], maxDeltaMs: number) {
  const target = new Date(ts).getTime();
  if (!Number.isFinite(target) || prices.length === 0) return null;

  let best: MarketHistoryRow | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (let i = 0; i < prices.length; i += 1) {
    const delta = Math.abs(new Date(prices[i].timestamp).getTime() - target);
    if (delta < bestDelta) {
      best = prices[i];
      bestDelta = delta;
    }
  }

  if (!best || bestDelta > maxDeltaMs) return null;

  const close = safeNum(best.close ?? best.price);
  const open = safeNum(best.open ?? close);
  const high = safeNum(best.high ?? Math.max(open, close));
  const low = safeNum(best.low ?? Math.min(open, close));

  return {
    open,
    high,
    low,
    close,
  };
}

const TIMEFRAME_DURATION_MS: Record<ChartTimeframe, number> = {
  "1min": 60_000,
  "5min": 5 * 60_000,
  "15min": 15 * 60_000,
  "1hr": 60 * 60_000,
  "1day": 24 * 60 * 60_000,
};

function svgPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

// Picks a round-number strike-axis step ($1/$2/$5/$10/$25/$50/$100/…) such
// that the visible range fits in roughly 10 labels. The OI bar chart's default
// categorical ticks land on whatever strikes happened to be in the data,
// which produces irregular labels like $584, $597, $612.
function getNiceStrikeStep(range: number, maxLabels = 10): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const presets = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  for (const p of presets) {
    if (range / p <= maxLabels) return p;
  }
  return presets[presets.length - 1];
}

// Strike labels a phone's ~280px axis holds without overprinting ("$630$640…").
const PHONE_STRIKE_LABELS = 5;
// The compact candle canvas keeps each bar at least this many px apart, so a
// phone shows the most recent bars that fit rather than 100 one-pixel candles.
const PHONE_MIN_BAR_PX = 5.5;
// The desktop candle board, in viewBox units.
const TS_BOARD_W = 1200;
const TS_BOARD_H = 444;

export default function MaxPainPage() {
  const { symbol, getMaxDataPoints } = useTimeframe();
  const { theme } = useTheme();
  const isMobile = useIsMobile();
  const maxPoints = getMaxDataPoints();
  // Over-fetch so symbols whose price data is only available during regular
  // hours (e.g., SPX) still have enough joined bars to fill the visible window
  // after `omitOutOfHoursForSymbol` and the candle-tolerance join. Capped at
  // 300 to match the API's `window_units` ceiling.
  const fetchUnits = Math.min(300, maxPoints * 3);
  const [selectedExpiration, setSelectedExpiration] = useState<string>("");
  const [timeseriesTimeframe, setTimeseriesTimeframe] = useState<ChartTimeframe>("5min");
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoverPx, setHoverPx] = useState<{ x: number; y: number } | null>(null);
  // The candle chart is a hand-drawn SVG: on a phone it draws a canvas as wide
  // as its card (1 unit = 1px, see GammaTerminalChart's compactCanvas) instead
  // of scaling the 1200-unit board into a 760px sideways scroller.
  const [tsMeasureRef, tsMeasuredWidth] = useMeasuredWidth<HTMLDivElement>();
  // Any card narrower than the 1200-unit board, and every card below lg: a
  // tablet's 600-990px card and a desktop one (~600px at 1024, ~950px at 1440)
  // scaled the board's labels to 5-9px.
  const tsCompactViewport = useIsMobile(1024);
  const tsCompact =
    tsMeasuredWidth != null && tsMeasuredWidth > 0 && (tsCompactViewport || tsMeasuredWidth < TS_BOARD_W);
  // Taps end in emulated mouse events (and a mouseleave); see onTsPointer*.
  const lastTouchAtRef = useRef(0);

  const { data: gexSummary } = useGEXSummary(symbol, 5000);

  const symParam = `symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`;
  const { data: maxPainCurrent, loading: oiLoading, error: oiError } = useApiData<MaxPainCurrentResponse>(
    `/api/max-pain/current?${symParam}&strike_limit=500`,
    { refreshInterval: 30000 },
  );

  const { data: maxPainSeries, loading: seriesLoading, error: seriesError } = useApiData<MaxPainTimeRow[]>(
    `/api/max-pain/timeseries?${symParam}&timeframe=${timeseriesTimeframe}&window_units=${fetchUnits}`,
    { refreshInterval: 10000 },
  );

  const { rows: priceSeriesAll } = useMarketHistorical(symbol, timeseriesTimeframe);
  const priceSeries: MarketHistoryRow[] = priceSeriesAll.slice(-fetchUnits);

  const currentMaxPain = safeNum(maxPainCurrent?.max_pain || gexSummary?.max_pain);
  const currentUnderlying = safeNum(maxPainCurrent?.underlying_price);
  // The snapshot endpoint can still carry yesterday's expirations for a
  // window post-close (the daily job leaves them in place until the next
  // session's row lands), but they're not useful to filter the chart by once
  // we've crossed midnight ET. YYYY-MM-DD lex compare matches calendar order
  // for the canonical zero-padded format the endpoint returns.
  const todayKey = etTodayDateKey();
  const expirationOptions = (maxPainCurrent?.expirations || []).filter(
    (e) => e.expiration >= todayKey,
  );
  // Reset the user's selection if the previously selected expiration has
  // since rolled into the past (page stayed open across midnight ET).
  if (selectedExpiration && selectedExpiration < todayKey) {
    setSelectedExpiration("");
  }
  const selectedExpirationValue = selectedExpiration || expirationOptions[0]?.expiration || "";
  const activeExpiration =
    expirationOptions.find((e) => e.expiration === selectedExpirationValue) || expirationOptions[0];

  const activeExpirationValue = activeExpiration?.expiration || "";
  const nearestExpirationMaxPain = safeNum(expirationOptions[0]?.max_pain);

  // Don't gate the whole page on the slowest endpoint — for SPX the
  // timeseries response often arrives well before /max-pain/current,
  // which used to leave the OI section flashing "No data available"
  // while the snapshot was still in flight. Each section below shows
  // its own loading state while its data is pending.

  const oiChart = ((activeExpiration?.strikes || []) as MaxPainPoint[])
    .map((row) => ({
      strike: safeNum(row.settlement_price),
      callNotionalM: safeNum(row.call_notional) / 1_000_000,
      putNotionalM: safeNum(row.put_notional) / 1_000_000,
    }))
    .filter((row) => row.strike > 0)
    .sort((a, b) => a.strike - b.strike);

  const oiStrikeStep = (() => {
    if (oiChart.length < 2) return 1;
    const minStrike = oiChart[0].strike;
    const maxStrike = oiChart[oiChart.length - 1].strike;
    return getNiceStrikeStep(maxStrike - minStrike, isMobile ? PHONE_STRIKE_LABELS : 10);
  })();
  // A phone hangs each reference label on the side of its line with room:
  // left of a line in the right half, right of one in the left half.
  const oiMidStrike = oiChart.length ? (oiChart[0].strike + oiChart[oiChart.length - 1].strike) / 2 : 0;
  const phoneRefLabelPosition = (strike: number) => (strike > oiMidStrike ? "insideTopRight" : "insideTopLeft");

  const underlyingStrikeMarker = oiChart.length
    ? oiChart.reduce((closest, row) =>
        Math.abs(row.strike - currentUnderlying) < Math.abs(closest - currentUnderlying)
          ? row.strike
          : closest,
      oiChart[0].strike)
    : currentUnderlying;

  // Stagger Max Pain and Spot labels vertically so they never collide,
  // regardless of how close the reference lines sit on the x-axis.
  const maxPainLabelDy = 4;
  const underlyingLabelDy = 26;

  // Daily bars are whole-session markers stamped at UTC midnight; the intraday
  // market-hours filter would drop them — every Monday for stocks, and (since
  // indexes are gated to RTH-only hours) every daily bar for SPX/NDX. Skip the
  // filter for daily; only intraday series need it. See shouldOmitClosedMarketTimes.
  const applyHoursFilter = shouldOmitClosedMarketTimes(TIMEFRAME_DURATION_MS[timeseriesTimeframe] / 60_000);
  const filteredMaxPainRows = applyHoursFilter
    ? omitOutOfHoursForSymbol(maxPainSeries || [], (row) => row.timestamp || "", symbol)
    : maxPainSeries || [];
  const filteredPriceRows = applyHoursFilter
    ? omitOutOfHoursForSymbol(priceSeries || [], (row) => row.timestamp, symbol)
    : priceSeries || [];

  const candleMatchToleranceMs = TIMEFRAME_DURATION_MS[timeseriesTimeframe] ?? 5 * 60_000;
  // Sort ascending by timestamp so the x-axis renders oldest → newest. The API
  // doesn't guarantee a chronological order, which used to produce a reversed
  // time axis when newer rows arrived first.
  const seriesChart = (filteredMaxPainRows
    .map((row) => {
      const ts = row.timestamp || "";
      const candle = nearestCandle(ts, filteredPriceRows, candleMatchToleranceMs);
      if (!candle) return null;
      return {
        timestamp: ts,
        time: new Date(ts).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        maxPain: safeNum(row.max_pain),
        ...candle,
      };
    })
    .filter(Boolean) as Array<{
    timestamp: string;
    time: string;
    maxPain: number;
    open: number;
    high: number;
    low: number;
    close: number;
  }>)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-maxPoints);

  const latest = seriesChart[seriesChart.length - 1];
  const impliedMove = currentMaxPain - currentUnderlying;
  const impliedMovePct = currentUnderlying > 0 ? (impliedMove / currentUnderlying) * 100 : 0;
  const maxPainTone: 'bullish' | 'bearish' | 'neutral' =
    Math.abs(impliedMovePct) <= 0.4 ? 'neutral' : impliedMove > 0 ? 'bullish' : 'bearish';
  const maxPainBadge = Math.abs(impliedMovePct) <= 0.4
    ? 'Pin Risk Elevated'
    : impliedMove > 0
      ? 'Upside Magnet'
      : 'Downside Magnet';
  const maxPainSummary = `Spot is ${impliedMove >= 0 ? 'below' : 'above'} max pain by ${Math.abs(impliedMove).toFixed(2)} points (${Math.abs(impliedMovePct).toFixed(2)}%). ${
    Math.abs(impliedMovePct) <= 0.4
      ? 'Price is already near the pin, so expect more mean-reversion behavior and faster failed breakouts.'
      : impliedMove > 0
        ? 'A higher pin suggests dealer hedging can nudge price upward into expirations if buyers stay engaged.'
        : 'A lower pin suggests gravity can remain to the downside into expiry, especially on failed bounces.'
  } Day and swing traders can use this as context: fade overextensions near the pin, but treat decisive breaks away from max pain as trend-confirmation signals.`;

  const textColor = 'var(--text-primary)';

  const tsWidth = tsCompact ? Math.max(260, Math.round(tsMeasuredWidth ?? 0)) : TS_BOARD_W;
  // 300 on a phone, growing with a wider card to the board's own proportions.
  const tsHeight = tsCompact ? Math.min(TS_BOARD_H, Math.max(300, Math.round(tsWidth * (TS_BOARD_H / TS_BOARD_W)))) : TS_BOARD_H;
  const padLeft = tsCompact ? 44 : 70;
  const padRight = tsCompact ? 8 : 25;
  const padTop = 24;
  const padBottom = tsCompact ? 44 : 64;
  const timeLabelY = tsHeight - (tsCompact ? 26 : 36);
  const dateLabelY = tsHeight - (tsCompact ? 8 : 14);
  // The bars the canvas draws: all of them on desktop; on a phone the most
  // recent that fit at PHONE_MIN_BAR_PX apiece.
  const chartRows = tsCompact
    ? seriesChart.slice(-Math.max(12, Math.floor((tsWidth - padLeft - padRight) / PHONE_MIN_BAR_PX)))
    : seriesChart;

  const priceValues = chartRows.flatMap((r) => [r.low, r.high, r.maxPain]).filter((n) => Number.isFinite(n));
  const minPrice = priceValues.length ? Math.min(...priceValues) : 0;
  const maxPrice = priceValues.length ? Math.max(...priceValues) : 1;
  const y = (v: number) =>
    padTop + (1 - (v - minPrice) / Math.max(1e-9, maxPrice - minPrice)) * (tsHeight - padTop - padBottom);
  const xStep = (tsWidth - padLeft - padRight) / Math.max(1, chartRows.length - 1);
  const candleWidth = Math.max(4, Math.min(10, xStep * 0.45));

  const priceRange = maxPrice - minPrice;
  const rawStep = priceRange / 5;
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 1e-9))));
  const norm = rawStep / mag;
  const niceStep = norm < 1.5 ? mag : norm < 3 ? 2 * mag : norm < 7 ? 5 * mag : 10 * mag;
  const yTicks: number[] = [];
  for (let v = Math.ceil(minPrice / niceStep) * niceStep; v <= maxPrice + 1e-9; v += niceStep) {
    yTicks.push(Math.round(v / niceStep) * niceStep);
  }

  const maxPainPath = svgPath(
    chartRows.map((r, i) => ({
      x: padLeft + i * xStep,
      y: y(r.maxPain),
    })),
  );

  const dateMarkers: Array<{ index: number; label: string; key: string }> = [];
  let prevDateKey = "";
  chartRows.forEach((row, index) => {
    const dt = new Date(row.timestamp);
    if (Number.isNaN(dt.getTime())) return;
    const dateKey = dt.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    if (dateKey === prevDateKey) return;
    prevDateKey = dateKey;
    dateMarkers.push({
      index,
      key: row.timestamp,
      label: dt.toLocaleDateString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
      }),
    });
  });

  const labeledDateMarkerKeys = new Set<string>();
  if (dateMarkers.length > 0) {
    const minGap = isMobile ? 80 : 52;
    let lastLabeledX = Number.NEGATIVE_INFINITY;
    dateMarkers.forEach((marker) => {
      const x = padLeft + marker.index * xStep;
      if (x - lastLabeledX < minGap) return;
      labeledDateMarkerKeys.add(marker.key);
      lastLabeledX = x;
    });
  }

  const fallbackIdx = Math.max(0, chartRows.length - 1);
  const resolvedIdx = hoveredIdx !== null ? Math.max(0, Math.min(fallbackIdx, hoveredIdx)) : fallbackIdx;
  const hoveredRow = chartRows[resolvedIdx] ?? null;

  const hoverAtClient = (svg: SVGSVGElement, clientX: number, clientY: number) => {
    if (chartRows.length === 0) return;
    const rect = svg.getBoundingClientRect();
    // Convert the cursor's screen coords back into viewBox coords using the
    // SVG's current transformation matrix so the bar-index math accounts for
    // any preserveAspectRatio letterboxing on wide screens. Falling back to
    // proportional scaling keeps the handler usable if getScreenCTM is
    // unavailable.
    const ctm = svg.getScreenCTM();
    let xView: number;
    if (ctm) {
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const local = pt.matrixTransform(ctm.inverse());
      xView = local.x;
    } else {
      xView = ((clientX - rect.left) / Math.max(1, rect.width)) * tsWidth;
    }
    const idx = Math.round((xView - padLeft) / Math.max(1e-9, xStep));
    const clampedIdx = Math.max(0, Math.min(chartRows.length - 1, idx));
    setHoveredIdx(clampedIdx);
    // Anchor the tooltip horizontally to the matched candle's screen position
    // — using the inverse of the same CTM — so the tooltip lines up with the
    // crosshair and the bar instead of sliding off to the side when the
    // cursor lands between two candles.
    const targetViewX = padLeft + clampedIdx * xStep;
    let tooltipX = ((clientX - rect.left) / Math.max(1, rect.width)) * tsWidth;
    if (ctm) {
      const candlePt = svg.createSVGPoint();
      candlePt.x = targetViewX;
      candlePt.y = 0;
      const screenPt = candlePt.matrixTransform(ctm);
      tooltipX = screenPt.x - rect.left;
    } else {
      tooltipX = (targetViewX / Math.max(1e-9, tsWidth)) * rect.width;
    }
    setHoverPx({
      x: tooltipX,
      y: clientY - rect.top,
    });
  };

  // ── Touch ── a finger has no hover. The canvas claims only horizontal
  // gestures (touch-action: pan-y) so a vertical swipe still scrolls the page;
  // a tap drops the readout on a candle, a horizontal drag scrubs it, and a
  // tap on a chart already showing one puts it away. Mouse input is unchanged.
  const tsTouchRef = useRef<{ startX: number; moved: boolean; had: boolean } | null>(null);
  const onTsPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch") return;
    lastTouchAtRef.current = Date.now();
    tsTouchRef.current = { startX: e.clientX, moved: false, had: hoveredIdx !== null };
  };
  const onTsPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType !== "touch") {
      if (Date.now() - lastTouchAtRef.current < 800) return;
      hoverAtClient(e.currentTarget, e.clientX, e.clientY);
      return;
    }
    const t = tsTouchRef.current;
    if (!t) return;
    lastTouchAtRef.current = Date.now();
    if (!t.moved && Math.abs(e.clientX - t.startX) < 6) return;
    t.moved = true;
    hoverAtClient(e.currentTarget, e.clientX, e.clientY);
  };
  const onTsPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const t = tsTouchRef.current;
    tsTouchRef.current = null;
    if (e.pointerType !== "touch" || !t || t.moved || e.type === "pointercancel") return;
    lastTouchAtRef.current = Date.now();
    if (t.had) {
      setHoveredIdx(null);
      setHoverPx(null);
    } else {
      hoverAtClient(e.currentTarget, e.clientX, e.clientY);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Max Pain"
        sub="The strike where the most option value expires worthless, and how far price sits from it."
        tooltip="Pool every listed contract into one payout curve and find the strike at which option holders collectively lose the most — that is max pain. It is a magnet, not a mechanism: open interest only changes at settlement, so the whole-chain figure is recomputed once a day pre-market and stays flat intraday. It tends to matter most into expiration, when the contracts pinned to it are the ones still alive, and least on a day when a catalyst supplies flow that dwarfs hedging. The nearest-expiration figure can sit a few points from the whole-chain one because it covers a single expiry rather than the pooled book."
      />
      <RegimeSummaryBanner
        title="Max Pain Regime"
        badge={maxPainBadge}
        tone={maxPainTone}
        summary={maxPainSummary}
      />

      <section className="mb-8">
        <SectionHead title="Max Pain Snapshot" tooltip="Current max pain context combining summary and intraday series." />
        {/* Phone: the headline figure (with its implied-move chip) across the
            row, the two single numbers paired under it. */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="col-span-2 md:col-span-1">
          <MetricCard
            title="Current Max Pain (All Expirations)"
            value={currentMaxPain ? `$${currentMaxPain.toFixed(2)}` : "--"}
            tooltip="Whole-chain max pain: the single strike where the most option value across ALL listed expirations would expire worthless, pooled into one payout curve. Open interest only changes at settlement, so this is recomputed once a day (pre-market). It's the authoritative value and is what drives the Implied Move below."
            theme={theme}
            contextBadge={
              <span
                className="zg-chip"
                style={{ '--chip-color': impliedMove >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' } as CSSProperties}
                title="Implied move = Max Pain - Current Underlying"
              >
                {impliedMove >= 0 ? <TrendingUp size={11} strokeWidth={2.5} /> : <TrendingDown size={11} strokeWidth={2.5} />}
                {impliedMove >= 0 ? "+" : ""}{impliedMove.toFixed(2)} ({impliedMove >= 0 ? "+" : ""}{impliedMovePct.toFixed(2)}%)
              </span>
            }
          />
          </div>
          <MetricCard title="Nearest-Expiration Max Pain" value={nearestExpirationMaxPain ? `$${nearestExpirationMaxPain.toFixed(2)}` : "--"} tooltip="Max pain for only the nearest non-expired expiration (often a daily or weekly contract) — the same value shown on the dashed Max Pain line in the chart below when its dropdown is set to that expiration. Because it covers a single expiration, it can sit a few points apart from the whole-chain Current Max Pain above, and it stays flat intraday since open interest only changes at settlement." theme={theme} />
          <MetricCard
            title="Underlying Price"
            value={latest?.close ? `$${latest.close.toFixed(2)}` : "--"}
            trend={latest?.close && currentMaxPain ? (latest.close > currentMaxPain ? "bullish" : "bearish") : "neutral"}
            tooltip="Latest underlying close mapped from /api/market/historical."
            theme={theme}
          />
        </div>
      </section>

      <ChartPanel
        className="mb-8"
        title="Notional Open Interest by Strike"
        tooltip="Call and put notional at each listed strike for the selected expiration, with max pain and spot marked. The bars are where the money actually sits; max pain is where those two stacks balance."
        actions={
          expirationOptions.length > 0 ? (
            <FilterSelect
              label="Expiration"
              value={activeExpirationValue}
              onChange={setSelectedExpiration}
              options={expirationOptions.map((exp) => ({
                value: exp.expiration,
                label: exp.expiration,
              }))}
            />
          ) : undefined
        }
      >

        {oiError ? (
          <ErrorMessage message={`Error loading data: ${oiError}`} />
        ) : oiLoading && !maxPainCurrent ? (
          <div className="py-8"><LoadingSpinner /></div>
        ) : oiChart.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>No max pain OI data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={isMobile ? 300 : 380}>
            {/* Phone: 14px on the right so the last strike label ("$700") is not
                cut in half, and no per-strike vertical grid — at 2px a strike
                it drew as solid hatching behind the bars. */}
            <BarChart data={oiChart} margin={isMobile ? { top: 10, right: 14, left: 0, bottom: 5 } : { top: 10, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={'var(--text-secondary)'} opacity={0.3} vertical={!isMobile} />
              <XAxis
                dataKey="strike"
                stroke={textColor}
                interval={0}
                tick={(props: { x?: number | string; y?: number | string; payload?: { value?: string | number } }) => {
                  const x = Number(props?.x ?? 0);
                  const y = Number(props?.y ?? 0);
                  const val = Number(props?.payload?.value ?? 0);
                  const r = val - Math.round(val / oiStrikeStep) * oiStrikeStep;
                  if (Math.abs(r) > 1e-6) return <g transform={`translate(${x},${y})`} />;
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <line x1={0} y1={0} x2={0} y2={5} stroke={textColor} strokeWidth={1} opacity={0.6} />
                      <text x={0} y={0} dy={16} textAnchor="middle" fontSize={isMobile ? 10 : 11} fill={textColor}>
                        {`$${val.toFixed(0)}`}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis
                stroke={textColor}
                // Phone: 10px ticks in a 40px gutter, "$450M" rather than
                // "450.0M" (the default 60px axis at ~14px type was a fifth of
                // the card).
                {...(isMobile ? { width: 40, tick: { fontSize: 10, fill: textColor } } : {})}
                tickFormatter={(v) => (isMobile ? `${Number(v) >= 10 ? Math.round(Number(v)) : Number(v).toFixed(1)}M` : `${Number(v).toFixed(1)}M`)}
                domain={["auto", "auto"]}
              />
              <Tooltip
                {...CHART_TOOLTIP_PROPS}
                {...(isMobile ? { position: { y: 0 } } : {})}
                formatter={(value) => `$${Number(value ?? 0).toFixed(2)}M`}
              />
              <Legend {...(isMobile ? { wrapperStyle: { fontSize: 11 } } : {})} />
              <ReferenceLine
                ifOverflow="extendDomain"
                x={safeNum(activeExpiration?.max_pain || currentMaxPain)}
                stroke={'var(--color-brand-primary)'}
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{
                  value: `Max Pain $${safeNum(activeExpiration?.max_pain || currentMaxPain).toFixed(2)}`,
                  fill: textColor,
                  position: isMobile ? phoneRefLabelPosition(safeNum(activeExpiration?.max_pain || currentMaxPain)) : "insideTopLeft",
                  dy: maxPainLabelDy,
                  ...(isMobile ? { fontSize: 11 } : {}),
                }}
              />
              <ReferenceLine
                ifOverflow="extendDomain"
                x={underlyingStrikeMarker}
                stroke={"var(--color-brand-accent)"}
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{
                  value: `Spot $${currentUnderlying.toFixed(2)}`,
                  fill: textColor,
                  position: isMobile ? phoneRefLabelPosition(underlyingStrikeMarker) : "insideTopLeft",
                  dy: underlyingLabelDy,
                  ...(isMobile ? { fontSize: 11 } : {}),
                }}
              />
              <Bar dataKey="callNotionalM" name="Call Notional" fill={'var(--color-bull)'} />
              <Bar dataKey="putNotionalM" name="Put Notional" fill={'var(--color-bear)'} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartPanel>

      <ChartPanel
        className="mb-8"
        title="Max Pain vs Underlying Price"
        tooltip="Max pain (line) against the underlying's own candles, so you can see whether price is being drawn toward the level or simply passing through it. Max pain steps rather than drifts — it only moves when open interest is rewritten at settlement."
        actions={
          <ChartTimeframeSelect
            value={timeseriesTimeframe}
            onChange={setTimeseriesTimeframe}
            className="mb-0"
          />
        }
      >
        {seriesError ? (
          <ErrorMessage message={seriesError} />
        ) : seriesLoading && !maxPainSeries ? (
          <div className="py-8"><LoadingSpinner /></div>
        ) : seriesChart.length === 0 ? (
          <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>No max pain timeseries data available</div>
        ) : (
          <div className="relative overflow-x-auto" ref={tsMeasureRef}>
          <svg
            width="100%"
            height={tsHeight}
            viewBox={`0 0 ${tsWidth} ${tsHeight}`}
            // Unmeasured, a phone would see the 1200-unit board for a frame.
            className={tsCompact ? undefined : tsMeasuredWidth == null ? "min-w-[760px] md:min-w-0 invisible" : "min-w-[760px] md:min-w-0"}
            style={tsCompact ? { display: "block", touchAction: "pan-y", userSelect: "none", WebkitTouchCallout: "none" } : undefined}
            onPointerDown={onTsPointerDown}
            onPointerMove={onTsPointerMove}
            onPointerUp={onTsPointerUp}
            onPointerCancel={onTsPointerUp}
            onMouseLeave={() => {
              if (Date.now() - lastTouchAtRef.current < 800) return;
              setHoveredIdx(null);
              setHoverPx(null);
            }}
          >
            {yTicks.map((val) => {
              const yPos = y(val);
              const label = niceStep >= 1 ? `$${Math.round(val)}` : `$${val.toFixed(2)}`;
              return (
                <g key={val}>
                  <line x1={padLeft} x2={tsWidth - padRight} y1={yPos} y2={yPos} stroke={'var(--text-secondary)'} opacity={0.25} />
                  <text x={padLeft - (tsCompact ? 5 : 8)} y={yPos + 4} textAnchor="end" fontSize="10" fill={textColor}>{label}</text>
                </g>
              );
            })}

            <path d={maxPainPath} fill="none" stroke={'var(--color-brand-primary)'} strokeWidth={2.5} />

            {chartRows.map((r, i) => {
              const x = padLeft + i * xStep;
              const up = r.close >= r.open;
              const c = up ? 'var(--color-bull)' : 'var(--color-bear)';
              const openY = y(r.open);
              const closeY = y(r.close);
              const highY = y(r.high);
              const lowY = y(r.low);
              const bodyY = Math.min(openY, closeY);
              const bodyBottom = Math.max(openY, closeY);
              const bodyH = Math.max(1, bodyBottom - bodyY);
              return (
                <g key={r.timestamp}>
                  <line x1={x} x2={x} y1={highY} y2={bodyY} stroke={c} strokeWidth={1.2} />
                  <line x1={x} x2={x} y1={bodyBottom} y2={lowY} stroke={c} strokeWidth={1.2} />
                  <rect x={x - candleWidth / 2} y={bodyY} width={candleWidth} height={bodyH} fill={up ? "transparent" : c} stroke={c} strokeWidth={1.2} />
                </g>
              );
            })}

            {chartRows.map((r, i) => {
              const spacing = xStep < 12 ? 10 : xStep < 18 ? 6 : 4;
              if (i % spacing !== 0) return null;
              return (
                <text key={`t-${r.timestamp}`} x={padLeft + i * xStep} y={timeLabelY} textAnchor="middle" fontSize="10" fill={textColor}>
                  {r.time}
                </text>
              );
            })}

            {dateMarkers.map((marker) => {
              const x = padLeft + marker.index * xStep;
              const showLabel = labeledDateMarkerKeys.has(marker.key);
              return (
                <g key={`date-marker-${marker.key}`}>
                  <line x1={x} x2={x} y1={padTop} y2={tsHeight - padBottom} stroke={'var(--text-secondary)'} opacity={0.22} />
                  {showLabel ? (
                    <text x={x + 4} y={dateLabelY} fontSize="10" textAnchor="start" fill={'var(--text-secondary)'}>
                      {marker.label}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {hoveredIdx !== null && hoveredRow ? (
              <line
                x1={padLeft + resolvedIdx * xStep}
                x2={padLeft + resolvedIdx * xStep}
                y1={padTop}
                y2={tsHeight - padBottom}
                stroke={'var(--text-secondary)'}
                opacity={0.5}
                strokeDasharray="3,3"
                pointerEvents="none"
              />
            ) : null}

            <rect x={padLeft} y={8} width="10" height="2" fill={'var(--color-brand-primary)'} />
            <text x={padLeft + 16} y={12} fill={textColor} fontSize="11">Max Pain</text>
          </svg>
          {hoveredRow && hoverPx && tsCompact ? (
            // Phone: pinned to the top corner away from the finger, the OHLC
            // split over two lines — the desktop one-liner is ~300px wide.
            <ChartTooltipShell
              className="absolute z-10 pointer-events-none"
              style={{
                top: 4,
                ...(hoverPx.x > tsWidth / 2 ? { left: padLeft + 4 } : { right: padRight + 4 }),
                minWidth: 150,
              }}
              label={`${new Date(hoveredRow.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/New_York" })} ET`}
            >
              <ChartTooltipRow label="Open / High" value={`${hoveredRow.open.toFixed(2)} / ${hoveredRow.high.toFixed(2)}`} />
              <ChartTooltipRow label="Low / Close" value={`${hoveredRow.low.toFixed(2)} / ${hoveredRow.close.toFixed(2)}`} />
              <ChartTooltipRow label="Max Pain" value={hoveredRow.maxPain.toFixed(2)} swatch="var(--color-brand-primary)" />
            </ChartTooltipShell>
          ) : hoveredRow && hoverPx ? (
            <ChartTooltipShell
              className="absolute z-10 pointer-events-none whitespace-nowrap"
              style={{
                left: `min(calc(100% - 240px), ${hoverPx.x + 16}px)`,
                top: Math.max(8, hoverPx.y - 12),
              }}
              label={new Date(hoveredRow.timestamp).toLocaleString()}
            >
              <ChartTooltipRow
                label="O / H / L / C"
                value={`${hoveredRow.open.toFixed(2)} / ${hoveredRow.high.toFixed(2)} / ${hoveredRow.low.toFixed(2)} / ${hoveredRow.close.toFixed(2)}`}
              />
              <ChartTooltipRow
                label="Max Pain"
                value={hoveredRow.maxPain.toFixed(2)}
                swatch="var(--color-brand-primary)"
              />
            </ChartTooltipShell>
          ) : null}
          </div>
        )}
      </ChartPanel>
    </PageShell>
  );
}
