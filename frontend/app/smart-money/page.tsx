'use client';

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Bar, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import {
  useFlowByContractCache,
  buildUnderlyingPriceMap,
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
type MinClassFilter = '500k' | '250k' | '100k' | '50k' | 'under50k';

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
function getDateMarkerMeta(timestamps: string[]) { const m = new Map<number, string>(); let prev = ''; timestamps.forEach((ts, idx) => { const k = new Date(ts).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }); if (k !== prev) { m.set(idx, k); prev = k; } }); return m; }
const is30MinBoundary = (ts: string) => { const d = new Date(ts); return d.getUTCMinutes() === 0 || d.getUTCMinutes() === 30; };

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
  const [smartMoneySortKey, setSmartMoneySortKey] = useState<SmartMoneySortKey>('notional');
  const [smartMoneySortDir, setSmartMoneySortDir] = useState<'asc' | 'desc'>('desc');
  const [minClass, setMinClass] = useState<MinClassFilter>('500k');
  const [sessionView, setSessionView] = useState<'current' | 'prior'>('current');
  const [tableRowLimit, setTableRowLimit] = useState(50);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);

  const { data: smartMoneyData, error: smartMoneyError } = useApiData<SmartMoneyRow[]>(`/api/flow/smart-money?symbol=${symbol}`, { refreshInterval: 10000 });
  const { data: smartMoneyNoSessionData, error: smartMoneyNoSessionError } = useApiData<SmartMoneyRow[]>(
    `/api/flow/smart-money?symbol=${symbol}&limit=100`,
    { refreshInterval: 10000, enabled: Boolean(smartMoneyError) }
  );
  const { data: smartMoneyFallbackData, error: smartMoneyFallbackError } = useApiData<SmartMoneyRow[]>(`/api/flow/smart-money?symbol=${symbol}&session=${sessionView}&limit=100`, { refreshInterval: 10000, enabled: Boolean(smartMoneyError) && !smartMoneyNoSessionData?.length });
  const { rows: byContractRows } = useFlowByContractCache(symbol, sessionView);
  const otherSession = sessionView === 'current' ? 'prior' : 'current';
  const { data: otherSessionProbe } = useApiData<FlowByContractPoint[]>(
    `/api/flow/by-contract?symbol=${symbol}&session=${otherSession}&intervals=1`,
    { refreshInterval: 60000 },
  );

  const sessionDateLabel = useMemo(() => latestRowDateKey(byContractRows), [byContractRows]);
  const otherSessionDateLabel = useMemo(() => latestRowDateKey(otherSessionProbe), [otherSessionProbe]);
  const currentDateLabel = sessionView === 'current' ? sessionDateLabel : otherSessionDateLabel;
  const priorDateLabel = sessionView === 'prior' ? sessionDateLabel : otherSessionDateLabel;

  const effectiveSmartMoneyRows = useMemo(
    () => (smartMoneyError ? (smartMoneyNoSessionData || smartMoneyFallbackData || []) : (smartMoneyData || [])),
    [smartMoneyError, smartMoneyNoSessionData, smartMoneyFallbackData, smartMoneyData]
  );
  const effectiveSmartMoneyError = smartMoneyError && smartMoneyNoSessionError && smartMoneyFallbackError ? smartMoneyError : null;

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
    const priceByTs = buildUnderlyingPriceMap(byContractRows);
    const maxBlocksPerMinute = Math.max(1, ...Array.from(blocksByTs.values()).map((values) => values.length));
    // Linearly interpolate the underlying price between sparse observations so
    // the line reads as a smooth curve instead of forward-filled plateaus.
    const observedIdx: number[] = [];
    const observedVal: number[] = [];
    for (let i = 0; i < sessionTimeline.length; i += 1) {
      const v = priceByTs.get(sessionTimeline[i]);
      if (v != null && Number.isFinite(v)) {
        observedIdx.push(i);
        observedVal.push(v);
      }
    }
    const filledPrices: Array<number | null> = new Array(sessionTimeline.length).fill(null);
    if (observedIdx.length === 1) {
      filledPrices.fill(observedVal[0]);
    } else if (observedIdx.length > 1) {
      for (let i = 0; i < observedIdx[0]; i += 1) filledPrices[i] = observedVal[0];
      for (let seg = 0; seg < observedIdx.length - 1; seg += 1) {
        const startIdx = observedIdx[seg];
        const endIdx = observedIdx[seg + 1];
        const startVal = observedVal[seg];
        const endVal = observedVal[seg + 1];
        const span = endIdx - startIdx;
        for (let i = startIdx; i <= endIdx; i += 1) {
          const t = span === 0 ? 0 : (i - startIdx) / span;
          filledPrices[i] = startVal + (endVal - startVal) * t;
        }
      }
      const lastIdx = observedIdx[observedIdx.length - 1];
      const lastVal = observedVal[observedVal.length - 1];
      for (let i = lastIdx + 1; i < sessionTimeline.length; i += 1) filledPrices[i] = lastVal;
    }
    return sessionTimeline.map((ts, idx) => {
      // Sort largest -> smallest so any segment cap trims from the smallest tail.
      const minuteBlocks = [...(blocksByTs.get(ts) || [])].sort((a, b) => b.notionalM - a.notionalM);
      const row: Record<string, number | string | null | SmartMoneyBlockMeta> = {
        timestamp: ts,
        underlyingPrice: filledPrices[idx],
      };
      for (let j = 0; j < maxBlocksPerMinute; j += 1) {
        const block = minuteBlocks[j];
        row[`block${j + 1}`] = block?.notionalM ?? 0;
        row[`blockMeta${j + 1}`] = block ?? { rowKey: '', contract: '--', flow: 0, notionalM: 0, optionType: '' };
      }
      return row;
    });
  }, [byContractRows, filteredSmartMoneyData, sessionTimeline]);

  const maxStackSegments = useMemo(
    () => Math.min(
      smartMoneySessionChart.reduce((max, row) => Math.max(max, Object.keys(row).filter((k) => k.startsWith('block') && Number(row[k] || 0) > 0).length), 1),
      12,
    ),
    [smartMoneySessionChart],
  );
  const dateMarkerMeta = useMemo(() => getDateMarkerMeta(smartMoneySessionChart.map((row) => String(row.timestamp))), [smartMoneySessionChart]);
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
  const toggleSmartMoneySort = (key: SmartMoneySortKey) => smartMoneySortKey === key ? setSmartMoneySortDir((dir) => (dir === 'asc' ? 'desc' : 'asc')) : (setSmartMoneySortKey(key), setSmartMoneySortDir('desc'));

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
                    <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={(props: { x?: number | string; y?: number | string; payload?: { value?: string | number }; index?: number }) => {
                      const x = Number(props?.x ?? 0); const y = Number(props?.y ?? 0); const ts = String(props?.payload?.value || ''); const index = Number(props?.index ?? -1);
                      const timeLabel = is30MinBoundary(ts) ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '';
                      const dateLabel = dateMarkerMeta.get(index);
                      if (!timeLabel && !dateLabel) return <g transform={`translate(${x},${y})`} />;
                      return <g transform={`translate(${x},${y})`}><line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} />{timeLabel ? <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>{timeLabel}</text> : null}{dateLabel ? <text dy={timeLabel ? 26 : 14} textAnchor="middle" fill={isDark ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)'} fontSize={9}>{dateLabel}</text> : null}</g>;
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
                        const underlying = payload.find((entry) => String(entry.dataKey || '').toLowerCase().includes('underlyingprice'));

                        return (
                          <div style={{ backgroundColor: "var(--color-chart-tooltip-bg)", borderColor: "var(--color-border)", color: "var(--color-chart-tooltip-text)" }} className="rounded-lg border px-3 py-2 text-sm">
                            <div className="font-semibold">{new Date(String(label)).toLocaleString()}</div>
                            {underlying ? (
                              <div>Underlying Price: ${Number(underlying.value || 0).toFixed(2)}</div>
                            ) : null}
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
                        fill="var(--color-positive)"
                        onMouseEnter={(data) => {
                          const meta = (data?.payload as Record<string, SmartMoneyBlockMeta | undefined>)?.[`blockMeta${idx + 1}`];
                          if (meta?.rowKey) setHoveredRowKey(meta.rowKey);
                        }}
                        onMouseLeave={() => setHoveredRowKey(null)}
                      >
                        {smartMoneySessionChart.map((point, pointIdx) => {
                          const meta = (point as Record<string, SmartMoneyBlockMeta | undefined>)[`blockMeta${idx + 1}`];
                          const isHovered = hoveredRowKey && meta?.rowKey === hoveredRowKey;
                          const baseFill = meta?.optionType === 'P' ? 'var(--color-negative)' : 'var(--color-positive)';
                          const popFill = meta?.optionType === 'P' ? 'var(--color-negative)' : 'var(--color-positive)';
                          return (
                            <Cell
                              key={`cell-${idx + 1}-${pointIdx}`}
                              fill={isHovered ? popFill : baseFill}
                              fillOpacity={hoveredRowKey ? (isHovered ? 1 : 0.18) : 0.82}
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
                <TooltipWrapper text="Table rows are filtered by Session and Min Class and sorted by the selected column."><Info size={14} /></TooltipWrapper>
              </div>
              <div className="overflow-x-auto mt-2">
                <table className="w-full min-w-[960px] text-sm"><thead><tr className="text-left border-b" style={{ borderColor: inputBorder, color: mutedText }}><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('timestamp')}>Time</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('contract')}>Contract</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('strike')}>Strike</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('expiration')}>Expiration</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('dte')}>DTE</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('option_type')}>Type</th><th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('flow')}>Contracts</th><th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('notional')}>Notional</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('notional_class')}>Class</th></tr></thead>
                  <tbody>{sortedSmartMoneyRows.slice(0, tableRowLimit).map((row) => { const ts = row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start; const t = ts ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '--'; const isHovered = hoveredRowKey === row.rowKey; const optionType = String(row.option_type || '').toUpperCase(); const optionLabel = optionType === 'P' ? 'Put' : optionType === 'C' ? 'Call' : row.option_type || '--'; return <tr key={row.rowKey} className="border-b" onMouseEnter={() => setHoveredRowKey(row.rowKey)} onMouseLeave={() => setHoveredRowKey(null)} style={{ borderColor: `${inputBorder}66`, backgroundColor: isHovered ? (isDark ? 'var(--color-warning-soft)' : 'var(--color-warning-soft)') : 'transparent' }}><td className="py-2 px-2 font-mono">{t}</td><td className="py-2 px-2">{row.contract || '--'}</td><td className="py-2 px-2">{Number(row.strike || 0).toFixed(0)}</td><td className="py-2 px-2">{row.expiration || '--'}</td><td className="py-2 px-2">{row.dte ?? '--'}</td><td className="py-2 px-2 uppercase">{optionLabel}</td><td className="py-2 px-2 text-right">{Number(row.flow || 0).toLocaleString()}</td><td className="py-2 px-2 text-right font-semibold">${(Number(row.notional || 0) / 1_000_000).toFixed(2)}M</td><td className="py-2 px-2">{row.notional_class || '--'}</td></tr>; })}</tbody></table>
              </div>
              {tableRowLimit < sortedSmartMoneyRows.length ? <div className="mt-3 text-right"><button type="button" className="px-3 py-1 rounded border text-xs" style={{ borderColor: inputBorder, color: mutedText }} onClick={() => setTableRowLimit((v) => v + 50)}>Show more</button></div> : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
