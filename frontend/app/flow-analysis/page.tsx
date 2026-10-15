/**
 * Flow Analysis: what traded today, and who crossed the spread to trade it.
 *
 * A one-line read across the top (the session's lean, net premium, net flow,
 * put/call, volume), then the contracts bought and sold on each side, then one
 * chart of the session in stacked panes on a shared clock (price, net premium
 * with its call and put legs, the contracts each bar by side, put/call), with
 * the flow log and the bar-by-bar tape underneath. Everything reads
 * /api/flow/series (useFlowSeries) through core/flowAnalysis, and a strike or
 * expiration pick narrows the whole page, so every number on it describes the
 * same contracts.
 */

'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import ReadCell from '@/components/layout/ReadCell';
import { FilterBar, FilterSelect } from '@/components/controls/Filters';
import ErrorMessage from '@/components/ErrorMessage';
import BoughtSoldBoard from '@/components/BoughtSoldBoard';
import FlowSessionChart, { type FlowChartLayers } from '@/components/FlowSessionChart';
import { useFlowSessions } from '@/hooks/useFlowSessions';
import { sessionDateKeyFromSeries, useFlowContractOptions, useFlowSeries } from '@/hooks/useFlowSeries';
import { useSharedExpirations } from '@/hooks/useSharedExpirations';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePersistedFlag } from '@/hooks/usePersistedFlag';
import { FULLSCREEN_LAYER_STYLE, useChartFullscreen } from '@/hooks/useChartFullscreen';
import { useTimeframe } from '@/core/TimeframeContext';
import { etTodayDateKey } from '@/core/utils';
import { isRollingZeroDte, reconcileExpirations } from '@/core/expirationPersistence';
import { flowSessionOptions, isFlowSessionDate, type FlowSession } from '@/core/flowSessions';
import { FLOW_TIMEFRAME_LABELS, FLOW_TIMEFRAME_MINUTES, getETTimeTimestamp, type FlowTimeframe } from '@/core/flowSeriesCharts';
import { ET_HM } from '@/core/technicalsCharts';
import { fmtLevel } from '@/core/technicalsSession';
import {
  FLOW_REGIME_LABEL,
  buildFlowBars,
  buildFlowEvents,
  flowRead,
  fmtContracts,
  fmtContractsCompact,
  fmtShare,
  fmtUsdCompact,
  sideTotal,
  type FlowBar,
  type FlowEvent,
  type FlowEventTone,
  type FlowRegime,
} from '@/core/flowAnalysis';
import { ContractScopeButton, ContractScopePanel, scopeSummary } from './ContractScope';

// One remembered flag per layer, per browser (hooks/usePersistedFlag).
const LAYER_KEY = (layer: keyof FlowChartLayers) => `zg.flow.layer.${layer}`;
const LAYER_BUTTONS: Array<{ key: keyof FlowChartLayers; label: string; swatch: CSSProperties | null }> = [
  { key: 'price', label: 'Price', swatch: { width: 14, borderTop: '2px solid var(--text-primary)' } },
  { key: 'premium', label: 'Net premium', swatch: { width: 14, height: 9, background: 'color-mix(in srgb, var(--color-bull) 30%, transparent)', borderTop: '2px solid var(--text-primary)' } },
  { key: 'legs', label: 'Call & put legs', swatch: { width: 14, height: 6, borderTop: '2px solid var(--color-bull)', borderBottom: '2px solid var(--color-bear)' } },
  { key: 'contracts', label: 'Contracts', swatch: { width: 10, height: 10, background: 'linear-gradient(var(--color-bull) 50%, var(--color-bear) 50%)' } },
  { key: 'pcr', label: 'Put/call', swatch: { width: 14, borderTop: '2px solid var(--color-info)' } },
  { key: 'events', label: 'Events', swatch: null },
];
const EVENTS_COLLAPSED = 8;
const BARS_COLLAPSED = 10;

const REGIME_COLOR: Record<FlowRegime, string | undefined> = {
  riskOn: 'var(--color-bull)',
  riskOff: 'var(--color-bear)',
  twoWay: undefined,
};

