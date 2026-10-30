/**
 * Fuseline Radar: the arithmetic behind the page, kept out of the components
 * so every rule that makes a claim about a price or a time can be tested.
 *
 * The product is Plus3 Forecasting's design (Barrie's spec, v1.2 plus the
 * Layout A decision). The page organizes existing analytics around one trade:
 * a Fuse, a direction, one or two targets, and the modeled gamma along that
 * route. Nothing here recommends a trade, sizes one, or predicts a level.
 *
 * Three meanings never share a channel on the page: SIGN (positive or
 * negative gamma), CHANGE (strengthening or weakening over a window), and the
 * TRADE PLAN (Fuse, targets, route). This module computes all three and lets
 * the components decide how to draw them.
 *
 * Coordinates: the gamma terrain is SPX-derived. ES is SPX times the basis
 * ratio the API itself uses for every ES surface (src/jobs/futures_projection
 * in zerogex-oa), so a strike drawn here sits where the rest of the site puts
 * it. The plan is stored in the instrument it was typed in and converted for
 * display, never re-entered.
 *
 * No runtime imports, so the Node test runner can load it directly.
 */

export type Instrument = 'ES' | 'SPX';
export type Direction = 'up' | 'down';
export type ViewMode = 'AB' | 'ABC' | 'WIDE';
export type ChangeWindow = 1 | 4 | 20;

export const CHANGE_WINDOWS: ChangeWindow[] = [1, 4, 20];
export const DEFAULT_WIDE_POINTS = 100;
/** Within this many points of a level, a strike counts as AT it. */
export const NEAR_POINTS = 2.5;

// ---------------------------------------------------------------------------
// Coordinates
// ---------------------------------------------------------------------------

export interface Basis {
  /** ES / SPX. */
  ratio: number;
  /** When the ratio was measured, ISO. Null for a theoretical carry ratio. */
  observedAt: string | null;
  /** 'measured' | 'measured_stale' | 'carry', from the API. */
  source: string | null;
}

/** Move a price between the two instruments. Identity when they match. */
export function convertPrice(price: number, from: Instrument, to: Instrument, ratio: number): number {
  if (from === to) return price;
  return from === 'SPX' ? price * ratio : price / ratio;
}

/** Plain words for the API's basis source, and whether it deserves a flag. */
export function describeBasisSource(source: string | null): { text: string; flag: boolean } {
  if (source === 'measured') return { text: 'measured', flag: false };
  if (source === 'measured_stale') return { text: 'measured, but stale', flag: true };
  if (source === 'carry') return { text: 'theoretical carry, not measured', flag: true };
  return { text: 'unknown source', flag: true };
}

// ---------------------------------------------------------------------------
// The plan
// ---------------------------------------------------------------------------

export interface RadarPlan {
  /** The instrument the plan's numbers were typed in. */
  instrument: Instrument;
  direction: Direction;
  fuse: number | null;
  t1: number | null;
  t2: number | null;
}

export const EMPTY_PLAN: RadarPlan = { instrument: 'ES', direction: 'up', fuse: null, t1: null, t2: null };

/**
 * What is wrong with a plan, in words. Targets are validated against the
 * direction and NEVER silently reordered: a Target 1 on the wrong side of the
 * Fuse is the trader's to fix, because swapping it would draw a route they
 * did not enter.
 */
export function planProblems(plan: RadarPlan): string[] {
  const out: string[] = [];
  const s = plan.direction === 'up' ? 1 : -1;
  const side = plan.direction === 'up' ? 'above' : 'below';
  if (plan.fuse == null) out.push('Enter the Fuse to anchor the route.');
  if (plan.t1 == null) out.push('Enter Target 1 to draw the route.');
  if (plan.fuse != null && plan.t1 != null && (plan.t1 - plan.fuse) * s <= 0) {
    out.push(`Target 1 must be ${side} the Fuse for a${plan.direction === 'up' ? 'n up' : ' down'} route.`);
  }
  if (plan.t1 != null && plan.t2 != null && (plan.t2 - plan.t1) * s <= 0) {
    out.push(`Target 2 must be ${side} Target 1.`);
  }
  return out;
}

