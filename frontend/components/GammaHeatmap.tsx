'use client';

import { Info } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';
import { omitClosedMarketTimes } from '@/core/utils';
import ChartTimeframeSelect, { type ChartTimeframe } from './ChartTimeframeSelect';
import { useIsMobile } from '@/hooks/useIsMobile';

interface GammaDataPoint { timestamp: string; strike: number; net_gex: number; gamma_flip?: number | null; }
interface PriceDataPoint { timestamp: string; open?: number; high?: number; low?: number; close?: number; }
interface GexHistoricalPoint { timestamp: string; gamma_flip?: number | null; }


export default function GammaHeatmap() {
  const { theme } = useTheme();
  const { getMaxDataPoints, symbol } = useTimeframe();
  const isMobile = useIsMobile();
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('5min');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxPoints = getMaxDataPoints();
  const fetchWindowUnits = maxPoints;

  const apiTimeframe = useMemo(() => {
    if (timeframe === '1min') return '1m';
    if (timeframe === '5min') return '5m';
    if (timeframe === '15min') return '15m';
    if (timeframe === '1hr') return '1h';
    return '1d';
  }, [timeframe]);

  const { data: gexData, loading, error } = useApiData<GammaDataPoint[]>(
    `/api/gex/heatmap?symbol=${symbol}&timeframe=${timeframe}&window_units=${fetchWindowUnits}`,
    { refreshInterval: 5000 }
  );
  const { data: gexDataAlt, loading: loadingAlt, error: errorAlt } = useApiData<GammaDataPoint[]>(
    `/api/gex/heatmap?symbol=${symbol}&timeframe=${apiTimeframe}&window_units=${fetchWindowUnits}`,
    { refreshInterval: 5000, enabled: Boolean(error) }
  );

  const { data: priceDataRaw, error: priceError } = useApiData<PriceDataPoint[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${timeframe}&window_units=${fetchWindowUnits}`,
    { refreshInterval: 5000 }
  );
  const { data: priceDataAlt } = useApiData<PriceDataPoint[]>(
    `/api/market/historical?symbol=${symbol}&timeframe=${apiTimeframe}&window_units=${fetchWindowUnits}`,
    { refreshInterval: 5000, enabled: Boolean(priceError) }
  );
  const { data: gexHistoricalDataRaw } = useApiData<GexHistoricalPoint[]>(
    `/api/gex/historical?symbol=${symbol}&timeframe=${timeframe}&window_units=${fetchWindowUnits}`,
    { refreshInterval: 5000 }
  );
  const { data: gexHistoricalDataAlt } = useApiData<GexHistoricalPoint[]>(
    `/api/gex/historical?symbol=${symbol}&timeframe=${apiTimeframe}&window_units=${fetchWindowUnits}`,
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
    const rows = activeGexData.slice(-5000);
    if (rows.length === 0) return { cells: [], strikes: [] as number[], timestamps: [] as string[] };

    const sortedTimestamps = omitClosedMarketTimes(Array.from(new Set(rows.map((r) => r.timestamp))).sort(), (ts) => ts).slice(-maxPoints);
    const strikes = Array.from(new Set(rows.map((r) => Number(r.strike)))).sort((a, b) => b - a);
    const map = new Map(rows.map((r) => [`${r.timestamp}_${Number(r.strike)}`, Number(r.net_gex)]));

    const cells = sortedTimestamps.flatMap((ts, x) =>
      strikes.map((strike) => ({ x, y: strike, value: map.get(`${ts}_${strike}`) ?? 0 }))
    );

    return { cells, strikes, timestamps: sortedTimestamps };
  }, [activeGexData, maxPoints]);

  const gammaFlipByTs = useMemo(() => {
    const fromHeatmap = new Map<string, number[]>();
    activeGexData.forEach((row) => {
      if (row.gamma_flip == null || !Number.isFinite(Number(row.gamma_flip))) return;
      const key = row.timestamp;
      if (!fromHeatmap.has(key)) fromHeatmap.set(key, []);
      fromHeatmap.get(key)!.push(Number(row.gamma_flip));
    });
    const result = new Map<string, number>();
    fromHeatmap.forEach((vals, ts) => {
      const avg = vals.reduce((sum, v) => sum + v, 0) / Math.max(1, vals.length);
      result.set(ts, avg);
    });
    if (result.size === 0) {
      activeGexHistoricalData.forEach((row) => {
        if (row.gamma_flip == null || !Number.isFinite(Number(row.gamma_flip))) return;
        result.set(row.timestamp, Number(row.gamma_flip));
      });
    }
    return result;
  }, [activeGexData, activeGexHistoricalData]);

  if (effectiveLoading && derived.cells.length === 0) return <LoadingSpinner size="lg" />;
  if (effectiveError) return <ErrorMessage message={effectiveError} />;
  if (derived.cells.length === 0) return <div className="rounded-lg p-8 text-center" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}><p style={{ color: colors.muted }}>No heatmap data available</p></div>;

  const getColor = (value: number, maxAbsValue: number) => {
    if (maxAbsValue < 1e-9) return 'var(--color-surface-elevated)';
    const normalized = (value + maxAbsValue) / (2 * maxAbsValue);

    const bearishTone = { r: 58, g: 174, b: 216 }; // lagoonBlue
    const neutralTone = { r: 247, g: 245, b: 247 };
    const bullishTone = { r: 255, g: 179, b: 71 }; // sunGlow

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

  const chartWidth = 1200;
  const chartHeight = 620;
  const yAxisWidth = 64;
  const plotLeft = 64;
  const plotTop = 42;
  const plotWidth = chartWidth - yAxisWidth - 12;
  const plotHeight = chartHeight - 76;
  const cellWidth = plotWidth / Math.max(1, derived.timestamps.length);

  const priceRows = omitClosedMarketTimes(activePriceData, (p) => p.timestamp);
  const priceByTs = new Map(priceRows.map((p) => [p.timestamp, p]));
  const minStrike = Math.min(...derived.strikes);
  const maxStrike = Math.max(...derived.strikes);
  const priceLow = Math.min(...priceRows.map((p) => Number(p.low ?? p.close ?? p.open ?? Infinity)));
  const priceHigh = Math.max(...priceRows.map((p) => Number(p.high ?? p.close ?? p.open ?? -Infinity)));
  const hasPriceRange = Number.isFinite(priceLow) && Number.isFinite(priceHigh);
  const combinedMinRaw = Math.min(minStrike, hasPriceRange ? priceLow : minStrike);
  const combinedMaxRaw = Math.max(maxStrike, hasPriceRange ? priceHigh : maxStrike);
  const combinedSpan = Math.max(1e-9, combinedMaxRaw - combinedMinRaw);
  const combinedPadding = combinedSpan * 0.03;
  const combinedMin = combinedMinRaw - combinedPadding;
  const combinedMax = combinedMaxRaw + combinedPadding;
  const topLevel = Math.ceil(combinedMax);
  const bottomLevel = Math.floor(combinedMin);
  const yLevels = Array.from({ length: Math.max(1, topLevel - bottomLevel + 1) }, (_, i) => topLevel - i);
  const yLabelStep = Math.max(1, Math.ceil(yLevels.length / 16));

  const cellValueMap = new Map<string, number>();
  derived.cells.forEach((cell) => {
    const ts = derived.timestamps[cell.x];
    if (!ts) return;
    cellValueMap.set(`${ts}_${Number(cell.y).toFixed(2)}`, Number(cell.value || 0));
  });

  const filledCells = derived.timestamps.flatMap((ts, x) =>
    yLevels.map((level) => ({
      x,
      y: level,
      value: cellValueMap.get(`${ts}_${Number(level).toFixed(2)}`) ?? 0,
    })),
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
      const value = gammaFlipByTs.get(ts);
      if (value == null || !Number.isFinite(value)) return null;
      return {
        idx,
        ts,
        x: idx * cellWidth + plotLeft + cellWidth / 2,
        y: yForValue(value),
        value,
      };
    })
    .filter((p): p is { idx: number; ts: string; x: number; y: number; value: number } => p !== null);

  const gammaFlipPath = gammaFlipPoints
    .map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');

  const hoveredIndex = hoveredIdx ?? (derived.timestamps.length - 1);
  const hoveredTs = derived.timestamps[Math.max(0, Math.min(derived.timestamps.length - 1, hoveredIndex))];
  const hoveredPrice = hoveredTs ? priceByTs.get(hoveredTs) : undefined;
  const hoveredGammaFlip = hoveredTs ? gammaFlipByTs.get(hoveredTs) : undefined;
  const hoveredStrikeValue = (() => {
    if (!hoveredTs) return null;
    const cell = filledCells.find((c) => c.x === hoveredIndex);
    if (!cell) return null;
    return { strike: cell.y, value: cell.value };
  })();

  const tooltipValueColor = theme === 'dark' ? colors.light : colors.dark;
  const axisColor = theme === 'dark' ? 'var(--color-text-primary)' : 'var(--color-text-primary)';

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight, border: `1px solid ${colors.muted}` }}>
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <h3 className="text-xl font-bold" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>GEX Time Series Heatmap</h3>
          <TooltipWrapper text="Time-series heatmap of net GEX by strike over time, with overlaid underlying candles to show how price moved relative to evolving gamma concentration zones."><Info size={14} /></TooltipWrapper>
        </div>

        <ChartTimeframeSelect value={timeframe} onChange={setTimeframe} className="px-4 pt-1 pb-2 flex justify-end" />

        <div className="overflow-x-auto relative">
        {hoveredTs && (
          <div className="absolute right-4 top-3 z-10 rounded-md px-3 py-2 text-xs shadow-lg pointer-events-none" style={{ backgroundColor: theme === 'dark' ? 'var(--color-surface)' : 'var(--color-surface)', border: `1px solid ${theme === 'dark' ? 'var(--color-surface)' : 'var(--color-border)'}`, color: tooltipValueColor }}>
            <div className="font-semibold">{new Date(hoveredTs).toLocaleString()}</div>
            {hoveredPrice && (
              <div>Underlying O:{Number(hoveredPrice.open ?? hoveredPrice.close ?? 0).toFixed(2)} H:{Number(hoveredPrice.high ?? hoveredPrice.close ?? 0).toFixed(2)} L:{Number(hoveredPrice.low ?? hoveredPrice.close ?? 0).toFixed(2)} C:{Number(hoveredPrice.close ?? hoveredPrice.open ?? 0).toFixed(2)}</div>
            )}
            {hoveredStrikeValue && (
              <div>Heatmap Net GEX (strike ${hoveredStrikeValue.strike.toFixed(0)}): {(hoveredStrikeValue.value / 1_000_000).toFixed(2)}M</div>
            )}
            {hoveredGammaFlip != null && (
              <div>Gamma Flip: ${hoveredGammaFlip.toFixed(2)}</div>
            )}
          </div>
        )}
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
          className="block min-w-[760px] md:min-w-0"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const xPx = e.clientX - rect.left;
            const xView = (xPx / Math.max(1, rect.width)) * chartWidth;
            const idx = Math.round((xView - plotLeft) / Math.max(1e-9, cellWidth));
            setHoveredIdx(Math.max(0, Math.min(derived.timestamps.length - 1, idx)));
          }}
          onMouseLeave={() => setHoveredIdx(null)}
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
            <line x1={plotLeft + 290} x2={plotLeft + 310} y1={20} y2={20} stroke="#1D3557" strokeWidth={2.25} />
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

          {gammaFlipPath && (
            <g clipPath="url(#heatmapClip)">
              <path d={gammaFlipPath} fill="none" stroke="#1D3557" strokeWidth={2.25} />
              {hoveredIdx != null && gammaFlipPoints
                .filter((p) => p.idx === hoveredIdx)
                .map((p) => (
                  <circle key={`gamma-flip-dot-${p.ts}`} cx={p.x} cy={p.y} r={3.5} fill="#1D3557" />
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
