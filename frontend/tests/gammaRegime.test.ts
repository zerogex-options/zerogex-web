// Unit tests for the dealer-gamma regime helpers. These encode the two
// sign-consistency guarantees behind the "Dealer Gamma @ Spot" badge and the
// shaded regime bands on GammaTerminalChart:
//   1. the badge is read from the spot-shift profile's value AT spot, never the
//      whole-chain total (which can carry the opposite sign);
//   2. the band the price sits in always agrees with the badge, even on a lumpy
//      / non-monotonic book where spot is on the far side of the reported flip.
import test from 'node:test';
import assert from 'node:assert/strict';

import { netGexAtSpotOrNull, aboveFlipBandIsLong } from '../core/gammaRegime.ts';

test('netGexAtSpotOrNull keeps a finite point value (both signs)', () => {
  assert.equal(netGexAtSpotOrNull(5.45e9), 5.45e9);
  assert.equal(netGexAtSpotOrNull(-2.1e9), -2.1e9);
  assert.equal(netGexAtSpotOrNull(0), 0);
  // Numeric strings (Decimal serialized by the API) coerce.
  assert.equal(netGexAtSpotOrNull('5.45e9'), 5.45e9);
  assert.equal(netGexAtSpotOrNull('-2.1e9'), -2.1e9);
});

test('netGexAtSpotOrNull returns null when the point value is absent', () => {
  // The whole-chain total must NOT be substituted here — the caller passes only
  // net_gex_at_spot, so an absent value is honestly null (badge falls back to
  // the geometric spot-vs-flip read), never an opposite-signed chain total.
  assert.equal(netGexAtSpotOrNull(null), null);
  assert.equal(netGexAtSpotOrNull(undefined), null);
  assert.equal(netGexAtSpotOrNull(NaN), null);
  assert.equal(netGexAtSpotOrNull('not-a-number'), null);
  assert.equal(netGexAtSpotOrNull(Infinity), null);
});

test('aboveFlipBandIsLong: monotonic book reduces to "long above / short below"', () => {
  // Spot above the flip and long at spot → above band is the long/pinning zone.
  assert.equal(aboveFlipBandIsLong(6100, 6000, true), true);
  // Spot below the flip and short at spot → above band still the long zone
  // (i.e. the band under spot is short), matching the classic geometry.
  assert.equal(aboveFlipBandIsLong(5900, 6000, false), true);
});

test('aboveFlipBandIsLong: inverted book keeps the band under spot on the badge', () => {
  // Michele's case: price materially below the reported flip, yet dealer gamma
  // at spot reads LONG. The above-flip band must become the SHORT zone so that
  // the band CONTAINING spot (below the flip) is painted long — matching the
  // badge instead of contradicting it.
  assert.equal(aboveFlipBandIsLong(5900, 6000, true), false);
  // Mirror: spot above the flip but short at spot → above band is short.
  assert.equal(aboveFlipBandIsLong(6100, 6000, false), false);
});

test('aboveFlipBandIsLong: unresolved flip → whole view is the badge regime', () => {
  assert.equal(aboveFlipBandIsLong(6000, null, true), true);
  assert.equal(aboveFlipBandIsLong(6000, null, false), false);
});

test('invariant: the band containing spot always equals the badge (longGammaNow)', () => {
  // Whatever spot/flip/badge combination arises, the region the trader is
  // standing in must never disagree with the "Dealer Gamma @ Spot" badge.
  const flip = 6000;
  for (const spot of [5800, 5999.99, 6000, 6000.01, 6200]) {
    for (const longGammaNow of [true, false]) {
      const aboveIsLong = aboveFlipBandIsLong(spot, flip, longGammaNow);
      const spotInAboveBand = spot >= flip;
      const bandContainingSpotIsLong = spotInAboveBand ? aboveIsLong : !aboveIsLong;
      assert.equal(
        bandContainingSpotIsLong,
        longGammaNow,
        `spot=${spot} flip=${flip} longGammaNow=${longGammaNow}: band under spot must match the badge`,
      );
    }
  }
});
