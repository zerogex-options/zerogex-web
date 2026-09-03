// Fixtures for core/sessionCloses.ts — the 16:00 ET flip repair.
//
// /api/market/session-closes advances `current_session_close` from yesterday's
// close to today's when the bell rings, but today's close only lands once the
// closing auction settles upstream. Until it does, the payload is still the
// PRE-flip pair while quote.session already reads 'after-hours' — and read with
// the after-hours convention that renders a whole session late (the reported
// bug: SPY headline "$761.65 −5.30 (−0.69%)" at 16:04, yesterday's close with
// yesterday's day change, beside a live after-hours row measuring +3.64 off that
// same stale close). resolvePriceSession reads a lagging payload as the
// open-session shape it actually is.
import test from "node:test";
import assert from "node:assert/strict";

import { sessionClosesLagBehind, resolvePriceSession } from "../core/sessionCloses.ts";
import { getPrimaryPriceChangeSummary, getExtendedHoursRow } from "../core/priceChange.ts";
import type { SessionClosesData } from "../hooks/useApiData.ts";

function closes(currentTs: string, current: number, prior: number): SessionClosesData {
  return {
    symbol: "SPY",
    current_session_close: current,
    current_session_close_ts: currentTs,
    prior_session_close: prior,
    prior_session_close_ts: "2026-09-01T20:00:00Z",
  };
}

// 16:00 ET on the two sessions in play (ET is UTC−4 in September).
const TUE_CLOSE = "2026-09-01T20:00:00Z"; // Tue Sep 1, yesterday
const WED_CLOSE = "2026-09-02T20:00:00Z"; // Wed Sep 2, today
const WED_1604 = "2026-09-02T20:04:00Z"; // the moment in the report

// ── sessionClosesLagBehind ──────────────────────────────────────────────────

test("after-hours carrying yesterday's close → lagging", () => {
  assert.equal(sessionClosesLagBehind("after-hours", TUE_CLOSE, WED_1604), true);
});

test("after-hours carrying today's close → fresh", () => {
  assert.equal(sessionClosesLagBehind("after-hours", WED_CLOSE, WED_1604), false);
});

test("only after-hours is judged — every other session passes through", () => {
  // Pre-market legitimately carries the previous day's close, the cash session
  // always does, and the overnight 'closed' state crosses midnight (where an
  // earlier date is expected, not late). None is decidable from the calendar.
  for (const session of ["open", "pre-market", "closed", "closed-weekend", "closed-holiday", null]) {
    assert.equal(sessionClosesLagBehind(session, TUE_CLOSE, WED_1604), false, `${session}`);
  }
});

test("a close stamped ahead of the reference is clock skew, not a stale payload", () => {
  assert.equal(sessionClosesLagBehind("after-hours", WED_CLOSE, TUE_CLOSE), false);
});

test("missing / unparseable timestamps never flag lagging", () => {
  assert.equal(sessionClosesLagBehind("after-hours", null, WED_1604), false);
  assert.equal(sessionClosesLagBehind("after-hours", "not-a-date", WED_1604), false);
});

// ── resolvePriceSession ─────────────────────────────────────────────────────

test("a lagging after-hours payload is read as the open-session shape it is", () => {
  assert.equal(resolvePriceSession("after-hours", closes(TUE_CLOSE, 761.65, 766.95), WED_1604), "open");
});

test("a fresh payload passes its session through untouched", () => {
  assert.equal(resolvePriceSession("after-hours", closes(WED_CLOSE, 765.14, 761.65), WED_1604), "after-hours");
  assert.equal(resolvePriceSession("open", closes(TUE_CLOSE, 761.65, 766.95), "2026-09-02T15:00:00Z"), "open");
  assert.equal(resolvePriceSession(null, closes(TUE_CLOSE, 761.65, 766.95), WED_1604), null);
});

// ── End to end: the reported header at 16:04 ────────────────────────────────

test("regression: 16:04 with lagging closes shows the live print vs the previous close", () => {
  // Served state at the time of the report: session flipped, closes did not.
  const lagging = closes(TUE_CLOSE, 761.65, 766.95);
  const quoteClose = 765.29; // live after-hours print

  const before = getPrimaryPriceChangeSummary({
    quoteClose,
    quoteSession: "after-hours",
    sessionCloses: lagging,
  });
  // What the header did: yesterday's close billed as today's price, carrying
  // yesterday's whole-day change.
  assert.equal(before.displayPrice, 761.65);
  assert.equal(Number(before.change?.toFixed(2)), -5.3);

  const after = getPrimaryPriceChangeSummary({
    quoteClose,
    quoteSession: resolvePriceSession("after-hours", lagging, WED_1604),
    sessionCloses: lagging,
  });
  // What it does now: the live print against the previous close — the same day
  // change the header showed at 15:59, still tracking the tape. It differs from
  // the official close's day change only by the after-hours drift since 16:00.
  assert.equal(after.displayPrice, 765.29);
  assert.equal(Number(after.change?.toFixed(2)), 3.64);
  assert.equal(Number(after.changePercent?.toFixed(2)), 0.48);
  assert.equal(after.isPositive, true);
});

test("the extended-hours row is dropped while the closes lag, and returns when they roll", () => {
  const lagging = closes(TUE_CLOSE, 761.65, 766.95);
  // The header gates row 2 on the resolved session, so a lagging payload never
  // renders a row whose baseline — today's close — is exactly what is missing.
  const laggingSession = resolvePriceSession("after-hours", lagging, WED_1604);
  assert.equal(laggingSession === "pre-market" || laggingSession === "after-hours", false);

  // Once today's close rolls in, the frozen-close headline and its separate live
  // row both come back, now measured off the right close: today's 765.14 against
  // yesterday's 761.65, with the live 765.29 print measured against today's close.
  const rolled = closes(WED_CLOSE, 765.14, 761.65);
  assert.equal(resolvePriceSession("after-hours", rolled, WED_1604), "after-hours");
  const row1 = getPrimaryPriceChangeSummary({
    quoteClose: 765.29,
    quoteSession: "after-hours",
    sessionCloses: rolled,
  });
  assert.equal(row1.displayPrice, 765.14);
  assert.equal(Number(row1.change?.toFixed(2)), 3.49);
  assert.equal(Number(row1.changePercent?.toFixed(2)), 0.46);
  const row2 = getExtendedHoursRow(765.29, rolled.current_session_close);
  assert.equal(Number(row2.change?.toFixed(2)), 0.15);
});
