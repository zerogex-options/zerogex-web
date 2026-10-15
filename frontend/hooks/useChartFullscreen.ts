'use client';

/**
 * Full screen for one chart: the instrument leaves its card and takes the
 * whole window, sized to it, while the rest of the page waits underneath.
 *
 * Two layers, because one is not enough everywhere:
 *
 *  - The chart's own element goes `position: fixed` over the page (the caller
 *    applies `FULLSCREEN_LAYER_STYLE`). That works in every browser, iPhone
 *    Safari included, and it keeps the chart mounted where it is, so its zoom,
 *    pan, layers and crosshair carry over in both directions.
 *  - Where the browser allows it, the DOCUMENT goes into the browser's own full
 *    screen as well, so its tabs and toolbars give the chart their room too.
 *    The document rather than the chart element: tooltips and pop-overs are
 *    portalled to <body>, and in element full screen everything outside the
 *    element stops rendering, so every tooltip on the chart would vanish.
 *
 * Escape, the caller's exit control, or leaving the browser's full screen
 * (its own Esc or F11) all bring the chart back. A browser full screen the
 * reader was already in is left alone when the chart exits.
 */

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { lockPageScroll } from '@/core/scrollLock';

/**
 * The style that lifts a chart's root element over the page. Above the site
 * header (z-40, z-61 with the phone menu open) and level with the expanded
 * cards (z-100); tooltips (z-9999) still draw over it.
 */
export const FULLSCREEN_LAYER_STYLE: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
  borderRadius: 0,
  borderWidth: 0,
  margin: 0,
};

export interface ChartFullscreen {
  active: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}

export function useChartFullscreen(): ChartFullscreen {
  const [active, setActive] = useState(false);
  // Read inside async callbacks, where the rendered `active` would be stale.
  const activeRef = useRef(false);
  // True while the browser's full screen is on because THIS chart asked for it.
  const ownsBrowserFullscreen = useRef(false);

  const leaveBrowserFullscreen = useCallback(() => {
    if (!ownsBrowserFullscreen.current) return;
    ownsBrowserFullscreen.current = false;
    if (typeof document !== 'undefined' && document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const exit = useCallback(() => {
    activeRef.current = false;
    leaveBrowserFullscreen();
    setActive(false);
  }, [leaveBrowserFullscreen]);

  const enter = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    setActive(true);
    // Has to run inside the click that asked for it: browsers only grant full
    // screen to a user gesture. Refused or unsupported (iPhone), the fixed
    // layer alone still fills the window.
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    if (!root || document.fullscreenElement || typeof root.requestFullscreen !== 'function') return;
    root
      .requestFullscreen({ navigationUI: 'hide' })
      .then(() => {
        ownsBrowserFullscreen.current = true;
        // The reader closed the chart before the browser finished entering.
        if (!activeRef.current) leaveBrowserFullscreen();
      })
      .catch(() => {});
  }, [leaveBrowserFullscreen]);

  const toggle = useCallback(() => {
    if (activeRef.current) exit();
    else enter();
  }, [enter, exit]);

  useEffect(() => {
    if (!active) return;
    // The page underneath must not scroll: a wheel over the chart is its zoom.
    const release = lockPageScroll();
    const onKey = (e: KeyboardEvent) => {
      // A menu inside the chart that closed itself on this Escape keeps it.
      if (e.key === 'Escape' && !e.defaultPrevented) exit();
    };
    const onFullscreenChange = () => {
      // Left the browser's full screen by its own controls: the chart follows.
      if (!document.fullscreenElement && ownsBrowserFullscreen.current) {
        ownsBrowserFullscreen.current = false;
        activeRef.current = false;
        setActive(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      release();
    };
  }, [active, exit]);

  // Navigating away mid full screen hands the browser back as it was.
  useEffect(() => () => leaveBrowserFullscreen(), [leaveBrowserFullscreen]);

  return { active, enter, exit, toggle };
}
