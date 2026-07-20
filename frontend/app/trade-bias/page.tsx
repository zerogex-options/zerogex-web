'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Compass,
  Info,
  LineChart as LineChartIcon,
  ListChecks,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import PageShell from '@/components/layout/PageShell';
import TooltipWrapper from '@/components/TooltipWrapper';
import SignalsGuide from '@/components/SignalsGuide';
import { useTimeframe } from '@/core/TimeframeContext';
import { getMarketSession } from '@/core/utils';
import { humanize, SignalTrend, trendColor } from '@/core/signalHelpers';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';
import BiasTape from './BiasTape';
import BiasSparkline from './BiasSparkline';
import { useTradeBiasData } from './useTradeBiasData';
import { BIAS_INPUT_KEYS, BIAS_INPUT_META, TACTICAL_PILLAR_META, TradeBiasPayload } from './data';

type ConnectionState = 'idle' | 'live' | 'stale' | 'disconnected';

const SESSION_KEY: Record<string, string> = {
  open: 'sessionOpen',
  'pre-market': 'sessionPreMarket',
  'after-hours': 'sessionAfterHours',
  closed: 'sessionClosed',
  'closed-weekend': 'sessionClosed',
  'closed-holiday': 'sessionClosed',
  halted: 'sessionHalted',
};

function LiveIndicator({
  connection,
  lastUpdatedAt,
}: {
  connection: ConnectionState;
  lastUpdatedAt: number | null;
}) {
  const t = usePageT(dict);
  const [now, setNow] = useState(() => Date.now());
  const [session, setSession] = useState(getMarketSession());

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      setSession(getMarketSession());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const ageSec = lastUpdatedAt != null ? Math.max(0, Math.floor((now - lastUpdatedAt) / 1000)) : null;
  let dotColor = 'var(--color-text-secondary)';
  let statusText = t('connecting');
  let statusGlyph: '●' | '◐' | '○' = '○';
  if (connection === 'disconnected') {
    dotColor = 'var(--color-bear)';
    statusText = t('disconnectedRetrying');
  } else if (connection === 'stale') {
    dotColor = 'var(--color-warning)';
    statusText = ageSec != null ? t('staleAgo', { age: ageSec }) : t('stale');
    statusGlyph = '◐';
  } else if (connection === 'live') {
    dotColor = 'var(--color-bull)';
    statusText = ageSec != null ? t('liveAgo', { age: ageSec }) : t('live');
    statusGlyph = '●';
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      <span aria-hidden style={{ color: dotColor, fontSize: 14 }}>{statusGlyph}</span>
      <span className="font-mono" style={{ color: 'var(--color-text-secondary)', fontVariantNumeric: 'tabular-nums' }} aria-label={statusText}>
        {statusText}
      </span>
      <span className="hidden md:inline text-[var(--color-text-secondary)] opacity-60">·</span>
      <span className="hidden md:inline text-[var(--color-text-secondary)]">{t(SESSION_KEY[session] ?? 'sessionMarket')}</span>
    </div>
  );
}

function StateChip({ state, overrideActive }: { state: string; overrideActive: boolean }) {
  // Phase 1 always reports "baseline"; the graded states (confirmed / divergent /
  // override) light up once the fusion layer lands. Keep the vocabulary here so
  // the chip is ready when they do.
  const t = usePageT(dict);
  const map: Record<string, { label: string; color: string; soft: string }> = {
    override: { label: t('stateOverride'), color: 'var(--color-info)', soft: 'var(--color-info-soft)' },
    confirmed: { label: t('stateConfirmed'), color: 'var(--color-bull)', soft: 'var(--color-bull-soft, transparent)' },
    divergent: { label: t('stateDivergent'), color: 'var(--color-warning)', soft: 'var(--color-warning-soft)' },
    baseline: { label: t('stateBaseline'), color: 'var(--color-text-secondary)', soft: 'var(--color-surface-subtle)' },
  };
  const s = overrideActive ? map.override : (map[state] ?? map.baseline);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
      style={{ borderColor: s.color, background: s.soft, color: s.color }}
    >
      {s.label}
    </span>
  );
}

