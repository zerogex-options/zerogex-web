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
  resolveAppearance,
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

// ── resolveAppearance ────────────────────────────────────────────────────────
// What a request paints. The contract: a signed-in member's account copy wins
// over whatever this browser kept — a lost cookie, a default written back after
// losing it, or a stale choice from before a change made on another device —
// except while this browser holds a change the account has not confirmed.

const SAVED = { theme: 'light', palette: 'monochrome-madison' };

test('signed out, the cookies are all there is', () => {
  assert.deepEqual(
    resolveAppearance({ cookieTheme: 'light', cookiePalette: 'kyoto', account: null }),
    { theme: 'light', palette: 'kyoto', fromAccount: false, syncToAccount: false },
  );
  assert.deepEqual(
    resolveAppearance({}),
    { theme: DEFAULT_THEME, palette: DEFAULT_PALETTE, fromAccount: false, syncToAccount: false },
  );
});

test('a signed-in member whose browser lost the cookies gets their saved look back', () => {
  const resolved = resolveAppearance({ account: SAVED });
  assert.equal(resolved.theme, 'light');
  assert.equal(resolved.palette, 'monochrome-madison');
  assert.equal(resolved.fromAccount, true);
  assert.equal(resolved.syncToAccount, false);
});

test('the account copy also beats a default the browser wrote back after the loss', () => {
  const resolved = resolveAppearance({
    cookieTheme: DEFAULT_THEME,
    cookiePalette: DEFAULT_PALETTE,
    account: SAVED,
  });
  assert.equal(resolved.palette, 'monochrome-madison');
  assert.equal(resolved.fromAccount, true);
});

test('a change made on another device carries over to this one', () => {
  const resolved = resolveAppearance({ cookieTheme: 'dark', cookiePalette: 'kyoto', account: SAVED });
  assert.equal(resolved.theme, 'light');
  assert.equal(resolved.palette, 'monochrome-madison');
});

test('an unconfirmed change in this browser stands, and is saved again', () => {
  const resolved = resolveAppearance({
    cookieTheme: 'dark',
    cookiePalette: 'kyoto',
    pending: true,
    account: SAVED,
  });
  assert.deepEqual(resolved, { theme: 'dark', palette: 'kyoto', fromAccount: false, syncToAccount: true });
});

test('a look picked before it moved onto the account is kept and copied up', () => {
  const resolved = resolveAppearance({
    cookieTheme: 'dark',
    cookiePalette: 'monochrome-madison',
    account: { theme: null, palette: null },
  });
  assert.deepEqual(resolved, {
    theme: 'dark',
    palette: 'monochrome-madison',
    fromAccount: false,
    syncToAccount: true,
  });
});

test('an untouched default is not copied up to an empty account', () => {
  for (const cookies of [{}, { cookieTheme: DEFAULT_THEME, cookiePalette: DEFAULT_PALETTE }]) {
    const resolved = resolveAppearance({ ...cookies, account: { theme: null, palette: null } });
    assert.equal(resolved.syncToAccount, false);
    assert.equal(resolved.palette, DEFAULT_PALETTE);
  }
});

test('account values are normalized like cookie values', () => {
  const retired = resolveAppearance({ account: { theme: 'dark', palette: 'monaco' } });
  assert.equal(retired.palette, 'monochrome-madison', 'a retired id resolves to its successor');
  const partial = resolveAppearance({ cookiePalette: 'kyoto', account: { theme: 'light', palette: null } });
  assert.equal(partial.theme, 'light', 'the saved field wins');
  assert.equal(partial.palette, 'kyoto', 'the unsaved field keeps the cookie');
});
