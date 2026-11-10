package io.zerogex.bookmap.core;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;

/**
 * Keeps one chart's level timelines filled: the live levels as they are
 * published, the session's history from before the chart was opened, and the
 * book that stood overnight.
 *
 * <p>Everything here is independent of Bookmap. It runs on its own daemon
 * thread, one small step at a time; {@link #step()} does one unit of work (one
 * history page set, one live poll) and returns how long to wait before the
 * next. Tests drive {@code step()} directly with a fake transport and clock.
 *
 * <h3>Which time the chart is at</h3>
 * The chart's own data time (from Bookmap) decides what to show, not the
 * desktop clock. A chart at the live edge polls the live levels. A chart
 * replaying last Tuesday gets last Tuesday's levels from the history endpoint
 * and polls nothing live, because today's levels drawn over last Tuesday would
 * be confidently wrong.
 *
 * <h3>Where each value goes</h3>
 * Every value is placed at the moment it became knowable: a live snapshot at
 * its {@code computed_at}, a history row at the end of its bar, the post-close
 * book at the close. Scrolling back to ask "was the wall there when price got
 * to it?" never shows a level before it existed.
 */
public final class Engine {

    /** Clock seam for tests. Wall time is epoch nanos; monotonic is {@link System#nanoTime()}. */
    public interface Clock {
        long wallNanos();

        long monoNanos();
    }

    public static final Clock SYSTEM_CLOCK = new Clock() {
        @Override
        public long wallNanos() {
            return MarketClock.nowNanos();
        }

        @Override
        public long monoNanos() {
            return System.nanoTime();
        }
    };

    /** What to fetch. Immutable; replaced as a whole when settings change. */
    public static final class Config {
        /** API symbol, or null when the chart could not be mapped to one. */
        public final String apiSymbol;
        /** The chart's contract (e.g. "ESZ26"), or null. */
        public final String chartContract;
        /** "all" or "0dte". */
        public final String expiration;
        public final int profileStrikes;

        public Config(String apiSymbol, String chartContract, String expiration, int profileStrikes) {
            this.apiSymbol = apiSymbol;
            this.chartContract = chartContract;
            this.expiration = expiration == null ? "all" : expiration.trim().toLowerCase(java.util.Locale.ROOT);
            this.profileStrikes = Math.max(10, Math.min(200, profileStrikes));
        }

        boolean sameData(Config o) {
            return o != null && eq(apiSymbol, o.apiSymbol) && eq(expiration, o.expiration);
        }

        public boolean wholeChain() {
            return "all".equals(expiration);
        }

        private static boolean eq(String a, String b) {
            return a == null ? b == null : a.equals(b);
        }
    }

    public enum State {
        /** Nothing fetched yet. */
        STARTING,
        /** The chart is not a symbol ZeroGEX can be asked about; pick one in settings. */
        NO_SYMBOL,
        /** No API key entered. */
        NO_KEY,
        /** Levels are drawn and the last request worked. */
        OK,
        /** The last request failed; levels already on the chart are kept. */
        ERROR,
        /** A failure retrying cannot fix (rejected key). Waiting for new settings. */
        PARKED
    }

    /** An immutable picture of the engine for the overlay and the settings panel. */
    public static final class Status {
        public final State state;
        public final ApiError lastError;
        /** The last good live snapshot, or null (none yet, or showing a past session). */
        public final LevelsSnapshot latest;
        /** True when the chart is on a past session and the levels come from history. */
        public final boolean past;
        /** The data time the labels are evaluated at. */
        public final long referenceTime;
        /** Non-null when the chart's contract differs from the levels': {chart, levels}. */
        public final String[] contractMismatch;
        /** Rows of history loaded, for diagnostics. */
        public final int historyRows;
        public final String symbol;

        public Status(State state, ApiError lastError, LevelsSnapshot latest, boolean past, long referenceTime,
               String[] contractMismatch, int historyRows, String symbol) {
            this.state = state;
            this.lastError = lastError;
            this.latest = latest;
            this.past = past;
            this.referenceTime = referenceTime;
            this.contractMismatch = contractMismatch;
            this.historyRows = historyRows;
            this.symbol = symbol;
        }
    }

    /** Progress loading one cash session. Engine thread only. */
    static final class SessionState {
        final LocalDate date;
        /** Stamp of the last history value written, or NONE. */
        long lastStamp = MarketClock.NONE;
        boolean rthLoaded;
        boolean empty;
        boolean overnightResolved;
        long retryAtMono;
        int rows;

