// Unit tests for the Light history: turning each bar's four scan lights into
// runs of "on", for the rows Barrie asked for under the strip.
//
// What is worth pinning is where a run starts and stops, because every one of
// those is a claim about a time: when a light came on, how long it held, and
// whether one still on runs to now.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BAR_MINUTES,
  LIVE_WITHIN_MS,
  axisFraction,
  formatDuration,
  hasLightData,
  hourTicks,
  lightTimeline,
  type LightBar,
} from '../core/lightHistory.ts';

const OPEN = Date.parse('2026-10-20T13:30:00Z'); // 09:30 ET
const BAR = BAR_MINUTES * 60_000;
const at = (i: number) => new Date(OPEN + i * BAR).toISOString();

const OFF = { agree: false, heads_up: false, fragile: false, stand_down: false };

function session(agree: boolean[]): LightBar[] {
  return agree.map((on, i) => ({ bar_start: at(i), lights: { ...OFF, agree: on } }));
}

test('a light on for consecutive bars is one run, opening to close', () => {
  const t = lightTimeline(session([false, true, true, true, false]), OPEN + 60 * BAR, false);

  assert.deepEqual(t?.runs.agree, [{ start: OPEN + BAR, end: OPEN + 4 * BAR, active: false }]);
});

test('switching on and off is several runs, which is what shows the flicker', () => {
  const t = lightTimeline(session([true, false, true, false, true]), OPEN + 60 * BAR, false);

  assert.equal(t?.runs.agree.length, 3);
});

test('a light still on in a live session runs to now and says so', () => {
  const now = OPEN + 3 * BAR + 2 * 60_000; // two minutes into the newest bar
  const t = lightTimeline(session([false, true, true, true]), now);

  assert.equal(t?.live, true);
  assert.deepEqual(t?.runs.agree, [{ start: OPEN + BAR, end: now, active: true }]);
  assert.equal(t?.to, now);
});

test('a finished session ends with its last bar, not with the clock', () => {
  // The evening after the close: "now" is hours past the newest bar, and
  // running the light to now would claim it was on while nothing was measured.
  const now = OPEN + 3 * BAR + LIVE_WITHIN_MS + 1;
  const t = lightTimeline(session([false, true, true, true]), now);

  assert.equal(t?.live, false);
  assert.deepEqual(t?.runs.agree, [{ start: OPEN + BAR, end: OPEN + 4 * BAR, active: false }]);
  assert.equal(t?.to, OPEN + 4 * BAR);
});

test('a dated page is never live, however recent its bars look', () => {
  const t = lightTimeline(session([true, true]), OPEN + 2 * BAR, false);

  assert.equal(t?.live, false);
  assert.equal(t?.runs.agree[0].active, false);
});

test('a hole in the grid breaks a run rather than bridging it', () => {
  // Bars 0-1 and 4-5, nothing in between. Nobody checked the light at 2 and 3.
  const bars: LightBar[] = [0, 1, 4, 5].map((i) => ({
    bar_start: at(i),
    lights: { ...OFF, agree: true },
  }));
  const t = lightTimeline(bars, OPEN + 60 * BAR, false);

  assert.deepEqual(t?.runs.agree, [
    { start: OPEN, end: OPEN + 2 * BAR, active: false },
    { start: OPEN + 4 * BAR, end: OPEN + 6 * BAR, active: false },
  ]);
});

test('a bar served without lights is not drawn as on', () => {
  const bars: LightBar[] = [
    { bar_start: at(0), lights: { ...OFF, agree: true } },
    { bar_start: at(1), lights: null },
    { bar_start: at(2), lights: { ...OFF, agree: true } },
  ];
  const t = lightTimeline(bars, OPEN + 60 * BAR, false);

  assert.equal(t?.runs.agree.length, 2);
});

test('each light is read from its own key', () => {
  const bars: LightBar[] = [
    { bar_start: at(0), lights: { ...OFF, fragile: true } },
    { bar_start: at(1), lights: { ...OFF, stand_down: true } },
  ];
  const t = lightTimeline(bars, OPEN + 60 * BAR, false);

  assert.equal(t?.runs.agree.length, 0);
  assert.equal(t?.runs.heads_up.length, 0);
  assert.equal(t?.runs.fragile.length, 1);
  assert.equal(t?.runs.stand_down.length, 1);
});

test('no bars is no timeline, and no lights anywhere is nothing to draw', () => {
  assert.equal(lightTimeline([], OPEN, true), null);
  assert.equal(hasLightData([{ bar_start: at(0) }]), false);
  assert.equal(hasLightData(session([false])), true);
});

test('durations read as minutes, then hours and minutes', () => {
  assert.equal(formatDuration(35 * 60_000), '35m');
  assert.equal(formatDuration(65 * 60_000), '1h 05m');
  assert.equal(formatDuration(-1), '0m');
});

test('hour ticks land on whole hours inside the axis', () => {
  // 09:30 to 12:20 ET: 10:00, 11:00, 12:00.
  const ticks = hourTicks(OPEN, OPEN + 170 * 60_000);

  assert.deepEqual(
    ticks.map((t) => new Date(t).toISOString().slice(11, 16)),
    ['14:00', '15:00', '16:00'],
  );
});

test('axis positions are clamped to the axis', () => {
  assert.equal(axisFraction(OPEN, OPEN, OPEN + 100), 0);
  assert.equal(axisFraction(OPEN + 50, OPEN, OPEN + 100), 0.5);
  assert.equal(axisFraction(OPEN + 500, OPEN, OPEN + 100), 1);
});
