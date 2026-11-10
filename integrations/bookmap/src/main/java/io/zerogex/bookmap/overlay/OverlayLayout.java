package io.zerogex.bookmap.overlay;

import io.zerogex.bookmap.core.Format;
import io.zerogex.bookmap.core.LabelLayout;
import io.zerogex.bookmap.core.LevelKind;
import io.zerogex.bookmap.core.ProfileLayout;
import io.zerogex.bookmap.core.StatusText;
import java.util.ArrayList;
import java.util.List;

/**
 * Turns one {@link OverlayFrame} and one window's {@link Viewport} into the
 * sprites to show. Pure: the Bookmap side only converts sprites into canvas
 * shapes, and the tests render the same sprites to an image to look at.
 *
 * <ul>
 *   <li><b>Labels</b> sit at the right edge of the heatmap, next to the newest
 *       data, one per level (or per group of levels on the same strike).
 *       They are pinned to their price, so they ride along when the trader drags
 *       the chart.</li>
 *   <li><b>Edge markers</b> replace labels for levels above or below the visible
 *       prices, and add the distance from the last price.</li>
 *   <li><b>The gamma profile</b> runs along the left edge by default, away from
 *       the labels and the live price.</li>
 *   <li><b>The status badge</b> says what the chart is showing and whether it is
 *       current, in one place, so a problem is never silent.</li>
 * </ul>
 */
public final class OverlayLayout {

    static final int EDGE_MARGIN = 6;
    static final int LABEL_GAP = 2;
    static final int BADGE_MARGIN = 8;

    private OverlayLayout() {
    }

    public static List<Sprite> build(OverlayFrame f, Viewport v) {
        List<Sprite> out = new ArrayList<Sprite>();
        if (f == null || v == null || !v.isUsable() || !(f.pips > 0)) {
            return out;
        }
        OverlayFrame.Style style = f.style;
        double bottom = v.priceBottom(f.pips);
        double top = v.priceTop(f.pips);
        int labelColumnLeft = v.widthPx;

        if (style.labels) {
            int labelH = SpriteImages.labelHeight(style.labelSize);
            List<LabelLayout.Item> items = LabelLayout.fold(f.levels, style.showLevel, f.pips);
            List<LabelLayout.Placed> placed = LabelLayout.layout(items, bottom, top, v.heightPx, labelH, LABEL_GAP);
            for (LabelLayout.Placed p : placed) {
                String names = names(p.item.kinds);
                String priceText = Format.price(p.item.price, f.decimals);
                boolean edge = p.edge != LabelLayout.Edge.NONE;
                String delta = edge && !Double.isNaN(f.price) ? Format.delta(p.item.price - f.price, f.decimals) : "";
                Sprite.Look.Type type = p.edge == LabelLayout.Edge.ABOVE ? Sprite.Look.Type.MARKER_UP
                        : p.edge == LabelLayout.Edge.BELOW ? Sprite.Look.Type.MARKER_DOWN
                        : Sprite.Look.Type.LABEL;
                String[] text = {names, priceText, delta};
                int w = SpriteImages.labelWidth(type, text, style.labelSize);
                int color = 0xFF000000 | style.color(p.item.lead());
                Sprite.Look look = new Sprite.Look(type, text, new int[] {color}, w, labelH, style.labelSize);
                int x = Math.max(0, v.widthPx - w - EDGE_MARGIN);
                labelColumnLeft = Math.min(labelColumnLeft, x);
                String key = (edge ? "marker:" : "label:") + keyOf(p.item.kinds);
                if (edge) {
                    int bottomPx = (int) Math.round(p.y - labelH / 2.0);
                    out.add(new Sprite(key, look, x, Sprite.Anchor.SCREEN, 0, bottomPx));
                } else {
                    int offset = (int) Math.round(p.y - p.naturalY - labelH / 2.0);
                    out.add(new Sprite(key, look, x, Sprite.Anchor.PRICE, p.item.price / f.pips, offset));
                }
            }
        }

        if (style.profile && !f.profile.isEmpty()) {
            int maxLen = Math.max(30, Math.min(600, v.widthPx * style.profileWidthPct / 100));
            List<ProfileLayout.Bar> bars = ProfileLayout.layout(f.profile, bottom, top, v.heightPx, maxLen);
            for (ProfileLayout.Bar b : bars) {
                int color = b.positive ? SpriteImages.GOLD : SpriteImages.VIOLET;
                String side = style.profileOnRight ? "right" : "left";
                Sprite.Look look = new Sprite.Look(Sprite.Look.Type.BAR, new String[] {side}, new int[] {color},
                        b.lengthPx, b.thicknessPx, 0);
                int x = style.profileOnRight ? Math.max(0, labelColumnLeft - EDGE_MARGIN - b.lengthPx) : 2;
                out.add(new Sprite("bar:" + b.strike, look, x, Sprite.Anchor.PRICE, b.strike / f.pips,
                        -(b.thicknessPx / 2)));
            }
        }

        if (style.badge && f.status != null) {
            // Beside a left-hand profile rather than on top of its lowest bars.
            int left = style.profile && !style.profileOnRight && !f.profile.isEmpty()
                    ? Math.max(30, Math.min(600, v.widthPx * style.profileWidthPct / 100)) + BADGE_MARGIN + 4
                    : BADGE_MARGIN + 2;
            out.add(badge(f.status, style, v, left));
        }
        return out;
    }

