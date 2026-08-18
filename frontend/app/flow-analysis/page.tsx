"use client";

import PageShell from '@/components/layout/PageShell';
import SectionHead from "@/components/layout/SectionHead";
import { useMemo, useState } from "react";
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
  canonicalIso,
  sessionDateKeyFromSeries,
  snapshotFromSeries,
  useFlowSeries,
  type FlowSeriesPoint,
} from "@/hooks/useFlowSeries";
import ErrorMessage from "@/components/ErrorMessage";
import ExpandableCard from "@/components/ExpandableCard";
import MetricCard from "@/components/MetricCard";
import RegimeSummaryBanner from "@/components/RegimeSummaryBanner";
import OptionsFlowChart from "@/components/OptionsFlowChart";
import { buildThirtyMinGridlines } from "@/components/ChartGridlines";
import { useTimeframe } from "@/core/TimeframeContext";
import { useTheme } from "@/core/ThemeContext";
import { useIsMobile } from "@/hooks/useIsMobile";
import { etDateKeyFor } from "@/core/utils";
// The Options Flow chart's own derivations live in core/flowSeriesCharts, shared
// with the "Options Flow" My Dashboard widget. The compact charts below reuse the
// session timeline, labels and axis helpers from there so every chart on this
// page lands on the same slots.
import {
  getDateMarkerMeta,
  getFiveMinuteSessionTimeline,
  isBarWindowComplete,
  latestRowMs,
  safeTimeLabel,
  type NetVolumeMode,
} from "@/core/flowSeriesCharts";

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

interface NetPositionRow {
  timestamp: string;
  callPosition: number | null;
  putPosition: number | null;
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

// Inserts an interpolated zero-crossing row between any two adjacent rows
// whose premium values straddle zero. Without it, the positive/negative Area
// series each start or end at the bar boundary rather than at the actual
// crossing, which renders as a visible step where the line crosses the axis.
function insertPremiumZeroCrossings(rows: NetDirectionalPremiumRow[]): NetDirectionalPremiumRow[] {
  const result: NetDirectionalPremiumRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i];
    result.push(cur);
    const next = rows[i + 1];
    if (!next) continue;
    const a = cur.premium;
    const b = next.premium;
    if (a == null || b == null) continue;
    if ((a > 0 && b < 0) || (a < 0 && b > 0)) {
      const tA = new Date(cur.timestamp).getTime();
      const tB = new Date(next.timestamp).getTime();
      if (Number.isFinite(tA) && Number.isFinite(tB) && tB > tA) {
        const ratio = Math.abs(a) / (Math.abs(a) + Math.abs(b));
        const tCrossMs = tA + (tB - tA) * ratio;
        result.push({
          timestamp: new Date(tCrossMs).toISOString(),
          premium: 0,
          positivePremium: 0,
          negativePremium: 0,
        });
      }
    }
  }
  return result;
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

// ── Incomplete-bar suppression ────────────────────────────────────────────────
//
// A row whose tracked cumulative fields are all exactly 0 inside a still-open
// 5-minute bar means "no trades reported yet for this bar" — plotting it drops
// the line to zero before the session has actually drifted there. We mask
// those rows until the bar window fully elapses; after that, a genuine 0 is
// allowed through.

function maskIncompleteZeroNetPositionBars(rows: NetPositionRow[]): NetPositionRow[] {
  return rows.map((row) => {
    if (
      row.callPosition === 0 &&
      row.putPosition === 0 &&
      !isBarWindowComplete(row.timestamp)
    ) {
      return { ...row, callPosition: null, putPosition: null };
    }
    return row;
  });
}

// ── FlowSeriesPoint → chart row mappers ──────────────────────────────────────
//
// The backend at /api/flow/series returns rows whose fields are already the
// session cumulatives the charts plot. These mappers are trivial field
// renames — no accumulation, no gap-filling.

function mapSeriesToRatioRows(rows: FlowSeriesPoint[]): PutCallRatioRow[] {
  return rows.map((r) => ({ timestamp: canonicalIso(r.timestamp), ratio: r.put_call_ratio }));
}

function mapSeriesToPremiumRows(rows: FlowSeriesPoint[]): NetDirectionalPremiumRow[] {
  return rows.map((r) => {
    const premium = r.net_premium_cum;
    return {
      timestamp: canonicalIso(r.timestamp),
      premium,
      positivePremium: premium > 0 ? premium : null,
      negativePremium: premium < 0 ? premium : null,
    };
  });
}

function mapSeriesToNetPositionRows(rows: FlowSeriesPoint[]): NetPositionRow[] {
  return rows.map((r) => ({
    timestamp: canonicalIso(r.timestamp),
    callPosition: r.call_position_cum,
    putPosition: r.put_position_cum,
  }));
}