        SessionState(LocalDate date) {
            this.date = date;
        }
    }

    /** A chart at most this far behind the clock is "at the live edge". */
    static final long LIVE_WINDOW = 10L * MarketClock.MINUTE;
    /** How many sessions back a chart's own history can pull in. */
    static final int MAX_SESSIONS_BACK = 4;
    /** The delayed summary reaches back at most a day; leave margin. */
    static final long DELAYED_REACH = 24L * MarketClock.HOUR - 10L * MarketClock.MINUTE;
    /** A live gap longer than this, in session, is back-filled from history. */
    static final long GAP_FILL_AFTER = 3L * MarketClock.MINUTE;

    private final ZeroGexApi api;
    private final ZeroGexApi.KeySource keys;
    private final Timelines timelines;
    private final Clock clock;
    private final PollPlanner planner;

    private volatile Config config;
    private volatile long dataTime = MarketClock.NONE;
    private volatile long earliestDataTime = MarketClock.NONE;
    private volatile Status status;
    private volatile boolean kicked;

    // ---- engine-thread state ----
    private Config applied;
    private final Map<LocalDate, SessionState> sessions = new HashMap<LocalDate, SessionState>();
    private long nextLiveMono;
    private boolean parked;
    private LevelsSnapshot latest;
    private long lastLiveStamp = MarketClock.NONE;
    /** The first live point drawn for this symbol: history only fills time before it. */
    private long firstLiveStamp = MarketClock.NONE;
    private ApiError lastError;
    private boolean everSucceeded;

    // ---- scheduling ----
    private ScheduledExecutorService executor;
    private ScheduledFuture<?> pending;
    private final Object scheduleLock = new Object();

    public Engine(ZeroGexApi api, ZeroGexApi.KeySource keys, Timelines timelines, Clock clock, Random random) {
        this.api = api;
        this.keys = keys;
        this.timelines = timelines;
        this.clock = clock;
        this.planner = new PollPlanner(random);
        this.status = new Status(State.STARTING, null, null, false, MarketClock.NONE, null, 0, null);
    }

    // ------------------------------------------------------------------
    // Inputs (any thread)
    // ------------------------------------------------------------------

    public void setConfig(Config newConfig) {
        this.config = newConfig;
        kick();
    }

    public Config config() {
        return config;
    }

    /** Bookmap's data time. Called for every event batch, so it does nothing else. */
    public void onDataTime(long nanos) {
        dataTime = nanos;
        long earliest = earliestDataTime;
        if (earliest == MarketClock.NONE || nanos < earliest) {
            earliestDataTime = nanos;
        }
    }

    public long dataTime() {
        return dataTime;
    }

    /** Ask for a step as soon as possible: a new key, symbol or setting. */
    public void kick() {
        kicked = true;
        synchronized (scheduleLock) {
            if (executor != null && !executor.isShutdown()) {
                if (pending != null) {
                    pending.cancel(false);
                }
                pending = executor.schedule(new Runnable() {
                    @Override
                    public void run() {
                        loop();
                    }
                }, 50, TimeUnit.MILLISECONDS);
            }
        }
    }

    public Status status() {
        return status;
    }

    // ------------------------------------------------------------------
    // Lifecycle
    // ------------------------------------------------------------------

    public void start(final String threadName) {
        synchronized (scheduleLock) {
            if (executor != null) {
                return;
            }
            executor = Executors.newSingleThreadScheduledExecutor(new ThreadFactory() {
                @Override
                public Thread newThread(Runnable r) {
                    Thread t = new Thread(r, threadName);
                    t.setDaemon(true);
                    t.setPriority(Thread.NORM_PRIORITY - 1);
                    return t;
                }
            });
        }
        kick();
    }

    public void stop() {
        synchronized (scheduleLock) {
            if (executor != null) {
                executor.shutdownNow();
            }
        }
    }

    private void loop() {
        long delay;
        try {
            delay = step();
        } catch (Throwable t) {
            // Never let one surprise end the thread: a dead engine thread is a
            // chart that silently stops updating.
            Logger.warn("engine step failed", t);
            delay = 15L * MarketClock.SECOND;
        }
        synchronized (scheduleLock) {
            if (executor == null || executor.isShutdown()) {
                return;
            }
            if (kicked) {
                delay = Math.min(delay, 50L * 1_000_000L);
            }
            pending = executor.schedule(new Runnable() {
                @Override
                public void run() {
                    loop();
                }
            }, Math.max(1_000_000L, delay), TimeUnit.NANOSECONDS);
        }
    }

