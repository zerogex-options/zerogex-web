'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type Timeframe = '1min' | '5min' | '15min' | '1hr' | '1day';
export type UnderlyingSymbol = 'SPY' | 'SPX' | 'QQQ' | 'IWM';

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
  const [symbol, setSymbol] = useState<UnderlyingSymbol>('SPY');

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
    const baseMinutes = 180;
    return baseMinutes * interval;
  };

  const getMaxDataPoints = () => 96;

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
