"use client";

import { Info } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApiData } from "@/hooks/useApiData";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import MetricCard from "@/components/MetricCard";
import TooltipWrapper from "@/components/TooltipWrapper";
import { useTimeframe } from "@/core/TimeframeContext";
import { omitClosedMarketTimes } from "@/core/utils";
import ChartTimeframeSelect, { type ChartTimeframe } from "@/components/ChartTimeframeSelect";

interface FlowByTypePoint {
  timestamp: string;
  call_volume: number;
  call_premium: number;
  put_volume: number;
  put_premium: number;
  net_volume: number;
  net_premium: number;
}

interface FlowByExpirationPoint {
  timestamp: string;
  expiration: string;
  volume: number;
  premium: number;
  net_volume: number;
  net_premium: number;
}

interface FlowByStrikePoint {
  timestamp: string;
  strike: number | string;
  volume: number;
  premium: number;
  net_volume: number;
  net_premium: number;
}

interface UnderlyingPoint {
  timestamp: string;
  close?: number;
  price?: number;
}


const getWindowUnitsForTimeframe = (maxPoints: number) => Math.max(1, Math.min(90, maxPoints));

function parseTimestampMs(value?: string): number | null {
  if (!value) return null;

  const direct = new Date(value).getTime();
  if (Number.isFinite(direct)) return direct;

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const retry = new Date(normalized).getTime();
  if (Number.isFinite(retry)) return retry;

  const bareMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!bareMatch) return null;

  const [, y, m, d, hh, mm, ss] = bareMatch;
  return Date.UTC(
    Number(y),
    Number(m) - 1,
    Number(d),
    Number(hh),
    Number(mm),
    Number(ss ?? "0"),
  );
}

function timeframeToBucketMs(timeframe: ChartTimeframe): number {
  switch (timeframe) {
    case "1min":
      return 60 * 1000;
    case "5min":
      return 5 * 60 * 1000;
    case "15min":
      return 15 * 60 * 1000;
    case "1hr":
      return 60 * 60 * 1000;
    case "1day":
      return 24 * 60 * 60 * 1000;
    default:
      return 5 * 60 * 1000;
  }
}

interface PutCallRatioRow {
  timestamp: string;
  ratio: number;
}

interface TimeseriesRow {
  timestamp: string;
  time: string;
  callPremium: number;
  putPremium: number;
  netVolume: number;
  positiveNetVolume: number;
  negativeNetVolume: number;
  underlyingPrice: number | null;
}

function safeTimeLabel(value?: string) {
  if (!value) return "--:--";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "--:--"
    : d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
}

