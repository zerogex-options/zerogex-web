'use client';

import PageShell from '@/components/layout/PageShell';
import { useMemo } from 'react';
import { AlertTriangle, Gauge, Radar, TrendingDown, TrendingUp } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';
import { useTrapDetectionSignal } from '@/hooks/useApiData';
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
  formatPct,
  formatPrice,
  formatGexCompact,
} from '@/core/signalHelpers';

function setupLabel(signal: string, score: number | null, t: (key: string) => string): string {
  if (score == null) return t('noReading');
  if (signal === 'bearish_fade') return t('bearishFadeSignal');
  if (signal === 'bullish_fade') return t('bullishFadeSignal');
  if (score <= -25) return t('bearishFadeRisk');
  if (score >= 25) return t('bullishFadeRisk');
  return t('noTrapEdge');
}

export default function TrapDetectionPage() {
  const t = usePageT(dict);
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useTrapDetectionSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.trapDetectionMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const signal = String(payload.signal ?? 'none');
  const triggered = payload.triggered === true || (score != null && Math.abs(score) >= 25);
  const breakoutUp = getBool(payload.breakout_up);
  const breakoutDown = getBool(payload.breakout_down);
  const netGexDelta = getNumber(payload.net_gex_delta);
  const netGexDeltaPct = getNumber(payload.net_gex_delta_pct);
  const priorResistance = getNumber(payload.broken_resistance_level) ?? getNumber(payload.resistance_level);
  const priorSupport = getNumber(payload.broken_support_level) ?? getNumber(payload.support_level);
  const bufferPct = getNumber(payload.breakout_buffer_pct);
  const callWallMigratedUp = getBool(payload.call_wall_migrated_up);
  const putWallMigratedDown = getBool(payload.put_wall_migrated_down);

  const ctx = useMemo(() => {
    const raw = asObject(payload.context_values) ?? {};
    return {
      close: getNumber(raw.close),
      netGex: getNumber(raw.net_gex),
      realizedSigma: getNumber(raw.realized_sigma),
      longGamma: getBool(raw.long_gamma),
      gammaStrengthening: getBool(raw.gamma_strengthening),
      callWall: getNumber(raw.call_wall),
      priorCallWall: getNumber(raw.prior_call_wall),
      putWall: getNumber(raw.put_wall),
      priorPutWall: getNumber(raw.prior_put_wall),
      callFlowDecelerating: getBool(raw.call_flow_decelerating),
      putFlowDecelerating: getBool(raw.put_flow_decelerating),
    };
  }, [payload]);

  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const ladderRange = useMemo(() => {
    const vals = [priorResistance, priorSupport, ctx.close].filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (min === max) return { min: min - 1, max: max + 1 };
    const pad = (max - min) * 0.2;
    return { min: min - pad, max: max + pad };
  }, [priorResistance, priorSupport, ctx.close]);

  if (loading && !data) return <LoadingSpinner size="lg" />;

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
              interpretation={setupLabel(signal, score, t)}
              history={history}
              badges={
                <>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide" style={{ background: `${color}1f`, color }}>
                    {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
                    {humanize(signal) || t('noneFallback')}
                  </span>
                  {triggered && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'var(--color-bear-soft)', color: 'var(--color-bear)' }}>
                      <AlertTriangle size={12} /> {t('trapBadge')}
                    </span>
                  )}
                </>
              }
            />
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
            <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Radar size={14} /> {t('priceLadderHeading')}</div>
            {ladderRange && ctx.close != null ? (
              <PriceLadder
                min={ladderRange.min}
                max={ladderRange.max}
                spot={ctx.close}
                priorResistance={priorResistance}
                priorSupport={priorSupport}
                bufferPct={bufferPct}
                breakoutUp={breakoutUp}
                breakoutDown={breakoutDown}
              />
            ) : (
              <div className="text-sm text-[var(--color-text-secondary)]">{t('priceLevelsUnavailable')}</div>
            )}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Chip
                label={t('chipGammaStrengthening')}
                on={ctx.gammaStrengthening}
                color="var(--color-bull)"
                tooltip={t('chipGammaStrengtheningTooltip')}
              />
              <Chip
                label={t('chipCallWallUp')}
                on={callWallMigratedUp}
                color="var(--color-bear)"
                tooltip={t('chipCallWallUpTooltip')}
              />
              <Chip
                label={t('chipPutWallDown')}
                on={putWallMigratedDown}
                color="var(--color-bear)"
                tooltip={t('chipPutWallDownTooltip')}
              />
              <Chip
                label={t('chipLongGamma')}
                on={ctx.longGamma}
                color="var(--color-bull)"
                tooltip={t('chipLongGammaTooltip')}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">{t('breakoutGammaContextHeading')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Radar size={16} /> {t('structureHeading')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label={t('rowSpot')} value={formatPrice(ctx.close)} />
              <Row label={t('rowPriorResistance')} value={formatPrice(priorResistance)} />
              <Row label={t('rowPriorSupport')} value={formatPrice(priorSupport)} />
              <Row label={t('rowBufferPct')} value={formatPct(bufferPct, 3, false)} />
              <Row label={t('rowRealizedSigma')} value={ctx.realizedSigma != null ? ctx.realizedSigma.toFixed(4) : '—'} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> {t('dealerHeading')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label={t('rowNetGex')} value={formatGexCompact(ctx.netGex)} />
              <Row label={t('rowNetGexDelta')} value={formatGexCompact(netGexDelta)} />
              <Row label={t('rowNetGexDeltaPct')} value={formatPct(netGexDeltaPct, 2)} />
              <Row label={t('rowCallWall')} value={formatPrice(ctx.callWall)} />
              <Row label={t('rowPriorCallWall')} value={formatPrice(ctx.priorCallWall)} />
              <Row label={t('rowPutWall')} value={formatPrice(ctx.putWall)} />
              <Row label={t('rowPriorPutWall')} value={formatPrice(ctx.priorPutWall)} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle size={16} /> {t('flowDecelHeading')}</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label={t('rowCallFlowDecel')} value={ctx.callFlowDecelerating ? t('yes') : t('no')} />
              <Row label={t('rowPutFlowDecel')} value={ctx.putFlowDecelerating ? t('yes') : t('no')} />
              <Row label={t('rowBreakoutUp')} value={breakoutUp ? t('yes') : t('no')} />
              <Row label={t('rowBreakoutDown')} value={breakoutDown ? t('yes') : t('no')} />
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">{t('interpretationHeading')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div
            className="rounded-xl border p-4 bg-[var(--color-surface-subtle)]"
            style={{ borderColor: signal === 'bearish_fade' ? 'var(--color-bear)' : 'var(--color-border)' }}
          >
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bear)]">
              <TrendingDown size={16} />
              <span>{t('bearishFadeLabel')}</span>
              {signal === 'bearish_fade' && (
                <span
                  className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--color-bear-soft)', color: 'var(--color-bear)' }}
                >
                  {t('activeBadge')}
                </span>
              )}
            </div>
            <p className="text-[var(--color-text-secondary)]">
              {t('bearishFadeParagraph')}
            </p>
          </div>
          <div
            className="rounded-xl border p-4 bg-[var(--color-surface-subtle)]"
            style={{ borderColor: signal === 'bullish_fade' ? 'var(--color-bull)' : 'var(--color-border)' }}
          >
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bull)]">
              <TrendingUp size={16} />
              <span>{t('bullishFadeLabel')}</span>
              {signal === 'bullish_fade' && (
                <span
                  className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--color-bull-soft)', color: 'var(--color-bull)' }}
                >
                  {t('activeBadge')}
                </span>
              )}
            </div>
            <p className="text-[var(--color-text-secondary)]">
              {t('bullishFadeParagraph')}
            </p>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={<>{t('howBuiltCaveat')}</>}
      >
        <div>{t('howBuiltDetects')}</div>
        <div>{t('howBuiltReq1')}<code>Net GEX &gt; 0</code>{t('howBuiltReq2')}<em>{t('howBuiltReqNot')}</em>{t('howBuiltReq3')}<code>call_wall_migrated_up</code>{t('howBuiltReq4')}<code>put_wall_migrated_down</code>{t('howBuiltReq5')}</div>
        <div>{t('howBuiltOptional')}</div>
        <div><code>Score = ±Confidence × 100</code>{t('howBuiltScoreDesc')}</div>
        <div><code>broken_resistance_level</code> / <code>broken_support_level</code> {t('howBuiltBrokenDesc')}</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="trap_detection" symbol={symbol} title="Event Timeline" />
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

