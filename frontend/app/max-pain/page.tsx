"use client";

import { Info, TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
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
import MetricCard from "@/components/MetricCard";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import TooltipWrapper from "@/components/TooltipWrapper";
import { useTimeframe } from "@/core/TimeframeContext";
import ChartTimeframeSelect, { type ChartTimeframe } from "@/components/ChartTimeframeSelect";
import { useTheme } from "@/core/ThemeContext";
import { colors } from "@/core/colors";
import { omitClosedMarketTimes } from "@/core/utils";

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

function nearestCandle(ts: string, prices: MarketHistoryRow[]) {
  const target = new Date(ts).getTime();
  if (!Number.isFinite(target) || prices.length === 0) return null;

  let best = prices[0];
  let bestDelta = Math.abs(new Date(best.timestamp).getTime() - target);

  for (let i = 1; i < prices.length; i += 1) {
    const delta = Math.abs(new Date(prices[i].timestamp).getTime() - target);
    if (delta < bestDelta) {
      best = prices[i];
      bestDelta = delta;
    }
  }

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

function svgPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

export default function MaxPainPage() {
  const { symbol, getMaxDataPoints } = useTimeframe();
  const { theme } = useTheme();
  const maxPoints = getMaxDataPoints();
  const [selectedExpiration, setSelectedExpiration] = useState<string>("");
  const [timeseriesTimeframe, setTimeseriesTimeframe] = useState<ChartTimeframe>("5min");

  const { data: gexSummary } = useGEXSummary(symbol, 5000);

  const { data: maxPainCurrent, loading: oiLoading, error: oiError } = useApiData<MaxPainCurrentResponse>(
    `/api/max-pain/current?symbol=${symbol}&strike_limit=500`,
    { refreshInterval: 30000 },
  );

  const { data: maxPainSeries, loading: seriesLoading, error: seriesError } = useApiData<MaxPainTimeRow[]>(
    `/api/max-pain/timeseries?symbol=${symbol}&timeframe=${timeseriesTimeframe}&window_units=${maxPoints}`,
    { refreshInterval: 10000 },
  );

  const { data: priceSeries } = useApiData<MarketHistoryRow[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${timeseriesTimeframe}&window_units=${maxPoints}`,
    { refreshInterval: 10000 },
  );

  const currentMaxPain = safeNum(maxPainCurrent?.max_pain || gexSummary?.max_pain);
  const currentUnderlying = safeNum(maxPainCurrent?.underlying_price);
  const expirationOptions = maxPainCurrent?.expirations || [];
  const selectedExpirationValue = selectedExpiration || expirationOptions[0]?.expiration || "";
  const activeExpiration =
    expirationOptions.find((e) => e.expiration === selectedExpirationValue) || expirationOptions[0];

  const activeExpirationValue = activeExpiration?.expiration || "";

  if ((oiLoading || seriesLoading) && !maxPainCurrent && !maxPainSeries) return <LoadingSpinner size="lg" />;

  const oiChart = ((activeExpiration?.strikes || []) as MaxPainPoint[])
    .map((row) => ({
      strike: safeNum(row.settlement_price),
      callNotionalM: safeNum(row.call_notional) / 1_000_000,
      putNotionalM: safeNum(row.put_notional) / 1_000_000,
    }))
    .filter((row) => row.strike > 0)
    .sort((a, b) => a.strike - b.strike);

  const underlyingStrikeMarker = oiChart.length
    ? oiChart.reduce((closest, row) =>
        Math.abs(row.strike - currentUnderlying) < Math.abs(closest - currentUnderlying)
          ? row.strike
          : closest,
      oiChart[0].strike)
    : currentUnderlying;

  const markerSeparation = Math.abs(safeNum(activeExpiration?.max_pain || currentMaxPain) - underlyingStrikeMarker);
  const labelsNeedExtraOffset = markerSeparation <= 5;

  const filteredMaxPainRows = omitClosedMarketTimes(maxPainSeries || [], (row) => row.timestamp || "");
  const filteredPriceRows = omitClosedMarketTimes(priceSeries || [], (row) => row.timestamp);

  const seriesChart = filteredMaxPainRows
    .map((row) => {
      const ts = row.timestamp || "";
      const candle = nearestCandle(ts, filteredPriceRows);
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
  }>;

  const latest = seriesChart[seriesChart.length - 1];
  const impliedMove = currentMaxPain - currentUnderlying;
  const impliedMovePct = currentUnderlying > 0 ? (impliedMove / currentUnderlying) * 100 : 0;

  const textColor = theme === "dark" ? colors.light : colors.dark;
  const panelBg = theme === "dark" ? colors.cardDark : colors.cardLight;

  const tsWidth = 1200;
  const tsHeight = 420;
  const padLeft = 70;
  const padRight = 25;
  const padTop = 24;
  const padBottom = 40;

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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Max Pain</h1>

      <section className="mb-8">
        <SectionTitle title="Max Pain Snapshot" tooltip="Current max pain context combining summary and intraday series." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-lg p-4 border" style={{ backgroundColor: panelBg, borderColor: colors.muted }}>
            <div className="text-xs mb-1" style={{ color: colors.muted }}>Current Max Pain</div>
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
          <MetricCard title="Last Series Max Pain" value={latest?.maxPain ? `$${latest.maxPain.toFixed(2)}` : "--"} tooltip="Latest max pain point from /api/max-pain/timeseries." theme={theme} />
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

        {oiError ? (
          <ErrorMessage message={`Error loading data: ${oiError}`} />
        ) : oiChart.length === 0 ? (
          <div className="text-center py-8" style={{ color: colors.muted }}>No max pain OI data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={380}>
            <BarChart data={oiChart} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.3} />
              <XAxis dataKey="strike" stroke={textColor} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
              <YAxis stroke={textColor} tickFormatter={(v) => `${Number(v).toFixed(1)}M`} domain={["auto", "auto"]} />
              <Tooltip formatter={(value) => `$${Number(value ?? 0).toFixed(2)}M`} />
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
                  dy: labelsNeedExtraOffset ? 0 : 8,
                }}
              />
              <ReferenceLine
                ifOverflow="extendDomain"
                x={underlyingStrikeMarker}
                stroke={"#60a5fa"}
                strokeDasharray="6 4"
                strokeWidth={2}
                label={{
                  value: `Underlying $${currentUnderlying.toFixed(2)}`,
                  fill: textColor,
                  position: "insideTopRight",
                  dy: labelsNeedExtraOffset ? 22 : 8,
                }}
              />
              <Bar dataKey="callNotionalM" name="Call Notional" fill={colors.bullish} />
              <Bar dataKey="putNotionalM" name="Put Notional" fill={colors.bearish} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: panelBg }}>
        <SectionTitle title="Max Pain vs Underlying Price" tooltip="Timeseries of max pain (line) overlaid with underlying candlesticks." />
        <ChartTimeframeSelect value={timeseriesTimeframe} onChange={setTimeseriesTimeframe} />
        {seriesError ? (
          <ErrorMessage message={seriesError} />
        ) : seriesChart.length === 0 ? (
          <div className="text-center py-8" style={{ color: colors.muted }}>No max pain timeseries data available</div>
        ) : (
          <svg width="100%" height={tsHeight} viewBox={`0 0 ${tsWidth} ${tsHeight}`}>
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
                <text key={`t-${r.timestamp}`} x={padLeft + i * xStep} y={tsHeight - 12} textAnchor="middle" fontSize="10" fill={textColor}>
                  {r.time}
                </text>
              );
            })}

            <rect x={padLeft} y={8} width="10" height="2" fill={colors.primary} />
            <text x={padLeft + 16} y={12} fill={textColor} fontSize="11">Max Pain</text>
          </svg>
        )}
      </section>
    </div>
  );
}
