"use client";

import { useMemo, useState } from "react";
import {
  Bar,
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
import { useTimeframe } from "@/core/TimeframeContext";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FlowByExpirationPoint {
  timestamp: string;
  expiration: string;
  volume: number;
  premium: number;
  net_volume: number;
  net_premium: number;
  underlying_price?: number | null;
}

interface FlowByStrikePoint {
  timestamp: string;
  strike: number | string;
  volume: number;
  premium: number;
  net_volume: number;
  net_premium: number;
  underlying_price?: number | null;
}

interface ContractDataPoint {
  timestamp: string;
  bid_volume: number;
  mid_volume: number;
  ask_volume: number;
  no_side_volume: number;
  avg_fill: number | null;
  underlying_price?: number | null;
}

interface ContractSummary {
  date: string;
  volume: number;
  open_interest: number;
  avg_price: number;
  premium: number;
  multi_pct: number;
  otm_pct: number;
}

interface ContractResponse {
  contract: string;
  days_to_expiry: number;
  summary: ContractSummary;
  data: ContractDataPoint[];
}

// ── Date / session helpers ────────────────────────────────────────────────────

function getETDateKey(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function getCurrentETDateKey(): string {
  return getETDateKey(new Date().toISOString());
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
        timeZone: "America/New_York",
      });
}

function is30MinBoundary(ts: string): boolean {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return false;
  const minutes = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      minute: "2-digit",
    }).format(d),
  );
  return minutes % 30 === 0;
}

function formatDateLabel(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
}

function getDateMarkerMeta(timestamps: string[]): Map<number, string> {
  const meta = new Map<number, string>();
  let prevDate = "";
  timestamps.forEach((ts, i) => {
    const dateKey = getETDateKey(ts);
    if (dateKey && dateKey !== prevDate) {
      meta.set(i, formatDateLabel(ts));
      prevDate = dateKey;
    }
  });
  return meta;
}

/** Format a session date as MM/DD/YYYY */
function formatSessionDate(dateKey: string): string {
  if (!dateKey || !dateKey.includes("-")) return dateKey;
  const [y, m, d] = dateKey.split("-");
  return `${m}/${d}/${y}`;
}

function isActiveExpiration(expiration?: string, todayKey: string = getCurrentETDateKey()) {
  if (!expiration) return false;
  const normalized = expiration.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return true;
  return normalized >= todayKey;
}

// ── Custom Legend ─────────────────────────────────────────────────────────────

