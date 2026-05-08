/**
 * Intraday Trading Tools Page
 * VWAP, ORB, Volume Spikes, Momentum Divergence, etc.
 */

'use client';

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Area, Bar, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import { useMarketHistorical } from '@/hooks/useMarketHistorical';
import {
  useFlowByContractCache,
  buildUnderlyingPriceMap,
  latestRowDateKey,
  type FlowByContractPoint,
} from '@/hooks/useFlowByContract';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import MetricCard from '@/components/MetricCard';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import TooltipWrapper from '@/components/TooltipWrapper';
import { omitClosedMarketTimes, normalizeToMinute, isIndexSymbol } from '@/core/utils';
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
  timestamp?: string;
  price?: number;
  current_volume: number;
  avg_volume?: number;
  volume_ratio: number;
  volume_sigma: number;
  buying_pressure_pct?: number;
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


function smartMoneyTimestamp(row: SmartMoneyRow): string | null {
  return normalizeToMinute(row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start);
}

function smartMoneyEffectiveTimestamp(row: SmartMoneyRow): string | null {
  const raw = row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function getDateMarkerMeta(timestamps: string[]) {
  const groups = new Map<string, { first: number; last: number }>();
  timestamps.forEach((ts, idx) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    const key = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
    const current = groups.get(key);
    if (!current) groups.set(key, { first: idx, last: idx });
    else groups.set(key, { first: current.first, last: idx });
  });
  const indexToLabel = new Map<number, string>();
  groups.forEach((g, label) => {
    indexToLabel.set(g.first, label);
  });
  return indexToLabel;
}

function is30MinBoundary(ts: string): boolean {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return false;
  const m = d.getUTCMinutes();
  return m === 0 || m === 30;
}

function getETTimeTimestamp(dateKey: string, etHour: number, etMinute: number): number | null {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return null;
  const etFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  for (const offset of [4, 5]) {
    const candidate = Date.UTC(y, m - 1, d, etHour + offset, etMinute);
    const parts = etFmt.formatToParts(new Date(candidate));
    const yV = parts.find((p) => p.type === 'year')?.value ?? '';
    const mV = parts.find((p) => p.type === 'month')?.value ?? '';
    const dV = parts.find((p) => p.type === 'day')?.value ?? '';
    const hV = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
    const minV = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
    if (`${yV}-${mV}-${dV}` === dateKey && hV === etHour && minV === etMinute) return candidate;
  }
  return null;
}

function getExtendedSessionTimestamps(dateKey: string): string[] {
  const startMs = getETTimeTimestamp(dateKey, 4, 0);
  const endMs = getETTimeTimestamp(dateKey, 20, 0);
  if (startMs == null || endMs == null) return [];
  const result: string[] = [];
  for (let t = startMs; t <= endMs; t += 60_000) {
    result.push(new Date(t).toISOString());
  }
  return result;
}

function getRegularSessionTimestamps(dateKey: string): string[] {
  const startMs = getETTimeTimestamp(dateKey, 9, 30);
  const endMs = getETTimeTimestamp(dateKey, 16, 0);
  if (startMs == null || endMs == null) return [];
  const result: string[] = [];
  for (let t = startMs; t <= endMs; t += 60_000) {
    result.push(new Date(t).toISOString());
  }
  return result;
}

function getCurrentSessionDateKey(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  if (hour >= 4) return `${year}-${month}-${day}`;
  const yesterday = new Date(now.getTime() - 24 * 3600_000);
  const yParts = fmt.formatToParts(yesterday);
  return `${yParts.find((p) => p.type === 'year')?.value ?? ''}-${yParts.find((p) => p.type === 'month')?.value ?? ''}-${yParts.find((p) => p.type === 'day')?.value ?? ''}`;
}

function getETDateKey(ts: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date(ts));
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

