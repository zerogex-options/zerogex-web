package io.zerogex.bookmap.overlay;

/**
 * What part of the chart one heatmap window shows, as Bookmap reports it to a
 * screen-space painter. Prices are Bookmap "levels" (price / tick size);
 * pixels count from the heatmap's bottom-left, y upward.
 */
public final class Viewport {
    public final long priceBottomLevels;
    public final long priceHeightLevels;
    public final int heightPx;
    public final int widthPx;

    public Viewport(long priceBottomLevels, long priceHeightLevels, int heightPx, int widthPx) {
        this.priceBottomLevels = priceBottomLevels;
        this.priceHeightLevels = priceHeightLevels;
        this.heightPx = heightPx;
        this.widthPx = widthPx;
    }

    public boolean isUsable() {
        return priceHeightLevels > 0 && heightPx > 20 && widthPx > 40;
    }

    public double priceBottom(double pips) {
        return priceBottomLevels * pips;
    }

    public double priceTop(double pips) {
        return (priceBottomLevels + priceHeightLevels) * pips;
    }

    /** Pixel row (from the bottom) of a price. */
    public double yOf(double price, double pips) {
        return (price / pips - priceBottomLevels) * heightPx / (double) priceHeightLevels;
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof Viewport)) {
            return false;
        }
        Viewport v = (Viewport) o;
        return priceBottomLevels == v.priceBottomLevels && priceHeightLevels == v.priceHeightLevels
                && heightPx == v.heightPx && widthPx == v.widthPx;
    }

    @Override
    public int hashCode() {
        return (int) (priceBottomLevels * 31 + priceHeightLevels * 17 + heightPx * 7 + widthPx);
    }
}
