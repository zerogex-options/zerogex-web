// Unit tests for core/levelValue — the one coercion and the one fallback rule
// every dealer-positioning level is read through.
//
// Both halves of this module exist because the open-coded copies they replaced
// disagreed, and the disagreement was user-visible: the Gamma Chart printed
// FLIP UNAVAILABLE while the Dealer Positioning header, reading the same API,
// printed $762.44. So the tests here are written as the two failure modes,
// not as a coercion table:
//
//   • a strict `typeof v === "number"` guard drops a served numeric STRING,
//     which is how one surface could go blank while the surface beside it
//     rendered the identical payload;
//   • `coerce(a ?? b)` puts the `??` inside the coercion, so a first source
//     that answers with something unusable-but-not-null consumes the fallback
//     and the second source is never read.
import test from 'node:test';
import assert from 'node:assert/strict';

import { firstLevel, levelOrNull } from '../core/levelValue.ts';

test('levelOrNull keeps any finite value, including zero and negatives', () => {
  assert.equal(levelOrNull(762.44), 762.44);
  assert.equal(levelOrNull(-2.1e9), -2.1e9);
  // Zero is preserved on purpose: net_gex_at_spot is exactly zero AT the flip,
  // and this coercion serves the signed quantities as well as the prices. The
  // "a price level must be positive" rule is core/keyLevels' positiveLevel.
  assert.equal(levelOrNull(0), 0);
});

test('levelOrNull coerces the numeric strings the API serves', () => {
  // A Postgres numeric can reach the client as a string. A strict
  // `typeof v === "number"` guard dropped these, which is the whole bug: the
  // chart blanked its flip while the Key Levels strip above it drew one.
  assert.equal(levelOrNull('762.44'), 762.44);
  assert.equal(levelOrNull('-2.1e9'), -2.1e9);
  assert.equal(levelOrNull('0'), 0);
});

test('levelOrNull refuses absent and unusable values', () => {
  assert.equal(levelOrNull(null), null);
  assert.equal(levelOrNull(undefined), null);
  assert.equal(levelOrNull(NaN), null);
  assert.equal(levelOrNull(Infinity), null);
  assert.equal(levelOrNull(-Infinity), null);
  assert.equal(levelOrNull('not-a-number'), null);
  assert.equal(levelOrNull({}), null);
});

test('an empty string is absent data, never zero', () => {
  // Number('') === 0, so a blank column would otherwise put a $0.00 level on
  // the price axis — indistinguishable from a real one.
  assert.equal(levelOrNull(''), null);
});

test('firstLevel takes the first usable candidate in precedence order', () => {
  assert.equal(firstLevel(762.44, 999), 762.44, 'the first source wins when it answers');
  assert.equal(firstLevel(null, 999), 999, 'and falls through when it does not');
  assert.equal(firstLevel(null, undefined, '612.50'), 612.5);
});

test('firstLevel falls through on ANY unusable first value, not just null', () => {
  // The regression this function exists to make unwriteable. `coerce(a ?? b)`
  // only falls back on null/undefined, so each of these consumed the fallback
  // and blanked the level while the second source was serving a good one.
  assert.equal(firstLevel(NaN, 762.44), 762.44, 'a NaN must not consume the fallback');
  assert.equal(firstLevel('', 762.44), 762.44, 'nor an empty string');
  assert.equal(firstLevel('not-a-number', 762.44), 762.44, 'nor unparseable text');
  assert.equal(firstLevel(Infinity, 762.44), 762.44, 'nor an infinity');
});

test('firstLevel returns null when nothing survives', () => {
  // The caller draws no level rather than substituting a differently-scoped
  // one — a whole-chain flip over subset bars is the contradiction the chart's
  // regime shading is built to avoid.
  assert.equal(firstLevel(null, undefined), null);
  assert.equal(firstLevel(), null);
  assert.equal(firstLevel(NaN, '', 'nope'), null);
});

test('firstLevel stops at a legitimate zero rather than reading past it', () => {
  // Zero survives levelOrNull, so it is an ANSWER, not a miss. Skipping it
  // would silently promote a second source over a first one that spoke.
  assert.equal(firstLevel(0, 762.44), 0);
});