function getNewYorkDateKey(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function isActiveExpiration(expiration?: string, todayKey: string = getNewYorkDateKey()) {
  if (!expiration) return false;
  const normalized = expiration.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return true;
  return normalized >= todayKey;
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

function MultiSelectChips({
  options,
  selected,
  onToggle,
  label,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  label: string;
}) {
  if (options.length === 0) {
    return <div className="text-gray-400 text-sm">No {label.toLowerCase()} available</div>;
  }

  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {options.map((option) => {
        const active = selected.has(option);
        return (
          <button
            key={option}
            onClick={() => onToggle(option)}
            className={`px-3 py-1.5 text-sm rounded-md border transition ${
              active
                ? "bg-blue-500/20 border-blue-400 text-blue-200"
                : "bg-[#2f2b2d] border-gray-600 text-gray-300 hover:border-gray-400"
            }`}
            type="button"
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function normalizeSignedFlow(totalPremium: number, netPremium: number, totalVolume: number, netVolume: number) {
  const callPremium = Math.max(0, (totalPremium + netPremium) / 2);
  const putPremium = Math.max(0, (totalPremium - netPremium) / 2);

  const derivedFromPremium = Math.round(
    Math.max(
      -totalVolume,
      Math.min(totalVolume, totalVolume * ((netPremium || 0) / Math.max(1, totalPremium || 0))),
    ),
  );

  const boundedRawNet = Number.isFinite(netVolume)
    ? Math.max(-totalVolume, Math.min(totalVolume, Math.round(netVolume)))
    : derivedFromPremium;

  const hasSignMismatch =
    Math.sign(netPremium || 0) !== 0 && Math.sign(boundedRawNet || 0) !== 0 && Math.sign(netPremium || 0) !== Math.sign(boundedRawNet || 0);

  return {
    callPremium,
    putPremium,
    netVolume: hasSignMismatch ? derivedFromPremium : boundedRawNet,
  };
}

function buildTimeseriesFromByType(rows: FlowByTypePoint[], maxPoints: number): TimeseriesRow[] {
  const grouped = new Map<
    string,
    { callPremium: number; putPremium: number; callVolume: number; putVolume: number }
  >();

  rows.forEach((row) => {
    const ts = row.timestamp;
    if (!ts) return;

    const current = grouped.get(ts) || {
      callPremium: 0,
      putPremium: 0,
      callVolume: 0,
      putVolume: 0,
    };

    current.callPremium += Number(row.call_premium || 0);
    current.putPremium += Number(row.put_premium || 0);
    current.callVolume += Number(row.call_volume || 0);
    current.putVolume += Number(row.put_volume || 0);

    grouped.set(ts, current);
  });

  const chartRows = Array.from(grouped.entries())
    .map(([timestamp, value]) => {
      const netVolume = value.callVolume - value.putVolume;
      return {
        timestamp,
        time: safeTimeLabel(timestamp),
        callPremium: value.callPremium,
        putPremium: value.putPremium,
        netVolume,
        positiveNetVolume: netVolume > 0 ? netVolume : 0,
        negativeNetVolume: netVolume < 0 ? netVolume : 0,
        underlyingPrice: null,
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return omitClosedMarketTimes(chartRows, (r) => r.timestamp).slice(-maxPoints);
}


function buildPutCallRatioSeries(rows: FlowByTypePoint[], maxPoints: number): PutCallRatioRow[] {
  const grouped = new Map<string, { callVolume: number; putVolume: number }>();

  rows.forEach((row) => {
    const ts = row.timestamp;
    if (!ts) return;
    const current = grouped.get(ts) || { callVolume: 0, putVolume: 0 };
    current.callVolume += Number(row.call_volume || 0);
    current.putVolume += Number(row.put_volume || 0);
    grouped.set(ts, current);
  });

  const points = Array.from(grouped.entries())
    .map(([timestamp, value]) => ({
      timestamp,
      ratio: value.callVolume > 0 ? value.putVolume / value.callVolume : 0,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return omitClosedMarketTimes(points, (row) => row.timestamp).slice(-maxPoints);
}

function buildTimeseriesFromNetRows(
  rows: Array<{ timestamp: string; premium: number; net_premium: number; volume: number; net_volume: number }>,
  maxPoints: number,
): TimeseriesRow[] {
  const grouped = new Map<string, { totalPremium: number; netPremium: number; totalVolume: number; netVolume: number }>();

  rows.forEach((row) => {
    const ts = row.timestamp;
    if (!ts) return;

    const current = grouped.get(ts) || {
      totalPremium: 0,
      netPremium: 0,
      totalVolume: 0,
      netVolume: 0,
    };

    current.totalPremium += Number(row.premium || 0);
    current.netPremium += Number(row.net_premium || 0);
    current.totalVolume += Number(row.volume || 0);
    current.netVolume += Number(row.net_volume || 0);

    grouped.set(ts, current);
  });

  const chartRows = Array.from(grouped.entries())
    .map(([timestamp, value]) => {
      const normalized = normalizeSignedFlow(
        value.totalPremium,
        value.netPremium,
        value.totalVolume,
        value.netVolume,
      );
      return {
        timestamp,
        time: safeTimeLabel(timestamp),
        callPremium: normalized.callPremium,
        putPremium: normalized.putPremium,
        netVolume: normalized.netVolume,
        positiveNetVolume: normalized.netVolume > 0 ? normalized.netVolume : 0,
        negativeNetVolume: normalized.netVolume < 0 ? normalized.netVolume : 0,
        underlyingPrice: null,
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return omitClosedMarketTimes(chartRows, (r) => r.timestamp).slice(-maxPoints);
}

function attachUnderlyingPrice(
  rows: TimeseriesRow[],
  underlyingRows: UnderlyingPoint[],
  timeframe: ChartTimeframe,
): TimeseriesRow[] {
  if (rows.length === 0 || underlyingRows.length === 0) return rows;

  const bucketMs = timeframeToBucketMs(timeframe);
  const aggregated = new Map<number, { sum: number; count: number }>();

  underlyingRows.forEach((row) => {
    const ts = parseTimestampMs(row.timestamp);
    const price = Number(row.close ?? row.price ?? NaN);
    if (ts === null || !Number.isFinite(price)) return;

    const bucket = Math.floor(ts / bucketMs) * bucketMs;
    const current = aggregated.get(bucket) || { sum: 0, count: 0 };
    current.sum += price;
    current.count += 1;
    aggregated.set(bucket, current);
  });

  return rows.map((row) => {
    const ts = parseTimestampMs(row.timestamp);
    if (ts === null) {
      return {
        ...row,
        underlyingPrice: null,
      };
    }

    const bucket = Math.floor(ts / bucketMs) * bucketMs;
    const value = aggregated.get(bucket);
    return {
      ...row,
      underlyingPrice: value && value.count > 0 ? value.sum / value.count : null,
    };
  });
}


function getUnderlyingDomain(rows: TimeseriesRow[]) {
  const prices = rows
    .map((r) => Number(r.underlyingPrice))
    .filter((v) => Number.isFinite(v));

  if (prices.length === 0) return ['auto', 'auto'] as const;

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const span = Math.max(0.01, maxPrice - minPrice);
  const padding = span * 0.03;

  return [minPrice - padding, maxPrice + padding] as const;
}

function roundToStep(value: number, step: number, mode: 'up' | 'down') {
  if (!Number.isFinite(value)) return 0;
  if (mode === 'down') return Math.floor(value / step) * step;
  return Math.ceil(value / step) * step;
}

function alignSeriesToTimeline(rows: TimeseriesRow[], timeline: string[]) {
  const byTs = new Map(rows.map((r) => [r.timestamp, r]));
  return timeline.map((timestamp) => {
    const row = byTs.get(timestamp);
    if (row) return row;
    return {
      timestamp,
      time: safeTimeLabel(timestamp),
      callPremium: 0,
      putPremium: 0,
      netVolume: 0,
      positiveNetVolume: 0,
      negativeNetVolume: 0,
      underlyingPrice: null,
    } satisfies TimeseriesRow;
  });
}


function formatFlowXAxisLabel(timestamp: string, includeDate: boolean) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '--:--';

  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  if (!includeDate) return time;

  const day = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return `${day} ${time}`;
}


function getDateMarkerMeta(timestamps: string[]) {
  const groups = new Map<string, { first: number; last: number }>();

  timestamps.forEach((ts, idx) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    const key = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const current = groups.get(key);
    if (!current) groups.set(key, { first: idx, last: idx });
    else groups.set(key, { first: current.first, last: idx });
  });

  const indexToLabel = new Map<number, string>();
  groups.forEach((g, label) => {
    indexToLabel.set(g.first, label);
  });

  return indexToLabel;
}



function getDynamicLeftMargin(rows: TimeseriesRow[]) {
  const prices = rows
    .map((r) => Number(r.underlyingPrice))
    .filter((v) => Number.isFinite(v));

  if (prices.length === 0) return 86;

  const maxAbs = Math.max(...prices.map((v) => Math.abs(v)));
  const digits = Math.max(3, Math.floor(Math.log10(Math.max(1, maxAbs))) + 1);
  return Math.max(86, Math.min(120, 52 + digits * 10));
}

function FullWidthFlowChart({ rows }: { rows: TimeseriesRow[] }) {
  if (rows.length === 0) {
    return <div className="text-gray-400 text-center py-8">No chart data available</div>;
  }

  const maxPremium = Math.max(0, ...rows.map((r) => r.callPremium), ...rows.map((r) => r.putPremium));
  const minVolumeRaw = Math.min(0, ...rows.map((r) => r.netVolume));
  const maxVolumeRaw = Math.max(0, ...rows.map((r) => r.netVolume));
  const volumeStep = 10_000;
  const minVolume = roundToStep(minVolumeRaw, volumeStep, "down");
  const maxVolume = roundToStep(maxVolumeRaw, volumeStep, "up");
  const underlyingDomain = getUnderlyingDomain(rows);
  const includeDateOnXAxis = new Set(rows.map((r) => new Date(r.timestamp).toDateString())).size > 1;
  const dateMarkerMeta = getDateMarkerMeta(rows.map((r) => r.timestamp));
  const timeTickStep = Math.max(1, Math.ceil(rows.length / 10));
  const leftChartMargin = getDynamicLeftMargin(rows);
  const rightChartMargin = 70;

  return (
    <div className="h-[540px]">
      <ResponsiveContainer width="100%" height="75%">
        <ComposedChart data={rows} margin={{ top: 10, right: rightChartMargin, left: leftChartMargin, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.25} />
          <XAxis dataKey="timestamp" tickFormatter={(value) => formatFlowXAxisLabel(String(value), includeDateOnXAxis)} stroke="#f2f2f2" minTickGap={24} padding={{ left: 0, right: 0 }} hide />
          <YAxis yAxisId="price" stroke="#f2f2f2" orientation="left" domain={underlyingDomain} tickFormatter={(v) => `$${Math.round(Number(v))}`} tick={{ fontSize: 10 }} tickMargin={8} width={72} label={{ value: "Underlying Price", angle: -90, position: "left", fill: "#f2f2f2", fontSize: 10, offset: 10 }} />
          <YAxis
            yAxisId="premium"
            stroke="#f2f2f2"
            orientation="right"
            domain={[0, Math.max(1, maxPremium)]}
            tickFormatter={(v) => `$${(Number(v) / 1_000_000).toFixed(1)}M`}
            tick={{ fontSize: 10 }}
            tickMargin={8}
            width={62}
            label={{ value: "Notional Value", angle: 90, position: "right", fill: "#f2f2f2", fontSize: 10, offset: 16 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "#ffffff", borderColor: "#d1d5db" }}
            labelStyle={{ color: "#374151", fontWeight: 600 }}
            itemStyle={{ color: "#111827" }}
            labelFormatter={(value) => new Date(String(value)).toLocaleString()}
            formatter={(value, name) => {
              const n = Number(value ?? 0);
              if (name === "Underlying") return [`$${n.toFixed(2)}`, name];
              return [`$${n.toLocaleString()}`, name];
            }}
          />
          <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />
          <ReferenceLine yAxisId="premium" y={0} stroke="#f2f2f2" opacity={0.6} />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="underlyingPrice"
            name="Underlying"
            stroke="#facc15"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="premium"
            type="monotone"
            dataKey="callPremium"
            name="Net Call Prem"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="premium"
            type="monotone"
            dataKey="putPremium"
            name="Net Put Prem"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <ResponsiveContainer width="100%" height="25%">
        <ComposedChart data={rows} margin={{ top: 0, right: rightChartMargin, left: leftChartMargin, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.2} vertical={false} />
          <XAxis
            dataKey="timestamp"
            stroke="#f2f2f2"
            interval={0}
            minTickGap={24}
            padding={{ left: 0, right: 0 }}
            tick={(props: { x?: number | string; y?: number | string; payload?: { value?: string | number }; index?: number }) => {
              const x = Number(props?.x ?? 0);
              const y = Number(props?.y ?? 0);
              const payload = props?.payload;
              const index = Number(props?.index ?? -1);
              const ts = String(payload?.value || "");
              const timeLabel = formatFlowXAxisLabel(ts, false);
              const dateLabel = dateMarkerMeta.get(index);
              const showTime = index % timeTickStep === 0 || Boolean(dateLabel);
              if (!showTime && !dateLabel) return <g transform={`translate(${x},${y})`} />;
              return (
                <g transform={`translate(${x},${y})`}>
                  {showTime ? <text dy={12} textAnchor="middle" fill="#f2f2f2" fontSize={10}>{timeLabel}</text> : null}
                  {dateLabel ? <text dy={24} textAnchor="middle" fill="#cfcfcf" fontSize={9}>{dateLabel}</text> : null}
                </g>
              );
            }}
          />
          <YAxis yAxisId="volumeSpacer" orientation="left" domain={[0, 1]} width={72} axisLine={false} tickLine={false} tick={false} />
          <YAxis yAxisId="volume" orientation="right" stroke="#f2f2f2" domain={[minVolume, maxVolume]} tickFormatter={(v) => (Math.round(Number(v) / 10_000) * 10_000).toLocaleString()} tick={{ fontSize: 10 }} tickMargin={8} width={62} label={{ value: "Net Volume", angle: 90, position: "right", fill: "#f2f2f2", fontSize: 10, offset: 16 }} />
          <Tooltip
            contentStyle={{ backgroundColor: "#ffffff", borderColor: "#d1d5db" }}
            labelStyle={{ color: "#374151", fontWeight: 600 }}
            itemStyle={{ color: "#111827" }}
            labelFormatter={(value) => new Date(String(value)).toLocaleString()}
            formatter={(value) => [Number(value ?? 0).toLocaleString(), "Net Volume"]}
          />
          <ReferenceLine yAxisId="volume" y={0} stroke="#f2f2f2" opacity={0.6} />
          <Area
            yAxisId="volume"
            type="linear"
            dataKey="positiveNetVolume"
            name="Positive Net Volume"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.45}
            baseValue={0}
            isAnimationActive={false}
          />
          <Area
            yAxisId="volume"
            type="linear"
            dataKey="negativeNetVolume"
            name="Negative Net Volume"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.45}
            baseValue={0}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function FlowAnalysisPage() {
  const { getMaxDataPoints, symbol } = useTimeframe();
  const maxPoints = getMaxDataPoints();

  const [optionsFlowTimeframe, setOptionsFlowTimeframe] = useState<ChartTimeframe>("5min");
  const [expirationTimeframe, setExpirationTimeframe] = useState<ChartTimeframe>("5min");
  const [strikeTimeframe, setStrikeTimeframe] = useState<ChartTimeframe>("5min");
  const [ratioTimeframe, setRatioTimeframe] = useState<ChartTimeframe>("5min");

  const optionsWindowUnits = getWindowUnitsForTimeframe(maxPoints);
  const expirationWindowUnits = getWindowUnitsForTimeframe(maxPoints);
  const strikeWindowUnits = getWindowUnitsForTimeframe(maxPoints);
  const ratioWindowUnits = getWindowUnitsForTimeframe(maxPoints);

  const {
    data: flowByType,
    loading: flowLoading,
    error: flowError,
  } = useApiData<FlowByTypePoint[]>(
    `/api/flow/by-type?symbol=${symbol}&timeframe=${optionsFlowTimeframe}&window_units=${optionsWindowUnits}`,
    { refreshInterval: 5000 },
  );

  const { data: flowByExpiration, error: expirationError } = useApiData<FlowByExpirationPoint[]>(
    `/api/flow/by-expiration?symbol=${symbol}&timeframe=${expirationTimeframe}&window_units=${expirationWindowUnits}&limit=50000`,
    { refreshInterval: 5000 },
  );

  const { data: flowByStrike, error: strikeError } = useApiData<FlowByStrikePoint[]>(
    `/api/flow/by-strike?symbol=${symbol}&timeframe=${strikeTimeframe}&window_units=${strikeWindowUnits}&limit=50000`,
    { refreshInterval: 5000 },
  );

  const { data: underlyingHistory } = useApiData<UnderlyingPoint[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${optionsFlowTimeframe}&window_units=${optionsWindowUnits}`,
    { refreshInterval: 5000 },
  );

  const { data: ratioFlowByType } = useApiData<FlowByTypePoint[]>(
    `/api/flow/by-type?symbol=${symbol}&timeframe=${ratioTimeframe}&window_units=${ratioWindowUnits}`,
    { refreshInterval: 5000 },
  );

  const { data: expirationUnderlyingHistory } = useApiData<UnderlyingPoint[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${expirationTimeframe}&window_units=${expirationWindowUnits}`,
    { refreshInterval: 5000 },
  );

  const { data: strikeUnderlyingHistory } = useApiData<UnderlyingPoint[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${strikeTimeframe}&window_units=${strikeWindowUnits}`,
    { refreshInterval: 5000 },
  );

  const latestSnapshot = useMemo(() => {
    const rows = flowByType || [];
    if (rows.length === 0) return null;

    const latest = [...rows].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0];

    const callVolume = Number(latest.call_volume || 0);
    const putVolume = Number(latest.put_volume || 0);
    const callPremium = Number(latest.call_premium || 0);
    const putPremium = Number(latest.put_premium || 0);

    return {
      timestamp: latest.timestamp,
      callVolume,
      putVolume,
      callPremium,
      putPremium,
      netFlow: Number(latest.net_volume || callVolume - putVolume),
      netPremium: Number(latest.net_premium || callPremium - putPremium),
      putCallRatio: callVolume > 0 ? putVolume / callVolume : 0,
    };
  }, [flowByType]);

  const mainBaseSeries = useMemo(() => buildTimeseriesFromByType(flowByType || [], maxPoints), [flowByType, maxPoints]);

  const timelineTimestamps = useMemo(() => mainBaseSeries.map((r) => r.timestamp), [mainBaseSeries]);

  const mainSeries = useMemo(() => {
    const aligned = alignSeriesToTimeline(mainBaseSeries, timelineTimestamps);
    return attachUnderlyingPrice(aligned, underlyingHistory || [], optionsFlowTimeframe);
  }, [mainBaseSeries, timelineTimestamps, underlyingHistory, optionsFlowTimeframe]);

  const expirationOptions = useMemo(
    () =>
      Array.from(new Set((flowByExpiration || []).map((r) => r.expiration).filter((value) => isActiveExpiration(value)))).sort(),
    [flowByExpiration],
  );
  const [selectedExpirations, setSelectedExpirations] = useState<Set<string>>(new Set());

  const strikeOptions = useMemo(
    () =>
      Array.from(new Set((flowByStrike || []).map((r) => String(r.strike)).filter(Boolean))).sort(
        (a, b) => Number(a) - Number(b),
      ),
    [flowByStrike],
  );
  const [selectedStrikes, setSelectedStrikes] = useState<Set<string>>(new Set());

  const expirationRowsFiltered = useMemo(() => {
    const source = flowByExpiration || [];
    const available = new Set(expirationOptions);
    const activeSelection = new Set(Array.from(selectedExpirations).filter((value) => available.has(value)));
    if (activeSelection.size === 0) return source.filter((r) => available.has(r.expiration));
    return source.filter((r) => activeSelection.has(r.expiration));
  }, [flowByExpiration, selectedExpirations, expirationOptions]);

  const strikeRowsFiltered = useMemo(() => {
    const source = flowByStrike || [];
    if (selectedStrikes.size === 0) return source;
    return source.filter((r) => selectedStrikes.has(String(r.strike)));
  }, [flowByStrike, selectedStrikes]);

  const expirationSeries = useMemo(() => {
    const base = buildTimeseriesFromNetRows(expirationRowsFiltered, maxPoints);
    return attachUnderlyingPrice(base, expirationUnderlyingHistory || [], expirationTimeframe);
  }, [expirationRowsFiltered, maxPoints, expirationUnderlyingHistory, expirationTimeframe]);

  const strikeSeries = useMemo(() => {
    const base = buildTimeseriesFromNetRows(strikeRowsFiltered, maxPoints);
    return attachUnderlyingPrice(base, strikeUnderlyingHistory || [], strikeTimeframe);
  }, [strikeRowsFiltered, maxPoints, strikeUnderlyingHistory, strikeTimeframe]);

  const putCallRatioSeries = useMemo(
    () => buildPutCallRatioSeries(ratioFlowByType || [], maxPoints),
    [ratioFlowByType, maxPoints],
  );


  const ratioDateMarkerMeta = useMemo(
    () => getDateMarkerMeta(putCallRatioSeries.map((r) => r.timestamp)),
    [putCallRatioSeries],
  );
  const ratioTimeTickStep = Math.max(1, Math.ceil(Math.max(1, putCallRatioSeries.length) / 10));

  const toggleExpirations = (value: string) => {
    setSelectedExpirations((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleStrikes = (value: string) => {
    setSelectedStrikes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  if (flowLoading && !flowByType) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Flow Analysis</h1>
      {flowError && <ErrorMessage message={flowError} />}

      <section className="mb-8">
        <SectionTitle
          title="Flow Snapshot"
          tooltip="Most recent snapshot from the latest row returned for the selected interval."
        />
        <div className="text-gray-400 text-sm mb-3">
          Latest timestamp: {latestSnapshot?.timestamp ? new Date(latestSnapshot.timestamp).toLocaleString() : "--"}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard
            title="Call Volume"
            value={Number(latestSnapshot?.callVolume || 0).toLocaleString()}
            subtitle={`$${(Number(latestSnapshot?.callPremium || 0) / 1_000_000).toFixed(2)}M premium`}
            trend="bullish"
            tooltip="Latest call contracts traded in the selected interval."
            theme="dark"
          />
          <MetricCard
            title="Put Volume"
            value={Number(latestSnapshot?.putVolume || 0).toLocaleString()}
            subtitle={`$${(Number(latestSnapshot?.putPremium || 0) / 1_000_000).toFixed(2)}M premium`}
            trend="bearish"
            tooltip="Latest put contracts traded in the selected interval."
            theme="dark"
          />
          <MetricCard
            title="Net Flow"
            value={Number(latestSnapshot?.netFlow || 0).toLocaleString()}
            trend={Number(latestSnapshot?.netFlow || 0) > 0 ? "bullish" : "bearish"}
            tooltip="Latest call volume minus put volume."
            theme="dark"
          />
          <MetricCard
            title="Net Premium"
            value={`$${(Number(latestSnapshot?.netPremium || 0) / 1_000_000).toFixed(2)}M`}
            trend={Number(latestSnapshot?.netPremium || 0) > 0 ? "bullish" : "bearish"}
            tooltip="Latest call premium minus put premium."
            theme="dark"
          />
          <MetricCard
            title="Put/Call Ratio"
            value={Number(latestSnapshot?.putCallRatio || 0).toFixed(2)}
            trend={Number(latestSnapshot?.putCallRatio || 0) > 1 ? "bearish" : "bullish"}
            tooltip="Latest put volume divided by call volume."
            theme="dark"
          />
        </div>
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Options Flow"
          tooltip="Primary axis: call premium (green) and put premium (red). Bottom axis: net volume area, green above zero and red below zero."
        />
        <ChartTimeframeSelect value={optionsFlowTimeframe} onChange={setOptionsFlowTimeframe} />
        <FullWidthFlowChart rows={mainSeries} />
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Flow by Expiration"
          tooltip="Same chart format, filtered by one or more expiration dates."
        />
        <MultiSelectChips
          options={expirationOptions}
          selected={selectedExpirations}
          onToggle={toggleExpirations}
          label="Expirations"
        />
        {expirationError && <ErrorMessage message={expirationError} />}
        <ChartTimeframeSelect value={expirationTimeframe} onChange={setExpirationTimeframe} />
        <FullWidthFlowChart rows={expirationSeries} />
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Flow by Strike"
          tooltip="Same chart format, filtered by one or more strikes."
        />
        <MultiSelectChips
          options={strikeOptions}
          selected={selectedStrikes}
          onToggle={toggleStrikes}
          label="Strikes"
        />
        {strikeError && <ErrorMessage message={strikeError} />}
        <ChartTimeframeSelect value={strikeTimeframe} onChange={setStrikeTimeframe} />
        <FullWidthFlowChart rows={strikeSeries} />
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Put/Call Ratio"
          tooltip="Put/call volume ratio over time using the selected timeframe."
        />
        <ChartTimeframeSelect value={ratioTimeframe} onChange={setRatioTimeframe} />
        {putCallRatioSeries.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No put/call ratio data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={putCallRatioSeries} margin={{ top: 10, right: 70, left: 70, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.2} />
              <XAxis
                dataKey="timestamp"
                stroke="#f2f2f2"
                interval={0}
                minTickGap={24}
                tick={(props: { x?: number | string; y?: number | string; payload?: { value?: string | number }; index?: number }) => {
                  const x = Number(props?.x ?? 0);
                  const y = Number(props?.y ?? 0);
                  const payload = props?.payload;
                  const index = Number(props?.index ?? -1);
                  const ts = String(payload?.value || "");
                  const timeLabel = formatFlowXAxisLabel(ts, false);
                  const dateLabel = ratioDateMarkerMeta.get(index);
                  const showTime = index % ratioTimeTickStep === 0 || Boolean(dateLabel);
                  if (!showTime && !dateLabel) return <g transform={`translate(${x},${y})`} />;
                  return (
                    <g transform={`translate(${x},${y})`}>
                      {showTime ? <text dy={12} textAnchor="middle" fill="#f2f2f2" fontSize={10}>{timeLabel}</text> : null}
                      {dateLabel ? <text dy={24} textAnchor="middle" fill="#cfcfcf" fontSize={9}>{dateLabel}</text> : null}
                    </g>
                  );
                }}
              />
              <YAxis stroke="#f2f2f2" tick={{ fontSize: 10 }} tickMargin={8} width={62} />
              <Tooltip
                labelFormatter={(value) => new Date(String(value)).toLocaleString()}
                formatter={(value) => [Number(value ?? 0).toFixed(2), "Put/Call Ratio"]}
              />
              <Line
                type="monotone"
                dataKey="ratio"
                name="Put/Call Ratio"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
