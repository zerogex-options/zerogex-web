'use client';

import type { ReactNode } from 'react';
import { TimeframeSymbolScope } from '@/core/TimeframeContext';
import { useWidgetInstance } from './widgetInstance';

/**
 * Hands every symbol switcher inside it to this tile: a chart's own symbol
 * dropdown (or a ladder's) then picks THIS tile's underlying, rather than
 * moving the page and every other tile with it. Outside a dashboard tile it
 * renders its children untouched.
 */
export default function TileSymbolScope({ children }: { children: ReactNode }) {
  const instance = useWidgetInstance();
  if (!instance) return children;
  return (
    <TimeframeSymbolScope symbol={instance.symbol} onSymbolChange={instance.selectSymbol}>
      {children}
    </TimeframeSymbolScope>
  );
}
