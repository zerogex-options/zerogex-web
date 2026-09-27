'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Compass,
  ListChecks,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  useGEXSummary,
  useTapeFlowBiasSignal,
  useVannaCharmFlowSignal,
  usePositioningTrapSignal,
  useGexGradientSignal,
  useTrapDetectionSignal,
  useGammaVwapConfluenceSignal,
  useZeroDtePositionImbalanceSignal,
  useSignalScore,
} from '@/hooks/useApiData';
import { useTimeframe } from '@/core/TimeframeContext';
import { useHasTierAccess, useTierAccessState } from '@/hooks/useAuthSession';
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import { asObject, getNumber, trendColor } from '@/core/signalHelpers';
import { computeBias, type BiasResult, type MarketState } from '@/core/tradeBias';
import TooltipWrapper from './TooltipWrapper';

// Number of consecutive ticks a new regime must appear before we swap. 1 means
// the cards swap on the first disagreeing tick (no hysteresis).
const REGIME_CONFIRM_TICKS = 1;

function BiasCard({
  title,
  icon: Icon,
  color,
  loading,
  tooltip,
  children,
  footer,
}: {
  title: string;
  icon: typeof Compass;
  color: string;
  loading?: boolean;
  tooltip?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="zg-feature-shell p-5 flex flex-col gap-3 transition-colors"
      style={{
        borderColor: color,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <Icon size={15} />
          </span>
          <div>
            <div className="text-sm font-semibold">{title}</div>
          </div>
        </div>
        {tooltip ? <TooltipWrapper text={tooltip} /> : null}
      </div>
      {loading ? (
        <div className="text-xs text-[var(--color-text-secondary)]">Loading…</div>
      ) : (
        children
      )}
      {footer}
    </div>
  );
}

// The panel describes where positioning and flow stand. It gives no trade
// instruction and makes no forecast; see the note in core/tradeBias.ts.
const REGIME_TOOLTIP =
  'Where dealer positioning and flow stand right now, from net GEX, the GEX gradient, the flow signals (tape, vanna/charm, 0DTE positioning) and the structure signals (positioning trap, trap detection, gamma/VWAP). States: Long Gamma \u00b7 Bullish or Bearish Flow (dealers long gamma, with most flow signals leaning one way), Short Gamma \u00b7 Flow vs. Structure (dealers short gamma, with flow and structure leaning opposite ways), Mixed Signals (no defined state), or Not Enough Data. It describes the current read; it does not predict what price will do. The checklist below shows which key conditions are met.';

const BIAS_TOOLTIP =
  'Which way the inputs behind the state lean: the flow signals in a long-gamma state, the structure signals in a short-gamma split, Mixed otherwise. Agreement is scored 0-10 by how closely the underlying signals line up with the state\u00a0- higher means more of them agree. It measures agreement, not the odds of a move. A “Single Signal” badge appears when one very strong reading carried the state on its own. In Mixed, “Strong” chips flag any one signal at a strong reading that has not changed the state.';

const CHANGE_TOOLTIP =
  'What would move the panel out of its current state. The panel describes positioning and flow as they stand; it is not a trade plan. Use it alongside price action, levels and your own risk rules.';

export default function TradeBiasSection({ compact = false }: { compact?: boolean } = {}) {
  const { symbol } = useTimeframe();

  // 0DTE imbalance, trap detection and gamma-VWAP confluence are Pro-only. This
  // card is embedded on the (Basic-tier) dashboard, so for non-Pro viewers those
  // three used to poll on a loop and 403 every time — pure wasted load. Gate them
  // behind Pro access: the bias already degrades gracefully when they're absent
  // (computeBias treats a missing signal as null), so a Basic viewer sees exactly
  // the same result, just without the doomed requests. Pro viewers are unchanged.
  const hasPro = useHasTierAccess('pro');
  // The compact card's link opens /trade-bias, a Pro page. A Basic member
  // clicking "Open Trade Bias" hit the plan wall with no warning, so the link
  // says it is Pro. Read with the loading bit so a Pro member is never told
  // that while the session is still resolving (see useTierAccessState).
  const proAccess = useTierAccessState('pro');
  const tradeBiasLocked = !proAccess.allowed && !proAccess.loading;

  const gex = useGEXSummary(symbol, 5000);
  const msi = useSignalScore(symbol, PROPRIETARY_SIGNALS_REFRESH.compositeScoreMs);
  const tape = useTapeFlowBiasSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.tapeFlowBiasMs);
  const vc = useVannaCharmFlowSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.vannaCharmFlowMs);
  const odte = useZeroDtePositionImbalanceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.zeroDteImbalanceMs, hasPro);
  const gexGrad = useGexGradientSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.gexGradientMs);
  const posTrap = usePositioningTrapSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.positioningTrapMs);
  const trap = useTrapDetectionSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.trapDetectionMs, hasPro);
  const gVwap = useGammaVwapConfluenceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.gammaVwapConfluenceMs, hasPro);

  const biasInputs = useMemo(() => {
    const get = (raw: unknown): number | null => getNumber((asObject(raw) ?? {}).score);
    return {
      netGEX: gex.data?.net_gex != null ? (gex.data.net_gex > 0 ? 50 : -50) : null,
      netGexRaw: gex.data?.net_gex ?? null,
      gexGradient: get(gexGrad.data),
      tapeFlow: get(tape.data),
      vannaCharm: get(vc.data),
      odtePositioning: get(odte.data),
      positioningTrap: get(posTrap.data),
      trapDetection: get(trap.data),
      gammaVWAP: get(gVwap.data),
      msi: getNumber(msi.data?.composite_score ?? msi.data?.score),
    };
  }, [gex.data, msi.data, tape.data, vc.data, odte.data, gexGrad.data, posTrap.data, trap.data, gVwap.data]);

  const fresh = useMemo(() => computeBias({
    netGEX: biasInputs.netGEX,
    gexGradient: biasInputs.gexGradient,
    tapeFlow: biasInputs.tapeFlow,
    vannaCharm: biasInputs.vannaCharm,
    odtePositioning: biasInputs.odtePositioning,
    positioningTrap: biasInputs.positioningTrap,
    trapDetection: biasInputs.trapDetection,
    gammaVWAP: biasInputs.gammaVWAP,
    msi: biasInputs.msi,
  }), [biasInputs]);

  // Hysteresis: a single tick disagreeing with the current regime is treated
  // as noise. We only swap once REGIME_CONFIRM_TICKS consecutive ticks agree
  // on the new state. Confidence and checklist always reflect the latest
  // reading under the displayed regime.
  const [displayed, setDisplayed] = useState<BiasResult | null>(null);
  const pendingRef = useRef<{ state: MarketState; count: number } | null>(null);

  useEffect(() => {
    setDisplayed((prev) => {
      // First tick, fresh has no data, or we were waiting for first regime
      // out of the loading/UNKNOWN state — pass through immediately.
      if (!prev || !fresh.hasData || prev.marketState === 'UNKNOWN') {
        pendingRef.current = null;
        return fresh;
      }
      if (fresh.marketState === prev.marketState) {
        pendingRef.current = null;
        return fresh;
      }
      const pending = pendingRef.current;
      const nextCount = pending?.state === fresh.marketState ? pending.count + 1 : 1;
      if (nextCount >= REGIME_CONFIRM_TICKS) {
        pendingRef.current = null;
        return fresh;
      }
      pendingRef.current = { state: fresh.marketState, count: nextCount };
      return prev;
    });
  }, [fresh]);

  const bias = displayed ?? fresh;

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG_TRADE_BIAS !== '1') return;
    const errors = {
      gex: gex.error,
      gexGradient: gexGrad.error,
      tapeFlow: tape.error,
      vannaCharm: vc.error,
      odtePositioning: odte.error,
      positioningTrap: posTrap.error,
      trapDetection: trap.error,
      gammaVWAP: gVwap.error,
      msi: msi.error,
    };
    const missing = Object.entries(biasInputs)
      .filter(([k, v]) => k !== 'netGexRaw' && v == null)
      .map(([k]) => k);
    const lagged = fresh.marketState !== bias.marketState;
    console.groupCollapsed(
      `[TradeBias] ${symbol} → ${bias.marketState} (${bias.biasLabel}, conf ${bias.confidence.toFixed(1)}/${bias.maxConfidence})${
        lagged ? ` [hysteresis: candidate ${fresh.marketState}]` : ''
      }`,
    );
    console.table(biasInputs);
    if (missing.length) console.warn('Missing signals:', missing);
    const failedEndpoints = Object.entries(errors).filter(([, v]) => v);
    if (failedEndpoints.length) console.warn('Endpoint errors:', Object.fromEntries(failedEndpoints));
    console.log('Displayed:', bias);
    if (lagged) console.log('Fresh (pending):', fresh);
    console.groupEnd();
  }, [
    symbol,
    bias,
    fresh,
    biasInputs,
    gex.error,
    gexGrad.error,
    tape.error,
    vc.error,
    odte.error,
    posTrap.error,
    trap.error,
    gVwap.error,
    msi.error,
  ]);

  const anyLoading =
    (gex.loading && !gex.data) ||
    (msi.loading && !msi.data) ||
    (tape.loading && !tape.data) ||
    (vc.loading && !vc.data) ||
    (odte.loading && !odte.data);

  const color = trendColor(bias.trend);
  const biasIcon = bias.trend === 'bullish' ? TrendingUp : bias.trend === 'bearish' ? TrendingDown : AlertTriangle;
  const confidencePct = (bias.confidence / bias.maxConfidence) * 100;

  // Compact mode — a single glance-first card for the dashboard. The full
  // three-card breakdown now lives on the dedicated /trade-bias page.
  if (compact) {
    const CompactIcon = biasIcon;
    return (
      <section className="mb-8">
        <div
          className="zg-feature-shell p-4 flex flex-wrap items-center gap-x-6 gap-y-3"
          style={{ borderColor: color }}
        >
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
          >
            <CompactIcon size={16} style={{ color }} />
          </span>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)]">
              Trade Bias · {bias.regimeLabel}
            </div>
            <div className="text-xl sm:text-2xl font-black leading-tight break-words" style={{ color }}>
              {bias.biasLabel}
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-black" style={{ color, fontVariantNumeric: 'tabular-nums' }}>
              {bias.confidence.toFixed(1)}
            </span>
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-secondary)]">
              Agreement / {bias.maxConfidence}
            </span>
          </div>
          <Link
            href="/trade-bias"
            className="ml-auto text-sm font-semibold hover:underline"
            style={{ color: 'var(--color-info)' }}
          >
            {tradeBiasLocked ? 'Full Trade Bias is in Pro →' : 'Open Trade Bias →'}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Trade Bias</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Positioning card */}
        <BiasCard title="Positioning" icon={Compass} color={color} loading={anyLoading && !bias.hasData} tooltip={REGIME_TOOLTIP}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl sm:text-3xl font-black leading-tight break-words" style={{ color }}>
                {bias.regimeLabel}
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 uppercase tracking-wide">
                Market State
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
            {bias.regimeDesc}
          </p>
          <div className="mt-auto grid grid-cols-1 gap-1.5 text-xs">
            {bias.checklist.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between border-b border-[var(--color-border)]/40 pb-1"
              >
                <span className="text-[var(--color-text-secondary)]">{row.label}</span>
                <span
                  className="font-mono"
                  style={{ color: row.passed ? 'var(--color-bull)' : 'var(--color-text-secondary)' }}
                >
                  {row.passed ? '✓' : '—'}
                </span>
              </div>
            ))}
          </div>
        </BiasCard>

        {/* Lean card */}
        <BiasCard title="Lean" icon={biasIcon} color={color} loading={anyLoading && !bias.hasData} tooltip={BIAS_TOOLTIP}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-black leading-none break-words" style={{ color }}>
                {bias.biasLabel}
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                <span>{bias.setup}</span>
                {bias.convictionDriven ? (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border"
                    style={{ borderColor: color, color }}
                    title="This state rests on one very strong reading rather than broad agreement."
                  >
                    Single Signal
                  </span>
                ) : null}
                {bias.watching.map((w) => {
                  const watchColor = w.direction === 'bullish' ? 'var(--color-bull)' : 'var(--color-bear)';
                  return (
                    <span
                      key={w.key}
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border"
                      style={{ borderColor: watchColor, color: watchColor }}
                      title={`${w.label} is at a strong ${w.direction} reading on its own; the other inputs have not formed a state.`}
                    >
                      Strong: {w.label} {w.direction === 'bullish' ? '↑' : '↓'}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl sm:text-3xl font-black leading-none break-words" style={{ color }}>
                {bias.confidence.toFixed(1)}
              </div>
              <div className="text-[10px] text-[var(--color-text-secondary)] mt-1 uppercase tracking-wide">
                Agreement / {bias.maxConfidence}
              </div>
            </div>
          </div>
          <div
            className="h-1.5 w-full rounded-full overflow-hidden"
            style={{ background: 'var(--color-border)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${confidencePct}%`, background: color }}
            />
          </div>
          <div className="mt-auto">
            <div className="text-[11px] uppercase tracking-wide text-[var(--color-text-secondary)] mb-1.5">
              What the Inputs Show
            </div>
            <ul className="flex flex-col gap-1 text-xs text-[var(--color-text-primary)]">
              {bias.expectedBehavior.map((line, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span
                    className="mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0"
                    style={{ background: color }}
                  />
                  <span className="leading-snug">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </BiasCard>

        {/* What-would-change-it card */}
        <BiasCard title="What Would Change It" icon={ListChecks} color={color} loading={anyLoading && !bias.hasData} tooltip={CHANGE_TOOLTIP}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl sm:text-3xl font-black leading-tight break-words" style={{ color }}>
                {bias.setup}
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 uppercase tracking-wide">
                Current State
              </div>
            </div>
          </div>
          <ol className="flex flex-col gap-1.5 text-xs text-[var(--color-text-primary)]">
            {bias.playbook.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0"
                  style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
                >
                  {idx + 1}
                </span>
                <span className="leading-snug pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </BiasCard>
      </div>
    </section>
  );
}
