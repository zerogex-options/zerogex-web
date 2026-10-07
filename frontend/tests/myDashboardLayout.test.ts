// Unit tests for the "My Dashboard" layout persistence + pure reducers
// (frontend/core/myDashboardLayout.ts) that back the customizable dashboard.
// Focus: the robustness contract (a corrupt/old/new stored blob can never crash
// the dashboard — worst case is an empty layout), the migration of a pre-split
// board, the immutable reducers, and the split/clone/scope behavior that lets a
// member set one half up and read a retargeted copy beside it.
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
  moveWidgetToPane,
  clonePane,
  clearPane,
  swapPanes,
  setSplit,
  setLinkPriceAxis,
  setPaneSymbol,
  setPaneExpirations,
  getPane,
  visiblePanes,
  allWidgets,
  paneOfInstance,
  isLayoutEmpty,
  isScoped,
  totalWidgetCount,
  hasWidget,
  countWidget,
  widgetCounts,
  makeInstanceId,
  isWidgetSize,
  isPaneId,
  otherPaneId,
  MY_DASHBOARD_LAYOUT_VERSION,
  chooseWorkingBoard,
  hasBoardSynced,
  isBoardUnsynced,
  setBoardUnsynced,
  setWidgetSymbol,
  setWidgetBox,
  setWidgetZoom,
  setWidgetPanelWidth,
  clampSpan,
  clampPanelWidth,
  GRID_TRACKS,
  toSpanStep,
  tracksForWidth,
  renderedSpan,
  spanFloor,
  clampHeight,
  isWidgetZoom,
  WIDGET_COLSPAN,
  GRID_COLUMNS,
  MIN_WIDGET_HEIGHT,
  MAX_WIDGET_HEIGHT,
} = await import('../core/myDashboardLayout.ts');

type Layout = ReturnType<typeof emptyLayout>;
type PaneKey = 'a' | 'b';

// Placements carry a generated instanceId; most assertions care about the
// (widgetId, size) pair, so compare on that projection.
const placements = (layout: Layout, pane: PaneKey = 'a') =>
  getPane(layout, pane).widgets.map((w) => ({ widgetId: w.widgetId, size: w.size }));
const ids = (layout: Layout, pane: PaneKey = 'a') =>
  getPane(layout, pane).widgets.map((w) => w.instanceId);
const widgetsOf = (layout: Layout, pane: PaneKey = 'a') => getPane(layout, pane).widgets;

// Add straight to pane 'a' — the single-board case almost every test exercises.
const add = (layout: Layout, widgetId: string, size: 'sm' | 'md' | 'lg' | 'xl') =>
  addWidget(layout, 'a', widgetId, size);

const SCOPE = 'user-123';

test('isWidgetSize accepts only the closed set', () => {
  assert.equal(isWidgetSize('sm'), true);
  assert.equal(isWidgetSize('xl'), true);
  assert.equal(isWidgetSize('huge'), false);
  assert.equal(isWidgetSize(2), false);
  assert.equal(isWidgetSize(null), false);
});

test('isPaneId / otherPaneId cover the closed pane set', () => {
  assert.equal(isPaneId('a'), true);
  assert.equal(isPaneId('b'), true);
  assert.equal(isPaneId('c'), false);
  assert.equal(isPaneId(0), false);
  assert.equal(otherPaneId('a'), 'b');
  assert.equal(otherPaneId('b'), 'a');
});

test('a fresh layout has two panes, unsplit and unscoped', () => {
  const layout = emptyLayout();
  assert.equal(layout.panes.length, 2);
  assert.deepEqual(layout.panes.map((p) => p.id), ['a', 'b']);
  assert.equal(layout.split, false);
  assert.equal(layout.linkPriceAxis, true, 'linked price axes are the default');
  assert.equal(isLayoutEmpty(layout), true);
  assert.equal(isScoped(layout.panes[0].scope), false);
  assert.deepEqual(visiblePanes(layout).map((p) => p.id), ['a'], 'only side A renders unsplit');
});

test('round-trips a saved layout for a scope', () => {
  memory.clear();
  const layout = add(add(emptyLayout(), 'net-gex', 'sm'), 'volatility', 'md');
  assert.equal(saveLayout(layout, SCOPE), true);
  const restored = loadLayout(SCOPE);
  assert.deepEqual(restored, layout);
});

test('round-trips a split, per-half-scoped board', () => {
  memory.clear();
  let layout = add(emptyLayout(), 'gamma-by-strike', 'xl');
  layout = clonePane(layout, 'a', 'b');
  layout = setPaneSymbol(layout, 'b', 'QQQ');
  layout = setPaneExpirations(layout, 'b', ['2026-01-16']);
  assert.equal(saveLayout(layout, SCOPE), true);
  const restored = loadLayout(SCOPE)!;
  assert.deepEqual(restored, layout);
  assert.equal(restored.split, true);
  assert.equal(getPane(restored, 'b').scope.symbol, 'QQQ');
  assert.deepEqual(getPane(restored, 'b').scope.expirations, ['2026-01-16']);
});

test('scopes are isolated from each other', () => {
  memory.clear();
  saveLayout(add(emptyLayout(), 'net-gex', 'sm'), 'user-a');
  saveLayout(add(emptyLayout(), 'max-pain', 'lg'), 'user-b');
  assert.deepEqual(placements(loadLayout('user-a')!), [{ widgetId: 'net-gex', size: 'sm' }]);
  assert.deepEqual(placements(loadLayout('user-b')!), [{ widgetId: 'max-pain', size: 'lg' }]);
});

test('loadLayout returns null when nothing is stored', () => {
  memory.clear();
  assert.equal(loadLayout('never-saved'), null);
});