function Card({
  title,
  icon: Icon,
  color,
  tooltip,
  children,
}: {
  title: string;
  icon: typeof Compass;
  color: string;
  tooltip?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="zg-feature-shell p-5 flex flex-col gap-3" style={{ borderColor: color }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <Icon size={15} />
          </span>
          <div className="text-sm font-semibold">{title}</div>
        </div>
        {tooltip ? <TooltipWrapper text={tooltip} /> : null}
      </div>
      {children}
    </div>
  );
}

function InputBar({ value }: { value: number | null }) {
  // value is on -100..+100; render a centered bar growing left (bear) or right (bull).
  const v = value == null ? null : Math.max(-100, Math.min(100, value));
  const trend: SignalTrend = v == null ? 'neutral' : v >= 25 ? 'bullish' : v <= -25 ? 'bearish' : 'neutral';
  const color = trendColor(trend);
  const widthPct = v == null ? 0 : Math.abs(v) / 2; // half-scale => max 50%
  return (
    <div className="relative h-2 rounded-full" style={{ background: 'var(--color-surface-subtle)' }}>
      <div className="absolute top-0 bottom-0" style={{ left: '50%', width: 1, background: 'var(--color-border)' }} />
      {v != null && (
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            background: color,
            width: `${widthPct}%`,
            left: v >= 0 ? '50%' : undefined,
            right: v < 0 ? '50%' : undefined,
            transition: 'width 300ms',
          }}
        />
      )}
    </div>
  );
}

