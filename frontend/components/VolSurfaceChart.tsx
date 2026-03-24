'use client';

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useVolSurface } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';

type Tab = 'surface' | 'term' | 'skew';

export default function VolSurfaceChart() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;
  const cardBg = isDark ? colors.cardDark : colors.cardLight;
  const axisStroke = isDark ? '#f2f2f2' : '#374151';
  const gridStroke = isDark ? '#968f92' : '#d1d5db';
  const mutedText = isDark ? '#9ca3af' : '#6b7280';

  const [activeTab, setActiveTab] = useState<Tab>('surface');
  const { data, loading, error, refetch } = useVolSurface(symbol);

  const surfaceGrid = useMemo(() => {
    if (!data?.surface?.length) return { cells: [], strikes: [], expirations: [] };

    const strikes = data.strikes;
    const expirations = data.surface.map((s) => ({ label: s.expiration, dte: s.dte }));

    const ivMap = new Map<string, number>();
    data.surface.forEach((slice) => {
      slice.ivs.forEach((iv) => {
        const callIv = iv.call_iv ?? 0;
        const putIv = iv.put_iv ?? 0;
        const avg = callIv && putIv ? (callIv + putIv) / 2 : callIv || putIv;
        if (avg > 0) ivMap.set(`${slice.dte}_${iv.strike}`, avg);
      });
    });

    const cells: { x: number; y: number; iv: number; strike: number; dte: number; expLabel: string }[] = [];
    expirations.forEach((exp, xi) => {
      strikes.forEach((strike, yi) => {
        const iv = ivMap.get(`${exp.dte}_${strike}`) ?? 0;
        cells.push({ x: xi, y: yi, iv, strike, dte: exp.dte, expLabel: exp.label });
      });
    });

    return { cells, strikes, expirations };
  }, [data]);

  const termData = useMemo(() => {
    if (!data?.atm_term_structure?.length) return [];
    return data.atm_term_structure
      .filter((p) => p.atm_iv != null)
      .map((p) => ({ dte: p.dte, iv: Number(((p.atm_iv ?? 0) * 100).toFixed(1)) }));
  }, [data]);

  const skewData = useMemo(() => {
    if (!data?.skew_25d?.length) return [];
    return data.skew_25d
      .filter((p) => p.skew != null)
      .map((p) => ({ dte: p.dte, skew: Number(((p.skew ?? 0) * 100).toFixed(2)) }));
  }, [data]);

  if (loading && !data) return <LoadingSpinner size="lg" />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'surface', label: 'IV Surface' },
    { key: 'term', label: 'ATM Term Structure' },
    { key: 'skew', label: '25Δ Skew' },
  ];

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart">
      <div className="rounded-lg overflow-hidden p-4" style={{ backgroundColor: cardBg }}>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-xl font-bold" style={{ color: textColor }}>
            Vol Surface
          </h3>
          <TooltipWrapper text="Implied volatility surface from /api/vol-surface. Shows IV across strikes and expirations, ATM term structure, and 25-delta put-call skew.">
            <Info size={14} />
          </TooltipWrapper>
        </div>

        <div className="flex gap-2 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-cyan-900 border-cyan-400 text-cyan-100 border'
                  : ''
              }`}
              style={
                activeTab !== tab.key
                  ? { backgroundColor: isDark ? '#2a2628' : '#f3f4f6', color: mutedText }
                  : undefined
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'surface' && <SurfaceHeatmap grid={surfaceGrid} spotPrice={data.spot_price} isDark={isDark} textColor={textColor} />}

        {activeTab === 'term' && (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={termData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
              <XAxis
                dataKey="dte"
                stroke={axisStroke}
                tick={{ fontSize: 11, fill: axisStroke }}
                label={{ value: 'Days to Expiration', position: 'insideBottom', offset: -10, fill: mutedText, fontSize: 11 }}
              />
              <YAxis
                stroke={axisStroke}
                tick={{ fontSize: 11, fill: axisStroke }}
                tickFormatter={(v) => `${v}%`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: isDark ? '#1f1d1e' : '#fff', borderColor: isDark ? '#423d3f' : '#d1d5db', borderRadius: 6 }}
                labelStyle={{ color: textColor }}
                formatter={(value) => `${Number(value)}%`}
                labelFormatter={(dte) => `${dte} DTE`}
              />
              <Line type="monotone" dataKey="iv" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} name="ATM IV" />
            </LineChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'skew' && (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={skewData} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
              <XAxis
                dataKey="dte"
                stroke={axisStroke}
                tick={{ fontSize: 11, fill: axisStroke }}
                label={{ value: 'Days to Expiration', position: 'insideBottom', offset: -10, fill: mutedText, fontSize: 11 }}
              />
              <YAxis
                stroke={axisStroke}
                tick={{ fontSize: 11, fill: axisStroke }}
                tickFormatter={(v) => `${v}%`}
                domain={['auto', 'auto']}
              />
              <Tooltip
                contentStyle={{ backgroundColor: isDark ? '#1f1d1e' : '#fff', borderColor: isDark ? '#423d3f' : '#d1d5db', borderRadius: 6 }}
                labelStyle={{ color: textColor }}
                formatter={(value) => `${Number(value)}%`}
                labelFormatter={(dte) => `${dte} DTE`}
              />
              <Line type="monotone" dataKey="skew" stroke="#60a5fa" strokeWidth={2} dot={{ r: 3, fill: '#60a5fa' }} name="25Δ Skew" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </ExpandableCard>
  );
}

function SurfaceHeatmap({
  grid,
  spotPrice,
  isDark,
  textColor,
}: {
  grid: {
    cells: { x: number; y: number; iv: number; strike: number; dte: number; expLabel: string }[];
    strikes: number[];
    expirations: { label: string; dte: number }[];
  };
  spotPrice: number;
  isDark: boolean;
  textColor: string;
}) {
  const { cells, strikes, expirations } = grid;

  if (cells.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>
        No vol surface data available
      </div>
    );
  }

  const ivValues = cells.map((c) => c.iv).filter((v) => v > 0);
  const minIv = Math.min(...ivValues);
  const maxIv = Math.max(...ivValues);

  const getColor = (iv: number) => {
    if (iv <= 0 || maxIv <= minIv) return isDark ? '#2a2628' : '#f3f4f6';
    const t = (iv - minIv) / (maxIv - minIv);

    // Cool (low IV) → Warm (high IV): deep blue → cyan → green → yellow → orange → red
    const stops = [
      { t: 0.0, r: 29, g: 78, b: 216 },
      { t: 0.2, r: 6, g: 182, b: 212 },
      { t: 0.4, r: 16, g: 185, b: 129 },
      { t: 0.6, r: 250, g: 204, b: 21 },
      { t: 0.8, r: 251, g: 146, b: 60 },
      { t: 1.0, r: 244, g: 88, b: 84 },
    ];

    let low = stops[0], high = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].t && t <= stops[i + 1].t) {
        low = stops[i];
        high = stops[i + 1];
        break;
      }
    }

    const segT = (t - low.t) / Math.max(1e-9, high.t - low.t);
    const r = Math.round(low.r + (high.r - low.r) * segT);
    const g = Math.round(low.g + (high.g - low.g) * segT);
    const b = Math.round(low.b + (high.b - low.b) * segT);
    return `rgb(${r}, ${g}, ${b})`;
  };

  const chartWidth = 1200;
  const chartHeight = 500;
  const plotLeft = 70;
  const plotTop = 10;
  const plotRight = 20;
  const plotBottom = 60;
  const plotWidth = chartWidth - plotLeft - plotRight;
  const plotHeight = chartHeight - plotTop - plotBottom;

  const cellWidth = plotWidth / Math.max(1, expirations.length);
  const cellHeight = plotHeight / Math.max(1, strikes.length);

  const labelStepX = Math.max(1, Math.ceil(expirations.length / 15));
  const labelStepY = Math.max(1, Math.ceil(strikes.length / 18));

  // Find the closest strike index to spot
  const spotIdx = strikes.reduce(
    (best, s, i) => (Math.abs(s - spotPrice) < Math.abs(strikes[best] - spotPrice) ? i : best),
    0,
  );
  const spotY = plotTop + spotIdx * cellHeight + cellHeight / 2;

  return (
    <div className="relative">
      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        className="block"
      >
        {/* Legend gradient */}
        <defs>
          <linearGradient id="ivScale" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={getColor(minIv)} />
            <stop offset="25%" stopColor={getColor(minIv + (maxIv - minIv) * 0.25)} />
            <stop offset="50%" stopColor={getColor(minIv + (maxIv - minIv) * 0.5)} />
            <stop offset="75%" stopColor={getColor(minIv + (maxIv - minIv) * 0.75)} />
            <stop offset="100%" stopColor={getColor(maxIv)} />
          </linearGradient>
        </defs>

        {/* Heatmap cells */}
        {cells.map((cell, idx) => (
          <rect
            key={idx}
            x={plotLeft + cell.x * cellWidth}
            y={plotTop + cell.y * cellHeight}
            width={cellWidth + 0.5}
            height={cellHeight + 0.5}
            fill={getColor(cell.iv)}
          >
            <title>
              {`Strike: $${cell.strike} | ${cell.expLabel} (${cell.dte}d) | IV: ${(cell.iv * 100).toFixed(1)}%`}
            </title>
          </rect>
        ))}

        {/* Spot price line */}
        <line
          x1={plotLeft}
          x2={plotLeft + plotWidth}
          y1={spotY}
          y2={spotY}
          stroke="#60a5fa"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
        <text
          x={plotLeft + plotWidth + 2}
          y={spotY}
          dominantBaseline="middle"
          style={{ fontSize: '10px', fill: '#60a5fa', fontFamily: 'monospace' }}
        >
          Spot
        </text>

        {/* Y-axis (strikes) - top = high strike, bottom = low strike */}
        {strikes.map((strike, idx) => {
          if (idx % labelStepY !== 0) return null;
          return (
            <text
              key={`y-${strike}`}
              x={plotLeft - 6}
              y={plotTop + idx * cellHeight + cellHeight / 2}
              textAnchor="end"
              dominantBaseline="middle"
              style={{ fontSize: '10px', fill: textColor, fontFamily: 'monospace' }}
            >
              ${strike.toFixed(0)}
            </text>
          );
        })}

        {/* X-axis (expirations) */}
        {expirations.map((exp, idx) => {
          if (idx % labelStepX !== 0) return null;
          const shortDate = exp.label.slice(5); // MM-DD
          return (
            <text
              key={`x-${exp.label}`}
              x={plotLeft + idx * cellWidth + cellWidth / 2}
              y={chartHeight - plotBottom + 16}
              textAnchor="middle"
              style={{ fontSize: '10px', fill: textColor, fontFamily: 'monospace' }}
            >
              {shortDate}
            </text>
          );
        })}
        {expirations.map((exp, idx) => {
          if (idx % labelStepX !== 0) return null;
          return (
            <text
              key={`xd-${exp.label}`}
              x={plotLeft + idx * cellWidth + cellWidth / 2}
              y={chartHeight - plotBottom + 30}
              textAnchor="middle"
              style={{ fontSize: '9px', fill: isDark ? '#9ca3af' : '#6b7280', fontFamily: 'monospace' }}
            >
              {exp.dte}d
            </text>
          );
        })}

        {/* Color legend */}
        <rect x={plotLeft} y={chartHeight - 16} width={200} height={10} fill="url(#ivScale)" rx="2" />
        <text x={plotLeft} y={chartHeight - 2} fontSize="9" fill={textColor}>
          {(minIv * 100).toFixed(0)}%
        </text>
        <text x={plotLeft + 100} y={chartHeight - 2} textAnchor="middle" fontSize="9" fill={textColor}>
          IV
        </text>
        <text x={plotLeft + 200} y={chartHeight - 2} textAnchor="end" fontSize="9" fill={textColor}>
          {(maxIv * 100).toFixed(0)}%
        </text>
      </svg>
    </div>
  );
}
