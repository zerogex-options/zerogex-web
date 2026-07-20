'use client';

import PageShell from '@/components/layout/PageShell';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Activity, Info, LayoutGrid, LineChart as LineChartIcon } from 'lucide-react';
import TooltipWrapper from '@/components/TooltipWrapper';
import SignalsGuide from '@/components/SignalsGuide';
import CompositeGauge from './CompositeGauge';
import ContributionStack from './ContributionStack';
import ComponentCard from './ComponentCard';
import { useCompositeData } from './useCompositeData';
import { REGIME_BANDS, classifyRegime } from '@/core/regime';
import { COMPONENT_KEYS, ComponentEntry } from './data';
import { useTimeframe } from '@/core/TimeframeContext';
import { getMarketSession } from '@/core/utils';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

// Recharts is ~200KB minzipped and the intraday chart is the last section
// on the page. Split it out so the gauge above the fold can paint without
// waiting for the chart bundle to download or parse.
const IntradayChart = dynamic(() => import('./IntradayChart'), {
  ssr: false,
  loading: () => <Skeleton height={320} label="Loading chart…" />,
});

const NEUTRAL_DELTA_THRESHOLD = 0.5;

type ConnectionState = 'idle' | 'live' | 'stale' | 'disconnected';

function findOpenScore(history: { timestamp: string; composite: number }[]): number | null {
  if (history.length === 0) return null;
  const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  // History is ASC, so the first row whose ET date matches today and whose
  // ET minute-of-day is >= 09:30 (570) is the opening bar.
  for (const row of history) {
    const ms = Date.parse(row.timestamp);
    if (!Number.isFinite(ms)) continue;
    const dKey = new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    if (dKey !== todayKey) continue;
    const parts = fmt.formatToParts(new Date(ms));
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const min = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    if (hour * 60 + min >= 9 * 60 + 30) return row.composite;
  }
  return null;
}

function findScoreAt(history: { timestamp: string; composite: number }[], cutoffMs: number): number | null {
  let best: { dist: number; score: number } | null = null;
  for (const row of history) {
    const ms = Date.parse(row.timestamp);
    if (!Number.isFinite(ms)) continue;
    if (ms > cutoffMs) continue;
    const dist = cutoffMs - ms;
    if (!best || dist < best.dist) best = { dist, score: row.composite };
  }
  return best?.score ?? null;
}

function emptyComponents(): ComponentEntry[] {
  return COMPONENT_KEYS.map((key) => ({ key, maxPoints: 0, contribution: null, score: null }));
}

type HistoryRow = { timestamp: string; composite: number };

function HeroDeltas({ history, composite }: { history: HistoryRow[]; composite: number | null }) {
  const t = usePageT(dict);
  // The 5-min-ago lookup needs a wall-clock reference. Keep that state
  // local so the 30s tick only re-renders these two badges — not the
  // gauge, contribution stack, component cards, or chart.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const openScore = useMemo(() => findOpenScore(history), [history]);
  const fiveMinAgoScore = useMemo(() => {
    if (now == null) return null;
    return findScoreAt(history, now - 5 * 60 * 1000);
  }, [history, now]);

  const deltaSinceOpen = composite != null && openScore != null ? composite - openScore : null;
  const deltaFiveMin = composite != null && fiveMinAgoScore != null ? composite - fiveMinAgoScore : null;

  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      <DeltaBadge label={t('deltaSinceOpen')} value={deltaSinceOpen} />
      <DeltaBadge label={t('deltaLast5Min')} value={deltaFiveMin} />
    </div>
  );
}

