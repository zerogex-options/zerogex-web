'use client';

import {
  Area,
  AreaChart,
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

type Scalar = number | string | null | undefined;
type VolSurfaceRawPoint = Record<string, Scalar>;

interface VolSurfaceResponse {
  symbol?: string;
  timestamp?: string;
  surface?: VolSurfaceRawPoint[];
  points?: VolSurfaceRawPoint[];
  data?: VolSurfaceRawPoint[];
  rows?: VolSurfaceRawPoint[];
  vol_surface?: VolSurfaceRawPoint[];
  curve?: VolSurfaceRawPoint[];
  result?: VolSurfaceRawPoint[];
}

interface VolSurfaceChartProps {
  symbol: string;
}

interface VolSurfaceChartPoint {
  xLabel: string;
  iv0dte: number | null;
  iv7dte: number | null;
  iv30dte: number | null;
}

const labelCandidates = ['label', 'bucket', 'moneyness', 'delta_bucket', 'x_label', 'x', 'strike'];
const dte0Candidates = ['iv_0dte', 'iv0dte', 'dte_0', '0dte', 'dte0', 'iv_0_dte'];
const dte7Candidates = ['iv_7dte', 'iv7dte', 'dte_7', '7dte', 'dte7', 'iv_7_dte'];
const dte30Candidates = ['iv_30dte', 'iv30dte', 'dte_30', '30dte', 'dte30', 'iv_30_dte'];
const tenorCandidates = ['tenor', 'dte_bucket', 'expiry_bucket', 'horizon'];
const ivValueCandidates = ['iv', 'implied_vol', 'implied_volatility', 'volatility', 'value'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === 'object' && !Array.isArray(v);
}

function toNum(v: Scalar): number | null {
  if (v == null || v === '') return null;
  const parsed = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1 ? parsed / 100 : parsed;
}

function lookup(obj: VolSurfaceRawPoint, candidates: string[]): Scalar {
  for (const key of candidates) {
    if (key in obj) return obj[key];
  }

  for (const [key, value] of Object.entries(obj)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (candidates.some((candidate) => normalized.includes(candidate.toLowerCase().replace(/[^a-z0-9]/g, '')))) {
      return value;
    }
  }

  return undefined;
}

function lookupDeep(obj: VolSurfaceRawPoint, candidates: string[]): Scalar {
  const direct = lookup(obj, candidates);
  if (direct != null) return direct;

  for (const value of Object.values(obj)) {
    if (isRecord(value)) {
      const nested = lookup(value as VolSurfaceRawPoint, candidates);
      if (nested != null) return nested;
    }
  }

  return undefined;
}

function normalizeTenor(raw: Scalar): '0dte' | '7dte' | '30dte' | null {
  if (raw == null) return null;
  const normalized = String(raw).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized.includes('0dte') || normalized === '0') return '0dte';
  if (normalized.includes('7dte') || normalized === '7') return '7dte';
  if (normalized.includes('30dte') || normalized === '30') return '30dte';
  return null;
}

function normalizeLongForm(rows: VolSurfaceRawPoint[]): VolSurfaceChartPoint[] {
  const grouped = new Map<string, VolSurfaceChartPoint>();

  rows.forEach((row, idx) => {
    const tenor = normalizeTenor(lookupDeep(row, tenorCandidates));
    const iv = toNum(lookupDeep(row, ivValueCandidates));
    if (!tenor || iv == null) return;

    const labelRaw = lookupDeep(row, labelCandidates);
    const label = labelRaw != null && String(labelRaw).trim() !== '' ? String(labelRaw) : `P${idx + 1}`;

    const existing = grouped.get(label) ?? { xLabel: label, iv0dte: null, iv7dte: null, iv30dte: null };
    if (tenor === '0dte') existing.iv0dte = iv;
    if (tenor === '7dte') existing.iv7dte = iv;
    if (tenor === '30dte') existing.iv30dte = iv;
    grouped.set(label, existing);
  });

  return Array.from(grouped.values());
}

