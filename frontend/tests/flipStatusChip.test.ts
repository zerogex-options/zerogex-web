// Unit tests for the Gamma Chart's flip status chip — the in-plot label that
// explains an absent flip line.
//
// The rules a trader can be misled by:
//   • an unresolved flip must say WHY nothing is drawn, in the same words the
//     dashboard card and the Key Levels strip use, and must carry the mark that
//     invites the hover — a bare "FLIP UNAVAILABLE" reads as a broken feed;
//   • on ES / NQ the explanation must name the chain the miss happened on;
//   • an off-scale flip is a different story (the line exists, it is just out
//     of view) and must not be dressed up as an unresolved one.
import test from 'node:test';
import assert from 'node:assert/strict';

import { FLIP_UNAVAILABLE_LABEL, flipStatusChip } from '../core/flipStatusChip.ts';
import { unresolvedLevelTooltip } from '../core/keyLevels.ts';

const formatPrice = (p: number) => p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

test('an unresolved flip carries the shared explainer and the "?" mark', () => {
  const chip = flipStatusChip({ flip: null, onScreen: false, aboveView: false, formatPrice, symbol: 'SPX' });
  assert.ok(chip, 'a chip is drawn when the flip is unresolved');
  assert.equal(chip.kind, 'unresolved');
  assert.equal(chip.label, FLIP_UNAVAILABLE_LABEL);
  assert.equal(chip.label, 'FLIP UNAVAILABLE', 'the label the reading-charts help page promises');
  assert.equal(chip.explain, true, 'the unresolved chip invites the hover');
  // Byte-identical to the dashboard card and the Key Levels strip: one story.
  assert.equal(chip.tooltip, unresolvedLevelTooltip('Gamma Flip', 'SPX', 'flip'));
  assert.match(chip.tooltip, /Gamma Flip is published only when/);
  assert.match(chip.tooltip, /close enough to spot to trade/);
  assert.match(chip.tooltip, /real open interest/);
  assert.match(chip.tooltip, /Net GEX's sign still tells you which regime/);
  assert.doesNotMatch(chip.tooltip, /one-signed/, 'the old chip copy is gone');
  assert.doesNotMatch(chip.tooltip, /chain of its own/, 'SPX has its own chain — no projection note');
});

test('an unresolved flip on a futures symbol names the chain the miss happened on', () => {
  const nq = flipStatusChip({ flip: null, onScreen: false, aboveView: false, formatPrice, symbol: 'NQ' });
  assert.ok(nq);
  assert.match(nq.tooltip, /NQ has no options chain of its own/);
  assert.match(nq.tooltip, /computed from the NDX chain/);
  assert.match(nq.tooltip, /the NDX snapshot that came back without one/);

  const es = flipStatusChip({ flip: null, onScreen: false, aboveView: false, formatPrice, symbol: 'es' });
  assert.ok(es);
  assert.match(es.tooltip, /ES has no options chain of its own/, 'symbol case is normalized');
  assert.match(es.tooltip, /computed from the SPX chain/);
});

test('an unresolved flip with no symbol still explains itself', () => {
  const chip = flipStatusChip({ flip: undefined, onScreen: false, aboveView: false, formatPrice });
  assert.ok(chip);
  assert.equal(chip.kind, 'unresolved');
  assert.match(chip.tooltip, /Gamma Flip is published only when/);
  assert.doesNotMatch(chip.tooltip, /chain of its own/);
});

test('an off-scale flip points at the line and says how to bring it into view', () => {
  const above = flipStatusChip({ flip: 22600, onScreen: false, aboveView: true, formatPrice, symbol: 'NDX' });
  assert.ok(above);
  assert.equal(above.kind, 'off-scale');
  assert.equal(above.label, 'FLIP ↑ 22,600.00');
  assert.equal(above.explain, false, 'the off-scale chip already states price and direction');
  assert.match(above.tooltip, /sits at 22,600\.00, outside the price range on screen/);
  assert.match(above.tooltip, /Zoom the price axis out/);
  assert.doesNotMatch(above.tooltip, /published only when/, 'an off-scale line is not an unresolved one');

  const below = flipStatusChip({ flip: 5815.5, onScreen: false, aboveView: false, formatPrice, symbol: 'SPX' });
  assert.ok(below);
  assert.equal(below.label, 'FLIP ↓ 5,815.50');
});

test('a flip on screen needs no chip', () => {
  assert.equal(flipStatusChip({ flip: 5815, onScreen: true, aboveView: false, formatPrice, symbol: 'SPX' }), null);
});
