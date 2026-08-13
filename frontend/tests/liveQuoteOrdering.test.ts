// Guards the out-of-order live-quote fix behind the Price Action candlestick
// chart. The tip candle paints `quote.close` from the shared quote cache, which
// applyLiveQuote() feeds from the WebSocket stream. WS frames can arrive out of
// order (the server fans each tick out on an independent task and replays a
// staler snapshot on every resubscribe), so applying whatever lands last used
// to rewind the tip candle a step and then jump it forward on the next in-order
// frame — the "quotes jumping" the user reported. isFresherServerTs() drops any
// frame that isn't strictly newer than the last one applied.
import test from "node:test";
import assert from "node:assert/strict";

import { isFresherServerTs } from "../core/liveQuoteOrdering.ts";

// ---------------------------------------------------------------------------
// isFresherServerTs — the raw ordering predicate
// ---------------------------------------------------------------------------

test("first frame of an epoch is always applied (no baseline yet)", () => {
  assert.equal(isFresherServerTs(null, 1_000.5), true);
  assert.equal(isFresherServerTs(undefined, 1_000.5), true);
});

test("a strictly newer frame is applied", () => {
  assert.equal(isFresherServerTs(1_000.0, 1_000.25), true);
});

test("a duplicate (equal server_ts) frame is dropped", () => {
  // The subscribe-snapshot replays the exact frame we just showed — same stamp.
  assert.equal(isFresherServerTs(1_000.0, 1_000.0), false);
});

test("an older (reordered) frame is dropped", () => {
  // A late frame for a tick that predates what we've already applied.
  assert.equal(isFresherServerTs(1_000.5, 1_000.0), false);
});

test("a frame with no server_ts is applied (no ordering signal → last-writer-wins)", () => {
  // Backwards-compat with any server that omits the stamp; absence of an
  // ordering signal must never freeze the stream.
  assert.equal(isFresherServerTs(1_000.0, null), true);
  assert.equal(isFresherServerTs(1_000.0, undefined), true);
});

test("a non-finite server_ts is treated as no stamp and applied", () => {
  assert.equal(isFresherServerTs(1_000.0, Number.NaN), true);
  assert.equal(isFresherServerTs(1_000.0, Infinity), true);
});

test("a non-finite baseline never blocks a stamped frame", () => {
  assert.equal(isFresherServerTs(Number.NaN, 1_000.0), true);
});

// ---------------------------------------------------------------------------
// Sequence simulation — mirrors applyLiveQuote's guard + baseline threading
// ---------------------------------------------------------------------------

interface Frame {
  close: number;
  server_ts?: number | null;
}

// Replays applyLiveQuote's decision: apply iff fresher, and advance the
// baseline only when the applied frame carried a finite stamp.
function feed(frames: Frame[]): { appliedCloses: number[]; droppedCloses: number[] } {
  let last: number | null = null;
  const appliedCloses: number[] = [];
  const droppedCloses: number[] = [];
  for (const f of frames) {
    if (isFresherServerTs(last, f.server_ts)) {
      appliedCloses.push(f.close);
      if (typeof f.server_ts === "number" && Number.isFinite(f.server_ts)) {
        last = f.server_ts;
      }
    } else {
      droppedCloses.push(f.close);
    }
  }
  return { appliedCloses, droppedCloses };
}

test("the reported scenario: a late frame can no longer rewind the candle", () => {
  // Ticks emitted at 100, 101, 102 with a late-arriving 100.5-stamped frame
  // (close 500.10) landing between 101 and 102 — the classic reorder.
  const { appliedCloses, droppedCloses } = feed([
    { close: 500.2, server_ts: 100 },
    { close: 500.3, server_ts: 101 },
    { close: 500.1, server_ts: 100.5 }, // reordered: older than 101 → dropped
    { close: 500.4, server_ts: 102 },
  ]);
  // The close only ever moves forward — never reverts to 500.1 and jumps back.
  assert.deepEqual(appliedCloses, [500.2, 500.3, 500.4]);
  assert.deepEqual(droppedCloses, [500.1]);
});

test("subscribe-snapshot replay after a fresher tick is dropped", () => {
  // Fresh tick (server_ts 205) races ahead of the snapshot replay (204) that
  // the server sends on subscribe. The snapshot must not revert the price.
  const { appliedCloses, droppedCloses } = feed([
    { close: 610.5, server_ts: 205 },
    { close: 610.1, server_ts: 204 }, // stale snapshot → dropped
    { close: 610.7, server_ts: 206 },
  ]);
  assert.deepEqual(appliedCloses, [610.5, 610.7]);
  assert.deepEqual(droppedCloses, [610.1]);
});

test("in-order 1 Hz stream applies every tick", () => {
  const { appliedCloses } = feed([
    { close: 500.1, server_ts: 100 },
    { close: 500.2, server_ts: 101 },
    { close: 500.15, server_ts: 102 }, // a real down-tick — value falls but time advances
    { close: 500.25, server_ts: 103 },
  ]);
  assert.deepEqual(appliedCloses, [500.1, 500.2, 500.15, 500.25]);
});

test("reconnect re-baseline: first frame of a new epoch is adopted even if its stamp is lower", () => {
  // resetLiveQuoteOrdering() clears the baseline on reconnect. Modeled here by
  // feeding a second sequence starting from a null baseline: a worker whose
  // clock sits behind the previous epoch would otherwise be frozen out.
  const epochOne = feed([
    { close: 500.1, server_ts: 5_000 },
    { close: 500.2, server_ts: 5_001 },
  ]);
  assert.deepEqual(epochOne.appliedCloses, [500.1, 500.2]);

  // New connection → fresh baseline. Stamps are lower (differently-clocked
  // worker) but the stream must not freeze.
  const epochTwo = feed([
    { close: 500.3, server_ts: 4_998 }, // adopted as the new baseline
    { close: 500.35, server_ts: 4_999 },
  ]);
  assert.deepEqual(epochTwo.appliedCloses, [500.3, 500.35]);
});
