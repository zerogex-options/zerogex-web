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
}

export const STRONG = 25;
export const MODERATE = 12;

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

  // Flow direction: 2-of-3 majority across tape, vanna/charm, and 0DTE
  // positioning. A single weak or contradicting signal no longer blocks the
  // regime — agreement among the majority is sufficient.
  const flowVotes = (sign: 1 | -1) => {
    let votes = 0;
    if (tapeFlow != null && tapeFlow * sign > STRONG) votes += 1;
    if (vannaCharm != null && vannaCharm * sign > MODERATE) votes += 1;
    if (odtePositioning != null && odtePositioning * sign > MODERATE) votes += 1;
    return votes;
  };
  const bullishFlow = flowVotes(1) >= 2;
  const bearishFlow = flowVotes(-1) >= 2;

  // Structure: 2-of-3 majority across positioning trap, trap detection,
  // and gamma/VWAP confluence.
  const structureVotes = (sign: 1 | -1) => {
    let votes = 0;
    if (positioningTrap != null && positioningTrap * sign > MODERATE) votes += 1;
    if (trapDetection != null && trapDetection * sign > STRONG) votes += 1;
    if (gammaVWAP != null && gammaVWAP * sign > MODERATE) votes += 1;
    return votes;
  };
  const bearishStructure = structureVotes(-1) >= 2;
  const bullishStructure = structureVotes(1) >= 2;

  let marketState: MarketState = 'UNKNOWN';
  if (isShortGamma && bullishFlow && bearishStructure) marketState = 'TRAP_REVERSAL';
  else if (isShortGamma && bearishFlow && bullishStructure) marketState = 'TRAP_SQUEEZE';
  else if (isLongGamma && bullishFlow && (msi == null || msi >= 0)) marketState = 'TREND_UP';
  else if (isLongGamma && bearishFlow && (msi == null || msi <= 0)) marketState = 'TREND_DOWN';
  else if (available >= 4) marketState = 'CHOP';

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
    case 'CHOP': {
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
