import { MarketSession } from './types';

export const getMarketSession = (): MarketSession => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hours = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minutes = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  const time = hours * 60 + minutes;

  if (weekday === 'Sat' || weekday === 'Sun') return 'closed-weekend';

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

const etFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  weekday: 'short',
});

export const isWithinExtendedMarketHours = (timestamp: string | Date): boolean => {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;

  const parts = etFormatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');

  if (weekday === 'Sat' || weekday === 'Sun') return false;

  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 4 * 60 && totalMinutes <= 20 * 60;
};

export const omitClosedMarketTimes = <T>(
  data: T[],
  getTimestamp: (item: T) => string | Date
): T[] => data.filter((item) => isWithinExtendedMarketHours(getTimestamp(item)));
