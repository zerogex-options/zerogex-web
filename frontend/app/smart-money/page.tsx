'use client';

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Bar, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';

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
  notional_class?: string | null;
  size_class?: string | null;
  time_window_start?: string;
  time_window_end?: string;
  interval_timestamp?: string | null;
}
interface SessionFlowPoint { timestamp: string; underlying_price?: number | null; }
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

const normalizeToMinute = (ts?: string) => { if (!ts) return null; const ms = new Date(ts).getTime(); if (!Number.isFinite(ms)) return null; return new Date(Math.floor(ms / 60_000) * 60_000).toISOString(); };
const smartMoneyTimestamp = (row: SmartMoneyRow) => normalizeToMinute(row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start);
const getETDateKey = (ts: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
const latestTimestamp = (timestamps: string[]) => timestamps.reduce<string>((latest, ts) => (new Date(ts).getTime() > new Date(latest).getTime() ? ts : latest), timestamps[0] || '');
function getDateMarkerMeta(timestamps: string[]) { const m = new Map<number, string>(); let prev = ''; timestamps.forEach((ts, idx) => { const k = new Date(ts).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' }); if (k !== prev) { m.set(idx, k); prev = k; } }); return m; }
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
  for (let t = startMs; t <= endMs; t += 60_000) {
    result.push(new Date(t).toISOString());
  }
  return result;
}
const is30MinBoundary = (ts: string) => { const d = new Date(ts); return d.getUTCMinutes() === 0 || d.getUTCMinutes() === 30; };
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
  const inputBg = isDark ? '#2f2b2c' : 'var(--color-surface-subtle)';
  const inputBorder = isDark ? 'var(--color-text-secondary)' : 'var(--color-border)';
  const inputColor = isDark ? 'var(--color-border)' : 'var(--color-text-primary)';
  const axisStroke = isDark ? 'var(--color-text-primary)' : 'var(--color-text-primary)';
  const mutedText = isDark ? 'var(--color-text-secondary)' : 'var(--color-text-secondary)';
  const textColor = isDark ? 'var(--color-text-primary)' : 'var(--color-surface)';
  const [smartMoneySortKey, setSmartMoneySortKey] = useState<SmartMoneySortKey>('notional');
  const [smartMoneySortDir, setSmartMoneySortDir] = useState<'asc' | 'desc'>('desc');
  const [minClass, setMinClass] = useState<MinClassFilter>('500k');
  const [sessionView, setSessionView] = useState<'current' | 'prior'>('current');
  const [tableRowLimit, setTableRowLimit] = useState(50);
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);

  const { data: smartMoneyData, error: smartMoneyError } = useApiData<SmartMoneyRow[]>(`/api/flow/smart-money?symbol=${symbol}&session=${sessionView}&limit=100`, { refreshInterval: 10000 });
  const { data: smartMoneyNoSessionData, error: smartMoneyNoSessionError } = useApiData<SmartMoneyRow[]>(
    `/api/flow/smart-money?symbol=${symbol}&limit=100`,
    { refreshInterval: 10000, enabled: Boolean(smartMoneyError) }
  );
  const { data: smartMoneyFallbackData, error: smartMoneyFallbackError } = useApiData<SmartMoneyRow[]>(`/api/flow/smart-money?symbol=${symbol}&session=prior&limit=100`, { refreshInterval: 10000, enabled: Boolean(smartMoneyError) && !smartMoneyNoSessionData?.length });
  const { data: sessionPriceDataRaw, error: sessionPriceError } = useApiData<SessionFlowPoint[]>(`/api/flow/by-type?symbol=${symbol}&session=${sessionView}`, { refreshInterval: 10000 });
  const { data: sessionPriceDataNoSession } = useApiData<SessionFlowPoint[]>(
    `/api/flow/by-type?symbol=${symbol}`,
    { refreshInterval: 10000, enabled: Boolean(sessionPriceError) }
  );
  const sessionPriceData = useMemo(
    () => sessionPriceDataRaw || sessionPriceDataNoSession || [],
    [sessionPriceDataRaw, sessionPriceDataNoSession]
  );
  const otherSession = sessionView === 'current' ? 'prior' : 'current';
  const { data: otherSessionProbe } = useApiData<SessionFlowPoint[]>(`/api/flow/by-type?symbol=${symbol}&session=${otherSession}`, { refreshInterval: 60000 });

  const sessionDateLabel = useMemo(() => sessionPriceData?.length ? getETDateKey(latestTimestamp(sessionPriceData.map((row) => row.timestamp))) : null, [sessionPriceData]);
  const otherSessionDateLabel = useMemo(() => otherSessionProbe?.length ? getETDateKey(latestTimestamp(otherSessionProbe.map((row) => row.timestamp))) : null, [otherSessionProbe]);
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
    const candidates = [
      ...(sessionPriceData || []).map((row) => row.timestamp),
      ...filteredSmartMoneyData.map((row) => row.minuteTimestamp || row.timestamp || ''),
    ].filter(Boolean);
    if (!candidates.length) return null;
    return getETDateKey(latestTimestamp(candidates));
  }, [sessionPriceData, filteredSmartMoneyData]);

  const sessionTimeline = useMemo(() => sessionDateKey ? getSessionTimestamps(sessionDateKey) : [], [sessionDateKey]);

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
    const priceByTs = new Map<string, number>();
    (sessionPriceData || []).forEach((row) => { const ts = normalizeToMinute(row.timestamp); if (ts && row.underlying_price != null) priceByTs.set(ts, Number(row.underlying_price)); });
    const maxBlocksPerMinute = Math.max(1, ...Array.from(blocksByTs.values()).map((values) => values.length));
    return sessionTimeline.map((ts) => {
      // Sort largest -> smallest so any segment cap trims from the smallest tail.
      const minuteBlocks = [...(blocksByTs.get(ts) || [])].sort((a, b) => b.notionalM - a.notionalM);
      const row: Record<string, number | string | null | SmartMoneyBlockMeta> = { timestamp: ts, underlyingPrice: priceByTs.get(ts) ?? null };
      for (let idx = 0; idx < maxBlocksPerMinute; idx += 1) {
        const block = minuteBlocks[idx];
        row[`block${idx + 1}`] = block?.notionalM ?? 0;
        row[`blockMeta${idx + 1}`] = block ?? { rowKey: '', contract: '--', flow: 0, notionalM: 0, optionType: '' };
      }
      return row;
    });
  }, [sessionPriceData, filteredSmartMoneyData, sessionTimeline]);

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
  const toggleSmartMoneySort = (key: SmartMoneySortKey) => smartMoneySortKey === key ? setSmartMoneySortDir((dir) => (dir === 'asc' ? 'desc' : 'asc')) : (setSmartMoneySortKey(key), setSmartMoneySortDir('desc'));

  return (
    <div className="container mx-auto px-4 py-8">
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
                  <TooltipWrapper text="Stacked bars show filtered smart-money notional by minute; yellow line overlays underlying price across the full 09:30–16:00 ET session timeline."><Info size={14} /></TooltipWrapper>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={smartMoneySessionChart} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <XAxis dataKey="timestamp" stroke={axisStroke} tickLine={false} interval={0} minTickGap={20} tick={(props: { x?: number | string; y?: number | string; payload?: { value?: string | number }; index?: number }) => {
                      const x = Number(props?.x ?? 0); const y = Number(props?.y ?? 0); const ts = String(props?.payload?.value || ''); const index = Number(props?.index ?? -1);
                      const timeLabel = is30MinBoundary(ts) ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '';
                      const dateLabel = dateMarkerMeta.get(index);
                      if (!timeLabel && !dateLabel) return <g transform={`translate(${x},${y})`} />;
                      return <g transform={`translate(${x},${y})`}><line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} />{timeLabel ? <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>{timeLabel}</text> : null}{dateLabel ? <text dy={timeLabel ? 26 : 14} textAnchor="middle" fill={isDark ? '#cfcfcf' : 'var(--color-text-secondary)'} fontSize={9}>{dateLabel}</text> : null}</g>;
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
                          <div style={{ backgroundColor: isDark ? "var(--color-surface)" : "var(--color-surface)", borderColor: isDark ? "var(--color-surface)" : "var(--color-border)", color: isDark ? "var(--color-text-primary)" : "var(--color-text-primary)" }} className="rounded border px-3 py-2 text-sm">
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
                          const popFill = meta?.optionType === 'P' ? '#fb7185' : '#4ade80';
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
                    <Line yAxisId="price" type="monotone" dataKey="underlyingPrice" stroke="var(--color-warning)" dot={false} strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>SMART MONEY FLOW TABLE</h3>
                <TooltipWrapper text="Table rows are filtered by Session and Min Class and sorted by the selected column."><Info size={14} /></TooltipWrapper>
              </div>
              <div className="overflow-x-auto mt-2">
                <table className="w-full min-w-[960px] text-sm"><thead><tr className="text-left border-b" style={{ borderColor: inputBorder, color: mutedText }}><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('timestamp')}>Time</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('contract')}>Contract</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('strike')}>Strike</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('expiration')}>Expiration</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('dte')}>DTE</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('option_type')}>Type</th><th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('flow')}>Contracts</th><th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('notional')}>Notional</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('notional_class')}>Class</th></tr></thead>
                  <tbody>{sortedSmartMoneyRows.slice(0, tableRowLimit).map((row) => { const ts = row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start; const t = ts ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '--'; const isHovered = hoveredRowKey === row.rowKey; const optionType = String(row.option_type || '').toUpperCase(); const optionLabel = optionType === 'P' ? 'Put' : optionType === 'C' ? 'Call' : row.option_type || '--'; return <tr key={row.rowKey} className="border-b" onMouseEnter={() => setHoveredRowKey(row.rowKey)} onMouseLeave={() => setHoveredRowKey(null)} style={{ borderColor: `${inputBorder}66`, backgroundColor: isHovered ? (isDark ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.22)') : 'transparent' }}><td className="py-2 px-2 font-mono">{t}</td><td className="py-2 px-2">{row.contract || '--'}</td><td className="py-2 px-2">{Number(row.strike || 0).toFixed(0)}</td><td className="py-2 px-2">{row.expiration || '--'}</td><td className="py-2 px-2">{row.dte ?? '--'}</td><td className="py-2 px-2 uppercase">{optionLabel}</td><td className="py-2 px-2 text-right">{Number(row.flow || 0).toLocaleString()}</td><td className="py-2 px-2 text-right font-semibold">${(Number(row.notional || 0) / 1_000_000).toFixed(2)}M</td><td className="py-2 px-2">{row.notional_class || '--'}</td></tr>; })}</tbody></table>
              </div>
              {tableRowLimit < sortedSmartMoneyRows.length ? <div className="mt-3 text-right"><button type="button" className="px-3 py-1 rounded border text-xs" style={{ borderColor: inputBorder, color: mutedText }} onClick={() => setTableRowLimit((v) => v + 50)}>Show more</button></div> : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