function Chip({ label, on, color, tooltip }: { label: string; on: boolean; color: string; tooltip?: string }) {
  return (
    <span
      title={tooltip}
      className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border"
      style={{
        borderColor: on ? color : 'var(--color-border)',
        color: on ? color : 'var(--color-text-secondary)',
        background: on ? `${color}14` : 'transparent',
        cursor: tooltip ? 'help' : undefined,
      }}
    >
      {label}
    </span>
  );
}

interface PriceLadderProps {
  min: number;
  max: number;
  spot: number;
  priorResistance: number | null;
  priorSupport: number | null;
  bufferPct: number | null;
  breakoutUp: boolean;
  breakoutDown: boolean;
}

function PriceLadder({ min, max, spot, priorResistance, priorSupport, bufferPct, breakoutUp, breakoutDown }: PriceLadderProps) {
  const t = usePageT(dict);
  const height = 180;
  const range = max - min;
  const toY = (v: number) => height - ((v - min) / range) * height;

  const showResistance = priorResistance != null;
  const showSupport = priorSupport != null;
  const resistanceBuffer = bufferPct != null && priorResistance != null ? bufferPct * priorResistance : 0;
  const supportBuffer = bufferPct != null && priorSupport != null ? bufferPct * priorSupport : 0;
  const resistanceLineOpacity = breakoutUp ? 1 : 0.45;
  const supportLineOpacity = breakoutDown ? 1 : 0.45;
  const resistanceBandOpacity = breakoutUp ? 0.12 : 0.04;
  const supportBandOpacity = breakoutDown ? 0.12 : 0.04;

  type Rung =
    | { kind: 'resistance'; value: number }
    | { kind: 'spot'; value: number }
    | { kind: 'support'; value: number };

  const rungs: Rung[] = [{ kind: 'spot', value: spot }];
  if (showResistance) rungs.push({ kind: 'resistance', value: priorResistance! });
  if (showSupport) rungs.push({ kind: 'support', value: priorSupport! });
  rungs.sort((a, b) => b.value - a.value);

  return (
    <div className="relative flex items-start gap-4">
      <svg width="48" height={height} viewBox={`0 0 48 ${height}`}>
        <line x1={24} y1={0} x2={24} y2={height} stroke="var(--color-border)" strokeWidth={2} />
        {showResistance && (
          <g>
            <line x1={6} y1={toY(priorResistance!)} x2={42} y2={toY(priorResistance!)} stroke="var(--color-bull)" strokeWidth={2} strokeDasharray="4 3" opacity={resistanceLineOpacity} />
            {resistanceBuffer > 0 && (
              <rect x={6} y={toY(priorResistance! + resistanceBuffer)} width={36} height={toY(priorResistance!) - toY(priorResistance! + resistanceBuffer)} fill="var(--color-bull)" opacity={resistanceBandOpacity} />
            )}
          </g>
        )}
        {showSupport && (
          <g>
            <line x1={6} y1={toY(priorSupport!)} x2={42} y2={toY(priorSupport!)} stroke="var(--color-bear)" strokeWidth={2} strokeDasharray="4 3" opacity={supportLineOpacity} />
            {supportBuffer > 0 && (
              <rect x={6} y={toY(priorSupport!)} width={36} height={toY(priorSupport! - supportBuffer) - toY(priorSupport!)} fill="var(--color-bear)" opacity={supportBandOpacity} />
            )}
          </g>
        )}
        <circle cx={24} cy={toY(spot)} r={5} fill="var(--color-warning)" stroke="var(--color-surface)" strokeWidth={2} />
      </svg>
      <div className="flex flex-col gap-3 text-xs">
        {rungs.map((r) => {
          if (r.kind === 'resistance') {
            const hint = r.value < spot ? t('belowClose') : r.value > spot ? t('aboveClose') : t('atClose');
            return (
              <div key="resistance" className="flex items-baseline gap-3">
                <span className="text-[var(--color-bull)] font-semibold w-28">{t('rowPriorResistance')}</span>
                <span className="font-mono">{formatPrice(r.value)}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  <span className="text-[var(--color-bull)]">{t('brokenUp')}</span>
                  <span className="text-[var(--color-text-secondary)]"> · {hint}</span>
                </span>
                {breakoutUp && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--color-bull-soft)', color: 'var(--color-bull)' }}
                  >
                    {t('activeBadge')}
                  </span>
                )}
              </div>
            );
          }
          if (r.kind === 'support') {
            const hint = r.value < spot ? t('belowClose') : r.value > spot ? t('aboveClose') : t('atClose');
            return (
              <div key="support" className="flex items-baseline gap-3">
                <span className="text-[var(--color-bear)] font-semibold w-28">{t('rowPriorSupport')}</span>
                <span className="font-mono">{formatPrice(r.value)}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  <span className="text-[var(--color-bear)]">{t('brokenDown')}</span>
                  <span className="text-[var(--color-text-secondary)]"> · {hint}</span>
                </span>
                {breakoutDown && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--color-bear-soft)', color: 'var(--color-bear)' }}
                  >
                    {t('activeBadge')}
                  </span>
                )}
              </div>
            );
          }
          return (
            <div key="spot" className="flex items-baseline gap-3">
              <span className="text-[var(--color-warning)] font-semibold w-28">{t('rowSpot')}</span>
              <span className="font-mono">{formatPrice(r.value)}</span>
            </div>
          );
        })}
        <div className="text-[11px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)]/40 pt-2">
          {t('bufferBandFooter')}
        </div>
      </div>
    </div>
  );
}
