package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.util.ArrayList;
import java.util.List;

public class TimelinesTest {

    static final class Recorder implements LineSink {
        final List<String> calls = new ArrayList<String>();

        @Override
        public void point(LevelKind kind, long t, double price) {
            calls.add(kind + "@" + t + "=" + price);
        }

        @Override
        public void clearAll(LevelKind kind) {
            calls.add("clear " + kind);
        }
    }

    @Test
    public void valueIsTheLastPointAtOrBefore() {
        Timelines tl = new Timelines();
        tl.put(LevelKind.CALL_WALL, 100, 7727);
        tl.put(LevelKind.CALL_WALL, 200, 7750);
        Check.nan(tl.valueAt(LevelKind.CALL_WALL, 99), "before the first point");
        Check.near(7727, tl.valueAt(LevelKind.CALL_WALL, 100), 0, "at");
        Check.near(7727, tl.valueAt(LevelKind.CALL_WALL, 199), 0, "between");
        Check.near(7750, tl.valueAt(LevelKind.CALL_WALL, 10_000), 0, "after");
    }

    @Test
    public void outOfOrderHistoryNeverOverridesALaterLivePoint() {
        // The trap a de-duplicating timeline falls into: history 10:40=A, then
        // live 10:45=A (skipped as "same"), then history 10:42=B would leave
        // 10:45 reading B. Keeping every point keeps 10:45 at A.
        Timelines tl = new Timelines();
        tl.put(LevelKind.CALL_WALL, 1040, 7727);
        tl.put(LevelKind.CALL_WALL, 1045, 7727);
        tl.put(LevelKind.CALL_WALL, 1042, 7750);
        Check.near(7750, tl.valueAt(LevelKind.CALL_WALL, 1043), 0, "the moved wall");
        Check.near(7727, tl.valueAt(LevelKind.CALL_WALL, 1045), 0, "the live point still stands");
    }

    @Test
    public void impossiblePricesBecomeGapsNotZeros() {
        Timelines tl = new Timelines();
        tl.put(LevelKind.PUT_WALL, 1, 0.0);
        tl.put(LevelKind.PUT_WALL, 2, -5.0);
        tl.put(LevelKind.PUT_WALL, 3, Double.POSITIVE_INFINITY);
        Check.nan(tl.valueAt(LevelKind.PUT_WALL, 1), "zero");
        Check.nan(tl.valueAt(LevelKind.PUT_WALL, 2), "negative");
        Check.nan(tl.valueAt(LevelKind.PUT_WALL, 3), "infinite");
        tl.put(LevelKind.PUT_WALL, MarketClock.NONE, 7000);
        Check.eq(3, tl.points(LevelKind.PUT_WALL).size(), "a point with no time is ignored");
    }

    @Test
    public void hidingClearsTheLineAndShowingRedrawsItsHistory() {
        Timelines tl = new Timelines();
        Recorder r = new Recorder();
        tl.attach(r);
        tl.put(LevelKind.MAX_PAIN, 10, 7626.75);
        tl.put(LevelKind.MAX_PAIN, 20, 7630.0);
        r.calls.clear();
        tl.setVisible(LevelKind.MAX_PAIN, false);
        Check.eq("[clear MAX_PAIN]", r.calls.toString(), "hide clears");
        tl.put(LevelKind.MAX_PAIN, 30, 7635.0);
        Check.eq(1, r.calls.size(), "hidden lines are not drawn");
        tl.setVisible(LevelKind.MAX_PAIN, true);
        Check.eq("[clear MAX_PAIN, MAX_PAIN@10=7626.75, MAX_PAIN@20=7630.0, MAX_PAIN@30=7635.0]",
                r.calls.subList(1, r.calls.size()).toString(), "show replays every point, including hidden ones");
    }

    @Test
    public void trimKeepsTheValueInForceAtTheEdge() {
        Timelines tl = new Timelines();
        long now = 100L * MarketClock.DAY;
        tl.put(LevelKind.GAMMA_FLIP, now - 20L * MarketClock.DAY, 7600);
        tl.put(LevelKind.GAMMA_FLIP, now - 10L * MarketClock.DAY, 7650);
        tl.put(LevelKind.GAMMA_FLIP, now - MarketClock.DAY, 7690);
        tl.trim(now);
        Check.eq(2, tl.points(LevelKind.GAMMA_FLIP).size(), "the oldest point dropped");
        Check.near(7650, tl.valueAt(LevelKind.GAMMA_FLIP, now - 9L * MarketClock.DAY), 0,
                "the value in force at the retention edge survives");
    }
}
