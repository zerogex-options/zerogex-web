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

test('TREND_UP requires MSI non-negative; negative MSI falls through to CHOP', () => {
  const bullishExceptMsi = computeBias({
    ...empty,
    netGEX: 50,
    gexGradient: 60,
    tapeFlow: 80,
    vannaCharm: 60,
    odtePositioning: 60,
    msi: -10,
  });
  assert.equal(bullishExceptMsi.marketState, 'CHOP');
  assert.equal(bullishExceptMsi.trend, 'neutral');
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
    tapeFlow: 50,
    vannaCharm: 30,
    odtePositioning: 30,
    msi: 50,
  });
  assert.notEqual(result.marketState, 'TREND_UP');
});
