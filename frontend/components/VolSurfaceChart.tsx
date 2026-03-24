'use client';

import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import { useTheme } from '@/core/ThemeContext';
import { colors } from '@/core/colors';

interface VolSurfacePoint {
  strike: number;
  iv_0dte?: number | null;
  iv_7dte?: number | null;
  iv_30dte?: number | null;
}

interface VolSurfaceResponse {
  symbol?: string;
  timestamp?: string;
  surface?: VolSurfacePoint[];
  points?: VolSurfacePoint[];
  data?: VolSurfacePoint[];
}

interface VolSurfaceChartProps {
  symbol: string;
}

function normalizeSurface(response: VolSurfaceResponse | VolSurfacePoint[] | null): VolSurfacePoint[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.surface)) return response.surface;
  if (Array.isArray(response.points)) return response.points;
  if (Array.isArray(response.data)) return response.data;
  return [];
}

function formatPct(value: number | string): string {
  const num = Number(value);
  if (!Number.isFinite(num)) return '--';
  return `${(num * 100).toFixed(1)}%`;
}

export default function VolSurfaceChart({ symbol }: VolSurfaceChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;
  const axisStroke = isDark ? '#f2f2f2' : '#374151';
  const gridStroke = isDark ? '#968f92' : '#d1d5db';

  const { data, loading, error } = useApiData<VolSurfaceResponse | VolSurfacePoint[]>(
    `/api/vol-surface?symbol=${symbol}`,
    { refreshInterval: 30000 },
  );

  const surface = normalizeSurface(data);

  return (
    <div
      className="rounded-2xl p-6 h-full"
      style={{
        backgroundColor: isDark ? colors.cardDark : colors.cardLight,
        border: `1px solid ${colors.muted}`,
      }}
    >
      <h3 className="text-sm font-bold tracking-wider uppercase mb-4" style={{ color: textColor }}>
        VOL SURFACE
      </h3>

      {loading && surface.length === 0 ? (
        <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: colors.muted }}>
          Loading vol surface...
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-[300px] text-sm text-red-400">
          {error}
        </div>
      ) : surface.length === 0 ? (
        <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: colors.muted }}>
          No vol surface data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={surface} margin={{ top: 5, right: 8, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
            <XAxis
              dataKey="strike"
              stroke={axisStroke}
              tick={{ fontSize: 10, fill: axisStroke }}
              tickFormatter={(v) => Number(v).toFixed(0)}
            />
            <YAxis
              stroke={axisStroke}
              tick={{ fontSize: 10, fill: axisStroke }}
              tickFormatter={formatPct}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: isDark ? '#1f1d1e' : '#ffffff',
                borderColor: isDark ? '#423d3f' : '#d1d5db',
                borderRadius: 6,
              }}
              labelStyle={{ color: textColor }}
              labelFormatter={(v) => `Strike $${Number(v).toFixed(0)}`}
              formatter={(value: number, name) => [formatPct(value), name]}
            />
            <Legend />
            <Line type="monotone" dataKey="iv_0dte" name="0DTE" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="iv_7dte" name="7DTE" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="iv_30dte" name="30DTE" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
