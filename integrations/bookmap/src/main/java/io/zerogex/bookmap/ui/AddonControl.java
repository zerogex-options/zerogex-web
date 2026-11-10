package io.zerogex.bookmap.ui;

import io.zerogex.bookmap.Settings;
import io.zerogex.bookmap.core.StatusText;
import java.util.function.Consumer;

/** What the settings panels need from the running add-on. Implemented by the add-on; faked in tests. */
public interface AddonControl {

    /** A copy of the current settings, safe to modify. */
    Settings settings();

    /** Saves and applies settings at once; there is no OK button to forget. */
    void applySettings(Settings next);

    /** Saves the API key for every chart; returns the sentence to show. */
    String saveApiKey(String key);

    boolean hasApiKey();

    /** The chart's status in one line, as the badge says it. */
    String statusLine();

    StatusText.Tone statusTone();

    /** "Auto - ES ESZ26" */
    String detectedSymbolText();

    /** Fetches once with the current key and symbol, off the calling thread; reports a sentence. */
    void testConnection(Consumer<String> done);

    /** Plain text for a support email. Never contains the key. */
    String diagnostics();

    /** Why labels/profile are unavailable, or "". */
    String overlayNote();

    /** Alert limitations on this Bookmap version, or "". */
    String alertNote();

    String version();
}
