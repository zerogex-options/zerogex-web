/**
 * "My Dashboard" layout persistence + pure reducers.
 *
 * The customizable dashboard (app/my-dashboard) lets a member assemble their
 * own view out of the site's widgets. This module owns the shape of that saved
 * layout and every pure transform on it (add / remove / resize / reorder /
 * split / clone / sanitize), kept free of React and `window` side effects so the
 * contract can be exercised directly under the Node test runner — exactly like
 * core/chartSettings.ts and core/symbolPersistence.ts.
 *
 * Persistence style deliberately mirrors the app's other saved preferences:
 * plain localStorage under a `zgx_` key, wrapped so a private-mode / disabled-
 * storage browser degrades to in-memory instead of throwing, and SSR-safe so it
 * never touches `window` on the server.
 *
 * TWO PANES — the split board:
 *   A board is always TWO panes ('a' = left/top, 'b' = right/bottom). Only pane
 *   'a' renders until `split` is turned on, so an unsplit board looks and
 *   behaves exactly as it always has. Each pane carries its own `scope`: an
 *   optional underlying symbol and an optional expiration selection that
 *   override the page-wide ones for every widget inside that pane. That is the
 *   point of the whole feature — build one side, clone it across, then point
 *   the copy at a different expiry or a different underlying and read the two
 *   side by side. A `null` in either scope field means "follow the page", which
 *   is what a freshly cloned pane inherits, so a clone starts out identical to
 *   its source and only diverges once the member changes something.
 *
 * Robustness contract for {@link sanitizeLayout} / {@link loadLayout}:
 *   - A stored blob of any shape (old build, newer build, hand-edited, corrupt)
 *     can never crash the dashboard. The worst case is an empty layout.
 *   - Each widget entry is validated independently; a bad entry is dropped, not
 *     fatal. Unknown widget ids are dropped when a `validWidgetIds` set is
 *     supplied (so a widget removed in a later build silently disappears rather
 *     than rendering a hole).
 *   - A widget may be placed more than once, in either pane. Two copies of the
 *     same widget are the point of a side-by-side comparison, so each placement
 *     carries its own `instanceId` — unique across the WHOLE board, both panes —
 *     and every reducer addresses a *placement*, not a widget type. Instance ids
 *     are repaired (assigned / de-duplicated) on load.
 *   - A board saved by the older single-pane build (`{ widgets: [...] }`) loads
 *     unchanged into pane 'a' with the split off. The storage key is pinned to
 *     that build's version for exactly that reason — see STORAGE_KEY_VERSION.
 */

import type { UnderlyingSymbol } from './symbolPersistence';

// ── Local validators ─────────────────────────────────────────────────────────
// core/symbolPersistence and core/expirationPersistence own the canonical
// versions of these three checks. They are re-stated here (as a handful of
// lines, deliberately generic) rather than imported because this module is
// exercised directly by the Node test runner, which resolves extensionless
// relative imports only for types — keeping the module's runtime dependency
// surface empty is what makes `node --test` on it possible at all. Both sides
// are pinned by their own unit tests (tests/symbolPersistence.test.ts,
// tests/expirationPersistence.test.ts, tests/myDashboardLayout.test.ts).

const UNDERLYING_SYMBOLS: readonly string[] = ['SPY', 'SPX', 'QQQ', 'NDX'];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isUnderlyingSymbol(value: unknown): value is UnderlyingSymbol {
  return typeof value === 'string' && UNDERLYING_SYMBOLS.includes(value);
}

/** Dedupe + sort ascending, dropping anything that isn't a YYYY-MM-DD string.
 *  ISO dates sort lexicographically in chronological order. */
function normalizeExpirations(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value === 'string' && ISO_DATE_RE.test(value)) seen.add(value);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

/** Order-sensitive equality for two normalised selections. */
function sameExpirations(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// Widget footprint on the responsive grid. Kept a small, closed set so a
// persisted size can be validated with a simple membership check.
export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl';

export const WIDGET_SIZES: readonly WidgetSize[] = ['sm', 'md', 'lg', 'xl'] as const;

// Column span per size on the desktop 4-column grid. The grid CSS
// (globals.css → .zg-w-*) collapses these responsively on smaller screens, and
// halves them again inside a split pane (.zg-mydash-grid--half).
export const WIDGET_COLSPAN: Record<WidgetSize, number> = {
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
};

export const WIDGET_SIZE_LABEL: Record<WidgetSize, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Full width',
};