    // ------------------------------------------------------------------
    // One step
    // ------------------------------------------------------------------

    /** Does one unit of work and returns the delay, in nanoseconds, before the next. */
    public long step() {
        boolean wasKicked = kicked;
        kicked = false;
        Config cfg = config;
        long now = clock.wallNanos();
        long mono = clock.monoNanos();

        if (cfg != applied) {
            applyConfig(cfg, mono);
        }
        if (wasKicked && parked) {
            // New settings (most likely a new key): try again now.
            parked = false;
            nextLiveMono = mono;
        }
        if (cfg == null || cfg.apiSymbol == null) {
            publish(State.NO_SYMBOL, now);
            return 30L * MarketClock.SECOND;
        }
        String key = keys.apiKey();
        if (key == null || key.trim().isEmpty()) {
            lastError = null;
            publish(State.NO_KEY, now);
            return 5L * MarketClock.SECOND;
        }
        if (parked) {
            publish(State.PARKED, now);
            return 10L * MarketClock.MINUTE;
        }

        long ref = referenceTime(now);
        boolean current = isCurrent(ref, now);

        // 1. History: one session's worth per step, so a slow history load never
        //    delays the first live levels by more than one request.
        if (cfg.wholeChain()) {
            if (current && latest == null && !everSucceeded && mono >= nextLiveMono) {
                // First thing on a fresh chart: the live levels, so the trader
                // sees today's numbers before the backfill starts.
                pollLive(cfg, now, mono);
                publish(lastError == null ? State.OK : stateForError(), now);
                return 50L * 1_000_000L;
            }
            if (loadNextHistory(cfg, ref, now, mono, current)) {
                publish(lastError == null ? State.OK : stateForError(), now);
                return parked ? 10L * MarketClock.MINUTE : 100L * 1_000_000L;
            }
        }

        // 2. Live.
        if (current) {
            if (mono >= nextLiveMono) {
                pollLive(cfg, now, mono);
            }
            publish(lastError == null ? State.OK : stateForError(), now);
            long wait = nextLiveMono - clock.monoNanos();
            return Math.max(250L * 1_000_000L, Math.min(60L * MarketClock.SECOND, wait));
        }

        // A past session with everything loaded: nothing to fetch until the
        // chart moves to another day.
        publish(lastError == null ? State.OK : stateForError(), now);
        return 2L * MarketClock.SECOND;
    }

    private void applyConfig(Config cfg, long mono) {
        if (applied == null || cfg == null || !cfg.sameData(applied)) {
            sessions.clear();
            timelines.clear();
            latest = null;
            lastLiveStamp = MarketClock.NONE;
            firstLiveStamp = MarketClock.NONE;
            lastError = null;
            everSucceeded = false;
        }
        applied = cfg;
        parked = false;
        // The same reading the step started with: a fresh clock read here would
        // be a few nanoseconds later than it, and "live first" would be skipped.
        nextLiveMono = mono;
    }

    /** The chart's data time, or the clock when the chart has shown no data yet. */
    long referenceTime(long now) {
        long t = dataTime;
        return t == MarketClock.NONE ? now : t;
    }

    /**
     * True when the chart is in the current session or the overnight after it,
     * which is everything the live endpoint describes. A weekend chart sitting
     * at Friday's last print is current; a replay of last Tuesday is not.
     */
    static boolean isCurrent(long ref, long now) {
        if (Math.abs(now - ref) <= LIVE_WINDOW) {
            return true;
        }
        LocalDate session = MarketClock.latestSessionDate(now);
        return ref >= MarketClock.open(session);
    }

    // ------------------------------------------------------------------
    // Live
    // ------------------------------------------------------------------

    private void pollLive(Config cfg, long now, long mono) {
        try {
            LevelsSnapshot snap = api.levels(cfg.apiSymbol, cfg.profileStrikes, cfg.expiration);
            onSnapshot(cfg, snap, now);
            lastError = null;
            everSucceeded = true;
            nextLiveMono = clock.monoNanos() + planner.afterSuccess(snap, now);
        } catch (ApiError e) {
            onError(e);
            long delay = planner.afterFailure(e);
            if (delay < 0) {
                parked = true;
            } else {
                nextLiveMono = clock.monoNanos() + delay;
            }
        }
    }

