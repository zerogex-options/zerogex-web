// Unit tests for the "My Dashboard" layout persistence + pure reducers
// (frontend/core/myDashboardLayout.ts) that back the customizable dashboard.
// Focus: the robustness contract (a corrupt/old/new stored blob can never crash
// the dashboard — worst case is an empty layout) and the immutable reducers.
import test from 'node:test';
import assert from 'node:assert/strict';

// The module reads `window.localStorage` lazily (inside each function, guarded
// by a typeof check), so stubbing a minimal in-memory Storage on the global
// before the functions run is enough to exercise the real browser path under
// the Node test runner. Mirrors tests/chartSettings.test.ts.
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
const {
  emptyLayout,
  sanitizeLayout,
  loadLayout,
  saveLayout,
  clearLayout,
  addWidget,
  removeWidget,
  resizeWidget,
  toggleWidget,
  moveWidget,
  hasWidget,
  isWidgetSize,
  MY_DASHBOARD_LAYOUT_VERSION,
} = await import('../core/myDashboardLayout.ts');

const SCOPE = 'user-123';

test('isWidgetSize accepts only the closed set', () => {
  assert.equal(isWidgetSize('sm'), true);
  assert.equal(isWidgetSize('xl'), true);
  assert.equal(isWidgetSize('huge'), false);
  assert.equal(isWidgetSize(2), false);
  assert.equal(isWidgetSize(null), false);
});

test('round-trips a saved layout for a scope', () => {
  memory.clear();
  const layout = addWidget(addWidget(emptyLayout(), 'net-gex', 'sm'), 'volatility', 'md');
  assert.equal(saveLayout(layout, SCOPE), true);
  const restored = loadLayout(SCOPE);
  assert.deepEqual(restored, layout);
});

test('scopes are isolated from each other', () => {
  memory.clear();
  saveLayout(addWidget(emptyLayout(), 'net-gex', 'sm'), 'user-a');
  saveLayout(addWidget(emptyLayout(), 'max-pain', 'lg'), 'user-b');
  assert.deepEqual(loadLayout('user-a')?.widgets, [{ widgetId: 'net-gex', size: 'sm' }]);
  assert.deepEqual(loadLayout('user-b')?.widgets, [{ widgetId: 'max-pain', size: 'lg' }]);
});

test('loadLayout returns null when nothing is stored', () => {
  memory.clear();
  assert.equal(loadLayout('never-saved'), null);
});

test('clearLayout removes only its scope', () => {
  memory.clear();
  saveLayout(addWidget(emptyLayout(), 'net-gex', 'sm'), 'user-a');
  saveLayout(addWidget(emptyLayout(), 'max-pain', 'lg'), 'user-b');
  clearLayout('user-a');
  assert.equal(loadLayout('user-a'), null);
  assert.deepEqual(loadLayout('user-b')?.widgets, [{ widgetId: 'max-pain', size: 'lg' }]);
});

test('sanitizeLayout survives garbage without throwing', () => {
  assert.deepEqual(sanitizeLayout(null).widgets, []);
  assert.deepEqual(sanitizeLayout('nonsense').widgets, []);
  assert.deepEqual(sanitizeLayout(42).widgets, []);
  assert.deepEqual(sanitizeLayout({ widgets: 'not-an-array' }).widgets, []);
  assert.deepEqual(sanitizeLayout({ widgets: [null, 3, 'x', {}] }).widgets, []);
});

test('sanitizeLayout coerces a bad size to the default and keeps the widget', () => {
  const layout = sanitizeLayout({ widgets: [{ widgetId: 'net-gex', size: 'nope' }] });
  assert.deepEqual(layout.widgets, [{ widgetId: 'net-gex', size: 'md' }]);
  assert.equal(layout.version, MY_DASHBOARD_LAYOUT_VERSION);
});

