'use client';

/**
 * The "Options Flow" instrument — net call/put premium on the top plot, net
 * volume on the bottom, both as running session cumulatives, with an optional
 * underlying-price line and strike / expiration filter chips.
 *
 * It headlines /flow-analysis and is also a "My Dashboard" widget, so it owns
 * everything it needs to stand alone: the contract-option chips, the filtered
 * fetch, the persisted display preference and — when the caller doesn't supply
 * them — its own session and net-volume-basis controls. Row derivation goes
 * through core/flowSeriesCharts, shared with the page, so a tile on a board
 * plots exactly what the page plots.
 *
 * Two props let the Flow Analysis page keep driving from its page-level
 * controls (which also steer its other three charts):
 *   • `session` / `netVolumeMode` — supplied, the matching control is hidden;
 *     omitted, the chart renders its own.
 *   • `baseRows` — the unfiltered rows the caller already subscribes to, so the
 *     page doesn't open a second poll of the same feed.
 */

import { useCallback, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
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
} from 'recharts';

import SectionHead from '@/components/layout/SectionHead';
import { buildThirtyMinGridlines } from '@/components/ChartGridlines';
import { useTheme } from '@/core/ThemeContext';
import { useTimeframe } from '@/core/TimeframeContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useSharedExpirations } from '@/hooks/useSharedExpirations';
import { loadChartSettings, saveChartSettings } from '@/core/chartSettings';
import {
  sessionDateKeyFromSeries,
  useFlowContractOptions,
  useFlowSeries,
  type FlowSeriesPoint,
} from '@/hooks/useFlowSeries';
import {
  generateNiceTicks,
  getDateMarkerMeta,
  getDynamicLeftMargin,
  getDynamicStep,
  getFiveMinuteSessionTimeline,
  getUnderlyingDomain,
  is30MinBoundary,
  optionsFlowSeries,
  roundToStep,
  safeTimeLabel,
  type FlowTimeseriesRow,
  type NetVolumeMode,
} from '@/core/flowSeriesCharts';

/** Which trading session the chart plots. */
export type FlowSession = 'current' | 'prior';

// ── Persistent Options Flow chart preferences ────────────────────────────────
//
// Backed by the shared per-chart settings store (localStorage via
// core/chartSettings), so a user's choice to hide the underlying price line on
// the Options Flow chart auto-loads the next time they open it — on the page or
// as a board tile. Keyed by a stable chart id that sits alongside the app's
// other `zgx_` prefs.
const OPTIONS_FLOW_CHART_ID = 'options-flow';

type OptionsFlowSettings = {
  showUnderlyingPrice: boolean;
};

const OPTIONS_FLOW_DEFAULTS: OptionsFlowSettings = {
  showUnderlyingPrice: true,
};

const CHART_TOOLTIP =
  'Primary axis: net call premium (green) and net put premium (red). Bottom axis: net volume area, green above zero and red below zero. Aggregates every contract returned by the by-contract endpoint in 5-minute intervals. Use the filters below to narrow by strike or expiration.';

// ── Filter chips ─────────────────────────────────────────────────────────────



function FilterRow({
  label,
  options,
  selected,
  onToggle,
  onSelectAll,
  onClear,
  renderOption,
  loading = false,
  error = null,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  renderOption?: (v: string) => string;
  loading?: boolean;
  error?: string | null;
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
          error ? (
            <span className="text-xs italic" style={{ color: "var(--color-danger, #ef4444)" }}>
              Failed to load — {error}
            </span>
          ) : loading ? (
            <span className="text-xs italic" style={{ color: "var(--color-text-secondary)" }}>
              Loading…
            </span>
          ) : (
            <span className="text-xs italic" style={{ color: "var(--color-text-secondary)" }}>
              None available
            </span>
          )
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
  loading = false,
  error = null,
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
  loading?: boolean;
  error?: string | null;
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
        loading={loading}
        error={error}
      />
      <FilterRow
        label="Expiration"
        options={expirationOptions}
        selected={selectedExpirations}
        onToggle={onToggleExpiration}
        onSelectAll={onSelectAllExpirations}
        onClear={onClearExpirations}
        loading={loading}
        error={error}
      />
    </div>
  );
}

// ── Chart ────────────────────────────────────────────────────────────────────