/** The plan's levels in the display instrument. Null where not set. */
export interface PlanLevels {
  fuse: number | null;
  t1: number | null;
  t2: number | null;
}

export function planLevels(plan: RadarPlan, display: Instrument, ratio: number): PlanLevels {
  const c = (p: number | null) => (p == null ? null : convertPrice(p, plan.instrument, display, ratio));
  // A Target 2 on the wrong side of Target 1 is reported, not drawn: drawing
  // it would put a destination on the chart that the route cannot reach.
  const t2Bad = planProblems(plan).some((p) => p.startsWith('Target 2'));
  return { fuse: c(plan.fuse), t1: c(plan.t1), t2: t2Bad ? null : c(plan.t2) };
}

/** A usable route: a Fuse and a Target 1 on the right side of it. */
export function routeReady(plan: RadarPlan): boolean {
  return planProblems(plan).every((p) => p.startsWith('Target 2'));
}

// ---------------------------------------------------------------------------
// Where a price sits on the route
// ---------------------------------------------------------------------------

export type RouteZone =
  | 'behind' // past the Fuse, on the wrong side of the trade
  | 'retrace' // between the Fuse and spot: the protection segment
  | 'spot'
  | 'active' // spot to Target 1
  | 't1'
  | 'extension' // Target 1 to Target 2
  | 'beyond'; // past the last target

export const ROUTE_ZONE_TEXT: Record<RouteZone, string> = {
  behind: 'Behind the Fuse',
  retrace: 'Between the Fuse and spot',
  spot: 'At spot',
  active: 'Before Target 1',
  t1: 'At Target 1',
  extension: 'Extension route',
  beyond: 'Beyond the last target',
};

/**
 * Classify a price against the route. Mirrored for a down route, so "behind"
 * always means past the Fuse on the side the trade is not going.
 */
export function routeZone(
  price: number,
  levels: { fuse: number; t1: number; t2: number | null; spot: number },
  direction: Direction,
): RouteZone {
  const s = direction === 'up' ? 1 : -1;
  const d = (x: number) => (x - levels.fuse) * s;
  if (Math.abs(price - levels.spot) <= NEAR_POINTS) return 'spot';
  if (Math.abs(price - levels.t1) <= NEAR_POINTS) return 't1';
  const x = d(price);
  if (x < 0) return 'behind';
  if (x < d(levels.spot)) return 'retrace';
  if (x <= d(levels.t1)) return 'active';
  if (levels.t2 != null && x <= d(levels.t2) + NEAR_POINTS) return 'extension';
  return 'beyond';
}

/** Spot has crossed the Fuse against the selected direction. */
export function anchorCrossed(spot: number, fuse: number, direction: Direction): boolean {
  return (spot - fuse) * (direction === 'up' ? 1 : -1) < 0;
}

/** Spot is past Target 1 in the trade's direction. */
export function targetPassed(spot: number, target: number, direction: Direction): boolean {
  return (spot - target) * (direction === 'up' ? 1 : -1) > 0;
}

// ---------------------------------------------------------------------------
// What the chart keeps on screen
// ---------------------------------------------------------------------------

/**
 * The prices a view asks the chart to keep in its fit. The chart still owns
 * the scale (and the reader's zoom and pan win over it): A to B keeps the Fuse
 * and Target 1 in view, A to B to C adds Target 2 (A to B when there is none),
 * and Wide reaches a set distance in the trade's direction from the Fuse.
 * Without a route there is nothing to keep, and the chart fits price alone.
 */
export function fitPricesFor(
  view: ViewMode,
  levels: PlanLevels,
  direction: Direction,
  widePoints: number = DEFAULT_WIDE_POINTS,
): number[] {
  const { fuse, t1, t2 } = levels;
  if (fuse == null || t1 == null) return [];
  if (view === 'WIDE') return [fuse, fuse + (direction === 'up' ? widePoints : -widePoints)];
  if (view === 'ABC' && t2 != null) return [fuse, t1, t2];
  return [fuse, t1];
}

