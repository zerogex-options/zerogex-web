// Pure (non-React) helpers for resolving and persisting the user's active
// expiration-filter selection — the set of option expirations the GEX/gamma
// charts aggregate over. Deliberately kept out of the React store
// (hooks/useSharedExpirations.ts) so the resolve + persist contract can be
// exercised directly under the Node test runner with a stubbed
// window.localStorage, exactly like core/symbolPersistence.ts and
// core/chartSettings.ts.
//
// Why a shared, persisted selection: several charts across the site
// (GEX Profile, OI by Strike, the Gamma Terminal rail, the strike
// table, the Flow-Analysis contract filter) each let the user pick one or more
// expirations to filter by. Historically every one kept its own in-memory
// selection that reset on reload and never agreed with its neighbours. This
// layer gives them ONE selection that survives reloads/navigation and stays in
// sync across every chart in the tab.
//
// TWO STORAGE LAYERS — "shared within a tab, independent across tabs":
//
//   • sessionStorage (EXPIRATIONS_SESSION_KEY) holds THIS TAB's live selection.
//     sessionStorage is per-tab by construction: a freshly opened tab starts
//     empty, a duplicated tab inherits a one-time copy and then diverges, and
//     the value survives a reload of the same tab (including the reloads
//     iOS/WebKit forces under memory pressure).
//   • localStorage (EXPIRATIONS_STORAGE_KEY) holds the LAST-SELECTED DEFAULT,
//     rewritten on every pick. It only ever seeds a tab that has no selection
//     of its own, so a new tab opens on the expirations you last chose.
//
// That split is deliberate and is the whole point of this layer: a user
// comparing expirations side by side (two windows, or a split screen) sets one
// in each tab and both stay put. Writing the live value to localStorage — or
// mirroring it back in via the `storage` event, as this module used to — makes
// every open tab snap to whichever one was touched last, which is exactly the
// behaviour that made side-by-side comparison impossible.
//
// A tab's own "All" is a real choice, not an absent one: readTabExpirations()
// returns null ONLY when the tab has never picked, so an explicit All ([]) is
// never re-seeded from the (possibly non-empty) stored default.
//
// The canonical model is an array of ISO date strings (YYYY-MM-DD), plus one
// rolling token:
//   []                    → "All expirations" (aggregate the whole chain), the
//                           default every chart already treats an empty set as.
//   ['2025-06-20', …]     → restrict to exactly those expirations.
//   ['0DTE']              → whatever expires TODAY, re-resolved every render.
// The array is always normalised (deduped, token first, dates ascending) so the
// stored blob and the cache-key params the charts derive from it are stable.
//
// Expirations are dates, so a saved pick naturally goes stale: a date chosen
// today may no longer trade tomorrow. Persistence stays lossless (we keep the
// user's literal pick), and each chart calls reconcileExpirations() against its
// own live option list at render time — so a stale date simply drops out of the
// view and a fully-expired selection collapses to the safe "All" default.
//
// That staleness is precisely why ROLLING_ZERO_DTE exists: for a same-day
// trader, "All" is not a safe fallback, it is a different book. See the token's
// own comment below.

// localStorage: the last-selected default, used to seed a tab that hasn't
// picked yet. Unchanged key — an existing saved pick keeps working.
export const EXPIRATIONS_STORAGE_KEY = 'zgx_expirations';

// sessionStorage: this tab's live selection. Distinct key so the two layers
// can't be confused when inspecting storage by hand.
export const EXPIRATIONS_SESSION_KEY = 'zgx_expirations_tab';

// A shared, frozen empty selection so callers (and useSyncExternalStore's
// server snapshot) can hand back a stable reference for the "All" case.
export const ALL_EXPIRATIONS: readonly string[] = Object.freeze([]);

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// The one non-date member of the selection model: "whatever expires TODAY",
// re-resolved on every render instead of frozen to the date it was picked on.
//
// A literal date is the wrong way to say "0DTE". Storing 2025-06-20 because
// that was today when the trader clicked it means the pick is silently wrong
// tomorrow: reconcileExpirations drops the expired date, the selection empties,
// and an empty selection reads as ALL expirations. So a 0DTE board quietly
// becomes a whole-chain board overnight — the worst failure mode available,
// because the numbers stay plausible and nothing announces the change.
//
// This token is the user's literal intent, kept literal. It survives
// normalisation and storage untouched; reconcileExpirations() is the single
// point where it becomes a concrete date, against the chart's own option list
// and the caller's ET date key. When today is NOT an expiry (a weekend, a
// holiday, or an underlying with no same-day contract) it resolves to nothing
// rather than to the nearest expiry — "no 0DTE today" is the honest answer, and
// silently substituting Friday's book would repeat the very bug above.
export const ROLLING_ZERO_DTE = '0DTE';

export function isExpirationDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_RE.test(value);
}

/** True for the rolling same-day token (as opposed to a literal date). */
export function isRollingZeroDte(value: unknown): boolean {
  return value === ROLLING_ZERO_DTE;
}

