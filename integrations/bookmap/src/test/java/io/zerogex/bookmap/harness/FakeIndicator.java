package io.zerogex.bookmap.harness;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.util.NavigableMap;
import java.util.TreeMap;
import velox.api.layer1.simplified.AxisRules;
import velox.api.layer1.simplified.IndicatorModifiable;
import velox.api.layer1.simplified.LineStyle;
import velox.api.layer1.simplified.WidgetRules;

/** Records what the add-on draws into one Bookmap line. Values are in Bookmap levels (price / tick). */
public final class FakeIndicator implements IndicatorModifiable {

    public final String name;
    public final boolean showLine;
    public final boolean showWidget;
    public final TreeMap<Long, Double> points = new TreeMap<Long, Double>();
    public volatile Color color;
    public volatile int width;
    public volatile LineStyle style;

    FakeIndicator(String name, boolean showLine, boolean showWidget) {
        this.name = name;
        this.showLine = showLine;
        this.showWidget = showWidget;
    }

    public synchronized NavigableMap<Long, Double> snapshot() {
        return new TreeMap<Long, Double>(points);
    }

    public synchronized double valueAt(long t) {
        java.util.Map.Entry<Long, Double> e = points.floorEntry(t);
        return e == null ? Double.NaN : e.getValue();
    }

    @Override
    public synchronized void addPoint(long timestamp, double value) {
        points.put(timestamp, value);
    }

    @Override
    public synchronized void clear(long fromTimestamp, long toTimestamp) {
        points.subMap(fromTimestamp, toTimestamp).clear();
    }

    @Override
    public void addPoint(double value) {
        throw new UnsupportedOperationException("the add-on must place every point at an explicit time");
    }

    @Override
    public void addIcon(double value, BufferedImage icon, int iconCenterX, int iconCenterY) {
    }

    @Override
    public void setColor(Color c) {
        this.color = c;
    }

    @Override
    public void setWidth(int w) {
        this.width = w;
    }

    @Override
    public void setLineStyle(LineStyle s) {
        this.style = s;
    }

    @Override
    public void setRenderPriority(int renderPriority) {
    }

    @Override
    public void setAxisRules(AxisRules axisRules) {
    }

    @Override
    public void setWidgetRules(WidgetRules widgetRules) {
    }
}
