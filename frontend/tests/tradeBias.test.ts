import test from 'node:test';
import assert from 'node:assert/strict';
import { computeBias, type BiasInput } from '../core/tradeBias.ts';

const empty: BiasInput = {
  netGEX: null,
  gexGradient: null,
  tapeFlow: null,
  vannaCharm: null,
  odtePositioning: null,
  positioningTrap: null,
  trapDetection: null,
  gammaVWAP: null,
  msi: null,
};

test('TREND_UP — long gamma + bullish flow → bullish/green', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: 60,
    positioningTrap: 40,
    trapDetection: 60,
    gammaVWAP: 40,
    msi: 50,
  });
  assert.equal(result.marketState, 'TREND_UP');
  assert.equal(result.trend, 'bullish');
  assert.equal(result.bias, 'BUY_DIPS');
  assert.ok(result.confidence > 0);
  assert.equal(result.hasData, true);
});

test('TREND_DOWN — long gamma + bearish flow → bearish/red', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: -80,
    vannaCharm: -60,
    odtePositioning: -60,
    positioningTrap: -40,
    trapDetection: -60,
    gammaVWAP: -40,
    // msi is the 0-100 composite. 35 used to block TREND_DOWN outright.
    msi: 35,
  });
  assert.equal(result.marketState, 'TREND_DOWN');
  assert.equal(result.trend, 'bearish');
  assert.equal(result.bias, 'SELL_RIPS');
});

test('TRAP_REVERSAL — short gamma + bullish flow + bearish structure → bearish/red', () => {
  const result = computeBias({
    ...empty,
    netGEX: -50,
    gexGradient: -60,
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: 60,
    positioningTrap: -40,
    trapDetection: -60,
    gammaVWAP: -40,
    msi: 0,
  });
  assert.equal(result.marketState, 'TRAP_REVERSAL');
  assert.equal(result.trend, 'bearish');
  assert.equal(result.bias, 'FADE_STRENGTH');
});

test('TRAP_SQUEEZE — short gamma + bearish flow + bullish structure → bullish/green', () => {
  const result = computeBias({
    ...empty,
    netGEX: -50,
    gexGradient: -60,
    tapeFlow: -80,
    vannaCharm: -60,
    odtePositioning: -60,
    positioningTrap: 40,
    trapDetection: 60,
    gammaVWAP: 40,
    msi: 0,
  });
  assert.equal(result.marketState, 'TRAP_SQUEEZE');
  assert.equal(result.trend, 'bullish');
  assert.equal(result.bias, 'FADE_WEAKNESS');
});

test('CHOP — mixed signals with ≥4 inputs → neutral/amber', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: -60,
    tapeFlow: 10,
    vannaCharm: -10,
    odtePositioning: 5,
  });
  assert.equal(result.marketState, 'CHOP');
  assert.equal(result.trend, 'neutral');
  assert.equal(result.bias, 'RANGE_FADE');
});

test('CHOP confidence — near-zero signals score high, extremes score low', () => {
  const calm = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: -60,
    tapeFlow: 5,
    vannaCharm: -5,
    odtePositioning: 5,
    positioningTrap: 5,
    trapDetection: -5,
    gammaVWAP: 5,
    msi: 0,
  });
  const noisy = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: -60,
    tapeFlow: 90,
    vannaCharm: -90,
    odtePositioning: 90,
    positioningTrap: -90,
    trapDetection: 90,
    gammaVWAP: -90,
    msi: 90,
  });
  assert.equal(calm.marketState, 'CHOP');
  assert.equal(noisy.marketState, 'CHOP');
  assert.ok(calm.confidence > 0, 'calm chop should accumulate confidence');
  assert.ok(calm.confidence > noisy.confidence, 'calm chop > noisy chop');
});

test('UNKNOWN — too few inputs → neutral/amber + hasData false', () => {
  const result = computeBias({
    ...empty,
    tapeFlow: 10,
    vannaCharm: -10,
  });
  assert.equal(result.marketState, 'UNKNOWN');
  assert.equal(result.trend, 'neutral');
  assert.equal(result.bias, 'WAIT');
  assert.equal(result.hasData, false);
});

test('hasData flips true at ≥3 available inputs', () => {
  const two = computeBias({ ...empty, tapeFlow: 10, vannaCharm: -10 });
  const three = computeBias({ ...empty, tapeFlow: 10, vannaCharm: -10, netGEX: 50 });
  assert.equal(two.hasData, false);
  assert.equal(three.hasData, true);
});

