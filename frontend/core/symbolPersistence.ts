// Pure (non-React) helpers for resolving and persisting the active underlying
// symbol. Deliberately kept out of TimeframeContext.tsx — which imports React
// and next/navigation — so the resolution + persistence contract can be
// exercised directly under the Node test runner (see tests/symbolPersistence.test.ts)
// with a stubbed window.localStorage, exactly like core/chartSettings.ts.
//
// Why this layer matters: the active symbol has to survive a full page reload,
// because iOS/WebKit (Safari, and every iOS browser incl. Edge/Chrome, which
// are all WebKit under the hood) aggressively discards and reloads pages under
// memory pressure and when returning to a backgrounded tab. On such a reload
// the in-memory React context is gone and the symbol is re-derived here from
// the URL or localStorage. That only works if the user's pick was actually
// written to storage — so persistSymbol() must be callable synchronously the
// moment the symbol changes, not deferred to a passive effect that may still be
// pending when the page is torn down.

export type UnderlyingSymbol = 'SPY' | 'SPX' | 'QQQ' | 'NDX';

export const SYMBOL_STORAGE_KEY = 'zgx_symbol';
export const DEFAULT_UNDERLYING_SYMBOL: UnderlyingSymbol = 'SPY';

export function isUnderlyingSymbol(
  value: string | null | undefined,
): value is UnderlyingSymbol {
  return value === 'SPY' || value === 'SPX' || value === 'QQQ' || value === 'NDX';
}

// Best-effort write. localStorage can throw (Safari private mode, storage
// disabled, quota) — persistence must never break symbol switching, so a
// failure is swallowed and the in-memory context simply carries the value for
// the life of the page.
export function persistSymbol(symbol: UnderlyingSymbol): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SYMBOL_STORAGE_KEY, symbol);
  } catch {
    /* storage unavailable — see comment above */
  }
}

export function readStoredSymbol(): UnderlyingSymbol | null {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(SYMBOL_STORAGE_KEY);
    return isUnderlyingSymbol(saved) ? saved : null;
  } catch {
    return null;
  }
}

// Reading `?symbol=` is what lets deep-links (e.g. the magnet page's per-symbol
// "Live dashboard" links) force the active symbol — without it, clicking
// SPX/SPY/QQQ would all land on whatever the user had previously selected.
export function symbolFromSearch(search: string): UnderlyingSymbol | null {
  try {
    const fromUrl = new URLSearchParams(search).get('symbol');
    return isUnderlyingSymbol(fromUrl) ? fromUrl : null;
  } catch {
    return null;
  }
}

export function symbolFromUrl(): UnderlyingSymbol | null {
  if (typeof window === 'undefined') return null;
  return symbolFromSearch(window.location.search);
}

// Resolution order used to seed the context on a fresh mount / full reload:
// an explicit ?symbol= deep-link wins, then the last persisted selection, then
// the default. This is what makes an iOS-reloaded page come back on the symbol
// the user actually chose instead of snapping back to the default/previous one.
export function resolveInitialSymbol(): UnderlyingSymbol {
  if (typeof window === 'undefined') return DEFAULT_UNDERLYING_SYMBOL;
  return symbolFromUrl() ?? readStoredSymbol() ?? DEFAULT_UNDERLYING_SYMBOL;
}
