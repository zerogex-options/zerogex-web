package io.zerogex.bookmap.core;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.SocketTimeoutException;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * The three ZeroGEX endpoints the add-on reads, with errors classified.
 *
 * <ul>
 *   <li>{@code GET /api/v1/levels/{symbol}} — the live levels and gamma profile
 *       (the versioned contract every chart integration builds on);</li>
 *   <li>{@code GET /api/gex/historical} — the session's levels minute by minute,
 *       so the lines are right before the add-on was loaded too;</li>
 *   <li>{@code GET /api/gex/summary?delay_minutes=} — the book as it stood just
 *       after a past close, which is what was on the chart overnight.</li>
 * </ul>
 *
 * <p>The key travels in an {@code Authorization: Bearer} header, never in the
 * URL: unlike Sierra Chart, Java can set headers, so there is no reason to put a
 * credential where proxies and logs can see it.
 *
 * <p>A small process-wide cache sits in front of the network. Bookmap traders
 * commonly have ES and MES (or NQ and MNQ) open side by side; both charts ask
 * for the same ES levels at the same moment, because both time their requests
 * to the analytics cycle. The cache answers the second from the first.
 */
public final class ZeroGexApi {

    public static final String DEFAULT_BASE_URL = "https://api.zerogex.io";

    private static final Pattern SYMBOL = Pattern.compile("^[A-Za-z0-9.^-]{1,16}$");
    private static final int CONNECT_TIMEOUT_MS = 8_000;
    private static final int READ_TIMEOUT_MS = 15_000;

    /** Live levels change at most twice a minute; two charts asking within this window share one answer. */
    static final long LIVE_CACHE_NANOS = 4L * MarketClock.SECOND;
    /** A finished session's history never changes; a request naming its range can be reused for hours. */
    static final long HISTORY_CACHE_NANOS = 6L * MarketClock.HOUR;
    private static final int CACHE_ENTRIES = 48;

    private static final Map<String, CachedBody> CACHE = new LinkedHashMap<String, CachedBody>(64, 0.75f, true);

    /** What the last request did, for the diagnostics the settings panel copies. Never contains the key. */
    public static final class CallRecord {
        public final String path;
        public final int status;
        public final long millis;
        public final long atWallNanos;
        public final boolean fromCache;

        CallRecord(String path, int status, long millis, long atWallNanos, boolean fromCache) {
            this.path = path;
            this.status = status;
            this.millis = millis;
            this.atWallNanos = atWallNanos;
            this.fromCache = fromCache;
        }
    }

    private static final class CachedBody {
        final String body;
        final long storedMonotonic;
        final long ttlNanos;

        CachedBody(String body, long storedMonotonic, long ttlNanos) {
            this.body = body;
            this.storedMonotonic = storedMonotonic;
            this.ttlNanos = ttlNanos;
        }
    }

    /** Supplies the key at request time, so a key pasted in settings is used on the very next call. */
    public interface KeySource {
        String apiKey();
    }

    private final HttpTransport transport;
    private final String baseUrl;
    private final KeySource keys;
    private final String userAgent;
    private volatile CallRecord lastCall;

    public ZeroGexApi(HttpTransport transport, String baseUrl, KeySource keys, String userAgent) {
        this.transport = transport;
        String base = baseUrl == null || baseUrl.trim().isEmpty() ? DEFAULT_BASE_URL : baseUrl.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        this.baseUrl = base;
        this.keys = keys;
        this.userAgent = userAgent;
    }

    public CallRecord lastCall() {
        return lastCall;
    }

    // ------------------------------------------------------------------
    // Endpoints
    // ------------------------------------------------------------------

    /**
     * The live levels for {@code symbol}.
     *
     * @param strikes    profile strikes nearest spot (the API bounds it to 1..200)
     * @param expiration null or "all" for the whole chain, "0dte", or a YYYY-MM-DD date
     */
    public LevelsSnapshot levels(String symbol, int strikes, String expiration) throws ApiError {
        String sym = checkSymbol(symbol);
        Map<String, String> query = new LinkedHashMap<String, String>();
        query.put("strikes", String.valueOf(Math.max(1, Math.min(200, strikes))));
        if (expiration != null && !expiration.trim().isEmpty() && !"all".equalsIgnoreCase(expiration.trim())) {
            query.put("expiration", expiration.trim().toLowerCase(Locale.ROOT));
        }
        String body = fetch("/api/v1/levels/" + sym, query, LIVE_CACHE_NANOS);
        try {
            LevelsSnapshot snap = LevelsSnapshot.parse(body, System.nanoTime());
            if (snap.symbol != null && !snap.symbol.equalsIgnoreCase(sym)) {
                throw new ApiError(ApiError.Kind.BAD_PAYLOAD, 200,
                        "asked for " + sym + " levels, got " + snap.symbol, -1);
            }
            if (query.containsKey("expiration") && snap.expiration == null) {
                // An API build from before scoping existed would answer with the
                // whole chain. Drawing that under a 0DTE heading is worse than
                // drawing nothing.
                throw new ApiError(ApiError.Kind.BAD_REQUEST, 200,
                        "The API ignored the expiration setting - set Expiration to All for now", -1);
            }
            return snap;
        } catch (IllegalArgumentException e) {
            forget("/api/v1/levels/" + sym, query);
            throw new ApiError(ApiError.Kind.BAD_PAYLOAD, 200, e.getMessage(), -1);
        }
    }