test('clearLayout removes only its scope', () => {
  memory.clear();
  saveLayout(add(emptyLayout(), 'net-gex', 'sm'), 'user-a');
  saveLayout(add(emptyLayout(), 'max-pain', 'lg'), 'user-b');
  clearLayout('user-a');
  assert.equal(loadLayout('user-a'), null);
  assert.deepEqual(placements(loadLayout('user-b')!), [{ widgetId: 'max-pain', size: 'lg' }]);
});

test('sanitizeLayout survives garbage without throwing', () => {
  for (const junk of [null, 'nonsense', 42, { widgets: 'not-an-array' }, { panes: 'nope' }]) {
    const layout = sanitizeLayout(junk);
    assert.equal(totalWidgetCount(layout), 0);
    assert.equal(layout.panes.length, 2);
    assert.equal(layout.split, false);
  }
  assert.equal(totalWidgetCount(sanitizeLayout({ widgets: [null, 3, 'x', {}] })), 0);
  assert.equal(totalWidgetCount(sanitizeLayout({ panes: [null, 3, { id: 'z' }] })), 0);
});

test('sanitizeLayout coerces a bad size to the default and keeps the widget', () => {
  const layout = sanitizeLayout({ widgets: [{ widgetId: 'net-gex', size: 'nope' }] });
  assert.deepEqual(placements(layout), [{ widgetId: 'net-gex', size: 'md' }]);
  assert.equal(layout.version, MY_DASHBOARD_LAYOUT_VERSION);
});

test('sanitizeLayout drops unknown widget ids in BOTH panes', () => {
  const valid = new Set(['net-gex', 'max-pain']);
  const layout = sanitizeLayout(
    {
      split: true,
      panes: [
        { id: 'a', widgets: [{ widgetId: 'net-gex', size: 'sm' }, { widgetId: 'ghost', size: 'sm' }] },
        { id: 'b', widgets: [{ widgetId: 'ghost', size: 'sm' }, { widgetId: 'max-pain', size: 'lg' }] },
      ],
    },
    valid,
  );
  assert.deepEqual(placements(layout, 'a'), [{ widgetId: 'net-gex', size: 'sm' }]);
  assert.deepEqual(placements(layout, 'b'), [{ widgetId: 'max-pain', size: 'lg' }]);
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
  assert.equal(new Set(ids(layout)).size, 2, 'instance ids are unique');
});

test('sanitizeLayout keeps instance ids unique ACROSS the two panes', () => {
  const layout = sanitizeLayout({
    split: true,
    panes: [
      { id: 'a', widgets: [{ instanceId: 'shared', widgetId: 'gamma-chart', size: 'md' }] },
      { id: 'b', widgets: [{ instanceId: 'shared', widgetId: 'gamma-chart', size: 'md' }] },
    ],
  });
  const every = allWidgets(layout).map((w) => w.instanceId);
  assert.equal(every.length, 2);
  assert.equal(new Set(every).size, 2, 'a collision across panes is repaired');
  assert.equal(every[0], 'shared', 'the first claim on an id keeps it');
});

test('sanitizeLayout migrates a pre-split (v1) blob into side A, unsplit', () => {
  const layout = sanitizeLayout({
    version: 1,
    widgets: [
      { instanceId: 'net-gex#1', widgetId: 'net-gex', size: 'sm' },
      { instanceId: 'max-pain#1', widgetId: 'max-pain', size: 'sm' },
    ],
  });
  assert.equal(layout.split, false);
  assert.deepEqual(ids(layout, 'a'), ['net-gex#1', 'max-pain#1'], 'ids survive the migration');
  assert.deepEqual(widgetsOf(layout, 'b'), [], 'side B starts empty');
  assert.equal(isScoped(getPane(layout, 'a').scope), false);
});

test('sanitizeLayout assigns instance ids to a legacy (pre-duplicates) blob', () => {
  const layout = sanitizeLayout({
    widgets: [
      { widgetId: 'net-gex', size: 'sm' },
      { widgetId: 'max-pain', size: 'sm' },
    ],
  });
  assert.deepEqual(ids(layout), ['net-gex#1', 'max-pain#1']);
});

test('sanitizeLayout repairs colliding / missing instance ids', () => {
  const layout = sanitizeLayout({
    widgets: [
      { instanceId: 'dup', widgetId: 'net-gex', size: 'sm' },
      { instanceId: 'dup', widgetId: 'net-gex', size: 'md' },
      { instanceId: 42, widgetId: 'net-gex', size: 'lg' },
    ],
  });
  const list = ids(layout);
  assert.equal(list.length, 3);
  assert.equal(new Set(list).size, 3);
  assert.equal(list[0], 'dup', 'the first claim on an id keeps it');
});

test('sanitizeLayout validates a pane scope and keeps "All" distinct from "inherit"', () => {
  const layout = sanitizeLayout({
    split: 'yes-ish',
    panes: [
      { id: 'a', scope: { symbol: 'QQQ', expirations: ['2026-03-20', 'junk', '2026-01-16'] }, widgets: [] },
      { id: 'b', scope: { symbol: 'DOGE', expirations: [] }, widgets: [] },
    ],
  });
  assert.equal(layout.split, false, 'only a literal true splits the board');
  assert.equal(getPane(layout, 'a').scope.symbol, 'QQQ');
  assert.deepEqual(
    getPane(layout, 'a').scope.expirations,
    ['2026-01-16', '2026-03-20'],
    'expirations are normalized: junk dropped, sorted ascending',
  );
  assert.equal(getPane(layout, 'b').scope.symbol, null, 'an unknown symbol falls back to inherit');
  assert.deepEqual(getPane(layout, 'b').scope.expirations, [], 'an explicit "All" is preserved');
});

