'use client';

import { useMemo } from 'react';
import { ArrowDown, ArrowUp, Info, Minus, ShieldCheck, Zap } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useVolExpansionSignal } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';
import SignalSparkline from '@/components/SignalSparkline';
import SignalEventsPanel from '@/components/SignalEventsPanel';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import {
  asObject,
  getNumber,
  parseScoreHistory,
  toTrend,
  trendColor,
  formatGexCompact,
  formatPct,
  formatSigned,
} from '@/core/signalHelpers';

function interpretation(score: number | null) {
  if (score == null) return 'No reading';
  if (score >= 70) return 'Bullish expansion primed';
  if (score >= 30) return 'Amplification potential';
  if (score <= -70) return 'Bearish expansion active';
  if (score <= -30) return 'Downside amplification';
  return 'Neutral — suppressed';
}

export default function VolatilityExpansionPage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useVolExpansionSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.volExpansionMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const expansion = getNumber(payload.expansion);
  const directionScore = getNumber(payload.direction_score);
  const magnitude = getNumber(payload.magnitude);
  const expectedBps = getNumber(payload.expected_5min_move_bps);
  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const ctx = useMemo(() => {
    const cv = asObject(payload.context_values) ?? {};
    return {
      net_gex: getNumber(cv.net_gex),
      momentum: getNumber(cv.momentum),
      momentum_z: getNumber(cv.momentum_z),
      gex_regime: String(cv.gex_regime ?? '—'),
      vol_pressure: getNumber(cv.vol_pressure),
      pct_change_5bar: getNumber(cv.pct_change_5bar),
      gex_readiness: getNumber(cv.gex_readiness),
    };
  }, [payload]);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-3xl font-bold">Volatility Expansion</h1>
        <TooltipWrapper
          text="Decomposes the composite score into expansion (GEX-driven readiness, 0–100) and direction (momentum-driven, −100..+100). Score is (expansion × direction) / 100."
          placement="bottom"
        >
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-3xl">
        Answers two questions: <em>Will vol expand?</em> and <em>If so, which way?</em> Short-gamma regimes elevate
        expansion readiness; a 5-bar z-scored momentum picks the direction.
      </p>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Expansion Score</div>
            <div className="text-6xl font-black leading-none" style={{ color }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{interpretation(score)}</div>
            <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
              Range −100 to +100. Sign follows <code>direction_score</code>, magnitude is gated by <code>expansion</code>.
            </p>
            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Score history</div>
              <SignalSparkline points={history} strokeColor={color} fillColor={`${color}1f`} height={56} />
            </div>
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-semibold">Expansion</div>
                <div className="text-xs text-[var(--color-text-secondary)]">0 to 100</div>
              </div>
              <div className="text-3xl font-black" style={{ color: expansion != null && expansion >= 60 ? 'var(--color-bull)' : expansion != null && expansion >= 30 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>
                {expansion != null ? expansion.toFixed(1) : '—'}
              </div>
              <div className="mt-3 h-3 rounded-full bg-[var(--color-border)]/40 overflow-hidden">
                <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, expansion ?? 0))}%`, background: 'linear-gradient(90deg, var(--color-text-secondary), var(--color-warning), var(--color-bull))' }} />
              </div>
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">GEX readiness (short-gamma bias elevates this).</p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-semibold">Direction</div>
                <div className="text-xs text-[var(--color-text-secondary)]">−100 to +100</div>
              </div>
              <div className="text-3xl font-black" style={{ color: directionScore != null && directionScore > 10 ? 'var(--color-bull)' : directionScore != null && directionScore < -10 ? 'var(--color-bear)' : 'var(--color-warning)' }}>
                {directionScore != null ? `${directionScore >= 0 ? '+' : ''}${directionScore.toFixed(1)}` : '—'}
              </div>
              <div className="relative mt-3 h-3 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-bear), var(--color-warning), var(--color-bull))' }}>
                <div className="absolute -top-1 h-5 w-0.5 bg-[var(--color-text-primary)]" style={{ left: directionScore != null ? `${Math.max(0, Math.min(100, (directionScore + 100) / 2))}%` : '50%', transform: 'translateX(-50%)' }} />
              </div>
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">5-bar z-scored momentum, tanh-squashed.</p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-1">Magnitude</div>
              <div className="text-3xl font-black">{magnitude != null ? magnitude.toFixed(1) : '—'}</div>
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">|expansion × direction| / 100 — absolute conviction.</p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-1">Expected 5-min move</div>
              <div className="text-3xl font-black">{expectedBps != null ? `${expectedBps.toFixed(1)} bps` : '—'}</div>
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">Forecasted basis-point move into the next 5-minute bar.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Context Breakdown</h2>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
            <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Info size={14} /> How It&apos;s Built</div>
            <div className="text-xs text-[var(--color-text-secondary)] space-y-2">
              <div><strong className="text-[var(--color-text-primary)]">gex_readiness</strong> = 0.15 + 0.85 × (1 + clamp(−net_gex / 300M)) / 2.</div>
              <div><strong className="text-[var(--color-text-primary)]">expansion</strong> = gex_readiness × 100.</div>
              <div><strong className="text-[var(--color-text-primary)]">direction</strong> = tanh(momentum_z) × 100.</div>
              <div><strong className="text-[var(--color-text-primary)]">score</strong> = (expansion × direction) / 100.</div>
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-secondary)]">
              Sign-flip of <code>direction_score</code> while <code>expansion</code> stays high = whipsaw warning.
            </div>
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
            <div className="text-sm font-semibold mb-3">Live Inputs</div>
            <div className="grid grid-cols-[minmax(150px,1.2fr)_1fr_minmax(120px,1fr)] gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)] pb-2 border-b border-[var(--color-border)]">
              <span>Metric</span>
              <span className="text-right">Value</span>
              <span className="text-center">Status</span>
            </div>
            <div className="divide-y divide-[var(--color-border)]">
              <ContextRow label="Net GEX" value={formatGexCompact(ctx.net_gex)}>
                {ctx.net_gex != null ? (
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${ctx.net_gex > 0 ? 'bg-[rgba(27,196,125,0.12)] text-[var(--color-bull)]' : 'bg-[rgba(255,77,90,0.12)] text-[var(--color-bear)]'}`}>
                    {ctx.net_gex > 0 ? <ShieldCheck size={13} /> : <Zap size={13} />}
                    {ctx.net_gex > 0 ? 'Suppression' : 'Amplification'}
                  </span>
                ) : <span className="text-xs text-[var(--color-text-secondary)]">—</span>}
              </ContextRow>
              <ContextRow label="GEX regime" value={ctx.gex_regime}>
                <span className="text-xs capitalize text-[var(--color-text-secondary)]">{ctx.gex_regime}</span>
              </ContextRow>
              <ContextRow label="GEX readiness" value={ctx.gex_readiness != null ? ctx.gex_readiness.toFixed(3) : '—'}>
                {ctx.gex_readiness != null ? (
                  <div className="flex items-center gap-2 w-full max-w-[120px]">
                    <div className="relative flex-1 h-2 rounded-full bg-[var(--color-border)]">
                      <div className="absolute top-0 left-0 h-2 rounded-full" style={{ width: `${Math.max(0, Math.min(100, ctx.gex_readiness * 100))}%`, background: 'var(--color-bull)' }} />
                    </div>
                    <span className="text-[10px] text-[var(--color-text-secondary)] w-8 text-right">{(ctx.gex_readiness * 100).toFixed(0)}%</span>
                  </div>
                ) : <span className="text-xs text-[var(--color-text-secondary)]">—</span>}
              </ContextRow>
              <ContextRow label="Momentum z" value={formatSigned(ctx.momentum_z, 3)}>
                {ctx.momentum_z != null ? (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${ctx.momentum_z > 0.25 ? 'text-[var(--color-bull)]' : ctx.momentum_z < -0.25 ? 'text-[var(--color-bear)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {ctx.momentum_z > 0.25 ? <ArrowUp size={14} /> : ctx.momentum_z < -0.25 ? <ArrowDown size={14} /> : <Minus size={14} />}
                    {Math.abs(ctx.momentum_z) >= 1 ? 'Strong' : Math.abs(ctx.momentum_z) >= 0.25 ? 'Moderate' : 'Flat'}
                  </span>
                ) : <span className="text-xs text-[var(--color-text-secondary)]">—</span>}
              </ContextRow>
              <ContextRow label="5-bar % change" value={formatPct(ctx.pct_change_5bar, 3)}>
                {ctx.pct_change_5bar != null ? (
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${ctx.pct_change_5bar > 0.001 ? 'text-[var(--color-bull)]' : ctx.pct_change_5bar < -0.001 ? 'text-[var(--color-bear)]' : 'text-[var(--color-text-secondary)]'}`}>
                    {ctx.pct_change_5bar > 0.001 ? <ArrowUp size={14} /> : ctx.pct_change_5bar < -0.001 ? <ArrowDown size={14} /> : <Minus size={14} />}
                    {Math.abs(ctx.pct_change_5bar) >= 0.005 ? 'Strong' : Math.abs(ctx.pct_change_5bar) >= 0.001 ? 'Moderate' : 'Negligible'}
                  </span>
                ) : <span className="text-xs text-[var(--color-text-secondary)]">—</span>}
              </ContextRow>
            </div>
          </div>
        </div>
      </section>

      <SignalEventsPanel signalName="vol_expansion" symbol={symbol} title="Event Timeline" />
    </div>
  );
}

function ContextRow({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(150px,1.2fr)_1fr_minmax(120px,1fr)] gap-2 text-sm py-2.5 items-center">
      <span className="font-medium">{label}</span>
      <span className="text-right font-mono text-[var(--color-text-secondary)]">{value}</span>
      <span className="flex items-center justify-center">{children}</span>
    </div>
  );
}
