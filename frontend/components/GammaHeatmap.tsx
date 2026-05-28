'use client';

import { Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useMarketHistorical } from '@/hooks/useMarketHistorical';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';
import { omitClosedMarketTimes, isWithinTradingHoursForSymbol } from '@/core/utils';
import ChartTimeframeSelect, { type ChartTimeframe } from './ChartTimeframeSelect';
import { useIsMobile } from '@/hooks/useIsMobile';

interface HeatmapCell { strike: number; net_gex: number; }
interface GammaBucket {
  timestamp: string;
  gamma_flip?: number | null;
  // See GammaHeatmapCanvas.tsx for the rationale — dashed segments
  // mark expansion-rung resolutions vs solid for default-rung.
  gamma_flip_span_used?: number | null;
  heatmap: HeatmapCell[];
}
interface PriceDataPoint { timestamp: string; open?: number; high?: number; low?: number; close?: number; }
interface GexHistoricalPoint { timestamp: string; gamma_flip?: number | null; gamma_flip_span_used?: number | null; }


export default function GammaHeatmap() {
  const { theme } = useTheme();
  const { getMaxDataPoints, symbol } = useTimeframe();
  const isMobile = useIsMobile();
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('5min');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredLevel, setHoveredLevel] = useState<number | null>(null);
  const maxPoints = getMaxDataPoints();
  const fetchWindowUnits = maxPoints;

  const apiTimeframe = useMemo(() => {
    if (timeframe === '1min') return '1m';
    if (timeframe === '5min') return '5m';
    if (timeframe === '15min') return '15m';
    if (timeframe === '1hr') return '1h';
    return '1d';
  }, [timeframe]);

  const symParam = `symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`;
  const { data: gexData, loading, error } = useApiData<GammaBucket[]>(
    `/api/gex/heatmap?${symParam}&timeframe=${timeframe}&window_units=${fetchWindowUnits}`,
    { refreshInterval: 5000 }
  );
  const { data: gexDataAlt, loading: loadingAlt, error: errorAlt } = useApiData<GammaBucket[]>(
    `/api/gex/heatmap?${symParam}&timeframe=${apiTimeframe}&window_units=${fetchWindowUnits}`,
    { refreshInterval: 5000, enabled: Boolean(error) }
  );

  const { rows: priceRowsAll } = useMarketHistorical(symbol, timeframe);
  const priceDataRaw: PriceDataPoint[] = useMemo(
    () => priceRowsAll.slice(-fetchWindowUnits),
    [priceRowsAll, fetchWindowUnits],
  );
  const priceDataAlt: PriceDataPoint[] = priceDataRaw;
  const { data: gexHistoricalDataRaw } = useApiData<GexHistoricalPoint[]>(
    `/api/gex/historical?${symParam}&timeframe=${timeframe}&window_units=${fetchWindowUnits}`,
    { refreshInterval: 5000 }
  );
  const { data: gexHistoricalDataAlt } = useApiData<GexHistoricalPoint[]>(
    `/api/gex/historical?${symParam}&timeframe=${apiTimeframe}&window_units=${fetchWindowUnits}`,
    { refreshInterval: 5000, enabled: !gexHistoricalDataRaw || gexHistoricalDataRaw.length === 0 }
  );

  const activeGexData = useMemo(() => gexData || gexDataAlt || [], [gexData, gexDataAlt]);
  const activePriceData = useMemo(() => priceDataRaw || priceDataAlt || [], [priceDataRaw, priceDataAlt]);
  const activeGexHistoricalData = useMemo(
    () => gexHistoricalDataRaw || gexHistoricalDataAlt || [],
    [gexHistoricalDataRaw, gexHistoricalDataAlt]
  );
  const effectiveLoading = loading || loadingAlt;
  const effectiveError = error && errorAlt ? error : null;

  const derived = useMemo(() => {
    const buckets = activeGexData || [];
    const cadenceMs = timeframe === '1min' ? 60_000 : timeframe === '5min' ? 300_000 : timeframe === '15min' ? 900_000 : timeframe === '1hr' ? 3_600_000 : 86_400_000;
    const bucketOf = (ms: number) => Math.floor(ms / cadenceMs) * cadenceMs;
    const isoOf = (ms: number) => new Date(ms).toISOString();

    // Canonical (floored) bucket-ISO keys so GEX, candles, slots and the
    // flip line all align regardless of phase/format drift between feeds.
    const sparse = new Map<string, number>();   // `${iso}_${strike}` -> net_gex
    const gexSlotSet = new Set<string>();        // canonical ISO that has GEX
    const gexMsSet = new Set<number>();
    const strikeSet = new Set<number>();
    buckets.forEach((b) => {
      const ms = bucketOf(new Date(b.timestamp).getTime());
      if (!Number.isFinite(ms)) return;
      const iso = isoOf(ms);
      (b.heatmap || []).forEach((c) => {
        const strike = Number(c.strike);
        if (!Number.isFinite(strike)) return;
        gexSlotSet.add(iso);
        gexMsSet.add(ms);
        strikeSet.add(strike);
        sparse.set(`${iso}_${strike}`, Number(c.net_gex));
      });
    });
    const strikes = Array.from(strikeSet).sort((a, b) => b - a);

    // Intraday timeframes get a REGULAR session-hour grid with blank slots
    // where GEX is genuinely absent (parity with the Canvas heatmap). 1hr/
    // 1day keep the collapsed present-bucket axis — the regular-grid +
    // session filter doesn't map cleanly onto daily bars / RTH-only indices.
    const isIntraday = timeframe === '1min' || timeframe === '5min' || timeframe === '15min';
    let timestamps: string[];
    if (isIntraday) {
      const priceMs = new Set<number>();
      (activePriceData || []).forEach((p) => {
        const ms = new Date(p.timestamp).getTime();
        if (Number.isFinite(ms)) priceMs.add(bucketOf(ms));
      });
      let latestMs = -Infinity;
      gexMsSet.forEach((ms) => { if (ms > latestMs) latestMs = ms; });
      priceMs.forEach((ms) => { if (ms > latestMs) latestMs = ms; });
      const slots: string[] = [];
      if (Number.isFinite(latestMs)) {
        let t = latestMs;
        let guard = 0;
        const guardMax = maxPoints * 64 + 4096;
        while (slots.length < maxPoints && guard < guardMax) {
          if (isWithinTradingHoursForSymbol(new Date(t), symbol)) slots.push(isoOf(t));
          t -= cadenceMs;
          guard += 1;
        }
        slots.reverse();
      }
      timestamps = slots;
    } else {
      timestamps = omitClosedMarketTimes(Array.from(gexSlotSet).sort(), (ts) => ts).slice(-maxPoints);
    }

    return { timestamps, gexSlotSet, sparse, strikes };
  }, [activeGexData, activePriceData, maxPoints, timeframe, symbol]);

  // Mirror of FLIP_DEFAULT_RUNG_MAX in GammaHeatmapCanvas.tsx —
  // GAMMA_PROFILE_SPAN_LADDER[0] = 0.20 on the backend; the 0.205
  // margin tolerates float drift at the boundary.
  const FLIP_DEFAULT_RUNG_MAX = 0.205;

  const gammaFlipByTs = useMemo(() => {
    // Keyed by canonical (floored) bucket-ISO so it matches derived's slots.
    const cadenceMs = timeframe === '1min' ? 60_000 : timeframe === '5min' ? 300_000 : timeframe === '15min' ? 900_000 : timeframe === '1hr' ? 3_600_000 : 86_400_000;
    const canon = (ts: string) => new Date(Math.floor(new Date(ts).getTime() / cadenceMs) * cadenceMs).toISOString();
    const result = new Map<string, { value: number; expanded: boolean }>();
    activeGexData.forEach((b) => {
      if (b.gamma_flip == null || !Number.isFinite(Number(b.gamma_flip))) return;
      const span = b.gamma_flip_span_used != null && Number.isFinite(Number(b.gamma_flip_span_used))
        ? Number(b.gamma_flip_span_used)
        : 0;
      result.set(canon(b.timestamp), { value: Number(b.gamma_flip), expanded: span > FLIP_DEFAULT_RUNG_MAX });
    });
    if (result.size === 0) {
      activeGexHistoricalData.forEach((row) => {
        if (row.gamma_flip == null || !Number.isFinite(Number(row.gamma_flip))) return;
        const span = row.gamma_flip_span_used != null && Number.isFinite(Number(row.gamma_flip_span_used))
          ? Number(row.gamma_flip_span_used)
          : 0;
        result.set(canon(row.timestamp), { value: Number(row.gamma_flip), expanded: span > FLIP_DEFAULT_RUNG_MAX });
      });
    }
    return result;
  }, [activeGexData, activeGexHistoricalData, timeframe]);

  if (effectiveLoading && derived.strikes.length === 0) return <LoadingSpinner size="lg" />;
  if (effectiveError) return <ErrorMessage message={effectiveError} />;
  if (derived.strikes.length === 0) return <div className="rounded-lg p-8 text-center" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}><p style={{ color: colors.muted }}>No heatmap data available</p></div>;

  const getColor = (value: number, maxAbsValue: number) => {
    if (maxAbsValue < 1e-9) return 'var(--color-surface-elevated)';
    const normalized = (value + maxAbsValue) / (2 * maxAbsValue);

    const bearishTone = { r: 44, g: 72, b: 117 }; // #2c4875 negative GEX
    const neutralTone = { r: 255, g: 246, b: 237 }; // #fff6ed net zero
    const bullishTone = { r: 255, g: 133, b: 49 }; // #ff8531 positive GEX

    const blend = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }, t: number) => ({
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t),
    });

    const rgb = normalized <= 0.5
      ? blend(bearishTone, neutralTone, normalized / 0.5)
      : blend(neutralTone, bullishTone, (normalized - 0.5) / 0.5);

    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  };

  const chartWidth = isMobile ? 900 : 1300;
  const chartHeight = isMobile ? 700 : 820;
  const yAxisWidth = 52;
  const plotLeft = 52;
  const plotTop = 42;
  const plotWidth = chartWidth - yAxisWidth - 18;
  const plotHeight = chartHeight - 94;
  const cellWidth = plotWidth / Math.max(1, derived.timestamps.length);

  const priceRows = omitClosedMarketTimes(activePriceData, (p) => p.timestamp);
  const cadenceMs = timeframe === '1min' ? 60_000 : timeframe === '5min' ? 300_000 : timeframe === '15min' ? 900_000 : timeframe === '1hr' ? 3_600_000 : 86_400_000;
  const canonIso = (ts: string) => new Date(Math.floor(new Date(ts).getTime() / cadenceMs) * cadenceMs).toISOString();
  const priceByTs = new Map(priceRows.map((p) => [canonIso(p.timestamp), p]));
  const minStrike = Math.min(...derived.strikes);
  const maxStrike = Math.max(...derived.strikes);
  const priceLow = Math.min(...priceRows.map((p) => Number(p.low ?? p.close ?? p.open ?? Infinity)));
  const priceHigh = Math.max(...priceRows.map((p) => Number(p.high ?? p.close ?? p.open ?? -Infinity)));
  const hasPriceRange = Number.isFinite(priceLow) && Number.isFinite(priceHigh);
  const combinedMinRaw = Math.min(minStrike, hasPriceRange ? priceLow : minStrike);
  const combinedMaxRaw = Math.max(maxStrike, hasPriceRange ? priceHigh : maxStrike);
  const combinedSpan = Math.max(1e-9, combinedMaxRaw - combinedMinRaw);
  const combinedPadding = combinedSpan * 0.01;
  const combinedMin = combinedMinRaw - combinedPadding;
  const combinedMax = combinedMaxRaw + combinedPadding;
  const topLevel = Math.ceil(combinedMax);
  const bottomLevel = Math.floor(combinedMin);
  const yLevels = Array.from({ length: Math.max(1, topLevel - bottomLevel + 1) }, (_, i) => topLevel - i);
  const yLabelStep = Math.max(1, Math.ceil(yLevels.length / 16));

  // Cells only for slots that actually have GEX; slots with no GEX render as
  // blank columns (the card background shows through), so sparsity is visible
  // instead of painted as neutral zero. Within a populated column, levels
  // without a reported strike keep the prior neutral-zero fill.
  const filledCells = derived.timestamps.flatMap((ts, x) =>
    derived.gexSlotSet.has(ts)
      ? yLevels.map((level) => ({
          x,
          y: level,
          value: derived.sparse.get(`${ts}_${level}`) ?? 0,
        }))
      : [],
  );

  const cellHeight = plotHeight / Math.max(1, yLevels.length);
  const values = filledCells.map((d) => Number(d.value || 0));
  const maxAbsValue = Math.max(1, ...values.map((v) => Math.abs(v)));
  const minValue = -maxAbsValue;
  const maxValue = maxAbsValue;

  const yForValue = (v: number) => {
    const raw = plotTop + plotHeight * (1 - (v - combinedMin) / Math.max(1e-9, combinedMax - combinedMin));
    return Math.max(plotTop, Math.min(plotTop + plotHeight, raw));
  };

  const gammaFlipPoints = derived.timestamps
    .map((ts, idx) => {
      const entry = gammaFlipByTs.get(ts);
      const value = entry?.value;
      if (entry == null || value == null || !Number.isFinite(value)) return null;
      // Suppress out-of-axis values the same way NULL is suppressed:
      // yForValue() clamps them to the plot edge, which renders the
      // line lying along the top/bottom border and falsely implies the
      // flip is sitting at that boundary. The honest rendering is a
      // gap.
      if (value < combinedMin || value > combinedMax) return null;
      return {
        idx,
        ts,
        x: idx * cellWidth + plotLeft + cellWidth / 2,
        y: yForValue(value),
        value,
        expanded: entry.expanded,
      };
    })
    .filter((p): p is { idx: number; ts: string; x: number; y: number; value: number; expanded: boolean } => p !== null);

  // Build TWO separate paths so default-rung and expansion-rung
  // segments render with different stroke styles and never visually
  // connect across a resolver-mode change.  See GammaHeatmapCanvas.tsx
  // for the rationale: drawing a continuous line through a
  // default→expansion transition would imply a continuous regime when
  // the resolver actually changed its qualifying scan.
  const buildFlipPath = (expandedFilter: boolean) => {
    const parts: string[] = [];
    let prevIdx = Number.NEGATIVE_INFINITY;
    gammaFlipPoints.forEach((point) => {
      if (point.expanded !== expandedFilter) {
        prevIdx = Number.NEGATIVE_INFINITY;
        return;
      }
      const continuesSegment = point.idx === prevIdx + 1 && parts.length > 0;
      parts.push(`${continuesSegment ? 'L' : 'M'} ${point.x} ${point.y}`);
      prevIdx = point.idx;
    });
    return parts.join(' ');
  };
  const gammaFlipPath = buildFlipPath(false);
  const gammaFlipPathExpanded = buildFlipPath(true);

  const hoveredIndex = hoveredIdx ?? (derived.timestamps.length - 1);
  const hoveredTs = derived.timestamps[Math.max(0, Math.min(derived.timestamps.length - 1, hoveredIndex))];
  const hoveredPrice = hoveredTs ? priceByTs.get(hoveredTs) : undefined;
  const hoveredGammaFlip = hoveredTs ? gammaFlipByTs.get(hoveredTs) : undefined;
  const hoveredStrikeValue = (() => {
    if (!hoveredTs || hoveredLevel == null) return null;
    return {
      strike: hoveredLevel,
      value: derived.sparse.get(`${hoveredTs}_${hoveredLevel}`) ?? 0,
    };
  })();

  const axisColor = theme === 'dark' ? 'var(--color-text-primary)' : 'var(--color-text-primary)';

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}>
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h3 className="text-xl font-bold" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>GEX Time Series Heatmap</h3>
          <TooltipWrapper text="Time-series heatmap of net GEX by strike over time, with overlaid underlying candles to show how price moved relative to evolving gamma concentration zones."><Info size={14} /></TooltipWrapper>
        </div>

        <ChartTimeframeSelect value={timeframe} onChange={setTimeframe} className="px-4 pt-1 pb-2 flex justify-end" />

        <div className="relative w-full">
        {hoveredTs && (
          <div className="absolute right-4 top-3 z-10 rounded-lg px-3 py-2 text-xs pointer-events-none" style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', border: '1px solid var(--color-border)', color: 'var(--color-chart-tooltip-text)', boxShadow: '0 8px 24px var(--color-info-soft)' }}>
            <div className="font-semibold">{new Date(hoveredTs).toLocaleString()}</div>
            {hoveredPrice && (
              <div>Underlying O:{Number(hoveredPrice.open ?? hoveredPrice.close ?? 0).toFixed(2)} H:{Number(hoveredPrice.high ?? hoveredPrice.close ?? 0).toFixed(2)} L:{Number(hoveredPrice.low ?? hoveredPrice.close ?? 0).toFixed(2)} C:{Number(hoveredPrice.close ?? hoveredPrice.open ?? 0).toFixed(2)}</div>
            )}
            {hoveredStrikeValue && (
              <div>Heatmap Net GEX (strike ${hoveredStrikeValue.strike.toFixed(0)}): {(hoveredStrikeValue.value / 1_000_000).toFixed(2)}M</div>
            )}
            {hoveredGammaFlip != null && Number.isFinite(hoveredGammaFlip.value) && (
              <div>
                Gamma Flip: ${hoveredGammaFlip.value.toFixed(2)}
                {hoveredGammaFlip.expanded && (
                  <span style={{ opacity: 0.7 }}> (expanded scan)</span>
                )}
              </div>
            )}
          </div>
        )}
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          style={{ aspectRatio: `${chartWidth} / ${chartHeight}` }}
          className="block w-full"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const xPx = e.clientX - rect.left;
            const yPx = e.clientY - rect.top;
            const xView = (xPx / Math.max(1, rect.width)) * chartWidth;
            const yView = (yPx / Math.max(1, rect.height)) * chartHeight;
            const idx = Math.floor((xView - plotLeft) / Math.max(1e-9, cellWidth));
            setHoveredIdx(Math.max(0, Math.min(derived.timestamps.length - 1, idx)));
            const yClamped = Math.max(plotTop, Math.min(plotTop + plotHeight, yView));
            const yValue = combinedMax - ((yClamped - plotTop) / Math.max(1e-9, plotHeight)) * (combinedMax - combinedMin);
            const nearestLevel = yLevels.reduce((best, level) =>
              Math.abs(level - yValue) < Math.abs(best - yValue) ? level : best,
            yLevels[0]);
            setHoveredLevel(nearestLevel);
          }}
          onMouseLeave={() => {
            setHoveredIdx(null);
            setHoveredLevel(null);
          }}
        >
          <defs>
            <linearGradient id="gexScale" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={getColor(minValue, maxAbsValue)} />
              <stop offset="50%" stopColor={getColor((minValue + maxValue) / 2, maxAbsValue)} />
              <stop offset="100%" stopColor={getColor(maxValue, maxAbsValue)} />
            </linearGradient>
            <clipPath id="heatmapClip">
              <rect x={plotLeft} y={plotTop} width={Math.max(0, plotWidth)} height={Math.max(0, plotHeight)} />
            </clipPath>
          </defs>

          <rect x={plotLeft} y={8} width="220" height="12" fill="url(#gexScale)" rx="3" />
          <text x={plotLeft} y={32} fontSize="10" fill={axisColor}>{(minValue / 1_000_000).toFixed(1)}M</text>
          <text x={plotLeft + 110} y={32} fontSize="10" textAnchor="middle" fill={axisColor}>0</text>
          <text x={plotLeft + 220} y={32} fontSize="10" textAnchor="end" fill={axisColor}>{(maxValue / 1_000_000).toFixed(1)}M</text>
          <text x={plotLeft + 228} y={18} fontSize="10" fill={axisColor}>Net GEX</text>
          <g>
            <line x1={plotLeft + 290} x2={plotLeft + 310} y1={20} y2={20} stroke="var(--accent-2)" strokeWidth={2.25} />
            <text x={plotLeft + 316} y={23} fontSize="10" fill={axisColor}>Gamma Flip</text>
          </g>

          {yLevels.map((level, idx) => {
            if (idx % yLabelStep !== 0) return null;
            return (
              <text key={`y-${level}`} x={plotLeft - 6} y={yForValue(level)} textAnchor="end" dominantBaseline="middle" style={{ fontSize: '10px', fill: axisColor }}>${level.toFixed(0)}</text>
            );
          })}

          <g clipPath="url(#heatmapClip)">
            <rect x={plotLeft} y={plotTop} width={Math.max(0, plotWidth)} height={Math.max(0, plotHeight)} fill={colors.cardLight} />
            {filledCells.map((cell, idx) => {
              const xPos = cell.x * cellWidth + plotLeft;
              const yPos = yForValue(cell.y) - cellHeight / 2 - 0.5;
              return (
                <rect
                  key={idx}
                  x={xPos}
                  y={yPos}
                  width={cellWidth}
                  height={cellHeight + 1}
                  fill={getColor(cell.value, maxAbsValue)}
                  opacity={1}
                />
              );
            })}
          </g>


          <g clipPath="url(#heatmapClip)">
            {derived.timestamps.map((ts, idx) => {
              const row = priceByTs.get(ts);
              if (!row) return null;
              const open = Number(row.open ?? row.close ?? 0);
              const high = Number(row.high ?? row.close ?? open);
              const low = Number(row.low ?? row.close ?? open);
              const close = Number(row.close ?? open);
              const x = idx * cellWidth + plotLeft + cellWidth / 2;
              const up = close >= open;
              const c = up ? colors.bullish : colors.bearish;
              const openY = yForValue(open);
              const closeY = yForValue(close);
              const highY = yForValue(high);
              const lowY = yForValue(low);
              const bodyY = Math.min(openY, closeY);
              const bodyBottom = Math.max(openY, closeY);
              const bodyHeight = Math.max(1, bodyBottom - bodyY);
              const candleWidth = Math.max(2, Math.min(8, cellWidth * 0.42));

              return (
                <g key={`candle-${ts}`}>
                  <line x1={x} x2={x} y1={highY} y2={bodyY} stroke={c} strokeWidth={1.5} opacity={0.95} />
                  <line x1={x} x2={x} y1={bodyBottom} y2={lowY} stroke={c} strokeWidth={1.5} opacity={0.95} />
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyY}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={c}
                    stroke={c}
                    strokeWidth={1.4}
                  />
                </g>
              );
            })}
          </g>

          {(gammaFlipPath || gammaFlipPathExpanded) && (
            <g clipPath="url(#heatmapClip)">
              {gammaFlipPath && (
                <path d={gammaFlipPath} fill="none" stroke="var(--accent-2)" strokeWidth={2.25} />
              )}
              {gammaFlipPathExpanded && (
                <path
                  d={gammaFlipPathExpanded}
                  fill="none"
                  stroke="var(--accent-2)"
                  strokeWidth={2}
                  strokeDasharray="6,4"
                  opacity={0.55}
                />
              )}
              {hoveredIdx != null && gammaFlipPoints
                .filter((p) => p.idx === hoveredIdx)
                .map((p) => (
                  <circle key={`gamma-flip-dot-${p.ts}`} cx={p.x} cy={p.y} r={3.5} fill="var(--accent-2)" />
                ))}
            </g>
          )}

          {derived.timestamps.map((timestamp, idx) => {
            const baseSpacing = cellWidth < 30 ? 6 : cellWidth < 40 ? 4 : 3;
            const spacing = isMobile ? Math.max(baseSpacing, Math.ceil(derived.timestamps.length / 6)) : baseSpacing;
            if (idx % spacing !== 0) return null;
            const time = new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            return <text key={`x-${timestamp}`} x={idx * cellWidth + plotLeft + cellWidth / 2} y={chartHeight - 14} textAnchor="middle" style={{ fontSize: isMobile ? '8px' : '10px', fill: axisColor }}>{time}</text>;
          })}
        </svg>
        </div>
      </div>
    </ExpandableCard>
  );
}
