'use client';

import { useEffect, useState, useRef } from 'react';
import { useApiData } from '@/hooks/useApiData';
import { useTheme } from '@/core/ThemeContext';
import { useTimeframe } from '@/core/TimeframeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface GammaDataPoint {
  timestamp: string;
  strike: number;
  net_gex: number;
}

interface PriceDataPoint {
  timestamp: string;
  price: number;
}

interface HeatmapCell {
  x: number; // time index
  y: number; // strike
  value: number; // gex value
  timestamp: string;
}

// Aggregate price data into time buckets
function aggregatePriceData(data: PriceDataPoint[], bucketMinutes: number, maxPoints: number): PriceDataPoint[] {
  if (data.length === 0) return [];
  
  const sorted = [...data].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  const buckets = new Map<string, PriceDataPoint[]>();
  
  sorted.forEach(point => {
    const timestamp = new Date(point.timestamp);
    const bucketTime = new Date(
      Math.floor(timestamp.getTime() / (bucketMinutes * 60000)) * (bucketMinutes * 60000)
    );
    const bucketKey = bucketTime.toISOString();
    
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, []);
    }
    buckets.get(bucketKey)!.push(point);
  });
  
  const aggregated: PriceDataPoint[] = [];
  buckets.forEach((points, timestamp) => {
    const avgPrice = points.reduce((sum, p) => sum + p.price, 0) / points.length;
    
    aggregated.push({
      timestamp,
      price: avgPrice,
    });
  });
  
  return aggregated
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .slice(-maxPoints);
}

