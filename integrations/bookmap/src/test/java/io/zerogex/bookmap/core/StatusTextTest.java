package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;

public class StatusTextTest {

    private static Engine.Status status(Engine.State state, ApiError error, LevelsSnapshot latest, boolean past,
                                        String[] mismatch) {
        return new Engine.Status(state, error, latest, past, Fixtures.et(2026, 11, 10, 10, 42), mismatch, 0, "ES");
    }

    private static final long NOW = Fixtures.et(2026, 11, 10, 10, 42, 30);

    @Test
    public void liveLevelsSayHowFreshTheyAre() {
        LevelsSnapshot snap = LevelsSnapshot.parse(new Fixtures.Levels().json(), 0);
        StatusText.Lines l = StatusText.build(status(Engine.State.OK, null, snap, false, null), 7689.75, 7581.5, NOW, 0);
        Check.eq("ZeroGEX ES · SHORT Γ below flip", l.headline, "regime");
        Check.eq("Live · updated 12s ago", l.detail, "freshness");
        Check.eq(StatusText.Tone.GOOD, l.detailTone, "green dot");
    }

    @Test
    public void theRegimeIsNeverColoredAsADirection() {
        LevelsSnapshot snap = LevelsSnapshot.parse(new Fixtures.Levels().json(), 0);
        StatusText.Lines above = StatusText.build(status(Engine.State.OK, null, snap, false, null), 7689.75, 7700, NOW, 0);
        Check.eq("ZeroGEX ES · LONG Γ above flip", above.headline, "above the flip");
        Check.eq(StatusText.Tone.NEUTRAL, above.headlineTone, "long gamma is not bullish");
        StatusText.Lines below = StatusText.build(status(Engine.State.OK, null, snap, false, null), 7689.75, 7600, NOW, 0);
        Check.eq(StatusText.Tone.NEUTRAL, below.headlineTone, "short gamma is not bearish");
    }

    @Test
    public void withoutAFlipTheEngineSideAndTheReasonAreShown() {
        Fixtures.Levels f = new Fixtures.Levels();
        f.flip = null;
        f.flipLabel = "Flip >8%↓";
        f.netGexAtSpot = 4.2e9;
        LevelsSnapshot snap = LevelsSnapshot.parse(f.json(), 0);
        StatusText.Lines l = StatusText.build(status(Engine.State.OK, null, snap, false, null), Double.NaN, 7581.5, NOW, 0);
        Check.eq("ZeroGEX ES · LONG Γ (Flip >8%↓)", l.headline, "side from net GEX, reason from the API");
    }

    @Test
    public void everyProblemIsSaidInWordsTheTraderCanActOn() {
        Check.contains(StatusText.build(status(Engine.State.NO_KEY, null, null, false, null), Double.NaN, Double.NaN,
                NOW, 0).detail, "Paste your ZeroGEX API key", "no key");
        Check.contains(StatusText.build(new Engine.Status(Engine.State.NO_SYMBOL, null, null, false, NOW, null, 0, null),
                Double.NaN, Double.NaN, NOW, 0).detail, "pick one in the add-on settings", "no symbol");
        ApiError rejected = new ApiError(ApiError.Kind.KEY_REJECTED, 401, null, -1);
        StatusText.Lines parked = StatusText.build(status(Engine.State.PARKED, rejected, null, false, null),
                Double.NaN, Double.NaN, NOW, 0);
        Check.contains(parked.detail, "generating a new key retires the old one", "rejected key");
        Check.eq(StatusText.Tone.BAD, parked.detailTone, "red");
        LevelsSnapshot snap = LevelsSnapshot.parse(new Fixtures.Levels().json(), 0);
        StatusText.Lines err = StatusText.build(status(Engine.State.ERROR, ApiError.of(ApiError.Kind.NETWORK, "timed out"),
                snap, false, null), 7689.75, 7581.5, NOW, 120L * MarketClock.SECOND);
        Check.contains(err.detail, "Can't reach api.zerogex.io (timed out)", "network");
        Check.contains(err.detail, "levels 2m old", "and how old the levels on screen are");
    }

    @Test
    public void staleClosedReplayAndRollAreEachNamed() {
        Fixtures.Levels f = new Fixtures.Levels();
        f.ageSeconds = 600;
        LevelsSnapshot stale = LevelsSnapshot.parse(f.json(), 0);
        Check.contains(StatusText.build(status(Engine.State.OK, null, stale, false, null), 7689.75, 7581.5, NOW, 0).detail,
                "Levels not updating - last update 10m ago", "stale in session");

        Fixtures.Levels post = new Fixtures.Levels();
        post.asOf = Fixtures.et(2026, 11, 9, 15, 59);
        post.expiredExcluded = "\"2026-11-09\"";
        LevelsSnapshot closed = LevelsSnapshot.parse(post.json(), 0);
        Check.eq("Market closed - levels as of Mon 3:59 PM ET",
                StatusText.build(status(Engine.State.OK, null, closed, false, null), 7689.75, 7581.5, NOW, 0).detail,
                "closed");

        Check.contains(StatusText.build(status(Engine.State.OK, null, null, true, null), Double.NaN, Double.NaN,
                NOW, 0).detail, "Levels as they were at", "replay");

        LevelsSnapshot snap = LevelsSnapshot.parse(new Fixtures.Levels().json(), 0);
        Check.eq("Chart on ESH27, levels on ESZ26 - offset by the roll spread",
                StatusText.build(status(Engine.State.OK, null, snap, false, new String[] {"ESH27", "ESZ26"}),
                        7689.75, 7581.5, NOW, 0).warning, "roll");
    }
}
