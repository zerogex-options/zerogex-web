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
  duplicateWidget,
  removeWidget,
  removeAllOfWidget,
  resizeWidget,
  moveWidget,
  hasWidget,
  countWidget,
  widgetCounts,
  makeInstanceId,
  isWidgetSize,
  MY_DASHBOARD_LAYOUT_VERSION,
} = await import('../core/myDashboardLayout.ts');

// Placements carry a generated instanceId; most assertions care about the
// (widgetId, size) pair, so compare on that projection.
const placements = (layout: { widgets: { widgetId: string; size: string }[] }) =>
  layout.widgets.map((w) => ({ widgetId: w.widgetId, size: w.size }));

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
  assert.deepEqual(placements(loadLayout('user-a')!), [{ widgetId: 'net-gex', size: 'sm' }]);
  assert.deepEqual(placements(loadLayout('user-b')!), [{ widgetId: 'max-pain', size: 'lg' }]);
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
  assert.deepEqual(placements(loadLayout('user-b')!), [{ widgetId: 'max-pain', size: 'lg' }]);
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
  assert.deepEqual(placements(layout), [{ widgetId: 'net-gex', size: 'md' }]);
  assert.equal(layout.version, MY_DASHBOARD_LAYOUT_VERSION);
});

test('sanitizeLayout drops unknown widget ids when a valid set is supplied', () => {
  const valid = new Set(['net-gex', 'max-pain']);
  const layout = sanitizeLayout(
    { widgets: [{ widgetId: 'net-gex', size: 'sm' }, { widgetId: 'ghost', size: 'sm' }] },
    valid,
  );
  assert.deepEqual(placements(layout), [{ widgetId: 'net-gex', size: 'sm' }]);
});

test('sanitizeLayout keeps repeated widget ids as distinct instances', () => {
  const layout = sanitizeLayout({
    widgets: [
      { widgetId: 'gamma-chart', size: 'md' },
      { widgetId: 'gamma-chart', size: 'md' },
    ],
  });
  assert.deepEqual(placements(layout), [
    { widgetId: 'gamma-chart', size: 'md' },
    { widgetId: 'gamma-chart', size: 'md' },
  ]);
  assert.equal(new Set(layout.widgets.map((w) => w.instanceId)).size, 2, 'instance ids are unique');
});

test('sanitizeLayout assigns instance ids to a legacy (pre-duplicates) blob', () => {
  const layout = sanitizeLayout({
    widgets: [
      { widgetId: 'net-gex', size: 'sm' },
      { widgetId: 'max-pain', size: 'sm' },
    ],
  });
  assert.deepEqual(layout.widgets.map((w) => w.instanceId), ['net-gex#1', 'max-pain#1']);
});

test('sanitizeLayout repairs colliding / missing instance ids', () => {
  const layout = sanitizeLayout({
    widgets: [
      { instanceId: 'dup', widgetId: 'net-gex', size: 'sm' },
      { instanceId: 'dup', widgetId: 'net-gex', size: 'md' },
      { instanceId: 42, widgetId: 'net-gex', size: 'lg' },
    ],
  });
  const ids = layout.widgets.map((w) => w.instanceId);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);
  assert.equal(ids[0], 'dup', 'the first claim on an id keeps it');
});

test('makeInstanceId skips ids already in use', () => {
  assert.equal(makeInstanceId('gamma-chart', new Set()), 'gamma-chart#1');
  assert.equal(
    makeInstanceId('gamma-chart', new Set(['gamma-chart#1', 'gamma-chart#2'])),
    'gamma-chart#3',
  );
});

test('loadLayout applies valid-id filtering to a persisted blob', () => {
  memory.clear();
  saveLayout(
    { version: MY_DASHBOARD_LAYOUT_VERSION, widgets: [
      { instanceId: 'net-gex#1', widgetId: 'net-gex', size: 'sm' },
      { instanceId: 'removed-in-newer-build#1', widgetId: 'removed-in-newer-build', size: 'md' },
    ] },
    SCOPE,
  );
  const restored = loadLayout(SCOPE, new Set(['net-gex']));
  assert.deepEqual(placements(restored!), [{ widgetId: 'net-gex', size: 'sm' }]);
});

