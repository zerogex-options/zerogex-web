// The ES / NQ market-data disclosure.
//
// The account is on TradeStation's DELAYED CME package while the real-time
// entitlement is provisioned, so every ES/NQ price on the site runs ~10
// minutes behind the futures market. Equities, the cash indexes, and the
// dealer levels themselves (computed from live SPX/NDX chains) are unaffected.
//
// Two properties matter more than the copy:
//
//  * the terminal badge is driven by the quote's OWN measured age, so it
//    cannot become a lie and clears itself when the feed catches up. A
//    hardcoded "10-minute delay" notice would need a human to take it down,
//    and would be wrong on a real-time feed that had stalled;
//  * the label is coarse. Bar timestamps are start-of-minute, so a steady
//    delay's age sweeps a full minute every minute — a per-minute label would
//    flicker between two values while nothing changed.
import test from "node:test";
import assert from "node:assert/strict";

import {
  FUTURES_REALTIME_PENDING,
  futuresDelayLabel,
  futuresDelayNote,
} from "../core/futuresDataStatus.ts";

test("a steady ~10 minute lag reads as one stable label", () => {
  // The age of the newest bar sweeps its own minute as the clock advances.
  // Every sample of a 10-minute delay must produce the same words.
  for (const seconds of [600, 615, 630, 645, 660, 690, 720]) {
    assert.equal(futuresDelayLabel(seconds), "~10 MIN DELAY", `${seconds}s`);
  }
});

test("a worse lag is reported honestly, not clamped to the expected one", () => {
  // This is why the badge is measured rather than hardcoded: if a real-time
  // feed dies, the badge must say so instead of repeating "10 minutes".
  assert.equal(futuresDelayLabel(1500), "~25 MIN DELAY");
  assert.equal(futuresDelayLabel(3600), "~60 MIN DELAY");
});

test("a small lag never claims to be smaller than the floor", () => {
  assert.equal(futuresDelayLabel(200), "~5 MIN DELAY");
});

test("a fresh feed is not described with a minute count", () => {
  // Under two minutes is a normal start-of-minute bar age, not a delay worth
  // a number. The badge only renders when the API flags `stale` anyway.
  assert.equal(futuresDelayLabel(30), "DELAYED");
  assert.equal(futuresDelayLabel(119), "DELAYED");
});

test("a missing age still discloses rather than silently rendering nothing", () => {
  assert.equal(futuresDelayLabel(null), "DELAYED");
  assert.equal(futuresDelayLabel(undefined), "DELAYED");
  assert.equal(futuresDelayLabel(Number.NaN), "DELAYED");
});

test("the static-page note names the symbol and is gated by the one switch", () => {
  const note = futuresDelayNote("ES");
  if (FUTURES_REALTIME_PENDING) {
    assert.ok(note.includes("ES"), note);
    assert.ok(/delayed CME feed/.test(note), note);
    // It must say the levels are NOT affected — that distinction is the whole
    // point of the projection design and the most likely thing to misread.
    assert.ok(/levels themselves are unaffected/.test(note), note);
  } else {
    // Flipping FUTURES_REALTIME_PENDING must remove the prose everywhere at
    // once, with no second place to remember.
    assert.equal(note, "");
  }
});
