'use client';

import PageShell from '@/components/layout/PageShell';
import { useMemo } from 'react';
import { Scale, ShieldAlert } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useSkewDeltaSignal } from '@/hooks/useApiData';
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
  formatPct,
  formatSigned,
} from '@/core/signalHelpers';
import { spectrumIndicatorLeft } from '@/core/spectrumIndicator';
import AutoFitValue from '@/components/AutoFitValue';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

function interpretation(score: number | null, t: (key: string) => string): string {
  if (score == null) return t('noReading');
  if (score <= -60) return t('fearBid');
  if (score <= -25) return t('elevatedPutSkew');
  if (score >= 50) return t('callSkewBid');
  if (score >= 25) return t('callsRicher');
  return t('normalSkew');
}

export default function SkewDeltaPage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useSkewDeltaSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.skewDeltaMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const trend = toTrend(payload.direction);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const otmPutIv = getNumber(payload.otm_put_iv);
  const otmCallIv = getNumber(payload.otm_call_iv);
  const spread = getNumber(payload.spread);
  const deviation = getNumber(payload.deviation);
  const baseline = getNumber(asObject(payload.context_values)?.baseline);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const needlePct = score != null ? Math.max(0, Math.min(100, (score + 100) / 2)) : 50;

  return (
    <PageShell>
      <SignalPageTitle
        title="Skew Delta"
        subtitle={t('subtitle')}
        icon={Scale}
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
                <span className="flex items-center gap-2"><ShieldAlert size={14} /> {t('fearEuphoria')}</span>
                <span className="text-[10px] text-[var(--color-text-secondary)] font-mono">−100 to +100</span>
              </div>
              <div className="relative h-6 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, var(--color-bear-soft) 30%, var(--color-surface) 50%, var(--color-bull-soft) 70%, var(--color-bull) 100%)' }}>
                <div className="absolute top-0 h-6 w-1 bg-[var(--color-text-primary)]" style={{ left: spectrumIndicatorLeft(needlePct, 24, 4), transform: 'translateX(-50%)' }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] font-mono text-[var(--color-text-secondary)]">
                <span>{t('fearLabel')}</span>
                <span>{t('normalLabel')}</span>
                <span>{t('euphoriaLabel')}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">OTM put IV</div>
                <AutoFitValue className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--color-bear)' }}>
                  {formatPct(otmPutIv, 2, false)}
                </AutoFitValue>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{t('otmPutIvDesc')}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">OTM call IV</div>
                <AutoFitValue className="text-2xl sm:text-3xl font-black" style={{ color: 'var(--color-bull)' }}>
                  {formatPct(otmCallIv, 2, false)}
                </AutoFitValue>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{t('otmCallIvDesc')}</p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">Spread</div>
                <AutoFitValue className="text-2xl sm:text-3xl font-black">{formatSigned(spread, 4)}</AutoFitValue>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                  put_iv − call_iv. Baseline: <span className="font-mono">{formatSigned(baseline, 3)}</span>
                </p>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
                <div className="text-sm font-semibold mb-1">Deviation</div>
                <AutoFitValue className="text-2xl sm:text-3xl font-black" style={{ color: (deviation ?? 0) > 0 ? 'var(--color-bear)' : 'var(--color-bull)' }}>
                  {formatSigned(deviation, 4)}
                </AutoFitValue>
                <p className="mt-2 text-xs text-[var(--color-text-secondary)]">spread − baseline. Negated to drive score.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={<>{t('caveat')}</>}
      >
        <div><code>Spread = OTM Put IV − OTM Call IV</code></div>
        <div><code>Deviation = Spread − Baseline</code> (baseline default 0.02)</div>
        <div><code>Score = −clip(Deviation / Saturation, [−1, 1]) × 100</code> (saturation default 0.04).</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="skew_delta" symbol={symbol} title={t('eventTimeline')} />
    </PageShell>
  );
}
