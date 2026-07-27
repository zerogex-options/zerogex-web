// Fixtures for the shared headline price/change calc (getPrimaryPriceChangeSummary).
//
// The bug this guards against: on the Gamma Chart, which draws the live
// pre-market / after-hours tape inline, the headline price + change froze on
// the regular-session 4 PM close while the candles beside it kept moving — so
// the quote looked stuck relative to the chart in extended-hours sessions.
//
// The default reading (used by the header row-1 and the metric cards, which
// pair it with a SEPARATE live extended-hours row) must be unchanged: in
// extended hours it still shows current_session_close. Opting in with
// preferLiveExtendedHours routes the extended-hours headline to the live quote
// close so it tracks the tape; the change baseline stays prior_session_close,
// so the value is continuous across the 16:00 flip.
import test from "node:test";
import assert from "node:assert/strict";

import { getPrimaryPriceChangeSummary } from "../core/priceChange.ts";
import type { SessionClosesData } from "../hooks/useApiData.ts";

// Build a SessionClosesData with the two closes the calc reads. `current` and
// `prior` mean different calendar days per session (see the field docs), so
// each test supplies the values appropriate to the session it exercises.
function closes(current: number, prior: number): SessionClosesData {
  return {
    symbol: "SPY",
    current_session_close: current,
    current_session_close_ts: "2026-07-23T20:00:00Z",
    prior_session_close: prior,
    prior_session_close_ts: "2026-07-22T20:00:00Z",
  };
}

const approx = (actual: number | null, expected: number, eps = 1e-9) => {
  assert.notEqual(actual, null);
  assert.ok(Math.abs((actual as number) - expected) < eps, `${actual} ≈ ${expected}`);
};

test("open session → live quote vs current_session_close (flag has no effect)", () => {
  // During the cash session current_session_close is the previous (yesterday's)
  // close. Change is live-vs-previous, and the flag is irrelevant here.
  for (const preferLiveExtendedHours of [false, true]) {
    const r = getPrimaryPriceChangeSummary({
      quoteClose: 748.5,
      quoteSession: "open",
      sessionCloses: closes(747.0, 745.0),
      preferLiveExtendedHours,
    });
    assert.equal(r.displayPrice, 748.5);
    assert.equal(r.change, 1.5);
    approx(r.changePercent, (1.5 / 747.0) * 100);
    assert.equal(r.isPositive, true);
  }
});

test("after-hours, DEFAULT → frozen regular close (header row-1 / card behavior preserved)", () => {
  // The regression guard: callers that want the official 4 PM close (paired
  // with a separate live extended-hours row) must keep getting it.
  const r = getPrimaryPriceChangeSummary({
    quoteClose: 750.5, // live after-hours print — deliberately ignored here
    quoteSession: "after-hours",
    sessionCloses: closes(749.0 /* today's 4 PM close */, 747.0 /* yesterday */),
  });
  assert.equal(r.displayPrice, 749.0);
  assert.equal(r.change, 2.0); // 749.00 − 747.00, the frozen regular-session change
  assert.equal(r.isPositive, true);
});

test("after-hours, FLAG ON → headline tracks the live tape", () => {
  // The fix: the Gamma Chart's headline follows the live after-hours quote,
  // measured against yesterday's close so it stays continuous with the day.
  const r = getPrimaryPriceChangeSummary({
    quoteClose: 750.5, // live after-hours
    quoteSession: "after-hours",
    sessionCloses: closes(749.0, 747.0),
    preferLiveExtendedHours: true,
  });
  assert.equal(r.displayPrice, 750.5); // NOT the frozen 749.00
  assert.equal(r.change, 3.5); // 750.50 − 747.00 (vs prior close)
  approx(r.changePercent, (3.5 / 747.0) * 100);
  assert.equal(r.isPositive, true);
});

test("after-hours, FLAG ON, price below prior close → negative change", () => {
  const r = getPrimaryPriceChangeSummary({
    quoteClose: 746.0,
    quoteSession: "after-hours",
    sessionCloses: closes(749.0, 747.0),
    preferLiveExtendedHours: true,
  });
  assert.equal(r.displayPrice, 746.0);
  assert.equal(r.change, -1.0);
  assert.equal(r.isPositive, false);
});

test("pre-market, FLAG ON → live pre-market quote vs prior close", () => {
  const r = getPrimaryPriceChangeSummary({
    quoteClose: 746.0, // live pre-market
    quoteSession: "pre-market",
    sessionCloses: closes(747.0, 745.0),
    preferLiveExtendedHours: true,
  });
  assert.equal(r.displayPrice, 746.0);
  assert.equal(r.change, 1.0); // 746.00 − 745.00 (prior_session_close)
  assert.equal(r.isPositive, true);
});

test("FLAG ON → change is continuous across the 16:00 open→after-hours flip", () => {
  // Same live price P and same yesterday's close Y on both sides of 16:00 must
  // yield the same change — no jump when the session label flips.
  const P = 749.0;
  const Y = 747.0;
  const open = getPrimaryPriceChangeSummary({
    quoteClose: P,
    quoteSession: "open",
    sessionCloses: closes(Y /* current = yesterday during the day */, 745.0),
    preferLiveExtendedHours: true,
  });
  const afterHours = getPrimaryPriceChangeSummary({
    quoteClose: P,
    quoteSession: "after-hours",
    sessionCloses: closes(748.0 /* current = today's 4 PM close */, Y /* prior = yesterday */),
    preferLiveExtendedHours: true,
  });
  assert.equal(open.displayPrice, afterHours.displayPrice);
  assert.equal(open.change, afterHours.change);
  assert.equal(open.change, 2.0);
});

test("futures display swap wins even with the flag on", () => {
  // The overnight index→future swap is resolved first and is unaffected by the
  // extended-hours preference.
  const r = getPrimaryPriceChangeSummary({
    quoteClose: 6050.0,
    quoteSession: "after-hours",
    sessionCloses: closes(6040.0, 6030.0),
    displaySource: "futures",
    futuresClose: 6100.25,
    futuresReferenceClose: 6090.0,
    preferLiveExtendedHours: true,
  });
  assert.equal(r.displayPrice, 6100.25); // the future's last price, not quoteClose
  approx(r.change, 10.25);
  assert.equal(r.isPositive, true);
});

test("closed session, FLAG ON → still the regular close (nothing is trading)", () => {
  // The flag only unfreezes extended hours. When the market is fully closed the
  // headline stays on the last regular-session close, matching the candles,
  // which freeze at that print too.
  for (const quoteSession of ["closed", "closed-weekend"]) {
    const r = getPrimaryPriceChangeSummary({
      quoteClose: 750.5, // stale last print
      quoteSession,
      sessionCloses: closes(749.0, 747.0),
      preferLiveExtendedHours: true,
    });
    assert.equal(r.displayPrice, 749.0);
    assert.equal(r.change, 2.0);
  }
});

test("after-hours, FLAG ON but no live quote → graceful fallback to regular close", () => {
  const r = getPrimaryPriceChangeSummary({
    quoteClose: null,
    quoteSession: "after-hours",
    sessionCloses: closes(749.0, 747.0),
    preferLiveExtendedHours: true,
  });
  assert.equal(r.displayPrice, 749.0); // falls back, no crash
  assert.equal(r.change, 2.0);
});
