'use client';

import PageShell from '@/components/layout/PageShell';
import { useMemo } from 'react';
import { ArrowRightLeft, Gauge, Rocket, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useSqueezeSetupSignal } from '@/hooks/useApiData';
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
  getBool,
  humanize,
  parseScoreHistory,
  toTrend,
  trendColor,
  formatSigned,
  formatGexCompact,
} from '@/core/signalHelpers';
import AutoFitValue from '@/components/AutoFitValue';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

function regimeLabel(t: ReturnType<typeof usePageT>, signal: string, score: number | null): string {
  if (score == null) return t('noReading');
  if (signal === 'bullish_squeeze') return t('bullishSqueezeTriggered');
  if (signal === 'bearish_squeeze') return t('bearishSqueezeTriggered');
  if (score >= 15) return t('buildingBullishPressure');
  if (score <= -15) return t('buildingBearishPressure');
  return t('noSqueezeEdge');
}

function vixTones(t: ReturnType<typeof usePageT>): Record<string, { label: string; color: string }> {
  return {
    dead: { label: t('vixDead'), color: 'var(--color-text-secondary)' },
    normal: { label: t('vixNormal'), color: 'var(--color-warning)' },
    elevated: { label: t('vixElevated'), color: 'var(--color-bear)' },
    panic: { label: t('vixPanic'), color: 'var(--color-bear)' },
    unknown: { label: t('vixUnknown'), color: 'var(--color-text-secondary)' },
  };
}

