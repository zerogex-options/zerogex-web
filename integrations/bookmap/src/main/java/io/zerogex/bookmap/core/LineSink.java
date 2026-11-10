package io.zerogex.bookmap.core;

/**
 * Where level changes are drawn. In Bookmap this is one modifiable indicator
 * per level; in tests it is a recorder.
 *
 * <p>Prices are real prices (7727.25), not Bookmap's tick-level units: the
 * conversion belongs to the one class that knows the instrument's tick size.
 * NaN means "no level from here": Bookmap draws it as a gap.
 */
public interface LineSink {

    /** The level is {@code price} from {@code timeNanos} until the next point. */
    void point(LevelKind kind, long timeNanos, double price);

    /** Removes every point of one level (used when its line is hidden or the symbol changes). */
    void clearAll(LevelKind kind);

    LineSink NONE = new LineSink() {
        @Override
        public void point(LevelKind kind, long timeNanos, double price) {
        }

        @Override
        public void clearAll(LevelKind kind) {
        }
    };
}
