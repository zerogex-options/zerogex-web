// Unit tests for saved-board naming (frontend/core/savedBoards.ts).
//
// The contract: a board name is what the member picks it out by in the
// switcher, so two boards that LOOK identically named must collide rather than
// sit next to each other indistinguishable. normalizeLayoutName is what makes
// that true — the UNIQUE(user_id, name) index only catches exact duplicates,
// so "  Morning  Read " has to become "Morning Read" before it reaches the
// database, or the constraint never fires and the member gets two rows they
// cannot tell apart.
//
// The storage paths themselves are exercised end to end against a live session
// (save, list, rename, delete, duplicate-name rejection, cross-account 404).
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_LAYOUT_NAME_LENGTH,
  MAX_SAVED_LAYOUTS,
  normalizeLayoutName,
} from '../core/savedBoards.ts';

test('surrounding and repeated whitespace collapses', () => {
  assert.equal(normalizeLayoutName('  Morning  Read '), 'Morning Read');
  assert.equal(normalizeLayoutName('Morning\tRead'), 'Morning Read');
  assert.equal(normalizeLayoutName('Morning\n\nRead'), 'Morning Read');
});

test('names that differ only by whitespace normalize to the same string', () => {
  // This is the whole point: these must collide on UNIQUE(user_id, name).
  const variants = ['Flow Focus', ' Flow Focus', 'Flow  Focus', 'Flow Focus  ', '\tFlow\nFocus '];
  const normalized = new Set(variants.map(normalizeLayoutName));
  assert.equal(normalized.size, 1, `expected one name, got ${[...normalized].join(' / ')}`);
  assert.equal([...normalized][0], 'Flow Focus');
});

test('blank and non-string names normalize to empty, which callers reject', () => {
  for (const blank of ['', '   ', '\t\n', null, undefined, 42, {}, []]) {
    assert.equal(normalizeLayoutName(blank as unknown), '');
  }
});

test('a name of only punctuation is kept — it is odd, not invalid', () => {
  // Deliberately not sanitized into nothing: members name things "***" and
  // that is their business, as long as it is stable and unique.
  assert.equal(normalizeLayoutName('***'), '***');
  assert.equal(normalizeLayoutName('  🚀  '), '🚀');
});

test('case is preserved, so a rename that only changes case still reads as a change', () => {
  assert.equal(normalizeLayoutName('morning read'), 'morning read');
  assert.notEqual(normalizeLayoutName('morning read'), normalizeLayoutName('Morning Read'));
});

test('the limits are sane bounds, not accidental defaults', () => {
  assert.ok(MAX_SAVED_LAYOUTS > 1, 'more than one board or the feature is pointless');
  assert.ok(MAX_SAVED_LAYOUTS <= 100, 'not unbounded');
  assert.ok(MAX_LAYOUT_NAME_LENGTH >= 20, 'long enough to be descriptive');
  assert.ok(MAX_LAYOUT_NAME_LENGTH <= 200, 'short enough to render in the switcher');
});

test('a name at exactly the limit normalizes without being truncated', () => {
  // Callers compare length AFTER normalizing, so normalization must not itself
  // push a legal name over the edge.
  const exact = 'x'.repeat(MAX_LAYOUT_NAME_LENGTH);
  assert.equal(normalizeLayoutName(exact).length, MAX_LAYOUT_NAME_LENGTH);
  assert.equal(normalizeLayoutName(`  ${exact}  `).length, MAX_LAYOUT_NAME_LENGTH);
});
