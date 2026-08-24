// Unit tests for the Key Levels presentation model — the shared source of truth
// behind the top-of-page Key Levels strip, the My Dashboard "Key Levels" widget
// and (for the distance line) the existing PriceDistanceMetricCard wall cards.
//
// The rules that matter here are the ones a trader can be misled by:
//   • an unresolved level must render an em-dash and say why — never a blank
//     cell and never "$0.00", which would read as a real level at zero;
//   • the distance format must stay byte-identical to the wall cards', since
//     the whole point of the strip is that it IS the wall-card format;
//   • "No active pin" must only ever be claimed when there is genuinely no pin,
//     not when the pin is fine and the underlying price is what's missing.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildKeyLevels,
  computeMaxPainFromStrikes,
  formatKeyLevelValue,
  keyLevelDistance,
  keyLevelsRegime,
  KEY_LEVEL_EMPTY,
  type KeyLevel,
} from '../core/keyLevels.ts';
import {
  PIN_STRIKE_EMPTY,
  PIN_STRIKE_TOOLTIP,
  classifyPinStrength,
  pinStrengthLabel,
} from '../core/pinStrike.ts';

/**
 * The Pin card's copy is composed by the caller from core/pinStrike (see
 * KeyLevelsStrip). Building it the same way here locks the contract the strip
 * relies on instead of hard-coding strings the pin module could move.
 */
const pinInput = (strike: number | null, confidence: number | null) => {
  const strength = classifyPinStrength(strike, confidence);
  return {
    strike,
    note: strength === 'none' ? null : `Pin strength: ${pinStrengthLabel(strength)}`,
    absentLabel: pinStrengthLabel('none'),
    tooltip: PIN_STRIKE_TOOLTIP,
  };
};

const byId = (levels: KeyLevel[], id: string): KeyLevel => {
  const found = levels.find((l) => l.id === id);
  assert.ok(found, `expected a "${id}" level`);
  return found;
};

const RESOLVED = {
  spot: 610,
  spotChange: 1.22,
  spotChangePercent: 0.2,
  flip: 612.5,
  pin: pinInput(609, 0.62),
  callWall: 615,
  putWall: 605,
  maxPain: 608,
};

// ── Value formatting ────────────────────────────────────────────────────────

test('the empty glyph stays identical to the Pin Strike card’s', () => {
  // Restated rather than imported (core modules under the Node runner carry no
  // runtime imports), so this is the guard against the two drifting apart.
  assert.equal(KEY_LEVEL_EMPTY, PIN_STRIKE_EMPTY);
});

test('formatKeyLevelValue renders a dollar level at two decimals', () => {
  assert.equal(formatKeyLevelValue(612.5), '$612.50');
  assert.equal(formatKeyLevelValue(6012.345), '$6012.35');
});

test('formatKeyLevelValue never renders 0, NaN or a blank', () => {
  assert.equal(formatKeyLevelValue(null), KEY_LEVEL_EMPTY);
  assert.equal(formatKeyLevelValue(undefined), KEY_LEVEL_EMPTY);
  assert.equal(formatKeyLevelValue(NaN), KEY_LEVEL_EMPTY);
  assert.equal(formatKeyLevelValue(0), KEY_LEVEL_EMPTY);
  assert.equal(formatKeyLevelValue(-12), KEY_LEVEL_EMPTY);
});

// ── Distance from spot ──────────────────────────────────────────────────────

test('keyLevelDistance matches the wall cards’ subtitle format exactly', () => {
  const above = keyLevelDistance(612.5, 610);
  assert.ok(above);
  assert.equal(above.isAbove, true);
  assert.equal(above.deltaLabel, '+$2.50');
  assert.equal(above.pctLabel, '+0.41%');
  assert.equal(above.relationLabel, 'above spot');
  assert.equal(above.label, '+$2.50 / +0.41% above spot');

  const below = keyLevelDistance(605, 610);
  assert.ok(below);
  assert.equal(below.isAbove, false);
  assert.equal(below.deltaLabel, '-$5.00');
  assert.equal(below.pctLabel, '-0.82%');
  assert.equal(below.label, '-$5.00 / -0.82% below spot');
});

