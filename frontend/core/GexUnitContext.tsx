'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// Dollar GEX is computed and stored in the "per 1% move" convention
// (γ × OI × 100 × S² × 0.01). The "per 1 point move" convention some
// competitor dashboards publish is the SAME exposure divided by
// (spot × 0.01), i.e. value × 100 / spot. The unit is a pure display
// reinterpretation — no stored value changes — so a single global
// preference keeps every GEX view (summary cards, profile chart,
// heatmaps) consistent.
export type GexUnit = 'percent' | 'point';

const STORAGE_KEY = 'zgx_gex_unit';

export const GEX_UNIT_LABEL: Record<GexUnit, string> = {
  percent: 'per 1% move',
  point: 'per 1pt move',
};

// Multiplicative factor that converts a per-1%-move dollar GEX value into
// the active unit. `point` => ×100/spot; `percent` (or missing/invalid
// spot) => 1 (identity). Because it is a single scalar per render, scaling
// the underlying values by it keeps axes, bars, color scales, legends and
// tooltips internally consistent.
export function gexScaleFactor(unit: GexUnit, spot: number | null | undefined): number {
  if (unit === 'point' && spot != null && Number.isFinite(spot) && spot > 0) {
    return 100 / spot;
  }
  return 1;
}

interface GexUnitContextType {
  gexUnit: GexUnit;
  setGexUnit: (unit: GexUnit) => void;
}

const GexUnitContext = createContext<GexUnitContextType | undefined>(undefined);

function getInitialUnit(): GexUnit {
  if (typeof window === 'undefined') return 'percent';
  try {
    return localStorage.getItem(STORAGE_KEY) === 'point' ? 'point' : 'percent';
  } catch {
    return 'percent';
  }
}

export function GexUnitProvider({ children }: { children: ReactNode }) {
  const [gexUnit, setGexUnit] = useState<GexUnit>(getInitialUnit);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, gexUnit);
    } catch {
      // Private-mode / disabled storage — fall back to in-memory only.
    }
  }, [gexUnit]);

  return (
    <GexUnitContext.Provider value={{ gexUnit, setGexUnit }}>
      {children}
    </GexUnitContext.Provider>
  );
}

export function useGexUnit() {
  const context = useContext(GexUnitContext);
  if (context === undefined) {
    throw new Error('useGexUnit must be used within a GexUnitProvider');
  }
  return context;
}
