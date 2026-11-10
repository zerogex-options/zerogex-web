package io.zerogex.bookmap;

import java.util.prefs.Preferences;

/**
 * One API key for every chart on this computer.
 *
 * <p>A ZeroGEX member holds one active key, and generating a new one retires
 * the old one everywhere. If each Bookmap chart stored its own copy, a trader
 * with ES, MES and NQ open would have to paste a regenerated key three times,
 * and the chart they forgot would quietly stop updating. Stored once here,
 * pasting it in any chart's settings fixes all of them.
 *
 * <p>Java Preferences: the current user's registry hive on Windows, a plist on
 * macOS. No administrator rights needed. If it cannot be written (locked-down
 * machine), the settings panel falls back to saving the key with the chart.
 *
 * <p>The key is stored as entered. It is a bearer credential for read-only,
 * derived market analytics, kept with the same protection as the rest of the
 * trader's Bookmap configuration.
 */
final class KeyStore {

    private static final String NODE = "io/zerogex/bookmap";
    private static final String KEY = "apiKey";

    private KeyStore() {
    }

    /** The stored key, "" when none, or null when the store cannot be read. */
    static String load() {
        try {
            return Preferences.userRoot().node(NODE).get(KEY, "");
        } catch (Throwable t) {
            return null;
        }
    }

    /** Saves (or, with a blank key, removes) the key. False if the store could not be written. */
    static boolean save(String key) {
        try {
            Preferences prefs = Preferences.userRoot().node(NODE);
            String trimmed = key == null ? "" : key.trim();
            if (trimmed.isEmpty()) {
                prefs.remove(KEY);
            } else {
                prefs.put(KEY, trimmed);
            }
            prefs.flush();
            return true;
        } catch (Throwable t) {
            return false;
        }
    }
}
