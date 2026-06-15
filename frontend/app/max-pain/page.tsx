"use client";

import { Info, TrendingDown, TrendingUp } from "lucide-react";
import { useState, type MouseEvent } from "react";
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
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import TooltipWrapper from "@/components/TooltipWrapper";
import RegimeSummaryBanner from "@/components/RegimeSummaryBanner";
import { useTimeframe } from "@/core/TimeframeContext";
import ChartTimeframeSelect, { type ChartTimeframe } from "@/components/ChartTimeframeSelect";
import { useTheme } from "@/core/ThemeContext";
import { colors } from "@/core/colors";
import { omitOutOfHoursForSymbol } from "@/core/utils";
import MobileScrollableChart from "@/components/MobileScrollableChart";
import { useIsMobile } from "@/hooks/useIsMobile";

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

function SectionTitle({ title, tooltip }: { title: string; tooltip: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <h2 className="text-2xl font-semibold">{title}</h2>
      <TooltipWrapper text={tooltip}>
        <Info size={14} />
      </TooltipWrapper>
    </div>
  );
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
function getNiceStrikeStep(range: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const presets = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
  for (const p of presets) {
    if (range / p <= 10) return p;
  }
  return presets[presets.length - 1];
}

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
  const expirationOptions = maxPainCurrent?.expirations || [];
  const selectedExpirationValue = selectedExpiration || expirationOptions[0]?.expiration || "";
  const activeExpiration =
    expirationOptions.find((e) => e.expiration === selectedExpirationValue) || expirationOptions[0];

  const activeExpirationValue = activeExpiration?.expiration || "";

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
    return getNiceStrikeStep(maxStrike - minStrike);
  })();

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

  const filteredMaxPainRows = omitOutOfHoursForSymbol(maxPainSeries || [], (row) => row.timestamp || "", symbol);
  const filteredPriceRows = omitOutOfHoursForSymbol(priceSeries || [], (row) => row.timestamp, symbol);

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

  const textColor = theme === "dark" ? colors.light : colors.dark;
  const panelBg = theme === "dark" ? colors.cardDark : colors.cardLight;

  const tsWidth = 1200;
  const tsHeight = 444;
  const padLeft = 70;
  const padRight = 25;
  const padTop = 24;
  const padBottom = 64;
  const timeLabelY = tsHeight - 36;
  const dateLabelY = tsHeight - 14;

  const priceValues = seriesChart.flatMap((r) => [r.low, r.high, r.maxPain]).filter((n) => Number.isFinite(n));
  const minPrice = priceValues.length ? Math.min(...priceValues) : 0;
  const maxPrice = priceValues.length ? Math.max(...priceValues) : 1;
  const y = (v: number) =>
    padTop + (1 - (v - minPrice) / Math.max(1e-9, maxPrice - minPrice)) * (tsHeight - padTop - padBottom);
  const xStep = (tsWidth - padLeft - padRight) / Math.max(1, seriesChart.length - 1);
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
    seriesChart.map((r, i) => ({
      x: padLeft + i * xStep,
      y: y(r.maxPain),
    })),
  );

  const dateMarkers: Array<{ index: number; label: string; key: string }> = [];
  let prevDateKey = "";
  seriesChart.forEach((row, index) => {
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

  const fallbackIdx = Math.max(0, seriesChart.length - 1);
  const resolvedIdx = hoveredIdx !== null ? Math.max(0, Math.min(fallbackIdx, hoveredIdx)) : fallbackIdx;
  const hoveredRow = seriesChart[resolvedIdx] ?? null;

  const handleChartMouseMove = (event: MouseEvent<SVGSVGElement>) => {
    if (seriesChart.length === 0) return;
    const svg = event.currentTarget;
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
      pt.x = event.clientX;
      pt.y = event.clientY;
      const local = pt.matrixTransform(ctm.inverse());
      xView = local.x;
    } else {
      xView = ((event.clientX - rect.left) / Math.max(1, rect.width)) * tsWidth;
    }
    const idx = Math.round((xView - padLeft) / Math.max(1e-9, xStep));
    const clampedIdx = Math.max(0, Math.min(seriesChart.length - 1, idx));
    setHoveredIdx(clampedIdx);
    // Anchor the tooltip horizontally to the matched candle's screen position
    // — using the inverse of the same CTM — so the tooltip lines up with the
    // crosshair and the bar instead of sliding off to the side when the
    // cursor lands between two candles.
    const targetViewX = padLeft + clampedIdx * xStep;
    let tooltipX = ((event.clientX - rect.left) / Math.max(1, rect.width)) * tsWidth;
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
      y: event.clientY - rect.top,
    });
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Max Pain</h1>
      <RegimeSummaryBanner
        title="Max Pain Regime"
        badge={maxPainBadge}
        tone={maxPainTone}
        summary={maxPainSummary}
      />

      <section className="mb-8">
        <SectionTitle title="Max Pain Snapshot" tooltip="Current max pain context combining summary and intraday series." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg p-4 border" style={{ backgroundColor: panelBg, borderColor: colors.muted }}>
            <div className="text-xs mb-1 flex items-center gap-1" style={{ color: colors.muted }}>
              Current Max Pain (All Expirations)
              <TooltipWrapper text="Whole-chain max pain: the single strike where the most option value across ALL listed expirations would expire worthless, pooled into one payout curve. Open interest only changes at settlement, so this is recomputed once a day (pre-market). It's the authoritative value and is what drives the Implied Move below.">
                <Info size={12} />
              </TooltipWrapper>
            </div>
            <div className="text-2xl font-bold" style={{ color: textColor }}>{currentMaxPain ? `$${currentMaxPain.toFixed(2)}` : "--"}</div>
            <div
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg font-semibold text-xs w-fit mt-2"
              style={{
                backgroundColor:
                  theme === "dark"
                    ? `${impliedMove >= 0 ? colors.bullish : colors.bearish}15`
                    : `${impliedMove >= 0 ? colors.bullish : colors.bearish}10`,
                color: impliedMove >= 0 ? colors.bullish : colors.bearish,
              }}
              title="Implied move = Max Pain - Current Underlying"
            >
              <span>Implied Move:</span>
              {impliedMove >= 0 ? <TrendingUp size={12} strokeWidth={2.5} /> : <TrendingDown size={12} strokeWidth={2.5} />}
              {impliedMove >= 0 ? "+" : ""}{impliedMove.toFixed(2)} ({impliedMove >= 0 ? "+" : ""}{impliedMovePct.toFixed(2)}%)
            </div>
          </div>
          <MetricCard title="Nearest-Expiration Max Pain" value={latest?.maxPain ? `$${latest.maxPain.toFixed(2)}` : "--"} tooltip="Nearest-expiration max pain: the latest point on the trend chart below, computed from only the nearest non-expired expiration (often a daily or weekly contract) and sampled through the day. Because it covers a single expiration — unlike the whole-chain Current Max Pain above — the two can sit a few points apart, and it stays roughly flat intraday since open interest only changes at settlement." theme={theme} />
          <MetricCard
            title="Underlying Price"
            value={latest?.close ? `$${latest.close.toFixed(2)}` : "--"}
            trend={latest?.close && currentMaxPain ? (latest.close > currentMaxPain ? "bullish" : "bearish") : "neutral"}
            tooltip="Latest underlying close mapped from /api/market/historical."
            theme={theme}
          />
        </div>
      </section>

      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: panelBg }}>
        <SectionTitle title="Notional Open Interest by Strike" tooltip="Select expiration and view call/put notional by strike with max pain and underlying reference lines." />

        {expirationOptions.length > 0 ? (
          <div className="mb-4">
            <label className="mr-3" style={{ color: textColor }}>Expiration:</label>
            <select
              value={activeExpirationValue}
              onChange={(e) => setSelectedExpiration(e.target.value)}
              className="px-3 py-2 rounded border"
              style={{ backgroundColor: panelBg, borderColor: colors.muted, color: textColor }}
            >
              {expirationOptions.map((exp) => (
                <option key={exp.expiration} value={exp.expiration}>{exp.expiration}</option>
              ))}
            </select>
          </div>
        ) : null}

        {oiError ? (
          <ErrorMessage message={`Error loading data: ${oiError}`} />
        ) : oiLoading && !maxPainCurrent ? (
          <div className="py-8"><LoadingSpinner /></div>
        ) : oiChart.length === 0 ? (
          <div className="text-center py-8" style={{ color: colors.muted }}>No max pain OI data available</div>
        ) : (
          <MobileScrollableChart>
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={oiChart} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.3} />
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
                      <text x={0} y={0} dy={16} textAnchor="middle" fontSize={11} fill={textColor}>
                        {`$${val.toFixed(0)}`}
                      </text>
                    </g>
                  );
                }}
              />
              <YAxis stroke={textColor} tickFormatter={(v) => `${Number(v).toFixed(1)}M`} domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', borderRadius: 8, color: 'var(--color-chart-tooltip-text)' }}
                labelStyle={{ color: 'var(--color-chart-tooltip-text)' }}
                itemStyle={{ color: 'var(--color-chart-tooltip-muted)' }}
                formatter={(value) => `$${Number(value ?? 0).toFixed(2)}M`}
              />
              <Legend />
              <ReferenceLine
                ifOverflow="extendDomain"
                x={safeNum(activeExpiration?.max_pain || currentMaxPain)}
                stroke={colors.primary}
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{
                  value: `Max Pain $${safeNum(activeExpiration?.max_pain || currentMaxPain).toFixed(2)}`,
                  fill: textColor,
                  position: "insideTopLeft",
                  dy: maxPainLabelDy,
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
                  position: "insideTopLeft",
                  dy: underlyingLabelDy,
                }}
              />
              <Bar dataKey="callNotionalM" name="Call Notional" fill={colors.bullish} />
              <Bar dataKey="putNotionalM" name="Put Notional" fill={colors.bearish} />
            </BarChart>
          </ResponsiveContainer>
          </MobileScrollableChart>
        )}
      </section>

      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: panelBg }}>
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <SectionTitle title="Max Pain vs Underlying Price" tooltip="Timeseries of max pain (line) overlaid with underlying candlesticks." />
          <div className="flex items-center gap-3 flex-wrap">
            <ChartTimeframeSelect value={timeseriesTimeframe} onChange={setTimeseriesTimeframe} className="mb-0" />
          </div>
        </div>
        {seriesError ? (
          <ErrorMessage message={seriesError} />
        ) : seriesLoading && !maxPainSeries ? (
          <div className="py-8"><LoadingSpinner /></div>
        ) : seriesChart.length === 0 ? (
          <div className="text-center py-8" style={{ color: colors.muted }}>No max pain timeseries data available</div>
        ) : (
          <div className="relative overflow-x-auto">
          <svg width="100%" height={tsHeight} viewBox={`0 0 ${tsWidth} ${tsHeight}`} className="min-w-[760px] md:min-w-0" onMouseMove={handleChartMouseMove} onMouseLeave={() => { setHoveredIdx(null); setHoverPx(null); }}>
            {yTicks.map((val) => {
              const yPos = y(val);
              const label = niceStep >= 1 ? `$${Math.round(val)}` : `$${val.toFixed(2)}`;
              return (
                <g key={val}>
                  <line x1={padLeft} x2={tsWidth - padRight} y1={yPos} y2={yPos} stroke={colors.muted} opacity={0.25} />
                  <text x={padLeft - 8} y={yPos + 4} textAnchor="end" fontSize="10" fill={textColor}>{label}</text>
                </g>
              );
            })}

            <path d={maxPainPath} fill="none" stroke={colors.primary} strokeWidth={2.5} />

            {seriesChart.map((r, i) => {
              const x = padLeft + i * xStep;
              const up = r.close >= r.open;
              const c = up ? colors.bullish : colors.bearish;
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

            {seriesChart.map((r, i) => {
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
                  <line x1={x} x2={x} y1={padTop} y2={tsHeight - padBottom} stroke={colors.muted} opacity={0.22} />
                  {showLabel ? (
                    <text x={x + 4} y={dateLabelY} fontSize="10" textAnchor="start" fill={colors.muted}>
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
                stroke={colors.muted}
                opacity={0.5}
                strokeDasharray="3,3"
                pointerEvents="none"
              />
            ) : null}

            <rect x={padLeft} y={8} width="10" height="2" fill={colors.primary} />
            <text x={padLeft + 16} y={12} fill={textColor} fontSize="11">Max Pain</text>
          </svg>
          {hoveredRow && hoverPx ? (
            <div
              className="absolute z-10 text-xs rounded-lg px-3 py-2 font-mono pointer-events-none whitespace-nowrap"
              style={{
                left: `min(calc(100% - 240px), ${hoverPx.x + 16}px)`,
                top: Math.max(8, hoverPx.y - 12),
                backgroundColor: 'var(--color-chart-tooltip-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-chart-tooltip-text)',
                boxShadow: '0 8px 24px var(--color-info-soft)',
              }}
            >
              <div>{new Date(hoveredRow.timestamp).toLocaleString()}</div>
              <div>O: {hoveredRow.open.toFixed(2)} H: {hoveredRow.high.toFixed(2)} L: {hoveredRow.low.toFixed(2)} C: {hoveredRow.close.toFixed(2)}</div>
              <div>Max Pain: {hoveredRow.maxPain.toFixed(2)}</div>
            </div>
          ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
