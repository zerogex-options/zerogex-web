'use client';

import { useMemo } from 'react';
import { Activity, Clock, Info } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useVannaCharmFlowSignal } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';
import SignalSparkline from '@/components/SignalSparkline';
import SignalEventsPanel from '@/components/SignalEventsPanel';
import ExpandableCard from '@/components/ExpandableCard';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import {
  asObject,
  getNumber,
  parseScoreHistory,
  toTrend,
  trendColor,
  formatGexCompact,
} from '@/core/signalHelpers';

function interpretation(score: number | null): string {
  if (score == null) return 'No reading';
  if (score >= 40) return 'Vanna lift — melt-up bias';
  if (score >= 20) return 'Bullish hedging pressure';
  if (score <= -40) return 'Charm fade — afternoon drag';
  if (score <= -20) return 'Bearish hedging pressure';
  return 'Neutral dealer pressure';
}

export default function VannaCharmFlowPage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useVannaCharmFlowSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.vannaCharmFlowMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const vannaTotal = getNumber(payload.vanna_total);
  const charmTotal = getNumber(payload.charm_total);
  const charmAmp = getNumber(payload.charm_amplification) ?? 1.0;
  const source = String(payload.source ?? asObject(payload.context_values)?.source ?? '—');

  if (loading && !data) return <LoadingSpinner size="lg" />;

  // Position charm amplification in [1.0, 1.5] range → [0, 100]%
  const ampPct = Math.max(0, Math.min(100, ((charmAmp - 1.0) / 0.5) * 100));
  const charmWeighted = charmTotal != null ? charmTotal * charmAmp : null;

  // Normalize bar widths with a shared visual scale
  const vcMax = Math.max(Math.abs(vannaTotal ?? 0), Math.abs(charmWeighted ?? 0), 1);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Activity size={24} />
        <h1 className="text-3xl font-bold">Vanna/Charm Flow</h1>
        <TooltipWrapper
          text="Second-order greek dealer hedging pressure. Vanna captures dealer delta changes when IV moves. Charm captures decay of short-dated deltas toward expiry. Late-session charm amplification boosts the afternoon fade signal."
          placement="bottom"
        >
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Composite Score</div>
            <div className="text-6xl font-black leading-none" style={{ color }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{interpretation(score)}</div>
            <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Source: <span className="font-mono">{source}</span></p>

            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2"><Clock size={14} /> Charm amplification</div>
              <div className="text-2xl font-black">{charmAmp.toFixed(2)}×</div>
              <div className="mt-2 h-2 rounded-full bg-[var(--color-border)]/40 overflow-hidden">
                <div className="h-full" style={{ width: `${ampPct}%`, background: 'linear-gradient(90deg, var(--color-text-secondary), var(--color-warning))' }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--color-text-secondary)]">
                <span>1.0×</span>
                <span>1.5× (EOD)</span>
              </div>
            </div>

            <ExpandableCard
              className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3"
              expandTrigger="button"
              expandButtonLabel="Expand score history"
            >
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Score history</div>
              <SignalSparkline points={history} strokeColor={color} fillColor={`${color}1f`} height={56} />
            </ExpandableCard>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-3">Vanna total</div>
              <SignedBar value={vannaTotal} absMax={vcMax} />
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                Positive = dealer delta grows with spot up (bullish hedging). Morning vol-crush lift lives here.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-3">Charm total × amplification</div>
              <SignedBar value={charmWeighted} absMax={vcMax} />
              <div className="mt-2 text-xs text-[var(--color-text-secondary)] flex items-center justify-between">
                <span>Raw charm: <span className="font-mono">{formatGexCompact(charmTotal)}</span></span>
                <span>Weighted: <span className="font-mono">{formatGexCompact(charmWeighted)}</span></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><Info size={16} /> How it&apos;s built</h2>
        <div className="text-xs text-[var(--color-text-secondary)] space-y-2 max-w-3xl">
          <div><code>vanna_total = Σ dealer_vanna_exposure</code>, <code>charm_total = Σ dealer_charm_exposure</code></div>
          <div><code>amp = charm_amplification(session_time)</code> — 1.0 morning, ramps to 1.5 in the final ~40% of session.</div>
          <div><code>combined = vanna_total + charm_total × amp</code>, <code>score = clip(combined / vc_norm, [−1, 1]) × 100</code>.</div>
          <div className="pt-2 border-t border-[var(--color-border)]">
            Source <code>market_exposure_negated</code> = legacy fallback path; signal is still valid but less precise than <code>dealer_exposure</code>.
          </div>
        </div>
      </section>

      <SignalEventsPanel signalName="vanna_charm_flow" symbol={symbol} title="Event Timeline" />
    </div>
  );
}

function SignedBar({ value, absMax }: { value: number | null; absMax: number }) {
  const v = value ?? 0;
  const pct = (Math.abs(v) / absMax) * 50;
  const isNeg = v < 0;
  return (
    <div className="relative h-6 rounded-full bg-[var(--color-border)]/30 overflow-hidden">
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-[var(--color-text-secondary)] opacity-60" />
      <div
        className="absolute top-0 bottom-0"
        style={{
          left: isNeg ? `${50 - pct}%` : '50%',
          width: `${pct}%`,
          background: isNeg ? 'var(--color-bear)' : 'var(--color-bull)',
        }}
      />
      <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-[var(--color-text-primary)]">
        {formatGexCompact(value)}
      </div>
    </div>
  );
}
