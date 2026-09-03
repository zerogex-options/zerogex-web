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
  flipDirectionBetween,
  flipSymbol,
  formatKeyLevelValue,
  keyLevelDistance,
  keyLevelsRegime,
  levelSourceChain,
  unresolvedLevelTooltip,
  KEY_LEVEL_EMPTY,
  LEVEL_AWAITING_PRICE_NOTE,
  LEVEL_UNRESOLVED_NOTE,
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
  // The blank strike must not become a $0 strike and win the minimization.
  assert.equal(computeMaxPainFromStrikes(strikes), 100);
});

test('computeMaxPainFromStrikes returns null for a book too thin to read', () => {
  assert.equal(computeMaxPainFromStrikes(null), null);
  assert.equal(computeMaxPainFromStrikes(undefined), null);
  assert.equal(computeMaxPainFromStrikes([{ strike: 100, call_oi: 5, put_oi: 5 }]), null);
  // Three strikes but no open interest anywhere — nothing to minimize.
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

// ── Flipping between symbols ────────────────────────────────────────────────

const RING = ['SPY', 'QQQ', 'SPX', 'NDX', 'ES', 'NQ'] as const;

test('flipSymbol steps forward and backward through the ring', () => {
  assert.equal(flipSymbol(RING, 'SPY', 1), 'QQQ');
  assert.equal(flipSymbol(RING, 'QQQ', 1), 'SPX');
  assert.equal(flipSymbol(RING, 'QQQ', -1), 'SPY');
  assert.equal(flipSymbol(RING, 'NDX', -1), 'SPX');
});

test('flipSymbol wraps at both ends so neither arrow dead-ends', () => {
  assert.equal(flipSymbol(RING, 'NQ', 1), 'SPY');
  assert.equal(flipSymbol(RING, 'SPY', -1), 'NQ');
});

test('flipSymbol treats any non-negative delta as forward and negative as back', () => {
  assert.equal(flipSymbol(RING, 'SPY', 0), 'QQQ');
  assert.equal(flipSymbol(RING, 'SPY', 5), 'QQQ');
  assert.equal(flipSymbol(RING, 'SPY', -5), 'NQ');
});

test('flipSymbol lands on the first symbol when the current one is unknown', () => {
  // A symbol the picker does not carry (a stale persisted value, a future
  // underlying) must not make the arrows guess an offset from nothing.
  assert.equal(flipSymbol(RING, 'TSLA', 1), 'SPY');
  assert.equal(flipSymbol(RING, 'TSLA', -1), 'SPY');
  assert.equal(flipSymbol(RING, '', 1), 'SPY');
});

test('flipSymbol returns null when there is nowhere to flip — no affordance', () => {
  assert.equal(flipSymbol([], 'SPY', 1), null);
  assert.equal(flipSymbol(['SPY'], 'SPY', 1), null);
  assert.equal(flipSymbol(['SPY'], 'SPY', -1), null);
});

test('flipDirectionBetween takes the shortest way round the ring', () => {
  // A one-step flip — what the arrows and a swipe always do — is never a tie,
  // so the animation direction is exact for every gesture.
  assert.equal(flipDirectionBetween(RING, 'SPY', 'QQQ'), 'next');
  assert.equal(flipDirectionBetween(RING, 'QQQ', 'SPY'), 'prev');
  assert.equal(flipDirectionBetween(RING, 'NQ', 'SPY'), 'next');
  assert.equal(flipDirectionBetween(RING, 'SPY', 'NQ'), 'prev');
});

test('flipDirectionBetween handles a jump made from outside the strip', () => {
  // The page's own symbol picker can move several steps at once; the strip
  // still animates whichever way is shorter.
  assert.equal(flipDirectionBetween(RING, 'SPY', 'SPX'), 'next');
  assert.equal(flipDirectionBetween(RING, 'SPX', 'SPY'), 'prev');
  assert.equal(flipDirectionBetween(RING, 'NQ', 'QQQ'), 'next');
});

test('flipDirectionBetween resolves ties, unknowns and no-ops forward', () => {
  // Directly opposite on an even ring — either answer is as true as the other.
  assert.equal(flipDirectionBetween(RING, 'SPY', 'NDX'), 'next');
  assert.equal(flipDirectionBetween(RING, 'SPY', 'SPY'), 'next');
  assert.equal(flipDirectionBetween(RING, 'TSLA', 'SPY'), 'next');
  assert.equal(flipDirectionBetween(RING, 'SPY', 'TSLA'), 'next');
  assert.equal(flipDirectionBetween([], 'SPY', 'QQQ'), 'next');
});

// ---------------------------------------------------------------------------
// The empty state's EXPLANATION — the copy that has to answer "why is there no
// data for /NQ" before a customer writes in to ask. An unresolved level is a
// declined publish, and the difference between that and a broken feed only
// exists if this copy says so.
// ---------------------------------------------------------------------------

test('the empty-state notes are the ones the cards render', () => {
  // PriceDistanceMetricCard composes its subtitle from these, so a reword here
  // is a reword there — that is the point of exporting them.
  const levels = buildKeyLevels({
    spot: 600,
    flip: null,
    pin: pinInput(null, null),
    callWall: 610,
    putWall: 590,
    maxPain: 600,
  });
  assert.equal(byId(levels, 'flip').emptyNote, LEVEL_UNRESOLVED_NOTE);

  const noSpot = buildKeyLevels({
    spot: null,
    flip: 598,
    pin: pinInput(null, null),
    callWall: null,
    putWall: null,
    maxPain: null,
  });
  assert.equal(byId(noSpot, 'flip').emptyNote, LEVEL_AWAITING_PRICE_NOTE);
});

test('levelSourceChain names the chain a futures symbol resolves from', () => {
  // ES / NQ carry no chain of their own: the backend runs the SPX / NDX
  // handler and converts the price fields onto the futures axis.
  assert.equal(levelSourceChain('NQ'), 'NDX');
  assert.equal(levelSourceChain('nq'), 'NDX');
  assert.equal(levelSourceChain(' ES '), 'SPX');
  assert.equal(levelSourceChain('RTY'), 'RUT');
  assert.equal(levelSourceChain('YM'), 'DJX');
});

test('levelSourceChain returns null for a symbol that IS its own chain', () => {
  // Null is what suppresses the "resolved from …" clause — a cash symbol has
  // nothing to attribute, and claiming otherwise would be wrong, not just noisy.
  for (const own of ['SPX', 'SPY', 'QQQ', 'NDX', 'TSLA']) {
    assert.equal(levelSourceChain(own), null, `${own} is its own chain`);
  }
  assert.equal(levelSourceChain(null), null);
  assert.equal(levelSourceChain(undefined), null);
  assert.equal(levelSourceChain(''), null);
});

test('the unresolved explainer says it is a declined publish, not a gap', () => {
  const copy = unresolvedLevelTooltip('Gamma Flip', 'SPX');
  assert.match(copy, /^Gamma Flip is published only when/);
  // The three things a trader needs: why it is blank, that it recovers, and
  // what still works meanwhile.
  assert.match(copy, /open\s+interest/);
  assert.match(copy, /later\s+snapshot/);
  assert.match(copy, /Net GEX/);
  // A cash symbol must not be told about a chain it does not borrow from.
  assert.ok(!copy.includes('no options chain of its own'));
});

test('the unresolved explainer blames the right chain on ES / NQ', () => {
  // The load-bearing sentence: a blank NQ flip is an NDX snapshot with no
  // publishable crossing, not missing NQ data.
  const nq = unresolvedLevelTooltip('Gamma Flip', 'NQ');
  assert.match(nq, /NQ has no options chain of its own/);
  assert.match(nq, /computed from the NDX chain/);
  assert.match(nq, /it is the NDX snapshot that came back without one/);

  const es = unresolvedLevelTooltip('Gamma Flip', 'es');
  assert.match(es, /ES has no options chain of its own/);
  assert.match(es, /the SPX chain/);
});

test('the unresolved explainer carries the level it is explaining', () => {
  // One shared body serves every priced card, so the level's own name has to
  // lead — a Max Pain card must not explain the gamma flip.
  assert.match(unresolvedLevelTooltip('Max Pain', 'SPY'), /^Max Pain is published only when/);
  assert.match(unresolvedLevelTooltip('Call Wall', null), /^Call Wall is published only when/);
});

test('buildKeyLevels swaps the definition for the explainer on an unresolved level', () => {
  // The strip carries ONE native tooltip per card. When there is no level, the
  // definition is the least useful thing it could say — so the explainer takes
  // the slot, and it names the chain when the symbol borrows one.
  const nq = buildKeyLevels({ ...RESOLVED, symbol: 'NQ', flip: null });
  const flip = byId(nq, 'flip');
  assert.equal(flip.valueLabel, KEY_LEVEL_EMPTY);
  assert.equal(flip.emptyNote, LEVEL_UNRESOLVED_NOTE);
  assert.match(flip.tooltip, /^Gamma Flip is published only when/);
  assert.match(flip.tooltip, /computed from the NDX chain/);
  // Its resolved neighbours keep their definitions — only the empty card changes.
  assert.match(byId(nq, 'callWall').tooltip, /heaviest call open interest/);
});

test('buildKeyLevels keeps the definition while the price is what is missing', () => {
  // No spot means no distance, but the LEVEL may be perfectly fine — calling it
  // unresolved there would be the same wrong claim the card's subtitle avoids.
  const levels = buildKeyLevels({ ...RESOLVED, symbol: 'NQ', spot: null });
  assert.match(byId(levels, 'flip').tooltip, /where aggregate net dealer gamma changes sign/);
});

test('the unresolved explainer tells the strike story for a wall or max pain', () => {
  // Max Pain is a RANKING over strikes, not a root of the gamma profile, so the
  // flip's "no zero crossing" wording would be a claim about the wrong thing.
  const strike = unresolvedLevelTooltip('Max Pain', 'SPY', 'strike');
  assert.match(strike, /^Max Pain is ranked over the strikes/);
  assert.match(strike, /no strike qualifies/);
  assert.ok(!strike.includes('zero crossing'), 'a strike ranking has no crossing');

  // And buildKeyLevels picks the story per level rather than one for all.
  const thin = buildKeyLevels({
    ...RESOLVED,
    symbol: 'NQ',
    flip: null,
    callWall: null,
    maxPain: null,
  });
  assert.match(byId(thin, 'flip').tooltip, /zero crossing/);
  assert.match(byId(thin, 'callWall').tooltip, /^Call Wall is ranked over the strikes/);
  assert.match(byId(thin, 'maxPain').tooltip, /^Max Pain is ranked over the strikes/);
  // The chain attribution rides along on every one of them.
  for (const id of ['flip', 'callWall', 'maxPain']) {
    assert.match(byId(thin, id).tooltip, /computed from the NDX chain/, id);
  }
});
