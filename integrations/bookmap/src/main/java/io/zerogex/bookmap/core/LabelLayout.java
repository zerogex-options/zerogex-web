package io.zerogex.bookmap.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Places the level labels on the right edge of the heatmap so none of them
 * overlap, and turns levels outside the visible prices into edge markers.
 *
 * <p>Carries over three lessons from the NinjaTrader indicator's testers:
 * <ul>
 *   <li><b>Levels on the same price fold into one label.</b> ES strikes are five
 *       points apart and the levels collide constantly (put wall and max pain
 *       on one strike is common). "PUT WALL · MAX PAIN 7,526.25" says more than
 *       two labels printed over each other: two measures agree on that strike.</li>
 *   <li><b>Labels that are close but not equal are stacked</b>, pushed apart just
 *       enough to read, and stay attached to their line.</li>
 *   <li><b>Nothing is silently dropped.</b> A Bookmap scalper is usually zoomed in
 *       tight, so the walls are often off-screen. Those become markers pinned to
 *       the top or bottom edge that say how far away the level is.</li>
 * </ul>
 *
 * <p>Pure geometry in pixels with y increasing upward (Bookmap's convention), so
 * it is tested without Bookmap or a screen.
 */
public final class LabelLayout {

    public enum Edge {
        NONE, ABOVE, BELOW
    }

    /** One level to label. */
    public static final class Item {
        public final List<LevelKind> kinds;
        public final double price;

        public Item(List<LevelKind> kinds, double price) {
            this.kinds = kinds;
            this.price = price;
        }

        /** The kind whose color and position the merged label takes. */
        public LevelKind lead() {
            return kinds.get(0);
        }
    }

    /** Where one label ended up. */
    public static final class Placed {
        public final Item item;
        public final Edge edge;
        /** Where the level itself is, in pixels from the bottom (meaningless for edge markers). */
        public final double naturalY;
        /** Where the label's center goes, in pixels from the bottom. */
        public final double y;

        Placed(Item item, Edge edge, double naturalY, double y) {
            this.item = item;
            this.edge = edge;
            this.naturalY = naturalY;
            this.y = y;
        }
    }

    private LabelLayout() {
    }

    /**
     * Folds levels that share a price (within half a tick) into one item,
     * ordered by {@link LevelKind#foldPriority()}. NaN levels are skipped.
     */
    public static List<Item> fold(double[] levelByKind, boolean[] include, double tick) {
        List<double[]> present = new ArrayList<double[]>();
        for (LevelKind kind : LevelKind.values()) {
            double p = levelByKind[kind.ordinal()];
            if (include[kind.ordinal()] && !Double.isNaN(p)) {
                present.add(new double[] {p, kind.ordinal()});
            }
        }
        double tolerance = (tick > 0 ? tick : 0.01) / 2.0;
        List<Item> out = new ArrayList<Item>();
        boolean[] used = new boolean[present.size()];
        for (int i = 0; i < present.size(); i++) {
            if (used[i]) {
                continue;
            }
            List<LevelKind> kinds = new ArrayList<LevelKind>();
            kinds.add(LevelKind.values()[(int) present.get(i)[1]]);
            for (int j = i + 1; j < present.size(); j++) {
                if (!used[j] && Math.abs(present.get(j)[0] - present.get(i)[0]) <= tolerance) {
                    kinds.add(LevelKind.values()[(int) present.get(j)[1]]);
                    used[j] = true;
                }
            }
            Collections.sort(kinds, new Comparator<LevelKind>() {
                @Override
                public int compare(LevelKind a, LevelKind b) {
                    return Integer.compare(a.foldPriority(), b.foldPriority());
                }
            });
            out.add(new Item(Collections.unmodifiableList(kinds), present.get(i)[0]));
        }
        return out;
    }

    /**
     * Lays the items out.
     *
     * @param priceBottom lowest visible price
     * @param priceTop    highest visible price
     * @param heightPx    heatmap height in pixels
     * @param labelPx     label height in pixels
     * @param gapPx       space between stacked labels
     */
    public static List<Placed> layout(List<Item> items, double priceBottom, double priceTop, int heightPx,
                                      int labelPx, int gapPx) {
        List<Placed> out = new ArrayList<Placed>();
        if (items.isEmpty() || !(priceTop > priceBottom) || heightPx <= 0) {
            return out;
        }
        double pxPerPrice = heightPx / (priceTop - priceBottom);
        double half = labelPx / 2.0;
        double pitch = labelPx + gapPx;

        List<Placed> visible = new ArrayList<Placed>();
        List<Item> above = new ArrayList<Item>();
        List<Item> below = new ArrayList<Item>();
        for (Item item : items) {
            if (item.price > priceTop) {
                above.add(item);
            } else if (item.price < priceBottom) {
                below.add(item);
            } else {
                double y = (item.price - priceBottom) * pxPerPrice;
                visible.add(new Placed(item, Edge.NONE, y, y));
            }
        }

        // Edge markers first, in price order: the highest level sits at the top
        // edge and the lowest at the bottom, so the stack reads the same way as
        // the chart (a call wall above the flip is drawn above the flip).
        Collections.sort(above, new Comparator<Item>() {
            @Override
            public int compare(Item a, Item b) {
                return Double.compare(b.price, a.price);
            }
        });
        Collections.sort(below, new Comparator<Item>() {
            @Override
            public int compare(Item a, Item b) {
                return Double.compare(a.price, b.price);
            }
        });
        double topLimit = heightPx - half - 2;
        double bottomLimit = half + 2;
        for (int k = 0; k < above.size(); k++) {
            double y = topLimit - k * pitch;
            out.add(new Placed(above.get(k), Edge.ABOVE, heightPx, y));
        }
        for (int k = 0; k < below.size(); k++) {
            double y = bottomLimit + k * pitch;
            out.add(new Placed(below.get(k), Edge.BELOW, 0, y));
        }
        // Visible labels live between the edge stacks.
        double ceiling = above.isEmpty() ? topLimit : topLimit - above.size() * pitch;
        double floor = below.isEmpty() ? bottomLimit : bottomLimit + below.size() * pitch;

        Collections.sort(visible, new Comparator<Placed>() {
            @Override
            public int compare(Placed a, Placed b) {
                return Double.compare(b.naturalY, a.naturalY); // top first
            }
        });
        int n = visible.size();
        double[] y = new double[n];
        for (int i = 0; i < n; i++) {
            y[i] = Math.min(ceiling, Math.max(floor, visible.get(i).naturalY));
        }
        // Push down from the top so each label clears the one above it...
        for (int i = 1; i < n; i++) {
            if (y[i] > y[i - 1] - pitch) {
                y[i] = y[i - 1] - pitch;
            }
        }
        // ...then, if the stack ran off the bottom, push back up from the floor.
        if (n > 0 && y[n - 1] < floor) {
            y[n - 1] = floor;
            for (int i = n - 2; i >= 0; i--) {
                if (y[i] < y[i + 1] + pitch) {
                    y[i] = y[i + 1] + pitch;
                }
            }
        }
        for (int i = 0; i < n; i++) {
            Placed p = visible.get(i);
            out.add(new Placed(p.item, Edge.NONE, p.naturalY, y[i]));
        }
        return out;
    }
}
