package io.zerogex.bookmap.alerts;

/**
 * Where a "price reached a level" alert goes. The Bookmap-native one needs
 * Bookmap 7.4's alert declarations; older Bookmaps get spoken alerts.
 */
public interface AlertSink {

    /** Raises one alert. Must not block: the caller may be Bookmap's data thread. */
    void raise(String text, boolean popup, boolean sound);

    void dispose();

    AlertSink NONE = new AlertSink() {
        @Override
        public void raise(String text, boolean popup, boolean sound) {
        }

        @Override
        public void dispose() {
        }
    };
}