    private void onSnapshot(Config cfg, LevelsSnapshot snap, long now) {
        long t = snap.effectiveTime();
        if (t == MarketClock.NONE) {
            t = now;
        }
        // A live gap in session (network outage, laptop asleep) is filled from
        // history before this point lands, so the line has no hole in it.
        if (cfg.wholeChain() && lastLiveStamp != MarketClock.NONE && t - lastLiveStamp > GAP_FILL_AFTER
                && !snap.isPostClose()) {
            LocalDate session = MarketClock.latestSessionDate(t);
            fillGap(cfg, session, lastLiveStamp, Math.min(t, now));
        }
        for (LevelKind kind : LevelKind.values()) {
            timelines.put(kind, t, snap.level(kind));
        }
        latest = snap;
        lastLiveStamp = t;
        if (firstLiveStamp == MarketClock.NONE || t < firstLiveStamp) {
            firstLiveStamp = t;
        }
        timelines.trim(now);
    }

    private void fillGap(Config cfg, LocalDate session, long from, long to) {
        try {
            List<SummaryRow> rows = api.history(cfg.apiSymbol, from, to, "1min", 5);
            // Only the hole: never past the live point about to land.
            writeRows(sessionState(session), rows, MarketClock.MINUTE, to - 1);
        } catch (ApiError e) {
            // The live point still lands; the gap just stays a straight line.
            Logger.info("gap fill skipped: " + e.getMessage());
        }
    }

    // ------------------------------------------------------------------
    // History
    // ------------------------------------------------------------------

    /**
     * Sessions the chart needs, most recent first. At the live edge that is
     * today's (or the last) session plus earlier ones the chart's own data
     * reaches back into; on a past session, that session and the same.
     */
    List<LocalDate> wantedSessions(long ref, long now, boolean current) {
        List<LocalDate> out = new ArrayList<LocalDate>();
        LocalDate first = MarketClock.latestSessionDate(current ? Math.max(ref, now) : ref);
        out.add(first);
        long earliest = earliestDataTime;
        LocalDate d = first;
        for (int i = 0; i < MAX_SESSIONS_BACK - 1; i++) {
            // The chart shows data from before this session's open, so it shows
            // the previous session's overnight (and maybe its day).
            if (earliest == MarketClock.NONE || earliest >= MarketClock.open(d)) {
                break;
            }
            d = MarketClock.previousWeekday(d);
            out.add(d);
        }
        return out;
    }

    /** Runs the next history task if there is one. Returns true when it made a request. */
    private boolean loadNextHistory(Config cfg, long ref, long now, long mono, boolean current) {
        List<LocalDate> wanted = wantedSessions(ref, now, current);
        LocalDate liveSession = current ? MarketClock.latestSessionDate(now) : null;
        for (int i = 0; i < wanted.size(); i++) {
            LocalDate d = wanted.get(i);
            SessionState st = sessionState(d);
            if (st.empty || mono < st.retryAtMono) {
                continue;
            }
            boolean isLiveSession = d.equals(liveSession);
            if (!st.rthLoaded) {
                loadSession(cfg, st, i == 0 ? "1min" : "5min", isLiveSession, now, mono);
                return true;
            }
            if (!st.overnightResolved) {
                if (isLiveSession) {
                    // The live endpoint answers for this session's overnight.
                    st.overnightResolved = true;
                    continue;
                }
                resolveOvernight(cfg, st, now, mono);
                return true;
            }
        }
        return false;
    }

    private void loadSession(Config cfg, SessionState st, String timeframe, boolean isLiveSession, long now,
                             long mono) {
        long open = MarketClock.open(st.date);
        long close = MarketClock.close(st.date);
        long end = Math.min(close, now);
        if (end <= open) {
            // Before this session's open: nothing to load yet.
            st.rthLoaded = true;
            st.overnightResolved = true;
            return;
        }
        long step = "1min".equals(timeframe) ? MarketClock.MINUTE : 5L * MarketClock.MINUTE;
        int maxPages = "1min".equals(timeframe) ? 6 : 2;
        try {
            List<SummaryRow> rows = api.history(cfg.apiSymbol, open, end, timeframe, maxPages);
            if (rows.isEmpty() && now > close) {
                // A finished weekday with no rows: a market holiday.
                st.empty = true;
            }
            // Live points are authoritative from the first one on: history fills
            // the time before it. Otherwise a chart opened mid-session would show
            // the history row for the current minute over the fresher live value
            // until the next poll, and a wall recomputed a strike apart would
            // flicker.
            long notAfter = firstLiveStamp == MarketClock.NONE ? now : Math.min(now, firstLiveStamp - 1);
            writeRows(st, rows, step, notAfter);
            st.rthLoaded = true;
            if (lastError != null && lastError.isTransient()) {
                lastError = null;
            }
        } catch (ApiError e) {
            onError(e);
            if (planner.afterFailure(e) < 0) {
                parked = true;
            }
            st.retryAtMono = mono + Math.max(30L * MarketClock.SECOND, retryDelay(e));
            if (e.kind == ApiError.Kind.NOT_FOUND || e.kind == ApiError.Kind.BAD_REQUEST) {
                // This symbol has no history (a newly added stock): draw live only.
                st.rthLoaded = true;
                st.overnightResolved = true;
            }
        }
    }

