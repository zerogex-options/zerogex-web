package io.zerogex.bookmap;

import io.zerogex.bookmap.core.Fixtures;
import io.zerogex.bookmap.core.FakeApi;
import io.zerogex.bookmap.core.FakeTransport;
import io.zerogex.bookmap.core.HttpTransport;
import io.zerogex.bookmap.core.LevelKind;
import io.zerogex.bookmap.core.MarketClock;
import io.zerogex.bookmap.harness.FakeBookmap;
import io.zerogex.bookmap.harness.FakeCanvas;
import io.zerogex.bookmap.harness.FakeIndicator;
import io.zerogex.bookmap.harness.LocalApiServer;
import io.zerogex.bookmap.harness.PreviewRenderer;
import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.awt.Component;
import java.awt.Container;
import java.awt.Dimension;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;
import javax.swing.JLabel;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.CanvasIcon;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.CompositeCoordinateBase;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.CompositeVerticalCoordinate;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory.ScreenSpaceCanvasType;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainter;
import velox.api.layer1.messages.Layer1ApiSoundAlertDeclarationMessage;
import velox.api.layer1.messages.Layer1ApiSoundAlertMessage;
import velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyScreenSpacePainter;
import velox.api.layer1.simplified.Api;
import velox.api.layer1.simplified.InitialState;
import velox.api.layer1.simplified.LineStyle;
import velox.gui.StrategyPanel;

/**
 * The whole add-on, as Bookmap would run it: loaded on an ES chart, fetching
 * from a local stand-in for api.zerogex.io over real HTTP, drawing into fake
 * Bookmap indicators and a fake heatmap canvas, raising an alert, building its
 * settings panels, and unloading cleanly.
 */
public class AddonEndToEndTest {

    static final String ALIAS = "ESZ6.CME@RITHMIC";
    static final String KEY = "zg_live_test_key_0123456789";
    static final double PIPS = 0.25;

    /** The live snapshot, always "just computed" relative to the real clock the add-on runs on. */
    static HttpTransport.Response handle(FakeApi api, String url) {
        if (url.contains("/api/v1/levels/")) {
            long now = MarketClock.nowNanos();
            Fixtures.Levels f = new Fixtures.Levels();
            f.asOf = now - now % MarketClock.MINUTE - MarketClock.MINUTE;
            f.computedAt = now - 13L * MarketClock.SECOND;
            f.dataAsOf = now - 16L * MarketClock.SECOND;
            f.ageSeconds = 16;
            return FakeTransport.ok(f.json());
        }
        return api.handle(url);
    }

    static Settings settings(String baseUrl) {
        Settings s = new Settings();
        s.apiBaseUrl = baseUrl;
        s.apiKey = KEY;
        s.alerts = true;
        s.alertSound = false; // no speech synthesizer outside Bookmap
        return s;
    }

    static InstrumentInfo es() {
        return new InstrumentInfo("ESZ6", "CME", "FUT", PIPS, 50, "E-mini S&P 500 Dec 2026", true);
    }

