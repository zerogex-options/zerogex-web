// Unit tests for the dealer-gamma regime helpers. These encode the two
// sign-consistency guarantees behind the "Dealer Gamma @ Spot" badge and the
// shaded regime bands on GammaTerminalChart:
//   1. the badge is read from the spot-shift profile's value AT spot, never the
//      whole-chain total (which can carry the opposite sign);
//   2. the band the price sits in always agrees with the badge, even on a lumpy
//      / non-monotonic book where spot is on the far side of the reported flip.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  netGexAtSpotOrNull,
  aboveFlipBandIsLong,
  longGammaAtSpot,
  offScaleBandIsLong,
} from '../core/gammaRegime.ts';

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

test('longGammaAtSpot: prefers the at-spot sign when present', () => {
  // Sign comes from net_gex_at_spot regardless of where spot sits vs the flip.
  assert.equal(longGammaAtSpot(5.45e9, 5900, 6000), true); // long at spot, below flip
  assert.equal(longGammaAtSpot(-2.1e9, 6100, 6000), false); // short at spot, above flip
  assert.equal(longGammaAtSpot(0, 5900, 6000), true); // exactly flat reads long (>= 0)
});

test('longGammaAtSpot: degrades to geometric spot-vs-flip when the point value is absent', () => {
  assert.equal(longGammaAtSpot(null, 6100, 6000), true); // above flip
  assert.equal(longGammaAtSpot(null, 5900, 6000), false); // below flip
  assert.equal(longGammaAtSpot(null, 6000, 6000), true); // at the flip reads long (>=)
});

test('longGammaAtSpot: unknown (null) when neither the point value nor the flip is available', () => {
  assert.equal(longGammaAtSpot(null, 6000, null), null);
  assert.equal(longGammaAtSpot(null, null, null), null);
  // Never substitutes a chain total: the only inputs are the at-spot value and
  // the flip, so an opposite-signed total can't influence the result.
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

test('offScaleBandIsLong: a flip below the scale leaves the above-flip band on screen', () => {
  // Domain [5900, 6100], flip at 5000: every visible price is ABOVE the flip,
  // so the whole plot carries the above-flip band's regime.
  assert.equal(offScaleBandIsLong(5000, 5900, true), true);
  assert.equal(offScaleBandIsLong(5000, 5900, false), false);
});

test('offScaleBandIsLong: a flip above the scale leaves the below-flip band on screen', () => {
  // Domain [5900, 6100], flip at 6500: every visible price is BELOW the flip,
  // so the whole plot carries the OPPOSITE of the above-flip band's regime.
  assert.equal(offScaleBandIsLong(6500, 5900, true), false);
  assert.equal(offScaleBandIsLong(6500, 5900, false), true);
});

test('offScaleBandIsLong: agrees with the badge when spot is on screen with it', () => {
  // The usual case — the flip is off-scale but spot is still in view, so the
  // band that fills the plot is the band containing spot and must read the same
  // as the "Dealer Gamma @ Spot" badge.
  for (const [spot, flip, domainMin] of [
    [6050, 6500, 5900], // spot below an off-the-top flip
    [6050, 5000, 5900], // spot above an off-the-bottom flip
  ] as const) {
    for (const longGammaNow of [true, false]) {
      const aboveIsLong = aboveFlipBandIsLong(spot, flip, longGammaNow);
      assert.equal(
        offScaleBandIsLong(flip, domainMin, aboveIsLong),
        longGammaNow,
        `spot=${spot} flip=${flip}: off-scale tint must match the badge`,
      );
    }
  }
});

test('offScaleBandIsLong: reports the opposite regime when the view is panned off spot', () => {
  // Panned so the visible window sits on the far side of the flip from spot
  // (domain [6200, 6400], spot 5900, flip 6000). The tint describes the window
  // the trader is looking at, which is genuinely the other regime.
  const spot = 5900;
  const flip = 6000;
  const domainMin = 6200; // flip is BELOW the scale -> above-flip band fills it
  const longGammaNow = false; // short at spot, spot below the flip
  const aboveIsLong = aboveFlipBandIsLong(spot, flip, longGammaNow);
  assert.equal(aboveIsLong, true);
  assert.equal(offScaleBandIsLong(flip, domainMin, aboveIsLong), true);
});
