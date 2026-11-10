package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.util.Random;

public class PollPlannerTest {

    private static LevelsSnapshot snap(long computedAt, long dataAsOf, long age) {
        Fixtures.Levels f = new Fixtures.Levels();
        f.computedAt = computedAt;
        f.dataAsOf = dataAsOf;
        f.ageSeconds = age;
        return LevelsSnapshot.parse(f.json(), 0);
    }

    @Test
    public void asksJustAfterTheNextCycle() {
        PollPlanner p = new PollPlanner(new Random(1));
        long c = Fixtures.et(2026, 11, 10, 10, 41, 47);
        // Server answered 9s after computing (quotes at :44 + 12s age = :56).
        long delay = p.afterSuccess(snap(c, c - 3 * MarketClock.SECOND, 12), c + 9 * MarketClock.SECOND);
        long seconds = delay / MarketClock.SECOND;
        Check.isTrue(seconds >= 23 && seconds <= 28, "30s cycle - 9s elapsed + 2-7s spread: " + seconds);
    }

    @Test
    public void learnsTheCycleLength() {
        PollPlanner p = new PollPlanner(new Random(1));
        long c = Fixtures.et(2026, 11, 10, 10, 0);
        for (int i = 0; i < 12; i++) {
            long computed = c + i * 60L * MarketClock.SECOND; // the engine runs every 60s
            p.afterSuccess(snap(computed, computed, 0), computed);
        }
        Check.isTrue(p.period() > 55L * MarketClock.SECOND, "converged toward 60s: " + p.period() / 1e9);
    }

    @Test
    public void aLateCycleIsRetriedSoonNotAfterAWholePeriod() {
        PollPlanner p = new PollPlanner(new Random(1));
        long c = Fixtures.et(2026, 11, 10, 10, 0);
        p.afterSuccess(snap(c, c, 0), c);
        long retry = p.afterSuccess(snap(c, c, 35), c + 35 * MarketClock.SECOND);
        Check.eq(PollPlanner.MIN_GAP, retry, "same computed_at again: ask again at the minimum gap");
        long retry2 = p.afterSuccess(snap(c, c, 43), c + 43 * MarketClock.SECOND);
        Check.isTrue(retry2 > retry, "a little later each time");
    }

    @Test
    public void closedMarketPollsRarelyAndWakesAfterTheOpen() {
        PollPlanner p = new PollPlanner(new Random(1));
        long computed = Fixtures.et(2026, 11, 9, 15, 59, 41);
        long now = Fixtures.et(2026, 11, 10, 9, 20);
        long delay = p.afterSuccess(snap(computed, computed, (now - computed) / MarketClock.SECOND), now);
        Check.eq(10L * MarketClock.MINUTE + PollPlanner.AFTER_OPEN, delay, "until 40s after the 9:30 open");
        long evening = Fixtures.et(2026, 11, 9, 20, 0);
        Check.eq(PollPlanner.CLOSED_POLL, p.afterSuccess(snap(computed, computed,
                (evening - computed) / MarketClock.SECOND), evening), "every 15 minutes overnight");
    }

    @Test
    public void failuresBackOffAndKeyProblemsPark() {
        PollPlanner p = new PollPlanner(new Random(1));
        ApiError net = ApiError.of(ApiError.Kind.NETWORK, null);
        Check.eq(15L * MarketClock.SECOND, p.afterFailure(net), "15s");
        Check.eq(30L * MarketClock.SECOND, p.afterFailure(net), "30s");
        Check.eq(60L * MarketClock.SECOND, p.afterFailure(net), "60s");
        for (int i = 0; i < 10; i++) {
            p.afterFailure(net);
        }
        Check.eq(5L * MarketClock.MINUTE, p.afterFailure(net), "capped at 5 minutes");
        Check.eq(-1L, p.afterFailure(new ApiError(ApiError.Kind.KEY_REJECTED, 401, null, -1)), "park on 401");
        Check.eq(300L * MarketClock.SECOND,
                p.afterFailure(new ApiError(ApiError.Kind.RATE_LIMITED, 429, null, 300)), "honor Retry-After");
        Check.eq(10L * MarketClock.MINUTE,
                p.afterFailure(new ApiError(ApiError.Kind.NOT_FOUND, 404, null, -1)), "uncovered symbol");
    }
}