function ContractLegend({
  latestPoint,
  theme,
}: {
  latestPoint: ContractDataPoint | null;
  theme?: "dark" | "light";
}) {
  const isDark = theme !== "light";
  const bidVol = latestPoint?.bid_volume ?? 0;
  const midVol = latestPoint?.mid_volume ?? 0;
  const askVol = latestPoint?.ask_volume ?? 0;
  const noSideVol = latestPoint?.no_side_volume ?? 0;

  const items = [
    { label: "Bid", value: `${Number(bidVol).toLocaleString()} Vol`, color: "#f45854" },
    { label: "Mid", value: `${Number(midVol).toLocaleString()} Vol`, color: "#22c55e" },
    { label: "Ask", value: `${Number(askVol).toLocaleString()} Vol`, color: "#3b82f6" },
    { label: "No Side", value: `${Number(noSideVol).toLocaleString()} Vol`, color: "#9ca3af" },
    { label: "Avg Fill", value: latestPoint?.avg_fill != null ? `$${Number(latestPoint.avg_fill).toFixed(2)}` : "--", color: "#facc15" },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
      style={{ color: isDark ? "#f2f2f2" : "#374151" }}
    >
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-2.5 h-2.5 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span style={{ color: isDark ? "#d1d5db" : "#6b7280" }}>{item.label}:</span>
          <span className="font-semibold">{item.value}</span>
          {i < items.length - 1 && (
            <span style={{ color: isDark ? "#4b5563" : "#d1d5db", marginLeft: 4 }}>|</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ── Stats Header ──────────────────────────────────────────────────────────────

function ContractStatsHeader({
  summary,
  sessionDateKey,
  theme,
}: {
  summary: ContractSummary | null;
  sessionDateKey: string;
  theme?: "dark" | "light";
}) {
  const isDark = theme !== "light";
  const dateLabel = summary?.date
    ? formatSessionDate(summary.date)
    : formatSessionDate(sessionDateKey);

  if (!summary) {
    return (
      <div
        className="px-4 py-2 text-sm"
        style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
      >
        No summary data
      </div>
    );
  }

  const stats = [
    { label: "Vol", value: Number(summary.volume).toLocaleString() },
    { label: "OI", value: Number(summary.open_interest).toLocaleString() },
    { label: "Avg", value: `$${Number(summary.avg_price).toFixed(2)}` },
    { label: "Prem", value: `$${Number(summary.premium).toLocaleString()}` },
    { label: "Multi", value: `${Number(summary.multi_pct).toFixed(0)}%` },
    { label: "%OTM", value: `${Number(summary.otm_pct).toFixed(0)}%` },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm border-b"
      style={{
        color: isDark ? "#f2f2f2" : "#374151",
        borderColor: isDark ? "rgba(150,143,146,0.2)" : "rgba(0,0,0,0.1)",
      }}
    >
      <span className="font-semibold" style={{ color: isDark ? "#d1d5db" : "#6b7280" }}>
        {dateLabel}:
      </span>
      {stats.map((s) => (
        <span key={s.label} className="flex items-center gap-1">
          <span style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>{s.label}:</span>
          <span className="font-semibold">{s.value}</span>
        </span>
      ))}
    </div>
  );
}

// ── Contract Chart ────────────────────────────────────────────────────────────

interface ChartRow extends ContractDataPoint {
  time: string;
}

function ContractChart({
  rows,
  latestPoint,
  summary,
  sessionDateKey,
  theme,
}: {
  rows: ChartRow[];
  latestPoint: ContractDataPoint | null;
  summary: ContractSummary | null;
  sessionDateKey: string;
  theme?: "dark" | "light";
}) {
  const isDark = theme !== "light";

  if (rows.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-64 text-sm"
        style={{ color: isDark ? "#9ca3af" : "#6b7280" }}
      >
        No contract data available for the selected parameters.
      </div>
    );
  }

  const dateMarkerMeta = getDateMarkerMeta(rows.map((r) => r.timestamp));

  // Volume axis
  const maxVol = Math.max(
    0,
    ...rows.map((r) => (r.bid_volume ?? 0) + (r.mid_volume ?? 0) + (r.ask_volume ?? 0) + (r.no_side_volume ?? 0)),
  );
  const volDomainMax = Math.max(1, Math.ceil(maxVol * 1.15));

  // Price axis for avg fill
  const fillPrices = rows.map((r) => r.avg_fill).filter((v): v is number => v != null && Number.isFinite(v));
  const minFill = fillPrices.length > 0 ? Math.min(...fillPrices) : 0;
  const maxFill = fillPrices.length > 0 ? Math.max(...fillPrices) : 1;
  const fillPad = Math.max(0.1, (maxFill - minFill) * 0.15);
  const fillDomainMin = Math.max(0, minFill - fillPad);
  const fillDomainMax = maxFill + fillPad;

  const gridStroke = isDark ? "#968f92" : "#d1d5db";
  const axisStroke = isDark ? "#f2f2f2" : "#374151";
  const axisTickStyle = { fontSize: 10, fill: axisStroke };

  return (
    <div>
      <ContractStatsHeader summary={summary} sessionDateKey={sessionDateKey} theme={theme} />
      <ContractLegend latestPoint={latestPoint} theme={theme} />
      <div className="h-[480px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={{ top: 10, right: 72, left: 72, bottom: 32 }}
            barCategoryGap="10%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.25} vertical={false} />
            <XAxis
              dataKey="timestamp"
              stroke={axisStroke}
              interval={0}
              minTickGap={28}
              padding={{ left: 0, right: 0 }}
              tickLine={false}
              tick={(props: {
                x?: number | string;
                y?: number | string;
                payload?: { value?: string | number };
                index?: number;
              }) => {
                const x = Number(props?.x ?? 0);
                const y = Number(props?.y ?? 0);
                const payload = props?.payload;
                const index = Number(props?.index ?? -1);
                const ts = String(payload?.value || "");
                const timeLabel = safeTimeLabel(ts);
                const dateLabel = dateMarkerMeta.get(index);
                const showTime = is30MinBoundary(ts) || Boolean(dateLabel);
                if (!showTime && !dateLabel) return <g transform={`translate(${x},${y})`} />;
                return (
                  <g transform={`translate(${x},${y})`}>
                    <line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} />
                    {showTime ? (
                      <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>
                        {timeLabel}
                      </text>
                    ) : null}
                    {dateLabel ? (
                      <text dy={26} textAnchor="middle" fill={isDark ? "#cfcfcf" : "#6b7280"} fontSize={9}>
                        {dateLabel}
                      </text>
                    ) : null}
                  </g>
                );
              }}
            />
            <YAxis
              yAxisId="volume"
              orientation="left"
              stroke={axisStroke}
              domain={[0, volDomainMax]}
              tickFormatter={(v) => {
                const n = Number(v);
                if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
                return String(Math.round(n));
              }}
              tick={axisTickStyle}
              tickMargin={6}
              width={64}
              label={{
                value: "Volume",
                angle: -90,
                position: "insideLeft",
                fill: axisStroke,
                fontSize: 10,
                offset: -4,
                dy: 30,
              }}
            />
            <YAxis
              yAxisId="price"
              orientation="right"
              stroke={axisStroke}
              domain={[fillDomainMin, fillDomainMax]}
              tickFormatter={(v) => `$${Number(v).toFixed(2)}`}
              tick={axisTickStyle}
              tickMargin={6}
              width={64}
              label={{
                value: "Avg Fill ($)",
                angle: 90,
                position: "insideRight",
                fill: axisStroke,
                fontSize: 10,
                offset: 4,
                dy: -30,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? "#1f1d1e" : "#ffffff",
                borderColor: isDark ? "#423d3f" : "#d1d5db",
                borderRadius: 6,
              }}
              labelStyle={{ color: isDark ? "#f2f2f2" : "#374151", fontWeight: 600, fontSize: 11 }}
              itemStyle={{ color: isDark ? "#d1d5db" : "#374151", fontSize: 11 }}
              labelFormatter={(value) => safeTimeLabel(String(value))}
              formatter={(value, name) => {
                const n = Number(value ?? 0);
                if (name === "Avg Fill") return [`$${n.toFixed(2)}`, name];
                return [n.toLocaleString(), name];
              }}
            />
            <ReferenceLine yAxisId="volume" y={0} stroke={gridStroke} opacity={0.5} />

            {/* Stacked volume bars */}
            <Bar
              yAxisId="volume"
              dataKey="bid_volume"
              name="Bid"
              stackId="vol"
              fill="#f45854"
              isAnimationActive={false}
            />
            <Bar
              yAxisId="volume"
              dataKey="mid_volume"
              name="Mid"
              stackId="vol"
              fill="#22c55e"
              isAnimationActive={false}
            />
            <Bar
              yAxisId="volume"
              dataKey="ask_volume"
              name="Ask"
              stackId="vol"
              fill="#3b82f6"
              isAnimationActive={false}
            />
            <Bar
              yAxisId="volume"
              dataKey="no_side_volume"
              name="No Side"
              stackId="vol"
              fill="#9ca3af"
              isAnimationActive={false}
            />

            {/* Avg fill price line */}
            <Line
              yAxisId="price"
              type="monotone"
              dataKey="avg_fill"
              name="Avg Fill"
              stroke="#facc15"
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OptionContractsPage() {
  const { symbol } = useTimeframe();

  // ── Selectors
  const [session, setSession] = useState<"current" | "prior">("current");
  const [selectedExpiration, setSelectedExpiration] = useState<string>("");
  const [selectedStrike, setSelectedStrike] = useState<string>("");
  const [optionType, setOptionType] = useState<"call" | "put">("call");

  // ── Fetch available expirations using flow/by-expiration
  const { data: expirationData, error: expirationError, loading: expirationLoading } = useApiData<FlowByExpirationPoint[]>(
    `/api/flow/by-expiration?symbol=${symbol}&session=${session}&limit=50000`,
    { refreshInterval: 60000 },
  );

  // ── Fetch available strikes using flow/by-strike
  const { data: strikeData, error: strikeError, loading: strikeLoading } = useApiData<FlowByStrikePoint[]>(
    `/api/flow/by-strike?symbol=${symbol}&session=${session}&limit=50000`,
    { refreshInterval: 60000 },
  );

  // ── Derive available expirations
  const expirationOptions = useMemo(() => {
    if (!expirationData) return [];
    const todayKey = getCurrentETDateKey();
    return Array.from(
      new Set(
        expirationData
          .map((r) => r.expiration)
          .filter((exp) => isActiveExpiration(exp, todayKey)),
      ),
    ).sort();
  }, [expirationData]);

  // ── Derive available strikes
  const strikeOptions = useMemo(() => {
    if (!strikeData) return [];
    return Array.from(
      new Set(strikeData.map((r) => String(r.strike)).filter(Boolean)),
    ).sort((a, b) => Number(a) - Number(b));
  }, [strikeData]);

  // ── Auto-select first expiration / strike when options load
  const resolvedExpiration = selectedExpiration || expirationOptions[0] || "";
  const resolvedStrike = selectedStrike || strikeOptions[0] || "";

  // ── Derive the session date label from expiration data
  const sessionDateKey = useMemo(() => {
    if (!expirationData || expirationData.length === 0) return getCurrentETDateKey();
    const sorted = [...expirationData].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return getETDateKey(sorted[0].timestamp) || getCurrentETDateKey();
  }, [expirationData]);

  // ── Build contract endpoint URL
  const contractEndpoint = useMemo(() => {
    if (!resolvedExpiration || !resolvedStrike) return null;
    const params = new URLSearchParams({
      symbol,
      expiration: resolvedExpiration,
      strike: resolvedStrike,
      option_type: optionType,
      session,
    });
    return `/api/option/contract?${params.toString()}`;
  }, [symbol, resolvedExpiration, resolvedStrike, optionType, session]);

  // ── Fetch contract data
  const {
    data: contractData,
    loading: contractLoading,
    error: contractError,
  } = useApiData<ContractResponse>(
    contractEndpoint ?? "/api/option/contract",
    {
      enabled: contractEndpoint !== null,
      refreshInterval: 30000,
    },
  );

  // ── Build chart rows
  const chartRows = useMemo((): ChartRow[] => {
    if (!contractData?.data) return [];
    return contractData.data
      .map((p) => ({
        ...p,
        time: safeTimeLabel(p.timestamp),
      }))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [contractData]);

  // ── Latest data point for legend
  const latestPoint = useMemo((): ContractDataPoint | null => {
    if (chartRows.length === 0) return null;
    return chartRows[chartRows.length - 1];
  }, [chartRows]);

  // ── Contract display label (e.g. "AVGO 340 C 03/20/2026")
  const contractLabel = useMemo(() => {
    if (contractData?.contract) return contractData.contract;
    if (!resolvedExpiration || !resolvedStrike) return symbol;
    const typeChar = optionType === "call" ? "C" : "P";
    const expFormatted = resolvedExpiration.includes("-")
      ? (() => {
          const [y, m, d] = resolvedExpiration.split("-");
          return `${m}/${d}/${y}`;
        })()
      : resolvedExpiration;
    return `${symbol} ${resolvedStrike} ${typeChar} ${expFormatted}`;
  }, [contractData, resolvedExpiration, resolvedStrike, optionType, symbol]);

  const daysToExpiry = contractData?.days_to_expiry ?? null;

  // ── Shared select style
  const selectStyle: React.CSSProperties = {
    padding: "6px 10px",
    fontSize: 13,
    borderRadius: 6,
    border: "1px solid rgba(150,143,146,0.4)",
    backgroundColor: "#2a2628",
    color: "#f2f2f2",
    cursor: "pointer",
    outline: "none",
    minWidth: 120,
  };

  const dropdownLoadError = (expirationError && expirationError !== "No data available yet")
    ? expirationError
    : (strikeError && strikeError !== "No data available yet")
      ? strikeError
      : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Option Contracts</h1>

      {dropdownLoadError && (
        <div className="mb-4">
          <ErrorMessage message={dropdownLoadError} />
        </div>
      )}

      {/* ── Controls ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Session */}
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "#9ca3af" }}>Date</span>
          <select
            value={session}
            onChange={(e) => setSession(e.target.value as "current" | "prior")}
            style={selectStyle}
          >
            <option value="current">Current</option>
            <option value="prior">Prior</option>
          </select>
        </div>

        {/* Expiration */}
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "#9ca3af" }}>Expiration</span>
          <select
            value={resolvedExpiration}
            onChange={(e) => setSelectedExpiration(e.target.value)}
            style={selectStyle}
          >
            {expirationOptions.length === 0 ? (
              <option value="">{expirationLoading ? "Loading…" : expirationError ? "Unavailable" : "No expirations"}</option>
            ) : (
              expirationOptions.map((exp) => (
                <option key={exp} value={exp}>
                  {exp}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Strike */}
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "#9ca3af" }}>Strike</span>
          <select
            value={resolvedStrike}
            onChange={(e) => setSelectedStrike(e.target.value)}
            style={selectStyle}
          >
            {strikeOptions.length === 0 ? (
              <option value="">{strikeLoading ? "Loading…" : strikeError ? "Unavailable" : "No strikes"}</option>
            ) : (
              strikeOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Type */}
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: "#9ca3af" }}>Type</span>
          <select
            value={optionType}
            onChange={(e) => setOptionType(e.target.value as "call" | "put")}
            style={selectStyle}
          >
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </div>
      </div>

      {/* ── Contract Title ────────────────────────────────────────────── */}
      {resolvedExpiration && resolvedStrike && (
        <div className="mb-4 flex items-baseline gap-2">
          <span
            className="text-xl font-semibold"
            style={{ color: "#f59e0b" }}
          >
            {contractLabel}
          </span>
          {daysToExpiry != null && (
            <span className="text-sm font-medium" style={{ color: "#9ca3af" }}>
              ({daysToExpiry}D)
            </span>
          )}
        </div>
      )}

      {/* ── Chart Card ───────────────────────────────────────────────── */}
      <section
        className="rounded-lg overflow-hidden"
        style={{ backgroundColor: "#423d3f" }}
      >
        {contractLoading && !contractData ? (
          <div className="flex items-center justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : contractError && contractError !== "No data available yet" ? (
          <div className="p-6">
            <ErrorMessage message={contractError} />
          </div>
        ) : (
          <ContractChart
            rows={chartRows}
            latestPoint={latestPoint}
            summary={contractData?.summary ?? null}
            sessionDateKey={sessionDateKey}
            theme="dark"
          />
        )}
      </section>
    </div>
  );
}
