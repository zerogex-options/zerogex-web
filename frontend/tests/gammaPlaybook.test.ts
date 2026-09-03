// Unit tests for the Gamma Chart Playbook's scenario resolver — the logic that
// picks WHICH of the four "Where do we expect the underlying to go?" cells is
// the live read for the selected symbol and expirations.
//
// The guarantees encoded here:
//   1. the regime axis agrees with the chart's LONG/SHORT badge (it is resolved
//      by the same core/gammaRegime helper), and degrades to the geometric
//      spot-vs-flip read when the at-spot chain value doesn't describe the book
//      on screen (i.e. when the levels are expiration-filtered);
//   2. the approach axis is the wall price actually walks into next — proximity
//      first, the session drift only as a tiebreak between equidistant walls;
//   3. a degraded book resolves to null rather than a confident wrong cell.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  atSpotGammaForPlaybook,
  describePlaybookScenario,
  expirationScopeLabel,
  resolvePlaybookScenario,
} from '../core/gammaPlaybook.ts';
import { longGammaAtSpot } from '../core/gammaRegime.ts';

const BASE = {
  spot: 600,
  callWall: 610,
  putWall: 580,
  longGamma: true as boolean | null,
  netGexAtSpot: null as number | null,
};

// How the hook composes the two modules: the expiration filter decides whether
// the whole-chain at-spot value may be read, then core/gammaRegime resolves the
// sign (falling back to spot-vs-flip). Mirrored here so the tests exercise the
// real pipeline rather than hand-picked flags.
function levelsFor(input: {
  spot: number | null;
  flip: number | null;
  callWall: number | null;
  putWall: number | null;
  netGexAtSpot?: number | null;
  filtered?: boolean;
  drift?: number | null;
}) {
  const atSpot = atSpotGammaForPlaybook(input.netGexAtSpot ?? null, input.filtered ?? false);
  return {
    spot: input.spot,
    callWall: input.callWall,
    putWall: input.putWall,
    netGexAtSpot: atSpot,
    longGamma: longGammaAtSpot(atSpot, input.spot, input.flip),
    drift: input.drift ?? null,
  };
}

test('regime follows dealer gamma at spot when it is available', () => {
  // Positive at-spot gamma → the pinning (positive γ) row, even though the
  // geometric read would agree here anyway.
  const long = resolvePlaybookScenario(
    levelsFor({ spot: 600, flip: 595, callWall: 610, putWall: 580, netGexAtSpot: 4.2e9 }),
  );
  assert.equal(long.regime, 'positive');
  assert.equal(long.regimeBasis, 'at-spot-gamma');

  // Inverted book: spot sits ABOVE the reported flip yet gamma at spot is
  // negative. The Playbook must follow the badge (short γ), not the geometry —
  // otherwise the matrix contradicts the badge drawn above it on the chart.
  const short = resolvePlaybookScenario(
    levelsFor({ spot: 600, flip: 595, callWall: 610, putWall: 580, netGexAtSpot: -1.5e9 }),
  );
  assert.equal(short.regime, 'negative');
  assert.equal(short.regimeBasis, 'at-spot-gamma');
});

test('regime degrades to spot vs flip when at-spot gamma is missing', () => {
  const above = resolvePlaybookScenario(
    levelsFor({ spot: 600, flip: 595, callWall: 610, putWall: 580 }),
  );
  assert.equal(above.regime, 'positive');
  assert.equal(above.regimeBasis, 'spot-vs-flip');

  const below = resolvePlaybookScenario(
    levelsFor({ spot: 590, flip: 595, callWall: 610, putWall: 580 }),
  );
  assert.equal(below.regime, 'negative');
  assert.equal(below.regimeBasis, 'spot-vs-flip');
});

