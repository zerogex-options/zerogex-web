package velox.gui.utils.localization.translatable;

/**
 * TEST-ONLY stand-in for a class Bookmap's runtime provides but its public API
 * jar does not: Bookmap's own {@code LineStyle} enum builds one of these for
 * each style's display name in its static initializer, so without it no code
 * outside Bookmap can even reference {@code LineStyle.SOLID}. Inside Bookmap
 * the real class is always present. This file lives under src/test and is
 * never packaged into the add-on's jar (build.sh packs src/main only).
 */
public class Layer1ApiTranslatableText {
    public Layer1ApiTranslatableText(String key) {
    }
}
