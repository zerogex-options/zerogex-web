// Unit tests for the one thing the stacked view adds that is not a rendering
// decision: putting all five fields on one x-grid.
//
// Recharts syncs charts by ROW INDEX, not by timestamp. Pressure comes off the
// flow series and the other four off the structure series, and the two
// payloads can differ in length and in where they start. Unaligned, the shared
// crosshair would sit on 11:45 in one chart and 11:20 in the next, which
// defeats the only reason to stack them, and it would look perfectly fine.
import test from 'node:test';
import assert from 'node:assert/strict';

import { alignFieldToTimeline, sessionDateKey, type WeatherFieldPoint } from '../core/weatherFields.ts';
import { getFiveMinuteSessionTimeline } from '../core/flowSeriesCharts.ts';

const TIMELINE = getFiveMinuteSessionTimeline('2026-09-28');
const pt = (bar_start: string, value: number | null = 1): WeatherFieldPoint => ({
  bar_start,
  value,
  smoothed: null,
});

test('two series of different lengths come out the same length', () => {
  // The real shape of the problem: one feed starts late, the other stops early.
  const pressure = TIMELINE.slice(4).map((t) => pt(t, 10));
  const lean = TIMELINE.slice(0, 40).map((t) => pt(t, 20));

  const a = alignFieldToTimeline(pressure, TIMELINE);
  const b = alignFieldToTimeline(lean, TIMELINE);

  assert.equal(a.length, TIMELINE.length);
  assert.equal(b.length, TIMELINE.length);
  // Index i is the same minute in both, which is the whole contract.
  for (let i = 0; i < TIMELINE.length; i++) {
    assert.equal(a[i].bar_start, b[i].bar_start);
    assert.equal(a[i].bar_start, TIMELINE[i]);
  }
});

test('a missing bar becomes a hole, not a shifted row', () => {
  // Dropping absent bars instead of nulling them is what slides every later
  // row one place left and silently misaligns the stack.
  const withGap = [pt(TIMELINE[0]), pt(TIMELINE[1]), pt(TIMELINE[3])];
  const aligned = alignFieldToTimeline(withGap, TIMELINE);

  assert.equal(aligned[2].bar_start, TIMELINE[2]);
  assert.equal(aligned[2].value, null);
  assert.equal(aligned[2].smoothed, null);
  assert.equal(aligned[3].value, 1, 'the bar after the gap must not shift');
});

test('values and smoothers survive alignment unchanged', () => {
  const points = [{ bar_start: TIMELINE[5], value: 42, smoothed: 7 }];
  const aligned = alignFieldToTimeline(points, TIMELINE);
  assert.deepEqual(aligned[5], { bar_start: TIMELINE[5], value: 42, smoothed: 7 });
});

test('an empty timeline leaves the points alone', () => {
  // A date the session grid cannot be built for must not blank the charts.
  const points = [pt(TIMELINE[0]), pt(TIMELINE[1])];
  assert.deepEqual(alignFieldToTimeline(points, []), points);
});

test('the session date comes off the last bar, in ET', () => {
  // 20:15 UTC on the 28th is 16:15 ET the same day: the session's final bar.
  const regime = { bars: [{ bar_start: '2026-09-28T13:30:00.000Z' }, { bar_start: '2026-09-28T20:15:00.000Z' }] };
  assert.equal(sessionDateKey(null, regime as never), '2026-09-28');

  // Falls back to flow when the structure series has not loaded.
  const flow = { bars: [{ bar_start: '2026-09-28T14:00:00.000Z' }] };
  assert.equal(sessionDateKey(flow as never, null), '2026-09-28');

  // And the key it returns must be one the timeline builder accepts.
  assert.ok(getFiveMinuteSessionTimeline(sessionDateKey(null, regime as never)!).length > 0);
});

test('no bars anywhere resolves to no session rather than today', () => {
  assert.equal(sessionDateKey(null, null), null);
  assert.equal(sessionDateKey({ bars: [] } as never, { bars: [] } as never), null);
  assert.equal(sessionDateKey(null, { bars: [{ bar_start: 'nonsense' }] } as never), null);
});


test('the server\'s timestamp format still matches the timeline', () => {
  // The timeline is built through Date.toISOString(), which writes
  // "2026-09-28T13:30:00.000Z". The API writes "2026-09-28T13:30:00Z". A raw
  // string compare matches nothing, so every bar aligns to a hole and all five
  // charts render empty with no error anywhere. Caught by opening the page,
  // not by a test, so here is the test.
  const serverStyle = TIMELINE.slice(0, 6).map((t) => pt(t.replace('.000Z', 'Z'), 99));
  const aligned = alignFieldToTimeline(serverStyle, TIMELINE);

  assert.equal(aligned.filter((p) => p.value != null).length, 6);
  assert.equal(aligned[0].value, 99);
  // And the row keeps the key it arrived with, because the Weather state and
  // the change dots are indexed by that one.
  assert.equal(aligned[0].bar_start, TIMELINE[0].replace('.000Z', 'Z'));
});
