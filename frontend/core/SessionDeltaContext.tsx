'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  readStoredSessionDelta,
  writeStoredSessionDelta,
  type SessionDeltaMode,
} from './sessionDelta';

// The gamma ladder's "Δ since open" indicator is a single global display
// preference (persisted to localStorage) shared by every ladder surface — the
// Pair Comparison columns and the "Gamma Ladder" dashboard tile — so toggling
// it in one place updates them all and survives reloads. Mirrors
// StrikeFilterContext / GexUnitContext.
interface SessionDeltaContextType {
  /** True = overlay the per-strike session-change triangles (opt-in). */
  showSessionDelta: boolean;
  setShowSessionDelta: (show: boolean) => void;
}

const SessionDeltaContext = createContext<SessionDeltaContextType | undefined>(undefined);

export function SessionDeltaProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<SessionDeltaMode>(readStoredSessionDelta);

  useEffect(() => {
    writeStoredSessionDelta(mode);
  }, [mode]);

  const value: SessionDeltaContextType = {
    showSessionDelta: mode === 'on',
    setShowSessionDelta: (next: boolean) => setMode(next ? 'on' : 'off'),
  };

  return <SessionDeltaContext.Provider value={value}>{children}</SessionDeltaContext.Provider>;
}

export function useSessionDelta() {
  const context = useContext(SessionDeltaContext);
  if (context === undefined) {
    throw new Error('useSessionDelta must be used within a SessionDeltaProvider');
  }
  return context;
}
