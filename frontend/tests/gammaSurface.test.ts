import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  colorLimit,
  extremeAtPrice,
  formatGexDollars,
  formatGexTick,
  formatLevel,
  interpolateAt,
  levelLadder,
  niceTicks,
  scaleProfiles,
  surfaceExtent,
  surfaceHours,
  surfaceTimeLabel,
  surfaceTimeTicks,
  traceAtPrice,
  zAxisRange,
} from '../core/gammaSurface.ts';

// Newer ICU builds put a narrow no-break space in some labels; compare the
// way a reader sees them.
const plain = (s: string) => s.replace(/\s/g, ' ');

// 2026-10-14 is a Wednesday; 15:00Z is 11:00 AM EDT.
const WED_11AM = '2026-10-14T15:00:00Z';

test('signed dollar labels scale to K / M / B with a typographic minus', () => {
  assert.equal(formatGexDollars(1_234_000_000), '+$1.23B');
  assert.equal(formatGexDollars(-456_700_000), '−$456.7M');
  assert.equal(formatGexDollars(12_400), '+$12K');
  assert.equal(formatGexDollars(-7), '−$7');
  assert.equal(formatGexDollars(0), '$0');
  assert.equal(formatGexDollars(null), '--');
  assert.equal(formatGexDollars(Number.NaN), '--');
});

test('levels print whole points on an index and cents below that', () => {
  assert.equal(formatLevel(7845.2), '7,845');
  assert.equal(formatLevel(671.234), '671.23');
  assert.equal(formatLevel(672), '672.00');
  assert.equal(formatLevel(undefined), '--');
});

test('rows convert from days to hours', () => {
  assert.deepEqual(surfaceHours([0, 0.25, 1]), [0, 6, 24]);
});

test('hover labels read in Eastern time with the weekday', () => {
  assert.equal(plain(surfaceTimeLabel(WED_11AM, 0)), 'Wed 11:00 AM ET');
  assert.equal(plain(surfaceTimeLabel(WED_11AM, 5)), 'Wed 4:00 PM ET');
  assert.equal(plain(surfaceTimeLabel(WED_11AM, 22.5)), 'Thu 9:30 AM ET');
  assert.equal(surfaceTimeLabel('not-a-date', 1), '');
});

