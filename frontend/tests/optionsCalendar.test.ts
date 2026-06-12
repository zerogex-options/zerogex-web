// Smoke test for optionsCalendar date math.
//
// Verifies that the 3rd-Friday, quarter-end, and VIX-expiration calculations
// match well-known calendar facts, and that the urgency thresholds map to the
// right colors (gray ≥3d out, amber tomorrow, coral today).
import test from "node:test";
import assert from "node:assert/strict";

import {
  getUpcomingOptionsEvents,
  urgencyForDaysUntil,
} from "../core/optionsCalendar.ts";

// "now" is anchored at noon ET to avoid DST-edge surprises.
function noonET(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 17, 0, 0));
}

test("urgencyForDaysUntil maps thresholds correctly", () => {
  assert.equal(urgencyForDaysUntil(0), "today");
  assert.equal(urgencyForDaysUntil(-1), "today");
  assert.equal(urgencyForDaysUntil(1), "tomorrow");
  assert.equal(urgencyForDaysUntil(2), "soon");
  assert.equal(urgencyForDaysUntil(3), "soon");
  assert.equal(urgencyForDaysUntil(4), "later");
  assert.equal(urgencyForDaysUntil(30), "later");
});

test("quad witching dates land on known 3rd Fridays of Mar/Jun/Sep/Dec 2026", () => {
  // The function scans current month + next 2 months, so we pin "now" to
  // March 1, 2026 to catch the March 20 witching, and again to June 1 for the
  // June 19 witching.
  const eventsMarch = getUpcomingOptionsEvents({
    now: noonET(2026, 3, 1),
    lookAheadDays: 45,
    maxEvents: 32,
  });
  const witchingMar = eventsMarch
    .filter((e) => e.kind === "quad-witching")
    .map((e) => e.isoDate);
  assert.deepEqual(witchingMar, ["2026-03-20"]);

  const eventsJune = getUpcomingOptionsEvents({
    now: noonET(2026, 6, 1),
    lookAheadDays: 45,
    maxEvents: 32,
  });
  const witchingJun = eventsJune
    .filter((e) => e.kind === "quad-witching")
    .map((e) => e.isoDate);
  assert.deepEqual(witchingJun, ["2026-06-19"]);
});

test("monthly OPEX falls on the 3rd Friday of non-witching months", () => {
  const events = getUpcomingOptionsEvents({
    now: noonET(2026, 1, 1),
    lookAheadDays: 120,
    maxEvents: 64,
  });
  const opex = events.filter((e) => e.kind === "opex").map((e) => e.isoDate);
  // Jan/Feb/Apr 2026 OPEX: 3rd Fridays.
  assert.ok(opex.includes("2026-01-16"), `expected Jan OPEX in ${opex.join(",")}`);
  assert.ok(opex.includes("2026-02-20"), `expected Feb OPEX in ${opex.join(",")}`);
});

test("VIX expiration is the Wednesday 30 days before next month's 3rd Friday", () => {
  // 3rd Friday of June 2026 is 2026-06-19. 30 days earlier is 2026-05-20 (Wed).
  const events = getUpcomingOptionsEvents({
    now: noonET(2026, 5, 1),
    lookAheadDays: 60,
    maxEvents: 64,
  });
  const vix = events.filter((e) => e.kind === "vix-expiration").map((e) => e.isoDate);
  assert.ok(vix.includes("2026-05-20"), `expected May VIX-exp on 2026-05-20, got ${vix.join(",")}`);
});

test("quarter-end + JPM collar share the last weekday of Mar/Jun/Sep/Dec", () => {
  const events = getUpcomingOptionsEvents({
    now: noonET(2026, 3, 1),
    lookAheadDays: 60,
    maxEvents: 64,
  });
  const qend = events.find((e) => e.kind === "quarter-end");
  const jpm = events.find((e) => e.kind === "jpm-collar");
  assert.ok(qend, "expected a quarter-end entry");
  assert.ok(jpm, "expected a jpm-collar entry");
  // March 31, 2026 is a Tuesday — last weekday of March.
  assert.equal(qend.isoDate, "2026-03-31");
  assert.equal(jpm.isoDate, "2026-03-31");
});

test("daysUntil reflects today/tomorrow/soon correctly", () => {
  // Pin "now" to two days before the Jan 16 2026 OPEX (Wed Jan 14).
  const events = getUpcomingOptionsEvents({
    now: noonET(2026, 1, 14),
    lookAheadDays: 30,
    maxEvents: 16,
  });
  const opex = events.find((e) => e.isoDate === "2026-01-16" && e.kind === "opex");
  assert.ok(opex, "expected Jan OPEX in look-ahead window");
  assert.equal(opex.daysUntil, 2);
  assert.equal(urgencyForDaysUntil(opex.daysUntil), "soon");
});

test("events are sorted by daysUntil ascending", () => {
  const events = getUpcomingOptionsEvents({
    now: noonET(2026, 1, 1),
    lookAheadDays: 90,
    maxEvents: 32,
  });
  for (let i = 1; i < events.length; i++) {
    assert.ok(
      events[i].daysUntil >= events[i - 1].daysUntil,
      `events out of order at ${i}: ${events[i - 1].daysUntil} → ${events[i].daysUntil}`,
    );
  }
});
