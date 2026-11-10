package io.zerogex.bookmap.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * One {@code GEXSummary} row: an element of {@code /api/gex/historical}, or the
 * single object {@code /api/gex/summary} returns.
 *
 * <p>The history rows carry the walls, flip and max pain for each minute of a
 * past session (projected onto the futures axis row by row for ES and NQ). The
 * pin strike is not part of the history, so it is NaN there and the add-on
 * draws the pin only from the moments it saw it live.
 */
public final class SummaryRow {

    /** The minute bucket the snapshot is filed under. */
    public final long timestamp;
    public final double spot;
    private final double[] levels;
    public final List<String> expiredExcluded;
    public final String rolledToExpiration;
    public final String dataContract;

    private SummaryRow(Map<String, Object> o) {
        this.timestamp = MarketClock.parseIso(Json.string(o, "timestamp"));
        this.spot = Json.number(o, "spot_price");
        this.levels = new double[LevelKind.values().length];
        for (LevelKind kind : LevelKind.values()) {
            levels[kind.ordinal()] = Json.number(o, kind.apiField);
        }
        List<String> expired = new ArrayList<String>();
        for (Object item : Json.array(o.get("expired_excluded"))) {
            if (item instanceof String) {
                expired.add((String) item);
            }
        }
        this.expiredExcluded = Collections.unmodifiableList(expired);
        this.rolledToExpiration = Json.string(o, "rolled_to_expiration");
        this.dataContract = Json.string(o, "data_contract");
    }

    public double level(LevelKind kind) {
        return levels[kind.ordinal()];
    }

    public boolean isPostClose() {
        return !expiredExcluded.isEmpty() || rolledToExpiration != null;
    }

    /** Parses the history endpoint's array. Rows without a timestamp are dropped. */
    public static List<SummaryRow> parseArray(String body) {
        Object root = Json.parse(body);
        if (!(root instanceof List)) {
            throw new IllegalArgumentException("history response is not an array");
        }
        List<SummaryRow> out = new ArrayList<SummaryRow>();
        for (Object item : Json.array(root)) {
            SummaryRow row = new SummaryRow(Json.object(item));
            if (row.timestamp != MarketClock.NONE) {
                out.add(row);
            }
        }
        return out;
    }

    /** Parses the summary endpoint's single object. */
    public static SummaryRow parseObject(String body) {
        Map<String, Object> o = Json.object(Json.parse(body));
        if (!o.containsKey("timestamp")) {
            throw new IllegalArgumentException("summary response has no timestamp");
        }
        SummaryRow row = new SummaryRow(o);
        if (row.timestamp == MarketClock.NONE) {
            throw new IllegalArgumentException("summary response has an unreadable timestamp");
        }
        return row;
    }
}
