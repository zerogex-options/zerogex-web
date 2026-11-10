package io.zerogex.bookmap.harness;

import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.Stroke;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.Random;
import javax.imageio.ImageIO;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.CanvasIcon;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.CompositeCoordinateBase;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.CompositeHorizontalCoordinate;
import velox.api.layer1.layers.strategies.interfaces.ScreenSpaceCanvas.CompositeVerticalCoordinate;
import velox.api.layer1.simplified.LineStyle;

/**
 * Renders what the add-on placed onto a simulated Bookmap heatmap, using the
 * coordinate rules Bookmap documents (prices in levels, pixels from the
 * bottom-left, y upward). The heatmap and price trail are synthetic and
 * labeled as such; the lines, labels, profile and badge are exactly the
 * add-on's output. For a human to look at: the assertions live in the tests.
 */
public final class PreviewRenderer {

    public final int width;
    public final int height;
    public final int timelineX;
    public final long timeLeft;
    public final long timeNow;
    public final long priceBottomLevels;
    public final long priceHeightLevels;
    public final double pips;

    public PreviewRenderer(int width, int height, int timelineX, long timeLeft, long timeNow,
                           long priceBottomLevels, long priceHeightLevels, double pips) {
        this.width = width;
        this.height = height;
        this.timelineX = timelineX;
        this.timeLeft = timeLeft;
        this.timeNow = timeNow;
        this.priceBottomLevels = priceBottomLevels;
        this.priceHeightLevels = priceHeightLevels;
        this.pips = pips;
    }

    double yOfLevel(double level) {
        return height - (level - priceBottomLevels) * height / priceHeightLevels;
    }

    double xOfTime(long t) {
        return (t - timeLeft) * (double) timelineX / (timeNow - timeLeft);
    }

