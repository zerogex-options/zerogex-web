import test from 'node:test';
import assert from 'node:assert/strict';

// The gamma ladder's crown is filled by the expirations its rows cover: teal
// (the same-day Pin Strike's color) for today's expiration alone, violet (the
// GEX King's color) for anything else. See core/crownScope.ts.

const {
  ladderExpiryScope,
  crownColor,
  crownScopeShort,
  crownLabel,
  crownKeyTitle,
  CROWN_TODAY_COLOR,
  CROWN_WIDER_COLOR,
} = await import('../core/crownScope.ts');

const TODAY = '2026-11-17';
const TOMORROW = '2026-11-18';
const FRIDAY = '2026-11-20';

test('an empty selection is the whole chain', () => {
  assert.equal(ladderExpiryScope([], TODAY), 'all');
});

test("today's expiration alone is today, whether reconciled or still the rolling token", () => {
  assert.equal(ladderExpiryScope([TODAY], TODAY), 'today');
  assert.equal(ladderExpiryScope(['0DTE'], TODAY), 'today');
});

test('any other selection is a selection, including one that contains today', () => {
  assert.equal(ladderExpiryScope([TOMORROW], TODAY), 'selected');
  assert.equal(ladderExpiryScope([FRIDAY], TODAY), 'selected');
  assert.equal(ladderExpiryScope([TODAY, FRIDAY], TODAY), 'selected');
  assert.equal(ladderExpiryScope(['0DTE', FRIDAY], TODAY), 'selected');
});

test("yesterday's date is not today once the ET date rolls", () => {
  assert.equal(ladderExpiryScope([TODAY], TOMORROW), 'selected');
});

test('teal means today only; every wider scope shares the King violet', () => {
  assert.equal(CROWN_TODAY_COLOR, 'var(--color-pin)');
  assert.equal(CROWN_WIDER_COLOR, 'var(--color-king)');
  assert.equal(crownColor('today'), CROWN_TODAY_COLOR);
  assert.equal(crownColor('all'), CROWN_WIDER_COLOR);
  assert.equal(crownColor('selected'), CROWN_WIDER_COLOR);
});

test("the header key names each scope in a word or two", () => {
  assert.equal(crownScopeShort('today'), '0DTE');
  assert.equal(crownScopeShort('all'), 'All exp.');
  assert.equal(crownScopeShort('selected'), 'Selected');
});

test('the crown label names what it marks and over which expirations', () => {
  assert.equal(crownLabel('today'), "Heaviest dealer gamma in view, from today's expiration only (0DTE)");
  assert.equal(crownLabel('all'), 'Heaviest dealer gamma in view, from all expirations');
  assert.equal(crownLabel('selected', 'oi'), 'Heaviest dealer gamma in view, from the expirations you selected');
  assert.equal(crownLabel('today', 'volume'), "Heaviest gamma traded this session, from today's expiration only (0DTE)");
});

test('the key tooltip states this column\'s scope and the two-color rule', () => {
  const title = crownKeyTitle('all');
  assert.match(title, /from all expirations\./);
  assert.match(title, /Teal when the ladder shows only today's expiration/);
  assert.match(title, /violet for all expirations or a selection/);
});
