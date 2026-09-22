// Guards the closed-market reconnect loop behind the header's switching SPY
// quote. The WS stall watchdog forces a reconnect when no server frame lands
// inside STALL_TIMEOUT_MS; it used to be fed by 'quote' frames only, so a
// healthy socket on a closed market — where no quotes is the correct, expected
// state — tripped it every 45 seconds. Each firing reopened the socket and
// re-subscribed, and every subscribe replays the server's cached last tick, so
// the SPY header kept flipping into its after-hours rendering and back out all
// weekend. A pong proves the route is up, which is the only thing this timer
// can actually answer; ingestion-down is covered by useApiData's per-symbol
// WS-live TTL instead, which needs no reconnect.
import test from "node:test";
import assert from "node:assert/strict";

import {
  PING_INTERVAL_MS,
  STALL_TIMEOUT_MS,
  feedsStallWatchdog,
  idlePingSustainsSocket,
} from "../core/streamLiveness.ts";

// ---------------------------------------------------------------------------
// feedsStallWatchdog — which frames prove the route is up
// ---------------------------------------------------------------------------

test("a pong feeds the watchdog (the fix)", () => {
  // The round-trip is the only proof of life available while nothing ticks.
  // Without this the socket reconnected every 45s all night and all weekend.
  assert.equal(feedsStallWatchdog("pong"), true);
});

test("a quote feeds the watchdog", () => {
  assert.equal(feedsStallWatchdog("quote"), true);
});

test("our own subscribe ack does not feed the watchdog", () => {
  // Reconnect churn generates acks itself — counting them would let a
  // half-dead socket keep resetting its own watchdog.
  assert.equal(feedsStallWatchdog("ack"), false);
});

test("the connect handshake does not feed the watchdog", () => {
  // Arming on open already covers it.
  assert.equal(feedsStallWatchdog("welcome"), false);
});

test("a server error is never read as health", () => {
  // It may be reporting exactly the trouble the watchdog should act on.
  assert.equal(feedsStallWatchdog("error"), false);
});

test("an absent or unknown frame type does not feed the watchdog", () => {
  for (const t of [null, undefined, "", "quotes", "QUOTE"]) {
    assert.equal(feedsStallWatchdog(t), false, `unexpectedly fed by ${String(t)}`);
  }
});

// ---------------------------------------------------------------------------
// idlePingSustainsSocket — the timing invariant the loop violated
// ---------------------------------------------------------------------------

test("the shipped constants let a quiet healthy socket survive", () => {
  // If this ever fails, the closed-market reconnect loop is back: pings
  // would no longer arrive often enough to hold the watchdog off.
  assert.equal(idlePingSustainsSocket(), true);
  assert.equal(idlePingSustainsSocket(PING_INTERVAL_MS, STALL_TIMEOUT_MS), true);
});

test("two ping intervals must fit inside the stall window", () => {
  // pingIfIdle skips a tick when a frame landed within the last half
  // interval, so a pong can be a full interval late in the worst case.
  assert.equal(idlePingSustainsSocket(15_000, 45_000), true);
  assert.equal(idlePingSustainsSocket(20_000, 45_000), true);
  assert.equal(idlePingSustainsSocket(25_000, 45_000), false); // 50s > 45s
  assert.equal(idlePingSustainsSocket(30_000, 45_000), false);
});

test("a stall window at or below two ping intervals is rejected", () => {
  // Exactly 2x is not enough — the round-trip itself needs room.
  assert.equal(idlePingSustainsSocket(15_000, 30_000), false);
  assert.equal(idlePingSustainsSocket(15_000, 20_000), false);
});

test("a non-positive ping interval never sustains the socket", () => {
  // A disabled ping means nothing feeds the watchdog on a quiet market.
  assert.equal(idlePingSustainsSocket(0, 45_000), false);
  assert.equal(idlePingSustainsSocket(-1, 45_000), false);
});
