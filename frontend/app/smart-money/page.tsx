'use client';

import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { Bar, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApiData } from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTheme } from '@/core/ThemeContext';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';

interface SmartMoneyRow { timestamp?: string; symbol: string; contract: string; strike: number; expiration: string; dte: number; option_type: string; flow: number; notional: number; notional_class: string; time_window_start?: string; time_window_end?: string; interval_timestamp?: string | null; }
interface SessionFlowPoint { timestamp: string; underlying_price?: number | null; }
interface NormalizedSmartMoneyRow extends SmartMoneyRow { rowKey: string; minuteTimestamp: string | null; notionalM: number; absNotional: number; }
type SmartMoneySortKey = 'timestamp' | 'contract' | 'strike' | 'expiration' | 'dte' | 'option_type' | 'flow' | 'notional' | 'notional_class';
type MinClassFilter = '500k' | '250k' | '100k' | '50k' | 'under50k';

const normalizeToMinute = (ts?: string) => { if (!ts) return null; const ms = new Date(ts).getTime(); if (!Number.isFinite(ms)) return null; return new Date(Math.floor(ms / 60_000) * 60_000).toISOString(); };
const smartMoneyTimestamp = (row: SmartMoneyRow) => normalizeToMinute(row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start);
const getETDateKey = (ts: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
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
  { value: '500k', label: '💰 $500K+ (>= $500K)' },
  { value: '250k', label: '💵 $250K+ (>= $250K, < $500K)' },
  { value: '100k', label: '💸 $100K+ (>= $100K, < $250K)' },
  { value: '50k', label: '💳 $50K+ (>= $50K, < $100K)' },
  { value: 'under50k', label: '💴 <$50K (< $50K)' },
];

function matchesMinClass(absNotional: number, minClass: MinClassFilter): boolean {
  if (minClass === '500k') return absNotional >= 500_000;
  if (minClass === '250k') return absNotional >= 250_000 && absNotional < 500_000;
  if (minClass === '100k') return absNotional >= 100_000 && absNotional < 250_000;
  if (minClass === '50k') return absNotional >= 50_000 && absNotional < 100_000;
  return absNotional < 50_000;
}

