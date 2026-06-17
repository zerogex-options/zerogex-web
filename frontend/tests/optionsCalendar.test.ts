// Smoke test for optionsCalendar date math.
//
// Verifies that the 3rd-Friday, quarter-end, and VIX-expiration calculations
// match well-known calendar facts, and that the urgency thresholds map to the
// right colors (gray ≥3d out, amber tomorrow, coral today).
import test from "node:test";
import assert from "node:assert/strict";

import {
  getUpcomingOptionsEvents,
  parseNyseHolidays,
  urgencyForDaysUntil,
} from "../core/optionsCalendar.ts";

// Same list documented in .env.example — used to drive the holiday-aware
// behavior tests below. Trimmed to the years we care about.
const SAMPLE_HOLIDAYS_2026_2027 =
  "2026-01-01,2026-01-19,2026-02-16,2026-04-03,2026-05-25,2026-06-19,2026-07-03,2026-09-07,2026-11-26,2026-12-25," +
  "2027-01-01,2027-01-18,2027-02-15,2027-03-26,2027-05-31,2027-06-18,2027-07-05,2027-09-06,2027-11-25,2027-12-24";

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

test("parseNyseHolidays handles comma list, trims junk, infers names", () => {
  const list = parseNyseHolidays(SAMPLE_HOLIDAYS_2026_2027);
  const byDate = new Map(list.map((h) => [h.isoDate, h.name] as const));
  assert.equal(byDate.get("2026-01-01"), "New Year's Day");
  assert.equal(byDate.get("2026-01-19"), "MLK Day");
  assert.equal(byDate.get("2026-02-16"), "Presidents Day");
  assert.equal(byDate.get("2026-04-03"), "Good Friday");
  assert.equal(byDate.get("2026-05-25"), "Memorial Day");
  assert.equal(byDate.get("2026-06-19"), "Juneteenth");
  assert.equal(byDate.get("2026-07-03"), "Independence Day");
  assert.equal(byDate.get("2026-09-07"), "Labor Day");
  assert.equal(byDate.get("2026-11-26"), "Thanksgiving");
  assert.equal(byDate.get("2026-12-25"), "Christmas");
  assert.equal(byDate.get("2027-05-31"), "Memorial Day");
  assert.equal(byDate.get("2027-06-18"), "Juneteenth");
});

test("parseNyseHolidays returns [] for empty / malformed input", () => {
  assert.deepEqual(parseNyseHolidays(undefined), []);
  assert.deepEqual(parseNyseHolidays(""), []);
  assert.deepEqual(
    parseNyseHolidays("not-a-date, 2026-13-40, 2026-01-01").map((h) => h.isoDate),
    ["2026-01-01"],
  );
});

test("Juneteenth on the 3rd Friday shifts Quad Witching back to Thursday", () => {
  // 2026-06-19 is both Juneteenth and the 3rd Friday → Quad Witching should
  // land on Thursday 2026-06-18 instead of the closed Friday.
  const events = getUpcomingOptionsEvents({
    now: noonET(2026, 6, 1),
    lookAheadDays: 45,
    maxEvents: 32,
    holidays: SAMPLE_HOLIDAYS_2026_2027.split(","),
  });
  const witching = events.find((e) => e.kind === "quad-witching");
  assert.ok(witching, "expected Quad Witching in June 2026 window");
  assert.equal(witching.isoDate, "2026-06-18");

  // Same date collision in 2027 (Juneteenth observed on Friday June 18).
  const events2027 = getUpcomingOptionsEvents({
    now: noonET(2027, 6, 1),
    lookAheadDays: 45,
    maxEvents: 32,
    holidays: SAMPLE_HOLIDAYS_2026_2027.split(","),
  });
  const witching2027 = events2027.find((e) => e.kind === "quad-witching");
  assert.ok(witching2027, "expected Quad Witching in June 2027 window");
  assert.equal(witching2027.isoDate, "2027-06-17");
});

test("Memorial Day landing on the last weekday of May shifts month-end back", () => {
  // 2027-05-31 is both Memorial Day (last Monday of May) and the last
  // weekday of May → Month End should fall on Friday 2027-05-28.
  const events = getUpcomingOptionsEvents({
    now: noonET(2027, 5, 1),
    lookAheadDays: 45,
    maxEvents: 32,
    holidays: SAMPLE_HOLIDAYS_2026_2027.split(","),
  });
  const monthEnd = events.find((e) => e.kind === "month-end");
  assert.ok(monthEnd, "expected Month End in May 2027 window");
  assert.equal(monthEnd.isoDate, "2027-05-28");
});

test("upcoming NYSE holidays surface as their own calendar entries", () => {
  // Two days before Juneteenth 2026, the holiday should appear in the
  // upcoming list (and Quad Witching for the shifted Thursday too).
  const events = getUpcomingOptionsEvents({
    now: noonET(2026, 6, 17),
    lookAheadDays: 10,
    maxEvents: 16,
    holidays: SAMPLE_HOLIDAYS_2026_2027.split(","),
  });
  const holiday = events.find(
    (e) => e.kind === "nyse-holiday" && e.isoDate === "2026-06-19",
  );
  assert.ok(holiday, "expected Juneteenth as an nyse-holiday entry");
  assert.match(holiday.label, /Juneteenth/);
  assert.equal(holiday.daysUntil, 2);
});

test("disabling holiday awareness restores the legacy Friday witching date", () => {
  // With holidays: [] override, the unaware behavior puts Quad Witching
  // on the nominal 3rd Friday even though it's a market closure day.
  const events = getUpcomingOptionsEvents({
    now: noonET(2026, 6, 1),
    lookAheadDays: 45,
    maxEvents: 32,
    holidays: [],
  });
  const witching = events.find((e) => e.kind === "quad-witching");
  assert.ok(witching);
  assert.equal(witching.isoDate, "2026-06-19");
});
