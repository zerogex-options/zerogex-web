package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;

public class AlertEngineTest {

    private static final double[] LEVELS = {7727.0, 7526.25, 7689.75, 7626.75, Double.NaN};

    private static AlertEngine engine() {
        AlertEngine e = new AlertEngine();
        e.configure(new boolean[] {true, true, true, false, false}, 2, 0.25);
        return e;
    }

    @Test
    public void firesOnceWhenPriceReachesALevel() {
        AlertEngine e = engine();
        long t = 0;
        Check.eq(null, e.onPrice(7700, LEVELS, t), "first look only arms");
        Check.eq(null, e.onPrice(7720, LEVELS, t += 1), "still 7 points away");
        AlertEngine.Hit hit = e.onPrice(7726.5, LEVELS, t += 1);
        Check.eq(LevelKind.CALL_WALL, hit.kind, "within 2 ticks of the call wall");
        Check.eq(null, e.onPrice(7726.75, LEVELS, t += 1), "no repeat while price sits there");
        Check.eq(null, e.onPrice(7727.0, LEVELS, t += 1), "nor at the level itself");
    }

    @Test
    public void rearmsOnlyAfterPriceMovesClearlyAwayAndTheCooldownPasses() {
        AlertEngine e = engine();
        long t = 0;
        e.onPrice(7700, LEVELS, t);
        Check.isTrue(e.onPrice(7727, LEVELS, t += 1) != null, "first touch");
        e.onPrice(7725.5, LEVELS, t += 1); // 1.5 points away: not clearly away
        Check.eq(null, e.onPrice(7727, LEVELS, t += 1), "still disarmed");
        e.onPrice(7715, LEVELS, t += 1); // 12 points away: rearmed
        Check.eq(null, e.onPrice(7727, LEVELS, t += MarketClock.SECOND), "but inside the cooldown");
        e.onPrice(7715, LEVELS, t += 1);
        Check.isTrue(e.onPrice(7727, LEVELS, t + AlertEngine.COOLDOWN) != null, "after the cooldown");
    }

    @Test
    public void aLevelMovingOntoPriceDoesNotFire() {
        AlertEngine e = engine();
        e.onPrice(7600, LEVELS, 0);
        double[] moved = LEVELS.clone();
        moved[LevelKind.CALL_WALL.ordinal()] = 7600.0;
        Check.eq(null, e.onPrice(7600, moved, 1), "the wall moved to price; price did not move to the wall");
    }

    @Test
    public void disabledLevelsStayQuiet() {
        AlertEngine e = engine();
        e.onPrice(7700, LEVELS, 0);
        Check.eq(null, e.onPrice(7626.75, LEVELS, 1), "max pain is not enabled");
    }

    @Test
    public void textSaysWhereAndHowClose() {
        AlertEngine e = engine();
        e.onPrice(7540, LEVELS, 0);
        AlertEngine.Hit hit = e.onPrice(7526.75, LEVELS, 1);
        Check.eq("ES within 0.50 of Put Wall 7,526.25", AlertEngine.describe(hit, "ES", 2), "near");
        AlertEngine e2 = engine();
        e2.onPrice(7540, LEVELS, 0);
        Check.eq("ES at Put Wall 7,526.25", AlertEngine.describe(e2.onPrice(7526.25, LEVELS, 1), "ES", 2), "at");
    }
}
