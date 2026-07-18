'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// A global "how much do you want to see" preference. 'simple' keeps pages
// glance-first (verbose sections collapsed by default); 'detailed' expands
// them. Persisted like the other display prefs (theme, GEX unit) so a power
// user's choice sticks across pages and sessions.
export type Density = 'simple' | 'detailed';

const STORAGE_KEY = 'zgx_density';

interface DensityContextType {
  density: Density;
  setDensity: (d: Density) => void;
  toggleDensity: () => void;
  // Convenience: the default-open state a Collapsible should take.
  detailed: boolean;
}

const DensityContext = createContext<DensityContextType | undefined>(undefined);

function getInitialDensity(): Density {
  if (typeof window === 'undefined') return 'simple';
  try {
    return localStorage.getItem(STORAGE_KEY) === 'detailed' ? 'detailed' : 'simple';
  } catch {
    return 'simple';
  }
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<Density>(getInitialDensity);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, density);
    } catch {
      // Private-mode / disabled storage — in-memory only.
    }
  }, [density]);

  const toggleDensity = () => setDensity((d) => (d === 'simple' ? 'detailed' : 'simple'));

  return (
    <DensityContext.Provider value={{ density, setDensity, toggleDensity, detailed: density === 'detailed' }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity() {
  const context = useContext(DensityContext);
  if (context === undefined) {
    throw new Error('useDensity must be used within a DensityProvider');
  }
  return context;
}
