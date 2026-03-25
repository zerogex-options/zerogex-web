/**
 * Intraday Trading Tools Page
 * VWAP, ORB, Volume Spikes, Momentum Divergence, etc.
 */

'use client';

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import TooltipWrapper from '@/components/TooltipWrapper';
import { omitClosedMarketTimes } from '@/core/utils';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';

interface VwapDeviationRow {
  price: number;
  vwap: number;
  vwap_deviation_pct: number;
  vwap_position: string;
}

interface OpeningRangeRow {
  current_price: number;
  orb_high: number;
  distance_above_orb_high: number;
  orb_low: number;
  distance_below_orb_low: number;
  orb_range: number;
  orb_status: string;
}

interface VolumeSpikeRow {
  time_et: string;
  current_volume: number;
  volume_ratio: number;
  volume_sigma: number;
  volume_class: string;
}

interface DivergenceRow {
  time_et?: string;
  timestamp?: string;
  time?: string;
  time_window_end?: string;
  divergence_signal?: string;
  signal?: string;
  divergence_type?: string;
  price?: number;
}

interface SmartMoneyRow {
  timestamp?: string;
  symbol: string;
  contract: string;
  strike: number;
  expiration: string;
  dte: number;
  option_type: string;
  flow: number;
  notional: number;
  delta?: number | null;
  score?: number | null;
  notional_class: string;
  size_class: string;
  underlying_price?: number | null;
  time_window_start?: string;
  time_window_end?: string;
  interval_timestamp?: string | null;
}

interface NormalizedSmartMoneyRow extends SmartMoneyRow {
  rowKey: string;
  minuteTimestamp: string | null;
  effectiveTimestamp: string | null;
  notionalM: number;
}

interface SessionFlowPoint {
  timestamp: string;
  underlying_price?: number | null;
}

type SmartMoneySortKey = 'timestamp' | 'contract' | 'strike' | 'expiration' | 'dte' | 'option_type' | 'flow' | 'notional' | 'notional_class';

const CLASS_RANKING = ['nano', 'micro', 'small', 'medium', 'large', 'xlarge', 'whale', 'blockbuster'];

function classRank(value: string): number {
  const normalized = (value || '').toLowerCase();
  const idx = CLASS_RANKING.findIndex((entry) => normalized.includes(entry));
  return idx === -1 ? 0 : idx;
}

function extractDivergenceRows(payload: unknown): DivergenceRow[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as DivergenceRow[];
  if (typeof payload !== 'object') return [];

  const direct = payload as Record<string, unknown>;
  const preferredKeys = ['data', 'results', 'signals', 'rows', 'items'];
  for (const key of preferredKeys) {
    const candidate = direct[key];
    if (Array.isArray(candidate)) return candidate as DivergenceRow[];
    if (candidate && typeof candidate === 'object') {
      const nested = extractDivergenceRows(candidate);
      if (nested.length > 0) return nested;
    }
  }

  for (const value of Object.values(direct)) {
    if (Array.isArray(value)) return value as DivergenceRow[];
    if (value && typeof value === 'object') {
      const nested = extractDivergenceRows(value);
      if (nested.length > 0) return nested;
    }
  }

  return [];
}

function normalizeToMinute(ts?: string): string | null {
  if (!ts) return null;
  const ms = new Date(ts).getTime();
  if (!Number.isFinite(ms)) return null;
  return new Date(Math.floor(ms / 60_000) * 60_000).toISOString();
}

function smartMoneyTimestamp(row: SmartMoneyRow): string | null {
  return normalizeToMinute(row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start);
}

