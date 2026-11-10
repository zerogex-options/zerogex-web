package io.zerogex.bookmap.core;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * A pretend ZeroGEX API with a known truth: every session's levels minute by
 * minute, the live snapshot, and the post-close book. Serves the real URL
 * shapes and pages history newest-first, 90 rows at a time, like the server.
 */
public final class FakeApi {

    /** The call wall moves from 7,727 to 7,750 at 10:00 ET each session; the flip is missing before 9:45. */
    public static double callWall(long bucket) {
        long minuteOfDay = (bucket - MarketClock.open(MarketClock.etDate(bucket))) / MarketClock.MINUTE;
        return minuteOfDay >= 30 ? 7750.0 : 7727.0;
    }

    public static Double flip(long bucket) {
        long minuteOfDay = (bucket - MarketClock.open(MarketClock.etDate(bucket))) / MarketClock.MINUTE;
        return minuteOfDay < 15 ? null : 7689.75;
    }

    public volatile String liveBody = new Fixtures.Levels().json();
    public volatile int liveStatus = 200;
    public volatile int historyStatus = 200;
    public volatile String summaryBody;

    public HttpTransport.Response handle(String url) {
        if (url.contains("/api/v1/levels/")) {
            return liveStatus == 200 ? FakeTransport.ok(liveBody)
                    : FakeTransport.status(liveStatus, "{\"detail\":\"" + detailFor(liveStatus) + "\"}");
        }
        if (url.contains("/api/gex/historical")) {
            if (historyStatus != 200) {
                return FakeTransport.status(historyStatus, "{\"detail\":\"" + detailFor(historyStatus) + "\"}");
            }
            return FakeTransport.ok(history(FakeTransport.query(url)));
        }
        if (url.contains("/api/gex/summary")) {
            return summaryBody == null ? FakeTransport.status(404, "{\"detail\":\"none\"}") : FakeTransport.ok(summaryBody);
        }
        return FakeTransport.status(404, "{\"detail\":\"Not Found\"}");
    }

    static String detailFor(int status) {
        switch (status) {
            case 401:
                return "Invalid or missing API key";
            case 404:
                return "No dealer-positioning levels available for XYZ";
            default:
                return "error";
        }
    }

    private static String history(Map<String, String> q) {
        long start = MarketClock.parseIso(q.get("start_date"));
        long end = MarketClock.parseIso(q.get("end_date"));
        long step = "5min".equals(q.get("timeframe")) ? 5L * MarketClock.MINUTE : MarketClock.MINUTE;
        int limit = Integer.parseInt(q.get("window_units"));
        List<String> rows = new ArrayList<String>();
        // Newest first, cash session only, bucket starts from 09:30 to 15:59.
        java.time.LocalDate d = MarketClock.etDate(end);
        for (long t = floorTo(end, step); t >= start && rows.size() < limit; t -= step) {
            if (!MarketClock.isRegularHours(t) || !MarketClock.isWeekday(MarketClock.etDate(t))) {
                continue;
            }
            rows.add(Fixtures.historyRow(t, callWall(t), 7526.25, flip(t), 7626.75));
        }
        return "[" + String.join(",", rows) + "]";
    }

    private static long floorTo(long t, long step) {
        long open = MarketClock.open(MarketClock.etDate(t));
        return open + Math.floorDiv(t - open, step) * step;
    }
}
