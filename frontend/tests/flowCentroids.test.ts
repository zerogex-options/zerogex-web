import assert from 'node:assert/strict';
import test from 'node:test';

import {
  centroidPath,
  centroidsForBars,
  centroidRange,
  type FlowCentroidRow,
} from '../core/flowCentroids.ts';

const T0 = Date.parse('2026-10-19T13:30:00Z'); // 09:30 ET, on the 5-min grid
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

function row(ms: number, call: number | null, put: number | null, callRecent = call, putRecent = put): FlowCentroidRow {
  return {
    timestamp: iso(ms),
    call_centroid: call,
    put_centroid: put,
    call_centroid_recent: callRecent,
    put_centroid_recent: putRecent,
    call_volume: 100,
    put_volume: 100,
  };
}

const ROWS = [
  row(T0, 7760, 7630),
  row(T0 + 5 * MIN, 7762, 7625),
  row(T0 + 10 * MIN, 7759, 7627),
];

test('5-minute candles read their own bucket', () => {
  const bars = [0, 5, 10].map((m) => ({ timestamp: iso(T0 + m * MIN) }));
  const points = centroidsForBars(bars, ROWS, 5);
  assert.deepEqual(points.map((p) => p?.call), [7760, 7762, 7759]);
  assert.deepEqual(points.map((p) => p?.put), [7630, 7625, 7627]);
});

test('1-minute candles read the bucket they fall in', () => {
  const bars = [0, 1, 4, 5, 9].map((m) => ({ timestamp: iso(T0 + m * MIN) }));
  const points = centroidsForBars(bars, ROWS, 1);
  assert.deepEqual(points.map((p) => p?.call), [7760, 7760, 7760, 7762, 7762]);
});

test('a 15-minute candle reads the newest bucket that closes inside it', () => {
  const points = centroidsForBars([{ timestamp: iso(T0) }], ROWS, 15);
  assert.equal(points[0]?.call, 7759);
  // An hourly candle with only the first two buckets in so far reads the newer.
  const partial = centroidsForBars([{ timestamp: iso(T0) }], ROWS.slice(0, 2), 60);
  assert.equal(partial[0]?.call, 7762);
});

test('bars outside the session read null', () => {
  const bars = [{ timestamp: iso(T0 - 5 * MIN) }, { timestamp: iso(T0) }, { timestamp: iso(T0 + 60 * MIN) }];
  const points = centroidsForBars(bars, ROWS, 5);
  assert.equal(points[0], null);
  assert.equal(points[1]?.call, 7760);
  assert.equal(points[2], null);
});

test('no rows means no points', () => {
  const bars = [{ timestamp: iso(T0) }];
  assert.deepEqual(centroidsForBars(bars, null, 5), [null]);
  assert.deepEqual(centroidsForBars(bars, [], 5), [null]);
  // A body that is not a list (an error object, say) draws nothing rather than throwing.
  assert.deepEqual(centroidsForBars(bars, { detail: 'oops' } as unknown as FlowCentroidRow[], 5), [null]);
});

test('a missing side stays null and non-numbers are dropped', () => {
  const rows = [row(T0, 7760, null), { ...row(T0 + 5 * MIN, 7762, 7625), put_centroid_recent: Number.NaN }];
  const points = centroidsForBars([{ timestamp: iso(T0) }, { timestamp: iso(T0 + 5 * MIN) }], rows, 5);
  assert.equal(points[0]?.put, null);
  assert.equal(points[1]?.putRecent, null);
  assert.equal(points[1]?.put, 7625);
});

test('the path breaks where a line has no value', () => {
  const points = [
    { call: 10, put: 1, callRecent: 10, putRecent: 1 },
    { call: 20, put: null, callRecent: 20, putRecent: null },
    null,
    { call: 30, put: 3, callRecent: 30, putRecent: 3 },
    { call: 40, put: 4, callRecent: 40, putRecent: 4 },
  ];
  const x = (i: number) => i * 10;
  const y = (p: number) => 100 - p;
  assert.equal(centroidPath(points, 'call', x, y), 'M 0.0 90.0 L 10.0 80.0 M 30.0 70.0 L 40.0 60.0');
  assert.equal(centroidPath(points, 'put', x, y), 'M 0.0 99.0 M 30.0 97.0 L 40.0 96.0');
  assert.equal(centroidPath([null, null], 'call', x, y), '');
});

test('the range spans every line and ignores gaps', () => {
  const points = [
    null,
    { call: 7760, put: 7630, callRecent: 7768, putRecent: null },
    { call: 7750, put: 7640, callRecent: 7745, putRecent: 7612 },
  ];
  assert.deepEqual(centroidRange(points), { min: 7612, max: 7768 });
  assert.equal(centroidRange([null, { call: null, put: null, callRecent: null, putRecent: null }]), null);
  assert.equal(centroidRange([]), null);
});
