// Unit tests for the active-symbol persistence layer
// (frontend/core/symbolPersistence.ts) that backs the mobile ticker-persistence
// fix. The contract under test: a symbol the user picks must survive a full
// page reload (which iOS/WebKit triggers on its own under memory pressure), and
// a broken/absent store must only ever fall back to the default — never crash.
import test from 'node:test';
import assert from 'node:assert/strict';

// The module reads window.localStorage / window.location lazily (guarded by a
// typeof check), so stubbing a minimal in-memory Storage + location on the
// global before the functions run exercises the real browser path under Node,
// mirroring tests/chartSettings.test.ts.
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
const location = { search: '' };
(globalThis as { window?: unknown }).window = { localStorage: memory, location };

// Imported AFTER the window stub so any module-level evaluation still sees it.
const {
  persistSymbol,
  readStoredSymbol,
  resolveInitialSymbol,
  symbolFromSearch,
  isUnderlyingSymbol,
  SYMBOL_STORAGE_KEY,
  DEFAULT_UNDERLYING_SYMBOL,
} = await import('../core/symbolPersistence.ts');

test.beforeEach(() => {
  memory.clear();
  location.search = '';
});

test('resolveInitialSymbol returns the default when nothing is saved and no URL param', () => {
  assert.equal(resolveInitialSymbol(), DEFAULT_UNDERLYING_SYMBOL);
  assert.equal(DEFAULT_UNDERLYING_SYMBOL, 'SPY');
});

test('persistSymbol writes through and readStoredSymbol reads it back', () => {
  persistSymbol('QQQ');
  assert.equal(memory.getItem(SYMBOL_STORAGE_KEY), 'QQQ');
  assert.equal(readStoredSymbol(), 'QQQ');
});

// The core regression: user picks SPY, then the page is reloaded (iOS memory
// pressure / tab backgrounding). Because the pick was persisted synchronously,
// re-resolving on the fresh mount must come back on SPY — not the prior value.
test('a persisted pick survives a reload (no URL param present)', () => {
  memory.setItem(SYMBOL_STORAGE_KEY, 'SPX'); // whatever the user had before
  persistSymbol('SPY'); // user switches to SPY on the dashboard
  // Simulate a full reload landing on a param-less page (e.g. /gamma-exposure).
  assert.equal(resolveInitialSymbol(), 'SPY');
});

test('an explicit ?symbol= deep-link wins over the stored value', () => {
  memory.setItem(SYMBOL_STORAGE_KEY, 'SPY');
  location.search = '?symbol=QQQ';
  assert.equal(resolveInitialSymbol(), 'QQQ');
});

test('resolveInitialSymbol falls back to the stored value when the URL has no symbol', () => {
  memory.setItem(SYMBOL_STORAGE_KEY, 'SPX');
  location.search = '?foo=bar';
  assert.equal(resolveInitialSymbol(), 'SPX');
});

test('an invalid stored value falls back to the default, never crashes', () => {
  memory.setItem(SYMBOL_STORAGE_KEY, 'NOT_A_SYMBOL');
  assert.equal(readStoredSymbol(), null);
  assert.equal(resolveInitialSymbol(), DEFAULT_UNDERLYING_SYMBOL);
});

test('an invalid ?symbol= value is ignored', () => {
  location.search = '?symbol=tsla';
  assert.equal(symbolFromSearch(location.search), null);
  assert.equal(resolveInitialSymbol(), DEFAULT_UNDERLYING_SYMBOL);
});

test('symbol matching is case-sensitive to the canonical upper-case tickers', () => {
  assert.equal(isUnderlyingSymbol('SPY'), true);
  assert.equal(isUnderlyingSymbol('NDX'), true);
  assert.equal(isUnderlyingSymbol('spy'), false);
  assert.equal(isUnderlyingSymbol(null), false);
  assert.equal(isUnderlyingSymbol(undefined), false);
});

// NDX (Nasdaq-100 cash index) is a first-class underlying: it must validate,
// persist, and survive a reload exactly like the original three tickers.
test('NDX is a valid underlying that persists and deep-links', () => {
  persistSymbol('NDX');
  assert.equal(readStoredSymbol(), 'NDX');
  assert.equal(resolveInitialSymbol(), 'NDX');

  location.search = '?symbol=NDX';
  assert.equal(symbolFromSearch(location.search), 'NDX');
});

// Private-mode Safari throws on localStorage access. Persistence is best-effort:
// a throwing store must not bubble out of persistSymbol/readStoredSymbol.
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
    location: { search: '' },
  };

  assert.doesNotThrow(() => persistSymbol('SPX'));
  assert.equal(readStoredSymbol(), null);
  assert.equal(resolveInitialSymbol(), DEFAULT_UNDERLYING_SYMBOL);

  // Restore the working stub for any subsequent tests.
  (globalThis as { window?: unknown }).window = { localStorage: memory, location };
});