const TONE_DOT: Record<FlowEventTone, string> = {
  bullish: 'var(--color-bull)',
  bearish: 'var(--color-bear)',
  neutral: 'var(--color-hazy)',
};

const ruleColor = 'var(--border-subtle)';

const noopSubscribe = () => () => {};

function etTime(ms: number): string {
  return ET_HM.format(new Date(ms));
}

function signColor(value: number | null | undefined): string | undefined {
  if (value == null || value === 0) return undefined;
  return value > 0 ? 'var(--color-bull)' : 'var(--color-bear)';
}

function dateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function MarkerBadge({ n, tone }: { n: number; tone: FlowEventTone }) {
  return (
    <span
      aria-label={`marker ${n}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: 999,
        border: `1px solid ${TONE_DOT[tone]}`,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginLeft: 6,
        verticalAlign: 'middle',
        flex: 'none',
      }}
    >
      {n}
    </span>
  );
}

function PanelHead({ title, caption }: { title: string; caption: ReactNode }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${ruleColor}` }}>
      <h2 className="zg-h3" style={{ margin: 0 }}>
        {title}
      </h2>
      <p className="zg-caption" style={{ margin: '4px 0 0' }}>
        {caption}
      </p>
    </div>
  );
}

function ShowMore({ open, total, noun, onClick }: { open: boolean; total: number; noun: string; onClick: () => void }) {
  return (
    <div style={{ padding: '0 16px 14px' }}>
      <button
        type="button"
        className="zg-btn"
        onClick={onClick}
        style={{ width: '100%', minHeight: 44, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-control, 2px)', cursor: 'pointer' }}
      >
        {open ? 'Show fewer' : `Show all ${total} ${noun}`}
      </button>
    </div>
  );
}

const toggleStyle = (on: boolean): CSSProperties => ({
  flex: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 40,
  padding: '0 12px',
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  color: on ? 'var(--text-primary)' : 'var(--text-muted)',
  background: on ? 'color-mix(in srgb, var(--color-navy, var(--color-info)) 18%, transparent)' : 'transparent',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-control, 2px)',
  cursor: 'pointer',
});

