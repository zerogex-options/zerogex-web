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

function getZeroOffset(minValue: number, maxValue: number) {
  if (maxValue <= 0) return 0;
  if (minValue >= 0) return 1;
  return maxValue / (maxValue - minValue);
}

function FullWidthFlowChart({ rows }: { rows: TimeseriesRow[] }) {
  if (rows.length === 0) {
    return <div className="text-gray-400 text-center py-8">No chart data available</div>;
  }

  const maxPremium = Math.max(0, ...rows.map((r) => r.callPremium), ...rows.map((r) => r.putPremium));
  const minVolume = Math.min(0, ...rows.map((r) => r.netVolume));
  const maxVolume = Math.max(0, ...rows.map((r) => r.netVolume));
  const volumeZeroOffset = getZeroOffset(minVolume, maxVolume);

  return (
    <div className="h-[540px]">
      <ResponsiveContainer width="100%" height="75%">
        <ComposedChart data={rows} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.25} />
          <XAxis dataKey="time" stroke="#f2f2f2" minTickGap={24} hide />
          <YAxis yAxisId="price" stroke="#f2f2f2" orientation="left" />
          <YAxis
            yAxisId="premium"
            stroke="#f2f2f2"
            orientation="right"
            domain={[0, Math.max(1, maxPremium)]}
            tickFormatter={(v) => `$${(Number(v) / 1_000_000).toFixed(1)}M`}
          />
          <Tooltip
            formatter={(value, name) => {
              const n = Number(value ?? 0);
              if (name === "Underlying") return [`$${n.toFixed(2)}`, name];
              return [`$${n.toLocaleString()}`, name];
            }}
          />
          <Legend />
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
        <ComposedChart data={rows} margin={{ top: 0, right: 30, left: 20, bottom: 10 }}>
          <defs>
            <linearGradient id="netVolumeSplit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.55} />
              <stop offset={`${Math.max(0, Math.min(1, volumeZeroOffset)) * 100}%`} stopColor="#22c55e" stopOpacity={0.55} />
              <stop offset={`${Math.max(0, Math.min(1, volumeZeroOffset)) * 100}%`} stopColor="#ef4444" stopOpacity={0.55} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.2} vertical={false} />
          <XAxis dataKey="time" stroke="#f2f2f2" minTickGap={24} />
          <YAxis yAxisId="volume" orientation="right" stroke="#f2f2f2" domain={[minVolume, maxVolume]} />
          <Tooltip formatter={(value) => [Number(value ?? 0).toLocaleString(), "Net Volume"]} />
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

  const mainSeries = useMemo(() => {
    const baseRows = buildTimeseriesFromByType(flowByType || [], maxPoints);
    return attachUnderlyingPrice(baseRows, underlyingHistory || []);
  }, [flowByType, maxPoints, underlyingHistory]);

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

  const expirationSeries = useMemo(
    () =>
      attachUnderlyingPrice(
        buildTimeseriesFromNetRows(expirationRowsFiltered, maxPoints),
        underlyingHistory || [],
      ),
    [expirationRowsFiltered, maxPoints, underlyingHistory],
  );

  const strikeSeries = useMemo(
    () =>
      attachUnderlyingPrice(
        buildTimeseriesFromNetRows(strikeRowsFiltered, maxPoints),
        underlyingHistory || [],
      ),
    [strikeRowsFiltered, maxPoints, underlyingHistory],
  );

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
          title="Net Premium + Net Volume Timeseries"
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
