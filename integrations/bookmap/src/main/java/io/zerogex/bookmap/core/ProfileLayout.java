package io.zerogex.bookmap.core;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Geometry of the per-strike gamma profile: one horizontal bar per strike,
 * its length proportional to the strike's net dealer gamma.
 *
 * <p>Bars are scaled against the largest strike in the whole profile, not the
 * largest one on screen. Zooming in on a quiet patch then shows short bars,
 * which is the truth, instead of blowing the biggest local bar up to full width
 * and making a minor strike look like a wall. It also means bar lengths only
 * change when the data does, not on every zoom.
 *
 * <p>Positive net gamma (dealers long: hedging leans against moves, a brake)
 * and negative (dealers short: hedging chases moves, an accelerant) are told
 * apart by color, the same gold and violet as the website's Gamma Terminal.
 */
public final class ProfileLayout {

    public static final class Bar {
        public final double strike;
        public final double netGex;
        public final int lengthPx;
        public final int thicknessPx;
        public final boolean positive;
        /** 1, 2 or 3 for the three largest strikes by absolute gamma; 0 otherwise. */
        public final int rank;

        Bar(double strike, double netGex, int lengthPx, int thicknessPx, boolean positive, int rank) {
            this.strike = strike;
            this.netGex = netGex;
            this.lengthPx = lengthPx;
            this.thicknessPx = thicknessPx;
            this.positive = positive;
            this.rank = rank;
        }
    }

    private ProfileLayout() {
    }

    /**
     * @param bars        the profile (any order)
     * @param priceBottom lowest visible price
     * @param priceTop    highest visible price
     * @param heightPx    heatmap height
     * @param maxLengthPx length of the largest bar
     */
    public static List<Bar> layout(List<StrikeGamma> bars, double priceBottom, double priceTop, int heightPx,
                                   int maxLengthPx) {
        List<Bar> out = new ArrayList<Bar>();
        if (bars == null || bars.isEmpty() || !(priceTop > priceBottom) || heightPx <= 0 || maxLengthPx <= 0) {
            return out;
        }
        double maxAbs = 0;
        for (StrikeGamma b : bars) {
            maxAbs = Math.max(maxAbs, Math.abs(b.netGex));
        }
        if (!(maxAbs > 0)) {
            return out;
        }
        double spacing = strikeSpacing(bars);
        double pxPerPrice = heightPx / (priceTop - priceBottom);
        // 70% of the gap between strikes, so neighbors never touch; at least a
        // 2px sliver so a bar stays visible zoomed out, at most 14px zoomed in.
        int thickness = (int) Math.round(Math.max(2, Math.min(14, spacing * pxPerPrice * 0.7)));

        double[] ranked = new double[bars.size()];
        for (int i = 0; i < bars.size(); i++) {
            ranked[i] = Math.abs(bars.get(i).netGex);
        }
        Arrays.sort(ranked);

        for (StrikeGamma b : bars) {
            if (b.strike < priceBottom - spacing || b.strike > priceTop + spacing) {
                continue;
            }
            int length = (int) Math.round(Math.abs(b.netGex) / maxAbs * maxLengthPx);
            if (length < 1) {
                continue; // under a pixel: nothing worth drawing
            }
            int rank = 0;
            double abs = Math.abs(b.netGex);
            for (int r = 1; r <= 3 && r <= ranked.length; r++) {
                if (abs == ranked[ranked.length - r] && abs > 0) {
                    rank = r;
                    break;
                }
            }
            out.add(new Bar(b.strike, b.netGex, length, thickness, b.netGex >= 0, rank));
        }
        return out;
    }

    /** The most common gap between neighboring strikes (5 on ES, 25 on NQ). */
    static double strikeSpacing(List<StrikeGamma> bars) {
        double[] strikes = new double[bars.size()];
        for (int i = 0; i < bars.size(); i++) {
            strikes[i] = bars.get(i).strike;
        }
        Arrays.sort(strikes);
        double best = 0;
        int bestCount = 0;
        for (int i = 1; i < strikes.length; i++) {
            double gap = strikes[i] - strikes[i - 1];
            if (!(gap > 0)) {
                continue;
            }
            int count = 0;
            for (int j = 1; j < strikes.length; j++) {
                if (Math.abs((strikes[j] - strikes[j - 1]) - gap) < 1e-6) {
                    count++;
                }
            }
            if (count > bestCount || (count == bestCount && gap < best)) {
                best = gap;
                bestCount = count;
            }
        }
        return best > 0 ? best : 1.0;
    }
}
