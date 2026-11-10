package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.util.Arrays;
import java.util.List;

public class LabelLayoutTest {

    private static final boolean[] ALL = {true, true, true, true, true};

    private static double[] levels(double call, double put, double flip, double pain, double pin) {
        return new double[] {call, put, flip, pain, pin};
    }

    @Test
    public void levelsOnTheSameStrikeFoldIntoOneLabelLedByTheWall() {
        List<LabelLayout.Item> items = LabelLayout.fold(levels(7727, 7526.25, Double.NaN, 7526.25, 7727), ALL, 0.25);
        Check.eq(2, items.size(), "two prices");
        LabelLayout.Item low = items.get(0).price < items.get(1).price ? items.get(0) : items.get(1);
        Check.eq(Arrays.asList(LevelKind.PUT_WALL, LevelKind.MAX_PAIN), low.kinds, "put wall leads max pain");
        LabelLayout.Item high = low == items.get(0) ? items.get(1) : items.get(0);
        Check.eq(Arrays.asList(LevelKind.CALL_WALL, LevelKind.PIN_STRIKE), high.kinds, "call wall leads the pin");
    }

    @Test
    public void hiddenAndMissingLevelsAreLeftOut() {
        boolean[] noPain = {true, true, true, false, true};
        List<LabelLayout.Item> items = LabelLayout.fold(levels(7727, Double.NaN, 7689.75, 7626.75, Double.NaN),
                noPain, 0.25);
        Check.eq(2, items.size(), "call wall and flip only");
    }

    @Test
    public void closeLabelsAreStackedWithoutOverlap() {
        List<LabelLayout.Item> items = LabelLayout.fold(levels(7600.25, 7600.5, 7600.75, 7601.0, 7601.25), ALL, 0.25);
        List<LabelLayout.Placed> placed = LabelLayout.layout(items, 7550, 7650, 800, 18, 2);
        Check.eq(5, placed.size(), "five labels");
        double[] ys = new double[5];
        for (int i = 0; i < 5; i++) {
            ys[i] = placed.get(i).y;
            Check.eq(LabelLayout.Edge.NONE, placed.get(i).edge, "all visible");
        }
        Arrays.sort(ys);
        for (int i = 1; i < 5; i++) {
            Check.isTrue(ys[i] - ys[i - 1] >= 20 - 1e-9, "labels at least a label apart: " + Arrays.toString(ys));
        }
    }

    @Test
    public void offScreenLevelsBecomeEdgeMarkersInPriceOrder() {
        List<LabelLayout.Item> items = LabelLayout.fold(levels(7727, 7526.25, 7689.75, 7626.75, Double.NaN), ALL, 0.25);
        // A tight scalper's zoom: 7570 to 7600.
        List<LabelLayout.Placed> placed = LabelLayout.layout(items, 7570, 7600, 600, 18, 2);
        int above = 0;
        int below = 0;
        double lastAboveY = Double.MAX_VALUE;
        for (LabelLayout.Placed p : placed) {
            if (p.edge == LabelLayout.Edge.ABOVE) {
                above++;
                Check.isTrue(p.y <= 600 - 9, "inside the top edge");
                Check.isTrue(p.y < lastAboveY, "stacked downward");
                lastAboveY = p.y;
            }
            if (p.edge == LabelLayout.Edge.BELOW) {
                below++;
                Check.isTrue(p.y >= 9, "inside the bottom edge");
            }
        }
        Check.eq(3, above, "call wall, flip, max pain above");
        Check.eq(1, below, "put wall below");
        LabelLayout.Placed first = null;
        for (LabelLayout.Placed p : placed) {
            if (p.edge == LabelLayout.Edge.ABOVE && (first == null || p.y > first.y)) {
                first = p;
            }
        }
        Check.eq(LevelKind.CALL_WALL, first.item.lead(), "the highest level sits at the top edge, as on the chart");
    }

    @Test
    public void labelsNearTheBottomArePushedBackOnScreen() {
        List<LabelLayout.Item> items = LabelLayout.fold(levels(7550.25, 7550.0, Double.NaN, Double.NaN, Double.NaN),
                ALL, 0.25);
        List<LabelLayout.Placed> placed = LabelLayout.layout(items, 7550, 7650, 800, 18, 2);
        for (LabelLayout.Placed p : placed) {
            Check.isTrue(p.y >= 9 - 1e-9, "inside the bottom edge: " + p.y);
        }
    }

    @Test
    public void nothingToDrawOnAnEmptyOrBrokenViewport() {
        List<LabelLayout.Item> items = LabelLayout.fold(levels(7727, 7526.25, 7689.75, 7626.75, 7600), ALL, 0.25);
        Check.eq(0, LabelLayout.layout(items, 7600, 7600, 800, 18, 2).size(), "zero price height");
        Check.eq(0, LabelLayout.layout(items, 7500, 7700, 0, 18, 2).size(), "zero pixels");
    }
}
