'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type Timeframe = '1min' | '5min' | '15min' | '1hr' | '1day';

interface TimeframeContextType {
  timeframe: Timeframe;
  setTimeframe: (timeframe: Timeframe) => void;
  getIntervalMinutes: () => number;
  getWindowMinutes: () => number;
  getMaxDataPoints: () => number;
}

const TimeframeContext = createContext<TimeframeContextType | undefined>(undefined);

export function TimeframeProvider({ children }: { children: ReactNode }) {
  const [timeframe, setTimeframe] = useState<Timeframe>('5min');

  // Convert timeframe to interval minutes
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

  // Calculate window as: base_minutes * timeframe_multiplier
  // Base is 180 minutes (3 hours) for 1-min
  const getWindowMinutes = () => {
    const interval = getIntervalMinutes();
    const baseMinutes = 180; // 3 hours for 1-min
    return baseMinutes * interval; // Scales proportionally with timeframe
  };

  // Fixed number of data points for consistent chart size
  const getMaxDataPoints = () => 96;

  return (
    <TimeframeContext.Provider
      value={{
        timeframe,
        setTimeframe,
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
