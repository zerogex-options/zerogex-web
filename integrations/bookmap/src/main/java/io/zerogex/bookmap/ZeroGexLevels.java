package io.zerogex.bookmap;

import io.zerogex.bookmap.alerts.AlertSink;
import io.zerogex.bookmap.core.AlertEngine;
import io.zerogex.bookmap.core.Engine;
import io.zerogex.bookmap.core.Format;
import io.zerogex.bookmap.core.LevelKind;
import io.zerogex.bookmap.core.LevelsSnapshot;
import io.zerogex.bookmap.core.Logger;
import io.zerogex.bookmap.core.MarketClock;
import io.zerogex.bookmap.core.StatusText;
import io.zerogex.bookmap.core.StrikeGamma;
import io.zerogex.bookmap.core.SymbolResolver;
import io.zerogex.bookmap.core.Timelines;
import io.zerogex.bookmap.core.UrlConnectionTransport;
import io.zerogex.bookmap.core.ZeroGexApi;
import io.zerogex.bookmap.overlay.Overlay;
import io.zerogex.bookmap.overlay.OverlayFrame;
import io.zerogex.bookmap.ui.AddonControl;
import io.zerogex.bookmap.ui.SettingsPanels;
import java.lang.reflect.Constructor;
import java.lang.reflect.InvocationTargetException;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import velox.api.layer1.annotations.Layer1ApiVersion;
import velox.api.layer1.annotations.Layer1ApiVersionValue;
import velox.api.layer1.annotations.Layer1SimpleAttachable;
import velox.api.layer1.annotations.Layer1StrategyName;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.data.TradeInfo;
import velox.api.layer1.simplified.Api;
import velox.api.layer1.simplified.CustomModule;
import velox.api.layer1.simplified.CustomSettingsPanelProvider;
import velox.api.layer1.simplified.HistoricalModeListener;
import velox.api.layer1.simplified.InitialState;
import velox.api.layer1.simplified.TimeListener;
import velox.api.layer1.simplified.TradeDataListener;
import velox.gui.StrategyPanel;

/**
 * ZeroGEX Gamma Levels for Bookmap.
 *
 * <p>Draws the ZeroGEX dealer-positioning levels (call wall, put wall, gamma
 * flip, max pain, pin strike) on a Bookmap chart and keeps them current from
 * the ZeroGEX API with the trader's Pro API key. One instance per chart.
 *
 * <p>The pieces, each in its own class:
 * <ul>
 *   <li>{@link Engine} fetches levels and history on its own thread and keeps
 *       {@link Timelines} filled;</li>
 *   <li>{@link IndicatorLines} draws the timelines as Bookmap indicators;</li>
 *   <li>the overlay (labels, gamma profile, status badge) and Bookmap-native
 *       alerts are loaded by name, so a Bookmap too old for them still runs
 *       the add-on with lines and spoken alerts;</li>
 *   <li>{@link SettingsPanels} is the settings UI.</li>
 * </ul>
 *
 * <p>Nothing here ever blocks Bookmap's threads on the network.
 */
