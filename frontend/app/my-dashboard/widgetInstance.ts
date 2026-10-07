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
  /** The underlying this tile shows: its own pick, else the board's. */
  symbol: UnderlyingSymbol;
  /** The underlying this tile is pinned to, or null while it follows the board. */
  pinnedSymbol: UnderlyingSymbol | null;
  /**
   * Show `symbol` on this tile. The board's own symbol means "follow the
   * board" (the tile un-pins, and moves when the page's picker does); any
   * other symbol pins this tile alone. That is what lets the tile's picker
   * simply list the symbols, with the board's selected until another is
   * picked, and still have a way back to following the page.
   */
  selectSymbol: (symbol: UnderlyingSymbol) => void;
  /** How large a free-resize tile draws its contents (1 = standard). */
  zoomScale: number;
  /**
   * The width this tile's side panel was dragged to — the Gamma Terminal's
   * ladders / Strike Panel, the Gamma Chart's strike rail — or null for the
   * widget's default. The widget fits it to its own layout when it draws.
   */
  panelWidth: number | null;
  /** Save the side panel's width, or null to go back to the default. */
  setPanelWidth: (width: number | null) => void;
};

export const WidgetInstanceContext = createContext<WidgetInstanceValue | null>(null);

/** This tile's placement settings, or null outside a dashboard tile. */
export function useWidgetInstance(): WidgetInstanceValue | null {
  return useContext(WidgetInstanceContext);
}