export default function SqueezeSetupPage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useSqueezeSetupSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.squeezeSetupMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const signal = String(payload.signal ?? 'none');
  const triggered = payload.triggered === true || (score != null && Math.abs(score) >= 25);
  const callFlowZ = getNumber(payload.call_flow_z);
  const putFlowZ = getNumber(payload.put_flow_z);
  const momentumZ = getNumber(payload.momentum_z);
  const callFlowDelta = getNumber(payload.call_flow_delta);
  const putFlowDelta = getNumber(payload.put_flow_delta);
  const vixRegime = String(payload.vix_regime ?? 'unknown').toLowerCase();
  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const ctx = useMemo(() => {
    const raw = asObject(payload.context_values) ?? {};
    return {
      netGex: getNumber(raw.net_gex),
      gammaFlip: getNumber(raw.gamma_flip),
      close: getNumber(raw.close),
      momentum5Bar: getNumber(raw.momentum_5bar),
      momentum10Bar: getNumber(raw.momentum_10bar),
      accelUp: getBool(raw.accel_up),
      accelDn: getBool(raw.accel_dn),
    };
  }, [payload]);

  const vixTonesMap = useMemo(() => vixTones(t), [t]);
  const vix = vixTonesMap[vixRegime] ?? vixTonesMap.unknown;

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <PageShell>
      <SignalPageTitle
        title={t('pageTitle')}
        subtitle={t('pageSubtitle')}
        icon={Zap}
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
              interpretation={regimeLabel(t, signal, score)}
              history={history}
              badges={
                <>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide" style={{ background: `${color}1f`, color }}>
                    {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
                    {humanize(signal) || t('none')}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--color-border)]" style={{ color: vix.color }}>
                    VIX {vix.label}
                  </span>
                </>
              }
            />
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FlowZCard label={t('callFlowZ')} value={callFlowZ} positiveColor="var(--color-bull)" hint={t('callFlowZHint')} />
            <FlowZCard label={t('putFlowZ')} value={putFlowZ} positiveColor="var(--color-bear)" hint={t('putFlowZHint')} />
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-1 flex items-center gap-2"><ArrowRightLeft size={14} /> {t('momentumZ')}</div>
              <AutoFitValue className="text-2xl sm:text-3xl font-black" style={{ color: momentumZ != null && momentumZ > 0.5 ? 'var(--color-bull)' : momentumZ != null && momentumZ < -0.5 ? 'var(--color-bear)' : 'var(--color-warning)' }}>
                {formatSigned(momentumZ, 2)}
              </AutoFitValue>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{t('momentumZHint')}</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-1 flex items-center gap-2"><Rocket size={14} /> {t('acceleration')}</div>
              <div className="flex items-center gap-2 mt-1">
                <AccelPill label={t('accelUp')} on={ctx.accelUp} color="var(--color-bull)" />
                <AccelPill label={t('accelDown')} on={ctx.accelDn} color="var(--color-bear)" />
              </div>
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">{t('accelerationHint')}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">{t('signalInputs')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> {t('state')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label={t('signal')} value={humanize(signal)} />
              <Row label={t('triggered')} value={triggered ? t('yes') : t('no')} />
              <Row label={t('vixRegime')} value={vix.label} />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><ArrowRightLeft size={16} /> {t('flowAndMomentum')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label={t('callFlowDelta')} value={formatSigned(callFlowDelta, 0)} />
              <Row label={t('putFlowDelta')} value={formatSigned(putFlowDelta, 0)} />
              <Row label={t('momentum5Bar')} value={formatSigned(ctx.momentum5Bar, 4)} />
              <Row label={t('momentum10Bar')} value={formatSigned(ctx.momentum10Bar, 4)} />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Rocket size={16} /> {t('gammaContext')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label={t('netGexChainWide')} value={formatGexCompact(ctx.netGex)} />
              <Row label={t('gammaFlip')} value={ctx.gammaFlip != null ? ctx.gammaFlip.toFixed(2) : t('dash')} />
              <Row label={t('close')} value={ctx.close != null ? ctx.close.toFixed(2) : t('dash')} />
              <Row label={t('aboveFlip')} value={ctx.close != null && ctx.gammaFlip != null ? (ctx.close > ctx.gammaFlip ? t('yes') : t('no')) : t('dash')} />
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">{t('interpretation')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bull)]"><TrendingUp size={16} /> {t('bullishSqueezeHeading')}</div>
            <p className="text-[var(--color-text-secondary)]">
              {t('bullishSqueezeBodyPre')} <code>net_gex &lt; 0</code>{t('bullishSqueezeBodyPost')}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bear)]"><TrendingDown size={16} /> {t('bearishSqueezeHeading')}</div>
            <p className="text-[var(--color-text-secondary)]">
              {t('bearishSqueezeBodyPre')} <code>net_gex &lt; 0</code>{t('bearishSqueezeBodyPost')}
            </p>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={<>{t('caveat')}</>}
      >
        <div>{t('howBuiltDirectionPre')} <code>|Call Flow Z|</code>{t('howBuiltDirectionMid')} <code>|Put Flow Z|</code>{t('howBuiltDirectionPost')}</div>
        <div><code>Conviction = clip(|Flow Z| × Momentum Align × Accel Boost × VIX Factor, [0, 1])</code>.</div>
        <div><code>Accel Boost = 1.2</code> {t('howBuiltAccelBoostPre')} <code>1.0</code>.</div>
        <div><code>Score = ±Conviction × 100</code> {t('howBuiltScorePre')}</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="squeeze_setup" symbol={symbol} title={t('eventTimeline')} />
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-mono text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function FlowZCard({ label, value, positiveColor, hint }: { label: string; value: number | null; positiveColor: string; hint: string }) {
  const magnitude = Math.min(100, Math.abs(value ?? 0) * 25);
  const isPositive = (value ?? 0) >= 0;
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
      <div className="text-sm font-semibold mb-1">{label}</div>
      <AutoFitValue className="text-2xl sm:text-3xl font-black" style={{ color: value != null && Math.abs(value) > 0.5 ? positiveColor : 'var(--color-text-primary)' }}>
        {formatSigned(value, 2)}
      </AutoFitValue>
      <div className="relative mt-3 h-3 rounded-full bg-[var(--color-border)]/40 overflow-hidden">
        <div className="absolute top-0 bottom-0" style={{ left: '50%', width: 1, background: 'var(--color-text-secondary)', opacity: 0.5 }} />
        {value != null && (
          <div className="absolute top-0 bottom-0" style={{ background: positiveColor, opacity: 0.85, left: isPositive ? '50%' : `${50 - magnitude / 2}%`, width: `${magnitude / 2}%` }} />
        )}
      </div>
      <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{hint}</p>
    </div>
  );
}

function AccelPill({ label, on, color }: { label: string; on: boolean; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border" style={{ borderColor: on ? color : 'var(--color-border)', color: on ? color : 'var(--color-text-secondary)', background: on ? `${color}1a` : 'transparent' }}>
      {label} {on ? '✓' : '·'}
    </span>
  );
}
