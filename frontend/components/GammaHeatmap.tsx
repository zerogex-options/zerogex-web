'use client';

import { useEffect, useState } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface GammaDataPoint {
  timestamp: string;
  strike: number;
  net_gex: number;
}

interface HeatmapCell {
  x: number; // time index
  y: number; // strike
  value: number; // gex value
  timestamp: string;
}

export default function GammaHeatmap() {
  const { theme } = useTheme();
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [strikes, setStrikes] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  
  // Fetch GEX by strike with historical data
  const { data: gexData, loading, error } = useApiData<GammaDataPoint[]>(
    '/api/gex/heatmap?window_minutes=60&interval_minutes=5',
    { refreshInterval: 5000 }
  );

  useEffect(() => {
    if (!gexData || gexData.length === 0) return;

    // Extract unique strikes and timestamps
    const uniqueStrikes = Array.from(new Set(gexData.map(d => d.strike))).sort((a, b) => b - a);
    const uniqueTimestamps = Array.from(new Set(gexData.map(d => d.timestamp))).sort();

    // Build heatmap cells
    const cells: HeatmapCell[] = [];
    uniqueTimestamps.forEach((timestamp, xIdx) => {
      uniqueStrikes.forEach((strike, yIdx) => {
        const dataPoint = gexData.find(d => d.timestamp === timestamp && d.strike === strike);
        cells.push({
          x: xIdx,
          y: strike,
          value: dataPoint?.net_gex || 0,
          timestamp,
        });
      });
    });

    setHeatmapData(cells);
    setStrikes(uniqueStrikes);
    setTimestamps(uniqueTimestamps);
  }, [gexData]);

  if (loading && heatmapData.length === 0) {
    return <LoadingSpinner size="lg" />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (heatmapData.length === 0) {
    return (
      <div 
        className="rounded-lg p-8 text-center"
        style={{
          backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <p style={{ color: colors.muted }}>No heatmap data available</p>
      </div>
    );
  }

  // Calculate min/max for color scaling
  const values = heatmapData.map(d => d.value);
  const maxVal = Math.max(...values);
  const minVal = Math.min(...values);
  const absMax = Math.max(Math.abs(maxVal), Math.abs(minVal));

  // Color function: red for negative, green for positive
  const getColor = (value: number) => {
    const normalized = value / absMax;
    if (normalized > 0) {
      // Positive (bullish) - shades of green
      return `rgba(16, 185, 129, ${normalized})`;
    } else {
      // Negative (bearish) - shades of red
      return `rgba(244, 88, 84, ${Math.abs(normalized)})`;
    }
  };

  // Calculate cell dimensions
  const cellWidth = 40;
  const cellHeight = 30;
  const chartWidth = timestamps.length * cellWidth + 80;
  const chartHeight = strikes.length * cellHeight + 60;

  return (
    <div 
      className="rounded-lg p-6"
      style={{
        backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
        border: `1px solid ${colors.muted}`,
      }}
    >
      <h3 
        className="text-xl font-bold mb-4"
        style={{ color: theme === 'dark' ? colors.light : colors.dark }}
      >
        Gamma Exposure Heatmap
      </h3>

      <div style={{ overflowX: 'auto' }}>
        <svg width={chartWidth} height={chartHeight}>
          {/* Y-axis labels (strikes) */}
          {strikes.map((strike, idx) => (
            <text
              key={`y-${strike}`}
              x={70}
              y={idx * cellHeight + cellHeight / 2 + 40}
              textAnchor="end"
              dominantBaseline="middle"
              style={{
                fontSize: '11px',
                fill: theme === 'dark' ? colors.light : colors.dark,
                fontFamily: 'monospace',
              }}
            >
              ${strike.toFixed(0)}
            </text>
          ))}

          {/* Heatmap cells */}
          {heatmapData.map((cell, idx) => {
            const xPos = cell.x * cellWidth + 80;
            const yPos = strikes.indexOf(cell.y) * cellHeight + 40;
            
            return (
              <g key={idx}>
                <rect
                  x={xPos}
                  y={yPos}
                  width={cellWidth - 1}
                  height={cellHeight - 1}
                  fill={getColor(cell.value)}
                  stroke={colors.muted}
                  strokeWidth={0.5}
                >
                  <title>{`Strike: $${cell.y}\nTime: ${new Date(cell.timestamp).toLocaleTimeString()}\nGEX: $${(cell.value / 1000000).toFixed(2)}M`}</title>
                </rect>
              </g>
            );
          })}

          {/* X-axis labels (timestamps) */}
          {timestamps.map((timestamp, idx) => {
            if (idx % 3 !== 0) return null; // Show every 3rd label to avoid crowding
            const time = new Date(timestamp).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: false 
            });
            return (
              <text
                key={`x-${timestamp}`}
                x={idx * cellWidth + 80 + cellWidth / 2}
                y={chartHeight - 20}
                textAnchor="middle"
                style={{
                  fontSize: '10px',
                  fill: theme === 'dark' ? colors.light : colors.dark,
                  fontFamily: 'monospace',
                }}
              >
                {time}
              </text>
            );
          })}

          {/* Axis labels */}
          <text
            x={40}
            y={20}
            textAnchor="middle"
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              fill: theme === 'dark' ? colors.light : colors.dark,
            }}
          >
            Strike
          </text>
          <text
            x={chartWidth / 2}
            y={chartHeight - 5}
            textAnchor="middle"
            style={{
              fontSize: '12px',
              fontWeight: 'bold',
              fill: theme === 'dark' ? colors.light : colors.dark,
            }}
          >
            Time
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div style={{ 
            width: '20px', 
            height: '20px', 
            backgroundColor: colors.bearish,
            border: `1px solid ${colors.muted}`,
            borderRadius: '4px',
          }} />
          <span style={{ fontSize: '12px', color: colors.muted }}>
            Negative GEX (Dealer Long Gamma)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div style={{ 
            width: '20px', 
            height: '20px', 
            backgroundColor: colors.bullish,
            border: `1px solid ${colors.muted}`,
            borderRadius: '4px',
          }} />
          <span style={{ fontSize: '12px', color: colors.muted }}>
            Positive GEX (Dealer Short Gamma)
          </span>
        </div>
      </div>

      {/* Data timestamp */}
      <div className="text-right text-xs mt-4" style={{ color: colors.muted }}>
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}
