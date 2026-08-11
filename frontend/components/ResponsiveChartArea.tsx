'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useExpandedCard } from './ExpandableCard';
import { useIsMobile } from '@/hooks/useIsMobile';

interface ResponsiveChartAreaProps {
  /** Render prop receiving the plot height in px. */
  children: (height: number) => ReactNode;
  mobileHeight?: number;
  desktopHeight?: number;
  /** Header + caption + padding to subtract from the viewport when expanded. */
  expandedChrome?: number;
  minExpandedHeight?: number;
}

// Supplies the plot height via a render prop, sized from the expanded state.
// It must read `useExpandedCard()` from INSIDE the card subtree (ExpandableCard
// renders its children twice — once inline, once in the modal — each with its
// own context value), so the modal copy fills most of the viewport while the
// inline copy keeps its compact height. Shared by the strike charts.
export default function ResponsiveChartArea({
  children,
  mobileHeight = 320,
  desktopHeight = 420,
  expandedChrome = 300,
  minExpandedHeight = 480,
}: ResponsiveChartAreaProps) {
  const expanded = useExpandedCard();
  const isMobile = useIsMobile();
  const [viewportH, setViewportH] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 0,
  );
  useEffect(() => {
    if (!expanded) return;
    const update = () => setViewportH(window.innerHeight);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [expanded]);
  // Expanded: fill most of the modal (it scrolls if the header crowds it).
  // Collapsed: the compact inline height.
  const height = expanded
    ? Math.max(minExpandedHeight, (viewportH || 900) - expandedChrome)
    : isMobile
      ? mobileHeight
      : desktopHeight;
  return <>{children(height)}</>;
}
