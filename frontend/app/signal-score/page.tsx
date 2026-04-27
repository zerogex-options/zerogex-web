'use client';

import { useEffect, useMemo, useState } from 'react';
import CompositeGauge from './CompositeGauge';
import CompositeHeaderBar, { CompositeSymbol } from './CompositeHeaderBar';
import IntradayChart from './IntradayChart';
import ContributionStack from './ContributionStack';
import ComponentCard from './ComponentCard';
import { useCompositeData } from './useCompositeData';
import { classifyRegime } from './regime';
import { COMPONENT_KEYS, ComponentEntry } from './data';

const NEUTRAL_DELTA_THRESHOLD = 0.5;

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
  // Pick the row with timestamp closest to (and not after) cutoffMs.
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
      color = '#16A34A';
      glyph = '▲';
    } else {
      color = '#DC2626';
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

  // Tick state so deltas/age refresh on a clock instead of via Date.now() in render.
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
    <div className="container mx-auto px-4 py-6 max-w-[1400px]">
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
          style={{ borderColor: '#D97706', background: 'rgba(217, 119, 6, 0.08)', color: '#92400E' }}
          role="status"
        >
          Reconnecting… last values shown may be stale.{' '}
          <button onClick={refetch} className="underline ml-1">Retry now</button>
        </div>
      )}

      {/* Hero section */}
      <section className="zg-feature-shell mt-4 p-6">
        {loading && composite == null ? (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-8">
            <Skeleton height={300} label="Loading gauge…" />
            <Skeleton height={300} label="Loading regime…" />
          </div>
        ) : noData ? (
          <div className="rounded-xl border p-12 text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)' }}>
            <div className="text-lg font-semibold mb-1">No score data for {symbol} yet.</div>
            <div className="text-sm text-[var(--color-text-secondary)]">The signal engine has no rows for this underlying. Try another symbol or check back during market hours.</div>
          </div>
        ) : (
          <div
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-8 items-center"
            style={{ opacity: connection === 'disconnected' ? 0.6 : 1, transition: 'opacity 200ms' }}
          >
            <CompositeGauge score={composite} size={320} />
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
              <p className="text-[15px] leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                {regime.copy}
              </p>
              <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                <DeltaBadge label="Δ since open" value={deltaSinceOpen} />
                <DeltaBadge label="Δ last 5 min" value={deltaFiveMin} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Intraday trend */}
      <section className="zg-feature-shell mt-6 p-6">
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-semibold">Intraday Trend</h2>
          <div className="text-xs text-[var(--color-text-secondary)] font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {history.length} pts
          </div>
        </div>
        {loading && history.length === 0 ? (
          <Skeleton height={320} label="Loading chart…" />
        ) : (
          <IntradayChart history={history} currentScore={composite} />
        )}
      </section>

      {/* Contribution stack */}
      <section className="mt-6">
        {loading && composite == null ? (
          <Skeleton height={120} label="Loading contributions…" />
        ) : (
          <ContributionStack components={components} composite={composite} />
        )}
      </section>

      {/* Component cards: gamma_anchor (key 1) is double-height. */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold mb-3">Components</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {components.map((c) => (
            <ComponentCard key={c.key} entry={c} />
          ))}
        </div>
      </section>
    </div>
  );
}
