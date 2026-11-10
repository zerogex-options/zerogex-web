package io.zerogex.bookmap.overlay;

import java.util.Arrays;
import java.util.Objects;

/**
 * One image the overlay places on the heatmap, in Bookmap-independent terms.
 *
 * <p>Horizontal positions are pixels from the heatmap's left edge. Vertically a
 * sprite is either pinned to a price ({@link Anchor#PRICE}: it moves with the
 * chart while the trader drags, and stays glued to its line) or to the screen
 * ({@link Anchor#SCREEN}: status badge, off-screen markers).
 *
 * <p>Every sprite's image is rendered at exactly its on-screen pixel size, so
 * nothing ever depends on how Bookmap would scale an image.
 */
public final class Sprite {

    public enum Anchor {
        PRICE, SCREEN
    }

    /** What the image looks like. Equal specs render identical pixels, so they share one prepared image. */
    public static final class Look {
        public enum Type {
            LABEL, MARKER_UP, MARKER_DOWN, BAR, BADGE
        }

        public final Type type;
        /** Text runs; for a label: {names, price, delta}. */
        public final String[] text;
        /** ARGB colors, meaning depends on type (accent, text tones...). */
        public final int[] colors;
        public final int width;
        public final int height;
        /** Font size step 0..3. */
        public final int size;

        public Look(Type type, String[] text, int[] colors, int width, int height, int size) {
            this.type = type;
            this.text = text.clone();
            this.colors = colors.clone();
            this.width = width;
            this.height = height;
            this.size = size;
        }

        @Override
        public boolean equals(Object o) {
            if (!(o instanceof Look)) {
                return false;
            }
            Look l = (Look) o;
            return type == l.type && width == l.width && height == l.height && size == l.size
                    && Arrays.equals(text, l.text) && Arrays.equals(colors, l.colors);
        }

        @Override
        public int hashCode() {
            return Objects.hash(type, width, height, size, Arrays.hashCode(text), Arrays.hashCode(colors));
        }
    }

    /** Stable identity across frames, so an unchanged sprite is left alone. */
    public final String key;
    public final Look look;
    public final int x;
    public final Anchor anchor;
    /** PRICE: the price level (in Bookmap levels: price / tick). */
    public final double levelY;
    /** PRICE: offset of the image's bottom edge from the price, px. SCREEN: bottom edge from the heatmap bottom, px. */
    public final int bottomPx;

    public Sprite(String key, Look look, int x, Anchor anchor, double levelY, int bottomPx) {
        this.key = key;
        this.look = look;
        this.x = x;
        this.anchor = anchor;
        this.levelY = levelY;
        this.bottomPx = bottomPx;
    }

    @Override
    public boolean equals(Object o) {
        if (!(o instanceof Sprite)) {
            return false;
        }
        Sprite s = (Sprite) o;
        return key.equals(s.key) && look.equals(s.look) && x == s.x && anchor == s.anchor
                && Double.compare(levelY, s.levelY) == 0 && bottomPx == s.bottomPx;
    }

    @Override
    public int hashCode() {
        return Objects.hash(key, look, x, anchor, levelY, bottomPx);
    }
}