    @Test
    public void fullLifecycleAgainstAFakeBookmapAndALocalApi() throws Exception {
        final FakeApi truth = new FakeApi();
        try (LocalApiServer server = new LocalApiServer(u -> handle(truth, u))) {
            final FakeBookmap bookmap = new FakeBookmap(settings(server.baseUrl()));
            final ZeroGexLevels addon = new ZeroGexLevels();
            addon.initialize(ALIAS, es(), bookmap.api, new InitialState());
            try {
                // ---- Lines ----
                Check.eq(5, bookmap.indicators.size(), "one line per level");
                for (LevelKind kind : LevelKind.values()) {
                    FakeIndicator line = bookmap.indicator("ZeroGEX " + kind.displayName);
                    Check.isTrue(line.showLine, "line on: " + kind);
                    Check.isFalse(line.showWidget, "no empty widget panels: " + kind);
                    Check.eq(kind.defaultRgb, line.color.getRGB() & 0xFFFFFF, "default color: " + kind);
                }
                Check.eq(LineStyle.LONG_DASH, bookmap.indicator("ZeroGEX Gamma Flip").style, "flip dashed");

                final long now = MarketClock.nowNanos();
                addon.onTimestamp(now);
                addon.onTrade(7581.5 / PIPS, 1, null);
                addon.onRealtimeStart();

                final FakeIndicator callWall = bookmap.indicator("ZeroGEX Call Wall");
                waitFor("the live levels to be drawn", () -> !Double.isNaN(callWall.valueAt(MarketClock.nowNanos())));
                Check.near(7727.0 / PIPS, callWall.valueAt(MarketClock.nowNanos()), 1e-9,
                        "drawn in Bookmap levels (price / tick)");
                Check.near(7526.25 / PIPS, bookmap.indicator("ZeroGEX Put Wall").valueAt(MarketClock.nowNanos()), 1e-9,
                        "put wall");

                // ---- Requests ----
                waitFor("the history backfill", () -> server.requests.stream().anyMatch(r -> r.contains("/api/gex/historical")));
                for (String r : new ArrayList<String>(server.requests)) {
                    Check.notContains(r, KEY, "no key in any URL");
                }
                for (String h : new ArrayList<String>(server.authHeaders)) {
                    Check.eq("Bearer " + KEY, h, "Bearer header on every request");
                }

                // ---- Overlay ----
                List<Layer1ApiUserMessageModifyScreenSpacePainter> painters =
                        bookmap.messagesOf(Layer1ApiUserMessageModifyScreenSpacePainter.class);
                Check.eq(1, painters.size(), "one painter registered");
                Layer1ApiUserMessageModifyScreenSpacePainter reg = painters.get(0);
                Check.isTrue(reg.isAdd, "registered, not removed");
                Check.isTrue(reg.aliasFilter.isDisplayedForAlias(ALIAS), "drawn on this chart");
                Check.isFalse(reg.aliasFilter.isDisplayedForAlias("NQZ6.CME@RITHMIC"), "and on no other chart");

                Check.contains(reg.userName, ALIAS, "a painter name of its own, so two charts never share one");

                FakeCanvas wrongChart = new FakeCanvas();
                ScreenSpacePainter other = reg.screenSpacePainterFactory.createScreenSpacePainter("ZeroGEX",
                        "NQZ6.CME@RITHMIC", wrongChart);
                other.onHeatmapPriceHeight(800);
                other.onHeatmapPixelsHeight(800);
                other.onHeatmapFullPixelsWidth(1400);
                other.onMoveEnd();

                FakeCanvas canvas = new FakeCanvas();
                ScreenSpacePainter painter = reg.screenSpacePainterFactory.createScreenSpacePainter("ZeroGEX", ALIAS, canvas);
                Check.eq(ScreenSpaceCanvasType.HEATMAP, canvas.type, "heatmap canvas");
                // The window shows 7,500 to 7,700 on 800 x 1,400 pixels.
                painter.onHeatmapPriceBottom((long) (7500 / PIPS));
                painter.onHeatmapPriceHeight((long) (200 / PIPS));
                painter.onHeatmapPixelsHeight(800);
                painter.onHeatmapFullPixelsWidth(1400);
                painter.onMoveEnd();
                waitFor("labels, markers, profile and badge", () -> canvas.snapshot().size() >= 10);
                Check.eq(null, wrongChart.type, "no canvas is even created for another chart's window");

                List<Double> labelLevels = new ArrayList<Double>();
                boolean badge = false;
                boolean marker = false;
                for (ScreenSpaceCanvas.CanvasShape shape : canvas.snapshot()) {
                    CanvasIcon icon = (CanvasIcon) shape;
                    CompositeVerticalCoordinate y1 = icon.getY1().compose();
                    CompositeVerticalCoordinate y2 = icon.getY2().compose();
                    BufferedImage img = icon.getImage().getReadOnlyImage();
                    Check.eq(img.getHeight(), y2.pixelsY - y1.pixelsY, "image exactly as tall as its slot");
                    Check.eq(img.getWidth(), icon.getX2().compose().pixelsX - icon.getX1().compose().pixelsX,
                            "and exactly as wide: Bookmap never has to scale it");
                    if (y1.base == CompositeCoordinateBase.DATA_ZERO && img.getHeight() > 14) {
                        labelLevels.add(y1.dataY);
                    }
                    if (y1.base == CompositeCoordinateBase.PIXEL_ZERO && y1.pixelsY == 8) {
                        badge = true;
                    }
                    if (y1.base == CompositeCoordinateBase.PIXEL_ZERO && y2.pixelsY > 760) {
                        marker = true;
                    }
                }
                for (double price : new double[] {7526.25, 7626.75, 7600.0, 7689.75}) {
                    Check.isTrue(labelLevels.contains(price / PIPS), "a label pinned at " + price + ": " + labelLevels);
                }
                Check.isTrue(badge, "status badge at the bottom-left");
                Check.isTrue(marker, "call wall marker at the top edge");

                PreviewRenderer preview = new PreviewRenderer(1400, 800, 1180, now - 95L * MarketClock.MINUTE,
                        MarketClock.nowNanos(), (long) (7500 / PIPS), (long) (200 / PIPS), PIPS);
                List<FakeIndicator> lines = new ArrayList<FakeIndicator>(bookmap.indicators.values());
                PreviewRenderer.write(preview.render(lines, canvas.snapshot(), 7581.5), "bookmap-overlay.png");

                // A tight scalper's zoom: only max pain and the pin in view, everything else as markers.
                painter.onHeatmapPriceBottom((long) (7590 / PIPS));
                painter.onHeatmapPriceHeight((long) (45 / PIPS));
                painter.onMoveEnd();
                Thread.sleep(600);
                PreviewRenderer zoom = new PreviewRenderer(1400, 800, 1180, now - 20L * MarketClock.MINUTE,
                        MarketClock.nowNanos(), (long) (7590 / PIPS), (long) (45 / PIPS), PIPS);
                PreviewRenderer.write(zoom.render(lines, canvas.snapshot(), 7612.25), "bookmap-overlay-zoomed.png");

                // ---- Alerts ----
                List<Layer1ApiSoundAlertDeclarationMessage> decl = bookmap.messagesOf(Layer1ApiSoundAlertDeclarationMessage.class);
                Check.eq(1, decl.size(), "one alert type declared");
                Check.isTrue(decl.get(0).aliasMatcher.test(ALIAS), "for this chart");
                addon.onTimestamp(MarketClock.nowNanos());
                addon.onTrade(7545.0 / PIPS, 1, null);
                addon.onTrade(7526.5 / PIPS, 1, null);
                waitFor("the put wall alert", () -> !bookmap.messagesOf(Layer1ApiSoundAlertMessage.class).isEmpty());
                Layer1ApiSoundAlertMessage alert = bookmap.messagesOf(Layer1ApiSoundAlertMessage.class).get(0);
                Check.eq("ZeroGEX: ES within 0.25 of Put Wall 7,526.25", alert.textInfo, "alert text");
                Check.eq(decl.get(0).id, alert.alertDeclarationId, "tied to the declaration");
                Check.eq(ALIAS, alert.alias, "on this chart");
                Check.isTrue(alert.showPopup, "popup on");
                Check.eq(null, alert.sound, "sound off as set");

                // ---- Settings ----
                Settings next = addon.settings();
                next.showLevel[LevelKind.MAX_PAIN.ordinal()] = false;
                next.levelColor[LevelKind.CALL_WALL.ordinal()] = 0x00FF00;
                addon.applySettings(next);
                Check.eq(0, bookmap.indicator("ZeroGEX Max Pain").snapshot().size(), "hidden line cleared");
                Check.eq(0x00FF00, bookmap.indicator("ZeroGEX Call Wall").color.getRGB() & 0xFFFFFF, "recolored live");
                Check.isFalse(((Settings) bookmap.settings).showLevel[LevelKind.MAX_PAIN.ordinal()],
                        "saved with the workspace");
                Thread.sleep(600);
                for (ScreenSpaceCanvas.CanvasShape shape : canvas.snapshot()) {
                    CompositeVerticalCoordinate y1 = ((CanvasIcon) shape).getY1().compose();
                    Check.isFalse(y1.base == CompositeCoordinateBase.DATA_ZERO && y1.dataY == 7626.75 / PIPS
                            && ((CanvasIcon) shape).getImage().getReadOnlyImage().getHeight() > 14,
                            "max pain label gone too");
                }
                next = addon.settings();
                next.showLevel[LevelKind.MAX_PAIN.ordinal()] = true;
                addon.applySettings(next);
                Check.isTrue(bookmap.indicator("ZeroGEX Max Pain").snapshot().size() > 0, "shown again, history included");

                StrategyPanel[] panels = addon.getCustomSettingsPanels();
                Check.eq(4, panels.length, "connection, levels, profile, alerts");
                Check.eq("ZeroGEX connection", panels[0].getTitle(), "first panel");
                String status = findStatus(panels[0]);
                Check.contains(status, "ZeroGEX ES", "live status in the panel: " + status);
                renderPanels(panels);

                String diag = addon.diagnostics();
                Check.contains(diag, "API key: set (" + KEY.length() + " chars)", "key presence");
                Check.notContains(diag, KEY, "never the key itself");
                Check.contains(diag, "Mapped to: ES", "mapping");
                Check.contains(diag, "chart contract ESZ26", "contract");
            } finally {
                addon.stop();
            }

            // ---- Unload ----
            List<Layer1ApiUserMessageModifyScreenSpacePainter> painters =
                    bookmap.messagesOf(Layer1ApiUserMessageModifyScreenSpacePainter.class);
            Check.isFalse(painters.get(painters.size() - 1).isAdd, "painter unregistered");
            List<Layer1ApiSoundAlertDeclarationMessage> decl = bookmap.messagesOf(Layer1ApiSoundAlertDeclarationMessage.class);
            Check.isFalse(decl.get(decl.size() - 1).isAdd, "alert type removed");
            Thread.sleep(300); // let a request already on the wire land
            int requests = server.requests.size();
            Thread.sleep(1500);
            Check.eq(requests, server.requests.size(), "no requests after unload");
        }
    }