/** True when a selection is the rolling same-day pick. */
export function selectionIsRollingZeroDte(selection: readonly string[]): boolean {
  return selection.length === 1 && isRollingZeroDte(selection[0]);
}

// Dedupe + sort ascending, dropping anything that isn't a YYYY-MM-DD string or
// the rolling 0DTE token. ISO dates sort lexicographically in chronological
// order, so localeCompare is exactly the ascending-by-date the charts want. The
// 0DTE token sorts FIRST: it stands for today, and nothing in a current/future
// option list can expire sooner. The result is a fresh array safe to store as
// component state.
export function normalizeExpirations(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  let rolling = false;
  for (const value of values) {
    if (isRollingZeroDte(value)) rolling = true;
    else if (isExpirationDate(value)) seen.add(value);
  }
  const dates = Array.from(seen).sort((a, b) => a.localeCompare(b));
  return rolling ? [ROLLING_ZERO_DTE, ...dates] : dates;
}

// Project a (normalised) selection onto the expirations a given chart actually
// has options for, preserving order, and resolve the rolling 0DTE token to a
// real date on the way through. Keeps a stale/foreign date from lingering in a
// chart's view; when nothing survives, the empty result reads as "All", which
// is the correct, safe fallback for a selection that has fully expired.
//
// `todayKey` is the ET date key (YYYY-MM-DD) — the same one chartExpirationOptions
// takes. It is REQUIRED rather than optional on purpose: an optional parameter
// would let a new call site forget it and silently drop the 0DTE token back to
// "All", which is exactly the bug this token exists to kill. Making the compiler
// ask the question routes every consumer through one door.
export function reconcileExpirations(
  selection: readonly string[],
  available: readonly string[],
  todayKey: string,
): string[] {
  if (selection.length === 0) return [];
  const availableSet = new Set(available);
  const out: string[] = [];
  const emitted = new Set<string>();
  for (const exp of selection) {
    // The token resolves to today's expiry only if one is actually listed;
    // otherwise it contributes nothing (see ROLLING_ZERO_DTE).
    const resolved = isRollingZeroDte(exp) ? todayKey : exp;
    if (!availableSet.has(resolved) || emitted.has(resolved)) continue;
    emitted.add(resolved);
    out.push(resolved);
  }
  return out;
}

// Access a Storage area defensively: both are absent during SSR, absent in a
// test stub that only provides one of them, and can throw on mere property
// access in sandboxed iframes or when the user has blocked site data.
function getStorage(area: 'localStorage' | 'sessionStorage'): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window[area] ?? null;
  } catch {
    return null;
  }
}

// Parse one stored blob into a normalised selection, or null when there is
// nothing usable there. A hand-edited / older-build blob of the wrong shape
// must degrade rather than crash a chart, so anything unparseable reads as
// absent — the caller decides whether absent means "All" or "fall through to
// the next layer".
function readSelection(storage: Storage | null, key: string): string[] | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? normalizeExpirations(parsed) : null;
  } catch {
    return null;
  }
}

// Read the persisted DEFAULT (localStorage) — the selection a tab with no pick
// of its own starts from. Returns [] ("All") when absent or unusable.
export function readStoredExpirations(): string[] {
  return readSelection(getStorage('localStorage'), EXPIRATIONS_STORAGE_KEY) ?? [];
}

// Read THIS TAB's selection (sessionStorage), or null when the tab has never
// picked one. The null is load-bearing: it's what separates "this tab chose
// All" (→ []) from "this tab hasn't chosen" (→ seed from the default), so an
// explicit All is never overwritten by a stored non-empty default.
export function readTabExpirations(): string[] | null {
  return readSelection(getStorage('sessionStorage'), EXPIRATIONS_SESSION_KEY);
}

// Resolution order used to seed the store on a fresh mount / full reload:
// this tab's own selection wins, then the last-selected default, then All.
// Mirrors resolveInitialSymbol() in core/symbolPersistence.ts.
export function resolveInitialExpirations(): string[] {
  return readTabExpirations() ?? readStoredExpirations();
}

// Best-effort write-through to BOTH layers: sessionStorage so this tab holds
// the pick across reloads, localStorage so the next tab opens on it. Normalises
// first (so storage and every reader see the canonical shape) and returns the
// normalised value so the caller can seed in-memory state from the same thing
// that was persisted. A failure in either area is swallowed — persistence must
// never break expiration switching — and the normalised value is still returned
// so the in-memory store stays correct.
export function persistExpirations(values: readonly string[]): string[] {
  const clean = normalizeExpirations(values);
  const blob = JSON.stringify(clean);
  const session = getStorage('sessionStorage');
  if (session) {
    try {
      session.setItem(EXPIRATIONS_SESSION_KEY, blob);
    } catch {
      /* storage unavailable — see comment above */
    }
  }
  const local = getStorage('localStorage');
  if (local) {
    try {
      local.setItem(EXPIRATIONS_STORAGE_KEY, blob);
    } catch {
      /* storage unavailable — see comment above */
    }
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
