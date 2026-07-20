'use client';

import PageShell from '@/components/layout/PageShell';
import { useMemo } from 'react';
import { Activity, Clock } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useVannaCharmFlowSignal } from '@/hooks/useApiData';
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
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

function interpretation(score: number | null, t: (key: string) => string): string {
  if (score == null) return t('interpNone');
  if (score >= 40) return t('interpVannaLift');
  if (score >= 20) return t('interpBullishHedging');
  if (score <= -40) return t('interpCharmFade');
  if (score <= -20) return t('interpBearishHedging');
  return t('interpNeutral');
}

export default function VannaCharmFlowPage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useVannaCharmFlowSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.vannaCharmFlowMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const trend = toTrend(payload.direction);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const vannaTotal = getNumber(payload.vanna_total);
  const charmTotal = getNumber(payload.charm_total);
  const charmAmp = getNumber(payload.charm_amplification) ?? 1.0;

  if (loading && !data) return <LoadingSpinner size="lg" />;

  // Position charm amplification in [1.0, 1.5] range → [0, 100]%
  const ampPct = Math.max(0, Math.min(100, ((charmAmp - 1.0) / 0.5) * 100));
  const charmWeighted = charmTotal != null ? charmTotal * charmAmp : null;

  // Normalize bar widths with a shared visual scale
  const vcMax = Math.max(Math.abs(vannaTotal ?? 0), Math.abs(charmWeighted ?? 0), 1);

  return (
    <PageShell>
      <SignalPageTitle
        title="Vanna/Charm Flow"
        subtitle={t('subtitle')}
        icon={Activity}
        tooltip={t('tooltip')}
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <SignalScoreHero
              score={score}
              trend={trend}
              interpretation={interpretation(score, t)}
              history={history}
            />

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold mb-2"><Clock size={14} /> {t('charmAmplification')}</div>
              <div className="text-2xl font-black">{charmAmp.toFixed(2)}×</div>
              <div className="mt-2 h-2 rounded-full bg-[var(--color-border)]/40 overflow-hidden">
                <div className="h-full" style={{ width: `${ampPct}%`, background: 'linear-gradient(90deg, var(--color-text-secondary), var(--color-warning))' }} />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-[var(--color-text-secondary)]">
                <span>1.0×</span>
                <span>1.5× (EOD)</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-3">{t('vannaTotal')}</div>
              <SignedBar value={vannaTotal} absMax={vcMax} />
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                {t('vannaTotalHelp')}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-3">{t('charmTotalTimesAmp')}</div>
              <SignedBar value={charmWeighted} absMax={vcMax} />
              <div className="mt-2 text-xs text-[var(--color-text-secondary)] flex items-center justify-between">
                <span>{t('rawCharm')} <span className="font-mono">{formatGexCompact(charmTotal)}</span></span>
                <span>{t('weighted')} <span className="font-mono">{formatGexCompact(charmWeighted)}</span></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={<>{t('caveatPre')} <code>Market Exposure Negated</code> {t('caveatMid')} <code>Dealer Exposure</code>{t('caveatEnd')}</>}
      >
        <div><code>Vanna Total = Σ Dealer Vanna Exposure</code>, <code>Charm Total = Σ Dealer Charm Exposure</code></div>
        <div><code>Amp = Charm Amplification(Session Time)</code> {t('ampFormulaSuffix')}</div>
        <div><code>Combined = Vanna Total + Charm Total × Amp</code>, <code>Score = clip(Combined / VC Norm, [−1, 1]) × 100</code>.</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="vanna_charm_flow" symbol={symbol} title={t('eventTimeline')} />
    </PageShell>
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