// ---------------------------------------------------------------------------
// Terrain: per-strike modeled net gamma through time
// ---------------------------------------------------------------------------

export interface TerrainBucket {
  timestamp: string;
  strikes?: { strike?: number | string; net_gamma?: number | string | null }[] | null;
}

export interface Terrain {
  /** Epoch ms per bucket, ascending. */
  times: number[];
  /** Strike (SPX) to its net gamma at each time; null where the strike was missing. */
  byStrike: Map<number, (number | null)[]>;
}

const num = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Align buckets into one series per strike. A strike absent from a bucket is
 * null there, never zero: a missing reading is not a reading of nothing.
 */
export function buildTerrain(buckets: TerrainBucket[] | null | undefined): Terrain {
  const rows = (buckets ?? [])
    .map((b) => ({ t: Date.parse(b.timestamp), strikes: b.strikes ?? [] }))
    .filter((b) => Number.isFinite(b.t))
    .sort((a, b) => a.t - b.t);
  const times = rows.map((r) => r.t);
  const byStrike = new Map<number, (number | null)[]>();
  rows.forEach((row, i) => {
    for (const s of row.strikes) {
      const k = num(s.strike);
      if (k == null) continue;
      let series = byStrike.get(k);
      if (!series) {
        series = new Array(rows.length).fill(null);
        byStrike.set(k, series);
      }
      series[i] = num(s.net_gamma);
    }
  });
  return { times, byStrike };
}

export type ChangeState = 'strengthening' | 'weakening' | 'steady' | 'unavailable';

export interface StrikeChange {
  now: number | null;
  /** The value at the start of the window. */
  then: number | null;
  /** |now| minus |then|: growth in size, whatever the sign. */
  sizeDelta: number | null;
  /** sizeDelta over |then|, only when |then| is large enough to divide by. */
  pct: number | null;
  state: ChangeState;
}

/**
 * How one strike changed over a window ending at the newest bucket.
 *
 * Strengthening and weakening are about SIZE: a negative strike going from
 * -760M to -420M is weakening, though its net value rose. The window start is
 * the bucket exactly `windowMin` minutes earlier; if that bucket or either
 * value is missing, the change is unavailable rather than inferred.
 *
 * `pctFloor` keeps percentages away from near-zero bases, where a doubling of
 * almost nothing reads as dramatic.
 */
export function strikeChange(
  series: (number | null)[] | undefined,
  times: number[],
  windowMin: number,
  threshold: number,
  pctFloor: number,
): StrikeChange {
  const empty: StrikeChange = { now: null, then: null, sizeDelta: null, pct: null, state: 'unavailable' };
  if (!series || times.length === 0) return empty;
  const last = times.length - 1;
  const now = series[last];
  const startAt = times[last] - windowMin * 60_000;
  const j = times.indexOf(startAt);
  const then = j >= 0 ? series[j] : null;
  if (now == null || then == null) return { ...empty, now };
  const sizeDelta = Math.abs(now) - Math.abs(then);
  const pct = Math.abs(then) >= pctFloor ? sizeDelta / Math.abs(then) : null;
  const state: ChangeState =
    sizeDelta >= threshold ? 'strengthening' : sizeDelta <= -threshold ? 'weakening' : 'steady';
  return { now, then, sizeDelta, pct, state };
}

/**
 * PROVISIONAL noise threshold: 3% of today's largest strike, scaled with the
 * square root of the window so a 20-minute change has to be bigger than a
 * 1-minute one to count. This is a stand-in so the ladder can be read today;
 * the adjustable lens from Barrie's zone spec replaces it.
 */
export function provisionalThreshold(maxAbs: number, windowMin: number): number {
  return Math.max(1, 0.03 * maxAbs * Math.sqrt(windowMin / 20));
}

