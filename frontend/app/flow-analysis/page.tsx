"use client";

import { Info } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  Area,
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
import {
  useFlowByContractCache,
  computeFlowSnapshot,
  etDateKeyFor,
  flowRowTimestamp,
  forEachBar,
  latestRowDateKey,
  type FlowByContractPoint,
} from "@/hooks/useFlowByContract";
import ErrorMessage from "@/components/ErrorMessage";
import MetricCard from "@/components/MetricCard";
import TooltipWrapper from "@/components/TooltipWrapper";
import RegimeSummaryBanner from "@/components/RegimeSummaryBanner";
import { useTimeframe } from "@/core/TimeframeContext";
import { useTheme } from "@/core/ThemeContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { getSessionTimestamps } from "@/core/utils";

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

interface NetPositionRow {
  timestamp: string;
  callPosition: number | null;
  putPosition: number | null;
}

/**
 * Running session total of net_premium per 5-minute bar, aggregated across
 * every contract. Per-bar deltas from the API are accumulated into a rising
 * session curve.
 */
function buildNetDirectionalPremiumSeries(rows: FlowByContractPoint[]): NetDirectionalPremiumRow[] {
  const output: NetDirectionalPremiumRow[] = [];
  let runningPremium = 0;
  forEachBar(rows, ({ timestamp, rows: barRows }) => {
    for (const row of barRows) {
      const v = Number(row.net_premium ?? 0);
      if (Number.isFinite(v)) runningPremium += v;
    }
    output.push({
      timestamp,
      premium: runningPremium,
      positivePremium: runningPremium > 0 ? runningPremium : null,
      negativePremium: runningPremium < 0 ? runningPremium : null,
    });
  });
  return output;
}

// ── Date / session helpers ────────────────────────────────────────────────────