@Layer1SimpleAttachable
@Layer1StrategyName("ZeroGEX Gamma Levels")
@Layer1ApiVersion(Layer1ApiVersionValue.VERSION2)
public class ZeroGexLevels implements CustomModule, TimeListener, TradeDataListener, HistoricalModeListener,
        CustomSettingsPanelProvider, AddonControl {

    public static final String VERSION = "1.0.0";

    /** Every running chart, so a key pasted in one chart wakes all of them. */
    private static final Set<ZeroGexLevels> RUNNING =
            Collections.newSetFromMap(new ConcurrentHashMap<ZeroGexLevels, Boolean>());

    private Api api;
    private String alias = "";
    private double pips = 0.25;
    private int decimals = 2;
    private String instrumentSymbol;
    private String instrumentExchange;
    private String instrumentType;
    private String instrumentFullName;

    private volatile Settings settings = new Settings();
    private volatile SymbolResolver.Resolution resolution;
    private Timelines timelines;
    private Engine engine;
    private ZeroGexApi client;
    private IndicatorLines lines;
    private volatile Overlay overlay;
    private volatile String overlayNote = "";
    private volatile AlertSink alerts = AlertSink.NONE;
    private volatile String alertNote = "";
    private final AlertEngine alertEngine = new AlertEngine();
    private final double[] alertLevels = new double[LevelKind.values().length]; // Bookmap data thread only
    private ScheduledExecutorService overlayThread;

    private volatile double lastPrice = Double.NaN;
    private volatile boolean realtime;

    // ------------------------------------------------------------------
    // Bookmap lifecycle
    // ------------------------------------------------------------------

    @Override
    public void initialize(String alias, InstrumentInfo info, Api api, InitialState initialState) {
        this.api = api;
        this.alias = alias == null ? "" : alias;
        readInstrument(info);
        if (initialState != null && initialState.getLastTradePrice() > 0) {
            lastPrice = initialState.getLastTradePrice() * pips;
        }

        Settings loaded = null;
        try {
            loaded = api.getSettings(Settings.class);
        } catch (Throwable t) {
            Logger.warn("could not read saved settings; using defaults", t);
        }
        settings = (loaded == null ? new Settings() : loaded).normalize();
        resolution = resolve(settings);

        timelines = new Timelines();
        lines = new IndicatorLines(api, pips, settings);
        for (LevelKind kind : LevelKind.values()) {
            timelines.setVisible(kind, settings.showLevel[kind.ordinal()]);
        }
        timelines.attach(lines);

        client = new ZeroGexApi(new UrlConnectionTransport(), settings.apiBaseUrl, this::apiKey, userAgent());
        engine = new Engine(client, this::apiKey, timelines, Engine.SYSTEM_CLOCK, new Random());
        engine.setConfig(engineConfig(settings, resolution));
        alertEngine.configure(settings.alertLevel, settings.alertTicks, pips);

        overlayThread = Executors.newSingleThreadScheduledExecutor(daemon("ZeroGEX overlay " + this.alias));
        overlay = createOverlay();
        alerts = createAlerts();

        RUNNING.add(this);
        engine.start("ZeroGEX " + this.alias);
        overlayThread.scheduleWithFixedDelay(new Runnable() {
            @Override
            public void run() {
                tick();
            }
        }, 200, 250, TimeUnit.MILLISECONDS);
        Logger.info("started " + VERSION + " on " + this.alias + " -> "
                + (resolution.isResolved() ? resolution.apiSymbol : "unmapped"));
    }

    @Override
    public void stop() {
        RUNNING.remove(this);
        if (engine != null) {
            engine.stop();
        }
        if (overlayThread != null) {
            overlayThread.shutdownNow();
        }
        Overlay o = overlay;
        overlay = null;
        if (o != null) {
            try {
                o.dispose();
            } catch (Throwable t) {
                Logger.warn("overlay dispose failed", t);
            }
        }
        alerts.dispose();
        alerts = AlertSink.NONE;
    }

    @Override
    public void onTimestamp(long t) {
        Engine e = engine;
        if (e != null) {
            e.onDataTime(t);
        }
    }

    @Override
    public void onRealtimeStart() {
        realtime = true;
        Engine e = engine;
        if (e != null) {
            e.kick();
        }
    }

    @Override
    public void onTrade(double price, int size, TradeInfo tradeInfo) {
        double p = price * pips;
        lastPrice = p;
        Settings s = settings;
        if (!realtime || !s.alerts || timelines == null) {
            return;
        }
        long t = engine.dataTime();
        for (LevelKind kind : LevelKind.values()) {
            alertLevels[kind.ordinal()] = timelines.valueAt(kind, t);
        }
        AlertEngine.Hit hit = alertEngine.onPrice(p, alertLevels, System.nanoTime());
        if (hit != null) {
            String symbol = resolution != null && resolution.apiSymbol != null ? resolution.apiSymbol : alias;
            alerts.raise(AlertEngine.describe(hit, symbol, decimals), s.alertPopup, s.alertSound);
        }
    }

    @Override
    public StrategyPanel[] getCustomSettingsPanels() {
        return SettingsPanels.build(this);
    }

    // ------------------------------------------------------------------
    // Overlay
    // ------------------------------------------------------------------

    /** Builds the next frame. Overlay thread, four times a second. */
    private void tick() {
        Overlay o = overlay;
        if (o == null) {
            return;
        }
        try {
            o.update(frame());
        } catch (Throwable t) {
            Logger.warn("overlay tick failed", t);
        }
    }

    OverlayFrame frame() {
        Engine.Status st = engine.status();
        long ref = st.referenceTime == MarketClock.NONE ? MarketClock.nowNanos() : st.referenceTime;
        double[] levels = new double[LevelKind.values().length];
        for (LevelKind kind : LevelKind.values()) {
            levels[kind.ordinal()] = timelines.valueAt(kind, ref);
        }
        StatusText.Lines status = StatusText.build(st, levels[LevelKind.GAMMA_FLIP.ordinal()], lastPrice,
                MarketClock.nowNanos(), System.nanoTime());
        Settings s = settings;
        OverlayFrame.Style style = new OverlayFrame.Style(s.labels, s.showLevel, s.levelColor, s.labelSize,
                s.statusBadge, s.statusBadgeBottom, s.profile, s.profileOnRight, s.profileWidthPct);
        return new OverlayFrame(pips, decimals, levels, lastPrice, status, profileFor(st, ref), style);
    }

    /**
     * The profile is today's book, so it is drawn only when the chart is
     * showing a moment at or after it was computed. Replaying this morning
     * draws no profile rather than this afternoon's.
     */
    static List<StrikeGamma> profileFor(Engine.Status st, long ref) {
        LevelsSnapshot latest = st.latest;
        if (latest == null || st.past) {
            return Collections.emptyList();
        }
        long at = latest.effectiveTime();
        if (at != MarketClock.NONE && ref + 2L * MarketClock.MINUTE < at) {
            return Collections.emptyList();
        }
        return latest.profile;
    }

    private void requestOverlayRefresh() {
        ScheduledExecutorService t = overlayThread;
        if (t == null || t.isShutdown()) {
            return;
        }
        try {
            t.execute(new Runnable() {
                @Override
                public void run() {
                    Overlay o = overlay;
                    if (o != null) {
                        try {
                            o.refresh();
                        } catch (Throwable e) {
                            Logger.warn("overlay refresh failed", e);
                        }
                    }
                }
            });
        } catch (java.util.concurrent.RejectedExecutionException ignored) {
            // shutting down
        }
    }

    /**
     * Loads the overlay by name. On Bookmap 7.0/7.1 the screen-space API does
     * not exist; the class fails to link, and the add-on carries on with the
     * lines alone.
     */
    private Overlay createOverlay() {
        try {
            Class<?> c = Class.forName("io.zerogex.bookmap.overlay.ScreenOverlay", true,
                    ZeroGexLevels.class.getClassLoader());
            Constructor<?> k = c.getConstructor(Api.class, Class.class, String.class, Runnable.class);
            Overlay o = (Overlay) k.newInstance(api, ZeroGexLevels.class, alias, (Runnable) this::requestOverlayRefresh);
            overlayNote = "";
            return o;
        } catch (InvocationTargetException e) {
            overlayNote = "Labels and profile unavailable on this Bookmap version (lines still work)";
            Logger.warn("overlay unavailable", e.getCause());
        } catch (Throwable t) {
            overlayNote = "Labels and profile need Bookmap 7.2 or later (lines still work)";
            Logger.warn("overlay unavailable", t);
        }
        return null;
    }

    private AlertSink createAlerts() {
        try {
            Class<?> c = Class.forName("io.zerogex.bookmap.alerts.DeclaredAlerts", true,
                    ZeroGexLevels.class.getClassLoader());
            AlertSink sink = (AlertSink) c.getConstructor(Api.class, Class.class, String.class)
                    .newInstance(api, ZeroGexLevels.class, alias);
            alertNote = "";
            return sink;
        } catch (Throwable t) {
            Logger.info("Bookmap alert declarations unavailable, using spoken alerts: " + t);
        }
        try {
            Class<?> c = Class.forName("io.zerogex.bookmap.alerts.SpokenAlerts", true,
                    ZeroGexLevels.class.getClassLoader());
            AlertSink sink = (AlertSink) c.getConstructor().newInstance();
            alertNote = "This Bookmap version speaks alerts but cannot show popups (needs 7.4+)";
            return sink;
        } catch (Throwable t) {
            alertNote = "Alerts are not available on this Bookmap version";
            Logger.warn("alerts unavailable", t);
            return AlertSink.NONE;
        }
    }

    // ------------------------------------------------------------------
    // Settings (AddonControl, called from the settings panel on the EDT)
    // ------------------------------------------------------------------

    @Override
    public Settings settings() {
        return settings.copy();
    }

    @Override
    public synchronized void applySettings(Settings next) {
        Settings s = next.copy().normalize();
        Settings before = settings;
        settings = s;
        try {
            api.setSettings(s);
        } catch (Throwable t) {
            Logger.warn("could not save settings", t);
        }
        lines.applyStyle(s);
        for (LevelKind kind : LevelKind.values()) {
            timelines.setVisible(kind, s.showLevel[kind.ordinal()]);
        }
        alertEngine.configure(s.alertLevel, s.alertTicks, pips);
        if (!s.symbol.equals(before.symbol) || !s.expiration.equals(before.expiration)
                || s.profileStrikes != before.profileStrikes) {
            resolution = resolve(s);
            engine.setConfig(engineConfig(s, resolution));
        }
        requestOverlayRefresh();
    }

    @Override
    public String saveApiKey(String key) {
        String trimmed = key == null ? "" : key.trim();
        // Copied from the API docs' example header: keep the key, drop the scheme.
        if (trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            trimmed = trimmed.substring(7).trim();
        }
        if (!trimmed.isEmpty() && !trimmed.matches("[\\x21-\\x7e]{8,256}")) {
            return "That doesn't look like a ZeroGEX API key - copy it again from Account > API Access";
        }
        boolean shared = KeyStore.save(trimmed);
        Settings s = settings.copy();
        // Keep a per-chart copy only when the shared store is unavailable.
        s.apiKey = shared ? "" : trimmed;
        applySettings(s);
        for (ZeroGexLevels other : RUNNING) {
            if (other.engine != null) {
                other.engine.kick();
            }
        }
        if (trimmed.isEmpty()) {
            return "Key removed";
        }
        return shared ? "Saved for every Bookmap chart on this computer" : "Saved for this chart";
    }

    @Override
    public boolean hasApiKey() {
        String k = apiKey();
        return k != null && !k.isEmpty();
    }

    @Override
    public String statusLine() {
        Engine.Status st = engine.status();
        long ref = st.referenceTime == MarketClock.NONE ? MarketClock.nowNanos() : st.referenceTime;
        StatusText.Lines l = StatusText.build(st, timelines.valueAt(LevelKind.GAMMA_FLIP, ref), lastPrice,
                MarketClock.nowNanos(), System.nanoTime());
        return l.headline + " - " + l.detail + (l.warning != null ? " - " + l.warning : "");
    }

    @Override
    public StatusText.Tone statusTone() {
        Engine.Status st = engine.status();
        StatusText.Lines l = StatusText.build(st, Double.NaN, lastPrice, MarketClock.nowNanos(), System.nanoTime());
        return l.detailTone;
    }

    @Override
    public String detectedSymbolText() {
        SymbolResolver.Resolution auto = SymbolResolver.resolve(Settings.AUTO, alias, instrumentSymbol,
                instrumentFullName, LocalDate.now(MarketClock.NEW_YORK));
        if (!auto.isResolved()) {
            return "Auto (not recognized: " + auto.source + ")";
        }
        String contract = auto.chartContract != null ? " " + auto.chartContract : "";
        return "Auto - " + auto.apiSymbol + contract + (auto.micro ? " (micro: same levels)" : "");
    }

    @Override
    public void testConnection(final java.util.function.Consumer<String> done) {
        final Settings s = settings;
        final SymbolResolver.Resolution r = resolution;
        Thread t = new Thread(new Runnable() {
            @Override
            public void run() {
                String result;
                if (r == null || !r.isResolved()) {
                    result = "Pick a symbol first";
                } else {
                    try {
                        LevelsSnapshot snap = client.levels(r.apiSymbol, 1, s.expiration);
                        String asOf = snap.asOf == MarketClock.NONE ? "" : " as of "
                                + MarketClock.clockLabel(snap.asOf, MarketClock.nowNanos());
                        result = "Connected - " + r.apiSymbol + " levels" + asOf;
                        engine.kick();
                    } catch (io.zerogex.bookmap.core.ApiError e) {
                        result = e.userMessage();
                    } catch (Throwable e) {
                        result = "Test failed: " + e;
                    }
                }
                done.accept(result);
            }
        }, "ZeroGEX connection test");
        t.setDaemon(true);
        t.start();
    }

    @Override
    public String diagnostics() {
        StringBuilder sb = new StringBuilder();
        long now = MarketClock.nowNanos();
        Engine.Status st = engine.status();
        sb.append("ZeroGEX Bookmap add-on ").append(VERSION).append('\n');
        sb.append("Java ").append(System.getProperty("java.version")).append(" (")
                .append(System.getProperty("java.vendor")).append(") on ").append(System.getProperty("os.name"))
                .append(' ').append(System.getProperty("os.version")).append('\n');
        sb.append("Chart: alias=").append(alias).append(" symbol=").append(instrumentSymbol)
                .append(" exchange=").append(instrumentExchange).append(" type=").append(instrumentType)
                .append(" tick=").append(pips).append('\n');
        SymbolResolver.Resolution r = resolution;
        sb.append("Mapped to: ").append(r != null && r.isResolved() ? r.apiSymbol : "nothing")
                .append(" (setting ").append(settings.symbol).append(")")
                .append(r != null && r.chartContract != null ? " chart contract " + r.chartContract : "")
                .append('\n');
        sb.append("Expiration: ").append(settings.expiration).append(", profile strikes ")
                .append(settings.profileStrikes).append('\n');
        String key = apiKey();
        sb.append("API key: ").append(key == null || key.isEmpty() ? "not set" : "set (" + key.length() + " chars)")
                .append('\n');
        sb.append("State: ").append(st.state)
                .append(st.lastError != null ? " - " + st.lastError.getMessage() : "").append('\n');
        ZeroGexApi.CallRecord call = client.lastCall();
        if (call != null) {
            sb.append("Last request: ").append(call.path).append(" -> ")
                    .append(call.status < 0 ? "no response" : "HTTP " + call.status)
                    .append(call.fromCache ? " (shared with another chart)" : " in " + call.millis + " ms")
                    .append(" at ").append(MarketClock.clockLabel(call.atWallNanos, now)).append('\n');
        }
        LevelsSnapshot latest = st.latest;
        if (latest != null) {
            sb.append("Latest levels: as of ")
                    .append(latest.asOf == MarketClock.NONE ? "?" : MarketClock.clockLabel(latest.asOf, now))
                    .append(", quotes ").append(Format.age(latest.liveAgeSeconds(System.nanoTime()))).append(" old")
                    .append(latest.dataContract != null ? ", contract " + latest.dataContract : "")
                    .append(", profile ").append(latest.profile.size()).append(" strikes").append('\n');
        }
        long ref = st.referenceTime == MarketClock.NONE ? now : st.referenceTime;
        sb.append("At chart time ").append(MarketClock.clockLabel(ref, now)).append(st.past ? " (past session)" : "")
                .append(':');
        for (LevelKind kind : LevelKind.values()) {
            sb.append(' ').append(kind.displayName).append(' ')
                    .append(Format.price(timelines.valueAt(kind, ref), decimals)).append(';');
        }
        sb.append('\n');
        sb.append("History rows: ").append(st.historyRows).append(", timeline points: ").append(timelines.size())
                .append('\n');
        sb.append("Overlay: ").append(overlay != null ? "on" : "off").append(overlayNote.isEmpty() ? "" : " - " + overlayNote)
                .append('\n');
        sb.append("Alerts: ").append(settings.alerts ? "on" : "off")
                .append(alertNote.isEmpty() ? "" : " - " + alertNote).append('\n');
        sb.append("Realtime: ").append(realtime).append('\n');
        return sb.toString();
    }

    @Override
    public String overlayNote() {
        return overlayNote;
    }

    @Override
    public String alertNote() {
        return alertNote;
    }

    @Override
    public String version() {
        return VERSION;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private String apiKey() {
        String shared = KeyStore.load();
        if (shared != null && !shared.trim().isEmpty()) {
            return shared.trim();
        }
        String own = settings.apiKey;
        return own == null ? "" : own.trim();
    }

    private void readInstrument(InstrumentInfo info) {
        if (info == null) {
            return;
        }
        try {
            if (info.pips > 0 && !Double.isInfinite(info.pips)) {
                pips = info.pips;
            }
            instrumentSymbol = info.symbol;
            instrumentExchange = info.exchange;
            instrumentType = info.type;
            instrumentFullName = info.fullName;
        } catch (Throwable t) {
            Logger.warn("could not read instrument info", t);
        }
        decimals = Format.decimalsFor(pips, 2);
    }

    private SymbolResolver.Resolution resolve(Settings s) {
        return SymbolResolver.resolve(s.symbol, alias, instrumentSymbol, instrumentFullName,
                LocalDate.now(MarketClock.NEW_YORK));
    }

    static Engine.Config engineConfig(Settings s, SymbolResolver.Resolution r) {
        return new Engine.Config(r.apiSymbol, r.chartContract, s.expiration, s.profileStrikes);
    }

    static String userAgent() {
        return "ZeroGEX-Bookmap/" + VERSION + " (Java " + System.getProperty("java.version") + "; "
                + System.getProperty("os.name", "?").toLowerCase(Locale.ROOT) + ")";
    }

    private static ThreadFactory daemon(final String name) {
        return new ThreadFactory() {
            @Override
            public Thread newThread(Runnable r) {
                Thread t = new Thread(r, name);
                t.setDaemon(true);
                return t;
            }
        };
    }
}
