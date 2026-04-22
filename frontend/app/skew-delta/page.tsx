'use client';

import { useMemo } from 'react';
import { Scale, Info, ShieldAlert } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useSkewDeltaSignal } from '@/hooks/useApiData';
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
  formatPct,
  formatSigned,
} from '@/core/signalHelpers';

function interpretation(score: number | null): string {
  if (score == null) return 'No reading';
  if (score <= -60) return 'Fear bid — hedge / tighten longs';
  if (score <= -25) return 'Elevated put skew';
  if (score >= 50) return 'Call-skew bid — upside squeeze watch';
  if (score >= 25) return 'Calls richer than usual';
  return 'Normal skew';
}

export default function SkewDeltaPage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useSkewDeltaSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.skewDeltaMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const otmPutIv = getNumber(payload.otm_put_iv);
  const otmCallIv = getNumber(payload.otm_call_iv);
  const spread = getNumber(payload.spread);
  const deviation = getNumber(payload.deviation);
  const baseline = getNumber(asObject(payload.context_values)?.baseline);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const needlePct = score != null ? Math.max(0, Math.min(100, (score + 100) / 2)) : 50;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <Scale size={24} />
        <h1 className="text-3xl font-bold">Skew Delta</h1>
        <TooltipWrapper
          text="Short-dated OTM put-vs-call IV spread expressed as deviation from a configurable baseline. Equity-index skew is structurally positive — this measures how elevated it is vs normal. Elevated put skew (negative score) is a leading fear gauge."
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
                <span className="flex items-center gap-2"><ShieldAlert size={14} /> Fear ↔ Euphoria</span>
                <span className="text-[10px] text-[var(--color-text-secondary)] font-mono">−100 to +100</span>
              </div>
              <div className="relative h-6 rounded-full overflow-hidden" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, var(--color-bear-soft) 30%, var(--color-surface) 50%, var(--color-bull-soft) 70%, var(--color-bull) 100%)' }}>
                <div className="absolute top-0 h-6 w-1 bg-[var(--color-text-primary)]" style={{ left: `${needlePct}%`, transform: 'translateX(-50%)' }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] font-mono text-[var(--color-text-secondary)]">
                <span>Fear</span>
                <span>Normal</span>
                <span>Euphoria</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">OTM put IV</div>
                <div className="text-3xl font-black" style={{ color: 'var(--color-bear)' }}>
                  {formatPct(otmPutIv, 2, false)}
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Nearest-window OTM put implied volatility.</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">OTM call IV</div>
                <div className="text-3xl font-black" style={{ color: 'var(--color-bull)' }}>
                  {formatPct(otmCallIv, 2, false)}
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Nearest-window OTM call implied volatility.</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">Spread</div>
                <div className="text-3xl font-black">{formatSigned(spread, 4)}</div>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  put_iv − call_iv. Baseline: <span className="font-mono">{formatSigned(baseline, 3)}</span>
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">Deviation</div>
                <div className="text-3xl font-black" style={{ color: (deviation ?? 0) > 0 ? 'var(--color-bear)' : 'var(--color-bull)' }}>
                  {formatSigned(deviation, 4)}
                </div>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">spread − baseline. Negated to drive score.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><Info size={16} /> How it&apos;s built</h2>
        <div className="text-xs text-[var(--color-text-secondary)] space-y-2 max-w-3xl">
          <div><code>spread = otm_put_iv − otm_call_iv</code></div>
          <div><code>deviation = spread − baseline</code> (baseline default 0.02)</div>
          <div><code>score = −clip(deviation / saturation, [−1, 1]) × 100</code> (saturation default 0.04).</div>
          <div className="pt-2 border-t border-[var(--color-border)]">
            The negative sign means elevated put skew → bearish score. Null IV → no short-dated data that cycle (not the same as neutral).
          </div>
        </div>
      </section>

      <SignalEventsPanel signalName="skew_delta" symbol={symbol} title="Event Timeline" />
    </div>
  );
}
