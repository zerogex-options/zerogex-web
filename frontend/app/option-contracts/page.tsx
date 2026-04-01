"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApiData, useMarketQuote, useOptionContract, type OptionContractRow } from "@/hooks/useApiData";
import LoadingSpinner from "@/components/LoadingSpinner";
import ErrorMessage from "@/components/ErrorMessage";
import { useTimeframe } from "@/core/TimeframeContext";
import { useTheme } from "@/core/ThemeContext";
import { useIsMobile } from "@/hooks/useIsMobile";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FlowByExpirationPoint {
  timestamp: string;
  expiration: string;
  dte: number;
  volume: number;
}

interface FlowByStrikePoint {
  timestamp: string;
  strike: number | string;
  volume: number;
}

interface ChartRow {
  timestamp: string;
  time: string;
  askVol: number | null;
  midVol: number | null;
  bidVol: number | null;
  last: number | null;
  bid: number | null;
  ask: number | null;
}

interface MinuteAggregate {
  last: number | null;
  bid: number | null;
  ask: number | null;
  askVol: number;
  midVol: number;
  bidVol: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function etWallTimeToUtcISO(dateKey: string, hour: number, minute: number): string | null {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return null;

  const etFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  for (const utcHour of [hour + 4, hour + 5]) {
    const candidate = Date.UTC(y, m - 1, d, utcHour, minute);
    const parts = etFmt.formatToParts(new Date(candidate));
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
    const min = Number(parts.find((p) => p.type === "minute")?.value ?? -1);
    if (h === hour && min === minute) return new Date(candidate).toISOString();
  }
  return null;
}

function getSessionMinuteTimeline(dateKey: string): string[] {
  const startIso = etWallTimeToUtcISO(dateKey, 9, 30);
  const endIso = etWallTimeToUtcISO(dateKey, 16, 0);
  if (!startIso || !endIso) return [];

  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return [];

  const result: string[] = [];
  for (let t = startMs; t <= endMs; t += 60_000) {
    result.push(new Date(t).toISOString());
  }
  return result;
}

function normalizeToMinute(ts: string): string | null {
  const ms = new Date(ts).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(Math.floor(ms / 60_000) * 60_000).toISOString();
}

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

function isAtOrAfterMarketOpen(ts: string): boolean {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour > 9 || (hour === 9 && minute >= 30);
}

function isAtOrBeforeMarketClose(ts: string): boolean {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour < 16 || (hour === 16 && minute <= 15);
}

function computeRoundTicks(min: number, max: number): number[] {
  const range = max - min;
  if (range <= 0) return [min, max];
  const steps = [0.05, 0.10, 0.25, 0.50, 1.00, 2.00, 5.00, 10.00, 25.00, 50.00, 100.00];
  const targetTickCount = 7;
  let step = steps[steps.length - 1];
  for (const s of steps) {
    if (range / s <= targetTickCount) {
      step = s;
      break;
    }
  }
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= end + step * 0.001; t += step) {
    ticks.push(Math.round(t * 10000) / 10000);
  }
  return ticks;
}

function formatSessionDate(dateKey: string): string {
  if (!dateKey || !dateKey.includes("-")) return dateKey;
  const [y, m, d] = dateKey.split("-");
  return `${m}/${d}/${y}`;
}

function getDateMarkerMeta(timestamps: string[]) {
  const markers = new Map<number, string>();
  let prev = "";
  timestamps.forEach((ts, idx) => {
    const dateLabel = new Date(ts).toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
    });
    if (dateLabel !== prev) {
      markers.set(idx, dateLabel);
      prev = dateLabel;
    }
  });
  return markers;
}

function computeDTE(expiration: string): number | null {
  if (!expiration) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiration + "T00:00:00");
  if (Number.isNaN(exp.getTime())) return null;
  return Math.max(0, Math.floor((exp.getTime() - today.getTime()) / 86_400_000));
}

// ── Stats Header ──────────────────────────────────────────────────────────────

