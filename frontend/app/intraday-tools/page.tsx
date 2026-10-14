/**
 * Technicals: the session's price picture, read against the dealer levels.
 *
 * One chart carries the candles, VWAP, the opening range, the gamma flip, both
 * walls and the pin, with volume underneath; a one-line read sits above it and
 * the opening range and the session's events sit below. Price, VWAP, the
 * range, volume and momentum come from `/api/technicals` (useTechnicals); the
 * candles are the Gamma Terminal's own (useMarketHistorical); the levels and
 * regime are the Key Levels strip's read (useGammaPlaybook), so all three
 * surfaces agree on the flip and the walls.
 */

'use client';

import Link from 'next/link';
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import PageShell from '@/components/layout/PageShell';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import ErrorMessage from '@/components/ErrorMessage';
import TechnicalsSessionChart, {
  type SessionChartLayers,
  type SessionVolumeBar,
  type SessionVwapPoint,
} from '@/components/TechnicalsSessionChart';
import { useTechnicals } from '@/hooks/useTechnicals';
import { useMarketHistorical } from '@/hooks/useMarketHistorical';
import { useGammaPlaybook } from '@/hooks/useGammaPlaybook';
import { useIsMobile } from '@/hooks/useIsMobile';
import { usePersistedFlag } from '@/hooks/usePersistedFlag';
import { useTimeframe } from '@/core/TimeframeContext';
import { isIndexSymbol, isWithinExtendedMarketHours } from '@/core/utils';
import { ET_HM, etMinuteOfDay, safeNum } from '@/core/technicalsCharts';
import {
  ORB_BAR_OUTER,
  ORB_NEAR_FRACTION,
  ORB_ZONE_LABEL,
  buildSessionEvents,
  deriveOrbLog,
  fmtDistance,
  fmtLevel,
  orbBarPosition,
  orbZone,
  type Candle,
  type OrbEvent,
  type SessionEvent,
  type SessionEventTone,
} from '@/core/technicalsSession';

// One remembered flag per layer, per browser (hooks/usePersistedFlag).
const LAYER_KEY = (layer: keyof SessionChartLayers) => `zg.technicals.layer.${layer}`;
const LAYER_BUTTONS: Array<{ key: keyof SessionChartLayers; label: string; swatch: CSSProperties | null }> = [
  { key: 'vwap', label: 'VWAP', swatch: { width: 14, borderTop: '2px dashed var(--color-warning)' } },
  { key: 'orb', label: 'Opening range', swatch: { width: 14, height: 9, background: 'color-mix(in srgb, var(--color-hazy) 30%, transparent)', borderTop: '1px solid var(--color-hazy)', borderBottom: '1px solid var(--color-hazy)' } },
  { key: 'levels', label: 'Flip and walls', swatch: { width: 14, borderTop: '2px dashed var(--color-flip)' } },
  { key: 'volume', label: 'Volume', swatch: null },
  { key: 'events', label: 'Events', swatch: null },
];
const EVENTS_COLLAPSED = 10;

const TONE_DOT: Record<SessionEventTone, string> = {
  warning: 'var(--color-warning)',
  bullish: 'var(--color-bull)',
  bearish: 'var(--color-bear)',
  range: 'var(--color-hazy)',
  neutral: 'var(--text-muted)',
};

const ruleColor = 'var(--border-subtle)';

function etTime(ms: number): string {
  return ET_HM.format(new Date(ms));
}

