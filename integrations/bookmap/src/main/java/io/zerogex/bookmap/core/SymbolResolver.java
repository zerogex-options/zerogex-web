package io.zerogex.bookmap.core;

import java.time.LocalDate;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Works out which ZeroGEX symbol a Bookmap chart is showing.
 *
 * <p>Bookmap names an instrument however its data connection does, and the
 * connections disagree: Rithmic says {@code ESZ6.CME@RITHMIC}, CQG says
 * {@code F.US.EPZ25} (its root for the E-mini S&P is EP), dxFeed says
 * {@code /ESZ25:XCME}, others say {@code ESZ5}, {@code ES 12-25} or
 * {@code ES-202512}. This reads all of them, maps the micros onto their
 * full-size contract (MES draws ES levels: same index, same option book, a
 * tenth the size), and keeps the contract month so the add-on can warn when the
 * chart and the levels are on different contracts.
 *
 * <p>A symbol it does not recognize as a future is passed through as-is when it
 * looks like a ticker (SPY, QQQ, NVDA...). Whether ZeroGEX covers it is the
 * API's call: an uncovered ticker gets the API's own "no levels" answer, and a
 * ticker ZeroGEX adds next month works without an add-on update.
 */
public final class SymbolResolver {

    /** The symbols ZeroGEX covers today, for the settings picker. Not a gate. */
    public static final List<String> KNOWN_SYMBOLS =
            Collections.unmodifiableList(Arrays.asList("ES", "NQ", "SPX", "NDX", "SPY", "QQQ", "NVDA", "MSFT"));

    /** The result of resolving one chart. */
    public static final class Resolution {
        /** Symbol to request from the API, or null when nothing usable was found. */
        public final String apiSymbol;
        /** Normalized contract the chart is on, e.g. "ESZ26" (micros normalized to the full-size root), or null. */
        public final String chartContract;
        /** True for MES / MNQ. */
        public final boolean micro;
        /** What was read, for the settings panel: "ESZ6.CME@RITHMIC". */
        public final String source;

        Resolution(String apiSymbol, String chartContract, boolean micro, String source) {
            this.apiSymbol = apiSymbol;
            this.chartContract = chartContract;
            this.micro = micro;
            this.source = source;
        }

        public boolean isResolved() {
            return apiSymbol != null;
        }

        public boolean isFuture() {
            return "ES".equals(apiSymbol) || "NQ".equals(apiSymbol);
        }
    }

    private static final Map<String, String> FUTURES_ROOTS = new HashMap<String, String>();
    private static final Map<String, Boolean> MICRO_ROOTS = new HashMap<String, Boolean>();

    static {
        FUTURES_ROOTS.put("ES", "ES");
        FUTURES_ROOTS.put("EP", "ES");   // CQG
        FUTURES_ROOTS.put("MES", "ES");
        FUTURES_ROOTS.put("NQ", "NQ");
        FUTURES_ROOTS.put("ENQ", "NQ");  // CQG
        FUTURES_ROOTS.put("MNQ", "NQ");
        MICRO_ROOTS.put("MES", Boolean.TRUE);
        MICRO_ROOTS.put("MNQ", Boolean.TRUE);
    }

    private static final String ROOTS = "MES|MNQ|ENQ|ES|EP|NQ";
    /** ESZ6, ESZ25, ESZ2025, MESH7, EPZ25 */
    private static final Pattern MONTH_CODE = Pattern.compile("^(" + ROOTS + ") ?([FGHJKMNQUVXZ])(\\d{1,4})$");
    /** ES 12-25, ES 12/2025, MES 03-26 */
    private static final Pattern NUMERIC_MONTH = Pattern.compile("^(" + ROOTS + ")[ _-]?(\\d{1,2})[-/](\\d{2}|\\d{4})$");
    /** ES-202512, ES202512, ES 2025-12 */
    private static final Pattern YEAR_MONTH = Pattern.compile("^(" + ROOTS + ")[ _-]?(\\d{4})-?(\\d{2})$");
    /** ES, @ES, ES#, ES1!, ES=F (continuous or front-month aliases) */
    private static final Pattern CONTINUOUS = Pattern.compile("^@?(" + ROOTS + ")(?:#|1!|=F|_CONT|\\.C)?$");
    /** A plain ticker: SPY, QQQ, NVDA. Anything with digits is some other contract. */
    private static final Pattern TICKER = Pattern.compile("^[A-Z]{1,6}$");
    /** "ESZ6-CME": symbol, dash, exchange letters. Not "ES-202512" (digits). */
    private static final Pattern EXCHANGE_SUFFIX = Pattern.compile("^([A-Z0-9]+)-[A-Z]{2,}$");

    private static final String MONTH_CODES = "FGHJKMNQUVXZ";

    private SymbolResolver() {
    }

    /**
     * Resolves a chart.
     *
     * @param override "AUTO"/blank to detect, otherwise the symbol to use
     * @param today    used only to place a one-digit contract year in its decade
     */
    public static Resolution resolve(String override, String alias, String symbol, String fullName,
                                     LocalDate today) {
        String forced = override == null ? "" : override.trim().toUpperCase(Locale.ROOT);
        Resolution detected = detect(alias, symbol, fullName, today);
        if (!forced.isEmpty() && !"AUTO".equals(forced)) {
            String api = FUTURES_ROOTS.containsKey(forced) ? FUTURES_ROOTS.get(forced) : forced;
            // Keep the chart's contract when the override agrees with it, so the
            // roll warning still works for a trader who set "ES" by hand.
            String contract = detected.isResolved() && api.equals(detected.apiSymbol) ? detected.chartContract : null;
            return new Resolution(api, contract, detected.micro && api.equals(detected.apiSymbol), detected.source);
        }
        return detected;
    }

