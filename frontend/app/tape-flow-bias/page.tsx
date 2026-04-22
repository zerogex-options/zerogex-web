'use client';

import { useMemo } from 'react';
import { Waves, Info } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTapeFlowBiasSignal } from '@/hooks/useApiData';
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
  if (score >= 50) return 'Early bullish accumulation';
  if (score >= 25) return 'Bullish tape tilt';
  if (score <= -50) return 'Distribution / early bearish';
  if (score <= -25) return 'Bearish tape tilt';
  return 'Flat / thin tape';
}

export default function TapeFlowBiasPage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useTapeFlowBiasSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.tapeFlowBiasMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const callNet = getNumber(payload.call_net_premium);
  const putNet = getNumber(payload.put_net_premium);
  const source = String(payload.source ?? asObject(payload.context_values)?.source ?? '—');

  const ctx = asObject(payload.context_values) ?? {};
  const callBuy = getNumber(ctx.call_buy_premium) ?? 0;
  const callSell = getNumber(ctx.call_sell_premium) ?? 0;
  const putBuy = getNumber(ctx.put_buy_premium) ?? 0;
  const putSell = getNumber(ctx.put_sell_premium) ?? 0;
  const totalAbs = Math.max(1, callBuy + callSell + putBuy + putSell);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  // Map score [-100, +100] to [0%, 100%] for gauge positioning
  const needlePct = score != null ? Math.max(0, Math.min(100, (score + 100) / 2)) : 50;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Waves size={24} />
        <h1 className="text-3xl font-bold">Tape Flow Bias</h1>
        <TooltipWrapper
          text="Continuous aggressive-vs-passive option-tape premium imbalance. Calls bought aggressively + puts sold aggressively = bullish. Abstains when total premium falls below the minimum threshold."
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
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
              Range −100 to +100. Source: <span className="font-mono">{source}</span>
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

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-3">Bidirectional tape meter</div>
              <div className="relative h-6 rounded-full overflow-hidden" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, var(--color-bear-soft) 35%, var(--color-surface) 50%, var(--color-bull-soft) 65%, var(--color-bull) 100%)' }}>
                <div className="absolute top-0 h-6 w-1 bg-[var(--color-text-primary)]" style={{ left: `${needlePct}%`, transform: 'translateX(-50%)' }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] font-mono text-[var(--color-text-secondary)]">
                <span>−100</span>
                <span>0</span>
                <span>+100</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <div className="text-[var(--color-text-secondary)] uppercase tracking-wide text-[10px]">Call net</div>
                  <div className="text-lg font-mono" style={{ color: (callNet ?? 0) > 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                    {formatGexCompact(callNet)}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                  <div className="text-[var(--color-text-secondary)] uppercase tracking-wide text-[10px]">Put net</div>
                  <div className="text-lg font-mono" style={{ color: (putNet ?? 0) > 0 ? 'var(--color-bear)' : 'var(--color-bull)' }}>
                    {formatGexCompact(putNet)}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-3">Premium components</div>
              <div className="flex flex-col gap-2">
                <PremiumBar label="Call buy" value={callBuy} total={totalAbs} color="var(--color-bull)" />
                <PremiumBar label="Call sell" value={callSell} total={totalAbs} color="var(--color-bear-soft)" />
                <PremiumBar label="Put buy" value={putBuy} total={totalAbs} color="var(--color-bear)" />
                <PremiumBar label="Put sell" value={putSell} total={totalAbs} color="var(--color-bull-soft)" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><Info size={16} /> How it&apos;s built</h2>
        <div className="text-xs text-[var(--color-text-secondary)] space-y-2 max-w-3xl">
          <div><code>call_net = call_buy_premium − call_sell_premium</code></div>
          <div><code>put_net = put_buy_premium − put_sell_premium</code></div>
          <div><code>directional = call_net − put_net</code>, <code>ratio = directional / (|call_net| + |put_net|)</code></div>
          <div><code>score = clip(ratio / saturation, [−1, 1]) × 100</code>. Saturation default 0.6 (60% one-sided imbalance saturates).</div>
          <div className="pt-2 border-t border-[var(--color-border)]">
            Score ≈ 0 during market hours means premium below minimum (thin tape), not &ldquo;neutral conviction&rdquo;.
          </div>
        </div>
      </section>

      <SignalEventsPanel signalName="tape_flow_bias" symbol={symbol} title="Event Timeline" />
    </div>
  );
}

function PremiumBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / total) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-mono">{formatGexCompact(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-border)]/40 overflow-hidden">
        <div className="h-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
