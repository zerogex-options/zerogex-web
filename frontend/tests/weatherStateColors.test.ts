// Unit tests for coloring a drawer line by the Weather state in force.
//
// The rules Barrie set are the ones worth pinning, because each of them is a
// way the chart could get noisy: color the state and nothing else, don't
// recolor for a candidate that hasn't confirmed, hold the color through quiet
// stretches, and change color exactly at the dot rather than blending into it.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEATHER_STATE_COLOR,
  WEATHER_STATE_LEGEND,
  drawnLineStops,
  segmentStops,
  stateSegments,
  weatherStateColor,
} from '../core/weatherStateColors.ts';

test('every state the classifier can emit has a color', () => {
  for (const s of ['STABLE_BID', 'SUPPORTED_DIP', 'FRAGILE_RALLY', 'UNSTABLE', 'MIXED']) {
    assert.ok(WEATHER_STATE_COLOR[s], `${s} needs a color`);
  }
});

test('the five colors are five, not three', () => {
  // The banner used to group them into three tones. If that ever comes back,
  // the drawers and the banner would disagree about what a color means.
  const distinct = new Set(Object.values(WEATHER_STATE_COLOR));

  assert.equal(distinct.size, 5);
});

test('the legend is fixed and complete', () => {
  // Always all five, in one order, even on a session that visited two. A
  // legend that shrank to what happened would make two days incomparable.
  assert.equal(WEATHER_STATE_LEGEND.length, 5);
  assert.deepEqual(
    WEATHER_STATE_LEGEND.map((e) => e.label),
    ['Stable bid', 'Supported dip', 'Fragile rally', 'Unstable', 'Mixed'],
  );
});

test('an unknown state falls back to the neutral rather than vanishing', () => {
  assert.equal(weatherStateColor('NOPE'), WEATHER_STATE_COLOR.MIXED);
  assert.equal(weatherStateColor(null), WEATHER_STATE_COLOR.MIXED);
});

test('a run of one state is one segment', () => {
  assert.deepEqual(stateSegments(['STABLE_BID', 'STABLE_BID', 'STABLE_BID']), [
    { state: 'STABLE_BID', from: 0, to: 2 },
  ]);
});

test('a quiet stretch keeps the last color and starts no new segment', () => {
  // The whole point of holding the color: a slow afternoon should not make
  // the line flicker, and it should not sprout dots either.
  const segments = stateSegments(['STABLE_BID', 'STABLE_BID', 'STABLE_BID', 'STABLE_BID']);

  assert.equal(segments.length, 1);
});

test('the segment changes where the state changes', () => {
  const segments = stateSegments(['STABLE_BID', 'STABLE_BID', 'UNSTABLE', 'UNSTABLE']);

  assert.deepEqual(segments, [
    { state: 'STABLE_BID', from: 0, to: 1 },
    { state: 'UNSTABLE', from: 2, to: 3 },
  ]);
});

test('a state that returns later gets its own segment', () => {
  const segments = stateSegments(['STABLE_BID', 'UNSTABLE', 'STABLE_BID']);

  assert.equal(segments.length, 3);
});

test('bars with no state yet extend the run rather than going neutral', () => {
  // A field can be charted before the weather series lands. Blinking gray
  // while a poll is in flight would look like a real state change.
  const segments = stateSegments(['STABLE_BID', null, null, 'STABLE_BID']);

  assert.deepEqual(segments, [{ state: 'STABLE_BID', from: 0, to: 3 }]);
});

test('a session with no states at all produces no segments', () => {
  assert.deepEqual(stateSegments([null, null]), []);
  assert.deepEqual(stateSegments([]), []);
});

