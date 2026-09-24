/**
 * Keeping a Gamma Chart view where the reader put it.
 *
 * The chart fits itself to the tape until the reader first zooms or pans, and
 * from then on it holds still: the price axis stops re-fitting (see
 * `pinnedAxis` in components/GammaTerminalChart), and a view panned back in
 * time stays on the bars it is showing. This module is the time half of that.
 *
 * The chart counts its view window from the RIGHT: `offset` is how many bars
 * are hidden past the view's right edge, 0 being the live edge. That is what
 * lets the live view follow new bars for free, and it is also why a panned-back
 * view used to creep: every bar that printed pushed the same offset one bar
 * further along, sliding the whole window left under the reader. The fix is to
 * widen the offset by however many bars printed, which is what this counts.
 *
 * Pure (no React) so the rule can be pinned by tests rather than by waiting
 * for a bar to print.
 */

/**
 * How many bars have printed since the bar that was newest: the number of bars
 * now after the one stamped `lastNewest`. Zero when there was no newest bar
 * yet, or when that bar is no longer in the series, which means a different
 * series has replaced it and there is no window to keep in place.
 *
 * Bars dropped off the FRONT of the pool as it rolls do not count: the offset
 * is measured from the right, so only what printed on the right moves it.
 */
export function barsPrintedSince(
  bars: ReadonlyArray<{ timestamp: string }>,
  lastNewest: string | null,
): number {
  if (lastNewest == null) return 0;
  for (let i = bars.length - 1; i >= 0; i--) {
    if (bars[i].timestamp === lastNewest) return bars.length - 1 - i;
  }
  return 0;
}
