'use client';

import { useMemo } from 'react';
import { ArrowRightLeft, Gauge, Rocket, TrendingDown, TrendingUp } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useSqueezeSetupSignal } from '@/hooks/useApiData';
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

function formatSigned(value: number | null, digits = 2): string {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

function regimeLabel(score: number | null): string {
  if (score == null) return 'No reading';
  if (score >= 70) return 'Strong bullish squeeze setup';
  if (score >= 30) return 'Bullish squeeze risk building';
  if (score <= -70) return 'Strong bearish squeeze setup';
  if (score <= -30) return 'Bearish squeeze risk building';
  return 'Neutral squeeze backdrop';
}

export default function SqueezeSetupPage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useSqueezeSetupSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.squeezeSetupMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const direction = String(payload.direction ?? 'neutral').toLowerCase();
  const triggered = payload.triggered === true;
  const signal = String(payload.signal ?? 'none');
  const clampedScore = getNumber(payload.clamped_score);

  const ctx = useMemo(() => {
    const raw = asObject(payload.context_values) ?? {};
    return {
      netGex: getNumber(raw.net_gex),
      gammaFlip: getNumber(raw.gamma_flip),
      close: getNumber(raw.close),
      callFlowDelta: getNumber(raw.call_flow_delta ?? payload.call_flow_delta),
      putFlowDelta: getNumber(raw.put_flow_delta ?? payload.put_flow_delta),
      momentum5Bar: getNumber(raw.momentum_5bar),
    };
  }, [payload]);

  const trend: 'bullish' | 'bearish' | 'neutral' = direction === 'bullish' ? 'bullish' : direction === 'bearish' ? 'bearish' : 'neutral';

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <h1 className="text-3xl font-bold">Squeeze Setup</h1>
        <TooltipWrapper text="Detects squeeze conditions from gamma regime, spot-vs-flip location, and options flow acceleration." placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Squeeze Score</div>
            <div className="text-6xl font-black leading-none" style={{ color: trend === 'bullish' ? 'var(--color-bull)' : trend === 'bearish' ? 'var(--color-bear)' : 'var(--color-warning)' }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{regimeLabel(score)}</div>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Positive values indicate squeeze risk to the upside, negative values indicate downside squeeze risk. `score` is `clamped_score × 100`.
            </p>
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold">Squeeze Spectrum</div>
              <div className="text-xs text-[var(--color-text-secondary)]">Range: −100 to +100</div>
            </div>
            <div className="relative mt-4">
              <div className="h-4 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, #d98572 25%, var(--color-warning) 50%, #75cfa1 75%, var(--color-bull) 100%)' }} />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-30" style={{ left: '35%' }} />
              <div className="absolute top-0 h-4 w-px bg-[var(--color-text-primary)] opacity-30" style={{ left: '65%' }} />
              <div className="absolute -top-2 h-8 w-0.5 bg-[var(--color-text-primary)]" style={{ left: score != null ? `${Math.max(0, Math.min(100, (score + 100) / 2))}%` : '50%', transform: 'translateX(-50%)' }} />
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Signal Inputs</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> State</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between"><span>Direction</span><span className="font-medium text-[var(--color-text-primary)] capitalize">{direction}</span></div>
              <div className="flex items-center justify-between"><span>Signal</span><span className="font-medium text-[var(--color-text-primary)]">{signal}</span></div>
              <div className="flex items-center justify-between"><span>Triggered</span><span className="font-medium text-[var(--color-text-primary)]">{triggered ? 'Yes' : 'No'}</span></div>
              <div className="flex items-center justify-between"><span>Clamped Score</span><span className="font-mono text-[var(--color-text-primary)]">{formatSigned(clampedScore, 3)}</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><ArrowRightLeft size={16} /> Flow + Momentum</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between"><span>Call Flow Delta</span><span className="font-mono text-[var(--color-text-primary)]">{formatSigned(ctx.callFlowDelta, 0)}</span></div>
              <div className="flex items-center justify-between"><span>Put Flow Delta</span><span className="font-mono text-[var(--color-text-primary)]">{formatSigned(ctx.putFlowDelta, 0)}</span></div>
              <div className="flex items-center justify-between"><span>5-Bar Momentum</span><span className="font-mono text-[var(--color-text-primary)]">{formatSigned(ctx.momentum5Bar, 4)}</span></div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Rocket size={16} /> Gamma Context</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between"><span>Net GEX</span><span className="font-mono text-[var(--color-text-primary)]">{formatSigned(ctx.netGex, 0)}</span></div>
              <div className="flex items-center justify-between"><span>Gamma Flip</span><span className="font-mono text-[var(--color-text-primary)]">{formatSigned(ctx.gammaFlip, 2)}</span></div>
              <div className="flex items-center justify-between"><span>Close</span><span className="font-mono text-[var(--color-text-primary)]">{formatSigned(ctx.close, 2)}</span></div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Interpretation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bull)]"><TrendingUp size={16} /> Bullish Setup</div>
            <p className="text-[var(--color-text-secondary)]">When dealers are in negative GEX, price is above gamma flip, and call flow accelerates, squeeze continuation risk rises.</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bear)]"><TrendingDown size={16} /> Bearish Setup</div>
            <p className="text-[var(--color-text-secondary)]">Inverse conditions (negative flow/momentum with bearish structure) push the score lower and flag downside squeeze risk.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