test('sanitizeLayout drops unknown widget ids when a valid set is supplied', () => {
  const valid = new Set(['net-gex', 'max-pain']);
  const layout = sanitizeLayout(
    { widgets: [{ widgetId: 'net-gex', size: 'sm' }, { widgetId: 'ghost', size: 'sm' }] },
    valid,
  );
  assert.deepEqual(layout.widgets, [{ widgetId: 'net-gex', size: 'sm' }]);
});

test('sanitizeLayout de-duplicates repeated widget ids (keeps first)', () => {
  const layout = sanitizeLayout({
    widgets: [
      { widgetId: 'net-gex', size: 'sm' },
      { widgetId: 'net-gex', size: 'xl' },
    ],
  });
  assert.deepEqual(layout.widgets, [{ widgetId: 'net-gex', size: 'sm' }]);
});

test('loadLayout applies valid-id filtering to a persisted blob', () => {
  memory.clear();
  saveLayout(
    { version: MY_DASHBOARD_LAYOUT_VERSION, widgets: [
      { widgetId: 'net-gex', size: 'sm' },
      { widgetId: 'removed-in-newer-build', size: 'md' },
    ] },
    SCOPE,
  );
  const restored = loadLayout(SCOPE, new Set(['net-gex']));
  assert.deepEqual(restored?.widgets, [{ widgetId: 'net-gex', size: 'sm' }]);
});

test('addWidget is idempotent and immutable', () => {
  const base = addWidget(emptyLayout(), 'net-gex', 'sm');
  const again = addWidget(base, 'net-gex', 'xl');
  assert.equal(again, base, 'adding a duplicate returns the same reference (no-op)');
  const grown = addWidget(base, 'max-pain', 'md');
  assert.notEqual(grown, base, 'a real add produces a new object');
  assert.equal(base.widgets.length, 1, 'the original layout is not mutated');
  assert.equal(grown.widgets.length, 2);
});

test('removeWidget removes and is a no-op when absent', () => {
  const base = addWidget(emptyLayout(), 'net-gex', 'sm');
  assert.equal(removeWidget(base, 'not-there'), base);
  assert.deepEqual(removeWidget(base, 'net-gex').widgets, []);
});

test('resizeWidget updates only the target and no-ops when unchanged', () => {
  const base = addWidget(addWidget(emptyLayout(), 'net-gex', 'sm'), 'max-pain', 'sm');
  const resized = resizeWidget(base, 'max-pain', 'lg');
  assert.deepEqual(resized.widgets, [
    { widgetId: 'net-gex', size: 'sm' },
    { widgetId: 'max-pain', size: 'lg' },
  ]);
  assert.equal(resizeWidget(base, 'max-pain', 'sm'), base, 'same size is a no-op');
  assert.equal(resizeWidget(base, 'ghost', 'lg'), base, 'absent widget is a no-op');
});

test('toggleWidget adds then removes', () => {
  const added = toggleWidget(emptyLayout(), 'net-gex', 'md');
  assert.equal(hasWidget(added, 'net-gex'), true);
  const removed = toggleWidget(added, 'net-gex', 'md');
  assert.equal(hasWidget(removed, 'net-gex'), false);
});

test('moveWidget reorders with clamping', () => {
  const base = { version: MY_DASHBOARD_LAYOUT_VERSION, widgets: [
    { widgetId: 'a', size: 'sm' as const },
    { widgetId: 'b', size: 'sm' as const },
    { widgetId: 'c', size: 'sm' as const },
  ] };
  assert.deepEqual(moveWidget(base, 0, 2).widgets.map((w) => w.widgetId), ['b', 'c', 'a']);
  assert.deepEqual(moveWidget(base, 2, 0).widgets.map((w) => w.widgetId), ['c', 'a', 'b']);
  // Out-of-range indices clamp into the array.
  assert.deepEqual(moveWidget(base, 0, 99).widgets.map((w) => w.widgetId), ['b', 'c', 'a']);
  assert.deepEqual(moveWidget(base, -5, 1).widgets.map((w) => w.widgetId), ['b', 'a', 'c']);
  // A no-op move returns the same reference.
  assert.equal(moveWidget(base, 1, 1), base);
});
