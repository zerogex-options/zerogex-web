// Unit tests for the shared expiration-filter persistence layer
// (frontend/core/expirationPersistence.ts) that backs the cross-chart
// expiration selection. The contract under test: a set of expirations the user
// picks must round-trip through storage in a normalised shape, reconcile
// cleanly against each chart's live options (so stale/expired dates drop out),
// and a broken/absent/tampered store must only ever fall back to "All" (empty)
// — never crash.
//
// Plus the two-layer tab contract: sessionStorage holds THIS tab's live pick
// and localStorage holds the last-selected default, so two open tabs can sit on
// different expirations while a newly opened tab still starts from the last
// pick. sessionStorage is per-tab in the browser, which under Node is modelled
// by swapping in a fresh session store to represent "a different tab".
//
// Mirrors tests/symbolPersistence.test.ts: the module reads window storage
// lazily (guarded by a typeof check), so minimal in-memory Storage stubs on the
// global before the functions run exercise the real browser path under Node.
import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

const memory = new MemoryStorage();
let session = new MemoryStorage();

// A tab is (localStorage shared by all tabs) + (its own sessionStorage).
// `openTab()` models opening a NEW tab: same localStorage, fresh session store.
function setWindow(sessionStore: MemoryStorage): void {
  (globalThis as { window?: unknown }).window = {
    localStorage: memory,
    sessionStorage: sessionStore,
  };
}

function openTab(): MemoryStorage {
  session = new MemoryStorage();
  setWindow(session);
  return session;
}

setWindow(session);

// Imported AFTER the window stub so any module-level evaluation still sees it.
const {
  isExpirationDate,
  normalizeExpirations,
  reconcileExpirations,
  readStoredExpirations,
  readTabExpirations,
  resolveInitialExpirations,
  persistExpirations,
  sameExpirations,
  EXPIRATIONS_STORAGE_KEY,
  EXPIRATIONS_SESSION_KEY,
} = await import('../core/expirationPersistence.ts');

test.beforeEach(() => {
  memory.clear();
  openTab();
});

test('isExpirationDate accepts YYYY-MM-DD and rejects everything else', () => {
  assert.equal(isExpirationDate('2025-06-20'), true);
  assert.equal(isExpirationDate('2025-6-2'), false); // not zero-padded
  assert.equal(isExpirationDate('20250620'), false);
  assert.equal(isExpirationDate('all'), false);
  assert.equal(isExpirationDate(''), false);
  assert.equal(isExpirationDate(null), false);
  assert.equal(isExpirationDate(undefined), false);
  assert.equal(isExpirationDate(20250620), false);
});

test('normalizeExpirations dedupes, sorts ascending, and drops invalid entries', () => {
  assert.deepEqual(
    normalizeExpirations(['2025-06-27', '2025-06-20', '2025-06-27', 'nope', 42, null]),
    ['2025-06-20', '2025-06-27'],
  );
  assert.deepEqual(normalizeExpirations([]), []);
});

test('reconcileExpirations keeps only still-available dates, preserving order', () => {
  const available = ['2025-06-20', '2025-06-27', '2025-07-03'];
  assert.deepEqual(
    reconcileExpirations(['2025-06-27', '2025-06-20'], available),
    ['2025-06-27', '2025-06-20'],
  );
  // An empty selection ("All") is passed through untouched.
  assert.deepEqual(reconcileExpirations([], available), []);
  // A fully-expired selection collapses to [] (which reads as "All").
  assert.deepEqual(reconcileExpirations(['1999-01-01'], available), []);
});

test('persistExpirations writes a normalised blob and readStoredExpirations reads it back', () => {
  const stored = persistExpirations(['2025-06-27', '2025-06-20', '2025-06-27']);
  assert.deepEqual(stored, ['2025-06-20', '2025-06-27']); // returns normalised
  assert.equal(memory.getItem(EXPIRATIONS_STORAGE_KEY), '["2025-06-20","2025-06-27"]');
  assert.deepEqual(readStoredExpirations(), ['2025-06-20', '2025-06-27']);
});

