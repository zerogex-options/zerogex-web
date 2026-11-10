package io.zerogex.bookmap.core;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Locale;

/**
 * Payloads shaped exactly like the API's, built in code so each test can vary
 * one field. Numbers default to the real ES levels at the Nov 9, 2026 close:
 * flip 7,689.75, call wall 7,727.00, put wall 7,526.25, max pain 7,626.75.
 */
public final class Fixtures {

    public static final ZoneId ET = ZoneId.of("America/New_York");

    private Fixtures() {
    }

    /** Epoch nanos for a New York wall-clock time. */
    public static long et(int year, int month, int day, int hour, int minute) {
        return et(year, month, day, hour, minute, 0);
    }

    public static long et(int year, int month, int day, int hour, int minute, int second) {
        return MarketClock.toNanos(ZonedDateTime.of(year, month, day, hour, minute, second, 0, ET).toInstant());
    }

    public static String iso(long nanos) {
        return MarketClock.isoUtc(nanos);
    }

    /** Builder for a /api/v1/levels body. */
    public static final class Levels {
        public String symbol = "ES";
        public double spot = 7581.5;
        public long asOf = et(2026, 11, 10, 10, 41);
        public long computedAt = et(2026, 11, 10, 10, 41, 47);
        public long dataAsOf = et(2026, 11, 10, 10, 41, 44);
        public long ageSeconds = 12;
        public Double callWall = 7727.0;
        public Double putWall = 7526.25;
        public Double flip = 7689.75;
        public Double maxPain = 7626.75;
        public Double pin = 7600.0;
        public String flipLabel = null;
        public double netGexAtSpot = -2.95e10;
        public String expiration = null;
        public String expiredExcluded = "";
        public String rolledTo = null;
        public String contract = "ESZ26";
        public int strikes = 60;

        public String json() {
            StringBuilder p = new StringBuilder();
            double base = 7430;
            for (int i = 0; i < strikes; i++) {
                double strike = base + i * 5;
                // Short gamma below the flip, long above, with heavy strikes at the walls.
                double net = (strike - 7689.75) * 4.0e7;
                if (strike == 7725) {
                    net = 3.1e9;
                }
                if (strike == 7525) {
                    net = -2.6e9;
                }
                if (p.length() > 0) {
                    p.append(',');
                }
                p.append(String.format(Locale.ROOT,
                        "{\"strike\":%.2f,\"net_gex\":%.1f,\"call_gex\":%.1f,\"put_gex\":%.1f}",
                        strike, net, Math.max(net, 0) + 1e8, Math.min(net, 0) - 1e8));
            }
            return "{"
                    + "\"symbol\":\"" + symbol + "\","
                    + "\"spot\":" + spot + ","
                    + "\"as_of\":\"" + iso(asOf) + "\","
                    + "\"age_seconds\":" + ageSeconds + ","
                    + (computedAt == MarketClock.NONE ? "" : "\"computed_at\":\"" + iso(computedAt) + "\",")
                    + (dataAsOf == MarketClock.NONE ? "" : "\"data_as_of\":\"" + iso(dataAsOf) + "\",")
                    + "\"net_gex_at_spot\":" + netGexAtSpot + ","
                    + "\"expiration\":" + str(expiration) + ","
                    + "\"levels\":{"
                    + "\"gamma_flip\":" + num(flip) + ","
                    + "\"gamma_flip_reason\":" + (flip == null ? "\"BEYOND_MAX_DISTANCE\"" : "null") + ","
                    + "\"gamma_flip_label\":" + str(flipLabel) + ","
                    + "\"call_wall\":" + num(callWall) + ","
                    + "\"put_wall\":" + num(putWall) + ","
                    + "\"max_pain\":" + num(maxPain) + ","
                    + "\"pin_strike\":" + num(pin)
                    + "},"
                    + "\"pin_score\":1504000000.0,\"pin_confidence\":0.31,"
                    + "\"pin_strike_reason\":" + (pin == null ? "\"PIN_SCORE_TOO_WEAK\"" : "null") + ","
                    + "\"profile\":[" + p + "],"
                    + "\"expired_excluded\":[" + expiredExcluded + "],"
                    + "\"rolled_to_expiration\":" + str(rolledTo) + ","
                    + "\"data_contract\":" + str(contract) + ","
                    + "\"data_contract_expiry\":\"2026-12-18\""
                    + "}";
        }
    }

    /** One /api/gex/historical row; prices as JSON strings, the way Decimal serializes. */
    public static String historyRow(long bucket, double call, double put, Double flip, double pain) {
        return "{\"timestamp\":\"" + iso(bucket) + "\",\"symbol\":\"ES\",\"spot_price\":\"7581.50\","
                + "\"total_call_gex\":null,\"total_put_gex\":null,\"net_gex\":\"-29540000000.0\","
                + "\"gamma_flip\":" + (flip == null ? "null" : "\"" + flip + "\"") + ","
                + "\"max_pain\":\"" + pain + "\",\"call_wall\":\"" + call + "\",\"put_wall\":\"" + put + "\","
                + "\"call_walls\":[],\"put_walls\":[],\"pin_strike\":null,\"expired_excluded\":[]}";
    }

    public static String summary(long bucket, double call, double put, double flip, double pain, double pin,
                                 boolean postClose) {
        return "{\"timestamp\":\"" + iso(bucket) + "\",\"symbol\":\"ES\",\"spot_price\":\"7578.75\","
                + "\"total_call_gex\":\"1.0\",\"total_put_gex\":\"-1.0\",\"net_gex\":\"0\","
                + "\"gamma_flip\":\"" + flip + "\",\"max_pain\":\"" + pain + "\",\"call_wall\":\"" + call + "\","
                + "\"put_wall\":\"" + put + "\",\"pin_strike\":\"" + pin + "\","
                + "\"expired_excluded\":[" + (postClose ? "\"2026-11-09\"" : "") + "],"
                + "\"rolled_to_expiration\":" + (postClose ? "\"2026-11-10\"" : "null") + "}";
    }

    static String num(Double d) {
        return d == null ? "null" : String.valueOf(d);
    }

    static String str(String s) {
        return s == null ? "null" : "\"" + s + "\"";
    }
}
