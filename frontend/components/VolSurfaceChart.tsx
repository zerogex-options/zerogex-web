'use client';

import { Info } from 'lucide-react';
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
import TooltipWrapper from './TooltipWrapper';
import ExpandableCard from './ExpandableCard';

type Scalar = number | string | null | undefined;
type VolSurfaceRawPoint = Record<string, Scalar>;

interface NestedIvPoint {
  strike?: number;
  call_iv?: number | null;
  put_iv?: number | null;
  iv?: number | null;
}

interface NestedSurfaceEntry {
  dte?: number;
  expiration?: string;
  ivs?: NestedIvPoint[];
}

interface VolSurfaceResponse {
  symbol?: string;
  timestamp?: string;
  surface?: VolSurfaceRawPoint[] | NestedSurfaceEntry[];
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

interface NormalizedSurface {
  points: VolSurfaceChartPoint[];
  labels: [string, string, string];
  emptyReason?: string;
}

const labelCandidates = ['label', 'bucket', 'moneyness', 'delta_bucket', 'x_label', 'x', 'strike'];
const dte0Candidates = ['iv_0dte', 'iv0dte', 'dte_0', '0dte', 'dte0', 'iv_0_dte'];
const dte7Candidates = ['iv_7dte', 'iv7dte', 'dte_7', '7dte', 'dte7', 'iv_7_dte'];
const dte30Candidates = ['iv_30dte', 'iv30dte', 'dte_30', '30dte', 'dte30', 'iv_30_dte'];
const tenorCandidates = ['tenor', 'dte_bucket', 'expiry_bucket', 'horizon'];
const ivValueCandidates = ['iv', 'implied_vol', 'implied_volatility', 'volatility', 'value'];
const callIvCandidates = ['call_iv', 'calliv', 'call_implied_vol', 'call_vol', 'call_volatility'];
const putIvCandidates = ['put_iv', 'putiv', 'put_implied_vol', 'put_vol', 'put_volatility'];
const seriesKeys: Array<keyof Pick<VolSurfaceChartPoint, 'iv0dte' | 'iv7dte' | 'iv30dte'>> = ['iv0dte', 'iv7dte', 'iv30dte'];

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

function averageIv(callIv: number | null | undefined, putIv: number | null | undefined): number | null {
  const call = toNum(callIv);
  const put = toNum(putIv);
  if (call != null && put != null) return (call + put) / 2;
  return call ?? put ?? null;
}

function extractNestedIv(ivPoint: NestedIvPoint): number | null {
  const direct = averageIv(ivPoint.call_iv, ivPoint.put_iv);
  if (direct != null) return direct;
  if (ivPoint.iv != null) return toNum(ivPoint.iv);

  const raw = ivPoint as VolSurfaceRawPoint;
  const call = toNum(lookupDeep(raw, callIvCandidates));
  const put = toNum(lookupDeep(raw, putIvCandidates));
  const avg = averageIv(call, put);
  if (avg != null) return avg;

  return toNum(lookupDeep(raw, ivValueCandidates));
}

function normalizeNestedSurface(response: VolSurfaceResponse): NormalizedSurface | null {
  if (!Array.isArray(response.surface) || response.surface.length === 0) return null;
  const entries = response.surface as NestedSurfaceEntry[];
  if (!entries.every((entry) => Array.isArray(entry.ivs))) return null;

  const sorted = [...entries].sort((a, b) => Number(a.dte ?? 999) - Number(b.dte ?? 999)).slice(0, 3);
  const labels: [string, string, string] = [
    `${sorted[0]?.dte ?? 0}DTE`,
    `${sorted[1]?.dte ?? 7}DTE`,
    `${sorted[2]?.dte ?? 30}DTE`,
  ];

  const byStrike = new Map<number, VolSurfaceChartPoint>();

  sorted.forEach((entry, entryIndex) => {
    const key = seriesKeys[entryIndex];
    (entry.ivs ?? []).forEach((ivPoint) => {
      const strike = Number(ivPoint.strike);
      if (!Number.isFinite(strike)) return;

      const existing = byStrike.get(strike) ?? {
        xLabel: String(strike),
        iv0dte: null,
        iv7dte: null,
        iv30dte: null,
      };

      existing[key] = extractNestedIv(ivPoint);
      byStrike.set(strike, existing);
    });
  });

  const points = Array.from(byStrike.entries())
    .sort((a, b) => a[0] - b[0])
    .map((entry) => entry[1])
    .filter((row) => row.iv0dte != null || row.iv7dte != null || row.iv30dte != null);

  const anyIvRows = sorted.some((entry) => (entry.ivs ?? []).length > 0);
  const emptyReason = points.length === 0 && anyIvRows
    ? 'API returned strikes, but all IV values are null for the selected tenors.'
    : undefined;

  return { points, labels, emptyReason };
}


function coerceRows(source: unknown): VolSurfaceRawPoint[] {
  if (!Array.isArray(source)) return [];
  return source.filter(isRecord) as VolSurfaceRawPoint[];
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

function normalizeWideForm(response: VolSurfaceResponse | VolSurfaceRawPoint[]): VolSurfaceChartPoint[] {
  const rows = Array.isArray(response)
    ? response
    : coerceRows(response.points)
      .concat(coerceRows(response.data))
      .concat(coerceRows(response.rows))
      .concat(coerceRows(response.vol_surface))
      .concat(coerceRows(response.curve))
      .concat(coerceRows(response.result))
      .concat(coerceRows(response.surface));

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

function normalizeSurface(response: VolSurfaceResponse | VolSurfaceRawPoint[] | null): NormalizedSurface {
  if (!response) {
    return { points: [], labels: ['0DTE', '7DTE', '30DTE'] };
  }

  if (!Array.isArray(response)) {
    const nested = normalizeNestedSurface(response);
    if (nested) return nested;
  }

  return {
    points: normalizeWideForm(response),
    labels: ['0DTE', '7DTE', '30DTE'],
  };
}

function formatPct(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value;
  const num = Number(raw);
  if (!Number.isFinite(num)) return '--';
  return `${(num * 100).toFixed(0)}%`;
}

function renderLegend(labels: [string, string, string]) {
  return (
    <div className="flex items-center gap-6 text-sm pt-2">
      <span className="inline-flex items-center gap-2 leading-4"><i className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#5db9ff' }} />{labels[0]} IV</span>
      <span className="inline-flex items-center gap-2 leading-4"><i className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#9b8bff' }} />{labels[1]} IV</span>
      <span className="inline-flex items-center gap-2 leading-4"><i className="inline-block w-4 h-4 rounded" style={{ backgroundColor: '#c0c4be' }} />{labels[2]} IV</span>
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
    `/api/volatility/surface?symbol=${symbol}`,
    { refreshInterval: 30000 },
  );

  const normalized = normalizeSurface(data);
  const surface = normalized.points;
  const labels = normalized.labels;

  return (
    <ExpandableCard expandTrigger="button" expandButtonLabel="Expand chart" className="h-full">
      <div
        className="rounded-2xl p-6 h-full"
        style={{
          backgroundColor: isDark ? colors.cardDark : colors.cardLight,
          border: `1px solid ${colors.muted}`,
        }}
      >
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>
          VOL SURFACE
        </h3>
        <TooltipWrapper text="Implied volatility curves across tenor buckets, showing how IV changes by strike/moneyness for near-term versus longer-dated expirations.">
          <Info size={14} />
        </TooltipWrapper>
      </div>

      {loading && surface.length === 0 ? (
        <div className="flex items-center justify-center h-[300px] text-sm" style={{ color: colors.muted }}>
          Loading vol surface...
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-[300px] text-sm text-red-400">
          {error}
        </div>
      ) : surface.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[300px] text-sm" style={{ color: colors.muted }}>
          <span>No vol surface data available</span>
          {normalized.emptyReason && <span className="text-xs mt-2 opacity-80">{normalized.emptyReason}</span>}
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
            <Legend verticalAlign="bottom" align="left" content={() => renderLegend(labels)} />

            <Area type="monotone" dataKey="iv0dte" stroke="none" fill="url(#surfaceFill)" fillOpacity={1} />

            <Area type="monotone" dataKey="iv0dte" name={labels[0]} stroke="#5db9ff" strokeWidth={3} fill="none" dot={{ r: 4, strokeWidth: 2, fill: 'transparent' }} connectNulls />
            <Area type="monotone" dataKey="iv7dte" name={labels[1]} stroke="#9b8bff" strokeWidth={3} fill="none" dot={{ r: 3, strokeWidth: 2, fill: '#9b8bff' }} connectNulls />
            <Area type="monotone" dataKey="iv30dte" name={labels[2]} stroke="#c0c4be" strokeWidth={3} strokeDasharray="6 4" fill="none" dot={{ r: 3, strokeWidth: 2, fill: isDark ? '#1f1d1e' : '#ffffff' }} connectNulls />
          </AreaChart>
        </ResponsiveContainer>
      )}
      </div>
    </ExpandableCard>
  );
}