    /**
     * Minute rows for {@code [startNanos, endNanos]}, oldest first, following
     * the endpoint's newest-first pages back until the range is covered.
     *
     * @param timeframe "1min" or "5min"
     * @param maxPages  hard stop, so a server that ignores the range can never
     *                  turn one chart load into hundreds of requests
     */
    public List<SummaryRow> history(String symbol, long startNanos, long endNanos, String timeframe, int maxPages)
            throws ApiError {
        String sym = checkSymbol(symbol);
        final int pageSize = 90; // the endpoint's maximum window_units
        List<SummaryRow> collected = new ArrayList<SummaryRow>();
        long end = endNanos;
        boolean finishedRange = endNanos < System.currentTimeMillis() * 1_000_000L - 2L * MarketClock.MINUTE;
        for (int page = 0; page < maxPages && end >= startNanos; page++) {
            Map<String, String> query = new LinkedHashMap<String, String>();
            query.put("symbol", sym);
            query.put("timeframe", timeframe);
            query.put("start_date", MarketClock.isoUtc(startNanos));
            query.put("end_date", MarketClock.isoUtc(end));
            query.put("window_units", String.valueOf(pageSize));
            String body = fetch("/api/gex/historical", query, finishedRange ? HISTORY_CACHE_NANOS : LIVE_CACHE_NANOS);
            List<SummaryRow> rows;
            try {
                rows = SummaryRow.parseArray(body);
            } catch (IllegalArgumentException e) {
                forget("/api/gex/historical", query);
                throw new ApiError(ApiError.Kind.BAD_PAYLOAD, 200, e.getMessage(), -1);
            }
            long oldest = Long.MAX_VALUE;
            for (SummaryRow row : rows) {
                if (row.timestamp >= startNanos && row.timestamp <= endNanos) {
                    collected.add(row);
                }
                oldest = Math.min(oldest, row.timestamp);
            }
            if (rows.size() < pageSize || oldest == Long.MAX_VALUE || oldest <= startNanos) {
                break;
            }
            end = oldest - MarketClock.SECOND;
        }
        // Newest-first pages, possibly overlapping at a page boundary: sort and de-duplicate.
        Collections.sort(collected, (a, b) -> Long.compare(a.timestamp, b.timestamp));
        List<SummaryRow> out = new ArrayList<SummaryRow>(collected.size());
        long last = Long.MIN_VALUE;
        for (SummaryRow row : collected) {
            if (row.timestamp != last) {
                out.add(row);
                last = row.timestamp;
            }
        }
        return out;
    }

    /**
     * The summary as the API would have answered {@code delayMinutes} ago
     * (the API caps the delay at one day). With expiry judged at that moment,
     * a read placed just after a close returns that evening's post-close book.
     */
    public SummaryRow summaryDelayed(String symbol, int delayMinutes) throws ApiError {
        String sym = checkSymbol(symbol);
        Map<String, String> query = new LinkedHashMap<String, String>();
        query.put("symbol", sym);
        query.put("delay_minutes", String.valueOf(Math.max(1, Math.min(24 * 60, delayMinutes))));
        String body = fetch("/api/gex/summary", query, HISTORY_CACHE_NANOS);
        try {
            return SummaryRow.parseObject(body);
        } catch (IllegalArgumentException e) {
            forget("/api/gex/summary", query);
            throw new ApiError(ApiError.Kind.BAD_PAYLOAD, 200, e.getMessage(), -1);
        }
    }

    // ------------------------------------------------------------------
    // Transport, caching, classification
    // ------------------------------------------------------------------

    private String fetch(String path, Map<String, String> query, long cacheNanos) throws ApiError {
        String key = keys.apiKey();
        if (key == null || key.trim().isEmpty()) {
            throw ApiError.of(ApiError.Kind.NO_KEY, null);
        }
        key = key.trim();
        String url = baseUrl + path + encodeQuery(query);
        String cacheKey = Integer.toHexString(key.hashCode()) + " " + url;

        long now = System.nanoTime();
        synchronized (CACHE) {
            CachedBody hit = CACHE.get(cacheKey);
            if (hit != null && now - hit.storedMonotonic < hit.ttlNanos) {
                lastCall = new CallRecord(path, 200, 0, MarketClock.nowNanos(), true);
                return hit.body;
            }
        }

        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Authorization", "Bearer " + key);
        headers.put("Accept", "application/json");
        headers.put("User-Agent", userAgent);

        long started = System.nanoTime();
        HttpTransport.Response resp;
        try {
            resp = transport.get(url, headers, CONNECT_TIMEOUT_MS, READ_TIMEOUT_MS);
        } catch (UnknownHostException e) {
            record(path, -1, started);
            throw ApiError.of(ApiError.Kind.NETWORK, "no DNS");
        } catch (SocketTimeoutException e) {
            record(path, -1, started);
            throw ApiError.of(ApiError.Kind.NETWORK, "timed out");
        } catch (IOException e) {
            record(path, -1, started);
            throw ApiError.of(ApiError.Kind.NETWORK, shortReason(e));
        } catch (RuntimeException e) {
            record(path, -1, started);
            throw ApiError.of(ApiError.Kind.NETWORK, shortReason(e));
        }
        record(path, resp.status, started);

        if (resp.status >= 200 && resp.status < 300) {
            synchronized (CACHE) {
                CACHE.put(cacheKey, new CachedBody(resp.body, System.nanoTime(), cacheNanos));
                Iterator<Map.Entry<String, CachedBody>> it = CACHE.entrySet().iterator();
                while (CACHE.size() > CACHE_ENTRIES && it.hasNext()) {
                    it.next();
                    it.remove();
                }
            }
            return resp.body;
        }
        throw classify(resp);
    }

