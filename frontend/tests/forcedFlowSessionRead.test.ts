// Tests for the forced-flow session read — the interpretation layer behind the
// full-session field chart. Pins the two things it computes off the
// /session-surface columns:
//   1. directional bias (now-lean + projected close target), and
//   2. pin respect (did price's next move go the way the field was pulling),
// including the sign conventions that make "pinned" vs "fighting" opposite
// readings of the same lean.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeForcedFlowSessionRead,
  type SessionColumnLike,
} from '../core/forcedFlowSessionRead.ts';

// Build a chronological column list (open → close). `pastSpots`/`pastMagnets`
// are the actual history + now column; an optional projection column carries the
// close target. min_to_close just marches down so the ordering is well-formed.
function makeColumns(
  pastSpots: number[],
  pastMagnets: (number | null)[],
  projection?: { spot: number; magnet: number | null },
): { columns: SessionColumnLike[]; now_index: number } {
  const n = pastSpots.length;
  const columns: SessionColumnLike[] = pastSpots.map((spot, i) => ({
    min_to_close: 390 - (i * 380) / n,
    spot,
    magnet: pastMagnets[i],
    is_past: true,
  }));
  const now_index = columns.length - 1;
  if (projection) {
    columns.push({ min_to_close: 0, spot: projection.spot, magnet: projection.magnet, is_past: false });
  }
  return { columns, now_index };
}

test('pinned + upward lean: price mean-reverts toward a magnet above spot', () => {
  // Spot climbs 100→106; the magnet leads it by +2 the whole way. Each step the
  // field pulls UP and price moves UP → every step obeys.
  const spots = [100, 101, 102, 103, 104, 105, 106];
  const magnets = spots.map((s) => s + 2);
  const { columns, now_index } = makeColumns(spots, magnets, { spot: 106, magnet: 108 });

  const read = computeForcedFlowSessionRead({ spot: 106, columns, now_index });

  assert.equal(read.totalSteps, 6, 'six consecutive actual steps');
  assert.equal(read.obeyedSteps, 6, 'all moved toward the magnet');
  assert.equal(read.respectPct, 1);
  assert.equal(read.regime, 'pinned');
  assert.equal(read.biasDir, 'up');
  assert.equal(read.headline, 'Upward pin');
  assert.equal(read.magnetNow, 108);
  assert.equal(read.leanNowPoints, 2); // 108 − 106
  assert.equal(read.closeTarget, 108);
  assert.equal(read.closeTargetPoints, 2);
  assert.match(read.sentence, /respected the pin/);
  assert.match(read.sentence, /108/); // names the target
});

test('fighting: same upward-leaning magnet, but price runs the other way', () => {
  // Identical +2 magnet lean, but spot FALLS away from it each step → the field
  // is being overridden. Same lean, opposite reaction → opposite regime.
  const spots = [106, 105, 104, 103, 102, 101, 100];
  const magnets = spots.map((s) => s + 2);
  const { columns, now_index } = makeColumns(spots, magnets, { spot: 100, magnet: 102 });

  const read = computeForcedFlowSessionRead({ spot: 100, columns, now_index });

  assert.equal(read.totalSteps, 6);
  assert.equal(read.obeyedSteps, 0, 'none moved toward the magnet');
  assert.equal(read.respectPct, 0);
  assert.equal(read.regime, 'fighting');
  assert.equal(read.headline, 'Fighting the pin');
  assert.match(read.sentence, /fighting the field/);
  assert.match(read.sentence, /weak target/);
});

test('flat pin: magnet sits on spot → no lean, reaction untestable', () => {
  const spots = [100, 100.5, 101, 100.5, 100, 100.5, 101];
  const magnets = spots.map((s) => s); // magnet exactly on spot every column
  const { columns, now_index } = makeColumns(spots, magnets, { spot: 101, magnet: 101 });

  const read = computeForcedFlowSessionRead({ spot: 101, columns, now_index });

  assert.equal(read.totalSteps, 0, 'no step has a directional pull to test');
  assert.equal(read.respectPct, null);
  assert.equal(read.regime, 'unknown');
  assert.equal(read.biasDir, 'flat');
  assert.equal(read.leanNowPoints, 0);
});

test('a mixed tape lands in the balanced band', () => {
  // Magnet +1 above spot throughout; price alternates toward/away so ~half the
  // steps obey → respect near 0.5 → balanced, not pinned or fighting.
  const spots = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101, 100];
  const magnets = spots.map((s) => s + 1);
  const { columns, now_index } = makeColumns(spots, magnets, { spot: 100, magnet: 101 });

  const read = computeForcedFlowSessionRead({ spot: 100, columns, now_index });

  assert.ok(read.totalSteps >= 5);
  assert.ok(
    read.respectPct != null && read.respectPct > 0.42 && read.respectPct < 0.58,
    `expected a middling respect, got ${read.respectPct}`,
  );
  assert.equal(read.regime, 'balanced');
});

test('projection columns are excluded from the reaction backtest', () => {
  // A wild projection spot would wreck respect if it were counted as realised.
  const spots = [100, 101, 102, 103, 104, 105];
  const magnets = spots.map((s) => s + 2);
  const withProj = makeColumns(spots, magnets, { spot: 50, magnet: 40 });
  const withoutProj = makeColumns(spots, magnets);

  const a = computeForcedFlowSessionRead({ spot: 105, columns: withProj.columns, now_index: withProj.now_index });
  const b = computeForcedFlowSessionRead({ spot: 105, columns: withoutProj.columns, now_index: withoutProj.now_index });

  assert.equal(a.totalSteps, b.totalSteps, 'projection column adds no step');
  assert.equal(a.obeyedSteps, b.obeyedSteps);
  // …but it DOES supply the close target for bias. Without a projection column
  // the last column is the now column, so the target falls back to its magnet.
  assert.equal(a.closeTarget, 40);
  assert.equal(b.closeTarget, 107); // spot 105 + 2 (the now magnet)
});

test('close target falls back to the now-lean when projection magnet is null', () => {
  const spots = [100, 101, 102, 103, 104, 105];
  const magnets = spots.map((s) => s + 2);
  const { columns, now_index } = makeColumns(spots, magnets, { spot: 105, magnet: null });

  const read = computeForcedFlowSessionRead({ spot: 105, columns, now_index });

  assert.equal(read.closeTarget, null);
  assert.equal(read.biasDir, 'up', 'falls back to the positive now-lean');
});

test('bad input yields an honest empty read', () => {
  for (const bad of [null, undefined, { spot: 0, columns: [], now_index: 0 }]) {
    const read = computeForcedFlowSessionRead(bad as never);
    assert.equal(read.regime, 'unknown');
    assert.equal(read.respectPct, null);
    assert.equal(read.biasDir, null);
  }
});