// ── The rolling 0DTE pane scope ──────────────────────────────────────────────
// The "0DTE Intraday" preset seeds a pane scope of [ROLLING_ZERO_DTE]. That is
// only a 0DTE board for as long as the token survives the round trip: if
// normalization dropped it the scope would silently become "All" — the whole
// chain — which is precisely the failure the token was introduced to end.

test('a pane scope pinned to the rolling 0DTE token round-trips through storage', () => {
  const pinned = setPaneExpirations(emptyLayout(), 'a', ['0DTE']);
  assert.deepEqual(getPane(pinned, 'a').scope.expirations, ['0DTE']);
  assert.equal(isScoped(getPane(pinned, 'a').scope), true, 'pinning surfaces the pane toolbar');

  saveLayout(pinned, SCOPE);
  const loaded = loadLayout(SCOPE);
  assert.deepEqual(
    getPane(loaded as Layout, 'a').scope.expirations,
    ['0DTE'],
    'the token survives save/load — a reload tomorrow is still a 0DTE board',
  );
});

test('sanitizeLayout keeps the 0DTE token and sorts it ahead of dated picks', () => {
  const layout = sanitizeLayout({
    panes: [
      { id: 'a', scope: { symbol: null, expirations: ['2026-03-20', '0DTE', 'junk'] }, widgets: [] },
      { id: 'b', scope: { symbol: null, expirations: null }, widgets: [] },
    ],
  });
  assert.deepEqual(
    getPane(layout, 'a').scope.expirations,
    ['0DTE', '2026-03-20'],
    'token first, junk still dropped',
  );
  assert.equal(
    getPane(layout, 'b').scope.expirations,
    null,
    'null still means "follow the page", distinct from a pinned selection',
  );
});

test('sanitizeLayout resolves reordered / duplicated / missing pane entries', () => {
  const layout = sanitizeLayout({
    split: true,
    panes: [
      { id: 'b', widgets: [{ widgetId: 'net-gex', size: 'sm' }] },
      { id: 'b', widgets: [{ widgetId: 'max-pain', size: 'sm' }] },
    ],
  });
  assert.deepEqual(layout.panes.map((p) => p.id), ['a', 'b'], 'pane order is canonical');
  assert.deepEqual(widgetsOf(layout, 'a'), [], 'the missing pane is empty, not absent');
  assert.deepEqual(placements(layout, 'b'), [{ widgetId: 'net-gex', size: 'sm' }], 'first wins');
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
    {
      version: MY_DASHBOARD_LAYOUT_VERSION,
      split: false,
      linkPriceAxis: true,
      panes: [
        {
          id: 'a' as const,
          scope: { symbol: null, expirations: null },
          widgets: [
            { instanceId: 'net-gex#1', widgetId: 'net-gex', size: 'sm' as const },
            {
              instanceId: 'removed-in-newer-build#1',
              widgetId: 'removed-in-newer-build',
              size: 'md' as const,
            },
          ],
        },
        { id: 'b' as const, scope: { symbol: null, expirations: null }, widgets: [] },
      ],
    },
    SCOPE,
  );
  const restored = loadLayout(SCOPE, new Set(['net-gex']));
  assert.deepEqual(placements(restored!), [{ widgetId: 'net-gex', size: 'sm' }]);
});

test('addWidget appends a new instance each time and is immutable', () => {
  const base = add(emptyLayout(), 'gamma-chart', 'md');
  const twice = add(base, 'gamma-chart', 'md');
  assert.equal(widgetsOf(base).length, 1, 'the original layout is not mutated');
  assert.equal(widgetsOf(twice).length, 2, 'the same widget can be placed more than once');
  assert.deepEqual(ids(twice), ['gamma-chart#1', 'gamma-chart#2']);
  assert.notEqual(twice, base, 'an add produces a new object');
});

test('addWidget targets the named pane and mints ids against the whole board', () => {
  const base = add(emptyLayout(), 'gamma-chart', 'md');
  const both = addWidget(base, 'b', 'gamma-chart', 'lg');
  assert.deepEqual(ids(both, 'a'), ['gamma-chart#1']);
  assert.deepEqual(ids(both, 'b'), ['gamma-chart#2'], 'ids never collide across the split');
  assert.equal(getPane(both, 'a'), getPane(base, 'a'), 'the untouched pane keeps its reference');
});

test('duplicateWidget inserts a same-size copy right after the original', () => {
  const base = add(add(emptyLayout(), 'gamma-chart', 'md'), 'net-gex', 'sm');
  const copied = duplicateWidget(base, 'gamma-chart#1');
  assert.deepEqual(placements(copied), [
    { widgetId: 'gamma-chart', size: 'md' },
    { widgetId: 'gamma-chart', size: 'md' },
    { widgetId: 'net-gex', size: 'sm' },
  ]);
  assert.deepEqual(ids(copied), ['gamma-chart#1', 'gamma-chart#2', 'net-gex#1']);
  assert.equal(duplicateWidget(base, 'ghost#1'), base, 'an absent instance is a no-op');
});

test('duplicateWidget finds its target in whichever pane holds it', () => {
  const base = addWidget(add(emptyLayout(), 'net-gex', 'sm'), 'b', 'gamma-chart', 'md');
  const copied = duplicateWidget(base, 'gamma-chart#1');
  assert.deepEqual(ids(copied, 'a'), ['net-gex#1'], 'side A is untouched');
  assert.deepEqual(ids(copied, 'b'), ['gamma-chart#1', 'gamma-chart#2']);
});

