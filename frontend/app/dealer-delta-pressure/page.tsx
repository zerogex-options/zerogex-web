'use client';

import { useMemo } from 'react';
import { Compass, Info } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useDealerDeltaPressureSignal } from '@/hooks/useApiData';
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
  formatSigned,
} from '@/core/signalHelpers';

function interpretation(score: number | null): string {
  if (score == null) return 'No reading';
  if (score >= 60) return 'Dealers deeply short delta — chase risk';
  if (score >= 25) return 'Dealers net short delta (bullish bias)';
  if (score <= -60) return 'Dealers deeply long — rallies sold';
  if (score <= -25) return 'Dealers net long delta (bearish bias)';
  return 'Balanced dealer delta';
}

function sourceQuality(source: string): { label: string; tone: 'bullish' | 'bearish' | 'neutral' } {
  if (source === 'dealer_net_delta_field') return { label: 'High-precision', tone: 'bullish' };
  if (source === 'gex_by_strike.delta_oi') return { label: 'OI-derived', tone: 'neutral' };
  if (source === 'gex_by_strike.distance_proxy') return { label: 'Fallback proxy', tone: 'bearish' };
  return { label: 'Unavailable', tone: 'neutral' };
}

export default function DealerDeltaPressurePage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useDealerDeltaPressureSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.dealerDeltaPressureMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const dealerNetDelta = getNumber(payload.dealer_net_delta_estimated);
  const dniNormalized = getNumber(payload.dni_normalized);
  const source = String(payload.source ?? asObject(payload.context_values)?.source ?? '—');
  const quality = sourceQuality(source);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const needlePct = score != null ? Math.max(0, Math.min(100, (score + 100) / 2)) : 50;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Compass size={24} />
        <h1 className="text-3xl font-bold">Dealer Delta Pressure</h1>
        <TooltipWrapper
          text="Estimates dealers' aggregate net-delta position. Score is inverted: positive = dealers short delta = mechanical buying on rallies (bullish). Delta flow leads gamma exposure by minutes, so this is the closest thing to a leading indicator for 0DTE regimes."
          placement="bottom"
        >
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Score</div>
            <div className="text-6xl font-black leading-none" style={{ color }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{interpretation(score)}</div>
            <div className="mt-3 inline-flex items-center gap-2 text-[11px] px-2 py-1 rounded-full border border-[var(--color-border)]" style={{ color: trendColor(quality.tone) }}>
              <span className="font-semibold uppercase tracking-wide">Source</span>
              <span className="font-mono">{source}</span>
              <span>· {quality.label}</span>
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
              <div className="flex items-center justify-between text-sm font-semibold mb-3">
                <span>Dealer Delta Pressure</span>
                <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">−100 to +100</span>
              </div>
              <div className="relative h-6 rounded-full overflow-hidden" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, var(--color-bear-soft) 35%, var(--color-surface) 50%, var(--color-bull-soft) 65%, var(--color-bull) 100%)' }}>
                <div className="absolute top-0 h-6 w-1 bg-[var(--color-text-primary)]" style={{ left: `${needlePct}%`, transform: 'translateX(-50%)' }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-[var(--color-text-secondary)]">
                <span>Dealers long → bearish</span>
                <span>Neutral</span>
                <span>Dealers short → bullish</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">Dealer net delta (est.)</div>
                <div className="text-3xl font-black" style={{ color: (dealerNetDelta ?? 0) < 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                  {formatGexCompact(dealerNetDelta)}
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  Shares-equivalent. Negative = dealer short delta (bullish for price).
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">DNI normalized</div>
                <div className="text-3xl font-black">{formatSigned(dniNormalized, 3)}</div>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  value / DNI_NORM (default $3e8). Sign is opposite the score.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><Info size={16} /> How it&apos;s built</h2>
        <div className="text-xs text-[var(--color-text-secondary)] space-y-2 max-w-3xl">
          <div>Three data paths in priority order: <code>dealer_net_delta</code> field → <code>gex_by_strike.delta_oi</code> sum → distance-proxy fallback.</div>
          <div><code>score = −clip(dni / DNI_NORM, [−1, 1]) × 100</code> (DNI_NORM default $3e8).</div>
          <div className="pt-2 border-t border-[var(--color-border)]">
            When this disagrees with GEX Gradient (structural view), trust Dealer Delta Pressure on a shorter (≤ 30m) horizon.
          </div>
        </div>
      </section>

      <SignalEventsPanel signalName="dealer_delta_pressure" symbol={symbol} title="Event Timeline" />
    </div>
  );
}
