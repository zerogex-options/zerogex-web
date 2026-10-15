/**
 * Gamma Surface — the pure half of the chart.
 *
 * The surface is /api/gex/gamma-surface: net dealer gamma (calls +, puts −,
 * dollars per 1% move) re-priced at every hypothetical price on `grid` and
 * every moment on `times_days`, from the snapshot to the settlement of the
 * first selected expiration. This module turns that payload into what the
 * plot draws: the time axis in Eastern wall-clock terms, the value labels, and
 * the reference traces (spot along the surface, the drop line under a wall).
 *
 * No React, no DOM, no Plotly, so the node test runner imports it directly.
 */

export interface GammaSurfaceResponse {
  symbol: string;
  spot: number;
  /** Snapshot instant (UTC ISO-8601) — the surface's first row. */
  timestamp: string;
  /** Expirations actually priced, ascending (YYYY-MM-DD). */
  expirations: string[];
  /** The expiration whose settlement ends the time axis. */
  settling_expiration: string;
  /** That settlement instant (UTC ISO-8601) — the surface's last row. */
  settles_at: string;
  /** Ascending hypothetical prices. */
  grid: number[];
  /** Ascending forward time from the snapshot, in days. */
  times_days: number[];
  /** profiles[i][j]: dealer dollar gamma per 1% move at times_days[i], grid[j]. */
  profiles: number[][];
  contract_count: number;
}

const HOUR_MS = 3_600_000;
const MINUTE_MS = 60_000;

/** "+$1.23B" / "−$456.7M" / "$0" — a signed dollar exposure, compact. */
export function formatGexDollars(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const abs = Math.abs(value);
  if (abs < 0.5) return '$0';
  const sign = value < 0 ? '−' : '+';
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

/** A price level, whole points on an index ("7,845"), cents below that ("512.50"). */
export function formatLevel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '--';
  const digits = Math.abs(value) >= 1000 ? 0 : 2;
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Forward time of every row, in hours from the snapshot. */
export function surfaceHours(timesDays: readonly number[]): number[] {
  return timesDays.map((d) => d * 24);
}

// ── Eastern wall clock ───────────────────────────────────────────────────────

const ET_PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  weekday: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hourCycle: 'h23',
});

