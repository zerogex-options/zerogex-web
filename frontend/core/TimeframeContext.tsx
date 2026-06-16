'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type Timeframe = '1min' | '5min' | '15min' | '1hr' | '1day';
export type UnderlyingSymbol = 'SPY' | 'SPX' | 'QQQ';

const SYMBOL_STORAGE_KEY = 'zgx_symbol';

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

function isUnderlyingSymbol(value: string | null): value is UnderlyingSymbol {
  return value === 'SPY' || value === 'SPX' || value === 'QQQ';
}

// Reading `?symbol=` from the URL on every navigation is what lets deep-links
// (e.g. the magnet page's per-symbol "Live dashboard" links) force the active
// symbol — without this, clicking SPX/SPY/QQQ all land on whatever the user
// had previously selected via localStorage.
function symbolFromUrl(): UnderlyingSymbol | null {
  if (typeof window === 'undefined') return null;
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('symbol');
    return isUnderlyingSymbol(fromUrl) ? fromUrl : null;
  } catch {
    return null;
  }
}

function getInitialSymbol(): UnderlyingSymbol {
  if (typeof window === 'undefined') return 'SPY';
  const fromUrl = symbolFromUrl();
  if (fromUrl) return fromUrl;
  const saved = localStorage.getItem(SYMBOL_STORAGE_KEY);
  return isUnderlyingSymbol(saved) ? saved : 'SPY';
}

export function TimeframeProvider({ children }: { children: ReactNode }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('5min');
  const [symbol, setSymbol] = useState<UnderlyingSymbol>(getInitialSymbol);
  const pathname = usePathname();

  useEffect(() => {
    localStorage.setItem(SYMBOL_STORAGE_KEY, symbol);
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
