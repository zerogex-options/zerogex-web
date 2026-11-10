package io.zerogex.bookmap.overlay;

import io.zerogex.bookmap.core.Logger;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.CanvasIcon;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.CompositeCoordinateBase;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.CompositeHorizontalCoordinate;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.CompositeVerticalCoordinate;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.PreparedImage;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory.ScreenSpaceCanvasType;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainter;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpacePainterFactory;
import velox.api.layer1.messages.indicators.AliasFilter;
import velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyScreenSpacePainter;
import velox.api.layer1.simplified.Api;

/**
 * {@link Overlay} on Bookmap's screen-space painter API (Bookmap 7.2 and later).
 *
 * <p>Bookmap asks for one painter per heatmap window showing the chart and
 * tells it, through the callbacks, which prices and pixels the window covers.
 * Each painter keeps the shapes it has placed and, on every frame, replaces
 * only the ones whose image or position changed: most frames change nothing,
 * and an untouched shape costs Bookmap nothing.
 *
 * <p>Shapes are only ever added or removed on the add-on's overlay thread.
 * Bookmap's own callbacks just record the new geometry and ask for a redraw.
 */
public final class ScreenOverlay implements Overlay, ScreenSpacePainterFactory {

    private static final int IMAGE_CACHE = 256;

    private final Layer1ApiProvider provider;
    private final Class<?> owner;
    private final String alias;
    private final Runnable requestRefresh;
    private final List<WindowPainter> painters = new CopyOnWriteArrayList<WindowPainter>();
    private final Map<Sprite.Look, PreparedImage> images =
            new LinkedHashMap<Sprite.Look, PreparedImage>(64, 0.75f, true) {
                private static final long serialVersionUID = 1L;

                @Override
                protected boolean removeEldestEntry(Map.Entry<Sprite.Look, PreparedImage> eldest) {
                    return size() > IMAGE_CACHE;
                }
            };
    private volatile OverlayFrame frame;
    private volatile boolean disposed;

    /**
     * Registers the painter for this chart only.
     *
     * @param requestRefresh asks the add-on's overlay thread to call {@link #refresh()} soon
     */
    public ScreenOverlay(Api api, Class<?> owner, final String alias, Runnable requestRefresh) {
        this.provider = api.getProvider();
        this.owner = owner;
        this.alias = alias;
        this.requestRefresh = requestRefresh;
        provider.sendUserMessage(message(true));
    }

    /**
     * One painter registration per chart, named after the chart: Bookmap keys a
     * painter by its owner class and name, so with a shared name an ES and an
     * NQ chart would register the same painter, and closing one could take the
     * other's labels with it.
     */
    private Layer1ApiUserMessageModifyScreenSpacePainter message(boolean add) {
        return Layer1ApiUserMessageModifyScreenSpacePainter.builder(owner, "ZeroGEX levels overlay (" + alias + ")")
                .setScreenSpacePainterFactory(this)
                .setAliasFilter(new AliasFilter() {
                    @Override
                    public boolean isDisplayedForAlias(String a) {
                        return alias.equals(a);
                    }
                })
                .setIsAdd(add)
                .build();
    }

    @Override
    public ScreenSpacePainter createScreenSpacePainter(String indicatorName, String indicatorAlias,
                                                       ScreenSpaceCanvasFactory canvasFactory) {
        if (indicatorAlias != null && !alias.equals(indicatorAlias)) {
            // Belt and braces on top of the alias filter: these levels belong to
            // this chart's instrument and must never be drawn on another.
            return new IdlePainter();
        }
        WindowPainter painter = new WindowPainter(canvasFactory.createCanvas(ScreenSpaceCanvasType.HEATMAP));
        painters.add(painter);
        requestRefresh.run();
        return painter;
    }

    @Override
    public void update(OverlayFrame newFrame) {
        this.frame = newFrame;
        refresh();
    }

    @Override
    public void refresh() {
        OverlayFrame f = frame;
        if (f == null || disposed) {
            return;
        }
        for (WindowPainter p : painters) {
            try {
                p.render(f);
            } catch (Throwable t) {
                Logger.warn("overlay render failed", t);
            }
        }
    }

    @Override
    public void dispose() {
        disposed = true;
        try {
            provider.sendUserMessage(message(false));
        } catch (Throwable t) {
            Logger.warn("could not unregister overlay", t);
        }
        for (WindowPainter p : painters) {
            p.clear();
        }
        painters.clear();
    }

    private PreparedImage image(Sprite.Look look) {
        synchronized (images) {
            PreparedImage img = images.get(look);
            if (img == null) {
                img = new PreparedImage(SpriteImages.render(look));
                images.put(look, img);
            }
            return img;
        }
    }

    /** One heatmap window. */
    private final class WindowPainter implements ScreenSpacePainter {
        private final ScreenSpaceCanvas canvas;
        private final Map<String, Placed> placed = new HashMap<String, Placed>();
        private volatile long priceBottom;
        private volatile long priceHeight;
        private volatile int heightPx;
        private volatile int widthPx;
        private volatile boolean gone;

        WindowPainter(ScreenSpaceCanvas canvas) {
            this.canvas = canvas;
        }

