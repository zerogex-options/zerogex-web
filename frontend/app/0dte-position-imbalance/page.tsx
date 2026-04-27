'use client';

import { useMemo } from 'react';
import { Activity, AlertCircle, Brain, Clock, Gauge } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
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

function label(signal: string, score: number | null): string {
  if (score == null) return 'No reading';
  if (signal === 'call_heavy') return 'Call-heavy crowding';
  if (signal === 'put_heavy') return 'Put-heavy crowding';
  if (score >= 25) return 'Upside tilt building';
  if (score <= -25) return 'Downside tilt building';
  return 'Balanced same-day positioning';
}

export default function ZeroDtePositionImbalancePage() {
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
    <div className="container mx-auto px-4 py-8">
      <SignalPageTitle
        title="0DTE Position Imbalance"
        icon={Activity}
        tooltip="Same-day-expiry flow tilt weighted by moneyness. Score blends flow imbalance, smart-money subset, and PCR tilt, then scales by a time-of-day multiplier. Triggers at |score| ≥ 25. OTM flow is weighted heaviest (0.6×) since dealers hedging short OTM options drive the largest chase."
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      {inactive && (
        <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-sm flex items-start gap-3">
          <Clock size={16} className="text-[var(--color-warning)] mt-0.5" />
          <div>
            <div className="font-semibold">Inactive — 0DTE window closed</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              Time-of-day multiplier is zero after hours; score is gated to 0.
            </div>
          </div>
        </div>
      )}

      {isFallback && (
        <div className="mb-6 rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4 text-sm flex items-start gap-3">
          <AlertCircle size={16} className="text-[var(--color-warning)] mt-0.5" />
          <div>
            <div className="font-semibold text-[var(--color-warning)]">Flow source: all-expiry fallback</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
              0DTE flow is missing — the picture is inferred from all-expiry flow, not measured same-day.
            </div>
          </div>
        </div>
      )}

      <section className="zg-feature-shell p-6" style={{ opacity: inactive ? 0.75 : 1 }}>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <SignalScoreHero
              score={score}
              scoreLabel="Imbalance Score"
              trend={trend}
              interpretation={label(signal, score)}
              history={history}
              badges={
                <>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide" style={{ background: `${color}1f`, color }}>
                    {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
                    {signal.replace(/_/g, ' ')}
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
            <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Activity size={14} /> Moneyness bucket flow</div>
            <MoneynessBars
              otmCall={ctx.otmCallNet}
              atmCall={ctx.atmCallNet}
              otmPut={ctx.otmPutNet}
              atmPut={ctx.atmPutNet}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="text-[var(--color-text-secondary)]">Flow imbalance</div>
                <div className="text-xl font-black" style={{ color: (flowImbalance ?? 0) > 0.1 ? 'var(--color-bull)' : (flowImbalance ?? 0) < -0.1 ? 'var(--color-bear)' : 'var(--color-text-primary)' }}>
                  {formatSigned(flowImbalance, 2)}
                </div>
                <div className="text-[10px] text-[var(--color-text-secondary)]">Bucket-weighted, gated ≥ $50k gross.</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                <div className="text-[var(--color-text-secondary)]">Smart imbalance</div>
                <div className="text-xl font-black" style={{ color: (smartImbalance ?? 0) > 0.1 ? 'var(--color-bull)' : (smartImbalance ?? 0) < -0.1 ? 'var(--color-bear)' : 'var(--color-text-primary)' }}>
                  {formatSigned(smartImbalance, 2)}
                </div>
                <div className="text-[10px] text-[var(--color-text-secondary)]">Smart-money subset of the same buckets.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Crowding Inputs</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Activity size={16} /> Net premium</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Call net premium" value={formatUsd(ctx.callNetPremium)} />
              <Row label="Put net premium" value={formatUsd(ctx.putNetPremium)} />
              <Row label="OTM call net" value={formatUsd(ctx.otmCallNet)} />
              <Row label="ATM call net" value={formatUsd(ctx.atmCallNet)} />
              <Row label="OTM put net" value={formatUsd(ctx.otmPutNet)} />
              <Row label="ATM put net" value={formatUsd(ctx.atmPutNet)} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Brain size={16} /> Imbalances</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Flow imbalance" value={formatSigned(flowImbalance, 3)} />
              <Row label="Smart imbalance" value={formatSigned(smartImbalance, 3)} />
              <Row label="PCR tilt" value={formatSigned(ctx.pcrTilt, 3)} />
              <Row label="Put/Call ratio" value={ctx.putCallRatio != null ? ctx.putCallRatio.toFixed(2) : '—'} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> Mechanics</div>
            <div className="text-[var(--color-text-secondary)] text-xs space-y-2">
              <div><strong className="text-[var(--color-text-primary)]">Blend:</strong> 0.55 × flow + 0.30 × smart + 0.15 × PCR tilt, then × time-of-day multiplier.</div>
              <div><strong className="text-[var(--color-text-primary)]">Weights:</strong> 0.6 × OTM, 0.3 × ATM, 0.1 × ITM.</div>
              <div><strong className="text-[var(--color-text-primary)]">Flow source:</strong> <span className="capitalize">{ctx.flowSource.replace(/_/g, ' ')}</span></div>
            </div>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={<>Time-of-day multiplier is 0 outside the 0DTE window (forces score to 0). When the all-expiry fallback fires, the picture is inferred — not measured same-day — and conviction should be discounted.</>}
      >
        <div>Net premium per moneyness bucket; weighted <code>0.6 × OTM + 0.3 × ATM + 0.1 × ITM</code> for both calls and puts.</div>
        <div><code>flow_imbalance = (weighted_call_net − weighted_put_net) / (|...| + |...|)</code>, gated above $50k gross premium.</div>
        <div><code>blended = 0.55 × flow + 0.30 × smart + 0.15 × pcr_tilt</code>, then × time-of-day multiplier.</div>
        <div><code>score = clip(blended, [−1, 1]) × 100</code>. Triggers at |score| ≥ 25.</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="zero_dte_position_imbalance" symbol={symbol} title="Event Timeline" />
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

function MoneynessBars({ otmCall, atmCall, otmPut, atmPut }: { otmCall: number | null; atmCall: number | null; otmPut: number | null; atmPut: number | null }) {
  const values = [otmCall, atmCall, atmPut, otmPut].filter((v): v is number => v != null);
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v)));
  const rows: Array<{ label: string; value: number | null; color: string; weight: string }> = [
    { label: 'OTM Call', value: otmCall, color: 'var(--color-bull)', weight: '0.6×' },
    { label: 'ATM Call', value: atmCall, color: 'var(--color-bull)', weight: '0.3×' },
    { label: 'ATM Put', value: atmPut, color: 'var(--color-bear)', weight: '0.3×' },
    { label: 'OTM Put', value: otmPut, color: 'var(--color-bear)', weight: '0.6×' },
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
