// Fixtures for the shared price/change calcs in core/priceChange.ts.
//
// getPrimaryPriceChangeSummary — the default reading is the "official close":
// in pre-market / after-hours it shows current_session_close (the header pairs
// that with a separate live row; the metric cards show it alone). Opting in
// with preferLiveExtendedHours makes displayPrice follow the live quote close,
// so a price marker riding it (the Gamma Chart's tape/marker) stays on the live
// extended tape. When that reading's change is read, the baseline is the most
// recent COMPLETED regular close — current_session_close in pre-market,
// prior_session_close in after-hours — so it's continuous across both the 09:30
// and 16:00 session flips.
//
// getExtendedHoursRow — the ETF-only second line: live extended price vs the
// most-recent cash close (current_session_close), TradingView's pre/post basis.
import test from "node:test";
import assert from "node:assert/strict";

import { getPrimaryPriceChangeSummary, getExtendedHoursRow } from "../core/priceChange.ts";
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

test("pre-market, DEFAULT → frozen regular close (symmetry with after-hours default)", () => {
  const r = getPrimaryPriceChangeSummary({
    quoteClose: 746.0, // live pre-market — ignored by default
    quoteSession: "pre-market",
    sessionCloses: closes(747.0, 745.0),
  });
  assert.equal(r.displayPrice, 747.0); // current_session_close (last regular close)
  assert.equal(r.change, 2.0); // 747.00 − 745.00, the row-1 last-session change
  assert.equal(r.isPositive, true);
});

test("pre-market, FLAG ON → live quote vs current_session_close (most recent close)", () => {
  // Pre-market's most recent COMPLETED regular close is current_session_close
  // (today hasn't closed yet); prior_session_close is two sessions back. The
  // baseline must be current — using prior is an off-by-one session that can
  // render a down tape as green. Here the tape is BELOW yesterday's close.
  const r = getPrimaryPriceChangeSummary({
    quoteClose: 746.0, // live pre-market, under yesterday's 747.00 close
    quoteSession: "pre-market",
    sessionCloses: closes(747.0 /* yesterday's close */, 745.0 /* two sessions back */),
    preferLiveExtendedHours: true,
  });
  assert.equal(r.displayPrice, 746.0);
  assert.equal(r.change, -1.0); // 746.00 − 747.00, NOT 746.00 − 745.00 (+1.0)
  approx(r.changePercent, (-1.0 / 747.0) * 100);
  assert.equal(r.isPositive, false); // down on the tape → red, not green
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

test("FLAG ON → change is continuous across the 09:30 pre-market→open flip", () => {
  // current_session_close (the most recent close) is unchanged from pre-market
  // into the cash session, so the same live price P must yield the same change
  // on both sides of 09:30 — no jump when the label flips to open.
  const P = 746.0;
  const preMarket = getPrimaryPriceChangeSummary({
    quoteClose: P,
    quoteSession: "pre-market",
    sessionCloses: closes(747.0 /* current = yesterday's close */, 745.0),
    preferLiveExtendedHours: true,
  });
  const open = getPrimaryPriceChangeSummary({
    quoteClose: P,
    quoteSession: "open",
    sessionCloses: closes(747.0 /* current = yesterday's close, unchanged */, 745.0),
    preferLiveExtendedHours: true,
  });
  assert.equal(preMarket.displayPrice, open.displayPrice);
  assert.equal(preMarket.change, open.change);
  assert.equal(open.change, -1.0);
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
  for (const quoteSession of ["closed", "closed-weekend", "closed-holiday"]) {
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

// ── getExtendedHoursRow ─────────────────────────────────────────────────────
// The second line under the ETF quote in pre-market / after-hours: the live
// extended price vs the MOST-RECENT cash close (current_session_close), which
// is TradingView's pre/post-market change basis.

test("extended row: after-hours up vs most-recent (today's) close", () => {
  // Today closed at 749.00; after-hours trading at 750.50 → +1.50 vs the close.
  const r = getExtendedHoursRow(750.5, 749.0);
  assert.equal(r.price, 750.5);
  approx(r.change as number, 1.5);
  approx(r.changePercent as number, (1.5 / 749.0) * 100);
  assert.equal(r.isPositive, true);
});

test("extended row: pre-market down vs most-recent (yesterday's) close", () => {
  // In pre-market the most-recent cash close is yesterday's 4 PM (746.00);
  // pre-market at 744.00 → −2.00, NOT measured against the day-before.
  const r = getExtendedHoursRow(744.0, 746.0);
  assert.equal(r.price, 744.0);
  approx(r.change as number, -2.0);
  approx(r.changePercent as number, (-2.0 / 746.0) * 100);
  assert.equal(r.isPositive, false);
});

test("extended row: missing inputs → all null, isPositive false (caller hides row)", () => {
  for (const [q, c] of [[null, 749.0], [750.5, null], [null, null], [undefined, undefined]] as const) {
    const r = getExtendedHoursRow(q, c);
    assert.equal(r.change, null);
    assert.equal(r.changePercent, null);
    assert.equal(r.isPositive, false);
  }
});

test("extended row: exactly flat → zero change counts as positive (green)", () => {
  const r = getExtendedHoursRow(749.0, 749.0);
  assert.equal(r.change, 0);
  assert.equal(r.changePercent, 0);
  assert.equal(r.isPositive, true);
});