    static ApiError classify(HttpTransport.Response resp) {
        String detail = serverDetail(resp.body);
        long retryAfter = parseRetryAfter(resp.header("retry-after"));
        int s = resp.status;
        if (s == 401) {
            return new ApiError(ApiError.Kind.KEY_REJECTED, s, detail, retryAfter);
        }
        if (s == 403) {
            return new ApiError(ApiError.Kind.NO_ACCESS, s, detail, retryAfter);
        }
        if (s == 404) {
            return new ApiError(ApiError.Kind.NOT_FOUND, s, detail, retryAfter);
        }
        if (s == 400 || s == 422) {
            return new ApiError(ApiError.Kind.BAD_REQUEST, s, detail, retryAfter);
        }
        if (s == 429) {
            return new ApiError(ApiError.Kind.RATE_LIMITED, s, detail, retryAfter);
        }
        // 5xx, and 3xx (redirects are not followed, so the Authorization
        // header never leaves for another host): transient from here.
        return new ApiError(ApiError.Kind.SERVER, s, null, retryAfter);
    }

    /**
     * The API's own sentence ({@code {"detail": "..."}}), which for a 404 or 400
     * is the fix ("SPX 2026-10-10 has expired; pick a later date or 0DTE").
     * Pydantic validation errors put a list there; those are not shown.
     */
    static String serverDetail(String body) {
        if (body == null || body.isEmpty() || body.charAt(0) != '{') {
            return null;
        }
        try {
            Object detail = Json.object(Json.parse(body)).get("detail");
            if (detail instanceof String) {
                String s = ((String) detail).trim();
                return s.isEmpty() ? null : (s.length() > 160 ? s.substring(0, 157) + "..." : s);
            }
        } catch (IllegalArgumentException ignored) {
            // not JSON: say nothing rather than echo an HTML error page
        }
        return null;
    }

    static long parseRetryAfter(String value) {
        if (value == null) {
            return -1;
        }
        try {
            long seconds = Long.parseLong(value.trim());
            return seconds >= 0 ? Math.min(seconds, 3600) : -1;
        } catch (NumberFormatException e) {
            return -1; // HTTP-date form: fall back to our own backoff
        }
    }

    private void record(String path, int status, long startedMonotonic) {
        long millis = (System.nanoTime() - startedMonotonic) / 1_000_000L;
        lastCall = new CallRecord(path, status, millis, MarketClock.nowNanos(), false);
    }

    private static String checkSymbol(String symbol) throws ApiError {
        String s = symbol == null ? "" : symbol.trim().toUpperCase(Locale.ROOT);
        if (!SYMBOL.matcher(s).matches()) {
            throw new ApiError(ApiError.Kind.BAD_REQUEST, 0, "\"" + symbol + "\" is not a symbol ZeroGEX can look up", -1);
        }
        return s;
    }

    private static String encodeQuery(Map<String, String> query) {
        if (query.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> e : query.entrySet()) {
            sb.append(sb.length() == 0 ? '?' : '&').append(encode(e.getKey())).append('=').append(encode(e.getValue()));
        }
        return sb.toString();
    }

    private static String encode(String value) {
        try {
            return URLEncoder.encode(value, "UTF-8").replace("+", "%20");
        } catch (UnsupportedEncodingException e) {
            throw new IllegalStateException(e);
        }
    }

    private void forget(String path, Map<String, String> query) {
        String key = keys.apiKey();
        if (key == null) {
            return;
        }
        String cacheKey = Integer.toHexString(key.trim().hashCode()) + " " + baseUrl + path + encodeQuery(query);
        synchronized (CACHE) {
            CACHE.remove(cacheKey);
        }
    }

    private static String shortReason(Throwable e) {
        String msg = e.getMessage();
        String name = e.getClass().getSimpleName();
        if (msg == null || msg.isEmpty()) {
            return name;
        }
        return msg.length() > 80 ? msg.substring(0, 77) + "..." : msg;
    }

    /** Test hook: forget every cached response. */
    static void clearCacheForTests() {
        synchronized (CACHE) {
            CACHE.clear();
        }
    }
}
