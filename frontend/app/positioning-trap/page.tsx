'use client';

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTimeframe } from '@/core/TimeframeContext';
import { usePositioningTrapSignal } from '@/hooks/useApiData';
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
  formatSigned,
  formatPct,
  formatPrice,
  formatGexCompact,
} from '@/core/signalHelpers';

function interpretation(score: number | null): string {
  if (score == null) return 'No reading';
  if (score >= 50) return 'Upside squeeze setup';
  if (score >= 25) return 'Squeeze risk building';
  if (score <= -50) return 'Downside flush setup';
  if (score <= -25) return 'Flush risk building';
  return 'Balanced positioning';
}

export default function PositioningTrapPage() {
  const { symbol } = useTimeframe();
  const { data, loading, error, refetch } = usePositioningTrapSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.positioningTrapMs);

  const payload = useMemo(() => asObject(data) ?? {}, [data]);
  const score = getNumber(payload.score);
  const trend = toTrend(payload.direction);
  const history = useMemo(() => parseScoreHistory(payload.score_history), [payload]);

  const ctx = asObject(payload.context_values) ?? {};
  const smartImbalance = getNumber(payload.smart_imbalance);
  const smartSource = String(payload.smart_imbalance_source ?? ctx.smart_imbalance_source ?? '—');
  const momentum5bar = getNumber(payload.momentum_5bar);
  const putCallRatio = getNumber(ctx.put_call_ratio);
  const close = getNumber(ctx.close);
  const gammaFlip = getNumber(ctx.gamma_flip);
  const netGex = getNumber(ctx.net_gex);

  if (loading && !data) return <LoadingSpinner size="lg" />;

  const needlePct = score != null ? Math.max(0, Math.min(100, (score + 100) / 2)) : 50;

  // Derive decomposition factors from context (approximate visualization of the model inputs)
  const shortCrowding = putCallRatio != null ? Math.max(0, Math.min(1, (putCallRatio - 1.0) / 0.5)) : 0;
  const longCrowding = putCallRatio != null ? Math.max(0, Math.min(1, (1.0 - putCallRatio) / 0.5)) : 0;
  const putSkewFactor = smartImbalance != null && smartImbalance < 0 ? Math.abs(smartImbalance) : 0;
  const callSkewFactor = smartImbalance != null && smartImbalance > 0 ? smartImbalance : 0;
  const momFactor = momentum5bar != null ? Math.max(-1, Math.min(1, momentum5bar / 0.004)) : 0;
  const aboveFlip = close != null && gammaFlip != null ? (close > gammaFlip ? 1 : 0) : 0;
  const belowFlip = close != null && gammaFlip != null ? (close < gammaFlip ? 1 : 0) : 0;
  const shortGamma = netGex != null && netGex < 0 ? 1 : 0;

  return (
    <div className="container mx-auto px-4 py-8">
      <SignalPageTitle
        title="Positioning Trap"
        icon={AlertTriangle}
        tooltip="Flags crowded one-way positioning where tape behavior is starting to invalidate crowd direction. Positive score = upside squeeze setup (crowd short, upside breaking). Negative score = downside flush setup (crowd long, downside breaking)."
      />

      {error && <ErrorMessage message={error} onRetry={refetch} />}

      <section className="zg-feature-shell p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <SignalScoreHero
              score={score}
              scoreLabel="Trap Score"
              trend={trend}
              interpretation={interpretation(score)}
              history={history}
              footnote={<>Smart imbalance source: <span className="font-mono">{smartSource}</span></>}
            />
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="flex items-center justify-between text-sm font-semibold mb-3">
                <span>Trap Meter</span>
                <span className="text-[10px] font-mono text-[var(--color-text-secondary)]">−100 to +100</span>
              </div>
              <div className="relative h-6 rounded-full overflow-hidden" style={{ background: 'linear-gradient(90deg, var(--color-bear) 0%, var(--color-bear-soft) 30%, var(--color-surface) 50%, var(--color-bull-soft) 70%, var(--color-bull) 100%)' }}>
                <div className="absolute top-0 h-6 w-1 bg-[var(--color-text-primary)]" style={{ left: `${needlePct}%`, transform: 'translateX(-50%)' }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-[var(--color-text-secondary)]">
                <span>Flush risk</span>
                <span>Balanced</span>
                <span>Squeeze risk</span>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-5">
              <div className="text-sm font-semibold mb-3">Input decomposition</div>
              <div className="grid grid-cols-1 gap-2">
                <FactorBar label="Short crowding (P/C > 1.05)" value={shortCrowding} tone="bull" />
                <FactorBar label="Long crowding (P/C < 0.95)" value={longCrowding} tone="bear" />
                <FactorBar label="Put skew (smart imb. < 0)" value={putSkewFactor} tone="bull" />
                <FactorBar label="Call skew (smart imb. > 0)" value={callSkewFactor} tone="bear" />
                <FactorBar label="Momentum (5-bar)" value={momFactor} tone="signed" />
                <FactorBar label="Above flip" value={aboveFlip} tone="bull" />
                <FactorBar label="Below flip" value={belowFlip} tone="bear" />
                <FactorBar label="Short gamma regime" value={shortGamma} tone="warning" />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-4 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-3 text-[var(--color-text-secondary)]">
              <div>
                <div className="uppercase tracking-wide">P/C ratio</div>
                <div className="font-mono text-[var(--color-text-primary)] text-sm">{putCallRatio != null ? putCallRatio.toFixed(2) : '—'}</div>
              </div>
              <div>
                <div className="uppercase tracking-wide">5-bar %</div>
                <div className="font-mono text-[var(--color-text-primary)] text-sm">{formatPct(momentum5bar, 3)}</div>
              </div>
              <div>
                <div className="uppercase tracking-wide">Close / Flip</div>
                <div className="font-mono text-[var(--color-text-primary)] text-sm">
                  {formatPrice(close)} / {formatPrice(gammaFlip)}
                </div>
              </div>
              <div>
                <div className="uppercase tracking-wide">Net GEX</div>
                <div className="font-mono text-[var(--color-text-primary)] text-sm">{formatGexCompact(netGex)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SignalHowItsBuilt
        caveat={
          <>
            Smart imbalance = <code>(smart_call_net − smart_put_net) / (|call_net| + |put_net|)</code>, abstaining when denominator &lt; $100K.
            Signed imbalance this snapshot: <span className="font-mono">{formatSigned(smartImbalance, 3)}</span>.
          </>
        }
      >
        <div>
          Two sub-scores (squeeze, flush) combine crowding (0.45), signed smart-money skew (0.25),
          5-bar momentum (0.15), gamma-flip location (0.10), and GEX regime (0.05).
        </div>
        <div><code>score = clip(squeeze − flush, [−1, 1]) × 100</code>.</div>
      </SignalHowItsBuilt>

      <SignalEventsPanel signalName="positioning_trap" symbol={symbol} title="Event Timeline" />
    </div>
  );
}

function FactorBar({ label, value, tone }: { label: string; value: number; tone: 'bull' | 'bear' | 'warning' | 'signed' }) {
  const abs = Math.max(0, Math.min(1, Math.abs(value)));
  const color =
    tone === 'bull' ? 'var(--color-bull)' :
    tone === 'bear' ? 'var(--color-bear)' :
    tone === 'warning' ? 'var(--color-warning)' :
    (value >= 0 ? 'var(--color-bull)' : 'var(--color-bear)');
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] mb-0.5">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className="font-mono">{formatSigned(value, 2)}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--color-border)]/40 overflow-hidden">
        <div className="h-full" style={{ width: `${abs * 100}%`, background: color }} />
      </div>
    </div>
  );
}