test('an intraday axis runs Now → round hours → the settlement', () => {
  // 11:00 → 16:00: five hours, hourly ticks; the 4 PM end is the last label.
  const ticks = surfaceTimeTicks(WED_11AM, 5);
  assert.deepEqual(ticks.values, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(ticks.labels.map(plain), ['Now', '12 PM', '1 PM', '2 PM', '3 PM', '4 PM']);
});

test('a settlement a hair under the hour still reads as the hour', () => {
  // times_days arrive rounded; 4.21666h from 11:47 lands 0.04s before 4 PM.
  const ticks = surfaceTimeTicks('2026-10-14T15:47:00Z', 0.175694 * 24);
  assert.equal(plain(ticks.labels[ticks.labels.length - 1]), '4 PM');
  assert.equal(plain(surfaceTimeLabel('2026-10-14T15:47:00Z', 0.175694 * 24)), 'Wed 4:00 PM ET');
});

test('a round tick crowding the snapshot is dropped', () => {
  // 11:50 → 16:00: the noon tick would sit 10 minutes from "Now".
  const ticks = surfaceTimeTicks('2026-10-14T15:50:00Z', 4 + 10 / 60);
  assert.equal(ticks.labels[0], 'Now');
  assert.ok(!ticks.labels.map(plain).includes('12 PM'));
  assert.equal(plain(ticks.labels[ticks.labels.length - 1]), '4 PM');
  for (let i = 1; i < ticks.values.length; i++) assert.ok(ticks.values[i] > ticks.values[i - 1]);
});

test('an overnight axis names the next day on its clock labels', () => {
  // Wed 4:30 PM → Thu 4:00 PM (23.5h): six-hour steps on the six-hour marks.
  const ticks = surfaceTimeTicks('2026-10-14T20:30:00Z', 23.5);
  assert.deepEqual(ticks.labels.map(plain), ['Now', 'Thu 12 AM', 'Thu 6 AM', 'Thu 12 PM', 'Thu 4 PM']);
  assert.equal(ticks.values[1], 7.5);
});

test('a multi-day axis ticks at Eastern midnight', () => {
  // Wed 11 AM → Fri 4 PM (53h).
  const ticks = surfaceTimeTicks(WED_11AM, 53, 6);
  assert.deepEqual(ticks.labels.map(plain), ['Now', 'Thu 12 AM', 'Thu 12 PM', 'Fri 12 AM', 'Fri 4 PM']);
  const weekly = surfaceTimeTicks(WED_11AM, 24 * 20, 6);
  assert.equal(weekly.labels[0], 'Now');
  assert.ok(weekly.labels.slice(1, -1).every((l) => /^[A-Z][a-z]{2} \d{1,2}\/\d{1,2}$/.test(l)));
});

test('a degenerate axis is just "Now"', () => {
  assert.deepEqual(surfaceTimeTicks(WED_11AM, 0), { values: [0], labels: ['Now'] });
  assert.deepEqual(surfaceTimeTicks('nope', 5), { values: [0], labels: ['Now'] });
});

const GRID = [100, 101, 102, 103];
const PROFILES = [
  [0, 10, 20, 10],
  [0, 15, 40, 5],
  [-5, 12, 30, -2],
];

test('interpolation is linear between grid points and null off the grid', () => {
  assert.equal(interpolateAt(GRID, PROFILES[0], 101.5), 15);
  assert.equal(interpolateAt(GRID, PROFILES[0], 100), 0);
  assert.equal(interpolateAt(GRID, PROFILES[0], 103), 10);
  assert.equal(interpolateAt(GRID, PROFILES[0], 99.9), null);
  assert.equal(interpolateAt(GRID, PROFILES[0], 103.1), null);
  assert.equal(interpolateAt([], [], 1), null);
});

test('a price trace reads every row, and is null when the price is off the grid', () => {
  assert.deepEqual(traceAtPrice(GRID, PROFILES, 102), [20, 40, 30]);
  assert.equal(traceAtPrice(GRID, PROFILES, 150), null);
  assert.equal(traceAtPrice(GRID, PROFILES, null), null);
});

test('the drop line meets the column at its highest (or lowest) row', () => {
  assert.deepEqual(extremeAtPrice(GRID, PROFILES, 102, 'max'), { row: 1, value: 40 });
  assert.deepEqual(extremeAtPrice(GRID, PROFILES, 100, 'min'), { row: 2, value: -5 });
  assert.equal(extremeAtPrice(GRID, PROFILES, 99, 'max'), null);
});

test('the z range always spans zero with headroom', () => {
  assert.deepEqual(surfaceExtent(PROFILES), { min: -5, max: 40 });
  const [lo, hi] = zAxisRange(PROFILES);
  assert.ok(lo < -5 && hi > 40);
  const [allPosLo] = zAxisRange([[5, 10]]);
  assert.ok(allPosLo < 0, 'an all-positive surface still floors below zero');
  assert.deepEqual(zAxisRange([]), [-1, 1]);
});

test('nice ticks land on round values inside the range', () => {
  assert.deepEqual(niceTicks(-1.2e9, 4.3e9, 5), [-1e9, 0, 1e9, 2e9, 3e9, 4e9]);
  assert.deepEqual(niceTicks(0, 10, 4), [0, 2.5, 5, 7.5, 10]);
  assert.deepEqual(niceTicks(5, 5), []);
});

test('axis ticks share one unit and drop trailing zeros', () => {
  const billions = [-50e9, -25e9, 0, 25e9, 50e9];
  assert.deepEqual(
    billions.map((t) => formatGexTick(t, billions)),
    ['−$50B', '−$25B', '$0', '+$25B', '+$50B'],
  );
  const halves = [0, 2.5e9, 5e9, 7.5e9];
  assert.deepEqual(halves.map((t) => formatGexTick(t, halves)), ['$0', '+$2.5B', '+$5B', '+$7.5B']);
  const millions = [-400e6, -200e6, 0, 200e6];
  assert.deepEqual(millions.map((t) => formatGexTick(t, millions)), ['−$400M', '−$200M', '$0', '+$200M']);
});

test('the color limit ignores the few cells a settlement spike sends sky-high', () => {
  const body = Array.from({ length: 99 }, (_, i) => (i % 2 ? 1 : -1) * (i + 1));
  const limit = colorLimit([[...body, 1e9]], 0.97);
  assert.ok(limit < 100 && limit > 90, `limit ${limit}`);
  assert.equal(colorLimit([]), 1);
  assert.equal(colorLimit([[0, 0]]), 1);
});

test('the readout stacks the levels as a price ladder, highest first', () => {
  const levels = [
    { key: 'call', value: 7850 },
    { key: 'flip', value: 7791 },
    { key: 'spot', value: 7807 },
    { key: 'put', value: 7750 },
  ];
  assert.deepEqual(levelLadder(levels).map((l) => l.key), ['call', 'spot', 'flip', 'put']);
  // Spot below the flip flips the middle of the ladder.
  levels[2].value = 7780;
  assert.deepEqual(levelLadder(levels).map((l) => l.key), ['call', 'flip', 'spot', 'put']);
  // An unknown level drops to the end; ties keep their order.
  assert.deepEqual(
    levelLadder([{ key: 'a', value: null }, { key: 'b', value: 5 }, { key: 'c', value: 5 }]).map((l) => l.key),
    ['b', 'c', 'a'],
  );
});

test('unit scaling multiplies every value', () => {
  assert.deepEqual(scaleProfiles([[1, -2]], 0.5), [[0.5, -1]]);
});
