'use client';

import { useMemo } from 'react';
import { Compass, Gauge, Magnet, TrendingDown, TrendingUp } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useGammaVwapConfluenceSignal } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';

type GenericObject = Record<string, unknown>;

function asObject(value: unknown): GenericObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as GenericObject;
}

function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function label(score: number | null): string {
  if (score == null) return 'No reading';
  if (score >= 70) return 'Strong bullish confluence';
  if (score >= 30) return 'Bullish confluence';
  if (score <= -70) return 'Strong bearish confluence';
  if (score <= -30) return 'Bearish confluence';
  return 'Mixed confluence';
}

function formatPct(value: number | null, digits = 3): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export default function GammaVwapConfluencePage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useGammaVwapConfluenceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.gammaVwapConfluenceMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const direction = String(payload.direction ?? 'neutral').toLowerCase();
  const signal = String(payload.signal ?? 'none');
  const triggered = payload.triggered === true;

  const ctx = useMemo(() => {
    const raw = asObject(payload.context_values) ?? {};
    return {
      gammaFlip: getNumber(raw.gamma_flip),
      vwap: getNumber(raw.vwap),
      confluenceLevel: getNumber(raw.confluence_level ?? payload.confluence_level),
      clusterGapPct: getNumber(raw.cluster_gap_pct ?? payload.cluster_gap_pct),
      distanceFromLevelPct: getNumber(raw.distance_from_level_pct),
      netGex: getNumber(raw.net_gex),
    };
  }, [payload]);

  const trend: 'bullish' | 'bearish' | 'neutral' = direction === 'bullish' ? 'bullish' : direction === 'bearish' ? 'bearish' : 'neutral';

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <h1 className="text-3xl font-bold">Gamma/VWAP Confluence</h1>
        <TooltipWrapper text="Measures whether gamma flip and VWAP are tightly clustered into a high-impact confluence level." placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Confluence Score</div>
            <div className="text-6xl font-black leading-none" style={{ color: trend === 'bullish' ? 'var(--color-bull)' : trend === 'bearish' ? 'var(--color-bear)' : 'var(--color-warning)' }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{label(score)}</div>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Positive values suggest bullish confluence (price above magnet level). Negative values suggest bearish confluence (price below level).</p>
          </div>
          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
            <div className="text-sm font-semibold mb-3">Signal Snapshot</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Direction</div><div className="font-semibold capitalize">{direction}</div></div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Signal</div><div className="font-semibold">{signal}</div></div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Triggered</div><div className="font-semibold">{triggered ? 'Yes' : 'No'}</div></div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Cluster Gap</div><div className="font-mono">{formatPct(ctx.clusterGapPct, 3)}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Confluence Inputs</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Compass size={16} /> Level Stack</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between"><span>Gamma Flip</span><span className="font-mono text-[var(--color-text-primary)]">{ctx.gammaFlip?.toFixed(2) ?? '—'}</span></div>
              <div className="flex items-center justify-between"><span>VWAP</span><span className="font-mono text-[var(--color-text-primary)]">{ctx.vwap?.toFixed(2) ?? '—'}</span></div>
              <div className="flex items-center justify-between"><span>Confluence Level</span><span className="font-mono text-[var(--color-text-primary)]">{ctx.confluenceLevel?.toFixed(2) ?? '—'}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Magnet size={16} /> Distance Metrics</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between"><span>Cluster Gap %</span><span className="font-mono text-[var(--color-text-primary)]">{formatPct(ctx.clusterGapPct, 3)}</span></div>
              <div className="flex items-center justify-between"><span>Distance From Level %</span><span className="font-mono text-[var(--color-text-primary)]">{formatPct(ctx.distanceFromLevelPct, 3)}</span></div>
              <div className="flex items-center justify-between"><span>Net GEX</span><span className="font-mono text-[var(--color-text-primary)]">{ctx.netGex?.toFixed(0) ?? '—'}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> Model Meaning</div>
            <p className="text-[var(--color-text-secondary)]">When gamma flip and VWAP cluster tightly, that zone can act as a magnetic control level. Price relative to that level drives directional confluence.</p>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Bias Read</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bull)]"><TrendingUp size={16} /> Bullish Confluence</div>
            <p className="text-[var(--color-text-secondary)]">Price above a tight gamma/VWAP cluster with negative GEX can support continuation to the upside.</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bear)]"><TrendingDown size={16} /> Bearish Confluence</div>
            <p className="text-[var(--color-text-secondary)]">Price below the confluence level can become a bearish drift/fade anchor depending on dealer positioning.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
