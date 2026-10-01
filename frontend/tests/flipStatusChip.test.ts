// Unit tests for the Gamma Chart's flip status chip — the in-plot label that
// explains an absent flip line.
//
// The rules a trader can be misled by:
//   • an unresolved flip must say WHY nothing is drawn, in the same words the
//     dashboard card and the Key Levels strip use, and must carry the mark that
//     invites the hover — a bare "FLIP UNAVAILABLE" reads as a broken feed;
//   • on ES / NQ the explanation must name the chain the miss happened on;
//   • an off-scale flip is a different story (the line exists, it is just out
//     of view) and must not be dressed up as an unresolved one;
//   • a blank flip under an Expiry FILTER is a third story again — the subset
//     has no crossing of its own — and reading it as a declined publish sends
//     the trader to wait for a snapshot that cannot fix it.
import test from 'node:test';
import assert from 'node:assert/strict';

import { FLIP_NO_CROSSING_LABEL, FLIP_UNAVAILABLE_LABEL, flipStatusChip } from '../core/flipStatusChip.ts';
import { noFlipInScopeTooltip, unresolvedLevelTooltip } from '../core/keyLevels.ts';

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

test('an unfiltered blank flip is still the unresolved story', () => {
  // filtered defaults to false and an explicit false behaves the same: the
  // whole chain is on screen, so a blank IS a declined publish.
  for (const chip of [
    flipStatusChip({ flip: null, onScreen: false, aboveView: false, formatPrice, symbol: 'SPY' }),
    flipStatusChip({ flip: null, onScreen: false, aboveView: false, formatPrice, symbol: 'SPY', filtered: false }),
  ]) {
    assert.ok(chip);
    assert.equal(chip.kind, 'unresolved');
    assert.equal(chip.label, FLIP_UNAVAILABLE_LABEL);
  }
});

test('a blank flip under an Expiry filter names the scope, not a failure', () => {
  const chip = flipStatusChip({
    flip: null, onScreen: false, aboveView: false, formatPrice, symbol: 'SPY', filtered: true,
  });
  assert.ok(chip, 'a chip is still drawn — the absence is the question either way');
  assert.equal(chip.kind, 'no-crossing');
  assert.equal(chip.label, FLIP_NO_CROSSING_LABEL);
  assert.equal(chip.label, 'NO FLIP IN SELECTED EXPIRIES');
  assert.equal(chip.explain, true, 'it states the scope but not the reason — the hover carries that');
  // Byte-identical to the Key Levels strip's card: one story per cause.
  assert.equal(chip.tooltip, noFlipInScopeTooltip('Gamma Flip'));
});

test('the filtered story tells the trader what actually brings the line back', () => {
  const chip = flipStatusChip({
    flip: null, onScreen: false, aboveView: false, formatPrice, symbol: 'SPY', filtered: true,
  });
  assert.ok(chip);
  assert.match(chip.tooltip, /one-signed/, 'why a subset so often has no crossing');
  assert.match(chip.tooltip, /setting Expiry back to All/, 'the action that works');
  assert.match(chip.tooltip, /Dealer Positioning/, 'accounts for the whole-chain level still on screen elsewhere');
  // The load-bearing negative: waiting is the WRONG advice here, and it is
  // exactly what the unresolved copy gives.
  assert.doesNotMatch(chip.tooltip, /normally resolves again on a later snapshot/);
  assert.match(chip.tooltip, /will not resolve on a later snapshot/);
  assert.notEqual(chip.tooltip, unresolvedLevelTooltip('Gamma Flip', 'SPY', 'flip'));
});

test('the filter never suppresses or rewrites a flip that exists', () => {
  // `filtered` decides WHICH blank-flip story is told, never whether one is.
  // A resolved flip is drawn or pointed at exactly as before.
  assert.equal(
    flipStatusChip({ flip: 5815, onScreen: true, aboveView: false, formatPrice, symbol: 'SPX', filtered: true }),
    null,
    'an on-screen flip needs no chip, filtered or not',
  );
  const offScale = flipStatusChip({
    flip: 22600, onScreen: false, aboveView: true, formatPrice, symbol: 'NDX', filtered: true,
  });
  assert.ok(offScale);
  assert.equal(offScale.kind, 'off-scale');
  assert.equal(offScale.label, 'FLIP ↑ 22,600.00');
});

// ── The chip's second home: the GEX Strike Profile ─────────────────────────
// The Strike Profile draws the same Gamma Flip line from the same
// expiration-filtered bucket, and went blank the same two ways — an off-scale
// level dropped by its in-bounds filter, and a filtered subset that publishes
// no crossing — while saying nothing about either. It now draws this same chip,
// so a reader who learns the label on one board reads it on the other.
// Checked at the source, the way tests/rewindDefaults.test.ts checks this
// component and tests/gammaTerminal.test.ts checks the chart.
import { readFileSync } from 'node:fs';

const strikeProfile = readFileSync(
  new URL('../components/MarketMakerExposures.tsx', import.meta.url),
  'utf8',
);

test('Strike Profile: the blank flip is explained by the shared chip, not re-worded', () => {
  assert.match(
    strikeProfile,
    /import \{ flipStatusChip \} from '@\/core\/flipStatusChip';/,
    'the copy comes from the shared module — never a second wording of the same blank',
  );
  assert.match(strikeProfile, /const flipChip = \(\) => \{|const flipChip = \(\(\) => \{/);
  // The labels themselves must NOT be written out here; that is how two
  // surfaces drift into telling different stories about one blank.
  assert.doesNotMatch(strikeProfile, /NO FLIP IN SELECTED EXPIRIES/);
  assert.doesNotMatch(strikeProfile, /FLIP UNAVAILABLE/);
});

test('Strike Profile: a filtered book gets the subset story, not the declined-publish one', () => {
  // `filtered` is what splits "this subset has no crossing" from "the resolver
  // declined". Wiring it to anything but the board's own level scope would send
  // the reader to wait for a snapshot that cannot fix it.
  assert.match(
    strikeProfile,
    /filtered: levelsAreFiltered,/,
    'the chip reads the same scope flag the levels themselves are read under',
  );
  assert.match(
    strikeProfile,
    /const levelsAreFiltered = expirationsParam !== 'all';/,
    'and that flag is the Expiry filter, not a proxy for it',
  );
});

test('Strike Profile: an off-scale flip is caught by the visible price band', () => {
  // The board keeps only levels between PLOT_TOP and PLOT_BOTTOM, so a flip
  // outside the band silently disappeared. onScreen has to be measured against
  // that same band or the chip never fires for the case it exists to cover.
  assert.match(strikeProfile, /onScreen: flipPrice != null && flipPrice >= yBounds\.yMin && flipPrice <= yBounds\.yMax,/);
  assert.match(strikeProfile, /const aboveView = flipPrice != null && flipPrice > yBounds\.yMax;/);
});

test('Strike Profile: the chip renders its label, its hover copy and the "?" mark', () => {
  assert.match(strikeProfile, /\{flipChip\.label\}/, 'the label is drawn');
  assert.match(strikeProfile, /<title>\{flipChip\.tooltip\}<\/title>/, 'the copy is reachable as a native title');
  assert.match(strikeProfile, /\{flipChip\.explain && \(/, 'a blank flip carries the mark that invites the hover');
  assert.match(strikeProfile, /fill="var\(--color-warning\)"/, 'and the mark is the same amber as every other empty level');
});
