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
import RegimeSummaryBanner from "@/components/RegimeSummaryBanner";
import { useTimeframe } from "@/core/TimeframeContext";
import { useTheme } from "@/core/ThemeContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { normalizeToMinute, getSessionTimestamps } from "@/core/utils";

// ── API shape ─────────────────────────────────────────────────────────────────

interface FlowByTypePoint {
  timestamp: string;
  call_volume: number;
  call_premium: number;
  put_volume: number;
  put_premium: number;
  net_volume: number;
  net_premium: number;
  cumulative_call_volume?: number | string;
  cumulative_put_volume?: number | string;
  cumulative_call_premium?: number | string;
  cumulative_put_premium?: number | string;
  cumulative_net_volume?: number | string;
  cumulative_net_directional_volume?: number | string;
  cumulative_net_premium?: number | string;
  running_put_call_ratio?: number | string;
  underlying_price?: number | null;
}

interface FlowByExpirationPoint {
  timestamp?: string;
  time_window_start?: string;
  time_window_end?: string;
  interval_timestamp?: string | null;
  expiration: string;
  volume?: number | string;
  total_volume?: number | string;
  premium?: number | string;
  total_premium?: number | string;
  net_volume?: number | string;
  net_premium?: number | string;
  cumulative_volume?: number | string;
  cumulative_net_volume?: number | string;
  cumulative_net_directional_volume?: number | string;
  cumulative_call_premium?: number | string;
  cumulative_put_premium?: number | string;
  cumulative_premium?: number | string;
  cumulative_net_premium?: number | string;
  flow_bias?: string;
  underlying_price?: number | string | null;
}

interface FlowByStrikePoint {
  timestamp?: string;
  time_window_start?: string;
  time_window_end?: string;
  interval_timestamp?: string | null;
  strike: number | string;
  volume?: number | string;
  total_volume?: number | string;
  premium?: number | string;
  total_premium?: number | string;
  net_volume?: number | string;
  net_premium?: number | string;
  cumulative_volume?: number | string;
  cumulative_net_volume?: number | string;
  cumulative_net_directional_volume?: number | string;
  cumulative_call_premium?: number | string;
  cumulative_put_premium?: number | string;
  cumulative_premium?: number | string;
  cumulative_net_premium?: number | string;
  flow_bias?: string;
  underlying_price?: number | string | null;
}

// ── Chart row shape ───────────────────────────────────────────────────────────

interface PutCallRatioRow {
  timestamp: string;
  ratio: number | null;
}

