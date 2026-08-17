// Tests for the forced-flow session read — the interpretation layer behind the
// full-session field chart. Pins the attractor(magnet)/repeller(pivot)
// distinction and the two things it drives:
//   1. regime + directional bias (pull toward a magnet vs push off a pivot), and
//   2. reaction (toward-magnet "respect" vs away-from-pivot "amplify"),
// including that the NEAREST crossing to spot decides the regime.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeForcedFlowSessionRead,
  type SessionColumnLike,
} from '../core/forcedFlowSessionRead.ts';

// Build a chronological column list (open → close). Optional projection column
// carries the close magnet/pivot.
function makeColumns(
  pastSpots: number[],
  pastMagnets: (number | null)[],
  pastPivots: (number | null)[],
  projection?: { spot: number; magnet?: number | null; pivot?: number | null },
): { columns: SessionColumnLike[]; now_index: number } {
  const n = pastSpots.length;
  const columns: SessionColumnLike[] = pastSpots.map((spot, i) => ({
    min_to_close: 390 - (i * 380) / n,
    spot,
    magnet: pastMagnets[i],
    pivot: pastPivots[i],
    is_past: true,
  }));
  const now_index = columns.length - 1;
  if (projection) {
    columns.push({
      min_to_close: 0,
      spot: projection.spot,
      magnet: projection.magnet ?? null,
      pivot: projection.pivot ?? null,
      is_past: false,
    });
  }
  return { columns, now_index };
}

test('pinning regime: price mean-reverts toward a magnet above spot', () => {
  const spots = [100, 101, 102, 103, 104, 105, 106];
  const magnets = spots.map((s) => s + 2); // attractor above
  const pivots = spots.map(() => null); // no repeller
  const { columns, now_index } = makeColumns(spots, magnets, pivots, { spot: 106, magnet: 108 });

  const read = computeForcedFlowSessionRead({ spot: 106, columns, now_index });

  assert.equal(read.regime, 'pin');
  assert.equal(read.keyLevelKind, 'pin');
  assert.equal(read.keyLevel, 108);
  assert.equal(read.magnetNow, 108);
  assert.equal(read.reactionKind, 'respect');
  assert.equal(read.reactionTotal, 6);
  assert.equal(read.reactionObeyed, 6, 'every move ran toward the magnet');
  assert.equal(read.reactionPct, 1);
  assert.equal(read.biasDir, 'up');
  assert.equal(read.headline, 'Upward pin');
  assert.match(read.sentence, /stable pin/);
  assert.match(read.sentence, /respected it/);
});

test('amplifying regime: price runs away from a pivot below spot', () => {
  const spots = [100, 101, 102, 103, 104, 105, 106];
  const magnets = spots.map(() => null); // no attractor
  const pivots = spots.map((s) => s - 2); // repeller below → price above it, running up
  const { columns, now_index } = makeColumns(spots, magnets, pivots, { spot: 106, pivot: 104 });

  const read = computeForcedFlowSessionRead({ spot: 106, columns, now_index });

  assert.equal(read.regime, 'pivot');
  assert.equal(read.keyLevelKind, 'pivot');
  assert.equal(read.keyLevel, 104);
  assert.equal(read.pivotNow, 104);
  assert.equal(read.reactionKind, 'amplify');
  assert.equal(read.reactionTotal, 6);
  assert.equal(read.reactionObeyed, 6, 'every move ran away from the pivot');
  assert.equal(read.reactionPct, 1);
  assert.equal(read.biasDir, 'up', 'spot sits above the pivot → upward push');
  assert.equal(read.headline, 'Amplifying · short γ');
  assert.match(read.sentence, /pivot/);
  assert.match(read.sentence, /amplify/);
  assert.doesNotMatch(read.sentence, /respected|fighting the pin/);
});

test('the NEAREST crossing to spot decides the regime', () => {
  const spots = [100, 100.5, 101, 100.5, 100, 100.5, 101];
  // Both a magnet and a pivot exist; the pivot is much nearer spot → short gamma.
  const magnets = spots.map((s) => s + 5);
  const pivots = spots.map((s) => s + 1);
  const near = makeColumns(spots, magnets, pivots, { spot: 101, magnet: 106, pivot: 102 });
  const readPivot = computeForcedFlowSessionRead({ spot: 101, columns: near.columns, now_index: near.now_index });
  assert.equal(readPivot.regime, 'pivot');
  assert.equal(readPivot.keyLevel, 102);

  // Flip the distances: magnet nearer than pivot → pinning.
  const magnets2 = spots.map((s) => s + 1);
  const pivots2 = spots.map((s) => s + 5);
  const far = makeColumns(spots, magnets2, pivots2, { spot: 101, magnet: 102, pivot: 106 });
  const readPin = computeForcedFlowSessionRead({ spot: 101, columns: far.columns, now_index: far.now_index });
  assert.equal(readPin.regime, 'pin');
  assert.equal(readPin.keyLevel, 102);
});

test('no crossing near spot → regime "none"', () => {
  const spots = [100, 101, 102, 103, 104];
  const nulls = spots.map(() => null);
  const { columns, now_index } = makeColumns(spots, nulls, nulls);
  const read = computeForcedFlowSessionRead({ spot: 104, columns, now_index });
  assert.equal(read.regime, 'none');
  assert.equal(read.keyLevel, null);
  assert.equal(read.biasDir, null);
  assert.match(read.sentence, /between structures/);
});

test('projection columns are excluded from the reaction, but supply the close target', () => {
  const spots = [100, 101, 102, 103, 104, 105];
  const magnets = spots.map((s) => s + 2);
  const pivots = spots.map(() => null);
  const withProj = makeColumns(spots, magnets, pivots, { spot: 50, magnet: 40 });
  const withoutProj = makeColumns(spots, magnets, pivots);

  const a = computeForcedFlowSessionRead({ spot: 105, columns: withProj.columns, now_index: withProj.now_index });
  const b = computeForcedFlowSessionRead({ spot: 105, columns: withoutProj.columns, now_index: withoutProj.now_index });

  assert.equal(a.reactionTotal, b.reactionTotal, 'projection column adds no step');
  assert.equal(a.reactionObeyed, b.reactionObeyed);
  assert.equal(a.closeTarget, 40, 'projection magnet is the close target');
  assert.equal(b.closeTarget, 107, 'no projection → last actual magnet (107 = 105 + 2)');
});

test('amplifying reaction counts running away, not toward', () => {
  // Pivot above spot, price falling → moving away from the pivot (downward run).
  const spots = [106, 105, 104, 103, 102, 101, 100];
  const magnets = spots.map(() => null);
  const pivots = spots.map((s) => s + 2); // pivot above → price below it, running down
  const { columns, now_index } = makeColumns(spots, magnets, pivots, { spot: 100, pivot: 102 });

  const read = computeForcedFlowSessionRead({ spot: 100, columns, now_index });
  assert.equal(read.regime, 'pivot');
  assert.equal(read.reactionKind, 'amplify');
  assert.equal(read.reactionObeyed, 6, 'each step ran further below the pivot');
  assert.equal(read.biasDir, 'down', 'spot sits below the pivot → downward push');
});

test('bad input yields an honest empty read', () => {
  for (const bad of [null, undefined, { spot: 0, columns: [], now_index: 0 }]) {
    const read = computeForcedFlowSessionRead(bad as never);
    assert.equal(read.regime, 'unknown');
    assert.equal(read.reactionPct, null);
    assert.equal(read.biasDir, null);
    assert.equal(read.keyLevel, null);
  }
});