export interface SizeContext {
  maxAbs: number;
  gross: number;
  /** 1 = the largest |net gamma| on the board right now. */
  rank: Map<number, number>;
  /** |net gamma| over the board's gross. */
  share: Map<number, number>;
}

/**
 * Today-relative size, over EVERY tracked strike rather than the visible
 * ones, so zooming or moving a target never changes how big a strike looks.
 */
export function sizeContext(terrain: Terrain): SizeContext {
  const last = terrain.times.length - 1;
  const current: [number, number][] = [];
  terrain.byStrike.forEach((series, k) => {
    const v = last >= 0 ? series[last] : null;
    if (v != null) current.push([k, Math.abs(v)]);
  });
  const gross = current.reduce((a, [, v]) => a + v, 0);
  const maxAbs = current.reduce((a, [, v]) => Math.max(a, v), 0);
  const rank = new Map<number, number>();
  const share = new Map<number, number>();
  [...current].sort((a, b) => b[1] - a[1]).forEach(([k, v], i) => {
    rank.set(k, i + 1);
    share.set(k, gross > 0 ? v / gross : 0);
  });
  return { maxAbs, gross, rank, share };
}

/**
 * PROVISIONAL: the first strike ahead of spot, inside the route, holding at
 * least `minShare` of today's gross. A placeholder for "the next relevant
 * concentration" until the methodology settles.
 */
export function nextRelevantStrike(
  strikes: { k: number; price: number; share: number }[],
  levels: { fuse: number; t1: number; t2: number | null; spot: number },
  direction: Direction,
  minShare = 0.08,
): number | null {
  const s = direction === 'up' ? 1 : -1;
  const ahead = strikes
    .filter((x) => (x.price - levels.spot) * s > NEAR_POINTS && x.share >= minShare)
    .filter((x) => ['active', 't1', 'extension'].includes(routeZone(x.price, levels, direction)))
    .sort((a, b) => (a.price - b.price) * s);
  return ahead.length ? ahead[0].k : null;
}

// ---------------------------------------------------------------------------
// The session clock
// ---------------------------------------------------------------------------

/**
 * ET's UTC offset in minutes at an instant (-240 in summer, -300 in winter),
 * read from the platform's own time-zone data rather than a DST table.
 */
export function etOffsetMinutes(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'shortOffset',
  }).formatToParts(new Date(ms));
  const name = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-5';
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!m) return -300;
  const minutes = Number(m[2]) * 60 + Number(m[3] ?? 0);
  return m[1] === '-' ? -minutes : minutes;
}

/** 09:30 and 16:00 ET on the trading day containing `ms`, as epoch ms. */
export function sessionBounds(ms: number): { open: number; close: number } {
  const offset = etOffsetMinutes(ms);
  const et = new Date(ms + offset * 60_000);
  const y = et.getUTCFullYear(); const mo = et.getUTCMonth(); const d = et.getUTCDate();
  const open = Date.UTC(y, mo, d, 9, 30) - offset * 60_000;
  const close = Date.UTC(y, mo, d, 16, 0) - offset * 60_000;
  return { open, close };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Dollar gamma, signed: +$940M, -$1.20B. */
export function formatGamma(value: number): string {
  const a = Math.abs(value); const sign = value < 0 ? '-' : '+';
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}$${Math.round(a / 1e6)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
  return `${sign}$${Math.round(a)}`;
}

/** A size change without the dollar sign, signed: +66M, -1.20B. */
export function formatSizeDelta(value: number): string {
  return formatGamma(value).replace('$', '');
}

export function formatPrice(price: number): string {
  return price.toFixed(2);
}

/** A strike's label in the display instrument: SPX strikes are whole, ES carries a decimal. */
export function formatStrike(spxStrike: number, display: Instrument, ratio: number): string {
  return display === 'SPX' ? String(spxStrike) : (spxStrike * ratio).toFixed(1);
}
