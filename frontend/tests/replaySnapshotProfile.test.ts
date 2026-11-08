import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SNAPSHOT_PROFILE_MAX_STRIKES,
  SNAPSHOT_PROFILE_ROW_LIMIT,
  snapshotNetProfile,
} from '../core/replaySnapshotProfile.ts';

// /api/replay/frame rows: one per (strike, expiration), nearest spot first.
const row = (strike: number, expiration: string, net: number) => ({ strike, expiration, net_gex: net });

test('two expirations at one strike become one bar holding their sum', () => {
  const cols = snapshotNetProfile([
    row(600, '2026-11-06', -300),
    row(600, '2026-11-13', -200),
    row(601, '2026-11-06', 50),
  ]);
  assert.deepEqual(cols, [
    { strike: 600, net: -500 },
    { strike: 601, net: 50 },
  ]);
});

test('every expiration of a strike counts, wherever its rows sit in the response', () => {
  // ES at the money on 2026-11-06: 12 expirations at every strike near spot.
  const exps = Array.from({ length: 12 }, (_, i) => `2026-11-${String(6 + i).padStart(2, '0')}`);
  const rows = [7418.75, 7413.5, 7423.75].flatMap((k, j) => exps.map((e, i) => row(k, e, -(j + 1) * 10 - i)));
  const cols = snapshotNetProfile(rows);
  assert.equal(cols.length, 3, 'one bar per strike, not one per expiration');
  const sum = (j: number) => exps.reduce((acc, _, i) => acc - (j + 1) * 10 - i, 0);
  assert.deepEqual(cols, [
    { strike: 7413.5, net: sum(1) },
    { strike: 7418.75, net: sum(0) },
    { strike: 7423.75, net: sum(2) },
  ]);
  assert.equal(new Set(cols.map((c) => c.strike)).size, cols.length, 'strikes are unique bar keys');
});

test('keeps the strikes nearest spot, in the order the endpoint ranked them', () => {
  // Nearest first: 100, 99, 101, 98, 102 ...
  const order = [100, 99, 101, 98, 102, 97, 103];
  const rows = order.flatMap((k) => [row(k, '2026-11-06', k), row(k, '2026-11-13', 1)]);
  assert.deepEqual(
    snapshotNetProfile(rows, SNAPSHOT_PROFILE_ROW_LIMIT, 3).map((c) => c.strike),
    [99, 100, 101],
  );
  assert.equal(snapshotNetProfile(rows).length, order.length);
});

test('a read cut at the row cap leaves out the strikes at the cut', () => {
  // A 7-row cap stops partway through the tie at distance 2 (98 and 102, on
  // either side of spot 100), with their rows interleaved as the endpoint may
  // return tied rows. 98 and 102 may be missing expirations, so neither is drawn.
  const rows = [
    row(100, 'a', 10), row(100, 'b', 10),
    row(99, 'a', 5), row(101, 'a', 7),
    row(98, 'a', 3), row(102, 'a', 4), row(98, 'b', 3),
  ];
  assert.deepEqual(snapshotNetProfile(rows, 7), [
    { strike: 99, net: 5 },
    { strike: 100, net: 20 },
    { strike: 101, net: 7 },
  ]);
  // Under the cap the same rows are a whole chain and every strike is drawn.
  assert.deepEqual(
    snapshotNetProfile(rows, 8).map((c) => c.strike),
    [98, 99, 100, 101, 102],
  );
});

test('rows without a usable strike or value are skipped, and empty reads draw nothing', () => {
  assert.deepEqual(snapshotNetProfile(null), []);
  assert.deepEqual(snapshotNetProfile([]), []);
  assert.deepEqual(
    snapshotNetProfile([
      { strike: null, expiration: 'a', net_gex: 5 },
      { strike: 600, expiration: 'a', net_gex: null },
      { strike: '601', expiration: 'a', net_gex: '2.5' },
      { strike: 602, expiration: 'a', net_gex: Number.NaN },
    ]),
    [{ strike: 601, net: 2.5 }],
  );
});

test('the card asks for the whole chain and draws at most 64 bars', () => {
  assert.equal(SNAPSHOT_PROFILE_ROW_LIMIT, 4000, 'the /api/replay/frame maximum, as the ladder baseline uses');
  assert.equal(SNAPSHOT_PROFILE_MAX_STRIKES, 64);
});
