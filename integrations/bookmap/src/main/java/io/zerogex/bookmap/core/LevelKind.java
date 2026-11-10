package io.zerogex.bookmap.core;

/**
 * The five dealer-positioning levels the {@code /api/v1/levels} contract
 * publishes, with how each one is drawn by default.
 *
 * <p>Names match the website and the NinjaTrader and Sierra Chart studies, so
 * a trader moving between them never has to translate. The default colors keep
 * the same hue for each level as those studies (call wall red, put wall green,
 * flip orange, max pain purple, pin blue) but are brightened for Bookmap's dark
 * heatmap.
 *
 * <p>The default line styles are a Bookmap-specific choice. Bookmap's heatmap
 * is itself made of horizontal bands (resting liquidity at a price over time),
 * so a solid colored line can read as one more liquidity band. The walls stay
 * solid and heavy because they are the headline; the flip is dashed and max
 * pain dotted so neither can be mistaken for the book.
 */
public enum LevelKind {
    CALL_WALL("call_wall", "Call Wall", "CALL WALL", 0xFF4D6A, LineDash.SOLID, 2),
    PUT_WALL("put_wall", "Put Wall", "PUT WALL", 0x2ED47A, LineDash.SOLID, 2),
    GAMMA_FLIP("gamma_flip", "Gamma Flip", "GAMMA FLIP", 0xFFB020, LineDash.DASHED, 2),
    MAX_PAIN("max_pain", "Max Pain", "MAX PAIN", 0xB388FF, LineDash.DOTTED, 2),
    PIN_STRIKE("pin_strike", "Pin Strike", "PIN", 0x33C3FF, LineDash.DASH_DOT, 2);

    /** How a level's line is stroked. Mapped onto Bookmap's own LineStyle at the edge. */
    public enum LineDash {
        SOLID, DASHED, DOTTED, DASH_DOT
    }

    /** Field name inside {@code levels} in the API response (and in the history rows). */
    public final String apiField;
    /** Title-case name, as on the website. */
    public final String displayName;
    /** Upper-case name for the on-chart labels. */
    public final String chartLabel;
    /** Default RGB color (no alpha). */
    public final int defaultRgb;
    public final LineDash defaultDash;
    public final int defaultWidth;

    LevelKind(String apiField, String displayName, String chartLabel, int defaultRgb,
              LineDash defaultDash, int defaultWidth) {
        this.apiField = apiField;
        this.displayName = displayName;
        this.chartLabel = chartLabel;
        this.defaultRgb = defaultRgb;
        this.defaultDash = defaultDash;
        this.defaultWidth = defaultWidth;
    }

    /**
     * Order used when several levels sit on the same price and fold into one
     * label: the walls lead because they are what a trader is looking for, and
     * the merged label takes the color of whichever comes first.
     */
    public int foldPriority() {
        switch (this) {
            case CALL_WALL:
                return 0;
            case PUT_WALL:
                return 1;
            case GAMMA_FLIP:
                return 2;
            case PIN_STRIKE:
                return 3;
            default:
                return 4;
        }
    }
}
