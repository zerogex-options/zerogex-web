'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  readStoredStrikeFilter,
  writeStoredStrikeFilter,
  type StrikeFilterMode,
} from './strikeFilter';

// "Active strikes only" is a single global display preference (persisted to
// localStorage) shared by every per-strike GEX view — the Pair Comparison
// ladder and the Gamma Exposure snapshot table — so toggling it in one place
// updates them all and survives reloads. Mirrors GexUnitContext.
interface StrikeFilterContextType {
  /** True = show only strikes carrying dealer positioning (the default). */
  activeOnly: boolean;
  setActiveOnly: (activeOnly: boolean) => void;
}

const StrikeFilterContext = createContext<StrikeFilterContextType | undefined>(undefined);

export function StrikeFilterProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<StrikeFilterMode>(readStoredStrikeFilter);

  useEffect(() => {
    writeStoredStrikeFilter(mode);
  }, [mode]);

  const value: StrikeFilterContextType = {
    activeOnly: mode === 'active',
    setActiveOnly: (next: boolean) => setMode(next ? 'active' : 'all'),
  };

  return <StrikeFilterContext.Provider value={value}>{children}</StrikeFilterContext.Provider>;
}

export function useStrikeFilter() {
  const context = useContext(StrikeFilterContext);
  if (context === undefined) {
    throw new Error('useStrikeFilter must be used within a StrikeFilterProvider');
  }
  return context;
}
