/**
 * The Light history: when each scan light was on, for how long, and how often
 * it switched.
 *
 * The strip above answers "is it on now". Barrie's question is the pattern
 * behind that: when a light came on, whether it held, and whether it has been
 * flicking on and off, which can mean something is building in one direction.
 * A light that has been on for forty minutes and one that came on a bar ago
 * look identical on the strip.
 *
 * Nothing here decides a light. Every bar's four booleans come from the API,
 * by the same rule the strip's own lights do (src/analytics/scan_lights.py),
 * so the newest bar here and the strip above it cannot disagree. This module
 * only turns those booleans into runs.
 *
 * No runtime imports, so the Node test runner can load it directly.
 */

export type LightKey = 'agree' | 'heads_up' | 'fragile' | 'stand_down';

export const LIGHT_ROWS: { key: LightKey; label: string }[] = [
  { key: 'agree', label: 'Agree' },
  { key: 'heads_up', label: 'Heads-up' },
  { key: 'fragile', label: 'Fragile' },
  { key: 'stand_down', label: 'Stand down' },
];

/** The Weather series is a 5-minute grid. */
export const BAR_MINUTES = 5;
const BAR_MS = BAR_MINUTES * 60_000;

/**
 * How recent the newest bar must be for the session to count as live. Past
 * this, the page is showing a finished session (the evening, a weekend, a
 * dated permalink) and "Now" would stretch the axis and every open light out
 * to a time nothing was measured.
 */
export const LIVE_WITHIN_MS = 15 * 60_000;

export interface LightBar {
  bar_start: string;
  lights?: Partial<Record<LightKey, boolean>> | null;
}

export interface LightRun {
  /** Epoch ms. The run's first bar opening. */
  start: number;
  /** Epoch ms. The last bar's close, or now while the run is still on. */
  end: number;
  /** Still on at the newest bar of a live session, so it runs to now. */
  active: boolean;
}

export interface LightTimeline {
  /** Epoch ms at the left edge: the first bar of the session. */
  from: number;
  /** Epoch ms at the right edge: now while live, else the last bar's close. */
  to: number;
  live: boolean;
  runs: Record<LightKey, LightRun[]>;
}

/**
 * Turn a session of bars into one row of ON runs per light.
 *
 * A run is consecutive bars with the light on. It breaks at an OFF bar, at a
 * bar the API sent without lights, and at a hole in the grid: a gap is
 * something nobody measured, and bridging it would draw a light as on through
 * minutes it was never checked.
 *
 * `now` is passed in rather than read, so a test can pin it. `allowLive` is
 * false on a dated page, which is always a finished session.
 */
export function lightTimeline(
  bars: LightBar[],
  now: number,
  allowLive = true,
): LightTimeline | null {
  const parsed = bars
    .map((bar) => ({ t: Date.parse(bar.bar_start), lights: bar.lights ?? null }))
    .filter((bar) => Number.isFinite(bar.t));
  if (parsed.length === 0) return null;

  const first = parsed[0].t;
  const last = parsed[parsed.length - 1].t;
  const live = allowLive && now - last <= LIVE_WITHIN_MS && now >= last;
  const to = live ? Math.max(now, last) : last + BAR_MS;

  const runs = {} as Record<LightKey, LightRun[]>;
  for (const { key } of LIGHT_ROWS) {
    const out: LightRun[] = [];
    let open: { start: number; lastBar: number } | null = null;
    const close = () => {
      if (open) out.push({ start: open.start, end: open.lastBar + BAR_MS, active: false });
      open = null;
    };
    for (let i = 0; i < parsed.length; i += 1) {
      const bar = parsed[i];
      const on = bar.lights?.[key] === true;
      const contiguous = open !== null && bar.t - open.lastBar === BAR_MS;
      if (!on) {
        close();
        continue;
      }
      if (open && contiguous) {
        open.lastBar = bar.t;
      } else {
        close();
        open = { start: bar.t, lastBar: bar.t };
      }
    }
    if (open) {
      // Still on at the newest bar. Live, it runs to now and is still going;
      // on a finished session it simply ended with the last bar.
      const { start, lastBar } = open;
      out.push(
        live
          ? { start, end: Math.max(now, start), active: true }
          : { start, end: lastBar + BAR_MS, active: false },
      );
    }
    runs[key] = out;
  }

  return { from: first, to, live, runs };
}

/** True when no bar carries lights at all, so there is nothing to draw. */
export function hasLightData(bars: LightBar[]): boolean {
  return bars.some((bar) => bar.lights != null);
}

/** "35m", "1h 05m". Rounded to the minute, never negative. */
export function formatDuration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/** Where `t` falls across the axis, 0..1. */
export function axisFraction(t: number, from: number, to: number): number {
  if (to <= from) return 0;
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

/**
 * Whole-hour ticks strictly inside the axis, as epoch ms. Hours are the same
 * instants in ET and UTC (ET is a whole-hour offset), so stepping through UTC
 * hours lands on 10:00, 11:00 ... ET.
 */
export function hourTicks(from: number, to: number): number[] {
  const HOUR = 3_600_000;
  const out: number[] = [];
  for (let t = Math.ceil(from / HOUR) * HOUR; t < to; t += HOUR) {
    if (t > from) out.push(t);
  }
  return out;
}