test('removeWidget removes one instance and is a no-op when absent', () => {
  const base = add(add(emptyLayout(), 'gamma-chart', 'md'), 'gamma-chart', 'lg');
  assert.equal(removeWidget(base, 'not-there'), base);
  const pruned = removeWidget(base, 'gamma-chart#1');
  assert.deepEqual(placements(pruned), [{ widgetId: 'gamma-chart', size: 'lg' }]);
  assert.equal(ids(pruned)[0], 'gamma-chart#2', 'the other copy survives');
});

test('removeAllOfWidget clears every copy, board-wide or per pane', () => {
  const base = addWidget(add(add(emptyLayout(), 'gamma-chart', 'md'), 'gamma-chart', 'md'), 'b', 'gamma-chart', 'sm');
  assert.equal(totalWidgetCount(removeAllOfWidget(base, 'gamma-chart')), 0, 'board-wide by default');
  const paneOnly = removeAllOfWidget(base, 'gamma-chart', 'a');
  assert.deepEqual(widgetsOf(paneOnly, 'a'), []);
  assert.equal(widgetsOf(paneOnly, 'b').length, 1, 'the other half is left alone');
  assert.equal(removeAllOfWidget(base, 'ghost'), base, 'an absent widget is a no-op');
});

test('resizeWidget updates only the target instance and no-ops when unchanged', () => {
  const base = add(add(emptyLayout(), 'gamma-chart', 'xl'), 'gamma-chart', 'xl');
  const resized = resizeWidget(base, 'gamma-chart#2', 'md');
  assert.deepEqual(placements(resized), [
    { widgetId: 'gamma-chart', size: 'xl' },
    { widgetId: 'gamma-chart', size: 'md' },
  ]);
  assert.equal(resizeWidget(base, 'gamma-chart#2', 'xl'), base, 'same size is a no-op');
  assert.equal(resizeWidget(base, 'ghost#1', 'lg'), base, 'absent instance is a no-op');
});

test('counts report the copies of each widget, board-wide or per pane', () => {
  let board = add(add(add(emptyLayout(), 'gamma-chart', 'md'), 'gamma-chart', 'md'), 'net-gex', 'sm');
  board = addWidget(board, 'b', 'gamma-chart', 'md');
  assert.equal(hasWidget(board, 'gamma-chart'), true);
  assert.equal(hasWidget(board, 'net-gex', 'b'), false, 'per-pane lookup ignores the other half');
  assert.equal(countWidget(board, 'gamma-chart'), 3);
  assert.equal(countWidget(board, 'gamma-chart', 'a'), 2);
  assert.equal(countWidget(board, 'ghost'), 0);
  assert.deepEqual([...widgetCounts(board, 'a')], [['gamma-chart', 2], ['net-gex', 1]]);
  assert.equal(totalWidgetCount(board), 4);
});

test('moveWidget reorders within one pane, with clamping', () => {
  const base = addWidget(
    addWidget(addWidget(emptyLayout(), 'a', 'a', 'sm'), 'a', 'b', 'sm'),
    'a',
    'c',
    'sm',
  );
  const order = (l: Layout) => widgetsOf(l).map((w) => w.widgetId);
  assert.deepEqual(order(moveWidget(base, 'a', 0, 2)), ['b', 'c', 'a']);
  assert.deepEqual(order(moveWidget(base, 'a', 2, 0)), ['c', 'a', 'b']);
  // Out-of-range indices clamp into the array.
  assert.deepEqual(order(moveWidget(base, 'a', 0, 99)), ['b', 'c', 'a']);
  assert.deepEqual(order(moveWidget(base, 'a', -5, 1)), ['b', 'a', 'c']);
  // A no-op move — and a move addressed at an empty pane — return the same reference.
  assert.equal(moveWidget(base, 'a', 1, 1), base);
  assert.equal(moveWidget(base, 'b', 0, 1), base);
});

test('moveWidgetToPane sends one tile across, keeping its id and size', () => {
  const base = add(add(emptyLayout(), 'gamma-chart', 'xl'), 'net-gex', 'sm');
  const moved = moveWidgetToPane(base, 'gamma-chart#1', 'b');
  assert.deepEqual(placements(moved, 'a'), [{ widgetId: 'net-gex', size: 'sm' }]);
  assert.deepEqual(placements(moved, 'b'), [{ widgetId: 'gamma-chart', size: 'xl' }]);
  assert.equal(paneOfInstance(moved, 'gamma-chart#1'), 'b');
  assert.equal(moveWidgetToPane(moved, 'gamma-chart#1', 'b'), moved, 'already there is a no-op');
  assert.equal(moveWidgetToPane(base, 'ghost#1', 'b'), base, 'an absent instance is a no-op');
});

test('setSplit toggles the second half without destroying it', () => {
  let layout = add(emptyLayout(), 'net-gex', 'sm');
  layout = addWidget(layout, 'b', 'max-pain', 'sm');
  layout = setSplit(layout, true);
  assert.deepEqual(visiblePanes(layout).map((p) => p.id), ['a', 'b']);
  const collapsed = setSplit(layout, false);
  assert.deepEqual(visiblePanes(collapsed).map((p) => p.id), ['a']);
  assert.equal(widgetsOf(collapsed, 'b').length, 1, 'side B is hidden, not cleared');
  assert.equal(setSplit(collapsed, false), collapsed, 'no change returns the same reference');
});

