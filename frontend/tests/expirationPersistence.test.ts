// Unit tests for the shared expiration-filter persistence layer
// (frontend/core/expirationPersistence.ts) that backs the cross-chart
// expiration selection. The contract under test: a set of expirations the user
// picks must round-trip through storage in a normalised shape, reconcile
// cleanly against each chart's live options (so stale/expired dates drop out),
// and a broken/absent/tampered store must only ever fall back to "All" (empty)
// — never crash.
//
// Mirrors tests/symbolPersistence.test.ts: the module reads
// window.localStorage lazily (guarded by a typeof check), so a minimal
// in-memory Storage stubbed on the global before the functions run exercises
// the real browser path under Node.
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
(globalThis as { window?: unknown }).window = { localStorage: memory };

// Imported AFTER the window stub so any module-level evaluation still sees it.
const {
  isExpirationDate,
  normalizeExpirations,
  reconcileExpirations,
  readStoredExpirations,
  persistExpirations,
  sameExpirations,
  EXPIRATIONS_STORAGE_KEY,
} = await import('../core/expirationPersistence.ts');

test.beforeEach(() => {
  memory.clear();
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
  (globalThis as { window?: unknown }).window = { localStorage: throwingStorage };

  assert.doesNotThrow(() => persistExpirations(['2025-06-20']));
  assert.deepEqual(persistExpirations(['2025-06-27', 'bad']), ['2025-06-27']);
  assert.deepEqual(readStoredExpirations(), []);

  // Restore the working stub for any subsequent tests.
  (globalThis as { window?: unknown }).window = { localStorage: memory };
});

// SSR safety: with no window at all, reads degrade to "All" and writes no-op
// while still returning the normalised value.
test('no window (SSR) degrades to [] and never throws', () => {
  const savedWindow = (globalThis as { window?: unknown }).window;
  delete (globalThis as { window?: unknown }).window;

  assert.deepEqual(readStoredExpirations(), []);
  assert.doesNotThrow(() => persistExpirations(['2025-06-20']));
  assert.deepEqual(persistExpirations(['2025-06-20']), ['2025-06-20']);

  (globalThis as { window?: unknown }).window = savedWindow;
});
