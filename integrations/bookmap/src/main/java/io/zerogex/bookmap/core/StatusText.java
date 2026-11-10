package io.zerogex.bookmap.core;

/**
 * The words on the chart's status badge and in the settings panel.
 *
 * <p>Kept separate from both so the two can never describe the same state
 * differently, and so every sentence is covered by a test.
 */
public final class StatusText {

    public enum Tone {
        GOOD, NEUTRAL, WARN, BAD
    }

    /** The badge's content. */
    public static final class Lines {
        /** "ZeroGEX ES · LONG Γ above flip" */
        public final String headline;
        public final Tone headlineTone;
        /** "updated 12s ago", or what is wrong. */
        public final String detail;
        public final Tone detailTone;
        /** A second warning (contract mismatch), or null. */
        public final String warning;

        Lines(String headline, Tone headlineTone, String detail, Tone detailTone, String warning) {
            this.headline = headline;
            this.headlineTone = headlineTone;
            this.detail = detail;
            this.detailTone = detailTone;
            this.warning = warning;
        }
    }

    /** Quotes older than this, in session, mean the levels have stopped updating. */
    static final long STALE_SECONDS = 5 * 60;

    private StatusText() {
    }

    /**
     * @param flip      the gamma flip in force at the chart's time, or NaN
     * @param price     the chart's last price, or NaN
     * @param nowWall   epoch nanos, for "as of" wording
     * @param nowMono   {@link System#nanoTime()}, for the age counter
     */
    public static Lines build(Engine.Status s, double flip, double price, long nowWall, long nowMono) {
        String symbol = s.symbol == null ? "" : " " + s.symbol;
        String warning = s.contractMismatch == null ? null
                : "Chart on " + s.contractMismatch[0] + ", levels on " + s.contractMismatch[1]
                        + " - offset by the roll spread";

        switch (s.state) {
            case NO_SYMBOL:
                return new Lines("ZeroGEX", Tone.NEUTRAL,
                        "Can't tell which symbol this chart is - pick one in the add-on settings", Tone.WARN, null);
            case NO_KEY:
                return new Lines("ZeroGEX" + symbol, Tone.NEUTRAL,
                        "Paste your ZeroGEX API key in the add-on settings", Tone.WARN, null);
            case STARTING:
                return new Lines("ZeroGEX" + symbol, Tone.NEUTRAL, "Loading levels...", Tone.NEUTRAL, warning);
            default:
                break;
        }

        String headline = "ZeroGEX" + symbol;
        // Never green/red: the regime says how moves tend to behave, not which
        // way they go, and a trader who reads LONG as bullish loses money on it.
        Tone headlineTone = Tone.NEUTRAL;
        String regime = regime(s, flip, price);
        if (regime != null) {
            headline += " · " + regime;
        }

        if (s.state == Engine.State.PARKED || s.state == Engine.State.ERROR) {
            String msg = s.lastError != null ? s.lastError.userMessage() : "Not updating";
            if (s.latest != null && s.state == Engine.State.ERROR) {
                long age = s.latest.liveAgeSeconds(nowMono);
                if (age >= 0) {
                    msg += " (levels " + Format.age(age) + " old)";
                }
            }
            return new Lines(headline, headlineTone, msg, s.state == Engine.State.PARKED ? Tone.BAD : Tone.WARN,
                    warning);
        }

        if (s.past) {
            String at = s.referenceTime == MarketClock.NONE ? "" : " at " + MarketClock.clockLabel(s.referenceTime, nowWall);
            return new Lines(headline, headlineTone, "Levels as they were" + at, Tone.NEUTRAL, warning);
        }

        LevelsSnapshot latest = s.latest;
        if (latest == null) {
            return new Lines(headline, headlineTone, "Levels from history", Tone.NEUTRAL, warning);
        }
        long age = latest.liveAgeSeconds(nowMono);
        boolean regularHours = MarketClock.isRegularHours(nowWall);
        if (latest.isPostClose() || (!regularHours && (age < 0 || age > STALE_SECONDS))) {
            long asOf = latest.asOf;
            String when = asOf == MarketClock.NONE ? "the last close" : MarketClock.clockLabel(asOf, nowWall);
            return new Lines(headline, headlineTone, "Market closed - levels as of " + when, Tone.NEUTRAL, warning);
        }
        if (age > STALE_SECONDS) {
            return new Lines(headline, headlineTone, "Levels not updating - last update " + Format.age(age) + " ago",
                    Tone.WARN, warning);
        }
        return new Lines(headline, headlineTone, "Live · updated " + Format.age(Math.max(0, age)) + " ago",
                Tone.GOOD, warning);
    }

    /**
     * "LONG Γ above flip" / "SHORT Γ below flip": how moves tend to behave,
     * not which way they go. When there is no flip on the chart, the
     * engine's own net gamma at spot decides the side, and the API's short
     * reason ("Flip >8%↓") says why the line is missing.
     */
    static String regime(Engine.Status s, double flip, double price) {
        if (!Double.isNaN(flip) && !Double.isNaN(price)) {
            return price >= flip ? "LONG Γ above flip" : "SHORT Γ below flip";
        }
        LevelsSnapshot latest = s.latest;
        if (latest == null) {
            return null;
        }
        String side = latest.netGexAtSpot > 0 ? "LONG Γ" : latest.netGexAtSpot < 0 ? "SHORT Γ" : null;
        String why = latest.flipLabel;
        if (side != null && why != null) {
            return side + " (" + why + ")";
        }
        return side != null ? side : why;
    }
}