test('keyLevelDistance treats a level exactly at spot as "above" with a zero delta', () => {
  const at = keyLevelDistance(610, 610);
  assert.ok(at);
  assert.equal(at.isAbove, true);
  assert.equal(at.label, '+$0.00 / +0.00% above spot');
});

test('keyLevelDistance returns null when either side is missing', () => {
  assert.equal(keyLevelDistance(null, 610), null);
  assert.equal(keyLevelDistance(612, null), null);
  // A zero spot would divide by zero; it is absent data, not a price.
  assert.equal(keyLevelDistance(612, 0), null);
});

// ── The level set ───────────────────────────────────────────────────────────

test('buildKeyLevels returns the six levels in reading order', () => {
  const levels = buildKeyLevels(RESOLVED);
  assert.deepEqual(
    levels.map((l) => l.id),
    ['spot', 'flip', 'pin', 'callWall', 'putWall', 'maxPain'],
  );
  assert.deepEqual(
    levels.map((l) => l.label),
    ['Spot', 'Gamma Flip', 'Pin Strike', 'Call Wall', 'Put Wall', 'Max Pain'],
  );
});

test('buildKeyLevels formats each resolved level and its distance from spot', () => {
  const levels = buildKeyLevels(RESOLVED);
  const flip = byId(levels, 'flip');
  assert.equal(flip.valueLabel, '$612.50');
  assert.equal(flip.distance?.label, '+$2.50 / +0.41% above spot');
  assert.equal(flip.emptyNote, null);

  const putWall = byId(levels, 'putWall');
  assert.equal(putWall.valueLabel, '$605.00');
  assert.equal(putWall.distance?.isAbove, false);

  const maxPain = byId(levels, 'maxPain');
  assert.equal(maxPain.valueLabel, '$608.00');
  assert.equal(maxPain.distance?.label, '-$2.00 / -0.33% below spot');
});

test('the spot card carries the session change, not a distance from itself', () => {
  const spot = byId(buildKeyLevels(RESOLVED), 'spot');
  assert.equal(spot.valueLabel, '$610.00');
  assert.equal(spot.distance?.label, '+$1.22 / +0.20% vs prior close');
});

test('a spot with no change context says so rather than showing a zero move', () => {
  const spot = byId(buildKeyLevels({ ...RESOLVED, spotChange: null, spotChangePercent: null }), 'spot');
  assert.equal(spot.valueLabel, '$610.00');
  assert.equal(spot.distance, null);
  assert.equal(spot.emptyNote, 'Awaiting change context');
});

// ── Missing data ────────────────────────────────────────────────────────────

test('an unresolved level shows the em-dash and its reason, never 0 or blank', () => {
  // The regime the spec calls out: some books resolve no Gamma Flip at all.
  const levels = buildKeyLevels({ ...RESOLVED, flip: null });
  const flip = byId(levels, 'flip');
  assert.equal(flip.value, null);
  assert.equal(flip.valueLabel, KEY_LEVEL_EMPTY);
  assert.equal(flip.distance, null);
  assert.equal(flip.emptyNote, 'Unresolved this snapshot');
  assert.notEqual(flip.emptyNote, '');
});

test('a zero level from a degraded payload is treated as absent, not as $0.00', () => {
  const flip = byId(buildKeyLevels({ ...RESOLVED, flip: 0 }), 'flip');
  assert.equal(flip.value, null);
  assert.equal(flip.valueLabel, KEY_LEVEL_EMPTY);
});

