// Guards the poll loops against a slow connection. A member in Romania reported
// (2026-09-29) rows of canceled price requests and others taking up to 18 s,
// while the API answered their requests in milliseconds. Two loop behaviors
// turned slow round trips into a stalled page: the price poll aborted its
// in-flight request on every 1 s tick, so once a round trip took longer than a
// second no answer ever landed; and the other polls started a new request on
// every tick regardless, so each late request had more stacked behind it.
// pollDecision makes a tick wait for the answer in flight instead, and replaces
// a request only once it has been out long enough to be stuck.
import test from "node:test";
import assert from "node:assert/strict";

import { STALE_POLL_FLOOR_MS, pollDecision, staleAfterMs } from "../core/pollGate.ts";

// ---------------------------------------------------------------------------
// pollDecision
// ---------------------------------------------------------------------------

test("nothing in flight: start", () => {
  assert.equal(pollDecision(null, 1_000, STALE_POLL_FLOOR_MS), "start");
});

test("a late answer is waited for, not stacked on or canceled (the fix)", () => {
  // Out 2.5 s on a 1 s poll: the old loops either sent another or aborted it.
  assert.equal(pollDecision(0, 2_500, STALE_POLL_FLOOR_MS), "skip");
});

test("a request out past the stale threshold is replaced", () => {
  assert.equal(pollDecision(0, STALE_POLL_FLOOR_MS - 1, STALE_POLL_FLOOR_MS), "skip");
  assert.equal(pollDecision(0, STALE_POLL_FLOOR_MS, STALE_POLL_FLOOR_MS), "replace");
});

// ---------------------------------------------------------------------------
// staleAfterMs
// ---------------------------------------------------------------------------

test("fast polls get the 10 s floor", () => {
  assert.equal(staleAfterMs(1_000), STALE_POLL_FLOOR_MS);
  assert.equal(staleAfterMs(0), STALE_POLL_FLOOR_MS);
});

test("slow polls wait three intervals before calling a request stuck", () => {
  assert.equal(staleAfterMs(5_000), 15_000);
  assert.equal(staleAfterMs(60_000), 180_000);
});

// ---------------------------------------------------------------------------
// A 1 s poll against a connection where every round trip takes 2.5 s
// ---------------------------------------------------------------------------

type Outcome = { sent: number; answered: number; maxInFlight: number };

// Ticks once a second for `seconds`. `mode` is how the loop treats a tick that
// finds a request still out: the old price poll aborted it, the old tail polls
// sent another anyway, and the gated loop asks pollDecision.
function simulate(mode: "abort" | "stack" | "gate", latencyMs: number, seconds: number): Outcome {
  let inFlight: { startedAt: number; landsAt: number }[] = [];
  let sent = 0;
  let answered = 0;
  let maxInFlight = 0;
  for (let now = 0; now < seconds * 1_000; now += 1_000) {
    // Answers that land before this tick.
    answered += inFlight.filter((r) => r.landsAt <= now).length;
    inFlight = inFlight.filter((r) => r.landsAt > now);

    const oldest = inFlight.length ? inFlight[0].startedAt : null;
    if (mode === "abort") {
      inFlight = [];
    } else if (mode === "gate") {
      const decision = pollDecision(oldest, now, staleAfterMs(1_000));
      if (decision === "skip") continue;
      if (decision === "replace") inFlight = [];
    }
    inFlight.push({ startedAt: now, landsAt: now + latencyMs });
    sent += 1;
    maxInFlight = Math.max(maxInFlight, inFlight.length);
  }
  answered += inFlight.filter((r) => r.landsAt <= seconds * 1_000).length;
  return { sent, answered, maxInFlight };
}

test("old price poll: at 2.5 s round trips no answer ever lands", () => {
  const { sent, answered } = simulate("abort", 2_500, 30);
  assert.equal(sent, 30);
  assert.equal(answered, 0);
});

test("old tail polls: requests stack three deep", () => {
  const { sent, maxInFlight } = simulate("stack", 2_500, 30);
  assert.equal(sent, 30);
  assert.equal(maxInFlight, 3);
});

test("gated poll: one request at a time, and the answers land", () => {
  const { sent, answered, maxInFlight } = simulate("gate", 2_500, 30);
  assert.equal(maxInFlight, 1);
  assert.equal(sent, 10);
  assert.equal(answered, 10);
});

test("gated poll on a fast connection asks every second, as before", () => {
  const { sent, answered, maxInFlight } = simulate("gate", 200, 30);
  assert.equal(sent, 30);
  assert.equal(answered, 30);
  assert.equal(maxInFlight, 1);
});

test("gated poll replaces a request that never comes back", () => {
  // Stuck forever: replaced at 10 s and 20 s, never stacked.
  const { sent, answered, maxInFlight } = simulate("gate", Number.POSITIVE_INFINITY, 30);
  assert.equal(sent, 3);
  assert.equal(answered, 0);
  assert.equal(maxInFlight, 1);
});