test('clonePane copies the widgets and the scope, and turns the split on', () => {
  let layout = add(add(emptyLayout(), 'gamma-by-strike', 'xl'), 'net-gex', 'sm');
  layout = setPaneSymbol(layout, 'a', 'SPX');
  layout = setPaneExpirations(layout, 'a', ['2026-01-16']);
  const cloned = clonePane(layout, 'a', 'b');

  assert.equal(cloned.split, true, 'cloning is what turns the board into two halves');
  assert.deepEqual(placements(cloned, 'b'), placements(cloned, 'a'), 'same widgets, same sizes');
  assert.deepEqual(
    getPane(cloned, 'b').scope,
    getPane(cloned, 'a').scope,
    'the copy starts on the same data and only diverges when retargeted',
  );
  assert.notDeepEqual(ids(cloned, 'b'), ids(cloned, 'a'), 'the copy gets its own instance ids');
  assert.equal(
    new Set(allWidgets(cloned).map((w) => w.instanceId)).size,
    allWidgets(cloned).length,
    'instance ids stay unique board-wide',
  );
  assert.notEqual(
    getPane(cloned, 'b').scope.expirations,
    getPane(cloned, 'a').scope.expirations,
    'the expiration array is copied, not shared',
  );
  assert.equal(clonePane(layout, 'a', 'a'), layout, 'cloning onto itself is a no-op');
});

test('clonePane replaces whatever the target half already held', () => {
  let layout = add(emptyLayout(), 'net-gex', 'sm');
  layout = addWidget(layout, 'b', 'max-pain', 'lg');
  const cloned = clonePane(layout, 'a', 'b');
  assert.deepEqual(placements(cloned, 'b'), [{ widgetId: 'net-gex', size: 'sm' }]);
  assert.equal(
    new Set(allWidgets(cloned).map((w) => w.instanceId)).size,
    2,
    'the replaced widgets free their ids without colliding',
  );
});

test('a cloned half is independent once retargeted', () => {
  let layout = clonePane(add(emptyLayout(), 'gamma-by-strike', 'xl'), 'a', 'b');
  layout = setPaneSymbol(layout, 'b', 'QQQ');
  layout = setPaneExpirations(layout, 'b', ['2026-02-20']);
  layout = resizeWidget(layout, ids(layout, 'b')[0], 'lg');

  assert.equal(getPane(layout, 'a').scope.symbol, null, 'side A still follows the page');
  assert.equal(getPane(layout, 'a').scope.expirations, null);
  assert.equal(getPane(layout, 'b').scope.symbol, 'QQQ');
  assert.equal(isScoped(getPane(layout, 'b').scope), true);
  assert.equal(widgetsOf(layout, 'a')[0].size, 'xl', 'resizing the copy left the original alone');
  assert.equal(widgetsOf(layout, 'b')[0].size, 'lg');
});

test('clearPane empties one half and leaves its scope and the other half alone', () => {
  let layout = clonePane(add(emptyLayout(), 'net-gex', 'sm'), 'a', 'b');
  layout = setPaneSymbol(layout, 'b', 'NDX');
  const cleared = clearPane(layout, 'b');
  assert.deepEqual(widgetsOf(cleared, 'b'), []);
  assert.equal(getPane(cleared, 'b').scope.symbol, 'NDX', 'the half keeps its underlying');
  assert.equal(widgetsOf(cleared, 'a').length, 1);
  assert.equal(clearPane(cleared, 'b'), cleared, 'clearing an empty half is a no-op');
});

test('swapPanes exchanges contents and scopes but keeps the pane ids in place', () => {
  let layout = add(emptyLayout(), 'net-gex', 'sm');
  layout = addWidget(layout, 'b', 'max-pain', 'lg');
  layout = setPaneSymbol(layout, 'b', 'SPX');
  const swapped = swapPanes(layout);
  assert.deepEqual(swapped.panes.map((p) => p.id), ['a', 'b']);
  assert.deepEqual(placements(swapped, 'a'), [{ widgetId: 'max-pain', size: 'lg' }]);
  assert.deepEqual(placements(swapped, 'b'), [{ widgetId: 'net-gex', size: 'sm' }]);
  assert.equal(getPane(swapped, 'a').scope.symbol, 'SPX');
  assert.equal(getPane(swapped, 'b').scope.symbol, null);
});

test('setPaneSymbol pins and un-pins a half', () => {
  const base = emptyLayout();
  const pinned = setPaneSymbol(base, 'b', 'QQQ');
  assert.equal(getPane(pinned, 'b').scope.symbol, 'QQQ');
  assert.equal(getPane(pinned, 'a').scope.symbol, null, 'the other half is untouched');
  assert.equal(setPaneSymbol(pinned, 'b', 'QQQ'), pinned, 'the same value is a no-op');
  assert.equal(getPane(setPaneSymbol(pinned, 'b', null), 'b').scope.symbol, null, 'null = follow the page');
});

test('setPaneExpirations normalizes, and separates "All" from "follow the page"', () => {
  const base = emptyLayout();
  const pinned = setPaneExpirations(base, 'a', ['2026-03-20', '2026-01-16', '2026-03-20']);
  assert.deepEqual(getPane(pinned, 'a').scope.expirations, ['2026-01-16', '2026-03-20']);
  assert.equal(
    setPaneExpirations(pinned, 'a', ['2026-03-20', '2026-01-16']),
    pinned,
    'an equivalent selection is a no-op',
  );

  const all = setPaneExpirations(pinned, 'a', []);
  assert.deepEqual(getPane(all, 'a').scope.expirations, [], 'an explicit All is a real selection');
  assert.equal(isScoped(getPane(all, 'a').scope), true);

  const inherit = setPaneExpirations(all, 'a', null);
  assert.equal(getPane(inherit, 'a').scope.expirations, null, 'null goes back to following the page');
  assert.equal(isScoped(getPane(inherit, 'a').scope), false);
  assert.equal(setPaneExpirations(inherit, 'a', null), inherit, 'still-inheriting is a no-op');
});

