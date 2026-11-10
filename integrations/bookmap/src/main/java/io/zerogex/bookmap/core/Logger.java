package io.zerogex.bookmap.core;

import java.lang.reflect.Method;

/**
 * Writes to Bookmap's own log when running inside Bookmap, and to stderr
 * otherwise (tests). Reached by reflection so the core package stays free of
 * Bookmap types and runs anywhere.
 *
 * <p>Messages are prefixed "ZeroGEX:" so a support request that includes the
 * Bookmap log can be searched in one step. Nothing logged here ever contains
 * the API key.
 */
public final class Logger {

    private static final Method INFO;
    private static final Method WARN;

    static {
        Method info = null;
        Method warn = null;
        try {
            Class<?> log = Class.forName("velox.api.layer1.common.Log");
            info = log.getMethod("info", String.class);
            warn = log.getMethod("warn", String.class);
        } catch (Throwable ignored) {
            // not inside Bookmap
        }
        INFO = info;
        WARN = warn;
    }

    private Logger() {
    }

    public static void info(String message) {
        write(INFO, "ZeroGEX: " + message);
    }

    public static void warn(String message, Throwable t) {
        String text = "ZeroGEX: " + message + (t == null ? "" : " - " + t);
        write(WARN, text);
    }

    private static void write(Method method, String text) {
        if (Boolean.getBoolean("zerogex.quiet")) {
            return;
        }
        if (method != null) {
            try {
                method.invoke(null, text);
                return;
            } catch (Throwable ignored) {
                // fall back to stderr
            }
        }
        System.err.println(text);
    }
}
