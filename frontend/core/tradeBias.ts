import type { SignalTrend } from './signalHelpers';

export type MarketState =
  | 'TRAP_REVERSAL'
  | 'TRAP_SQUEEZE'
  | 'TREND_UP'
  | 'TREND_DOWN'
  | 'CHOP'
  | 'UNKNOWN';

export interface BiasInput {
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

export interface WatchingSignal {
  key: string;
  label: string;
  direction: 'bullish' | 'bearish';
}

export interface BiasResult {
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
  convictionDriven: boolean;
  watching: WatchingSignal[];
}

const SIGNAL_LABELS = {
  tapeFlow: 'Tape Flow',
  vannaCharm: 'Vanna/Charm',
  odtePositioning: '0DTE Positioning',
  positioningTrap: 'Positioning Trap',
  trapDetection: 'Trap Detection',
  gammaVWAP: 'Gamma/VWAP',
} as const;

export const STRONG = 25;
export const MODERATE = 12;
export const DOMINANT = 65;

// The copy below describes where positioning and flow stand; it gives no
// trade instruction and makes no forecast. ZeroGEX's own replays of every
// minute since 2026-07-17 (zerogex-oa research/short_gamma_trend,
// trade_bias_inputs, trade_bias_movement) found that no state predicted the
// direction or the size of the next move, and no input predicted its direction.
// src/signals/trade_bias/bias.py carries the same strings; keep them in step.
const NOT_A_FORECAST = 'A description of the current read, not a forecast';

// `msi` is the 0-100 composite: regime strength, not direction. Both trend
// states treat it identically -- it adds to a trend call's confidence and
// never gates it. It used to gate them as if it ran -100..+100 (`msi >= -10`
// for TREND_UP, `msi <= 10` for TREND_DOWN); on the real scale the first
// always passed and the second needed the gauge at 10 or below, so TREND_UP
// fired freely and TREND_DOWN almost never did.

export function computeBias(inp: BiasInput): BiasResult {
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

  // Gamma regime: net GEX sign defines it; gradient acts as a veto only when
  // it strongly contradicts. This lets a regime fire when the gradient is
  // mildly mixed instead of demanding both signals point the same way.
  const isShortGamma =
    netGEX != null && netGEX < 0 && (gexGradient == null || gexGradient < MODERATE);
  const isLongGamma =
    netGEX != null && netGEX > 0 && (gexGradient == null || gexGradient > -MODERATE);

  // Conviction-weighted voting: a signal contributes 1 vote past its base
  // threshold, or 2 votes past DOMINANT — so a single high-conviction reading
  // can singlehandedly produce the 2-of-3 majority. The strict `>` comparison
  // on the opposing tally cancels ties: opposing dominant signals net to a
  // draw rather than letting the if/else order pick a winner. `boost=false`
  // skips the DOMINANT bonus so we can detect whether a regime was carried
  // by conviction alone (a flat-vote re-count below).
  const conviction = (v: number | null, sign: 1 | -1, base: number, boost = true): number => {
    if (v == null) return 0;
    const aligned = v * sign;
    if (boost && aligned > DOMINANT) return 2;
    if (aligned > base) return 1;
    return 0;
  };

  const flowVotes = (sign: 1 | -1, boost = true) =>
    conviction(tapeFlow, sign, STRONG, boost) +
    conviction(vannaCharm, sign, MODERATE, boost) +
    conviction(odtePositioning, sign, MODERATE, boost);
  const bullFlowVotes = flowVotes(1);
  const bearFlowVotes = flowVotes(-1);
  const bullishFlow = bullFlowVotes >= 2 && bullFlowVotes > bearFlowVotes;
  const bearishFlow = bearFlowVotes >= 2 && bearFlowVotes > bullFlowVotes;

  const structureVotes = (sign: 1 | -1, boost = true) =>
    conviction(positioningTrap, sign, MODERATE, boost) +
    conviction(trapDetection, sign, STRONG, boost) +
    conviction(gammaVWAP, sign, MODERATE, boost);
  const bullStructVotes = structureVotes(1);
  const bearStructVotes = structureVotes(-1);
  const bullishStructure = bullStructVotes >= 2 && bullStructVotes > bearStructVotes;
  const bearishStructure = bearStructVotes >= 2 && bearStructVotes > bullStructVotes;

  let marketState: MarketState = 'UNKNOWN';
  if (isShortGamma && bullishFlow && bearishStructure) marketState = 'TRAP_REVERSAL';
  else if (isShortGamma && bearishFlow && bullishStructure) marketState = 'TRAP_SQUEEZE';
  else if (isLongGamma && bullishFlow) marketState = 'TREND_UP';
  else if (isLongGamma && bearishFlow) marketState = 'TREND_DOWN';
  else if (available >= 4) marketState = 'CHOP';

  const biasScores: number[] = [];
  const push = (v: number | null | undefined, expectedSign: 1 | -1) => {
    if (v == null) return;
    biasScores.push(Math.max(0, (v * expectedSign) / 100));
  };

  // Defaults are the UNKNOWN state's copy: fewer than four inputs reporting.
  let trend: SignalTrend = 'neutral';
  let biasLabel = 'No Read';
  let bias = 'WAIT';
  let regimeLabel = 'Not Enough Data';
  let regimeDesc = 'Fewer than four of the nine inputs are reporting.';
  let setup = 'No Defined State';
  // `playbook` is what would move the panel out of its current state;
  // `expectedBehavior` is what the inputs show. Field names are the API's.
  let playbook: string[] = ['More of the nine inputs reporting'];
  let expectedBehavior: string[] = ['Waiting on more inputs to report', NOT_A_FORECAST];

  switch (marketState) {
    case 'TRAP_REVERSAL':
      trend = 'bearish';
      bias = 'FADE_STRENGTH';
      biasLabel = 'Structure Bearish';
      regimeLabel = 'Short Gamma \u00b7 Flow vs. Structure';
      regimeDesc = 'Dealers are net short gamma. Flow leans bullish while the structure signals lean bearish.';
      setup = 'Flow/Structure Split';
      playbook = [
        'Flow or structure losing its majority',
        'Net GEX turning positive, or the gradient strongly against it',
      ];
      expectedBehavior = [
        'Net GEX negative: dealers net short gamma',
        'Flow majority bullish; structure majority bearish',
        NOT_A_FORECAST,
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
      biasLabel = 'Structure Bullish';
      regimeLabel = 'Short Gamma \u00b7 Flow vs. Structure';
      regimeDesc = 'Dealers are net short gamma. Flow leans bearish while the structure signals lean bullish.';
      setup = 'Flow/Structure Split';
      playbook = [
        'Flow or structure losing its majority',
        'Net GEX turning positive, or the gradient strongly against it',
      ];
      expectedBehavior = [
        'Net GEX negative: dealers net short gamma',
        'Flow majority bearish; structure majority bullish',
        NOT_A_FORECAST,
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
      biasLabel = 'Flow Bullish';
      regimeLabel = 'Long Gamma \u00b7 Bullish Flow';
      regimeDesc = 'Dealers are net long gamma, and most flow signals lean bullish.';
      setup = 'Aligned Flow';
      playbook = [
        'Flow losing its bullish majority',
        'Net GEX turning negative, or the gradient strongly against it',
      ];
      expectedBehavior = [
        'Net GEX positive: dealers net long gamma',
        'Tape, vanna/charm and 0DTE flow: majority bullish',
        NOT_A_FORECAST,
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
      biasLabel = 'Flow Bearish';
      regimeLabel = 'Long Gamma \u00b7 Bearish Flow';
      regimeDesc = 'Dealers are net long gamma, and most flow signals lean bearish.';
      setup = 'Aligned Flow';
      playbook = [
        'Flow losing its bearish majority',
        'Net GEX turning negative, or the gradient strongly against it',
      ];
      expectedBehavior = [
        'Net GEX positive: dealers net long gamma',
        'Tape, vanna/charm and 0DTE flow: majority bearish',
        NOT_A_FORECAST,
      ];
      push(tapeFlow, -1);
      push(vannaCharm, -1);
      push(odtePositioning, -1);
      push(positioningTrap, -1);
      push(trapDetection, -1);
      push(gammaVWAP, -1);
      // Regime strength, like netGEX: pushed the same way as in TREND_UP.
      push(netGEX, 1);
      push(msi, 1);
      break;
    case 'CHOP': {
      trend = 'neutral';
      bias = 'RANGE_FADE';
      biasLabel = 'Mixed';
      regimeLabel = 'Mixed Signals';
      regimeDesc = 'The gamma regime, flow and structure signals do not line up into a defined state.';
      setup = 'No Defined State';
      playbook = [
        'Flow forming a majority while dealers are long gamma',
        'Flow and structure splitting while dealers are short gamma',
      ];
      expectedBehavior = [
        'No flow majority in long gamma, and no flow/structure split in short gamma',
        'Most minutes read this way; it does not mean the market is quiet',
        NOT_A_FORECAST,
      ];
      // Chop confidence rises as directional signals sit near zero; extreme
      // readings on either side reduce conviction in the range thesis.
      const pushChop = (v: number | null | undefined) => {
        if (v == null) return;
        biasScores.push(Math.max(0, (100 - Math.abs(v)) / 100));
      };
      pushChop(tapeFlow);
      pushChop(vannaCharm);
      pushChop(odtePositioning);
      pushChop(positioningTrap);
      pushChop(trapDetection);
      pushChop(gammaVWAP);
      pushChop(msi);
      break;
    }
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

  // True when the active regime would NOT have triggered without the DOMINANT
  // conviction bonus — i.e. a single high-conviction signal carried the
  // majority alone. UI surfaces this so traders can size knowing the regime
  // is one-signal-driven rather than broad-consensus.
  const flowMajorityFlat = (sign: 1 | -1) => flowVotes(sign, false) >= 2;
  const structureMajorityFlat = (sign: 1 | -1) => structureVotes(sign, false) >= 2;
  let convictionDriven = false;
  switch (marketState) {
    case 'TREND_UP':
      convictionDriven = !flowMajorityFlat(1);
      break;
    case 'TREND_DOWN':
      convictionDriven = !flowMajorityFlat(-1);
      break;
    case 'TRAP_REVERSAL':
      convictionDriven = !flowMajorityFlat(1) || !structureMajorityFlat(-1);
      break;
    case 'TRAP_SQUEEZE':
      convictionDriven = !flowMajorityFlat(-1) || !structureMajorityFlat(1);
      break;
  }

  // In CHOP, surface any signal that's at conviction levels but hasn't yet
  // pulled the regime directional — a "brewing" indicator so traders can see
  // a potential regime swap forming before it triggers.
  const watching: WatchingSignal[] = [];
  if (marketState === 'CHOP') {
    const check = (v: number | null, key: keyof typeof SIGNAL_LABELS) => {
      if (v == null || Math.abs(v) <= DOMINANT) return;
      watching.push({
        key,
        label: SIGNAL_LABELS[key],
        direction: v > 0 ? 'bullish' : 'bearish',
      });
    };
    check(tapeFlow, 'tapeFlow');
    check(vannaCharm, 'vannaCharm');
    check(odtePositioning, 'odtePositioning');
    check(positioningTrap, 'positioningTrap');
    check(trapDetection, 'trapDetection');
    check(gammaVWAP, 'gammaVWAP');
  }

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
    convictionDriven,
    watching,
  };
}
