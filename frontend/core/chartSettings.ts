/**
 * Persistent per-chart display settings.
 *
 * Interactive charts across the site expose display preferences — grid on/off,
 * gamma split vs net, default timeframe, overlay toggles, and so on. This
 * module gives every chart one small, uniform way to remember those choices in
 * the browser (localStorage), keyed by a stable chart id, so a user's preferred
 * setup auto-loads the next time they open the same chart on any page.
 *
 * It deliberately mirrors the persistence style already used by the app's other
 * saved preferences (symbol → `zgx_symbol`, GEX unit → `zgx_gex_unit`, theme):
 * plain localStorage, wrapped so a private-mode / disabled-storage browser
 * degrades to in-memory instead of throwing, and SSR-safe so it never touches
 * `window` on the server.
 *
 * Robustness contract for `loadChartSettings`:
 *   - Only keys present in the caller's `defaults` are ever restored; unknown
 *     keys in a stored blob are ignored.
 *   - A stored value is applied only when its runtime type matches the
 *     default's (typeof check), so a corrupt or hand-edited entry can never
 *     inject an unexpected shape into chart state — the worst case is a single
 *     field silently falling back to its default.
 * Together these mean a stored blob written by an older or newer build (extra
 * keys, missing keys, changed types) can never crash a chart; it just merges
 * whatever still fits over the current defaults.
 *
 * Intended for flat objects of primitives (string / number / boolean), which is
 * what chart display preferences are.
 */

// Namespaced so per-chart blobs sit alongside the app's other `zgx_` prefs
// without colliding (zgx_symbol, zgx_gex_unit, …). The chart id is the suffix.
const KEY_PREFIX = 'zgx_chart_settings:';

function storageKey(chartId: string): string {
  return `${KEY_PREFIX}${chartId}`;
}

// Access localStorage defensively: it is absent during SSR and can throw on
// access in sandboxed iframes or when the user has blocked site data.
function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Restore persisted settings for `chartId`, layered over `defaults`. Always
 * returns a fresh object safe to spread into component state; on any problem
 * (SSR, no entry, blocked storage, corrupt JSON, wrong shape) it falls back to
 * a copy of `defaults`.
 */
export function loadChartSettings<T extends object>(chartId: string, defaults: T): T {
  const merged = { ...defaults };
  const storage = getStorage();
  if (!storage) return merged;

  let raw: string | null = null;
  try {
    raw = storage.getItem(storageKey(chartId));
  } catch {
    return merged;
  }
  if (!raw) return merged;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return merged;
  }
  if (parsed === null || typeof parsed !== 'object') return merged;

  const source = parsed as Record<string, unknown>;
  const target = merged as Record<string, unknown>;
  for (const key of Object.keys(defaults)) {
    const candidate = source[key];
    // Restore only when the persisted value's runtime type matches the
    // default's — guards against corrupt/tampered blobs of the wrong shape.
    if (candidate !== undefined && typeof candidate === typeof target[key]) {
      target[key] = candidate;
    }
  }
  return merged;
}

/**
 * Persist `settings` as the auto-load state for `chartId`. Called on every
 * change so a chart reopens exactly as the user left it. Returns true on
 * success, or false if storage was unavailable (SSR, private mode, quota).
 */
export function saveChartSettings<T extends object>(chartId: string, settings: T): boolean {
  const storage = getStorage();
  if (!storage) return false;
  try {
    storage.setItem(storageKey(chartId), JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