    @Test
    public void anOldBookmapWithoutTheOverlayApiStillDrawsTheLines() throws Exception {
        final FakeApi truth = new FakeApi();
        try (LocalApiServer server = new LocalApiServer(u -> handle(truth, u))) {
            final FakeBookmap bookmap = new FakeBookmap(settings(server.baseUrl()));
            // Bookmap 7.0's Api has no getProvider(): calling it fails to link.
            Api old = (Api) Proxy.newProxyInstance(getClass().getClassLoader(), new Class<?>[] {Api.class},
                    new InvocationHandler() {
                        @Override
                        public Object invoke(Object proxy, Method m, Object[] args) throws Throwable {
                            if (m.getName().equals("getProvider")) {
                                throw new AbstractMethodError("getProvider");
                            }
                            try {
                                return m.invoke(bookmap.api, args);
                            } catch (java.lang.reflect.InvocationTargetException e) {
                                throw e.getCause();
                            }
                        }
                    });
            ZeroGexLevels addon = new ZeroGexLevels();
            addon.initialize(ALIAS, es(), old, new InitialState());
            try {
                addon.onTimestamp(MarketClock.nowNanos());
                final FakeIndicator callWall = bookmap.indicator("ZeroGEX Call Wall");
                waitFor("lines without an overlay", () -> !Double.isNaN(callWall.valueAt(MarketClock.nowNanos())));
                Check.contains(addon.overlayNote(), "lines still work", "the settings panel explains it");
                Check.contains(addon.alertNote(), "cannot show popups", "and the alert limitation");
                Check.eq(0, bookmap.messagesOf(Layer1ApiUserMessageModifyScreenSpacePainter.class).size(), "no painter");
            } finally {
                addon.stop();
            }
        }
    }

