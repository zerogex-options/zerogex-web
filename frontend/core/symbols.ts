// Shared symbol constants + parser. Kept in a plain (non 'use client')
// module so both server components (which resolve ?symbol=X in searchParams)
// and the client-side SymbolPicker can import from the same source of truth
// without dragging server code across the RSC boundary.
//
// The symbol TYPE is now derived from the centralized instrument registry
// (core/instruments/registry.ts) — the single source of truth. SYMBOLS below
// is the equity/index picker DISPLAY ORDER (a UI concern), typed as
// EquitySymbol so any drift from the registry is a compile error. The
// href-based SymbolPicker used by the equity analytics pages (replay,
// forecast, scorecard) stays equity-only; ES/NQ are surfaced through the
// registry-driven Header, not this list.

import type { EquitySymbol } from './instruments/registry';

export type PickerSymbol = EquitySymbol;
export const SYMBOLS: readonly PickerSymbol[] = ['SPY', 'QQQ', 'SPX', 'NDX'];
export const DEFAULT_SYMBOL: PickerSymbol = 'SPY';

export function resolveSymbol(raw: string | undefined | null): PickerSymbol {
  const upper = (raw || '').toUpperCase();
  return (SYMBOLS as readonly string[]).includes(upper)
    ? (upper as PickerSymbol)
    : DEFAULT_SYMBOL;
}

/**
 * Build the per-symbol href map the SymbolPicker consumes.  Given a
 * function that maps a symbol to its target URL, produce an object keyed
 * by every valid symbol — saves each page an ~identical three-line
 * reduce.  Example:
 *
 *   const hrefs = buildSymbolHrefs((s) => `/forecast/${s}/${date}`);
 */
export function buildSymbolHrefs(
  hrefFor: (symbol: PickerSymbol) => string,
): Record<PickerSymbol, string> {
  return SYMBOLS.reduce(
    (acc, s) => {
      acc[s] = hrefFor(s);
      return acc;
    },
    {} as Record<PickerSymbol, string>,
  );
}
