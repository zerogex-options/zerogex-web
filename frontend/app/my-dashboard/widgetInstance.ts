'use client';

/**
 * What a widget knows about its own placement on the board.
 *
 * WidgetFrame provides this around every widget body, so a widget that offers
 * per-tile settings reads and writes them here instead of having props
 * threaded through the registry's argument-less render(). Outside My Dashboard
 * there is no provider and the hook returns null, so a component shared with a
 * page can check for it and behave as it always has.
 */

import { createContext, useContext } from 'react';
import type { UnderlyingSymbol } from '@/core/symbolPersistence';

export type WidgetInstanceValue = {
  /** The underlying this tile is pinned to, or null while it follows the board. */
  pinnedSymbol: UnderlyingSymbol | null;
  /** What it follows while unpinned: its half's symbol, or the page's. */
  defaultSymbol: UnderlyingSymbol;
  /** Pin this tile to a symbol, or pass null to follow the board again. */
  setSymbol: (symbol: UnderlyingSymbol | null) => void;
  /** How large a free-resize tile draws its contents (1 = standard). */
  zoomScale: number;
};

export const WidgetInstanceContext = createContext<WidgetInstanceValue | null>(null);

/** This tile's placement settings, or null outside a dashboard tile. */
export function useWidgetInstance(): WidgetInstanceValue | null {
  return useContext(WidgetInstanceContext);
}