// The MSI is 0-100 regime strength. It used to gate the trend states as if it
// ran -100..+100: TREND_UP's `msi >= -10` always passed, while TREND_DOWN's
// `msi <= 10` needed the gauge at 10 or below.
test('MSI never gates either trend state', () => {
  for (const msi of [null, 0, 10, 11, 35, 65, 100]) {
    const up = computeBias({
      ...empty,
      netGEX: 50,
      gexGradient: 60,
      tapeFlow: 80,
      vannaCharm: 60,
      odtePositioning: 60,
      msi,
    });
    const down = computeBias({
      ...empty,
      netGEX: 50,
      gexGradient: 60,
      tapeFlow: -80,
      vannaCharm: -60,
      odtePositioning: -60,
      msi,
    });
    assert.equal(up.marketState, 'TREND_UP', `msi=${msi}`);
    assert.equal(down.marketState, 'TREND_DOWN', `msi=${msi}`);
  }
});

test('TREND_DOWN is the mirror of TREND_UP', () => {
  for (const msi of [5, 35, 80]) {
    const up = computeBias({
      ...empty,
      netGEX: 50,
      gexGradient: 60,
      tapeFlow: 80,
      vannaCharm: 60,
      odtePositioning: 60,
      positioningTrap: 40,
      trapDetection: 60,
      gammaVWAP: 40,
      msi,
    });
    const down = computeBias({
      ...empty,
      netGEX: 50,
      gexGradient: 60,
      tapeFlow: -80,
      vannaCharm: -60,
      odtePositioning: -60,
      positioningTrap: -40,
      trapDetection: -60,
      gammaVWAP: -40,
      msi,
    });
    assert.deepEqual([up.bias, down.bias], ['BUY_DIPS', 'SELL_RIPS']);
    assert.equal(down.confidence, up.confidence, `msi=${msi}`);
    assert.equal(down.convictionDriven, up.convictionDriven, `msi=${msi}`);
  }
});

// SPX at 11:30 ET on 2026-09-23 (the session readout): long gamma by total net
// GEX, tape and vanna/charm both leaning bearish, MSI 14.5 -- and the panel
// said Range-Bound while SPX fell another 15 points.
test('2026-09-23 SPX late morning reads TREND_DOWN', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: -7,
    tapeFlow: -35,
    vannaCharm: -19,
    odtePositioning: -6,
    msi: 14.5,
  });
  assert.equal(result.marketState, 'TREND_DOWN');
  assert.equal(result.bias, 'SELL_RIPS');
});

test('single dominant flow signal carries the majority by itself', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: 80,
    vannaCharm: -15,
    odtePositioning: -5,
    msi: 20,
  });
  assert.equal(result.marketState, 'TREND_UP');
  assert.equal(result.bias, 'BUY_DIPS');
  assert.equal(result.convictionDriven, true);
});

test('broad-consensus regime is not flagged as conviction-driven', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: 40,
    vannaCharm: 30,
    odtePositioning: 30,
    msi: 30,
  });
  assert.equal(result.marketState, 'TREND_UP');
  assert.equal(result.convictionDriven, false);
});

test('CHOP regime never flags convictionDriven', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: -60,
    tapeFlow: 5,
    vannaCharm: -5,
    odtePositioning: 5,
    msi: 0,
  });
  assert.equal(result.marketState, 'CHOP');
  assert.equal(result.convictionDriven, false);
});

test('CHOP surfaces a "watching" entry for each signal at conviction levels', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: -60,
    tapeFlow: 80,
    vannaCharm: -80,
    odtePositioning: 5,
    msi: 0,
  });
  assert.equal(result.marketState, 'CHOP');
  const tape = result.watching.find((w) => w.key === 'tapeFlow');
  const vanna = result.watching.find((w) => w.key === 'vannaCharm');
  assert.equal(tape?.direction, 'bullish');
  assert.equal(vanna?.direction, 'bearish');
  assert.equal(result.watching.length, 2);
});

test('directional regimes do not surface "watching" entries', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: 60,
    msi: 30,
  });
  assert.equal(result.marketState, 'TREND_UP');
  assert.equal(result.watching.length, 0);
});

test('CHOP with no conviction-level signals has empty watching list', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: -60,
    tapeFlow: 30,
    vannaCharm: -30,
    odtePositioning: 5,
    msi: 0,
  });
  assert.equal(result.marketState, 'CHOP');
  assert.equal(result.watching.length, 0);
});

