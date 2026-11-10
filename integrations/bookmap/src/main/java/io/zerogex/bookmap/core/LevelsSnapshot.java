package io.zerogex.bookmap.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * One {@code GET /api/v1/levels/{symbol}} response, parsed.
 *
 * <p>Every level is a double that is NaN when the API sent null. The contract
 * is explicit that a null level means "could not resolve it, hide it" — a put
 * wall drawn at zero would also flatten the chart's price scale — so NaN is
 * carried all the way to the chart, where Bookmap draws it as a gap.
 */
public final class LevelsSnapshot {

    public final String symbol;
    public final double spot;
    /** Minute bucket the numbers are filed under. */
    public final long asOf;
    /** When the analytics engine produced them (server clock), or NONE. */
    public final long computedAt;
    /** Newest option-quote write the engine read, or NONE. */
    public final long dataAsOf;
    /** Server-measured age of the option quotes at response time, or -1. */
    public final long ageSeconds;
    public final double netGexAtSpot;
    /** The expiration the levels are scoped to, or null for the whole chain. */
    public final String expiration;
    private final double[] levels;
    public final String flipReason;
    /** Ready-to-draw text for a missing flip, e.g. "Flip >8%↓". Null when a flip was published. */
    public final String flipLabel;
    public final String pinReason;
    public final double pinConfidence;
    public final List<StrikeGamma> profile;
    public final List<String> expiredExcluded;
    public final String rolledToExpiration;
    /** CME contract the futures axis is quoted on, e.g. "ESZ26". Null for non-futures. */
    public final String dataContract;
    public final String dataContractExpiry;
    /** {@link System#nanoTime()} when the response arrived, for a monotonic age counter. */
    public final long receivedMonotonic;

    private LevelsSnapshot(Map<String, Object> o, long receivedMonotonic) {
        this.symbol = Json.string(o, "symbol");
        this.spot = Json.number(o, "spot");
        this.asOf = MarketClock.parseIso(Json.string(o, "as_of"));
        this.computedAt = MarketClock.parseIso(Json.string(o, "computed_at"));
        this.dataAsOf = MarketClock.parseIso(Json.string(o, "data_as_of"));
        double age = Json.number(o, "age_seconds");
        this.ageSeconds = Double.isNaN(age) ? -1 : (long) age;
        this.netGexAtSpot = Json.number(o, "net_gex_at_spot");
        this.expiration = Json.string(o, "expiration");

        Map<String, Object> lv = Json.object(o.get("levels"));
        this.levels = new double[LevelKind.values().length];
        for (LevelKind kind : LevelKind.values()) {
            levels[kind.ordinal()] = Json.number(lv, kind.apiField);
        }
        this.flipReason = Json.string(lv, "gamma_flip_reason");
        this.flipLabel = Json.string(lv, "gamma_flip_label");
        this.pinReason = Json.string(o, "pin_strike_reason");
        this.pinConfidence = Json.number(o, "pin_confidence");

        List<StrikeGamma> bars = new ArrayList<StrikeGamma>();
        for (Object item : Json.array(o.get("profile"))) {
            Map<String, Object> bar = Json.object(item);
            double strike = Json.number(bar, "strike");
            double net = Json.number(bar, "net_gex");
            // A ragged element costs one bar, never the whole profile.
            if (!Double.isNaN(strike) && !Double.isNaN(net)) {
                bars.add(new StrikeGamma(strike, net, Json.number(bar, "call_gex"), Json.number(bar, "put_gex")));
            }
        }
        this.profile = Collections.unmodifiableList(bars);

        List<String> expired = new ArrayList<String>();
        for (Object item : Json.array(o.get("expired_excluded"))) {
            if (item instanceof String) {
                expired.add((String) item);
            }
        }
        this.expiredExcluded = Collections.unmodifiableList(expired);
        this.rolledToExpiration = Json.string(o, "rolled_to_expiration");
        this.dataContract = Json.string(o, "data_contract");
        this.dataContractExpiry = Json.string(o, "data_contract_expiry");
        this.receivedMonotonic = receivedMonotonic;
    }

    /**
     * Parses a response body. Throws {@link IllegalArgumentException} when the
     * body is not the levels contract at all — notably a 200 from something in
     * the path that is not the API (a captive portal, a proxy error page),
     * which must not be mistaken for "every level is null today".
     */
    public static LevelsSnapshot parse(String body, long receivedMonotonic) {
        Map<String, Object> o = Json.object(Json.parse(body));
        if (!o.containsKey("levels") || !(o.get("levels") instanceof Map)) {
            throw new IllegalArgumentException("response has no \"levels\" object");
        }
        return new LevelsSnapshot(o, receivedMonotonic);
    }

    /** The level's price, or NaN when the API did not publish one. */
    public double level(LevelKind kind) {
        return levels[kind.ordinal()];
    }

    /**
     * True for the book as it stands after the close: the session's last
     * snapshot with that day's expired contracts taken out. Those numbers
     * describe the overnight, not the minute they are filed under.
     */
    public boolean isPostClose() {
        return !expiredExcluded.isEmpty() || rolledToExpiration != null;
    }

    /**
     * When these numbers became knowable, which is where they go on the chart.
     *
     * <p>Placing a snapshot at the moment it was produced rather than at the
     * moment this add-on happened to fetch it means two charts, or a chart and
     * a replay of the same session, draw every change at the same instant. And
     * it never draws a level before it existed: a trader scrolling back to ask
     * "was the wall there when price got to it?" gets an honest answer.
     *
     * <p>The post-close book is placed at the end of its bucket — the close —
     * because that is when the expiring contracts leave it. One nanosecond
     * past it, so it always replaces the session's last minute (which a
     * history row also stamps at the close) rather than racing it.
     */
    public long effectiveTime() {
        if (isPostClose() && asOf != MarketClock.NONE) {
            return postCloseTime(asOf);
        }
        long t = computedAt != MarketClock.NONE ? computedAt
                : dataAsOf != MarketClock.NONE ? dataAsOf
                : asOf != MarketClock.NONE ? asOf + MarketClock.MINUTE
                : MarketClock.NONE;
        if (t != MarketClock.NONE && asOf != MarketClock.NONE && t < asOf) {
            t = asOf;
        }
        return t;
    }

    /** Where a post-close book filed under {@code bucket} goes on the timeline. */
    public static long postCloseTime(long bucket) {
        return bucket + MarketClock.MINUTE + 1;
    }

    /**
     * Age of the option quotes now: the server's measurement plus the time
     * since it answered. Counted on the monotonic clock so a wrong desktop
     * clock cannot make fresh data look stale (or the reverse). -1 if unknown.
     */
    public long liveAgeSeconds(long nowMonotonic) {
        if (ageSeconds < 0) {
            return -1;
        }
        long elapsed = Math.max(0L, (nowMonotonic - receivedMonotonic) / MarketClock.SECOND);
        return ageSeconds + elapsed;
    }
}