        synchronized void render(OverlayFrame f) {
            if (gone) {
                return;
            }
            Viewport v = new Viewport(priceBottom, priceHeight, heightPx, widthPx);
            List<Sprite> sprites = OverlayLayout.build(f, v);
            Set<String> keep = new HashSet<String>();
            for (Sprite s : sprites) {
                keep.add(s.key);
                Placed old = placed.get(s.key);
                if (old != null && old.sprite.equals(s)) {
                    continue;
                }
                CanvasIcon icon = new CanvasIcon(image(s.look),
                        new CompositeHorizontalCoordinate(CompositeCoordinateBase.PIXEL_ZERO, s.x, 0L),
                        bottom(s),
                        new CompositeHorizontalCoordinate(CompositeCoordinateBase.PIXEL_ZERO, s.x + s.look.width, 0L),
                        top(s));
                // Add the new shape before removing the old one, so a moving
                // label never blinks out for a frame.
                canvas.addShape(icon);
                if (old != null) {
                    canvas.removeShape(old.icon);
                }
                placed.put(s.key, new Placed(s, icon));
            }
            if (placed.size() != keep.size()) {
                java.util.Iterator<Map.Entry<String, Placed>> it = placed.entrySet().iterator();
                while (it.hasNext()) {
                    Map.Entry<String, Placed> e = it.next();
                    if (!keep.contains(e.getKey())) {
                        canvas.removeShape(e.getValue().icon);
                        it.remove();
                    }
                }
            }
        }

        private CompositeVerticalCoordinate bottom(Sprite s) {
            return s.anchor == Sprite.Anchor.PRICE
                    ? new CompositeVerticalCoordinate(CompositeCoordinateBase.DATA_ZERO, s.bottomPx, s.levelY)
                    : new CompositeVerticalCoordinate(CompositeCoordinateBase.PIXEL_ZERO, s.bottomPx, 0.0);
        }

        private CompositeVerticalCoordinate top(Sprite s) {
            int px = s.bottomPx + s.look.height;
            return s.anchor == Sprite.Anchor.PRICE
                    ? new CompositeVerticalCoordinate(CompositeCoordinateBase.DATA_ZERO, px, s.levelY)
                    : new CompositeVerticalCoordinate(CompositeCoordinateBase.PIXEL_ZERO, px, 0.0);
        }

        synchronized void clear() {
            for (Placed p : placed.values()) {
                try {
                    canvas.removeShape(p.icon);
                } catch (Throwable ignored) {
                    // the window may already be gone
                }
            }
            placed.clear();
        }

        // ---- Bookmap callbacks: record geometry, ask for a redraw ----

        @Override
        public void onHeatmapPriceBottom(long v) {
            priceBottom = v;
        }

        @Override
        public void onHeatmapPriceHeight(long v) {
            priceHeight = v;
        }

        @Override
        public void onHeatmapPixelsHeight(int v) {
            heightPx = v;
        }

        @Override
        public void onHeatmapFullPixelsWidth(int v) {
            widthPx = v;
        }

        @Override
        public void onMoveEnd() {
            requestRefresh.run();
        }

        @Override
        public void onMoveStart() {
        }

        @Override
        public void onHeatmapTimeLeft(long v) {
        }

        @Override
        public void onHeatmapActiveTimeWidth(long v) {
        }

        @Override
        public void onHeatmapFullTimeWidth(long v) {
        }

        @Override
        public void onHeatmapPixelsLeft(int v) {
        }

        @Override
        public void onHeatmapActivePixelsWidth(int v) {
        }

        @Override
        public void onHeatmapPixelsBottom(int v) {
        }

        @Override
        public void onRightOfTimelineLeft(int v) {
        }

        @Override
        public void onRightOfTimelineWidth(int v) {
        }

        @Override
        public void dispose() {
            synchronized (this) {
                gone = true;
                placed.clear();
            }
            painters.remove(this);
            try {
                canvas.dispose();
            } catch (Throwable ignored) {
                // already disposed by Bookmap
            }
        }
    }

    /** A painter that draws nothing, for a window that is not this chart's. */
    private static final class IdlePainter implements ScreenSpacePainter {
        @Override
        public void onMoveStart() {
        }

        @Override
        public void onMoveEnd() {
        }

        @Override
        public void onHeatmapTimeLeft(long v) {
        }

        @Override
        public void onHeatmapActiveTimeWidth(long v) {
        }

        @Override
        public void onHeatmapFullTimeWidth(long v) {
        }

        @Override
        public void onHeatmapPriceBottom(long v) {
        }

        @Override
        public void onHeatmapPriceHeight(long v) {
        }

        @Override
        public void onHeatmapPixelsLeft(int v) {
        }

        @Override
        public void onHeatmapActivePixelsWidth(int v) {
        }

        @Override
        public void onHeatmapFullPixelsWidth(int v) {
        }

        @Override
        public void onHeatmapPixelsBottom(int v) {
        }

        @Override
        public void onHeatmapPixelsHeight(int v) {
        }

        @Override
        public void onRightOfTimelineLeft(int v) {
        }

        @Override
        public void onRightOfTimelineWidth(int v) {
        }

        @Override
        public void dispose() {
        }
    }

    private static final class Placed {
        final Sprite sprite;
        final CanvasIcon icon;

        Placed(Sprite sprite, CanvasIcon icon) {
            this.sprite = sprite;
            this.icon = icon;
        }
    }
}
