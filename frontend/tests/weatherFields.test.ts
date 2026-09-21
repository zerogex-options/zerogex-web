// Unit tests for binding a Gamma Weather header field to its session story.
//
// The drawer exists because words capture one slice of time and the question
// is about a pattern. What is pinned here is the part that would be wrong in
// a way nobody notices: which numbers a field reads, which comments belong on
// its chart, and what the trail says at a time the cursor lands on.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WEATHER_FIELDS,
  changesForField,
  commentAt,
  fieldSeries,
  fieldSpec,
} from '../core/weatherFields.ts';

const t = (i: number) => `2026-09-21T13:${String(30 + i * 5).padStart(2, '0')}:00Z`;

// CHRONOLOGICAL, because that is what the hooks hand over: useHedgingFlow and
// useGammaRegimeSeries each reverse the API's newest-first rows once, so every
// consumer shares one order. An earlier version of this fixture was
// newest-first and the code reversed it, which agreed with itself and drew the
// session right to left in the browser.
const flow = {
  bars: [
    { bar_start: t(0), net_flow_usd: 100 },
    { bar_start: t(1), net_flow_usd: 200 },
    { bar_start: t(2), net_flow_usd: 300 },
  ],
} as never;

const regime = {
  bars: [
    { bar_start: t(0), rolling_lean: 10, rolling_stability: -10, anchored_stability: 1, cushion_pts: 16 },
    { bar_start: t(1), rolling_lean: 20, rolling_stability: -20, anchored_stability: 2, cushion_pts: 14 },
    { bar_start: t(2), rolling_lean: 30, rolling_stability: -30, anchored_stability: 3, cushion_pts: 12 },
  ],
} as never;

const changes = [
  { bar_start: t(0), field: 'state', kind: 'STATE', text: 'Stable bid', opening: true },
  { bar_start: t(0), field: 'pressure', kind: 'PRESSURE', text: 'Opened buying', opening: true },
  { bar_start: t(1), field: 'pressure', kind: 'PRESSURE', text: 'Flipped to selling', opening: false },
  { bar_start: t(1), field: 'cushion', kind: 'CUSHION_BAND', text: 'Cushion thin', opening: false },
  { bar_start: t(2), field: 'state', kind: 'STATE', text: 'Unstable', opening: false },
];

const bars = [
  { bar_start: t(0), sentence: 'Stable bid. Everything is calm.' },
  { bar_start: t(1), sentence: 'Stable bid. Pressure has turned.' },
  { bar_start: t(2), sentence: 'Unstable. It broke.' },
] as never;

test('every field has a spec, and an unknown one is refused', () => {
  for (const f of WEATHER_FIELDS) assert.equal(fieldSpec(f.key).key, f.key);
  assert.throws(() => fieldSpec('nope' as never));
});

test('a field series keeps the order the hooks delivered', () => {
  // The payloads are already chronological. Re-ordering here would draw the
  // session backwards, and it would do so silently.
  for (const key of ['pressure', 'lean', 'stability', 'gamma_trend', 'cushion'] as const) {
    const points = fieldSeries(key, flow, regime);
    const stamps = points.map((p) => p.bar_start);
    assert.deepEqual(stamps, [...stamps].sort(), `${key} must run oldest to newest`);
  }
});

test('pressure reads the flow series', () => {
  const points = fieldSeries('pressure', flow, regime);

  assert.deepEqual(points.map((p) => p.value), [100, 200, 300]);
  assert.equal(points[0].bar_start, t(0));
});

test('each structure field reads its own column', () => {
  assert.deepEqual(fieldSeries('lean', flow, regime).map((p) => p.value), [10, 20, 30]);
  assert.deepEqual(fieldSeries('stability', flow, regime).map((p) => p.value), [-10, -20, -30]);
  assert.deepEqual(fieldSeries('gamma_trend', flow, regime).map((p) => p.value), [1, 2, 3]);
  assert.deepEqual(fieldSeries('cushion', flow, regime).map((p) => p.value), [16, 14, 12]);
});

test('a field with no payload yet is empty rather than an error', () => {
  // The drawer can open before the first poll returns.
  assert.deepEqual(fieldSeries('lean', null, null), []);
  assert.deepEqual(fieldSeries('pressure', null, null), []);
});

test('a chart carries its own comments plus the Weather state', () => {
  // The state is the headline the whole panel is about, so it belongs on every
  // chart. Another field's line on this axis would be someone else's story.
  const forPressure = changesForField(changes, 'pressure');

  assert.deepEqual(
    forPressure.map((c) => c.text),
    ['Stable bid', 'Opened buying', 'Flipped to selling', 'Unstable'],
  );
});

test('a chart does not carry another field\'s comments', () => {
  const forPressure = changesForField(changes, 'pressure');

  assert.ok(!forPressure.some((c) => c.text === 'Cushion thin'));
});

test('the comment at a time is the one in force, not only one printed then', () => {
  // A trail that went blank between changes would be unreadable on exactly the
  // quiet stretches it exists to compress.
  const comment = commentAt(bars, changes, 'pressure', t(2));

  assert.equal(comment.sentence, 'Unstable. It broke.');
  assert.equal(comment.line, 'Flipped to selling');
  assert.equal(comment.fresh, false);
});

test('a line that printed on the hovered bar is marked fresh', () => {
  const comment = commentAt(bars, changes, 'pressure', t(1));

  assert.equal(comment.line, 'Flipped to selling');
  assert.equal(comment.fresh, true);
});

test('the field line is the field\'s own, never the state line', () => {
  // Otherwise hovering the cushion chart would report a pressure flip as the
  // cushion's story.
  const comment = commentAt(bars, changes, 'cushion', t(2));

  assert.equal(comment.line, 'Cushion thin');
});

test('a time before anything printed yields no line', () => {
  const comment = commentAt(bars, changes, 'pressure', '2026-09-21T13:00:00Z');

  assert.equal(comment.sentence, null);
  assert.equal(comment.line, null);
});

test('no hovered time yields nothing rather than guessing', () => {
  const comment = commentAt(bars, changes, 'pressure', null);

  assert.equal(comment.sentence, null);
  assert.equal(comment.fresh, false);
});
