package io.zerogex.bookmap.harness;

import java.util.ArrayList;
import java.util.List;
import velox.api.layer1.layers.strategies.interfaces.CanvasContextMenuProvider;
import velox.api.layer1.layers.strategies.interfaces.CanvasMouseListener;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvasFactory;

/** A heatmap canvas that keeps the shapes the add-on places, in order. */
public final class FakeCanvas implements ScreenSpaceCanvas, ScreenSpaceCanvasFactory {

    public final List<CanvasShape> shapes = new ArrayList<CanvasShape>();
    public volatile ScreenSpaceCanvasType type;
    public volatile boolean disposed;
    public volatile int adds;
    public volatile int removes;

    @Override
    public ScreenSpaceCanvas createCanvas(ScreenSpaceCanvasType t) {
        this.type = t;
        return this;
    }

    @Override
    public long getUniqueId() {
        return 1;
    }

    @Override
    public void dispose() {
        disposed = true;
    }

    @Override
    public synchronized void addShape(CanvasShape canvasShape) {
        shapes.add(canvasShape);
        adds++;
    }

    @Override
    public synchronized void removeShape(CanvasShape canvasShape) {
        if (!shapes.remove(canvasShape)) {
            throw new IllegalStateException("removed a shape that was never added");
        }
        removes++;
    }

    public synchronized List<CanvasShape> snapshot() {
        return new ArrayList<CanvasShape>(shapes);
    }

    @Override
    public void addMouseListener(CanvasMouseListener listener) {
    }

    @Override
    public void addContextMenuProvider(CanvasContextMenuProvider contextMenuProvider) {
    }
}
