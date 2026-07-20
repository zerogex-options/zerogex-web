'use client';

import PageShell from '@/components/layout/PageShell';
import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { usePositioningTrapSignal } from '@/hooks/useApiData';
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
  formatSigned,
  formatPct,
  formatPrice,
  formatGexCompact,
} from '@/core/signalHelpers';
import { spectrumIndicatorLeft } from '@/core/spectrumIndicator';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

function interpretation(score: number | null, t: (key: string) => string): string {
  if (score == null) return t('interpNoReading');
  if (score >= 50) return t('interpUpsideSqueeze');
  if (score >= 25) return t('interpSqueezeRisk');
  if (score <= -50) return t('interpDownsideFlush');
  if (score <= -25) return t('interpFlushRisk');
  return t('interpBalanced');
}

export default function PositioningTrapPage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = usePositioningTrapSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.positioningTrapMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const trend = toTrend(payload.direction);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const ctx = asObject(payload.context_values) ?? {};
  const smartImbalance = getNumber(payload.smart_imbalance);
  const momentum5bar = getNumber(payload.momentum_5bar);
  const putCallRatio = getNumber(ctx.put_call_ratio);
  const close = getNumber(ctx.close);
  const gammaFlip = getNumber(ctx.gamma_flip);
  const netGex = getNumber(ctx.net_gex);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const needlePct = score != null ? Math.max(0, Math.min(100, (score + 100) / 2)) : 50;

  // Derive decomposition factors from context (approximate visualization of the model inputs)
  const shortCrowding = putCallRatio != null ? Math.max(0, Math.min(1, (putCallRatio - 1.0) / 0.5)) : 0;
  const longCrowding = putCallRatio != null ? Math.max(0, Math.min(1, (1.0 - putCallRatio) / 0.5)) : 0;
  const putSkewFactor = smartImbalance != null && smartImbalance < 0 ? Math.abs(smartImbalance) : 0;
  const callSkewFactor = smartImbalance != null && smartImbalance > 0 ? smartImbalance : 0;
  const momFactor = momentum5bar != null ? Math.max(-1, Math.min(1, momentum5bar / 0.004)) : 0;
  const aboveFlip = close != null && gammaFlip != null ? (close > gammaFlip ? 1 : 0) : 0;
  const belowFlip = close != null && gammaFlip != null ? (close < gammaFlip ? 1 : 0) : 0;
  const shortGamma = netGex != null && netGex < 0 ? 1 : 0;

  return (
    <PageShell>
      <SignalPageTitle
        title={t('pageTitle')}
        subtitle={t('pageSubtitle')}
        icon={AlertTriangle}
        tooltip={t('pageTooltip')}
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <SignalScoreHero
              score={score}
              scoreLabel={t('scoreLabel')}
              trend={trend}
              interpretation={interpretation(score, t)}
              history={history}
            />
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="flex items-center justify-between text-sm font-semibold mb-3">
                <span>{t('trapMeterTitle')}</span>
                <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">−100 to +100</span>
              </div>
              <div className="relative h-6 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, var(--color-bear-soft) 30%, var(--color-surface) 50%, var(--color-bull-soft) 70%, var(--color-bull) 100%)' }}>
                <div className="absolute top-0 h-6 w-1 bg-[var(--color-text-primary)]" style={{ left: spectrumIndicatorLeft(needlePct, 24, 4), transform: 'translateX(-50%)' }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-[var(--color-text-secondary)]">
                <span>{t('flushRiskLabel')}</span>
                <span>{t('balancedLabel')}</span>
                <span>{t('squeezeRiskLabel')}</span>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-3">{t('decompositionTitle')}</div>
              <div className="grid grid-cols-1 gap-2">
                <FactorBar label={t('factorShortCrowding')} value={shortCrowding} tone="bull" />
                <FactorBar label={t('factorLongCrowding')} value={longCrowding} tone="bear" />
                <FactorBar label={t('factorPutSkew')} value={putSkewFactor} tone="bull" />
                <FactorBar label={t('factorCallSkew')} value={callSkewFactor} tone="bear" />
                <FactorBar label={t('factorMomentum')} value={momFactor} tone="signed" />
                <FactorBar label={t('factorAboveFlip')} value={aboveFlip} tone="bull" />
                <FactorBar label={t('factorBelowFlip')} value={belowFlip} tone="bear" />
                <FactorBar label={t('factorShortGamma')} value={shortGamma} tone="warning" />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-3 text-[var(--color-text-secondary)]">
              <div>
                <div className="uppercase tracking-wide">{t('statPcRatio')}</div>
                <div className="font-mono text-[var(--color-text-primary)] text-sm">{putCallRatio != null ? putCallRatio.toFixed(2) : '—'}</div>
              </div>
              <div>
                <div className="uppercase tracking-wide">{t('stat5barPct')}</div>
                <div className="font-mono text-[var(--color-text-primary)] text-sm">{formatPct(momentum5bar, 3)}</div>
              </div>
              <div>
                <div className="uppercase tracking-wide">{t('statCloseFlip')}</div>
                <div className="font-mono text-[var(--color-text-primary)] text-sm">
                  {formatPrice(close)} / {formatPrice(gammaFlip)}
                </div>
              </div>
              <div>
                <div className="uppercase tracking-wide">{t('statNetGex')}</div>
                <div className="font-mono text-[var(--color-text-primary)] text-sm">{formatGexCompact(netGex)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={
          <>
            {t('caveatDefLabel')} <code>(Smart Call Net − Smart Put Net) / (|Call Net| + |Put Net|)</code>{t('caveatAbstain')}
            {' '}{t('caveatSnapshotLabel')} <span className="font-mono">{formatSigned(smartImbalance, 3)}</span>.
          </>
        }
      >
        <div>{t('howBuiltPara')}</div>
        <div><code>Score = clip(Squeeze − Flush, [−1, 1]) × 100</code>.</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="positioning_trap" symbol={symbol} title={t('eventTimelineTitle')} />
    </PageShell>
  );
}

function FactorBar({ label, value, tone }: { label: string; value: number; tone: 'bull' | 'bear' | 'warning' | 'signed' }) {
  const abs = Math.max(0, Math.min(1, Math.abs(value)));
  const color =
    tone === 'bull' ? 'var(--color-bull)' :
    tone === 'bear' ? 'var(--color-bear)' :
    tone === 'warning' ? 'var(--color-warning)' :
    (value >= 0 ? 'var(--color-bull)' : 'var(--color-bear)');
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-mono">{formatSigned(value, 2)}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-border)]/40 overflow-hidden">
        <div className="h-full" style={{ width: `${abs * 100}%`, background: color }} />
      </div>
    </div>
  );
}