function FullWidthFlowChart({
  rows,
  isDark,
  isMobile,
  showUnderlyingPrice,
}: {
  rows: FlowTimeseriesRow[];
  isDark: boolean;
  isMobile: boolean;
  showUnderlyingPrice: boolean;
}) {
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
  // When the underlying price line is hidden we drop the left price axis
  // entirely and reclaim its gutter so the premium/volume plots use the full
  // width. The top (price/premium) and bottom (volume) charts must keep an
  // identical left inset — margin + left-axis width — to stay vertically
  // aligned, so both switch together off this single flag.
  const leftChartMargin = isMobile ? 8 : showUnderlyingPrice ? getDynamicLeftMargin(rows) : 16;
  const rightChartMargin = isMobile ? 8 : 70;
  const yAxisWidth = isMobile ? 40 : 72;
  const yAxisWidthRight = isMobile ? 38 : 62;
  const chartWidth = isMobile ? 900 : "100%";

  return (
    <div className={isMobile ? "overflow-x-auto pb-2" : ""}>
      <div className="h-[580px]" style={{ width: chartWidth, minWidth: isMobile ? 900 : undefined }}>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={rows} margin={{ top: 20, right: rightChartMargin, left: leftChartMargin, bottom: 0 }}>
          <XAxis
            dataKey="timestamp"
            stroke={axisStroke}
            minTickGap={24}
            padding={{ left: 0, right: 0 }}
            hide
          />
          {showUnderlyingPrice ? (
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
          ) : null}
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
          {showUnderlyingPrice ? (
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
          ) : null}
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

      <ResponsiveContainer width="100%" height={220}>
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
          {showUnderlyingPrice ? (
            <YAxis
              yAxisId="volumeSpacer"
              orientation="left"
              domain={[0, 1]}
              width={yAxisWidth}
              axisLine={false}
              tickLine={false}
              tick={false}
            />
          ) : null}
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

// ── Standalone controls (widget use) ─────────────────────────────────────────
//
// Rendered only when the caller doesn't supply the matching prop. On
// /flow-analysis the page's own control bar drives session and basis for every
// chart at once, so both are passed in and neither select appears here.

function InlineSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (next: T) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs whitespace-nowrap" style={{ color: 'var(--color-text-secondary)' }}>
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="px-2 py-1 text-xs rounded-md border focus:outline-none cursor-pointer"
        style={{
          backgroundColor: 'var(--color-surface-subtle)',
          borderColor: 'var(--color-border)',
          color: 'var(--color-text-primary)',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ── Options Flow ─────────────────────────────────────────────────────────────

export type OptionsFlowChartProps = {
  /** Session to plot. Omit and the chart renders its own session select. */
  session?: FlowSession;
  /** Net-volume basis. Omit and the chart renders its own basis select. */
  netVolumeMode?: NetVolumeMode;
  /**
   * Unfiltered rows for `session`, when the caller already subscribes to them
   * (the Flow Analysis page does, for its other charts) — passing them keeps a
   * second poll of the same feed from opening. Must be the rows for `session`.
   * Omit and the chart subscribes itself.
   */
  baseRows?: FlowSeriesPoint[] | null;
  /** Extra classes on the card shell (margins on a page, `h-full` in a tile). */
  className?: string;
};

export default function OptionsFlowChart({
  session: sessionProp,
  netVolumeMode: netVolumeModeProp,
  baseRows,
  className = '',
}: OptionsFlowChartProps) {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isMobile = useIsMobile();

  // Controlled by the caller, or self-owned with a select in the header.
  const [ownSession, setOwnSession] = useState<FlowSession>('current');
  const [ownNetVolumeMode, setOwnNetVolumeMode] = useState<NetVolumeMode>('directional');
  const session = sessionProp ?? ownSession;
  const netVolumeMode = netVolumeModeProp ?? ownNetVolumeMode;

  // ── Display prefs (persisted) ───────────────────────────────────────────
  // Restored once in a lazy initializer — mirroring how symbol / GEX unit
  // hydrate — so restore costs no extra render pass, and saved on every change
  // so the chart reopens exactly as the user left it, with no explicit "save".
  const [savedSettings] = useState(() =>
    loadChartSettings(OPTIONS_FLOW_CHART_ID, OPTIONS_FLOW_DEFAULTS),
  );
  const [showUnderlyingPrice, setShowUnderlyingPrice] = useState<boolean>(
    savedSettings.showUnderlyingPrice,
  );
  const toggleUnderlyingPrice = useCallback((next: boolean) => {
    setShowUnderlyingPrice(next);
    saveChartSettings<OptionsFlowSettings>(OPTIONS_FLOW_CHART_ID, {
      showUnderlyingPrice: next,
    });
  }, []);

  // ── Filter chips (Strike / Expiration) ──────────────────────────────────
  const {
    options: serverContractOptions,
    loading: contractOptionsLoading,
    error: contractOptionsError,
  } = useFlowContractOptions(symbol, session);

  const strikeOptions = useMemo(
    () => serverContractOptions.strikes.map((n) => String(n)),
    [serverContractOptions],
  );
  const expirationOptions = useMemo(
    () => serverContractOptions.expirations.slice().sort(),
    [serverContractOptions],
  );

  const [selectedStrikes, setSelectedStrikes] = useState<Set<string>>(new Set());
  // A session switch clears the strike picks: the two sessions' strike universes
  // only partly overlap, so carrying a pick across silently re-filters the new
  // session. Adjusted during render (React's derive-state-from-props pattern)
  // rather than in an effect, so the new session never paints one frame through
  // the old session's filter.
  const [strikesForSession, setStrikesForSession] = useState<FlowSession>(session);
  if (strikesForSession !== session) {
    setStrikesForSession(session);
    setSelectedStrikes(new Set());
  }
  // Expirations are backed by the tab-wide shared selection (empty = no filter /
  // All), so a pick here follows over to the GEX/gamma charts and back — and,
  // inside a split board, to the pane's own scoped selection. It reconciles to
  // the new session's options on its own, so a session switch leaves it alone.
  // See useSharedExpirations.
  const { selection: sharedExpirations, setSelection: setSharedExpirations } = useSharedExpirations();
  const selectedExpirations = useMemo(() => new Set(sharedExpirations), [sharedExpirations]);

  // Drop any previously-selected values that no longer appear in the current options
  const effectiveSelectedStrikes = useMemo(
    () => new Set(strikeOptions.filter((v) => selectedStrikes.has(v))),
    [strikeOptions, selectedStrikes],
  );
  const effectiveSelectedExpirations = useMemo(
    () => new Set(expirationOptions.filter((v) => selectedExpirations.has(v))),
    [expirationOptions, selectedExpirations],
  );

  const hasActiveFilters =
    effectiveSelectedStrikes.size > 0 || effectiveSelectedExpirations.size > 0;

  // ── Session rows ────────────────────────────────────────────────────────
  // The unfiltered baseline (own subscription only when the caller didn't hand
  // us theirs) plus a filtered fetch that runs only while a chip is active.
  const { rows: ownBaseRows } = useFlowSeries(symbol, session, {
    enabled: baseRows === undefined,
  });
  const unfilteredRows = baseRows !== undefined ? baseRows : ownBaseRows;

  const serverFilters = useMemo(
    () => ({
      strikes: Array.from(effectiveSelectedStrikes),
      expirations: Array.from(effectiveSelectedExpirations),
    }),
    [effectiveSelectedStrikes, effectiveSelectedExpirations],
  );
  const { rows: filteredRows } = useFlowSeries(symbol, session, {
    enabled: hasActiveFilters,
    filters: serverFilters,
  });

  const sourceRows = useMemo(
    () => (hasActiveFilters ? (filteredRows ?? []) : (unfilteredRows ?? [])),
    [hasActiveFilters, filteredRows, unfilteredRows],
  );

  // ── Chart series ────────────────────────────────────────────────────────
  // The session grid is anchored to the date the rows themselves report, so a
  // prior-session view lays out on that session's clock, not today's.
  const sessionTimeline = useMemo(
    () => getFiveMinuteSessionTimeline(sessionDateKeyFromSeries(unfilteredRows ?? sourceRows)),
    [unfilteredRows, sourceRows],
  );
  const rows = useMemo(
    () => optionsFlowSeries(sourceRows, sessionTimeline, netVolumeMode),
    [sourceRows, sessionTimeline, netVolumeMode],
  );

  // ── Filter chip toggles ─────────────────────────────────────────────────
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
  // Expirations toggle the shared selection instead of local state, so the
  // change broadcasts to every other expiration-filtering chart.
  const toggleExpirations = useCallback(
    (value: string) => {
      const next = new Set(sharedExpirations);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      setSharedExpirations(Array.from(next));
    },
    [sharedExpirations, setSharedExpirations],
  );

  return (
    <section
      className={`rounded-lg p-6 ${className}`.trim()}
      style={{ backgroundColor: 'var(--color-surface)' }}
    >
      <SectionHead
        title="Options Flow"
        tooltip={CHART_TOOLTIP}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            {sessionProp === undefined && (
              <InlineSelect<FlowSession>
                label="Session"
                value={session}
                options={[
                  { value: 'current', label: 'Current' },
                  { value: 'prior', label: 'Prior' },
                ]}
                onChange={setOwnSession}
              />
            )}
            {netVolumeModeProp === undefined && (
              <InlineSelect<NetVolumeMode>
                label="Net Volume"
                value={netVolumeMode}
                options={[
                  { value: 'directional', label: 'Directional' },
                  { value: 'raw', label: 'Raw Net' },
                ]}
                onChange={setOwnNetVolumeMode}
              />
            )}
            <label
              className="flex items-center gap-2 text-xs cursor-pointer select-none whitespace-nowrap"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <input
                type="checkbox"
                checked={showUnderlyingPrice}
                onChange={(e) => toggleUnderlyingPrice(e.target.checked)}
                className="cursor-pointer"
                style={{ accentColor: 'var(--color-warning)' }}
              />
              <span>Show underlying price</span>
            </label>
          </div>
        }
      />
      <FlowFilters
        strikeOptions={strikeOptions}
        expirationOptions={expirationOptions}
        selectedStrikes={effectiveSelectedStrikes}
        selectedExpirations={effectiveSelectedExpirations}
        onToggleStrike={toggleStrikes}
        onToggleExpiration={toggleExpirations}
        onClearStrikes={() => setSelectedStrikes(new Set())}
        onClearExpirations={() => setSharedExpirations([])}
        onSelectAllStrikes={() => setSelectedStrikes(new Set(strikeOptions))}
        onSelectAllExpirations={() => setSharedExpirations(expirationOptions)}
        loading={contractOptionsLoading}
        error={contractOptionsError}
      />
      <FullWidthFlowChart
        rows={rows}
        isDark={isDark}
        isMobile={isMobile}
        showUnderlyingPrice={showUnderlyingPrice}
      />
    </section>
  );
}
