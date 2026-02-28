'use client';

import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

interface FlowDataPoint {
  timestamp: string;
  call_notional: number;
  put_notional: number;
}

interface ChartDataPoint {
  time: string;
  calls: number;
  puts: number;
}

export default function OptionsFlowChart() {
  const { theme } = useTheme();
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  // Fetch flow data
  const { data: flowData, loading, error } = useApiData<FlowDataPoint[]>(
    '/api/flow/timeseries?window_minutes=60&interval_minutes=5',
    { refreshInterval: 5000 }
  );

  useEffect(() => {
    if (!flowData || flowData.length === 0) return;

    const formatted = flowData.map(d => ({
      time: new Date(d.timestamp).toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }),
      calls: d.call_notional / 1000000, // Convert to millions
      puts: d.put_notional / 1000000,
    }));

    setChartData(formatted);
  }, [flowData]);

  if (loading && chartData.length === 0) {
    return <LoadingSpinner size="lg" />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  if (chartData.length === 0) {
    return (
      <div 
        className="rounded-lg p-8 text-center"
        style={{
          backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
        <p style={{ color: colors.muted }}>No flow data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div 
          className="p-3 rounded-lg shadow-lg"
          style={{
            backgroundColor: theme === 'dark' ? colors.cardDark : colors.cardLight,
            border: `1px solid ${colors.muted}`,
          }}
        >
          <p className="font-semibold mb-2" style={{ color: theme === 'dark' ? colors.light : colors.dark }}>
            {label}
          </p>
          <p style={{ color: colors.bullish, fontSize: '14px' }}>
            Calls: ${payload[0].value.toFixed(2)}M
          </p>
          <p style={{ color: colors.bearish, fontSize: '14px' }}>
            Puts: ${payload[1].value.toFixed(2)}M
          </p>
          <p style={{ color: theme === 'dark' ? colors.light : colors.dark, fontSize: '12px', marginTop: '4px' }}>
            Net: ${(payload[0].value - payload[1].value).toFixed(2)}M
          </p>
        </div>
      );
    }
    return null;
  };

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
        Options Flow - Notional Premium
      </h3>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke={colors.muted}
            opacity={0.3}
          />
          <XAxis 
            dataKey="time" 
            stroke={theme === 'dark' ? colors.light : colors.dark}
            style={{ fontSize: '12px' }}
            tick={{ fill: theme === 'dark' ? colors.light : colors.dark }}
          />
          <YAxis 
            stroke={theme === 'dark' ? colors.light : colors.dark}
            style={{ fontSize: '12px' }}
            tick={{ fill: theme === 'dark' ? colors.light : colors.dark }}
            label={{ 
              value: 'Premium ($M)', 
              angle: -90, 
              position: 'insideLeft',
              style: { fill: theme === 'dark' ? colors.light : colors.dark }
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend 
            wrapperStyle={{ 
              paddingTop: '20px',
              color: theme === 'dark' ? colors.light : colors.dark 
            }}
          />
          <Line 
            type="monotone" 
            dataKey="calls" 
            name="Call Premium"
            stroke={colors.bullish} 
            strokeWidth={3}
            dot={{ fill: colors.bullish, r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="puts" 
            name="Put Premium"
            stroke={colors.bearish} 
            strokeWidth={3}
            dot={{ fill: colors.bearish, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="text-center">
          <div style={{ color: colors.muted, fontSize: '12px', marginBottom: '4px' }}>
            Total Call Premium
          </div>
          <div style={{ color: colors.bullish, fontSize: '20px', fontWeight: 'bold' }}>
            ${chartData.reduce((sum, d) => sum + d.calls, 0).toFixed(2)}M
          </div>
        </div>
        <div className="text-center">
          <div style={{ color: colors.muted, fontSize: '12px', marginBottom: '4px' }}>
            Total Put Premium
          </div>
          <div style={{ color: colors.bearish, fontSize: '20px', fontWeight: 'bold' }}>
            ${chartData.reduce((sum, d) => sum + d.puts, 0).toFixed(2)}M
          </div>
        </div>
        <div className="text-center">
          <div style={{ color: colors.muted, fontSize: '12px', marginBottom: '4px' }}>
            Net Flow
          </div>
          <div style={{ 
            color: chartData.reduce((sum, d) => sum + (d.calls - d.puts), 0) > 0 ? colors.bullish : colors.bearish,
            fontSize: '20px', 
            fontWeight: 'bold' 
          }}>
            ${chartData.reduce((sum, d) => sum + (d.calls - d.puts), 0).toFixed(2)}M
          </div>
        </div>
      </div>

      {/* Data timestamp */}
      <div className="text-right text-xs mt-4" style={{ color: colors.muted }}>
        Last updated: {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}
