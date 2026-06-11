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
    msi: -50,
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

test('TREND_UP blocked when MSI is outside tolerance band; falls through to CHOP', () => {
  const bullishExceptMsi = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: 60,
    msi: -15,
  });
  assert.equal(bullishExceptMsi.marketState, 'CHOP');
  assert.equal(bullishExceptMsi.trend, 'neutral');
});

test('MSI within tolerance band does not block TREND_UP', () => {
  const result = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: 60,
    msi: -8,
  });
  assert.equal(result.marketState, 'TREND_UP');
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
