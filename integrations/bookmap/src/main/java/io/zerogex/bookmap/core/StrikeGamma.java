package io.zerogex.bookmap.core;

/**
 * One bar of the per-strike gamma profile: dollar gamma per 1% move at a
 * strike, summed across expirations, calls positive and puts negative.
 *
 * <p>On ES and NQ the strike arrives already projected onto the futures price
 * axis; the dollar figures are deliberately not projected (they belong to the
 * option book), which is exactly what a profile scaled on relative size needs.
 */
public final class StrikeGamma {
    public final double strike;
    public final double netGex;
    public final double callGex;
    public final double putGex;

    public StrikeGamma(double strike, double netGex, double callGex, double putGex) {
        this.strike = strike;
        this.netGex = netGex;
        this.callGex = callGex;
        this.putGex = putGex;
    }
}