function ContractStatsHeader({
  rows,
  isDark,
}: {
  rows: OptionContractRow[];
  isDark: boolean;
}) {
  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const latest = rows[rows.length - 1];

    const vol = latest.volume ?? 0;
    const oi = latest.open_interest ?? 0;

    let weightedSum = 0;
    let totalDelta = 0;
    for (const r of rows) {
      const delta = r.volume_delta ?? 0;
      if (delta > 0 && r.last != null) {
        weightedSum += r.last * delta;
        totalDelta += delta;
      }
    }
    const avg = totalDelta > 0 ? weightedSum / totalDelta : (latest.last ?? 0);
    const prem = vol * avg * 100;
    const iv = latest.implied_volatility;
    const delta = latest.delta;
    const theta = latest.theta;
    const dateKey = getETDateKey(latest.timestamp);
    return { dateKey, vol, oi, avg, prem, iv, delta, theta };
  }, [rows]);

  const labelStyle: React.CSSProperties = { color: isDark ? "#9ca3af" : "#6b7280" };
  const valueStyle: React.CSSProperties = { fontWeight: 600 };

  if (!stats) {
    return (
      <div className="px-4 py-2 text-sm" style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
        No data
      </div>
    );
  }

  const items: Array<{ label: string; value: string }> = [
    { label: "Vol", value: stats.vol.toLocaleString() },
    { label: "OI", value: stats.oi.toLocaleString() },
    { label: "Avg", value: `$${stats.avg.toFixed(2)}` },
    {
      label: "Prem",
      value:
        stats.prem >= 1_000_000
          ? `$${(stats.prem / 1_000_000).toFixed(2)}M`
          : `$${Math.round(stats.prem).toLocaleString()}`,
    },
    ...(stats.iv != null ? [{ label: "IV", value: `${(stats.iv * 100).toFixed(1)}%` }] : []),
    ...(stats.delta != null ? [{ label: "Δ", value: stats.delta.toFixed(3) }] : []),
    ...(stats.theta != null ? [{ label: "Θ", value: stats.theta.toFixed(3) }] : []),
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
        {formatSessionDate(stats.dateKey)}:
      </span>
      {items.map((s) => (
        <span key={s.label} className="flex items-center gap-1">
          <span style={labelStyle}>{s.label}:</span>
          <span style={valueStyle}>{s.value}</span>
        </span>
      ))}
    </div>
  );
}

// ── Legend ─────────────────────────────────────────────────────────────────────

function ContractLegend({
  latest,
  isDark,
}: {
  latest: OptionContractRow | null;
  isDark: boolean;
}) {
  const items = [
    { label: "Last", value: latest?.last != null ? `$${Number(latest.last).toFixed(2)}` : "--", color: "#facc15" },
    { label: "Ask Vol", value: null, color: "#22c55e" },
    { label: "Mid Vol", value: null, color: "#60a5fa" },
    { label: "Bid Vol", value: null, color: "#f45854" },
  ];

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm"
      style={{ color: isDark ? "#f2f2f2" : "#374151" }}
    >
      {items.map((item, i) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
          <span style={{ color: isDark ? "#d1d5db" : "#6b7280" }}>{item.label}{item.value != null ? ":" : ""}</span>
          {item.value != null && <span style={{ fontWeight: 600 }}>{item.value}</span>}
          {i < items.length - 1 && (
            <span style={{ color: isDark ? "#4b5563" : "#d1d5db", marginLeft: 4 }}>|</span>
          )}
        </span>
      ))}
    </div>
  );
}

// ── Chart ──────────────────────────────────────────────────────────────────────

