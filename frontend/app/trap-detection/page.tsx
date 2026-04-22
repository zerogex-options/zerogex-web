'use client';

import { useMemo } from 'react';
import { AlertTriangle, Gauge, Radar, TrendingDown, TrendingUp } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { useTrapDetectionSignal } from '@/hooks/useApiData';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorMessage from '@/components/ErrorMessage';
import TooltipWrapper from '@/components/TooltipWrapper';
import SignalSparkline from '@/components/SignalSparkline';
import SignalEventsPanel from '@/components/SignalEventsPanel';
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
  formatGexCompact,
} from '@/core/signalHelpers';

function setupLabel(signal: string, score: number | null): string {
  if (score == null) return 'No reading';
  if (signal === 'bearish_fade') return 'Bearish fade — failed upside breakout';
  if (signal === 'bullish_fade') return 'Bullish fade — failed downside break';
  if (score <= -25) return 'Bearish fade risk';
  if (score >= 25) return 'Bullish fade risk';
  return 'No strong trap edge';
}

export default function TrapDetectionPage() {
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
  const resistance = getNumber(payload.resistance_level);
  const support = getNumber(payload.support_level);
  const bufferPct = getNumber(payload.breakout_buffer_pct);
  const wallMigratedUp = getBool(payload.wall_migrated_up);
  const wallMigratedDown = getBool(payload.wall_migrated_down);

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
      callFlowDecelerating: getBool(raw.call_flow_decelerating),
      putFlowDecelerating: getBool(raw.put_flow_decelerating),
    };
  }, [payload]);

  const trend = toTrend(payload.direction);
  const color = trendColor(trend);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const ladderRange = useMemo(() => {
    const vals = [resistance, support, ctx.close].filter((v): v is number => v != null);
    if (vals.length === 0) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (min === max) return { min: min - 1, max: max + 1 };
    const pad = (max - min) * 0.2;
    return { min: min - pad, max: max + pad };
  }, [resistance, support, ctx.close]);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 mb-2">
        <h1 className="text-3xl font-bold">Trap Detection</h1>
        <TooltipWrapper
          text="Flags failed breakouts as fade opportunities when dealer long gamma is reinforcing a reversal at a wall."
          placement="bottom"
        >
          <span className="text-[var(--color-text-secondary)] cursor-help">ⓘ</span>
        </TooltipWrapper>
      </div>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6 max-w-3xl">
        Triggers at |score| ≥ 25. Invalidated when the relevant wall migrates with price (dealers repositioning).
      </p>

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-secondary)] mb-2">Trap Score</div>
            <div className="text-6xl font-black leading-none" style={{ color }}>
              {score != null ? score.toFixed(2) : '—'}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide" style={{ background: `${color}1f`, color }}>
                {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
                {signal.replace(/_/g, ' ') || 'none'}
              </span>
              {triggered && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'var(--color-bear-soft)', color: 'var(--color-bear)' }}>
                  <AlertTriangle size={12} /> TRAP
                </span>
              )}
            </div>
            <div className="mt-3 text-sm font-semibold">{setupLabel(signal, score)}</div>
            <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
              <div className="text-[11px] uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Score history</div>
              <SignalSparkline points={history} strokeColor={color} fillColor={`${color}1f`} height={56} />
            </div>
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
            <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Radar size={14} /> Price ladder</div>
            {ladderRange && ctx.close != null ? (
              <PriceLadder
                min={ladderRange.min}
                max={ladderRange.max}
                close={ctx.close}
                resistance={resistance}
                support={support}
                bufferPct={bufferPct}
                breakoutUp={breakoutUp}
                breakoutDown={breakoutDown}
              />
            ) : (
              <div className="text-sm text-[var(--color-text-secondary)]">Price levels not available.</div>
            )}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Chip label="Gamma strengthening" on={ctx.gammaStrengthening} color="var(--color-bull)" />
              <Chip label="Wall migrated ↑" on={wallMigratedUp} color="var(--color-bear)" />
              <Chip label="Wall migrated ↓" on={wallMigratedDown} color="var(--color-bear)" />
              <Chip label="Long gamma" on={ctx.longGamma} color="var(--color-bull)" />
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Breakout &amp; Gamma Context</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Radar size={16} /> Structure</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Close" value={formatPrice(ctx.close)} />
              <Row label="Resistance" value={formatPrice(resistance)} />
              <Row label="Support" value={formatPrice(support)} />
              <Row label="Buffer %" value={formatPct(bufferPct, 3, false)} />
              <Row label="Realized σ" value={ctx.realizedSigma != null ? ctx.realizedSigma.toFixed(4) : '—'} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><Gauge size={16} /> Dealer</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Net GEX" value={formatGexCompact(ctx.netGex)} />
              <Row label="Net GEX Δ" value={formatGexCompact(netGexDelta)} />
              <Row label="Net GEX Δ%" value={formatPct(netGexDeltaPct, 2)} />
              <Row label="Call wall" value={formatPrice(ctx.callWall)} />
              <Row label="Prior call wall" value={formatPrice(ctx.priorCallWall)} />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle size={16} /> Flow decel</div>
            <div className="space-y-2 text-[var(--color-text-secondary)]">
              <Row label="Call flow decel" value={ctx.callFlowDecelerating ? 'Yes' : 'No'} />
              <Row label="Put flow decel" value={ctx.putFlowDecelerating ? 'Yes' : 'No'} />
              <Row label="Breakout ↑" value={breakoutUp ? 'Yes' : 'No'} />
              <Row label="Breakout ↓" value={breakoutDown ? 'Yes' : 'No'} />
            </div>
          </div>
        </div>
      </section>

      <section className="zg-feature-shell mt-8 p-6">
        <h2 className="text-xl font-semibold mb-4">Interpretation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bear)]"><TrendingDown size={16} /> Bearish fade</div>
            <p className="text-[var(--color-text-secondary)]">
              Upside poke above resistance + dealers long gamma + call wall not migrating → short-call-spread or
              put-debit at resistance.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--color-border)] p-4 bg-[var(--color-surface-subtle)]">
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bull)]"><TrendingUp size={16} /> Bullish fade</div>
            <p className="text-[var(--color-text-secondary)]">
              Mirror: downside break under support with reinforcing long gamma. Invalidate on wall migration with
              price.
            </p>
          </div>
        </div>
      </section>

      <SignalEventsPanel signalName="trap_detection" symbol={symbol} title="Event Timeline" />
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

