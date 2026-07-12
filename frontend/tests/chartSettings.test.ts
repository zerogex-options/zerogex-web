// Unit tests for the per-chart settings persistence layer
// (frontend/core/chartSettings.ts) that backs the "Save Chart Settings"
// feature. Focuses on the robustness contract: an old/new/corrupt stored blob
// must never crash a chart — it may only ever fall back to defaults.
import test from 'node:test';
import assert from 'node:assert/strict';

// The module reads `window.localStorage` lazily (inside each function, guarded
// by a typeof check), so stubbing a minimal in-memory Storage on the global
// before the functions run is enough to exercise the real browser path under
// the Node test runner.
class MemoryStorage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
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
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
}

const memory = new MemoryStorage();
(globalThis as { window?: unknown }).window = { localStorage: memory };

// Imported AFTER the window stub so any module-level evaluation still sees it.
const { loadChartSettings, saveChartSettings, clearChartSettings, hasSavedChartSettings } =
  await import('../core/chartSettings.ts');

const CHART_ID = 'unit-test-chart';
const DEFAULTS = {
  tf: '5m',
  gexMode: 'split',
  withPrev: false,
  showGrid: true,
  zoom: 1.6,
};

test.beforeEach(() => {
  memory.clear();
});

test('loadChartSettings returns a fresh copy of defaults when nothing is saved', () => {
  const loaded = loadChartSettings(CHART_ID, DEFAULTS);
  assert.deepEqual(loaded, DEFAULTS);
  // Must be a copy, not the same reference — mutating it must not corrupt the
  // caller's shared DEFAULTS object.
  assert.notEqual(loaded, DEFAULTS);
  loaded.tf = '1m';
  assert.equal(DEFAULTS.tf, '5m');
});

test('save then load round-trips every field', () => {
  const chosen = { tf: '15m', gexMode: 'net', withPrev: true, showGrid: false, zoom: 2.4 };
  assert.equal(saveChartSettings(CHART_ID, chosen), true);
  assert.deepEqual(loadChartSettings(CHART_ID, DEFAULTS), chosen);
});

test('hasSavedChartSettings reflects presence, and clear removes it', () => {
  assert.equal(hasSavedChartSettings(CHART_ID), false);
  saveChartSettings(CHART_ID, DEFAULTS);
  assert.equal(hasSavedChartSettings(CHART_ID), true);
  assert.equal(clearChartSettings(CHART_ID), true);
  assert.equal(hasSavedChartSettings(CHART_ID), false);
  // After clearing, load falls back to defaults again.
  assert.deepEqual(loadChartSettings(CHART_ID, DEFAULTS), DEFAULTS);
});

test('load merges a partial blob over defaults (missing keys keep their default)', () => {
  memory.setItem(`zgx_chart_settings:${CHART_ID}`, JSON.stringify({ gexMode: 'net' }));
  const loaded = loadChartSettings(CHART_ID, DEFAULTS);
  assert.equal(loaded.gexMode, 'net');
  assert.equal(loaded.tf, '5m'); // untouched default
  assert.equal(loaded.showGrid, true); // untouched default
});

test('load ignores unknown keys not present in defaults', () => {
  memory.setItem(
    `zgx_chart_settings:${CHART_ID}`,
    JSON.stringify({ tf: '1m', legacyOnly: 'should-be-dropped' }),
  );
  const loaded = loadChartSettings(CHART_ID, DEFAULTS) as Record<string, unknown>;
  assert.equal(loaded.tf, '1m');
  assert.equal('legacyOnly' in loaded, false);
});

test('load drops type-mismatched values and keeps the default (corrupt/tampered blob)', () => {
  memory.setItem(
    `zgx_chart_settings:${CHART_ID}`,
    // showGrid stored as a string, zoom as a string, withPrev as a number —
    // all the wrong runtime type for their defaults.
    JSON.stringify({ tf: '1m', showGrid: 'yes', zoom: 'wide', withPrev: 1 }),
  );
  const loaded = loadChartSettings(CHART_ID, DEFAULTS);
  assert.equal(loaded.tf, '1m'); // right type → restored
  assert.equal(loaded.showGrid, true); // wrong type → default
  assert.equal(loaded.zoom, 1.6); // wrong type → default
  assert.equal(loaded.withPrev, false); // wrong type → default
});

test('load survives corrupt JSON and a non-object payload', () => {
  memory.setItem(`zgx_chart_settings:${CHART_ID}`, '{not valid json');
  assert.deepEqual(loadChartSettings(CHART_ID, DEFAULTS), DEFAULTS);
  memory.setItem(`zgx_chart_settings:${CHART_ID}`, JSON.stringify('a bare string'));
  assert.deepEqual(loadChartSettings(CHART_ID, DEFAULTS), DEFAULTS);
  memory.setItem(`zgx_chart_settings:${CHART_ID}`, JSON.stringify(null));
  assert.deepEqual(loadChartSettings(CHART_ID, DEFAULTS), DEFAULTS);
});

test('distinct chart ids do not share state', () => {
  saveChartSettings('chart-a', { ...DEFAULTS, tf: '1m' });
  saveChartSettings('chart-b', { ...DEFAULTS, tf: '15m' });
  assert.equal(loadChartSettings('chart-a', DEFAULTS).tf, '1m');
  assert.equal(loadChartSettings('chart-b', DEFAULTS).tf, '15m');
});