export default function SmartMoneyPage() {
  const { symbol } = useTimeframe();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const cardBg = isDark ? '#423d3f' : '#ffffff';
  const inputBg = isDark ? '#2f2b2c' : '#f3f4f6';
  const inputBorder = isDark ? '#6b7280' : '#d1d5db';
  const inputColor = isDark ? '#e5e7eb' : '#374151';
  const axisStroke = isDark ? '#f2f2f2' : '#374151';
  const mutedText = isDark ? '#9ca3af' : '#6b7280';
  const textColor = isDark ? '#f2f2f2' : '#1f1d1e';
  const [smartMoneySortKey, setSmartMoneySortKey] = useState<SmartMoneySortKey>('notional');
  const [smartMoneySortDir, setSmartMoneySortDir] = useState<'asc' | 'desc'>('desc');
  const [minClass, setMinClass] = useState<MinClassFilter>('500k');
  const [sessionView, setSessionView] = useState<'current' | 'prior'>('current');
  const [tableRowLimit, setTableRowLimit] = useState(50);

  const { data: smartMoneyData, error: smartMoneyError } = useApiData<SmartMoneyRow[]>(`/api/flow/smart-money?symbol=${symbol}&session=${sessionView}&limit=100`, { refreshInterval: 10000 });
  const { data: smartMoneyFallbackData, error: smartMoneyFallbackError } = useApiData<SmartMoneyRow[]>(`/api/flow/smart-money?symbol=${symbol}&session=prior&limit=100`, { refreshInterval: 10000 });
  const { data: sessionPriceData } = useApiData<SessionFlowPoint[]>(`/api/flow/by-type?symbol=${symbol}&session=${sessionView}`, { refreshInterval: 10000 });
  const otherSession = sessionView === 'current' ? 'prior' : 'current';
  const { data: otherSessionProbe } = useApiData<SessionFlowPoint[]>(`/api/flow/by-type?symbol=${symbol}&session=${otherSession}`, { refreshInterval: 60000 });

  const sessionDateLabel = useMemo(() => sessionPriceData?.length ? getETDateKey([...sessionPriceData].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp) : null, [sessionPriceData]);
  const otherSessionDateLabel = useMemo(() => otherSessionProbe?.length ? getETDateKey([...otherSessionProbe].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp) : null, [otherSessionProbe]);
  const currentDateLabel = sessionView === 'current' ? sessionDateLabel : otherSessionDateLabel;
  const priorDateLabel = sessionView === 'prior' ? sessionDateLabel : otherSessionDateLabel;

  const effectiveSmartMoneyRows = useMemo(() => (smartMoneyError ? (smartMoneyFallbackData || []) : (smartMoneyData || [])), [smartMoneyError, smartMoneyFallbackData, smartMoneyData]);
  const effectiveSmartMoneyError = smartMoneyError && smartMoneyFallbackError ? smartMoneyError : null;

  const normalizedSmartMoneyRows = useMemo<NormalizedSmartMoneyRow[]>(() => effectiveSmartMoneyRows.map((row, idx) => ({ ...row, rowKey: `${smartMoneyTimestamp(row) ?? 'na'}-${row.contract ?? 'contract'}-${idx}`, minuteTimestamp: smartMoneyTimestamp(row), notionalM: Math.abs(Number(row.notional || 0)) / 1_000_000, absNotional: Math.abs(Number(row.notional || 0)) })), [effectiveSmartMoneyRows]);

  const filteredSmartMoneyData = useMemo<NormalizedSmartMoneyRow[]>(() => normalizedSmartMoneyRows.filter((row) => matchesMinClass(row.absNotional, minClass)), [normalizedSmartMoneyRows, minClass]);

  const sessionDateKey = useMemo(() => {
    const candidates = [
      ...(sessionPriceData || []).map((row) => row.timestamp),
      ...filteredSmartMoneyData.map((row) => row.minuteTimestamp || row.timestamp || ''),
    ].filter(Boolean);
    if (!candidates.length) return null;
    const latest = [...candidates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    return getETDateKey(latest);
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
    const blocksByTs = new Map<string, Array<{ notionalM: number; optionType: string }>>();
    filteredSmartMoneyData.forEach((row) => {
      if (!row.minuteTimestamp) return;
      const blocks = blocksByTs.get(row.minuteTimestamp) ?? [];
      blocks.push({ notionalM: row.notionalM, optionType: String(row.option_type || '').toLowerCase() });
      blocksByTs.set(row.minuteTimestamp, blocks);
    });
    const priceByTs = new Map<string, number>();
    (sessionPriceData || []).forEach((row) => { const ts = normalizeToMinute(row.timestamp); if (ts && row.underlying_price != null) priceByTs.set(ts, Number(row.underlying_price)); });
    const maxBlocksPerMinute = Math.max(1, ...Array.from(blocksByTs.values()).map((values) => values.length));
    return sessionTimeline.map((ts) => {
      const minuteBlocks = [...(blocksByTs.get(ts) || [])].sort((a, b) => b.notionalM - a.notionalM);
      const row: Record<string, number | string | null> = { timestamp: ts, underlyingPrice: priceByTs.get(ts) ?? null };
      for (let idx = 0; idx < maxBlocksPerMinute; idx += 1) row[`block${idx + 1}`] = minuteBlocks[idx]?.notionalM ?? 0;
      return row;
    });
  }, [sessionPriceData, filteredSmartMoneyData, sessionTimeline]);

  const maxStackSegments = useMemo(() => Math.min(smartMoneySessionChart.reduce((max, row) => Math.max(max, Object.keys(row).filter((k) => k.startsWith('block') && Number(row[k] || 0) > 0).length), 1), 10), [smartMoneySessionChart]);
  const dateMarkerMeta = useMemo(() => getDateMarkerMeta(smartMoneySessionChart.map((row) => String(row.timestamp))), [smartMoneySessionChart]);
  const dailyTotalsTimestamp = useMemo(() => {
    const latest = filteredSmartMoneyData
      .map((row) => row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start || '')
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
    return latest || null;
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
          {effectiveSmartMoneyError ? <ErrorMessage message={effectiveSmartMoneyError} /> : !filteredSmartMoneyData.length ? <div className="text-center py-6" style={{ color: mutedText }}>{!smartMoneyData && !smartMoneyError ? 'Loading...' : 'No smart money flow data available'}</div> : (
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
                      return <g transform={`translate(${x},${y})`}><line x1={0} y1={0} x2={0} y2={5} stroke={axisStroke} strokeWidth={1} opacity={0.6} />{timeLabel ? <text dy={14} textAnchor="middle" fill={axisStroke} fontSize={10}>{timeLabel}</text> : null}{dateLabel ? <text dy={timeLabel ? 26 : 14} textAnchor="middle" fill={isDark ? '#cfcfcf' : '#6b7280'} fontSize={9}>{dateLabel}</text> : null}</g>;
                    }} />
                    <YAxis yAxisId="notional" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} tickFormatter={(v) => `$${Number(v).toFixed(1)}M`} />
                    <YAxis yAxisId="price" orientation="right" stroke={axisStroke} tick={{ fill: axisStroke, fontSize: 11 }} tickLine={false} domain={["auto", "auto"]} tickFormatter={(v) => `$${Number(v).toFixed(0)}`} />
                    <Tooltip formatter={(value, name) => String(name).toLowerCase().includes('price') ? [`$${Number(value).toFixed(2)}`, 'Underlying'] : [`$${Number(value).toFixed(2)}M`, String(name)]} />
                    {Array.from({ length: maxStackSegments }).map((_, idx) => <Bar key={`block-${idx + 1}`} yAxisId="notional" dataKey={`block${idx + 1}`} stackId="notional" fill={idx % 2 === 0 ? '#22c55e' : '#ef4444'} />)}
                    <Line yAxisId="price" type="monotone" dataKey="underlyingPrice" stroke="#facc15" dot={false} strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-bold tracking-wider uppercase" style={{ color: textColor }}>SMART MONEY FLOW TABLE</h3>
                <TooltipWrapper text="Table rows are filtered by Session and Min Class and sorted by the selected column."><Info size={14} /></TooltipWrapper>
              </div>
              <div className="overflow-x-auto mt-2">
                <table className="w-full min-w-[960px] text-sm"><thead><tr className="text-left border-b" style={{ borderColor: inputBorder, color: mutedText }}><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('timestamp')}>Time</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('contract')}>Contract</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('strike')}>Strike</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('expiration')}>Expiration</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('dte')}>DTE</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('option_type')}>Type</th><th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('flow')}>Flow</th><th className="text-right py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('notional')}>Notional</th><th className="py-2 px-2 cursor-pointer" onClick={() => toggleSmartMoneySort('notional_class')}>Class</th></tr></thead>
                  <tbody>{sortedSmartMoneyRows.slice(0, tableRowLimit).map((row) => { const ts = row.timestamp || row.time_window_end || row.interval_timestamp || row.time_window_start; const t = ts ? new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) : '--'; return <tr key={row.rowKey} className="border-b" style={{ borderColor: `${inputBorder}66` }}><td className="py-2 px-2 font-mono">{t}</td><td className="py-2 px-2">{row.contract || '--'}</td><td className="py-2 px-2">{Number(row.strike || 0).toFixed(0)}</td><td className="py-2 px-2">{row.expiration || '--'}</td><td className="py-2 px-2">{row.dte ?? '--'}</td><td className="py-2 px-2 uppercase">{row.option_type || '--'}</td><td className="py-2 px-2 text-right">{Number(row.flow || 0).toLocaleString()}</td><td className="py-2 px-2 text-right font-semibold">${(Number(row.notional || 0) / 1_000_000).toFixed(2)}M</td><td className="py-2 px-2">{row.notional_class || '--'}</td></tr>; })}</tbody></table>
              </div>
              {tableRowLimit < sortedSmartMoneyRows.length ? <div className="mt-3 text-right"><button type="button" className="px-3 py-1 rounded border text-xs" style={{ borderColor: inputBorder, color: mutedText }} onClick={() => setTableRowLimit((v) => v + 50)}>Show more</button></div> : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
