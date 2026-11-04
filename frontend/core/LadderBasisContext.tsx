'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { readStoredLadderBasis, writeStoredLadderBasis, type LadderBasis } from './ladderBasis';

// What the gamma ladders weight each strike's gamma by: open interest (the
// dealer book, the default) or the session's traded volume. A single global
// display preference (persisted to localStorage) shared by every ladder
// surface — the Gamma Terminal, the Pair Comparison columns and the "Gamma
// Ladder" dashboard tile — so switching it in one place updates them all and
// survives reloads. Mirrors SessionDeltaContext.
interface LadderBasisContextType {
  ladderBasis: LadderBasis;
  setLadderBasis: (basis: LadderBasis) => void;
}

const LadderBasisContext = createContext<LadderBasisContextType | undefined>(undefined);

export function LadderBasisProvider({ children }: { children: ReactNode }) {
  const [ladderBasis, setLadderBasis] = useState<LadderBasis>(readStoredLadderBasis);

  useEffect(() => {
    writeStoredLadderBasis(ladderBasis);
  }, [ladderBasis]);

  return (
    <LadderBasisContext.Provider value={{ ladderBasis, setLadderBasis }}>
      {children}
    </LadderBasisContext.Provider>
  );
}

export function useLadderBasis() {
  const context = useContext(LadderBasisContext);
  if (context === undefined) {
    throw new Error('useLadderBasis must be used within a LadderBasisProvider');
  }
  return context;
}
