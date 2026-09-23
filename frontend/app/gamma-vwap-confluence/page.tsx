'use client';

import PageShell from '@/components/layout/PageShell';
import Link from 'next/link';
import { useMemo } from 'react';
import { Compass, Gauge, Magnet, ArrowUp, ArrowDown } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useGammaVwapConfluenceSignal, useGEXSummary } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import SignalEventsPanel from '@/components/SignalEventsPanel';
import SignalPageTitle from '@/components/SignalPageTitle';
import SignalScoreHero from '@/components/SignalScoreHero';
import SignalHowItsBuilt from '@/components/SignalHowItsBuilt';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import {
  asObject,
  asArray,
  getNumber,
  humanize,
  parseScoreHistory,
  toTrend,
  trendColor,
  formatPct,
  formatPrice,
  formatGexCompact,
} from '@/core/signalHelpers';

function label(signal: string, score: number | null): string {
  if (score == null) return 'No reading';
  if (signal === 'bullish_confluence') return 'Bullish confluence';
  if (signal === 'bearish_confluence') return 'Bearish confluence';
  if (score >= 20) return 'Bullish confluence forming';
  if (score <= -20) return 'Bearish confluence forming';
  return 'No confluence edge';
}

const LEVEL_COLORS: Record<string, string> = {
  gamma_flip: 'var(--color-bull)',
  vwap: 'var(--color-warning)',
  max_pain: '#C084FC',
  max_gamma: '#6EA8FE',
  call_wall: 'var(--color-bear)',
  spot: 'var(--color-text-primary)',
};

