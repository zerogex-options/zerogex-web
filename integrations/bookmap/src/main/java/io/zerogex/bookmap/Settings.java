package io.zerogex.bookmap;

import io.zerogex.bookmap.core.LevelKind;
import velox.api.layer1.settings.StrategySettingsVersion;

/**
 * Everything the trader can set, as Bookmap saves it with the workspace (per
 * chart). Plain fields with defaults, because Bookmap serializes this class
 * itself and a workspace saved by an older version must still load.
 *
 * <p>The API key is normally NOT kept here: it lives in one place for every
 * chart ({@link KeyStore}), so a trader enters it once and regenerating it means
 * pasting it once. {@link #apiKey} is only a fallback for a machine where that
 * store cannot be written.
 *
 * <p>Arrays are indexed by {@link LevelKind#ordinal()}. {@link #normalize()}
 * repairs anything missing or out of range, which is how a workspace saved by a
 * future version with an extra level still loads here.
 */
@StrategySettingsVersion(currentVersion = 1, compatibleVersions = {})
public class Settings {

    public static final String AUTO = "AUTO";

    public String symbol = AUTO;
    /** "all" or "0dte". */
    public String expiration = "all";
    public String apiKey = "";
    /** Blank means api.zerogex.io. */
    public String apiBaseUrl = "";

    public boolean[] showLevel = defaultsShow();
    public int[] levelColor = defaultsColor();
    /** 0 thin, 1 normal (each level's own width), 2 thick. */
    public int lineWeight = 1;

    public boolean labels = true;
    /** 0 small, 1 normal, 2 large, 3 extra large. */
    public int labelSize = 1;
    public boolean statusBadge = true;
    /** True: bottom-left of the heatmap. False: top-left. */
    public boolean statusBadgeBottom = true;

    public boolean profile = true;
    public boolean profileOnRight = false;
    public int profileWidthPct = 16;
    public int profileStrikes = 60;

    public boolean alerts = false;
    public boolean[] alertLevel = {true, true, true, false, false};
    public int alertTicks = 2;
    public boolean alertPopup = true;
    public boolean alertSound = true;

    private static boolean[] defaultsShow() {
        boolean[] b = new boolean[LevelKind.values().length];
        java.util.Arrays.fill(b, true);
        return b;
    }

    private static int[] defaultsColor() {
        int[] c = new int[LevelKind.values().length];
        for (LevelKind kind : LevelKind.values()) {
            c[kind.ordinal()] = kind.defaultRgb;
        }
        return c;
    }

    /** Repairs a loaded instance in place and returns it. */
    public Settings normalize() {
        int n = LevelKind.values().length;
        if (symbol == null || symbol.trim().isEmpty()) {
            symbol = AUTO;
        }
        symbol = symbol.trim().toUpperCase(java.util.Locale.ROOT);
        if (!"0dte".equalsIgnoreCase(expiration)) {
            expiration = "all";
        } else {
            expiration = "0dte";
        }
        if (apiKey == null) {
            apiKey = "";
        }
        if (apiBaseUrl == null) {
            apiBaseUrl = "";
        }
        showLevel = resize(showLevel, defaultsShow());
        levelColor = resize(levelColor, defaultsColor());
        alertLevel = resize(alertLevel, new boolean[] {true, true, true, false, false});
        lineWeight = clamp(lineWeight, 0, 2);
        labelSize = clamp(labelSize, 0, 3);
        profileWidthPct = clamp(profileWidthPct, 5, 40);
        profileStrikes = clamp(profileStrikes, 20, 200);
        alertTicks = clamp(alertTicks, 0, 40);
        return this;
    }

    public Settings copy() {
        Settings s = new Settings();
        s.symbol = symbol;
        s.expiration = expiration;
        s.apiKey = apiKey;
        s.apiBaseUrl = apiBaseUrl;
        s.showLevel = showLevel.clone();
        s.levelColor = levelColor.clone();
        s.lineWeight = lineWeight;
        s.labels = labels;
        s.labelSize = labelSize;
        s.statusBadge = statusBadge;
        s.statusBadgeBottom = statusBadgeBottom;
        s.profile = profile;
        s.profileOnRight = profileOnRight;
        s.profileWidthPct = profileWidthPct;
        s.profileStrikes = profileStrikes;
        s.alerts = alerts;
        s.alertLevel = alertLevel.clone();
        s.alertTicks = alertTicks;
        s.alertPopup = alertPopup;
        s.alertSound = alertSound;
        return s;
    }

    public int lineWidth(LevelKind kind) {
        int base = kind.defaultWidth;
        return lineWeight == 0 ? 1 : lineWeight == 2 ? base + 1 : base;
    }

    private static boolean[] resize(boolean[] in, boolean[] defaults) {
        if (in != null && in.length == defaults.length) {
            return in;
        }
        boolean[] out = defaults.clone();
        if (in != null) {
            System.arraycopy(in, 0, out, 0, Math.min(in.length, out.length));
        }
        return out;
    }

    private static int[] resize(int[] in, int[] defaults) {
        if (in != null && in.length == defaults.length) {
            return in;
        }
        int[] out = defaults.clone();
        if (in != null) {
            System.arraycopy(in, 0, out, 0, Math.min(in.length, out.length));
        }
        return out;
    }

    private static int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }
}