function signed(value: number | null, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : '-'}${Math.abs(value).toFixed(digits)}`;
}

function changeColor(value: number | null): string {
  if (value == null || value === 0) return 'var(--text-secondary)';
  return value > 0 ? 'var(--color-bull)' : 'var(--color-bear)';
}

function Label({ children }: { children: ReactNode }) {
  return <div className="zg-label">{children}</div>;
}

function ReadCell({
  label,
  value,
  sub,
  subColor,
  size = 22,
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  subColor?: string;
  size?: number;
}) {
  return (
    <div style={{ background: 'var(--bg-card)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <Label>{label}</Label>
      <div className="zg-metric" style={{ fontSize: size, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
      <div className="zg-mono" style={{ fontSize: 12, color: subColor ?? 'var(--text-muted)' }}>
        {sub}
      </div>
    </div>
  );
}

function MarkerBadge({ n, tone }: { n: number; tone: SessionEventTone }) {
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
        border: `1px solid ${tone === 'warning' ? 'var(--color-warning)' : 'var(--color-hazy)'}`,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--text-primary)',
        marginLeft: 6,
        verticalAlign: 'middle',
      }}
    >
      {n}
    </span>
  );
}

function orbLogText(e: OrbEvent): { title: string; detail: string } {
  switch (e.kind) {
    case 'breakout':
      return { title: 'Broke above the high', detail: `closed ${fmtLevel(e.price)}` };
    case 'breakdown':
      return { title: 'Broke below the low', detail: `closed ${fmtLevel(e.price)}` };
    case 'furthest':
      return {
        title: e.ongoing ? 'Furthest so far' : 'Furthest move',
        detail: `${fmtLevel(e.price)} · ${(e.multiple ?? 0).toFixed(2)}× the range`,
      };
    case 'backInside':
      return { title: 'Back inside', detail: `${e.side === 'above' ? 'breakout' : 'breakdown'} failed after ${e.minutes ?? 0} min` };
    case 'testHigh':
      return { title: 'Tested the high', detail: `wick ${fmtLevel(e.price)}, closed inside` };
    case 'testLow':
      return { title: 'Tested the low', detail: `wick ${fmtLevel(e.price)}, closed inside` };
  }
}

export default function TechnicalsPage() {
  const { symbol } = useTimeframe();
  const isMobile = useIsMobile();
  const { bars, latest, sessionStartEt, sessionEndEt, fetchedAt, loading, error } = useTechnicals(symbol);
  const read = useGammaPlaybook();
  const { rows: candleRows } = useMarketHistorical(symbol, '5min', !isIndexSymbol(symbol), true);

  const [showAllEvents, setShowAllEvents] = useState(false);

  // Every layer starts on; a viewer's choices are remembered in this browser.
  const [vwapOn, toggleVwap] = usePersistedFlag(LAYER_KEY('vwap'), true);
  const [orbOn, toggleOrb] = usePersistedFlag(LAYER_KEY('orb'), true);
  const [levelsOn, toggleLevels] = usePersistedFlag(LAYER_KEY('levels'), true);
  const [volumeOn, toggleVolume] = usePersistedFlag(LAYER_KEY('volume'), true);
  const [eventsOn, toggleEvents] = usePersistedFlag(LAYER_KEY('events'), true);
  const layers: SessionChartLayers = { vwap: vwapOn, orb: orbOn, levels: levelsOn, volume: volumeOn, events: eventsOn };
  const toggles: Record<keyof SessionChartLayers, () => void> = {
    vwap: toggleVwap,
    orb: toggleOrb,
    levels: toggleLevels,
    volume: toggleVolume,
    events: toggleEvents,
  };

  // ── The session window ───────────────────────────────────────────────────
  const sessionStartMs = useMemo(() => {
    const ms = sessionStartEt ? Date.parse(sessionStartEt) : NaN;
    if (Number.isFinite(ms)) return ms;
    return bars.length ? Date.parse(bars[0].timestamp) : NaN;
  }, [sessionStartEt, bars]);
  const sessionEndMs = useMemo(() => {
    const ms = sessionEndEt ? Date.parse(sessionEndEt) : NaN;
    if (Number.isFinite(ms)) return ms;
    return bars.length ? Date.parse(bars[bars.length - 1].timestamp) + 5 * 60_000 : NaN;
  }, [sessionEndEt, bars]);
  const haveWindow = Number.isFinite(sessionStartMs) && Number.isFinite(sessionEndMs) && sessionEndMs > sessionStartMs;

  const candles = useMemo<Candle[]>(() => {
    if (!haveWindow) return [];
    const out: Candle[] = [];
    for (const r of candleRows) {
      const ms = Date.parse(r.timestamp);
      if (!Number.isFinite(ms) || ms < sessionStartMs || ms >= sessionEndMs) continue;
      const open = safeNum(r.open);
      const high = safeNum(r.high);
      const low = safeNum(r.low);
      const close = safeNum(r.close ?? r.price);
      if (open == null || high == null || low == null || close == null) continue;
      out.push({ ms, open, high, low, close });
    }
    return out.sort((a, b) => a.ms - b.ms);
  }, [candleRows, haveWindow, sessionStartMs, sessionEndMs]);

  const vwapPoints = useMemo<SessionVwapPoint[]>(() => {
    const out: SessionVwapPoint[] = [];
    for (const b of bars) {
      const ms = Date.parse(b.timestamp);
      const v = safeNum(b.vwap_deviation?.vwap);
      if (Number.isFinite(ms) && v != null) out.push({ ms, vwap: v });
    }
    return out;
  }, [bars]);

  const volumeBars = useMemo<SessionVolumeBar[]>(() => {
    const out: SessionVolumeBar[] = [];
    for (const b of bars) {
      const ms = Date.parse(b.timestamp);
      const v = safeNum(b.volume_spike?.current_volume) ?? safeNum(b.volume);
      if (!Number.isFinite(ms) || v == null) continue;
      const cls = b.volume_spike?.volume_class ?? '';
      out.push({ ms, volume: v, spike: !!cls && !cls.toLowerCase().includes('normal'), buyingPct: safeNum(b.volume_spike?.buying_pressure_pct) });
    }
    return out;
  }, [bars]);

  // ── The opening range ────────────────────────────────────────────────────
  const orbHigh = safeNum(latest?.opening_range?.orb_high);
  const orbLow = safeNum(latest?.opening_range?.orb_low);
  // The range is this session's 09:30–09:59, so it exists from 10:00 ET on.
  // Through pre-market the feed carries the PREVIOUS session's range on every
  // bar (src/api/queries/technicals.py anchors it on the last cash session),
  // so a bar only counts if it is in this session and at or after 10:00 ET;
  // until then the page says the range is still to set.
  const rangeEndMs = useMemo(() => {
    for (const b of bars) {
      if (safeNum(b.opening_range?.orb_high) == null) continue;
      const ms = Date.parse(b.timestamp);
      if (!Number.isFinite(ms) || !(ms >= sessionStartMs)) continue;
      const minute = etMinuteOfDay(ms);
      if (minute >= 600) return ms - (minute - 600) * 60_000;
    }
    return null;
  }, [bars, sessionStartMs]);
  const orb =
    orbHigh != null && orbLow != null && rangeEndMs != null && orbHigh >= orbLow
      ? { high: orbHigh, low: orbLow, startMs: rangeEndMs - 30 * 60_000, endMs: rangeEndMs }
      : null;

  // A few hundred bars at most, so these are cheap to derive on each render
  // (and the React Compiler memoizes them anyway).
  const orbLog = orb ? deriveOrbLog(candles, orb.high, orb.low, orb.endMs) : [];
  const events = buildSessionEvents(bars, orbLog, isWithinExtendedMarketHours);
  const markerById = new Map(events.filter((e) => e.marker != null).map((e) => [e.id, e]));

  // ── The read ─────────────────────────────────────────────────────────────
  const last = read.spot ?? safeNum(latest?.close) ?? (candles.length ? candles[candles.length - 1].close : null);
  const vwapNow = safeNum(latest?.vwap_deviation?.vwap);
  const vwapGap = last != null && vwapNow != null ? last - vwapNow : null;
  const zone = orb ? orbZone(last, orb.high, orb.low) : null;
  const flip = read.flip;
  const callWall = read.callWall;
  const putWall = read.putWall;

  const asOfMs = latest?.timestamp ? Date.parse(latest.timestamp) : fetchedAt ?? null;
  const asOf = asOfMs != null && Number.isFinite(asOfMs) ? `As of ${etTime(asOfMs)} ET` : null;

  const orbSub = (() => {
    if (!orb || last == null || zone == null) return 'sets from 09:30–09:59 ET';
    if (zone === 'above') return `${fmtDistance(last - orb.high)} above the high`;
    if (zone === 'below') return `${fmtDistance(orb.low - last)} below the low`;
    return orb.high - last <= last - orb.low ? `${fmtDistance(orb.high - last)} below the high` : `${fmtDistance(last - orb.low)} above the low`;
  })();

  const wallSub = (() => {
    const parts: string[] = [];
    if (callWall != null && last != null) parts.push(`call ${fmtDistance(callWall - last)} ${callWall >= last ? 'above' : 'below'}`);
    if (putWall != null && last != null) parts.push(`put ${fmtDistance(last - putWall)} ${last >= putWall ? 'below' : 'above'}`);
    return parts.length ? parts.join(' · ') : 'walls not resolved';
  })();

  const showInitialLoading = loading && bars.length === 0;
  const showInitialError = !!error && bars.length === 0;
  const visibleEvents = showAllEvents ? events : events.slice(0, EVENTS_COLLAPSED);

  return (
    <PageShell>
      <PageHeader
        title="Technicals"
        sub="The price picture under the levels. VWAP, the opening range, volume and momentum on one chart, read against the flip and the walls."
        tooltip="The one page in this section that reads price rather than the option chain. It sits here because every gamma level is a price on this chart: VWAP is the session's volume-weighted average, the opening range is the high and low of 09:30–09:59 ET held flat for the day, volume spikes are five-minute bars far above their recent average, and divergences flag price and options flow disagreeing. Context for the levels, not signals on their own."
        actions={asOf ? <span className="zg-caption">{asOf}</span> : undefined}
      />

      {showInitialError ? <ErrorMessage message={error as string} /> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
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
            label="Price"
            value={fmtLevel(last)}
            sub={read.spotChange != null ? `${signed(read.spotChange)} (${signed(read.spotChangePercent)}%) today` : symbol}
            subColor={changeColor(read.spotChange)}
          />
          <ReadCell
            label="VWAP"
            value={fmtLevel(vwapNow)}
            sub={vwapGap != null ? `${fmtDistance(vwapGap)} ${vwapGap >= 0 ? 'above' : 'below'} · ${signed(vwapNow ? (vwapGap / vwapNow) * 100 : null)}%` : '—'}
            subColor={changeColor(vwapGap)}
          />
          <ReadCell label="Opening range" value={zone ? ORB_ZONE_LABEL[zone] : orb ? '—' : 'Forming'} sub={orbSub} />
          <ReadCell
            label="Dealer gamma"
            value={read.longGamma == null ? '—' : read.longGamma ? 'Long γ' : 'Short γ'}
            sub={flip != null && last != null ? `${last >= flip ? 'above' : 'below'} the flip, ${fmtLevel(flip)}` : 'no flip resolved'}
            subColor="var(--color-flip)"
          />
          <div style={isMobile ? { gridColumn: 'span 2', display: 'grid' } : { display: 'grid' }}>
            <ReadCell
              label="Walls"
              size={17}
              value={
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ color: 'var(--color-bear)' }}>{fmtLevel(callWall)}</span>
                  <span style={{ color: 'var(--color-bull)' }}>{fmtLevel(putWall)}</span>
                </span>
              }
              sub={wallSub}
            />
          </div>
        </section>

        {/* The chart */}
        <Panel padded={false}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderBottom: `1px solid ${ruleColor}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
              <h2 className="zg-h3" style={{ margin: 0 }}>
                Session
              </h2>
              <span className="zg-caption">5-minute bars · times in ET</span>
            </div>
            <div role="group" aria-label="Chart layers" style={{ display: 'flex', gap: 6, flexWrap: isMobile ? 'nowrap' : 'wrap', overflowX: isMobile ? 'auto' : undefined, maxWidth: '100%' }}>
              {LAYER_BUTTONS.map((b) => {
                const on = layers[b.key];
                return (
                  <button
                    key={b.key}
                    type="button"
                    aria-pressed={on}
                    onClick={toggles[b.key]}
                    className="zg-btn"
                    style={{
                      flex: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      minHeight: 40,
                      padding: '0 12px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      color: on ? 'var(--text-primary)' : 'var(--text-muted)',
                      background: on ? 'color-mix(in srgb, var(--color-navy) 18%, transparent)' : 'transparent',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-control, 2px)',
                      cursor: 'pointer',
                    }}
                  >
                    {b.swatch && <span aria-hidden="true" style={{ display: 'inline-block', boxSizing: 'border-box', ...b.swatch, opacity: on ? 1 : 0.4 }} />}
                    {b.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ padding: '10px 10px 4px' }}>
            {showInitialLoading ? (
              <div style={{ height: isMobile ? 360 : 470, display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'center', padding: '0 12px' }}>
                <div className="zg-skeleton-line" style={{ width: '38%', height: 10 }} />
                <div className="zg-skeleton-line" style={{ width: '100%', height: 220 }} />
                <div className="zg-skeleton-line" style={{ width: '62%', height: 10 }} />
              </div>
            ) : !haveWindow || candles.length === 0 ? (
              <div className="zg-caption" style={{ padding: '48px 12px', textAlign: 'center' }}>
                No bars yet for this session.
              </div>
            ) : (
              <TechnicalsSessionChart
                candles={candles}
                vwap={vwapPoints}
                volume={volumeBars}
                orb={orb}
                levels={{ flip, callWall, putWall, pin: read.pinStrike }}
                last={last}
                sessionStartMs={sessionStartMs}
                sessionEndMs={sessionEndMs}
                events={events}
                layers={layers}
                compact={isMobile}
                ariaLabel={`${symbol} five-minute candles for the session, with VWAP, the opening range, the gamma flip, the walls and the pin`}
              />
            )}
          </div>
          <p className="zg-caption" style={{ margin: 0, padding: '8px 16px 12px', borderTop: `1px solid ${ruleColor}` }}>
            The shaded band is the opening range; its lighter edges are the outer fifths, where the status reads near the high or near the low. Numbered markers match the event list.
          </p>
        </Panel>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 20, alignItems: 'start' }}>
          {/* The opening range */}
          <Panel padded={false}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${ruleColor}` }}>
              <h2 className="zg-h3" style={{ margin: 0 }}>
                Opening range
              </h2>
              <p className="zg-caption" style={{ margin: '4px 0 0' }}>
                09:30–09:59 ET, then held flat for the session.
              </p>
            </div>
            {!orb ? (
              <p className="zg-caption" style={{ margin: 0, padding: '18px 16px' }}>
                The range sets at 10:00 ET from the high and low of the first half hour.
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                    gap: 1,
                    background: ruleColor,
                    borderBottom: `1px solid ${ruleColor}`,
                  }}
                >
                  <ReadCell label="High" value={fmtLevel(orb.high)} sub={last != null ? `${fmtDistance(orb.high - last)} ${orb.high >= last ? 'above' : 'below'}` : '—'} />
                  <ReadCell label="Low" value={fmtLevel(orb.low)} sub={last != null ? `${fmtDistance(last - orb.low)} ${last >= orb.low ? 'below' : 'above'}` : '—'} />
                  <ReadCell label="Range" value={fmtDistance(orb.high - orb.low)} sub={last ? `${(((orb.high - orb.low) / last) * 100).toFixed(2)}% of price` : '—'} />
                  <ReadCell label="Status" value={zone ? ORB_ZONE_LABEL[zone] : '—'} sub={zone === 'inside' ? 'middle three-fifths' : zone === 'nearHigh' || zone === 'nearLow' ? 'outer fifth' : zone ? 'outside the range' : '—'} />
                </div>

                <div style={{ padding: '16px 16px 6px' }}>
                  <Label>Where price sits</Label>
                  {(() => {
                    const pos = orbBarPosition(last, orb.high, orb.low);
                    const near = ORB_NEAR_FRACTION * (1 - 2 * ORB_BAR_OUTER) * 100;
                    const mid = (1 - 2 * ORB_BAR_OUTER) * 100 - 2 * near;
                    const outer = ORB_BAR_OUTER * 100;
                    return (
                      <div style={{ position: 'relative', paddingTop: 20, marginTop: 8 }}>
                        <span className="zg-mono" style={{ position: 'absolute', top: 0, left: `${outer}%`, transform: 'translateX(-30%)', fontSize: 11, color: 'var(--text-secondary)' }}>
                          {fmtLevel(orb.low)}
                        </span>
                        <span className="zg-mono" style={{ position: 'absolute', top: 0, left: `${100 - outer}%`, transform: 'translateX(-70%)', fontSize: 11, color: 'var(--text-secondary)' }}>
                          {fmtLevel(orb.high)}
                        </span>
                        <div style={{ display: 'flex', height: 24 }} aria-hidden="true">
                          <div style={{ width: `${outer}%`, background: 'color-mix(in srgb, var(--color-bear) 16%, transparent)' }} />
                          <div style={{ width: `${near}%`, background: 'color-mix(in srgb, var(--color-hazy) 26%, transparent)', borderLeft: '1px solid var(--color-hazy)' }} />
                          <div style={{ width: `${mid}%`, background: 'color-mix(in srgb, var(--color-hazy) 10%, transparent)' }} />
                          <div style={{ width: `${near}%`, background: 'color-mix(in srgb, var(--color-hazy) 26%, transparent)', borderRight: '1px solid var(--color-hazy)' }} />
                          <div style={{ width: `${outer}%`, background: 'color-mix(in srgb, var(--color-bull) 16%, transparent)' }} />
                        </div>
                        {pos != null && (
                          <div
                            aria-hidden="true"
                            style={{ position: 'absolute', top: 16, left: `${pos * 100}%`, width: 2, height: 32, background: 'var(--color-accent-hot)', transform: 'translateX(-1px)' }}
                          />
                        )}
                        <div className="zg-mono" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
                          <span>Near low</span>
                          <span style={{ color: 'var(--color-accent-hot)' }}>
                            {fmtLevel(last)}
                            {zone ? ` · ${ORB_ZONE_LABEL[zone]}` : ''}
                          </span>
                          <span>Near high</span>
                        </div>
                      </div>
                    );
                  })()}
                  <p className="zg-caption" style={{ margin: '12px 0 0' }}>
                    Near means the outer fifth of the range, so it scales with the day instead of a fixed share of price.
                  </p>
                </div>

                <div style={{ padding: '14px 16px 16px', borderTop: `1px solid ${ruleColor}` }}>
                  <Label>Breakout log</Label>
                  {orbLog.length === 0 ? (
                    <p className="zg-caption" style={{ margin: '8px 0 0' }}>
                      No test or break of the range yet.
                    </p>
                  ) : (
                    <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
                      {orbLog.map((e, i) => {
                        const t = orbLogText(e);
                        const ev = markerById.get(`orb-${e.kind}-${e.ms}`);
                        return (
                          <li
                            key={`${e.kind}-${e.ms}`}
                            style={{ display: 'flex', gap: 12, padding: '9px 0', borderBottom: i === orbLog.length - 1 ? 'none' : `1px solid ${ruleColor}`, alignItems: 'baseline' }}
                          >
                            <span className="zg-mono" style={{ fontSize: 13, width: 46, flex: 'none' }}>
                              {etTime(e.ms)}
                            </span>
                            <span style={{ fontSize: 14, minWidth: 0 }}>
                              {t.title}
                              {ev?.marker != null && <MarkerBadge n={ev.marker} tone={ev.tone} />}
                              <span style={{ color: 'var(--text-muted)' }}> · {t.detail}</span>
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </>
            )}
          </Panel>

          {/* The session's events */}
          <Panel padded={false}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${ruleColor}` }}>
              <h2 className="zg-h3" style={{ margin: 0 }}>
                Events
              </h2>
              <p className="zg-caption" style={{ margin: '4px 0 0' }}>
                Divergences, weak moves, volume spikes and range breaks, newest first.
              </p>
            </div>
            {events.length === 0 ? (
              <p className="zg-caption" style={{ margin: 0, padding: '18px 16px' }}>
                {showInitialLoading ? 'Loading the session…' : 'Nothing notable yet this session.'}
              </p>
            ) : isMobile ? (
              <ul style={{ listStyle: 'none', margin: 0, padding: '0 16px' }}>
                {visibleEvents.map((e: SessionEvent, i) => (
                  <li key={e.id} style={{ padding: '11px 0', borderBottom: i === visibleEvents.length - 1 ? 'none' : `1px solid ${ruleColor}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 999, background: TONE_DOT[e.tone], flex: 'none' }} />
                      <span className="zg-mono" style={{ fontSize: 13 }}>
                        {etTime(e.ms)}
                      </span>
                      <span>
                        {e.title}
                        {e.marker != null && <MarkerBadge n={e.marker} tone={e.tone} />}
                      </span>
                    </div>
                    <div className="zg-mono" style={{ fontSize: 12, color: 'var(--text-muted)', paddingLeft: 16, marginTop: 3 }}>
                      {e.detail ? `${e.detail} · ` : ''}
                      {fmtLevel(e.price)}
                      {e.chg5m != null && (
                        <>
                          {' · '}
                          <span style={{ color: changeColor(e.chg5m) }}>{signed(e.chg5m)}</span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ padding: '2px 16px 8px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, minWidth: 460 }}>
                  <thead>
                    <tr>
                      {(['ET', 'Event', 'Price', '5-min chg'] as const).map((h, i) => (
                        <th
                          key={h}
                          scope="col"
                          className="zg-mono"
                          style={{ textAlign: i >= 2 ? 'right' : 'left', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 500, color: 'var(--text-muted)', padding: '10px 8px 6px', paddingLeft: i === 0 ? 0 : 8, paddingRight: i === 3 ? 0 : 8, borderBottom: `1px solid ${ruleColor}` }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEvents.map((e: SessionEvent, i) => {
                      const cell: CSSProperties = { padding: '9px 8px', borderBottom: i === visibleEvents.length - 1 ? 'none' : `1px solid ${ruleColor}` };
                      return (
                        <tr key={e.id}>
                          <td className="zg-mono" style={{ ...cell, paddingLeft: 0, whiteSpace: 'nowrap', fontSize: 13 }}>
                            {etTime(e.ms)}
                            {e.marker != null && <MarkerBadge n={e.marker} tone={e.tone} />}
                          </td>
                          <td style={cell}>
                            <span aria-hidden="true" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: TONE_DOT[e.tone], marginRight: 8 }} />
                            {e.title}
                            {e.detail && <span style={{ color: 'var(--text-muted)' }}> · {e.detail}</span>}
                          </td>
                          <td className="zg-mono" style={{ ...cell, textAlign: 'right', fontSize: 13 }}>
                            {fmtLevel(e.price)}
                          </td>
                          <td className="zg-mono" style={{ ...cell, paddingRight: 0, textAlign: 'right', fontSize: 13, color: changeColor(e.chg5m) }}>
                            {signed(e.chg5m)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {events.length > EVENTS_COLLAPSED && (
              <div style={{ padding: '0 16px 14px' }}>
                <button
                  type="button"
                  className="zg-btn"
                  onClick={() => setShowAllEvents((v) => !v)}
                  style={{ width: '100%', minHeight: 44, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)', background: 'transparent', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-control, 2px)', cursor: 'pointer' }}
                >
                  {showAllEvents ? 'Show fewer' : `Show all ${events.length} events`}
                </button>
              </div>
            )}
          </Panel>
        </div>

        <footer className="zg-caption" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
          <span>Context for the levels, not signals on their own.</span>
          <Link href="/help/platform/technicals" style={{ color: 'var(--color-accent-hot)' }}>
            How to read this page
          </Link>
        </footer>
      </div>
    </PageShell>
  );
}
