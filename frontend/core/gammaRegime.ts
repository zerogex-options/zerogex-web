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
 * The modeled long-gamma regime at spot, as a sign — the shared resolver behind
 * every LONG/SHORT badge, trend color, and posture line on the site.
 *
 * Returns `true` (modeled long gamma), `false` (short), or `null` when the
 * regime is genuinely unknown. It prefers the sign of `netGexAtSpot` (the
 * spot-shift profile's value at spot); when that is absent it degrades to the
 * geometric spot-vs-flip read — the same fallback GammaTerminalChart's
 * `longGammaNow` uses — so a surface never contradicts the flip it draws. It
 * NEVER derives the sign from the whole-chain total: callers pass only
 * `netGexAtSpot` (see {@link netGexAtSpotOrNull}), so an opposite-signed chain
 * total can't leak in. Map `null` to a neutral / unknown presentation rather
 * than a default direction.
 *
 * @param netGexAtSpot sign-consistent dealer gamma at spot, or null
 * @param spot current underlying price, or null
 * @param flip gamma-flip level, or null
 */
export function longGammaAtSpot(
  netGexAtSpot: number | null,
  spot: number | null,
  flip: number | null,
): boolean | null {
  if (netGexAtSpot != null) return netGexAtSpot >= 0;
  if (flip != null && spot != null) return spot >= flip;
  return null;
}

/**
 * The at-spot dealer gamma a surface may read, given the scope of the levels it
 * is currently drawing. The canonical rule — every surface that can draw a
 * non-whole-chain flip goes through this.
 *
 * `net_gex_at_spot` is served for the WHOLE chain, read off the spot-shift
 * profile that also produces the canonical flip. The two are sign-consistent BY
 * CONSTRUCTION (the engine's `_resolve_gamma_flip` returns both off the same
 * curve), and that guarantee is what lets the badge, the flip line and the
 * shaded bands tell one story.
 *
 * The guarantee holds only while the flip on screen IS that whole-chain flip.
 * Two paths replace it with a differently-scoped level:
 *
 *   * an expiration filter — flip and walls are recomputed from the selected
 *     expirations alone (the strike-profile timeseries' cumulative-net-GEX
 *     crossing, since the spot-shift profile can't be rebuilt for a subset), so
 *     they describe a strictly smaller book;
 *   * rewind — flip and walls come from a historical bucket, describing an
 *     earlier moment.
 *
 * Pairing either with the live whole-chain at-spot value puts two different
 * books on the same chart: the badge can read SHORT while price sits above the
 * flip drawn beside it. Because the shaded bands take their orientation from
 * the badge (see {@link aboveFlipBandIsLong}), that contradiction does not stay
 * in the badge — the regime zones paint INVERTED, short above the flip and long
 * below, which is the one reading the chart must never show.
 *
 * Scoped levels therefore get `null`, which sends {@link longGammaAtSpot} to
 * its geometric spot-vs-DRAWN-flip fallback: no dollar figure, but a badge and
 * bands that agree with the level on screen.
 *
 * @param netGexAtSpot whole-chain at-spot dealer gamma, or null
 * @param scopedLevels true when the flip/walls on screen are not the whole-chain live ones
 */
export function atSpotGammaForScope(
  netGexAtSpot: number | null,
  scopedLevels: boolean,
): number | null {
  if (scopedLevels) return null;
  return typeof netGexAtSpot === "number" && Number.isFinite(netGexAtSpot)
    ? netGexAtSpot
    : null;
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

/**
 * Regime of the single band on screen when the flip is OFF the visible price
 * scale.
 *
 * The chart's price domain is fitted to the bars and can then be zoomed and
 * panned, so the flip regularly sits outside it. When it does, the whole
 * visible window lies on ONE side of the flip and is therefore entirely in one
 * regime — the shading must still be painted (previously it disappeared exactly
 * when the regime was most one-sided) and it must be the correct side:
 *
 *   flip below the bottom of the scale → every visible price is ABOVE it
 *                                        → the above-flip band fills the plot
 *   flip above the top of the scale    → every visible price is BELOW it
 *                                        → the below-flip band fills the plot
 *
 * Orientation comes from the same {@link aboveFlipBandIsLong} value that drives
 * the in-view split, so the off-scale tint and its label stay consistent with
 * the "Dealer Gamma @ Spot" badge. Note this is a statement about the visible
 * window, not about spot: when the view is panned to the far side of the flip
 * from spot, the tint correctly reports the opposite regime to the badge.
 *
 * Callers invoke this only when the flip is outside [domainMin, domainMax];
 * `domainMax` is not needed because "not below the bottom" then means "above
 * the top".
 *
 * @param flip gamma-flip level, known to be outside the visible domain
 * @param domainMin low edge of the visible price domain
 * @param aboveBandIsLong orientation from {@link aboveFlipBandIsLong}
 */
export function offScaleBandIsLong(
  flip: number,
  domainMin: number,
  aboveBandIsLong: boolean,
): boolean {
  return flip < domainMin ? aboveBandIsLong : !aboveBandIsLong;
}