    public BufferedImage render(List<FakeIndicator> lines, List<ScreenSpaceCanvas.CanvasShape> shapes,
                                double lastPrice) {
        int axis = 78;
        BufferedImage img = new BufferedImage(width + axis, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(new Color(0x04070F));
        g.fillRect(0, 0, width + axis, height);
        drawSyntheticHeatmap(g, lastPrice);
        // The "now" line.
        g.setColor(new Color(255, 255, 255, 60));
        g.drawLine(timelineX, 0, timelineX, height);

        for (FakeIndicator line : lines) {
            drawLine(g, line);
        }
        for (ScreenSpaceCanvas.CanvasShape s : shapes) {
            if (s instanceof CanvasIcon) {
                drawIcon(g, (CanvasIcon) s);
            }
        }
        drawAxis(g, axis, lastPrice);
        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 10));
        g.setColor(new Color(255, 255, 255, 90));
        g.drawString("Simulated heatmap and price (test render). Lines, labels, profile and badge are the add-on's output.",
                width / 2 - 250, 14);
        g.dispose();
        return img;
    }

    private void drawSyntheticHeatmap(Graphics2D g, double lastPrice) {
        Random r = new Random(42);
        for (long lv = priceBottomLevels; lv < priceBottomLevels + priceHeightLevels; lv++) {
            double price = lv * pips;
            double base = Math.abs(price % 5.0) < 1e-9 ? 0.45 : Math.abs(price % 1.0) < 1e-9 ? 0.25 : 0.08;
            int y = (int) yOfLevel(lv + 1);
            int h = Math.max(1, (int) Math.ceil(height / (double) priceHeightLevels));
            for (int x = 0; x < timelineX; x += 6) {
                double heat = base * (0.4 + r.nextDouble()) * (r.nextDouble() < 0.02 ? 3 : 1);
                g.setColor(heatColor(Math.min(1.0, heat)));
                g.fillRect(x, y, 6, h);
            }
        }
        // A synthetic price trail ending at the last price.
        double p = lastPrice;
        int prevY = (int) yOfLevel(p / pips);
        g.setStroke(new BasicStroke(1.6f));
        for (int x = timelineX; x > 0; x -= 3) {
            p += (r.nextDouble() - 0.5) * 1.5;
            double lv = p / pips;
            if (lv < priceBottomLevels + 4 || lv > priceBottomLevels + priceHeightLevels - 4) {
                p -= (lv - (priceBottomLevels + priceHeightLevels / 2.0)) * pips * 0.05;
            }
            int y = (int) yOfLevel(p / pips);
            g.setColor(new Color(235, 240, 255, 200));
            g.drawLine(x, prevY, x - 3, y);
            prevY = y;
        }
    }

    private static Color heatColor(double v) {
        if (v < 0.25) {
            return blend(new Color(0x04070F), new Color(0x0B2E59), v / 0.25);
        }
        if (v < 0.5) {
            return blend(new Color(0x0B2E59), new Color(0x1E88A8), (v - 0.25) / 0.25);
        }
        if (v < 0.75) {
            return blend(new Color(0x1E88A8), new Color(0xE0C341), (v - 0.5) / 0.25);
        }
        return blend(new Color(0xE0C341), new Color(0xF2742B), (v - 0.75) / 0.25);
    }

    private static Color blend(Color a, Color b, double t) {
        t = Math.max(0, Math.min(1, t));
        return new Color((int) (a.getRed() + (b.getRed() - a.getRed()) * t),
                (int) (a.getGreen() + (b.getGreen() - a.getGreen()) * t),
                (int) (a.getBlue() + (b.getBlue() - a.getBlue()) * t));
    }

    private void drawLine(Graphics2D g, FakeIndicator line) {
        if (line.points.isEmpty()) {
            return;
        }
        g.setColor(line.color == null ? Color.WHITE : line.color);
        g.setStroke(stroke(line.style, Math.max(1, line.width)));
        int prevX = -1;
        int prevY = -1;
        for (int x = 0; x <= timelineX; x++) {
            long t = timeLeft + (long) ((timeNow - timeLeft) * (x / (double) timelineX));
            double v = line.valueAt(t);
            if (Double.isNaN(v)) {
                prevX = -1;
                continue;
            }
            int y = (int) Math.round(yOfLevel(v));
            if (prevX >= 0) {
                g.drawLine(prevX, prevY, x, y);
            }
            prevX = x;
            prevY = y;
        }
    }

    private static Stroke stroke(LineStyle style, int width) {
        if (style == LineStyle.LONG_DASH) {
            return new BasicStroke(width, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10f, new float[] {10f, 6f}, 0f);
        }
        if (style == LineStyle.DOT) {
            return new BasicStroke(width, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10f, new float[] {2f, 4f}, 0f);
        }
        if (style == LineStyle.DASH_DOT) {
            return new BasicStroke(width, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER, 10f,
                    new float[] {9f, 4f, 2f, 4f}, 0f);
        }
        return new BasicStroke(width);
    }

    private void drawIcon(Graphics2D g, CanvasIcon icon) {
        double x1 = x(icon.getX1().compose());
        double x2 = x(icon.getX2().compose());
        double y1 = yFromBottom(icon.getY1().compose());
        double y2 = yFromBottom(icon.getY2().compose());
        BufferedImage img = icon.getImage().getReadOnlyImage();
        int left = (int) Math.round(Math.min(x1, x2));
        int top = (int) Math.round(height - Math.max(y1, y2));
        g.drawImage(img, left, top, (int) Math.round(Math.abs(x2 - x1)), (int) Math.round(Math.abs(y2 - y1)), null);
    }

    double x(CompositeHorizontalCoordinate c) {
        if (c.base == CompositeCoordinateBase.PIXEL_ZERO) {
            return c.pixelsX;
        }
        return xOfTime(c.timeX) + c.pixelsX;
    }

    double yFromBottom(CompositeVerticalCoordinate c) {
        if (c.base == CompositeCoordinateBase.PIXEL_ZERO) {
            return c.pixelsY;
        }
        return (c.dataY - priceBottomLevels) * height / priceHeightLevels + c.pixelsY;
    }

    private void drawAxis(Graphics2D g, int axis, double lastPrice) {
        g.setColor(new Color(0x0B111C));
        g.fillRect(width, 0, axis, height);
        g.setFont(new Font(Font.SANS_SERIF, Font.PLAIN, 11));
        double bottom = priceBottomLevels * pips;
        double top = (priceBottomLevels + priceHeightLevels) * pips;
        for (double p = Math.ceil(bottom / 10) * 10; p <= top; p += 10) {
            int y = (int) yOfLevel(p / pips);
            g.setColor(new Color(0x6B7280));
            g.drawString(String.format("%,.2f", p), width + 6, y + 4);
        }
        int y = (int) yOfLevel(lastPrice / pips);
        g.setColor(new Color(0xE5E7EB));
        g.fillRect(width, y - 8, axis, 16);
        g.setColor(Color.BLACK);
        g.drawString(String.format("%,.2f", lastPrice), width + 6, y + 4);
    }

    public static void write(BufferedImage img, String name) throws IOException {
        String dir = System.getProperty("zerogex.preview.dir");
        if (dir == null || dir.isEmpty()) {
            return;
        }
        File out = new File(dir, name);
        out.getParentFile().mkdirs();
        ImageIO.write(img, "png", out);
    }
}
