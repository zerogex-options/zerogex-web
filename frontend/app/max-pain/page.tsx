"use client";

import { Info } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
import { useTheme } from "@/core/ThemeContext";
import { colors } from "@/core/colors";

interface MaxPainPoint {
  settlement_price: number;
  call_notional: number;
  put_notional: number;
}
interface MaxPainExpiration {
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

function nicePriceStep(min: number, max: number) {
  const span = Math.max(1, max - min);
  const rough = span / 8;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

export default function MaxPainPage() {
  const { symbol, timeframe, getMaxDataPoints } = useTimeframe();
  const { theme } = useTheme();
  const limit = getMaxDataPoints();
  const { data: gexSummary } = useGEXSummary(symbol, 5000);

  const { data: maxPainCurrent, loading: oiLoading, error: oiError } = useApiData<MaxPainCurrentResponse>(
    `/api/max-pain/current?symbol=${symbol}&strike_limit=200`,
    { refreshInterval: 30000 },
  );

  const { data: maxPainSeries, loading: seriesLoading, error: seriesError } = useApiData<MaxPainTimeRow[]>(
    `/api/max-pain/timeseries?symbol=${symbol}&timeframe=${timeframe}&window_units=${limit}`,
    { refreshInterval: 10000 },
  );

  const { data: priceSeries } = useApiData<MarketHistoryRow[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${timeframe}&window_units=${limit}`,
    { refreshInterval: 10000 },
  );

  if ((oiLoading || seriesLoading) && !maxPainCurrent && !maxPainSeries) return <LoadingSpinner size="lg" />;

  const currentMaxPain = safeNum(maxPainCurrent?.max_pain || gexSummary?.max_pain);
  const currentUnderlying = safeNum(maxPainCurrent?.underlying_price);

  const allStrikes = (maxPainCurrent?.expirations || []).flatMap((exp) => exp.strikes || []);
  const oiChart = allStrikes
    .map((row) => ({
      strike: safeNum(row.settlement_price),
      callNotionalM: safeNum(row.call_notional) / 1_000_000,
      putNotionalM: safeNum(row.put_notional) / 1_000_000,
    }))
    .filter((row) => row.strike > 0)
    .sort((a, b) => a.strike - b.strike);

  const timeBucketMinutes = timeframe === "1day" ? 60 : timeframe === "1hr" ? 30 : timeframe === "15min" ? 30 : timeframe === "5min" ? 15 : 10;

  const seriesChart = (maxPainSeries || []).map((row) => {
    const ts = row.timestamp || "";
    const d = new Date(ts);
    const roundedMs = Math.floor(d.getTime() / (timeBucketMinutes * 60000)) * timeBucketMinutes * 60000;
    const rounded = new Date(roundedMs);
    return {
      timestamp: ts,
      time: Number.isNaN(rounded.getTime())
        ? "--:--"
        : rounded.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
      maxPain: safeNum(row.max_pain),
      price: nearestPrice(ts, priceSeries || []),
    };
  });

  const latest = seriesChart[seriesChart.length - 1];
  const combinedValues = seriesChart.flatMap((r) => [r.maxPain, r.price]).filter((v) => Number.isFinite(v) && v > 0);
  const yMin = combinedValues.length ? Math.min(...combinedValues) : 0;
  const yMax = combinedValues.length ? Math.max(...combinedValues) : 1;
  const step = nicePriceStep(yMin, yMax);
  const domainMin = Math.floor((yMin - step) / step) * step;
  const domainMax = Math.ceil((yMax + step) / step) * step;

  const textColor = theme === "dark" ? colors.light : colors.dark;
  const panelBg = theme === "dark" ? colors.cardDark : colors.cardLight;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Max Pain</h1>

      <section className="mb-8">
        <SectionTitle title="Max Pain Snapshot" tooltip="Current max pain context combining summary and intraday series." />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard title="Current Max Pain" value={currentMaxPain ? `$${currentMaxPain.toFixed(2)}` : "--"} theme={theme} />
          <MetricCard title="Last Series Max Pain" value={latest?.maxPain ? `$${latest.maxPain.toFixed(2)}` : "--"} theme={theme} />
          <MetricCard
            title="Underlying Price"
            value={latest?.price ? `$${latest.price.toFixed(2)}` : "--"}
            trend={latest?.price && currentMaxPain ? (latest.price > currentMaxPain ? "bullish" : "bearish") : "neutral"}
            theme={theme}
          />
        </div>
      </section>

      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: panelBg }}>
        <SectionTitle title="Notional Open Interest by Strike" tooltip="Calls/puts notional by strike with current max pain and underlying markers." />
        {oiError ? (
          <ErrorMessage message={`Error loading data: ${oiError}`} />
        ) : oiChart.length === 0 ? (
          <div className="text-center py-8" style={{ color: colors.muted }}>No max pain OI data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={oiChart} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.3} />
              <XAxis dataKey="strike" stroke={textColor} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
              <YAxis stroke={textColor} tickFormatter={(v) => `${Number(v).toFixed(1)}M`} domain={["auto", "auto"]} />
              <Tooltip formatter={(value) => `$${Number(value ?? 0).toFixed(2)}M`} />
              <Legend />
              <ReferenceLine x={currentMaxPain} stroke={colors.primary} strokeWidth={2} label={{ value: "Max Pain", fill: textColor, position: "top" }} />
              <ReferenceLine x={currentUnderlying} stroke={colors.bullish} strokeWidth={2} label={{ value: "Underlying", fill: textColor, position: "insideTopRight" }} />
              <Bar dataKey="callNotionalM" name="Call Notional" fill={colors.bullish} />
              <Bar dataKey="putNotionalM" name="Put Notional" fill={colors.bearish} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: panelBg }}>
        <SectionTitle title="Max Pain vs Underlying Price" tooltip="Both max pain and underlying are sourced from timeframe-aligned historical series." />
        {seriesError ? (
          <ErrorMessage message={seriesError} />
        ) : seriesChart.length === 0 ? (
          <div className="text-center py-8" style={{ color: colors.muted }}>No max pain timeseries data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={seriesChart} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.muted} opacity={0.3} />
              <XAxis dataKey="time" stroke={textColor} minTickGap={24} />
              <YAxis stroke={textColor} domain={[domainMin, domainMax]} tickCount={8} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
              <Tooltip />
              <Legend />
              <Line dataKey="maxPain" name="Max Pain" stroke={colors.primary} strokeWidth={2} dot={false} />
              <Line dataKey="price" name="Underlying Price" stroke="#60a5fa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