export default function GammaHeatmap() {
  const { theme } = useTheme();
  const { getIntervalMinutes, getWindowMinutes, getMaxDataPoints } = useTimeframe();
  const containerRef = useRef<HTMLDivElement>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [strikes, setStrikes] = useState<number[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [containerWidth, setContainerWidth] = useState(1200);
  
  const intervalMinutes = getIntervalMinutes();
  const windowMinutes = getWindowMinutes();
  const maxPoints = getMaxDataPoints();

  // Fetch price data first - this will dictate our timestamps
  const { data: priceData } = useApiData<PriceDataPoint[]>(
    `/api/price/timeseries?window_minutes=${windowMinutes}&interval_minutes=1`,
    { refreshInterval: 5000 }
  );

  // Fetch GEX by strike with historical data
  const { data: gexData, loading, error } = useApiData<GammaDataPoint[]>(
    `/api/gex/heatmap?window_minutes=${windowMinutes}&interval_minutes=1`,
    { refreshInterval: 5000 }
  );

  // Measure container width
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!gexData || gexData.length === 0 || !priceData || priceData.length === 0) return;

    // Aggregate price data based on timeframe
    const aggregatedPriceData = aggregatePriceData(priceData, intervalMinutes, maxPoints);
    
    // Use ONLY the timestamps that have price data (this omits market closed periods)
    const validTimestamps = aggregatedPriceData.map(p => p.timestamp).sort();

    // Filter GEX data to only include timestamps that have price data
    const filteredGexData = gexData.filter(g => {
      const gexTime = new Date(g.timestamp).getTime();
      // Find if there's a price timestamp within the bucket window
      return validTimestamps.some(pt => {
        const priceTime = new Date(pt).getTime();
        return Math.abs(gexTime - priceTime) < intervalMinutes * 60000;
      });
    });

    // Aggregate GEX data into buckets matching price timestamps
    const gexBuckets = new Map<string, GammaDataPoint[]>();
    
    filteredGexData.forEach(point => {
      const timestamp = new Date(point.timestamp);
      const bucketTime = new Date(
        Math.floor(timestamp.getTime() / (intervalMinutes * 60000)) * (intervalMinutes * 60000)
      );
      const bucketKey = `${bucketTime.toISOString()}_${point.strike}`;
      
      if (!gexBuckets.has(bucketKey)) {
        gexBuckets.set(bucketKey, []);
      }
      gexBuckets.get(bucketKey)!.push(point);
    });
    
    // Average each bucket
    const aggregatedGex: GammaDataPoint[] = [];
    gexBuckets.forEach((points, key) => {
      const [timestamp, strike] = key.split('_');
      const avgGex = points.reduce((sum, p) => sum + p.net_gex, 0) / points.length;
      
      aggregatedGex.push({
        timestamp,
        strike: parseFloat(strike),
        net_gex: avgGex,
      });
    });

    // Extract unique strikes and use validTimestamps
    const uniqueStrikes = Array.from(new Set(aggregatedGex.map(d => d.strike))).sort((a, b) => b - a);

    // Build heatmap cells - only for valid timestamps
    const cells: HeatmapCell[] = [];
    validTimestamps.forEach((timestamp, xIdx) => {
      uniqueStrikes.forEach((strike, yIdx) => {
        // Match with some tolerance for timestamp differences
        const dataPoint = aggregatedGex.find(d => {
          const timeDiff = Math.abs(new Date(d.timestamp).getTime() - new Date(timestamp).getTime());
          return timeDiff < intervalMinutes * 60000 && d.strike === strike;
        });
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
    setTimestamps(validTimestamps);
  }, [gexData, priceData, intervalMinutes, maxPoints]);

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

  // Color function: red for negative, green for positive with enhanced lower end visibility
  const getColor = (value: number) => {
    const normalized = value / absMax;
    
    if (normalized > 0) {
      // Positive (bullish) - shades of green
      // Use power curve to make lower values more visible
      const intensity = Math.pow(Math.abs(normalized), 0.5); // Square root for more vivid low values
      const minOpacity = 0.3; // Ensure even small values are visible
      const opacity = minOpacity + (1 - minOpacity) * intensity;
      return `rgba(16, 185, 129, ${opacity})`;
    } else {
      // Negative (bearish) - shades of red
      // Use power curve to make lower values more visible
      const intensity = Math.pow(Math.abs(normalized), 0.5); // Square root for more vivid low values
      const minOpacity = 0.3; // Ensure even small values are visible
      const opacity = minOpacity + (1 - minOpacity) * intensity;
      return `rgba(244, 88, 84, ${opacity})`;
    }
  };

  // FIXED chart dimensions - calculate based on available width and number of data points
  const yAxisWidth = 80;
  const availableWidth = containerWidth - yAxisWidth - 40;
  const cellWidth = Math.max(20, Math.floor(availableWidth / Math.min(timestamps.length, maxPoints)));
  const cellHeight = 30;
  const numStrikes = strikes.length;
  
  // Chart dimensions stay constant
  const chartWidth = Math.min(timestamps.length, maxPoints) * cellWidth + yAxisWidth + 40;
  const chartHeight = numStrikes * cellHeight + 80;

  // Aggregate price data for overlay
  const aggregatedPriceData = priceData ? aggregatePriceData(priceData, intervalMinutes, maxPoints) : [];

  return (
    <div 
      ref={containerRef}
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

      <div style={{ width: '100%' }}>
        <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
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
                  width={cellWidth}
                  height={cellHeight}
                  fill={getColor(cell.value)}
                  stroke="none"
                >
                  <title>{`Strike: $${cell.y}\nTime: ${new Date(cell.timestamp).toLocaleTimeString()}\nGEX: $${(cell.value / 1000000).toFixed(2)}M`}</title>
                </rect>
              </g>
            );
          })}

          {/* Price line overlay */}
          {aggregatedPriceData.length > 0 && strikes.length > 0 && (() => {
            // Build a lookup map with normalized timestamps
            const priceByTime = new Map();
            aggregatedPriceData.forEach(p => {
              priceByTime.set(p.timestamp, p.price);
              // Also store without timezone for matching
              const normalized = p.timestamp.replace(/\+00:00$/, '').replace(/Z$/, '');
              priceByTime.set(normalized, p.price);
            });
            
            // Map each heatmap timestamp to price
            const pricePoints = timestamps.map((ts, idx) => {
              // Try exact match first
              let price = priceByTime.get(ts);
              
              // Try without timezone suffix
              if (!price) {
                const tsWithoutTZ = ts.replace(/\+00:00$/, '').replace(/Z$/, '');
                price = priceByTime.get(tsWithoutTZ);
              }
              
              // If still no match, find closest by time
              if (!price) {
                const tsTime = new Date(ts).getTime();
                let closestDiff = Infinity;
                let closestPrice = null;
                
                aggregatedPriceData.forEach(p => {
                  const pTime = new Date(p.timestamp).getTime();
                  const diff = Math.abs(pTime - tsTime);
                  if (diff < closestDiff && diff < 300000) { // Within 5 minutes
                    closestDiff = diff;
                    closestPrice = p.price;
                  }
                });
                
                price = closestPrice;
              }
              
              if (!price) return null;
              
              const x = idx * cellWidth + 80 + cellWidth / 2;
              
              // Interpolate Y position based on strike range
              const minStrike = Math.min(...strikes);
              const maxStrike = Math.max(...strikes);
              const priceNormalized = (price - minStrike) / (maxStrike - minStrike);
              const y = 40 + (strikes.length * cellHeight) * (1 - priceNormalized);
              
              return { x, y, price, timestamp: ts };
            }).filter(p => p !== null);

            if (pricePoints.length === 0) return null;

            const pathData = pricePoints.map((p, i) => 
              `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
            ).join(' ');

            return (
              <g>
                <path
                  d={pathData}
                  fill="none"
                  stroke={colors.primary}
                  strokeWidth={3}
                  opacity={1}
                />
                {pricePoints.map((p, i) => (
                  <circle
                    key={`price-${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={0}
                    fill={colors.primary}
                    stroke="none"
                  >
                    <title>Price: ${p.price.toFixed(2)}</title>
                  </circle>
                ))}
              </g>
            );
          })()}

          {/* X-axis labels (timestamps) */}
          {timestamps.map((timestamp, idx) => {
            // Dynamically decide how many labels to show based on cellWidth
            const labelSpacing = cellWidth < 30 ? 6 : cellWidth < 40 ? 4 : 3;
            if (idx % labelSpacing !== 0) return null;
            
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
      <div className="flex items-center justify-center gap-6 mt-4 flex-wrap">
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
        <div className="flex items-center gap-2">
          <div style={{ 
            width: '30px', 
            height: '3px', 
            backgroundColor: colors.primary,
            borderRadius: '2px',
          }} />
          <span style={{ fontSize: '12px', color: colors.muted }}>
            Underlying Price
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
