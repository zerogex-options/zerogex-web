'use client';

import { useMemo } from 'react';
import { Activity, Brain, Gauge, TrendingDown, TrendingUp } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useZeroDtePositionImbalanceSignal } from '@/hooks/useApiData';
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
  if (score >= 70) return 'Strong call-heavy crowding';
  if (score >= 30) return 'Moderate call-heavy crowding';
  if (score <= -70) return 'Strong put-heavy crowding';
  if (score <= -30) return 'Moderate put-heavy crowding';
  return 'Balanced same-day positioning';
}

function formatUsdCompact(value: number | null): string {
  if (value == null) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${value < 0 ? '-' : ''}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${value < 0 ? '-' : ''}$${(abs / 1_000).toFixed(1)}K`;
  return `${value < 0 ? '-' : ''}$${abs.toFixed(0)}`;
}

export default function ZeroDtePositionImbalancePage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useZeroDtePositionImbalanceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.zeroDteImbalanceMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const direction = String(payload.direction ?? 'neutral').toLowerCase();
  const signal = String(payload.signal ?? 'none');
  const triggered = payload.triggered === true;

  const ctx = useMemo(() => {
    const raw = asObject(payload.context_values) ?? {};
    return {
      callNetPremium: getNumber(raw.call_net_premium),
      putNetPremium: getNumber(raw.put_net_premium),
      flowImbalance: getNumber(raw.flow_imbalance ?? payload.flow_imbalance),
      smartImbalance: getNumber(raw.smart_imbalance ?? payload.smart_imbalance),
      putCallRatio: getNumber(raw.put_call_ratio),
    };
  }, [payload]);

  const trend: 'bullish' | 'bearish' | 'neutral' = direction === 'bullish' ? 'bullish' : direction === 'bearish' ? 'bearish' : 'neutral';

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <h1 className="text-3xl font-bold">0DTE Position Imbalance</h1>
        <TooltipWrapper text="A 0DTE crowding proxy based on net premium, flow imbalance, and smart-money tilt (not literal contract-by-contract positioning)." placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Imbalance Score</div>
            <div className="text-6xl font-black leading-none" style={{ color: trend === 'bullish' ? 'var(--color-bull)' : trend === 'bearish' ? 'var(--color-bear)' : 'var(--color-warning)' }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{label(score)}</div>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Positive scores imply upside crowding (`call_heavy`), while negative scores imply downside crowding (`put_heavy`).</p>
          </div>
          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
            <div className="text-sm font-semibold mb-3">Signal Snapshot</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Direction</div><div className="font-semibold capitalize">{direction}</div></div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Signal</div><div className="font-semibold">{signal}</div></div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Triggered</div><div className="font-semibold">{triggered ? 'Yes' : 'No'}</div></div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Put/Call Ratio</div><div className="font-mono">{ctx.putCallRatio?.toFixed(2) ?? '—'}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Crowding Inputs</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Activity size={16} /> Net Premium</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between"><span>Call Net Premium</span><span className="font-mono text-[var(--color-text-primary)]">{formatUsdCompact(ctx.callNetPremium)}</span></div>
              <div className="flex items-center justify-between"><span>Put Net Premium</span><span className="font-mono text-[var(--color-text-primary)]">{formatUsdCompact(ctx.putNetPremium)}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Brain size={16} /> Imbalances</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between"><span>Flow Imbalance</span><span className="font-mono text-[var(--color-text-primary)]">{ctx.flowImbalance?.toFixed(4) ?? '—'}</span></div>
              <div className="flex items-center justify-between"><span>Smart Imbalance</span><span className="font-mono text-[var(--color-text-primary)]">{ctx.smartImbalance?.toFixed(4) ?? '—'}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> Interpretation</div>
            <p className="text-[var(--color-text-secondary)]">This signal estimates same-day positioning pressure. It is a crowding proxy and not a literal position inventory at each strike.</p>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Bias Read</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bull)]"><TrendingUp size={16} /> Call Heavy</div>
            <p className="text-[var(--color-text-secondary)]">Net call premium and smart-money tilt dominate. Same-day crowding appears skewed toward upside continuation/chasing.</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bear)]"><TrendingDown size={16} /> Put Heavy</div>
            <p className="text-[var(--color-text-secondary)]">If deeply negative, downside crowding dominates and signal shifts toward `put_heavy` positioning risk.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
