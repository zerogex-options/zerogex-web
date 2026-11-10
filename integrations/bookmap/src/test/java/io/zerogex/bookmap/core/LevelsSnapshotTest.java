package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;

public class LevelsSnapshotTest {

    @Test
    public void parsesTheLevelsContract() {
        LevelsSnapshot s = LevelsSnapshot.parse(new Fixtures.Levels().json(), 0);
        Check.eq("ES", s.symbol, "symbol");
        Check.near(7727.0, s.level(LevelKind.CALL_WALL), 0, "call wall");
        Check.near(7526.25, s.level(LevelKind.PUT_WALL), 0, "put wall");
        Check.near(7689.75, s.level(LevelKind.GAMMA_FLIP), 0, "flip");
        Check.near(7626.75, s.level(LevelKind.MAX_PAIN), 0, "max pain");
        Check.near(7600.0, s.level(LevelKind.PIN_STRIKE), 0, "pin");
        Check.eq(60, s.profile.size(), "profile bars");
        Check.eq("ESZ26", s.dataContract, "contract");
        Check.eq(12L, s.ageSeconds, "age");
        Check.isFalse(s.isPostClose(), "in session");
    }

    @Test
    public void nullLevelsAreNaNNeverZero() {
        Fixtures.Levels f = new Fixtures.Levels();
        f.flip = null;
        f.pin = null;
        f.flipLabel = "Flip >8%↓";
        LevelsSnapshot s = LevelsSnapshot.parse(f.json(), 0);
        Check.nan(s.level(LevelKind.GAMMA_FLIP), "null flip");
        Check.nan(s.level(LevelKind.PIN_STRIKE), "null pin");
        Check.eq("Flip >8%↓", s.flipLabel, "the server's label for the missing flip");
        Check.eq("PIN_SCORE_TOO_WEAK", s.pinReason, "pin reason");
    }

    @Test
    public void aBodyWithoutLevelsIsRejected() {
        // A 200 from something that is not the API (proxy page, captive portal)
        // must not read as "every level is null today".
        Check.throwsA(IllegalArgumentException.class,
                () -> LevelsSnapshot.parse("{\"detail\":\"Invalid or missing API key\"}", 0), "401 body");
        Check.throwsA(IllegalArgumentException.class, () -> LevelsSnapshot.parse("[]", 0), "array");
    }

    @Test
    public void raggedProfileElementsCostOneBarNotTheProfile() {
        String body = new Fixtures.Levels().json().replace(
                "\"profile\":[", "\"profile\":[{\"strike\":null,\"net_gex\":1.0},{\"strike\":7000.0},");
        LevelsSnapshot s = LevelsSnapshot.parse(body, 0);
        Check.eq(60, s.profile.size(), "two broken elements skipped, the rest kept");
    }

    @Test
    public void liveSnapshotIsPlacedWhenItWasComputed() {
        Fixtures.Levels f = new Fixtures.Levels();
        LevelsSnapshot s = LevelsSnapshot.parse(f.json(), 0);
        Check.eq(f.computedAt, s.effectiveTime(), "computed_at wins");

        f.computedAt = MarketClock.NONE;
        Check.eq(f.dataAsOf, LevelsSnapshot.parse(f.json(), 0).effectiveTime(), "then data_as_of");

        f.dataAsOf = MarketClock.NONE;
        Check.eq(f.asOf + MarketClock.MINUTE, LevelsSnapshot.parse(f.json(), 0).effectiveTime(),
                "then the end of the as_of minute");
    }

    @Test
    public void postCloseBookIsPlacedJustAfterTheClose() {
        Fixtures.Levels f = new Fixtures.Levels();
        f.asOf = Fixtures.et(2026, 11, 9, 15, 59);
        f.computedAt = Fixtures.et(2026, 11, 9, 15, 59, 41);
        f.expiredExcluded = "\"2026-11-09\"";
        f.rolledTo = "2026-11-10";
        LevelsSnapshot s = LevelsSnapshot.parse(f.json(), 0);
        Check.isTrue(s.isPostClose(), "post-close");
        Check.eq(Fixtures.et(2026, 11, 9, 16, 0) + 1, s.effectiveTime(),
                "one nanosecond past the close, so it replaces the 3:59 row stamped at the close");
    }

    @Test
    public void ageKeepsCountingOnTheMonotonicClock() {
        LevelsSnapshot s = LevelsSnapshot.parse(new Fixtures.Levels().json(), 1_000L);
        Check.eq(12L, s.liveAgeSeconds(1_000L), "at receipt");
        Check.eq(42L, s.liveAgeSeconds(1_000L + 30L * MarketClock.SECOND), "30s later");
    }
}
