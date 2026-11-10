package io.zerogex.bookmap.overlay;

/**
 * The on-chart labels, profile and status badge.
 *
 * <p>An interface the add-on holds instead of the implementation, because the
 * implementation uses Bookmap's screen-space painter API, which Bookmap 7.0 and
 * 7.1 do not have. The add-on loads {@code ScreenOverlay} by name; on a Bookmap
 * without the API that load fails cleanly and the add-on runs with lines only.
 */
public interface Overlay {

    /** Draws a new frame. Called on the add-on's overlay thread only. */
    void update(OverlayFrame frame);

    /** Re-lays out the last frame (the window moved or resized). Overlay thread only. */
    void refresh();

    void dispose();
}