test('paneOfInstance / allWidgets read across both halves', () => {
  let layout = add(emptyLayout(), 'net-gex', 'sm');
  layout = addWidget(layout, 'b', 'max-pain', 'lg');
  assert.equal(paneOfInstance(layout, 'net-gex#1'), 'a');
  assert.equal(paneOfInstance(layout, 'max-pain#1'), 'b');
  assert.equal(paneOfInstance(layout, 'ghost#1'), null);
  assert.deepEqual(allWidgets(layout).map((w) => w.widgetId), ['net-gex', 'max-pain']);
  assert.equal(isLayoutEmpty(layout), false);
});

test('setLinkPriceAxis toggles, and only an explicit false survives a reload', () => {
  const base = emptyLayout();
  assert.equal(setLinkPriceAxis(base, true), base, 'already-on is a no-op');
  const off = setLinkPriceAxis(base, false);
  assert.equal(off.linkPriceAxis, false);
  assert.equal(setLinkPriceAxis(off, true).linkPriceAxis, true);

  // The field post-dates the split, so a board saved without it must keep the
  // helpful default rather than silently losing the link.
  assert.equal(sanitizeLayout({ panes: [] }).linkPriceAxis, true, 'absent reads as on');
  assert.equal(sanitizeLayout({ widgets: [] }).linkPriceAxis, true, 'a pre-split board too');
  assert.equal(
    sanitizeLayout({ panes: [], linkPriceAxis: false }).linkPriceAxis,
    false,
    'an explicit false is honored',
  );
  assert.equal(
    sanitizeLayout({ panes: [], linkPriceAxis: 'nope' }).linkPriceAxis,
    true,
    'a junk value falls back to on',
  );
});

test('the link setting round-trips through storage', () => {
  memory.clear();
  saveLayout(setLinkPriceAxis(add(emptyLayout(), 'gamma-chart', 'xl'), false), SCOPE);
  assert.equal(loadLayout(SCOPE)!.linkPriceAxis, false);
});

// ── Account copy ─────────────────────────────────────────────────────────────
// A signed-in member's board is kept on the account, because a browser that
// clears site data used to take the board with it. chooseWorkingBoard decides
// which copy opens; the unsynced flag is what stops a change that never
// reached the account from being overwritten by the account's older copy.

test('the account copy wins over an in-sync browser copy (a change made elsewhere)', () => {
  const account = add(emptyLayout(), 'gamma-chart', 'xl');
  const browser = add(emptyLayout(), 'key-levels', 'lg');
  assert.equal(chooseWorkingBoard({ account, browser, browserUnsynced: false }), account);
});

test('a browser that lost its board opens the account copy', () => {
  const account = add(emptyLayout(), 'gamma-chart', 'xl');
  assert.equal(chooseWorkingBoard({ account, browser: null, browserUnsynced: false }), account);
  // A stray flag with no board behind it cannot conjure one.
  assert.equal(chooseWorkingBoard({ account, browser: null, browserUnsynced: true }), account);
});

test('a board the account has never held opens as-is, so it gets copied up', () => {
  const browser = add(emptyLayout(), 'key-levels', 'lg');
  assert.equal(chooseWorkingBoard({ account: null, browser, browserUnsynced: false }), browser);
});

test('a change that never reached the account wins over the older account copy', () => {
  const account = add(emptyLayout(), 'gamma-chart', 'xl');
  const browser = add(account, 'key-levels', 'lg');
  assert.equal(chooseWorkingBoard({ account, browser, browserUnsynced: true }), browser);
});

test('no copy anywhere opens an empty board', () => {
  const chosen = chooseWorkingBoard({ account: null, browser: null, browserUnsynced: false });
  assert.ok(isLayoutEmpty(chosen));
});

test('the sync state is per member and leaves the stored board alone', () => {
  memory.clear();
  const board = add(emptyLayout(), 'gamma-chart', 'xl');
  saveLayout(board, 'user_a');

  // A board built before boards were kept on the account has no state at all.
  assert.equal(hasBoardSynced('user_a'), false, 'never synced');
  assert.equal(isBoardUnsynced('user_a'), false, 'and nothing pending');

  setBoardUnsynced('user_a', true);
  assert.equal(isBoardUnsynced('user_a'), true);
  assert.equal(hasBoardSynced('user_a'), true);
  assert.equal(isBoardUnsynced('user_b'), false, 'another member sharing the browser is unaffected');
  assert.equal(hasBoardSynced('user_b'), false);
  assert.deepEqual(loadLayout('user_a'), board, 'the state does not touch the board itself');

  setBoardUnsynced('user_a', false);
  assert.equal(isBoardUnsynced('user_a'), false);
  assert.equal(hasBoardSynced('user_a'), true, 'once synced, stays known to the account');
  assert.deepEqual(loadLayout('user_a'), board);
});

// ── Per-tile settings: symbol, free-resize box, zoom ─────────────────────────

test('footprints are quarter / half / three-quarters / full of the 12-column grid', () => {
  assert.equal(GRID_COLUMNS, 12);
  assert.equal(GRID_TRACKS, 48, 'quarter-column steps need four CSS tracks per column');
  assert.deepEqual(WIDGET_COLSPAN, { sm: 3, md: 6, lg: 9, xl: 12 });
});

