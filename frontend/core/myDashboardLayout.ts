/**
 * "My Dashboard" layout persistence + pure reducers.
 *
 * The customizable dashboard (app/my-dashboard) lets a member assemble their
 * own view out of the site's widgets. This module owns the shape of that saved
 * layout and every pure transform on it (add / remove / resize / reorder /
 * sanitize), kept free of React and `window` side effects so the contract can
 * be exercised directly under the Node test runner — exactly like
 * core/chartSettings.ts and core/symbolPersistence.ts.
 *
 * Persistence style deliberately mirrors the app's other saved preferences:
 * plain localStorage under a `zgx_` key, wrapped so a private-mode / disabled-
 * storage browser degrades to in-memory instead of throwing, and SSR-safe so it
 * never touches `window` on the server.
 *
 * Robustness contract for {@link sanitizeLayout} / {@link loadLayout}:
 *   - A stored blob of any shape (old build, newer build, hand-edited, corrupt)
 *     can never crash the dashboard. The worst case is an empty layout.
 *   - Each widget entry is validated independently; a bad entry is dropped, not
 *     fatal. Unknown widget ids are dropped when a `validWidgetIds` set is
 *     supplied (so a widget removed in a later build silently disappears rather
 *     than rendering a hole).
 *   - Each widget appears at most once. The active underlying symbol is global,
 *     so a second copy of the same widget would be a duplicate with no value;
 *     de-duplication keeps the grid honest and makes add/remove idempotent.
 */

// Widget footprint on the responsive grid. Kept a small, closed set so a
// persisted size can be validated with a simple membership check.
export type WidgetSize = 'sm' | 'md' | 'lg' | 'xl';

export const WIDGET_SIZES: readonly WidgetSize[] = ['sm', 'md', 'lg', 'xl'] as const;

// Column span per size on the desktop 4-column grid. The grid CSS
// (globals.css → .zg-w-*) collapses these responsively on smaller screens.
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

// One placed widget. `widgetId` keys into the widget registry
// (app/my-dashboard/registry). `size` is the user's chosen footprint.
export type PlacedWidget = {
  widgetId: string;
  size: WidgetSize;
};

export type DashboardLayout = {
  version: number;
  widgets: PlacedWidget[];
};

export const MY_DASHBOARD_LAYOUT_VERSION = 1;
const KEY_PREFIX = 'zgx_my_dashboard';

export function isWidgetSize(value: unknown): value is WidgetSize {
  return typeof value === 'string' && (WIDGET_SIZES as readonly string[]).includes(value);
}

export function emptyLayout(): DashboardLayout {
  return { version: MY_DASHBOARD_LAYOUT_VERSION, widgets: [] };
}

// Storage is namespaced per member so two accounts sharing a browser don't
// clobber each other's boards. Anonymous / unknown scope falls back to a
// shared default bucket.
function storageKey(scope?: string | null): string {
  const safeScope = scope && scope.trim() ? scope.trim() : 'default';
  return `${KEY_PREFIX}:v${MY_DASHBOARD_LAYOUT_VERSION}:${safeScope}`;
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
 * Coerce an arbitrary parsed value into a valid {@link DashboardLayout}.
 * Never throws. When `validWidgetIds` is provided, widgets whose id is not in
 * the set are dropped. Duplicates (same widgetId) collapse to the first.
 */
export function sanitizeLayout(raw: unknown, validWidgetIds?: ReadonlySet<string>): DashboardLayout {
  const out = emptyLayout();
  if (!raw || typeof raw !== 'object') return out;

  const widgetsRaw = (raw as Record<string, unknown>).widgets;
  if (!Array.isArray(widgetsRaw)) return out;

  const seen = new Set<string>();
  for (const entry of widgetsRaw) {
    if (!entry || typeof entry !== 'object') continue;
    const widgetId = (entry as Record<string, unknown>).widgetId;
    if (typeof widgetId !== 'string' || !widgetId) continue;
    if (validWidgetIds && !validWidgetIds.has(widgetId)) continue;
    if (seen.has(widgetId)) continue;
    const sizeRaw = (entry as Record<string, unknown>).size;
    const size: WidgetSize = isWidgetSize(sizeRaw) ? sizeRaw : 'md';
    seen.add(widgetId);
    out.widgets.push({ widgetId, size });
  }
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

// ── Pure reducers ────────────────────────────────────────────────────────────
// Each returns a NEW layout object (immutable update) so React state transitions
// stay predictable and every transform is trivially unit-testable.

/** Append a widget. No-op if the widget is already present (idempotent). */
export function addWidget(
  layout: DashboardLayout,
  widgetId: string,
  size: WidgetSize,
): DashboardLayout {
  if (layout.widgets.some((w) => w.widgetId === widgetId)) return layout;
  return { ...layout, widgets: [...layout.widgets, { widgetId, size }] };
}

/** Remove a widget by id. No-op if absent. */
export function removeWidget(layout: DashboardLayout, widgetId: string): DashboardLayout {
  if (!layout.widgets.some((w) => w.widgetId === widgetId)) return layout;
  return { ...layout, widgets: layout.widgets.filter((w) => w.widgetId !== widgetId) };
}

/** Change a widget's size. No-op if the widget is absent. */
export function resizeWidget(
  layout: DashboardLayout,
  widgetId: string,
  size: WidgetSize,
): DashboardLayout {
  let changed = false;
  const widgets = layout.widgets.map((w) => {
    if (w.widgetId !== widgetId || w.size === size) return w;
    changed = true;
    return { ...w, size };
  });
  return changed ? { ...layout, widgets } : layout;
}

/** Toggle a widget: add it (with `size`) if absent, remove it if present. */
export function toggleWidget(
  layout: DashboardLayout,
  widgetId: string,
  size: WidgetSize,
): DashboardLayout {
  return layout.widgets.some((w) => w.widgetId === widgetId)
    ? removeWidget(layout, widgetId)
    : addWidget(layout, widgetId, size);
}

/**
 * Move the widget at `from` to index `to`, shifting the rest. Out-of-range
 * indices are clamped; a no-op move returns the same layout reference.
 */
export function moveWidget(layout: DashboardLayout, from: number, to: number): DashboardLayout {
  const n = layout.widgets.length;
  if (n === 0) return layout;
  const clamp = (i: number) => Math.max(0, Math.min(n - 1, Math.trunc(i)));
  const src = clamp(from);
  const dst = clamp(to);
  if (src === dst) return layout;
  const widgets = [...layout.widgets];
  const [moved] = widgets.splice(src, 1);
  widgets.splice(dst, 0, moved);
  return { ...layout, widgets };
}

export function hasWidget(layout: DashboardLayout, widgetId: string): boolean {
  return layout.widgets.some((w) => w.widgetId === widgetId);
}
