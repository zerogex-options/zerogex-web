package io.zerogex.bookmap;

import io.zerogex.bookmap.core.LevelKind;
import io.zerogex.bookmap.core.LineSink;
import io.zerogex.bookmap.core.Logger;
import java.awt.Color;
import java.lang.reflect.Method;
import java.util.EnumMap;
import java.util.Map;
import velox.api.layer1.messages.indicators.Layer1ApiUserMessageModifyIndicator.GraphType;
import velox.api.layer1.simplified.Api;
import velox.api.layer1.simplified.IndicatorModifiable;
import velox.api.layer1.simplified.LineStyle;

/**
 * The level lines, as Bookmap indicators on the price chart.
 *
 * <p>"Modifiable" indicators because they accept a point at any timestamp, not
 * only "now": that is what lets the add-on draw the session's history the moment
 * it loads, and redraw a past session in Bookmap's replay. Bookmap samples them
 * as a step function, so each line holds its value until the next change,
 * exactly like the timelines in the core package.
 *
 * <p>Being ordinary Bookmap indicators also means each line shows in Bookmap's
 * own indicator list, where it can be hidden or restyled like any other.
 *
 * <p>Bookmap's price axis counts in ticks ("levels"), so every price is divided
 * by the instrument's tick size on the way in. That conversion happens here and
 * nowhere else.
 */
final class IndicatorLines implements LineSink {

    private final Map<LevelKind, IndicatorModifiable> lines =
            new EnumMap<LevelKind, IndicatorModifiable>(LevelKind.class);
    private final double pips;

    IndicatorLines(Api api, double pips, Settings settings) {
        this.pips = pips;
        for (LevelKind kind : LevelKind.values()) {
            IndicatorModifiable line = register(api, "ZeroGEX " + kind.displayName);
            lines.put(kind, line);
        }
        applyStyle(settings);
    }

    /**
     * Registers with the widget off: Bookmap's per-indicator widget is a
     * value scale, which for a horizontal level adds five empty panels and
     * nothing else. The overload that takes that flag arrived in Bookmap 7.2;
     * on 7.0 and 7.1 the older one is used and the trader can hide the widgets
     * by hand.
     */
    private static IndicatorModifiable register(Api api, String name) {
        try {
            Method m = Api.class.getMethod("registerIndicatorModifiable", String.class, GraphType.class,
                    double.class, boolean.class, boolean.class);
            return (IndicatorModifiable) m.invoke(api, name, GraphType.PRIMARY, Double.NaN, true, false);
        } catch (NoSuchMethodException e) {
            return api.registerIndicatorModifiable(name, GraphType.PRIMARY, Double.NaN);
        } catch (Exception e) {
            Logger.warn("could not register " + name + " with widget off; using the default", e);
            return api.registerIndicatorModifiable(name, GraphType.PRIMARY, Double.NaN);
        }
    }

    void applyStyle(Settings s) {
        for (LevelKind kind : LevelKind.values()) {
            IndicatorModifiable line = lines.get(kind);
            try {
                line.setColor(new Color(s.levelColor[kind.ordinal()]));
                line.setWidth(s.lineWidth(kind));
                line.setLineStyle(toBookmap(kind.defaultDash));
            } catch (Throwable t) {
                // Styling is cosmetic; a Bookmap build that rejects one call
                // must not cost the trader the line itself.
                Logger.warn("could not style " + kind.displayName, t);
            }
        }
    }

    @Override
    public void point(LevelKind kind, long timeNanos, double price) {
        IndicatorModifiable line = lines.get(kind);
        if (line != null) {
            line.addPoint(timeNanos, Double.isNaN(price) ? Double.NaN : price / pips);
        }
    }

    @Override
    public void clearAll(LevelKind kind) {
        IndicatorModifiable line = lines.get(kind);
        if (line != null) {
            line.clear(Long.MIN_VALUE, Long.MAX_VALUE);
        }
    }

    static LineStyle toBookmap(LevelKind.LineDash dash) {
        switch (dash) {
            case DASHED:
                return LineStyle.LONG_DASH;
            case DOTTED:
                return LineStyle.DOT;
            case DASH_DOT:
                return LineStyle.DASH_DOT;
            case SOLID:
            default:
                return LineStyle.SOLID;
        }
    }
}
