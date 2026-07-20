'use client';

import PageShell from '@/components/layout/PageShell';
import { useMemo } from 'react';
import { Waves } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTapeFlowBiasSignal } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import SignalEventsPanel from '@/components/SignalEventsPanel';
import SignalPageTitle from '@/components/SignalPageTitle';
import SignalScoreHero from '@/components/SignalScoreHero';
import SignalHowItsBuilt from '@/components/SignalHowItsBuilt';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import {
  asObject,
  getNumber,
  parseScoreHistory,
  toTrend,
  formatGexCompact,
} from '@/core/signalHelpers';
import { spectrumIndicatorLeft } from '@/core/spectrumIndicator';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

function interpretation(score: number | null, t: (key: string) => string): string {
  if (score == null) return t('interpNoReading');
  if (score >= 50) return t('interpBullAccum');
  if (score >= 25) return t('interpBullTilt');
  if (score <= -50) return t('interpBearDist');
  if (score <= -25) return t('interpBearTilt');
  return t('interpFlat');
}

export default function TapeFlowBiasPage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useTapeFlowBiasSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.tapeFlowBiasMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const trend = toTrend(payload.direction);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const callNet = getNumber(payload.call_net_premium);
  const putNet = getNumber(payload.put_net_premium);

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
    <PageShell>
      <SignalPageTitle
        title="Tape Flow Bias"
        subtitle={t('pageSubtitle')}
        icon={Waves}
        tooltip={t('pageTooltip')}
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <SignalScoreHero
              score={score}
              trend={trend}
              interpretation={interpretation(score, t)}
              history={history}
            />
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-3">{t('meterHeading')}</div>
              <div className="relative h-6 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, var(--color-bear-soft) 35%, var(--color-surface) 50%, var(--color-bull-soft) 65%, var(--color-bull) 100%)' }}>
                <div className="absolute top-0 h-6 w-1 bg-[var(--color-text-primary)]" style={{ left: spectrumIndicatorLeft(needlePct, 24, 4), transform: 'translateX(-50%)' }} />
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
              <div className="text-sm font-semibold mb-3">{t('premiumComponentsHeading')}</div>
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

      <SignalHowItsBuilt
        caveat={<>{t('caveatText')}</>}
      >
        <div><code>Call Net = Call Buy Premium − Call Sell Premium</code></div>
        <div><code>Put Net = Put Buy Premium − Put Sell Premium</code></div>
        <div><code>Directional = Call Net − Put Net</code>, <code>Ratio = Directional / (|Call Net| + |Put Net|)</code></div>
        <div><code>Score = clip(Ratio / Saturation, [−1, 1]) × 100</code>. {t('saturationNote')}</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="tape_flow_bias" symbol={symbol} title={t('eventTimelineTitle')} />
    </PageShell>
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
