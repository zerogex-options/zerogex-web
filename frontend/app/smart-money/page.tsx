'use client';

import { useEffect, useMemo, useState } from 'react';
import { Filter, Info } from 'lucide-react';
import { Bar, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import { useMarketHistorical } from '@/hooks/useMarketHistorical';
import {
  useFlowByContractCache,
  latestRowDateKey,
  type FlowByContractPoint,
} from '@/hooks/useFlowByContract';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import { normalizeToMinute, getSessionTimestamps } from '@/core/utils';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';
import MobileScrollableChart from '@/components/MobileScrollableChart';
import RegimeSummaryBanner from '@/components/RegimeSummaryBanner';

interface SmartMoneyRow {
  timestamp?: string;
  symbol?: string;
  contract?: string;
  strike?: number | null;
  expiration?: string | null;
  dte?: number | null;
  option_type?: string | null;
  flow?: number | null;
  total_volume?: number | null;
  notional?: number | null;
  total_premium?: number | null;
  trade_side?: string | null;
  delta?: number | null;
  score?: number | null;
  underlying_price?: number | null;
  notional_class?: string | null;
  size_class?: string | null;
  time_window_start?: string;
  time_window_end?: string;
  interval_timestamp?: string | null;
}
interface NormalizedSmartMoneyRow extends SmartMoneyRow { rowKey: string; minuteTimestamp: string | null; notionalM: number; absNotional: number; }
interface SmartMoneyBlockMeta {
  rowKey: string;
  contract: string;
  flow: number;
  notionalM: number;
  optionType: string;
}
type SmartMoneySortKey = 'timestamp' | 'contract' | 'strike' | 'expiration' | 'dte' | 'option_type' | 'flow' | 'notional' | 'notional_class';
type SortLevel = { key: SmartMoneySortKey; dir: 'asc' | 'desc' };
const MAX_SORT_LEVELS = 3;
type MinClassFilter = '500k' | '250k' | '100k' | '50k' | 'under50k';
type FilterableKey = 'strike' | 'expiration' | 'option_type';
const FILTERABLE_KEYS: readonly FilterableKey[] = ['strike', 'expiration', 'option_type'] as const;

type SmartMoneyColumn = { key: SmartMoneySortKey; label: string; align: 'left' | 'right'; filterable?: boolean };
const smartMoneyColumns: SmartMoneyColumn[] = [
  { key: 'timestamp', label: 'Time', align: 'left' },
  { key: 'contract', label: 'Contract', align: 'left' },
  { key: 'strike', label: 'Strike', align: 'left', filterable: true },
  { key: 'expiration', label: 'Expiration', align: 'left', filterable: true },
  { key: 'dte', label: 'DTE', align: 'left' },
  { key: 'option_type', label: 'Type', align: 'left', filterable: true },
  { key: 'flow', label: 'Contracts', align: 'right' },
  { key: 'notional', label: 'Notional', align: 'right' },
  { key: 'notional_class', label: 'Class', align: 'left' },
];

function getCellDisplayValue(row: SmartMoneyRow, key: SmartMoneySortKey): string {
  switch (key) {
    case 'timestamp': {
      const ts = row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start;
      return ts ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '';
    }
    case 'contract': return row.contract || '';
    case 'strike': return row.strike != null ? Number(row.strike).toFixed(0) : '';
    case 'expiration': return row.expiration || '';
    case 'dte': return row.dte != null ? String(row.dte) : '';
    case 'option_type': {
      const t = String(row.option_type || '').toUpperCase();
      return t === 'P' ? 'Put' : t === 'C' ? 'Call' : (row.option_type || '');
    }
    case 'flow': return Number(row.flow || 0).toLocaleString();
    case 'notional': return `$${(Number(row.notional || 0) / 1_000_000).toFixed(2)}M`;
    case 'notional_class': return row.notional_class || '';
    default: return '';
  }
}

function getRowContracts(row: SmartMoneyRow): number {
  return Number(row.flow ?? row.total_volume ?? 0);
}

function getRowNotional(row: SmartMoneyRow): number {
  return Number(row.notional ?? row.total_premium ?? 0);
}

function getRowClass(row: SmartMoneyRow): string {
  return String(row.notional_class || row.size_class || '--');
}

function getRowContractLabel(row: SmartMoneyRow): string {
  if (row.contract) return row.contract;
  const symbol = row.symbol || '--';
  const strike = row.strike != null ? Number(row.strike).toFixed(0) : '--';
  const optionType = String(row.option_type || '').toUpperCase();
  return `${symbol} ${strike}${optionType ? ` ${optionType}` : ''}`.trim();
}

const smartMoneyTimestamp = (row: SmartMoneyRow) => normalizeToMinute(row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start);
const getETDateKey = (ts: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
const latestTimestamp = (timestamps: string[]) => timestamps.reduce<string>((latest, ts) => (new Date(ts).getTime() > new Date(latest).getTime() ? ts : latest), timestamps[0] || '');
const is30MinBoundary = (ts: string) => { const d = new Date(ts); return d.getUTCMinutes() === 0 || d.getUTCMinutes() === 30; };

// Skip a refresh-driven state update when the new payload's endpoints match
// the previous one. The smart-money feed is append-mostly within a session,
// so identical length + identical first/last row fingerprints is a reliable
// "no change" signal and avoids re-running every downstream useMemo.
function isSameSmartMoneySnapshot(next: SmartMoneyRow[], prev: SmartMoneyRow[] | null): boolean {
  if (!prev || prev.length !== next.length) return false;
  if (next.length === 0) return true;
  const a0 = next[0]; const aN = next[next.length - 1];
  const b0 = prev[0]; const bN = prev[prev.length - 1];
  return (
    a0.timestamp === b0.timestamp && a0.contract === b0.contract && a0.notional === b0.notional &&
    aN.timestamp === bN.timestamp && aN.contract === bN.contract && aN.notional === bN.notional
  );
}
const acceptSmartMoneySnapshot = (next: SmartMoneyRow[], prev: SmartMoneyRow[] | null) => !isSameSmartMoneySnapshot(next, prev);

function getETTimeTimestamp(dateKey: string, etHour: number, etMinute: number): number | null {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return null;
  const etFmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false });
  const candidateHours = Array.from(new Set([etHour + 4, etHour + 5])).filter((h) => h >= 0 && h <= 23);
  for (const utcHour of candidateHours) {
    const candidate = Date.UTC(y, m - 1, d, utcHour, etMinute);
    const parts = etFmt.formatToParts(new Date(candidate));
    const h = Number(parts.find((p) => p.type === 'hour')?.value ?? -1);
    const min = Number(parts.find((p) => p.type === 'minute')?.value ?? -1);
    if (h === etHour && min === etMinute) return candidate;
  }
  return null;
}

