import 'server-only';

// Default windowing for the admin monitoring charts. The hourly/daily series
// pad to these sizes so the chart x-axes span a consistent range regardless of
// how much data has been collected. Both are defaults, not hard caps: callers
// may pass a custom count to either generator — the backend metrics feed uses a
// smaller hourly window, and the retained MRR/subscriber series pass a larger
// daily count to show all accumulated history beyond MAX_DAILY.
export const MAX_HOURLY = 720;
export const MAX_DAILY = 90;

const ET_PARTS_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
});

export function etBucketKeys(date: Date): { hour: string; day: string } {
  const parts = ET_PARTS_FORMATTER.formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '00';
  const d = parts.find((p) => p.type === 'day')?.value ?? '00';
  const rawHour = parts.find((p) => p.type === 'hour')?.value ?? '00';
  // Intl can render hour "24" at midnight; normalize to "00".
  const h = (rawHour === '24' ? '00' : rawHour).padStart(2, '0');
  const day = `${y}-${m}-${d}`;
  return { day, hour: `${day}T${h}` };
}

export function generateHourlyKeys(now: Date, count: number = MAX_HOURLY): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 3600_000);
    const { hour } = etBucketKeys(d);
    if (!seen.has(hour)) {
      seen.add(hour);
      keys.push(hour);
    }
  }
  return keys;
}

export function generateDailyKeys(now: Date, count: number = MAX_DAILY): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400_000);
    const { day } = etBucketKeys(d);
    if (!seen.has(day)) {
      seen.add(day);
      keys.push(day);
    }
  }
  return keys;
}
