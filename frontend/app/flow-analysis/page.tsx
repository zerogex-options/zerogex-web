"use client";

import { Info } from "lucide-react";
import { useMemo } from "react";
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
import {
  useOptionFlow,
  useSmartMoneyFlow,
  useApiData,
} from "@/hooks/useApiData";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import MetricCard from "@/components/MetricCard";
import OptionsFlowChart from "@/components/OptionsFlowChart";
import TooltipWrapper from "@/components/TooltipWrapper";
import { useTimeframe } from "@/core/TimeframeContext";

interface FlowByStrikeRow {
  strike: number;
  total_volume: number;
  total_premium: number;
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

export default function FlowAnalysisPage() {
  const { timeframe, getMaxDataPoints, symbol } = useTimeframe();
  const maxPoints = getMaxDataPoints();
  const windowUnits = maxPoints;

  const {
    data: flowData,
    loading: flowLoading,
    error: flowError,
  } = useOptionFlow(symbol, timeframe, windowUnits, 5000);
  const {
    data: smartMoney,
    loading: smartLoading,
    error: smartError,
  } = useSmartMoneyFlow(symbol, 30, timeframe, windowUnits, 10000);
  const { data: flowByStrike, error: strikeError } = useApiData<
    FlowByStrikeRow[]
  >(
    `/api/flow/by-strike?symbol=${symbol}&timeframe=${timeframe}&window_units=${windowUnits}&limit=25`,
    { refreshInterval: 5000 },
  );

  const callFlow = flowData?.find((f) => f.option_type === "CALL");
  const putFlow = flowData?.find((f) => f.option_type === "PUT");

  const totalCallVolume = Number(callFlow?.total_volume || 0);
  const totalPutVolume = Number(putFlow?.total_volume || 0);
  const totalCallPremium = Number(callFlow?.total_premium || 0);
  const totalPutPremium = Number(putFlow?.total_premium || 0);
  const netFlow = totalCallVolume - totalPutVolume;
  const netPremium = totalCallPremium - totalPutPremium;
  const putCallRatio =
    totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;

  const putCallRatioSeries = useMemo(() => {
    const grouped = new Map<string, { calls: number; puts: number }>();

    (flowData || []).forEach((row) => {
      const ts = row.interval_timestamp || row.time_window_end;
      if (!ts) return;
      const key = String(ts);
      const current = grouped.get(key) || { calls: 0, puts: 0 };
      const volume = Number(row.total_volume || 0);
      if ((row.option_type || "").toUpperCase() === "CALL") current.calls += volume;
      if ((row.option_type || "").toUpperCase() === "PUT") current.puts += volume;
      grouped.set(key, current);
    });

    return Array.from(grouped.entries())
      .map(([timestamp, value]) => {
        const ratio = value.calls > 0 ? value.puts / value.calls : 0;
        return { timestamp, time: safeTimeLabel(timestamp), ratio };
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-maxPoints);
  }, [flowData, maxPoints]);

  const byStrikeChart = useMemo(
    () =>
      (flowByStrike || []).map((row) => ({
        strike: Number(row.strike),
        volume: Number(row.total_volume || 0),
        premiumM: Number(row.total_premium || 0) / 1_000_000,
      })),
    [flowByStrike],
  );

  const smartMoneyRows = useMemo(
    () =>
      (smartMoney || []).map((row) => ({
        time: safeTimeLabel(row.time_window_end),
        type: row.option_type || "--",
        strike: row.strike ?? "--",
        volume: Number(row.total_volume || 0),
        premium: Number(row.total_premium || 0),
        score: Number(row.unusual_activity_score || 0),
      })),
    [smartMoney],
  );

  if (flowLoading && !flowData) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Flow Analysis</h1>
      {flowError && <ErrorMessage message={flowError} />}


      <section className="mb-8">
        <OptionsFlowChart />
      </section>

      <section className="mb-8">
        <SectionTitle
          title="Flow Snapshot"
          tooltip="Snapshot metrics over selected symbol/time window."
        />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard
            title="Call Volume"
            value={totalCallVolume.toLocaleString()}
            subtitle={`$${(totalCallPremium / 1_000_000).toFixed(2)}M premium`}
            trend="bullish"
            tooltip="Total call contracts traded in-window."
            theme="dark"
          />
          <MetricCard
            title="Put Volume"
            value={totalPutVolume.toLocaleString()}
            subtitle={`$${(totalPutPremium / 1_000_000).toFixed(2)}M premium`}
            trend="bearish"
            tooltip="Total put contracts traded in-window."
            theme="dark"
          />
          <MetricCard
            title="Net Flow"
            value={netFlow.toLocaleString()}
            trend={netFlow > 0 ? "bullish" : "bearish"}
            tooltip="Call volume minus put volume."
            theme="dark"
          />
          <MetricCard
            title="Net Premium"
            value={`$${(netPremium / 1_000_000).toFixed(2)}M`}
            trend={netPremium > 0 ? "bullish" : "bearish"}
            tooltip="Call premium minus put premium."
            theme="dark"
          />
          <MetricCard
            title="Put/Call Ratio"
            value={putCallRatio.toFixed(2)}
            trend={putCallRatio > 1 ? "bearish" : "bullish"}
            tooltip="Put volume divided by call volume."
            theme="dark"
          />
        </div>
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Put/Call Ratio Timeseries"
          tooltip="Put/call ratio over the selected timeframe using a 90-unit window from /api/flow/by-type."
        />
        {putCallRatioSeries.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            No put/call ratio timeseries available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <ResponsiveContainer width="100%" height={300}>
            <LineChart data={putCallRatioSeries}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#968f92"
                opacity={0.3}
              />
              <XAxis dataKey="time" stroke="#f2f2f2" />
              <YAxis stroke="#f2f2f2" domain={["auto", "auto"]} />
              <Tooltip formatter={(value) => Number(value ?? 0).toFixed(2)} />
              <Legend />
              <Line
                dataKey="ratio"
                name="Put/Call Ratio"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Flow by Strike"
          tooltip="Volume and premium by strike; premium uses secondary axis."
        />
        {strikeError ? (
          <ErrorMessage message={strikeError} />
        ) : byStrikeChart.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            No flow-by-strike data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <ResponsiveContainer width="100%" height={340}>
            <BarChart
              data={byStrikeChart}
              margin={{ top: 5, right: 45, left: 25, bottom: 5 }}
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
              <YAxis yAxisId="left" stroke="#f2f2f2" />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#f2f2f2"
                tickFormatter={(v) => `${Number(v).toFixed(1)}M`}
              />
              <Tooltip
                formatter={(value, name) => {
                  const n = Number(value ?? 0);
                  return [
                    name === "premiumM"
                      ? `$${n.toFixed(2)}M`
                      : n.toLocaleString(),
                    String(name),
                  ];
                }}
              />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="volume"
                name="Volume"
                fill="#10b981"
              />
              <Bar
                yAxisId="right"
                dataKey="premiumM"
                name="Premium ($M)"
                fill="#60a5fa"
              />
            </BarChart>
          </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Smart Money"
          tooltip="Raw smart-money rows from /api/flow/smart-money."
        />
        {smartError ? (
          <ErrorMessage message={smartError} />
        ) : smartLoading ? (
          <LoadingSpinner />
        ) : smartMoneyRows.length === 0 ? (
          <div className="text-gray-400 text-center py-8">
            No unusual activity detected
          </div>
        ) : (
          <div className="overflow-auto max-h-[420px]">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-600">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Strike</th>
                  <th className="py-2 pr-4">Volume</th>
                  <th className="py-2 pr-4">Premium</th>
                  <th className="py-2 pr-4">Score</th>
                </tr>
              </thead>
              <tbody>
                {smartMoneyRows.map((r, i) => (
                  <tr
                    key={`${r.time}-${r.strike}-${i}`}
                    className="border-b border-gray-700/50"
                  >
                    <td className="py-2 pr-4">{r.time}</td>
                    <td className="py-2 pr-4">{r.type}</td>
                    <td className="py-2 pr-4">
                      {typeof r.strike === "number"
                        ? `$${Number(r.strike).toFixed(2)}`
                        : r.strike}
                    </td>
                    <td className="py-2 pr-4">{r.volume.toLocaleString()}</td>
                    <td className="py-2 pr-4">${r.premium.toLocaleString()}</td>
                    <td className="py-2 pr-4">{r.score.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
