import { MarketSession } from './types';

export const getMarketSession = (): MarketSession => {
  const now = new Date();
  const day = now.getDay();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const time = hours * 60 + minutes;

  if (day === 0 || day === 6) return 'closed-weekend';

  const marketOpen = 9 * 60 + 30;
  const marketClose = 16 * 60;
  const preMarketStart = 4 * 60;
  const afterHoursEnd = 20 * 60;

  if (time >= marketOpen && time < marketClose) return 'open';
  if (time >= preMarketStart && time < marketOpen) return 'pre-market';
  if (time >= marketClose && time < afterHoursEnd) return 'after-hours';
  return 'closed';
};

export const formatTime = (timezone: string): string => {
  return new Date().toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};
