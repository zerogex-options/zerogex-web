package io.zerogex.bookmap.core;

/**
 * Decides when price has reached a level, for the optional Bookmap alerts.
 *
 * <p>An alert is worth something only if it is rare enough to be read. So each
 * level fires once when price comes within the chosen distance, and then stays
 * quiet until price has moved clearly away (several times the distance) and a
 * cooldown has passed. A level that moves resets its own state, so a wall that
 * jumps to a new strike can fire again, but a level that lands on the current
 * price does not fire on arrival: it was the level that moved, not the price.
 */
public final class AlertEngine {

    /** One alert to raise. */
    public static final class Hit {
        public final LevelKind kind;
        public final double level;
        public final double price;

        Hit(LevelKind kind, double level, double price) {
            this.kind = kind;
            this.level = level;
            this.price = price;
        }
    }

    static final long COOLDOWN = 90L * MarketClock.SECOND;

    private final boolean[] armed = new boolean[LevelKind.values().length];
    private final double[] lastLevel = new double[LevelKind.values().length];
    private final long[] lastFiredMono = new long[LevelKind.values().length];
    private boolean[] enabled = new boolean[LevelKind.values().length];
    private double threshold;
    private double rearm;

    public AlertEngine() {
        java.util.Arrays.fill(lastLevel, Double.NaN);
        java.util.Arrays.fill(lastFiredMono, Long.MIN_VALUE / 2);
    }

    /**
     * @param enabledKinds which levels can alert, indexed by ordinal
     * @param distanceTicks how close counts as "reached", in ticks (0 = touch)
     * @param tick the instrument's tick size
     */
    public synchronized void configure(boolean[] enabledKinds, int distanceTicks, double tick) {
        this.enabled = enabledKinds.clone();
        double t = tick > 0 ? tick : 0.01;
        this.threshold = Math.max(0, distanceTicks) * t + t * 0.5;
        // "Clearly away": four times the alert distance, and never less than
        // eight ticks beyond it (2.6 points on ES at the default distance).
        this.rearm = Math.max(threshold * 4, threshold + 8 * t);
    }

    /**
     * Feeds the latest price and the levels in force; returns the alert to
     * raise, or null. At most one per call, the nearest level first.
     */
    public synchronized Hit onPrice(double price, double[] levels, long monoNow) {
        if (Double.isNaN(price)) {
            return null;
        }
        Hit best = null;
        double bestDistance = Double.MAX_VALUE;
        for (LevelKind kind : LevelKind.values()) {
            int i = kind.ordinal();
            double level = levels[i];
            if (Double.isNaN(level)) {
                lastLevel[i] = Double.NaN;
                armed[i] = false;
                continue;
            }
            double distance = Math.abs(price - level);
            if (Double.isNaN(lastLevel[i]) || Math.abs(level - lastLevel[i]) > 1e-9) {
                // New or moved level: arm it only if price is not already on it.
                lastLevel[i] = level;
                armed[i] = distance > threshold;
                continue;
            }
            if (!armed[i]) {
                if (distance >= rearm) {
                    armed[i] = true;
                }
                continue;
            }
            if (enabled[i] && distance <= threshold && monoNow - lastFiredMono[i] >= COOLDOWN
                    && distance < bestDistance) {
                best = new Hit(kind, level, price);
                bestDistance = distance;
            }
        }
        if (best != null) {
            int i = best.kind.ordinal();
            armed[i] = false;
            lastFiredMono[i] = monoNow;
        }
        return best;
    }

    /** "ES at Call Wall 7,727.00" / "ES within 0.50 of Put Wall 7,526.25" */
    public static String describe(Hit hit, String symbol, int decimals) {
        double gap = Math.abs(hit.price - hit.level);
        String where = gap < 1e-9 ? "at" : "within " + Format.price(gap, decimals) + " of";
        return symbol + " " + where + " " + hit.kind.displayName + " " + Format.price(hit.level, decimals);
    }
}