function Chip({ label, on, color }: { label: string; on: boolean; color: string }) {
  return (
    <span
      className="inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border"
      style={{ borderColor: on ? color : 'var(--color-border)', color: on ? color : 'var(--color-text-secondary)', background: on ? `${color}14` : 'transparent' }}
    >
      {label}
    </span>
  );
}

interface PriceLadderProps {
  min: number;
  max: number;
  close: number;
  resistance: number | null;
  support: number | null;
  bufferPct: number | null;
  breakoutUp: boolean;
  breakoutDown: boolean;
}

function PriceLadder({ min, max, close, resistance, support, bufferPct, breakoutUp, breakoutDown }: PriceLadderProps) {
  const height = 180;
  const range = max - min;
  const toY = (v: number) => height - ((v - min) / range) * height;
  const buffer = bufferPct != null ? bufferPct * close : 0;

  return (
    <div className="relative flex items-start gap-4">
      <svg width="48" height={height} viewBox={`0 0 48 ${height}`}>
        <line x1={24} y1={0} x2={24} y2={height} stroke="var(--color-border)" strokeWidth={2} />
        {resistance != null && (
          <g>
            <line x1={6} y1={toY(resistance)} x2={42} y2={toY(resistance)} stroke="var(--color-bear)" strokeWidth={2} />
            {buffer > 0 && (
              <rect x={6} y={toY(resistance + buffer)} width={36} height={toY(resistance) - toY(resistance + buffer)} fill="var(--color-bear)" opacity={0.12} />
            )}
          </g>
        )}
        {support != null && (
          <g>
            <line x1={6} y1={toY(support)} x2={42} y2={toY(support)} stroke="var(--color-bull)" strokeWidth={2} />
            {buffer > 0 && (
              <rect x={6} y={toY(support)} width={36} height={toY(support - buffer) - toY(support)} fill="var(--color-bull)" opacity={0.12} />
            )}
          </g>
        )}
        <circle cx={24} cy={toY(close)} r={5} fill="var(--color-warning)" stroke="var(--color-surface)" strokeWidth={2} />
      </svg>
      <div className="flex flex-col gap-3 text-xs">
        {resistance != null && (
          <div className="flex items-baseline gap-3">
            <span className="text-[var(--color-bear)] font-semibold w-20">Resistance</span>
            <span className="font-mono">{formatPrice(resistance)}</span>
            {breakoutUp && <span className="text-[var(--color-bear)] text-[10px] font-semibold uppercase tracking-wide">Broken ↑</span>}
          </div>
        )}
        <div className="flex items-baseline gap-3">
          <span className="text-[var(--color-warning)] font-semibold w-20">Close</span>
          <span className="font-mono">{formatPrice(close)}</span>
        </div>
        {support != null && (
          <div className="flex items-baseline gap-3">
            <span className="text-[var(--color-bull)] font-semibold w-20">Support</span>
            <span className="font-mono">{formatPrice(support)}</span>
            {breakoutDown && <span className="text-[var(--color-bull)] text-[10px] font-semibold uppercase tracking-wide">Broken ↓</span>}
          </div>
        )}
        <div className="text-[11px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)]/40 pt-2">
          Buffer band = min(0.1%, 0.15 × realized σ × √5).
        </div>
      </div>
    </div>
  );
}
