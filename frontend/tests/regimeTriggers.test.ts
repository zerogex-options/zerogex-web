// Regression tests for the "Regime Triggers · Readiness" card mapping.
//
// The bug these lock down: the card read `imminence` / `loading` out of each
// signal's `context_values`, but those responses carry their headline reading
// at the TOP LEVEL — `context_values` holds only the per-pillar breakdown. The
// lookups resolved to undefined, so Range Break Imminence and Market Pressure
// rendered "awaiting data" permanently while the dedicated
// /range-break-imminence and /market-pressure pages (which read the top level)
// showed live numbers.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRegimeTriggers,
  deriveImminenceState,
  deriveMarketPressureState,
  deriveVolExpansionState,
  extractDirection,
} from '../core/regimeTriggers.ts';

// Payloads shaped like the real API responses: headline fields at the top
// level, per-pillar breakdown nested under `context_values`.
const VOL_EXPANSION = {
  underlying: 'SPY',
  score: 41.2,
  direction: 'bullish',
  expansion: 72.4,
  magnitude: 41.2,
  context_values: {
    net_gex: -1.8e9,
    gex_regime: 'negative',
    expansion: 72.4,
    gex_readiness: 0.724,
    triggered: true,
  },
};

const RANGE_BREAK = {
  underlying: 'SPY',
  score: 68.0,
  imminence: 68.0,
  label: 'Break Watch',
  bias: 0.31,
  direction: 'bullish',
  triggered: true,
  context_values: {
    skew: { signed: 0.4, magnitude: 62.0 },
    dealer: { signed: -0.2, magnitude: 31.0 },
    trap: { side: 'none', signed: 0, magnitude: 0 },
    compression: { ratio: 0.7, magnitude: 55.0 },
    weights: { skew: 30, dealer: 25, trap: 25, compression: 20 },
  },
};

const MARKET_PRESSURE = {
  underlying: 'SPY',
  score: 33.5,
  loading: 58.2,
  label: 'Loaded',
  direction: 'bearish',
  direction_value: -0.42,
  confidence_mult: 1.15,
  triggered: true,
  context_values: {
    compression: { magnitude: 0.61, wall_pinch: 0.7 },
    hedging: { magnitude: 0.55, signed: -0.3 },
    flow: { magnitude: 0.48, signed: -0.5 },
    tension: { magnitude: 0.72, iv_rank: 0.2 },
    weights: { hedging: 0.45, flow: 0.4, dealer: 0.15 },
  },
};

test('headline readings come from the top level, not context_values', () => {
  const [vol, rangeBreak, marketPressure] = buildRegimeTriggers(
    VOL_EXPANSION,
    RANGE_BREAK,
    MARKET_PRESSURE,
  );

  assert.equal(vol.magnitude, 72.4);
  // The two that regressed: both must resolve to a live number, never null.
  assert.equal(rangeBreak.magnitude, 68.0);
  assert.equal(marketPressure.magnitude, 58.2);
});

test('a populated payload never renders as "awaiting data"', () => {
  for (const trigger of buildRegimeTriggers(VOL_EXPANSION, RANGE_BREAK, MARKET_PRESSURE)) {
    assert.notEqual(trigger.magnitude, null, `${trigger.key} magnitude went null`);
    assert.notEqual(trigger.state, null, `${trigger.key} state went null`);
  }
});

test('backend label wins over the derived band', () => {
  const [, rangeBreak, marketPressure] = buildRegimeTriggers(
    VOL_EXPANSION,
    RANGE_BREAK,
    MARKET_PRESSURE,
  );
  assert.equal(rangeBreak.state, 'Break Watch');
  assert.equal(marketPressure.state, 'Loaded');
});

// Drop a key from a fixture without a destructure-to-omit (which reads as an
// unused variable to the linter).
function omit<T extends object>(source: T, key: keyof T): Partial<T> {
  const copy: Partial<T> = { ...source };
  delete copy[key];
  return copy;
}

