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
  const derivedNetVolume = Number.isFinite(netVolume)
    ? netVolume
    : Math.max(-totalVolume, Math.min(totalVolume, totalVolume));

  return {
    callPremium,
    putPremium,
    netVolume: derivedNetVolume,
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

function attachUnderlyingPrice(rows: TimeseriesRow[], underlyingRows: UnderlyingPoint[]): TimeseriesRow[] {
  if (rows.length === 0 || underlyingRows.length === 0) return rows;

  const sortedUnderlying = [...underlyingRows]
    .filter((r) => Boolean(r.timestamp))
    .map((r) => ({
      timestamp: r.timestamp,
      timeMs: new Date(r.timestamp).getTime(),
      price: Number(r.close ?? r.price ?? NaN),
    }))
    .filter((r) => Number.isFinite(r.timeMs) && Number.isFinite(r.price))
    .sort((a, b) => a.timeMs - b.timeMs);

  if (sortedUnderlying.length === 0) return rows;

  let idx = 0;
  return rows.map((row) => {
    const t = new Date(row.timestamp).getTime();
    while (idx + 1 < sortedUnderlying.length && sortedUnderlying[idx + 1].timeMs <= t) {
      idx += 1;
    }

    const current = sortedUnderlying[idx];
    const next = idx + 1 < sortedUnderlying.length ? sortedUnderlying[idx + 1] : null;

    const chosen =
      next && Math.abs(next.timeMs - t) < Math.abs(current.timeMs - t) ? next.price : current.price;

    return {
      ...row,
      underlyingPrice: chosen,
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

function getZeroOffset(minValue: number, maxValue: number) {
  if (maxValue <= 0) return 0;
  if (minValue >= 0) return 1;
  return maxValue / (maxValue - minValue);
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
    const mid = Math.floor((g.first + g.last) / 2);
    indexToLabel.set(mid, label);
  });

  return indexToLabel;
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
  const volumeZeroOffset = getZeroOffset(minVolume, maxVolume);
  const underlyingDomain = getUnderlyingDomain(rows);
  const includeDateOnXAxis = new Set(rows.map((r) => new Date(r.timestamp).toDateString())).size > 1;
  const dateMarkerMeta = getDateMarkerMeta(rows.map((r) => r.timestamp));

  return (
    <div className="h-[540px]">
      <ResponsiveContainer width="100%" height="75%">
        <ComposedChart data={rows} margin={{ top: 10, right: 70, left: 70, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.25} />
          <XAxis dataKey="timestamp" tickFormatter={(value) => formatFlowXAxisLabel(String(value), includeDateOnXAxis)} stroke="#f2f2f2" minTickGap={24} hide />
          <YAxis yAxisId="price" stroke="#f2f2f2" orientation="left" domain={underlyingDomain} tickFormatter={(v) => `$${Math.round(Number(v))}`} tick={{ fontSize: 10 }} tickMargin={8} width={62} label={{ value: "Underlying Price", angle: -90, position: "left", fill: "#f2f2f2", fontSize: 10, offset: 16 }} />
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
        <ComposedChart data={rows} margin={{ top: 0, right: 70, left: 70, bottom: 28 }}>
          <defs>
            <linearGradient id="netVolumeSplit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.55} />
              <stop offset={`${Math.max(0, Math.min(1, volumeZeroOffset)) * 100}%`} stopColor="#22c55e" stopOpacity={0.55} />
              <stop offset={`${Math.max(0, Math.min(1, volumeZeroOffset)) * 100}%`} stopColor="#ef4444" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.2} vertical={false} />
          <XAxis
            dataKey="timestamp"
            stroke="#f2f2f2"
            minTickGap={24}
            tick={(props: { x?: number | string; y?: number | string; payload?: { value?: string | number }; index?: number }) => {
              const x = Number(props?.x ?? 0);
              const y = Number(props?.y ?? 0);
              const payload = props?.payload;
              const index = Number(props?.index ?? -1);
              const ts = String(payload?.value || "");
              const timeLabel = formatFlowXAxisLabel(ts, false);
              const dateLabel = dateMarkerMeta.get(index);
              return (
                <g transform={`translate(${x},${y})`}>
                  <text dy={12} textAnchor="middle" fill="#f2f2f2" fontSize={10}>{timeLabel}</text>
                  {dateLabel ? <text dy={24} textAnchor="middle" fill="#cfcfcf" fontSize={9}>{dateLabel}</text> : null}
                </g>
              );
            }}
          />
          <YAxis yAxisId="volume" orientation="right" stroke="#f2f2f2" domain={[minVolume, maxVolume]} tickFormatter={(v) => (Math.round(Number(v) / 10_000) * 10_000).toLocaleString()} tick={{ fontSize: 10 }} tickMargin={8} width={62} label={{ value: "Net Volume", angle: 90, position: "right", fill: "#f2f2f2", fontSize: 10, offset: 16 }} />
          <Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleString()} formatter={(value) => [Number(value ?? 0).toLocaleString(), "Net Volume"]} />
          <ReferenceLine yAxisId="volume" y={0} stroke="#f2f2f2" opacity={0.6} />
          <Area
            yAxisId="volume"
            type="monotone"
            dataKey="netVolume"
            name="Net Volume"
            stroke="#f2f2f2"
            strokeOpacity={0.5}
            fill="url(#netVolumeSplit)"
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function FlowAnalysisPage() {
  const { timeframe, getMaxDataPoints, symbol } = useTimeframe();
  const maxPoints = getMaxDataPoints();
  const windowUnits = Math.max(1, Math.min(90, maxPoints));

  const {
    data: flowByType,
    loading: flowLoading,
    error: flowError,
  } = useApiData<FlowByTypePoint[]>(
    `/api/flow/by-type?symbol=${symbol}&timeframe=${timeframe}&window_units=${windowUnits}`,
    { refreshInterval: 5000 },
  );

  const { data: flowByExpiration, error: expirationError } = useApiData<FlowByExpirationPoint[]>(
    `/api/flow/by-expiration?symbol=${symbol}&timeframe=${timeframe}&window_units=${windowUnits}&limit=500`,
    { refreshInterval: 5000 },
  );

  const { data: flowByStrike, error: strikeError } = useApiData<FlowByStrikePoint[]>(
    `/api/flow/by-strike?symbol=${symbol}&timeframe=${timeframe}&window_units=${windowUnits}&limit=500`,
    { refreshInterval: 5000 },
  );

  const { data: underlyingHistory } = useApiData<UnderlyingPoint[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${timeframe}&window_units=${windowUnits}`,
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
    return attachUnderlyingPrice(aligned, underlyingHistory || []);
  }, [mainBaseSeries, timelineTimestamps, underlyingHistory]);

  const expirationOptions = useMemo(
    () =>
      Array.from(new Set((flowByExpiration || []).map((r) => r.expiration).filter(Boolean))).sort(),
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
    if (selectedExpirations.size === 0) return source;
    return source.filter((r) => selectedExpirations.has(r.expiration));
  }, [flowByExpiration, selectedExpirations]);

  const strikeRowsFiltered = useMemo(() => {
    const source = flowByStrike || [];
    if (selectedStrikes.size === 0) return source;
    return source.filter((r) => selectedStrikes.has(String(r.strike)));
  }, [flowByStrike, selectedStrikes]);

  const expirationSeries = useMemo(() => {
    const base = buildTimeseriesFromNetRows(expirationRowsFiltered, maxPoints);
    const aligned = alignSeriesToTimeline(base, timelineTimestamps);
    return attachUnderlyingPrice(aligned, underlyingHistory || []);
  }, [expirationRowsFiltered, maxPoints, timelineTimestamps, underlyingHistory]);

  const strikeSeries = useMemo(() => {
    const base = buildTimeseriesFromNetRows(strikeRowsFiltered, maxPoints);
    const aligned = alignSeriesToTimeline(base, timelineTimestamps);
    return attachUnderlyingPrice(aligned, underlyingHistory || []);
  }, [strikeRowsFiltered, maxPoints, timelineTimestamps, underlyingHistory]);

  const putCallRatioSeries = useMemo(() => {
    const base = buildPutCallRatioSeries(flowByType || [], maxPoints);
    const byTs = new Map(base.map((r) => [r.timestamp, r.ratio]));
    return timelineTimestamps.map((timestamp) => ({
      timestamp,
      ratio: byTs.get(timestamp) ?? 0,
    }));
  }, [flowByType, maxPoints, timelineTimestamps]);

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
        <FullWidthFlowChart rows={expirationSeries} />
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Put/Call Ratio"
          tooltip="Put/call volume ratio over time using the selected timeframe."
        />
        {putCallRatioSeries.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No put/call ratio data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={putCallRatioSeries} margin={{ top: 10, right: 70, left: 70, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.2} />
              <XAxis dataKey="timestamp" tickFormatter={safeTimeLabel} stroke="#f2f2f2" minTickGap={24} tick={{ fontSize: 10 }} />
              <YAxis stroke="#f2f2f2" tick={{ fontSize: 10 }} tickMargin={8} width={62} />
              <Tooltip
                labelFormatter={(value) => new Date(String(value)).toLocaleString()}
                formatter={(value) => [Number(value ?? 0).toFixed(2), "Put/Call Ratio"]}
              />
              <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />
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
        <FullWidthFlowChart rows={strikeSeries} />
      </section>
    </div>
  );
}
