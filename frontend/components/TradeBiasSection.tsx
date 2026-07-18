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
import { PROPRIETARY_SIGNALS_REFRESH } from '@/core/refreshProfiles';
import { asObject, getNumber, humanize, trendColor } from '@/core/signalHelpers';
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

const REGIME_TOOLTIP =
  'Market State derived from the confluence of net GEX, gradient, tape flow, vanna/charm, 0DTE positioning, and trap signals. Possible regimes: Trend Up (long gamma + bullish flow), Trend Down (long gamma + bearish flow), Trap / Reversal (short gamma + bullish flow into crowded structure → fade strength), Trap / Squeeze (short gamma + bearish flow into trapped shorts → fade weakness), Chop / Range (mixed signals → mean reversion), or Awaiting confluence (insufficient data). The checklist below shows which key conditions are currently met.';

const BIAS_TOOLTIP =
  'Directional bias suggested by the active regime. Possible values: Buy Dips (Trend Up), Sell Rips (Trend Down), Fade Strength (Trap / Reversal), Fade Weakness (Trap / Squeeze), Range Fade (Chop), or Neutral / Wait (low confluence). Confidence is scored 0–10 based on how aligned the underlying signals are with the active regime — higher = more signals agree, lower = more mixed. The bar shows confidence as a percentage of the maximum. A “Conviction” badge appears when a regime was triggered by a single dominant signal rather than broad consensus. While in Chop, “Watching: …” chips appear for any individual signal at conviction levels — early warning that a regime swap may be brewing.';

const PLAYBOOK_TOOLTIP =
  'Suggested setup and step-by-step plan tailored to the active regime. The Setup name (e.g. Trend Continuation (Up), Trap / Squeeze, Mean Reversion) summarizes the trade thesis; the numbered steps describe how to execute it — entry trigger, level to watch, target, and risk management. Use this as a checklist, not a guarantee: confirm with the regime checklist and confidence score before sizing in.';

export default function TradeBiasSection({ compact = false }: { compact?: boolean } = {}) {
  const { symbol } = useTimeframe();

  const gex = useGEXSummary(symbol, 5000);
  const msi = useSignalScore(symbol, PROPRIETARY_SIGNALS_REFRESH.compositeScoreMs);
  const tape = useTapeFlowBiasSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.tapeFlowBiasMs);
  const vc = useVannaCharmFlowSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.vannaCharmFlowMs);
  const odte = useZeroDtePositionImbalanceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.zeroDteImbalanceMs);
  const gexGrad = useGexGradientSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.gexGradientMs);
  const posTrap = usePositioningTrapSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.positioningTrapMs);
  const trap = useTrapDetectionSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.trapDetectionMs);
  const gVwap = useGammaVwapConfluenceSignal(symbol, PROPRIETARY_SIGNALS_REFRESH.gammaVwapConfluenceMs);

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
  // three-card breakdown + playbook now lives on the dedicated /trade-bias page.
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
              Conf / {bias.maxConfidence}
            </span>
          </div>
          <Link
            href="/trade-bias"
            className="ml-auto text-sm font-semibold hover:underline"
            style={{ color: 'var(--color-info)' }}
          >
            Open Trade Bias →
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Trade Bias</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Regime card */}
        <BiasCard title="Regime" icon={Compass} color={color} loading={anyLoading && !bias.hasData} tooltip={REGIME_TOOLTIP}>
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

        {/* Bias card */}
        <BiasCard title="Bias" icon={biasIcon} color={color} loading={anyLoading && !bias.hasData} tooltip={BIAS_TOOLTIP}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl sm:text-3xl md:text-4xl font-black leading-none break-words" style={{ color }}>
                {bias.biasLabel}
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 uppercase tracking-wide flex items-center gap-1.5 flex-wrap">
                <span>{humanize(bias.bias)}</span>
                {bias.convictionDriven ? (
                  <span
                    className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border"
                    style={{ borderColor: color, color }}
                    title="Regime triggered by a single dominant signal rather than broad consensus."
                  >
                    Conviction
                  </span>
                ) : null}
                {bias.watching.map((w) => {
                  const watchColor = w.direction === 'bullish' ? 'var(--color-bull)' : 'var(--color-bear)';
                  return (
                    <span
                      key={w.key}
                      className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border"
                      style={{ borderColor: watchColor, color: watchColor }}
                      title={`${w.label} is at conviction levels (${w.direction}). No regime swap yet — watch for one if other signals align.`}
                    >
                      Watching: {w.label} {w.direction === 'bullish' ? '↑' : '↓'}
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
                Confidence / {bias.maxConfidence}
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
              Expected Behavior
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

        {/* Playbook card */}
        <BiasCard title="Playbook" icon={ListChecks} color={color} loading={anyLoading && !bias.hasData} tooltip={PLAYBOOK_TOOLTIP}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-2xl sm:text-3xl font-black leading-tight break-words" style={{ color }}>
                {bias.setup}
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 uppercase tracking-wide">
                Setup
              </div>
            </div>
          </div>
          <ol className="flex flex-col gap-1.5 text-xs text-[var(--color-text-primary)]">
            {bias.playbook.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0"
                  style={{ background: `${color}1f`, color }}
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
