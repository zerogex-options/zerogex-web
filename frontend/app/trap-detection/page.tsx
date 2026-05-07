'use client';

import { useMemo } from 'react';
import { AlertTriangle, Gauge, Radar, TrendingDown, TrendingUp } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
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
    <div className="container mx-auto px-4 py-8">
      <SignalPageTitle
        title="Trap Detection"
        icon={AlertTriangle}
        tooltip="Flags failed breakouts as fade opportunities when dealer long gamma is reinforcing a reversal at a wall. Triggers at |score| ≥ 25. Prior resistance is the most-recently-breached upside wall; prior support, the most-recently-breached downside wall. The level persists in the payload after the break, so its position relative to close depends on tape since."
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <SignalScoreHero
              score={score}
              scoreLabel="Trap Score"
              trend={trend}
              interpretation={setupLabel(signal, score)}
              history={history}
              badges={
                <>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide" style={{ background: `${color}1f`, color }}>
                    {triggered && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
                    {humanize(signal) || 'None'}
                  </span>
                  {triggered && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'var(--color-bear-soft)', color: 'var(--color-bear)' }}>
                      <AlertTriangle size={12} /> TRAP
                    </span>
                  )}
                </>
              }
            />
          </div>

          <div className="lg:col-span-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
            <div className="text-sm font-semibold mb-3 flex items-center gap-2"><Radar size={14} /> Price ladder</div>
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
              <div className="text-sm text-[var(--color-text-secondary)]">Price levels not available.</div>
            )}
            <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Chip
                label="Gamma strengthening"
                on={ctx.gammaStrengthening}
                color="var(--color-bull)"
                tooltip="Net GEX is rising session-over-session — dealer long-gamma is intensifying. Reinforces fade-trade behavior at the wall."
              />
              <Chip
                label="Call wall migrated ↑"
                on={callWallMigratedUp}
                color="var(--color-bear)"
                tooltip="The call wall has migrated higher (call_wall > prior_call_wall) — dealers are repositioning their upside reference up with price, which invalidates the bearish-fade setup at the prior resistance."
              />
              <Chip
                label="Put wall migrated ↓"
                on={putWallMigratedDown}
                color="var(--color-bear)"
                tooltip="The put wall has migrated lower (put_wall < prior_put_wall) — dealers are repositioning their downside reference down with price, which invalidates the bullish-fade setup at the prior support."
              />
              <Chip
                label="Long gamma"
                on={ctx.longGamma}
                color="var(--color-bull)"
                tooltip="Net GEX > 0: dealers are net long gamma. They sell into rallies and buy dips, dampening volatility — supportive of fade behavior at walls."
              />
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
              <Row label="Spot" value={formatPrice(ctx.close)} />
              <Row label="Prior Resistance" value={formatPrice(priorResistance)} />
              <Row label="Prior Support" value={formatPrice(priorSupport)} />
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
              <Row label="Put wall" value={formatPrice(ctx.putWall)} />
              <Row label="Prior put wall" value={formatPrice(ctx.priorPutWall)} />
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
          <div
            className="rounded-xl border p-4 bg-[var(--color-surface-subtle)]"
            style={{ borderColor: signal === 'bearish_fade' ? 'var(--color-bear)' : 'var(--color-border)' }}
          >
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bear)]">
              <TrendingDown size={16} />
              <span>Bearish fade</span>
              {signal === 'bearish_fade' && (
                <span
                  className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--color-bear-soft)', color: 'var(--color-bear)' }}
                >
                  Active
                </span>
              )}
            </div>
            <p className="text-[var(--color-text-secondary)]">
              Price popped above the prior resistance (now sitting below close) but failed to hold + dealers long
              gamma + call wall not migrating → fade the failed break with a short-call-spread or put-debit.
            </p>
          </div>
          <div
            className="rounded-xl border p-4 bg-[var(--color-surface-subtle)]"
            style={{ borderColor: signal === 'bullish_fade' ? 'var(--color-bull)' : 'var(--color-border)' }}
          >
            <div className="font-semibold mb-2 flex items-center gap-2 text-[var(--color-bull)]">
              <TrendingUp size={16} />
              <span>Bullish fade</span>
              {signal === 'bullish_fade' && (
                <span
                  className="ml-auto text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--color-bull-soft)', color: 'var(--color-bull)' }}
                >
                  Active
                </span>
              )}
            </div>
            <p className="text-[var(--color-text-secondary)]">
              Mirror: price slipped beneath the prior support (now sitting above close) but failed to hold, with
              reinforcing long gamma → fade the failed break. Invalidate on wall migration with price.
            </p>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={<>Wall migration with price (dealers repositioning) invalidates the setup. Buffer band is min(0.1%, 0.15 × realized σ × √5).</>}
      >
        <div>Detects upside / downside breakouts beyond the prior resistance / support wall by at least the buffer band.</div>
        <div>Requires dealer long gamma (<code>Net GEX &gt; 0</code>), gamma strengthening, and the relevant wall <em>not</em> migrating in the breakout direction — call wall not moving up on a bearish fade (<code>call_wall_migrated_up</code>), put wall not moving down on a bullish fade (<code>put_wall_migrated_down</code>).</div>
        <div>Optional confirmation: same-side flow decelerating into the wall.</div>
        <div><code>Score = ±Confidence × 100</code>, where Confidence aggregates the boolean triggers above. Sign opposes the failed-breakout direction.</div>
        <div><code>broken_resistance_level</code> / <code>broken_support_level</code> are the most-recently-breached walls — prior resistance was punched through to the upside; prior support, to the downside. The fields persist past the breakout flag, so the level can sit on either side of close as price retraces.</div>
      </SignalHowItsBuilt>

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
            const hint = r.value < spot ? 'below close' : r.value > spot ? 'above close' : 'at close';
            return (
              <div key="resistance" className="flex items-baseline gap-3">
                <span className="text-[var(--color-bull)] font-semibold w-28">Prior Resistance</span>
                <span className="font-mono">{formatPrice(r.value)}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  <span className="text-[var(--color-bull)]">Broken ↑</span>
                  <span className="text-[var(--color-text-secondary)]"> · {hint}</span>
                </span>
                {breakoutUp && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--color-bull-soft)', color: 'var(--color-bull)' }}
                  >
                    Active
                  </span>
                )}
              </div>
            );
          }
          if (r.kind === 'support') {
            const hint = r.value < spot ? 'below close' : r.value > spot ? 'above close' : 'at close';
            return (
              <div key="support" className="flex items-baseline gap-3">
                <span className="text-[var(--color-bear)] font-semibold w-28">Prior Support</span>
                <span className="font-mono">{formatPrice(r.value)}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide">
                  <span className="text-[var(--color-bear)]">Broken ↓</span>
                  <span className="text-[var(--color-text-secondary)]"> · {hint}</span>
                </span>
                {breakoutDown && (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{ background: 'var(--color-bear-soft)', color: 'var(--color-bear)' }}
                  >
                    Active
                  </span>
                )}
              </div>
            );
          }
          return (
            <div key="spot" className="flex items-baseline gap-3">
              <span className="text-[var(--color-warning)] font-semibold w-28">Spot</span>
              <span className="font-mono">{formatPrice(r.value)}</span>
            </div>
          );
        })}
        <div className="text-[11px] text-[var(--color-text-secondary)] border-t border-[var(--color-border)]/40 pt-2">
          Buffer band = min(0.1%, 0.15 × realized σ × √5).
        </div>
      </div>
    </div>
  );
}
