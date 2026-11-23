'use client';

import { createContext, useContext, useSyncExternalStore, ReactNode } from 'react';

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

// A module-level store read through useSyncExternalStore, so hydration uses the
// SERVER's value ('simple', since the server cannot see localStorage) and React
// then re-renders with the saved one. Reading localStorage in a useState
// initializer instead made the first client render disagree with the server
// HTML for everyone on Detailed; React does not patch attributes after such a
// mismatch, so the Simple / Detailed switch kept showing Simple as selected
// while the page was Detailed, and clicking Detailed changed nothing on screen.
let current: Density | null = null;
const listeners = new Set<() => void>();

function readSaved(): Density {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'detailed' ? 'detailed' : 'simple';
  } catch {
    return 'simple';
  }
}

function getSnapshot(): Density {
  if (current === null) current = readSaved();
  return current;
}

function getServerSnapshot(): Density {
  return 'simple';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setDensity(next: Density): void {
  if (current === next) return;
  current = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Private-mode / disabled storage — in-memory only.
  }
  for (const listener of listeners) listener();
}

export function DensityProvider({ children }: { children: ReactNode }) {
  const density = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggleDensity = () => setDensity(density === 'simple' ? 'detailed' : 'simple');

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
