package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.util.Random;

public class EngineTest {

    static class FakeClock implements Engine.Clock {
        long wall;
        long mono = 1_000_000_000_000L;

        FakeClock(long wall) {
            this.wall = wall;
        }

        @Override
        public long wallNanos() {
            return wall;
        }

        @Override
        public long monoNanos() {
            return mono;
        }

        void advance(long nanos) {
            wall += nanos;
            mono += nanos;
        }
    }

    final FakeApi api = new FakeApi();
    final FakeTransport transport = new FakeTransport(api::handle);
    final Timelines timelines = new Timelines();
    String key = "zg_test_key";
    FakeClock clock;
    Engine engine;

    private Engine start(long now, String symbol) {
        ZeroGexApi.clearCacheForTests();
        clock = new FakeClock(now);
        ZeroGexApi client = new ZeroGexApi(transport, null, () -> key, "test");
        engine = new Engine(client, () -> key, timelines, clock, new Random(7));
        engine.setConfig(new Engine.Config(symbol, "ESZ26", "all", 60));
        return engine;
    }

    /** Runs steps until the engine wants to wait at least {@code idle}, advancing time by each delay. */
    private void runUntilIdle(long idle) {
        for (int i = 0; i < 50; i++) {
            long delay = engine.step();
            if (delay >= idle) {
                return;
            }
            clock.advance(delay);
        }
        throw new AssertionError("engine never settled");
    }

