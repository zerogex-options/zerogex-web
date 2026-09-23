// The 95% Wilson score interval, on its own so more than one report can say
// how uncertain its rate is.
//
// PURE. No DB, no network, no `server-only`, no '@/' alias — it is imported by
// client components, by server components and by tests under node's
// --experimental-strip-types loader.
//
// Lifted out of core/paymentDeclines.ts, which still re-exports it so every
// existing call site is untouched. The move is about weight, not tidiness:
// core/trackRecord.ts needs an interval and is headed for client components on
// the public marketing pages, and importing 1400 lines of billing analytics to
// reach a ten-line statistical primitive would ship all of it to anyone who
// loads a gamma-levels page.

/**
 * 95% Wilson score interval for a proportion.
 *
 * Wilson rather than the normal approximation because it stays inside [0, 1]
 * and does not collapse to a zero-width interval at 0 or 100% — which is
 * exactly where small samples sit, and exactly where a point estimate is most
 * misleading. A record of 29 for 29 is not "100%, no uncertainty"; it is
 * 100% observed with a true rate that could plausibly be 88%.
 */
export function wilsonInterval(successes: number, trials: number): { low: number; high: number } | null {
  if (!Number.isFinite(successes) || !Number.isFinite(trials) || trials <= 0) return null;
  const z = 1.959964;
  const p = successes / trials;
  const z2 = z * z;
  const denominator = 1 + z2 / trials;
  const center = (p + z2 / (2 * trials)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denominator;
  return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
}