function extendTimelineToSessionClose(timeline: string[], dateKey: string): string[] {
  if (timeline.length === 0) return timeline;
  const targetMs = getETTimeTimestamp(dateKey, 16, 15);
  if (targetMs == null) return timeline;
  const extended = [...timeline];
  let cursor = new Date(extended[extended.length - 1]).getTime();
  if (!Number.isFinite(cursor)) return timeline;
  while (cursor < targetMs) {
    cursor += 60_000;
    extended.push(new Date(cursor).toISOString());
  }
  return extended;
}

const minClassOptions: Array<{ value: MinClassFilter; label: string }> = [
  { value: '500k', label: '💰 $500K+' },
  { value: '250k', label: '💵 $250K+' },
  { value: '100k', label: '💸 $100K+' },
  { value: '50k', label: '💳 $50K+' },
  { value: 'under50k', label: '💴 <$50K' },
];

function matchesMinClass(absNotional: number, minClass: MinClassFilter): boolean {
  if (minClass === '500k') return absNotional >= 500_000;
  if (minClass === '250k') return absNotional >= 250_000;
  if (minClass === '100k') return absNotional >= 100_000;
  if (minClass === '50k') return absNotional >= 50_000;
  return absNotional >= 0;
}

export default function SmartMoneyPage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? 'var(--color-surface)' : 'var(--color-surface)';
  const inputBg = 'var(--color-surface-subtle)';
  const inputBorder = 'var(--color-border)';
  const inputColor = 'var(--color-text-primary)';
  const axisStroke = isDark ? 'var(--color-text-primary)' : 'var(--color-text-primary)';
  const mutedText = isDark ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)';
  const textColor = isDark ? 'var(--color-text-primary)' : 'var(--color-surface)';
  const [sortStack, setSortStack] = useState<SortLevel[]>([{ key: 'notional', dir: 'desc' }]);
  const [columnFilters, setColumnFilters] = useState<Record<FilterableKey, string>>({ strike: '', expiration: '', option_type: '' });
  const [openFilter, setOpenFilter] = useState<FilterableKey | null>(null);
  const [minClass, setMinClass] = useState<MinClassFilter>('500k');

  useEffect(() => {
    if (!openFilter) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('[data-smart-money-filter]')) setOpenFilter(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openFilter]);
  const [sessionView, setSessionView] = useState<'current' | 'prior'>('current');
  const [tableRowLimit, setTableRowLimit] = useState(50);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);

  const symParam = `symbol=${encodeURIComponent(symbol)}&underlying=${encodeURIComponent(symbol)}`;
  const { data: smartMoneyData, error: smartMoneyError } = useApiData<SmartMoneyRow[]>(`/api/flow/smart-money?${symParam}&session=${sessionView}`, { refreshInterval: 10000, shouldAcceptData: acceptSmartMoneySnapshot });
  const { data: smartMoneyLimitedData, error: smartMoneyLimitedError } = useApiData<SmartMoneyRow[]>(
    `/api/flow/smart-money?${symParam}&session=${sessionView}&limit=100`,
    { refreshInterval: 10000, enabled: Boolean(smartMoneyError), shouldAcceptData: acceptSmartMoneySnapshot }
  );
  const { data: smartMoneyNoSessionData, error: smartMoneyNoSessionError } = useApiData<SmartMoneyRow[]>(`/api/flow/smart-money?${symParam}&limit=100`, { refreshInterval: 10000, enabled: Boolean(smartMoneyError) && !smartMoneyLimitedData?.length, shouldAcceptData: acceptSmartMoneySnapshot });
  const { rows: smartMoneyPriceBars } = useMarketHistorical(symbol, '5min');
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

  const effectiveSmartMoneyRows = useMemo(
    () => (smartMoneyError ? (smartMoneyLimitedData || smartMoneyNoSessionData || []) : (smartMoneyData || [])),
    [smartMoneyError, smartMoneyLimitedData, smartMoneyNoSessionData, smartMoneyData]
  );
  const effectiveSmartMoneyError = smartMoneyError && smartMoneyLimitedError && smartMoneyNoSessionError ? smartMoneyError : null;

  const normalizedSmartMoneyRows = useMemo<NormalizedSmartMoneyRow[]>(() => effectiveSmartMoneyRows.map((row, idx) => {
    const rowNotional = Math.abs(getRowNotional(row));
    return {
      ...row,
      contract: getRowContractLabel(row),
      flow: getRowContracts(row),
      notional: rowNotional,
      notional_class: getRowClass(row),
      rowKey: `${smartMoneyTimestamp(row) ?? 'na'}-${row.contract ?? 'contract'}-${idx}`,
      minuteTimestamp: smartMoneyTimestamp(row),
      notionalM: rowNotional / 1_000_000,
      absNotional: rowNotional,
    };
  }), [effectiveSmartMoneyRows]);

  const filteredSmartMoneyData = useMemo<NormalizedSmartMoneyRow[]>(() => normalizedSmartMoneyRows.filter((row) => matchesMinClass(row.absNotional, minClass)), [normalizedSmartMoneyRows, minClass]);

  const sessionDateKey = useMemo(() => {
    if (sessionDateLabel) return sessionDateLabel;
    const candidates = filteredSmartMoneyData
      .map((row) => row.minuteTimestamp || row.timestamp || '')
      .filter(Boolean);
    if (!candidates.length) return null;
    return getETDateKey(latestTimestamp(candidates));
  }, [sessionDateLabel, filteredSmartMoneyData]);

  const sessionTimeline = useMemo(
    () => (sessionDateKey ? extendTimelineToSessionClose(getSessionTimestamps(sessionDateKey), sessionDateKey) : []),
    [sessionDateKey],
  );

  const uniqueFilterValues = useMemo(() => {
    const sets: Record<FilterableKey, Set<string>> = { strike: new Set(), expiration: new Set(), option_type: new Set() };
    for (const row of filteredSmartMoneyData) {
      for (const key of FILTERABLE_KEYS) {
        const value = getCellDisplayValue(row, key);
        if (value) sets[key].add(value);
      }
    }
    return {
      strike: Array.from(sets.strike).sort((a, b) => Number(a) - Number(b)),
      expiration: Array.from(sets.expiration).sort(),
      option_type: Array.from(sets.option_type).sort(),
    } as Record<FilterableKey, string[]>;
  }, [filteredSmartMoneyData]);

  const sortedSmartMoneyRows = useMemo(() => {
    const rows = filteredSmartMoneyData.filter((row) => {
      for (const key of FILTERABLE_KEYS) {
        const selected = columnFilters[key];
        if (selected && getCellDisplayValue(row, key) !== selected) return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      for (const { key, dir } of sortStack) {
        const valueA = a[key];
        const valueB = b[key];
        const normalizedA = typeof valueA === 'string' ? valueA.toLowerCase() : (valueA ?? 0);
        const normalizedB = typeof valueB === 'string' ? valueB.toLowerCase() : (valueB ?? 0);
        const comparison = normalizedA < normalizedB ? -1 : normalizedA > normalizedB ? 1 : 0;
        if (comparison !== 0) return dir === 'asc' ? comparison : -comparison;
      }
      return 0;
    });
    return rows;
  }, [filteredSmartMoneyData, sortStack, columnFilters]);

  const smartMoneySessionChart = useMemo(() => {
    const blocksByTs = new Map<string, SmartMoneyBlockMeta[]>();
    filteredSmartMoneyData.forEach((row) => {
      if (!row.minuteTimestamp) return;
      const blocks = blocksByTs.get(row.minuteTimestamp) ?? [];
      blocks.push({
        rowKey: row.rowKey,
        contract: row.contract || '--',
        flow: Number(row.flow || 0),
        notionalM: row.notionalM,
        optionType: String(row.option_type || '').toUpperCase(),
      });
      blocksByTs.set(row.minuteTimestamp, blocks);
    });
    // Pull underlying price from /api/market/historical 5-min bars: plot each
    // bar's close at the bar's normalized minute, leave the 4 in-between
    // minutes null, and let connectNulls + type="monotone" smooth across them.
    const priceByTs = new Map<string, number>();
    for (const bar of smartMoneyPriceBars || []) {
      const minute = normalizeToMinute(bar.timestamp);
      if (!minute) continue;
      const close = bar.close ?? bar.price;
      if (close == null) continue;
      const u = Number(close);
      if (Number.isFinite(u)) priceByTs.set(minute, u);
    }
    const maxBlocksPerMinute = Math.max(1, ...Array.from(blocksByTs.values()).map((values) => values.length));
    // Leave gaps as nulls between observations; Recharts' connectNulls + type="monotone"
    // draws a true smooth curve across the sparse points (matching the Options Flow line).
    return sessionTimeline.map((ts) => {
      // Sort largest -> smallest so any segment cap trims from the smallest tail.
      const minuteBlocks = [...(blocksByTs.get(ts) || [])].sort((a, b) => b.notionalM - a.notionalM);
      const observed = priceByTs.get(ts);
      const row: Record<string, number | string | null | SmartMoneyBlockMeta> = {
        timestamp: ts,
        underlyingPrice: observed != null && Number.isFinite(observed) ? observed : null,
      };
      for (let j = 0; j < maxBlocksPerMinute; j += 1) {
        const block = minuteBlocks[j];
        row[`block${j + 1}`] = block?.notionalM ?? 0;
        row[`blockMeta${j + 1}`] = block ?? { rowKey: '', contract: '--', flow: 0, notionalM: 0, optionType: '' };
      }
      return row;
    });
  }, [filteredSmartMoneyData, smartMoneyPriceBars, sessionTimeline]);

  const maxStackSegments = useMemo(
    () => Math.min(
      smartMoneySessionChart.reduce((max, row) => Math.max(max, Object.keys(row).filter((k) => k.startsWith('block') && Number(row[k] || 0) > 0).length), 1),
      12,
    ),
    [smartMoneySessionChart],
  );
  // Build a sparse Map of timestamps that should render a tick label (either a
  // 30-min boundary, a new-day marker, or both). Recharts is told to render
  // ONLY these ticks via the `ticks` prop instead of iterating every minute,
  // which previously meant ~400 wasted custom-tick renders per chart pass.
  const xAxisTickInfo = useMemo(() => {
    const info = new Map<string, { time?: string; date?: string }>();
    let prevDate = '';
    for (const row of smartMoneySessionChart) {
      const ts = String(row.timestamp);
      const time = is30MinBoundary(ts)
        ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' })
        : undefined;
      const dateLabel = new Date(ts).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
      const date = dateLabel !== prevDate ? dateLabel : undefined;
      prevDate = dateLabel;
      if (time || date) info.set(ts, { time, date });
    }
    return info;
  }, [smartMoneySessionChart]);
  const xAxisTicks = useMemo(() => Array.from(xAxisTickInfo.keys()), [xAxisTickInfo]);
  const dailyTotalsTimestamp = useMemo(() => {
    const timestamps = filteredSmartMoneyData
      .map((row) => row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start || '')
      .filter(Boolean);
    return timestamps.length ? latestTimestamp(timestamps) : null;
  }, [filteredSmartMoneyData]);
  const smartMoneyTotals = useMemo(() => {
    return filteredSmartMoneyData.reduce(
      (acc, row) => {
        const notional = Number(row.absNotional || 0);
        const optionType = String(row.option_type || '').toUpperCase();
        if (optionType.includes('C')) acc.call += notional;
        if (optionType.includes('P')) acc.put += notional;
        return acc;
      },
      { call: 0, put: 0 },
    );
  }, [filteredSmartMoneyData]);
  const smartMoneyNet = smartMoneyTotals.call - smartMoneyTotals.put;
  const smartMoneyTone: 'bullish' | 'bearish' | 'neutral' =
    Math.abs(smartMoneyNet) < 250_000 ? 'neutral' : smartMoneyNet > 0 ? 'bullish' : 'bearish';
  const smartMoneyBadge =
    smartMoneyTone === 'neutral' ? 'Balanced Positioning' : smartMoneyTone === 'bullish' ? 'Call Buyers in Control' : 'Put Buyers in Control';
  const smartMoneySummary = `Filtered blocks show ${smartMoneyNet >= 0 ? 'net call' : 'net put'} notional of $${(Math.abs(smartMoneyNet) / 1_000_000).toFixed(2)}M ($${(smartMoneyTotals.call / 1_000_000).toFixed(2)}M calls vs $${(smartMoneyTotals.put / 1_000_000).toFixed(2)}M puts). ${
    smartMoneyTone === 'neutral'
      ? 'Positioning is relatively balanced, so confirmation from price action is more important than flow alone.'
      : smartMoneyTone === 'bullish'
        ? 'Call-heavy institutional flow supports dip-buying and upside continuation if price holds key supports.'
        : 'Put-heavy institutional flow supports defensive or downside setups unless price decisively reclaims resistance.'
  } Day traders can use this for intraday bias, while swing traders can treat sustained multi-session imbalance as a potential trend filter.`;
  const toggleSmartMoneySort = (key: SmartMoneySortKey) => {
    setSortStack((stack) => {
      if (stack.length > 0 && stack[0].key === key) {
        const flipped: SortLevel = { key, dir: stack[0].dir === 'asc' ? 'desc' : 'asc' };
        return [flipped, ...stack.slice(1)];
      }
      const rest = stack.filter((level) => level.key !== key);
      const next: SortLevel = { key, dir: 'desc' };
      return [next, ...rest].slice(0, MAX_SORT_LEVELS);
    });
  };
  const sortIndexByKey = useMemo(() => {
    const map = new Map<SmartMoneySortKey, number>();
    sortStack.forEach((level, idx) => map.set(level.key, idx));
    return map;
  }, [sortStack]);
  const renderSortIndicator = (key: SmartMoneySortKey) => {
    const idx = sortIndexByKey.get(key);
    if (idx === undefined) return null;
    const arrow = sortStack[idx].dir === 'asc' ? '↑' : '↓';
    return (
      <span className="ml-1 text-xs font-normal" style={{ color: textColor }}>
        {arrow}{sortStack.length > 1 ? <sup>{idx + 1}</sup> : null}
      </span>
    );
  };
  const setColumnFilter = (key: FilterableKey, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <RegimeSummaryBanner
        title="Smart Money Regime"
        badge={smartMoneyBadge}
        tone={smartMoneyTone}
        summary={smartMoneySummary}
      />
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">Smart Money Flow
          <TooltipWrapper text="Session view overlays smart-money block notional versus underlying price, with a sortable detail table below."><Info size={14} /></TooltipWrapper>
        </h2>
        <div className="flex flex-wrap items-center justify-start gap-3 mb-4">
          <label className="text-sm" style={{ color: mutedText }}>Session
            <select className="ml-2 rounded px-2 py-1" style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputColor, border: `1px solid ${inputBorder}` }} value={sessionView} onChange={(e) => setSessionView(e.target.value as 'current' | 'prior')}>
              <option value="current">Current{currentDateLabel ? ` (${currentDateLabel})` : ''}</option>
              <option value="prior">Prior{priorDateLabel ? ` (${priorDateLabel})` : ''}</option>
            </select>
          </label>
            <label className="text-sm" style={{ color: mutedText }}>Min Class
              <select className="ml-2 rounded px-2 py-1" style={{ backgroundColor: inputBg, borderColor: inputBorder, color: inputColor, border: `1px solid ${inputBorder}` }} value={minClass} onChange={(e) => setMinClass(e.target.value as MinClassFilter)}>
                {minClassOptions.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
              </select>
            </label>
        </div>
        <div className="text-sm mb-3" style={{ color: mutedText }}>
          Daily Totals as of: {dailyTotalsTimestamp ? new Date(dailyTotalsTimestamp).toLocaleString() : '--'}
        </div>
        <div className="rounded-lg p-6" style={{ backgroundColor: cardBg }}>
          {effectiveSmartMoneyError ? <ErrorMessage message={effectiveSmartMoneyError} /> : !filteredSmartMoneyData.length ? <div className="text-center py-6" style={{ color: mutedText }}>{!smartMoneyData && !smartMoneyError ? 'Loading...' : `No smart money flow data available for ${sessionView} session at the ${minClass} filter. Try a different session or Min Class.`}</div> : (
            <>
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>SMART MONEY BLOCKS VS UNDERLYING PRICE</h3>
                  <TooltipWrapper text="Stacked bars show filtered smart-money notional by minute; yellow line overlays underlying price across the full 09:30–16:15 ET session timeline."><Info size={14} /></TooltipWrapper>
                </div>
                <MobileScrollableChart>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={smartMoneySessionChart} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} ticks={xAxisTicks} tick={(props: { x?: number | string; y?: number | string; payload?: { value?: string | number } }) => {
                      const x = Number(props?.x ?? 0); const y = Number(props?.y ?? 0); const ts = String(props?.payload?.value || '');
                      const info = xAxisTickInfo.get(ts);
                      if (!info) return <g transform={`translate(${x},${y})`} />;
                      return <g transform={`translate(${x},${y})`}><line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} />{info.time ? <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>{info.time}</text> : null}{info.date ? <text dy={info.time ? 26 : 14} textAnchor="middle" fill={isDark ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)'} fontSize={9}>{info.date}</text> : null}</g>;
                    }} />
                    <YAxis yAxisId="notional" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} tickFormatter={(v) => `$${Number(v).toFixed(1)}M`} />
                    <YAxis yAxisId="price" orientation="right" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} domain={["auto", "auto"]} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                    <Tooltip
                      content={({ active, label, payload }) => {
                        if (!active || !payload?.length) return null;
                        const blockEntries = payload
                          .filter((entry) => String(entry.dataKey || '').startsWith('block') && Number(entry.value || 0) > 0)
                          .map((entry) => {
                            const key = String(entry.dataKey || '').replace('block', 'blockMeta');
                            const meta = (entry.payload as Record<string, SmartMoneyBlockMeta | undefined>)[key];
                            if (!meta || !meta.rowKey) return null;
                            return {
                              name: `${meta.contract} (x${Number(meta.flow || 0).toLocaleString()})`,
                              value: Number(meta.notionalM || 0),
                              optionType: meta.optionType,
                            };
                          })
                          .filter(Boolean) as Array<{ name: string; value: number; optionType: string }>;

                        return (
                          <div style={{ backgroundColor: "var(--color-chart-tooltip-bg)", borderColor: "var(--color-border)", color: "var(--color-chart-tooltip-text)" }} className="rounded-lg border px-3 py-2 text-sm">
                            <div className="font-semibold">{new Date(String(label)).toLocaleString()}</div>
                            {blockEntries.map((block) => (
                              <div key={block.name}>
                                {block.name}: ${block.value.toFixed(2)}M
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    {Array.from({ length: maxStackSegments }).map((_, idx) => (
                      <Bar
                        key={`block-${idx + 1}`}
                        yAxisId="notional"
                        dataKey={`block${idx + 1}`}
                        stackId="notional"
                        barSize={5}
                        fill="var(--color-positive)"
                        onMouseEnter={(data) => {
                          const meta = (data?.payload as Record<string, SmartMoneyBlockMeta | undefined>)?.[`blockMeta${idx + 1}`];
                          if (meta?.rowKey) setHoveredRowKey(meta.rowKey);
                        }}
                        onMouseLeave={() => setHoveredRowKey(null)}
                      >
                        {smartMoneySessionChart.map((point, pointIdx) => {
                          const meta = (point as Record<string, SmartMoneyBlockMeta | undefined>)[`blockMeta${idx + 1}`];
                          const isHovered = hoveredRowKey !== null && meta?.rowKey === hoveredRowKey;
                          const fill = meta?.optionType === 'P' ? 'var(--color-negative)' : 'var(--color-positive)';
                          return (
                            <Cell
                              key={`cell-${idx + 1}-${pointIdx}`}
                              fill={fill}
                              fillOpacity={isHovered ? 1 : 0.82}
                              stroke={isHovered ? 'var(--color-brand-primary)' : 'none'}
                              strokeWidth={isHovered ? 2.5 : 0}
                            />
                          );
                        })}
                      </Bar>
                    ))}
                    <Line yAxisId="price" type="monotone" dataKey="underlyingPrice" name="Underlying" stroke="var(--color-warning)" dot={false} strokeWidth={2} connectNulls isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
                </MobileScrollableChart>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>SMART MONEY FLOW TABLE</h3>
                <TooltipWrapper text="Click the funnel icon on Strike, Expiration, or Type to pick a value to filter by. Click a header to sort; clicking a second header keeps the prior sort as a secondary tiebreaker (up to 3 levels)."><Info size={14} /></TooltipWrapper>
              </div>
              <div className="overflow-x-auto mt-2">
                <table className="w-full min-w-[960px] text-sm"><thead><tr className="text-left border-b" style={{ borderColor: inputBorder, color: mutedText }}>
                  {smartMoneyColumns.map((col) => {
                    const filterKey = col.filterable ? (col.key as FilterableKey) : null;
                    const activeFilter = filterKey ? columnFilters[filterKey] : '';
                    return (
                      <th key={col.key} className={`${col.align === 'right' ? 'text-right' : ''} py-2 px-2 cursor-pointer select-none whitespace-nowrap`} onClick={() => toggleSmartMoneySort(col.key)}>
                        <span>{col.label}</span>{renderSortIndicator(col.key)}
                        {filterKey ? (
                          <span data-smart-money-filter className="relative inline-block ml-1 align-middle">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenFilter((curr) => (curr === filterKey ? null : filterKey)); }}
                              aria-label={`Filter ${col.label}`}
                              className="inline-flex items-center"
                              style={{ color: activeFilter ? 'var(--color-brand-primary)' : mutedText }}
                            >
                              <Filter size={12} fill={activeFilter ? 'currentColor' : 'none'} />
                            </button>
                            {openFilter === filterKey ? (
                              <div
                                className="absolute z-20 mt-1 rounded border max-h-60 overflow-y-auto text-left shadow"
                                style={{ backgroundColor: cardBg, borderColor: inputBorder, color: inputColor, minWidth: '120px', top: '100%', left: 0 }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className="block w-full text-left px-3 py-1.5 text-xs"
                                  style={{ backgroundColor: !activeFilter ? 'var(--bg-hover)' : 'transparent', color: inputColor }}
                                  onClick={() => { setColumnFilter(filterKey, ''); setOpenFilter(null); }}
                                >
                                  All
                                </button>
                                {uniqueFilterValues[filterKey].length === 0 ? (
                                  <div className="px-3 py-1.5 text-xs" style={{ color: mutedText }}>No values</div>
                                ) : (
                                  uniqueFilterValues[filterKey].map((value) => (
                                    <button
                                      key={value}
                                      type="button"
                                      className="block w-full text-left px-3 py-1.5 text-xs"
                                      style={{ backgroundColor: activeFilter === value ? 'var(--bg-hover)' : 'transparent', color: inputColor }}
                                      onClick={() => { setColumnFilter(filterKey, value); setOpenFilter(null); }}
                                    >
                                      {value}
                                    </button>
                                  ))
                                )}
                              </div>
                            ) : null}
                          </span>
                        ) : null}
                      </th>
                    );
                  })}
                </tr></thead>
                  <tbody>{sortedSmartMoneyRows.slice(0, tableRowLimit).map((row) => { const ts = row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start; const t = ts ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '--'; const isHovered = hoveredRowKey === row.rowKey; const optionType = String(row.option_type || '').toUpperCase(); const optionLabel = optionType === 'P' ? 'Put' : optionType === 'C' ? 'Call' : row.option_type || '--'; return <tr key={row.rowKey} className="border-b" onMouseEnter={() => setHoveredRowKey(row.rowKey)} onMouseLeave={() => setHoveredRowKey(null)} style={{ borderColor: `${inputBorder}66`, backgroundColor: isHovered ? 'var(--color-warning-soft)' : 'transparent' }}><td className="py-2 px-2 font-mono">{t}</td><td className="py-2 px-2">{row.contract || '--'}</td><td className="py-2 px-2">{Number(row.strike || 0).toFixed(0)}</td><td className="py-2 px-2">{row.expiration || '--'}</td><td className="py-2 px-2">{row.dte ?? '--'}</td><td className="py-2 px-2 uppercase">{optionLabel}</td><td className="py-2 px-2 text-right">{Number(row.flow || 0).toLocaleString()}</td><td className="py-2 px-2 text-right font-semibold">${(Number(row.notional || 0) / 1_000_000).toFixed(2)}M</td><td className="py-2 px-2">{row.notional_class || '--'}</td></tr>; })}</tbody></table>
              </div>
              {tableRowLimit < sortedSmartMoneyRows.length ? <div className="mt-3 text-right"><button type="button" className="px-3 py-1 rounded border text-xs" style={{ borderColor: inputBorder, color: mutedText }} onClick={() => setTableRowLimit((v) => v + 50)}>Show more</button></div> : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