test('a board saved before per-tile settings existed loads without any of them', () => {
  const layout = sanitizeLayout({ widgets: [{ widgetId: 'gamma-ladder', size: 'sm', instanceId: 'gamma-ladder#1' }] });
  assert.deepEqual(widgetsOf(layout), [{ instanceId: 'gamma-ladder#1', widgetId: 'gamma-ladder', size: 'sm' }]);
});

test('sanitizeLayout keeps valid per-tile settings and drops bad ones one by one', () => {
  const layout = sanitizeLayout({
    split: false,
    panes: [
      {
        id: 'a',
        widgets: [
          { widgetId: 'gamma-ladder', size: 'sm', symbol: 'QQQ', span: 2, height: 520, zoom: 'lg' },
          { widgetId: 'gamma-ladder', size: 'sm', symbol: 'DOGE', span: 'wide', height: -4, zoom: 'xl' },
          { widgetId: 'gamma-ladder', size: 'sm', span: 40, height: 99999 },
        ],
      },
    ],
  });
  const [good, bad, clamped] = widgetsOf(layout);
  assert.deepEqual(
    { symbol: good.symbol, span: good.span, height: good.height, zoom: good.zoom },
    { symbol: 'QQQ', span: 2, height: 520, zoom: 'lg' },
  );
  assert.deepEqual(bad, { instanceId: bad.instanceId, widgetId: 'gamma-ladder', size: 'sm', height: MIN_WIDGET_HEIGHT });
  assert.equal(clamped.span, 12, 'a span past the grid clamps to the full width');
  assert.equal(clamped.height, MAX_WIDGET_HEIGHT);
});

test('per-tile settings round-trip through storage', () => {
  let layout = add(emptyLayout(), 'gamma-ladder', 'sm');
  layout = setWidgetSymbol(layout, 'gamma-ladder#1', 'SPX');
  layout = setWidgetBox(layout, 'gamma-ladder#1', { span: 2, height: 480 });
  layout = setWidgetZoom(layout, 'gamma-ladder#1', 'sm');
  saveLayout(layout, SCOPE);
  assert.deepEqual(loadLayout(SCOPE), layout);
});

test('setWidgetSymbol pins one tile, leaves its twin alone, and un-pins with null', () => {
  const base = add(add(emptyLayout(), 'gamma-ladder', 'sm'), 'gamma-ladder', 'sm');
  const pinned = setWidgetSymbol(base, 'gamma-ladder#2', 'NDX');
  assert.equal(widgetsOf(pinned)[0].symbol, undefined, 'the other ladder still follows the page');
  assert.equal(widgetsOf(pinned)[1].symbol, 'NDX');
  assert.equal(setWidgetSymbol(pinned, 'gamma-ladder#2', 'NDX'), pinned, 'same symbol is a no-op');
  const followed = setWidgetSymbol(pinned, 'gamma-ladder#2', null);
  assert.equal('symbol' in widgetsOf(followed)[1], false, 'un-pinning removes the field');
  assert.equal(setWidgetSymbol(base, 'ghost#1', 'SPY'), base, 'absent instance is a no-op');
});

test('setWidgetBox sets, clamps and clears width and height independently', () => {
  const base = add(emptyLayout(), 'gamma-ladder', 'sm');
  const sized = setWidgetBox(base, 'gamma-ladder#1', { span: 2.4, height: 433.6 });
  assert.equal(widgetsOf(sized)[0].span, 2.5, 'widths go in quarter-column steps');
  assert.equal(widgetsOf(sized)[0].height, 434);
  const widthOnly = setWidgetBox(sized, 'gamma-ladder#1', { span: 5 });
  assert.equal(widgetsOf(widthOnly)[0].height, 434, 'an omitted field is left alone');
  const filled = setWidgetBox(widthOnly, 'gamma-ladder#1', { height: null });
  assert.equal('height' in widgetsOf(filled)[0], false, 'null goes back to filling the row');
  assert.equal(widgetsOf(filled)[0].span, 5);
  assert.equal(setWidgetBox(filled, 'gamma-ladder#1', { span: 5 }), filled, 'unchanged is a no-op');
  assert.equal(widgetsOf(setWidgetBox(base, 'gamma-ladder#1', { span: 0 }))[0].span, 0.25);
});

test('setWidgetZoom sets the text size and rejects anything else', () => {
  const base = add(emptyLayout(), 'gamma-ladder', 'sm');
  const zoomed = setWidgetZoom(base, 'gamma-ladder#1', 'lg');
  assert.equal(widgetsOf(zoomed)[0].zoom, 'lg');
  assert.equal(widgetsOf(zoomed)[0].size, 'sm', 'the footprint is untouched');
  assert.equal(setWidgetZoom(zoomed, 'gamma-ladder#1', 'xl' as never), zoomed);
  assert.equal(isWidgetZoom('md'), true);
  assert.equal(isWidgetZoom('xl'), false);
});

test('duplicating, cloning and moving a tile carry its per-tile settings', () => {
  let layout = add(emptyLayout(), 'gamma-ladder', 'sm');
  layout = setWidgetSymbol(layout, 'gamma-ladder#1', 'QQQ');
  layout = setWidgetBox(layout, 'gamma-ladder#1', { span: 2, height: 600 });
  layout = setWidgetZoom(layout, 'gamma-ladder#1', 'lg');
  layout = setWidgetPanelWidth(layout, 'gamma-ladder#1', 300);
  const settings = (w: { symbol?: string; span?: number; height?: number; zoom?: string; panelWidth?: number; size: string }) => ({
    size: w.size,
    symbol: w.symbol,
    span: w.span,
    height: w.height,
    zoom: w.zoom,
    panelWidth: w.panelWidth,
  });
  const expected = { size: 'sm', symbol: 'QQQ', span: 2, height: 600, zoom: 'lg', panelWidth: 300 };

  const duplicated = duplicateWidget(layout, 'gamma-ladder#1');
  assert.deepEqual(settings(widgetsOf(duplicated)[1]), expected);

  const cloned = clonePane(layout, 'a', 'b');
  assert.deepEqual(settings(widgetsOf(cloned, 'b')[0]), expected);

  const moved = moveWidgetToPane(setSplit(layout, true), 'gamma-ladder#1', 'b');
  assert.deepEqual(settings(widgetsOf(moved, 'b')[0]), expected);
});

