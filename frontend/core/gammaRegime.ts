/**
 * Dealer-gamma regime helpers shared by the price chart and the public
 * snapshot builder.
 *
 * Two small pieces of logic live here because both feed the "Dealer Gamma @
 * Spot" LONG/SHORT badge and the shaded regime bands, and both have to stay
 * *sign-consistent*: the badge, the flip line, and the band the price sits in
 * must never tell three different stories.
 */

/**
 * Sign-consistent dealer gamma at spot for the regime badge.
 *
 * Returns the spot-shift profile's `net_gex_at_spot` coerced to a finite
 * number, or `null` when it is absent. Callers pass ONLY the point value —
 * never the whole-chain total (`total_net_gex`, exposed as the summary's
 * `net_gex`). The chain total sums gamma across every strike and can carry the
 * *opposite* sign to the value at spot when far-OTM strikes dominate the tail;
 * substituting it lets the badge read LONG while price sits below the flip (and
 * vice versa), which is exactly the contradiction this codebase is built to
 * avoid. When the point value is missing the badge degrades to the geometric
 * spot-vs-flip read (see `longGammaNow` in GammaTerminalChart) rather than an
 * opposite-signed chain total.
 */
export function netGexAtSpotOrNull(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : (value as number);
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

/**
 * Orientation of the chart's shaded regime bands.
 *
 * Returns whether the band ABOVE the flip represents the long-gamma
 * ("pinning") regime. The band that CONTAINS the current spot always takes the
 * badge's sign (`longGammaNow`); the far side of the flip takes the opposite.
 *
 * On a monotonic dealer-gamma book this is identical to the classic geometry
 * ("long gamma above the flip, short gamma below"). On a lumpy / non-monotonic
 * book — common in 0DTE, where the true sign at spot can disagree with the
 * nearest-crossing flip the resolver reports — this keeps the band under spot
 * consistent with the "Dealer Gamma @ Spot" badge instead of painting price
 * into the opposite-regime zone. It is a two-region approximation (a lumpy book
 * can cross zero more than once), but it is guaranteed correct at spot, which
 * is the reading a trader acts on.
 *
 * @param spot current underlying price
 * @param flip gamma-flip level, or null when unresolved (whole view is one regime)
 * @param longGammaNow the badge's sign at spot (true = modeled long gamma)
 */
export function aboveFlipBandIsLong(
  spot: number,
  flip: number | null,
  longGammaNow: boolean,
): boolean {
  if (flip == null) return longGammaNow;
  // spot >= flip  → spot is in the above-flip band → that band is the badge's
  // regime. spot < flip → spot is in the below-flip band → the above-flip band
  // is the opposite of the badge.
  return spot >= flip ? longGammaNow : !longGammaNow;
}