function DeltaBadge({ label, value }: { label: string; value: number | null }) {
  let color = 'var(--color-text-secondary)';
  let glyph: '▲' | '▼' | '●' = '●';
  let display = '—';
  if (value != null && Number.isFinite(value)) {
    if (Math.abs(value) < NEUTRAL_DELTA_THRESHOLD) {
      color = 'var(--color-text-secondary)';
      glyph = '●';
    } else if (value > 0) {
      color = 'var(--color-bull)';
      glyph = '▲';
    } else {
      color = 'var(--color-bear)';
      glyph = '▼';
    }
    display = `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{label}</span>
      <span aria-hidden style={{ color, fontSize: 12 }}>{glyph}</span>
      <span
        className="font-mono font-semibold text-sm"
        style={{ color, fontVariantNumeric: 'tabular-nums' }}
        aria-label={`${label} ${display}`}
      >
        {display}
      </span>
    </div>
  );
}

function ScoreRangeLegend({ activeKey, orientation = 'horizontal' }: { activeKey: string | null; orientation?: 'horizontal' | 'vertical' }) {
  const gridClass = orientation === 'vertical'
    ? 'grid grid-cols-1 gap-1.5'
    : 'grid grid-cols-2 lg:grid-cols-4 gap-1.5';
  return (
    <ul className={gridClass}>
      {[...REGIME_BANDS].reverse().map(({ regime }) => {
        const active = regime.key === activeKey;
        return (
          <li
            key={regime.key}
            className="rounded-md border px-2 py-1.5"
            style={{
              borderColor: active ? regime.color : 'var(--color-border)',
              background: active ? regime.softColor : 'transparent',
              transition: 'background 200ms, border-color 200ms',
            }}
          >
            <div className="flex items-baseline gap-1.5">
              <span aria-hidden style={{ color: regime.color, fontSize: 11, lineHeight: '14px' }}>
                {regime.glyph}
              </span>
              <span className="text-[11px] font-semibold leading-tight" style={{ color: regime.color }}>{regime.label}</span>
              <span className="text-[10px] font-mono text-[var(--color-text-secondary)] ml-auto" style={{ fontVariantNumeric: 'tabular-nums' }}>{regime.rangeLabel}</span>
            </div>
            <p className="text-[10px] leading-snug text-[var(--color-text-secondary)] mt-0.5">
              {regime.copy}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function Skeleton({ height = 200, label }: { height?: number; label?: string }) {
  return (
    <div
      className="rounded-xl border animate-pulse flex items-center justify-center text-xs text-[var(--color-text-secondary)]"
      style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)', height }}
    >
      {label}
    </div>
  );
}

function LiveIndicator({
  connection,
  lastUpdatedAt,
}: {
  connection: ConnectionState;
  lastUpdatedAt: number | null;
}) {
  const t = usePageT(dict);
  const [now, setNow] = useState(() => Date.now());
  const [session, setSession] = useState(getMarketSession());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      setSession(getMarketSession());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const ageSec = lastUpdatedAt != null ? Math.max(0, Math.floor((now - lastUpdatedAt) / 1000)) : null;

  const SESSION_LABEL: Record<string, string> = {
    open: t('sessionOpen'),
    'pre-market': t('sessionPreMarket'),
    'after-hours': t('sessionAfterHours'),
    closed: t('sessionClosed'),
    'closed-weekend': t('sessionClosed'),
    'closed-holiday': t('sessionClosed'),
    halted: t('sessionHalted'),
  };

  let dotColor = 'var(--color-text-secondary)';
  let statusText = t('connecting');
  let statusGlyph: '●' | '◐' | '○' = '○';
  if (connection === 'disconnected') {
    dotColor = 'var(--color-bear)';
    statusText = t('disconnectedRetrying');
    statusGlyph = '○';
  } else if (connection === 'stale') {
    dotColor = 'var(--color-warning)';
    statusText = ageSec != null ? t('staleAgo', { sec: ageSec }) : t('stale');
    statusGlyph = '◐';
  } else if (connection === 'live') {
    dotColor = 'var(--color-bull)';
    statusText = ageSec != null ? t('liveUpdatedAgo', { sec: ageSec }) : t('liveLabel');
    statusGlyph = '●';
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span aria-hidden style={{ color: dotColor, fontSize: 14 }}>{statusGlyph}</span>
      <span
        className="font-mono"
        style={{ color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }}
        aria-label={statusText}
      >
        {statusText}
      </span>
      <span className="hidden md:inline text-[var(--color-text-secondary)] opacity-60">·</span>
      <span className="hidden md:inline text-[var(--color-text-secondary)]">
        {SESSION_LABEL[session] ?? t('sessionMarket')}
      </span>
    </div>
  );
}

export default function CompositeScorePage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const { payload, history, lastUpdatedAt, connection, loading, historyLoaded, refetch } = useCompositeData(symbol);

  const composite = payload?.composite ?? null;
  const components = payload?.components ?? emptyComponents();
  const regime = classifyRegime(composite);
  const noData = !loading && composite == null && history.length === 0;

  return (
    <PageShell>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <span className="text-[var(--color-text-secondary)] text-base">·</span>
        <span className="text-[var(--color-text-secondary)] text-lg font-semibold">MSI</span>
        <TooltipWrapper text={t('titleTooltip')} placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
        <div className="ml-auto">
          <LiveIndicator connection={connection} lastUpdatedAt={lastUpdatedAt} />
        </div>
      </div>

      {connection === 'disconnected' && (
        <div
          className="mb-3 rounded-md border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--color-warning)', background: 'var(--color-warning-soft)', color: 'var(--color-text-primary)' }}
          role="status"
        >
          {t('reconnecting')}{' '}
          <button onClick={refetch} className="underline ml-1">
            {t('retryNow')}
          </button>
        </div>
      )}

      <SignalsGuide current="composite-score" />

      {/* Hero gauge — gauge / regime info / score-range cards in three columns. */}
      <section className="zg-feature-shell p-6">
        {loading && composite == null ? (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_240px] gap-6">
            <Skeleton height={300} label={t('loadingGauge')} />
            <Skeleton height={300} label={t('loadingRegime')} />
            <Skeleton height={300} label={t('loadingRanges')} />
          </div>
        ) : noData ? (
          <div
            className="rounded-xl border p-12 text-center"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)' }}
          >
            <div className="text-lg font-semibold mb-1">{t('noDataTitle', { symbol })}</div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              {t('noDataBody')}
            </div>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)_240px] gap-6 items-center"
            style={{ opacity: connection === 'disconnected' ? 0.6 : 1, transition: 'opacity 200ms' }}
          >
            <div className="flex justify-center lg:justify-start">
              <CompositeGauge score={composite} size={320} />
            </div>
            <div className="min-w-0 flex flex-col gap-3">
              <div
                className="inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-sm font-semibold"
                style={{
                  borderColor: regime.color,
                  background: regime.softColor,
                  color: regime.color,
                  transition: 'all 250ms ease-out',
                }}
                role="status"
                aria-live="polite"
              >
                <span aria-hidden>{regime.glyph}</span>
                <span>{regime.label}</span>
                <span className="text-[var(--color-text-secondary)] font-normal opacity-80">· {regime.rangeLabel}</span>
              </div>
              <p className="text-sm leading-relaxed text-[var(--color-text-primary)]">
                {regime.copy}
              </p>
              <HeroDeltas history={history} composite={composite} />
              <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-[var(--color-text-secondary)]">
                <span><span className="text-[var(--color-text-primary)] font-semibold">{t('symbolLabel')}</span> {symbol}</span>
                <span><span className="text-[var(--color-text-primary)] font-semibold">{t('scaleLabel')}</span> 0 – 100</span>
                <span><span className="text-[var(--color-text-primary)] font-semibold">{t('neutralLabel')}</span> 50</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] mb-1.5">
                {t('scoreRanges')}
              </div>
              <ScoreRangeLegend
                activeKey={composite != null ? regime.key : null}
                orientation="vertical"
              />
            </div>
          </div>
        )}
      </section>

      {/* Contribution stack */}
      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <LayoutGrid size={20} />
          {t('componentContributions')}
          <TooltipWrapper text={t('contribTooltip')} placement="bottom">
            <Info size={14} className="text-[var(--color-text-secondary)] cursor-help" />
          </TooltipWrapper>
        </h2>
        {loading && composite == null ? (
          <Skeleton height={120} label={t('loadingContributions')} />
        ) : (
          <ContributionStack components={components} composite={composite} />
        )}
      </section>

      {/* Component cards: all uniform height. */}
      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity size={20} />
          {t('componentsHeading')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
          {components.map((c) => (
            <ComponentCard key={c.key} entry={c} />
          ))}
        </div>
      </section>

      {/* Intraday trend (moved to bottom for the page narrative) */}
      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <LineChartIcon size={20} />
          {t('intradayTrend')}
          <TooltipWrapper text={t('intradayTooltip')} placement="bottom">
            <Info size={14} className="text-[var(--color-text-secondary)] cursor-help" />
          </TooltipWrapper>
        </h2>
        {!historyLoaded ? (
          <Skeleton height={320} label={t('loadingChart')} />
        ) : (
          <IntradayChart history={history} currentScore={composite} />
        )}
      </section>
    </PageShell>
  );
}