test('clampSpan / clampHeight bound and round, and reject non-numbers', () => {
  assert.equal(clampSpan(7.6), 7.5);
  assert.equal(clampSpan(7.8), 7.75);
  assert.equal(clampSpan(7.9), 8);
  assert.equal(clampSpan(1.5), 1.5);
  assert.equal(clampSpan(-3), 0.25);
  assert.equal(clampSpan('4'), null);
  assert.equal(clampSpan(Number.NaN), null);
  assert.equal(clampHeight(20), MIN_WIDGET_HEIGHT);
  assert.equal(clampHeight(Infinity), null);
});

test('setWidgetPanelWidth sets, clamps, clears, and survives a reload', () => {
  const base = add(emptyLayout(), 'gamma-terminal', 'xl');
  const set = setWidgetPanelWidth(base, 'gamma-terminal#1', 299.6);
  assert.equal(widgetsOf(set)[0].panelWidth, 300);
  assert.equal(setWidgetPanelWidth(set, 'gamma-terminal#1', 300), set, 'unchanged is a no-op');
  const cleared = setWidgetPanelWidth(set, 'gamma-terminal#1', null);
  assert.equal('panelWidth' in widgetsOf(cleared)[0], false, 'null goes back to the default width');
  assert.equal(clampPanelWidth(1), 40);
  assert.equal(clampPanelWidth('300'), null);
  const restored = sanitizeLayout(JSON.parse(JSON.stringify(set)));
  assert.equal(widgetsOf(restored)[0].panelWidth, 300);
  const junk = sanitizeLayout({ widgets: [{ widgetId: 'gamma-terminal', size: 'xl', panelWidth: 'wide' }] });
  assert.equal('panelWidth' in widgetsOf(junk)[0], false, 'a bad width drops back to the default');
});

test('spans saved in whole or half columns keep their width; others round to the step', () => {
  const layout = sanitizeLayout({ widgets: [
    { widgetId: 'gamma-ladder', size: 'sm', span: 2 },
    { widgetId: 'gamma-ladder', size: 'sm', span: 1.5 },
    { widgetId: 'gamma-ladder', size: 'sm', span: 1.6 },
  ] });
  assert.deepEqual(widgetsOf(layout).map((w) => w.span), [2, 1.5, 1.5]);
});

// ── Grid track math ──────────────────────────────────────────────────────────
// The desktop grid has no column gap: tiles are spaced by 8px of cell padding
// a side (the gutter). A 1440px screen's board: ~1406px of grid over 48
// tracks; a split half at 1280px with the sidebar open: ~476px.
const FULL = { gap: 0, gutter: 16, trackWidth: 1406 / 48, columnsPerTrack: 12 / 48 };
const HALF = { gap: 0, gutter: 16, trackWidth: 476 / 48, columnsPerTrack: 12 / 48 / 2 };

test('toSpanStep rounds to quarter-columns', () => {
  assert.equal(toSpanStep(1.6), 1.5);
  assert.equal(toSpanStep(1.63), 1.75);
  assert.equal(toSpanStep(3), 3);
});

test('a footprint cell measures back to its footprint, unsplit and in a split half', () => {
  // S = 12 of the board's 48 tracks.
  assert.equal(renderedSpan(FULL, 12 * FULL.trackWidth), 3);
  // In a split half S draws at 24 of the pane's tracks: still a quarter of the board.
  assert.equal(renderedSpan(HALF, 24 * HALF.trackWidth), 3);
});

test('tracksForWidth is exact at a whole number of tracks, with or without a gap', () => {
  assert.ok(Math.abs(tracksForWidth(FULL, 5 * FULL.trackWidth) - 5) < 1e-9);
  const gapped = { gap: 16, gutter: 0, trackWidth: 300, columnsPerTrack: 6 };
  assert.ok(Math.abs(tracksForWidth(gapped, 2 * 300 + 16) - 2) < 1e-9, 'the tablet grid keeps a real gap');
});

test('spanFloor leaves the tile itself at least the px floor wide', () => {
  const tileWidth = (span: number, m: typeof FULL) => (span / m.columnsPerTrack) * m.trackWidth - m.gutter;
  // 130px + the 16px gutter over ~29.3px tracks = 5 tracks = 1.25 board columns.
  assert.equal(spanFloor(FULL, 130), 1.25);
  assert.ok(tileWidth(1.25, FULL) >= 130, `tile ${tileWidth(1.25, FULL)}px`);
  assert.ok(tileWidth(1, FULL) < 130, 'one step narrower would be under the floor');
  // In a split half a track is narrower, so the floor is more board columns,
  // rounded UP to a quarter-column.
  const halfFloor = spanFloor(HALF, 130);
  assert.equal(halfFloor % 0.25, 0);
  assert.ok(tileWidth(halfFloor, HALF) >= 130, `tile ${tileWidth(halfFloor, HALF)}px`);
  assert.equal(spanFloor({ gap: 0, gutter: 16, trackWidth: 0, columnsPerTrack: 0.25 }, 130), 0, 'unmeasured grid: no floor');
});
