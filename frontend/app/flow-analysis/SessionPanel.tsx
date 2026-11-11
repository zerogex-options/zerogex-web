'use client';

/**
 * The Flow Analysis page's Session chart, with its toolbar and its key: the
 * one block the page and the My Dashboard "Flow Analysis - Session" widget
 * both mount, so the tile can't drift from the page.
 *
 * It owns what only the chart uses: which panes and layers are on, the strike
 * ribbon's reads, the flip and walls, and full screen. The layer buttons are
 * remembered per browser and shared by the page and every tile, the way the
 * Gamma Chart's are. The session's rows are the caller's (useFlowSessionData),
 * because the page reads them for its other panels too.
 *
 * In a tile (`inWidget`) two things change: there is no Full screen, since a
 * tile is sized by its footprint and owns its top-right corner, and the key
 * under the chart points to the page for the flow log, which is not in the tile.
 */

import Link from 'next/link';
import { useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { ArrowUpRight, Maximize2, Minimize2 } from 'lucide-react';
import FlowSessionChart, { type FlowChartLayers, type FlowLevels } from '@/components/FlowSessionChart';
import { useFlowByStrike } from '@/hooks/useFlowByStrike';
import { useGammaPlaybook } from '@/hooks/useGammaPlaybook';
import { usePersistedFlag } from '@/hooks/usePersistedFlag';
import { usePersistedChoice } from '@/hooks/usePersistedChoice';
import { usePersistedText } from '@/hooks/usePersistedText';
import { useMarketQuote } from '@/hooks/useApiData';
import { FULLSCREEN_LAYER_STYLE, useChartFullscreen } from '@/hooks/useChartFullscreen';
import { FLOW_TIMEFRAME_LABELS, type FlowTimeframe } from '@/core/flowSeriesCharts';
import { parseSizing, sizingKey, strikeCellsByBar, type StrikeDotSize } from '@/core/flowStrikes';
import type { FlowSessionData } from './useFlowSessionData';

// One remembered flag per layer, per browser (hooks/usePersistedFlag).
const LAYER_KEY = (layer: keyof FlowChartLayers) => `zg.flow.layer.${layer}`;
const LAYER_BUTTONS: Array<{ key: keyof FlowChartLayers; label: string; swatch: CSSProperties | null }> = [
  { key: 'price', label: 'Price', swatch: { width: 14, borderTop: '2px solid var(--text-primary)' } },
  { key: 'strikes', label: 'Strikes', swatch: { width: 12, height: 7, borderRadius: 999, background: 'linear-gradient(90deg, var(--color-bull) 50%, var(--color-bear) 50%)' } },
  { key: 'walls', label: 'Flip and walls', swatch: { width: 14, borderTop: '2px dashed var(--color-flip)' } },
  { key: 'premium', label: 'Net premium', swatch: { width: 14, height: 9, background: 'color-mix(in srgb, var(--color-bull) 30%, transparent)', borderTop: '2px solid var(--text-primary)' } },
  { key: 'legs', label: 'Call & put legs', swatch: { width: 14, height: 6, borderTop: '2px solid var(--color-bull)', borderBottom: '2px solid var(--color-bear)' } },
  { key: 'contracts', label: 'Contracts', swatch: { width: 10, height: 10, background: 'linear-gradient(var(--color-bull) 50%, var(--color-bear) 50%)' } },
  { key: 'pcr', label: 'Put/call', swatch: { width: 14, borderTop: '2px solid var(--color-info)' } },
  { key: 'events', label: 'Events', swatch: null },
];
// The strike ribbon's size filter, smallest dot first.
const STRIKE_SIZES: readonly StrikeDotSize[] = ['all', 'medium', 'large'];
const STRIKE_SIZE_BUTTONS: Array<{ value: StrikeDotSize; label: string; title: string }> = [
  { value: 'all', label: 'All dots', title: 'Every strike one side led' },
  { value: 'medium', label: 'Medium+', title: 'The medium and large dots: strikes with a bigger net flow' },
  { value: 'large', label: 'Large', title: 'Only the largest dots: the strikes pressed hardest' },
];

const ruleColor = 'var(--border-subtle)';

function dateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  if (!y || !m || !d) return dateKey;
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
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

/**
 * The session chart with its newest price on the live quote. A component of
 * its own so the second-by-second quote redraws the chart rather than the
 * whole page. Only a live session asks for the quote; a quote older than the
 * newest bar, or a stale futures feed, is left out.
 */
function LiveFlowSessionChart(props: ComponentProps<typeof FlowSessionChart>) {
  const { bars, live, symbol, sessionEndMs } = props;
  const { data: quote } = useMarketQuote(symbol, live ? 1000 : 0, live);
  const newestMs = bars.length > 0 ? bars[bars.length - 1].ms : null;
  const quoteMs = quote ? Date.parse(quote.timestamp) : NaN;
  const livePrice =
    live && quote && !quote.stale && Number.isFinite(quote.close) && newestMs != null && quoteMs >= newestMs && quoteMs <= sessionEndMs
      ? quote.close
      : null;
  return <FlowSessionChart {...props} livePrice={livePrice} />;
}

export default function SessionPanel({
  data,
  onTimeframe,
  compact,
  inWidget = false,
  title,
}: {
  data: FlowSessionData;
  onTimeframe: (next: FlowTimeframe) => void;
  /** The phone layout: one toolbar row that scrolls sideways, and the compact chart. */
  compact: boolean;
  /** In a My Dashboard tile: no Full screen, and the key points to the page's flow log. */
  inWidget?: boolean;
  /** In place of the page's "Session" heading. */
  title?: ReactNode;
}) {
  const {
    symbol,
    flowSession,
    timeframe,
    barMinutes,
    barMs,
    hydrated,
    dateKey,
    filtered,
    summary,
    serverFilters,
    scopePending,
    bars,
    events,
    failed,
    showInitialLoading,
    sessionStartMs,
    sessionEndMs,
    haveWindow,
    live,
  } = data;

  // ── Chart layers, remembered per browser ─────────────────────────────────
  const [priceOn, togglePrice] = usePersistedFlag(LAYER_KEY('price'), true);
  const [premiumOn, togglePremium] = usePersistedFlag(LAYER_KEY('premium'), true);
  const [legsOn, toggleLegs] = usePersistedFlag(LAYER_KEY('legs'), true);
  const [contractsOn, toggleContracts] = usePersistedFlag(LAYER_KEY('contracts'), true);
  const [pcrOn, togglePcr] = usePersistedFlag(LAYER_KEY('pcr'), true);
  const [eventsOn, toggleEvents] = usePersistedFlag(LAYER_KEY('events'), true);
  const [strikesOn, toggleStrikes] = usePersistedFlag(LAYER_KEY('strikes'), true);
  const [wallsOn, toggleWalls] = usePersistedFlag(LAYER_KEY('walls'), true);
  // The flip and walls are where they stand now, so they are drawn on the
  // current session only; the strike ribbon reads either bar size.
  const strikesAvailable = priceOn;
  const [strikeSize, setStrikeSize] = usePersistedChoice<StrikeDotSize>('zg.flow.strikes.size', STRIKE_SIZES, 'all');
  // The dot sizes, Auto or the reader's own contract counts, per symbol: SPY's
  // and SPX's contract numbers have nothing in common.
  const [sizingStored, setSizingStored] = usePersistedText(`zg.flow.strikes.sizes.${symbol}`, 'auto');
  const strikeSizing = useMemo(() => parseSizing(sizingStored), [sizingStored]);
  const wallsAvailable = priceOn && flowSession === 'current';
  const layers: FlowChartLayers = {
    price: priceOn,
    premium: premiumOn,
    legs: legsOn && premiumOn,
    contracts: contractsOn,
    pcr: pcrOn,
    events: eventsOn,
    strikes: strikesOn && strikesAvailable,
    walls: wallsOn && wallsAvailable,
  };
  const toggles: Record<keyof FlowChartLayers, () => void> = {
    price: togglePrice,
    premium: togglePremium,
    legs: toggleLegs,
    contracts: toggleContracts,
    pcr: togglePcr,
    events: toggleEvents,
    strikes: toggleStrikes,
    walls: toggleWalls,
  };
  const noPanes = !priceOn && !premiumOn && !contractsOn && !pcrOn;

  // ── Strikes and levels ───────────────────────────────────────────────────
  // The ribbon narrows with the page's contract picks, like every other number
  // on it. Read only while it is drawn, and not while a remembered pick waits
  // on the chain's expirations to resolve: that read would be the whole chain's
  // ribbon, thrown away a moment later.
  const { rows: strikeRows } = useFlowByStrike(symbol, flowSession, {
    filters: serverFilters,
    timeframe,
    enabled: hydrated && layers.strikes && !scopePending,
  });
  const strikeCells = useMemo(() => (strikeRows ? strikeCellsByBar(strikeRows) : null), [strikeRows]);
  // The Key Levels strip's read, so this chart, the gamma charts and Technicals
  // agree on the flip and the walls (and follow the same expiration picks).
  const playbook = useGammaPlaybook({ enabled: hydrated && layers.walls });
  const flowLevels: FlowLevels | null = layers.walls
    ? { flip: playbook.flip, callWall: playbook.callWall, putWall: playbook.putWall }
    : null;

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
  const restingChartH = compact ? 440 : 560;
  const chartHeight = fullscreen.active && fillH ? Math.max(360, fillH) : restingChartH;

  const layerControls = (
    <div role="group" aria-label="Chart layers" style={{ display: 'flex', gap: 6, flexWrap: compact ? 'nowrap' : 'wrap' }}>
      {LAYER_BUTTONS.map((b) => {
        const on = layers[b.key];
        const why =
          b.key === 'legs' && !premiumOn
            ? 'Shown inside the net premium pane'
            : (b.key === 'strikes' || b.key === 'walls') && !priceOn
              ? 'Shown inside the price pane'
              : b.key === 'walls' && !wallsAvailable
                ? 'Where they stand now, so on the current session only'
                : null;
        const disabled = why != null;
        return (
          <button
            key={b.key}
            type="button"
            aria-pressed={on}
            onClick={toggles[b.key]}
            disabled={disabled}
            title={why ?? undefined}
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
            onClick={() => onTimeframe(tf)}
            className="zg-btn"
            style={{ ...toggleStyle(timeframe === tf), borderLeftWidth: i === 0 ? 1 : 0 }}
          >
            {FLOW_TIMEFRAME_LABELS[tf]}
          </button>
        ))}
      </div>
      {/* The strike ribbon's size filter: in this row rather than beside the
          Strikes button, so the layer row keeps its length. */}
      {layers.strikes && (
        <div role="group" aria-label="Strike dots shown" style={{ display: 'flex', flex: 'none' }}>
          {STRIKE_SIZE_BUTTONS.map((c, i) => (
            <button
              key={c.value}
              type="button"
              aria-pressed={strikeSize === c.value}
              onClick={() => setStrikeSize(c.value)}
              title={c.title}
              className="zg-btn"
              style={{ ...toggleStyle(strikeSize === c.value), borderLeftWidth: i === 0 ? 1 : 0 }}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
      {/* A tile is sized by its footprint, and its own controls hold its
          top-right corner, so full screen is the page's alone. */}
      {!inWidget && (
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
          {!compact && (fullscreen.active ? 'Exit' : 'Full screen')}
        </button>
      )}
    </>
  );

  return (
    <>
      {fullscreen.active && <div aria-hidden="true" style={{ height: restingH }} />}
      <div
        ref={chartPanelRef}
        className="zg-panel"
        style={
          fullscreen.active
            ? { ...FULLSCREEN_LAYER_STYLE, display: 'flex', flexDirection: 'column', overflowX: 'hidden', overflowY: 'auto' }
            : inWidget
              ? // As tall as its tile, which a taller tile beside it can stretch.
                { height: '100%' }
              : undefined
        }
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
            {title ?? (
              <h2 className="zg-h3" style={{ margin: 0 }}>
                {fullscreen.active ? `${symbol} flow` : 'Session'}
              </h2>
            )}
            <span className="zg-caption">
              {barMinutes}-minute bars · {dateLabel(dateKey)} · times in ET
              {filtered ? ` · ${summary}` : ''}
            </span>
            {inWidget && (
              <Link
                href="/flow-analysis"
                className="zg-caption inline-flex items-center gap-1 transition-opacity opacity-60 hover:opacity-100"
                style={{ color: 'var(--color-accent-hot)' }}
              >
                Flow Analysis
                <ArrowUpRight size={13} aria-hidden />
              </Link>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: compact ? 'nowrap' : 'wrap', overflowX: compact ? 'auto' : undefined, maxWidth: '100%' }}>
            {/* A phone scrolls this row sideways, so the bar size and full
                screen lead it there, in sight; the layers follow. */}
            {compact ? (
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
            <LiveFlowSessionChart
              bars={bars}
              sessionStartMs={sessionStartMs}
              sessionEndMs={sessionEndMs}
              barMs={barMs}
              live={live}
              layers={layers}
              events={events}
              height={chartHeight}
              compact={compact}
              symbol={symbol}
              strikeCells={strikeCells}
              strikeSize={strikeSize}
              strikeSizing={strikeSizing}
              onStrikeSizing={(next) => setSizingStored(sizingKey(next))}
              levels={flowLevels}
              ariaLabel={`${symbol} options flow for the session in ${barMinutes}-minute bars: price${layers.strikes ? ' with contracts bought and sold at each strike' : ''}${layers.walls ? ', the flip and the walls' : ''}, net premium with the call and put legs, contracts bought and sold each bar, and the put/call ratio`}
            />
          )}
        </div>
        <p className="zg-caption" style={{ margin: 0, padding: '8px 16px 12px', borderTop: `1px solid ${ruleColor}`, flex: 'none' }}>
          {layers.strikes &&
            'Strike dots: calls bought minus calls sold, plus puts sold minus puts bought, at that strike in that bar; green above zero, red below, and small, medium or large by that net. '}
          {layers.walls && 'Dashed lines are the flip and walls as they stand now. '}
          Up bars are the bullish side, calls bought with puts sold stacked lighter on top; down bars the bearish side, puts bought with calls sold.{' '}
          {inWidget
            ? 'Hover a numbered marker for its event; the full flow log is on Flow Analysis.'
            : 'Numbered markers match the flow log.'}
        </p>
      </div>
    </>
  );
}
