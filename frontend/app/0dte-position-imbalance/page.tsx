'use client';

import PageShell from '@/components/layout/PageShell';
import { useMemo } from 'react';
import { Activity, AlertCircle, Brain, Clock, Gauge } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';
import { useZeroDtePositionImbalanceSignal } from '@/hooks/useApiData';
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
  humanize,
  parseScoreHistory,
  toTrend,
  trendColor,
  formatSigned,
} from '@/core/signalHelpers';

function formatUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function label(signal: string, score: number | null, t: (key: string) => string): string {
  if (score == null) return t('noReading');
  if (signal === 'call_heavy') return t('callHeavyCrowding');
  if (signal === 'put_heavy') return t('putHeavyCrowding');
  if (score >= 25) return t('upsideTilt');
  if (score <= -25) return t('downsideTilt');
  return t('balancedPositioning');
}

export default function ZeroDtePositionImbalancePage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useZeroDtePositionImbalanceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.zeroDteImbalanceMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const signal = String(payload.signal ?? 'balanced');
  const triggered = payload.triggered === true || (score != null && Math.abs(score) >= 25);
  const flowImbalance = getNumber(payload.flow_imbalance);
  const smartImbalance = getNumber(payload.smart_imbalance);

  const ctx = useMemo(() => {
    const raw = asObject(payload.context_values) ?? {};
    return {
      callNetPremium: getNumber(raw.call_net_premium),
      putNetPremium: getNumber(raw.put_net_premium),
      otmCallNet: getNumber(raw.otm_call_net),
      atmCallNet: getNumber(raw.atm_call_net),
      otmPutNet: getNumber(raw.otm_put_net),
      atmPutNet: getNumber(raw.atm_put_net),
      putCallRatio: getNumber(raw.put_call_ratio),
      pcrTilt: getNumber(raw.pcr_tilt),
      todMultiplier: getNumber(raw.tod_multiplier),
      flowSource: String(raw.flow_source ?? '—'),
    };
  }, [payload]);

  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const inactive = ctx.todMultiplier != null && ctx.todMultiplier === 0;
  const isFallback = ctx.flowSource === 'all_expiry_fallback';

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <PageShell>
      <SignalPageTitle
        title={t('title')}
        subtitle={t('subtitle')}
        icon={Activity}
        tooltip={t('tooltip')}
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {inactive && (
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-sm flex items-start gap-3">
          <Clock size={16} className="text-[var(--color-warning)] mt-0.5" />
          <div>
            <div className="font-semibold">{t('inactiveTitle')}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {t('inactiveDesc')}
            </div>
          </div>
        </div>
      )}

      {isFallback && (
        <div className="mb-6 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4 text-sm flex items-start gap-3">
          <AlertCircle size={16} className="text-[var(--color-warning)] mt-0.5" />
          <div>
            <div className="font-semibold text-[var(--color-warning)]">{t('fallbackTitle')}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              {t('fallbackDesc')}
            </div>
          </div>
        </div>
      )}

      <section className="zg-feature-shell p-6" style={{ opacity: inactive ? 0.75 : 1 }}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <SignalScoreHero
              score={score}
              scoreLabel={t('scoreLabel')}
              trend={trend}
              interpretation={label(signal, score, t)}
              history={history}
              badges={
                <>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide" style={{ background: `${color}1f`, color }}>
                    {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
                    {humanize(signal)}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--color-border)]">
                    <Clock size={11} />
                    ToD <span className="font-mono ml-1">{ctx.todMultiplier != null ? ctx.todMultiplier.toFixed(2) : '—'}</span>
                  </span>
                </>
              }
            />
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
            <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity size={14} /> {t('moneynessBucketFlow')}</div>
            <MoneynessBars
              otmCall={ctx.otmCallNet}
              atmCall={ctx.atmCallNet}
              otmPut={ctx.otmPutNet}
              atmPut={ctx.atmPutNet}
              t={t}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="text-[var(--color-text-secondary)]">{t('flowImbalanceLabel')}</div>
                <div className="text-xl font-black" style={{ color: (flowImbalance ?? 0) > 0.1 ? 'var(--color-bull)' : (flowImbalance ?? 0) < -0.1 ? 'var(--color-bear)' : 'var(--color-text-primary)' }}>
                  {formatSigned(flowImbalance, 2)}
                </div>
                <div className="text-[10px] text-[var(--color-text-secondary)]">{t('flowImbalanceNote')}</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="text-[var(--color-text-secondary)]">{t('smartImbalanceLabel')}</div>
                <div className="text-xl font-black" style={{ color: (smartImbalance ?? 0) > 0.1 ? 'var(--color-bull)' : (smartImbalance ?? 0) < -0.1 ? 'var(--color-bear)' : 'var(--color-text-primary)' }}>
                  {formatSigned(smartImbalance, 2)}
                </div>
                <div className="text-[10px] text-[var(--color-text-secondary)]">{t('smartImbalanceNote')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">{t('crowdingInputs')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Activity size={16} /> {t('netPremium')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label={t('callNetPremium')} value={formatUsd(ctx.callNetPremium)} />
              <Row label={t('putNetPremium')} value={formatUsd(ctx.putNetPremium)} />
              <Row label={t('otmCallNet')} value={formatUsd(ctx.otmCallNet)} />
              <Row label={t('atmCallNet')} value={formatUsd(ctx.atmCallNet)} />
              <Row label={t('otmPutNet')} value={formatUsd(ctx.otmPutNet)} />
              <Row label={t('atmPutNet')} value={formatUsd(ctx.atmPutNet)} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Brain size={16} /> {t('imbalances')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label={t('flowImbalanceLabel')} value={formatSigned(flowImbalance, 3)} />
              <Row label={t('smartImbalanceLabel')} value={formatSigned(smartImbalance, 3)} />
              <Row label={t('pcrTilt')} value={formatSigned(ctx.pcrTilt, 3)} />
              <Row label={t('putCallRatio')} value={ctx.putCallRatio != null ? ctx.putCallRatio.toFixed(2) : '—'} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> {t('mechanics')}</div>
            <div className="text-[var(--color-text-secondary)] text-xs space-y-2">
              <div><strong className="text-[var(--color-text-primary)]">{t('blendLabel')}</strong> {t('blendText')}</div>
              <div><strong className="text-[var(--color-text-primary)]">{t('weightsLabel')}</strong> {t('weightsText')}</div>
            </div>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={<>{t('caveat')}</>}
      >
        <div>{t('howBuilt1a')} <code>0.6 × OTM + 0.3 × ATM + 0.1 × ITM</code> {t('howBuilt1b')}</div>
        <div><code>Flow Imbalance = (Weighted Call Net − Weighted Put Net) / (|...| + |...|)</code>{t('howBuilt2')}</div>
        <div><code>Blended = 0.55 × Flow + 0.30 × Smart + 0.15 × PCR Tilt</code>{t('howBuilt3')}</div>
        <div><code>Score = clip(Blended, [−1, 1]) × 100</code>. {t('howBuilt4')}</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="zero_dte_position_imbalance" symbol={symbol} title={t('eventTimeline')} />
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

function MoneynessBars({ otmCall, atmCall, otmPut, atmPut, t }: { otmCall: number | null; atmCall: number | null; otmPut: number | null; atmPut: number | null; t: (key: string) => string }) {
  const values = [otmCall, atmCall, atmPut, otmPut].filter((v): v is number => v != null);
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  const rows: Array<{ label: string; value: number | null; color: string; weight: string }> = [
    { label: t('otmCallShort'), value: otmCall, color: 'var(--color-bull)', weight: '0.6×' },
    { label: t('atmCallShort'), value: atmCall, color: 'var(--color-bull)', weight: '0.3×' },
    { label: t('atmPutShort'), value: atmPut, color: 'var(--color-bear)', weight: '0.3×' },
    { label: t('otmPutShort'), value: otmPut, color: 'var(--color-bear)', weight: '0.6×' },
  ];

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const v = row.value ?? 0;
        const pct = Math.min(50, (Math.abs(v) / maxAbs) * 50);
        const isPositive = v >= 0;
        return (
          <div key={row.label}>
            <div className="flex items-center justify-between text-[11px] text-[var(--color-text-secondary)] mb-0.5">
              <span>{row.label} <span className="text-[10px] opacity-70">{row.weight}</span></span>
              <span className="font-mono text-[var(--color-text-primary)]">{formatUsd(row.value)}</span>
            </div>
            <div className="relative h-3 rounded-md bg-[var(--color-border)]/40 overflow-hidden">
              <div className="absolute top-0 bottom-0" style={{ left: '50%', width: 1, background: 'var(--color-text-secondary)', opacity: 0.5 }} />
              <div
                className="absolute top-0 bottom-0"
                style={{ background: row.color, opacity: 0.85, left: isPositive ? '50%' : `${50 - pct}%`, width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
