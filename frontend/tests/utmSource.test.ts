import test from 'node:test';
import assert from 'node:assert/strict';

import { sanitizeUtmSource, UTM_SOURCE_ALIASES } from '../core/utils.ts';

// The single chokepoint every acquisition source passes through: the page-view
// beacon, the signup cookie, and the decline report's attribution join all call
// it. A change here silently re-buckets every channel on three admin reports.

test('a source is lowercased and stripped to an index-safe key', () => {
  assert.equal(sanitizeUtmSource('Reddit'), 'reddit');
  assert.equal(sanitizeUtmSource('  YouTube  '), 'youtube');
  assert.equal(sanitizeUtmSource('chatgpt.com'), 'chatgpt.com');
  // Nothing hostile reaches SQL or the admin table.
  assert.equal(sanitizeUtmSource("x'; DROP TABLE users;--"), 'xdroptableusers--');
});

test('absent, empty and non-string sources become NULL, never ""', () => {
  assert.equal(sanitizeUtmSource(undefined), null);
  assert.equal(sanitizeUtmSource(null), null);
  assert.equal(sanitizeUtmSource(''), null);
  assert.equal(sanitizeUtmSource('   '), null);
  assert.equal(sanitizeUtmSource(42), null);
  // Everything strippable: the result must be NULL (direct/organic), not a key
  // made of nothing.
  assert.equal(sanitizeUtmSource('!!!'), null);
});

test('one channel tagged two ways folds to one key', () => {
  // The finding that motivated this: `x` and `twitter` sat as separate channels
  // with 3 and 10 first-payment charges. Split, neither could support a rate;
  // merged, the one real channel has 13 and at least counts toward the 25 the
  // report needs before it will read a percentage.
  assert.equal(sanitizeUtmSource('twitter'), 'x');
  assert.equal(sanitizeUtmSource('Twitter'), 'x');
  assert.equal(sanitizeUtmSource('  TWITTER '), 'x');
  assert.equal(sanitizeUtmSource('x'), 'x');
});

test('aliasing runs after the charset pass, not before', () => {
  // The map is written against sanitized keys, so an alias must not be looked up
  // on the raw string. If the order flipped, 'Twitter' would miss the map and
  // the split this exists to close would quietly reopen.
  for (const [from, to] of Object.entries(UTM_SOURCE_ALIASES)) {
    assert.equal(sanitizeUtmSource(from.toUpperCase()), to);
    assert.equal(sanitizeUtmSource(` ${from} `), to);
  }
});

test('aliasing is idempotent — every target is its own fixed point', () => {
  // Otherwise `make normalize-utm-sources` could rewrite the same rows on every
  // run, and a cycle in the map would make it never converge.
  for (const to of Object.values(UTM_SOURCE_ALIASES)) {
    assert.equal(sanitizeUtmSource(to), to, `alias target ${to} must not itself be aliased`);
  }
});

test('an untagged source is left exactly as it arrived', () => {
  // The map is deliberately small. Anything not in it must survive untouched —
  // folding `newsletter` into `email` would destroy a real distinction between
  // two different sends.
  for (const source of ['reddit', 'youtube', 'discord', 'chatgpt.com', 'copilot.com', 'newsletter', 'email']) {
    assert.equal(sanitizeUtmSource(source), source);
  }
});