test('single dominant structure signal carries the majority by itself', () => {
  const result = computeBias({
    ...empty,
    netGEX: -50,
    gexGradient: -60,
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: 60,
    positioningTrap: -10,
    trapDetection: -80,
    gammaVWAP: 5,
    msi: 0,
  });
  assert.equal(result.marketState, 'TRAP_REVERSAL');
});

test('opposing dominant flow signals cancel — no directional regime', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: 80,
    vannaCharm: -80,
    odtePositioning: -5,
    msi: 0,
  });
  assert.equal(result.marketState, 'CHOP');
});

test('confidence clamps into [0, maxConfidence]', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: 100,
    vannaCharm: 100,
    odtePositioning: 100,
    positioningTrap: 100,
    trapDetection: 100,
    gammaVWAP: 100,
    msi: 100,
  });
  assert.ok(result.confidence >= 0);
  assert.ok(result.confidence <= result.maxConfidence);
});

test('checklist reports short-gamma + trap-trigger + divergence flags', () => {
  const result = computeBias({
    ...empty,
    netGEX: -50,
    gexGradient: -60,
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: 60,
    positioningTrap: -40,
    trapDetection: -60,
    gammaVWAP: -40,
  });
  const pass = (label: string) => result.checklist.find((r) => r.label === label)?.passed;
  assert.equal(pass('Short-gamma regime'), true);
  assert.equal(pass('Call-heavy tape flow'), true);
  assert.equal(pass('Trap detection triggered'), true);
  assert.equal(pass('Structure/flow divergence'), true);
});

test('just-below-threshold flow does not trigger TREND_UP', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: 25,
    vannaCharm: 12,
    odtePositioning: 12,
    msi: 50,
  });
  assert.notEqual(result.marketState, 'TREND_UP');
});

test('TREND_UP fires with 2-of-3 flow majority (one mixed signal)', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: -5, // contradicts but doesn't block the majority
    msi: 30,
  });
  assert.equal(result.marketState, 'TREND_UP');
  assert.equal(result.bias, 'BUY_DIPS');
});

test('TRAP_REVERSAL fires with 2-of-3 structure majority', () => {
  const result = computeBias({
    ...empty,
    netGEX: -50,
    gexGradient: -60,
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: 60,
    positioningTrap: -40,
    trapDetection: -60,
    gammaVWAP: 5, // contradicts but doesn't block the majority
    msi: 0,
  });
  assert.equal(result.marketState, 'TRAP_REVERSAL');
  assert.equal(result.bias, 'FADE_STRENGTH');
});

test('strongly contradicting GEX gradient blocks long-gamma regime', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: -60, // strongly negative — vetoes long gamma
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: 60,
    msi: 30,
  });
  assert.notEqual(result.marketState, 'TREND_UP');
  assert.equal(result.marketState, 'CHOP');
});

test('mildly contradicting GEX gradient does not block long-gamma regime', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: -10, // weakly negative — within MODERATE veto band
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: 60,
    msi: 30,
  });
  assert.equal(result.marketState, 'TREND_UP');
});

// The copy describes where positioning and flow stand; it gives no trade
// instruction and makes no forecast (see the note in core/tradeBias.ts). The
// same table is pinned against the backend port in zerogex-oa
// tests/test_trade_bias.py, so the two copies cannot drift apart without a
// test failing on one side.
const NOT_A_FORECAST = 'A description of the current read, not a forecast';

const STATE_INPUTS: Record<string, Partial<BiasInput>> = {
  TREND_UP: { netGEX: 50, gexGradient: 60, tapeFlow: 80, vannaCharm: 60, odtePositioning: 60, msi: 50 },
  TREND_DOWN: { netGEX: 50, gexGradient: 60, tapeFlow: -80, vannaCharm: -60, odtePositioning: -60, msi: 50 },
  TRAP_REVERSAL: {
    netGEX: -50, gexGradient: -60, tapeFlow: 80, vannaCharm: 60, odtePositioning: 60,
    positioningTrap: -40, trapDetection: -60, gammaVWAP: -40,
  },
  TRAP_SQUEEZE: {
    netGEX: -50, gexGradient: -60, tapeFlow: -80, vannaCharm: -60, odtePositioning: -60,
    positioningTrap: 40, trapDetection: 60, gammaVWAP: 40,
  },
  CHOP: { netGEX: 50, gexGradient: 0, tapeFlow: 0, vannaCharm: 0, odtePositioning: 0, msi: 50 },
  UNKNOWN: { netGEX: 50, tapeFlow: 0, msi: 50 },
};

