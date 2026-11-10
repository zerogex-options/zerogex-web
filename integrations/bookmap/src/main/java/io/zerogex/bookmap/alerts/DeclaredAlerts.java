package io.zerogex.bookmap.alerts;

import io.zerogex.bookmap.core.Logger;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import velox.api.layer1.Layer1ApiProvider;
import velox.api.layer1.layers.utils.SoundSynthHelper;
import velox.api.layer1.messages.Layer1ApiSoundAlertDeclarationMessage;
import velox.api.layer1.messages.Layer1ApiSoundAlertMessage;
import velox.api.layer1.simplified.Api;

/**
 * Alerts through Bookmap's own alert system (Bookmap 7.4 and later).
 *
 * <p>The add-on declares its one alert type ("price reaches a ZeroGEX level")
 * for this chart, so it shows in Bookmap's alert settings, where the trader can
 * mute the sound or the popup there like any other Bookmap alert. Each alert's
 * sound is the alert text spoken by Bookmap's synthesizer, so "ES at Call Wall"
 * needs no glance at the screen.
 *
 * <p>Speech synthesis takes a moment, so alerts are built on a small thread of
 * their own and never on Bookmap's data thread.
 */
public final class DeclaredAlerts implements AlertSink {

    private final Layer1ApiProvider provider;
    private final Class<?> owner;
    private final String alias;
    private final Layer1ApiSoundAlertDeclarationMessage declaration;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(new ThreadFactory() {
        @Override
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r, "ZeroGEX alerts");
            t.setDaemon(true);
            return t;
        }
    });

    public DeclaredAlerts(Api api, Class<?> owner, final String alias) {
        this.provider = api.getProvider();
        this.owner = owner;
        this.alias = alias;
        this.declaration = Layer1ApiSoundAlertDeclarationMessage.builder()
                .setTriggerDescription("Price reaches a ZeroGEX level (" + alias + ")")
                .setSource(owner)
                .setAliasMatcher(new java.util.function.Predicate<String>() {
                    @Override
                    public boolean test(String a) {
                        return alias.equals(a);
                    }
                })
                .setPopupAllowed(true)
                .setSoundAllowed(true)
                .setRepeated(false)
                .setIsAdd(true)
                .build();
        provider.sendUserMessage(declaration);
    }

    @Override
    public void raise(final String text, final boolean popup, final boolean sound) {
        worker.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    byte[] audio = sound ? SoundSynthHelper.synthesize(text) : null;
                    Layer1ApiSoundAlertMessage message = Layer1ApiSoundAlertMessage.builder()
                            .setAlertDeclarationId(declaration.id)
                            .setTextInfo("ZeroGEX: " + text)
                            .setShowPopup(popup)
                            .setSound(audio)
                            .setRepeatCount(1)
                            .setSource(owner)
                            .setAlias(alias)
                            .build();
                    provider.sendUserMessage(message);
                } catch (Throwable t) {
                    Logger.warn("could not raise alert", t);
                }
            }
        });
    }

    @Override
    public void dispose() {
        worker.shutdownNow();
        try {
            provider.sendUserMessage(new Layer1ApiSoundAlertDeclarationMessage.Builder(declaration)
                    .setIsAdd(false)
                    .build());
        } catch (Throwable t) {
            Logger.warn("could not remove alert declaration", t);
        }
    }
}