function ContractChart({
  rows,
  rawRows,
  isDark,
  isMobile,
}: {
  rows: ChartRow[];
  rawRows: OptionContractRow[];
  isDark: boolean;
  isMobile: boolean;
}) {
  const latestRaw = rawRows.length > 0 ? rawRows[rawRows.length - 1] : null;
  const dateMarkerMeta = useMemo(
    () => getDateMarkerMeta(rows.map((row) => row.timestamp)),
    [rows],
  );

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

  const maxVol = Math.max(0, ...rows.map((r) => (r.askVol ?? 0) + (r.midVol ?? 0) + (r.bidVol ?? 0)));
  const volDomainMax = Math.max(1, Math.ceil(maxVol * 1.2));

  const prices = rows
    .map((r) => r.last)
    .filter((v): v is number => v != null && Number.isFinite(v));
  const minP = prices.length > 0 ? Math.min(...prices) : 0;
  const maxP = prices.length > 0 ? Math.max(...prices) : 1;
  const pad = Math.max(0.05, (maxP - minP) * 0.15);
  const priceDomainMin = Math.max(0, minP - pad);
  const priceDomainMax = maxP + pad;
  const priceTicks = computeRoundTicks(priceDomainMin, priceDomainMax);

  const gridStroke = isDark ? "#968f92" : "#d1d5db";
  const axisStroke = isDark ? "#f2f2f2" : "#374151";
  const axisTickStyle = { fontSize: isMobile ? 9 : 10, fill: axisStroke };

  const chartMargin = isMobile
    ? { top: 8, right: 8, left: 8, bottom: 44 }
    : { top: 10, right: 72, left: 72, bottom: 46 };
  const yAxisWidth = isMobile ? 40 : 64;

  return (
    <div>
      <ContractStatsHeader rows={rawRows} isDark={isDark} />
      <ContractLegend latest={latestRaw} isDark={isDark} />
      <div className="h-[320px] md:h-[480px] mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={rows}
            margin={chartMargin}
            barCategoryGap="15%"
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
                const ts = String(props?.payload?.value || "");
                const index = Number(props?.index ?? -1);
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
              tickMargin={isMobile ? 2 : 6}
              width={yAxisWidth}
              label={isMobile ? undefined : {
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
              domain={[priceTicks[0] ?? priceDomainMin, priceTicks[priceTicks.length - 1] ?? priceDomainMax]}
              ticks={priceTicks}
              tickFormatter={(v) => {
                const n = Number(v);
                const step = priceTicks.length > 1 ? priceTicks[1] - priceTicks[0] : 1;
                const decimals = step < 0.10 ? 2 : step < 1.00 ? 2 : 0;
                return `$${n.toFixed(decimals)}`;
              }}
              tick={axisTickStyle}
              tickMargin={isMobile ? 2 : 6}
              width={yAxisWidth}
              label={isMobile ? undefined : {
                value: "Price ($)",
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
                if (name === "Last")
                  return n > 0 ? [`$${n.toFixed(2)}`, name] : [null, name];
                if (n === 0) return [null, name];
                return [n.toLocaleString(), name];
              }}
              itemSorter={(item) => {
                // Define custom order: Last, Bid Vol, Mid Vol, Ask Vol
                const order = { "Last": 0, "Bid Vol": 1, "Mid Vol": 2, "Ask Vol": 3 };
                return order[item.name as keyof typeof order] ?? 99;
              }}
            />

            <Bar yAxisId="volume" dataKey="askVol" name="Ask Vol" stackId="vol" fill="#22c55e" isAnimationActive={false} />
            <Bar yAxisId="volume" dataKey="midVol" name="Mid Vol" stackId="vol" fill="#60a5fa" isAnimationActive={false} />
            <Bar yAxisId="volume" dataKey="bidVol" name="Bid Vol" stackId="vol" fill="#f45854" isAnimationActive={false} />

            <Line yAxisId="price" type="monotone" dataKey="last" name="Last" stroke="#facc15" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OptionContractsPage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isMobile = useIsMobile();

  const [selectedExpiration, setSelectedExpiration] = useState<string>("");
  const [selectedStrike, setSelectedStrike] = useState<string>("");
  const [optionType, setOptionType] = useState<"C" | "P">("C");

  const { data: quoteData } = useMarketQuote(symbol, 1000);

  // ── Fetch available expirations / strikes from current session flow data
  const { data: expirationDataSession, error: expirationErrorSession, loading: expirationLoading } =
    useApiData<FlowByExpirationPoint[]>(
      `/api/flow/by-expiration?symbol=${symbol}&session=current&limit=500`,
      { refreshInterval: 60000 },
    );
  const { data: expirationDataNoSession, error: expirationErrorNoSession, loading: expirationLoadingNoSession } =
    useApiData<FlowByExpirationPoint[]>(
      `/api/flow/by-expiration?symbol=${symbol}&limit=500`,
      {
        refreshInterval: 60000,
        enabled: Boolean(expirationErrorSession) || (!!expirationDataSession && expirationDataSession.length === 0),
      },
    );

  const { data: strikeDataSession, error: strikeErrorSession, loading: strikeLoading } =
    useApiData<FlowByStrikePoint[]>(
      `/api/flow/by-strike?symbol=${symbol}&session=current&limit=500`,
      { refreshInterval: 60000 },
    );
  const { data: strikeDataNoSession, error: strikeErrorNoSession, loading: strikeLoadingNoSession } =
    useApiData<FlowByStrikePoint[]>(
      `/api/flow/by-strike?symbol=${symbol}&limit=500`,
      {
        refreshInterval: 60000,
        enabled: Boolean(strikeErrorSession) || (!!strikeDataSession && strikeDataSession.length === 0),
      },
    );

  const expirationData =
    expirationDataSession && expirationDataSession.length > 0
      ? expirationDataSession
      : expirationDataNoSession;
  const strikeData =
    strikeDataSession && strikeDataSession.length > 0
      ? strikeDataSession
      : strikeDataNoSession;
  const expirationError = expirationErrorSession && expirationErrorNoSession ? expirationErrorSession : null;
  const strikeError = strikeErrorSession && strikeErrorNoSession ? strikeErrorSession : null;
  const expirationDropdownLoading = expirationLoading || expirationLoadingNoSession;
  const strikeDropdownLoading = strikeLoading || strikeLoadingNoSession;

  // ── Derive available expirations (active only — expire today or later)
  const expirationOptions = useMemo(() => {
    if (!expirationData) return [];
    const todayKey = getCurrentETDateKey();
    return Array.from(
      new Set(
        expirationData
          .map((r) => r.expiration)
          .filter((exp) => {
            if (!exp) return false;
            const normalized = exp.trim().slice(0, 10);
            return /^\d{4}-\d{2}-\d{2}$/.test(normalized) && normalized >= todayKey;
          }),
      ),
    ).sort();
  }, [expirationData]);

  const strikeOptions = useMemo(() => {
    if (!strikeData) return [];
    return Array.from(
      new Set(strikeData.map((r) => String(r.strike)).filter(Boolean)),
    ).sort((a, b) => Number(a) - Number(b));
  }, [strikeData]);

  const defaultExpiration = useMemo(() => {
    const todayKey = getCurrentETDateKey();
    return expirationOptions.find((exp) => exp === todayKey) || expirationOptions[0] || "";
  }, [expirationOptions]);

  const defaultStrike = useMemo(() => {
    if (strikeOptions.length === 0) return "";
    const spot = quoteData?.close;
    if (spot == null || Number.isNaN(Number(spot))) return strikeOptions[0];

    return strikeOptions.reduce((closest, current) =>
      Math.abs(Number(current) - spot) < Math.abs(Number(closest) - spot) ? current : closest,
    strikeOptions[0]);
  }, [quoteData?.close, strikeOptions]);

  const resolvedExpiration = selectedExpiration || defaultExpiration || "";
  const resolvedStrike = selectedStrike || defaultStrike || "";

  // ── Fetch contract time-series
  const { data: contractRows, loading: contractLoading, error: contractError } =
    useOptionContract(symbol, resolvedExpiration, resolvedStrike, optionType, 30000);

  // ── Chart rows
  const chartRows = useMemo((): ChartRow[] => {
    if (!contractRows || contractRows.length === 0) return [];

    const inSessionRows = [...contractRows]
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .filter((r) => isAtOrAfterMarketOpen(r.timestamp) && isAtOrBeforeMarketClose(r.timestamp));
    if (inSessionRows.length === 0) return [];

    const sessionDateKey = getETDateKey(inSessionRows[inSessionRows.length - 1].timestamp);
    const minuteTimeline = getSessionMinuteTimeline(sessionDateKey);
    if (minuteTimeline.length === 0) {
      return inSessionRows.map((r) => ({
        timestamp: r.timestamp,
        time: safeTimeLabel(r.timestamp),
        askVol: r.ask_volume ?? 0,
        midVol: r.mid_volume ?? 0,
        bidVol: r.bid_volume ?? 0,
        last: r.last ?? null,
        bid: r.bid ?? null,
        ask: r.ask ?? null,
      }));
    }

    const aggregatedByMinute = new Map<string, MinuteAggregate>();
    inSessionRows.forEach((row) => {
      const minuteTs = normalizeToMinute(row.timestamp);
      if (!minuteTs) return;
      const prev = aggregatedByMinute.get(minuteTs) ?? {
        last: null,
        bid: null,
        ask: null,
        askVol: 0,
        midVol: 0,
        bidVol: 0,
      };
      aggregatedByMinute.set(minuteTs, {
        last: row.last ?? prev.last,
        bid: row.bid ?? prev.bid,
        ask: row.ask ?? prev.ask,
        askVol: prev.askVol + (row.ask_volume ?? 0),
        midVol: prev.midVol + (row.mid_volume ?? 0),
        bidVol: prev.bidVol + (row.bid_volume ?? 0),
      });
    });

    return minuteTimeline.map((minuteTs) => {
      const row = aggregatedByMinute.get(minuteTs);
      return {
        timestamp: minuteTs,
        time: safeTimeLabel(minuteTs),
        askVol: row ? row.askVol : null,
        midVol: row ? row.midVol : null,
        bidVol: row ? row.bidVol : null,
        last: row?.last ?? null,
        bid: row?.bid ?? null,
        ask: row?.ask ?? null,
      };
    });
  }, [contractRows]);

  // ── Contract display label
  const contractLabel = useMemo(() => {
    if (!resolvedExpiration || !resolvedStrike) return symbol;
    const expFormatted = resolvedExpiration.includes("-")
      ? (() => {
          const [y, m, d] = resolvedExpiration.split("-");
          return `${m}/${d}/${y}`;
        })()
      : resolvedExpiration;
    return `${symbol} ${resolvedStrike} ${optionType} ${expFormatted}`;
  }, [resolvedExpiration, resolvedStrike, optionType, symbol]);

  const dte = resolvedExpiration ? computeDTE(resolvedExpiration) : null;

  const cardBg = isDark ? "#423d3f" : "#ffffff";
  const inputBg = isDark ? "#2a2628" : "#f3f4f6";
  const inputBorder = isDark ? "rgba(150,143,146,0.4)" : "rgba(0,0,0,0.15)";
  const inputColor = isDark ? "#f2f2f2" : "#374151";
  const mutedText = isDark ? "#9ca3af" : "#6b7280";

  const selectStyle: React.CSSProperties = {
    padding: "6px 10px",
    fontSize: 13,
    borderRadius: 6,
    border: `1px solid ${inputBorder}`,
    backgroundColor: inputBg,
    color: inputColor,
    cursor: "pointer",
    outline: "none",
    minWidth: 120,
  };

  const dropdownLoadError =
    (expirationError && expirationError !== "No data available yet")
      ? expirationError
      : strikeError && strikeError !== "No data available yet"
        ? strikeError
        : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">Real-Time Contract Viewer</h1>

      {dropdownLoadError && (
        <div className="mb-4">
          <ErrorMessage message={dropdownLoadError} />
        </div>
      )}

      {/* ── Controls ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Expiration */}
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: mutedText }}>Expiration</span>
          <select
            value={resolvedExpiration}
            onChange={(e) => setSelectedExpiration(e.target.value)}
            style={selectStyle}
          >
            {expirationOptions.length === 0 ? (
                <option value="">
                {expirationDropdownLoading ? "Loading…" : expirationError ? "Unavailable" : "No expirations"}
              </option>
            ) : (
              expirationOptions.map((exp) => (
                <option key={exp} value={exp}>{exp}</option>
              ))
            )}
          </select>
        </div>

        {/* Strike */}
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: mutedText }}>Strike</span>
          <select
            value={resolvedStrike}
            onChange={(e) => setSelectedStrike(e.target.value)}
            style={selectStyle}
          >
            {strikeOptions.length === 0 ? (
                <option value="">
                {strikeDropdownLoading ? "Loading…" : strikeError ? "Unavailable" : "No strikes"}
              </option>
            ) : (
              strikeOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))
            )}
          </select>
        </div>

        {/* Type */}
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: mutedText }}>Type</span>
          <select
            value={optionType}
            onChange={(e) => setOptionType(e.target.value as "C" | "P")}
            style={selectStyle}
          >
            <option value="C">Call</option>
            <option value="P">Put</option>
          </select>
        </div>
      </div>

      {/* ── Contract Title ──────────────────────────────────────────── */}
      {resolvedExpiration && resolvedStrike && (
        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-xl font-semibold" style={{ color: "#f59e0b" }}>
            {contractLabel}
          </span>
          {dte != null && (
            <span className="text-sm font-medium" style={{ color: mutedText }}>
              ({dte} DTE)
            </span>
          )}
        </div>
      )}

      {/* ── Chart Card ─────────────────────────────────────────────── */}
      <section
        className="rounded-lg overflow-hidden"
        style={{ backgroundColor: cardBg }}
      >
        {contractLoading && !contractRows ? (
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
            rawRows={contractRows ?? []}
            isDark={isDark}
            isMobile={isMobile}
          />
        )}
      </section>
    </div>
  );
}