test('a missing label falls back to the same bands the deep-dive pages use', () => {
  const [vol, rangeBreak, marketPressure] = buildRegimeTriggers(
    VOL_EXPANSION,
    omit(RANGE_BREAK, 'label'),
    omit(MARKET_PRESSURE, 'label'),
  );
  assert.equal(vol.state, 'Loaded');          // 72.4 ≥ 70
  assert.equal(rangeBreak.state, 'Break Watch');   // 68.0 ≥ 65
  assert.equal(marketPressure.state, 'Loaded');    // 58.2 ≥ 50
});

test('direction tags are read from the fields the API actually sends', () => {
  const [vol, rangeBreak, marketPressure] = buildRegimeTriggers(
    VOL_EXPANSION,
    RANGE_BREAK,
    MARKET_PRESSURE,
  );
  assert.equal(vol.direction, 'bullish');
  assert.equal(rangeBreak.direction, 'bullish');
  assert.equal(marketPressure.direction, 'bearish');
});

test('market pressure direction falls back to the sign of direction_value', () => {
  const [, , marketPressure] = buildRegimeTriggers(
    VOL_EXPANSION,
    RANGE_BREAK,
    omit(MARKET_PRESSURE, 'direction'),
  );
  assert.equal(marketPressure.direction, 'bearish');
});

test('a nested headline still resolves (defensive fallback)', () => {
  const nested = { context_values: { imminence: 44.0 } };
  const [, rangeBreak] = buildRegimeTriggers(null, nested, null);
  assert.equal(rangeBreak.magnitude, 44.0);
  assert.equal(rangeBreak.state, 'Weak Range');
});

test('genuinely absent data stays null so the card can say so', () => {
  for (const trigger of buildRegimeTriggers(null, undefined, {})) {
    assert.equal(trigger.magnitude, null);
    assert.equal(trigger.state, null);
    assert.equal(trigger.direction, null);
  }
});

test('band edges match the dedicated pages', () => {
  assert.equal(deriveImminenceState(80), 'Breakout Mode');
  assert.equal(deriveImminenceState(65), 'Break Watch');
  assert.equal(deriveImminenceState(40), 'Weak Range');
  assert.equal(deriveImminenceState(39.9), 'Range-Bound');
  assert.equal(deriveImminenceState(null), null);

  assert.equal(deriveMarketPressureState(75), 'Critical');
  assert.equal(deriveMarketPressureState(50), 'Loaded');
  assert.equal(deriveMarketPressureState(25), 'Building');
  assert.equal(deriveMarketPressureState(24.9), 'Discharged');
  assert.equal(deriveMarketPressureState(null), null);

  assert.equal(deriveVolExpansionState(70), 'Loaded');
  assert.equal(deriveVolExpansionState(40), 'Building');
  assert.equal(deriveVolExpansionState(39.9), 'Quiet');
  assert.equal(deriveVolExpansionState(null), null);
});

test('extractDirection handles both the string tag and a signed number', () => {
  assert.equal(extractDirection('Bullish'), 'bullish');
  assert.equal(extractDirection('bearish'), 'bearish');
  assert.equal(extractDirection('neutral'), 'neutral');
  assert.equal(extractDirection(0.4), 'bullish');
  assert.equal(extractDirection(-0.4), 'bearish');
  assert.equal(extractDirection(0), 'neutral');
  assert.equal(extractDirection('sideways'), null);
  assert.equal(extractDirection(undefined), null);
  assert.equal(extractDirection(Number.NaN), null);
});

// A zero reading is real data ("Discharged" / "Range-Bound"), not missing data.
test('a zero magnitude is data, not a gap', () => {
  const [, rangeBreak, marketPressure] = buildRegimeTriggers(
    null,
    { imminence: 0 },
    { loading: 0 },
  );
  assert.equal(rangeBreak.magnitude, 0);
  assert.equal(rangeBreak.state, 'Range-Bound');
  assert.equal(marketPressure.magnitude, 0);
  assert.equal(marketPressure.state, 'Discharged');
});
