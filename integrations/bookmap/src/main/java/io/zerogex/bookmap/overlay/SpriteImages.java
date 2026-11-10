package io.zerogex.bookmap.overlay;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.Polygon;
import java.awt.RenderingHints;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;

/**
 * Draws the overlay's images with plain Java2D: label pills, edge markers,
 * profile bars and the status badge.
 *
 * <p>Each image is drawn at exactly the size it will occupy on screen (the
 * layout measures text with the same fonts first), so how Bookmap scales
 * textures never comes into it. Arrows are drawn as shapes rather than glyphs,
 * because not every font a Windows install falls back to has a triangle.
 */
public final class SpriteImages {

    /** Background of pills and the badge: near-black, slightly translucent so the heatmap reads through. */
    static final int PANEL_BG = 0xE60D1117;
    static final int PANEL_BORDER = 0x33FFFFFF;
    static final int TEXT_PRIMARY = 0xFFF2F4F8;
    public static final int TEXT_MUTED = 0xFF9AA4B2;
    public static final int TONE_GOOD = 0xFF2ED47A;
    public static final int TONE_BAD = 0xFFFF4D6A;
    public static final int TONE_WARN = 0xFFFFB020;
    public static final int TONE_NEUTRAL = 0xFF9AA4B2;
    /** Profile: the website Gamma Terminal's long-gamma gold and short-gamma violet. */
    public static final int GOLD = 0xC8FFB300;
    public static final int VIOLET = 0xC87C6CFF;
    /** The same two hues at full strength, for the regime text. */
    public static final int REGIME_LONG = 0xFFFFC233;
    public static final int REGIME_SHORT = 0xFFA79BFF;

    private static final int[] FONT_PX = {10, 11, 13, 15};
    private static final int PAD_X = 7;
    private static final int ACCENT_W = 3;
    private static final int RUN_GAP = 6;
    private static final int ARROW_W = 8;

    private static final ThreadLocal<Graphics2D> MEASURE = new ThreadLocal<Graphics2D>() {
        @Override
        protected Graphics2D initialValue() {
            Graphics2D g = new BufferedImage(1, 1, BufferedImage.TYPE_INT_ARGB).createGraphics();
            hints(g);
            return g;
        }
    };

    private SpriteImages() {
    }

    static Font font(int size, boolean bold) {
        int px = FONT_PX[Math.max(0, Math.min(FONT_PX.length - 1, size))];
        return new Font(Font.SANS_SERIF, bold ? Font.BOLD : Font.PLAIN, px);
    }

    /** Height of a label pill at a size step. */
    public static int labelHeight(int size) {
        FontMetrics fm = MEASURE.get().getFontMetrics(font(size, true));
        return fm.getAscent() + fm.getDescent() + 6;
    }

    /** Width of a label or marker: {names, price, delta}. */
    public static int labelWidth(Sprite.Look.Type type, String[] text, int size) {
        Graphics2D g = MEASURE.get();
        FontMetrics bold = g.getFontMetrics(font(size, true));
        FontMetrics plain = g.getFontMetrics(font(size, false));
        int w = PAD_X + ACCENT_W + bold.stringWidth(text[0]) + RUN_GAP + bold.stringWidth(text[1]) + PAD_X;
        if (text.length > 2 && !text[2].isEmpty()) {
            w += RUN_GAP + plain.stringWidth(text[2]);
        }
        if (type == Sprite.Look.Type.MARKER_UP || type == Sprite.Look.Type.MARKER_DOWN) {
            w += ARROW_W + 4;
        }
        return w;
    }

    /** Size of the badge for {title, regime, detail, warning}. */
    public static int[] badgeSize(String[] text, int size) {
        Graphics2D g = MEASURE.get();
        FontMetrics bold = g.getFontMetrics(font(size, true));
        FontMetrics plain = g.getFontMetrics(font(size, false));
        int line1 = 14 + bold.stringWidth(text[0]) + (text[1].isEmpty() ? 0 : bold.stringWidth("  " + text[1]));
        int line2 = plain.stringWidth(text[2]);
        int line3 = text[3].isEmpty() ? 0 : plain.stringWidth(text[3]);
        int lines = text[3].isEmpty() ? 2 : 3;
        int lineH = bold.getAscent() + bold.getDescent() + 2;
        int w = Math.max(line1, Math.max(line2, line3)) + 2 * PAD_X + 2;
        int h = lines * lineH + 8;
        return new int[] {w, h};
    }

    /** Renders a look at its exact size. */
    public static BufferedImage render(Sprite.Look look) {
        BufferedImage img = new BufferedImage(Math.max(1, look.width), Math.max(1, look.height),
                BufferedImage.TYPE_INT_ARGB);
        Graphics2D g = img.createGraphics();
        try {
            hints(g);
            switch (look.type) {
                case BAR:
                    drawBar(g, look);
                    break;
                case BADGE:
                    drawBadge(g, look);
                    break;
                default:
                    drawLabel(g, look);
                    break;
            }
        } finally {
            g.dispose();
        }
        return img;
    }

