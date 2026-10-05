/**
 * One color per Gamma Weather state, used everywhere the state appears.
 *
 * The point is not decoration. The same five colors on every drawer mean
 * Pressure and Lean draw the same day-shape, so flipping between fields still
 * reads as one session rather than five unrelated charts.
 *
 * Color encodes the WEATHER STATE, never a field's own label and never buying
 * versus selling. Mixing those would put two different meanings on one channel
 * and the reader would have to remember which chart used which.
 *
 * The palette is validated, not picked by eye: four hues plus a neutral,
 * checked over ALL pairs (any two states can meet in time, and all five sit
 * together in the legend) under protanopia and deuteranopia, in both modes.
 * Worst pair 8.3 dE under CVD and 19.5 under normal vision, every hue at or
 * above 3:1 on its own surface and inside its mode's lightness band. Amber and
 * red are separated by lightness as well as hue because deuteranopia collapses
 * that pair. The hexes live in globals.css; re-run the palette validator before
 * changing any of them, and include the neutral in the pair list.
 *
 * Supported dip is violet rather than blue because Barrie could not separate it
 * from Stable bid's teal while scanning the row. He was right, and it was the
 * weakest pair in the set: blue against teal measured 16.8 dE under normal
 * vision in dark mode, barely over the 15 floor, and only 3.4 under tritanopia.
 * Violet takes that pair to 24.0 and 11.2. It also fixed one nobody had found:
 * blue against the Mixed slate was 13.7, BELOW the floor, which the original
 * validation missed by running the four hues without the neutral. Violet is
 * 15.5 there.
 *
 * The two steps are not the same hex on purpose. Barrie proposed #A78BFA, which
 * is right for dark but fails twice as written: 2.72:1 on white, and L 0.709
 * against a dark band of 0.48-0.67, so it would have read brighter than the
 * four states beside it. #9B7BF5 is the nearest step inside the band, and
 * #7C3AED is the light-mode counterpart, deep enough to hold 3:1 on white.
 */

export const WEATHER_STATE_COLOR: Record<string, string> = {
  STABLE_BID: 'var(--color-weather-stable-bid)',
  SUPPORTED_DIP: 'var(--color-weather-supported-dip)',
  FRAGILE_RALLY: 'var(--color-weather-fragile-rally)',
  UNSTABLE: 'var(--color-weather-unstable)',
  MIXED: 'var(--color-weather-mixed)',
};

/**
 * Legend order: settled to unstable, with the neutral last.
 *
 * Fixed, and the same on every chart. A legend that reordered itself by what
 * happened to appear that session would make two days incomparable at a
 * glance, which is the opposite of the point.
 */
export const WEATHER_STATE_LEGEND: { state: string; label: string }[] = [
  { state: 'STABLE_BID', label: 'Stable bid' },
  { state: 'SUPPORTED_DIP', label: 'Supported dip' },
  { state: 'FRAGILE_RALLY', label: 'Fragile rally' },
  { state: 'UNSTABLE', label: 'Unstable' },
  { state: 'MIXED', label: 'Mixed' },
];

export function weatherStateColor(state: string | null | undefined): string {
  if (!state) return WEATHER_STATE_COLOR.MIXED;
  return WEATHER_STATE_COLOR[state] ?? WEATHER_STATE_COLOR.MIXED;
}

export interface StateSegment {
  state: string;
  /** Index into the charted series where this run starts and ends, inclusive. */
  from: number;
  to: number;
}

/**
 * Split a run of per-bar states into the segments the line is colored by.
 *
 * A segment runs until the state changes, which is exactly "the line carries
 * that color until the next dot". Quiet stretches are not segments of their
 * own: they extend the run they sit inside, so the color holds and no new dot
 * appears, which is what keeps the chart from flickering on a slow afternoon.
 *
 * Bars with no state yet (a field charted before the weather series loads)
 * join the preceding run rather than starting a gray one, so the line does not
 * blink neutral while a poll is in flight.
 */
export function stateSegments(states: (string | null)[]): StateSegment[] {
  const out: StateSegment[] = [];
  for (let i = 0; i < states.length; i += 1) {
    const state = states[i];
    if (!state) {
      if (out.length) out[out.length - 1].to = i;
      continue;
    }
    const last = out[out.length - 1];
    if (last && last.state === state) {
      last.to = i;
    } else {
      out.push({ state, from: i, to: i });
    }
  }
  return out;
}

/**
 * Gradient stops that paint each segment its own flat color.
 *
 * Two stops at the same offset give a hard edge, so the color changes exactly
 * at the dot instead of blending across the bars either side of it. A blend
 * would smear the one moment the reader is looking for.
 *
 * Offsets are fractions of the x-axis, which is index-based here because the
 * series is one bar per point on a fixed grid.
 */
export function segmentStops(
  segments: StateSegment[],
  total: number,
): { offset: number; color: string }[] {
  if (total <= 1 || segments.length === 0) {
    return segments.length
      ? [
          { offset: 0, color: weatherStateColor(segments[0].state) },
          { offset: 1, color: weatherStateColor(segments[0].state) },
        ]
      : [];
  }
  const span = total - 1;
  const stops: { offset: number; color: string }[] = [];
  segments.forEach((segment, i) => {
    const color = weatherStateColor(segment.state);
    const next = segments[i + 1];
    // A segment ends where the NEXT one begins, not on its own last bar. Two
    // stops then share an offset and the gradient steps rather than ramps,
    // which is what puts the color change exactly at the dot. Ending on the
    // segment's own last bar leaves a bar's width of blend either side of the
    // boundary, and that blur sits precisely on the moment being looked for.
    stops.push({ offset: segment.from / span, color });
    stops.push({ offset: next ? next.from / span : 1, color });
  });
  return stops;
}
