'use client';

import { useEffect, useMemo } from 'react';
import {
  AlertTriangle,
  Compass,
  ListChecks,
  Target,
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
import { asObject, getNumber, trendColor } from '@/core/signalHelpers';
import { computeBias } from '@/core/tradeBias';

function BiasCard({
  title,
  icon: Icon,
  color,
  loading,
  children,
  footer,
}: {
  title: string;
  icon: typeof Compass;
  color: string;
  loading?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-3 transition-colors"
      style={{
        borderColor: color,
        background: 'var(--color-surface-subtle)',
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

export default function TradeBiasSection() {
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

  const bias = useMemo(() => computeBias({
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
    console.groupCollapsed(
      `[TradeBias] ${symbol} → ${bias.marketState} (${bias.biasLabel}, conf ${bias.confidence.toFixed(1)}/${bias.maxConfidence})`,
    );
    console.table(biasInputs);
    if (missing.length) console.warn('Missing signals:', missing);
    const failedEndpoints = Object.entries(errors).filter(([, v]) => v);
    if (failedEndpoints.length) console.warn('Endpoint errors:', Object.fromEntries(failedEndpoints));
    console.log('Result:', bias);
    console.groupEnd();
  }, [
    symbol,
    bias,
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

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Trade Bias</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Regime card */}
        <BiasCard title="Regime" icon={Compass} color={color} loading={anyLoading && !bias.hasData}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-black leading-tight" style={{ color }}>
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
        <BiasCard title="Bias" icon={biasIcon} color={color} loading={anyLoading && !bias.hasData}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-4xl font-black leading-none" style={{ color }}>
                {bias.biasLabel}
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 uppercase tracking-wide">
                {bias.bias.replace(/_/g, ' ')}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-black leading-none" style={{ color }}>
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
        <BiasCard title="Playbook" icon={ListChecks} color={color} loading={anyLoading && !bias.hasData}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-3xl font-black leading-tight" style={{ color }}>
                {bias.setup}
              </div>
              <div className="text-[11px] text-[var(--color-text-secondary)] mt-1 uppercase tracking-wide">
                Setup
              </div>
            </div>
            <Target size={24} style={{ color }} />
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
