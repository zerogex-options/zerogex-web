'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  persistSymbol,
  resolveInitialSymbol,
  symbolFromUrl,
  type UnderlyingSymbol,
} from './symbolPersistence';

type Timeframe = '1min' | '5min' | '15min' | '1hr' | '1day';
export type { UnderlyingSymbol };

interface TimeframeContextType {
  timeframe: Timeframe;
  setTimeframe: (timeframe: Timeframe) => void;
  symbol: UnderlyingSymbol;
  setSymbol: (symbol: UnderlyingSymbol) => void;
  getIntervalMinutes: () => number;
  getWindowMinutes: () => number;
  getMaxDataPoints: () => number;
}

const TimeframeContext = createContext<TimeframeContextType | undefined>(undefined);

export function TimeframeProvider({ children }: { children: ReactNode }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('5min');
  const [symbol, setSymbolState] = useState<UnderlyingSymbol>(resolveInitialSymbol);
  const pathname = usePathname();

  // Persist synchronously on every symbol change (header picker, forced-flow
  // buttons, deep links) instead of relying on a passive effect. On iOS/WebKit
  // the page can be discarded and reloaded at any moment (memory pressure, tab
  // backgrounding); the symbol is then re-derived from localStorage. A passive
  // useEffect write could still be pending when that teardown happens, so the
  // user's pick (e.g. SPY) never reached storage and the reloaded page fell
  // back to the previously saved value (SPX) — exactly the "won't stick on
  // mobile" report. Writing in the setter guarantees the value is durable
  // before any navigation or reload can occur.
  const setSymbol = useCallback((next: UnderlyingSymbol) => {
    persistSymbol(next);
    setSymbolState(next);
  }, []);

  // Backstop persistence for the value we *started* with — a fresh deep-link
  // landing (?symbol=QQQ) or the default — so a later reload still restores it.
  // User-driven changes are already written synchronously by setSymbol above,
  // so this effectively only fires for the initial mount value.
  useEffect(() => {
    persistSymbol(symbol);
  }, [symbol]);

  // Re-honor ?symbol= on every client-side navigation. Without this the deep
  // link works only on a fresh tab; in-app <Link> navigation keeps the old
  // symbol because the provider lives in the root layout and never remounts.
  // A pathname change with no ?symbol= param leaves the current symbol alone.
  useEffect(() => {
    const fromUrl = symbolFromUrl();
    if (fromUrl && fromUrl !== symbol) {
      setSymbol(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const getIntervalMinutes = () => {
    switch (timeframe) {
      case '1min': return 1;
      case '5min': return 5;
      case '15min': return 15;
      case '1hr': return 60;
      case '1day': return 1440;
      default: return 5;
    }
  };

  const getWindowMinutes = () => {
    const interval = getIntervalMinutes();
    const baseMinutes = 90;
    return baseMinutes * interval;
  };

  const getMaxDataPoints = () => 90;

  return (
    <TimeframeContext.Provider
      value={{
        timeframe,
        setTimeframe,
        symbol,
        setSymbol,
        getIntervalMinutes,
        getWindowMinutes,
        getMaxDataPoints,
      }}
    >
      {children}
    </TimeframeContext.Provider>
  );
}

export function useTimeframe() {
  const context = useContext(TimeframeContext);
  if (context === undefined) {
    throw new Error('useTimeframe must be used within a TimeframeProvider');
  }
  return context;
}