// ── Panes ────────────────────────────────────────────────────────────────────

/** 'a' is the left (or, stacked, top) half; 'b' is the right/bottom half. */
export type PaneId = 'a' | 'b';

export const PANE_IDS: readonly PaneId[] = ['a', 'b'] as const;

export function isPaneId(value: unknown): value is PaneId {
  return value === 'a' || value === 'b';
}

/** The pane that isn't this one — what "clone to the other side" targets. */
export function otherPaneId(id: PaneId): PaneId {
  return id === 'a' ? 'b' : 'a';
}

/**
 * A pane's data overrides. `null` means "follow the page" — the header's symbol
 * picker for `symbol`, the tab-wide shared selection for `expirations`. A
 * non-null value pins that pane, and only that pane, to it.
 *
 * `expirations: []` is a real, explicit choice ("All expirations"), which is why
 * the field is `string[] | null` and not just `string[]` — the same distinction
 * core/expirationPersistence draws between "chose All" and "hasn't chosen".
 */
export type PaneScope = {
  symbol: UnderlyingSymbol | null;
  expirations: string[] | null;
};

// One placed widget. `widgetId` keys into the widget registry
// (app/my-dashboard/registry). `size` is the user's chosen footprint.
// `instanceId` identifies this particular placement — the same widget can sit on
// the board several times and in either pane, so every mutation is addressed by
// instance.
export type PlacedWidget = {
  instanceId: string;
  widgetId: string;
  size: WidgetSize;
};

export type DashboardPane = {
  id: PaneId;
  scope: PaneScope;
  widgets: PlacedWidget[];
};

export type DashboardLayout = {
  version: number;
  /** Whether pane 'b' renders. Pane 'b' keeps its contents while off, so
   *  un-splitting and re-splitting is non-destructive. */
  split: boolean;
  /**
   * Whether the two halves' Gamma Charts share one price (y) axis. On by
   * default: the reason to put two charts side by side is to read one against
   * the other, and that only works if a level sits at the same height on both.
   * Has no effect unless the board is split and both halves hold a chart.
   */
  linkPriceAxis: boolean;
  /** Always exactly two panes, in PANE_IDS order. */
  panes: DashboardPane[];
};

export const MY_DASHBOARD_LAYOUT_VERSION = 2;

// The storage key stays pinned to the pre-split version on purpose: bumping it
// would leave every existing board sitting under an orphaned key and the member
// would open the page to a blank slate. sanitizeLayout() understands both the
// v1 (`{ widgets: [...] }`) and v2 (`{ panes: [...] }`) blobs, so the migration
// happens in place on the next save.
const STORAGE_KEY_VERSION = 1;
const KEY_PREFIX = 'zgx_my_dashboard';

export function isWidgetSize(value: unknown): value is WidgetSize {
  return typeof value === 'string' && (WIDGET_SIZES as readonly string[]).includes(value);
}

export function emptyScope(): PaneScope {
  return { symbol: null, expirations: null };
}

export function emptyPane(id: PaneId): DashboardPane {
  return { id, scope: emptyScope(), widgets: [] };
}

export function emptyLayout(): DashboardLayout {
  return {
    version: MY_DASHBOARD_LAYOUT_VERSION,
    split: false,
    linkPriceAxis: true,
    panes: PANE_IDS.map(emptyPane),
  };
}

// Storage is namespaced per member so two accounts sharing a browser don't
// clobber each other's boards. Anonymous / unknown scope falls back to a
// shared default bucket.
function storageKey(scope?: string | null): string {
  const safeScope = scope && scope.trim() ? scope.trim() : 'default';
  return `${KEY_PREFIX}:v${STORAGE_KEY_VERSION}:${safeScope}`;
}

// Access localStorage defensively: absent during SSR, and can throw on access
// in sandboxed iframes or when the user has blocked site data.
function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Mint an instance id for `widgetId` that is not already in `taken`.
 * Deterministic (`gamma-chart#1`, `gamma-chart#2`, …) rather than random, so the
 * reducers stay pure and directly unit-testable, and a saved board reads
 * legibly in devtools. `taken` spans both panes — instance ids are React keys
 * and reducer addresses for the whole board, so they can never collide across
 * the split.
 */
