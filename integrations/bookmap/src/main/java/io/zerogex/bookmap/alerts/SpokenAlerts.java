package io.zerogex.bookmap.alerts;

import io.zerogex.bookmap.core.Logger;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import velox.api.layer1.layers.utils.SoundSynthHelper;

/**
 * Alerts for Bookmap before 7.4, which has no alert declarations: the text is
 * spoken with Bookmap's synthesizer (present since 7.0). There is no popup on
 * these versions, which the settings panel says.
 */
public final class SpokenAlerts implements AlertSink {

    private final ExecutorService worker = Executors.newSingleThreadExecutor(new ThreadFactory() {
        @Override
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r, "ZeroGEX alerts");
            t.setDaemon(true);
            return t;
        }
    });

    @Override
    public void raise(final String text, boolean popup, boolean sound) {
        if (!sound) {
            return;
        }
        worker.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    SoundSynthHelper.say(text);
                } catch (Throwable t) {
                    Logger.warn("could not speak alert", t);
                }
            }
        });
    }

    @Override
    public void dispose() {
        worker.shutdownNow();
    }
}
