// Fixtures for the public /chart delayed-quote repair (resolveDelayedQuote).
//
// The bug this guards against: just after the 09:30 open, the separately-cached
// /api/market/quote can still read session:'closed' with the prior day's 4 PM
// close, so the delayed headline froze on yesterday's close with yesterday's
// whole-day change — while the candles beside it already showed today's tape.
// During the cash session the readout must instead anchor to the freshest
// delayed BAR; outside it, the served quote is authoritative and untouched.
import test from "node:test";
import assert from "node:assert/strict";

import { resolveDelayedQuote } from "../core/delayedQuote.ts";

// A realistic "stale overnight quote" — yesterday's 4 PM close, still flagged
// closed — paired with a fresh delayed bar from early in today's session.
const STALE_CLOSED_QUOTE = {
  quoteClose: 747.39, // yesterday's regular-session close
  quoteSession: "closed",
  quoteTimestamp: "2026-07-22T20:00:00Z", // 16:00 ET prior day
  displaySource: null,
} as const;

const TODAY_BAR = {
  lastBarClose: 748.61, // today's delayed print (~09:32 ET)
  lastBarTimestamp: "2026-07-23T13:30:00Z", // 09:30 ET today
} as const;

test("cash session + stale closed quote → unfreezes onto the delayed tape", () => {
  const r = resolveDelayedQuote({ ...STALE_CLOSED_QUOTE, ...TODAY_BAR, marketNow: "open" });
  // The whole point: NOT 747.39/closed. Price, session and the "as of" stamp all
  // come from the fresh bar, so the headline reads today's delayed intraday move.
  assert.equal(r.close, 748.61);
  assert.equal(r.session, "open");
  assert.equal(r.timestamp, "2026-07-23T13:30:00Z");
});

test("cash session + already-fresh quote → still anchors to the bar (matches candles)", () => {
  const r = resolveDelayedQuote({
    quoteClose: 748.55,
    quoteSession: "open",
    quoteTimestamp: "2026-07-23T13:32:07Z",
    displaySource: null,
    ...TODAY_BAR,
    marketNow: "open",
  });
  // Price + timestamp stay coupled to the bar so the "as of" line never labels a
  // number the candles don't show.
  assert.equal(r.close, 748.61);
  assert.equal(r.session, "open");
  assert.equal(r.timestamp, "2026-07-23T13:30:00Z");
});

test("cash session + futures display swap → passed through untouched", () => {
  // The index→future swap only happens overnight, but if the flag is set we must
  // not clobber it with the cash tape.
  const r = resolveDelayedQuote({
    quoteClose: 6100.25,
    quoteSession: "futures",
    quoteTimestamp: "2026-07-23T13:30:00Z",
    displaySource: "futures",
    ...TODAY_BAR,
    marketNow: "open",
  });
  assert.equal(r.close, 6100.25);
  assert.equal(r.session, "futures");
  assert.equal(r.timestamp, "2026-07-23T13:30:00Z");
});

test("cash session but no delayed bar close → falls back to served quote", () => {
  const r = resolveDelayedQuote({
    ...STALE_CLOSED_QUOTE,
    lastBarClose: null,
    lastBarTimestamp: null,
    marketNow: "open",
  });
  assert.equal(r.close, 747.39);
  assert.equal(r.session, "closed");
  assert.equal(r.timestamp, "2026-07-22T20:00:00Z");
});

test("after-hours → served quote is authoritative (today's close, not the tape)", () => {
  // Viewing the delayed chart in the evening should keep showing the served
  // after-hours quote, not overwrite it with a stale bar.
  const r = resolveDelayedQuote({
    quoteClose: 749.10,
    quoteSession: "after-hours",
    quoteTimestamp: "2026-07-23T21:15:00Z",
    displaySource: null,
    lastBarClose: 748.90,
    lastBarTimestamp: "2026-07-23T21:10:00Z",
    marketNow: "after-hours",
  });
  assert.equal(r.close, 749.10);
  assert.equal(r.session, "after-hours");
  assert.equal(r.timestamp, "2026-07-23T21:15:00Z");
});

test("weekend → served quote is authoritative", () => {
  const r = resolveDelayedQuote({
    ...STALE_CLOSED_QUOTE,
    lastBarClose: 748.61,
    lastBarTimestamp: "2026-07-24T20:00:00Z",
    marketNow: "closed-weekend",
  });
  assert.equal(r.close, 747.39);
  assert.equal(r.session, "closed");
});

test("repaired stamp falls back to the quote timestamp when the bar has none", () => {
  const r = resolveDelayedQuote({
    ...STALE_CLOSED_QUOTE,
    lastBarClose: 748.61,
    lastBarTimestamp: null,
    marketNow: "open",
  });
  assert.equal(r.close, 748.61);
  assert.equal(r.session, "open");
  assert.equal(r.timestamp, "2026-07-22T20:00:00Z");
});
