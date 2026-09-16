// Unit tests for the shared appearance vocabulary (frontend/core/appearance.ts).
//
// The contract this file guards: the server layout and the client provider now
// validate theme/palette through ONE list, so a value that paints on the client
// cannot fail validation on the server (or the reverse). A preference saved
// under a retired palette id still resolves to its successor rather than
// silently reverting the member to the default, and anything unrecognized —
// a hand-edited cookie, a value from an older release, a null — lands on the
// default instead of reaching the DOM as a bogus `palette-*` class.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_PALETTE,
  DEFAULT_THEME,
  LEGACY_PALETTE_MAP,
  PALETTES,
  normalizePalette,
  normalizeTheme,
} from '../core/appearance.ts';

test('every live palette round-trips unchanged', () => {
  for (const id of PALETTES) {
    assert.equal(normalizePalette(id), id, `palette ${id} should survive normalization`);
  }
});

test('retired palette ids resolve to their successor, not the default', () => {
  for (const [retired, successor] of Object.entries(LEGACY_PALETTE_MAP)) {
    assert.equal(
      normalizePalette(retired),
      successor,
      `retired palette ${retired} should map to ${successor}`,
    );
    // The successor has to be a palette that still exists, or the mapping just
    // moves the member from one dead id to another.
    assert.ok(PALETTES.includes(successor), `${successor} must be a live palette`);
  }
});

test('unknown, empty and absent palettes fall back to the default', () => {
  for (const bogus of ['', 'not-a-palette', 'PALETTE-OG', 'zerogex_og', null, undefined]) {
    assert.equal(normalizePalette(bogus as string | null | undefined), DEFAULT_PALETTE);
  }
});

test('the default palette is itself a live palette', () => {
  assert.ok(PALETTES.includes(DEFAULT_PALETTE));
});

test('no retired id shadows a live palette', () => {
  // A retired id that is also a live id would be rewritten on every read, so a
  // member choosing it could never keep it.
  for (const retired of Object.keys(LEGACY_PALETTE_MAP)) {
    assert.ok(
      !PALETTES.includes(retired as (typeof PALETTES)[number]),
      `${retired} is both live and retired`,
    );
  }
});

test('themes normalize to the two supported values', () => {
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('dark'), 'dark');
  for (const bogus of ['', 'Light', 'DARK', 'system', 'auto', null, undefined]) {
    assert.equal(normalizeTheme(bogus as string | null | undefined), DEFAULT_THEME);
  }
});

test('palette ids are safe to interpolate into a CSS class', () => {
  // ThemeContext builds `palette-${id}` and toggles it on <html>. Anything
  // outside this shape would either break the selector or inject markup.
  for (const id of PALETTES) {
    assert.match(id, /^[a-z0-9-]+$/, `palette id ${id} must be class-name safe`);
  }
});
