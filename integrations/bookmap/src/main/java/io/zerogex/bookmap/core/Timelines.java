package io.zerogex.bookmap.core;

import java.util.EnumMap;
import java.util.Map;
import java.util.NavigableMap;
import java.util.TreeMap;

/**
 * Every level as a step function of time: the value in force at {@code t} is
 * the last point at or before {@code t}. That is exactly how Bookmap samples an
 * indicator, so what the labels and alerts read here is what the lines show.
 *
 * <p>Points are never de-duplicated on the way in. History and live snapshots
 * arrive out of order (a chart opened at noon fetches the morning after it has
 * already drawn the latest minute), and a point that looks redundant when it is
 * written can become the one that matters when an earlier point lands after it.
 * Keeping all of them costs a few hundred doubles a day per level.
 *
 * <p>Thread-safe: written by the add-on's network thread, read by the overlay
 * and by Bookmap's data thread.
 */
public final class Timelines {

    /** Points older than this are dropped, so a chart left open for weeks stays small. */
    static final long RETAIN_NANOS = 8L * MarketClock.DAY;

    private final Map<LevelKind, TreeMap<Long, Double>> lines =
            new EnumMap<LevelKind, TreeMap<Long, Double>>(LevelKind.class);
    private final boolean[] visible = new boolean[LevelKind.values().length];
    private LineSink sink = LineSink.NONE;

    public Timelines() {
        for (LevelKind kind : LevelKind.values()) {
            lines.put(kind, new TreeMap<Long, Double>());
            visible[kind.ordinal()] = true;
        }
    }

    public synchronized void attach(LineSink newSink) {
        this.sink = newSink == null ? LineSink.NONE : newSink;
        for (LevelKind kind : LevelKind.values()) {
            replay(kind);
        }
    }

    /** Writes one point. NaN marks "no level from here on". */
    public synchronized void put(LevelKind kind, long timeNanos, double price) {
        if (timeNanos == MarketClock.NONE) {
            return;
        }
        double value = Double.isNaN(price) || Double.isInfinite(price) || price <= 0 ? Double.NaN : price;
        lines.get(kind).put(timeNanos, value);
        if (visible[kind.ordinal()]) {
            sink.point(kind, timeNanos, value);
        }
    }

    /** The level in force at {@code timeNanos}; NaN when there is none. */
    public synchronized double valueAt(LevelKind kind, long timeNanos) {
        Map.Entry<Long, Double> e = lines.get(kind).floorEntry(timeNanos);
        return e == null ? Double.NaN : e.getValue();
    }

    /** True when any level has a point at or before {@code timeNanos}. */
    public synchronized boolean hasDataAt(long timeNanos) {
        for (TreeMap<Long, Double> line : lines.values()) {
            if (line.floorKey(timeNanos) != null) {
                return true;
            }
        }
        return false;
    }

    /**
     * Shows or hides one level's line. Hiding clears it from the chart; showing
     * redraws it from the points kept here, history included.
     */
    public synchronized void setVisible(LevelKind kind, boolean show) {
        if (visible[kind.ordinal()] == show) {
            return;
        }
        visible[kind.ordinal()] = show;
        if (show) {
            replay(kind);
        } else {
            sink.clearAll(kind);
        }
    }

    public synchronized boolean isVisible(LevelKind kind) {
        return visible[kind.ordinal()];
    }

    /** Forgets everything (symbol or expiration changed). */
    public synchronized void clear() {
        for (LevelKind kind : LevelKind.values()) {
            lines.get(kind).clear();
            sink.clearAll(kind);
        }
    }

    /** Drops points older than the retention window, keeping the one in force at its edge. */
    public synchronized void trim(long nowNanos) {
        long cutoff = nowNanos - RETAIN_NANOS;
        for (TreeMap<Long, Double> line : lines.values()) {
            Long keep = line.floorKey(cutoff);
            if (keep != null) {
                line.headMap(keep, false).clear();
            }
        }
    }

    /** A copy of one level's points, for tests and diagnostics. */
    public synchronized NavigableMap<Long, Double> points(LevelKind kind) {
        return new TreeMap<Long, Double>(lines.get(kind));
    }

    public synchronized int size() {
        int n = 0;
        for (TreeMap<Long, Double> line : lines.values()) {
            n += line.size();
        }
        return n;
    }

    private void replay(LevelKind kind) {
        sink.clearAll(kind);
        if (!visible[kind.ordinal()]) {
            return;
        }
        for (Map.Entry<Long, Double> e : lines.get(kind).entrySet()) {
            sink.point(kind, e.getKey(), e.getValue());
        }
    }
}
