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
  atSpotGammaForScope,
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
  // An empty column is absent data, not a zero reading. Number('') === 0 would
  // have the badge assert LONG (>= 0) off a blank; null degrades it to the
  // geometric spot-vs-flip read instead, which is what the doc promises.
  assert.equal(netGexAtSpotOrNull(''), null);
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

test('atSpotGammaForScope: whole-chain levels keep the at-spot value', () => {
  // Nothing is scoped: the flip on screen is the live whole-chain spot-shift
  // flip, so it and net_gex_at_spot came off the same curve and pair correctly.
  assert.equal(atSpotGammaForScope(5.45e9, false), 5.45e9);
  assert.equal(atSpotGammaForScope(-2.1e9, false), -2.1e9);
  assert.equal(atSpotGammaForScope(0, false), 0);
});

test('atSpotGammaForScope: scoped levels withhold it', () => {
  // An expiration filter or a rewound bucket puts a differently-scoped flip on
  // screen; the whole-chain at-spot value no longer describes the same book.
  assert.equal(atSpotGammaForScope(5.45e9, true), null);
  assert.equal(atSpotGammaForScope(-2.1e9, true), null);
  assert.equal(atSpotGammaForScope(0, true), null);
});

test('atSpotGammaForScope: a missing or non-finite value is null either way', () => {
  assert.equal(atSpotGammaForScope(null, false), null);
  assert.equal(atSpotGammaForScope(NaN, false), null);
  assert.equal(atSpotGammaForScope(Infinity, false), null);
  assert.equal(atSpotGammaForScope(null, true), null);
});

test('regression: an expiration-filtered flip must not invert the regime bands', () => {
  // The reported case, with its real numbers. SPY at 754.12 with the Expiry
  // selector on a single 0DTE expiration: the flip line is that subset's
  // 744.00, while net_gex_at_spot is still the WHOLE chain's -$10.26B.
  const spot = 754.12;
  const filteredFlip = 744.0;
  const wholeChainAtSpot = -10.26e9;

  // Before the fix: the chain-wide negative sign drove the badge, and because
  // the bands take their orientation from the badge the whole plot inverted —
  // SHORT above the flip, LONG below, with price sitting above the flip.
  const unscoped = longGammaAtSpot(wholeChainAtSpot, spot, filteredFlip);
  assert.equal(unscoped, false);
  assert.equal(aboveFlipBandIsLong(spot, filteredFlip, unscoped!), false);

  // After the fix: the value is withheld because the flip is a subset's, so the
  // badge reads the FILTERED book geometrically and the bands come back the
  // right way up — long/pinning above the flip, short/trending below.
  const scoped = atSpotGammaForScope(wholeChainAtSpot, true);
  assert.equal(scoped, null);
  const longNow = longGammaAtSpot(scoped, spot, filteredFlip);
  assert.equal(longNow, true);
  assert.equal(aboveFlipBandIsLong(spot, filteredFlip, longNow!), true);
});

test('regression: a whole-chain book may still disagree with its own flip', () => {
  // The guarantee is NOT "always long above the flip" — on a lumpy book the
  // canonical resolver can report a nearest crossing that spot sits the wrong
  // side of, and the badge is still authoritative there because both readings
  // come off the SAME spot-shift curve. Unfiltered, unrewound → keep the value
  // and let the bands follow it.
  const kept = atSpotGammaForScope(-10.26e9, false);
  assert.equal(kept, -10.26e9);
  const longNow = longGammaAtSpot(kept, 754.12, 744.0);
  assert.equal(longNow, false);
  assert.equal(aboveFlipBandIsLong(754.12, 744.0, longNow!), false);
});