    @Test
    public void inSessionChartGetsLiveLevelsFirstThenTheMorningsHistory() {
        long now = Fixtures.et(2026, 11, 10, 10, 42, 30);
        start(now, "ES");
        engine.onDataTime(now);

        engine.step();
        Check.eq(1, transport.urls.size(), "the very first request is the live levels");
        Check.contains(transport.urls.get(0), "/api/v1/levels/ES", "live first");
        Check.eq(Engine.State.OK, engine.status().state, "OK after one request");

        runUntilIdle(5L * MarketClock.SECOND);
        Check.eq(1, transport.count("/api/gex/historical"), "then the morning's history (72 minutes: one page)");
        Check.eq(0, transport.count("/api/gex/summary"), "no delayed summary for the live session");

        // History: the wall moved from 7727 to 7750 in the 10:00 bar, drawn when that bar ended.
        Check.near(7727, timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 10, 9, 59)), 0, "before");
        Check.near(7727, timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 10, 10, 0, 59)), 0,
                "not drawn before the 10:00 bar finished");
        Check.near(7750, timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 10, 10, 1, 0)), 0, "after");
        Check.nan(timelines.valueAt(LevelKind.GAMMA_FLIP, Fixtures.et(2026, 11, 10, 9, 40)), "no flip early on");
        Check.near(7689.75, timelines.valueAt(LevelKind.GAMMA_FLIP, Fixtures.et(2026, 11, 10, 10, 0)), 0, "flip later");
        // Live: the snapshot computed at 10:41:47 says 7727 again.
        Check.near(7727, timelines.valueAt(LevelKind.CALL_WALL, now), 0, "live value at the chart's time");
        Check.near(7600, timelines.valueAt(LevelKind.PIN_STRIKE, now), 0, "the pin comes from live data");
        for (Long t : timelines.points(LevelKind.CALL_WALL).keySet()) {
            Check.isTrue(t <= now, "nothing drawn in the future");
        }
    }

    @Test
    public void theFirstRequestIsLiveEvenWhenTheClockMovesDuringTheStep() {
        // Regression: the config reset took its own clock reading, a hair later
        // than the step's, so "live first" lost by nanoseconds and the history
        // landed first, over the newer live value.
        long now = Fixtures.et(2026, 11, 10, 10, 42, 30);
        ZeroGexApi.clearCacheForTests();
        clock = new FakeClock(now) {
            @Override
            public long monoNanos() {
                return mono++;
            }
        };
        ZeroGexApi client = new ZeroGexApi(transport, null, () -> key, "test");
        engine = new Engine(client, () -> key, timelines, clock, new Random(7));
        engine.setConfig(new Engine.Config("ES", "ESZ26", "all", 60));
        engine.step();
        Check.contains(transport.urls.get(0), "/api/v1/levels/ES", "live first");
    }

    @Test
    public void livePollingFollowsTheAnalyticsCycle() {
        long now = Fixtures.et(2026, 11, 10, 10, 42, 30);
        start(now, "ES");
        engine.onDataTime(now);
        runUntilIdle(5L * MarketClock.SECOND);
        int before = transport.count("/api/v1/levels/");
        // The snapshot was computed 9s before the server answered; a 30s cycle
        // plus a 2-7s spread puts the next request 23-28s out.
        clock.advance(20L * MarketClock.SECOND);
        engine.step();
        Check.eq(before, transport.count("/api/v1/levels/"), "not yet at 20s");
        ZeroGexApi.clearCacheForTests();
        clock.advance(10L * MarketClock.SECOND);
        engine.step();
        Check.eq(before + 1, transport.count("/api/v1/levels/"), "polled by 30s");
    }

    @Test
    public void preMarketChartDrawsYesterdayThenThePostCloseBookOvernight() {
        long now = Fixtures.et(2026, 11, 10, 8, 0);
        Fixtures.Levels post = new Fixtures.Levels();
        post.asOf = Fixtures.et(2026, 11, 9, 15, 59);
        post.computedAt = Fixtures.et(2026, 11, 9, 15, 59, 41);
        post.dataAsOf = Fixtures.et(2026, 11, 9, 15, 59, 38);
        post.ageSeconds = (now - post.dataAsOf) / MarketClock.SECOND;
        post.expiredExcluded = "\"2026-11-09\"";
        post.rolledTo = "2026-11-10";
        post.callWall = 7740.0; // re-picked without the expired contracts
        api.liveBody = post.json();
        start(now, "ES");
        engine.onDataTime(now);
        runUntilIdle(5L * MarketClock.SECOND);

        Check.eq(5, transport.count("/api/gex/historical"), "all of yesterday, 1-minute");
        Check.eq(0, transport.count("/api/gex/summary"), "the live endpoint already is the post-close book");
        Check.near(7750, timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 9, 15, 0)), 0, "yesterday");
        Check.near(7750, timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 9, 16, 0)), 0,
                "the 3:59 bar until the close");
        Check.near(7740, timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 9, 16, 0) + 1), 0,
                "post-close book from the close");
        Check.near(7740, timelines.valueAt(LevelKind.CALL_WALL, now), 0, "and through the overnight");
        Check.eq(Engine.State.OK, engine.status().state, "OK");
        Check.isFalse(engine.status().past, "current, not a replay");
    }

    @Test
    public void marketClosedPollsRarelyAndWakesForTheOpen() {
        long now = Fixtures.et(2026, 11, 10, 8, 0);
        Fixtures.Levels post = new Fixtures.Levels();
        post.asOf = Fixtures.et(2026, 11, 9, 15, 59);
        post.computedAt = Fixtures.et(2026, 11, 9, 15, 59, 41);
        post.dataAsOf = Fixtures.et(2026, 11, 9, 15, 59, 38);
        post.ageSeconds = (now - post.dataAsOf) / MarketClock.SECOND;
        post.expiredExcluded = "\"2026-11-09\"";
        api.liveBody = post.json();
        start(now, "ES");
        engine.onDataTime(now);
        runUntilIdle(5L * MarketClock.SECOND);
        int polls = transport.count("/api/v1/levels/");
        for (int i = 0; i < 14; i++) { // 14 minutes
            clock.advance(MarketClock.MINUTE);
            ZeroGexApi.clearCacheForTests();
            engine.step();
        }
        Check.eq(polls, transport.count("/api/v1/levels/"), "nothing for 14 minutes while the engine is idle");
        clock.advance(2L * MarketClock.MINUTE);
        ZeroGexApi.clearCacheForTests();
        engine.step();
        Check.eq(polls + 1, transport.count("/api/v1/levels/"), "one check every 15 minutes");
    }

    @Test
    public void aChartWithTwoDaysOfDataGetsEarlierSessionsAndLastNightsBook() {
        long now = Fixtures.et(2026, 11, 10, 11, 0);
        start(now, "ES");
        long earliest = Fixtures.et(2026, 11, 9, 3, 0); // Monday's overnight
        engine.onDataTime(earliest);
        engine.onDataTime(now);
        api.summaryBody = Fixtures.summary(Fixtures.et(2026, 11, 9, 15, 59), 7745, 7520, 7695, 7630, 7610, true);
        runUntilIdle(5L * MarketClock.SECOND);

        String summaryUrl = null;
        for (String u : transport.urls) {
            if (u.contains("/api/gex/summary")) {
                summaryUrl = u;
            }
        }
        Check.isTrue(summaryUrl != null, "asked for Monday's post-close book");
        int delay = Integer.parseInt(FakeTransport.query(summaryUrl).get("delay_minutes"));
        long readAt = now - delay * MarketClock.MINUTE;
        Check.isTrue(readAt > Fixtures.et(2026, 11, 9, 16, 1) && readAt < Fixtures.et(2026, 11, 9, 16, 4),
                "a read placed just after Monday's close (" + delay + " minutes back)");
        Check.near(7745, timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 9, 20, 0)), 0,
                "Monday night shows Monday's post-close book");
        Check.near(7610, timelines.valueAt(LevelKind.PIN_STRIKE, Fixtures.et(2026, 11, 10, 6, 0)), 0,
                "including the next day's pin");
        Check.near(7750, timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 9, 13, 0)), 0,
                "Monday's session itself, at 5-minute resolution");
        Check.nan(timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 6, 20, 0)),
                "Friday night is beyond the delayed read's day of reach: a gap, not a guess");
        Check.near(7727, timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 6, 9, 50)), 0,
                "Friday's session is still drawn");
    }

    @Test
    public void replayOfAPastDayUsesHistoryAndNeverTheLiveLevels() {
        long now = Fixtures.et(2026, 11, 10, 11, 0);
        start(now, "ES");
        long replay = Fixtures.et(2026, 11, 5, 11, 0);
        engine.onDataTime(replay);
        runUntilIdle(MarketClock.SECOND);
        Check.eq(0, transport.count("/api/v1/levels/"), "today's levels are never drawn over last week");
        Check.isTrue(transport.count("/api/gex/historical") > 0, "history for the replayed day");
        Check.near(7750, timelines.valueAt(LevelKind.CALL_WALL, replay), 0, "the level as it was");
        Check.isTrue(engine.status().past, "status says it is a past session");
        Check.eq(null, engine.status().latest, "no live snapshot is presented for a replay");
    }

    @Test
    public void noKeyMeansNoRequestsUntilOneIsSaved() {
        long now = Fixtures.et(2026, 11, 10, 10, 42, 30);
        key = "";
        start(now, "ES");
        engine.step();
        engine.step();
        Check.eq(Engine.State.NO_KEY, engine.status().state, "asks for a key");
        Check.eq(0, transport.urls.size(), "nothing sent");
        key = "zg_new";
        engine.kick();
        engine.step();
        Check.eq(1, transport.urls.size(), "the saved key is used at once");
    }

    @Test
    public void aRejectedKeyParksTheEngineUntilSettingsChange() {
        long now = Fixtures.et(2026, 11, 10, 10, 42, 30);
        api.liveStatus = 401;
        start(now, "ES");
        engine.onDataTime(now);
        engine.step();
        Check.eq(Engine.State.PARKED, engine.status().state, "parked");
        Check.contains(engine.status().lastError.userMessage(), "generating a new key retires the old one", "why");
        int sent = transport.urls.size();
        for (int i = 0; i < 5; i++) {
            clock.advance(MarketClock.MINUTE);
            engine.step();
        }
        Check.eq(sent, transport.urls.size(), "a rejected key is not retried in a loop");
        api.liveStatus = 200;
        ZeroGexApi.clearCacheForTests();
        engine.kick();
        engine.step();
        Check.eq(Engine.State.OK, engine.status().state, "a new key brings it back");
    }

    @Test
    public void anUncoveredSymbolSaysSoAndBacksOff() {
        long now = Fixtures.et(2026, 11, 10, 10, 42, 30);
        api.liveStatus = 404;
        api.historyStatus = 404;
        start(now, "XYZ");
        engine.onDataTime(now);
        runUntilIdle(5L * MarketClock.SECOND);
        Check.eq(Engine.State.ERROR, engine.status().state, "error");
        Check.contains(engine.status().lastError.userMessage(), "No dealer-positioning levels available", "the API's sentence");
        int sent = transport.urls.size();
        clock.advance(5L * MarketClock.MINUTE);
        ZeroGexApi.clearCacheForTests();
        engine.step();
        Check.eq(sent, transport.urls.size(), "waits ten minutes before asking again");
    }

    @Test
    public void aLiveGapIsFilledFromHistory() {
        long now = Fixtures.et(2026, 11, 10, 9, 58);
        Fixtures.Levels f = new Fixtures.Levels();
        f.asOf = Fixtures.et(2026, 11, 10, 9, 57);
        f.computedAt = Fixtures.et(2026, 11, 10, 9, 57, 40);
        f.dataAsOf = Fixtures.et(2026, 11, 10, 9, 57, 38);
        f.ageSeconds = 22;
        api.liveBody = f.json();
        start(now, "ES");
        engine.onDataTime(now);
        runUntilIdle(5L * MarketClock.SECOND);
        int historyBefore = transport.count("/api/gex/historical");

        // The laptop sleeps for twenty minutes.
        clock.advance(20L * MarketClock.MINUTE);
        engine.onDataTime(clock.wall);
        Fixtures.Levels later = new Fixtures.Levels();
        later.asOf = Fixtures.et(2026, 11, 10, 10, 17);
        later.computedAt = Fixtures.et(2026, 11, 10, 10, 17, 40);
        later.dataAsOf = Fixtures.et(2026, 11, 10, 10, 17, 38);
        later.ageSeconds = 22;
        later.callWall = 7750.0;
        api.liveBody = later.json();
        ZeroGexApi.clearCacheForTests();
        engine.step();
        Check.eq(historyBefore + 1, transport.count("/api/gex/historical"), "one history request for the gap");
        Check.near(7750, timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 10, 10, 5)), 0,
                "the 10:00 move appears inside the gap, where it happened");
    }

    @Test
    public void switchingSymbolStartsClean() {
        long now = Fixtures.et(2026, 11, 10, 10, 42, 30);
        start(now, "ES");
        engine.onDataTime(now);
        runUntilIdle(5L * MarketClock.SECOND);
        Check.isTrue(timelines.size() > 0, "ES drawn");
        Fixtures.Levels nq = new Fixtures.Levels();
        nq.symbol = "NQ";
        nq.callWall = 29824.0;
        api.liveBody = nq.json();
        ZeroGexApi.clearCacheForTests();
        engine.setConfig(new Engine.Config("NQ", "NQZ26", "all", 60));
        engine.step();
        Check.near(29824, timelines.valueAt(LevelKind.CALL_WALL, now), 0, "NQ levels");
        Check.nan(timelines.valueAt(LevelKind.CALL_WALL, Fixtures.et(2026, 11, 10, 9, 45)),
                "no ES history left behind under the NQ chart");
    }

    @Test
    public void contractMismatchIsReported() {
        long now = Fixtures.et(2026, 11, 10, 10, 42, 30);
        start(now, "ES");
        engine.setConfig(new Engine.Config("ES", "ESH27", "all", 60));
        engine.onDataTime(now);
        engine.step();
        String[] m = engine.status().contractMismatch;
        Check.eq("ESH27", m[0], "chart contract");
        Check.eq("ESZ26", m[1], "levels contract");
    }

    @Test
    public void zeroDteScopeSkipsHistory() {
        long now = Fixtures.et(2026, 11, 10, 10, 42, 30);
        Fixtures.Levels f = new Fixtures.Levels();
        f.expiration = "2026-11-10";
        api.liveBody = f.json();
        start(now, "ES");
        engine.setConfig(new Engine.Config("ES", "ESZ26", "0dte", 60));
        engine.onDataTime(now);
        runUntilIdle(5L * MarketClock.SECOND);
        Check.eq(0, transport.count("/api/gex/historical"), "history is whole-chain only");
        Check.contains(transport.urls.get(0), "expiration=0dte", "scope sent");
    }

    @Test
    public void currentMeansTheSessionOrTheOvernightAfterIt() {
        long now = Fixtures.et(2026, 11, 14, 12, 0); // Saturday
        Check.isTrue(Engine.isCurrent(Fixtures.et(2026, 11, 13, 16, 59), now), "Friday's last print, on a weekend");
        Check.isFalse(Engine.isCurrent(Fixtures.et(2026, 11, 12, 11, 0), now), "Thursday is a replay");
        Check.isTrue(Engine.isCurrent(now - MarketClock.MINUTE, now), "a minute behind");
    }
}