test('with no underlying price every card reports the missing price, not a bad level', () => {
  const levels = buildKeyLevels({ ...RESOLVED, spot: null });
  for (const level of levels) {
    assert.equal(level.distance, null, `${level.id} should have no distance without spot`);
    assert.equal(level.emptyNote, 'Awaiting price', `${level.id} should blame the price`);
  }
  // The levels themselves still render — only the distance is unavailable.
  assert.equal(byId(levels, 'callWall').valueLabel, '$615.00');
});

// ── Pin Strike ──────────────────────────────────────────────────────────────

test('an active pin carries its strength as a note alongside the distance', () => {
  const pin = byId(buildKeyLevels(RESOLVED), 'pin');
  assert.equal(pin.valueLabel, '$609.00');
  assert.equal(pin.distance?.label, '-$1.00 / -0.16% below spot');
  assert.equal(pin.note, 'Pin strength: Strong');
});

test('no pin reads as "No active pin" and carries no strength', () => {
  const pin = byId(buildKeyLevels({ ...RESOLVED, pin: pinInput(null, null) }), 'pin');
  assert.equal(pin.valueLabel, KEY_LEVEL_EMPTY);
  assert.equal(pin.emptyNote, 'No active pin');
  assert.equal(pin.note, null);
});

test('a resolved pin with no spot must not claim there is no pin', () => {
  const pin = byId(buildKeyLevels({ ...RESOLVED, spot: null }), 'pin');
  assert.equal(pin.valueLabel, '$609.00');
  assert.equal(pin.emptyNote, 'Awaiting price');
  assert.equal(pin.note, 'Pin strength: Strong');
});

// ── Max Pain from a filtered book ───────────────────────────────────────────

test('computeMaxPainFromStrikes picks the minimum-writer-payout strike', () => {
  // All the open interest sits at 100, so settling there costs writers least.
  const strikes = [
    { strike: 90, call_oi: 10, put_oi: 0 },
    { strike: 95, call_oi: 20, put_oi: 0 },
    { strike: 100, call_oi: 200, put_oi: 200 },
    { strike: 105, call_oi: 0, put_oi: 20 },
    { strike: 110, call_oi: 0, put_oi: 10 },
  ];
  assert.equal(computeMaxPainFromStrikes(strikes), 100);
});

test('computeMaxPainFromStrikes coerces string columns and ignores blank strikes', () => {
  const strikes = [
    { strike: '90', call_oi: '10', put_oi: '0' },
    { strike: '', call_oi: '999', put_oi: '999' },
    { strike: '95', call_oi: '20', put_oi: '0' },
    { strike: '100', call_oi: '200', put_oi: '200' },
    { strike: '105', call_oi: '0', put_oi: '20' },
  ];
  // The blank strike must not become a $0 strike and win the minimisation.
  assert.equal(computeMaxPainFromStrikes(strikes), 100);
});

test('computeMaxPainFromStrikes returns null for a book too thin to read', () => {
  assert.equal(computeMaxPainFromStrikes(null), null);
  assert.equal(computeMaxPainFromStrikes(undefined), null);
  assert.equal(computeMaxPainFromStrikes([{ strike: 100, call_oi: 5, put_oi: 5 }]), null);
  // Three strikes but no open interest anywhere — nothing to minimise.
  assert.equal(
    computeMaxPainFromStrikes([
      { strike: 95, call_oi: 0, put_oi: 0 },
      { strike: 100, call_oi: 0, put_oi: 0 },
      { strike: 105, call_oi: 0, put_oi: 0 },
    ]),
    null,
  );
});

// ── Regime chip ─────────────────────────────────────────────────────────────

test('keyLevelsRegime labels the modeled regime and renders nothing when unknown', () => {
  assert.equal(keyLevelsRegime(null), null);
  assert.equal(keyLevelsRegime(true)?.label, 'Long γ');
  assert.equal(keyLevelsRegime(true)?.long, true);
  assert.equal(keyLevelsRegime(false)?.label, 'Short γ');
  assert.equal(keyLevelsRegime(false)?.long, false);
});