function safeNum(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function fmtFixed(value: unknown, digits = 2): string {
  const n = safeNum(value);
  return n == null ? '--' : n.toFixed(digits);
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
  const cardBg = isDark ? 'var(--color-surface)' : 'var(--color-surface)';
  const inputBg = isDark ? 'var(--bg-hover)' : 'var(--color-surface-subtle)';
  const inputBorder = isDark ? 'var(--color-text-secondary)' : 'var(--color-border)';
  const inputColor = isDark ? 'var(--color-border)' : 'var(--color-text-primary)';
  const axisStroke = isDark ? 'var(--color-text-primary)' : 'var(--color-text-primary)';
  const mutedText = isDark ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)';
  const textColor = isDark ? 'var(--color-text-primary)' : 'var(--color-surface)';
  const borderColor = isDark ? 'var(--border-default)' : 'var(--border-default)';
  const [smartMoneySortKey, setSmartMoneySortKey] = useState<SmartMoneySortKey>('notional');
  const [smartMoneySortDir, setSmartMoneySortDir] = useState<'asc' | 'desc'>('desc');
  const [minClass, setMinClass] = useState('all');
  const [sessionView, setSessionView] = useState<'current' | 'prior'>('current');
  const [tableRowLimit, setTableRowLimit] = useState(50);
  const maxPoints = getMaxDataPoints();
  const divergenceWindowUnits = maxPoints;

  const symParam = `symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`;
  const { data: vwapData, loading: vwapLoading, error: vwapError } = useApiData<VwapDeviationRow[]>(
    `/api/technicals/vwap-deviation?${symParam}&timeframe=${timeframe}&window_units=20`,
    { refreshInterval: 5000 }
  );

  const { data: orbData, loading: orbLoading, error: orbError } = useApiData<OpeningRangeRow[]>(
    `/api/technicals/opening-range?${symParam}&timeframe=${timeframe}&window_units=20`,
    { refreshInterval: 5000 }
  );

  const { data: volumeSpikes, loading: volumeSpikesLoading, error: volumeSpikesError } = useApiData<VolumeSpikeRow[]>(
    `/api/technicals/volume-spikes?${symParam}&limit=50`,
    { refreshInterval: 10000 }
  );

  const { rows: volumeSpikesPriceBars } = useMarketHistorical(symbol, '5min');

  const { data: divergenceResponse } = useApiData<unknown>(
    `/api/technicals/momentum-divergence?${symParam}&timeframe=${timeframe}&window_units=${divergenceWindowUnits}`,
    { refreshInterval: 5000 }
  );

  const { data: divergenceFallback } = useApiData<unknown>(
    `/api/technicals/momentum-divergence?${symParam}`,
    { refreshInterval: 5000 }
  );

  const { data: divergenceDefault } = useApiData<unknown>(
    `/api/technicals/momentum-divergence`,
    { refreshInterval: 5000 }
  );

  const { data: smartMoneyData, error: smartMoneyError } = useApiData<SmartMoneyRow[]>(
    `/api/flow/smart-money?${symParam}&session=${sessionView}&limit=100`,
    { refreshInterval: 10000 }
  );
  const { data: smartMoneyFallbackData, error: smartMoneyFallbackError } = useApiData<SmartMoneyRow[]>(
    `/api/flow/smart-money?${symParam}&session=prior&limit=100`,
    { refreshInterval: 10000 }
  );
  const { rows: byContractRows } = useFlowByContractCache(symbol, sessionView);
  const otherSession = sessionView === 'current' ? 'prior' : 'current';
  const { data: otherSessionProbe } = useApiData<FlowByContractPoint[]>(
    `/api/flow/by-contract?${symParam}&session=${otherSession}&intervals=1`,
    { refreshInterval: 60000 },
  );

  const sessionDateLabel = useMemo(() => latestRowDateKey(byContractRows), [byContractRows]);
  const otherSessionDateLabel = useMemo(() => latestRowDateKey(otherSessionProbe), [otherSessionProbe]);

  const currentDateLabel = sessionView === 'current' ? sessionDateLabel : otherSessionDateLabel;
  const priorDateLabel = sessionView === 'prior' ? sessionDateLabel : otherSessionDateLabel;

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
      const normalizedA = typeof valueA === 'string' ? valueA.toLowerCase() : (valueA ?? 0);
      const normalizedB = typeof valueB === 'string' ? valueB.toLowerCase() : (valueB ?? 0);
      const comparison = normalizedA < normalizedB ? -1 : normalizedA > normalizedB ? 1 : 0;
      return smartMoneySortDir === 'asc' ? comparison : -comparison;
    });
    return rows;
  }, [filteredSmartMoneyData, smartMoneySortDir, smartMoneySortKey]);

  const smartMoneySessionChart = useMemo(() => {
    const rows = filteredSmartMoneyData;
    const priceByTs = buildUnderlyingPriceMap(byContractRows);
    if (rows.length === 0 && priceByTs.size === 0) return [];

    const blocksByTs = new Map<string, Array<{ notionalM: number; rowKey: string; optionType: string }>>();
    rows.forEach((row) => {
      const ts = row.minuteTimestamp;
      if (!ts) return;
      const blocks = blocksByTs.get(ts) ?? [];
      blocks.push({ notionalM: row.notionalM, rowKey: row.rowKey, optionType: String(row.option_type || '').toLowerCase() });
      blocksByTs.set(ts, blocks);
    });

    const allTs = Array.from(new Set([...blocksByTs.keys(), ...priceByTs.keys()])).sort((a, b) => a.localeCompare(b));
    const maxBlocksPerMinute = Math.max(1, ...Array.from(blocksByTs.values()).map((values) => values.length));

    return allTs.map((ts) => {
      const minuteBlocks = [...(blocksByTs.get(ts) || [])].sort((a, b) => b.notionalM - a.notionalM);
      const totalMinuteNotional = minuteBlocks.reduce((sum, value) => sum + value.notionalM, 0);

      const row: Record<string, number | string | null> = {
        timestamp: ts,
        time: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }),
        blockNotionalM: totalMinuteNotional,
        underlyingPrice: priceByTs.get(ts) ?? null,
      };

      for (let idx = 0; idx < maxBlocksPerMinute; idx += 1) {
        row[`block${idx + 1}`] = minuteBlocks[idx]?.notionalM ?? 0;
        row[`block${idx + 1}Key`] = minuteBlocks[idx]?.rowKey ?? '';
        row[`block${idx + 1}Type`] = minuteBlocks[idx]?.optionType ?? '';
      }
      return row;
    });
  }, [byContractRows, filteredSmartMoneyData]);

  const maxStackSegments = useMemo(() => {
    const raw = smartMoneySessionChart.reduce((max, row) => {
      const keys = Object.keys(row).filter((key) => key.startsWith('block') && !key.includes('Key') && !key.includes('Type') && Number(row[key] || 0) > 0);
      return Math.max(max, keys.length);
    }, 1);
    return Math.min(raw, 10);
  }, [smartMoneySessionChart]);

  const notionalTicks = useMemo(() => {
    const values = smartMoneySessionChart.map((row) => Number(row.blockNotionalM || 0)).filter((v) => v > 0);
    if (values.length === 0) return [0];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return generateNiceTicks(min, max);
  }, [smartMoneySessionChart]);

  const priceTicks = useMemo(() => {
    const values = smartMoneySessionChart
      .map((row) => row.underlyingPrice)
      .filter((v): v is number => v != null && Number.isFinite(v as number) && (v as number) > 0)
      .map(Number);
    if (values.length === 0) return [];
    const min = Math.min(...values);
    const max = Math.max(...values);
    return generateNiceTicks(min, max);
  }, [smartMoneySessionChart]);

  const dateMarkerMeta = useMemo(() => {
    return getDateMarkerMeta(smartMoneySessionChart.map((row) => String(row.timestamp)));
  }, [smartMoneySessionChart]);

  const volumeSpikesSessionDateKey = useMemo(() => {
    // Prefer the latest spike's date so the session timeline matches actual
    // spike data. If the latest price bar is on a newer day but no spikes
    // landed there yet (common for SPX outside its narrow RTH window), the
    // chart used to anchor on that newer day and filter every spike out.
    let latestSpikeMs = 0;
    (volumeSpikes || []).forEach((spike) => {
      const ts = spike.timestamp || spike.time_et;
      if (!ts) return;
      const ms = new Date(ts).getTime();
      if (Number.isFinite(ms) && ms > latestSpikeMs) latestSpikeMs = ms;
    });
    if (latestSpikeMs > 0) return getETDateKey(new Date(latestSpikeMs).toISOString());

    let latestPriceMs = 0;
    (volumeSpikesPriceBars || []).forEach((bar) => {
      if (!bar.timestamp) return;
      const ms = new Date(bar.timestamp).getTime();
      if (Number.isFinite(ms) && ms > latestPriceMs) latestPriceMs = ms;
    });
    if (latestPriceMs > 0) return getETDateKey(new Date(latestPriceMs).toISOString());

    return getCurrentSessionDateKey();
  }, [volumeSpikes, volumeSpikesPriceBars]);

  const volumeSpikesChart = useMemo(() => {
    const sessionTimeline = isIndexSymbol(symbol)
      ? getRegularSessionTimestamps(volumeSpikesSessionDateKey)
      : getExtendedSessionTimestamps(volumeSpikesSessionDateKey);
    if (sessionTimeline.length === 0) return [];

    const sessionStartMs = new Date(sessionTimeline[0]).getTime();
    const sessionEndMs = new Date(sessionTimeline[sessionTimeline.length - 1]).getTime();

    const spikeByTs = new Map<string, VolumeSpikeRow>();
    (volumeSpikes || []).forEach((spike) => {
      const ts = spike.timestamp || spike.time_et;
      if (!ts) return;
      const ms = new Date(ts).getTime();
      if (!Number.isFinite(ms) || ms < sessionStartMs || ms > sessionEndMs) return;
      const minute = normalizeToMinute(ts);
      if (!minute) return;
      const existing = spikeByTs.get(minute);
      if (!existing || (safeNum(spike.volume_sigma) ?? 0) > (safeNum(existing.volume_sigma) ?? 0)) {
        spikeByTs.set(minute, spike);
      }
    });

    const priceByTs = new Map<string, number>();
    for (const bar of volumeSpikesPriceBars || []) {
      const minute = normalizeToMinute(bar.timestamp);
      if (!minute) continue;
      const ms = new Date(minute).getTime();
      if (!Number.isFinite(ms) || ms < sessionStartMs || ms > sessionEndMs) continue;
      const close = safeNum(bar.close ?? bar.price);
      if (close == null) continue;
      priceByTs.set(minute, close);
    }

    return sessionTimeline.map((ts) => {
      const spike = spikeByTs.get(ts);
      const volume = spike ? safeNum(spike.current_volume) : null;
      const ratio = spike ? safeNum(spike.volume_ratio) : null;
      const sigma = spike ? safeNum(spike.volume_sigma) : null;
      const buyingPressure = spike ? safeNum(spike.buying_pressure_pct) : null;
      const observedPrice = priceByTs.get(ts);

      return {
        timestamp: ts,
        time: new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }),
        volume: volume ?? 0,
        volumeRaw: volume,
        volumeRatio: ratio,
        volumeSigma: sigma,
        volumeClass: spike?.volume_class ?? null,
        buyingPressurePct: buyingPressure,
        underlyingPrice: observedPrice != null && Number.isFinite(observedPrice) ? observedPrice : null,
      };
    });
  }, [volumeSpikes, volumeSpikesPriceBars, volumeSpikesSessionDateKey, symbol]);

  const volumeSpikesHasAnySpike = useMemo(
    () => volumeSpikesChart.some((row) => row.volumeRaw != null),
    [volumeSpikesChart],
  );

  const volumeSpikeVolumeTicks = useMemo(() => {
    const max = volumeSpikesChart.reduce((m, row) => Math.max(m, row.volume || 0), 0);
    if (max <= 0) return [0];
    const step = getDynamicStep(0, max);
    const top = Math.ceil(max / step) * step;
    const ticks: number[] = [];
    for (let t = 0; t <= top + step / 2 && ticks.length < 24; t += step) {
      ticks.push(Number(t.toPrecision(12)));
    }
    return ticks;
  }, [volumeSpikesChart]);

  const volumeSpikeLabelStepMin = useMemo(() => {
    const len = volumeSpikesChart.length;
    if (len <= 0) return 60;
    if (len <= 120) return 15;
    if (len <= 480) return 60;
    if (len <= 1440) return 120;
    return 240;
  }, [volumeSpikesChart]);

  const volumeSpikePriceTicks = useMemo(() => {
    const values = volumeSpikesChart
      .map((row) => row.underlyingPrice)
      .filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
    if (values.length === 0) return [];
    const ticks = generateNiceTicks(Math.min(...values), Math.max(...values));
    if (ticks.length <= 2) return ticks;
    return ticks.slice(1, -1);
  }, [volumeSpikesChart]);

  const volumeSpikeDateMarkerMeta = useMemo(() => {
    return getDateMarkerMeta(volumeSpikesChart.map((row) => String(row.timestamp)));
  }, [volumeSpikesChart]);

  const vwapChart = useMemo(() => {
    const timeline = isIndexSymbol(symbol)
      ? getRegularSessionTimestamps(volumeSpikesSessionDateKey)
      : getExtendedSessionTimestamps(volumeSpikesSessionDateKey);
    if (timeline.length === 0) return [] as Array<{
      timestamp: string;
      price: number | null;
      vwap: number | null;
      channelAbove: [number, number] | null;
      channelBelow: [number, number] | null;
      deviationPct: number | null;
    }>;

    const rthStartMs = getETTimeTimestamp(volumeSpikesSessionDateKey, 9, 30);
    const rthEndMs = getETTimeTimestamp(volumeSpikesSessionDateKey, 16, 0);

    const barByMinute = new Map<string, { price: number; typical: number; volume: number }>();
    for (const bar of volumeSpikesPriceBars || []) {
      const minute = normalizeToMinute(bar.timestamp);
      if (!minute) continue;
      const close = safeNum(bar.close ?? bar.price);
      if (close == null) continue;
      const high = safeNum(bar.high) ?? close;
      const low = safeNum(bar.low) ?? close;
      const volume = Math.max(0, safeNum(bar.volume) ?? 0);
      barByMinute.set(minute, { price: close, typical: (high + low + close) / 3, volume });
    }

    let cumPv = 0;
    let cumV = 0;
    return timeline.map((ts) => {
      const ms = new Date(ts).getTime();
      const inRth = rthStartMs != null && rthEndMs != null && ms >= rthStartMs && ms <= rthEndMs;
      const bar = barByMinute.get(ts);
      if (bar && inRth && bar.volume > 0) {
        cumPv += bar.typical * bar.volume;
        cumV += bar.volume;
      }
      const vwap = inRth && cumV > 0 ? cumPv / cumV : null;
      const price = bar?.price ?? null;
      const hasBoth = price != null && vwap != null;
      const channelAbove: [number, number] | null = hasBoth && price >= vwap ? [vwap, price] : null;
      const channelBelow: [number, number] | null = hasBoth && price < vwap ? [price, vwap] : null;
      const deviationPct = hasBoth && vwap !== 0 ? ((price - vwap) / vwap) * 100 : null;
      return { timestamp: ts, price, vwap, channelAbove, channelBelow, deviationPct };
    });
  }, [volumeSpikesPriceBars, volumeSpikesSessionDateKey, symbol]);

  const vwapPriceTicks = useMemo(() => {
    const values: number[] = [];
    for (const row of vwapChart) {
      if (row.price != null) values.push(row.price);
      if (row.vwap != null) values.push(row.vwap);
    }
    if (values.length === 0) return [] as number[];
    return generateNiceTicks(Math.min(...values), Math.max(...values));
  }, [vwapChart]);

  const orbChart = useMemo(() => {
    const timeline = isIndexSymbol(symbol)
      ? getRegularSessionTimestamps(volumeSpikesSessionDateKey)
      : getExtendedSessionTimestamps(volumeSpikesSessionDateKey);
    if (timeline.length === 0) return [] as Array<{ timestamp: string; price: number | null }>;

    const priceByTs = new Map<string, number>();
    for (const bar of volumeSpikesPriceBars || []) {
      const minute = normalizeToMinute(bar.timestamp);
      if (!minute) continue;
      const close = safeNum(bar.close ?? bar.price);
      if (close == null) continue;
      priceByTs.set(minute, close);
    }

    return timeline.map((ts) => ({ timestamp: ts, price: priceByTs.get(ts) ?? null }));
  }, [volumeSpikesPriceBars, volumeSpikesSessionDateKey, symbol]);

  const orbPriceTicks = useMemo(() => {
    if (!orb) return [] as number[];
    const values: number[] = [orb.orb_high, orb.orb_low];
    for (const row of orbChart) if (row.price != null) values.push(row.price);
    const filtered = values.filter((v) => Number.isFinite(v) && v > 0);
    if (filtered.length === 0) return [] as number[];
    const padding = orb.orb_range > 0 ? orb.orb_range * 0.25 : 0;
    return generateNiceTicks(Math.min(...filtered) - padding, Math.max(...filtered) + padding);
  }, [orbChart, orb]);

  const renderTimelineTick = (props: { x?: number | string; y?: number | string; payload?: { value?: string | number }; index?: number }) => {
    const x = Number(props?.x ?? 0); const y = Number(props?.y ?? 0);
    const ts = String(props?.payload?.value || '');
    const index = Number(props?.index ?? -1);
    const d = ts ? new Date(ts) : null;
    const minOfDay = d && !Number.isNaN(d.getTime()) ? d.getUTCHours() * 60 + d.getUTCMinutes() : -1;
    const showTime = minOfDay >= 0 && minOfDay % volumeSpikeLabelStepMin === 0;
    const timeLabel = showTime ? d!.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '';
    const dateLabel = volumeSpikeDateMarkerMeta.get(index);
    if (!timeLabel && !dateLabel) return <g transform={`translate(${x},${y})`} />;
    return (
      <g transform={`translate(${x},${y})`}>
        <line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} />
        {timeLabel ? <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>{timeLabel}</text> : null}
        {dateLabel ? <text dy={timeLabel ? 26 : 14} textAnchor="middle" fill={mutedText} fontSize={9}>{dateLabel}</text> : null}
      </g>
    );
  };

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

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">VWAP Analysis</h2>
        {vwapError ? (
          <ErrorMessage message={vwapError} />
        ) : !vwap ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>
            No VWAP data available (market may be closed)
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <MetricCard title="Current Price" value={`$${fmtFixed(vwap.price)}`} tooltip="Current market price" />
              <MetricCard title="VWAP" value={`$${fmtFixed(vwap.vwap)}`} tooltip="Volume weighted average price" />
              <MetricCard title="Deviation" value={`${fmtFixed(vwap.vwap_deviation_pct)}%`} trend={Math.abs(safeNum(vwap.vwap_deviation_pct) ?? 0) > 0.2 ? 'bearish' : 'neutral'} tooltip="Percentage deviation from VWAP" />
              <MetricCard title="Position" value={vwap.vwap_position ?? '--'} tooltip="Price position relative to VWAP" />
            </div>
            {vwapChart.length > 0 ? (
              <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>VWAP VS UNDERLYING PRICE</h3>
                  <TooltipWrapper text="Session VWAP (yellow dashed) vs underlying price (white). The shaded channel highlights how far above (green) or below (red) VWAP the price is tracking. VWAP resets at 9:30 ET."><Info size={14} /></TooltipWrapper>
                </div>
                <MobileScrollableChart>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={vwapChart} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                      <defs>
                        <linearGradient id="vwapAboveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-bull)" stopOpacity={0.45} />
                          <stop offset="100%" stopColor="var(--color-bull)" stopOpacity={0.05} />
                        </linearGradient>
                        <linearGradient id="vwapBelowGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-bear)" stopOpacity={0.05} />
                          <stop offset="100%" stopColor="var(--color-bear)" stopOpacity={0.45} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={renderTimelineTick} />
                      <YAxis stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} domain={['auto', 'auto']} ticks={vwapPriceTicks.length ? vwapPriceTicks : undefined} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
                      <Tooltip
                        cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
                        content={({ active, label, payload }) => {
                          if (!active || !payload?.length) return null;
                          const point = payload[0]?.payload as { price: number | null; vwap: number | null; deviationPct: number | null } | undefined;
                          if (!point) return null;
                          const labelStr = label ? new Date(String(label)).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '--';
                          const devColor = point.deviationPct == null ? mutedText : point.deviationPct >= 0 ? 'var(--color-bull)' : 'var(--color-bear)';
                          return (
                            <div style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }} className="rounded-lg border px-3 py-2 text-sm">
                              <div className="font-semibold mb-1">{labelStr}</div>
                              <div>Price: {point.price != null ? `$${point.price.toFixed(2)}` : '--'}</div>
                              <div>VWAP: {point.vwap != null ? `$${point.vwap.toFixed(2)}` : '--'}</div>
                              <div style={{ color: devColor }}>Deviation: {point.deviationPct != null ? `${point.deviationPct >= 0 ? '+' : ''}${point.deviationPct.toFixed(2)}%` : '--'}</div>
                            </div>
                          );
                        }}
                      />
                      <Area dataKey="channelAbove" stroke="none" fill="url(#vwapAboveGrad)" connectNulls={false} isAnimationActive={false} activeDot={false} />
                      <Area dataKey="channelBelow" stroke="none" fill="url(#vwapBelowGrad)" connectNulls={false} isAnimationActive={false} activeDot={false} />
                      <Line type="monotone" dataKey="vwap" name="VWAP" stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls isAnimationActive={false} />
                      <Line type="monotone" dataKey="price" name="Price" stroke="var(--color-text-primary)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </MobileScrollableChart>
              </div>
            ) : null}
          </>
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
              <MetricCard title="Current Price" value={`$${fmtFixed(orb.current_price)}`} tooltip="Current market price" />
              <MetricCard title="ORB High" value={`$${fmtFixed(orb.orb_high)}`} subtitle={`+${fmtFixed(orb.distance_above_orb_high)}`} tooltip="Opening range high" />
              <MetricCard title="ORB Low" value={`$${fmtFixed(orb.orb_low)}`} subtitle={`-${fmtFixed(orb.distance_below_orb_low)}`} tooltip="Opening range low" />
              <MetricCard title="ORB Range" value={`$${fmtFixed(orb.orb_range)}`} tooltip="Opening range size" />
            </div>
            {orbChart.length > 0 ? (
              <div className="rounded-lg p-6 mb-4" style={{ backgroundColor: cardBg }}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>ORB BREAKOUT MAP</h3>
                  <TooltipWrapper text="The shaded yellow zone is the opening 30-minute range. The white line is the underlying price through the session. A clean break above the green line confirms a long breakout; a break below the red line confirms a short."><Info size={14} /></TooltipWrapper>
                </div>
                <MobileScrollableChart>
                  <ResponsiveContainer width="100%" height={320}>
                    <ComposedChart data={orbChart} margin={{ top: 8, right: 56, left: 0, bottom: 8 }}>
                      <defs>
                        <linearGradient id="orbZoneGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-warning)" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="var(--color-warning)" stopOpacity={0.08} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={renderTimelineTick} />
                      <YAxis stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} domain={['auto', 'auto']} ticks={orbPriceTicks.length ? orbPriceTicks : undefined} tickFormatter={(v) => `$${Number(v).toFixed(2)}`} />
                      <Tooltip
                        cursor={{ stroke: 'var(--color-text-primary)', strokeOpacity: 0.2 }}
                        content={({ active, label, payload }) => {
                          if (!active || !payload?.length) return null;
                          const point = payload[0]?.payload as { price: number | null } | undefined;
                          if (!point) return null;
                          const labelStr = label ? new Date(String(label)).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '--';
                          const distHigh = point.price != null ? point.price - orb.orb_high : null;
                          const distLow = point.price != null ? point.price - orb.orb_low : null;
                          const zone = point.price == null ? null : point.price > orb.orb_high ? 'Above ORB High' : point.price < orb.orb_low ? 'Below ORB Low' : 'Inside ORB Range';
                          const zoneColor = zone === 'Above ORB High' ? 'var(--color-bull)' : zone === 'Below ORB Low' ? 'var(--color-bear)' : 'var(--color-warning)';
                          return (
                            <div style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }} className="rounded-lg border px-3 py-2 text-sm">
                              <div className="font-semibold mb-1">{labelStr}</div>
                              <div>Price: {point.price != null ? `$${point.price.toFixed(2)}` : '--'}</div>
                              {distHigh != null ? <div>vs High: {distHigh >= 0 ? '+' : ''}${'$'}{distHigh.toFixed(2)}</div> : null}
                              {distLow != null ? <div>vs Low: {distLow >= 0 ? '+' : ''}${'$'}{distLow.toFixed(2)}</div> : null}
                              {zone ? <div style={{ color: zoneColor }}>{zone}</div> : null}
                            </div>
                          );
                        }}
                      />
                      <ReferenceArea y1={orb.orb_low} y2={orb.orb_high} fill="url(#orbZoneGrad)" stroke="var(--color-warning)" strokeOpacity={0.35} strokeDasharray="2 4" />
                      <ReferenceLine y={orb.orb_high} stroke="var(--color-bull)" strokeWidth={1.5} strokeDasharray="5 3" label={{ value: `H $${orb.orb_high.toFixed(2)}`, position: 'right', fill: 'var(--color-bull)', fontSize: 11, fontWeight: 600 }} />
                      <ReferenceLine y={orb.orb_low} stroke="var(--color-bear)" strokeWidth={1.5} strokeDasharray="5 3" label={{ value: `L $${orb.orb_low.toFixed(2)}`, position: 'right', fill: 'var(--color-bear)', fontSize: 11, fontWeight: 600 }} />
                      <Line type="monotone" dataKey="price" name="Price" stroke="var(--color-text-primary)" strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </MobileScrollableChart>
              </div>
            ) : null}
            <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
              {(() => {
                const range = Number.isFinite(orb.orb_range) && orb.orb_range > 0 ? orb.orb_range : 1;
                const lowEdge = orb.orb_low - range;
                const highEdge = orb.orb_high + range;
                const span = Math.max(1e-9, highEdge - lowEdge);
                const pct = (v: number) => Math.max(0, Math.min(100, ((v - lowEdge) / span) * 100));
                const lowPct = pct(orb.orb_low);
                const highPct = pct(orb.orb_high);
                const pricePct = pct(orb.current_price);
                const status = orb.orb_status ?? '--';
                const statusColor = status.includes('🚀') ? 'var(--color-bull)' : status.includes('💥') ? 'var(--color-bear)' : 'var(--color-warning)';
                return (
                  <div>
                    <div className="flex items-baseline justify-between mb-3">
                      <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>Position Within Range</h3>
                      <div className="text-sm" style={{ color: statusColor, fontWeight: 600 }}>{status}</div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-wider mb-2" style={{ color: mutedText }}>
                      <span>Below Range</span>
                      <span>Inside Range</span>
                      <span>Above Range</span>
                    </div>
                    <div
                      className="relative h-5 rounded-full overflow-visible"
                      style={{ background: 'linear-gradient(to right, var(--color-bear) 0%, color-mix(in srgb, var(--color-bear) 30%, transparent) 33%, color-mix(in srgb, var(--color-warning) 35%, transparent) 50%, color-mix(in srgb, var(--color-bull) 30%, transparent) 67%, var(--color-bull) 100%)' }}
                    >
                      <div className="absolute top-0 bottom-0 w-px" style={{ left: `${lowPct}%`, backgroundColor: 'var(--color-text-primary)', opacity: 0.45 }} />
                      <div className="absolute top-0 bottom-0 w-px" style={{ left: `${highPct}%`, backgroundColor: 'var(--color-text-primary)', opacity: 0.45 }} />
                      <div
                        className="absolute -top-1 -bottom-1 w-1 -translate-x-1/2 rounded"
                        style={{ left: `${pricePct}%`, backgroundColor: 'var(--color-text-primary)', boxShadow: '0 0 10px rgba(255,255,255,0.55)' }}
                      />
                    </div>
                    <div className="relative h-5 mt-2 text-[10px]" style={{ color: mutedText }}>
                      <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${lowPct}%` }}>${orb.orb_low.toFixed(2)}</span>
                      <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${highPct}%` }}>${orb.orb_high.toFixed(2)}</span>
                      <span className="absolute -translate-x-1/2 whitespace-nowrap font-semibold" style={{ left: `${pricePct}%`, color: textColor }}>
                        ${orb.current_price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Unusual Volume Spikes</h2>
        {volumeSpikesError ? (
          <ErrorMessage message={volumeSpikesError} />
        ) : volumeSpikes == null && volumeSpikesLoading ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>
            Loading volume spikes...
          </div>
        ) : !volumeSpikesHasAnySpike ? (
          <div className="rounded-lg p-6 text-center" style={{ backgroundColor: cardBg, color: mutedText }}>
            No unusual volume detected
          </div>
        ) : (
          <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>VOLUME SPIKES VS UNDERLYING PRICE</h3>
              <TooltipWrapper text="Bars show spike volume by minute (taller = larger spike). Bar color reflects how unusual the spike is in standard deviations. The yellow line overlays the underlying price on the right axis. Hover any bar for full detail."><Info size={14} /></TooltipWrapper>
            </div>
            <MobileScrollableChart>
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={volumeSpikesChart} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={(props: { x?: number | string; y?: number | string; payload?: { value?: string | number }; index?: number }) => {
                    const x = Number(props?.x ?? 0); const y = Number(props?.y ?? 0); const ts = String(props?.payload?.value || ''); const index = Number(props?.index ?? -1);
                    const d = ts ? new Date(ts) : null;
                    const minOfDay = d && !Number.isNaN(d.getTime()) ? d.getUTCHours() * 60 + d.getUTCMinutes() : -1;
                    const showTime = minOfDay >= 0 && minOfDay % volumeSpikeLabelStepMin === 0;
                    const timeLabel = showTime ? d!.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '';
                    const dateLabel = volumeSpikeDateMarkerMeta.get(index);
                    if (!timeLabel && !dateLabel) return <g transform={`translate(${x},${y})`} />;
                    return <g transform={`translate(${x},${y})`}><line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} />{timeLabel ? <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>{timeLabel}</text> : null}{dateLabel ? <text dy={timeLabel ? 26 : 14} textAnchor="middle" fill={mutedText} fontSize={9}>{dateLabel}</text> : null}</g>;
                  }} />
                  <YAxis yAxisId="volume" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} ticks={volumeSpikeVolumeTicks} domain={volumeSpikeVolumeTicks.length ? [volumeSpikeVolumeTicks[0], volumeSpikeVolumeTicks[volumeSpikeVolumeTicks.length - 1]] : [0, 'auto']} tickFormatter={(v) => {
                    const n = Number(v);
                    if (!Number.isFinite(n)) return '--';
                    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
                    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
                    return String(n);
                  }} />
                  <YAxis yAxisId="price" orientation="right" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} domain={["auto", "auto"]} ticks={volumeSpikePriceTicks.length ? volumeSpikePriceTicks : undefined} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                  <Tooltip
                    cursor={{ fill: 'var(--color-text-primary)', fillOpacity: 0.08 }}
                    content={({ active, label, payload }) => {
                      if (!active || !payload?.length) return null;
                      const point = payload[0]?.payload as {
                        volumeRaw: number | null;
                        volumeRatio: number | null;
                        volumeSigma: number | null;
                        volumeClass: string | null;
                        buyingPressurePct: number | null;
                        underlyingPrice: number | null;
                      } | undefined;
                      if (!point) return null;
                      const labelStr = label ? new Date(String(label)).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '--';
                      const hasSpike = point.volumeRaw != null;
                      return (
                        <div style={{ backgroundColor: 'var(--color-chart-tooltip-bg)', borderColor: 'var(--color-border)', color: 'var(--color-chart-tooltip-text)' }} className="rounded-lg border px-3 py-2 text-sm">
                          <div className="font-semibold mb-1">{labelStr}</div>
                          {hasSpike ? (
                            <>
                              <div>Volume: {point.volumeRaw!.toLocaleString()}</div>
                              {point.volumeRatio != null ? <div>Ratio: {point.volumeRatio.toFixed(1)}x avg</div> : null}
                              {point.volumeSigma != null ? <div>Sigma: {point.volumeSigma.toFixed(1)}σ</div> : null}
                              {point.volumeClass ? <div>Class: {point.volumeClass}</div> : null}
                              {point.buyingPressurePct != null ? <div>Buying Pressure: {point.buyingPressurePct.toFixed(1)}%</div> : null}
                            </>
                          ) : (
                            <div style={{ color: mutedText }}>No spike at this minute</div>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Bar yAxisId="volume" dataKey="volume" name="Spike Volume" barSize={14} isAnimationActive={false}>
                    {volumeSpikesChart.map((row, idx) => {
                      const sigma = row.volumeSigma ?? 0;
                      const fill = sigma >= 4 ? 'var(--color-bear)' : sigma >= 3 ? 'var(--color-warning)' : sigma >= 2 ? 'var(--color-positive)' : 'var(--color-text-secondary)';
                      const opacity = row.volumeRaw == null ? 0 : 0.95;
                      return <Cell key={`vol-cell-${idx}`} fill={fill} fillOpacity={opacity} />;
                    })}
                  </Bar>
                  <Line yAxisId="price" type="monotone" dataKey="underlyingPrice" name="Underlying" stroke="var(--color-warning)" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </MobileScrollableChart>
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
                        divergenceSignal.includes('🚨') ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]' :
                        divergenceSignal.includes('🟢') ? 'bg-[var(--color-bull-soft)] text-[var(--color-bull)]' :
                        divergenceSignal.includes('🔴') ? 'bg-[var(--color-bear-soft)] text-[var(--color-bear)]' :
                        'bg-[var(--bg-card)] text-[var(--color-text-secondary)]'
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
