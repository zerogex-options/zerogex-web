'use client';

import { useMemo } from 'react';
import { AlertTriangle, Gauge, Radar, TrendingDown, TrendingUp } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTrapDetectionSignal } from '@/hooks/useApiData';
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

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

function setupLabel(score: number | null): string {
  if (score == null) return 'No reading';
  if (score <= -70) return 'Strong bearish trap/fade';
  if (score <= -30) return 'Bearish fade risk';
  if (score >= 70) return 'Strong bullish trap/fade';
  if (score >= 30) return 'Bullish fade risk';
  return 'No strong trap edge';
}

export default function TrapDetectionPage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useTrapDetectionSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.trapDetectionMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const direction = String(payload.direction ?? 'neutral').toLowerCase();
  const signal = String(payload.signal ?? 'none');
  const clamped = getNumber(payload.clamped_score);
  const triggered = payload.triggered === true;

  const ctx = useMemo(() => {
    const raw = asObject(payload.context_values) ?? {};
    return {
      close: getNumber(raw.close),
      resistance: getNumber(raw.resistance_level),
      support: getNumber(raw.support_level),
      breakoutUp: asBool(raw.breakout_up ?? payload.breakout_up),
      breakoutDown: asBool(raw.breakout_down ?? payload.breakout_down),
      netGex: getNumber(raw.net_gex),
      netGexDelta: getNumber(raw.net_gex_delta ?? payload.net_gex_delta),
      longGamma: asBool(raw.long_gamma),
      gammaStrengthening: asBool(raw.gamma_strengthening),
    };
  }, [payload]);

  const trend: 'bullish' | 'bearish' | 'neutral' = direction === 'bullish' ? 'bullish' : direction === 'bearish' ? 'bearish' : 'neutral';

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-8">
        <h1 className="text-3xl font-bold">Trap Detection</h1>
        <TooltipWrapper text="Flags likely failed breakouts/breakdowns when gamma positioning implies mean reversion pressure." placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Trap Score</div>
            <div className="text-6xl font-black leading-none" style={{ color: trend === 'bullish' ? 'var(--color-bull)' : trend === 'bearish' ? 'var(--color-bear)' : 'var(--color-warning)' }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{setupLabel(score)}</div>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Negative values generally map to bearish-fade risk after upside breakouts. Positive values map to bullish-fade risk after downside breaks.</p>
          </div>
          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] p-5 bg-[var(--color-surface-subtle)]">
            <div className="text-sm font-semibold mb-3">Signal State</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Direction</div><div className="font-semibold capitalize">{direction}</div></div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Signal</div><div className="font-semibold">{signal}</div></div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Triggered</div><div className="font-semibold">{triggered ? 'Yes' : 'No'}</div></div>
              <div className="rounded-lg border border-[var(--color-border)] p-3 bg-[var(--color-surface)]"><div className="text-[var(--color-text-secondary)]">Clamped</div><div className="font-mono">{clamped != null ? clamped.toFixed(3) : '—'}</div></div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Breakout + Gamma Context</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Radar size={16} /> Price Structure</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between"><span>Close</span><span className="font-mono text-[var(--color-text-primary)]">{ctx.close?.toFixed(2) ?? '—'}</span></div>
              <div className="flex items-center justify-between"><span>Resistance</span><span className="font-mono text-[var(--color-text-primary)]">{ctx.resistance?.toFixed(2) ?? '—'}</span></div>
              <div className="flex items-center justify-between"><span>Support</span><span className="font-mono text-[var(--color-text-primary)]">{ctx.support?.toFixed(2) ?? '—'}</span></div>
              <div className="flex items-center justify-between"><span>Breakout Up</span><span className="font-medium text-[var(--color-text-primary)]">{ctx.breakoutUp ? 'Yes' : 'No'}</span></div>
              <div className="flex items-center justify-between"><span>Breakout Down</span><span className="font-medium text-[var(--color-text-primary)]">{ctx.breakoutDown ? 'Yes' : 'No'}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> Dealer Positioning</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <div className="flex items-center justify-between"><span>Net GEX</span><span className="font-mono text-[var(--color-text-primary)]">{ctx.netGex?.toFixed(0) ?? '—'}</span></div>
              <div className="flex items-center justify-between"><span>Net GEX Delta</span><span className="font-mono text-[var(--color-text-primary)]">{ctx.netGexDelta?.toFixed(0) ?? '—'}</span></div>
              <div className="flex items-center justify-between"><span>Long Gamma</span><span className="font-medium text-[var(--color-text-primary)]">{ctx.longGamma ? 'Yes' : 'No'}</span></div>
              <div className="flex items-center justify-between"><span>Gamma Strengthening</span><span className="font-medium text-[var(--color-text-primary)]">{ctx.gammaStrengthening ? 'Yes' : 'No'}</span></div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle size={16} /> Model Meaning</div>
            <p className="text-[var(--color-text-secondary)]">If price breaks resistance but long gamma is strong/increasing, continuation odds drop and the move is more likely to fade back toward mean.</p>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Interpretation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bear)]"><TrendingDown size={16} /> Bearish Fade</div>
            <p className="text-[var(--color-text-secondary)]">Typical case: upside breakout + long gamma + strengthening gamma =&gt; breakout failure risk.</p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bull)]"><TrendingUp size={16} /> Bullish Fade</div>
            <p className="text-[var(--color-text-secondary)]">Mirror case: downside breakdown under mean-reverting gamma regime can snap back higher.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
