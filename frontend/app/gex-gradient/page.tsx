'use client';

import PageShell from '@/components/layout/PageShell';
import { useMemo } from 'react';
import { ScatterChart } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useGexGradientSignal } from '@/hooks/useApiData';
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
  formatPct,
} from '@/core/signalHelpers';
import { spectrumIndicatorLeft } from '@/core/spectrumIndicator';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

function interpretation(score: number | null, netGex: number | null, t: (key: string) => string): string {
  if (score == null) return t('noReading');
  const shortGamma = netGex != null && netGex < 0;
  if (score >= 50) return shortGamma ? t('interpShortUpside') : t('interpStructResistance');
  if (score <= -50) return shortGamma ? t('interpShortDownside') : t('interpStructSupport');
  if (Math.abs(score) >= 25) return t('interpModerate');
  return t('interpBalanced');
}

export default function GexGradientPage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useGexGradientSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.gexGradientMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const trend = toTrend(payload.direction);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const ctx = asObject(payload.context_values) ?? {};
  const above = getNumber(payload.above_spot_gamma_abs) ?? 0;
  const below = getNumber(payload.below_spot_gamma_abs) ?? 0;
  const atm = getNumber(ctx.atm_gamma_abs) ?? 0;
  const wing = getNumber(ctx.wing_gamma_abs) ?? 0;
  const asymmetry = getNumber(payload.asymmetry);
  const wingFraction = getNumber(payload.wing_fraction);
  const strikeCount = getNumber(ctx.strike_count);
  const netGex = getNumber(ctx.net_gex);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const barMax = Math.max(above, below, 1);
  const atmWingTotal = Math.max(atm + wing, 1);
  const atmShare = (atm / atmWingTotal) * 100;
  const wingShare = 100 - atmShare;
  const asymmetryNeedlePct = asymmetry != null ? Math.max(0, Math.min(100, (asymmetry + 1) * 50)) : 50;

  return (
    <PageShell>
      <SignalPageTitle
        title={t('title')}
        subtitle={t('subtitle')}
        icon={ScatterChart}
        tooltip={t('tooltip')}
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <SignalScoreHero
              score={score}
              trend={trend}
              interpretation={interpretation(score, netGex, t)}
              history={history}
              badges={
                <>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[11px]">
                    {t('regimeLabel')} <span className="font-mono" style={{ color: (netGex ?? 0) < 0 ? 'var(--color-bear)' : 'var(--color-bull)' }}>
                      {netGex != null ? (netGex < 0 ? t('shortGamma') : t('longGamma')) : '—'}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[11px]">
                    {t('strikesLabel')} <span className="font-mono">{strikeCount != null ? Math.floor(strikeCount) : '—'}</span>
                  </span>
                </>
              }
            />
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-3">{t('strikeZoneMap')}</div>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[var(--color-text-secondary)]">{t('aboveSpot')}</span>
                    <span className="font-mono">{formatGexCompact(above)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-[var(--color-border)]/30 overflow-hidden">
                    <div className="h-full" style={{ width: `${(above / barMax) * 100}%`, background: 'var(--color-bull)' }} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[var(--color-text-secondary)]">{t('belowSpot')}</span>
                    <span className="font-mono">{formatGexCompact(below)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-[var(--color-border)]/30 overflow-hidden">
                    <div className="h-full" style={{ width: `${(below / barMax) * 100}%`, background: 'var(--color-bear)' }} />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[var(--color-border)]">
                <div className="text-[11px] text-[var(--color-text-secondary)] mb-2 uppercase tracking-wide">{t('asymmetryLabel')}</div>
                <div className="relative h-4 rounded-full" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, var(--color-surface) 50%, var(--color-bull) 100%)' }}>
                  <div className="absolute top-0 h-4 w-0.5 bg-[var(--color-text-primary)]" style={{ left: spectrumIndicatorLeft(asymmetryNeedlePct, 16, 2), transform: 'translateX(-50%)' }} />
                </div>
                <div className="mt-1 flex justify-between text-[10px] font-mono text-[var(--color-text-secondary)]">
                  <span>−1</span>
                  <span>{asymmetry != null ? formatSigned(asymmetry, 3) : '—'}</span>
                  <span>+1</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
                <div className="text-sm font-semibold mb-2">{t('atmVsWings')}</div>
                <div className="flex h-4 rounded-full overflow-hidden">
                  <div style={{ width: `${atmShare}%`, background: 'var(--color-warning)' }} />
                  <div style={{ width: `${wingShare}%`, background: 'var(--color-text-secondary)' }} />
                </div>
                <div className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
                  {t('atmLabel')} <span className="font-mono">{formatGexCompact(atm)}</span> · {t('wingsLabel')} <span className="font-mono">{formatGexCompact(wing)}</span>
                </div>
              </div>
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
                <div className="text-sm font-semibold mb-2">{t('wingFractionLabel')}</div>
                <div className="text-2xl font-black" style={{ color: (wingFraction ?? 0) > 0.5 ? 'var(--color-warning)' : 'var(--color-text-primary)' }}>
                  {formatPct(wingFraction, 1, false)}
                </div>
                <p className="mt-1 text-[11px] text-[var(--color-text-secondary)]">
                  {t('wingFractionHelp')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt>
        <div><code>Asymmetry = (Above Abs − Below Abs) / (Above Abs + Below Abs)</code>.</div>
        <div>{t('howBuiltShortRegime')} <code>Raw = Asymmetry</code>. {t('howBuiltLongRegime')} <code>Raw = −Asymmetry × Damping</code> (damping 0.40).</div>
        <div><code>Confidence = max(0.25, 1 − Wing Fraction)</code>. {t('howBuiltWingsPin')}</div>
        <div><code>Score = clip(Raw × Confidence, [−1, 1]) × 100</code>. {t('howBuiltAbstain')}</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="gex_gradient" symbol={symbol} title={t('eventTimeline')} />
    </PageShell>
  );
}