function normalizeSurface(response: VolSurfaceResponse | VolSurfaceRawPoint[] | null): VolSurfaceChartPoint[] {
  if (!response) return [];

  const rows = Array.isArray(response)
    ? response
    : response.surface ?? response.points ?? response.data ?? response.rows ?? response.vol_surface ?? response.curve ?? response.result ?? [];

  const hasLongForm = rows.some((row) => normalizeTenor(lookupDeep(row, tenorCandidates)) != null);
  if (hasLongForm) {
    return normalizeLongForm(rows).filter((row) => row.iv0dte != null || row.iv7dte != null || row.iv30dte != null);
  }

  return rows
    .map((row, idx) => {
      const labelRaw = lookupDeep(row, labelCandidates);
      const label = labelRaw != null && String(labelRaw).trim() !== '' ? String(labelRaw) : `P${idx + 1}`;

      return {
        xLabel: label,
        iv0dte: toNum(lookupDeep(row, dte0Candidates)),
        iv7dte: toNum(lookupDeep(row, dte7Candidates)),
        iv30dte: toNum(lookupDeep(row, dte30Candidates)),
      };
    })
    .filter((row) => row.iv0dte != null || row.iv7dte != null || row.iv30dte != null);
}

function formatPct(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const num = Number(raw);
  if (!Number.isFinite(num)) return '--';
  return `${(num * 100).toFixed(0)}%`;
}

function renderLegend() {
  return (
    <div className="flex items-center gap-6 text-sm pt-2">
      <span className="inline-flex items-center gap-2 leading-4"><i className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#3b93d9' }} />0DTE IV</span>
      <span className="inline-flex items-center gap-2 leading-4"><i className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#7c7ad4' }} />7DTE IV</span>
      <span className="inline-flex items-center gap-2 leading-4"><i className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#8e8f8b' }} />30DTE IV</span>
    </div>
  );
}

export default function VolSurfaceChart({ symbol }: VolSurfaceChartProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const textColor = isDark ? colors.light : colors.dark;
  const axisStroke = isDark ? '#f2f2f2' : '#8e8e8e';
  const gridStroke = isDark ? '#968f92' : '#e5e7eb';

  const { data, loading, error } = useApiData<VolSurfaceResponse | VolSurfaceRawPoint[]>(
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
          <AreaChart data={surface} margin={{ top: 8, right: 8, left: 0, bottom: 14 }}>
            <defs>
              <linearGradient id="surfaceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c7d2df" stopOpacity={0.5} />
                <stop offset="100%" stopColor="#c7d2df" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.45} />
            <XAxis
              dataKey="xLabel"
              stroke={axisStroke}
              tick={{ fontSize: 10, fill: axisStroke }}
              interval={0}
              tickMargin={10}
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
              formatter={(value, name) => [formatPct(value), String(name ?? '')]}
            />
            <Legend verticalAlign="bottom" align="left" content={renderLegend} />

            <Area type="monotone" dataKey="iv0dte" stroke="none" fill="url(#surfaceFill)" fillOpacity={1} />

            <Area type="monotone" dataKey="iv0dte" name="0DTE" stroke="#3b93d9" strokeWidth={3} fill="none" dot={{ r: 4, strokeWidth: 2, fill: 'transparent' }} connectNulls />
            <Area type="monotone" dataKey="iv7dte" name="7DTE" stroke="#7c7ad4" strokeWidth={3} fill="none" dot={{ r: 3, strokeWidth: 2, fill: '#7c7ad4' }} connectNulls />
            <Area type="monotone" dataKey="iv30dte" name="30DTE" stroke="#8e8f8b" strokeWidth={3} strokeDasharray="6 4" fill="none" dot={{ r: 3, strokeWidth: 2, fill: isDark ? '#1f1d1e' : '#ffffff' }} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
