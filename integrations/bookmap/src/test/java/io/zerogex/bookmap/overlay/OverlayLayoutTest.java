package io.zerogex.bookmap.overlay;

import io.zerogex.bookmap.core.Engine;
import io.zerogex.bookmap.core.LevelKind;
import io.zerogex.bookmap.core.LevelsSnapshot;
import io.zerogex.bookmap.core.MarketClock;
import io.zerogex.bookmap.core.StatusText;
import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.util.ArrayList;
import java.util.List;

public class OverlayLayoutTest {

    static OverlayFrame.Style style(boolean profileRight) {
        boolean[] show = {true, true, true, true, true};
        int[] colors = new int[5];
        for (LevelKind k : LevelKind.values()) {
            colors[k.ordinal()] = k.defaultRgb;
        }
        return new OverlayFrame.Style(true, show, colors, 1, true, true, true, profileRight, 16);
    }

    static OverlayFrame frame(double price, boolean profileRight) {
        String json = new io.zerogex.bookmap.core.Fixtures.Levels().json();
        LevelsSnapshot snap = LevelsSnapshot.parse(json, 0);
        double[] levels = new double[5];
        for (LevelKind k : LevelKind.values()) {
            levels[k.ordinal()] = snap.level(k);
        }
        Engine.Status st = new Engine.Status(Engine.State.OK, null, snap, false,
                io.zerogex.bookmap.core.Fixtures.et(2026, 11, 10, 10, 42), null, 0, "ES");
        StatusText.Lines lines = StatusText.build(st, levels[LevelKind.GAMMA_FLIP.ordinal()], price,
                io.zerogex.bookmap.core.Fixtures.et(2026, 11, 10, 10, 42, 30), 0);
        return new OverlayFrame(0.25, 2, levels, price, lines, snap.profile, style(profileRight));
    }

    /** 7,500 to 7,700 over 800 px, 1,400 px wide. */
    static Viewport wide() {
        return new Viewport(7500 * 4, 200 * 4, 800, 1400);
    }

    @Test
    public void labelsSitAtTheRightEdgePinnedToTheirPrices() {
        List<Sprite> sprites = OverlayLayout.build(frame(7581.5, false), wide());
        int labels = 0;
        for (Sprite s : sprites) {
            if (s.key.startsWith("label:")) {
                labels++;
                Check.eq(Sprite.Anchor.PRICE, s.anchor, "pinned to price: " + s.key);
                Check.eq(1400 - 6, s.x + s.look.width, "right-aligned: " + s.key);
                Check.isTrue(s.levelY == Math.rint(s.levelY), "a whole number of ticks: " + s.levelY);
            }
        }
        Check.eq(4, labels, "put wall, max pain, pin and flip are in 7,500-7,700");
    }

    @Test
    public void everyVisibleLevelGetsALabelAndEveryHiddenOneAMarker() {
        List<Sprite> sprites = OverlayLayout.build(frame(7581.5, false), wide());
        List<String> keys = new ArrayList<String>();
        for (Sprite s : sprites) {
            keys.add(s.key);
        }
        // 7,500-7,700 shows the put wall, max pain, pin and flip; the call wall (7,727) is above.
        Check.isTrue(keys.contains("label:PUT_WALL+"), "put wall labeled: " + keys);
        Check.isTrue(keys.contains("label:GAMMA_FLIP+"), "flip labeled: " + keys);
        Check.isTrue(keys.contains("marker:CALL_WALL+"), "call wall as an edge marker: " + keys);
        for (Sprite s : sprites) {
            if (s.key.equals("marker:CALL_WALL+")) {
                Check.eq(Sprite.Look.Type.MARKER_UP, s.look.type, "points up");
                Check.eq("+145.50", s.look.text[2], "with its distance from price");
                Check.eq(Sprite.Anchor.SCREEN, s.anchor, "pinned to the screen edge");
            }
        }
    }

    @Test
    public void labelsNeverOverlapOnScreen() {
        Viewport tight = new Viewport(7595 * 4, 40 * 4, 400, 1200); // 7,595-7,635: pin and max pain close
        List<Sprite> sprites = OverlayLayout.build(frame(7610, false), tight);
        List<double[]> boxes = new ArrayList<double[]>();
        for (Sprite s : sprites) {
            if (s.key.startsWith("label:") || s.key.startsWith("marker:")) {
                double bottom = s.anchor == Sprite.Anchor.PRICE
                        ? (s.levelY - tight.priceBottomLevels) * tight.heightPx / (double) tight.priceHeightLevels + s.bottomPx
                        : s.bottomPx;
                boxes.add(new double[] {bottom, bottom + s.look.height});
                Check.isTrue(bottom >= 0 && bottom + s.look.height <= tight.heightPx, "on screen: " + s.key);
            }
        }
        for (int i = 0; i < boxes.size(); i++) {
            for (int j = i + 1; j < boxes.size(); j++) {
                boolean overlap = boxes.get(i)[0] < boxes.get(j)[1] && boxes.get(j)[0] < boxes.get(i)[1];
                Check.isFalse(overlap, "labels " + i + " and " + j + " overlap");
            }
        }
    }

    @Test
    public void theProfileHugsTheChosenEdgeAndNeverRunsUnderTheLabels() {
        int labelLeft = Integer.MAX_VALUE;
        List<Sprite> right = OverlayLayout.build(frame(7581.5, true), wide());
        for (Sprite s : right) {
            if (s.key.startsWith("label:") || s.key.startsWith("marker:")) {
                labelLeft = Math.min(labelLeft, s.x);
            }
        }
        for (Sprite s : right) {
            if (s.key.startsWith("bar:")) {
                Check.isTrue(s.x + s.look.width <= labelLeft - 6, "bar ends before the labels start");
            }
        }
        for (Sprite s : OverlayLayout.build(frame(7581.5, false), wide())) {
            if (s.key.startsWith("bar:")) {
                Check.eq(2, s.x, "left profile starts at the edge");
                Check.isTrue(s.look.width <= 1400 * 16 / 100, "no wider than the setting");
            }
        }
    }

    @Test
    public void theBadgeSitsInsideTheChosenCorner() {
        Sprite badge = null;
        for (Sprite s : OverlayLayout.build(frame(7581.5, false), wide())) {
            if (s.key.equals("badge")) {
                badge = s;
            }
        }
        Check.isTrue(badge != null, "badge present");
        Check.eq(OverlayLayout.BADGE_MARGIN, badge.bottomPx, "bottom-left by default");
        Check.eq("SHORT Γ below flip", badge.look.text[1], "regime on the badge");
        Check.eq(SpriteImages.REGIME_SHORT, badge.look.colors[1], "violet, not red");
    }

    @Test
    public void imagesAreRenderedAtExactlyTheirLaidOutSize() {
        for (Sprite s : OverlayLayout.build(frame(7581.5, false), wide())) {
            java.awt.image.BufferedImage img = SpriteImages.render(s.look);
            Check.eq(s.look.width, img.getWidth(), "width of " + s.key);
            Check.eq(s.look.height, img.getHeight(), "height of " + s.key);
        }
    }

    @Test
    public void anUnusableViewportDrawsNothing() {
        Check.eq(0, OverlayLayout.build(frame(7581.5, false), new Viewport(0, 0, 0, 0)).size(), "not measured yet");
        Check.isTrue(MarketClock.NONE < 0, "sanity");
    }
}
