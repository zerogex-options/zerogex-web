import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseHighlightsJson,
  selectHighlightsSince,
  type DatedHighlight,
} from '../core/winbackHighlights.ts';

// The contract that makes a re-engagement email cohort-correct: a reader is
// only ever told something is NEW when it actually postdates their departure.
// freshCount is the load-bearing output — it is what stops the copy claiming
// "a lot has changed" to someone for whom nothing has.

const NEWEST: DatedHighlight = { title: 'newest', body: 'b', since: '2026-09-10' };
const MIDDLE: DatedHighlight = { title: 'middle', body: 'b', since: '2026-08-28' };
const OLDEST: DatedHighlight = { title: 'oldest', body: 'b', since: '2026-08-01' };
const EVERGREEN: DatedHighlight = { title: 'evergreen', body: 'b' };
const ALL = [OLDEST, EVERGREEN, NEWEST, MIDDLE];

const titles = (items: DatedHighlight[]) => items.map((i) => i.title);

test('only items that postdate the reader are counted as fresh', () => {
  const result = selectHighlightsSince(ALL, '2026-09-01', { minItems: 1 });
  // The evergreen item rides along — undated means "we could not verify when
  // this shipped", which must not filter it out of a cohort — but it is not
  // counted as new to anyone.
  assert.deepEqual(titles(result.items), ['newest', 'evergreen']);
  assert.equal(result.freshCount, 1);
});

test('results are newest-first, with undated items last', () => {
  const result = selectHighlightsSince(ALL, '2026-01-01', { minItems: 1 });
  assert.deepEqual(titles(result.items), ['newest', 'middle', 'oldest', 'evergreen']);
  // The evergreen item ships to everyone but is never claimed as new.
  assert.equal(result.freshCount, 3);
});

test('a thin fresh list is topped up without inflating freshCount', () => {
  const result = selectHighlightsSince(ALL, '2026-09-01', { minItems: 3 });
  assert.equal(result.items.length, 3);
  assert.equal(titles(result.items)[0], 'newest');
  // Topped up for substance — but the caller still knows only one is new, so it
  // can pick honest framing.
  assert.equal(result.freshCount, 1);
});

test('a member who left after everything shipped is told nothing is new', () => {
  const result = selectHighlightsSince(ALL, '2026-12-31', { minItems: 2 });
  assert.equal(result.freshCount, 0);
  assert.equal(result.items.length, 2, 'still shows context, just never calls it new');
});

test('an unknown departure date shows everything and claims nothing', () => {
  for (const since of [null, undefined, '', 'not-a-date']) {
    const result = selectHighlightsSince(ALL, since, { minItems: 3 });
    assert.equal(result.items.length, ALL.length, `since=${String(since)} should show all`);
    assert.equal(result.freshCount, 0, `since=${String(since)} must not claim novelty`);
  }
});

test('selection never mutates the caller list', () => {
  const input = [...ALL];
  selectHighlightsSince(input, '2026-09-01');
  assert.deepEqual(titles(input), titles(ALL), 'the shared default list must survive a sort');
});

test('parse keeps valid rows, drops junk, and preserves dates', () => {
  const parsed = parseHighlightsJson({
    highlights: [
      { title: 'good', body: 'yes', since: '2026-09-10' },
      { title: '  padded  ', body: '  trimmed  ' },
      { title: '', body: 'no title' },
      { title: 'no body', body: '   ' },
      { title: 'bad date', body: 'kept anyway', since: 'whenever' },
      'not an object',
      null,
    ],
  });
  assert.ok(parsed);
  assert.deepEqual(titles(parsed), ['good', 'padded', 'bad date']);
  assert.equal(parsed[0].since, '2026-09-10');
  assert.equal(parsed[1].since, null, 'an absent date is null, not undefined');
  // An unparseable date costs the item its targeting, never the reader the item.
  assert.equal(parsed[2].since, null);
});

test('parse returns null for anything unusable', () => {
  for (const raw of [null, undefined, 42, 'string', {}, { highlights: 'nope' }, { highlights: [] }]) {
    assert.equal(parseHighlightsJson(raw), null, `${JSON.stringify(raw)} should be unusable`);
  }
});

test('the shipped highlights file parses and is fully dated', async () => {
  // Guards the real content, not a fixture: a typo'd date silently removes a
  // bullet from the cohort it would most impress, and nothing else would catch it.
  const fs = await import('node:fs');
  const url = new URL('../content/winback-highlights.json', import.meta.url);
  const parsed = parseHighlightsJson(JSON.parse(fs.readFileSync(url, 'utf8')));
  assert.ok(parsed, 'content/winback-highlights.json must parse');
  assert.ok(parsed.length >= 3, 'keep at least three bullets so a filtered list stays substantive');
  for (const item of parsed) {
    assert.ok(item.since, `highlight "${item.title}" is missing a valid since date`);
  }
});
