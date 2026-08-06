// Pure (non-React) helpers for resolving and persisting the user's active
// expiration-filter selection — the set of option expirations the GEX/gamma
// charts aggregate over. Deliberately kept out of the React store
// (hooks/useSharedExpirations.ts) so the resolve + persist contract can be
// exercised directly under the Node test runner with a stubbed
// window.localStorage, exactly like core/symbolPersistence.ts and
// core/chartSettings.ts.
//
// Why a shared, persisted selection: several charts across the site
// (GEX Profile, OI & Exposure by Strike, the Gamma Terminal rail, the strike
// table, the Flow-Analysis contract filter) each let the user pick one or more
// expirations to filter by. Historically every one kept its own in-memory
// selection that reset on reload and never agreed with its neighbours. This
// layer gives them ONE selection that survives reloads/navigation and stays in
// sync across every chart in the tab.
//
// The canonical model is an array of ISO date strings (YYYY-MM-DD):
//   []                    → "All expirations" (aggregate the whole chain), the
//                           default every chart already treats an empty set as.
//   ['2025-06-20', …]     → restrict to exactly those expirations.
// The array is always normalised (deduped, ascending) so the stored blob and
// the cache-key params the charts derive from it are stable.
//
// Expirations are dates, so a saved pick naturally goes stale: a date chosen
// today may no longer trade tomorrow. Persistence stays lossless (we keep the
// user's literal pick), and each chart calls reconcileExpirations() against its
// own live option list at render time — so a stale date simply drops out of the
// view and a fully-expired selection collapses to the safe "All" default.

export const EXPIRATIONS_STORAGE_KEY = 'zgx_expirations';

// A shared, frozen empty selection so callers (and useSyncExternalStore's
// server snapshot) can hand back a stable reference for the "All" case.
export const ALL_EXPIRATIONS: readonly string[] = Object.freeze([]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isExpirationDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

// Dedupe + sort ascending, dropping anything that isn't a YYYY-MM-DD string.
// ISO dates sort lexicographically in chronological order, so localeCompare is
// exactly the ascending-by-date the charts want. The result is a fresh array
// safe to store as component state.
export function normalizeExpirations(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (isExpirationDate(value)) seen.add(value);
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b));
}

// Project a (normalised) selection onto the expirations a given chart actually
// has options for, preserving order. Keeps a stale/foreign date from lingering
// in a chart's view; when nothing survives, the empty result reads as "All",
// which is the correct, safe fallback for a selection that has fully expired.
export function reconcileExpirations(
  selection: readonly string[],
  available: readonly string[],
): string[] {
  if (selection.length === 0) return [];
  const availableSet = new Set(available);
  return selection.filter((exp) => availableSet.has(exp));
}

// Read the persisted selection. Best-effort: localStorage is absent during SSR
// and can throw (Safari private mode, storage disabled, blocked site data), and
// a hand-edited / older-build blob of the wrong shape must degrade to "All"
// rather than crash a chart — so any problem returns [] (All).
export function readStoredExpirations(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(EXPIRATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeExpirations(parsed) : [];
  } catch {
    return [];
  }
}

// Best-effort write-through. Normalises first (so storage and every reader see
// the canonical shape) and returns the normalised value so the caller can seed
// in-memory state from the same thing that was persisted. A storage failure is
// swallowed — persistence must never break expiration switching — and the
// normalised value is still returned so the in-memory store stays correct.
export function persistExpirations(values: readonly string[]): string[] {
  const clean = normalizeExpirations(values);
  if (typeof window === 'undefined') return clean;
  try {
    window.localStorage.setItem(EXPIRATIONS_STORAGE_KEY, JSON.stringify(clean));
  } catch {
    /* storage unavailable — see comment above */
  }
  return clean;
}

// Order-sensitive equality for two normalised selections. Used to no-op
// redundant store updates (and so break any set→broadcast→re-seed feedback
// loop between the shared store and a chart's local mirror).
export function sameExpirations(a: readonly string[], b: readonly string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