test('expiration-filtered levels ignore the whole-chain at-spot value', () => {
  // The user filtered to a subset of expirations, so flip/walls describe THAT
  // book while net_gex_at_spot is still served for the whole chain. Using the
  // chain value would leave the regime pinned to the unfiltered read and make
  // the Playbook insensitive to the expiration picker; the filtered flip wins.
  assert.equal(atSpotGammaForPlaybook(4.2e9, true), null);
  assert.equal(atSpotGammaForPlaybook(4.2e9, false), 4.2e9);

  const filtered = resolvePlaybookScenario(
    levelsFor({
      spot: 590,
      flip: 595,
      callWall: 610,
      putWall: 580,
      netGexAtSpot: 4.2e9, // whole chain reads long...
      filtered: true,
    }),
  );
  assert.equal(filtered.regime, 'negative'); // ...but the filtered book has spot below its flip
  assert.equal(filtered.regimeBasis, 'spot-vs-flip');

  // Same numbers unfiltered → the chain value is honored again.
  const unfiltered = resolvePlaybookScenario(
    levelsFor({ spot: 590, flip: 595, callWall: 610, putWall: 580, netGexAtSpot: 4.2e9 }),
  );
  assert.equal(unfiltered.regime, 'positive');
  assert.equal(unfiltered.regimeBasis, 'at-spot-gamma');
});

test('approach is the wall nearest to spot', () => {
  const up = resolvePlaybookScenario({ ...BASE, spot: 606, callWall: 610, putWall: 580 });
  assert.equal(up.approach, 'up');
  assert.equal(up.approachBasis, 'nearest-wall');
  assert.equal(up.wall?.side, 'call');
  assert.equal(up.wall?.level, 610);

  const down = resolvePlaybookScenario({ ...BASE, spot: 584, callWall: 610, putWall: 580 });
  assert.equal(down.approach, 'down');
  assert.equal(down.approachBasis, 'nearest-wall');
  assert.equal(down.wall?.side, 'put');
});

test('a materially nearer wall beats the session drift', () => {
  // Price is 1 point under the Call Wall and 20 points above the Put Wall while
  // the day is red. Momentum must NOT drag the read down to the Put Wall — the
  // Call Wall is the level price is standing on right now.
  const scenario = resolvePlaybookScenario({
    ...BASE,
    spot: 609,
    callWall: 610,
    putWall: 589,
    drift: -3,
  });
  assert.equal(scenario.approach, 'up');
  assert.equal(scenario.approachBasis, 'nearest-wall');
});

test('drift breaks a near-tie between equidistant walls', () => {
  // Walls 10 points either side: neither is "next" on distance alone, so the
  // day's direction decides.
  const red = resolvePlaybookScenario({ ...BASE, spot: 600, callWall: 610, putWall: 590, drift: -4 });
  assert.equal(red.approach, 'down');
  assert.equal(red.approachBasis, 'drift-tiebreak');
  assert.equal(red.wall?.side, 'put');

  const green = resolvePlaybookScenario({ ...BASE, spot: 600, callWall: 610, putWall: 590, drift: 4 });
  assert.equal(green.approach, 'up');
  assert.equal(green.approachBasis, 'drift-tiebreak');

  // A flat tape (inside the 5bp noise floor) leaves proximity in charge.
  const flat = resolvePlaybookScenario({ ...BASE, spot: 600, callWall: 610, putWall: 590, drift: 0.05 });
  assert.equal(flat.approachBasis, 'nearest-wall');

  // No drift at all → proximity, no crash.
  const noDrift = resolvePlaybookScenario({ ...BASE, spot: 600, callWall: 610, putWall: 590, drift: null });
  assert.equal(noDrift.approachBasis, 'nearest-wall');
});

test('the only resolved wall carries the read', () => {
  // Degraded chain: no Call Wall, so the Put Wall is the level in play.
  const putOnly = resolvePlaybookScenario({ ...BASE, spot: 600, callWall: null, putWall: 590 });
  assert.equal(putOnly.approach, 'down');
  assert.equal(putOnly.approachBasis, 'only-wall');
  assert.equal(putOnly.beyondWall, false);

  const callOnly = resolvePlaybookScenario({ ...BASE, spot: 600, callWall: 604, putWall: null });
  assert.equal(callOnly.approach, 'up');
  assert.equal(callOnly.approachBasis, 'only-wall');
});

test('a wall price has already broken stays the level in play', () => {
  // Price punched 3 points through the Call Wall while the Put Wall is 35 away.
  // The Call Wall is still what price is trading against — the read must stay on
  // it (flagged breached) rather than jumping to a Put Wall nobody is near.
  const brokenUp = resolvePlaybookScenario({ ...BASE, spot: 615, callWall: 612, putWall: 580 });
  assert.equal(brokenUp.approach, 'up');
  assert.equal(brokenUp.approachBasis, 'nearest-wall');
  assert.equal(brokenUp.beyondWall, true);
  assert.equal(brokenUp.wall?.side, 'call');

  // Mirror: price has lost the Put Wall.
  const brokenDown = resolvePlaybookScenario({ ...BASE, spot: 578, callWall: 610, putWall: 580 });
  assert.equal(brokenDown.approach, 'down');
  assert.equal(brokenDown.beyondWall, true);
  assert.equal(brokenDown.wall?.side, 'put');
});

