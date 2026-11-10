package io.zerogex.bookmap.overlay;

import io.zerogex.bookmap.core.LevelKind;
import io.zerogex.bookmap.core.StatusText;
import io.zerogex.bookmap.core.StrikeGamma;
import java.util.Collections;
import java.util.List;

/**
 * Everything the overlay draws at one moment, decided off Bookmap's threads.
 * Immutable, so the painter can read it from whichever thread Bookmap calls it
 * on.
 */
public final class OverlayFrame {

    /** How the trader set the overlay up. */
    public static final class Style {
        public final boolean labels;
        public final boolean[] showLevel;
        public final int[] levelColor;
        /** 0..3 */
        public final int labelSize;
        public final boolean badge;
        public final boolean badgeBottom;
        public final boolean profile;
        public final boolean profileOnRight;
        public final int profileWidthPct;

        public Style(boolean labels, boolean[] showLevel, int[] levelColor, int labelSize, boolean badge,
                     boolean badgeBottom, boolean profile, boolean profileOnRight, int profileWidthPct) {
            this.labels = labels;
            this.showLevel = showLevel.clone();
            this.levelColor = levelColor.clone();
            this.labelSize = labelSize;
            this.badge = badge;
            this.badgeBottom = badgeBottom;
            this.profile = profile;
            this.profileOnRight = profileOnRight;
            this.profileWidthPct = profileWidthPct;
        }

        public int color(LevelKind kind) {
            return levelColor[kind.ordinal()];
        }
    }

    public final double pips;
    public final int decimals;
    /** Level in force at the chart's time, by ordinal; NaN when none. */
    public final double[] levels;
    /** The chart's last price, or NaN. */
    public final double price;
    public final StatusText.Lines status;
    /** The gamma profile to draw; empty when it does not describe the chart's moment. */
    public final List<StrikeGamma> profile;
    public final Style style;

    public OverlayFrame(double pips, int decimals, double[] levels, double price, StatusText.Lines status,
                        List<StrikeGamma> profile, Style style) {
        this.pips = pips;
        this.decimals = decimals;
        this.levels = levels.clone();
        this.price = price;
        this.status = status;
        this.profile = profile == null ? Collections.<StrikeGamma>emptyList() : profile;
        this.style = style;
    }
}
