/**
 * Intraday Trading Tools Page
 * VWAP, ORB, Volume Spikes, Momentum Divergence, etc.
 *
 * All cards and charts on this page are powered by the unified
 * `/api/technicals` endpoint via the `useTechnicals` hook.
 */

'use client';

import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import SectionHead from '@/components/layout/SectionHead';
import ChartTooltipShell, { ChartTooltipRow } from '@/components/ChartTooltipShell';
import { useMemo, useState } from 'react';
import { Area, Bar, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTechnicals, type TechnicalsBar } from '@/hooks/useTechnicals';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import { isWithinExtendedMarketHours } from '@/core/utils';
import { useTimeframe } from '@/core/TimeframeContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { spectrumIndicatorLeft } from '@/core/spectrumIndicator';

function getDateMarkerMeta(timestamps: string[]) {
  const groups = new Map<string, { first: number; last: number }>();
  timestamps.forEach((ts, idx) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    const key = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
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

function getDynamicStep(min: number, max: number): number {
  const range = Math.max(1e-9, Math.abs(max - min));
  const rawStep = range / 6;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  if (normalized < 1.5) return 1 * magnitude;
  if (normalized < 3.5) return 2 * magnitude;
  if (normalized < 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

function safeNum(value: unknown): number | null {
  // Treat null/undefined/empty as missing — Number(null) === 0 silently turns
  // "no data yet" bars (e.g. ORB before market open) into a real 0, which then
  // collapses chart domains down to zero.
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function trimEdgeTicks(ticks: number[]): number[] {
  // Drop the first and last tick so the topmost/bottommost labels aren't
  // rendered right at the chart edge (where they'd overlap the axis line or
  // spill beyond the chart frame).
  if (ticks.length <= 2) return ticks;
  return ticks.slice(1, -1);
}

function fmtFixed(value: unknown, digits = 2): string {
  const n = safeNum(value);
  return n == null ? '--' : n.toFixed(digits);
}

function generateNiceTicks(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const step = getDynamicStep(min, max);
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let i = 0; i < 24; i++) {
    const t = Number((start + i * step).toPrecision(12));
    ticks.push(t);
    if (t >= max) break;
  }
  return ticks;
}

function isVolumeSpike(volumeClass: string | null | undefined): boolean {
  if (!volumeClass) return false;
  return !volumeClass.toLowerCase().includes('normal');
}

const VOL_BAR_RED: readonly [number, number, number] = [239, 68, 68];
const VOL_BAR_NEUTRAL: readonly [number, number, number] = [148, 163, 184];
const VOL_BAR_GREEN: readonly [number, number, number] = [34, 197, 94];

function lerpRgb(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
  t: number,
): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(a[0] + (b[0] - a[0]) * clamped);
  const g = Math.round(a[1] + (b[1] - a[1]) * clamped);
  const bl = Math.round(a[2] + (b[2] - a[2]) * clamped);
  return `rgb(${r},${g},${bl})`;
}

function gradientVolumeColor(upPct: number | null): string {
  if (upPct == null || !Number.isFinite(upPct)) {
    return lerpRgb(VOL_BAR_NEUTRAL, VOL_BAR_NEUTRAL, 0);
  }
  const ratio = Math.max(0, Math.min(100, upPct)) / 100;
  if (ratio < 0.5) return lerpRgb(VOL_BAR_RED, VOL_BAR_NEUTRAL, ratio * 2);
  return lerpRgb(VOL_BAR_NEUTRAL, VOL_BAR_GREEN, (ratio - 0.5) * 2);
}

// Five-minute bucket interval in milliseconds; matches the API's bucket size.
const VOLUME_BUCKET_MS = 5 * 60 * 1000;

// ── Phone time axis ───────────────────────────────────────────────────────────
// A phone plot is ~260px wide. The desktop step (hourly across a 04:00–20:00
// session) is a dozen labels there, which overprinted into one smear
// ("04:005:006:00…"). A phone keeps about five: the step is the smallest clock
// interval that fits the chart's own span into that many, aligned to the ET
// clock (not UTC, so 3-hour steps land on 09:00/12:00/15:00 in both EST and
// EDT).
const ET_HM = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function etMinuteOfDay(ms: number): number {
  const parts = ET_HM.formatToParts(new Date(ms));
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : -1;
}

const PHONE_MAX_TIME_LABELS = 5;

function phoneLabelStepMin(timestamps: string[]): number {
  if (timestamps.length < 2) return 60;
  const first = new Date(timestamps[0]).getTime();
  const last = new Date(timestamps[timestamps.length - 1]).getTime();
  const spanMin = Number.isFinite(first) && Number.isFinite(last) ? (last - first) / 60_000 : 0;
  for (const step of [30, 60, 120, 180, 240]) {
    if (spanMin / step <= PHONE_MAX_TIME_LABELS) return step;
  }
  return 240;
}

/** Price ticks without the cents when every tick is a whole dollar — "$658",
 *  which fits a phone's 44px axis where "$658.00" did not. */
function phonePriceTick(v: number, ticks: number[]): string {
  const whole = ticks.length > 0 && ticks.every((t) => Math.abs(t - Math.round(t)) < 1e-9);
  return `$${Number(v).toFixed(whole ? 0 : 2)}`;
}

// How many divergence signals a phone shows before "Show all" — the desktop
// list scrolls inside its card, which on a phone is a scroll box inside a
// scrolling page.
const PHONE_DIVERGENCE_ROWS = 6;

export default function IntradayToolsPage() {
  const { symbol } = useTimeframe();
  const isMobile = useIsMobile();
  const [showAllDivergence, setShowAllDivergence] = useState(false);
  const axisStroke = 'var(--text-primary)';
  const mutedText = 'var(--text-secondary)';
  // Was `isDark ? --text-primary : --color-surface`: in a light theme the
  // four chart headings below rendered white on a white card.
  const textColor = 'var(--text-primary)';
  const borderColor = 'var(--border-default)';

  const { bars, latest, sessionStartEt, sessionEndEt, fetchedAt, loading, error } = useTechnicals(symbol);

  const lastUpdatedLabel = useMemo(() => {
    const ts = latest?.timestamp ?? null;
    const ms = ts ? new Date(ts).getTime() : (fetchedAt ?? null);
    if (ms == null || !Number.isFinite(ms)) return null;
    return new Date(ms).toLocaleTimeString();
  }, [latest, fetchedAt]);

  const vwapLatest = latest?.vwap_deviation ?? null;
  const orbLatest = latest?.opening_range ?? null;
  const hasVwap = vwapLatest != null && safeNum(vwapLatest.vwap) != null;
  const hasOrb = orbLatest != null && safeNum(orbLatest.orb_high) != null && safeNum(orbLatest.orb_low) != null;

  const vwapChart = useMemo(() => {
    return bars.map((bar) => {
      const price = safeNum(bar.close);
      const v = safeNum(bar.vwap_deviation?.vwap);
      const hasBoth = price != null && v != null;
      const channelAbove: [number, number] | null = hasBoth && price >= v ? [v, price] : null;
      const channelBelow: [number, number] | null = hasBoth && price < v ? [price, v] : null;
      const deviationPct = hasBoth && v !== 0 ? ((price - v) / v) * 100 : null;
      return { timestamp: bar.timestamp, price, vwap: v, channelAbove, channelBelow, deviationPct };
    });
  }, [bars]);

  const vwapPriceTicks = useMemo(() => {
    const values: number[] = [];
    for (const row of vwapChart) {
      if (row.price != null) values.push(row.price);
      if (row.vwap != null) values.push(row.vwap);
    }
    if (values.length === 0) return [] as number[];
    return trimEdgeTicks(generateNiceTicks(Math.min(...values), Math.max(...values)));
  }, [vwapChart]);

  const orbChart = useMemo(() => {
    return bars.map((bar) => {
      const price = safeNum(bar.close);
      const high = safeNum(bar.opening_range?.orb_high);
      const low = safeNum(bar.opening_range?.orb_low);
      const orbBand: [number, number] | null = high != null && low != null ? [low, high] : null;
      return { timestamp: bar.timestamp, price, orbHigh: high, orbLow: low, orbBand };
    });
  }, [bars]);

  const orbDomain = useMemo<[number, number] | null>(() => {
    const values: number[] = [];
    for (const row of orbChart) {
      if (row.price != null) values.push(row.price);
      if (row.orbHigh != null) values.push(row.orbHigh);
      if (row.orbLow != null) values.push(row.orbLow);
    }
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = max > min ? (max - min) * 0.15 : Math.max(0.5, max * 0.001);
    return [min - padding, max + padding];
  }, [orbChart]);

  const orbPriceTicks = useMemo(() => {
    if (!orbDomain) return [] as number[];
    return trimEdgeTicks(generateNiceTicks(orbDomain[0], orbDomain[1]));
  }, [orbDomain]);

  const volumeSpikesChart = useMemo(() => {
    // Bucket existing bars by their epoch-ms so we can hydrate the static
    // session slots below regardless of how recharts normalizes timestamps.
    const barByMs = new Map<number, TechnicalsBar>();
    for (const bar of bars) {
      if (!bar?.timestamp) continue;
      const ms = new Date(bar.timestamp).getTime();
      if (Number.isFinite(ms)) barByMs.set(ms, bar);
    }

    // Anchor the static range on the API-supplied session window so we cover
    // the full 04:00–20:00 ET (or 09:30–16:00 ET for indices) regardless of
    // how much data has come in yet. Falls back to first/last bar if session
    // metadata hasn't arrived.
    const sessionStartMs = sessionStartEt
      ? new Date(sessionStartEt).getTime()
      : bars.length ? new Date(bars[0].timestamp).getTime() : NaN;
    const sessionEndMs = sessionEndEt
      ? new Date(sessionEndEt).getTime()
      : bars.length ? new Date(bars[bars.length - 1].timestamp).getTime() : NaN;

    if (!Number.isFinite(sessionStartMs) || !Number.isFinite(sessionEndMs) || sessionEndMs <= sessionStartMs) {
      return [] as Array<{
        timestamp: string;
        volume: number;
        volumeRaw: number | null;
        volumeRatio: number | null;
        volumeSigma: number | null;
        volumeClass: string | null;
        buyingPressurePct: number | null;
        upVolume: number | null;
        downVolume: number | null;
        underlyingPrice: number | null;
      }>;
    }

    const slots: Array<{
      timestamp: string;
      volume: number;
      volumeRaw: number | null;
      volumeRatio: number | null;
      volumeSigma: number | null;
      volumeClass: string | null;
      buyingPressurePct: number | null;
      upVolume: number | null;
      downVolume: number | null;
      underlyingPrice: number | null;
    }> = [];

    for (let t = sessionStartMs; t < sessionEndMs; t += VOLUME_BUCKET_MS) {
      const bar = barByMs.get(t);
      const volumeClass = bar?.volume_spike?.volume_class ?? null;
      const isSpike = isVolumeSpike(volumeClass);
      const volume = bar ? (safeNum(bar.volume_spike?.current_volume) ?? safeNum(bar.volume)) : null;
      const ratio = bar ? safeNum(bar.volume_spike?.volume_ratio) : null;
      const sigma = bar ? safeNum(bar.volume_spike?.volume_sigma) : null;
      const buyingPressure = bar ? safeNum(bar.volume_spike?.buying_pressure_pct) : null;
      const upVolume = bar ? safeNum(bar.volume_spike?.up_volume) : null;
      const downVolume = bar ? safeNum(bar.volume_spike?.down_volume) : null;
      const observedPrice = bar ? safeNum(bar.close) : null;
      slots.push({
        timestamp: new Date(t).toISOString(),
        volume: isSpike && volume != null ? volume : 0,
        volumeRaw: isSpike ? volume : null,
        volumeRatio: ratio,
        volumeSigma: sigma,
        volumeClass,
        buyingPressurePct: buyingPressure,
        upVolume,
        downVolume,
        underlyingPrice: observedPrice,
      });
    }

    return slots;
  }, [bars, sessionStartEt, sessionEndEt]);

  const volumeSpikeVolumeAxis = useMemo(() => {
    const max = volumeSpikesChart.reduce((m, row) => Math.max(m, row.volume || 0), 0);
    if (max <= 0) return { ticks: [0], domain: [0, 0] as [number, number] };
    const step = getDynamicStep(0, max);
    const top = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let t = 0; t <= top + step / 2 && ticks.length < 24; t += step) {
      ticks.push(Number(t.toPrecision(12)));
    }
    return { ticks: trimEdgeTicks(ticks), domain: [0, top] as [number, number] };
  }, [volumeSpikesChart]);

  const volumeSpikeLabelStepMin = useMemo(() => {
    const len = volumeSpikesChart.length;
    if (len <= 0) return 60;
    if (len <= 24) return 15;
    if (len <= 96) return 30;
    if (len <= 192) return 60;
    return 120;
  }, [volumeSpikesChart]);

  const volumeSpikePriceTicks = useMemo(() => {
    const values = volumeSpikesChart
      .map((row) => row.underlyingPrice)
      .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
    if (values.length === 0) return [];
    const ticks = generateNiceTicks(Math.min(...values), Math.max(...values));
    if (ticks.length <= 2) return ticks;
    return ticks.slice(1, -1);
  }, [volumeSpikesChart]);

  const volumeSpikeDateMarkerMeta = useMemo(() => {
    return getDateMarkerMeta(volumeSpikesChart.map((row) => String(row.timestamp)));
  }, [volumeSpikesChart]);

  const divergenceRows = useMemo(() => {
    const rows = bars
      .filter((bar): bar is TechnicalsBar => Boolean(bar?.momentum_divergence?.divergence_signal))
      .filter((bar) => isWithinExtendedMarketHours(bar.timestamp))
      .map((bar) => ({
        timestamp: bar.timestamp,
        signal: bar.momentum_divergence.divergence_signal as string,
        price: safeNum(bar.close),
        chg5m: safeNum(bar.momentum_divergence.chg_5m),
      }));
    rows.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return rows;
  }, [bars]);

  const renderTimelineTick = (props: { x?: number | string; y?: number | string; payload?: { value?: string | number }; index?: number }) => {
    const x = Number(props?.x ?? 0); const y = Number(props?.y ?? 0);
    const ts = String(props?.payload?.value || '');
    const index = Number(props?.index ?? -1);
    const d = ts ? new Date(ts) : null;
    const minOfDay = d && !Number.isNaN(d.getTime()) ? d.getUTCHours() * 60 + d.getUTCMinutes() : -1;
    const showTime = minOfDay >= 0 && minOfDay % volumeSpikeLabelStepMin === 0;
    const timeLabel = showTime ? d!.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '';
    const dateLabel = volumeSpikeDateMarkerMeta.get(index);
    if (!timeLabel && !dateLabel) return <g transform={`translate(${x},${y})`} />;
    return (
      <g transform={`translate(${x},${y})`}>
        <line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} />
        {timeLabel ? <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>{timeLabel}</text> : null}
        {dateLabel ? <text dy={timeLabel ? 26 : 14} textAnchor="middle" fill={mutedText} fontSize={9}>{dateLabel}</text> : null}
      </g>
    );
  };

  // Phone twin of renderTimelineTick: an ET-aligned step sized to each
  // chart's own span (see phoneLabelStepMin), 10px type, and the session date
  // under the first slot. Desktop keeps renderTimelineTick as it was.
  const phoneTimelineTick = (stepMin: number) => {
    const PhoneTimelineTick = (props: { x?: number | string; y?: number | string; payload?: { value?: string | number }; index?: number }) => {
      const x = Number(props?.x ?? 0); const y = Number(props?.y ?? 0);
      const ts = String(props?.payload?.value || '');
      const index = Number(props?.index ?? -1);
      const ms = ts ? new Date(ts).getTime() : NaN;
      const minute = Number.isFinite(ms) ? etMinuteOfDay(ms) : -1;
      const showTime = minute >= 0 && minute % stepMin === 0;
      const dateLabel = index === 0 && Number.isFinite(ms)
        ? new Date(ms).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })
        : '';
      if (!showTime && !dateLabel) return <g transform={`translate(${x},${y})`} />;
      return (
        <g transform={`translate(${x},${y})`}>
          {showTime ? <line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} /> : null}
          {showTime ? <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>{ET_HM.format(new Date(ms))}</text> : null}
          {dateLabel ? <text dy={26} textAnchor="start" fill={mutedText} fontSize={10}>{dateLabel}</text> : null}
        </g>
      );
    };
    return PhoneTimelineTick;
  };
  const barsStepMin = useMemo(() => phoneLabelStepMin(bars.map((b) => b.timestamp)), [bars]);
  const spikesStepMin = useMemo(
    () => phoneLabelStepMin(volumeSpikesChart.map((r) => r.timestamp)),
    [volumeSpikesChart],
  );
  // On a phone the price charts fit their own data (plus a little air), not
  // Recharts' 'auto' rounding, which left a quarter of a 260px plot empty.
  const vwapPhoneDomain = useMemo<[number, number] | null>(() => {
    const values: number[] = [];
    for (const row of vwapChart) {
      if (row.price != null) values.push(row.price);
      if (row.vwap != null) values.push(row.vwap);
    }
    if (values.length === 0) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = max > min ? (max - min) * 0.08 : Math.max(0.5, max * 0.001);
    return [min - pad, max + pad];
  }, [vwapChart]);
  const chartHeight = isMobile ? 260 : 320;
  // Readouts on a phone pin to the top of the plot (clear of the finger) and
  // name the bar by the ET clock the axis prints.
  const phoneTooltipPosition = isMobile ? { position: { y: 0 } } : {};
  const tooltipTimeLabel = (label: unknown) => {
    if (!label) return '--';
    const d = new Date(String(label));
    return isMobile ? `${ET_HM.format(d)} ET` : d.toLocaleString('en-US', { timeZone: 'America/New_York' });
  };

  const showInitialLoading = loading && bars.length === 0;
  const showInitialError = error && bars.length === 0;

  return (
    <PageShell>
      <PageHeader
        title="Technicals"
        sub="The intraday price picture the option book sits on&nbsp;- VWAP, opening range, volume and momentum."
        tooltip="The only page in this section that reads price rather than the option chain, and it is here because every gamma level is a level on this chart. VWAP is the session's volume-weighted average and the reference most institutional execution is measured against; the opening range is the first 30 minutes held flat for the rest of the day; volume spikes are minutes trading far above their own recent average, shaded by whether the volume was buying or selling; divergence flags price making a new extreme that momentum does not confirm. Context for the positioning surfaces, not signals in their own right."
        actions={
          lastUpdatedLabel ? (
            <span className="zg-small" style={{ color: 'var(--text-muted)' }}>
              Last updated: {lastUpdatedLabel}
            </span>
          ) : undefined
        }
      />

      {showInitialError ? (
        <ErrorMessage message={error as string} />
      ) : null}

      <section className="mb-8">
        <SectionHead title="VWAP Analysis" />
        {showInitialLoading ? (
          <div className="zg-panel p-5">
            <LoadingSpinner />
          </div>
        ) : !hasVwap ? (
          <div className="zg-panel p-5 text-center" style={{ color: mutedText }}>
            No VWAP data available (market may be closed)
          </div>
        ) : (
          <>
            {/* Short single numbers: two per row on a phone, not a tower. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
              <MetricCard title="Current Price" value={`$${fmtFixed(latest?.close)}`} tooltip="Current market price" />
              <MetricCard title="VWAP" value={`$${fmtFixed(vwapLatest?.vwap)}`} tooltip="Volume weighted average price" />
              <MetricCard title="Deviation" value={`${fmtFixed(vwapLatest?.vwap_deviation_pct)}%`} trend={Math.abs(safeNum(vwapLatest?.vwap_deviation_pct) ?? 0) > 0.2 ? 'bearish' : 'neutral'} tooltip="Percentage deviation from VWAP" />
              <MetricCard title="Position" value={vwapLatest?.vwap_position ?? '--'} tooltip="Price position relative to VWAP" />
            </div>
            {vwapChart.length > 0 ? (
              <div className="zg-panel p-5">
                <SectionHead title="VWAP vs. underlying price" titleClassName="zg-h3" tooltip="VWAP (yellow dashed) and underlying price (white) for the current session, sourced from the unified technicals API. The shaded channel widens as price diverges from VWAP&nbsp;- green when above, red when below." />
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <ComposedChart data={vwapChart} margin={isMobile ? { top: 8, right: 4, left: 0, bottom: 16 } : { top: 16, right: 12, left: 0, bottom: 16 }}>
                      <defs>
                        <linearGradient id="vwapAboveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-bull)" stopOpacity={0.95} />
                          <stop offset="35%" stopColor="var(--color-bull)" stopOpacity={0.55} />
                          <stop offset="75%" stopColor="var(--color-bull)" stopOpacity={0.18} />
                          <stop offset="100%" stopColor="var(--color-bull)" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="vwapBelowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-bear)" stopOpacity={0.0} />
                          <stop offset="25%" stopColor="var(--color-bear)" stopOpacity={0.18} />
                          <stop offset="65%" stopColor="var(--color-bear)" stopOpacity={0.55} />
                          <stop offset="100%" stopColor="var(--color-bear)" stopOpacity={0.95} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={isMobile ? phoneTimelineTick(barsStepMin) : renderTimelineTick} />
                      <YAxis stroke={axisStroke} tick={{ fill: axisStroke, fontSize: isMobile ? 10 : 11 }} tickLine={false} width={isMobile ? 44 : 60} domain={isMobile && vwapPhoneDomain ? vwapPhoneDomain : ['auto', 'auto']} ticks={vwapPriceTicks.length ? vwapPriceTicks : undefined} tickFormatter={(v) => (isMobile ? phonePriceTick(Number(v), vwapPriceTicks) : `$${Number(v).toFixed(2)}`)} padding={{ top: 12, bottom: 12 }} />
                      <Tooltip
                        {...phoneTooltipPosition}
                        cursor={{ stroke: 'var(--text-primary)', strokeOpacity: 0.2 }}
                        content={({ active, label, payload }) => {
                          if (!active || !payload?.length) return null;
                          const point = payload[0]?.payload as { price: number | null; vwap: number | null; deviationPct: number | null } | undefined;
                          if (!point) return null;
                          const labelStr = tooltipTimeLabel(label);
                          const devColor = point.deviationPct == null ? mutedText : point.deviationPct >= 0 ? 'var(--color-bull)' : 'var(--color-bear)';
                          return (
                            <ChartTooltipShell label={labelStr}>
                              <ChartTooltipRow label="Price" value={point.price != null ? `$${point.price.toFixed(2)}` : '--'} swatch="var(--text-primary)" />
                              <ChartTooltipRow label="VWAP" value={point.vwap != null ? `$${point.vwap.toFixed(2)}` : '--'} swatch="var(--color-warning)" />
                              <ChartTooltipRow
                                label="Deviation"
                                value={point.deviationPct != null ? `${point.deviationPct >= 0 ? '+' : ''}${point.deviationPct.toFixed(2)}%` : '--'}
                                color={devColor}
                              />
                            </ChartTooltipShell>
                          );
                        }}
                      />
                      <Area dataKey="channelAbove" stroke="none" fill="url(#vwapAboveGrad)" connectNulls={false} isAnimationActive={false} activeDot={false} />
                      <Area dataKey="channelBelow" stroke="none" fill="url(#vwapBelowGrad)" connectNulls={false} isAnimationActive={false} activeDot={false} />
                      <Line type="monotone" dataKey="vwap" name="VWAP" stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />
                      <Line type="monotone" dataKey="price" name="Price" stroke="var(--text-primary)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="mb-8">
        <SectionHead title="Opening Range Breakout" />
        {showInitialLoading ? (
          <div className="zg-panel p-5">
            <LoadingSpinner />
          </div>
        ) : !hasOrb || latest?.close == null ? (
          <div className="zg-panel p-5 text-center" style={{ color: mutedText }}>
            No ORB data available (market may be closed)
          </div>
        ) : (
          <>
            {/* Short single numbers: two per row on a phone, not a tower. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
              <MetricCard title="Current Price" value={`$${fmtFixed(latest?.close)}`} tooltip="Current market price" />
              <MetricCard title="ORB High" value={`$${fmtFixed(orbLatest?.orb_high)}`} subtitle={`+${fmtFixed(orbLatest?.distance_above_orb_high)}`} tooltip="Opening range high" />
              <MetricCard title="ORB Low" value={`$${fmtFixed(orbLatest?.orb_low)}`} subtitle={`-${fmtFixed(orbLatest?.distance_below_orb_low)}`} tooltip="Opening range low" />
              <MetricCard title="ORB Range" value={`$${fmtFixed(orbLatest?.orb_range)}`} tooltip="Opening range size" />
            </div>
            <div className="zg-panel p-5 mb-4">
              {(() => {
                const orbHigh = safeNum(orbLatest?.orb_high) ?? 0;
                const orbLow = safeNum(orbLatest?.orb_low) ?? 0;
                const orbRangeRaw = safeNum(orbLatest?.orb_range);
                const currentPrice = safeNum(latest?.close) ?? 0;
                const range = orbRangeRaw != null && orbRangeRaw > 0 ? orbRangeRaw : 1;
                const lowEdge = orbLow - range;
                const highEdge = orbHigh + range;
                const span = Math.max(1e-9, highEdge - lowEdge);
                const pct = (v: number) => Math.max(0, Math.min(100, ((v - lowEdge) / span) * 100));
                const lowPct = pct(orbLow);
                const highPct = pct(orbHigh);
                const pricePct = pct(currentPrice);
                const status = orbLatest?.orb_status ?? '--';
                const statusColor = status.includes('🚀') ? 'var(--color-bull)' : status.includes('💥') ? 'var(--color-bear)' : 'var(--color-warning)';
                return (
                  <div>
                    <div className="flex items-baseline justify-between mb-3">
                      <h3 className="zg-h3">Position Within Range</h3>
                      <div className="text-sm" style={{ color: statusColor, fontWeight: 600 }}>{status}</div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-2" style={{ color: mutedText }}>
                      <span>Below Range</span>
                      <span>Inside Range</span>
                      <span>Above Range</span>
                    </div>
                    <div
                      className="relative h-5 rounded-full overflow-visible"
                      style={{ background: 'linear-gradient(to right, var(--color-bear) 0%, color-mix(in srgb, var(--color-bear) 30%, transparent) 33%, color-mix(in srgb, var(--color-warning) 35%, transparent) 50%, color-mix(in srgb, var(--color-bull) 30%, transparent) 67%, var(--color-bull) 100%)' }}
                    >
                      <div className="absolute top-0 bottom-0 w-px" style={{ left: `${lowPct}%`, backgroundColor: 'var(--text-primary)', opacity: 0.45 }} />
                      <div className="absolute top-0 bottom-0 w-px" style={{ left: `${highPct}%`, backgroundColor: 'var(--text-primary)', opacity: 0.45 }} />
                      <div
                        className="absolute -top-1 -bottom-1 w-1 -translate-x-1/2 rounded"
                        style={{ left: spectrumIndicatorLeft(pricePct, 20, 4), backgroundColor: 'var(--text-primary)', boxShadow: '0 0 10px rgba(255,255,255,0.55)' }}
                      />
                    </div>
                    <div className="relative h-5 mt-2 text-[10px]" style={{ color: mutedText }}>
                      <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${lowPct}%` }}>${orbLow.toFixed(2)}</span>
                      <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${highPct}%` }}>${orbHigh.toFixed(2)}</span>
                    </div>
                    <div className="relative h-4 text-[10px]">
                      {/* Centered under the marker, the price label hung half
                          off the card whenever price sat at either end of the
                          scale (it pins there once it leaves the range). A
                          phone anchors it inside instead. */}
                      <span
                        className={`absolute whitespace-nowrap font-semibold ${
                          isMobile && pricePct > 88 ? '-translate-x-full' : isMobile && pricePct < 12 ? '' : '-translate-x-1/2'
                        }`}
                        style={{ left: `${pricePct}%`, color: textColor }}
                      >
                        ${currentPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
            {orbChart.length > 0 ? (
              <div className="zg-panel p-5">
                <SectionHead title="ORB breakout map" titleClassName="zg-h3" tooltip="30-minute opening range (09:30-09:59 ET). The green line is the ORB High and the red line is the ORB Low, both computed from that first 30 minutes of the regular session and then held flat for the rest of the day. The yellow band is the live opening range, and the white line is the underlying price." />
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <ComposedChart data={orbChart} margin={isMobile ? { top: 8, right: 4, left: 0, bottom: 16 } : { top: 16, right: 56, left: 0, bottom: 16 }}>
                      <defs>
                        <linearGradient id="orbZoneGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-warning)" stopOpacity={0.42} />
                          <stop offset="100%" stopColor="var(--color-warning)" stopOpacity={0.18} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={isMobile ? phoneTimelineTick(barsStepMin) : renderTimelineTick} />
                      <YAxis stroke={axisStroke} tick={{ fill: axisStroke, fontSize: isMobile ? 10 : 11 }} tickLine={false} width={isMobile ? 44 : 60} domain={orbDomain ?? ['auto', 'auto']} ticks={orbPriceTicks.length ? orbPriceTicks : undefined} tickFormatter={(v) => (isMobile ? phonePriceTick(Number(v), orbPriceTicks) : `$${Number(v).toFixed(2)}`)} allowDataOverflow={false} padding={{ top: 12, bottom: 12 }} />
                      <Tooltip
                        {...phoneTooltipPosition}
                        cursor={{ stroke: 'var(--text-primary)', strokeOpacity: 0.2 }}
                        content={({ active, label, payload }) => {
                          if (!active || !payload?.length) return null;
                          const point = payload[0]?.payload as { price: number | null; orbHigh: number | null; orbLow: number | null } | undefined;
                          if (!point) return null;
                          const labelStr = tooltipTimeLabel(label);
                          const distHigh = point.price != null && point.orbHigh != null ? point.price - point.orbHigh : null;
                          const distLow = point.price != null && point.orbLow != null ? point.price - point.orbLow : null;
                          const zone = point.price == null || point.orbHigh == null || point.orbLow == null
                            ? null
                            : point.price > point.orbHigh ? 'Above ORB High' : point.price < point.orbLow ? 'Below ORB Low' : 'Inside ORB Range';
                          const zoneColor = zone === 'Above ORB High' ? 'var(--color-bull)' : zone === 'Below ORB Low' ? 'var(--color-bear)' : 'var(--color-warning)';
                          return (
                            <ChartTooltipShell label={labelStr}>
                              <ChartTooltipRow label="Price" value={point.price != null ? `$${point.price.toFixed(2)}` : '--'} swatch="var(--text-primary)" />
                              <ChartTooltipRow label="ORB High" value={point.orbHigh != null ? `$${point.orbHigh.toFixed(2)}` : '--'} swatch="var(--color-bull)" />
                              <ChartTooltipRow label="ORB Low" value={point.orbLow != null ? `$${point.orbLow.toFixed(2)}` : '--'} swatch="var(--color-bear)" />
                              {distHigh != null ? <ChartTooltipRow label="vs High" value={`${distHigh >= 0 ? '+' : ''}$${distHigh.toFixed(2)}`} /> : null}
                              {distLow != null ? <ChartTooltipRow label="vs Low" value={`${distLow >= 0 ? '+' : ''}$${distLow.toFixed(2)}`} /> : null}
                              {zone ? <ChartTooltipRow label="Zone" value={zone} color={zoneColor} /> : null}
                            </ChartTooltipShell>
                          );
                        }}
                      />
                      <Area type="stepAfter" dataKey="orbBand" stroke="none" fill="url(#orbZoneGrad)" connectNulls={false} isAnimationActive={false} activeDot={false} />
                      <Line type="stepAfter" dataKey="orbHigh" name="ORB High" stroke="var(--color-bull)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                      <Line type="stepAfter" dataKey="orbLow" name="ORB Low" stroke="var(--color-bear)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                      <Line type="monotone" dataKey="price" name="Price" stroke="var(--text-primary)" strokeWidth={2.25} dot={false} connectNulls isAnimationActive={false} />
                      {/* The level tags hang in a 56px right gutter on desktop; a
                          phone has no gutter to spare, so they sit inside the
                          plot's right edge — H above its line, L below its. */}
                      {orbLatest?.orb_high != null ? (
                        <ReferenceLine y={orbLatest.orb_high} stroke="transparent" label={{ value: `H $${(safeNum(orbLatest.orb_high) ?? 0).toFixed(2)}`, position: isMobile ? 'insideTopRight' : 'right', fill: 'var(--color-bull)', fontSize: isMobile ? 10 : 11, fontWeight: 600 }} />
                      ) : null}
                      {orbLatest?.orb_low != null ? (
                        <ReferenceLine y={orbLatest.orb_low} stroke="transparent" label={{ value: `L $${(safeNum(orbLatest.orb_low) ?? 0).toFixed(2)}`, position: isMobile ? 'insideBottomRight' : 'right', fill: 'var(--color-bear)', fontSize: isMobile ? 10 : 11, fontWeight: 600 }} />
                      ) : null}
                    </ComposedChart>
                  </ResponsiveContainer>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="mb-8">
        <SectionHead title="Unusual Volume Spikes" />
        {showInitialLoading ? (
          <div className="zg-panel p-5 text-center" style={{ color: mutedText }}>
            Loading volume spikes...
          </div>
        ) : volumeSpikesChart.length === 0 ? (
          <div className="zg-panel p-5 text-center" style={{ color: mutedText }}>
            No unusual volume detected
          </div>
        ) : (
          <div className="zg-panel p-5">
            <SectionHead title="Volume spikes vs. underlying price" titleClassName="zg-h3" tooltip="Bars show spike volume by minute (taller = larger spike). Bar color shades from bright red (all down-volume) through neutral (balanced) to bright green (all up-volume). The yellow line overlays the underlying price on the right axis. Hover any bar for full detail." />
              <ResponsiveContainer width="100%" height={chartHeight}>
                <ComposedChart data={volumeSpikesChart} margin={isMobile ? { top: 8, right: 0, left: 0, bottom: 16 } : { top: 16, right: 12, left: 0, bottom: 16 }}>
                  <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={isMobile ? phoneTimelineTick(spikesStepMin) : renderTimelineTick} />
                  <YAxis yAxisId="volume" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: isMobile ? 10 : 11 }} tickLine={false} width={isMobile ? 40 : 60} ticks={volumeSpikeVolumeAxis.ticks} domain={volumeSpikeVolumeAxis.domain} padding={{ top: 12, bottom: 12 }} tickFormatter={(v) => {
                    const n = Number(v);
                    if (!Number.isFinite(n)) return '--';
                    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
                    return String(n);
                  }} />
                  <YAxis yAxisId="price" orientation="right" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: isMobile ? 10 : 11 }} tickLine={false} width={isMobile ? 40 : 60} domain={["auto", "auto"]} ticks={volumeSpikePriceTicks.length ? volumeSpikePriceTicks : undefined} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} padding={{ top: 12, bottom: 12 }} />
                  <Tooltip
                    {...phoneTooltipPosition}
                    cursor={{ fill: 'var(--text-primary)', fillOpacity: 0.08 }}
                    content={({ active, label, payload }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0]?.payload as {
                        volumeRaw: number | null;
                        volumeRatio: number | null;
                        volumeSigma: number | null;
                        volumeClass: string | null;
                        buyingPressurePct: number | null;
                        upVolume: number | null;
                        downVolume: number | null;
                        underlyingPrice: number | null;
                      } | undefined;
                      if (!point) return null;
                      const labelStr = tooltipTimeLabel(label);
                      const hasSpike = point.volumeRaw != null;
                      return (
                        <ChartTooltipShell label={labelStr}>
                          {hasSpike ? (
                            <>
                              <ChartTooltipRow label="Volume" value={point.volumeRaw!.toLocaleString()} />
                              {point.upVolume != null ? <ChartTooltipRow label="Up Volume" value={point.upVolume.toLocaleString()} swatch="var(--color-bull)" /> : null}
                              {point.downVolume != null ? <ChartTooltipRow label="Down Volume" value={point.downVolume.toLocaleString()} swatch="var(--color-bear)" /> : null}
                              {point.volumeRatio != null ? <ChartTooltipRow label="Ratio" value={`${point.volumeRatio.toFixed(1)}x avg`} /> : null}
                              {point.volumeSigma != null ? <ChartTooltipRow label="Sigma" value={`${point.volumeSigma.toFixed(1)}σ`} /> : null}
                              {point.volumeClass ? <ChartTooltipRow label="Class" value={point.volumeClass} /> : null}
                              {point.buyingPressurePct != null ? <ChartTooltipRow label="Buying Pressure" value={`${point.buyingPressurePct.toFixed(1)}%`} /> : null}
                            </>
                          ) : (
                            <div style={{ color: mutedText }}>No spike at this minute</div>
                          )}
                        </ChartTooltipShell>
                      );
                    }}
                  />
                  {/* 192 five-minute slots share ~250px on a phone: a 14px bar
                      there is a smear across its neighbours, so it thins. */}
                  <Bar yAxisId="volume" dataKey="volume" name="Spike Volume" barSize={isMobile ? 3 : 14} isAnimationActive={false}>
                    {volumeSpikesChart.map((row, idx) => {
                      // Gradient red→neutral→green based on the up-vs-down volume
                      // split for the bucket. Falls back to the API-computed
                      // buying_pressure_pct when up/down volumes aren't present.
                      const total = (row.upVolume ?? 0) + (row.downVolume ?? 0);
                      const upPct = row.upVolume != null && row.downVolume != null && total > 0
                        ? (row.upVolume / total) * 100
                        : row.buyingPressurePct;
                      return <Cell key={`vol-cell-${idx}`} fill={gradientVolumeColor(upPct)} />;
                    })}
                  </Bar>
                  <Line yAxisId="price" type="monotone" dataKey="underlyingPrice" name="Underlying" stroke="var(--color-warning)" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="mb-8">
        <SectionHead title="Momentum Divergence Signals" />
        {showInitialLoading ? (
          <div className="zg-panel p-5 text-center" style={{ color: mutedText }}>
            Loading divergence signals...
          </div>
        ) : divergenceRows.length === 0 ? (
          <div className="zg-panel p-5 text-center" style={{ color: mutedText }}>No divergence signals</div>
        ) : (
          <div className="zg-panel p-5">
            <div className={isMobile ? 'space-y-3' : 'space-y-3 max-h-[420px] overflow-y-auto pr-1'}>
              {(isMobile && !showAllDivergence ? divergenceRows.slice(0, PHONE_DIVERGENCE_ROWS) : divergenceRows).map((signal, idx) => {
                const divergenceSignal = signal.signal;
                const price = signal.price ?? 0;
                return (
                  <div key={`${signal.timestamp}-${idx}`} className="border-b pb-3" style={{ borderColor: borderColor }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">{signal.timestamp ? new Date(signal.timestamp).toLocaleTimeString() : '--:--'}</div>
                      <div className={`px-3 py-1 rounded text-sm font-semibold ${
                        divergenceSignal.includes('🚨') ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]' :
                        divergenceSignal.includes('🟢') ? 'bg-[var(--color-bull-soft)] text-[var(--color-bull)]' :
                        divergenceSignal.includes('🔴') ? 'bg-[var(--color-bear-soft)] text-[var(--color-bear)]' :
                        'bg-[var(--bg-card)] text-[var(--text-secondary)]'
                      }`}>
                        {divergenceSignal}
                      </div>
                    </div>
                    <div className="text-sm" style={{ color: mutedText }}>Price: ${price.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
            {isMobile && divergenceRows.length > PHONE_DIVERGENCE_ROWS ? (
              <button
                type="button"
                onClick={() => setShowAllDivergence((v) => !v)}
                className="mt-3 w-full min-h-10 rounded border text-sm font-semibold"
                style={{ borderColor, color: 'var(--text-secondary)' }}
              >
                {showAllDivergence ? 'Show fewer' : `Show all ${divergenceRows.length} signals`}
              </button>
            ) : null}
          </div>
        )}
      </section>
    </PageShell>
  );
}
