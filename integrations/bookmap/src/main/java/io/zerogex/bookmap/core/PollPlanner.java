package io.zerogex.bookmap.core;

import java.util.Random;

/**
 * Decides when to ask for the live levels next.
 *
 * <p>The analytics engine recomputes the levels every ~30 seconds and stamps
 * each snapshot with {@code computed_at}. Polling on a fixed timer either
 * wastes requests (fast) or shows levels up to a whole interval late (slow).
 * Instead this learns the cycle from consecutive {@code computed_at} values and
 * asks a few seconds after the next one is due, so the chart is current within
 * seconds of each recompute for about two requests a minute.
 *
 * <p>The few seconds include a random offset fixed per chart. Every copy of the
 * add-on aligns to the same server cycle; without it they would all arrive in
 * the same second.
 *
 * <p>When the engine has stopped producing snapshots (the cash session is
 * closed: ES and NQ levels hold from the 4:00 PM close), it backs off to one
 * request every 15 minutes, and wakes up just after the 9:30 open so the
 * session's first levels land promptly.
 *
 * <p>All times here are durations on the monotonic clock, derived from the
 * server's own timestamps, so a desktop clock that is minutes off cannot make
 * it poll early, late, or in a loop.
 */
public final class PollPlanner {

    static final long DEFAULT_PERIOD = 30L * MarketClock.SECOND;
    static final long MIN_PERIOD = 15L * MarketClock.SECOND;
    static final long MAX_PERIOD = 90L * MarketClock.SECOND;
    /** Never two live requests closer than this. */
    static final long MIN_GAP = 8L * MarketClock.SECOND;
    /** In session, never longer than this between requests. */
    static final long MAX_GAP = 50L * MarketClock.SECOND;
    /** A snapshot computed longer ago than this means the engine is idle (market closed). */
    static final long IDLE_AFTER = 5L * MarketClock.MINUTE;
    static final long CLOSED_POLL = 15L * MarketClock.MINUTE;
    static final long AFTER_OPEN = 40L * MarketClock.SECOND;

    private long period = DEFAULT_PERIOD;
    private long lastComputedAt = MarketClock.NONE;
    private int sameCycleRepeats;
    private int consecutiveFailures;
    private final long spreadNanos;

    public PollPlanner(Random random) {
        // 2 to 7 seconds after the cycle; fixed for this chart's lifetime.
        this.spreadNanos = 2L * MarketClock.SECOND + (long) (random.nextDouble() * 5L * MarketClock.SECOND);
    }

    /** Delay before the next request, after a good response. {@code nowWall} is only used for the open. */
    public long afterSuccess(LevelsSnapshot snap, long nowWall) {
        consecutiveFailures = 0;
        long sinceComputed = sinceComputed(snap);

        if (sinceComputed > IDLE_AFTER) {
            // The engine is not cycling. Nothing will change before the open.
            lastComputedAt = snap.computedAt;
            sameCycleRepeats = 0;
            long untilOpen = MarketClock.nextOpenAfter(nowWall) - nowWall + AFTER_OPEN;
            return Math.max(MIN_GAP, Math.min(CLOSED_POLL, untilOpen));
        }

        if (snap.computedAt != MarketClock.NONE && lastComputedAt != MarketClock.NONE) {
            if (snap.computedAt > lastComputedAt) {
                long observed = snap.computedAt - lastComputedAt;
                // Only learn from one-cycle gaps; a gap spanning a missed cycle or
                // an outage would drag the estimate upward.
                if (observed >= MIN_PERIOD && observed <= MAX_PERIOD) {
                    period = (long) (period * 0.7 + observed * 0.3);
                }
                sameCycleRepeats = 0;
            } else {
                sameCycleRepeats++;
            }
        }
        lastComputedAt = snap.computedAt;

        long delay;
        if (sinceComputed < 0) {
            delay = period;
        } else if (sameCycleRepeats > 0) {
            // We asked for the next cycle and got the last one again: it is
            // running late. Ask again shortly, a little later each time.
            delay = Math.min(MAX_GAP, MIN_GAP + (sameCycleRepeats - 1) * 4L * MarketClock.SECOND);
        } else {
            delay = period - sinceComputed + spreadNanos;
        }
        return clamp(delay, MIN_GAP, MAX_GAP);
    }

    /**
     * Delay before retrying after a failure. Returns -1 for failures retrying
     * cannot fix (a rejected key): the engine parks until settings change.
     */
    public long afterFailure(ApiError error) {
        consecutiveFailures++;
        switch (error.kind) {
            case NO_KEY:
            case KEY_REJECTED:
            case NO_ACCESS:
                return -1;
            case NOT_FOUND:
            case BAD_REQUEST:
                return 10L * MarketClock.MINUTE;
            case RATE_LIMITED:
                return Math.max(60L * MarketClock.SECOND,
                        error.retryAfterSeconds > 0 ? error.retryAfterSeconds * MarketClock.SECOND : 0L);
            default: {
                if (error.retryAfterSeconds > 0) {
                    return Math.max(MIN_GAP, error.retryAfterSeconds * MarketClock.SECOND);
                }
                // 15s, 30s, 60s, 2m, 4m, then every 5 minutes.
                long backoff = 15L * MarketClock.SECOND << Math.min(5, consecutiveFailures - 1);
                return Math.min(5L * MarketClock.MINUTE, backoff);
            }
        }
    }

    public long period() {
        return period;
    }

    public int consecutiveFailures() {
        return consecutiveFailures;
    }

    /**
     * Seconds (in nanos) between the snapshot's computation and the moment the
     * server answered, from the server's own clock: the server's "now" is the
     * quotes' timestamp plus their reported age. -1 when it cannot be told.
     */
    static long sinceComputed(LevelsSnapshot snap) {
        if (snap.computedAt == MarketClock.NONE || snap.ageSeconds < 0) {
            return -1;
        }
        long quotesAt = snap.dataAsOf != MarketClock.NONE ? snap.dataAsOf : snap.asOf;
        if (quotesAt == MarketClock.NONE) {
            return -1;
        }
        long serverNow = quotesAt + snap.ageSeconds * MarketClock.SECOND;
        return Math.max(0L, serverNow - snap.computedAt);
    }

    private static long clamp(long v, long lo, long hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