export default function FlowAnalysisPage() {
  const { symbol } = useTimeframe();
  const isMobile = useIsMobile();
  const todayKey = etTodayDateKey();

  // The clock, to the half minute: only the close needs it.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Session and bar size ─────────────────────────────────────────────────
  const [flowSession, setFlowSession] = useState<FlowSession>('current');
  const flowSessionDays = useFlowSessions(symbol);
  const [timeframe, setTimeframe] = useState<FlowTimeframe>('5min');
  const barMinutes = FLOW_TIMEFRAME_MINUTES[timeframe];
  const barMs = barMinutes * 60_000;

  // Every contract's rows. The hook paints rows this tab cached on its first
  // render, which the server never has: held back for the hydrating render,
  // the page matches the server's HTML, and the cached rows paint on the next.
  const allSeries = useFlowSeries(symbol, flowSession, { timeframe });
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const allRows = hydrated ? allSeries.rows : null;
  const allLoading = hydrated ? allSeries.loading : true;
  const allError = hydrated ? allSeries.error : null;
  // The session's own ET date. It lays a past session out on its own clock,
  // and it is what a rolling 0DTE pick means here: the contracts that expired
  // that day, not today's.
  const dateKey = isFlowSessionDate(flowSession)
    ? flowSession
    : allRows && allRows.length > 0
      ? sessionDateKeyFromSeries(allRows)
      : (flowSessionDays?.[flowSession === 'current' ? 0 : 1] ?? todayKey);

  // ── Which contracts ──────────────────────────────────────────────────────
  const {
    options: contractOptions,
    loading: contractsLoading,
    error: contractsError,
    chainSymbol,
  } = useFlowContractOptions(symbol, flowSession);
  const strikeOptions = useMemo(() => contractOptions.strikes.map((n) => String(n)), [contractOptions]);
  const expirationOptions = useMemo(() => contractOptions.expirations.slice().sort(), [contractOptions]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [selectedStrikes, setSelectedStrikes] = useState<Set<string>>(new Set());
  // A new symbol or session clears the strike picks: the strike universes only
  // partly overlap, so a carried pick would silently re-filter the new one.
  // Adjusted during render so the new session never paints through the old pick.
  const strikeScope = `${symbol}:${flowSession}`;
  const [strikesFor, setStrikesFor] = useState(strikeScope);
  if (strikesFor !== strikeScope) {
    setStrikesFor(strikeScope);
    setSelectedStrikes(new Set());
  }
  const { selection: sharedExpirations, setSelection: setSharedExpirations } = useSharedExpirations();
  const effectiveStrikes = useMemo(() => new Set(strikeOptions.filter((v) => selectedStrikes.has(v))), [strikeOptions, selectedStrikes]);
  // Through the shared reconcile, the one place the rolling 0DTE pick resolves:
  // here to the session's same-day expiration, which is today's only when the
  // session is today's.
  const effectiveExpirations = useMemo(
    () => new Set(reconcileExpirations(sharedExpirations, expirationOptions, dateKey)),
    [sharedExpirations, expirationOptions, dateKey],
  );
  const filtered = effectiveStrikes.size > 0 || effectiveExpirations.size > 0;
  const serverFilters = useMemo(
    () => ({ strikes: Array.from(effectiveStrikes), expirations: Array.from(effectiveExpirations) }),
    [effectiveStrikes, effectiveExpirations],
  );
  const toggleStrike = (value: string) =>
    setSelectedStrikes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  const toggleExpiration = (value: string) => {
    // Toggle against the resolved picks (a rolling 0DTE pick shows as the
    // session's date), and carry through dates this session has no option for: they
    // belong to other charts in the tab and are not this page's to drop.
    const foreign = sharedExpirations.filter((exp) => !isRollingZeroDte(exp) && !expirationOptions.includes(exp));
    const next = new Set([...effectiveExpirations, ...foreign]);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSharedExpirations(Array.from(next));
  };
  const clearScope = () => {
    setSelectedStrikes(new Set());
    setSharedExpirations([]);
  };
  const summary = scopeSummary(Array.from(effectiveStrikes), Array.from(effectiveExpirations), dateKey);
  // ES / NQ have no chain of their own: their flow is the index's, so the
  // strikes are index strikes, not prices on the futures axis.
  const chainNote =
    chainSymbol.toUpperCase() === symbol.toUpperCase()
      ? null
      : `${symbol} has no option chain of its own; its flow is ${chainSymbol} flow, so these are ${chainSymbol} strikes, not ${symbol} prices.`;

  // ── The rows ─────────────────────────────────────────────────────────────
  const scopedSeries = useFlowSeries(symbol, flowSession, {
    timeframe,
    filters: serverFilters,
    enabled: filtered,
  });
  const scopedRows = hydrated ? scopedSeries.rows : null;
  const scopedLoading = hydrated ? scopedSeries.loading : true;
  const scopedError = hydrated ? scopedSeries.error : null;
  const rows = filtered ? scopedRows : allRows;
  const loading = filtered ? scopedLoading : allLoading;
  // A first load that failed. A refresh that fails later keeps the rows it had.
  const loadError = filtered ? scopedError : allError;
  const failed = loadError != null && rows == null;
  const bars = useMemo<FlowBar[]>(() => buildFlowBars(rows), [rows]);
  const read = useMemo(() => flowRead(bars), [bars]);
  const events = useMemo<FlowEvent[]>(() => buildFlowEvents(bars, barMinutes), [bars, barMinutes]);

  const sessionStartMs = getETTimeTimestamp(dateKey, 9, 30) ?? NaN;
  const sessionEndMs = (getETTimeTimestamp(dateKey, 16, 15) ?? NaN) + barMs;
  const haveWindow = Number.isFinite(sessionStartMs) && Number.isFinite(sessionEndMs);
  // Still trading: today's session, before its last bar has closed. After the
  // close the day reads as final, as a past session does.
  const live = flowSession === 'current' && dateKey === todayKey && nowMs < sessionEndMs;
  const barLabel = read ? etTime(read.asOfMs) : null;
  const asOf = read ? `As of ${barLabel} ET` : null;

  const sessionOptions = useMemo(
    () => flowSessionOptions(flowSessionDays, flowSession, flowSession === 'current' ? dateKey : null),
    [flowSessionDays, flowSession, dateKey],
  );

  // ── Chart layers, remembered per browser ─────────────────────────────────
  const [priceOn, togglePrice] = usePersistedFlag(LAYER_KEY('price'), true);
  const [premiumOn, togglePremium] = usePersistedFlag(LAYER_KEY('premium'), true);
  const [legsOn, toggleLegs] = usePersistedFlag(LAYER_KEY('legs'), true);
  const [contractsOn, toggleContracts] = usePersistedFlag(LAYER_KEY('contracts'), true);
  const [pcrOn, togglePcr] = usePersistedFlag(LAYER_KEY('pcr'), true);
  const [eventsOn, toggleEvents] = usePersistedFlag(LAYER_KEY('events'), true);
  const layers: FlowChartLayers = { price: priceOn, premium: premiumOn, legs: legsOn && premiumOn, contracts: contractsOn, pcr: pcrOn, events: eventsOn };
  const toggles: Record<keyof FlowChartLayers, () => void> = {
    price: togglePrice,
    premium: togglePremium,
    legs: toggleLegs,
    contracts: toggleContracts,
    pcr: togglePcr,
    events: toggleEvents,
  };
  const noPanes = !priceOn && !premiumOn && !contractsOn && !pcrOn;

  // ── Full screen ──────────────────────────────────────────────────────────
  // The chart panel lifts over the page (hooks/useChartFullscreen) and the
  // chart takes the height its drawing area is left, so the panes fill the
  // window instead of a short chart floating in it.
  const fullscreen = useChartFullscreen();
  const chartPanelRef = useRef<HTMLDivElement | null>(null);
  const [restingH, setRestingH] = useState(0);
  const [drawingEl, setDrawingEl] = useState<HTMLDivElement | null>(null);
  const [fillH, setFillH] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (!fullscreen.active || !drawingEl) return;
    const measure = () => {
      const h = Math.floor(drawingEl.clientHeight - 14);
      if (h > 0) setFillH((cur) => (cur === h ? cur : h));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(drawingEl);
    return () => ro.disconnect();
  }, [fullscreen.active, drawingEl]);
  const toggleFullscreen = () => {
    if (!fullscreen.active) setRestingH(chartPanelRef.current?.offsetHeight ?? 0);
    fullscreen.toggle();
  };
  const restingChartH = isMobile ? 440 : 560;
  const chartHeight = fullscreen.active && fillH ? Math.max(360, fillH) : restingChartH;

  const [showAllEvents, setShowAllEvents] = useState(false);
  const [showAllBars, setShowAllBars] = useState(false);
  // The tape lists bars that traded: a narrow strike pick can leave most bars
  // empty, and a column of zeros reads as missing data.
  const recentBars = useMemo(() => bars.filter((b) => sideTotal(b.bar) > 0).reverse(), [bars]);
  const topRowFilling = live && recentBars.length > 0 && recentBars[0].ms === bars[bars.length - 1]?.ms;
  const visibleBars = showAllBars ? recentBars : recentBars.slice(0, BARS_COLLAPSED);
  const visibleEvents = showAllEvents ? events : events.slice(0, EVENTS_COLLAPSED);

  const layerControls = (
    <div role="group" aria-label="Chart layers" style={{ display: 'flex', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap' }}>
      {LAYER_BUTTONS.map((b) => {
        const on = layers[b.key];
        const disabled = b.key === 'legs' && !premiumOn;
        return (
          <button
            key={b.key}
            type="button"
            aria-pressed={on}
            onClick={toggles[b.key]}
            disabled={disabled}
            title={disabled ? 'Shown inside the net premium pane' : undefined}
            className="zg-btn"
            style={toggleStyle(on)}
          >
            {b.swatch && <span aria-hidden="true" style={{ display: 'inline-block', boxSizing: 'border-box', ...b.swatch, opacity: on ? 1 : 0.4 }} />}
            {b.label}
          </button>
        );
      })}
    </div>
  );
  const barControls = (
    <>
      <div role="group" aria-label="Bar size" style={{ display: 'flex', flex: 'none' }}>
        {(['5min', '1min'] as const).map((tf, i) => (
          <button
            key={tf}
            type="button"
            aria-pressed={timeframe === tf}
            onClick={() => setTimeframe(tf)}
            className="zg-btn"
            style={{ ...toggleStyle(timeframe === tf), borderLeftWidth: i === 0 ? 1 : 0 }}
          >
            {FLOW_TIMEFRAME_LABELS[tf]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={toggleFullscreen}
        aria-pressed={fullscreen.active}
        aria-label={fullscreen.active ? 'Exit full screen' : 'Full screen'}
        title={fullscreen.active ? 'Exit full screen (Esc)' : 'Full screen: the chart takes the whole window. Esc to exit.'}
        className="zg-btn"
        style={{ ...toggleStyle(fullscreen.active), color: fullscreen.active ? 'var(--color-accent-hot)' : 'var(--text-secondary)', borderColor: fullscreen.active ? 'var(--color-accent-hot)' : 'var(--border-default)' }}
      >
        {fullscreen.active ? <Minimize2 size={14} aria-hidden /> : <Maximize2 size={14} aria-hidden />}
        {!isMobile && (fullscreen.active ? 'Exit' : 'Full screen')}
      </button>
    </>
  );

  const showInitialLoading = loading && bars.length === 0;
  const scopeNote = filtered ? `Covering ${summary}.` : null;

  return (
    <PageShell>
      <PageHeader
        title="Flow Analysis"
        sub="What traded today, and who crossed the spread to trade it: premium, contracts bought and sold on each side, and the put/call, on one clock."
        tooltip="The tape rather than the book. Every option print is classed by which side crossed the spread: at or near the ask it counts as bought, at or near the bid as sold, and prints at the midpoint are shared out in proportion to that contract's ask and bid prints. Calls bought and puts sold are the bullish side, puts bought and calls sold the bearish side; net flow is the gap between them in contracts, and net premium the same in dollars. The aggressor read is the closest the feed gets to intent, but it cannot tell an opening buy from a closing one. The last week of sessions is there so you can see whether today is unusual at all."
        actions={
          <FilterBar>
            <FilterSelect label="Session" value={flowSession} onChange={setFlowSession} options={sessionOptions} />
            <ContractScopeButton summary={summary} active={filtered} open={scopeOpen} onToggle={() => setScopeOpen((v) => !v)} onClear={clearScope} />
            {asOf ? <span className="zg-caption">{asOf}</span> : null}
          </FilterBar>
        }
      />

      {failed ? <ErrorMessage message={loadError} /> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {scopeOpen && (
          <ContractScopePanel
            strikeOptions={strikeOptions}
            expirationOptions={expirationOptions}
            selectedStrikes={effectiveStrikes}
            selectedExpirations={effectiveExpirations}
            onToggleStrike={toggleStrike}
            onToggleExpiration={toggleExpiration}
            onClearStrikes={() => setSelectedStrikes(new Set())}
            onClearExpirations={() => setSharedExpirations([])}
            sessionKey={dateKey}
            loading={contractsLoading}
            error={contractsError}
            note={chainNote}
          />
        )}

        {/* The one-line read */}
        <section
          aria-label="Session read"
          className="zg-panel"
          style={{
            background: 'var(--border-default)',
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 1,
            overflow: 'hidden',
          }}
        >
          <ReadCell
            label="Flow"
            value={read ? FLOW_REGIME_LABEL[read.regime] : '—'}
            valueColor={read ? REGIME_COLOR[read.regime] : undefined}
            sub={read ? read.regimeDetail : showInitialLoading ? 'loading the session…' : failed ? "didn't load" : 'no trades yet'}
          />
          <ReadCell
            label="Net premium"
            value={read ? fmtUsdCompact(read.netPremium, true) : '—'}
            valueColor={signColor(read?.netPremium)}
            sub={read ? `calls ${fmtUsdCompact(read.callPremium, true)} · puts ${fmtUsdCompact(read.putPremium, true)}` : '—'}
          />
          <ReadCell
            label="Net flow"
            value={read ? fmtContracts(read.netFlow, true) : '—'}
            valueColor={signColor(read?.netFlow)}
            sub={read ? `contracts · ${fmtShare(read.bullish, read.bullish + read.bearish)} bullish side` : '—'}
          />
          <ReadCell
            label="Put/call"
            value={read?.putCallRatio != null ? read.putCallRatio.toFixed(2) : '—'}
            sub={read ? `${fmtContractsCompact(read.putVolume)} puts · ${fmtContractsCompact(read.callVolume)} calls` : '—'}
          />
          <div style={isMobile ? { gridColumn: 'span 2', display: 'grid' } : { display: 'grid' }}>
            <ReadCell
              label="Volume"
              value={read ? fmtContracts(read.totalVolume) : '—'}
              sub={read && barLabel && live ? `+${fmtContracts(read.lastVolume)} since ${barLabel}` : read ? 'contracts, session final' : 'contracts traded'}
            />
          </div>
        </section>

        {/* Bought vs. sold */}
        {/* The latest bar's additions only mean something while it is trading. */}
        <BoughtSoldBoard read={read} barLabel={live ? barLabel : null} compact={isMobile} loading={showInitialLoading} failed={failed} live={live} scopeNote={scopeNote} />

        {/* The chart */}
        {fullscreen.active && <div aria-hidden="true" style={{ height: restingH }} />}
        <div
          ref={chartPanelRef}
          className="zg-panel"
          style={fullscreen.active ? { ...FULLSCREEN_LAYER_STYLE, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto' } : undefined}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderBottom: `1px solid ${ruleColor}`,
              flex: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', minWidth: 0 }}>
              <h2 className="zg-h3" style={{ margin: 0 }}>
                {fullscreen.active ? `${symbol} flow` : 'Session'}
              </h2>
              <span className="zg-caption">
                {barMinutes}-minute bars · {dateLabel(dateKey)} · times in ET
                {filtered ? ` · ${summary}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : undefined, maxWidth: '100%' }}>
              {/* A phone scrolls this row sideways, so the bar size and full
                  screen lead it there, in sight; the layers follow. */}
              {isMobile ? (
                <>
                  {barControls}
                  {layerControls}
                </>
              ) : (
                <>
                  {layerControls}
                  {barControls}
                </>
              )}
            </div>
          </div>
          <div
            ref={setDrawingEl}
            style={fullscreen.active ? { flex: '1 1 0%', minHeight: 374, padding: '10px 10px 4px', overflow: 'hidden' } : { padding: '10px 10px 4px' }}
          >
            {showInitialLoading || !haveWindow ? (
              <div style={{ height: chartHeight, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center', padding: '0 12px' }} aria-hidden="true">
                <div className="zg-skeleton-line" style={{ width: '38%', height: 10 }} />
                <div className="zg-skeleton-line" style={{ width: '100%', height: Math.max(120, chartHeight * 0.45) }} />
                <div className="zg-skeleton-line" style={{ width: '62%', height: 10 }} />
              </div>
            ) : bars.length === 0 ? (
              <div className="zg-caption" style={{ padding: '48px 12px', textAlign: 'center' }}>
                {failed ? "The flow didn't load." : filtered ? 'Nothing has traded in the contracts you picked this session.' : 'No flow yet for this session.'}
              </div>
            ) : noPanes ? (
              <div className="zg-caption" style={{ padding: '48px 12px', textAlign: 'center' }}>
                Every pane is switched off. Turn one back on above.
              </div>
            ) : (
              <FlowSessionChart
                bars={bars}
                sessionStartMs={sessionStartMs}
                sessionEndMs={sessionEndMs}
                barMs={barMs}
                live={live}
                layers={layers}
                events={events}
                height={chartHeight}
                compact={isMobile}
                symbol={symbol}
                ariaLabel={`${symbol} options flow for the session in ${barMinutes}-minute bars: price, net premium with the call and put legs, contracts bought and sold each bar, and the put/call ratio`}
              />
            )}
          </div>
          <p className="zg-caption" style={{ margin: 0, padding: '8px 16px 12px', borderTop: `1px solid ${ruleColor}`, flex: 'none' }}>
            Up bars are the bullish side, calls bought with puts sold stacked lighter on top; down bars the bearish side, puts bought with calls sold. Numbered markers match the flow log.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))', gap: 20, alignItems: 'start' }}>
          {/* The flow log */}
          <Panel padded={false}>
            <PanelHead title="Flow log" caption="Net flow and net premium turning, put/call crossing 1, and volume bursts, newest first." />
            {events.length === 0 ? (
              <p className="zg-caption" style={{ margin: 0, padding: '18px 16px' }}>
                {showInitialLoading ? 'Loading the session…' : failed ? "The flow didn't load." : 'Nothing notable yet this session.'}
              </p>
            ) : isMobile ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: '0 16px' }}>
                {visibleEvents.map((e, i) => (
                  <li key={e.id} style={{ padding: '11px 0', borderBottom: i === visibleEvents.length - 1 ? 'none' : `1px solid ${ruleColor}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: TONE_DOT[e.tone], flex: 'none' }} />
                      <span className="zg-mono" style={{ fontSize: 13 }}>
                        {etTime(e.ms)}
                      </span>
                      <span>
                        {e.title}
                        <MarkerBadge n={e.marker} tone={e.tone} />
                      </span>
                    </div>
                    <div className="zg-mono" style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, marginTop: 3 }}>
                      {e.detail ? `${e.detail} · ` : ''}
                      {fmtLevel(e.price)}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ padding: '2px 16px 8px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 420 }}>
                  <thead>
                    <tr>
                      {(['ET', 'Event', 'Price'] as const).map((h, i) => (
                        <th
                          key={h}
                          scope="col"
                          className="zg-mono"
                          style={{ textAlign: i === 2 ? 'right' : 'left', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', padding: '10px 8px 6px', paddingLeft: i === 0 ? 0 : 8, paddingRight: i === 2 ? 0 : 8, borderBottom: `1px solid ${ruleColor}` }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEvents.map((e, i) => {
                      const cell: CSSProperties = { padding: '9px 8px', borderBottom: i === visibleEvents.length - 1 ? 'none' : `1px solid ${ruleColor}` };
                      return (
                        <tr key={e.id}>
                          <td className="zg-mono" style={{ ...cell, paddingLeft: 0, whiteSpace: 'nowrap', fontSize: 13 }}>
                            {etTime(e.ms)}
                            <MarkerBadge n={e.marker} tone={e.tone} />
                          </td>
                          <td style={cell}>
                            <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: TONE_DOT[e.tone], marginRight: 8 }} />
                            {e.title}
                            {e.detail && <span style={{ color: 'var(--text-muted)' }}> · {e.detail}</span>}
                          </td>
                          <td className="zg-mono" style={{ ...cell, paddingRight: 0, textAlign: 'right', fontSize: 13 }}>
                            {fmtLevel(e.price)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {events.length > EVENTS_COLLAPSED && <ShowMore open={showAllEvents} total={events.length} noun="events" onClick={() => setShowAllEvents((v) => !v)} />}
          </Panel>

          {/* The tape, bar by bar */}
          <Panel padded={false}>
            <PanelHead
              title="Bar by bar"
              caption={`${isMobile ? `Contracts in each ${barMinutes}-minute bar, bought / sold` : `Contracts bought and sold in each ${barMinutes}-minute bar`}, newest first; bars with no trades are left out.${topRowFilling ? ' The top row is still filling.' : ''}`}
            />
            {recentBars.length === 0 ? (
              <p className="zg-caption" style={{ margin: 0, padding: '18px 16px' }}>
                {showInitialLoading ? 'Loading the session…' : failed ? "The flow didn't load." : 'Nothing has traded yet this session.'}
              </p>
            ) : isMobile ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: '0 16px' }}>
                {visibleBars.map((b, i) => {
                  const net = b.bar.callsBought + b.bar.putsSold - (b.bar.putsBought + b.bar.callsSold);
                  return (
                    <li key={b.ms} style={{ padding: '10px 0', borderBottom: i === visibleBars.length - 1 ? 'none' : `1px solid ${ruleColor}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span className="zg-mono" style={{ fontSize: 13 }}>
                          {etTime(b.ms)}
                        </span>
                        <span className="zg-mono" style={{ fontSize: 13, color: signColor(net) }}>
                          net {fmtContracts(net, true)}
                        </span>
                      </div>
                      <div className="zg-mono" style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 3, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                        <span>calls {fmtContracts(b.bar.callsBought)} / {fmtContracts(b.bar.callsSold)}</span>
                        <span>puts {fmtContracts(b.bar.putsBought)} / {fmtContracts(b.bar.putsSold)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div style={{ padding: '2px 16px 8px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 460 }}>
                  <thead>
                    <tr>
                      <th scope="col" rowSpan={2} className="zg-mono" style={{ textAlign: 'left', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', padding: '10px 8px 6px 0', borderBottom: `1px solid ${ruleColor}`, verticalAlign: 'bottom' }}>
                        ET
                      </th>
                      <th scope="colgroup" colSpan={2} className="zg-mono" style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', padding: '10px 8px 0' }}>
                        Calls
                      </th>
                      <th scope="colgroup" colSpan={2} className="zg-mono" style={{ textAlign: 'center', fontSize: 11, fontWeight: 500, color: 'var(--text-secondary)', padding: '10px 8px 0' }}>
                        Puts
                      </th>
                      <th scope="col" rowSpan={2} className="zg-mono" style={{ textAlign: 'right', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', padding: '10px 0 6px 8px', borderBottom: `1px solid ${ruleColor}`, verticalAlign: 'bottom' }}>
                        Net flow
                      </th>
                    </tr>
                    <tr>
                      {['bought', 'sold', 'bought', 'sold'].map((h, i) => (
                        <th key={`${h}-${i}`} scope="col" className="zg-mono" style={{ textAlign: 'right', fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', padding: '2px 8px 6px', borderBottom: `1px solid ${ruleColor}` }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleBars.map((b, i) => {
                      const net = b.bar.callsBought + b.bar.putsSold - (b.bar.putsBought + b.bar.callsSold);
                      const cell: CSSProperties = { padding: '7px 8px', textAlign: 'right', borderBottom: i === visibleBars.length - 1 ? 'none' : `1px solid ${ruleColor}` };
                      return (
                        <tr key={b.ms}>
                          <td className="zg-mono" style={{ ...cell, textAlign: 'left', paddingLeft: 0 }}>
                            {etTime(b.ms)}
                          </td>
                          <td className="zg-datum" style={cell}>
                            {fmtContracts(b.bar.callsBought)}
                          </td>
                          <td className="zg-datum" style={cell}>
                            {fmtContracts(b.bar.callsSold)}
                          </td>
                          <td className="zg-datum" style={cell}>
                            {fmtContracts(b.bar.putsBought)}
                          </td>
                          <td className="zg-datum" style={cell}>
                            {fmtContracts(b.bar.putsSold)}
                          </td>
                          <td className="zg-datum" style={{ ...cell, paddingRight: 0, color: signColor(net) }}>
                            {fmtContracts(net, true)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {recentBars.length > BARS_COLLAPSED && <ShowMore open={showAllBars} total={recentBars.length} noun="bars" onClick={() => setShowAllBars((v) => !v)} />}
          </Panel>
        </div>

        <footer className="zg-caption" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
          <span>Flow is context for the levels, not a signal on its own.</span>
          <Link href="/help/platform/flow-analysis" style={{ color: 'var(--color-accent-hot)' }}>
            How to read this page
          </Link>
        </footer>
      </div>
    </PageShell>
  );
}