export default function GammaVwapConfluencePage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useGammaVwapConfluenceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.gammaVwapConfluenceMs);
  // Gamma-flip, close, and net GEX are still sourced from gex-summary so the
  // level-stack stays populated even when the signal payload trims them.
  const { data: gexSummary } = useGEXSummary(symbol, 15000);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const signal = String(payload.signal ?? 'neutral');
  const triggered = payload.triggered === true || (score != null && Math.abs(score) >= 20);
  const confluenceLevel = getNumber(payload.confluence_level);
  const expectedTarget = getNumber(payload.expected_target);

  const ctx = useMemo(() => {
    const raw = asObject(payload.context_values) ?? {};
    const members = asArray(raw.cluster_members).map((m) => String(m));
    const gammaFlip = getNumber(raw.gamma_flip) ?? getNumber(gexSummary?.gamma_flip);
    return {
      gammaFlip,
      vwap: getNumber(raw.vwap),
      maxPain: getNumber(raw.max_pain),
      maxGamma: getNumber(raw.max_gamma),
      callWall: getNumber(raw.call_wall),
      close: getNumber(raw.close) ?? getNumber(gexSummary?.spot_price),
      clusterMembers: members,
      clusterQuality: getNumber(raw.cluster_quality),
      distanceFromLevelPct: getNumber(raw.distance_from_level_pct),
      regimeDirection: String(raw.regime_direction ?? '—'),
      netGex: getNumber(raw.net_gex) ?? getNumber(gexSummary?.net_gex),
    };
  }, [payload, gexSummary]);

  // cluster_gap_pct is |flip - VWAP| / price: the distance between the two
  // PERMANENT cluster members, never the span of all five reference levels.
  // The backend always emits the key and sends null only from its
  // `missing_levels` short-circuit -- the same branch that omits
  // confluence_level, cluster_quality and cluster_members and scores 0. There
  // is no cluster in that state, so there is no gap to reconstruct: a
  // back-computed number would be the only populated field in the box, and
  // would have to borrow a gamma flip from gex-summary that the signal itself
  // treated as unavailable. Read the field and let it render as "--" with its
  // neighbours, which is what /advanced-signals already does.
  const clusterGapPct = getNumber(payload.cluster_gap_pct);

  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const levels: Array<{ name: string; value: number | null; color: string }> = [
    { name: 'Call wall', value: ctx.callWall, color: LEVEL_COLORS.call_wall },
    { name: 'Max gamma', value: ctx.maxGamma, color: LEVEL_COLORS.max_gamma },
    { name: 'VWAP', value: ctx.vwap, color: LEVEL_COLORS.vwap },
    { name: 'Spot', value: ctx.close, color: LEVEL_COLORS.spot },
    { name: 'Gamma flip', value: ctx.gammaFlip, color: LEVEL_COLORS.gamma_flip },
    { name: 'Max pain', value: ctx.maxPain, color: LEVEL_COLORS.max_pain },
  ].sort((a, b) => {
    if (a.value == null && b.value == null) return 0;
    if (a.value == null) return 1;
    if (b.value == null) return -1;
    return b.value - a.value;
  });

  return (
    <PageShell>
      <SignalPageTitle
        title="Gamma / VWAP Confluence"
        subtitle={'"Are key levels stacking up here?"'}
        icon={Magnet}
        tooltip="The gamma flip and VWAP are ALWAYS the core of the cluster; max pain, max gamma and the call wall join only when they sit within 0.15% of the flip/VWAP midpoint. The more that qualify, and the tighter the flip and VWAP sit, the more the stack reads as a magnet or bounce level. Triggers at |score| ≥ 20. In short-gamma regimes the level acts as a continuation breakout; in long-gamma regimes it reverts."
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <SignalScoreHero
              score={score}
              scoreLabel="Confluence Score"
              trend={trend}
              interpretation={label(signal, score)}
              history={history}
              badges={
                <>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide" style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}>
                    {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
                    {humanize(signal)}
                  </span>
                  {ctx.regimeDirection !== '—' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--color-border)]">
                      {humanize(ctx.regimeDirection)}
                    </span>
                  )}
                </>
              }
              footnote={
                <>
                  Cluster gap: <span className="font-mono text-[var(--color-text-primary)]">{formatPct(clusterGapPct, 3, false)}</span>
                  {' · '}
                  Quality: <span className="font-mono text-[var(--color-text-primary)]">{ctx.clusterQuality != null ? ctx.clusterQuality.toFixed(2) : '—'}</span>
                  {' · '}
                  Members: <span className="font-mono text-[var(--color-text-primary)]">{ctx.clusterMembers.length || '—'}</span>
                </>
              }
            />
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
            <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Compass size={14} /> Level stack</div>
            <LevelStack
              levels={levels}
              close={ctx.close}
              confluence={confluenceLevel}
              expectedTarget={expectedTarget}
              members={ctx.clusterMembers}
            />
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Confluence Inputs</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Compass size={16} /> Levels</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              {levels.map((l) => (
                <div key={l.name} className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} />
                    {l.name}
                  </span>
                  <span className="font-mono text-[var(--color-text-primary)]">{formatPrice(l.value)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Magnet size={16} /> Cluster</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Confluence level" value={formatPrice(confluenceLevel)} />
              <Row label="Expected target" value={formatPrice(expectedTarget)} />
              <Row label="Cluster gap" value={formatPct(clusterGapPct, 3, false)} />
              <Row label="Cluster quality" value={ctx.clusterQuality != null ? ctx.clusterQuality.toFixed(2) : '—'} />
              <Row label="Distance from level" value={formatPct(ctx.distanceFromLevelPct, 3)} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> Regime</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Net GEX (chain-wide)" value={formatGexCompact(ctx.netGex)} />
              <Row label="Direction" value={humanize(ctx.regimeDirection)} />
              <Row label="Close vs level" value={ctx.close != null && confluenceLevel != null ? (ctx.close > confluenceLevel ? 'Above' : 'Below') : '—'} />
            </div>
            <p className="mt-3 pt-2 border-t border-[var(--color-border)]/40 text-[11px] text-[var(--color-text-secondary)]">
              Short-gamma → breakout continues past level. Long-gamma → reverts to level (× 0.7).
            </p>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={<>Short-gamma regime → breakout continues past the level (continuation). Long-gamma regime → reverts to the level (mean-reversion, ×0.7 conviction).</>}
      >
        <div>The <strong>Gamma Flip and VWAP are always members</strong>, which is why every card floors at <code>Members: 2</code>. Max Pain, Max Gamma and the Call Wall each join only if they sit within <strong>0.15%</strong> of the midpoint between the flip and VWAP.</div>
        <div><code>Confluence Level = mean(qualifying members)</code>, and <code>Cluster Gap = |Flip − VWAP| ÷ Price</code> — the gap is the two core members’ distance, not the span of all five.</div>
        <div><code>Cluster Quality = clamp(1 − Cluster Gap % ÷ 1.0%, 0.05, 1.00)</code>. That 0.05 floor is why a wide-gap card still prints a small score: a ±5 is the model reporting <em>no cluster</em>, not weak direction.</div>
        <div><code>Members Multiplier = 1 + 0.15 × (Members − 2)</code> — four members is 1.30× on the same geometry.</div>
        <div><code>Distance = (Price − Confluence Level) ÷ Price</code>, scaled so roughly ±0.30% saturates the reading: the model reads which side price is on, not how far it has gone.</div>
        <div><code>Raw = Quality × Members Multiplier × scaled Distance × Regime Factor</code>, where Regime Factor is <code>+1</code> in short gamma (continuation) and <code>−0.7</code> in long gamma (mean reversion — the sign inverts).</div>
        <div><code>Score = clip(Raw, [−1, 1]) × 100</code>. Triggers at |Score| ≥ 20; below that the card reads “No confluence edge” rather than naming a direction.</div>
        <div className="pt-1">
          The long version — why the quality floor makes a small score an <em>absent</em> cluster rather than a weak one, and why two symbols can read opposite on the same afternoon:{' '}
          <Link href="/education/gamma-vwap-confluence-explained" className="font-semibold text-[var(--color-warning)] underline-offset-2 hover:underline">
            Gamma / VWAP Confluence explained
          </Link>.
        </div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="gamma_vwap_confluence" symbol={symbol} title="Event Timeline" />
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-mono text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

interface LevelStackProps {
  levels: Array<{ name: string; value: number | null; color: string }>;
  close: number | null;
  confluence: number | null;
  expectedTarget: number | null;
  members: string[];
}

function LevelStack({ levels, close, confluence, expectedTarget, members }: LevelStackProps) {
  const values = [
    ...levels.map((l) => l.value),
    close,
    confluence,
    expectedTarget,
  ].filter((v): v is number => v != null);
  if (values.length < 2) {
    return <div className="text-sm text-[var(--color-text-secondary)]">Level data not available.</div>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max === min ? 1 : max - min;
  const pad = range * 0.12;
  const viewMin = min - pad;
  const viewMax = max + pad;
  const viewRange = viewMax - viewMin;
  const height = 220;
  const toY = (v: number) => height - ((v - viewMin) / viewRange) * height;

  return (
    <div className="flex items-start gap-4 sm:gap-6">
      <svg width="80" height={height} viewBox={`0 0 80 ${height}`} className="shrink-0">
        <line x1={40} y1={0} x2={40} y2={height} stroke="var(--color-border)" strokeWidth={2} />
        {confluence != null && (
          <rect x={16} y={toY(confluence) - 4} width={48} height={8} fill="var(--color-warning)" opacity={0.7} />
        )}
        {levels.map((l) => {
          if (l.value == null) return null;
          if (l.name === 'Spot') return null; // close circle already represents spot
          const y = toY(l.value);
          return (
            <g key={l.name}>
              <line x1={20} y1={y} x2={60} y2={y} stroke={l.color} strokeWidth={2} />
            </g>
          );
        })}
        {close != null && (
          <g>
            <circle cx={40} cy={toY(close)} r={6} fill="var(--color-text-primary)" stroke="var(--color-surface)" strokeWidth={2} />
            {expectedTarget != null && (
              <line x1={40} y1={toY(close)} x2={40} y2={toY(expectedTarget)} stroke="var(--color-text-primary)" strokeWidth={1.5} strokeDasharray="3 3" markerEnd="url(#arrow)" />
            )}
          </g>
        )}
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8" fill="var(--color-text-primary)" />
          </marker>
        </defs>
      </svg>
      <div className="flex-1 flex flex-col gap-2 text-xs">
        {levels.map((l) => {
          const inCluster = members.some((m) => m.toLowerCase().includes(l.name.toLowerCase().replace(' ', '_')));
          return (
            <div key={l.name} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: l.color }} />
              <span className="w-24 font-semibold" style={{ color: l.color }}>{l.name}</span>
              <span className="font-mono text-[var(--color-text-primary)]">{formatPrice(l.value)}</span>
              {inCluster && (
                <>
                  <span className="ml-auto hidden text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-warning-soft)] text-[var(--color-warning)] font-semibold uppercase tracking-wide sm:inline">In cluster</span>
                  {/* Phone: the badge wrapped to two lines beside the price in a
                      ~180px column; the confluence magnet marks it instead
                      (keyed under the list). */}
                  <Magnet size={12} aria-label="in cluster" className="ml-auto shrink-0 text-[var(--color-warning)] sm:hidden" />
                </>
              )}
            </div>
          );
        })}
        {members.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-secondary)] sm:hidden">
            <Magnet size={11} className="text-[var(--color-warning)]" /> = in the confluence cluster
          </div>
        )}
        <div className="mt-1 border-t border-[var(--color-border)]/40 pt-2 space-y-1">
          <div className="flex items-center gap-2">
            <Magnet size={12} className="text-[var(--color-warning)]" />
            <span className="font-semibold">Confluence level</span>
            <span className="font-mono text-[var(--color-text-primary)]">{formatPrice(confluence)}</span>
          </div>
          {close != null && expectedTarget != null && (
            <div className="flex items-center gap-2">
              {expectedTarget >= close ? <ArrowUp size={12} className="text-[var(--color-bull)]" /> : <ArrowDown size={12} className="text-[var(--color-bear)]" />}
              <span className="font-semibold">Expected target</span>
              <span className="font-mono text-[var(--color-text-primary)]">{formatPrice(expectedTarget)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
