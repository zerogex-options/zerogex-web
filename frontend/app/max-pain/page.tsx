"use client";

import { Info } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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

interface MaxPainStrikeRow {
  settlement_price: number;
  total_notional: number;
}
interface MaxPainCurrentResponse {
  timestamp: string;
  symbol: string;
  max_pain: number;
  strikes: MaxPainStrikeRow[];
}
interface MaxPainTimeRow {
  timestamp?: string;
  max_pain: number;
}
interface MarketHistoryRow {
  timestamp: string;
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

function nearestPrice(ts: string, prices: MarketHistoryRow[]) {
  const target = new Date(ts).getTime();
  if (!Number.isFinite(target) || prices.length === 0) return 0;
  let best = prices[0];
  let bestDelta = Math.abs(new Date(best.timestamp).getTime() - target);
  for (let i = 1; i < prices.length; i += 1) {
    const delta = Math.abs(new Date(prices[i].timestamp).getTime() - target);
    if (delta < bestDelta) {
      best = prices[i];
      bestDelta = delta;
    }
  }
  return safeNum(best.close ?? best.price);
}

export default function MaxPainPage() {
  const { symbol, timeframe, getMaxDataPoints } = useTimeframe();
  const limit = getMaxDataPoints();
  const { data: gexSummary } = useGEXSummary(symbol, 5000);

  const {
    data: maxPainCurrent,
    loading: oiLoading,
    error: oiError,
  } = useApiData<MaxPainCurrentResponse>(
    `/api/max-pain/current?symbol=${symbol}&strike_limit=40`,
    { refreshInterval: 30000 },
  );
  const { data: maxPainCurrentFallback } = useApiData<MaxPainCurrentResponse>(
    `/api/max-pain/current?symbol=${symbol}&strike_limit=20`,
    { refreshInterval: 30000, enabled: !!oiError },
  );

  const {
    data: maxPainSeries,
    loading: seriesLoading,
    error: seriesError,
  } = useApiData<MaxPainTimeRow[]>(
    `/api/max-pain/timeseries?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`,
    { refreshInterval: 10000 },
  );

  const { data: priceSeries } = useApiData<MarketHistoryRow[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${timeframe}&limit=${limit}`,
    { refreshInterval: 10000 },
  );

  if ((oiLoading || seriesLoading) && !maxPainCurrent && !maxPainSeries)
    return <LoadingSpinner size="lg" />;

  const effectiveCurrent = maxPainCurrent || maxPainCurrentFallback;
  const currentMaxPain = safeNum(
    effectiveCurrent?.max_pain || gexSummary?.max_pain,
  );

  const oiChart = [...(effectiveCurrent?.strikes || [])]
    .map((row) => ({
      strike: safeNum(row.settlement_price),
      notionalOiM: safeNum(row.total_notional) / 1_000_000,
    }))
    .filter((row) => row.strike > 0)
    .sort((a, b) => a.strike - b.strike);

  const seriesChart = (maxPainSeries || []).map((row) => {
    const ts = row.timestamp || "";
    const date = new Date(ts);
    return {
      timestamp: ts,
      time: Number.isNaN(date.getTime())
        ? "--:--"
        : date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }),
      maxPain: safeNum(row.max_pain),
      price: nearestPrice(ts, priceSeries || []),
    };
  });

  const latest = seriesChart[seriesChart.length - 1];

  const combinedValues = seriesChart
    .flatMap((r) => [r.maxPain, r.price])
    .filter((v) => Number.isFinite(v) && v > 0);
  const yMin = combinedValues.length ? Math.min(...combinedValues) : 0;
  const yMax = combinedValues.length ? Math.max(...combinedValues) : 1;
  const pad = Math.max(0.5, (yMax - yMin) * 0.1);
  const dollarMin = Math.floor(yMin - pad);
  const dollarMax = Math.ceil(yMax + pad);
  const yTicks = Array.from(
    { length: Math.max(1, dollarMax - dollarMin + 1) },
    (_, i) => dollarMin + i,
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Max Pain</h1>

      <section className="mb-8">
        <SectionTitle
          title="Max Pain Snapshot"
          tooltip="Current max pain context combining summary and intraday series."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Current Max Pain"
            value={currentMaxPain ? `$${currentMaxPain.toFixed(2)}` : "--"}
            tooltip="Latest max pain from /api/max-pain/current (fallback /api/gex/summary)."
            theme="dark"
          />
          <MetricCard
            title="Last Series Max Pain"
            value={latest?.maxPain ? `$${latest.maxPain.toFixed(2)}` : "--"}
            tooltip="Most recent max pain from /api/max-pain/timeseries."
            theme="dark"
          />
          <MetricCard
            title="Underlying Price"
            value={latest?.price ? `$${latest.price.toFixed(2)}` : "--"}
            trend={
              latest?.price && currentMaxPain
                ? latest.price > currentMaxPain
                  ? "bullish"
                  : "bearish"
                : "neutral"
            }
            tooltip="Mapped from /api/market/historical for selected timeframe."
            theme="dark"
          />
        </div>
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Notional Open Interest by Strike"
          tooltip="Strike-level total notional from /api/max-pain/current."
        />
        {oiError ? (
          <ErrorMessage message={`Error loading data: ${oiError}`} />
        ) : oiChart.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            No max pain OI data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart
              data={oiChart}
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#968f92"
                opacity={0.3}
              />
              <XAxis
                dataKey="strike"
                stroke="#f2f2f2"
                tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
              />
              <YAxis
                stroke="#f2f2f2"
                tickFormatter={(value) => `${Number(value).toFixed(1)}M`}
                domain={["auto", "auto"]}
              />
              <Tooltip
                formatter={(value) => `$${Number(value ?? 0).toFixed(2)}M`}
              />
              <Bar dataKey="notionalOiM" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Max Pain vs Underlying Price"
          tooltip="Both max pain and underlying are sourced from timeframe-aligned historical series."
        />
        {seriesError ? (
          <ErrorMessage message={seriesError} />
        ) : seriesChart.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            No max pain timeseries data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart
              data={seriesChart}
              margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#968f92"
                opacity={0.3}
              />
              <XAxis dataKey="time" stroke="#f2f2f2" />
              <YAxis
                stroke="#f2f2f2"
                domain={[dollarMin, dollarMax]}
                ticks={yTicks}
                allowDecimals={false}
                tickFormatter={(value) => `$${Math.round(Number(value))}`}
              />
              <Tooltip />
              <Legend />
              <Line
                dataKey="maxPain"
                name="Max Pain"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
              <Line
                dataKey="price"
                name="Underlying Price"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
