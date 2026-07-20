'use client';

import PageShell from '@/components/layout/PageShell';
import { useMemo } from 'react';
import { Compass } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useDealerDeltaPressureSignal } from '@/hooks/useApiData';
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
  formatSigned,
} from '@/core/signalHelpers';
import { spectrumIndicatorLeft } from '@/core/spectrumIndicator';
import AutoFitValue from '@/components/AutoFitValue';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

function interpretation(score: number | null, t: (key: string) => string): string {
  if (score == null) return t('noReading');
  if (score >= 60) return t('deepShort');
  if (score >= 25) return t('netShort');
  if (score <= -60) return t('deepLong');
  if (score <= -25) return t('netLong');
  return t('balanced');
}

export default function DealerDeltaPressurePage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useDealerDeltaPressureSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.dealerDeltaPressureMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const trend = toTrend(payload.direction);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const dealerNetDelta = getNumber(payload.dealer_net_delta_estimated);
  const dniNormalized = getNumber(payload.dni_normalized);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const needlePct = score != null ? Math.max(0, Math.min(100, (score + 100) / 2)) : 50;

  return (
    <PageShell>
      <SignalPageTitle
        title={t('title')}
        subtitle={t('subtitle')}
        icon={Compass}
        tooltip={t('tooltip')}
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
              <div className="flex items-center justify-between text-sm font-semibold mb-3">
                <span>{t('gaugeLabel')}</span>
                <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">−100 to +100</span>
              </div>
              <div className="relative h-6 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, var(--color-bear-soft) 35%, var(--color-surface) 50%, var(--color-bull-soft) 65%, var(--color-bull) 100%)' }}>
                <div className="absolute top-0 h-6 w-1 bg-[var(--color-text-primary)]" style={{ left: spectrumIndicatorLeft(needlePct, 24, 4), transform: 'translateX(-50%)' }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-[var(--color-text-secondary)]">
                <span>{t('dealersLongBearish')}</span>
                <span>{t('neutral')}</span>
                <span>{t('dealersShortBullish')}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">{t('dealerNetDeltaLabel')}</div>
                <AutoFitValue className="text-2xl sm:text-3xl font-black" style={{ color: (dealerNetDelta ?? 0) < 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                  {formatGexCompact(dealerNetDelta)}
                </AutoFitValue>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  {t('dealerNetDeltaHelp')}
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">{t('dniNormalizedLabel')}</div>
                <AutoFitValue className="text-2xl sm:text-3xl font-black">{formatSigned(dniNormalized, 3)}</AutoFitValue>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  {t('dniNormalizedHelp')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={<>{t('caveat')}</>}
      >
        <div>{t('howItsBuiltDesc')}</div>
        <div><code>Score = −clip(DNI / DNI Norm, [−1, 1]) × 100</code> (DNI Norm default $3e8).</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="dealer_delta_pressure" symbol={symbol} title={t('eventTimeline')} />
    </PageShell>
  );
}
