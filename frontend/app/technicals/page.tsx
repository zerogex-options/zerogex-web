/**
 * Intraday Trading Tools Page
 * VWAP, ORB, Volume Spikes, Momentum Divergence, etc.
 *
 * All cards and charts on this page are powered by the unified
 * `/api/technicals` endpoint via the `useTechnicals` hook.
 */

'use client';

import { useMemo } from 'react';
import { Info } from 'lucide-react';
import { Area, Bar, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useTechnicals, type TechnicalsBar } from '@/hooks/useTechnicals';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import TooltipWrapper from '@/components/TooltipWrapper';
import { isWithinExtendedMarketHours } from '@/core/utils';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
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

export default function IntradayToolsPage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? 'var(--color-surface)' : 'var(--color-surface)';
  const axisStroke = isDark ? 'var(--color-text-primary)' : 'var(--color-text-primary)';
  const mutedText = isDark ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)';
  const textColor = isDark ? 'var(--color-text-primary)' : 'var(--color-surface)';
  const borderColor = isDark ? 'var(--border-default)' : 'var(--border-default)';

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

  const showInitialLoading = loading && bars.length === 0;
  const showInitialError = error && bars.length === 0;

  return (
    <div className="container mx-auto px-4 py-8">
      {lastUpdatedLabel ? (
        <div className="text-right text-sm text-[var(--text-muted)] mb-4">
          Last updated: {lastUpdatedLabel}
        </div>
      ) : null}

      {showInitialError ? (
        <ErrorMessage message={error as string} />
      ) : null}

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">VWAP Analysis</h2>
        {showInitialLoading ? (
          <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
            <LoadingSpinner />
          </div>
        ) : !hasVwap ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>
            No VWAP data available (market may be closed)
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <MetricCard title="Current Price" value={`$${fmtFixed(latest?.close)}`} tooltip="Current market price" />
              <MetricCard title="VWAP" value={`$${fmtFixed(vwapLatest?.vwap)}`} tooltip="Volume weighted average price" />
              <MetricCard title="Deviation" value={`${fmtFixed(vwapLatest?.vwap_deviation_pct)}%`} trend={Math.abs(safeNum(vwapLatest?.vwap_deviation_pct) ?? 0) > 0.2 ? 'bearish' : 'neutral'} tooltip="Percentage deviation from VWAP" />
              <MetricCard title="Position" value={vwapLatest?.vwap_position ?? '--'} tooltip="Price position relative to VWAP" />
            </div>
            {vwapChart.length > 0 ? (
              <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>VWAP VS UNDERLYING PRICE</h3>
                  <TooltipWrapper text="VWAP (yellow dashed) and underlying price (white) for the current session, sourced from the unified technicals API. The shaded channel widens as price diverges from VWAP — green when above, red when below."><Info size={14} /></TooltipWrapper>
                </div>
                <MobileScrollableChart>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={vwapChart} margin={{ top: 16, right: 12, left: 0, bottom: 16 }}>
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
                      <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={renderTimelineTick} />
                      <YAxis stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} domain={['auto', 'auto']} ticks={vwapPriceTicks.length ? vwapPriceTicks : undefined} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} padding={{ top: 12, bottom: 12 }} />
                      <Tooltip
                        cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
                        content={({ active, label, payload }) => {
                          if (!active || !payload?.length) return null;
                          const point = payload[0]?.payload as { price: number | null; vwap: number | null; deviationPct: number | null } | undefined;
                          if (!point) return null;
                          const labelStr = label ? new Date(String(label)).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '--';
                          const devColor = point.deviationPct == null ? mutedText : point.deviationPct >= 0 ? 'var(--color-bull)' : 'var(--color-bear)';
                          return (
                            <div style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }} className="rounded-lg border px-3 py-2 text-sm">
                              <div className="font-semibold mb-1">{labelStr}</div>
                              <div>Price: {point.price != null ? `$${point.price.toFixed(2)}` : '--'}</div>
                              <div>VWAP: {point.vwap != null ? `$${point.vwap.toFixed(2)}` : '--'}</div>
                              <div style={{ color: devColor }}>Deviation: {point.deviationPct != null ? `${point.deviationPct >= 0 ? '+' : ''}${point.deviationPct.toFixed(2)}%` : '--'}</div>
                            </div>
                          );
                        }}
                      />
                      <Area dataKey="channelAbove" stroke="none" fill="url(#vwapAboveGrad)" connectNulls={false} isAnimationActive={false} activeDot={false} />
                      <Area dataKey="channelBelow" stroke="none" fill="url(#vwapBelowGrad)" connectNulls={false} isAnimationActive={false} activeDot={false} />
                      <Line type="monotone" dataKey="vwap" name="VWAP" stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />
                      <Line type="monotone" dataKey="price" name="Price" stroke="var(--color-text-primary)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </MobileScrollableChart>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Opening Range Breakout</h2>
        {showInitialLoading ? (
          <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
            <LoadingSpinner />
          </div>
        ) : !hasOrb || latest?.close == null ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>
            No ORB data available (market may be closed)
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <MetricCard title="Current Price" value={`$${fmtFixed(latest?.close)}`} tooltip="Current market price" />
              <MetricCard title="ORB High" value={`$${fmtFixed(orbLatest?.orb_high)}`} subtitle={`+${fmtFixed(orbLatest?.distance_above_orb_high)}`} tooltip="Opening range high" />
              <MetricCard title="ORB Low" value={`$${fmtFixed(orbLatest?.orb_low)}`} subtitle={`-${fmtFixed(orbLatest?.distance_below_orb_low)}`} tooltip="Opening range low" />
              <MetricCard title="ORB Range" value={`$${fmtFixed(orbLatest?.orb_range)}`} tooltip="Opening range size" />
            </div>
            <div className="rounded-lg p-6 mb-4" style={{ backgroundColor: cardBg }}>
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
                      <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>Position Within Range</h3>
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
                      <div className="absolute top-0 bottom-0 w-px" style={{ left: `${lowPct}%`, backgroundColor: 'var(--color-text-primary)', opacity: 0.45 }} />
                      <div className="absolute top-0 bottom-0 w-px" style={{ left: `${highPct}%`, backgroundColor: 'var(--color-text-primary)', opacity: 0.45 }} />
                      <div
                        className="absolute -top-1 -bottom-1 w-1 -translate-x-1/2 rounded"
                        style={{ left: spectrumIndicatorLeft(pricePct, 20, 4), backgroundColor: 'var(--color-text-primary)', boxShadow: '0 0 10px rgba(255,255,255,0.55)' }}
                      />
                    </div>
                    <div className="relative h-5 mt-2 text-[10px]" style={{ color: mutedText }}>
                      <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${lowPct}%` }}>${orbLow.toFixed(2)}</span>
                      <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${highPct}%` }}>${orbHigh.toFixed(2)}</span>
                    </div>
                    <div className="relative h-4 text-[10px]">
                      <span className="absolute -translate-x-1/2 whitespace-nowrap font-semibold" style={{ left: `${pricePct}%`, color: textColor }}>
                        ${currentPrice.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
            {orbChart.length > 0 ? (
              <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>ORB BREAKOUT MAP</h3>
                  <TooltipWrapper text="The green line is the ORB high through the session, the red line is the ORB low, the yellow band is the live opening range, and the white line is the underlying price."><Info size={14} /></TooltipWrapper>
                </div>
                <MobileScrollableChart>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={orbChart} margin={{ top: 16, right: 56, left: 0, bottom: 16 }}>
                      <defs>
                        <linearGradient id="orbZoneGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-warning)" stopOpacity={0.42} />
                          <stop offset="100%" stopColor="var(--color-warning)" stopOpacity={0.18} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={renderTimelineTick} />
                      <YAxis stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} domain={orbDomain ?? ['auto', 'auto']} ticks={orbPriceTicks.length ? orbPriceTicks : undefined} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} allowDataOverflow={false} padding={{ top: 12, bottom: 12 }} />
                      <Tooltip
                        cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
                        content={({ active, label, payload }) => {
                          if (!active || !payload?.length) return null;
                          const point = payload[0]?.payload as { price: number | null; orbHigh: number | null; orbLow: number | null } | undefined;
                          if (!point) return null;
                          const labelStr = label ? new Date(String(label)).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '--';
                          const distHigh = point.price != null && point.orbHigh != null ? point.price - point.orbHigh : null;
                          const distLow = point.price != null && point.orbLow != null ? point.price - point.orbLow : null;
                          const zone = point.price == null || point.orbHigh == null || point.orbLow == null
                            ? null
                            : point.price > point.orbHigh ? 'Above ORB High' : point.price < point.orbLow ? 'Below ORB Low' : 'Inside ORB Range';
                          const zoneColor = zone === 'Above ORB High' ? 'var(--color-bull)' : zone === 'Below ORB Low' ? 'var(--color-bear)' : 'var(--color-warning)';
                          return (
                            <div style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }} className="rounded-lg border px-3 py-2 text-sm">
                              <div className="font-semibold mb-1">{labelStr}</div>
                              <div>Price: {point.price != null ? `$${point.price.toFixed(2)}` : '--'}</div>
                              <div>ORB High: {point.orbHigh != null ? `$${point.orbHigh.toFixed(2)}` : '--'}</div>
                              <div>ORB Low: {point.orbLow != null ? `$${point.orbLow.toFixed(2)}` : '--'}</div>
                              {distHigh != null ? <div>vs High: {distHigh >= 0 ? '+' : ''}${'$'}{distHigh.toFixed(2)}</div> : null}
                              {distLow != null ? <div>vs Low: {distLow >= 0 ? '+' : ''}${'$'}{distLow.toFixed(2)}</div> : null}
                              {zone ? <div style={{ color: zoneColor }}>{zone}</div> : null}
                            </div>
                          );
                        }}
                      />
                      <Area type="stepAfter" dataKey="orbBand" stroke="none" fill="url(#orbZoneGrad)" connectNulls={false} isAnimationActive={false} activeDot={false} />
                      <Line type="stepAfter" dataKey="orbHigh" name="ORB High" stroke="var(--color-bull)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                      <Line type="stepAfter" dataKey="orbLow" name="ORB Low" stroke="var(--color-bear)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                      <Line type="monotone" dataKey="price" name="Price" stroke="var(--color-text-primary)" strokeWidth={2.25} dot={false} connectNulls isAnimationActive={false} />
                      {orbLatest?.orb_high != null ? (
                        <ReferenceLine y={orbLatest.orb_high} stroke="transparent" label={{ value: `H $${(safeNum(orbLatest.orb_high) ?? 0).toFixed(2)}`, position: 'right', fill: 'var(--color-bull)', fontSize: 11, fontWeight: 600 }} />
                      ) : null}
                      {orbLatest?.orb_low != null ? (
                        <ReferenceLine y={orbLatest.orb_low} stroke="transparent" label={{ value: `L $${(safeNum(orbLatest.orb_low) ?? 0).toFixed(2)}`, position: 'right', fill: 'var(--color-bear)', fontSize: 11, fontWeight: 600 }} />
                      ) : null}
                    </ComposedChart>
                  </ResponsiveContainer>
                </MobileScrollableChart>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Unusual Volume Spikes</h2>
        {showInitialLoading ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>
            Loading volume spikes...
          </div>
        ) : volumeSpikesChart.length === 0 ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>
            No unusual volume detected
          </div>
        ) : (
          <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>VOLUME SPIKES VS UNDERLYING PRICE</h3>
              <TooltipWrapper text="Bars show spike volume by minute (taller = larger spike). Bar color shades from bright red (all down-volume) through neutral (balanced) to bright green (all up-volume). The yellow line overlays the underlying price on the right axis. Hover any bar for full detail."><Info size={14} /></TooltipWrapper>
            </div>
            <MobileScrollableChart>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={volumeSpikesChart} margin={{ top: 16, right: 12, left: 0, bottom: 16 }}>
                  <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={renderTimelineTick} />
                  <YAxis yAxisId="volume" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} ticks={volumeSpikeVolumeAxis.ticks} domain={volumeSpikeVolumeAxis.domain} padding={{ top: 12, bottom: 12 }} tickFormatter={(v) => {
                    const n = Number(v);
                    if (!Number.isFinite(n)) return '--';
                    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
                    return String(n);
                  }} />
                  <YAxis yAxisId="price" orientation="right" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} domain={["auto", "auto"]} ticks={volumeSpikePriceTicks.length ? volumeSpikePriceTicks : undefined} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} padding={{ top: 12, bottom: 12 }} />
                  <Tooltip
                    cursor={{ fill: 'var(--color-text-primary)', fillOpacity: 0.08 }}
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
                      const labelStr = label ? new Date(String(label)).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '--';
                      const hasSpike = point.volumeRaw != null;
                      return (
                        <div style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }} className="rounded-lg border px-3 py-2 text-sm">
                          <div className="font-semibold mb-1">{labelStr}</div>
                          {hasSpike ? (
                            <>
                              <div>Volume: {point.volumeRaw!.toLocaleString()}</div>
                              {point.upVolume != null ? <div>Up Volume: {point.upVolume.toLocaleString()}</div> : null}
                              {point.downVolume != null ? <div>Down Volume: {point.downVolume.toLocaleString()}</div> : null}
                              {point.volumeRatio != null ? <div>Ratio: {point.volumeRatio.toFixed(1)}x avg</div> : null}
                              {point.volumeSigma != null ? <div>Sigma: {point.volumeSigma.toFixed(1)}σ</div> : null}
                              {point.volumeClass ? <div>Class: {point.volumeClass}</div> : null}
                              {point.buyingPressurePct != null ? <div>Buying Pressure: {point.buyingPressurePct.toFixed(1)}%</div> : null}
                            </>
                          ) : (
                            <div style={{ color: mutedText }}>No spike at this minute</div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar yAxisId="volume" dataKey="volume" name="Spike Volume" barSize={14} isAnimationActive={false}>
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
            </MobileScrollableChart>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Momentum Divergence Signals</h2>
        {showInitialLoading ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>
            Loading divergence signals...
          </div>
        ) : divergenceRows.length === 0 ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>No divergence signals</div>
        ) : (
          <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {divergenceRows.map((signal, idx) => {
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
                        'bg-[var(--bg-card)] text-[var(--color-text-secondary)]'
                      }`}>
                        {divergenceSignal}
                      </div>
                    </div>
                    <div className="text-sm" style={{ color: mutedText }}>Price: ${price.toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
