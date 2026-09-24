/**
 * Pure helpers behind the Technicals charts: the /intraday-tools page and the
 * My Dashboard widgets that show the same pictures. One copy, so the page and
 * the widgets cannot drift apart, and free of React so it can be tested
 * directly under the Node test runner.
 *
 * The number, tick and time-axis helpers moved here unchanged from
 * app/intraday-tools/page.tsx; the opening-range functions are what the page
 * used to compute inline.
 */

import type { TechnicalsBar, TechnicalsOpeningRange } from '../hooks/useTechnicals';

// ── Numbers and ticks ─────────────────────────────────────────────────────────

export function getDateMarkerMeta(timestamps: string[]) {
  const groups = new Map<string, { first: number; last: number }>();
  timestamps.forEach((ts, idx) => {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    const key = d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
    const current = groups.get(key);
    if (!current) groups.set(key, { first: idx, last: idx });
    else groups.set(key, { first: current.first, last: idx });
  });
  const indexToLabel = new Map<number, string>();
  groups.forEach((g, label) => {
    indexToLabel.set(g.first, label);
  });
  return indexToLabel;
}

export function getDynamicStep(min: number, max: number): number {
  const range = Math.max(1e-9, Math.abs(max - min));
  const rawStep = range / 6;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;
  if (normalized < 1.5) return 1 * magnitude;
  if (normalized < 3.5) return 2 * magnitude;
  if (normalized < 7.5) return 5 * magnitude;
  return 10 * magnitude;
}

export function safeNum(value: unknown): number | null {
  // Treat null/undefined/empty as missing — Number(null) === 0 silently turns
  // "no data yet" bars (e.g. ORB before market open) into a real 0, which then
  // collapses chart domains down to zero.
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function trimEdgeTicks(ticks: number[]): number[] {
  // Drop the first and last tick so the topmost/bottommost labels aren't
  // rendered right at the chart edge (where they'd overlap the axis line or
  // spill beyond the chart frame).
  if (ticks.length <= 2) return ticks;
  return ticks.slice(1, -1);
}

export function fmtFixed(value: unknown, digits = 2): string {
  const n = safeNum(value);
  return n == null ? '--' : n.toFixed(digits);
}

export function generateNiceTicks(min: number, max: number): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const step = getDynamicStep(min, max);
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let i = 0; i < 24; i++) {
    const t = Number((start + i * step).toPrecision(12));
    ticks.push(t);
    if (t >= max) break;
  }
  return ticks;
}

// ── Time axis ─────────────────────────────────────────────────────────────────

/**
 * Minutes between time labels on a desktop session axis, from the number of
 * five-minute slots it spans.
 */
export function timelineLabelStepMin(slotCount: number): number {
  if (slotCount <= 0) return 60;
  if (slotCount <= 24) return 15;
  if (slotCount <= 96) return 30;
  if (slotCount <= 192) return 60;
  return 120;
}

// A phone plot is ~260px wide. The desktop step (hourly across a 04:00–20:00
// session) is a dozen labels there, which overprinted into one smear
// ("04:005:006:00…"). A phone keeps about five: the step is the smallest clock
// interval that fits the chart's own span into that many, aligned to the ET
// clock (not UTC, so 3-hour steps land on 09:00/12:00/15:00 in both EST and
// EDT).
export const ET_HM = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

export function etMinuteOfDay(ms: number): number {
  const parts = ET_HM.formatToParts(new Date(ms));
  const h = Number(parts.find((p) => p.type === 'hour')?.value);
  const m = Number(parts.find((p) => p.type === 'minute')?.value);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : -1;
}

const PHONE_MAX_TIME_LABELS = 5;

export function phoneLabelStepMin(timestamps: string[]): number {
  if (timestamps.length < 2) return 60;
  const first = new Date(timestamps[0]).getTime();
  const last = new Date(timestamps[timestamps.length - 1]).getTime();
  const spanMin = Number.isFinite(first) && Number.isFinite(last) ? (last - first) / 60_000 : 0;
  for (const step of [30, 60, 120, 180, 240]) {
    if (spanMin / step <= PHONE_MAX_TIME_LABELS) return step;
  }
  return 240;
}

/** Price ticks without the cents when every tick is a whole dollar — "$658",
 *  which fits a phone's 44px axis where "$658.00" did not. */
