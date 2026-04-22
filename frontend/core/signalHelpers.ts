export type GenericObject = Record<string, unknown>;

export type SignalTrend = 'bullish' | 'bearish' | 'neutral';

export function asObject(value: unknown): GenericObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as GenericObject;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function getNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function getBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

export function toTrend(direction: unknown): SignalTrend {
  const d = String(direction ?? '').toLowerCase();
  if (d === 'bullish' || d === 'up' || d === 'long') return 'bullish';
  if (d === 'bearish' || d === 'down' || d === 'short') return 'bearish';
  return 'neutral';
}

export function trendColor(trend: SignalTrend): string {
  if (trend === 'bullish') return 'var(--color-bull)';
  if (trend === 'bearish') return 'var(--color-bear)';
  return 'var(--color-warning)';
}

export function scoreTrend(score: number | null | undefined, threshold = 25): SignalTrend {
  if (score == null || !Number.isFinite(score)) return 'neutral';
  if (score >= threshold) return 'bullish';
  if (score <= -threshold) return 'bearish';
  return 'neutral';
}

export function formatSigned(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`;
}

export function formatPct(value: number | null | undefined, digits = 2, signed = true): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const pct = value * 100;
  const sign = signed ? (pct >= 0 ? '+' : '') : '';
  return `${sign}${pct.toFixed(digits)}%`;
}

export function formatGexCompact(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatPrice(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export interface ScoreHistoryPoint {
  score: number;
  timestamp?: string | null;
  index: number;
}

export function parseScoreHistory(raw: unknown): ScoreHistoryPoint[] {
  const rows = asArray(raw);
  const out: ScoreHistoryPoint[] = [];
  rows.forEach((row, idx) => {
    const obj = asObject(row);
    if (!obj) return;
    const score = getNumber(obj.score ?? obj.value ?? obj.composite_score);
    if (score == null) return;
    const ts = obj.timestamp ?? obj.time ?? obj.ts ?? null;
    out.push({ score, timestamp: ts ? String(ts) : null, index: idx });
  });

  const withTs = out.filter((p) => p.timestamp);
  if (withTs.length === out.length && out.length > 1) {
    out.sort((a, b) => new Date(a.timestamp as string).getTime() - new Date(b.timestamp as string).getTime());
    out.forEach((p, i) => { p.index = i; });
  }
  return out;
}

export function formatEtTime(value: unknown): string {
  if (value == null) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' });
}

export function formatEtDate(value: unknown): string {
  if (value == null) return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });
}

function etDateKey(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function etMinuteOfDay(value: string): number | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d);
  let hour = 0;
  let minute = 0;
  for (const p of parts) {
    if (p.type === 'hour') hour = Number(p.value) % 24;
    else if (p.type === 'minute') minute = Number(p.value);
  }
  return hour * 60 + minute;
}

// Pick tick timestamps from a sorted series that land on even `stepMinutes`
// boundaries in ET (e.g. 9:00, 9:15, 9:30…). Falls back to sampling the
// available points evenly when none line up.
export function computeTimeTicks(timestamps: readonly string[], stepMinutes = 15): string[] {
  if (timestamps.length === 0) return [];
  const aligned: string[] = [];
  let lastKey = '';
  for (const ts of timestamps) {
    const mod = etMinuteOfDay(ts);
    if (mod == null) continue;
    if (mod % stepMinutes !== 0) continue;
    const bucket = `${etDateKey(ts)}#${mod}`;
    if (bucket === lastKey) continue;
    aligned.push(ts);
    lastKey = bucket;
  }
  if (aligned.length >= 2) return aligned;
  const targetCount = Math.min(6, timestamps.length);
  const stride = Math.max(1, Math.floor((timestamps.length - 1) / (targetCount - 1 || 1)));
  const sampled: string[] = [];
  for (let i = 0; i < timestamps.length; i += stride) sampled.push(timestamps[i]);
  if (sampled[sampled.length - 1] !== timestamps[timestamps.length - 1]) {
    sampled.push(timestamps[timestamps.length - 1]);
  }
  return sampled;
}

// For a list of tick timestamps, returns the ones that are the first
// occurrence of a new ET calendar day, so a date label can be rendered
// once per day group.
export function firstTicksOfEtDay(ticks: readonly string[]): Set<string> {
  const result = new Set<string>();
  let lastDay = '';
  for (const ts of ticks) {
    const day = etDateKey(ts);
    if (!day) continue;
    if (day !== lastDay) {
      result.add(ts);
      lastDay = day;
    }
  }
  return result;
}
