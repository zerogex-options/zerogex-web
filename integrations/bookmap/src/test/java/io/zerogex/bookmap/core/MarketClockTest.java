package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.time.LocalDate;

public class MarketClockTest {

    @Test
    public void parsesEveryTimestampShapeTheApiSends() {
        long expected = Fixtures.et(2026, 7, 6, 15, 30);
        Check.eq(expected, MarketClock.parseIso("2026-07-06T19:30:00Z"), "Z");
        Check.eq(expected, MarketClock.parseIso("2026-07-06T19:30:00+00:00"), "+00:00");
        Check.eq(expected, MarketClock.parseIso("2026-07-06T15:30:00-04:00"), "offset");
        Check.eq(expected, MarketClock.parseIso("2026-07-06T19:30:00"), "naive is UTC");
        Check.eq(expected + 123_456_000L, MarketClock.parseIso("2026-07-06T19:30:00.123456+00:00"), "micros");
        Check.eq(MarketClock.NONE, MarketClock.parseIso("garbage"), "garbage");
        Check.eq(MarketClock.NONE, MarketClock.parseIso(null), "null");
    }

    @Test
    public void formatsQueryTimesInTheFormPythonAccepts() {
        Check.eq("2026-07-06T19:30:00+00:00",
                MarketClock.isoUtc(Fixtures.et(2026, 7, 6, 15, 30) + 999_999_999L), "whole seconds, explicit offset");
        Check.eq("1969-12-31T23:59:59+00:00", MarketClock.isoUtc(-1L), "floors, never rounds toward zero");
    }

    @Test
    public void latestSessionIsTheOneInProgressOrLastOpened() {
        // Tue Nov 10 2026
        Check.eq(LocalDate.of(2026, 11, 10), MarketClock.latestSessionDate(Fixtures.et(2026, 11, 10, 11, 0)), "in session");
        Check.eq(LocalDate.of(2026, 11, 10), MarketClock.latestSessionDate(Fixtures.et(2026, 11, 10, 18, 0)), "evening");
        Check.eq(LocalDate.of(2026, 11, 9), MarketClock.latestSessionDate(Fixtures.et(2026, 11, 10, 8, 0)), "pre-market");
        // Sat Nov 14 / Sun Nov 15 / Mon Nov 16 pre-open -> Fri Nov 13
        Check.eq(LocalDate.of(2026, 11, 13), MarketClock.latestSessionDate(Fixtures.et(2026, 11, 14, 12, 0)), "Saturday");
        Check.eq(LocalDate.of(2026, 11, 13), MarketClock.latestSessionDate(Fixtures.et(2026, 11, 15, 19, 0)), "Sunday night");
        Check.eq(LocalDate.of(2026, 11, 13), MarketClock.latestSessionDate(Fixtures.et(2026, 11, 16, 9, 29)), "Monday 9:29");
    }

    @Test
    public void nextOpenSkipsTheWeekend() {
        Check.eq(Fixtures.et(2026, 11, 16, 9, 30), MarketClock.nextOpenAfter(Fixtures.et(2026, 11, 13, 16, 30)), "Fri -> Mon");
        Check.eq(Fixtures.et(2026, 11, 10, 9, 30), MarketClock.nextOpenAfter(Fixtures.et(2026, 11, 10, 6, 0)), "same morning");
        Check.eq(Fixtures.et(2026, 11, 11, 9, 30), MarketClock.nextOpenAfter(Fixtures.et(2026, 11, 10, 9, 30)), "at the open");
    }

    @Test
    public void sessionHoursFollowDaylightSavingTime() {
        // 9:30 ET is 13:30 UTC in summer and 14:30 UTC in winter.
        Check.eq(MarketClock.parseIso("2026-07-06T13:30:00Z"), MarketClock.open(LocalDate.of(2026, 7, 6)), "EDT");
        Check.eq(MarketClock.parseIso("2026-11-10T14:30:00Z"), MarketClock.open(LocalDate.of(2026, 11, 10)), "EST");
        Check.isTrue(MarketClock.isRegularHours(Fixtures.et(2026, 11, 10, 9, 30)), "open is in");
        Check.isFalse(MarketClock.isRegularHours(Fixtures.et(2026, 11, 10, 16, 0)), "close is out");
        Check.isFalse(MarketClock.isRegularHours(Fixtures.et(2026, 11, 14, 11, 0)), "Saturday");
    }

    @Test
    public void clockLabelsNameTheDayOnlyWhenItIsNotToday() {
        long now = Fixtures.et(2026, 11, 10, 11, 0);
        Check.eq("3:59 PM ET", MarketClock.clockLabel(Fixtures.et(2026, 11, 10, 15, 59), now), "today");
        Check.eq("Mon 3:59 PM ET", MarketClock.clockLabel(Fixtures.et(2026, 11, 9, 15, 59), now), "yesterday");
    }
}
