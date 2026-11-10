package io.zerogex.bookmap.testkit;

import java.util.Objects;

/** Assertions. Small on purpose: the add-on's build has no third-party dependencies, tests included. */
public final class Check {

    private Check() {
    }

    public static void isTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    public static void isFalse(boolean condition, String message) {
        isTrue(!condition, message);
    }

    public static void eq(Object expected, Object actual, String message) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError(message + "\n  expected: " + expected + "\n  actual:   " + actual);
        }
    }

    public static void near(double expected, double actual, double tolerance, String message) {
        if (Double.isNaN(expected) ? !Double.isNaN(actual) : !(Math.abs(expected - actual) <= tolerance)) {
            throw new AssertionError(message + "\n  expected: " + expected + " (+/- " + tolerance + ")\n  actual:   " + actual);
        }
    }

    public static void nan(double actual, String message) {
        if (!Double.isNaN(actual)) {
            throw new AssertionError(message + "\n  expected NaN, got " + actual);
        }
    }

    public static <T extends Throwable> T throwsA(Class<T> type, Runnable body, String message) {
        try {
            body.run();
        } catch (Throwable t) {
            if (type.isInstance(t)) {
                return type.cast(t);
            }
            throw new AssertionError(message + "\n  expected " + type.getSimpleName() + ", got " + t, t);
        }
        throw new AssertionError(message + "\n  expected " + type.getSimpleName() + ", nothing was thrown");
    }

    public static void contains(String haystack, String needle, String message) {
        if (haystack == null || !haystack.contains(needle)) {
            throw new AssertionError(message + "\n  expected to contain: " + needle + "\n  actual: " + haystack);
        }
    }

    public static void notContains(String haystack, String needle, String message) {
        if (haystack != null && haystack.contains(needle)) {
            throw new AssertionError(message + "\n  must not contain: " + needle + "\n  actual: " + haystack);
        }
    }
}
