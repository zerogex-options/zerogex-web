import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  FILLED_INPUTS,
  fillThinkScriptLevels,
  formatLevel,
  formatLevelsDate,
  hasAnyLevel,
  setInputDefault,
} from '../core/thinkorswimStudy.ts';

// The generated study is the one artifact here that nobody reviews before it
// reaches a chart: it is assembled in the browser and pasted straight into
// thinkorswim's editor. So the assertions worth having are the ones about what
// the paste produces — that it compiles, and that the numbers in it are the
// numbers we meant.

const HERE = path.dirname(new URL(import.meta.url).pathname);
const TEMPLATE = readFileSync(
  path.join(HERE, '../public/thinkorswim/zerogex-daily-gamma-levels.thinkscript'),
  'utf8',
);

// ---------------------------------------------------------------------------
// The template and the filler must agree
// ---------------------------------------------------------------------------

test('the template declares every input the filler writes', () => {
  // The whole point of rewriting the tracked template rather than assembling a
  // second copy is that there is one source of record. That only holds while
  // the input names match — rename one in the .thinkscript and this fails here
  // rather than shipping a study that silently carries no levels.
  for (const name of FILLED_INPUTS) {
    assert.match(
      TEMPLATE,
      new RegExp(`^\\s*input\\s+${name}\\s*=`, 'm'),
      `the thinkScript template no longer declares "input ${name}"`,
    );
  }
});

test('setInputDefault throws rather than silently missing', () => {
  assert.throws(
    () => setInputDefault(TEMPLATE, 'noSuchInput', '1.0'),
    /no "input noSuchInput" to fill/,
  );
});

test('setInputDefault does not match the name inside a comment or string', () => {
  const source = [
    '# callWall is the strike where call-side gamma piles up',
    'input callWall  = 0.0;',
    'AddLabel(yes, "callWall = 0.0;", Color.GRAY);',
  ].join('\n');
  const filled = setInputDefault(source, 'callWall', '6100.0');
  assert.match(filled, /^input callWall {2}= 6100\.0;$/m);
  // The comment and the label text are untouched.
  assert.ok(filled.includes('# callWall is the strike where call-side gamma piles up'));
  assert.ok(filled.includes('AddLabel(yes, "callWall = 0.0;", Color.GRAY);'));
});

// ---------------------------------------------------------------------------
// Number formatting — where a wrong answer would be silent
// ---------------------------------------------------------------------------

test('a whole-number level still emits a decimal point', () => {
  // Load-bearing: thinkScript infers an input's TYPE from its default, so
  // `input callWall = 6100;` becomes an integer input that then refuses a
  // fractional value when the user edits it.
  assert.equal(formatLevel(6100), '6100.0');
  assert.equal(formatLevel(5900.0), '5900.0');
});

test('fractional levels keep their precision without trailing noise', () => {
  assert.equal(formatLevel(5950.25), '5950.25');
  assert.equal(formatLevel(5950.5), '5950.5');
  assert.equal(formatLevel(612.125), '612.125');
});