    private static void drawLabel(Graphics2D g, Sprite.Look look) {
        int w = look.width;
        int h = look.height;
        Color accent = new Color(look.colors[0], true);
        RoundRectangle2D pill = new RoundRectangle2D.Float(0.5f, 0.5f, w - 1f, h - 1f, 6, 6);
        g.setColor(new Color(PANEL_BG, true));
        g.fill(pill);
        g.setColor(withAlpha(accent, 0xCC));
        g.setStroke(new BasicStroke(1f));
        g.draw(pill);
        g.setColor(accent);
        g.fillRect(1, 1, ACCENT_W, h - 2);

        Font bold = font(look.size, true);
        Font plain = font(look.size, false);
        FontMetrics fm = g.getFontMetrics(bold);
        int baseline = (h - (fm.getAscent() + fm.getDescent())) / 2 + fm.getAscent();
        int x = ACCENT_W + PAD_X;

        boolean up = look.type == Sprite.Look.Type.MARKER_UP;
        boolean down = look.type == Sprite.Look.Type.MARKER_DOWN;
        if (up || down) {
            int cy = h / 2;
            Polygon arrow = new Polygon();
            if (up) {
                arrow.addPoint(x, cy + 3);
                arrow.addPoint(x + ARROW_W, cy + 3);
                arrow.addPoint(x + ARROW_W / 2, cy - 4);
            } else {
                arrow.addPoint(x, cy - 3);
                arrow.addPoint(x + ARROW_W, cy - 3);
                arrow.addPoint(x + ARROW_W / 2, cy + 4);
            }
            g.setColor(accent);
            g.fillPolygon(arrow);
            x += ARROW_W + 4;
        }

        g.setFont(bold);
        g.setColor(brighten(accent));
        g.drawString(look.text[0], x, baseline);
        x += fm.stringWidth(look.text[0]) + RUN_GAP;
        g.setColor(new Color(TEXT_PRIMARY, true));
        g.drawString(look.text[1], x, baseline);
        x += fm.stringWidth(look.text[1]) + RUN_GAP;
        if (look.text.length > 2 && !look.text[2].isEmpty()) {
            g.setFont(plain);
            g.setColor(new Color(TEXT_MUTED, true));
            g.drawString(look.text[2], x, baseline);
        }
    }

    private static void drawBar(Graphics2D g, Sprite.Look look) {
        Color c = new Color(look.colors[0], true);
        g.setColor(c);
        g.fillRect(0, 0, look.width, look.height);
        // A brighter cap at the far end gives short bars a visible edge.
        g.setColor(withAlpha(c, 0xFF));
        if (look.text.length > 0 && "right".equals(look.text[0])) {
            g.fillRect(0, 0, Math.min(2, look.width), look.height);
        } else {
            g.fillRect(Math.max(0, look.width - 2), 0, Math.min(2, look.width), look.height);
        }
    }

    private static void drawBadge(Graphics2D g, Sprite.Look look) {
        int w = look.width;
        int h = look.height;
        RoundRectangle2D box = new RoundRectangle2D.Float(0.5f, 0.5f, w - 1f, h - 1f, 8, 8);
        g.setColor(new Color(PANEL_BG, true));
        g.fill(box);
        g.setColor(new Color(PANEL_BORDER, true));
        g.draw(box);

        Font bold = font(look.size, true);
        Font plain = font(look.size, false);
        FontMetrics fm = g.getFontMetrics(bold);
        int lineH = fm.getAscent() + fm.getDescent() + 2;
        int x = PAD_X + 1;
        int y = 4 + fm.getAscent();

        // Line 1: status dot, title, regime.
        g.setColor(new Color(look.colors[0], true));
        int dot = Math.max(6, fm.getAscent() - 4);
        g.fillOval(x, y - fm.getAscent() / 2 - dot / 2 - 1, dot, dot);
        int tx = x + 14;
        g.setFont(bold);
        g.setColor(new Color(TEXT_PRIMARY, true));
        g.drawString(look.text[0], tx, y);
        if (!look.text[1].isEmpty()) {
            tx += fm.stringWidth(look.text[0] + "  ");
            g.setColor(new Color(look.colors[1], true));
            g.drawString(look.text[1], tx, y);
        }
        // Line 2: detail. Line 3: warning.
        g.setFont(plain);
        y += lineH;
        g.setColor(new Color(look.colors[2], true));
        g.drawString(look.text[2], x, y);
        if (!look.text[3].isEmpty()) {
            y += lineH;
            g.setColor(new Color(look.colors[3], true));
            g.drawString(look.text[3], x, y);
        }
    }

    private static void hints(Graphics2D g) {
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        // Grayscale, not subpixel: the image is composited over a heatmap whose
        // color we do not know, and LCD text fringes show on anything but white.
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_FRACTIONALMETRICS, RenderingHints.VALUE_FRACTIONALMETRICS_OFF);
        g.setRenderingHint(RenderingHints.KEY_STROKE_CONTROL, RenderingHints.VALUE_STROKE_PURE);
    }

    static Color withAlpha(Color c, int alpha) {
        return new Color(c.getRed(), c.getGreen(), c.getBlue(), alpha);
    }

    /** The level's color, lifted toward white so small text stays legible on the dark pill. */
    static Color brighten(Color c) {
        return new Color(lift(c.getRed()), lift(c.getGreen()), lift(c.getBlue()));
    }

    private static int lift(int v) {
        return Math.min(255, v + (255 - v) / 5);
    }
}
