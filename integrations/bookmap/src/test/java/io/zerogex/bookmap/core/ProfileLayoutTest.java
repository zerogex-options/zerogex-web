package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.util.ArrayList;
import java.util.List;

public class ProfileLayoutTest {

    private static List<StrikeGamma> profile() {
        List<StrikeGamma> bars = new ArrayList<StrikeGamma>();
        for (int i = 0; i < 50; i++) { // 7,500 to 7,745
            double strike = 7500 + i * 5;
            double net = strike == 7725 ? 3.0e9 : strike == 7525 ? -2.0e9 : (strike - 7690) * 1e7;
            bars.add(new StrikeGamma(strike, net, 0, 0));
        }
        return bars;
    }

    @Test
    public void barsScaleAgainstTheWholeProfileNotTheView() {
        List<ProfileLayout.Bar> wide = ProfileLayout.layout(profile(), 7490, 7700, 840, 300);
        List<ProfileLayout.Bar> zoomed = ProfileLayout.layout(profile(), 7600, 7650, 840, 300);
        ProfileLayout.Bar a = find(wide, 7620);
        ProfileLayout.Bar b = find(zoomed, 7620);
        Check.eq(a.lengthPx, b.lengthPx, "the same strike is the same length at any zoom");
        Check.eq(300, find(ProfileLayout.layout(profile(), 7490, 7800, 840, 300), 7725).lengthPx,
                "the largest strike is full length");
    }

    @Test
    public void signDecidesTheColorAndTopThreeAreRanked() {
        List<ProfileLayout.Bar> bars = ProfileLayout.layout(profile(), 7490, 7800, 840, 300);
        Check.isTrue(find(bars, 7725).positive, "long gamma");
        Check.isFalse(find(bars, 7525).positive, "short gamma");
        Check.eq(1, find(bars, 7725).rank, "largest");
        Check.eq(2, find(bars, 7525).rank, "second");
    }

    @Test
    public void onlyVisibleStrikesAreLaidOut() {
        List<ProfileLayout.Bar> bars = ProfileLayout.layout(profile(), 7600, 7650, 840, 300);
        for (ProfileLayout.Bar b : bars) {
            Check.isTrue(b.strike >= 7595 && b.strike <= 7655, "within view plus one strike: " + b.strike);
        }
    }

    @Test
    public void thicknessFollowsStrikeSpacingWithinLimits() {
        Check.near(5.0, ProfileLayout.strikeSpacing(profile()), 1e-9, "ES strikes every 5");
        int zoomedOut = ProfileLayout.layout(profile(), 6000, 9000, 800, 300).get(0).thicknessPx;
        int zoomedIn = ProfileLayout.layout(profile(), 7600, 7620, 800, 300).get(0).thicknessPx;
        Check.eq(2, zoomedOut, "a visible sliver when zoomed out");
        Check.eq(14, zoomedIn, "capped when zoomed in");
    }

    @Test
    public void anEmptyOrFlatProfileDrawsNothing() {
        Check.eq(0, ProfileLayout.layout(new ArrayList<StrikeGamma>(), 7500, 7700, 800, 300).size(), "empty");
        List<StrikeGamma> flat = new ArrayList<StrikeGamma>();
        flat.add(new StrikeGamma(7600, 0, 0, 0));
        Check.eq(0, ProfileLayout.layout(flat, 7500, 7700, 800, 300).size(), "all zero");
    }

    private static ProfileLayout.Bar find(List<ProfileLayout.Bar> bars, double strike) {
        for (ProfileLayout.Bar b : bars) {
            if (b.strike == strike) {
                return b;
            }
        }
        throw new AssertionError("no bar at " + strike);
    }
}