    static Resolution detect(String alias, String symbol, String fullName, LocalDate today) {
        String source = firstNonBlank(alias, symbol, fullName);
        // The bare symbol is usually the cleanest; the alias carries the provider
        // suffix; the full name is a last resort (it is often a description).
        for (String candidate : new String[] {symbol, alias, fullName}) {
            Resolution r = detectOne(candidate, today, source);
            if (r != null) {
                return r;
            }
        }
        return new Resolution(null, null, false, source);
    }

    private static Resolution detectOne(String raw, LocalDate today, String source) {
        if (raw == null) {
            return null;
        }
        String s = normalize(raw);
        if (s.isEmpty()) {
            return null;
        }

        Matcher m = MONTH_CODE.matcher(s);
        if (m.matches()) {
            int year = expandYear(m.group(3), today);
            return future(m.group(1), m.group(2).charAt(0), year, source);
        }
        m = NUMERIC_MONTH.matcher(s);
        if (m.matches()) {
            int month = Integer.parseInt(m.group(2));
            if (month >= 1 && month <= 12) {
                return future(m.group(1), MONTH_CODES.charAt(month - 1), expandYear(m.group(3), today), source);
            }
        }
        m = YEAR_MONTH.matcher(s);
        if (m.matches()) {
            int month = Integer.parseInt(m.group(3));
            if (month >= 1 && month <= 12) {
                return future(m.group(1), MONTH_CODES.charAt(month - 1), Integer.parseInt(m.group(2)), source);
            }
        }
        m = CONTINUOUS.matcher(s);
        if (m.matches()) {
            String root = m.group(1);
            return new Resolution(FUTURES_ROOTS.get(root), null, MICRO_ROOTS.containsKey(root), source);
        }
        if (TICKER.matcher(s).matches()) {
            return new Resolution(s, null, false, source);
        }
        return null;
    }

    private static Resolution future(String root, char monthCode, int year, String source) {
        String api = FUTURES_ROOTS.get(root);
        String contract = year > 0 ? api + monthCode + String.format(Locale.ROOT, "%02d", year % 100) : null;
        return new Resolution(api, contract, MICRO_ROOTS.containsKey(root), source);
    }

    /**
     * Strips what connections wrap around a symbol: the "@PROVIDER" suffix, an
     * exchange after ':' or '.', CQG's "F.US." prefix, dxFeed's leading '/',
     * an index's '$' or '^'.
     */
    static String normalize(String raw) {
        String s = raw.trim().toUpperCase(Locale.ROOT);
        int at = s.indexOf('@');
        if (at > 0) {
            s = s.substring(0, at);
        }
        if (s.startsWith("F.US.")) {
            s = s.substring(5);
        }
        while (s.startsWith("/") || s.startsWith("$") || s.startsWith("^")) {
            s = s.substring(1);
        }
        int colon = s.indexOf(':');
        if (colon > 0) {
            s = s.substring(0, colon);
        }
        // "ESZ6.CME" -> "ESZ6"; "SPX.X" -> "SPX". Keep "ES 12-25" and "ES-202512" whole.
        int dot = s.indexOf('.');
        if (dot > 0) {
            s = s.substring(0, dot);
        }
        // "ESZ6-CME" -> "ESZ6": a trailing all-letter segment is an exchange code.
        Matcher exchange = EXCHANGE_SUFFIX.matcher(s);
        if (exchange.matches()) {
            s = exchange.group(1);
        }
        return s.trim();
    }

    /** "6" -> the year ending in 6 nearest today; "26" -> 2026; "2026" -> 2026. */
    static int expandYear(String digits, LocalDate today) {
        int n = Integer.parseInt(digits);
        if (digits.length() >= 4) {
            return n;
        }
        if (digits.length() == 3) {
            return 2000 + n % 100;
        }
        if (digits.length() == 2) {
            return 2000 + n;
        }
        // One digit: futures list at most a few years out and a chart is rarely
        // on an expired contract, so pick the year with that last digit closest
        // to now, preferring the future on a tie.
        int base = today.getYear();
        int best = -1;
        int bestDistance = Integer.MAX_VALUE;
        for (int y = base - 5; y <= base + 5; y++) {
            if (y % 10 == n) {
                int distance = Math.abs(y - base);
                if (distance < bestDistance || (distance == bestDistance && y > best)) {
                    best = y;
                    bestDistance = distance;
                }
            }
        }
        return best;
    }

    /**
     * Compares the chart's contract with the one the levels are quoted on.
     *
     * @return null when they agree or either is unknown; otherwise the two codes,
     *         e.g. {"ESH27", "ESZ26"}, for the warning
     */
    public static String[] contractMismatch(String chartContract, String dataContract) {
        if (chartContract == null || dataContract == null) {
            return null;
        }
        String chart = chartContract.trim().toUpperCase(Locale.ROOT);
        String data = dataContract.trim().toUpperCase(Locale.ROOT);
        if (chart.isEmpty() || data.isEmpty() || chart.equals(data)) {
            return null;
        }
        return new String[] {chart, data};
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.trim().isEmpty()) {
                return v.trim();
            }
        }
        return "";
    }
}