interface NetDirectionalPremiumRow {
  timestamp: string;
  premium: number | null;
  positivePremium: number | null;
  negativePremium: number | null;
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

function buildNetDirectionalPremiumSeries(rows: FlowByTypePoint[]): NetDirectionalPremiumRow[] {
  const grouped = new Map<string, { timestamp: string; cumulative: number | null }>();

  for (const row of rows) {
    const normalizedTs = normalizeToMinute(row.timestamp);
    if (!normalizedTs) continue;
    const cumulative = typeof row.cumulative_net_premium === "number"
      ? row.cumulative_net_premium
      : typeof row.cumulative_net_premium === "string"
        ? Number(row.cumulative_net_premium)
        : null;
    grouped.set(normalizedTs, {
      timestamp: normalizedTs,
      cumulative: Number.isFinite(cumulative) ? (cumulative as number) : null,
    });
  }

  return Array.from(grouped.values())
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map((row) => ({
      timestamp: row.timestamp,
      premium: row.cumulative,
      positivePremium: row.cumulative != null && row.cumulative > 0 ? row.cumulative : null,
      negativePremium: row.cumulative != null && row.cumulative < 0 ? row.cumulative : null,
    }));
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

function flowRowTimestamp(row: {
  timestamp?: string;
  time_window_end?: string;
  interval_timestamp?: string | null;
  time_window_start?: string;
}): string | null {
  return row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start || null;
}

function getETTimeTimestamp(dateKey: string, etHour: number, etMinute: number): number | null {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return null;

  const etFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const candidateHours = Array.from(new Set([etHour + 4, etHour + 5])).filter((h) => h >= 0 && h <= 23);
  for (const utcHour of candidateHours) {
    const candidate = Date.UTC(y, m - 1, d, utcHour, etMinute);
    const parts = etFmt.formatToParts(new Date(candidate));
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? -1);
    const min = Number(parts.find((p) => p.type === "minute")?.value ?? -1);
    if (h === etHour && min === etMinute) return candidate;
  }
  return null;
}

function extendTimelineToSessionClose(timeline: string[], dateKey: string): string[] {
  if (timeline.length === 0) return timeline;
  const targetMs = getETTimeTimestamp(dateKey, 16, 15);
  if (targetMs == null) return timeline;

  const result = [...timeline];
  let cursor = new Date(result[result.length - 1]).getTime();
  if (!Number.isFinite(cursor)) return timeline;

  while (cursor < targetMs) {
    cursor += 60_000;
    result.push(new Date(cursor).toISOString());
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

function alignPremiumToTimeline(rows: NetDirectionalPremiumRow[], timeline: string[]): NetDirectionalPremiumRow[] {
  const byTs = new Map(rows.map((r) => [r.timestamp, r]));
  return timeline.map((timestamp) => byTs.get(timestamp) ?? {
    timestamp,
    premium: null,
    positivePremium: null,
    negativePremium: null,
  });
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

function buildTimeseriesFromByType(
  rows: FlowByTypePoint[],
  netVolumeMode: "cumulative_net_volume" | "cumulative_net_directional_volume",
): TimeseriesRow[] {
  // Use the last row per minute bucket for cumulative values (they are running totals).
  const grouped = new Map<
    string,
    { callPremium: number; putPremium: number; netVolume: number; underlyingPrice: number | null; latestTs: number }
  >();

  rows.forEach((row) => {
    const ts = normalizeToMinute(row.timestamp);
    if (!ts) return;

    const rowTime = new Date(row.timestamp).getTime();
    const current = grouped.get(ts);

    if (!current || rowTime > current.latestTs) {
      grouped.set(ts, {
        callPremium: Number(row.cumulative_call_premium || 0),
        putPremium: Number(row.cumulative_put_premium || 0),
        netVolume: Number(row[netVolumeMode] || 0),
        underlyingPrice: row.underlying_price != null ? Number(row.underlying_price) : (current?.underlyingPrice ?? null),
        latestTs: rowTime,
      });
    }
  });

  return Array.from(grouped.entries())
    .map(([timestamp, value]) => {
      const netVolume = value.netVolume;
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
  const grouped = new Map<string, { ratio: number; latestTs: number }>();

  rows.forEach((row) => {
    const ts = normalizeToMinute(row.timestamp);
    if (!ts) return;
    const rowTime = new Date(row.timestamp).getTime();
    const current = grouped.get(ts);
    if (!current || rowTime > current.latestTs) {
      grouped.set(ts, {
        ratio: Number(row.running_put_call_ratio || 0),
        latestTs: rowTime,
      });
    }
  });

  return Array.from(grouped.entries())
    .map(([timestamp, value]) => ({
      timestamp,
      ratio: value.ratio,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/**
 * Builds a timeseries for the by-expiration / by-strike charts.
 *
 * New API format (5-min buckets): each row carries cumulative call/put premium
 * and cumulative net volume values. For each timestamp we aggregate those
 * across every row matching the current filter (selected strikes/expirations).
 *
 * Legacy API format: rows have only bucket-level premium/net_premium/net_volume
 * fields. We fall back to summing those and accumulating manually.
 *
 * For the new format:
 * - callPremium = Σ(cumulative_call_premium)
 * - putPremium = Σ(cumulative_put_premium)
 * - netVolume = Σ(cumulative_net_volume)
 * - underlyingPrice = first row's underlying_price for the interval
 */
function buildTimeseriesFromCumulativeRows(
  rows: Array<{
    timestamp?: string;
    time_window_start?: string;
    time_window_end?: string;
    interval_timestamp?: string | null;
    // New format
    cumulative_call_premium?: number | string;
    cumulative_put_premium?: number | string;
    cumulative_premium?: number | string;
    cumulative_net_premium?: number | string;
    cumulative_net_volume?: number | string;
    cumulative_net_directional_volume?: number | string;
    // Legacy format fallback
    premium?: number | string;
    total_premium?: number | string;
    net_premium?: number | string;
    net_volume?: number | string;
    underlying_price?: number | string | null;
  }>,
  netVolumeMode: "cumulative_net_volume" | "cumulative_net_directional_volume",
): TimeseriesRow[] {
  const hasDirectCallPutCumulativeFields = rows.some(
    (r) => r.cumulative_call_premium != null || r.cumulative_put_premium != null,
  );

  // ── New format: sum cumulative call/put + cumulative_net_volume per timestamp ───────
  if (hasDirectCallPutCumulativeFields) {
    const grouped = new Map<
      string,
      {
        callPremium: number;
        putPremium: number;
        netVolume: number;
        underlyingPrice: number | null;
        hasUnderlying: boolean;
      }
    >();

    rows.forEach((row) => {
      const sourceTs = row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start;
      if (!sourceTs) return;
      const ts = normalizeToMinute(sourceTs);
      if (!ts) return;

      const current = grouped.get(ts) ?? {
        callPremium: 0,
        putPremium: 0,
        netVolume: 0,
        underlyingPrice: null,
        hasUnderlying: false,
      };
      current.callPremium += Number(row.cumulative_call_premium ?? 0);
      current.putPremium += Number(row.cumulative_put_premium ?? 0);
      current.netVolume += Number(row[netVolumeMode] ?? 0);
      if (!current.hasUnderlying) {
        current.underlyingPrice = row.underlying_price != null ? Number(row.underlying_price) : null;
        current.hasUnderlying = true;
      }
      grouped.set(ts, current);
    });

    return Array.from(grouped.entries())
      .map(([timestamp, value]) => {
        const callPremium = value.callPremium;
        const putPremium = value.putPremium;
        const netVolume = value.netVolume;
        return {
          timestamp,
          time: safeTimeLabel(timestamp),
          callPremium,
          putPremium,
          netVolume,
          positiveNetVolume: netVolume > 0 ? netVolume : 0,
          negativeNetVolume: netVolume < 0 ? netVolume : 0,
          underlyingPrice: value.underlyingPrice,
        };
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // ── Legacy format: sum bucket-level values then accumulate ────────────────
  const grouped = new Map<
    string,
    { totalPremium: number; netPremium: number; netVolume: number; underlyingPrice: number | null }
  >();

  rows.forEach((row) => {
    const sourceTs = row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start;
    if (!sourceTs) return;
    const ts = normalizeToMinute(sourceTs);
    if (!ts) return;

    const current = grouped.get(ts) ?? { totalPremium: 0, netPremium: 0, netVolume: 0, underlyingPrice: null };
    current.totalPremium += Number(row.total_premium ?? row.premium ?? 0);
    current.netPremium   += Number(row.net_premium ?? 0);
    current.netVolume    += Number(row.net_volume ?? 0);
    if (current.underlyingPrice === null && row.underlying_price != null) {
      current.underlyingPrice = Number(row.underlying_price);
    }
    grouped.set(ts, current);
  });

  const perBucket = Array.from(grouped.entries())
    .map(([timestamp, v]) => ({
      timestamp,
      callBucket: Math.max(0, (v.totalPremium + v.netPremium) / 2),
      putBucket:  Math.max(0, (v.totalPremium - v.netPremium) / 2),
      netVolume:  v.netVolume,
      underlyingPrice: v.underlyingPrice,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let cumCall = 0, cumPut = 0, cumVol = 0;
  return perBucket.map((row) => {
    cumCall += row.callBucket;
    cumPut  += row.putBucket;
    cumVol  += row.netVolume;
    return {
      timestamp: row.timestamp,
      time: safeTimeLabel(row.timestamp),
      callPremium: cumCall,
      putPremium:  cumPut,
      netVolume:   cumVol,
      positiveNetVolume: cumVol > 0 ? cumVol : 0,
      negativeNetVolume: cumVol < 0 ? cumVol : 0,
      underlyingPrice: row.underlyingPrice,
    };
  });
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

/**
 * Generates an array of evenly-spaced, human-readable tick values spanning
 * [min, max].  Uses getDynamicStep to pick a clean interval.
 */
function generateNiceTicks(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) return [min];
  const step = getDynamicStep(min, max);
  const start = roundToStep(min, step, "down");
  const ticks: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t = parseFloat((start + i * step).toPrecision(12));
    ticks.push(t);
    if (t >= max) break;
  }
  return ticks;
}

/** True when the timestamp falls on a :00 or :30 UTC minute boundary.
 *  Because ET market times are always at :30 offset (DST-safe), UTC :00/:30
 *  maps exactly to each half-hour boundary in ET. */
function is30MinBoundary(ts: string): boolean {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return false;
  const m = d.getUTCMinutes();
  return m === 0 || m === 30;
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
  onClear,
  label,
  isDark,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear?: () => void;
  label: string;
  isDark: boolean;
}) {
  if (options.length === 0) {
    return <div className="text-sm" style={{ color: isDark ? "var(--color-text-secondary)" : "var(--color-text-secondary)" }}>No {label.toLowerCase()} available</div>;
  }

  return (
    <div className="mb-4">
      <div className="mb-2 text-xs" style={{ color: "var(--color-text-secondary)" }}>
        {selected.size > 0 ? `${selected.size} selected` : "No filters selected"}
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.has(option);
          return (
            <button
              key={option}
              onClick={() => onToggle(option)}
              style={active
                ? {
                    backgroundColor: "var(--color-info)",
                    borderColor: "var(--color-info)",
                    color: "#ffffff",
                  }
                : {
                    backgroundColor: "var(--color-surface-subtle)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text-secondary)",
                  }}
              className={`px-3 py-1.5 text-sm rounded-md border transition ${
                active
                  ? "shadow-sm"
                  : "hover:border-[var(--border-strong)]"
              }`}
              type="button"
              aria-pressed={active}
            >
              {active ? `✓ ${option}` : option}
            </button>
          );
        })}
      </div>
      {onClear && selected.size > 0 ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 text-xs underline underline-offset-2 hover:opacity-80"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function DateSelect({
  dates,
  value,
  onChange,
  isDark,
}: {
  dates: string[];
  value: string;
  onChange: (d: string) => void;
  isDark: boolean;
}) {
  if (dates.length === 0) return null;
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm" style={{ color: isDark ? "var(--color-text-secondary)" : "var(--color-text-secondary)" }}>Date</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 text-sm rounded-md border focus:outline-none cursor-pointer"
        style={{
          backgroundColor: "var(--color-surface-subtle)",
          borderColor: "var(--color-border)",
          color: "var(--color-text-primary)",
        }}
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

function FullWidthFlowChart({ rows, isDark, isMobile }: { rows: TimeseriesRow[]; isDark: boolean; isMobile: boolean }) {
  const gridStroke = isDark ? "var(--color-text-secondary)" : "var(--color-border)";
  const axisStroke = isDark ? "var(--color-text-primary)" : "var(--color-text-primary)";

  if (rows.length === 0) {
    return <div className="text-center py-8" style={{ color: isDark ? "var(--color-text-secondary)" : "var(--color-text-secondary)" }}>No chart data available</div>;
  }

  // ── Premium axis: handle negative cumulative values ─────────────────────────
  const premiumValues = rows.flatMap((r) => [r.callPremium ?? 0, r.putPremium ?? 0]).filter(Number.isFinite);
  const rawMinPremium = premiumValues.length > 0 ? Math.min(0, ...premiumValues) : 0;
  const rawMaxPremium = premiumValues.length > 0 ? Math.max(0, ...premiumValues) : 0;
  const premiumStep = getDynamicStep(rawMinPremium, Math.max(1, rawMaxPremium - rawMinPremium));
  const premiumDomainMin = roundToStep(rawMinPremium, premiumStep, "down");
  const premiumDomainMax = roundToStep(Math.max(rawMinPremium + 1, rawMaxPremium), premiumStep, "up");
  const premiumTicks = generateNiceTicks(premiumDomainMin, premiumDomainMax);

  // ── Volume axis: actual min/max with nice step ─────────────────────────────
  const rawVolumeValues = rows.map((r) => r.netVolume ?? 0).filter(Number.isFinite);
  const rawMinVolume = rawVolumeValues.length > 0 ? Math.min(0, ...rawVolumeValues) : 0;
  const rawMaxVolume = rawVolumeValues.length > 0 ? Math.max(0, ...rawVolumeValues) : 0;
  const volumeStep = getDynamicStep(rawMinVolume, rawMaxVolume);
  const minVolume = roundToStep(rawMinVolume, volumeStep, "down");
  // Ensure the domain never collapses to [x, x] which hides the chart
  const rawMaxVolumeRounded = roundToStep(rawMaxVolume, volumeStep, "up");
  const maxVolume = rawMaxVolumeRounded > minVolume ? rawMaxVolumeRounded : minVolume + volumeStep;
  const volumeTicks = generateNiceTicks(minVolume, maxVolume);

  // ── Price axis: padded domain with nice explicit ticks ─────────────────────
  const underlyingDomain = getUnderlyingDomain(rows);
  const [domainMin, domainMax] = underlyingDomain;
  const priceRange = typeof domainMin === "number" && typeof domainMax === "number" ? domainMax - domainMin : 0;
  const priceDecimals = priceRange / 5 < 1 ? 2 : 0;
  const priceTicks =
    typeof domainMin === "number" && typeof domainMax === "number"
      ? generateNiceTicks(domainMin, domainMax)
      : undefined;

  const dateMarkerMeta = getDateMarkerMeta(rows.map((r) => r.timestamp));
  const leftChartMargin = isMobile ? 8 : getDynamicLeftMargin(rows);
  const rightChartMargin = isMobile ? 8 : 70;
  const yAxisWidth = isMobile ? 40 : 72;
  const yAxisWidthRight = isMobile ? 38 : 62;
  const chartWidth = isMobile ? 900 : "100%";

  return (
    <div className={isMobile ? "overflow-x-auto pb-2" : ""}>
      <div className="h-[580px]" style={{ width: chartWidth, minWidth: isMobile ? 900 : undefined }}>
      <ResponsiveContainer width="100%" height="62%">
        <ComposedChart data={rows} margin={{ top: 20, right: rightChartMargin, left: leftChartMargin, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.25} />
          <XAxis
            dataKey="timestamp"
            stroke={axisStroke}
            minTickGap={24}
            padding={{ left: 0, right: 0 }}
            hide
          />
          <YAxis
            yAxisId="price"
            stroke={axisStroke}
            orientation="left"
            domain={underlyingDomain}
            ticks={priceTicks}
            tickFormatter={(v) => `$${Number(v).toFixed(priceDecimals)}`}
            tick={{ fontSize: isMobile ? 9 : 10, fill: axisStroke }}
            tickMargin={isMobile ? 2 : 8}
            width={yAxisWidth}
            padding={{ top: 14, bottom: 8 }}
            label={isMobile ? undefined : { value: "Underlying Price", angle: -90, position: "left", fill: axisStroke, fontSize: 10, offset: 10 }}
          />
          <YAxis
            yAxisId="premium"
            stroke={axisStroke}
            orientation="right"
            domain={[premiumDomainMin, premiumDomainMax]}
            ticks={premiumTicks}
            tickFormatter={(v) => {
              const n = Number(v);
              const abs = Math.abs(n);
              const sign = n < 0 ? '-' : '';
              if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
              if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
              return `${sign}$${Math.round(abs)}`;
            }}
            tick={{ fontSize: isMobile ? 9 : 10, fill: axisStroke }}
            tickMargin={isMobile ? 2 : 8}
            width={yAxisWidthRight}
            padding={{ top: 14, bottom: 8 }}
            label={isMobile ? undefined : { value: "Net Put/Call Premiums", angle: 90, position: "right", fill: axisStroke, fontSize: 10, offset: 16 }}
          />
          <Tooltip
            contentStyle={{ backgroundColor: "var(--color-chart-tooltip-bg)", borderColor: "var(--color-border)", borderRadius: 8, color: "var(--color-chart-tooltip-text)" }}
            labelStyle={{ color: "var(--color-chart-tooltip-text)", fontWeight: 600 }}
            itemStyle={{ color: "var(--color-chart-tooltip-muted)" }}
            labelFormatter={(value) => new Date(String(value)).toLocaleString()}
            formatter={(value, name) => {
              const n = Number(value ?? 0);
              if (name === "Underlying") return [`$${n.toFixed(2)}`, name];
              return [`$${n.toLocaleString()}`, name];
            }}
          />
          <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 11, paddingBottom: 6, color: isDark ? "var(--color-border)" : "var(--color-text-primary)" }} />
          <ReferenceLine yAxisId="premium" y={0} stroke={axisStroke} opacity={0.6} />
          <Line
            yAxisId="price"
            type="monotone"
            dataKey="underlyingPrice"
            name="Underlying"
            stroke="var(--color-warning)"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="premium"
            type="monotone"
            dataKey="callPremium"
            name="Net Call Prem"
            stroke="var(--color-positive)"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="premium"
            type="monotone"
            dataKey="putPremium"
            name="Net Put Prem"
            stroke="var(--color-negative)"
            strokeWidth={2}
            dot={false}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>

      <ResponsiveContainer width="100%" height="38%">
        <ComposedChart data={rows} margin={{ top: 0, right: rightChartMargin, left: leftChartMargin, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.2} vertical={false} />
          <XAxis
            dataKey="timestamp"
            stroke={axisStroke}
            interval={0}
            minTickGap={24}
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
                    <text dy={26} textAnchor="middle" fill={isDark ? "var(--color-text-secondary)" : "var(--color-text-secondary)"} fontSize={9}>
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
            width={yAxisWidth}
            axisLine={false}
            tickLine={false}
            tick={false}
          />
          <YAxis
            yAxisId="volume"
            orientation="right"
            stroke={axisStroke}
            domain={[minVolume, maxVolume]}
            ticks={volumeTicks}
            tickFormatter={(v) => {
              const n = Number(v);
              if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
              if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
              return String(Math.round(n));
            }}
            tick={{ fontSize: isMobile ? 9 : 10, fill: axisStroke }}
            tickMargin={isMobile ? 2 : 8}
            width={yAxisWidthRight}
            label={isMobile ? undefined : { value: "Net Volume", angle: 90, position: "right", fill: axisStroke, fontSize: 10, offset: 16 }}
          />
          <Tooltip
            content={({ active, label, payload }) => {
              if (!active || !payload || payload.length === 0) return null;
              const point = payload[0]?.payload as { netVolume?: number } | undefined;
              return (
                <div style={{ backgroundColor: "var(--color-chart-tooltip-bg)", borderColor: "var(--color-border)", color: "var(--color-chart-tooltip-text)" }} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="font-semibold">{new Date(String(label)).toLocaleString()}</div>
                  <div>Net Volume: {Number(point?.netVolume ?? 0).toLocaleString()}</div>
                </div>
              );
            }}
          />
          <ReferenceLine yAxisId="volume" y={0} stroke={axisStroke} opacity={0.6} />
          <Area
            yAxisId="volume"
            type="monotone"
            dataKey="positiveNetVolume"
            name="Positive Net Volume"
            stroke="var(--color-positive)"
            fill="var(--color-positive)"
            fillOpacity={0.45}
            baseValue={0}
            connectNulls
            isAnimationActive={false}
          />
          <Area
            yAxisId="volume"
            type="monotone"
            dataKey="negativeNetVolume"
            name="Negative Net Volume"
            stroke="var(--color-negative)"
            fill="var(--color-negative)"
            fillOpacity={0.45}
            baseValue={0}
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

export default function FlowAnalysisPage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const isMobile = useIsMobile();
  const cardBg = isDark ? "var(--color-surface)" : "var(--color-surface)";
  const inputBg = "var(--color-surface-subtle)";
  const inputBorder = "var(--color-border)";
  const inputColor = "var(--color-text-primary)";
  const mutedText = isDark ? "var(--color-text-secondary)" : "var(--color-text-secondary)";
  const axisStroke = isDark ? "var(--color-text-primary)" : "var(--color-text-primary)";

  // ── Session selector (current = most recent session, prior = previous full session)
  const [flowSession, setFlowSession] = useState<"current" | "prior">("current");
  const [netVolumeMode, setNetVolumeMode] = useState<"cumulative_net_volume" | "cumulative_net_directional_volume">(
    "cumulative_net_directional_volume",
  );

  // Fetch all data for the selected session
  const {
    data: flowByType,
    loading: flowLoading,
    error: flowError,
  } = useApiData<FlowByTypePoint[]>(
    `/api/flow/by-type?symbol=${symbol}&session=${flowSession}`,
    { refreshInterval: 30000 },
  );

  // Probe the other session to get its date for the dropdown label
  const otherSession = flowSession === "current" ? "prior" : "current";
  const { data: otherSessionProbe } = useApiData<FlowByTypePoint[]>(
    `/api/flow/by-type?symbol=${symbol}&session=${otherSession}`,
    { refreshInterval: 60000 },
  );
  const otherSessionDate = useMemo(() => {
    if (!otherSessionProbe || otherSessionProbe.length === 0) return null;
    const sorted = [...otherSessionProbe].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return getETDateKey(sorted[0].timestamp) || null;
  }, [otherSessionProbe]);

  const { data: flowByExpirationSession, error: expirationErrorSession } = useApiData<FlowByExpirationPoint[]>(
    `/api/flow/by-expiration?symbol=${symbol}&session=${flowSession}&limit=500`,
    { refreshInterval: 30000 },
  );
  const { data: flowByExpirationNoSession, error: expirationErrorNoSession } = useApiData<FlowByExpirationPoint[]>(
    `/api/flow/by-expiration?symbol=${symbol}&limit=500`,
    { refreshInterval: 30000, enabled: Boolean(expirationErrorSession) },
  );

  const { data: flowByStrikeSession, error: strikeErrorSession } = useApiData<FlowByStrikePoint[]>(
    `/api/flow/by-strike?symbol=${symbol}&session=${flowSession}&limit=500`,
    { refreshInterval: 30000 },
  );
  const { data: flowByStrikeNoSession, error: strikeErrorNoSession } = useApiData<FlowByStrikePoint[]>(
    `/api/flow/by-strike?symbol=${symbol}&limit=500`,
    { refreshInterval: 30000, enabled: Boolean(strikeErrorSession) },
  );

  const flowByExpiration = flowByExpirationSession || flowByExpirationNoSession;
  const flowByStrike = flowByStrikeSession || flowByStrikeNoSession;
  const expirationError = expirationErrorSession && expirationErrorNoSession ? expirationErrorSession : null;
  const strikeError = strikeErrorSession && strikeErrorNoSession ? strikeErrorSession : null;

  // ── Derive the session date from the returned data ──────────────────────────

  /** ET date key for the session returned by the API (e.g. "2026-03-17"). */
  const selectedDate = useMemo(() => {
    if (!flowByType || flowByType.length === 0) return getCurrentETDateKey();
    // Use the latest row's date as the canonical session date.
    const sorted = [...flowByType].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return getETDateKey(sorted[0].timestamp) || getCurrentETDateKey();
  }, [flowByType]);

  const currentDateLabel = flowSession === "current" ? selectedDate : (otherSessionDate ?? null);
  const priorDateLabel = flowSession === "prior" ? selectedDate : (otherSessionDate ?? null);

  // ── Session timeline (fixed 09:30–16:00 ET for selected date) ──────────────

  const sessionTimeline = useMemo(() => {
    if (!selectedDate) return [];
    return extendTimelineToSessionClose(getSessionTimestamps(selectedDate), selectedDate);
  }, [selectedDate]);

  // ── Snapshot (most recent row's cumulative values) ──────────────────────────

  const latestSnapshot = useMemo(() => {
    if (!selectedDate || !flowByType || flowByType.length === 0) return null;
    const dateRows = flowByType.filter((r) => getETDateKey(r.timestamp) === selectedDate);
    if (dateRows.length === 0) return null;

    const latest = [...dateRows].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )[0];

    const callVolume = Number(latest.cumulative_call_volume || 0);
    const putVolume = Number(latest.cumulative_put_volume || 0);

    return {
      timestamp: latest.timestamp,
      callVolume,
      putVolume,
      callPremium: Number(latest.cumulative_call_premium || 0),
      putPremium: Number(latest.cumulative_put_premium || 0),
      netFlow: Number(latest.cumulative_net_volume || 0),
      netPremium: Number(latest.cumulative_net_premium || 0),
      putCallRatio: Number(latest.running_put_call_ratio || 0),
    };
  }, [selectedDate, flowByType]);
  const flowTone: 'bullish' | 'bearish' | 'neutral' = !latestSnapshot
    ? 'neutral'
    : (Math.abs(latestSnapshot.netPremium) < 250_000 && Math.abs(latestSnapshot.netFlow) < 10_000)
      ? 'neutral'
      : latestSnapshot.netPremium > 0 && latestSnapshot.netFlow > 0
        ? 'bullish'
        : latestSnapshot.netPremium < 0 && latestSnapshot.netFlow < 0
          ? 'bearish'
          : 'neutral';
  const flowBadge =
    flowTone === 'neutral' ? 'Mixed / Two-Way Flow' : flowTone === 'bullish' ? 'Risk-On Flow Regime' : 'Risk-Off Flow Regime';
  const flowSummary = !latestSnapshot
    ? 'Flow snapshot is still loading. Once data arrives, this banner will summarize whether options participants are pressing risk-on or risk-off in the selected session.'
    : `Session flow is showing ${latestSnapshot.netPremium >= 0 ? 'net call-premium' : 'net put-premium'} pressure of $${(Math.abs(latestSnapshot.netPremium) / 1_000_000).toFixed(2)}M with a net contract imbalance of ${Math.abs(latestSnapshot.netFlow).toLocaleString()} (${latestSnapshot.netFlow >= 0 ? 'call-led' : 'put-led'}). Put/Call ratio is ${latestSnapshot.putCallRatio.toFixed(2)}, which ${
      latestSnapshot.putCallRatio > 1.1 ? 'leans defensive' : latestSnapshot.putCallRatio < 0.9 ? 'leans risk-on' : 'is close to balanced'
    }. Day traders can anchor directional bias to this flow regime, while swing traders should watch for follow-through across multiple sessions before sizing up.`;

  // ── Main options flow series ────────────────────────────────────────────────

  const mainSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const dateRows = (flowByType ?? []).filter((r) => getETDateKey(r.timestamp) === selectedDate);
    const base = buildTimeseriesFromByType(dateRows, netVolumeMode);
    return alignSeriesToTimeline(base, sessionTimeline);
  }, [selectedDate, flowByType, sessionTimeline, netVolumeMode]);

  // ── By-expiration ───────────────────────────────────────────────────────────

  const expirationOptions = useMemo(() => {
    if (!selectedDate || !flowByExpiration) return [];
    const dateRows = flowByExpiration.filter((r) => {
      const ts = flowRowTimestamp(r);
      return ts ? getETDateKey(ts) === selectedDate : false;
    });
    const todayKey = getCurrentETDateKey();
    return Array.from(
      new Set(dateRows.map((r) => r.expiration).filter((exp) => isActiveExpiration(exp, todayKey))),
    ).sort();
  }, [selectedDate, flowByExpiration]);

  const [selectedExpirations, setSelectedExpirations] = useState<Set<string>>(new Set());
  const [expirationSelectionCleared, setExpirationSelectionCleared] = useState(false);
  const effectiveSelectedExpirations = useMemo(() => {
    const kept = expirationOptions.filter((exp) => selectedExpirations.has(exp));
    if (kept.length > 0) return new Set(kept);
    if (expirationSelectionCleared || expirationOptions.length === 0) return new Set<string>();
    return new Set([expirationOptions[0]]);
  }, [expirationOptions, selectedExpirations, expirationSelectionCleared]);

  const expirationSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const dateRows = (flowByExpiration ?? []).filter((r) => {
      const ts = flowRowTimestamp(r);
      return ts ? getETDateKey(ts) === selectedDate : false;
    });
    const available = new Set(expirationOptions);
    const activeSelection = new Set(Array.from(effectiveSelectedExpirations).filter((v) => available.has(v)));
    const filtered =
      activeSelection.size > 0
        ? dateRows.filter((r) => activeSelection.has(r.expiration))
        : dateRows.filter((r) => available.has(r.expiration));
    const base = buildTimeseriesFromCumulativeRows(filtered, netVolumeMode);
    const aligned = alignSeriesToTimeline(base, sessionTimeline);
    const mainPriceByTs = new Map(mainSeries.map((row) => [row.timestamp, row.underlyingPrice]));
    return aligned.map((row) => ({
      ...row,
      underlyingPrice: row.underlyingPrice ?? mainPriceByTs.get(row.timestamp) ?? null,
    }));
  }, [selectedDate, flowByExpiration, effectiveSelectedExpirations, expirationOptions, sessionTimeline, mainSeries, netVolumeMode]);

  // ── By-strike ───────────────────────────────────────────────────────────────

  const strikeOptions = useMemo(() => {
    if (!selectedDate || !flowByStrike) return [];
    const dateRows = flowByStrike.filter((r) => {
      const ts = flowRowTimestamp(r);
      return ts ? getETDateKey(ts) === selectedDate : false;
    });
    return Array.from(new Set(dateRows.map((r) => String(r.strike)).filter(Boolean))).sort(
      (a, b) => Number(a) - Number(b),
    );
  }, [selectedDate, flowByStrike]);

  const [selectedStrikes, setSelectedStrikes] = useState<Set<string>>(new Set());
  const [strikeSelectionCleared, setStrikeSelectionCleared] = useState(false);

  const latestUnderlyingPrice = useMemo(() => {
    for (let i = mainSeries.length - 1; i >= 0; i -= 1) {
      const p = mainSeries[i]?.underlyingPrice;
      if (typeof p === "number" && Number.isFinite(p)) return p;
    }
    return null;
  }, [mainSeries]);

  const effectiveSelectedStrikes = useMemo(() => {
    const kept = strikeOptions.filter((strike) => selectedStrikes.has(strike));
    if (kept.length > 0) return new Set(kept);
    if (strikeSelectionCleared || strikeOptions.length === 0) return new Set<string>();

    if (latestUnderlyingPrice == null) return new Set([strikeOptions[0]]);
    let closest = strikeOptions[0];
    let closestDistance = Math.abs(Number(closest) - latestUnderlyingPrice);
    for (const strike of strikeOptions) {
      const strikeNum = Number(strike);
      if (!Number.isFinite(strikeNum)) continue;
      const distance = Math.abs(strikeNum - latestUnderlyingPrice);
      if (distance < closestDistance) {
        closest = strike;
        closestDistance = distance;
      }
    }
    return new Set([closest]);
  }, [strikeOptions, selectedStrikes, strikeSelectionCleared, latestUnderlyingPrice]);

  const strikeSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const dateRows = (flowByStrike ?? []).filter((r) => {
      const ts = flowRowTimestamp(r);
      return ts ? getETDateKey(ts) === selectedDate : false;
    });
    const filtered =
      effectiveSelectedStrikes.size > 0
        ? dateRows.filter((r) => effectiveSelectedStrikes.has(String(r.strike)))
        : dateRows;
    const base = buildTimeseriesFromCumulativeRows(filtered, netVolumeMode);
    const aligned = alignSeriesToTimeline(base, sessionTimeline);
    const mainPriceByTs = new Map(mainSeries.map((row) => [row.timestamp, row.underlyingPrice]));
    return aligned.map((row) => ({
      ...row,
      underlyingPrice: row.underlyingPrice ?? mainPriceByTs.get(row.timestamp) ?? null,
    }));
  }, [selectedDate, flowByStrike, effectiveSelectedStrikes, sessionTimeline, mainSeries, netVolumeMode]);

  // ── Put/Call ratio ──────────────────────────────────────────────────────────

  const putCallRatioSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const dateRows = (flowByType ?? []).filter((r) => getETDateKey(r.timestamp) === selectedDate);
    const base = buildPutCallRatioSeries(dateRows);
    return alignRatioToTimeline(base, sessionTimeline);
  }, [selectedDate, flowByType, sessionTimeline]);

  const directionalPremiumSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const dateRows = (flowByType ?? []).filter((r) => getETDateKey(r.timestamp) === selectedDate);
    const base = buildNetDirectionalPremiumSeries(dateRows);
    return alignPremiumToTimeline(base, sessionTimeline);
  }, [selectedDate, flowByType, sessionTimeline]);

  const directionalPremiumVisibleSeries = useMemo(() => {
    if (directionalPremiumSeries.length === 0) return [];

    const lastDataIndex = directionalPremiumSeries.findLastIndex((row) => row.premium != null);
    if (lastDataIndex < 0) return [];

    return directionalPremiumSeries.slice(0, lastDataIndex + 1);
  }, [directionalPremiumSeries]);

  const ratioDateMarkerMeta = useMemo(
    () => getDateMarkerMeta(putCallRatioSeries.map((r) => r.timestamp)),
    [putCallRatioSeries],
  );
  const ratioTimeTickStep = Math.max(1, Math.ceil(Math.max(1, putCallRatioSeries.length) / 10));

  // ── Chip toggles ────────────────────────────────────────────────────────────

  const toggleExpirations = (value: string) => {
    setExpirationSelectionCleared(false);
    setSelectedExpirations((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  };

  const toggleStrikes = (value: string) => {
    setStrikeSelectionCleared(false);
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
      <RegimeSummaryBanner
        title="Flow Analysis Regime"
        badge={flowBadge}
        tone={flowTone}
        summary={flowSummary}
      />

      {/* Session selector — shared across all sections */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: mutedText }}>Session</span>
          <select
            value={flowSession}
            onChange={(e) => {
              setFlowSession(e.target.value as "current" | "prior");
              setExpirationSelectionCleared(false);
              setSelectedExpirations(new Set());
              setStrikeSelectionCleared(false);
              setSelectedStrikes(new Set());
            }}
            className="px-3 py-1.5 text-sm rounded-md border focus:outline-none cursor-pointer"
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputColor }}
          >
            <option value="current">Current{currentDateLabel ? ` (${currentDateLabel})` : ""}</option>
            <option value="prior">Prior{priorDateLabel ? ` (${priorDateLabel})` : ""}</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm" style={{ color: mutedText }}>Net Volume Basis</span>
          <select
            value={netVolumeMode}
            onChange={(e) => setNetVolumeMode(e.target.value as "cumulative_net_volume" | "cumulative_net_directional_volume")}
            className="px-3 py-1.5 text-sm rounded-md border focus:outline-none cursor-pointer"
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputColor }}
          >
            <option value="cumulative_net_directional_volume">Directional</option>
            <option value="cumulative_net_volume">Raw Net</option>
          </select>
        </div>
      </div>

      {/* ── Flow Snapshot ─────────────────────────────────────────────── */}
      <section className="mb-8">
        <SectionTitle
          title="Flow Snapshot"
          tooltip="Cumulative snapshot from the most recent data point in the selected trading session."
        />
        <div className="text-sm mb-3" style={{ color: mutedText }}>
          Daily Totals as of:{" "}
          {latestSnapshot?.timestamp ? new Date(latestSnapshot.timestamp).toLocaleString() : "--"}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <MetricCard
            title="Call Volume"
            value={Number(latestSnapshot?.callVolume || 0).toLocaleString()}
            subtitle={`${Number(latestSnapshot?.callPremium || 0) < 0 ? '-' : ''}$${(Math.abs(Number(latestSnapshot?.callPremium || 0)) / 1_000_000).toFixed(2)}M premium`}
            trend="bullish"
            tooltip="Cumulative call contracts and net call premium across the selected date."
            theme="dark"
          />
          <MetricCard
            title="Put Volume"
            value={Number(latestSnapshot?.putVolume || 0).toLocaleString()}
            subtitle={`${Number(latestSnapshot?.putPremium || 0) < 0 ? '-' : ''}$${(Math.abs(Number(latestSnapshot?.putPremium || 0)) / 1_000_000).toFixed(2)}M premium`}
            trend="bearish"
            tooltip="Cumulative put contracts and net put premium across the selected date."
            theme="dark"
          />
          <MetricCard
            title="Net Flow"
            value={Number(latestSnapshot?.netFlow || 0).toLocaleString()}
            subtitle="contracts"
            trend={Number(latestSnapshot?.netFlow || 0) > 0 ? "bullish" : "bearish"}
            tooltip="Cumulative call volume minus put volume across the selected date."
            theme="dark"
          />
          <MetricCard
            title="Net Premium"
            value={`${Number(latestSnapshot?.netPremium || 0) < 0 ? '-' : ''}$${(Math.abs(Number(latestSnapshot?.netPremium || 0)) / 1_000_000).toFixed(2)}M`}
            trend={Number(latestSnapshot?.netPremium || 0) > 0 ? "bullish" : "bearish"}
            tooltip="Cumulative call premium minus put premium across the selected date."
            theme="dark"
          />
          <MetricCard
            title="Put/Call Ratio"
            value={Number(latestSnapshot?.putCallRatio || 0).toFixed(2)}
            trend={Number(latestSnapshot?.putCallRatio || 0) > 1 ? "bearish" : "bullish"}
            tooltip="Cumulative put volume divided by cumulative call volume across the selected date."
            theme="dark"
          />
        </div>
      </section>

      {/* ── Options Flow ──────────────────────────────────────────────── */}
      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: cardBg }}>
        <SectionTitle
          title="Options Flow"
          tooltip="Primary axis: call premium (green) and put premium (red). Bottom axis: net volume area, green above zero and red below zero. X-axis spans the full session from first bar to 16:15 ET."
        />
        <FullWidthFlowChart rows={mainSeries} isDark={isDark} isMobile={isMobile} />
      </section>

      {/* ── Flow by Expiration ────────────────────────────────────────── */}
      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: cardBg }}>
        <SectionTitle
          title="Flow by Expiration"
          tooltip="Same chart format, filtered by one or more expiration dates."
        />
        <MultiSelectChips
          options={expirationOptions}
          selected={effectiveSelectedExpirations}
          onToggle={toggleExpirations}
          onClear={() => {
            setExpirationSelectionCleared(true);
            setSelectedExpirations(new Set());
          }}
          label="Expirations"
          isDark={isDark}
        />
        {expirationError && <ErrorMessage message={expirationError} />}
        <FullWidthFlowChart rows={expirationSeries} isDark={isDark} isMobile={isMobile} />
      </section>

      {/* ── Flow by Strike ────────────────────────────────────────────── */}
      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: cardBg }}>
        <SectionTitle
          title="Flow by Strike"
          tooltip="Same chart format, filtered by one or more strikes."
        />
        <MultiSelectChips
          options={strikeOptions}
          selected={effectiveSelectedStrikes}
          onToggle={toggleStrikes}
          onClear={() => {
            setStrikeSelectionCleared(true);
            setSelectedStrikes(new Set());
          }}
          label="Strikes"
          isDark={isDark}
        />
        {strikeError && <ErrorMessage message={strikeError} />}
        <FullWidthFlowChart rows={strikeSeries} isDark={isDark} isMobile={isMobile} />
      </section>

      {/* ── Net Directional Premium ───────────────────────────────────── */}
      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: cardBg }}>
        <SectionTitle
          title="Net Directional Premium"
          tooltip="Cumulative net directional premium from flow-by-type, where positive values indicate net bullish premium and negative values indicate net bearish premium."
        />
        {directionalPremiumVisibleSeries.length === 0 ? (
          <div className="text-center py-8" style={{ color: mutedText }}>No net directional premium data available</div>
        ) : (
          <div className={isMobile ? "overflow-x-auto pb-2" : ""}>
            <div style={{ width: isMobile ? 900 : "100%", minWidth: isMobile ? 900 : undefined, height: 580 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={directionalPremiumVisibleSeries}
                  margin={isMobile ? { top: 8, right: 8, left: 8, bottom: 24 } : { top: 10, right: 70, left: 70, bottom: 28 }}
                >
                  <XAxis
                    dataKey="timestamp"
                    stroke={axisStroke}
                    interval={0}
                    minTickGap={24}
                    tickLine={false}
                    tick={(props: {
                      x?: number | string;
                      y?: number | string;
                      payload?: { value?: string | number };
                    }) => {
                      const x = Number(props?.x ?? 0);
                      const y = Number(props?.y ?? 0);
                      const ts = String(props?.payload?.value || "");
                      const showTime = is30MinBoundary(ts);
                      if (!showTime) return <g transform={`translate(${x},${y})`} />;
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} />
                          <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>
                            {safeTimeLabel(ts)}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <YAxis
                    stroke={axisStroke}
                    tick={{ fontSize: isMobile ? 9 : 10, fill: axisStroke }}
                    tickMargin={isMobile ? 2 : 8}
                    width={isMobile ? 42 : 62}
                    tickFormatter={(v) => {
                      const n = Number(v);
                      if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
                      if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
                      return `$${Math.round(n)}`;
                    }}
                  />
                  {directionalPremiumVisibleSeries
                    .filter((row) => is30MinBoundary(row.timestamp))
                    .map((row) => (
                      <ReferenceLine
                        key={`premium-v-${row.timestamp}`}
                        x={row.timestamp}
                        stroke={axisStroke}
                        opacity={0.18}
                      />
                    ))}
                  <Tooltip
                    content={({ active, label, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const point = payload[0]?.payload as { premium?: number | null } | undefined;
                      return (
                        <div className="rounded border px-3 py-2 text-sm" style={{ backgroundColor: "var(--color-chart-tooltip-bg)", borderColor: "var(--color-border)", color: "var(--color-chart-tooltip-text)" }}>
                          <div className="font-semibold">{new Date(String(label)).toLocaleString()}</div>
                          <div>Cumulative Net Premium: {point?.premium != null ? `$${point.premium.toLocaleString()}` : "—"}</div>
                        </div>
                      );
                    }}
                  />
                  <ReferenceLine y={0} stroke={axisStroke} opacity={0.55} />
                  <Area
                    type="monotone"
                    dataKey="positivePremium"
                    name="Positive Premium"
                    stroke="var(--color-positive)"
                    fill="var(--color-positive)"
                    fillOpacity={0.42}
                    baseValue={0}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="negativePremium"
                    name="Negative Premium"
                    stroke="var(--color-negative)"
                    fill="var(--color-negative)"
                    fillOpacity={0.42}
                    baseValue={0}
                    connectNulls
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* ── Put/Call Ratio ────────────────────────────────────────────── */}
      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: cardBg }}>
        <SectionTitle
          title="Put/Call Ratio"
          tooltip="Put/call volume ratio over time for the selected date."
        />
        {putCallRatioSeries.length === 0 ? (
          <div className="text-center py-8" style={{ color: mutedText }}>No put/call ratio data available</div>
        ) : (
          <div className={isMobile ? "overflow-x-auto pb-2" : ""}>
            <div style={{ width: isMobile ? 900 : "100%", minWidth: isMobile ? 900 : undefined, height: 580 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={putCallRatioSeries}
                  margin={isMobile ? { top: 8, right: 8, left: 8, bottom: 24 } : { top: 10, right: 70, left: 70, bottom: 28 }}
                >
                  <XAxis
                    dataKey="timestamp"
                    stroke={axisStroke}
                    interval={0}
                    minTickGap={24}
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
                      const dateLabel = ratioDateMarkerMeta.get(index);
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
                            <text dy={26} textAnchor="middle" fill={isDark ? "var(--color-text-secondary)" : "var(--color-text-secondary)"} fontSize={9}>
                              {dateLabel}
                            </text>
                          ) : null}
                        </g>
                      );
                    }}
                  />
                  {putCallRatioSeries
                    .filter((row) => is30MinBoundary(row.timestamp))
                    .map((row) => (
                      <ReferenceLine
                        key={`pcr-v-${row.timestamp}`}
                        x={row.timestamp}
                        stroke={axisStroke}
                        opacity={0.18}
                      />
                    ))}
                  <YAxis
                    stroke={axisStroke}
                    tick={{ fontSize: isMobile ? 9 : 10, fill: axisStroke }}
                    tickMargin={isMobile ? 2 : 8}
                    width={isMobile ? 38 : 62}
                    domain={(() => {
                      const vals = putCallRatioSeries.map((r) => r.ratio).filter((v): v is number => v != null && Number.isFinite(v));
                      if (vals.length === 0) return [0, 2];
                      const min = Math.min(...vals);
                      const max = Math.max(...vals);
                      const step = max - min > 1 ? 0.5 : 0.25;
                      return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
                    })()}
                    ticks={(() => {
                      const vals = putCallRatioSeries.map((r) => r.ratio).filter((v): v is number => v != null && Number.isFinite(v));
                      if (vals.length === 0) return [0, 0.5, 1.0, 1.5, 2.0];
                      const min = Math.min(...vals);
                      const max = Math.max(...vals);
                      const step = max - min > 1 ? 0.5 : 0.25;
                      const lo = Math.floor(min / step) * step;
                      const hi = Math.ceil(max / step) * step;
                      const t: number[] = [];
                      for (let v = lo; v <= hi + step / 2; v += step) t.push(parseFloat(v.toFixed(2)));
                      return t;
                    })()}
                    tickFormatter={(v) => Number(v).toFixed(2)}
                  />
                  <Tooltip
                    content={({ active, label, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      return (
                        <div className="rounded border px-3 py-2 text-sm" style={{ backgroundColor: isDark ? "var(--color-surface)" : "var(--color-surface)", borderColor: isDark ? "var(--color-surface)" : "var(--color-border)", color: isDark ? "var(--color-text-primary)" : "var(--color-text-primary)" }}>
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
                    stroke="var(--color-brand-primary)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