function getCurrentETDateKey(): string {
  return etDateKeyFor(new Date().toISOString());
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

function extendTimelineToSessionClose(timeline: string[], dateKey: string, stepMs: number = 60_000): string[] {
  if (timeline.length === 0) return timeline;
  const targetMs = getETTimeTimestamp(dateKey, 16, 15);
  if (targetMs == null) return timeline;

  const result = [...timeline];
  let cursor = new Date(result[result.length - 1]).getTime();
  if (!Number.isFinite(cursor)) return timeline;

  while (cursor < targetMs) {
    cursor += stepMs;
    result.push(new Date(cursor).toISOString());
  }
  return result;
}

/** Builds a 5-minute ET session timeline for the given date (09:30–16:15 ET). */
function getFiveMinuteSessionTimeline(dateKey: string): string[] {
  const minuteTimeline = getSessionTimestamps(dateKey);
  const fiveMin = minuteTimeline.filter((_, idx) => idx % 5 === 0);
  return extendTimelineToSessionClose(fiveMin, dateKey, 5 * 60_000);
}

/**
 * Returns the millisecond timestamp of the latest row in `rows`, or -Infinity
 * if the array is empty. Used so alignment functions can tell "internal gap"
 * (carry-forward) slots apart from "trailing" (leave null) slots.
 */
function latestRowMs<T extends { timestamp: string }>(rows: T[]): number {
  if (rows.length === 0) return -Infinity;
  const last = rows[rows.length - 1].timestamp;
  const ms = new Date(last).getTime();
  return Number.isFinite(ms) ? ms : -Infinity;
}

/**
 * Aligns a cumulative timeseries to the session timeline. Each chart on this
 * page plots running session totals, so a 5-minute bar with no reported API
 * activity should hold the previous cumulative value rather than punch a hole
 * in the line. We only leave nulls for slots *after* the last real bar so the
 * curve doesn't extrapolate into future market time.
 */
function alignSeriesToTimeline(rows: TimeseriesRow[], timeline: string[]): TimeseriesRow[] {
  const byTs = new Map(rows.map((r) => [r.timestamp, r]));
  const lastMs = latestRowMs(rows);

  let prev: TimeseriesRow | null = null;
  return timeline.map((timestamp) => {
    const exact = byTs.get(timestamp);
    if (exact) {
      prev = exact;
      return exact;
    }
    const ms = new Date(timestamp).getTime();
    if (prev && Number.isFinite(ms) && ms < lastMs) {
      const netVolume = prev.netVolume;
      return {
        timestamp,
        time: safeTimeLabel(timestamp),
        callPremium: prev.callPremium,
        putPremium: prev.putPremium,
        netVolume,
        positiveNetVolume: netVolume != null && netVolume > 0 ? netVolume : 0,
        negativeNetVolume: netVolume != null && netVolume < 0 ? netVolume : 0,
        underlyingPrice: prev.underlyingPrice,
      } satisfies TimeseriesRow;
    }
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

function alignRatioToTimeline(rows: PutCallRatioRow[], timeline: string[]): PutCallRatioRow[] {
  const byTs = new Map(rows.map((r) => [r.timestamp, r]));
  const lastMs = latestRowMs(rows);

  let prev: PutCallRatioRow | null = null;
  return timeline.map((timestamp) => {
    const exact = byTs.get(timestamp);
    if (exact) {
      prev = exact;
      return exact;
    }
    const ms = new Date(timestamp).getTime();
    if (prev && Number.isFinite(ms) && ms < lastMs) {
      return { timestamp, ratio: prev.ratio };
    }
    return { timestamp, ratio: null };
  });
}

function alignPremiumToTimeline(rows: NetDirectionalPremiumRow[], timeline: string[]): NetDirectionalPremiumRow[] {
  const byTs = new Map(rows.map((r) => [r.timestamp, r]));
  const lastMs = latestRowMs(rows);

  let prev: NetDirectionalPremiumRow | null = null;
  return timeline.map((timestamp) => {
    const exact = byTs.get(timestamp);
    if (exact) {
      prev = exact;
      return exact;
    }
    const ms = new Date(timestamp).getTime();
    if (prev && Number.isFinite(ms) && ms < lastMs) {
      const premium = prev.premium;
      return {
        timestamp,
        premium,
        positivePremium: premium != null && premium > 0 ? premium : null,
        negativePremium: premium != null && premium < 0 ? premium : null,
      };
    }
    return { timestamp, premium: null, positivePremium: null, negativePremium: null };
  });
}

function alignNetPositionToTimeline(rows: NetPositionRow[], timeline: string[]): NetPositionRow[] {
  const byTs = new Map(rows.map((r) => [r.timestamp, r]));
  const lastMs = latestRowMs(rows);

  let prev: NetPositionRow | null = null;
  return timeline.map((timestamp) => {
    const exact = byTs.get(timestamp);
    if (exact) {
      prev = exact;
      return exact;
    }
    const ms = new Date(timestamp).getTime();
    if (prev && Number.isFinite(ms) && ms < lastMs) {
      return { timestamp, callPosition: prev.callPosition, putPosition: prev.putPosition };
    }
    return { timestamp, callPosition: null, putPosition: null };
  });
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

// ── Series builders ───────────────────────────────────────────────────────────

export type NetVolumeMode = "raw" | "directional";

/**
 * Builds the Options Flow chart series from per-bar rows by accumulating:
 *   callPremium(T) = Σ net_premium for calls up to T
 *   putPremium(T)  = Σ net_premium for puts up to T
 *   netVolume(T)   = Σ (per-bar raw_volume or net_volume) for all contracts up to T
 *   underlyingPrice(T) = average underlying_price across all contracts in bar T
 * The Net Put/Call Premium lines always use net_premium. The Net Volume
 * area toggles between raw_volume (Raw mode) and net_volume (Directional).
 */
function buildFlowTimeseries(
  rows: FlowByContractPoint[],
  mode: NetVolumeMode,
): TimeseriesRow[] {
  const volumeField = mode === "raw" ? "raw_volume" : "net_volume";

  const output: TimeseriesRow[] = [];
  let cumCallPremium = 0;
  let cumPutPremium = 0;
  let cumNetVolume = 0;

  forEachBar(rows, ({ timestamp, rows: barRows }) => {
    let underlyingSum = 0;
    let underlyingCount = 0;
    for (const row of barRows) {
      const prem = Number(row.net_premium ?? 0);
      const vol = Number(row[volumeField] ?? 0);
      if (Number.isFinite(prem)) {
        if (row.option_type === "C") cumCallPremium += prem;
        else if (row.option_type === "P") cumPutPremium += prem;
      }
      if (Number.isFinite(vol)) cumNetVolume += vol;
      if (row.underlying_price != null) {
        const u = Number(row.underlying_price);
        if (Number.isFinite(u)) {
          underlyingSum += u;
          underlyingCount += 1;
        }
      }
    }
    output.push({
      timestamp,
      time: safeTimeLabel(timestamp),
      callPremium: cumCallPremium,
      putPremium: cumPutPremium,
      netVolume: cumNetVolume,
      positiveNetVolume: cumNetVolume > 0 ? cumNetVolume : 0,
      negativeNetVolume: cumNetVolume < 0 ? cumNetVolume : 0,
      underlyingPrice: underlyingCount > 0 ? underlyingSum / underlyingCount : null,
    });
  });

  return output;
}

/**
 * Put/Call Ratio per 5-minute bar as session-cumulative raw volumes:
 *   ratio(T) = Σ raw_volume for puts up to T ÷ Σ raw_volume for calls up to T
 */
function buildPutCallRatioSeries(rows: FlowByContractPoint[]): PutCallRatioRow[] {
  const output: PutCallRatioRow[] = [];
  let cumCallVolume = 0;
  let cumPutVolume = 0;

  forEachBar(rows, ({ timestamp, rows: barRows }) => {
    for (const row of barRows) {
      const v = Number(row.raw_volume ?? 0);
      if (!Number.isFinite(v)) continue;
      if (row.option_type === "C") cumCallVolume += v;
      else if (row.option_type === "P") cumPutVolume += v;
    }
    output.push({
      timestamp,
      ratio: cumCallVolume > 0 ? cumPutVolume / cumCallVolume : null,
    });
  });
  return output;
}

/**
 * Net Position (Buys vs Sells): running session totals of net_volume split
 * by option_type. Positive = net buying pressure, negative = net selling.
 */
function buildNetPositionSeries(rows: FlowByContractPoint[]): NetPositionRow[] {
  const output: NetPositionRow[] = [];
  let cumCallNet = 0;
  let cumPutNet = 0;

  forEachBar(rows, ({ timestamp, rows: barRows }) => {
    for (const row of barRows) {
      const v = Number(row.net_volume ?? 0);
      if (!Number.isFinite(v)) continue;
      if (row.option_type === "C") cumCallNet += v;
      else if (row.option_type === "P") cumPutNet += v;
    }
    output.push({ timestamp, callPosition: cumCallNet, putPosition: cumPutNet });
  });
  return output;
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

// ── Gridline helper ──────────────────────────────────────────────────────────

const GRID_STROKE_DASHARRAY = "2 4";
const GRID_OPACITY = 0.28;

/**
 * Returns an array of ReferenceLine elements, one vertical dotted line at
 * each 30-minute boundary in the provided series. Used by every chart on
 * the page for a consistent dotted-gridline look that lines up with the
 * time labels.
 */
function buildThirtyMinGridlines<T extends { timestamp: string }>(
  data: T[],
  stroke: string,
  keyPrefix: string,
  yAxisId?: string,
) {
  return data
    .filter((row) => is30MinBoundary(row.timestamp))
    .map((row) => (
      <ReferenceLine
        key={`${keyPrefix}-${row.timestamp}`}
        x={row.timestamp}
        {...(yAxisId ? { yAxisId } : {})}
        stroke={stroke}
        strokeDasharray={GRID_STROKE_DASHARRAY}
        opacity={GRID_OPACITY}
      />
    ));
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

function FilterRow({
  label,
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  renderOption,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  renderOption?: (v: string) => string;
}) {
  const active = selected.size > 0;
  const allSelected = active && selected.size === options.length;
  const btnBase =
    "shrink-0 px-2.5 py-1 text-xs rounded-full border transition whitespace-nowrap cursor-pointer";
  const btnInactive: React.CSSProperties = {
    backgroundColor: "transparent",
    borderColor: "var(--color-border)",
    color: "var(--color-text-secondary)",
  };
  const btnActive: React.CSSProperties = {
    backgroundColor: "var(--color-info)",
    borderColor: "var(--color-info)",
    color: "#ffffff",
  };
  const controlBtn: React.CSSProperties = {
    backgroundColor: "var(--color-surface)",
    borderColor: "var(--color-border)",
    color: "var(--color-text-secondary)",
  };

  return (
    <div className="flex items-center gap-3">
      <span
        className="shrink-0 text-xs font-semibold uppercase tracking-wide"
        style={{ color: "var(--color-text-secondary)", minWidth: 72 }}
      >
        {label}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onSelectAll}
          disabled={options.length === 0 || allSelected}
          className={`${btnBase} ${options.length === 0 || allSelected ? "opacity-50 cursor-not-allowed" : "hover:border-[var(--border-strong)]"}`}
          style={controlBtn}
        >
          Select All
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!active}
          className={`${btnBase} ${!active ? "opacity-50 cursor-not-allowed" : "hover:border-[var(--border-strong)]"}`}
          style={controlBtn}
        >
          Clear
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto flex-1 min-w-0 py-0.5" style={{ scrollbarWidth: "thin" }}>
        {options.length === 0 ? (
          <span className="text-xs italic" style={{ color: "var(--color-text-secondary)" }}>
            None available
          </span>
        ) : (
          options.map((option) => {
            const isActive = selected.has(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => onToggle(option)}
                aria-pressed={isActive}
                className={`${btnBase} ${isActive ? "" : "hover:border-[var(--border-strong)]"}`}
                style={isActive ? btnActive : btnInactive}
              >
                {renderOption ? renderOption(option) : option}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function FlowFilters({
  strikeOptions,
  expirationOptions,
  selectedStrikes,
  selectedExpirations,
  onToggleStrike,
  onToggleExpiration,
  onClearStrikes,
  onClearExpirations,
  onSelectAllStrikes,
  onSelectAllExpirations,
}: {
  strikeOptions: string[];
  expirationOptions: string[];
  selectedStrikes: Set<string>;
  selectedExpirations: Set<string>;
  onToggleStrike: (v: string) => void;
  onToggleExpiration: (v: string) => void;
  onClearStrikes: () => void;
  onClearExpirations: () => void;
  onSelectAllStrikes: () => void;
  onSelectAllExpirations: () => void;
}) {
  return (
    <div
      className="mb-4 rounded-lg border p-3 space-y-2.5"
      style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface-subtle)" }}
    >
      <FilterRow
        label="Strike"
        options={strikeOptions}
        selected={selectedStrikes}
        onToggle={onToggleStrike}
        onSelectAll={onSelectAllStrikes}
        onClear={onClearStrikes}
      />
      <FilterRow
        label="Expiration"
        options={expirationOptions}
        selected={selectedExpirations}
        onToggle={onToggleExpiration}
        onSelectAll={onSelectAllExpirations}
        onClear={onClearExpirations}
      />
    </div>
  );
}

function FullWidthFlowChart({ rows, isDark, isMobile }: { rows: TimeseriesRow[]; isDark: boolean; isMobile: boolean }) {
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
          {buildThirtyMinGridlines(rows, axisStroke, "flow-top", "premium")}
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
          {buildThirtyMinGridlines(rows, axisStroke, "flow-bottom", "volume")}
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
  const [netVolumeMode, setNetVolumeMode] = useState<NetVolumeMode>("directional");

  // ── Options Flow / Snapshot / Net Directional Premium / Put-Call Ratio
  //    all derive from this shared cache of per-contract 5-minute rows.
  const {
    rows: flowByContract,
    error: flowError,
  } = useFlowByContractCache(symbol, flowSession);

  // A cheap intervals=1 probe of the other session just to read its ET date
  // for the session dropdown label. Avoids a full-session fetch on mount.
  const otherSession = flowSession === "current" ? "prior" : "current";
  const { data: otherSessionProbe } = useApiData<FlowByContractPoint[]>(
    `/api/flow/by-contract?symbol=${symbol}&session=${otherSession}&intervals=1`,
    { refreshInterval: 60000 },
  );
  const otherSessionDate = useMemo(() => latestRowDateKey(otherSessionProbe), [otherSessionProbe]);

  // ── Derive the session date from cache ────────────────────────────────────
  const selectedDate = useMemo(
    () => latestRowDateKey(flowByContract) || getCurrentETDateKey(),
    [flowByContract],
  );

  const currentDateLabel = flowSession === "current" ? selectedDate : (otherSessionDate ?? null);
  const priorDateLabel = flowSession === "prior" ? selectedDate : (otherSessionDate ?? null);

  // ── Session timeline (5-minute, 09:30–16:15 ET) ───────────────────────────
  const sessionTimeline = useMemo(() => {
    if (!selectedDate) return [];
    return getFiveMinuteSessionTimeline(selectedDate);
  }, [selectedDate]);

  // ── By-contract rows scoped to the selected date ──────────────────────────
  const dateScopedContractRows = useMemo(() => {
    if (!flowByContract || !selectedDate) return [] as FlowByContractPoint[];
    return flowByContract.filter((r) => {
      const ts = flowRowTimestamp(r);
      return ts ? etDateKeyFor(ts) === selectedDate : false;
    });
  }, [flowByContract, selectedDate]);

  // ── Snapshot (aggregated across every contract at the latest 5-min bar) ─

  const latestSnapshot = useMemo(
    () => computeFlowSnapshot(flowByContract, selectedDate),
    [flowByContract, selectedDate],
  );
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

  // ── Filters (Strike / Expiration) ─────────────────────────────────────────

  const strikeOptions = useMemo(() => {
    const set = new Set<string>();
    dateScopedContractRows.forEach((r) => {
      if (r.strike != null && r.strike !== "") set.add(String(r.strike));
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [dateScopedContractRows]);

  const expirationOptions = useMemo(() => {
    const set = new Set<string>();
    dateScopedContractRows.forEach((r) => {
      if (r.expiration) set.add(r.expiration);
    });
    return Array.from(set).sort();
  }, [dateScopedContractRows]);

  const [selectedStrikes, setSelectedStrikes] = useState<Set<string>>(new Set());
  const [selectedExpirations, setSelectedExpirations] = useState<Set<string>>(new Set());

  // Drop any previously-selected values that no longer appear in the current options
  const effectiveSelectedStrikes = useMemo(
    () => new Set(strikeOptions.filter((v) => selectedStrikes.has(v))),
    [strikeOptions, selectedStrikes],
  );
  const effectiveSelectedExpirations = useMemo(
    () => new Set(expirationOptions.filter((v) => selectedExpirations.has(v))),
    [expirationOptions, selectedExpirations],
  );

  const filteredContractRows = useMemo(() => {
    return dateScopedContractRows.filter((r) => {
      if (effectiveSelectedStrikes.size > 0) {
        if (!effectiveSelectedStrikes.has(String(r.strike ?? ""))) return false;
      }
      if (effectiveSelectedExpirations.size > 0) {
        if (!effectiveSelectedExpirations.has(r.expiration ?? "")) return false;
      }
      return true;
    });
  }, [dateScopedContractRows, effectiveSelectedStrikes, effectiveSelectedExpirations]);

  // ── Options Flow series (filtered) ────────────────────────────────────────

  const mainSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const base = buildFlowTimeseries(filteredContractRows, netVolumeMode);
    return alignSeriesToTimeline(base, sessionTimeline);
  }, [selectedDate, filteredContractRows, sessionTimeline, netVolumeMode]);

  // ── Put/Call ratio (from full by-contract cache, unfiltered) ──────────────

  const putCallRatioSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const base = buildPutCallRatioSeries(dateScopedContractRows);
    return alignRatioToTimeline(base, sessionTimeline);
  }, [selectedDate, dateScopedContractRows, sessionTimeline]);

  // ── Net Directional Premium (from full by-contract cache, unfiltered) ────

  const directionalPremiumSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const base = buildNetDirectionalPremiumSeries(dateScopedContractRows);
    return alignPremiumToTimeline(base, sessionTimeline);
  }, [selectedDate, dateScopedContractRows, sessionTimeline]);

  // ── Net Position (Buys vs Sells): aggregated cumulative call vs put volume
  //    across every contract, per 5-minute bar.

  const netPositionSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const base = buildNetPositionSeries(dateScopedContractRows);
    return alignNetPositionToTimeline(base, sessionTimeline);
  }, [selectedDate, dateScopedContractRows, sessionTimeline]);

  const hasDirectionalPremiumData = directionalPremiumSeries.some((row) => row.premium != null);
  const hasRatioData = putCallRatioSeries.some((row) => row.ratio != null);
  const hasNetPositionData = netPositionSeries.some(
    (row) => row.callPosition != null || row.putPosition != null,
  );

  const ratioDateMarkerMeta = useMemo(
    () => getDateMarkerMeta(putCallRatioSeries.map((r) => r.timestamp)),
    [putCallRatioSeries],
  );
  const netPositionDateMarkerMeta = useMemo(
    () => getDateMarkerMeta(netPositionSeries.map((r) => r.timestamp)),
    [netPositionSeries],
  );

  // ── Filter chip toggles ───────────────────────────────────────────────────

  const makeToggler = useCallback(
    (setter: Dispatch<SetStateAction<Set<string>>>) => (value: string) => {
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(value)) next.delete(value);
        else next.add(value);
        return next;
      });
    },
    [],
  );
  const toggleStrikes = useMemo(() => makeToggler(setSelectedStrikes), [makeToggler]);
  const toggleExpirations = useMemo(() => makeToggler(setSelectedExpirations), [makeToggler]);

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Flow Analysis</h1>
      {flowError && !flowByContract && <ErrorMessage message={flowError} />}
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
              setSelectedStrikes(new Set());
              setSelectedExpirations(new Set());
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
            onChange={(e) => setNetVolumeMode(e.target.value as NetVolumeMode)}
            className="px-3 py-1.5 text-sm rounded-md border focus:outline-none cursor-pointer"
            style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputColor }}
          >
            <option value="directional">Directional</option>
            <option value="raw">Raw Net</option>
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
          tooltip="Primary axis: net call premium (green) and net put premium (red). Bottom axis: net volume area, green above zero and red below zero. Aggregates every contract returned by the by-contract endpoint in 5-minute intervals. Use the filters below to narrow by strike or expiration."
        />
        <FlowFilters
          strikeOptions={strikeOptions}
          expirationOptions={expirationOptions}
          selectedStrikes={effectiveSelectedStrikes}
          selectedExpirations={effectiveSelectedExpirations}
          onToggleStrike={toggleStrikes}
          onToggleExpiration={toggleExpirations}
          onClearStrikes={() => setSelectedStrikes(new Set())}
          onClearExpirations={() => setSelectedExpirations(new Set())}
          onSelectAllStrikes={() => setSelectedStrikes(new Set(strikeOptions))}
          onSelectAllExpirations={() => setSelectedExpirations(new Set(expirationOptions))}
        />
        <FullWidthFlowChart rows={mainSeries} isDark={isDark} isMobile={isMobile} />
      </section>

      {/* ── Net Directional Premium ───────────────────────────────────── */}
      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: cardBg }}>
        <SectionTitle
          title="Net Directional Premium"
          tooltip="Running session total of net_premium aggregated across every contract (accumulated across 5-minute bars). Positive values indicate net bullish premium pressure, negative values indicate net bearish premium pressure."
        />
        {!hasDirectionalPremiumData ? (
          <div className="text-center py-8" style={{ color: mutedText }}>No net directional premium data available</div>
        ) : (
          <div className={isMobile ? "overflow-x-auto pb-2" : ""}>
            <div style={{ width: isMobile ? 900 : "100%", minWidth: isMobile ? 900 : undefined, height: 464 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={directionalPremiumSeries}
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
                  {buildThirtyMinGridlines(directionalPremiumSeries, axisStroke, "directional-premium")}
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
          tooltip="Session-cumulative put volume ÷ session-cumulative call volume at each 5-minute bar. Sums total puts traded through the day over total calls traded up to that point, carrying forward contracts that stopped reporting in earlier bars."
        />
        {!hasRatioData ? (
          <div className="text-center py-8" style={{ color: mutedText }}>No put/call ratio data available</div>
        ) : (
          <div className={isMobile ? "overflow-x-auto pb-2" : ""}>
            <div style={{ width: isMobile ? 900 : "100%", minWidth: isMobile ? 900 : undefined, height: 464 }}>
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
                  {buildThirtyMinGridlines(putCallRatioSeries, axisStroke, "pcr")}
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

      {/* ── Net Position (Buys vs Sells) ─────────────────────────────── */}
      <section className="mb-8 rounded-lg p-6" style={{ backgroundColor: cardBg }}>
        <SectionTitle
          title="Net Position (Buys vs. Sells)"
          tooltip="Running session totals of net_volume per 5-minute bar, split by option_type. Positive values mean net buying pressure, negative values mean net selling pressure. The Put/Call Ratio above measures raw activity — this chart accounts for trade direction to distinguish buying from selling."
        />
        {!hasNetPositionData ? (
          <div className="text-center py-8" style={{ color: mutedText }}>No net position data available</div>
        ) : (
          <div className={isMobile ? "overflow-x-auto pb-2" : ""}>
            <div style={{ width: isMobile ? 900 : "100%", minWidth: isMobile ? 900 : undefined, height: 464 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={netPositionSeries}
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
                      const dateLabel = netPositionDateMarkerMeta.get(index);
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
                  {buildThirtyMinGridlines(netPositionSeries, axisStroke, "net-position")}
                  <YAxis
                    stroke={axisStroke}
                    tick={{ fontSize: isMobile ? 9 : 10, fill: axisStroke }}
                    tickMargin={isMobile ? 2 : 8}
                    width={isMobile ? 42 : 62}
                    tickFormatter={(v) => {
                      const n = Number(v);
                      const abs = Math.abs(n);
                      const sign = n < 0 ? "-" : "";
                      if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
                      if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(0)}K`;
                      return `${sign}${Math.round(abs)}`;
                    }}
                  />
                  <Tooltip
                    content={({ active, label, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const point = payload[0]?.payload as { callPosition?: number | null; putPosition?: number | null } | undefined;
                      return (
                        <div className="rounded border px-3 py-2 text-sm" style={{ backgroundColor: "var(--color-chart-tooltip-bg)", borderColor: "var(--color-border)", color: "var(--color-chart-tooltip-text)" }}>
                          <div className="font-semibold">{new Date(String(label)).toLocaleString()}</div>
                          <div>Net Call Position: {point?.callPosition != null ? Number(point.callPosition).toLocaleString() : "—"}</div>
                          <div>Net Put Position: {point?.putPosition != null ? Number(point.putPosition).toLocaleString() : "—"}</div>
                        </div>
                      );
                    }}
                  />
                  <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 11, paddingBottom: 6, color: isDark ? "var(--color-border)" : "var(--color-text-primary)" }} />
                  <ReferenceLine y={0} stroke={axisStroke} opacity={0.55} />
                  <Line
                    type="monotone"
                    dataKey="callPosition"
                    name="Net Call Position"
                    stroke="var(--color-positive)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="putPosition"
                    name="Net Put Position"
                    stroke="var(--color-negative)"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
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
