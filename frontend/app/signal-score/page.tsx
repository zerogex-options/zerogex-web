'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Info, LayoutGrid, LineChart as LineChartIcon } from 'lucide-react';
import TooltipWrapper from '@/components/TooltipWrapper';
import CompositeGauge from './CompositeGauge';
import CompositeHeaderBar, { CompositeSymbol } from './CompositeHeaderBar';
import IntradayChart from './IntradayChart';
import ContributionStack from './ContributionStack';
import ComponentCard from './ComponentCard';
import { useCompositeData } from './useCompositeData';
import { REGIME_BANDS, classifyRegime } from './regime';
import { COMPONENT_KEYS, ComponentEntry } from './data';

const NEUTRAL_DELTA_THRESHOLD = 0.5;

const TITLE_TOOLTIP =
  'Composite Score, also known as the Market State Index (MSI), is a single 0–100 number that summarizes today\'s option-structure regime. ' +
  'It blends six independent components — net dealer gamma sign, gamma anchor, put/call ratio, volatility regime, smart-money order-flow imbalance, ' +
  'and dealer delta pressure — each weighted to a max-points cap that sums to 100. 50 is neutral; readings above 50 indicate an expansion / directional bias, ' +
  'readings below 50 indicate pinning, chop, or reversal risk. MSI = "Market State Index".';

const INTRADAY_TOOLTIP =
  "The MSI's path through today's session, plotted as 0–100 with shaded regime bands at <20 (high-risk reversal), 20–40 (chop), 40–70 (controlled trend), and ≥70 (trend / expansion). " +
  "Hover any point for the timestamp, score, regime, and the top-3 components that drove the reading.";

const CONTRIB_TOOLTIP =
  'Single horizontal bar showing each component\'s signed point contribution around the 50-baseline. Positives (green) push right, negatives (red) push left; total visual offset equals |composite − 50|. Hover any segment for its raw score, contribution, and weight share.';

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

function ScoreRangeLegend({ activeKey }: { activeKey: string | null }) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)' }}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] mb-2">
        Score ranges
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[...REGIME_BANDS].reverse().map(({ regime }) => {
          const active = regime.key === activeKey;
          return (
            <li
              key={regime.key}
              className="rounded-lg border px-2.5 py-1.5 flex items-start gap-2"
              style={{
                borderColor: active ? regime.color : 'var(--color-border)',
                background: active ? `${regime.color}12` : 'transparent',
              }}
            >
              <span aria-hidden style={{ color: regime.color, fontSize: 14, lineHeight: '20px' }}>
                {regime.glyph}
              </span>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-[12px] font-semibold" style={{ color: regime.color }}>{regime.label}</span>
                  <span className="text-[11px] font-mono text-[var(--color-text-secondary)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{regime.rangeLabel}</span>
                </div>
                <p className="text-[11px] leading-snug text-[var(--color-text-secondary)] mt-0.5">
                  {regime.copy}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
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

export default function CompositeScorePage() {
  const [symbol, setSymbol] = useState<CompositeSymbol>('SPY');
  const { payload, history, lastUpdatedAt, intervalMs, connection, loading, refetch } = useCompositeData(symbol);

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const composite = payload?.composite ?? null;
  const components = payload?.components ?? emptyComponents();
  const regime = classifyRegime(composite);
  const noData = !loading && composite == null && history.length === 0;

  const openScore = useMemo(() => findOpenScore(history), [history]);
  const fiveMinAgoScore = useMemo(() => {
    if (now == null) return null;
    return findScoreAt(history, now - 5 * 60 * 1000);
  }, [history, now]);
  const deltaSinceOpen = composite != null && openScore != null ? composite - openScore : null;
  const deltaFiveMin = composite != null && fiveMinAgoScore != null ? composite - fiveMinAgoScore : null;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">Composite Score</h1>
        <span className="text-[var(--color-text-secondary)] text-base">·</span>
        <span className="text-[var(--color-text-secondary)] text-lg font-semibold">MSI</span>
        <TooltipWrapper text={TITLE_TOOLTIP} placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      <CompositeHeaderBar
        symbol={symbol}
        onSymbolChange={setSymbol}
        connection={connection}
        lastUpdatedAt={lastUpdatedAt}
        intervalMs={intervalMs}
      />

      {connection === 'disconnected' && (
        <div
          className="mt-3 rounded-md border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--color-warning)', background: 'var(--color-warning-soft)', color: 'var(--color-text-primary)' }}
          role="status"
        >
          Reconnecting… last values shown may be stale.{' '}
          <button onClick={refetch} className="underline ml-1">
            Retry now
          </button>
        </div>
      )}

      {/* Hero section */}
      <section className="zg-feature-shell mt-6 p-6">
        {loading && composite == null ? (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-8">
            <Skeleton height={300} label="Loading gauge…" />
            <Skeleton height={300} label="Loading regime…" />
          </div>
        ) : noData ? (
          <div
            className="rounded-xl border p-12 text-center"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)' }}
          >
            <div className="text-lg font-semibold mb-1">No score data for {symbol} yet.</div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              The signal engine has no rows for this underlying. Try another symbol or check back during market hours.
            </div>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-8 items-start"
            style={{ opacity: connection === 'disconnected' ? 0.6 : 1, transition: 'opacity 200ms' }}
          >
            <div className="flex justify-center">
              <CompositeGauge score={composite} size={320} />
            </div>
            <div className="min-w-0 flex flex-col gap-4">
              <div
                className="inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-sm font-semibold"
                style={{
                  borderColor: regime.color,
                  background: `${regime.color}1A`,
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
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <DeltaBadge label="Δ since open" value={deltaSinceOpen} />
                <DeltaBadge label="Δ last 5 min" value={deltaFiveMin} />
              </div>
              <ScoreRangeLegend activeKey={composite != null ? regime.key : null} />
            </div>
          </div>
        )}
      </section>

      {/* Contribution stack */}
      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <LayoutGrid size={20} />
          Component Contributions
          <TooltipWrapper text={CONTRIB_TOOLTIP} placement="bottom">
            <Info size={14} className="text-[var(--color-text-secondary)] cursor-help" />
          </TooltipWrapper>
        </h2>
        {loading && composite == null ? (
          <Skeleton height={120} label="Loading contributions…" />
        ) : (
          <ContributionStack components={components} composite={composite} />
        )}
      </section>

      {/* Component cards: all uniform height. */}
      <section className="mt-8">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity size={20} />
          Components
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
          Intraday Trend
          <TooltipWrapper text={INTRADAY_TOOLTIP} placement="bottom">
            <Info size={14} className="text-[var(--color-text-secondary)] cursor-help" />
          </TooltipWrapper>
          <span
            className="ml-auto text-xs text-[var(--color-text-secondary)] font-mono font-normal"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {history.length} pts
          </span>
        </h2>
        {loading && history.length === 0 ? (
          <Skeleton height={320} label="Loading chart…" />
        ) : (
          <IntradayChart history={history} currentScore={composite} />
        )}
      </section>
    </div>
  );
}
