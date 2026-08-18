'use client';

/**
 * Marks a subtree as running inside a "My Dashboard" widget tile.
 *
 * The board reuses the site's real feature components — the strike profile, the
 * GEX-by-strike chart, the candle chart — and those carry their own page chrome,
 * including an expand / fullscreen control pinned to their top-right corner. On
 * a page that is the right affordance; inside a widget tile it isn't. The tile
 * already owns that corner (its edit controls sit there, and the expand button
 * covered the remove button), and a tile is resized by its own S/M/L/XL footprint rather
 * than blown up to fill the viewport.
 *
 * So WidgetFrame provides this context around every widget body, and each
 * component that offers an expand affordance checks it and renders without one.
 * A context rather than a prop because these components are nested several
 * levels deep behind wrappers that take no props of their own, and because it
 * makes the rule automatic for any widget added later.
 */

import { createContext, useContext } from 'react';

export const DashboardWidgetContext = createContext(false);

/** True when the calling component is rendering inside a dashboard widget tile. */
export function useInDashboardWidget(): boolean {
  return useContext(DashboardWidgetContext);
}