test('a degraded book resolves to null instead of a default cell', () => {
  // No flip and no walls: neither axis can be read, so nothing is highlighted.
  const noLevels = resolvePlaybookScenario(
    levelsFor({ spot: 600, flip: null, callWall: null, putWall: null }),
  );
  assert.equal(noLevels.regime, null);
  assert.equal(noLevels.approach, null);
  assert.equal(noLevels.resolved, false);

  const noSpot = resolvePlaybookScenario(
    levelsFor({ spot: null, flip: 595, callWall: 610, putWall: 580 }),
  );
  assert.equal(noSpot.approach, null);
  assert.equal(noSpot.resolved, false);

  // Non-finite junk from the API coerces to "unknown", never to a cell.
  const junk = resolvePlaybookScenario(
    levelsFor({ spot: NaN, flip: NaN, callWall: NaN, putWall: NaN, netGexAtSpot: NaN }),
  );
  assert.equal(junk.resolved, false);

  // One axis can land while the other doesn't — a known regime with no walls
  // still isn't a cell.
  const regimeOnly = resolvePlaybookScenario(
    levelsFor({ spot: 600, flip: 595, callWall: null, putWall: null }),
  );
  assert.equal(regimeOnly.regime, 'positive');
  assert.equal(regimeOnly.approach, null);
  assert.equal(regimeOnly.resolved, false);
});

test('resolved flags both axes landing', () => {
  const scenario = resolvePlaybookScenario({ ...BASE, netGexAtSpot: 1e9 });
  assert.equal(scenario.resolved, true);
  assert.equal(scenario.regime, 'positive');
  assert.equal(scenario.approach, 'up');
});

test('wall distance is reported signed, with an absolute percentage', () => {
  const scenario = resolvePlaybookScenario({ ...BASE, spot: 600, callWall: 606, putWall: 580 });
  assert.equal(scenario.wall?.distance, 6);
  assert.ok(Math.abs((scenario.wall?.distancePct ?? 0) - 1) < 1e-9);

  const below = resolvePlaybookScenario({ ...BASE, spot: 600, callWall: 640, putWall: 594 });
  assert.equal(below.wall?.distance, -6);
  assert.ok(Math.abs((below.wall?.distancePct ?? 0) - 1) < 1e-9);
});

test('expirationScopeLabel names the scope the way a trader reads it', () => {
  assert.equal(expirationScopeLabel([], '2026-08-20'), 'all expirations');
  assert.equal(expirationScopeLabel(['2026-08-20'], '2026-08-20'), '0DTE (2026-08-20)');
  assert.equal(expirationScopeLabel(['2026-08-22'], '2026-08-20'), 'the 2026-08-22 expiration');
  assert.equal(
    expirationScopeLabel(['2026-08-29', '2026-08-22'], '2026-08-20'),
    '2 expirations (2026-08-22 → 2026-08-29)',
  );
});

test('the rationale names the symbol, the scope and both axes', () => {
  const scenario = resolvePlaybookScenario(
    levelsFor({ spot: 6000, flip: 5950, callWall: 6020, putWall: 5900, netGexAtSpot: 3e9 }),
  );
  const text = describePlaybookScenario(scenario, {
    symbol: 'SPX',
    expirationLabel: '0DTE (2026-08-20)',
    spot: 6000,
    flip: 5950,
  });
  assert.match(text, /SPX/);
  assert.match(text, /0DTE \(2026-08-20\)/);
  assert.match(text, /positive \(long γ\)/);
  assert.match(text, /Call Wall at 6,020\.00/);
});

test('the rationale admits when nothing could be resolved', () => {
  const scenario = resolvePlaybookScenario(
    levelsFor({ spot: null, flip: null, callWall: null, putWall: null }),
  );
  const text = describePlaybookScenario(scenario, {
    symbol: 'SPY',
    expirationLabel: 'all expirations',
    spot: null,
    flip: null,
  });
  assert.match(text, /not enough resolved gamma structure/);
});