test('unusable levels format to null so the template keeps its 0.0 sentinel', () => {
  for (const value of [null, undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(formatLevel(value as number | null | undefined), null, `${String(value)}`);
  }
});

test('the snapshot date renders in ET, not the viewer timezone', () => {
  // 03:30 UTC on the 2nd is still the evening of the 1st in New York. A study
  // labeled with tomorrow's date would read as levels the user has not seen.
  assert.equal(formatLevelsDate('2026-09-02T03:30:00Z'), '2026-09-01');
  assert.equal(formatLevelsDate('2026-09-01T18:00:00Z'), '2026-09-01');
});

test('a missing or unparseable timestamp yields no date', () => {
  assert.equal(formatLevelsDate(null), null);
  assert.equal(formatLevelsDate('not a date'), null);
});

// ---------------------------------------------------------------------------
// The filled study
// ---------------------------------------------------------------------------

const FULL = {
  symbol: 'SPX',
  gammaFlip: 5950.25,
  callWall: 6100,
  putWall: 5900.5,
  maxPain: 5975,
  asOf: '2026-09-01T18:00:00Z',
};

test('a filled study carries every level and the labeling', () => {
  const filled = fillThinkScriptLevels(TEMPLATE, FULL);
  assert.match(filled, /^input callWall\s+= 6100\.0;/m);
  assert.match(filled, /^input gammaFlip\s+= 5950\.25;/m);
  assert.match(filled, /^input putWall\s+= 5900\.5;/m);
  assert.match(filled, /^input maxPain\s+= 5975\.0;/m);
  assert.match(filled, /^input levelsFor\s+= "SPX";/m);
  assert.match(filled, /^input levelsDate\s+= "2026-09-01";/m);
  assert.match(filled, /^input showLevelsDate\s+= yes;/m);
});

test('a partial snapshot leaves the missing levels hidden, not zeroed onto the chart', () => {
  const filled = fillThinkScriptLevels(TEMPLATE, {
    symbol: 'QQQ',
    gammaFlip: 512.5,
    callWall: null,
    putWall: undefined,
    maxPain: 0,
    asOf: null,
  });
  assert.match(filled, /^input gammaFlip\s+= 512\.5;/m);
  // 0.0 is the study's "hide this level" sentinel, so an unresolved level
  // draws nothing rather than a line at zero.
  assert.match(filled, /^input callWall\s+= 0\.0;/m);
  assert.match(filled, /^input putWall\s+= 0\.0;/m);
  assert.match(filled, /^input maxPain\s+= 0\.0;/m);
  // No date means the date chip stays off rather than rendering "Levels:".
  assert.match(filled, /^input showLevelsDate\s+= no;/m);
});

test('filling is idempotent and does not disturb the rest of the file', () => {
  const once = fillThinkScriptLevels(TEMPLATE, FULL);
  const twice = fillThinkScriptLevels(once, FULL);
  assert.equal(once, twice);
  // Same number of lines as the template: substitution only, never insertion.
  assert.equal(once.split('\n').length, TEMPLATE.split('\n').length);
  // The parts that make it a working study are still there verbatim.
  for (const marker of ['declare upper;', 'plot CallWallLine', 'AddChartBubble(', 'Alert(']) {
    assert.ok(once.includes(marker), `filling removed "${marker}"`);
  }
});

test('the symbol is emitted as a quoted, escaped literal', () => {
  // The symbol comes from an upstream response. This function is the only thing
  // between that field and a file the user pastes into an editor, so a quote in
  // it must not be able to terminate the thinkScript string early.
  const filled = fillThinkScriptLevels(TEMPLATE, { symbol: 'A"B', gammaFlip: 1 });
  assert.match(filled, /^input levelsFor\s+= "A\\"B";/m);
});

test('a filled study still contains no non-ASCII in what the platform renders', () => {
  // Same rule the template itself follows: the file travels by clipboard into
  // a Java editor, and a mangled character in a comment is invisible where one
  // on a chart is not.
  const filled = fillThinkScriptLevels(TEMPLATE, FULL);

  // Strip trailing `#` comments as well as whole comment lines: most of the
  // template's prose sits after code on the same line and is allowed to carry
  // normal typography. Only what thinkorswim actually renders is checked.
  const rendered = filled
    .split('\n')
    .map((line) => line.replace(/#.*$/, ''))
    .join('\n');
  const offending = rendered.match(/[^\x20-\x7E\t\n\r]/g);
  assert.equal(offending, null, `non-ASCII outside comments: ${JSON.stringify(offending)}`);

  // And every string literal specifically, since those are the labels, bubble
  // text and alert messages a reader sees on a chart.
  for (const literal of filled.match(/"[^"]*"/g) ?? []) {
    assert.equal(
      literal.match(/[^\x20-\x7E]/g),
      null,
      `non-ASCII in a rendered string literal: ${literal}`,
    );
  }
});

// ---------------------------------------------------------------------------
// The gate on the "today's levels" claim
// ---------------------------------------------------------------------------

test('hasAnyLevel decides whether the page may promise today\'s numbers', () => {
  assert.equal(hasAnyLevel(null), false);
  assert.equal(hasAnyLevel({ symbol: 'SPX' }), false);
  assert.equal(
    hasAnyLevel({ symbol: 'SPX', gammaFlip: null, callWall: 0, putWall: null, maxPain: null }),
    false,
  );
  assert.equal(hasAnyLevel({ symbol: 'SPX', maxPain: 5975 }), true);
});