// ── Chart layout helpers ──────────────────────────────────────────────────────

const MAJOR_TICK_ET_HOURS = new Set([10, 12, 14, 16]);

/** True when `ts` lands exactly on 10:00, 12:00, 14:00, or 16:00 ET — used
 *  by the compact-row charts to thin labels down to a handful of major
 *  intraday markers. DST-safe via Intl. */
function isMajorTwoHourTick(ts: string): boolean {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return false;
  if (d.getUTCMinutes() !== 0) return false;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hourCycle: "h23",
    hour: "2-digit",
  }).formatToParts(d);
  const etHour = Number(parts.find((p) => p.type === "hour")?.value);
  return MAJOR_TICK_ET_HOURS.has(etHour);
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

  // ── Server-computed session cumulatives (unfiltered) ─────────────────────
  // Drives the Flow Snapshot cards and the Put/Call Ratio, Net Directional
  // Premium and Net Position charts, and is handed to the Options Flow chart as
  // its unfiltered baseline so that chart doesn't open a second poll of the
  // same feed.
  const {
    rows: flowSeriesUnfiltered,
    error: flowError,
  } = useFlowSeries(symbol, flowSession);

  // A cheap intervals=1 probe of the other session just to read its ET date
  // for the session dropdown label.
  const otherSession = flowSession === "current" ? "prior" : "current";
  const { data: otherSessionProbe } = useApiData<FlowSeriesPoint[]>(
    `/api/flow/series?symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}&session=${otherSession}&intervals=1`,
    { refreshInterval: 60000 },
  );
  const otherSessionDate = useMemo(() => {
    if (!otherSessionProbe || otherSessionProbe.length === 0) return null;
    return etDateKeyFor(otherSessionProbe[otherSessionProbe.length - 1].timestamp) || null;
  }, [otherSessionProbe]);

  // ── Derive the session date ──────────────────────────────────────────────
  // Same read the Options Flow chart makes, so every chart on the page lays out
  // on the session the rows actually report rather than on today's clock.
  const selectedDate = useMemo(
    () => sessionDateKeyFromSeries(flowSeriesUnfiltered),
    [flowSeriesUnfiltered],
  );

  const currentDateLabel = flowSession === "current" ? selectedDate : (otherSessionDate ?? null);
  const priorDateLabel = flowSession === "prior" ? selectedDate : (otherSessionDate ?? null);

  // ── Session timeline (5-minute, 09:30–16:15 ET) ───────────────────────────
  const sessionTimeline = useMemo(() => {
    if (!selectedDate) return [];
    return getFiveMinuteSessionTimeline(selectedDate);
  }, [selectedDate]);

  // ── Flow Snapshot cards ───────────────────────────────────────────────────
  const latestSnapshot = useMemo(
    () => snapshotFromSeries(flowSeriesUnfiltered),
    [flowSeriesUnfiltered],
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

  // ── Put/Call ratio (unfiltered) ──────────────────────────────────────────
  const putCallRatioSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const base = mapSeriesToRatioRows(flowSeriesUnfiltered ?? []);
    return alignRatioToTimeline(base, sessionTimeline);
  }, [flowSeriesUnfiltered, selectedDate, sessionTimeline]);

  // ── Net Directional Premium (unfiltered) ─────────────────────────────────
  const directionalPremiumSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const base = mapSeriesToPremiumRows(flowSeriesUnfiltered ?? []);
    const aligned = alignPremiumToTimeline(base, sessionTimeline);
    return insertPremiumZeroCrossings(aligned);
  }, [flowSeriesUnfiltered, selectedDate, sessionTimeline]);

  // ── Net Position (Buys vs Sells), unfiltered ─────────────────────────────
  const netPositionSeries = useMemo(() => {
    if (!selectedDate || sessionTimeline.length === 0) return [];
    const base = mapSeriesToNetPositionRows(flowSeriesUnfiltered ?? []);
    const aligned = alignNetPositionToTimeline(base, sessionTimeline);
    return maskIncompleteZeroNetPositionBars(aligned);
  }, [flowSeriesUnfiltered, selectedDate, sessionTimeline]);

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
  const directionalPremiumDateMarkerMeta = useMemo(
    () => getDateMarkerMeta(directionalPremiumSeries.map((r) => r.timestamp)),
    [directionalPremiumSeries],
  );

  return (
    <PageShell>
      <h1 className="text-3xl font-bold mb-8">Flow Analysis</h1>
      {flowError && !flowSeriesUnfiltered && <ErrorMessage message={flowError} />}
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
            onChange={(e) => setFlowSession(e.target.value as "current" | "prior")}
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
        <SectionHead
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
      {/* The same instrument members can drop on their board — session and
          basis come from this page's control bar, and it reuses the unfiltered
          rows fetched above rather than opening its own poll. */}
      <OptionsFlowChart
        className="mb-8"
        session={flowSession}
        netVolumeMode={netVolumeMode}
        baseRows={flowSeriesUnfiltered}
      />

      {/* ── Compact charts row (Net Directional Premium · Put/Call Ratio · Net Position) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {/* ── Net Directional Premium ───────────────────────────────────── */}
      <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <div className="rounded-lg p-6 h-full" style={{ backgroundColor: cardBg }}>
        <SectionHead
          title="Net Directional Premium"
          titleClassName="zg-h3"
          tooltip="Running session total of net_premium aggregated across every contract (accumulated across 5-minute bars). Positive values indicate net bullish premium pressure, negative values indicate net bearish premium pressure."
        />
        {!hasDirectionalPremiumData ? (
          <div className="text-center py-8" style={{ color: mutedText }}>No net directional premium data available</div>
        ) : (
          <div className={isMobile ? "overflow-x-auto pb-2" : ""}>
            <div style={{ width: isMobile ? 900 : "100%", minWidth: isMobile ? 900 : undefined, height: 288 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={directionalPremiumSeries}
                  margin={isMobile ? { top: 8, right: 8, left: 8, bottom: 24 } : { top: 10, right: 12, left: 0, bottom: 24 }}
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
                      const dateLabel = directionalPremiumDateMarkerMeta.get(index);
                      const showTime = isMajorTwoHourTick(ts);
                      if (!showTime && !dateLabel) return <g transform={`translate(${x},${y})`} />;
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} />
                          {showTime ? (
                            <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>
                              {safeTimeLabel(ts)}
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
                    stroke={axisStroke}
                    tick={{ fontSize: isMobile ? 9 : 10, fill: axisStroke }}
                    tickMargin={isMobile ? 2 : 8}
                    width={isMobile ? 42 : 48}
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
      </div>
      </ExpandableCard>

      {/* ── Put/Call Ratio ────────────────────────────────────────────── */}
      <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <div className="rounded-lg p-6 h-full" style={{ backgroundColor: cardBg }}>
        <SectionHead
          title="Put/Call Ratio"
          titleClassName="zg-h3"
          tooltip="Session-cumulative put volume ÷ session-cumulative call volume at each 5-minute bar. Sums total puts traded through the day over total calls traded up to that point, carrying forward contracts that stopped reporting in earlier bars."
        />
        {!hasRatioData ? (
          <div className="text-center py-8" style={{ color: mutedText }}>No put/call ratio data available</div>
        ) : (
          <div className={isMobile ? "overflow-x-auto pb-2" : ""}>
            <div style={{ width: isMobile ? 900 : "100%", minWidth: isMobile ? 900 : undefined, height: 288 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={putCallRatioSeries}
                  margin={isMobile ? { top: 8, right: 8, left: 8, bottom: 24 } : { top: 10, right: 12, left: 0, bottom: 24 }}
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
                      const showTime = isMajorTwoHourTick(ts);
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
                    width={isMobile ? 38 : 48}
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
      </div>
      </ExpandableCard>

      {/* ── Net Position (Buys vs Sells) ─────────────────────────────── */}
      <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <div className="rounded-lg p-6 h-full" style={{ backgroundColor: cardBg }}>
        <SectionHead
          title="Net Position (Buys vs. Sells)"
          titleClassName="zg-h3"
          tooltip="Running session totals of net_volume per 5-minute bar, split by option_type. Positive values mean net buying pressure, negative values mean net selling pressure. The Put/Call Ratio above measures raw activity — this chart accounts for trade direction to distinguish buying from selling."
        />
        {!hasNetPositionData ? (
          <div className="text-center py-8" style={{ color: mutedText }}>No net position data available</div>
        ) : (
          <div className={isMobile ? "overflow-x-auto pb-2" : ""}>
            <div style={{ width: isMobile ? 900 : "100%", minWidth: isMobile ? 900 : undefined, height: 288 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={netPositionSeries}
                  margin={isMobile ? { top: 8, right: 8, left: 8, bottom: 24 } : { top: 10, right: 12, left: 0, bottom: 24 }}
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
                      const showTime = isMajorTwoHourTick(ts);
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
                    width={isMobile ? 42 : 48}
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
      </div>
      </ExpandableCard>
      </div>
    </PageShell>
  );
}
