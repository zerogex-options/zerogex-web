'use client';

import { useMemo } from 'react';
import { CalendarClock, Info, Pin, Timer, TrendingDown, TrendingUp, Gauge } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useEodPressureSignal } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';
import SignalSparkline from '@/components/SignalSparkline';
import SignalEventsPanel from '@/components/SignalEventsPanel';
import ExpandableCard from '@/components/ExpandableCard';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import {
  asObject,
  getNumber,
  getBool,
  parseScoreHistory,
  toTrend,
  trendColor,
  formatPct,
  formatPrice,
} from '@/core/signalHelpers';

function pressureLabel(score: number | null): string {
  if (score == null) return 'No reading';
  if (score >= 70) return 'Strong bullish close pressure';
  if (score >= 30) return 'Bullish close tilt';
  if (score <= -70) return 'Strong bearish close pressure';
  if (score <= -30) return 'Bearish close tilt';
  return 'Neutral close setup';
}

export default function EodPressurePage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = useEodPressureSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.eodPressureMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const charmAtSpot = getNumber(payload.charm_at_spot);
  const pinTarget = getNumber(payload.pin_target);
  const pinDistancePct = getNumber(payload.pin_distance_pct);
  const timeRamp = getNumber(payload.time_ramp) ?? 0;
  const gammaRegime = String(payload.gamma_regime ?? 'neutral').toLowerCase();
  const calendarFlags = asObject(payload.calendar_flags) ?? {};
  const isOpex = getBool(calendarFlags.opex);
  const isQuadWitching = getBool(calendarFlags.quad_witching);
  const ctx = asObject(payload.context_values) ?? {};
  const calendarAmp = getNumber(ctx.calendar_amp);
  const pinSource = String(ctx.pin_source ?? '—');
  const atmBandPct = getNumber(ctx.atm_band_pct);

  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const inactive = timeRamp === 0 && (score == null || score === 0);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">EOD Pressure</h1>
        <TooltipWrapper
          text="End-of-day close pin/drift forecast. Combines dealer charm at spot, gamma-gated pin gravity, a calendar amplifier, and a linear time ramp. Active only during the closing window (14:30–16:00 ET). The time ramp scales contribution from 0 at 14:30 toward 1.0 by 15:45 ET."
          placement="bottom"
        >
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {inactive && (
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-sm flex items-start gap-3">
          <Timer size={16} className="text-[var(--color-warning)] mt-0.5" />
          <div>
            <div className="font-semibold">Inactive — EOD window opens at 14:30 ET</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Score returns 0 outside the activation window; live fields will populate as the close approaches.
            </div>
          </div>
        </div>
      )}

      <section className="zg-feature-shell p-6" style={{ opacity: inactive ? 0.75 : 1 }}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">EOD Pressure Score</div>
            <div className="text-6xl font-black leading-none" style={{ color }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 text-lg font-semibold">{pressureLabel(score)}</div>
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              {isOpex && <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>OpEx</span>}
              {isQuadWitching && <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-bear-soft)', color: 'var(--color-bear)' }}>Quad Witching</span>}
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]">
                Amp <span className="font-mono ml-1">{calendarAmp != null ? `${calendarAmp.toFixed(2)}×` : '1.00×'}</span>
              </span>
            </div>
            <ExpandableCard
              className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3"
              expandTrigger="button"
              expandButtonLabel="Expand score history"
            >
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Score history</div>
              <SignalSparkline points={history} strokeColor={color} fillColor={`${color}1f`} height={56} />
            </ExpandableCard>
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold mb-1"><Timer size={14} /> Time ramp</div>
              <div className="text-3xl font-black">{timeRamp.toFixed(2)}</div>
              <div className="relative mt-3 h-3 rounded-full bg-[var(--color-border)]/40 overflow-hidden">
                <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, timeRamp * 100))}%`, background: 'linear-gradient(90deg, var(--color-text-secondary), var(--color-warning), var(--color-bull))' }} />
              </div>
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">Linear 0 → 1 from 14:30 to 15:45 ET.</p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold mb-1"><Pin size={14} /> Pin target</div>
              <div className="text-3xl font-black">{formatPrice(pinTarget)}</div>
              <div className="mt-2 text-xs text-[var(--color-text-secondary)]">
                Distance: <span className="font-mono text-[var(--color-text-primary)]">{formatPct(pinDistancePct, 3)}</span>
              </div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)] capitalize">Source: {pinSource}</div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold mb-1"><Gauge size={14} /> Charm @ spot</div>
              <div className="text-3xl font-black" style={{ color: charmAtSpot != null && charmAtSpot > 0 ? 'var(--color-bull)' : charmAtSpot != null && charmAtSpot < 0 ? 'var(--color-bear)' : 'var(--color-text-primary)' }}>
                {charmAtSpot != null ? `${charmAtSpot >= 0 ? '+' : ''}${(charmAtSpot / 1e6).toFixed(2)}M` : '—'}
              </div>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Signed dollar-delta of dealer charm within ATM band{atmBandPct ? ` (±${(atmBandPct * 100).toFixed(2)}%)` : ''}.</p>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="flex items-center gap-2 text-sm font-semibold mb-1"><CalendarClock size={14} /> Gamma regime</div>
              <div className="text-3xl font-black capitalize" style={{ color: gammaRegime === 'positive' ? 'var(--color-bull)' : gammaRegime === 'negative' ? 'var(--color-bear)' : 'var(--color-warning)' }}>{gammaRegime}</div>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Positive → dealers pull toward pin. Negative → dealers amplify moves away.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">How This Signal Works</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Info size={14} /> Charm at spot</div>
            <p className="text-[var(--color-text-secondary)] text-xs">
              <code>charm_score = tanh(charm_at_spot / 20M)</code> across an ATM band. Captures accelerating delta decay
              into the close.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Pin size={14} /> Pin gravity</div>
            <p className="text-[var(--color-text-secondary)] text-xs">
              <code>pin_gravity = sign(net_gex) × min(1.0, pin_distance_pct / 0.3%)</code>. Flips direction when dealers
              cross to short gamma.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><CalendarClock size={14} /> Time × calendar</div>
            <p className="text-[var(--color-text-secondary)] text-xs">
              <code>score = (0.6·charm + 0.4·pin) × calendar_amp × time_ramp</code>. OpEx 1.5×, quad-witching 2.0×.
            </p>
          </div>
        </div>
        <div className="mt-4 text-xs text-[var(--color-text-secondary)] flex items-center gap-2">
          <Timer size={14} /> Activation window: 14:30 ET → 16:00 ET. Ramp reaches 1.0 by ~15:45 ET.
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bull)]"><TrendingUp size={16} /> Bullish close</div>
            <p className="text-[var(--color-text-secondary)]">
              <code>time_ramp &gt; 0.5</code> and <code>score &gt; 50</code> → trade the drift toward <code>pin_target</code>.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bear)]"><TrendingDown size={16} /> Bearish close</div>
            <p className="text-[var(--color-text-secondary)]">
              Mirror setup. On quad-witching days, treat |score| &gt; 60 as high-conviction pin.
            </p>
          </div>
        </div>
      </section>

      <SignalEventsPanel signalName="eod_pressure" symbol={symbol} title="Event Timeline" />
    </div>
  );
}