test('addWidget appends a new instance each time and is immutable', () => {
  const base = addWidget(emptyLayout(), 'gamma-chart', 'md');
  const twice = addWidget(base, 'gamma-chart', 'md');
  assert.equal(base.widgets.length, 1, 'the original layout is not mutated');
  assert.equal(twice.widgets.length, 2, 'the same widget can be placed more than once');
  assert.deepEqual(twice.widgets.map((w) => w.instanceId), ['gamma-chart#1', 'gamma-chart#2']);
  assert.notEqual(twice, base, 'an add produces a new object');
});

test('duplicateWidget inserts a same-size copy right after the original', () => {
  const base = addWidget(addWidget(emptyLayout(), 'gamma-chart', 'md'), 'net-gex', 'sm');
  const copied = duplicateWidget(base, 'gamma-chart#1');
  assert.deepEqual(placements(copied), [
    { widgetId: 'gamma-chart', size: 'md' },
    { widgetId: 'gamma-chart', size: 'md' },
    { widgetId: 'net-gex', size: 'sm' },
  ]);
  assert.deepEqual(copied.widgets.map((w) => w.instanceId), [
    'gamma-chart#1',
    'gamma-chart#2',
    'net-gex#1',
  ]);
  assert.equal(duplicateWidget(base, 'ghost#1'), base, 'an absent instance is a no-op');
});

test('removeWidget removes one instance and is a no-op when absent', () => {
  const base = addWidget(addWidget(emptyLayout(), 'gamma-chart', 'md'), 'gamma-chart', 'lg');
  assert.equal(removeWidget(base, 'not-there'), base);
  const pruned = removeWidget(base, 'gamma-chart#1');
  assert.deepEqual(placements(pruned), [{ widgetId: 'gamma-chart', size: 'lg' }]);
  assert.equal(pruned.widgets[0].instanceId, 'gamma-chart#2', 'the other copy survives');
});

test('removeAllOfWidget clears every copy', () => {
  const base = addWidget(addWidget(emptyLayout(), 'gamma-chart', 'md'), 'gamma-chart', 'md');
  assert.deepEqual(removeAllOfWidget(base, 'gamma-chart').widgets, []);
  assert.equal(removeAllOfWidget(base, 'ghost'), base, 'an absent widget is a no-op');
});

test('resizeWidget updates only the target instance and no-ops when unchanged', () => {
  const base = addWidget(addWidget(emptyLayout(), 'gamma-chart', 'xl'), 'gamma-chart', 'xl');
  const resized = resizeWidget(base, 'gamma-chart#2', 'md');
  assert.deepEqual(placements(resized), [
    { widgetId: 'gamma-chart', size: 'xl' },
    { widgetId: 'gamma-chart', size: 'md' },
  ]);
  assert.equal(resizeWidget(base, 'gamma-chart#2', 'xl'), base, 'same size is a no-op');
  assert.equal(resizeWidget(base, 'ghost#1', 'lg'), base, 'absent instance is a no-op');
});

test('counts report the copies of each widget', () => {
  const board = addWidget(
    addWidget(addWidget(emptyLayout(), 'gamma-chart', 'md'), 'gamma-chart', 'md'),
    'net-gex',
    'sm',
  );
  assert.equal(hasWidget(board, 'gamma-chart'), true);
  assert.equal(countWidget(board, 'gamma-chart'), 2);
  assert.equal(countWidget(board, 'ghost'), 0);
  assert.deepEqual([...widgetCounts(board)], [['gamma-chart', 2], ['net-gex', 1]]);
});

test('moveWidget reorders with clamping', () => {
  const base = { version: MY_DASHBOARD_LAYOUT_VERSION, widgets: [
    { instanceId: 'a#1', widgetId: 'a', size: 'sm' as const },
    { instanceId: 'b#1', widgetId: 'b', size: 'sm' as const },
    { instanceId: 'c#1', widgetId: 'c', size: 'sm' as const },
  ] };
  assert.deepEqual(moveWidget(base, 0, 2).widgets.map((w) => w.widgetId), ['b', 'c', 'a']);
  assert.deepEqual(moveWidget(base, 2, 0).widgets.map((w) => w.widgetId), ['c', 'a', 'b']);
  // Out-of-range indices clamp into the array.
  assert.deepEqual(moveWidget(base, 0, 99).widgets.map((w) => w.widgetId), ['b', 'c', 'a']);
  assert.deepEqual(moveWidget(base, -5, 1).widgets.map((w) => w.widgetId), ['b', 'a', 'c']);
  // A no-op move returns the same reference.
  assert.equal(moveWidget(base, 1, 1), base);
});