function InputsBreakdown({ payload }: { payload: TradeBiasPayload }) {
  const t = usePageT(dict);
  const structural = BIAS_INPUT_KEYS.filter((k) => BIAS_INPUT_META[k].layer === 'structural');
  const tactical = BIAS_INPUT_KEYS.filter((k) => BIAS_INPUT_META[k].layer === 'tactical');

  const Row = ({ k }: { k: (typeof BIAS_INPUT_KEYS)[number] }) => {
    const meta = BIAS_INPUT_META[k];
    const value = payload.inputs[k];
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_120px_46px] items-center gap-3 py-1.5">
        <div className="min-w-0 flex items-center gap-1.5">
          <span className="text-[13px] font-medium truncate">{meta.label}</span>
          <TooltipWrapper text={meta.description} />
        </div>
        <InputBar value={value} />
        <span className="text-[12px] font-mono text-right" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>
          {value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(0)}`}
        </span>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-1">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] mb-1.5">
          {t('structuralBaseline')}
        </div>
        {structural.map((k) => <Row key={k} k={k} />)}
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)] mb-1.5">
          {t('tacticalLiveRead')}
        </div>
        {tactical.map((k) => <Row key={k} k={k} />)}
      </div>
    </div>
  );
}

const STATE_DESC_KEY: Record<string, string> = {
  confirmed: 'liveReadDescConfirmed',
  divergent: 'liveReadDescDivergent',
  override: 'liveReadDescOverride',
  baseline: 'liveReadDescBaseline',
};

function TacticalPanel({ payload }: { payload: TradeBiasPayload }) {
  const t = usePageT(dict);
  const tac = payload.tactical;
  const dirTrend: SignalTrend =
    tac.direction == null ? 'neutral' : tac.direction > 0.15 ? 'bullish' : tac.direction < -0.15 ? 'bearish' : 'neutral';
  const dirColor = trendColor(dirTrend);
  const dirLabel = dirTrend === 'bullish' ? t('dirLong') : dirTrend === 'bearish' ? t('dirShort') : t('dirNeutral');
  const convPct = tac.conviction != null ? Math.round(tac.conviction * 100) : null;
  const descKey = STATE_DESC_KEY[payload.state] ?? 'liveReadDescBaseline';

  return (
    <section className="zg-feature-shell mt-8 p-6">
      <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
        <Zap size={20} />
        {t('liveReadHeading')}
        <TooltipWrapper text={t('liveReadTooltip')} placement="bottom">
          <Info size={14} className="text-[var(--color-text-secondary)] cursor-help" />
        </TooltipWrapper>
      </h2>
      <p className="text-xs text-[var(--color-text-secondary)] mb-4">
        {t(descKey, { structural: payload.structuralBiasLabel ?? 'structural' })}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1">
        {TACTICAL_PILLAR_META.map((p) => {
          const v = payload.tactical.pillars[p.key];
          return (
            <div key={p.key} className="grid grid-cols-[minmax(0,1fr)_120px_46px] items-center gap-3 py-1.5">
              <div className="min-w-0 flex items-center gap-1.5">
                <span className="text-[13px] font-medium truncate">{p.label}</span>
                <TooltipWrapper text={p.description} />
              </div>
              <InputBar value={v == null ? null : v * 100} />
              <span className="text-[12px] font-mono text-right" style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-secondary)' }}>
                {v == null ? '—' : `${v >= 0 ? '+' : ''}${(v * 100).toFixed(0)}`}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs border-t pt-3" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-[var(--color-text-secondary)]">
          {t('tacticalDirectionLabel')} <span className="font-semibold" style={{ color: dirColor }}>{dirLabel}</span>
        </span>
        <span className="text-[var(--color-text-secondary)]">
          {t('convictionLabel')} <span className="font-semibold font-mono text-[var(--color-text-primary)]">{convPct == null ? '—' : `${convPct}%`}</span>
        </span>
        <span className="text-[var(--color-text-secondary)]">
          <span className="font-semibold font-mono text-[var(--color-text-primary)]">{tac.alignedCount ?? '—'}/{tac.availableCount ?? '—'}</span> {t('pillarsAligned')}
        </span>
        <span className="flex items-center gap-1.5 text-[var(--color-text-secondary)]">
          {t('resolvedAsPrefix')} <StateChip state={payload.state} overrideActive={payload.overrideActive} />
        </span>
      </div>
    </section>
  );
}

export default function TradeBiasPage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const [tenor, setTenor] = useState('swing');
  const { payload, history, lastUpdatedAt, connection, loading, historyLoaded, noData, refetch } =
    useTradeBiasData(symbol, tenor);

  const trend: SignalTrend = payload?.direction ?? 'neutral';
  const color = trendColor(trend);
  const biasIcon = trend === 'bullish' ? TrendingUp : trend === 'bearish' ? TrendingDown : AlertTriangle;
  const confidence = payload?.confidence ?? null;
  const isIntraday = tenor === 'intraday';
  const tenorOptions = [
    { value: 'swing', label: t('tenorSwing') },
    { value: 'intraday', label: t('tenorIntraday') },
  ];

  return (
    <PageShell>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">{t('pageTitle')}</h1>
        <TooltipWrapper text={t('titleTooltip')} placement="bottom">
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
        <div className="ml-auto flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
            <span className="hidden sm:inline">{t('horizonLabel')}</span>
            <select
              value={tenor}
              onChange={(e) => setTenor(e.target.value)}
              className="rounded-md border bg-transparent px-2 py-1 text-xs font-medium text-[var(--color-text-primary)]"
              style={{ borderColor: 'var(--color-border)' }}
              aria-label={t('horizonAriaLabel')}
            >
              {tenorOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <TooltipWrapper text={t('tenorTooltip')} />
          </label>
          <LiveIndicator connection={connection} lastUpdatedAt={lastUpdatedAt} />
        </div>
      </div>

      {connection === 'disconnected' && (
        <div
          className="mb-3 rounded-md border px-3 py-2 text-xs"
          style={{ borderColor: 'var(--color-warning)', background: 'var(--color-warning-soft)', color: 'var(--color-text-primary)' }}
          role="status"
        >
          {t('reconnecting')}{' '}
          <button onClick={refetch} className="underline ml-1">{t('retryNow')}</button>
        </div>
      )}

      <SignalsGuide current="trade-bias" />

      {/* Hero: the signed bias tape + headline read */}
      <section className="zg-feature-shell p-6">
        {loading && payload == null && !noData ? (
          <div className="animate-pulse h-40 rounded-lg" style={{ background: 'var(--color-surface-subtle)' }} />
        ) : noData ? (
          <div className="rounded-xl border p-12 text-center" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-subtle)' }}>
            <div className="text-lg font-semibold mb-1">
              {isIntraday ? t('noDataTitleIntraday', { symbol }) : t('noDataTitleSwing', { symbol })}
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">
              {isIntraday ? t('noDataDescIntraday') : t('noDataDescSwing')}
            </div>
          </div>
        ) : payload ? (
          <div className="flex flex-col gap-5" style={{ opacity: connection === 'disconnected' ? 0.6 : 1, transition: 'opacity 200ms' }}>
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-6 items-center">
              <div className="min-w-0 flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold" style={{ borderColor: color, color }}>
                    {(() => { const I = biasIcon; return <I size={15} />; })()}
                    {payload.biasLabel}
                  </span>
                  <StateChip state={payload.state} overrideActive={payload.overrideActive} />
                  {payload.convictionDriven && (
                    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ borderColor: color, color }} title={t('convictionBadgeTooltip')}>
                      <Zap size={11} /> {t('convictionBadge')}
                    </span>
                  )}
                </div>
                <BiasTape biasScore={payload.biasScore} trend={trend} />
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{t('directionLabel')}</span>
                    <span className="text-sm font-semibold" style={{ color }}>{humanize(payload.directionRaw) || t('dirNeutral')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{t('gammaLabel')}</span>
                    <span className="text-sm font-mono">{payload.gammaRegime ?? '—'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)]">{t('volatilityLabel')}</span>
                    <span className="text-sm font-mono">{payload.volatilityRegime ?? '—'}</span>
                  </div>
                </div>
              </div>
              <div className="text-center lg:text-right">
                <div className="text-5xl font-black leading-none" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
                  {confidence == null ? '—' : Math.round(confidence)}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] mt-1">{t('confidenceLabel')}</div>
                <div className="mt-2 h-1.5 w-32 mx-auto lg:ml-auto lg:mr-0 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${confidence ?? 0}%`, background: color }} />
                </div>
              </div>
            </div>

            {payload.overrideActive && (
              <div className="rounded-lg border-l-4 px-4 py-3" style={{ borderLeftColor: 'var(--color-info)', background: 'var(--color-info-soft)' }}>
                <div className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--color-info)' }}>
                  <Zap size={14} /> {t('overrideActiveLabel')}
                </div>
                <p className="text-xs text-[var(--color-text-primary)] mt-1">
                  {payload.overrideReason ?? t('overrideReasonDefault')}
                  {payload.overruledPosture ? t('overruledSuffix', { posture: payload.overruledPosture }) : ''}
                </p>
              </div>
            )}
          </div>
        ) : null}
      </section>

      {/* Live read — the tactical layer that confirms / diverges / overrides */}
      {payload && !noData && <TacticalPanel payload={payload} />}

      {/* Regime / Bias / Playbook — the read, its behavior, and the plan */}
      {payload && !noData && (
        <section className="mt-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Card title={t('regimeTitle')} icon={Compass} color={color}>
            <div className="text-2xl font-black leading-tight break-words" style={{ color }}>{payload.regimeLabel}</div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{payload.regimeDesc}</p>
            <div className="mt-auto grid grid-cols-1 gap-1.5 text-xs">
              {payload.checklist.map((row) => (
                <div key={row.label} className="flex items-center justify-between border-b border-[var(--color-border)]/40 pb-1">
                  <span className="text-[var(--color-text-secondary)]">{row.label}</span>
                  <span className="font-mono" style={{ color: row.passed ? 'var(--color-bull)' : 'var(--color-text-secondary)' }}>
                    {row.passed ? '✓' : '—'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card title={t('biasTitle')} icon={biasIcon} color={color}>
            <div className="text-3xl font-black leading-none break-words" style={{ color }}>{payload.biasLabel}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide">{humanize(payload.biasCode)}</div>
            {payload.watching.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {payload.watching.map((w) => {
                  const wc = w.direction === 'bullish' ? 'var(--color-bull)' : 'var(--color-bear)';
                  return (
                    <span key={w.key} className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border" style={{ borderColor: wc, color: wc }}>
                      {t('watchingLabel', { label: w.label })} {w.direction === 'bullish' ? '↑' : '↓'}
                    </span>
                  );
                })}
              </div>
            )}
            <div className="mt-auto">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-1.5">{t('expectedBehaviorLabel')}</div>
              <ul className="flex flex-col gap-1 text-xs">
                {payload.expectedBehavior.map((line, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="leading-snug">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card title={t('playbookTitle')} icon={ListChecks} color={color}>
            <div className="text-2xl font-black leading-tight break-words" style={{ color }}>{payload.setup}</div>
            <div className="text-[11px] text-[var(--color-text-secondary)] uppercase tracking-wide">{t('setupLabel')}</div>
            <ol className="mt-1 flex flex-col gap-1.5 text-xs">
              {payload.playbook.map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0" style={{ background: `${color}1f`, color }}>
                    {i + 1}
                  </span>
                  <span className="leading-snug pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      )}

      {/* Inputs breakdown */}
      {payload && !noData && (
        <section className="zg-feature-shell mt-8 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity size={20} />
            {t('drivingItHeading')}
            <TooltipWrapper text={t('inputsTooltip')} placement="bottom">
              <Info size={14} className="text-[var(--color-text-secondary)] cursor-help" />
            </TooltipWrapper>
          </h2>
          <InputsBreakdown payload={payload} />
        </section>
      )}

      {/* Intraday trend */}
      {payload && !noData && (
        <section className="zg-feature-shell mt-8 p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <LineChartIcon size={20} />
            {t('intradayBiasHeading')}
          </h2>
          {!historyLoaded ? (
            <div className="animate-pulse h-40 rounded-lg" style={{ background: 'var(--color-surface-subtle)' }} />
          ) : (
            <BiasSparkline history={history} />
          )}
        </section>
      )}
    </PageShell>
  );
}