interface EtParts {
  dateKey: string;
  weekday: string;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

// Labels read to the minute, so round to it: the row times arrive as fractions
// of a day, and a settlement a hair under 4:00 PM must still read "4 PM".
function toMinute(ms: number): number {
  return Math.round(ms / MINUTE_MS) * MINUTE_MS;
}

function etParts(ms: number): EtParts {
  const parts: Record<string, string> = {};
  for (const p of ET_PARTS.formatToParts(new Date(ms))) parts[p.type] = p.value;
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    dateKey: `${parts.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    weekday: parts.weekday,
    month,
    day,
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
  };
}

/** "11 AM" / "11:30 AM" / "4 PM" — Eastern clock time, no zone. `withMinutes`
 *  keeps ":00" on the hour, for a hover that reads to the minute. */
function clockLabel(p: EtParts, withMinutes = false): string {
  const suffix = p.hour < 12 ? 'AM' : 'PM';
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return p.minute === 0 && !withMinutes
    ? `${h12} ${suffix}`
    : `${h12}:${String(p.minute).padStart(2, '0')} ${suffix}`;
}

/** "Wed 1:35 PM ET" — the hover label for one row. */
export function surfaceTimeLabel(startIso: string, hours: number): string {
  const start = Date.parse(startIso);
  if (!Number.isFinite(start)) return '';
  const p = etParts(toMinute(start + hours * HOUR_MS));
  return `${p.weekday} ${clockLabel(p, true)} ET`;
}

// Tick spacing ladder, in minutes: the smallest that keeps the axis to
// `maxTicks` labels. Sub-day steps land on whole multiples of the step since
// Eastern midnight (so hours land on the hour); day steps land on midnight.
const STEP_MINUTES = [15, 30, 60, 120, 180, 360, 720, 1440, 2880, 10080];

export interface TimeTicks {
  /** Hours from the snapshot. */
  values: number[];
  labels: string[];
}

/**
 * The y-axis ticks for a surface running `spanHours` from `startIso`:
 * "Now" at the snapshot, round Eastern times between, and the settlement
 * instant at the far end. A round tick crowding either end is dropped.
 */
export function surfaceTimeTicks(startIso: string, spanHours: number, maxTicks = 6): TimeTicks {
  const start = Date.parse(startIso);
  if (!Number.isFinite(start) || !(spanHours > 0)) return { values: [0], labels: ['Now'] };
  const spanMinutes = spanHours * 60;
  const step =
    STEP_MINUTES.find((m) => spanMinutes / m <= Math.max(1, maxTicks - 1)) ??
    STEP_MINUTES[STEP_MINUTES.length - 1];

  const startParts = etParts(start);
  const minutesIntoDay = startParts.hour * 60 + startParts.minute + new Date(start).getUTCSeconds() / 60;
  // Day steps align to Eastern midnight; sub-day steps to multiples of the step.
  const align = step >= 1440 ? 1440 : step;
  let next = Math.ceil((minutesIntoDay + 1e-6) / align) * align - minutesIntoDay;
  const values: number[] = [0];
  const labels: string[] = ['Now'];
  const guard = step * 0.35;
  for (; next < spanMinutes - guard; next += step) {
    if (next < guard) continue;
    const p = etParts(start + next * MINUTE_MS);
    values.push(next / 60);
    labels.push(tickLabel(p, startParts, step));
  }
  const end = etParts(toMinute(start + spanMinutes * MINUTE_MS));
  values.push(spanHours);
  labels.push(tickLabel(end, startParts, step));
  return { values, labels };
}

function tickLabel(p: EtParts, startParts: EtParts, stepMinutes: number): string {
  if (stepMinutes >= 1440 && p.hour === 0 && p.minute === 0) return `${p.weekday} ${p.month}/${p.day}`;
  // A clock time on a later day names the day, so "9 AM" can't be misread as today.
  return p.dateKey === startParts.dateKey ? clockLabel(p) : `${p.weekday} ${clockLabel(p)}`;
}

// ── Reading the surface ──────────────────────────────────────────────────────

/** Linear interpolation of `row` (on ascending `grid`) at `x`; null off-grid. */
export function interpolateAt(grid: readonly number[], row: readonly number[], x: number): number | null {
  const n = Math.min(grid.length, row.length);
  if (n === 0 || !Number.isFinite(x) || x < grid[0] || x > grid[n - 1]) return null;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (grid[mid] <= x) lo = mid;
    else hi = mid;
  }
  const x0 = grid[lo];
  const x1 = grid[hi];
  if (x1 === x0) return row[lo];
  const t = (x - x0) / (x1 - x0);
  return row[lo] + (row[hi] - row[lo]) * t;
}

/** The surface along one price, row by row — the line traced over the mesh. */
export function traceAtPrice(
  grid: readonly number[],
  profiles: readonly (readonly number[])[],
  price: number | null | undefined,
): number[] | null {
  if (price == null) return null;
  const out: number[] = [];
  for (const row of profiles) {
    const v = interpolateAt(grid, row, price);
    if (v == null) return null;
    out.push(v);
  }
  return out.length > 0 ? out : null;
}

/**
 * Where a price column of the surface rises highest (`'max'`) or sinks
 * lowest (`'min'`), as a row index and value — the top of a drop line.
 */
export function extremeAtPrice(
  grid: readonly number[],
  profiles: readonly (readonly number[])[],
  price: number | null | undefined,
  kind: 'max' | 'min',
): { row: number; value: number } | null {
  const trace = traceAtPrice(grid, profiles, price);
  if (!trace) return null;
  let best = 0;
  for (let i = 1; i < trace.length; i++) {
    if (kind === 'max' ? trace[i] > trace[best] : trace[i] < trace[best]) best = i;
  }
  return { row: best, value: trace[best] };
}

/** Lowest and highest value across the whole surface. */
export function surfaceExtent(profiles: readonly (readonly number[])[]): { min: number; max: number } | null {
  let min = Infinity;
  let max = -Infinity;
  for (const row of profiles) {
    for (const v of row) {
      if (!Number.isFinite(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return Number.isFinite(min) && Number.isFinite(max) ? { min, max } : null;
}

/**
 * The z-axis range: the surface's extent with headroom, always including zero
 * so the base of the scene sits below every trough and the sign of a peak can
 * be read off the axis. The low end is the base the level lines lie on.
 */
export function zAxisRange(profiles: readonly (readonly number[])[], pad = 0.08): [number, number] {
  const extent = surfaceExtent(profiles);
  if (!extent) return [-1, 1];
  const lo = Math.min(0, extent.min);
  const hi = Math.max(0, extent.max);
  const span = hi - lo || Math.max(1, Math.abs(hi));
  return [lo - span * pad, hi + span * pad];
}

/**
 * The magnitude the color scale saturates at: the `q` quantile of |value|. A
 * same-day wall's spike into its settlement can run several times taller than
 * everything else, and scaling the colors to it would leave the rest of the
 * surface one flat hue; past this the colors simply saturate (the height and
 * the hover still carry the true value).
 */
export function colorLimit(profiles: readonly (readonly number[])[], q = 0.97): number {
  const mags: number[] = [];
  for (const row of profiles) for (const v of row) if (Number.isFinite(v)) mags.push(Math.abs(v));
  if (mags.length === 0) return 1;
  mags.sort((a, b) => a - b);
  const at = mags[Math.min(mags.length - 1, Math.max(0, Math.floor(mags.length * q)))];
  return at > 0 ? at : Math.max(1, mags[mags.length - 1]);
}

/**
 * Axis label for a tick: "+$25B" / "−$2.5B" / "+$500M" / "$0". The unit
 * follows the biggest tick and the decimals follow the step, so a column of
 * ticks reads as one scale with no trailing zeros.
 */
export function formatGexTick(value: number, ticks: readonly number[]): string {
  if (!Number.isFinite(value)) return '';
  if (value === 0) return '$0';
  const top = Math.max(...ticks.map((t) => Math.abs(t)), Math.abs(value));
  const [unit, suffix] = top >= 1e9 ? [1e9, 'B'] : top >= 1e6 ? [1e6, 'M'] : top >= 1e3 ? [1e3, 'K'] : [1, ''];
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) / unit : 1;
  const decimals = [0, 1, 2].find((d) => Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) < 1e-6) ?? 2;
  const sign = value < 0 ? '−' : '+';
  // Trailing zeros dropped per tick: "+$5B" beside "+$7.5B", not "+$5.0B".
  const fixed = (Math.abs(value) / unit).toFixed(decimals);
  const digits = fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
  return `${sign}$${digits}${suffix}`;
}

/** Round tick values (1 / 2 / 2.5 / 5 × 10^k), about `target` of them, inside [lo, hi]. */
export function niceTicks(lo: number, hi: number, target = 5): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo) return [];
  const raw = (hi - lo) / Math.max(1, target);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  // The nice step nearest the raw one, so the count lands near the target.
  const step =
    (norm < 1.5 ? 1 : norm < 2.25 ? 2 : norm < 3.5 ? 2.5 : norm < 7.5 ? 5 : 10) * magnitude;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

/**
 * Levels as a price ladder, highest first, the way they stack on a chart's
 * price axis. Unknown levels go last; ties keep the order they came in.
 */
export function levelLadder<T extends { value: number | null }>(levels: readonly T[]): T[] {
  return levels
    .map((level, i) => ({ level, i }))
    .sort((a, b) => {
      const av = a.level.value;
      const bv = b.level.value;
      if (av == null || bv == null) return av == null && bv == null ? a.i - b.i : av == null ? 1 : -1;
      return bv - av || a.i - b.i;
    })
    .map(({ level }) => level);
}

/** Multiply every value by the GEX unit's display factor. */
export function scaleProfiles(profiles: readonly (readonly number[])[], factor: number): number[][] {
  return profiles.map((row) => row.map((v) => v * factor));
}