    /**
     * Writes history rows, each at the end of its bar. A row stamped after
     * {@code notAfter} is skipped: a bar that has not finished yet, or time the
     * live points already cover.
     */
    private void writeRows(SessionState st, List<SummaryRow> rows, long barNanos, long notAfter) {
        for (SummaryRow row : rows) {
            long stamp = row.timestamp + barNanos;
            if (stamp > notAfter) {
                continue;
            }
            for (LevelKind kind : LevelKind.values()) {
                if (kind == LevelKind.PIN_STRIKE) {
                    continue; // not in the history; drawn only from live data
                }
                timelines.put(kind, stamp, row.level(kind));
            }
            if (st.lastStamp == MarketClock.NONE || stamp > st.lastStamp) {
                st.lastStamp = stamp;
            }
            st.rows++;
        }
    }

    /**
     * The overnight after a past session: the post-close book if it is still
     * within reach of the delayed summary (a day), otherwise a gap. A gap is
     * the honest answer — drawing the 3:59 PM levels overnight would show walls
     * built partly from contracts that had already expired.
     */
    private void resolveOvernight(Config cfg, SessionState st, long now, long mono) {
        long close = MarketClock.close(st.date);
        long endOfDay = st.lastStamp != MarketClock.NONE ? st.lastStamp : close;
        long sinceClose = now - close;
        if (sinceClose > 2L * MarketClock.MINUTE && sinceClose < DELAYED_REACH) {
            int delayMinutes = (int) ((sinceClose - 2L * MarketClock.MINUTE) / MarketClock.MINUTE);
            try {
                SummaryRow book = api.summaryDelayed(cfg.apiSymbol, Math.max(1, delayMinutes));
                if (book.timestamp >= MarketClock.open(st.date) && book.timestamp <= close) {
                    long t = LevelsSnapshot.postCloseTime(book.timestamp);
                    for (LevelKind kind : LevelKind.values()) {
                        timelines.put(kind, t, book.level(kind));
                    }
                    st.overnightResolved = true;
                    return;
                }
            } catch (ApiError e) {
                if (e.isTransient() && planner.afterFailure(e) >= 0) {
                    st.retryAtMono = mono + 30L * MarketClock.SECOND;
                    onError(e);
                    return;
                }
                // Anything else: fall through to the gap.
            }
        }
        for (LevelKind kind : LevelKind.values()) {
            timelines.put(kind, endOfDay + 1, Double.NaN);
        }
        st.overnightResolved = true;
    }

    private SessionState sessionState(LocalDate d) {
        SessionState st = sessions.get(d);
        if (st == null) {
            st = new SessionState(d);
            sessions.put(d, st);
        }
        return st;
    }

    private long retryDelay(ApiError e) {
        long d = planner.afterFailure(e);
        return d < 0 ? 10L * MarketClock.MINUTE : d;
    }

    // ------------------------------------------------------------------
    // Status
    // ------------------------------------------------------------------

    private void onError(ApiError e) {
        lastError = e;
        Logger.info("request failed: " + e.getMessage());
    }

    private State stateForError() {
        return parked ? State.PARKED : State.ERROR;
    }

    private void publish(State state, long now) {
        Config cfg = applied;
        long ref = referenceTime(now);
        boolean past = cfg != null && cfg.apiSymbol != null && !isCurrent(ref, now);
        String[] mismatch = null;
        if (cfg != null && latest != null && !past) {
            mismatch = SymbolResolver.contractMismatch(cfg.chartContract, latest.dataContract);
        }
        int rows = 0;
        for (SessionState st : sessions.values()) {
            rows += st.rows;
        }
        if (state == State.OK && !everSucceeded && timelines.size() == 0) {
            state = State.STARTING;
        }
        status = new Status(state, lastError, past ? null : latest, past, ref, mismatch, rows,
                cfg == null ? null : cfg.apiSymbol);
    }
}
