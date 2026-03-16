"use client";

import { Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

// ── API shape ─────────────────────────────────────────────────────────────────

interface FlowByTypePoint {
  timestamp: string;
  call_volume: number;
  call_premium: number;
  put_volume: number;
  put_premium: number;
  net_volume: number;
  net_premium: number;
  underlying_price?: number | null;
}

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

// ── Chart row shape ───────────────────────────────────────────────────────────

interface PutCallRatioRow {
  timestamp: string;
  ratio: number | null;
}

interface TimeseriesRow {
  timestamp: string;
  time: string;
  callPremium: number | null;
  putPremium: number | null;
  netVolume: number | null;
  positiveNetVolume: number | null;
  negativeNetVolume: number | null;
  underlyingPrice: number | null;
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

/** Normalises a timestamp to minute precision (truncates seconds/ms). */
function normalizeToMinute(ts: string): string {
  const ms = new Date(ts).getTime();
  if (!Number.isFinite(ms)) return ts;
  return new Date(Math.floor(ms / 60_000) * 60_000).toISOString();
}

/**
 * Generates 1-min ISO timestamps from 09:30 ET to 16:00 ET for the given YYYY-MM-DD dateKey.
 * Handles EDT (UTC-4) and EST (UTC-5) automatically.
 */
function getSessionTimestamps(dateKey: string): string[] {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return [];

  const etFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  // 09:30 ET = 13:30 UTC (EDT) or 14:30 UTC (EST)
  let startMs: number | null = null;
  for (const utcH of [13, 14]) {
    const candidate = Date.UTC(y, m - 1, d, utcH, 30);
    const parts = etFmt.formatToParts(new Date(candidate));
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
    const min = Number(parts.find((p) => p.type === "minute")?.value ?? -1);
    if (h === 9 && min === 30) { startMs = candidate; break; }
  }

  // 16:00 ET = 20:00 UTC (EDT) or 21:00 UTC (EST)
  let endMs: number | null = null;
  for (const utcH of [20, 21]) {
    const candidate = Date.UTC(y, m - 1, d, utcH, 0);
    const parts = etFmt.formatToParts(new Date(candidate));
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
    const min = Number(parts.find((p) => p.type === "minute")?.value ?? -1);
    if (h === 16 && min === 0) { endMs = candidate; break; }
  }

  if (startMs === null || endMs === null) return [];

  const result: string[] = [];
  for (let t = startMs; t <= endMs; t += 60_000) {
    result.push(new Date(t).toISOString());
  }
  return result;
}

/** Aligns a timeseries to the session timeline, filling missing slots with null data values. */
function alignSeriesToTimeline(rows: TimeseriesRow[], timeline: string[]): TimeseriesRow[] {
  const byTs = new Map(rows.map((r) => [r.timestamp, r]));
  return timeline.map((timestamp) => {
    const row = byTs.get(timestamp);
    if (row) return row;
    return {
      timestamp,
      time: safeTimeLabel(timestamp),
      callPremium: null,
      putPremium: null,
      netVolume: null,
      positiveNetVolume: null,
      negativeNetVolume: null,
      underlyingPrice: null,
    } satisfies TimeseriesRow;
  });
}

/** Aligns a put/call ratio series to the session timeline, filling missing slots with null. */
function alignRatioToTimeline(rows: PutCallRatioRow[], timeline: string[]): PutCallRatioRow[] {
  const byTs = new Map(rows.map((r) => [r.timestamp, r]));
  return timeline.map((timestamp) => byTs.get(timestamp) ?? { timestamp, ratio: null });
}

/**
 * Determines the default selected date.
 * If the market is currently open (≥ 09:30 ET on a weekday) and today is in availableDates → today.
 * Otherwise → the most recent available date.
 */
function getDefaultDate(availableDates: string[]): string {
  if (availableDates.length === 0) return getCurrentETDateKey();

  const now = new Date();
  const etParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const weekday = etParts.find((p) => p.type === "weekday")?.value ?? "";
  const etHour = Number(etParts.find((p) => p.type === "hour")?.value ?? 0);
  const etMin = Number(etParts.find((p) => p.type === "minute")?.value ?? 0);
  const isWeekday = weekday !== "Sat" && weekday !== "Sun";
  const isMarketOpen = isWeekday && etHour * 60 + etMin >= 9 * 60 + 30;
  const todayKey = getCurrentETDateKey();

  if (isMarketOpen && availableDates.includes(todayKey)) return todayKey;
  // Most recent available date (dates are sorted descending)
  return availableDates[0];
}

// ── Label / axis helpers ──────────────────────────────────────────────────────

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

function isActiveExpiration(expiration?: string, todayKey: string = getCurrentETDateKey()) {
  if (!expiration) return false;
  const normalized = expiration.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return true;
  return normalized >= todayKey;
}

// ── Series builders ───────────────────────────────────────────────────────────

function buildTimeseriesFromByType(rows: FlowByTypePoint[]): TimeseriesRow[] {
  const grouped = new Map<
    string,
    { callPremium: number; putPremium: number; callVolume: number; putVolume: number; underlyingPrice: number | null }
  >();

  rows.forEach((row) => {
    const ts = normalizeToMinute(row.timestamp);
    if (!ts) return;

    const current = grouped.get(ts) ?? {
      callPremium: 0,
      putPremium: 0,
      callVolume: 0,
      putVolume: 0,
      underlyingPrice: null,
    };

    current.callPremium += Number(row.call_premium || 0);
    current.putPremium += Number(row.put_premium || 0);
    current.callVolume += Number(row.call_volume || 0);
    current.putVolume += Number(row.put_volume || 0);
    if (current.underlyingPrice === null && row.underlying_price != null) {
      current.underlyingPrice = Number(row.underlying_price);
    }

    grouped.set(ts, current);
  });

  return Array.from(grouped.entries())
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
        underlyingPrice: value.underlyingPrice,
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function buildPutCallRatioSeries(rows: FlowByTypePoint[]): PutCallRatioRow[] {
  const grouped = new Map<string, { callVolume: number; putVolume: number }>();

  rows.forEach((row) => {
    const ts = normalizeToMinute(row.timestamp);
    if (!ts) return;
    const current = grouped.get(ts) ?? { callVolume: 0, putVolume: 0 };
    current.callVolume += Number(row.call_volume || 0);
    current.putVolume += Number(row.put_volume || 0);
    grouped.set(ts, current);
  });

  return Array.from(grouped.entries())
    .map(([timestamp, value]) => ({
      timestamp,
      ratio: value.callVolume > 0 ? value.putVolume / value.callVolume : 0,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function normalizeSignedFlow(
  totalPremium: number,
  netPremium: number,
  totalVolume: number,
  netVolume: number,
) {
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
    Math.sign(netPremium || 0) !== 0 &&
    Math.sign(boundedRawNet || 0) !== 0 &&
    Math.sign(netPremium || 0) !== Math.sign(boundedRawNet || 0);

  return {
    callPremium,
    putPremium,
    netVolume: hasSignMismatch ? derivedFromPremium : boundedRawNet,
  };
}

function buildTimeseriesFromNetRows(
  rows: Array<{
    timestamp: string;
    premium: number;
    net_premium: number;
    volume: number;
    net_volume: number;
    underlying_price?: number | null;
  }>,
): TimeseriesRow[] {
  const grouped = new Map<
    string,
    { totalPremium: number; netPremium: number; totalVolume: number; netVolume: number; underlyingPrice: number | null }
  >();

  rows.forEach((row) => {
    const ts = normalizeToMinute(row.timestamp);
    if (!ts) return;

    const current = grouped.get(ts) ?? {
      totalPremium: 0,
      netPremium: 0,
      totalVolume: 0,
      netVolume: 0,
      underlyingPrice: null,
    };

    current.totalPremium += Number(row.premium || 0);
    current.netPremium += Number(row.net_premium || 0);
    current.totalVolume += Number(row.volume || 0);
    current.netVolume += Number(row.net_volume || 0);
    if (current.underlyingPrice === null && row.underlying_price != null) {
      current.underlyingPrice = Number(row.underlying_price);
    }

    grouped.set(ts, current);
  });

  return Array.from(grouped.entries())
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
        underlyingPrice: value.underlyingPrice,
      };
    })
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// ── Chart layout helpers ──────────────────────────────────────────────────────

/** Computes a clean axis step that gives roughly 6 ticks over the given range. */
function getDynamicStep(min: number, max: number): number {
  const range = Math.max(1, Math.abs(max - min));
  const rawStep = range / 6;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  let step: number;
  if (normalized < 1.5) step = 1 * magnitude;
  else if (normalized < 3.5) step = 2 * magnitude;
  else if (normalized < 7.5) step = 5 * magnitude;
  else step = 10 * magnitude;
  return Math.max(1, step);
}

function getUnderlyingDomain(rows: TimeseriesRow[]) {
  const prices = rows
    .map((r) => r.underlyingPrice)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (prices.length === 0) return ["auto", "auto"] as const;

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const span = Math.max(0.01, maxPrice - minPrice);
  const padding = span * 0.03;

  return [minPrice - padding, maxPrice + padding] as const;
}

function roundToStep(value: number, step: number, mode: "up" | "down") {
  if (!Number.isFinite(value)) return 0;
  if (mode === "down") return Math.floor(value / step) * step;
  return Math.ceil(value / step) * step;
}

function getDynamicLeftMargin(rows: TimeseriesRow[]) {
  const prices = rows
    .map((r) => r.underlyingPrice)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));

  if (prices.length === 0) return 86;

  const maxAbs = Math.max(...prices.map((v) => Math.abs(v)));
  const digits = Math.max(3, Math.floor(Math.log10(Math.max(1, maxAbs))) + 1);
  return Math.max(86, Math.min(120, 52 + digits * 10));
}

function getDateMarkerMeta(timestamps: string[]) {
  const groups = new Map<string, { first: number; last: number }>();

  timestamps.forEach((ts, idx) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

// ── Sub-components ────────────────────────────────────────────────────────────

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

function DateSelect({
  dates,
  value,
  onChange,
}: {
  dates: string[];
  value: string;
  onChange: (d: string) => void;
}) {
  if (dates.length === 0) return null;
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm text-gray-400">Date</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 text-sm rounded-md border border-gray-600 bg-[#2a2628] text-gray-200 focus:outline-none focus:border-gray-400 cursor-pointer"
      >
        {dates.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
    </div>
  );
}

function FullWidthFlowChart({ rows }: { rows: TimeseriesRow[] }) {
  if (rows.length === 0) {
    return <div className="text-gray-400 text-center py-8">No chart data available</div>;
  }

  const maxPremium = Math.max(0, ...rows.map((r) => r.callPremium ?? 0), ...rows.map((r) => r.putPremium ?? 0));
  const minVolumeRaw = Math.min(0, ...rows.map((r) => r.netVolume ?? 0));
  const maxVolumeRaw = Math.max(0, ...rows.map((r) => r.netVolume ?? 0));
  const volumeStep = getDynamicStep(minVolumeRaw, maxVolumeRaw);
  const minVolume = roundToStep(minVolumeRaw, volumeStep, "down");
  const maxVolume = roundToStep(maxVolumeRaw, volumeStep, "up");
  const underlyingDomain = getUnderlyingDomain(rows);
  const dateMarkerMeta = getDateMarkerMeta(rows.map((r) => r.timestamp));
  const timeTickStep = Math.max(1, Math.ceil(rows.length / 10));
  const leftChartMargin = getDynamicLeftMargin(rows);
  const rightChartMargin = 70;

  return (
    <div className="h-[540px]">
      <ResponsiveContainer width="100%" height="75%">
        <ComposedChart data={rows} margin={{ top: 10, right: rightChartMargin, left: leftChartMargin, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.25} />
          <XAxis
            dataKey="timestamp"
            stroke="#f2f2f2"
            minTickGap={24}
            padding={{ left: 0, right: 0 }}
            hide
          />
          <YAxis
            yAxisId="price"
            stroke="#f2f2f2"
            orientation="left"
            domain={underlyingDomain}
            tickFormatter={(v) => `$${Math.round(Number(v))}`}
            tick={{ fontSize: 10 }}
            tickMargin={8}
            width={72}
            label={{ value: "Underlying Price", angle: -90, position: "left", fill: "#f2f2f2", fontSize: 10, offset: 10 }}
          />
          <YAxis
            yAxisId="premium"
            stroke="#f2f2f2"
            orientation="right"
            domain={[0, Math.max(1, maxPremium * 1.05)]}
            tickFormatter={(v) => {
              const n = Number(v);
              if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
              if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
              return `$${Math.round(n)}`;
            }}
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
            connectNulls
          />
          <Line
            yAxisId="premium"
            type="monotone"
            dataKey="callPremium"
            name="Net Call Prem"
            stroke="#10b981"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
          />
          <Line
            yAxisId="premium"
            type="monotone"
            dataKey="putPremium"
            name="Net Put Prem"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            connectNulls={false}
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
              const showTime = index % timeTickStep === 0 || Boolean(dateLabel);
              if (!showTime && !dateLabel) return <g transform={`translate(${x},${y})`} />;
              return (
                <g transform={`translate(${x},${y})`}>
                  {showTime ? (
                    <text dy={12} textAnchor="middle" fill="#f2f2f2" fontSize={10}>
                      {timeLabel}
                    </text>
                  ) : null}
                  {dateLabel ? (
                    <text dy={24} textAnchor="middle" fill="#cfcfcf" fontSize={9}>
                      {dateLabel}
                    </text>
                  ) : null}
                </g>
              );
            }}
          />
          <YAxis
            yAxisId="volumeSpacer"
            orientation="left"
            domain={[0, 1]}
            width={72}
            axisLine={false}
            tickLine={false}
            tick={false}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            stroke="#f2f2f2"
            domain={[minVolume, maxVolume]}
            tickFormatter={(v) => {
              const n = Number(v);
              if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
              if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
              return String(Math.round(n));
            }}
            tick={{ fontSize: 10 }}
            tickMargin={8}
            width={62}
            label={{ value: "Net Volume", angle: 90, position: "right", fill: "#f2f2f2", fontSize: 10, offset: 16 }}
          />
          <Tooltip
            content={({ active, label, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const point = payload[0]?.payload as { netVolume?: number } | undefined;
              return (
                <div className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                  <div className="font-semibold">{new Date(String(label)).toLocaleString()}</div>
                  <div>Net Volume: {Number(point?.netVolume ?? 0).toLocaleString()}</div>
                </div>
              );
            }}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FlowAnalysisPage() {
  const { symbol } = useTimeframe();

  // Fetch all data with maximum window to cover all available dates
  const {
    data: flowByType,
    loading: flowLoading,
    error: flowError,
  } = useApiData<FlowByTypePoint[]>(
    `/api/flow/by-type?symbol=${symbol}&window_minutes=1440`,
    { refreshInterval: 30000 },
  );

  const { data: flowByExpiration, error: expirationError } = useApiData<FlowByExpirationPoint[]>(
    `/api/flow/by-expiration?symbol=${symbol}&window_minutes=1440&limit=50000`,
    { refreshInterval: 30000 },
  );

  const { data: flowByStrike, error: strikeError } = useApiData<FlowByStrikePoint[]>(
    `/api/flow/by-strike?symbol=${symbol}&window_minutes=1440&limit=50000`,
    { refreshInterval: 30000 },
  );

  // ── Date selection ──────────────────────────────────────────────────────────

  /** All unique ET dates present in the data, sorted descending (most recent first). */
  const availableDates = useMemo(() => {
    if (!flowByType || flowByType.length === 0) return [];
    const dates = new Set<string>();
    flowByType.forEach((row) => {
      const key = getETDateKey(row.timestamp);
      if (key) dates.add(key);
    });
    return Array.from(dates).sort().reverse();
  }, [flowByType]);

  const [selectedDate, setSelectedDate] = useState<string>("");

  // Auto-select default date once data arrives (or when symbol changes).
  useEffect(() => {
    if (availableDates.length === 0) return;
    // Keep current selection if it's still valid.
    if (selectedDate && availableDates.includes(selectedDate)) return;
    setSelectedDate(getDefaultDate(availableDates));
  }, [availableDates]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session timeline (fixed 09:30–16:00 ET for selected date) ──────────────

  const sessionTimeline = useMemo(() => {
    if (!selectedDate) return [];
    return getSessionTimestamps(selectedDate);
  }, [selectedDate]);

  // ── Snapshot (latest row for selected date) ─────────────────────────────────

  const latestSnapshot = useMemo(() => {
    if (!selectedDate || !flowByType || flowByType.length === 0) return null;
    const dateRows = flowByType.filter((r) => getETDateKey(r.timestamp) === selectedDate);
    if (dateRows.length === 0) return null;

    const latest = [...dateRows].sort(
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
  }, [selectedDate, flowByType]);

  // ── Main options flow series ────────────────────────────────────────────────

  const mainSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const dateRows = (flowByType ?? []).filter((r) => getETDateKey(r.timestamp) === selectedDate);
    const base = buildTimeseriesFromByType(dateRows);
    return alignSeriesToTimeline(base, sessionTimeline);
  }, [selectedDate, flowByType, sessionTimeline]);

  // ── By-expiration ───────────────────────────────────────────────────────────

  const expirationOptions = useMemo(() => {
    if (!selectedDate || !flowByExpiration) return [];
    const dateRows = flowByExpiration.filter((r) => getETDateKey(r.timestamp) === selectedDate);
    const todayKey = getCurrentETDateKey();
    return Array.from(
      new Set(dateRows.map((r) => r.expiration).filter((exp) => isActiveExpiration(exp, todayKey))),
    ).sort();
  }, [selectedDate, flowByExpiration]);

  const [selectedExpirations, setSelectedExpirations] = useState<Set<string>>(new Set());

  const expirationSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const dateRows = (flowByExpiration ?? []).filter((r) => getETDateKey(r.timestamp) === selectedDate);
    const available = new Set(expirationOptions);
    const activeSelection = new Set(Array.from(selectedExpirations).filter((v) => available.has(v)));
    const filtered =
      activeSelection.size > 0
        ? dateRows.filter((r) => activeSelection.has(r.expiration))
        : dateRows.filter((r) => available.has(r.expiration));
    const base = buildTimeseriesFromNetRows(filtered);
    return alignSeriesToTimeline(base, sessionTimeline);
  }, [selectedDate, flowByExpiration, selectedExpirations, expirationOptions, sessionTimeline]);

  // ── By-strike ───────────────────────────────────────────────────────────────

  const strikeOptions = useMemo(() => {
    if (!selectedDate || !flowByStrike) return [];
    const dateRows = flowByStrike.filter((r) => getETDateKey(r.timestamp) === selectedDate);
    return Array.from(new Set(dateRows.map((r) => String(r.strike)).filter(Boolean))).sort(
      (a, b) => Number(a) - Number(b),
    );
  }, [selectedDate, flowByStrike]);

  const [selectedStrikes, setSelectedStrikes] = useState<Set<string>>(new Set());

  const strikeSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const dateRows = (flowByStrike ?? []).filter((r) => getETDateKey(r.timestamp) === selectedDate);
    const filtered =
      selectedStrikes.size > 0 ? dateRows.filter((r) => selectedStrikes.has(String(r.strike))) : dateRows;
    const base = buildTimeseriesFromNetRows(filtered);
    return alignSeriesToTimeline(base, sessionTimeline);
  }, [selectedDate, flowByStrike, selectedStrikes, sessionTimeline]);

  // ── Put/Call ratio ──────────────────────────────────────────────────────────

  const putCallRatioSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const dateRows = (flowByType ?? []).filter((r) => getETDateKey(r.timestamp) === selectedDate);
    const base = buildPutCallRatioSeries(dateRows);
    return alignRatioToTimeline(base, sessionTimeline);
  }, [selectedDate, flowByType, sessionTimeline]);

  const ratioDateMarkerMeta = useMemo(
    () => getDateMarkerMeta(putCallRatioSeries.map((r) => r.timestamp)),
    [putCallRatioSeries],
  );
  const ratioTimeTickStep = Math.max(1, Math.ceil(Math.max(1, putCallRatioSeries.length) / 10));

  // ── Chip toggles ────────────────────────────────────────────────────────────

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

      {/* Date selector — shared across all sections */}
      <div className="mb-6">
        <DateSelect dates={availableDates} value={selectedDate} onChange={setSelectedDate} />
      </div>

      {/* ── Flow Snapshot ─────────────────────────────────────────────── */}
      <section className="mb-8">
        <SectionTitle
          title="Flow Snapshot"
          tooltip="Most recent snapshot from the latest row for the selected date."
        />
        <div className="text-gray-400 text-sm mb-3">
          Latest timestamp:{" "}
          {latestSnapshot?.timestamp ? new Date(latestSnapshot.timestamp).toLocaleString() : "--"}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard
            title="Call Volume"
            value={Number(latestSnapshot?.callVolume || 0).toLocaleString()}
            subtitle={`$${(Number(latestSnapshot?.callPremium || 0) / 1_000_000).toFixed(2)}M premium`}
            trend="bullish"
            tooltip="Latest call contracts traded for the selected date."
            theme="dark"
          />
          <MetricCard
            title="Put Volume"
            value={Number(latestSnapshot?.putVolume || 0).toLocaleString()}
            subtitle={`$${(Number(latestSnapshot?.putPremium || 0) / 1_000_000).toFixed(2)}M premium`}
            trend="bearish"
            tooltip="Latest put contracts traded for the selected date."
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

      {/* ── Options Flow ──────────────────────────────────────────────── */}
      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Options Flow"
          tooltip="Primary axis: call premium (green) and put premium (red). Bottom axis: net volume area, green above zero and red below zero. X-axis spans the full session from first bar to 16:15 ET."
        />
        <FullWidthFlowChart rows={mainSeries} />
      </section>

      {/* ── Flow by Expiration ────────────────────────────────────────── */}
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

      {/* ── Flow by Strike ────────────────────────────────────────────── */}
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

      {/* ── Put/Call Ratio ────────────────────────────────────────────── */}
      <section className="mb-8 bg-[#423d3f] rounded-lg p-6">
        <SectionTitle
          title="Put/Call Ratio"
          tooltip="Put/call volume ratio over time for the selected date."
        />
        {putCallRatioSeries.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No put/call ratio data available</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart
              data={putCallRatioSeries}
              margin={{ top: 10, right: 70, left: 70, bottom: 28 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#968f92" opacity={0.2} />
              <XAxis
                dataKey="timestamp"
                stroke="#f2f2f2"
                interval={0}
                minTickGap={24}
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
                  const dateLabel = ratioDateMarkerMeta.get(index);
                  const showTime = index % ratioTimeTickStep === 0 || Boolean(dateLabel);
                  if (!showTime && !dateLabel) return <g transform={`translate(${x},${y})`} />;
                  return (
                    <g transform={`translate(${x},${y})`}>
                      {showTime ? (
                        <text dy={12} textAnchor="middle" fill="#f2f2f2" fontSize={10}>
                          {timeLabel}
                        </text>
                      ) : null}
                      {dateLabel ? (
                        <text dy={24} textAnchor="middle" fill="#cfcfcf" fontSize={9}>
                          {dateLabel}
                        </text>
                      ) : null}
                    </g>
                  );
                }}
              />
              <YAxis stroke="#f2f2f2" tick={{ fontSize: 10 }} tickMargin={8} width={62} />
              <Tooltip
                content={({ active, label, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  return (
                    <div className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
                      <div className="font-semibold">{new Date(String(label)).toLocaleString()}</div>
                      <div>Put/Call Ratio: {Number(payload[0]?.value ?? 0).toFixed(2)}</div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="ratio"
                name="Put/Call Ratio"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