// The core regression: a persisted pick must survive a reload — re-reading on a
// fresh mount comes back with exactly what was saved.
test('a persisted selection survives a reload', () => {
  persistExpirations(['2025-06-20']);
  assert.deepEqual(readStoredExpirations(), ['2025-06-20']);
});

test('an empty selection (All) round-trips as []', () => {
  persistExpirations([]);
  assert.equal(memory.getItem(EXPIRATIONS_STORAGE_KEY), '[]');
  assert.deepEqual(readStoredExpirations(), []);
});

test('readStoredExpirations returns [] when nothing is saved', () => {
  assert.deepEqual(readStoredExpirations(), []);
});

test('a corrupt / wrong-shape stored blob falls back to [] (All), never crashes', () => {
  memory.setItem(EXPIRATIONS_STORAGE_KEY, 'not json');
  assert.deepEqual(readStoredExpirations(), []);

  memory.setItem(EXPIRATIONS_STORAGE_KEY, '{"not":"an array"}');
  assert.deepEqual(readStoredExpirations(), []);

  // A tampered array of the wrong element types is filtered down to nothing.
  memory.setItem(EXPIRATIONS_STORAGE_KEY, '[1,2,"nope"]');
  assert.deepEqual(readStoredExpirations(), []);

  // A mixed array keeps only the valid dates.
  memory.setItem(EXPIRATIONS_STORAGE_KEY, '["2025-06-20", "bad", 3]');
  assert.deepEqual(readStoredExpirations(), ['2025-06-20']);
});

test('sameExpirations compares by order-sensitive value', () => {
  assert.equal(sameExpirations([], []), true);
  assert.equal(sameExpirations(['2025-06-20'], ['2025-06-20']), true);
  assert.equal(sameExpirations(['2025-06-20'], ['2025-06-27']), false);
  assert.equal(sameExpirations(['2025-06-20'], []), false);
  // Normalised inputs are always sorted, so differing order is a real change.
  assert.equal(
    sameExpirations(['2025-06-20', '2025-06-27'], ['2025-06-27', '2025-06-20']),
    false,
  );
});

// Private-mode Safari throws on localStorage access. Persistence is best-effort:
// a throwing store must not bubble out of persistExpirations/readStoredExpirations,
// and persist still returns the normalised value so the in-memory store stays right.
test('storage failures are swallowed (private mode / disabled storage)', () => {
  const throwingStorage = {
    getItem() {
      throw new Error('SecurityError');
    },
    setItem() {
      throw new Error('QuotaExceededError');
    },
  };
  (globalThis as { window?: unknown }).window = {
    localStorage: throwingStorage,
    sessionStorage: throwingStorage,
  };

  assert.doesNotThrow(() => persistExpirations(['2025-06-20']));
  assert.deepEqual(persistExpirations(['2025-06-27', 'bad']), ['2025-06-27']);
  assert.deepEqual(readStoredExpirations(), []);
  assert.equal(readTabExpirations(), null);
  assert.deepEqual(resolveInitialExpirations(), []);

  // Restore the working stub for any subsequent tests.
  setWindow(session);
});

// A browser that offers localStorage but no sessionStorage (or vice versa) must
// still work — the missing layer is simply skipped, never dereferenced.
test('a missing storage area degrades instead of throwing', () => {
  (globalThis as { window?: unknown }).window = { localStorage: memory };

  assert.doesNotThrow(() => persistExpirations(['2025-06-20']));
  assert.equal(readTabExpirations(), null); // no sessionStorage → no tab pick
  assert.deepEqual(resolveInitialExpirations(), ['2025-06-20']); // default still works

  setWindow(session);
});

