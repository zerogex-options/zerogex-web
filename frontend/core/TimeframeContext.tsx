'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
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

/**
 * Pin a subtree to one underlying symbol, overriding the page-wide pick.
 *
 * Every widget on the site reads its symbol from useTimeframe(), so re-providing
 * the context with a different `symbol` is all it takes to point a whole branch
 * of the tree at another underlying — which is how "My Dashboard" runs SPY down
 * one half of a split board and QQQ down the other without a second page.
 *
 * `setSymbol` is redirected too: a chart with its own symbol switcher (the Gamma
 * Terminal's segmented control, say) must retarget the pane it lives in, not
 * yank the whole site. When `onSymbolChange` is omitted the setter is a no-op
 * inside the scope, so a scoped chart can never silently change the page.
 *
 * A null `symbol` passes the parent context straight through, so an unscoped
 * pane costs nothing and behaves exactly as before.
 */
export function TimeframeSymbolScope({
  symbol,
  onSymbolChange,
  children,
}: {
  symbol: UnderlyingSymbol | null;
  onSymbolChange?: (symbol: UnderlyingSymbol) => void;
  children: ReactNode;
}) {
  const parent = useTimeframe();
  const value = useMemo<TimeframeContextType>(() => {
    if (!symbol) return parent;
    return {
      ...parent,
      symbol,
      setSymbol: onSymbolChange ?? (() => {}),
    };
  }, [parent, symbol, onSymbolChange]);
  return <TimeframeContext.Provider value={value}>{children}</TimeframeContext.Provider>;
}

export function useTimeframe() {
  const context = useContext(TimeframeContext);
  if (context === undefined) {
    throw new Error('useTimeframe must be used within a TimeframeProvider');
  }
  return context;
}
