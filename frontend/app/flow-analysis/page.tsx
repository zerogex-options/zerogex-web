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
import { useApiData, useOptionFlow } from "@/hooks/useApiData";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import MetricCard from "@/components/MetricCard";
import TooltipWrapper from "@/components/TooltipWrapper";
import { useTimeframe } from "@/core/TimeframeContext";
import { omitClosedMarketTimes } from "@/core/utils";

interface FlowRow {
  time_window_start?: string;
  time_window_end?: string;
  interval_timestamp?: string | null;
  option_type?: string | null;
  strike?: number | string | null;
  expiration?: string | null;
  expiration_date?: string | null;
  expiry?: string | null;
  total_volume?: number;
  total_premium?: number;
}

interface TimeseriesRow {
  timestamp: string;
  time: string;
  callPremium: number;
  putPremium: number;
  netVolume: number;
  positiveNetVolume: number;
  negativeNetVolume: number;
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

function getTimestamp(row: FlowRow) {
  return row.interval_timestamp || row.time_window_end || row.time_window_start || "";
}

function getExpiration(row: FlowRow) {
  return row.expiration_date || row.expiration || row.expiry || "";
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

function buildTimeseries(rows: FlowRow[], maxPoints: number): TimeseriesRow[] {
  const grouped = new Map<string, { callPremium: number; putPremium: number; callVolume: number; putVolume: number }>();

  rows.forEach((row) => {
    const ts = getTimestamp(row);
    if (!ts) return;

    const type = (row.option_type || "").toUpperCase();
    const premium = Number(row.total_premium || 0);
    const volume = Number(row.total_volume || 0);
    const current = grouped.get(ts) || {
      callPremium: 0,
      putPremium: 0,
      callVolume: 0,
      putVolume: 0,
    };

    if (type === "CALL") {
      current.callPremium += premium;
      current.callVolume += volume;
    }
    if (type === "PUT") {
      current.putPremium += premium;
      current.putVolume += volume;
    }

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
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return omitClosedMarketTimes(chartRows, (r) => r.timestamp).slice(-maxPoints);
}

function FullWidthFlowChart({ rows }: { rows: TimeseriesRow[] }) {
  return (
    <>
      {rows.length === 0 ? (
        <div className="text-gray-400 text-center py-8">No chart data available</div>
      ) : (
        <ResponsiveContainer width="100%" height={540}>
          <ComposedChart data={rows} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.25} />
            <XAxis dataKey="time" stroke="#f2f2f2" minTickGap={24} />
            <YAxis
              yAxisId="premium"
              stroke="#f2f2f2"
              tickFormatter={(v) => `$${(Number(v) / 1_000_000).toFixed(1)}M`}
            />
            <YAxis yAxisId="volume" orientation="right" stroke="#f2f2f2" />
            <Tooltip
              formatter={(value, name) => {
                const n = Number(value ?? 0);
                if (name === "Call Premium" || name === "Put Premium") {
                  return [`$${n.toLocaleString()}`, name];
                }
                return [n.toLocaleString(), name];
              }}
            />
            <Legend />
            <Line
              yAxisId="premium"
              type="monotone"
              dataKey="callPremium"
              name="Call Premium"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="premium"
              type="monotone"
              dataKey="putPremium"
              name="Put Premium"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
            <ReferenceLine yAxisId="volume" y={0} stroke="#f2f2f2" opacity={0.5} />
            <Area
              yAxisId="volume"
              type="monotone"
              dataKey="positiveNetVolume"
              name="Net Volume (+)"
              stroke="#22c55e"
              fill="#22c55e"
              fillOpacity={0.35}
            />
            <Area
              yAxisId="volume"
              type="monotone"
              dataKey="negativeNetVolume"
              name="Net Volume (-)"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.35}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </>
  );
}

export default function FlowAnalysisPage() {
  const { timeframe, getMaxDataPoints, symbol } = useTimeframe();
  const maxPoints = getMaxDataPoints();
  const windowUnits = maxPoints;

  const {
    data: flowData,
    loading: flowLoading,
    error: flowError,
  } = useOptionFlow(symbol, timeframe, windowUnits, 5000);

  const { data: flowByExpiration, error: expirationError } = useApiData<FlowRow[]>(
    `/api/flow/by-expiration?symbol=${symbol}&timeframe=${timeframe}&window_units=${windowUnits}&limit=500`,
    { refreshInterval: 5000 },
  );

  const { data: flowByStrike, error: strikeError } = useApiData<FlowRow[]>(
    `/api/flow/by-strike?symbol=${symbol}&timeframe=${timeframe}&window_units=${windowUnits}&limit=500`,
    { refreshInterval: 5000 },
  );

  const latestSnapshot = useMemo(() => {
    const rows = flowData || [];
    if (rows.length === 0) return null;

    const latestTimestamp = rows.reduce((latest, row) => {
      const ts = getTimestamp(row);
      if (!ts) return latest;
      if (!latest) return ts;
      return new Date(ts).getTime() > new Date(latest).getTime() ? ts : latest;
    }, "");

    const latestRows = rows.filter((r) => getTimestamp(r) === latestTimestamp);
    const call = latestRows.find((r) => (r.option_type || "").toUpperCase() === "CALL");
    const put = latestRows.find((r) => (r.option_type || "").toUpperCase() === "PUT");

    const callVolume = Number(call?.total_volume || 0);
    const putVolume = Number(put?.total_volume || 0);
    const callPremium = Number(call?.total_premium || 0);
    const putPremium = Number(put?.total_premium || 0);

    return {
      timestamp: latestTimestamp,
      callVolume,
      putVolume,
      callPremium,
      putPremium,
      netFlow: callVolume - putVolume,
      netPremium: callPremium - putPremium,
      putCallRatio: callVolume > 0 ? putVolume / callVolume : 0,
    };
  }, [flowData]);

  const mainSeries = useMemo(() => buildTimeseries(flowData || [], maxPoints), [flowData, maxPoints]);

  const expirationOptions = useMemo(
    () =>
      Array.from(
        new Set((flowByExpiration || []).map((r) => getExpiration(r)).filter(Boolean)),
      ).sort(),
    [flowByExpiration],
  );
  const [selectedExpirations, setSelectedExpirations] = useState<Set<string>>(new Set());

  const strikeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          (flowByStrike || [])
            .map((r) => (r.strike !== undefined && r.strike !== null ? String(r.strike) : ""))
            .filter(Boolean),
        ),
      ).sort((a, b) => Number(a) - Number(b)),
    [flowByStrike],
  );
  const [selectedStrikes, setSelectedStrikes] = useState<Set<string>>(new Set());

  const expirationRowsFiltered = useMemo(() => {
    const source = flowByExpiration || [];
    if (selectedExpirations.size === 0) return source;
    return source.filter((r) => selectedExpirations.has(getExpiration(r)));
  }, [flowByExpiration, selectedExpirations]);

  const strikeRowsFiltered = useMemo(() => {
    const source = flowByStrike || [];
    if (selectedStrikes.size === 0) return source;
    return source.filter((r) => selectedStrikes.has(String(r.strike)));
  }, [flowByStrike, selectedStrikes]);

  const expirationSeries = useMemo(
    () => buildTimeseries(expirationRowsFiltered, maxPoints),
    [expirationRowsFiltered, maxPoints],
  );
  const strikeSeries = useMemo(() => buildTimeseries(strikeRowsFiltered, maxPoints), [strikeRowsFiltered, maxPoints]);

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

  if (flowLoading && !flowData) return <LoadingSpinner size="lg" />;

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