export function makeInstanceId(widgetId: string, taken: ReadonlySet<string>): string {
  for (let n = 1; ; n += 1) {
    const candidate = `${widgetId}#${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

// ── Sanitizing ───────────────────────────────────────────────────────────────

/** Coerce an arbitrary parsed value into a valid {@link PaneScope}. */
function sanitizeScope(raw: unknown): PaneScope {
  const out = emptyScope();
  if (!raw || typeof raw !== 'object') return out;
  const symbol = (raw as Record<string, unknown>).symbol;
  if (typeof symbol === 'string' && isUnderlyingSymbol(symbol)) out.symbol = symbol;
  const expirations = (raw as Record<string, unknown>).expirations;
  // An empty array is a real selection ("All"), so only a non-array reads as
  // "no override".
  if (Array.isArray(expirations)) out.expirations = normalizeExpirations(expirations);
  return out;
}

/** Validate one widget list into `into`, minting/repairing ids against `taken`. */
function sanitizeWidgets(
  raw: unknown,
  taken: Set<string>,
  validWidgetIds?: ReadonlySet<string>,
): PlacedWidget[] {
  const out: PlacedWidget[] = [];
  if (!Array.isArray(raw)) return out;
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const widgetId = (entry as Record<string, unknown>).widgetId;
    if (typeof widgetId !== 'string' || !widgetId) continue;
    if (validWidgetIds && !validWidgetIds.has(widgetId)) continue;
    const sizeRaw = (entry as Record<string, unknown>).size;
    const size: WidgetSize = isWidgetSize(sizeRaw) ? sizeRaw : 'md';
    const rawInstanceId = (entry as Record<string, unknown>).instanceId;
    const instanceId =
      typeof rawInstanceId === 'string' && rawInstanceId && !taken.has(rawInstanceId)
        ? rawInstanceId
        : makeInstanceId(widgetId, taken);
    taken.add(instanceId);
    out.push({ instanceId, widgetId, size });
  }
  return out;
}

/**
 * Coerce an arbitrary parsed value into a valid {@link DashboardLayout}.
 * Never throws. When `validWidgetIds` is provided, widgets whose id is not in
 * the set are dropped. Repeated widgets are kept — each placement is a distinct
 * instance — while missing or colliding `instanceId`s are repaired.
 *
 * Understands both persisted shapes:
 *   - v2: `{ split, panes: [{ id, scope, widgets }, …] }`
 *   - v1: `{ widgets: [...] }` — the pre-split build. Its widgets land in pane
 *     'a' with the split off, so an existing board opens exactly as it was.
 */
export function sanitizeLayout(raw: unknown, validWidgetIds?: ReadonlySet<string>): DashboardLayout {
  const out = emptyLayout();
  if (!raw || typeof raw !== 'object') return out;
  const blob = raw as Record<string, unknown>;

  const taken = new Set<string>();

  if (Array.isArray(blob.panes)) {
    // Index the stored panes by id so a blob with them reordered, duplicated or
    // partially missing still resolves deterministically.
    const byId = new Map<PaneId, Record<string, unknown>>();
    for (const entry of blob.panes) {
      if (!entry || typeof entry !== 'object') continue;
      const id = (entry as Record<string, unknown>).id;
      if (!isPaneId(id) || byId.has(id)) continue;
      byId.set(id, entry as Record<string, unknown>);
    }
    for (const pane of out.panes) {
      const stored = byId.get(pane.id);
      if (!stored) continue;
      pane.scope = sanitizeScope(stored.scope);
      pane.widgets = sanitizeWidgets(stored.widgets, taken, validWidgetIds);
    }
    out.split = blob.split === true;
    out.linkPriceAxis = blob.linkPriceAxis !== false;
    return out;
  }

  // v1 fallback: a flat widget list is the single (left) pane.
  out.panes[0].widgets = sanitizeWidgets(blob.widgets, taken, validWidgetIds);
  return out;
}

/**
 * Restore the persisted layout for `scope`, dropping any widgets not in
 * `validWidgetIds`. Returns null when there is nothing stored (so the caller
 * can decide whether to seed a starter layout) and an empty/partial layout
 * when the stored blob is corrupt.
 */
export function loadLayout(
  scope?: string | null,
  validWidgetIds?: ReadonlySet<string>,
): DashboardLayout | null {
  const storage = getStorage();
  if (!storage) return null;

  let rawText: string | null = null;
  try {
    rawText = storage.getItem(storageKey(scope));
  } catch {
    return null;
  }
  if (!rawText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return null;
  }
  return sanitizeLayout(parsed, validWidgetIds);
}

/**
 * Persist `layout` for `scope`. Returns true on success, false if storage was
 * unavailable (SSR, private mode, quota). Never throws.
 */
export function saveLayout(layout: DashboardLayout, scope?: string | null): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(storageKey(scope), JSON.stringify(layout));
    return true;
  } catch {
    return false;
  }
}

/** Remove the persisted layout for `scope` (used by "Reset to default"). */
export function clearLayout(scope?: string | null): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(storageKey(scope));
  } catch {
    /* storage unavailable — nothing to clean up */
  }
}

// ── Queries ──────────────────────────────────────────────────────────────────

/** The pane with this id. Always present — a layout holds both, always. */
export function getPane(layout: DashboardLayout, paneId: PaneId): DashboardPane {
  return layout.panes.find((p) => p.id === paneId) ?? emptyPane(paneId);
}

/** The panes that actually render: just 'a', or both when the board is split. */
export function visiblePanes(layout: DashboardLayout): DashboardPane[] {
  return layout.split ? layout.panes : layout.panes.slice(0, 1);
}

/** Every placement on the board, both panes, in pane order. */
export function allWidgets(layout: DashboardLayout): PlacedWidget[] {
  return layout.panes.flatMap((p) => p.widgets);
}

/** Which pane holds `instanceId`, or null when nothing does. */
export function paneOfInstance(layout: DashboardLayout, instanceId: string): PaneId | null {
  for (const pane of layout.panes) {
    if (pane.widgets.some((w) => w.instanceId === instanceId)) return pane.id;
  }
  return null;
}

/** Placements across the whole board (or just one pane when `paneId` is given). */
function widgetsIn(layout: DashboardLayout, paneId?: PaneId): PlacedWidget[] {
  return paneId ? getPane(layout, paneId).widgets : allWidgets(layout);
}

export function hasWidget(layout: DashboardLayout, widgetId: string, paneId?: PaneId): boolean {
  return widgetsIn(layout, paneId).some((w) => w.widgetId === widgetId);
}

/** How many copies of `widgetId` sit on the board (or in one pane). */
export function countWidget(layout: DashboardLayout, widgetId: string, paneId?: PaneId): number {
  return widgetsIn(layout, paneId).reduce((n, w) => (w.widgetId === widgetId ? n + 1 : n), 0);
}

/** Copies per widget id — what the add-widget gallery renders its state from. */
export function widgetCounts(layout: DashboardLayout, paneId?: PaneId): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of widgetsIn(layout, paneId)) {
    counts.set(w.widgetId, (counts.get(w.widgetId) ?? 0) + 1);
  }
  return counts;
}

/** Total placements across both panes. */
export function totalWidgetCount(layout: DashboardLayout): number {
  return layout.panes.reduce((n, p) => n + p.widgets.length, 0);
}

/** True when nothing at all is placed — what shows the starter/preset screen. */
export function isLayoutEmpty(layout: DashboardLayout): boolean {
  return totalWidgetCount(layout) === 0;
}

/** True when this pane overrides the page's symbol or expiration selection. */
export function isScoped(scope: PaneScope): boolean {
  return scope.symbol !== null || scope.expirations !== null;
}

/** Every instance id currently on the board, both panes. */
function takenIds(layout: DashboardLayout): Set<string> {
  return new Set(allWidgets(layout).map((w) => w.instanceId));
}

// ── Pure reducers ────────────────────────────────────────────────────────────
// Each returns a NEW layout object (immutable update) so React state transitions
// stay predictable and every transform is trivially unit-testable. Reducers that
// address a *placement* (remove / resize / duplicate) find it in whichever pane
// holds it; reducers that address a *position* (add / reorder) take a pane id.

/** Replace one pane, leaving the other untouched. */
function withPane(
  layout: DashboardLayout,
  paneId: PaneId,
  update: (pane: DashboardPane) => DashboardPane,
): DashboardLayout {
  let changed = false;
  const panes = layout.panes.map((pane) => {
    if (pane.id !== paneId) return pane;
    const next = update(pane);
    if (next === pane) return pane;
    changed = true;
    return next;
  });
  return changed ? { ...layout, panes } : layout;
}

/** Map every pane's widget list, keeping panes that don't change by reference. */
function withWidgets(
  layout: DashboardLayout,
  update: (widgets: PlacedWidget[], pane: DashboardPane) => PlacedWidget[] | null,
): DashboardLayout {
  let changed = false;
  const panes = layout.panes.map((pane) => {
    const next = update(pane.widgets, pane);
    if (next === null || next === pane.widgets) return pane;
    changed = true;
    return { ...pane, widgets: next };
  });
  return changed ? { ...layout, panes } : layout;
}

/**
 * Append a placement of `widgetId` at `size` to `paneId`. Always adds — a board
 * may hold several copies of the same widget (two Gamma Charts side by side,
 * say), each with its own instance id and its own footprint.
 */
export function addWidget(
  layout: DashboardLayout,
  paneId: PaneId,
  widgetId: string,
  size: WidgetSize,
): DashboardLayout {
  const instanceId = makeInstanceId(widgetId, takenIds(layout));
  return withPane(layout, paneId, (pane) => ({
    ...pane,
    widgets: [...pane.widgets, { instanceId, widgetId, size }],
  }));
}

/**
 * Insert a copy of the placement `instanceId` directly after it, in the pane
 * that holds it, so the copy lands next to its original — the layout half of a
 * side-by-side comparison. No-op if the instance is absent.
 */
export function duplicateWidget(layout: DashboardLayout, instanceId: string): DashboardLayout {
  const taken = takenIds(layout);
  return withWidgets(layout, (widgets) => {
    const index = widgets.findIndex((w) => w.instanceId === instanceId);
    if (index === -1) return null;
    const source = widgets[index];
    const copy: PlacedWidget = {
      instanceId: makeInstanceId(source.widgetId, taken),
      widgetId: source.widgetId,
      size: source.size,
    };
    const next = [...widgets];
    next.splice(index + 1, 0, copy);
    return next;
  });
}

/** Remove one placement by instance id, wherever it sits. No-op if absent. */
export function removeWidget(layout: DashboardLayout, instanceId: string): DashboardLayout {
  return withWidgets(layout, (widgets) => {
    if (!widgets.some((w) => w.instanceId === instanceId)) return null;
    return widgets.filter((w) => w.instanceId !== instanceId);
  });
}

/**
 * Remove every placement of `widgetId` — from one pane when `paneId` is given,
 * otherwise from the whole board. No-op if none are present.
 */
export function removeAllOfWidget(
  layout: DashboardLayout,
  widgetId: string,
  paneId?: PaneId,
): DashboardLayout {
  return withWidgets(layout, (widgets, pane) => {
    if (paneId && pane.id !== paneId) return null;
    if (!widgets.some((w) => w.widgetId === widgetId)) return null;
    return widgets.filter((w) => w.widgetId !== widgetId);
  });
}

/** Change one placement's size, wherever it sits. No-op if the instance is absent. */
export function resizeWidget(
  layout: DashboardLayout,
  instanceId: string,
  size: WidgetSize,
): DashboardLayout {
  return withWidgets(layout, (widgets) => {
    let changed = false;
    const next = widgets.map((w) => {
      if (w.instanceId !== instanceId || w.size === size) return w;
      changed = true;
      return { ...w, size };
    });
    return changed ? next : null;
  });
}

/**
 * Move the widget at `from` to index `to` within `paneId`, shifting the rest.
 * Out-of-range indices are clamped; a no-op move returns the same layout
 * reference.
 */
export function moveWidget(
  layout: DashboardLayout,
  paneId: PaneId,
  from: number,
  to: number,
): DashboardLayout {
  return withPane(layout, paneId, (pane) => {
    const n = pane.widgets.length;
    if (n === 0) return pane;
    const clamp = (i: number) => Math.max(0, Math.min(n - 1, Math.trunc(i)));
    const src = clamp(from);
    const dst = clamp(to);
    if (src === dst) return pane;
    const widgets = [...pane.widgets];
    const [moved] = widgets.splice(src, 1);
    widgets.splice(dst, 0, moved);
    return { ...pane, widgets };
  });
}

/**
 * Move one placement to the end of `paneId` — "send this tile to the other
 * side". Keeps its instance id and footprint. No-op if the instance is absent
 * or already in the target pane.
 */
export function moveWidgetToPane(
  layout: DashboardLayout,
  instanceId: string,
  paneId: PaneId,
): DashboardLayout {
  const from = paneOfInstance(layout, instanceId);
  if (from === null || from === paneId) return layout;
  const moved = getPane(layout, from).widgets.find((w) => w.instanceId === instanceId);
  if (!moved) return layout;
  const panes = layout.panes.map((pane) => {
    if (pane.id === from) {
      return { ...pane, widgets: pane.widgets.filter((w) => w.instanceId !== instanceId) };
    }
    if (pane.id === paneId) return { ...pane, widgets: [...pane.widgets, moved] };
    return pane;
  });
  return { ...layout, panes };
}

// ── Split / scope reducers ───────────────────────────────────────────────────

/**
 * Turn the second pane on or off. Turning it off keeps pane 'b's contents and
 * scope, so the member can flip back without rebuilding — nothing is destroyed
 * by collapsing the board.
 */
export function setSplit(layout: DashboardLayout, split: boolean): DashboardLayout {
  return layout.split === split ? layout : { ...layout, split };
}

/**
 * Copy pane `from` onto pane `to` — every widget (fresh instance ids, same
 * order and footprints) and the pane's scope — and turn the split on. This is
 * the "set one half up, then clone it across" action: the copy starts out
 * identical, and the member then points it at a different expiry or underlying.
 *
 * Whatever was in the target pane is replaced, which is why the UI confirms
 * first when the target isn't empty.
 */
export function clonePane(layout: DashboardLayout, from: PaneId, to: PaneId): DashboardLayout {
  if (from === to) return layout;
  const source = getPane(layout, from);
  // Ids are minted against the board minus the target pane's current contents,
  // since those are about to be replaced.
  const taken = new Set(
    layout.panes.filter((p) => p.id !== to).flatMap((p) => p.widgets.map((w) => w.instanceId)),
  );
  const widgets = source.widgets.map((w) => {
    const instanceId = makeInstanceId(w.widgetId, taken);
    taken.add(instanceId);
    return { instanceId, widgetId: w.widgetId, size: w.size };
  });
  const scope: PaneScope = {
    symbol: source.scope.symbol,
    expirations: source.scope.expirations === null ? null : [...source.scope.expirations],
  };
  const panes = layout.panes.map((pane) => (pane.id === to ? { ...pane, scope, widgets } : pane));
  return { ...layout, split: true, panes };
}

/**
 * Link or unlink the two halves' price axes. Stored on the board so the choice
 * survives a reload, like the split itself.
 */
export function setLinkPriceAxis(layout: DashboardLayout, link: boolean): DashboardLayout {
  return layout.linkPriceAxis === link ? layout : { ...layout, linkPriceAxis: link };
}

/** Drop every widget from one pane, leaving its scope alone. */
export function clearPane(layout: DashboardLayout, paneId: PaneId): DashboardLayout {
  return withPane(layout, paneId, (pane) =>
    pane.widgets.length === 0 ? pane : { ...pane, widgets: [] },
  );
}

/** Exchange the two panes' widgets and scopes. */
export function swapPanes(layout: DashboardLayout): DashboardLayout {
  const [a, b] = layout.panes;
  if (!a || !b) return layout;
  return {
    ...layout,
    panes: [
      { ...b, id: a.id },
      { ...a, id: b.id },
    ],
  };
}

/**
 * Pin this pane to `symbol`, or pass null to let it follow the page's symbol
 * picker again.
 */
export function setPaneSymbol(
  layout: DashboardLayout,
  paneId: PaneId,
  symbol: UnderlyingSymbol | null,
): DashboardLayout {
  return withPane(layout, paneId, (pane) =>
    pane.scope.symbol === symbol ? pane : { ...pane, scope: { ...pane.scope, symbol } },
  );
}

/**
 * Pin this pane to an expiration selection (`[]` = all expirations), or pass
 * null to let it follow the tab-wide shared selection again.
 */
export function setPaneExpirations(
  layout: DashboardLayout,
  paneId: PaneId,
  expirations: readonly string[] | null,
): DashboardLayout {
  const next = expirations === null ? null : normalizeExpirations(expirations);
  return withPane(layout, paneId, (pane) => {
    const current = pane.scope.expirations;
    if (current === null && next === null) return pane;
    if (current !== null && next !== null && sameExpirations(current, next)) return pane;
    return { ...pane, scope: { ...pane.scope, expirations: next } };
  });
}