function smartMoneyEffectiveTimestamp(row: SmartMoneyRow): string | null {
  const raw = row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function getETDateKey(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function getSessionTimestamps(dateKey: string): string[] {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return [];

  const etFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  let startMs: number | null = null;
  for (const utcH of [13, 14]) {
    const candidate = Date.UTC(y, m - 1, d, utcH, 30);
    const parts = etFmt.formatToParts(new Date(candidate));
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
    const min = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
    if (h === 9 && min === 30) { startMs = candidate; break; }
  }

  let endMs: number | null = null;
  for (const utcH of [20, 21]) {
    const candidate = Date.UTC(y, m - 1, d, utcH, 0);
    const parts = etFmt.formatToParts(new Date(candidate));
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
    const min = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
    if (h === 16 && min === 0) { endMs = candidate; break; }
  }

  if (startMs === null || endMs === null) return [];
  const result: string[] = [];
  for (let t = startMs; t <= endMs; t += 60_000) result.push(new Date(t).toISOString());
  return result;
}

function is30MinBoundary(ts: string): boolean {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return false;
  const m = d.getUTCMinutes();
  return m === 0 || m === 30;
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

export default function IntradayToolsPage() {
  const { symbol, timeframe, getMaxDataPoints } = useTimeframe();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#423d3f' : '#ffffff';
  const inputBg = isDark ? '#2f2b2c' : '#f3f4f6';
  const inputBorder = isDark ? '#6b7280' : '#d1d5db';
  const inputColor = isDark ? '#e5e7eb' : '#374151';
  const axisStroke = isDark ? '#f2f2f2' : '#374151';
  const gridStroke = isDark ? '#968f92' : '#d1d5db';
  const mutedText = isDark ? '#9ca3af' : '#6b7280';
  const borderColor = isDark ? 'rgba(150,143,146,0.3)' : 'rgba(0,0,0,0.1)';
  const [smartMoneySortKey, setSmartMoneySortKey] = useState<SmartMoneySortKey>('notional');
  const [smartMoneySortDir, setSmartMoneySortDir] = useState<'asc' | 'desc'>('desc');
  const [minClass, setMinClass] = useState('all');
  const [sessionView, setSessionView] = useState<'current' | 'prior'>('current');
  const [hoveredBlockKey, setHoveredBlockKey] = useState<string | null>(null);
  const maxPoints = getMaxDataPoints();
  const divergenceWindowUnits = maxPoints;

  const { data: vwapData, loading: vwapLoading, error: vwapError } = useApiData<VwapDeviationRow[]>(
    `/api/trading/vwap-deviation?symbol=${symbol}&timeframe=${timeframe}&window_units=20`,
    { refreshInterval: 5000 }
  );

  const { data: orbData, loading: orbLoading, error: orbError } = useApiData<OpeningRangeRow[]>(
    `/api/trading/opening-range?symbol=${symbol}&timeframe=${timeframe}&window_units=20`,
    { refreshInterval: 5000 }
  );

  const { data: volumeSpikes } = useApiData<VolumeSpikeRow[]>(
    `/api/trading/volume-spikes?symbol=${symbol}&limit=5`,
    { refreshInterval: 10000 }
  );

  const { data: divergenceResponse } = useApiData<unknown>(
    `/api/trading/momentum-divergence?symbol=${symbol}&timeframe=${timeframe}&window_units=${divergenceWindowUnits}`,
    { refreshInterval: 5000 }
  );

  const { data: divergenceFallback } = useApiData<unknown>(
    `/api/trading/momentum-divergence?symbol=${symbol}`,
    { refreshInterval: 5000 }
  );

  const { data: divergenceDefault } = useApiData<unknown>(
    `/api/trading/momentum-divergence`,
    { refreshInterval: 5000 }
  );

  const { data: smartMoneyData, error: smartMoneyError } = useApiData<SmartMoneyRow[]>(
    `/api/flow/smart-money?symbol=${symbol}&session=${sessionView}&limit=500`,
    { refreshInterval: 10000 }
  );
  const { data: smartMoneyFallbackData, error: smartMoneyFallbackError } = useApiData<SmartMoneyRow[]>(
    `/api/flow/smart-money?symbol=${symbol}&timeframe=1day&window_units=30&limit=200`,
    { refreshInterval: 10000 }
  );
  const { data: sessionPriceData } = useApiData<SessionFlowPoint[]>(
    `/api/flow/by-type?symbol=${symbol}&session=${sessionView}`,
    { refreshInterval: 10000 }
  );

  const primaryDivergence = extractDivergenceRows(divergenceResponse);
  const fallbackDivergence = extractDivergenceRows(divergenceFallback);
  const defaultDivergence = extractDivergenceRows(divergenceDefault);
  const divergence = [primaryDivergence, fallbackDivergence, defaultDivergence].find((rows) => rows.length > 0) || [];

  const vwap = vwapData?.[0];
  const orb = orbData?.[0];
  const divergenceMarketRows = omitClosedMarketTimes(divergence || [], (signal) => signal.time_et || signal.timestamp || signal.time_window_end || signal.time || '');

  const effectiveSmartMoneyRows = useMemo(
    () => (smartMoneyError ? (smartMoneyFallbackData || []) : (smartMoneyData || [])),
    [smartMoneyError, smartMoneyFallbackData, smartMoneyData],
  );
  const effectiveSmartMoneyError = smartMoneyError && smartMoneyFallbackError ? smartMoneyError : null;

  const normalizedSmartMoneyRows = useMemo<NormalizedSmartMoneyRow[]>(() => {
    return effectiveSmartMoneyRows.map((row, idx) => {
      const effectiveTimestamp = smartMoneyEffectiveTimestamp(row);
      const minuteTimestamp = smartMoneyTimestamp(row);
      return {
        ...row,
        rowKey: `${minuteTimestamp ?? 'na'}-${row.contract ?? 'contract'}-${idx}`,
        minuteTimestamp,
        effectiveTimestamp,
        notionalM: Math.abs(Number(row.notional || 0)) / 1_000_000,
      };
    });
  }, [effectiveSmartMoneyRows]);

  const classOptions = useMemo(() => {
    const unique = Array.from(new Set(normalizedSmartMoneyRows.map((row) => row.notional_class))).filter(Boolean);
    return unique.sort((a, b) => classRank(a) - classRank(b));
  }, [normalizedSmartMoneyRows]);

  const filteredSmartMoneyData = useMemo<NormalizedSmartMoneyRow[]>(() => {
    if (minClass === 'all') return normalizedSmartMoneyRows;
    const threshold = classRank(minClass);
    return normalizedSmartMoneyRows.filter((row) => classRank(row.notional_class) >= threshold);
  }, [normalizedSmartMoneyRows, minClass]);

  const sortedSmartMoneyRows = useMemo(() => {
    const rows = [...filteredSmartMoneyData];
    rows.sort((a, b) => {
      const valueA = a[smartMoneySortKey];
      const valueB = b[smartMoneySortKey];
      const normalizedA = typeof valueA === 'string' ? valueA.toLowerCase() : valueA;
      const normalizedB = typeof valueB === 'string' ? valueB.toLowerCase() : valueB;
      const comparison = normalizedA < normalizedB ? -1 : normalizedA > normalizedB ? 1 : 0;
      return smartMoneySortDir === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [filteredSmartMoneyData, smartMoneySortDir, smartMoneySortKey]);

  const smartMoneySessionChart = useMemo(() => {
    const rows = filteredSmartMoneyData;
    const priceRows = sessionPriceData || [];
    if (rows.length === 0 && priceRows.length === 0) return [];

    const blocksByTs = new Map<string, Array<{ notionalM: number; rowKey: string }>>();
    rows.forEach((row) => {
      const ts = row.minuteTimestamp;
      if (!ts) return;
      const blocks = blocksByTs.get(ts) ?? [];
      blocks.push({ notionalM: row.notionalM, rowKey: row.rowKey });
      blocksByTs.set(ts, blocks);
    });

    const priceByTs = new Map<string, number>();
    priceRows.forEach((row) => {
      const ts = normalizeToMinute(row.timestamp);
      if (!ts || row.underlying_price == null) return;
      priceByTs.set(ts, Number(row.underlying_price));
    });

    const allTsFromData = Array.from(new Set([...blocksByTs.keys(), ...priceByTs.keys()])).sort((a, b) => a.localeCompare(b));
    const sessionDate = allTsFromData.length > 0 ? getETDateKey(allTsFromData[allTsFromData.length - 1]) : '';
    const sessionTimeline = sessionDate ? getSessionTimestamps(sessionDate) : allTsFromData;
    const allTs = sessionTimeline.length > 0 ? sessionTimeline : allTsFromData;
    const maxBlocksPerMinute = Math.max(1, ...Array.from(blocksByTs.values()).map((values) => values.length));

    let cumulative = 0;
    return allTs.map((ts) => {
      const minuteBlocks = [...(blocksByTs.get(ts) || [])].sort((a, b) => b.notionalM - a.notionalM);
      const totalMinuteNotional = minuteBlocks.reduce((sum, value) => sum + value.notionalM, 0);
      cumulative += totalMinuteNotional;

      const row: Record<string, number | string | null> = {
        timestamp: ts,
        time: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }),
        blockNotionalM: totalMinuteNotional,
        cumulativeNotionalM: cumulative,
        underlyingPrice: priceByTs.get(ts) ?? null,
      };

      for (let idx = 0; idx < maxBlocksPerMinute; idx += 1) {
        row[`block${idx + 1}`] = minuteBlocks[idx]?.notionalM ?? 0;
        row[`block${idx + 1}Key`] = minuteBlocks[idx]?.rowKey ?? '';
      }
      return row;
    });
  }, [sessionPriceData, filteredSmartMoneyData]);

  const maxStackSegments = useMemo(() => {
    return smartMoneySessionChart.reduce((max, row) => {
      const keys = Object.keys(row).filter((key) => key.startsWith('block') && Number(row[key] || 0) > 0);
      return Math.max(max, keys.length);
    }, 1);
  }, [smartMoneySessionChart]);

  const notionalTicks = useMemo(() => {
    const max = Math.max(0, ...smartMoneySessionChart.map((row) => Number(row.blockNotionalM || 0)));
    return generateNiceTicks(0, max);
  }, [smartMoneySessionChart]);

  const priceTicks = useMemo(() => {
    const values = smartMoneySessionChart
      .map((row) => Number(row.underlyingPrice))
      .filter((value) => Number.isFinite(value));
    if (values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return generateNiceTicks(min, max);
  }, [smartMoneySessionChart]);

  const toggleSmartMoneySort = (key: SmartMoneySortKey) => {
    if (smartMoneySortKey === key) {
      setSmartMoneySortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSmartMoneySortKey(key);
    setSmartMoneySortDir('desc');
  };

  if ((vwapLoading || orbLoading) && !vwapData && !orbData) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Intraday Trading Tools</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">VWAP Analysis</h2>
        {vwapError ? (
          <ErrorMessage message={vwapError} />
        ) : !vwap ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>
            No VWAP data available (market may be closed)
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard title="Current Price" value={`$${vwap.price.toFixed(2)}`} tooltip="Current market price" />
            <MetricCard title="VWAP" value={`$${vwap.vwap.toFixed(2)}`} tooltip="Volume weighted average price" />
            <MetricCard title="Deviation" value={`${vwap.vwap_deviation_pct.toFixed(2)}%`} trend={Math.abs(vwap.vwap_deviation_pct) > 0.2 ? 'bearish' : 'neutral'} tooltip="Percentage deviation from VWAP" />
            <MetricCard title="Position" value={vwap.vwap_position} tooltip="Price position relative to VWAP" />
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Opening Range Breakout</h2>
        {orbError ? (
          <ErrorMessage message={orbError} />
        ) : !orb ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>
            No ORB data available (market may be closed)
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <MetricCard title="Current Price" value={`$${orb.current_price.toFixed(2)}`} tooltip="Current market price" />
              <MetricCard title="ORB High" value={`$${orb.orb_high.toFixed(2)}`} subtitle={`+${orb.distance_above_orb_high.toFixed(2)}`} tooltip="Opening range high" />
              <MetricCard title="ORB Low" value={`$${orb.orb_low.toFixed(2)}`} subtitle={`-${orb.distance_below_orb_low.toFixed(2)}`} tooltip="Opening range low" />
              <MetricCard title="ORB Range" value={`$${orb.orb_range.toFixed(2)}`} tooltip="Opening range size" />
            </div>
            <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
              <div className="text-xl font-semibold text-center">
                Status: <span className={`${orb.orb_status.includes('🚀') ? 'text-green-400' : orb.orb_status.includes('💥') ? 'text-red-400' : 'text-yellow-400'}`}>{orb.orb_status}</span>
              </div>
            </div>
          </>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">Smart Money Flow
          <TooltipWrapper text="Session view overlays smart-money block notional and cumulative block flow versus underlying price, with a sortable detail table below." >
            <Info size={14} />
          </TooltipWrapper>
        </h2>
        <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
          <div className="flex flex-wrap items-center justify-end gap-3 mb-4">
            <label className="text-sm" style={{ color: mutedText }}>
              Session
              <select
                className="ml-2 rounded px-2 py-1"
                style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputColor, border: `1px solid ${inputBorder}` }}
                value={sessionView}
                onChange={(e) => setSessionView(e.target.value as 'current' | 'prior')}
              >
                <option value="current">Current session</option>
                <option value="prior">Previous session</option>
              </select>
            </label>
            <label className="text-sm" style={{ color: mutedText }}>
              Min Class
              <select className="ml-2 rounded px-2 py-1" style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputColor, border: `1px solid ${inputBorder}` }} value={minClass} onChange={(e) => setMinClass(e.target.value)}>
                <option value="all">All</option>
                {classOptions.map((cls) => (
                  <option key={cls} value={cls}>{cls} +</option>
                ))}
              </select>
            </label>
          </div>

          {effectiveSmartMoneyError ? <ErrorMessage message={effectiveSmartMoneyError} /> : !filteredSmartMoneyData || filteredSmartMoneyData.length === 0 ? (
            <div className="text-center py-6" style={{ color: mutedText }}>No smart money flow data available</div>
          ) : (
            <>
              <div className="mb-5">
                <h3 className="text-sm font-semibold mb-2" style={{ color: mutedText }}>
                  Smart Money Blocks vs Underlying Price ({sessionView === 'current' ? 'Current Session' : 'Previous Session'})
                </h3>
                {smartMoneySessionChart.length === 0 ? (
                  <div className="text-center py-4 text-sm" style={{ color: mutedText }}>
                    No session chart data available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart
                      data={smartMoneySessionChart}
                      margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
                      onMouseMove={(state) => {
                        const payload = state?.activePayload?.[0]?.payload as Record<string, unknown> | undefined;
                        if (!payload || !state?.activePayload || state.activePayload.length === 0) return;
                        const firstBar = state.activePayload.find((item) => String(item.dataKey || '').startsWith('block'));
                        const dataKey = String(firstBar?.dataKey || '');
                        if (!dataKey) return;
                        const rowKey = String(payload[`${dataKey}Key`] || '');
                        setHoveredBlockKey(rowKey || null);
                      }}
                      onMouseLeave={() => setHoveredBlockKey(null)}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} opacity={0.3} />
                      <XAxis
                        dataKey="timestamp"
                        stroke={axisStroke}
                        tick={{ fill: axisStroke, fontSize: 11 }}
                        interval={0}
                        minTickGap={20}
                        tickFormatter={(value) => {
                          const ts = String(value || '');
                          if (!is30MinBoundary(ts)) return '';
                          return new Date(ts).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                            timeZone: 'America/New_York',
                          });
                        }}
                      />
                      <YAxis
                        yAxisId="notional"
                        stroke={axisStroke}
                        tick={{ fill: axisStroke, fontSize: 11 }}
                        domain={[0, 'auto']}
                        ticks={notionalTicks}
                        tickFormatter={(value) => `$${Number(value).toFixed(1)}M`}
                      />
                      <YAxis
                        yAxisId="price"
                        orientation="right"
                        stroke={axisStroke}
                        tick={{ fill: axisStroke, fontSize: 11 }}
                        domain={priceTicks.length > 1 ? [priceTicks[0], priceTicks[priceTicks.length - 1]] : ['auto', 'auto']}
                        ticks={priceTicks}
                        tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: isDark ? '#1f1d1e' : '#ffffff', borderColor: isDark ? '#423d3f' : '#d1d5db' }}
                        formatter={(value, name) => {
                          if (String(name).includes('Price')) return [`$${Number(value).toFixed(2)}`, name];
                          return [`$${Number(value).toFixed(2)}M`, name];
                        }}
                      />
                      {Array.from({ length: maxStackSegments }, (_, idx) => (
                        <Bar
                          key={`block${idx + 1}`}
                          yAxisId="notional"
                          dataKey={`block${idx + 1}`}
                          name={idx === 0 ? 'Block Notional' : undefined}
                          stackId="smartMoneyBlocks"
                          fill={idx % 2 === 0 ? '#f59e0b' : '#fbbf24'}
                          opacity={0.8}
                          isAnimationActive={false}
                          shape={(props: Record<string, unknown>) => {
                            const x = Number(props.x || 0);
                            const y = Number(props.y || 0);
                            const width = Number(props.width || 0);
                            const height = Number(props.height || 0);
                            const payload = props.payload as Record<string, unknown>;
                            const rowKey = String(payload?.[`block${idx + 1}Key`] || '');
                            const isHighlighted = hoveredBlockKey != null && rowKey === hoveredBlockKey;
                            return (
                              <rect
                                x={x}
                                y={y}
                                width={width}
                                height={height}
                                fill={isHighlighted ? '#fde047' : (idx % 2 === 0 ? '#f59e0b' : '#fbbf24')}
                                opacity={isHighlighted ? 1 : 0.8}
                                stroke={isHighlighted ? '#fff7cc' : 'none'}
                                strokeWidth={isHighlighted ? 1 : 0}
                              />
                            );
                          }}
                        />
                      ))}
                      <Line yAxisId="notional" type="monotone" dataKey="cumulativeNotionalM" name="Cumulative Smart Money" stroke="#22c55e" strokeWidth={2} dot={false} />
                      <Line yAxisId="price" type="monotone" dataKey="underlyingPrice" name="Underlying Price" stroke="#60a5fa" strokeWidth={2} dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="overflow-x-auto mt-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b" style={{ borderColor: borderColor, color: mutedText }}>
                      <th className="text-left py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('timestamp')}>Time</th>
                      <th className="text-left py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('contract')}>Contract</th>
                      <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('strike')}>Strike</th>
                      <th className="text-left py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('expiration')}>Expiry</th>
                      <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('dte')}>DTE</th>
                      <th className="text-left py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('option_type')}>Type</th>
                      <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('flow')}>Flow</th>
                      <th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('notional')}>Notional</th>
                      <th className="text-left py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('notional_class')}>Class</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSmartMoneyRows.map((row) => {
                      const isCall = String(row.option_type).toLowerCase().includes('call');
                      const isHighlighted = hoveredBlockKey != null && row.rowKey === hoveredBlockKey;
                      return (
                        <tr
                          key={row.rowKey}
                          className="border-b"
                          style={{
                            borderColor: borderColor,
                            backgroundColor: isHighlighted ? (isDark ? 'rgba(253,224,71,0.16)' : 'rgba(245,158,11,0.12)') : 'transparent',
                          }}
                          onMouseEnter={() => setHoveredBlockKey(row.rowKey)}
                          onMouseLeave={() => setHoveredBlockKey(null)}
                        >
                          <td className="py-2 px-2">{row.effectiveTimestamp ? new Date(row.effectiveTimestamp).toLocaleTimeString() : '--:--'}</td>
                          <td className="py-2 px-2 font-mono text-xs">{row.contract}</td>
                          <td className="text-right py-2 px-2">${Number(row.strike).toFixed(2)}</td>
                          <td className="py-2 px-2">{row.expiration}</td>
                          <td className="text-right py-2 px-2">{row.dte}</td>
                          <td className={`py-2 px-2 font-semibold ${isCall ? 'text-green-300' : 'text-red-300'}`}>{isCall ? 'C' : 'P'}</td>
                          <td className="text-right py-2 px-2">{Number(row.flow).toLocaleString()}</td>
                          <td className="text-right py-2 px-2">${(Number(row.notional) / 1000000).toFixed(2)}M</td>
                          <td className="py-2 px-2">{row.notional_class} / {row.size_class}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Unusual Volume Spikes</h2>
        {!volumeSpikes || volumeSpikes.length === 0 ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>
            No unusual volume detected
          </div>
        ) : (
          <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {volumeSpikes.map((spike, idx) => (
                <div key={idx} className="flex items-center justify-between border-b pb-3" style={{ borderColor: borderColor }}>
                  <div>
                    <div className="font-semibold">{new Date(spike.time_et).toLocaleTimeString()}</div>
                    <div className="text-sm" style={{ color: mutedText }}>Volume: {spike.current_volume.toLocaleString()} ({spike.volume_ratio.toFixed(1)}x avg)</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold">{spike.volume_sigma.toFixed(1)}σ</div>
                    <div className="text-sm">{spike.volume_class}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Momentum Divergence Signals</h2>
        {!divergenceMarketRows || divergenceMarketRows.length === 0 ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>No divergence signals</div>
        ) : (
          <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {divergenceMarketRows.map((signal, idx) => {
                const timestamp = signal.time_et || signal.timestamp || signal.time_window_end || signal.time || '';
                const divergenceSignal = signal.divergence_signal || signal.signal || signal.divergence_type || 'No signal';
                const price = Number(signal.price || 0);
                return (
                  <div key={idx} className="border-b pb-3" style={{ borderColor: borderColor }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold">{timestamp ? new Date(timestamp).toLocaleTimeString() : '--:--'}</div>
                      <div className={`px-3 py-1 rounded text-sm font-semibold ${
                        divergenceSignal.includes('🚨') ? 'bg-yellow-900 text-yellow-300' :
                        divergenceSignal.includes('🟢') ? 'bg-green-900 text-green-300' :
                        divergenceSignal.includes('🔴') ? 'bg-red-900 text-red-300' :
                        'bg-gray-800 text-gray-300'
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
