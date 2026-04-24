'use client';

import { useMemo } from 'react';
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
import { asObject, getNumber, trendColor, type SignalTrend } from '@/core/signalHelpers';

type MarketState =
  | 'TRAP_REVERSAL'
  | 'TRAP_SQUEEZE'
  | 'TREND_UP'
  | 'TREND_DOWN'
  | 'CHOP'
  | 'UNKNOWN';

interface BiasInput {
  netGEX: number | null;
  gexGradient: number | null;
  tapeFlow: number | null;
  vannaCharm: number | null;
  odtePositioning: number | null;
  positioningTrap: number | null;
  trapDetection: number | null;
  gammaVWAP: number | null;
  msi: number | null;
}

interface BiasResult {
  marketState: MarketState;
  regimeLabel: string;
  regimeDesc: string;
  bias: string;
  biasLabel: string;
  trend: SignalTrend;
  confidence: number;
  maxConfidence: number;
  setup: string;
  playbook: string[];
  expectedBehavior: string[];
  checklist: Array<{ label: string; passed: boolean }>;
  hasData: boolean;
}

const STRONG = 50;
const MODERATE = 30;

function computeBias(inp: BiasInput): BiasResult {
  const {
    netGEX,
    gexGradient,
    tapeFlow,
    vannaCharm,
    odtePositioning,
    positioningTrap,
    trapDetection,
    gammaVWAP,
    msi,
  } = inp;

  const available = [netGEX, gexGradient, tapeFlow, vannaCharm, odtePositioning, positioningTrap, trapDetection, gammaVWAP, msi]
    .filter((v) => v != null).length;

  // Short-gamma / unstable regime (amplifies moves, reversal-prone)
  const isShortGamma = (netGEX != null && netGEX < 0) && (gexGradient != null && gexGradient < 0);
  const isLongGamma = (netGEX != null && netGEX > 0) && (gexGradient != null && gexGradient > 0);

  // Bullish flow (calls buying, dealer vanna+, 0DTE tilt bullish)
  const bullishFlow =
    (tapeFlow != null && tapeFlow > STRONG) &&
    (vannaCharm != null && vannaCharm > MODERATE) &&
    (odtePositioning != null && odtePositioning > MODERATE);
  const bearishFlow =
    (tapeFlow != null && tapeFlow < -STRONG) &&
    (vannaCharm != null && vannaCharm < -MODERATE) &&
    (odtePositioning != null && odtePositioning < -MODERATE);

  // Bearish structure (crowded longs about to be unwound)
  const bearishStructure =
    (positioningTrap != null && positioningTrap < -MODERATE) &&
    (trapDetection != null && trapDetection < -STRONG) &&
    (gammaVWAP != null && gammaVWAP < -MODERATE);
  const bullishStructure =
    (positioningTrap != null && positioningTrap > MODERATE) &&
    (trapDetection != null && trapDetection > STRONG) &&
    (gammaVWAP != null && gammaVWAP > MODERATE);

  let marketState: MarketState = 'UNKNOWN';
  if (isShortGamma && bullishFlow && bearishStructure) marketState = 'TRAP_REVERSAL';
  else if (isShortGamma && bearishFlow && bullishStructure) marketState = 'TRAP_SQUEEZE';
  else if (isLongGamma && bullishFlow && (msi == null || msi >= 0)) marketState = 'TREND_UP';
  else if (isLongGamma && bearishFlow && (msi == null || msi <= 0)) marketState = 'TREND_DOWN';
  else if (available >= 4) marketState = 'CHOP';

  // Bias signal count for confidence (how many components align with the thesis)
  const biasScores: number[] = [];
  const push = (v: number | null | undefined, expectedSign: 1 | -1) => {
    if (v == null) return;
    biasScores.push(Math.max(0, (v * expectedSign) / 100));
  };

  let trend: SignalTrend = 'neutral';
  let biasLabel = 'Neutral';
  let bias = 'WAIT';
  let regimeLabel = 'Awaiting confluence';
  let regimeDesc = 'Signals mixed. Wait for alignment.';
  let setup = 'No defined setup';
  let playbook: string[] = ['Wait for signal alignment', 'Avoid premium decay exposure', 'Re-assess every 15m'];
  let expectedBehavior: string[] = ['Range-bound / choppy', 'Low directional conviction'];

  switch (marketState) {
    case 'TRAP_REVERSAL':
      trend = 'bearish';
      bias = 'FADE_STRENGTH';
      biasLabel = 'Fade Strength';
      regimeLabel = 'Trap / Reversal Regime';
      regimeDesc = 'Short gamma + bullish flow + crowded structure = reversal setup.';
      setup = 'Trap / Reversal';
      playbook = [
        'Wait for upside push to stall',
        'Watch for rejection at resistance / VWAP',
        'Enter puts on failure confirmation',
        'Target liquidity sweep / downside expansion',
      ];
      expectedBehavior = [
        'Early strength fails',
        'Choppy rejection at resistance',
        'Short-gamma expansion lower',
      ];
      push(tapeFlow, 1);
      push(vannaCharm, 1);
      push(odtePositioning, 1);
      push(positioningTrap, -1);
      push(trapDetection, -1);
      push(gammaVWAP, -1);
      push(netGEX, -1);
      push(gexGradient, -1);
      break;
    case 'TRAP_SQUEEZE':
      trend = 'bullish';
      bias = 'FADE_WEAKNESS';
      biasLabel = 'Fade Weakness';
      regimeLabel = 'Trap / Squeeze Regime';
      regimeDesc = 'Short gamma + bearish flow + trapped shorts = squeeze setup.';
      setup = 'Trap / Squeeze';
      playbook = [
        'Wait for downside flush to stall',
        'Watch for reclaim of VWAP / support',
        'Enter calls on reversal confirmation',
        'Target short-cover squeeze / upside expansion',
      ];
      expectedBehavior = [
        'Early weakness fails',
        'Flush reclaims support',
        'Short-gamma expansion higher',
      ];
      push(tapeFlow, -1);
      push(vannaCharm, -1);
      push(odtePositioning, -1);
      push(positioningTrap, 1);
      push(trapDetection, 1);
      push(gammaVWAP, 1);
      push(netGEX, -1);
      push(gexGradient, -1);
      break;
    case 'TREND_UP':
      trend = 'bullish';
      bias = 'BUY_DIPS';
      biasLabel = 'Buy Dips';
      regimeLabel = 'Trend Up Regime';
      regimeDesc = 'Long gamma + aligned bullish flow + positive MSI.';
      setup = 'Trend Continuation (Up)';
      playbook = [
        'Buy dips toward VWAP / gamma support',
        'Target prior highs & call-wall magnet',
        'Trail stops under rising support',
      ];
      expectedBehavior = [
        'Steady grind higher',
        'Shallow pullbacks bought',
        'Call-wall pin effect',
      ];
      push(tapeFlow, 1);
      push(vannaCharm, 1);
      push(odtePositioning, 1);
      push(positioningTrap, 1);
      push(trapDetection, 1);
      push(gammaVWAP, 1);
      push(netGEX, 1);
      push(msi, 1);
      break;
    case 'TREND_DOWN':
      trend = 'bearish';
      bias = 'SELL_RIPS';
      biasLabel = 'Sell Rips';
      regimeLabel = 'Trend Down Regime';
      regimeDesc = 'Long gamma + aligned bearish flow + negative MSI.';
      setup = 'Trend Continuation (Down)';
      playbook = [
        'Short rips into VWAP / resistance',
        'Target prior lows & put-wall magnet',
        'Trail stops above declining resistance',
      ];
      expectedBehavior = [
        'Steady drift lower',
        'Shallow bounces sold',
        'Put-wall pin effect',
      ];
      push(tapeFlow, -1);
      push(vannaCharm, -1);
      push(odtePositioning, -1);
      push(positioningTrap, -1);
      push(trapDetection, -1);
      push(gammaVWAP, -1);
      push(netGEX, 1);
      push(msi, -1);
      break;
    case 'CHOP':
      trend = 'neutral';
      bias = 'RANGE_FADE';
      biasLabel = 'Range Fade';
      regimeLabel = 'Chop / Range Regime';
      regimeDesc = 'Mixed signals — no dominant directional thesis.';
      setup = 'Mean Reversion';
      playbook = [
        'Fade extremes of the session range',
        'Avoid premium breakout trades',
        'Favor theta / defined-risk structures',
      ];
      expectedBehavior = [
        'Two-way chop',
        'VWAP magnetism',
        'Failed breakout attempts',
      ];
      break;
    default:
      break;
  }

  const maxConfidence = 10;
  const rawAvg = biasScores.length ? biasScores.reduce((a, b) => a + b, 0) / biasScores.length : 0;
  const confidence = Math.max(0, Math.min(maxConfidence, Math.round(rawAvg * 10 * 10) / 10));

  const checklist: Array<{ label: string; passed: boolean }> = [
    { label: 'Short-gamma regime', passed: isShortGamma },
    { label: 'Call-heavy tape flow', passed: tapeFlow != null && tapeFlow > MODERATE },
    { label: 'Trap detection triggered', passed: (trapDetection ?? 0) < -STRONG || (trapDetection ?? 0) > STRONG },
    { label: 'Structure/flow divergence', passed:
      (bullishFlow && bearishStructure) || (bearishFlow && bullishStructure),
    },
  ];

  return {
    marketState,
    regimeLabel,
    regimeDesc,
    bias,
    biasLabel,
    trend,
    confidence,
    maxConfidence,
    setup,
    playbook,
    expectedBehavior,
    checklist,
    hasData: available >= 3,
  };
}

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

  const bias = useMemo(() => {
    const get = (raw: unknown): number | null => getNumber((asObject(raw) ?? {}).score);
    const netGEX = gex.data?.net_gex != null ? (gex.data.net_gex > 0 ? 50 : -50) : null;

    return computeBias({
      netGEX,
      gexGradient: get(gexGrad.data),
      tapeFlow: get(tape.data),
      vannaCharm: get(vc.data),
      odtePositioning: get(odte.data),
      positioningTrap: get(posTrap.data),
      trapDetection: get(trap.data),
      gammaVWAP: get(gVwap.data),
      msi: getNumber(msi.data?.composite_score ?? msi.data?.score),
    });
  }, [gex.data, msi.data, tape.data, vc.data, odte.data, gexGrad.data, posTrap.data, trap.data, gVwap.data]);

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
