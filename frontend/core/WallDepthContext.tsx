'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { WALL_DEPTH_DEFAULT, WallDepth, normalizeWallDepth } from './wallLadder';

/**
 * How many Call/Put Walls per side the gamma surfaces draw — 1 (the primary
 * wall alone, as it has always been), 2 (adds C2/P2) or 3 (adds C3/P3).
 *
 * A single global preference rather than per-chart state, for the same reason
 * the GEX unit is global: the Gamma Chart, the Strike Profile and the Gamma
 * Ladder all draw the same levels for the same symbol, and a board that shows
 * three of them side by side must not disagree with itself about which walls
 * exist. Turning C2 on in one place turns it on everywhere, and the setting
 * survives a reload.
 *
 * It defaults to 1, so this feature is genuinely optional: an existing user's
 * charts look exactly as they did until they ask for more.
 */

const STORAGE_KEY = 'zgx_wall_depth';

export const WALL_DEPTH_LABEL: Record<WallDepth, string> = {
  1: 'Walls: C1 · P1',
  2: 'Walls: +C2 · P2',
  3: 'Walls: +C3 · P3',
};

/** Short form for a tight toolbar (the dashboard tiles' overlay rows). */
export const WALL_DEPTH_SHORT: Record<WallDepth, string> = {
  1: 'C1',
  2: 'C2',
  3: 'C3',
};

interface WallDepthContextType {
  wallDepth: WallDepth;
  setWallDepth: (depth: WallDepth) => void;
  /** Advance 1 → 2 → 3 → 1, for a single-button toolbar control. */
  cycleWallDepth: () => void;
}

const WallDepthContext = createContext<WallDepthContextType | undefined>(undefined);

function getInitialDepth(): WallDepth {
  if (typeof window === 'undefined') return WALL_DEPTH_DEFAULT;
  try {
    return normalizeWallDepth(localStorage.getItem(STORAGE_KEY));
  } catch {
    return WALL_DEPTH_DEFAULT;
  }
}

export function WallDepthProvider({ children }: { children: ReactNode }) {
  const [wallDepth, setDepth] = useState<WallDepth>(getInitialDepth);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(wallDepth));
    } catch {
      // Private-mode / disabled storage — fall back to in-memory only.
    }
  }, [wallDepth]);

  const setWallDepth = (depth: WallDepth) => setDepth(normalizeWallDepth(depth));
  const cycleWallDepth = () => setDepth((d) => normalizeWallDepth((d % 3) + 1));

  return (
    <WallDepthContext.Provider value={{ wallDepth, setWallDepth, cycleWallDepth }}>
      {children}
    </WallDepthContext.Provider>
  );
}

/**
 * Read the shared wall depth.
 *
 * Returns the default outside a provider instead of throwing: these surfaces
 * are also rendered in isolated contexts (the OG-image routes, marketing
 * previews) that mount a chart without the app shell, and a missing preference
 * should degrade to "primary wall only", not blank the page.
 */
export function useWallDepth(): WallDepthContextType {
  const context = useContext(WallDepthContext);
  if (context === undefined) {
    return {
      wallDepth: WALL_DEPTH_DEFAULT,
      setWallDepth: () => {},
      cycleWallDepth: () => {},
    };
  }
  return context;
}
