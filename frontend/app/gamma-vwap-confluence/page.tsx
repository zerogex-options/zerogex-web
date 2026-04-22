'use client';

import { useMemo } from 'react';
import { Compass, Gauge, Magnet, TrendingDown, TrendingUp, ArrowUp, ArrowDown } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useGammaVwapConfluenceSignal, useGEXSummary, useGEXByStrike } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';
import SignalSparkline from '@/components/SignalSparkline';
import SignalEventsPanel from '@/components/SignalEventsPanel';
import ExpandableCard from '@/components/ExpandableCard';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import {
  asObject,
  asArray,
  getNumber,
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
};

export default function GammaVwapConfluencePage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useGammaVwapConfluenceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.gammaVwapConfluenceMs);
  // The signal payload often omits these magnet levels; fall back to the
  // canonical gex-summary + by-strike endpoints so the UI stays populated.
  const { data: gexSummary } = useGEXSummary(symbol, 15000);
  const { data: gexByStrike } = useGEXByStrike(symbol, 50, 30000, 'impact');

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const signal = String(payload.signal ?? 'neutral');
  const triggered = payload.triggered === true || (score != null && Math.abs(score) >= 20);
  const confluenceLevel = getNumber(payload.confluence_level);
  const expectedTarget = getNumber(payload.expected_target);

  const maxGammaFromStrikes = useMemo(() => {
    if (!Array.isArray(gexByStrike) || gexByStrike.length === 0) return null;
    let best: { strike: number; abs: number } | null = null;
    for (const row of gexByStrike) {
      const strike = getNumber(row?.strike);
      const netGex = getNumber(row?.net_gex);
      if (strike == null || netGex == null) continue;
      const abs = Math.abs(netGex);
      if (!best || abs > best.abs) best = { strike, abs };
    }
    return best?.strike ?? null;
  }, [gexByStrike]);

  const ctx = useMemo(() => {
    const raw = asObject(payload.context_values) ?? {};
    const members = asArray(raw.cluster_members).map((m) => String(m));
    const maxPain = getNumber(raw.max_pain) ?? getNumber(payload.max_pain) ?? getNumber(gexSummary?.max_pain);
    const callWall = getNumber(raw.call_wall) ?? getNumber(payload.call_wall) ?? getNumber(gexSummary?.call_wall);
    const maxGamma = getNumber(raw.max_gamma) ?? getNumber(payload.max_gamma) ?? maxGammaFromStrikes;
    const gammaFlip = getNumber(raw.gamma_flip) ?? getNumber(gexSummary?.gamma_flip);
    return {
      gammaFlip,
      vwap: getNumber(raw.vwap),
      maxPain,
      maxGamma,
      callWall,
      close: getNumber(raw.close) ?? getNumber(gexSummary?.spot_price),
      clusterMembers: members,
      clusterQuality: getNumber(raw.cluster_quality),
      distanceFromLevelPct: getNumber(raw.distance_from_level_pct),
      regimeDirection: String(raw.regime_direction ?? '—'),
      netGex: getNumber(raw.net_gex) ?? getNumber(gexSummary?.net_gex),
    };
  }, [payload, gexSummary, maxGammaFromStrikes]);

  // cluster_gap_pct is the range spanned by the clustered levels, normalized
  // by spot. Back-compute it when the backend omits it.
  const clusterGapPct = useMemo(() => {
    const raw = getNumber(payload.cluster_gap_pct);
    if (raw != null) return raw;
    const candidates = [ctx.gammaFlip, ctx.vwap, ctx.maxPain, ctx.maxGamma, ctx.callWall]
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (candidates.length < 2) return null;
    const spot = ctx.close;
    if (spot == null || spot === 0) return null;
    const span = Math.max(...candidates) - Math.min(...candidates);
    return span / spot;
  }, [payload.cluster_gap_pct, ctx]);

  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const levels: Array<{ name: string; value: number | null; color: string }> = [
    { name: 'Gamma flip', value: ctx.gammaFlip, color: LEVEL_COLORS.gamma_flip },
    { name: 'VWAP', value: ctx.vwap, color: LEVEL_COLORS.vwap },
    { name: 'Max pain', value: ctx.maxPain, color: LEVEL_COLORS.max_pain },
    { name: 'Max gamma', value: ctx.maxGamma, color: LEVEL_COLORS.max_gamma },
    { name: 'Call wall', value: ctx.callWall, color: LEVEL_COLORS.call_wall },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">Gamma / VWAP Confluence</h1>
        <TooltipWrapper
          text="Detects when gamma flip, VWAP, max pain, max gamma, and the call wall cluster at the same price — a high-conviction magnet or bounce level. Triggers at |score| ≥ 20. In short-gamma regimes the level acts as a continuation breakout; in long-gamma regimes it reverts."
          placement="bottom"
        >
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Confluence Score</div>
            <div className="text-6xl font-black leading-none" style={{ color }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide" style={{ background: `${color}1f`, color }}>
                {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
                {signal.replace(/_/g, ' ')}
              </span>
              {ctx.regimeDirection !== '—' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--color-border)] capitalize">
                  {ctx.regimeDirection.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <div className="mt-3 text-sm font-semibold">{label(signal, score)}</div>
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
              Cluster gap: <span className="font-mono text-[var(--color-text-primary)]">{formatPct(clusterGapPct, 3, false)}</span>
              {' · '}
              Quality: <span className="font-mono text-[var(--color-text-primary)]">{ctx.clusterQuality != null ? ctx.clusterQuality.toFixed(2) : '—'}</span>
              {' · '}
              Members: <span className="font-mono text-[var(--color-text-primary)]">{ctx.clusterMembers.length || '—'}</span>
            </p>
            <ExpandableCard
              className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3"
              expandTrigger="button"
              expandButtonLabel="Expand score history"
            >
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Score history</div>
              <SignalSparkline points={history} strokeColor={color} fillColor={`${color}1f`} height={56} />
            </ExpandableCard>
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
              <Row label="Net GEX" value={formatGexCompact(ctx.netGex)} />
              <Row label="Direction" value={<span className="capitalize">{ctx.regimeDirection.replace(/_/g, ' ')}</span>} />
              <Row label="Close vs level" value={ctx.close != null && confluenceLevel != null ? (ctx.close > confluenceLevel ? 'Above' : 'Below') : '—'} />
            </div>
            <p className="mt-3 pt-2 border-t border-[var(--color-border)]/40 text-[11px] text-[var(--color-text-secondary)]">
              Short-gamma → breakout continues past level. Long-gamma → reverts to level (× 0.7).
            </p>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Interpretation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bull)]"><TrendingUp size={16} /> Bullish confluence</div>
            <p className="text-[var(--color-text-secondary)]">
              Cluster quality &gt; 0.8 + mean-reversion regime → <code>confluence_level</code> is a buy zone;
              <code> expected_target</code> is the reversion target.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bear)]"><TrendingDown size={16} /> Bearish confluence</div>
            <p className="text-[var(--color-text-secondary)]">
              In continuation regimes (<code>net_gex &lt; 0</code>) a break through the level tends to run —
              <code>expected_target</code> acts as a first profit taker instead.
            </p>
          </div>
        </div>
      </section>

      <SignalEventsPanel signalName="gamma_vwap_confluence" symbol={symbol} title="Event Timeline" />
    </div>
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
    <div className="flex items-start gap-6">
      <svg width="80" height={height} viewBox={`0 0 80 ${height}`}>
        <line x1={40} y1={0} x2={40} y2={height} stroke="var(--color-border)" strokeWidth={2} />
        {confluence != null && (
          <rect x={16} y={toY(confluence) - 4} width={48} height={8} fill="var(--color-warning)" opacity={0.7} />
        )}
        {levels.map((l) => {
          if (l.value == null) return null;
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
              {inCluster && <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-warning-soft)] text-[var(--color-warning)] font-semibold uppercase tracking-wide">In cluster</span>}
            </div>
          );
        })}
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
