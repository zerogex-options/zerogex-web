/**
 * Pure helper for the Premium Surface page's "% to Breakeven" mode.
 *
 * The Z axis toggles between extrinsic dollars (returned directly by the API)
 * and the % move from current spot the underlying must make for a contract to
 * break even at expiry. The math here computes only the second one; extrinsic
 * dollars pass through untouched at the call site.
 *
 * Breakeven price at expiry is where the contract's intrinsic value at
 * settlement equals the premium paid: strike + premium for a call, strike −
 * premium for a put. The required spot move is:
 *
 *   call: breakeven − spot = strike + premium − spot
 *   put : spot − breakeven = spot − strike + premium
 *
 * For ITM strikes those expressions collapse to `premium − intrinsic` (i.e.
 * extrinsic), so a client that only scales extrinsic by spot would give the
 * right answer for the ITM half of the surface but understate the OTM half by
 * exactly |strike − spot| — which is where most of the surface lives. That's
 * why the formula uses `premium` directly (not the pre-computed extrinsic).
 *
 * Clamped at 0 to mirror the API's negative-extrinsic clamp: a crossed or
 * stale quote can imply breakeven < spot for a call (i.e. instant profit),
 * which is a data artefact rather than a real trading opportunity.
 */
export function moveToBreakevenPct(
  strike: number,
  premium: number | null | undefined,
  spot: number,
  optionType: 'C' | 'P',
): number | null {
  if (premium == null || spot <= 0) return null;
  const moveDollars = optionType === 'C'
    ? strike + premium - spot
    : spot - strike + premium;
  return (Math.max(0, moveDollars) / spot) * 100;
}
