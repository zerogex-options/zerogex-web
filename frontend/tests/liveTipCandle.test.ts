// The live price on the Gamma Terminal's newest candle (core/liveTipCandle.ts).
// The candles must move every second: inside the newest bucket the price
// extends that candle, and when a new bucket starts it opens the next candle
// at once instead of holding the old one until the next candle poll lands.
import test from "node:test";
import assert from "node:assert/strict";

import { overlayLiveTick, type Candle } from "../core/liveTipCandle.ts";

const MIN = 60_000;

function candle(timestamp: string, open: number, high: number, low: number, close: number): Candle {
  return { timestamp, open, high, low, close, volume: 900, upVolume: 500, downVolume: 400 };
}

const history = [
  candle("2026-10-27T18:29:00.000Z", 680.0, 680.4, 679.9, 680.2),
  candle("2026-10-27T18:30:00.000Z", 680.2, 680.6, 680.1, 680.5),
];

test("inside the newest bucket the price extends that candle", () => {
  const out = overlayLiveTick(history, { close: 680.9, timestamp: "2026-10-27T18:30:00.000Z" }, MIN, true);
  assert.equal(out.length, 2);
  assert.deepEqual(out[1], { ...history[1], close: 680.9, high: 680.9 });
  assert.equal(history[1].close, 680.5, "history itself is never mutated");
});

test("a price below the low lowers it", () => {
  const out = overlayLiveTick(history, { close: 679.8, timestamp: "2026-10-27T18:30:00.000Z" }, MIN, true);
  assert.equal(out[1].low, 679.8);
  assert.equal(out[1].high, 680.6);
});

test("an unchanged price returns the same array, so nothing re-renders", () => {
  const same = overlayLiveTick(history, { close: 680.5, timestamp: "2026-10-27T18:30:00.000Z" }, MIN, true);
  assert.equal(same, history);
});

test("the next minute opens a new candle at once (the fix)", () => {
  const out = overlayLiveTick(
    history,
    { close: 680.7, open: 680.55, high: 680.8, low: 680.5, timestamp: "2026-10-27T18:31:00.000Z" },
    MIN,
    true,
  );
  assert.equal(out.length, 3);
  assert.deepEqual(out[2], {
    timestamp: "2026-10-27T18:31:00.000Z",
    open: 680.55,
    high: 680.8,
    low: 680.5,
    close: 680.7,
    volume: 0,
    upVolume: 0,
    downVolume: 0,
  });
  assert.deepEqual(out.slice(0, 2), history, "the finished candle keeps its stored values");
});

test("without the minute bar's own open, high and low the new candle starts at the price", () => {
  const out = overlayLiveTick(history, { close: 680.7, timestamp: "2026-10-27T18:31:00.000Z" }, MIN, true);
  assert.deepEqual([out[2].open, out[2].high, out[2].low, out[2].close], [680.7, 680.7, 680.7, 680.7]);
});

test("a 5-minute chart opens its next bucket on the bucket boundary", () => {
  const fives = [candle("2026-10-27T18:25:00.000Z", 680.0, 680.6, 679.9, 680.5)];
  const out = overlayLiveTick(fives, { close: 680.6, open: 680.5, high: 680.6, low: 680.5, timestamp: "2026-10-27T18:30:00.000Z" }, 5 * MIN, true);
  assert.equal(out.length, 2);
  assert.equal(out[1].timestamp, "2026-10-27T18:30:00.000Z");
  // A minute still inside the newest 5-minute bucket extends it instead.
  const inside = overlayLiveTick(fives, { close: 680.8, timestamp: "2026-10-27T18:29:00.000Z" }, 5 * MIN, true);
  assert.equal(inside.length, 1);
  assert.equal(inside[0].close, 680.8);
});

test("no new candle when the caller says it may not open (daily, out of hours)", () => {
  const out = overlayLiveTick(history, { close: 680.7, timestamp: "2026-10-27T18:31:00.000Z" }, MIN, false);
  assert.equal(out, history);
});

test("a tick further ahead than the next bucket is left to history", () => {
  const overnight = overlayLiveTick(history, { close: 681.0, timestamp: "2026-10-28T08:00:00.000Z" }, MIN, true);
  assert.equal(overnight, history);
});

test("a tick older than the newest candle is ignored", () => {
  const stale = overlayLiveTick(history, { close: 679.0, timestamp: "2026-10-27T18:29:00.000Z" }, MIN, true);
  assert.equal(stale, history);
});

test("missing or unusable input changes nothing", () => {
  assert.equal(overlayLiveTick(history, { close: null, timestamp: "2026-10-27T18:30:00.000Z" }, MIN, true), history);
  assert.equal(overlayLiveTick(history, { close: 681, timestamp: null }, MIN, true), history);
  assert.equal(overlayLiveTick(history, { close: 681, timestamp: "not a time" }, MIN, true), history);
  const empty: Candle[] = [];
  assert.equal(overlayLiveTick(empty, { close: 681, timestamp: "2026-10-27T18:31:00.000Z" }, MIN, true), empty);
});