    @Test
    public void aChartZeroGexDoesNotCoverMakesNoRequests() throws Exception {
        final FakeApi truth = new FakeApi();
        try (LocalApiServer server = new LocalApiServer(u -> handle(truth, u))) {
            FakeBookmap bookmap = new FakeBookmap(settings(server.baseUrl()));
            ZeroGexLevels addon = new ZeroGexLevels();
            addon.initialize("CLZ6.NYMEX@RITHMIC", new InstrumentInfo("CLZ6", "NYMEX", "FUT", 0.01, 1000,
                    "Crude Oil Dec 2026", true), bookmap.api, new InitialState());
            try {
                addon.onTimestamp(MarketClock.nowNanos());
                Thread.sleep(800);
                Check.eq(0, server.requests.size(), "crude oil is not looked up");
                Check.contains(addon.statusLine(), "pick one in the add-on settings", "and the chart says so");
                Settings next = addon.settings();
                next.symbol = "ES";
                addon.applySettings(next);
                waitFor("an override to take effect", () -> server.requests.size() > 0);
            } finally {
                addon.stop();
            }
        }
    }

    // ------------------------------------------------------------------

    static void waitFor(String what, BooleanSupplier condition) throws InterruptedException {
        long deadline = System.nanoTime() + 15L * MarketClock.SECOND;
        while (System.nanoTime() < deadline) {
            if (condition.getAsBoolean()) {
                return;
            }
            Thread.sleep(50);
        }
        throw new AssertionError("timed out waiting for " + what);
    }

    static String findStatus(Container c) {
        boolean next = false;
        for (Component child : c.getComponents()) {
            if (child instanceof JLabel) {
                String text = ((JLabel) child).getText();
                if (next) {
                    return text;
                }
                if ("Status".equals(text)) {
                    next = true;
                }
            }
        }
        return null;
    }

    static void renderPanels(StrategyPanel[] panels) throws Exception {
        int width = 760;
        int total = 0;
        for (StrategyPanel p : panels) {
            Dimension d = p.getPreferredSize();
            p.setSize(Math.max(width, d.width), d.height);
            layoutAll(p);
            total += d.height + 12;
        }
        BufferedImage img = new BufferedImage(width, total, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(java.awt.Color.WHITE);
        g.fillRect(0, 0, width, total);
        int y = 0;
        for (StrategyPanel p : panels) {
            Graphics2D pg = (Graphics2D) g.create(0, y, width, p.getHeight());
            p.printAll(pg);
            pg.dispose();
            y += p.getHeight() + 12;
        }
        g.dispose();
        PreviewRenderer.write(img, "bookmap-settings.png");
    }

    static void layoutAll(Container c) {
        c.doLayout();
        for (Component child : c.getComponents()) {
            if (child instanceof Container) {
                layoutAll((Container) child);
            }
        }
    }
}
