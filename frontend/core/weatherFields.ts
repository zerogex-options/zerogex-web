/**
 * Binding a Gamma Weather header field to the session story behind it.
 *
 * The header answers "what is it now". Someone who looked away for two hours
 * is asking what happened while they were gone, and a word on a chip cannot
 * say: it captures one slice of time when the question is about a pattern.
 *
 * None of this fetches anything new. The numbers are already on the page for
 * the two charts below the header, and the comment trail comes from
 * /api/gex/weather-series. Binding what is already loaded is the whole idea:
 * a second source for the same field could disagree with the chart under it.
 */

import type { HedgingFlowPayload } from '@/hooks/useHedgingFlow';
import type { GammaRegimeSeriesPayload } from '@/hooks/useGammaRegimeSeries';
import type { GammaWeatherChange, GammaWeatherSeriesBar } from '@/hooks/useGammaWeatherSeries';

export type WeatherFieldKey = 'pressure' | 'lean' | 'stability' | 'gamma_trend' | 'cushion';

export interface WeatherFieldPoint {
  bar_start: string;
  value: number | null;
}

export interface WeatherFieldSpec {
  key: WeatherFieldKey;
  /** Matches the header chip, so the open drawer is obviously that chip's. */
  label: string;
  /** One line under the title saying what the axis means. */
  caption: string;
  unit: 'usd' | 'points';
  /** Whether crossing zero is itself the story. */
  zeroLine: boolean;
}

export const WEATHER_FIELDS: WeatherFieldSpec[] = [
  {
    key: 'pressure',
    label: 'Pressure now',
    caption: 'Estimated hedging pressure per bar. Above zero the hedge buys stock.',
    unit: 'usd',
    zeroLine: true,
  },
  {
    key: 'lean',
    label: 'Lean',
    caption: 'Which side the book leans. Above zero is supportive, below is capping.',
    unit: 'usd',
    zeroLine: true,
  },
  {
    key: 'stability',
    label: 'Stability',
    caption: 'Gamma near price. Above zero is pinning, below is accelerative.',
    unit: 'usd',
    zeroLine: true,
  },
  {
    key: 'gamma_trend',
    label: 'Gamma trend',
    caption: 'The same reading since the open, so it says where the session has migrated.',
    unit: 'usd',
    zeroLine: true,
  },
  {
    key: 'cushion',
    label: 'Flip cushion',
    caption: 'Points between spot and the gamma flip. Zero is the boundary itself.',
    unit: 'points',
    zeroLine: false,
  },
];

export function fieldSpec(key: WeatherFieldKey): WeatherFieldSpec {
  const found = WEATHER_FIELDS.find((f) => f.key === key);
  if (!found) throw new Error(`unknown weather field: ${key}`);
  return found;
}

/**
 * The numeric series behind one field, oldest first.
 *
 * Pressure comes off the flow series and the rest off the structure series,
 * which is exactly the split the two charts below the header already use.
 *
 * Both payloads arrive here ALREADY chronological: useHedgingFlow and
 * useGammaRegimeSeries reverse the API's newest-first rows once, so every
 * consumer shares one order. Reversing again here drew the session right to
 * left, which a unit test written on the same wrong assumption happily
 * confirmed; only opening the page showed it.
 *
 * Returns an empty array rather than throwing when a payload has not loaded,
 * because the drawer can open before a poll returns.
 */
export function fieldSeries(
  key: WeatherFieldKey,
  flow: HedgingFlowPayload | null | undefined,
  regime: GammaRegimeSeriesPayload | null | undefined,
): WeatherFieldPoint[] {
  if (key === 'pressure') {
    const bars = flow?.bars ?? [];
    return bars.map((b) => ({ bar_start: b.bar_start, value: b.net_flow_usd ?? null }));
  }

  const bars = regime?.bars ?? [];
  const pick = (bar: (typeof bars)[number]): number | null => {
    if (key === 'lean') return bar.rolling_lean;
    if (key === 'stability') return bar.rolling_stability;
    if (key === 'gamma_trend') return bar.anchored_stability;
    return bar.cushion_pts ?? null;
  };
  return bars.map((b) => ({ bar_start: b.bar_start, value: pick(b) }));
}

/**
 * The comment lines that belong on one field's chart.
 *
 * A field's own changes plus every Weather state change. The state is the
 * headline the whole panel is about, so it belongs on every chart; the rest
 * would be another field's story on the wrong axis.
 */
export function changesForField(
  changes: GammaWeatherChange[],
  key: WeatherFieldKey,
): GammaWeatherChange[] {
  return changes.filter((c) => c.field === key || c.field === 'state');
}

function atOrBefore<T extends { bar_start: string }>(rows: T[], time: string): T | null {
  let found: T | null = null;
  for (const row of rows) {
    if (row.bar_start > time) break;
    found = row;
  }
  return found;
}

export interface WeatherComment {
  /** The panel sentence in force at that time, forming chip included. */
  sentence: string | null;
  /** The most recent line for the open field, and when it printed. */
  line: string | null;
  lineAt: string | null;
  /** True when the line printed on the hovered bar rather than earlier. */
  fresh: boolean;
}

/**
 * What to show as the cursor passes a time.
 *
 * "The comment that was printed at that time" means the most recent one at or
 * before it, not one that only exists on that exact bar. A trail that went
 * blank between changes would be unreadable precisely on the quiet stretches
 * it exists to compress, and would tempt a reader into thinking nothing was
 * in force.
 *
 * Both lists must be oldest-first.
 */
export function commentAt(
  bars: GammaWeatherSeriesBar[],
  changes: GammaWeatherChange[],
  key: WeatherFieldKey,
  time: string | null,
): WeatherComment {
  const empty: WeatherComment = { sentence: null, line: null, lineAt: null, fresh: false };
  if (!time) return empty;

  const bar = atOrBefore(bars, time);
  const own = changesForField(changes, key).filter((c) => c.field === key);
  const line = atOrBefore(own, time);

  return {
    sentence: bar?.sentence ?? null,
    line: line?.text ?? null,
    lineAt: line?.bar_start ?? null,
    fresh: line != null && line.bar_start === time,
  };
}