    static Sprite badge(StatusText.Lines lines, OverlayFrame.Style style, Viewport v, int x) {
        String title = lines.headline;
        String regime = "";
        int sep = title.indexOf(" · ");
        if (sep > 0) {
            regime = title.substring(sep + 3);
            title = title.substring(0, sep);
        }
        String[] text = {title, regime, lines.detail == null ? "" : lines.detail,
                lines.warning == null ? "" : lines.warning};
        int[] size = SpriteImages.badgeSize(text, style.labelSize);
        int[] colors = {tone(lines.detailTone), regimeColor(regime), detailColor(lines.detailTone),
                SpriteImages.TONE_WARN};
        Sprite.Look look = new Sprite.Look(Sprite.Look.Type.BADGE, text, colors, size[0], size[1], style.labelSize);
        int bottomPx = style.badgeBottom ? BADGE_MARGIN : Math.max(0, v.heightPx - BADGE_MARGIN - size[1]);
        return new Sprite("badge", look, x, Sprite.Anchor.SCREEN, 0, bottomPx);
    }

    static String names(List<LevelKind> kinds) {
        StringBuilder sb = new StringBuilder();
        for (LevelKind k : kinds) {
            if (sb.length() > 0) {
                sb.append(" · ");
            }
            sb.append(k.chartLabel);
        }
        return sb.toString();
    }

    private static String keyOf(List<LevelKind> kinds) {
        StringBuilder sb = new StringBuilder();
        for (LevelKind k : kinds) {
            sb.append(k.name()).append('+');
        }
        return sb.toString();
    }

    /**
     * Gold for long gamma, violet for short, as on the website's Gamma
     * Terminal. Deliberately not green and red: long gamma is not bullish and
     * short gamma is not bearish.
     */
    static int regimeColor(String regime) {
        if (regime.startsWith("LONG")) {
            return SpriteImages.REGIME_LONG;
        }
        if (regime.startsWith("SHORT")) {
            return SpriteImages.REGIME_SHORT;
        }
        return SpriteImages.TEXT_MUTED;
    }

    private static int tone(StatusText.Tone t) {
        switch (t) {
            case GOOD:
                return SpriteImages.TONE_GOOD;
            case BAD:
                return SpriteImages.TONE_BAD;
            case WARN:
                return SpriteImages.TONE_WARN;
            default:
                return SpriteImages.TONE_NEUTRAL;
        }
    }

    private static int detailColor(StatusText.Tone t) {
        switch (t) {
            case BAD:
                return SpriteImages.TONE_BAD;
            case WARN:
                return SpriteImages.TONE_WARN;
            default:
                return 0xFFC9D1DC;
        }
    }
}
