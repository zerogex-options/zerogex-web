package io.zerogex.bookmap.core;

import java.util.Locale;

/** Number and duration formatting for the chart, in US conventions. */
public final class Format {

    private Format() {
    }

    /**
     * Decimals needed to show every multiple of {@code tick} exactly: 2 for
     * ES (0.25) and SPY (0.01), 0 for a 1.0 tick. At least {@code min}.
     */
    public static int decimalsFor(double tick, int min) {
        if (!(tick > 0) || Double.isInfinite(tick)) {
            return Math.max(min, 2);
        }
        for (int d = 0; d <= 6; d++) {
            double scaled = tick * Math.pow(10, d);
            if (Math.abs(scaled - Math.rint(scaled)) < 1e-7) {
                return Math.max(min, d);
            }
        }
        return Math.max(min, 6);
    }

    /** "7,727.25" */
    public static String price(double value, int decimals) {
        if (Double.isNaN(value)) {
            return "-";
        }
        return String.format(Locale.US, "%,." + decimals + "f", value);
    }

    /** "+38.50" / "-12.25" / "0.00" */
    public static String delta(double value, int decimals) {
        if (Double.isNaN(value)) {
            return "";
        }
        double rounded = round(value, decimals);
        String body = String.format(Locale.US, "%,." + decimals + "f", Math.abs(rounded));
        if (rounded > 0) {
            return "+" + body;
        }
        if (rounded < 0) {
            return "-" + body;
        }
        return body;
    }

    /** "12s", "4m", "2h 05m", "3d" */
    public static String age(long seconds) {
        if (seconds < 0) {
            return "?";
        }
        if (seconds < 90) {
            return seconds + "s";
        }
        long minutes = seconds / 60;
        if (minutes < 60) {
            return minutes + "m";
        }
        long hours = minutes / 60;
        if (hours < 48) {
            return String.format(Locale.US, "%dh %02dm", hours, minutes % 60);
        }
        return (hours / 24) + "d";
    }

    /** "$3.07B" for dollar gamma. */
    public static String dollars(double value) {
        if (Double.isNaN(value)) {
            return "-";
        }
        double abs = Math.abs(value);
        String sign = value < 0 ? "-" : "";
        if (abs >= 1e9) {
            return String.format(Locale.US, "%s$%.2fB", sign, abs / 1e9);
        }
        if (abs >= 1e6) {
            return String.format(Locale.US, "%s$%.1fM", sign, abs / 1e6);
        }
        return String.format(Locale.US, "%s$%,.0f", sign, abs);
    }

    static double round(double value, int decimals) {
        double f = Math.pow(10, decimals);
        return Math.rint(value * f) / f;
    }
}
