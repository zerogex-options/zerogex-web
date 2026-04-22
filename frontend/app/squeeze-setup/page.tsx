'use client';

import { useMemo } from 'react';
import { ArrowRightLeft, Gauge, Rocket, TrendingDown, TrendingUp } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useSqueezeSetupSignal } from '@/hooks/useApiData';
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
  formatSigned,
  formatGexCompact,
} from '@/core/signalHelpers';

function regimeLabel(signal: string, score: number | null): string {
  if (score == null) return 'No reading';
  if (signal === 'bullish_squeeze') return 'Bullish squeeze triggered';
  if (signal === 'bearish_squeeze') return 'Bearish squeeze triggered';
  if (score >= 15) return 'Building bullish pressure';
  if (score <= -15) return 'Building bearish pressure';
  return 'No squeeze edge';
}

const VIX_TONES: Record<string, { label: string; color: string }> = {
  dead: { label: 'Dead', color: 'var(--color-text-secondary)' },
  normal: { label: 'Normal', color: 'var(--color-warning)' },
  elevated: { label: 'Elevated', color: 'var(--color-bear)' },
  panic: { label: 'Panic', color: 'var(--color-bear)' },
  unknown: { label: 'Unknown', color: 'var(--color-text-secondary)' },
};

export default function SqueezeSetupPage() {
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

  const vix = VIX_TONES[vixRegime] ?? VIX_TONES.unknown;

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-3xl font-bold">Squeeze Setup</h1>
        <TooltipWrapper
          text="Standalone detector — not part of the MSI. Correlates directional flow z-scores with momentum acceleration and dealer-gamma posture. Triggers at |score| ≥ 25. Dead-VIX regimes attenuate conviction ~50%."
          placement="bottom"
        >
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Squeeze Score</div>
            <div className="text-6xl font-black leading-none" style={{ color }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide" style={{ background: `${color}1f`, color }}>
                {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
                {signal.replace(/_/g, ' ') || 'none'}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-[var(--color-border)]" style={{ color: vix.color }}>
                VIX {vix.label}
              </span>
            </div>
            <div className="mt-3 text-sm font-semibold">{regimeLabel(signal, score)}</div>
            <ExpandableCard
              className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3"
              expandTrigger="button"
              expandButtonLabel="Expand score history"
            >
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Score history</div>
              <SignalSparkline points={history} strokeColor={color} fillColor={`${color}1f`} height={56} min={-100} max={100} />
            </ExpandableCard>
          </div>

          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FlowZCard label="Call flow z" value={callFlowZ} positiveColor="var(--color-bull)" hint="Net call flow standardized over recent window." />
            <FlowZCard label="Put flow z" value={putFlowZ} positiveColor="var(--color-bear)" hint="Net put flow standardized over recent window." />
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-1 flex items-center gap-2"><ArrowRightLeft size={14} /> Momentum z</div>
              <div className="text-3xl font-black" style={{ color: momentumZ != null && momentumZ > 0.5 ? 'var(--color-bull)' : momentumZ != null && momentumZ < -0.5 ? 'var(--color-bear)' : 'var(--color-warning)' }}>
                {formatSigned(momentumZ, 2)}
              </div>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Price momentum z-score. Diverges from flow → early (no price) or exhausted (no flow).</p>
            </div>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-1 flex items-center gap-2"><Rocket size={14} /> Acceleration</div>
              <div className="flex items-center gap-2 mt-1">
                <AccelPill label="Up" on={ctx.accelUp} color="var(--color-bull)" />
                <AccelPill label="Down" on={ctx.accelDn} color="var(--color-bear)" />
              </div>
              <p className="mt-3 text-xs text-[var(--color-text-secondary)]">Applies a 1.2× boost when momentum is accelerating in the signal direction.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Signal Inputs</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> State</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Signal" value={signal.replace(/_/g, ' ')} />
              <Row label="Triggered" value={triggered ? 'Yes' : 'No'} />
              <Row label="VIX regime" value={vix.label} />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><ArrowRightLeft size={16} /> Flow &amp; momentum</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Call flow Δ" value={formatSigned(callFlowDelta, 0)} />
              <Row label="Put flow Δ" value={formatSigned(putFlowDelta, 0)} />
              <Row label="Momentum 5-bar" value={formatSigned(ctx.momentum5Bar, 4)} />
              <Row label="Momentum 10-bar" value={formatSigned(ctx.momentum10Bar, 4)} />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Rocket size={16} /> Gamma context</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Net GEX" value={formatGexCompact(ctx.netGex)} />
              <Row label="Gamma flip" value={ctx.gammaFlip != null ? ctx.gammaFlip.toFixed(2) : '—'} />
              <Row label="Close" value={ctx.close != null ? ctx.close.toFixed(2) : '—'} />
              <Row label="Above flip" value={ctx.close != null && ctx.gammaFlip != null ? (ctx.close > ctx.gammaFlip ? 'Yes' : 'No') : '—'} />
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Interpretation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bull)]"><TrendingUp size={16} /> Bullish squeeze</div>
            <p className="text-[var(--color-text-secondary)]">
              Price above gamma flip, <code>net_gex &lt; 0</code>, call flow z high, and accelerating up → classic
              short-gamma squeeze. Long call spreads typical.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bear)]"><TrendingDown size={16} /> Bearish squeeze</div>
            <p className="text-[var(--color-text-secondary)]">
              Mirror: price below flip, <code>net_gex &lt; 0</code>, rising put flow z, accelerating down.
            </p>
          </div>
        </div>
      </section>

      <SignalEventsPanel signalName="squeeze_setup" symbol={symbol} title="Event Timeline" />
    </div>
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
      <div className="text-3xl font-black" style={{ color: value != null && Math.abs(value) > 0.5 ? positiveColor : 'var(--color-text-primary)' }}>
        {formatSigned(value, 2)}
      </div>
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