export function phonePriceTick(v: number, ticks: number[]): string {
  const whole = ticks.length > 0 && ticks.every((t) => Math.abs(t - Math.round(t)) < 1e-9);
  return `$${Number(v).toFixed(whole ? 0 : 2)}`;
}

// ── Opening range ─────────────────────────────────────────────────────────────

export type OrbChartRow = {
  timestamp: string;
  price: number | null;
  orbHigh: number | null;
  orbLow: number | null;
  orbBand: [number, number] | null;
};

/** One row per bar: price, the range's high and low, and the band between. */
export function orbChartRows(bars: TechnicalsBar[]): OrbChartRow[] {
  return bars.map((bar) => {
    const price = safeNum(bar.close);
    const high = safeNum(bar.opening_range?.orb_high);
    const low = safeNum(bar.opening_range?.orb_low);
    const orbBand: [number, number] | null = high != null && low != null ? [low, high] : null;
    return { timestamp: bar.timestamp, price, orbHigh: high, orbLow: low, orbBand };
  });
}

/** Price domain covering price and both levels, with 15% of the span as air. */
export function orbChartDomain(rows: OrbChartRow[]): [number, number] | null {
  const values: number[] = [];
  for (const row of rows) {
    if (row.price != null) values.push(row.price);
    if (row.orbHigh != null) values.push(row.orbHigh);
    if (row.orbLow != null) values.push(row.orbLow);
  }
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = max > min ? (max - min) * 0.15 : Math.max(0.5, max * 0.001);
  return [min - padding, max + padding];
}

export function orbPriceTicks(domain: [number, number] | null): number[] {
  if (!domain) return [];
  return trimEdgeTicks(generateNiceTicks(domain[0], domain[1]));
}

export type OrbPosition = {
  orbLow: number;
  orbHigh: number;
  price: number;
  /** Positions on the bar, 0–100. */
  lowPct: number;
  highPct: number;
  pricePct: number;
};

/**
 * Where price and the range's edges sit on the Position Within Range bar. The
 * bar spans one range-width either side of the range, so a breakout shows as
 * distance traveled and price pins to an end once it is further out than
 * that. Null until the range and a price both exist.
 */
export function orbPosition(
  orb: Pick<TechnicalsOpeningRange, 'orb_high' | 'orb_low' | 'orb_range'> | null | undefined,
  price: unknown,
): OrbPosition | null {
  const orbHigh = safeNum(orb?.orb_high);
  const orbLow = safeNum(orb?.orb_low);
  const current = safeNum(price);
  if (orbHigh == null || orbLow == null || current == null) return null;
  const orbRangeRaw = safeNum(orb?.orb_range);
  const range = orbRangeRaw != null && orbRangeRaw > 0 ? orbRangeRaw : 1;
  const lowEdge = orbLow - range;
  const highEdge = orbHigh + range;
  const span = Math.max(1e-9, highEdge - lowEdge);
  const pct = (v: number) => Math.max(0, Math.min(100, ((v - lowEdge) / span) * 100));
  return { orbLow, orbHigh, price: current, lowPct: pct(orbLow), highPct: pct(orbHigh), pricePct: pct(current) };
}

export type OrbStatusKind = 'breakout' | 'breakdown' | 'nearHigh' | 'nearLow' | 'inside';

/**
 * The backend's orb_status is display text with an emoji ("🚀 ORB Breakout
 * (Long)", "💥 ORB Breakdown (Short)", "⚡ Near ORB High", "⚡ Near ORB Low",
 * "⏸️ Inside ORB"). This reads it as one of five states, so a widget can show a
 * short label that fits. Null for no status yet, or one this build does not
 * know.
 */
export function orbStatusKind(status: string | null | undefined): OrbStatusKind | null {
  if (!status) return null;
  if (status.includes('🚀') || /breakout/i.test(status)) return 'breakout';
  if (status.includes('💥') || /breakdown/i.test(status)) return 'breakdown';
  if (/near\s+orb\s+high/i.test(status)) return 'nearHigh';
  if (/near\s+orb\s+low/i.test(status)) return 'nearLow';
  if (/inside/i.test(status)) return 'inside';
  return null;
}

/** Breakout reads bullish, breakdown bearish, anything else is a warning tone. */
export function orbStatusColor(status: string | null | undefined): string {
  const kind = orbStatusKind(status);
  if (kind === 'breakout') return 'var(--color-bull)';
  if (kind === 'breakdown') return 'var(--color-bear)';
  return 'var(--color-warning)';
}