test('the color changes exactly at the boundary, with no blend', () => {
  // Two stops share an offset, which is what gives a hard edge. A gradient
  // that eased between them would smear the one moment being looked for.
  const stops = segmentStops(
    [
      { state: 'STABLE_BID', from: 0, to: 1 },
      { state: 'UNSTABLE', from: 2, to: 3 },
    ],
    4,
  );

  // Two stops share the boundary offset: that is the hard edge.
  assert.deepEqual(
    stops.map((s) => s.offset),
    [0, 2 / 3, 2 / 3, 1],
  );
  assert.equal(stops[1].offset, stops[2].offset);
  assert.equal(stops[1].color, WEATHER_STATE_COLOR.STABLE_BID);
  assert.equal(stops[2].color, WEATHER_STATE_COLOR.UNSTABLE);
});

test('no two adjacent stops with different colors sit at different offsets', () => {
  // Any color change must be a step. A ramp anywhere means a blur on a
  // boundary, which is exactly where the reader is looking.
  const stops = segmentStops(
    stateSegments(['MIXED', 'STABLE_BID', 'STABLE_BID', 'UNSTABLE', 'FRAGILE_RALLY']),
    5,
  );

  for (let i = 1; i < stops.length; i += 1) {
    if (stops[i].color !== stops[i - 1].color) {
      assert.equal(stops[i].offset, stops[i - 1].offset, `blend between stop ${i - 1} and ${i}`);
    }
  }
});

test('stops span the full axis so no end is left uncolored', () => {
  const stops = segmentStops(stateSegments(['MIXED', 'MIXED', 'UNSTABLE']), 3);

  assert.equal(stops[0].offset, 0);
  assert.equal(stops[stops.length - 1].offset, 1);
});

test('a single-point series still gets a flat color rather than nothing', () => {
  const stops = segmentStops([{ state: 'MIXED', from: 0, to: 0 }], 1);

  assert.equal(stops.length, 2);
  assert.equal(stops[0].color, WEATHER_STATE_COLOR.MIXED);
});

// The gradient stretches over the drawn line, not the axis, so its stops must
// be measured along the line. Barrie caught the difference: the stacked view
// and the one-at-a-time view colored the same bars differently.

test('a line that stops before the end of the axis is colored along the line', () => {
  // The stacked view: the axis runs to 16:00, the line stops at the latest
  // bar. Measured against the axis, this change landed at 2/9 of the way
  // along the line instead of at its own bar.
  const stops = drawnLineStops([
    { value: 1, state: 'MIXED' },
    { value: 2, state: 'MIXED' },
    { value: 3, state: 'UNSTABLE' },
    { value: 4, state: 'UNSTABLE' },
    ...Array.from({ length: 6 }, () => ({ value: null, state: null })),
  ]);

  assert.deepEqual(
    stops.map((s) => s.offset),
    [0, 2 / 3, 2 / 3, 1],
  );
  assert.equal(stops[2].color, WEATHER_STATE_COLOR.UNSTABLE);
});

test('a line that starts late is colored from its own first bar', () => {
  // Lean and Stability have no value until their window fills, so the line
  // starts after the axis does. The change at bar 4 is two bars into a line
  // three bars long, whatever came before it.
  const stops = drawnLineStops([
    { value: null, state: 'MIXED' },
    { value: null, state: 'MIXED' },
    { value: 1, state: 'MIXED' },
    { value: 2, state: 'MIXED' },
    { value: 3, state: 'UNSTABLE' },
    { value: 4, state: 'UNSTABLE' },
  ]);

  assert.deepEqual(
    stops.map((s) => s.offset),
    [0, 2 / 3, 2 / 3, 1],
  );
});

test('the same bars get the same colors in both views', () => {
  // One chart at a time draws only the bars that exist; the stack pads them
  // onto the whole session. The colors must not depend on which one is open.
  const bars = [
    { value: 1, state: 'MIXED' },
    { value: 2, state: 'UNSTABLE' },
    { value: 3, state: 'UNSTABLE' },
  ];
  const padded = [...bars, ...Array.from({ length: 75 }, () => ({ value: null, state: null }))];

  assert.deepEqual(drawnLineStops(padded), drawnLineStops(bars));
});

test('a field with no values yet gets no stops', () => {
  assert.deepEqual(drawnLineStops([{ value: null, state: 'MIXED' }]), []);
  assert.deepEqual(drawnLineStops([]), []);
});