const STATE_COPY: Record<string, {
  code: string; regime: string; desc: string; lean: string; state: string; shows: string[]; changes: string[];
}> = {
  TREND_UP: {
    code: 'BUY_DIPS',
    regime: 'Long Gamma · Bullish Flow',
    desc: 'Dealers are net long gamma, and most flow signals lean bullish.',
    lean: 'Flow Bullish',
    state: 'Aligned Flow',
    shows: ['Net GEX positive: dealers net long gamma', 'Tape, vanna/charm and 0DTE flow: majority bullish', NOT_A_FORECAST],
    changes: ['Flow losing its bullish majority', 'Net GEX turning negative, or the gradient strongly against it'],
  },
  TREND_DOWN: {
    code: 'SELL_RIPS',
    regime: 'Long Gamma · Bearish Flow',
    desc: 'Dealers are net long gamma, and most flow signals lean bearish.',
    lean: 'Flow Bearish',
    state: 'Aligned Flow',
    shows: ['Net GEX positive: dealers net long gamma', 'Tape, vanna/charm and 0DTE flow: majority bearish', NOT_A_FORECAST],
    changes: ['Flow losing its bearish majority', 'Net GEX turning negative, or the gradient strongly against it'],
  },
  TRAP_REVERSAL: {
    code: 'FADE_STRENGTH',
    regime: 'Short Gamma · Flow vs. Structure',
    desc: 'Dealers are net short gamma. Flow leans bullish while the structure signals lean bearish.',
    lean: 'Structure Bearish',
    state: 'Flow/Structure Split',
    shows: ['Net GEX negative: dealers net short gamma', 'Flow majority bullish; structure majority bearish', NOT_A_FORECAST],
    changes: ['Flow or structure losing its majority', 'Net GEX turning positive, or the gradient strongly against it'],
  },
  TRAP_SQUEEZE: {
    code: 'FADE_WEAKNESS',
    regime: 'Short Gamma · Flow vs. Structure',
    desc: 'Dealers are net short gamma. Flow leans bearish while the structure signals lean bullish.',
    lean: 'Structure Bullish',
    state: 'Flow/Structure Split',
    shows: ['Net GEX negative: dealers net short gamma', 'Flow majority bearish; structure majority bullish', NOT_A_FORECAST],
    changes: ['Flow or structure losing its majority', 'Net GEX turning positive, or the gradient strongly against it'],
  },
  CHOP: {
    code: 'RANGE_FADE',
    regime: 'Mixed Signals',
    desc: 'The gamma regime, flow and structure signals do not line up into a defined state.',
    lean: 'Mixed',
    state: 'No Defined State',
    shows: [
      'No flow majority in long gamma, and no flow/structure split in short gamma',
      'Most minutes read this way; it does not mean the market is quiet',
      NOT_A_FORECAST,
    ],
    changes: ['Flow forming a majority while dealers are long gamma', 'Flow and structure splitting while dealers are short gamma'],
  },
  UNKNOWN: {
    code: 'WAIT',
    regime: 'Not Enough Data',
    desc: 'Fewer than four of the nine inputs are reporting.',
    lean: 'No Read',
    state: 'No Defined State',
    shows: ['Waiting on more inputs to report', NOT_A_FORECAST],
    changes: ['More of the nine inputs reporting'],
  },
};

// Trade instructions and movement promises the copy used to make.
const INSTRUCTION =
  /\b(buy|sell|enter|entry|target|trail|stops?|fade|favor|avoid|dips|rips|longs|shorts|puts|calls|theta|expansion|squeeze|reversal|grind|drift|pin|magnet|chop|range-bound|breakout)\b/i;

for (const [state, inputs] of Object.entries(STATE_INPUTS)) {
  test(`${state} copy describes where things stand and does not instruct`, () => {
    const r = computeBias({ ...empty, ...inputs });
    const expected = STATE_COPY[state];
    assert.equal(r.marketState, state);
    assert.equal(r.bias, expected.code); // TradeWorkz and the API key off the codes
    assert.deepEqual(
      [r.regimeLabel, r.regimeDesc, r.biasLabel, r.setup],
      [expected.regime, expected.desc, expected.lean, expected.state],
    );
    assert.deepEqual(r.expectedBehavior, expected.shows);
    assert.deepEqual(r.playbook, expected.changes);
    for (const line of [r.regimeLabel, r.regimeDesc, r.biasLabel, r.setup, ...r.playbook, ...r.expectedBehavior]) {
      assert.doesNotMatch(line, INSTRUCTION, `${state}: ${line}`);
    }
  });
}
