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

test("only after-hours and closed are judged — every other session passes through", () => {
  // Pre-market legitimately carries the previous day's close and the cash session
  // always does. The weekend / holiday labels come from the viewer's clock alone,
  // with no print behind them to judge by.
  for (const session of ["open", "pre-market", "closed-weekend", "closed-holiday", null]) {
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

// ── Cash indexes: 'closed', judged from the last print ─────────────────────
//
// SPX and NDX have no after-hours tape, so the quote endpoint takes them from
// 'open' straight to 'closed' at 16:00:30 ET and the after-hours branch never saw
// them. The reported screen, 16:05 ET Fri 2026-09-25: SPX header "$7,704.23 −2.16"
// — Thursday's close (7,704.13 official) carrying Thursday's change against
// Wednesday (7,706.03) — while the real close was 7,743.41 (+0.51%), which the
// site had already stored as 7,743.50.

const WED_SEP23_CLOSE = "2026-09-23T20:00:00Z"; // Wed Sep 23 16:00 ET
const THU_SEP24_CLOSE = "2026-09-24T20:00:00Z"; // Thu Sep 24 16:00 ET
const FRI_SEP25_CLOSE = "2026-09-25T20:00:00Z"; // Fri Sep 25 16:00 ET
const FRI_SEP25_LAST_BAR = "2026-09-25T19:59:00Z"; // the index's last print, 15:59 bucket

function indexCloses(
  currentTs: string,
  current: number,
  priorTs: string,
  prior: number,
): SessionClosesData {
  return {
    symbol: "SPX",
    current_session_close: current,
    current_session_close_ts: currentTs,
    prior_session_close: prior,
    prior_session_close_ts: priorTs,
  };
}

test("closed: the last print is from a later session than the close → lagging", () => {
  assert.equal(sessionClosesLagBehind("closed", THU_SEP24_CLOSE, FRI_SEP25_LAST_BAR), true);
  assert.equal(sessionClosesLagBehind("closed", THU_SEP24_CLOSE, FRI_SEP25_CLOSE), true);
});

test("closed: the close has rolled to the last print's day → fresh", () => {
  assert.equal(sessionClosesLagBehind("closed", FRI_SEP25_CLOSE, FRI_SEP25_LAST_BAR), false);
  assert.equal(sessionClosesLagBehind("closed", FRI_SEP25_CLOSE, FRI_SEP25_CLOSE), false);
});

test("closed overnight and over a weekend: the last print sits on the close's own day", () => {
  // Why 'closed' could not be judged by the clock: it crosses midnight and the
  // weekend. The print does not move, so a rolled payload stays fresh all the way
  // to Monday's open.
  assert.equal(sessionClosesLagBehind("closed", FRI_SEP25_CLOSE, FRI_SEP25_LAST_BAR), false);
  // And there is no wall-clock fallback: without a print there is no verdict.
  assert.equal(sessionClosesLagBehind("closed", THU_SEP24_CLOSE, null), false);
  assert.equal(sessionClosesLagBehind("closed", THU_SEP24_CLOSE, undefined), false);
});

test("closed: a print before the 09:30 open owes no close", () => {
  // An overnight ETF bar after midnight is dated a day past yesterday's close,
  // and that is expected, not late.
  assert.equal(sessionClosesLagBehind("closed", TUE_CLOSE, "2026-09-02T05:00:00Z"), false); // 01:00
  assert.equal(sessionClosesLagBehind("closed", TUE_CLOSE, "2026-09-02T13:29:00Z"), false); // 09:29
  assert.equal(sessionClosesLagBehind("closed", TUE_CLOSE, "2026-09-02T13:30:00Z"), true); // 09:30
});

test("closed: an ETF's evening print still flags a close that never rolled", () => {
  // From 20:00:30 an ETF is 'closed' too; a 19:59 print a session past the close
  // on offer is the same stale payload, later in the evening.
  const FRI_1959 = "2026-09-25T23:59:00Z";
  assert.equal(sessionClosesLagBehind("closed", THU_SEP24_CLOSE, FRI_1959), true);
  assert.equal(sessionClosesLagBehind("closed", FRI_SEP25_CLOSE, FRI_1959), false);
});

test("closed: missing / unparseable timestamps never flag lagging", () => {
  assert.equal(sessionClosesLagBehind("closed", null, FRI_SEP25_LAST_BAR), false);
  assert.equal(sessionClosesLagBehind("closed", "not-a-date", FRI_SEP25_LAST_BAR), false);
  assert.equal(sessionClosesLagBehind("closed", THU_SEP24_CLOSE, "not-a-date"), false);
});

test("regression: SPX at 16:05 with lagging closes shows today's close vs yesterday's", () => {
  // Served pair at the time of the report: Thursday's close as "current", Wednesday's
  // as "prior". The quote is the index's frozen last print.
  const lagging = indexCloses(THU_SEP24_CLOSE, 7704.23, WED_SEP23_CLOSE, 7706.39);
  const quoteClose = 7743.5;

  const before = getPrimaryPriceChangeSummary({
    quoteClose,
    quoteSession: "closed",
    sessionCloses: lagging,
  });
  // What the header did: Thursday's close billed as today's, with Thursday's change.
  assert.equal(before.displayPrice, 7704.23);
  assert.equal(Number(before.change?.toFixed(2)), -2.16);

  const after = getPrimaryPriceChangeSummary({
    quoteClose,
    quoteSession: resolvePriceSession("closed", lagging, FRI_SEP25_LAST_BAR),
    sessionCloses: lagging,
  });
  assert.equal(after.displayPrice, 7743.5);
  assert.equal(Number(after.change?.toFixed(2)), 39.27);
  assert.equal(Number(after.changePercent?.toFixed(2)), 0.51);
  assert.equal(after.isPositive, true);

  // Once the payload rolls, the frozen-close reading returns with the same numbers:
  // the index's last print IS its close.
  const rolled = indexCloses(FRI_SEP25_CLOSE, 7743.5, THU_SEP24_CLOSE, 7704.23);
  assert.equal(resolvePriceSession("closed", rolled, FRI_SEP25_LAST_BAR), "closed");
  const settled = getPrimaryPriceChangeSummary({
    quoteClose,
    quoteSession: "closed",
    sessionCloses: rolled,
  });
  assert.equal(settled.displayPrice, 7743.5);
  assert.equal(Number(settled.change?.toFixed(2)), 39.27);
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
