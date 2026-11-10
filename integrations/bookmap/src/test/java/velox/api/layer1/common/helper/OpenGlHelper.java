package velox.api.layer1.common.helper;

import java.awt.image.BufferedImage;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Future;

/**
 * TEST-ONLY stand-in for a Bookmap runtime class the public API jar leaves
 * out. Bookmap's {@code ScreenSpaceCanvas.PreparedImage} hands every image to
 * this helper to build its OpenGL texture; inside Bookmap the real one does
 * that. Here it returns the pixels unchanged so the add-on's overlay can be
 * exercised outside Bookmap. Lives under src/test; never packaged.
 */
public final class OpenGlHelper {

    private OpenGlHelper() {
    }

    public static Future<int[]> convertImageToOpenGlFormatAsync(BufferedImage image) {
        int[] pixels = image.getRGB(0, 0, image.getWidth(), image.getHeight(), null, 0, image.getWidth());
        return CompletableFuture.completedFuture(pixels);
    }
}
