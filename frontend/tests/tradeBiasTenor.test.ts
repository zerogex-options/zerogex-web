// Unit tests for the Trade Bias horizon preference (frontend/core/tradeBiasTenor.ts).
//
// The contract: a horizon the user picks survives a reload, an unrecognized or
// absent stored value falls back to the default rather than reaching the bias
// API, and blocked storage degrades instead of throwing.
//
// Mirrors tests/symbolPersistence.test.ts: the module reads window.localStorage
// lazily (guarded by a typeof check), so a minimal in-memory Storage stub on
// the global before the functions run exercises the real browser path under Node.
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
  isBiasTenor,
  persistBiasTenor,
  readStoredBiasTenor,
  resolveBiasTenor,
  BIAS_TENOR_OPTIONS,
  BIAS_TENOR_STORAGE_KEY,
  DEFAULT_BIAS_TENOR,
} = await import('../core/tradeBiasTenor.ts');

test.beforeEach(() => {
  memory.clear();
});

test('isBiasTenor accepts the two horizons and rejects everything else', () => {
  assert.equal(isBiasTenor('swing'), true);
  assert.equal(isBiasTenor('intraday'), true);
  assert.equal(isBiasTenor('0dte'), false);
  assert.equal(isBiasTenor('Swing'), false);
  assert.equal(isBiasTenor(''), false);
  assert.equal(isBiasTenor(null), false);
  assert.equal(isBiasTenor(undefined), false);
  assert.equal(isBiasTenor(0), false);
});

test('the options list is exactly the accepted values, in display order', () => {
  // Guards the pairing that actually matters: a label added to the dropdown
  // without a matching guard entry would be selectable, persist, then fail the
  // guard on the next load and silently snap back to swing.
  assert.deepEqual(
    BIAS_TENOR_OPTIONS.map((o) => o.value),
    ['swing', 'intraday'],
  );
  for (const option of BIAS_TENOR_OPTIONS) {
    assert.equal(isBiasTenor(option.value), true, `${option.value} must pass the guard`);
    assert.ok(option.label.length > 0, `${option.value} needs a label`);
  }
});

test('a picked horizon round-trips through storage', () => {
  persistBiasTenor('intraday');
  assert.equal(memory.getItem(BIAS_TENOR_STORAGE_KEY), 'intraday');
  assert.equal(readStoredBiasTenor(), 'intraday');
  assert.equal(resolveBiasTenor(), 'intraday');
});

test('nothing stored resolves to the default', () => {
  assert.equal(readStoredBiasTenor(), null, 'null distinguishes "never picked"');
  assert.equal(resolveBiasTenor(), DEFAULT_BIAS_TENOR);
  assert.equal(DEFAULT_BIAS_TENOR, 'swing', 'the structural read is the safe default');
});

test('a tampered or stale stored value falls back to the default', () => {
  // The value guard is the point: an unrecognized tenor forwarded to the bias
  // API returns no reading, and the page would show an empty state that looks
  // like an outage rather than a bad preference.
  memory.setItem(BIAS_TENOR_STORAGE_KEY, 'banana');
  assert.equal(readStoredBiasTenor(), null);
  assert.equal(resolveBiasTenor(), DEFAULT_BIAS_TENOR);
});

test('blocked storage degrades instead of throwing', () => {
  const throwing = {
    getItem() {
      throw new Error('storage disabled');
    },
    setItem() {
      throw new Error('storage disabled');
    },
  };
  (globalThis as { window?: unknown }).window = { localStorage: throwing };
  assert.doesNotThrow(() => persistBiasTenor('intraday'));
  assert.equal(readStoredBiasTenor(), null);
  assert.equal(resolveBiasTenor(), DEFAULT_BIAS_TENOR);
  (globalThis as { window?: unknown }).window = { localStorage: memory };
});

test('server-side rendering never touches window', () => {
  const saved = (globalThis as { window?: unknown }).window;
  delete (globalThis as { window?: unknown }).window;
  assert.doesNotThrow(() => persistBiasTenor('intraday'));
  assert.equal(readStoredBiasTenor(), null);
  assert.equal(resolveBiasTenor(), DEFAULT_BIAS_TENOR);
  (globalThis as { window?: unknown }).window = saved;
});