// SSR safety: with no window at all, reads degrade to "All" and writes no-op
// while still returning the normalised value.
test('no window (SSR) degrades to [] and never throws', () => {
  const savedWindow = (globalThis as { window?: unknown }).window;
  delete (globalThis as { window?: unknown }).window;

  assert.deepEqual(readStoredExpirations(), []);
  assert.equal(readTabExpirations(), null);
  assert.deepEqual(resolveInitialExpirations(), []);
  assert.doesNotThrow(() => persistExpirations(['2025-06-20']));
  assert.deepEqual(persistExpirations(['2025-06-20']), ['2025-06-20']);

  (globalThis as { window?: unknown }).window = savedWindow;
});

// ---------------------------------------------------------------------------
// The two-layer tab contract — what this split exists for.
// ---------------------------------------------------------------------------

test('persistExpirations writes both layers: this tab live + the shared default', () => {
  persistExpirations(['2025-06-20']);
  assert.equal(session.getItem(EXPIRATIONS_SESSION_KEY), '["2025-06-20"]');
  assert.equal(memory.getItem(EXPIRATIONS_STORAGE_KEY), '["2025-06-20"]');
});

// The regression this layer was built for: two tabs open side by side must be
// able to hold DIFFERENT expirations. Tab B picking must not move tab A.
test('two open tabs keep independent selections', () => {
  const tabA = openTab();
  persistExpirations(['2025-06-20']);

  const tabB = openTab();
  persistExpirations(['2025-07-03']);

  // Back on tab A: its own session store still holds A's pick, even though the
  // shared default has since moved to B's.
  setWindow(tabA);
  assert.deepEqual(resolveInitialExpirations(), ['2025-06-20']);

  setWindow(tabB);
  assert.deepEqual(resolveInitialExpirations(), ['2025-07-03']);

  // The shared default is the last pick made anywhere.
  assert.deepEqual(readStoredExpirations(), ['2025-07-03']);
});

// The other half of the deal: persistence across tabs is by SEEDING, so a tab
// opened after the fact still starts on the last thing the user chose.
test('a newly opened tab seeds from the last-selected default', () => {
  persistExpirations(['2025-06-27']);

  openTab(); // fresh tab: empty sessionStorage, same localStorage
  assert.equal(readTabExpirations(), null);
  assert.deepEqual(resolveInitialExpirations(), ['2025-06-27']);
});

// A tab that has explicitly chosen All ([]) must STAY on All. This is why
// readTabExpirations distinguishes null (never picked) from [] (picked All) —
// re-seeding here would drag the tab back to a default it deliberately left.
test("a tab's explicit All is not overwritten by a non-empty default", () => {
  persistExpirations(['2025-06-20']); // default is now non-empty
  const tabB = openTab();
  persistExpirations([]); // tab B picks All

  setWindow(tabB);
  assert.deepEqual(readTabExpirations(), []);
  assert.deepEqual(resolveInitialExpirations(), []);
  assert.deepEqual(readStoredExpirations(), []); // All is also the new default
});

// Reloading a tab (same sessionStorage, module state gone) must come back on
// that tab's own pick — including when another tab has since moved the default.
test("a reload restores the tab's own selection, not another tab's", () => {
  const tabA = openTab();
  persistExpirations(['2025-06-20']);

  openTab();
  persistExpirations(['2025-07-03']); // another tab moves the shared default

  setWindow(tabA); // tab A reloads: same session store, fresh module state
  assert.deepEqual(resolveInitialExpirations(), ['2025-06-20']);
});

// A corrupt tab blob must fall through to the default rather than wedge the tab
// on "All" — absent and unusable are treated the same at the tab layer.
test('a corrupt tab blob falls through to the shared default', () => {
  persistExpirations(['2025-06-27']);
  session.setItem(EXPIRATIONS_SESSION_KEY, 'not json');
  assert.equal(readTabExpirations(), null);
  assert.deepEqual(resolveInitialExpirations(), ['2025-06-27']);

  session.setItem(EXPIRATIONS_SESSION_KEY, '{"not":"an array"}');
  assert.deepEqual(resolveInitialExpirations(), ['2025-06-27']);
});
