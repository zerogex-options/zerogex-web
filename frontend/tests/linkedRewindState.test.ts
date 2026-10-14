// Unit tests for core/linkedRewindState — the one Rewind clock every replaying
// chart on a My Dashboard board reads.
//
// What the reader sees is "rewind any chart and they all rewind together", so
// these pin the rules that make that hold: a change reaches every other chart
// and never echoes back to the one that made it, exactly one chart steps
// playback, playback stops if that chart leaves, and an empty board is live.
// The last block pins which bar a chart on another timeframe shows for the
// shared moment, which must never be a bar that had not closed yet.
import test from 'node:test';
import assert from 'node:assert/strict';

import { LIVE_REWIND, barIndexAsOf, createRewindLink, type SharedRewind } from '../core/linkedRewindState.ts';

function member(link: ReturnType<typeof createRewindLink>, id: string) {
  const heard: SharedRewind[] = [];
  const leave = link.join(id, (s) => heard.push(s));
  return { heard, leave };
}

test('a change reaches every other chart and not the one that made it', () => {
  const link = createRewindLink();
  const a = member(link, 'a');
  const b = member(link, 'b');
  const c = member(link, 'c');

  link.publish('a', { active: true, time: 1000, playing: false });

  assert.deepEqual(a.heard, []);
  assert.deepEqual(b.heard, [{ active: true, time: 1000, playing: false }]);
  assert.deepEqual(c.heard, [{ active: true, time: 1000, playing: false }]);
  assert.deepEqual(link.current(), { active: true, time: 1000, playing: false });
});

test('a partial change keeps the moment (Pause does not restate the time)', () => {
  const link = createRewindLink();
  member(link, 'a');
  const b = member(link, 'b');

  link.publish('a', { active: true, time: 5000, playing: true });
  link.publish('a', { playing: false });

  assert.deepEqual(b.heard.at(-1), { active: true, time: 5000, playing: false });
});

test('exit returns the board to live, whatever else the change carried', () => {
  const link = createRewindLink();
  member(link, 'a');
  const b = member(link, 'b');

  link.publish('a', { active: true, time: 5000, playing: true });
  link.publish('b', { active: false });

  assert.deepEqual(link.current(), LIVE_REWIND);
  assert.equal(link.driving('a'), false);
  assert.equal(link.driving('b'), false);
  // b made the change, so only a hears it.
  assert.equal(b.heard.length, 1);
});

test('the chart that starts playback drives it, and working another hands it over', () => {
  const link = createRewindLink();
  member(link, 'a');
  member(link, 'b');

  link.publish('a', { active: true, time: 1000, playing: true });
  assert.equal(link.driving('a'), true);
  assert.equal(link.driving('b'), false);

  // b changes speed while a is playing: b takes playback over.
  link.publish('b', { playing: true });
  assert.equal(link.driving('a'), false);
  assert.equal(link.driving('b'), true);
  assert.equal(link.current().time, 1000);

  // Pausing from anywhere leaves no driver.
  link.publish('a', { playing: false });
  assert.equal(link.driving('a'), false);
  assert.equal(link.driving('b'), false);
});

test('playback stops when the chart driving it leaves the board', () => {
  const link = createRewindLink();
  const a = member(link, 'a');
  const b = member(link, 'b');

  link.publish('a', { active: true, time: 1000, playing: true });
  a.leave();

  assert.deepEqual(link.current(), { active: true, time: 1000, playing: false });
  assert.deepEqual(b.heard.at(-1), { active: true, time: 1000, playing: false });
});

test('a follower leaving does not disturb playback', () => {
  const link = createRewindLink();
  member(link, 'a');
  const b = member(link, 'b');
  const c = member(link, 'c');

  link.publish('a', { active: true, time: 1000, playing: true });
  const heardBefore = c.heard.length;
  b.leave();

  assert.equal(link.current().playing, true);
  assert.equal(link.driving('a'), true);
  assert.equal(c.heard.length, heardBefore);
});

test('the board goes back to live when the last chart leaves', () => {
  const link = createRewindLink();
  const a = member(link, 'a');

  link.publish('a', { active: true, time: 1000, playing: false });
  a.leave();
  assert.deepEqual(link.current(), LIVE_REWIND);

  // A chart added afterwards finds nothing to join.
  member(link, 'b');
  assert.equal(link.current().active, false);
});

test('a stale leave cannot remove the chart that rejoined under the same id', () => {
  const link = createRewindLink();
  const first = member(link, 'a');
  first.leave();
  const second = member(link, 'a');
  member(link, 'b');

  first.leave();
  link.publish('b', { active: true, time: 1000, playing: false });
  assert.equal(second.heard.length, 1);
});

// ── barIndexAsOf ────────────────────────────────────────────────────────────

const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 14, 14, 0); // 10:00 ET
const fiveMinStarts = [0, 5, 10, 15].map((m) => T0 + m * MIN); // 10:00 … 10:15

test('a bar is shown only once it has closed', () => {
  // 10:07 on a 1-min clock: the 10:05 bar has not closed, so 10:00 holds.
  assert.equal(barIndexAsOf(fiveMinStarts, 5 * MIN, T0 + 7 * MIN), 0);
  // The last millisecond of 10:05–10:10 closes it.
  assert.equal(barIndexAsOf(fiveMinStarts, 5 * MIN, T0 + 10 * MIN - 1), 1);
  assert.equal(barIndexAsOf(fiveMinStarts, 5 * MIN, T0 + 10 * MIN - 2), 0);
});

test('the newest bar is shown once the clock reaches it', () => {
  // The forming bar as it stands is not ahead of the clock, so entering Rewind
  // from a 1-min chart does not knock a 5-min chart back a bar.
  assert.equal(barIndexAsOf(fiveMinStarts, 5 * MIN, T0 + 15 * MIN), 3);
  assert.equal(barIndexAsOf(fiveMinStarts, 5 * MIN, T0 + 17 * MIN), 3);
  // Before it starts, the bar before it is the newest closed one.
  assert.equal(barIndexAsOf(fiveMinStarts, 5 * MIN, T0 + 15 * MIN - 1), 2);
});

test('a clock before the first bar closed resolves to nothing', () => {
  assert.equal(barIndexAsOf(fiveMinStarts, 5 * MIN, T0 + 2 * MIN), null);
  assert.equal(barIndexAsOf(fiveMinStarts, 5 * MIN, T0 - MIN), null);
  assert.equal(barIndexAsOf([], 5 * MIN, T0), null);
  assert.equal(barIndexAsOf(fiveMinStarts, 5 * MIN, Number.NaN), null);
});

test('a 1-min chart following a 5-min chart lands on the bar that closes with it', () => {
  // A 5-min chart publishes its 10:05 bar as that bar's close (10:09:59.999).
  const oneMinStarts = Array.from({ length: 20 }, (_, i) => T0 + i * MIN);
  assert.equal(barIndexAsOf(oneMinStarts, MIN, T0 + 10 * MIN - 1), 9); // the 10:09 bar
});
