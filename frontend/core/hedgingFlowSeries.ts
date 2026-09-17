// Wire-shape normalisation for the two Hedging Flow series.
//
// The endpoints answer newest-first, matching every other series endpoint.
// Every consumer is a chart, and charts read left to right — so somebody has
// to reverse them, and somebody has to canonicalise the timestamps so a flow
// bar and a structure bar for the same five minutes key identically.
//
// That somebody used to be the hooks, which was fine while the only way to
// reach these series was a browser poll. The dated permalinks fetch them on
// the server instead, and a second copy of this reshaping would be a silent
// way for the live page and the historical one to disagree about which bar is
// which. Pure and React-free, like core/flowSeriesCharts.ts, so both sides of
// the RSC boundary can call it.

// Relative, with the extension, like every other sibling import in core/:
// the node --experimental-strip-types loader the test suite runs under does
// not resolve the `@/` alias, and a module the tests cannot import is a module
// the tests cannot check. The type imports below are erased, so they may keep
// the alias.
import { canonicalTimestamp } from './flowSeriesCharts.ts';
import type { HedgingFlowPayload } from '@/hooks/useHedgingFlow';
import type { GammaRegimeSeriesPayload } from '@/hooks/useGammaRegimeSeries';

/** Oldest-first bars with canonical timestamps, or null for a null payload. */
export function normalizeHedgingFlow(
  data: HedgingFlowPayload | null | undefined,
): HedgingFlowPayload | null {
  if (!data) return null;
  return {
    ...data,
    bars: [...(data.bars ?? [])]
      .map((bar) => ({ ...bar, timestamp: canonicalTimestamp(bar.timestamp) }))
      .reverse(),
    // Flips are not reversed: they are events keyed by bar, not a series, and
    // `latestRateFlip` reads the LAST one — which the wire already orders
    // oldest-first within its own array.
    flips: (data.flips ?? []).map((flip) => ({
      ...flip,
      bar_start: canonicalTimestamp(flip.bar_start),
    })),
  } satisfies HedgingFlowPayload;
}

/** The structure series, reshaped to share the flow series' axis exactly. */
export function normalizeGammaRegime(
  data: GammaRegimeSeriesPayload | null | undefined,
): GammaRegimeSeriesPayload | null {
  if (!data) return null;
  return {
    ...data,
    bars: [...(data.bars ?? [])]
      .map((bar) => ({ ...bar, timestamp: canonicalTimestamp(bar.timestamp) }))
      .reverse(),
  } satisfies GammaRegimeSeriesPayload;
}
