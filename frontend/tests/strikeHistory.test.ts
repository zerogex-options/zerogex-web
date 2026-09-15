import assert from "node:assert/strict";
import test from "node:test";
import { bucketAtOrNearest, bucketHasPositioning, etDateKeyOf, rewoundChangePercent } from "../core/strikeHistory.ts";

const T0 = Date.parse("2026-09-04T13:30:00Z"); // 09:30 ET
const at = (min: number, net: number | null) => ({
  timestamp: new Date(T0 + min * 60_000).toISOString(),
  strikes: net == null ? [] : [{ net_gamma: net }],
});

test("a bucket has positioning only when some strike carries non-zero gamma", () => {
  assert.equal(bucketHasPositioning(at(0, 5)), true);
  assert.equal(bucketHasPositioning(at(0, 0)), false);
  assert.equal(bucketHasPositioning(at(0, null)), false);
  assert.equal(bucketHasPositioning({ timestamp: "x", strikes: [{ net_gamma: "-12" }] }), true);
  assert.equal(bucketHasPositioning(null), false);
});

test("rewind reads the newest positioned bucket at or before the clock", () => {
  const buckets = [at(0, 1), at(5, 2), at(10, 3), at(15, null), at(20, 4)];
  assert.equal(bucketAtOrNearest(buckets, T0 + 12 * 60_000)?.timestamp, at(10, 0).timestamp);
  assert.equal(bucketAtOrNearest(buckets, T0 + 10 * 60_000)?.timestamp, at(10, 0).timestamp);
  // 15 is empty → the book as it stood is still the 10:00 bucket.
  assert.equal(bucketAtOrNearest(buckets, T0 + 17 * 60_000)?.timestamp, at(10, 0).timestamp);
  assert.equal(bucketAtOrNearest(buckets, T0 + 60 * 60_000)?.timestamp, at(20, 0).timestamp);
});

test("before the history starts, the earliest positioned bucket stands in", () => {
  const buckets = [at(30, 1), at(35, 2)];
  assert.equal(bucketAtOrNearest(buckets, T0)?.timestamp, at(30, 0).timestamp);
  assert.equal(bucketAtOrNearest([at(0, null), at(5, 0)], T0), null);
  assert.equal(bucketAtOrNearest([], T0), null);
});

test("ET date keys and the rewound day change pick the previous session's close", () => {
  assert.equal(etDateKeyOf("2026-09-04T20:00:00Z"), "2026-09-04");
  assert.equal(etDateKeyOf("2026-09-05T02:00:00Z"), "2026-09-04"); // 22:00 ET, still the 4th
  assert.equal(etDateKeyOf("nope"), null);
  const closes = { current_session_close: 748.6, current_session_close_ts: "2026-09-04T20:00:00Z", prior_session_close: 751.9 };
  // Today's close is being served → a bucket inside today reads against yesterday's close.
  const pct = rewoundChangePercent(745, "2026-09-04T18:30:00Z", closes);
  assert.ok(pct != null && Math.abs(pct - ((745 - 751.9) / 751.9) * 100) < 1e-9);
  // The pair has not rolled yet (current = yesterday's close) → use it directly.
  const live = { current_session_close: 751.9, current_session_close_ts: "2026-09-03T20:00:00Z", prior_session_close: 749.0 };
  const pct2 = rewoundChangePercent(745, "2026-09-04T18:30:00Z", live);
  assert.ok(pct2 != null && Math.abs(pct2 - ((745 - 751.9) / 751.9) * 100) < 1e-9);
  assert.equal(rewoundChangePercent(null, "2026-09-04T18:30:00Z", closes), null);
  assert.equal(rewoundChangePercent(745, "2026-09-04T18:30:00Z", null), null);
});
