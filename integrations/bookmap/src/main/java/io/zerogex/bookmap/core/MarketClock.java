package io.zerogex.bookmap.core;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;

/**
 * Time arithmetic in the units Bookmap and the ZeroGEX API each speak.
 *
 * <p>Bookmap stamps everything in nanoseconds since the epoch (UTC). The API
 * speaks ISO-8601 with an offset. The cash session that produces the levels
 * runs 09:30 to 16:00 America/New_York. This class owns the conversions
 * between the three so nothing else does date math by hand.
 *
 * <p>Holidays and early closes are deliberately not modeled here: the API
 * already knows them, and a session it has no rows for is simply a session the
 * add-on draws nothing for. A hard-coded holiday table in a desktop add-on is a
 * table that is wrong the first year nobody updates it.
 */
public final class MarketClock {

    /** Sentinel for "no timestamp". Long.MIN_VALUE never collides with a real time. */
    public static final long NONE = Long.MIN_VALUE;

    public static final ZoneId NEW_YORK = ZoneId.of("America/New_York");
    public static final LocalTime OPEN = LocalTime.of(9, 30);
    public static final LocalTime CLOSE = LocalTime.of(16, 0);

    public static final long SECOND = 1_000_000_000L;
    public static final long MINUTE = 60L * SECOND;
    public static final long HOUR = 60L * MINUTE;
    public static final long DAY = 24L * HOUR;

    private static final DateTimeFormatter CLOCK_ET =
            DateTimeFormatter.ofPattern("h:mm a", Locale.US);
    private static final DateTimeFormatter DAY_CLOCK_ET =
            DateTimeFormatter.ofPattern("EEE h:mm a", Locale.US);

    private MarketClock() {
    }

    // ------------------------------------------------------------------
    // Conversions
    // ------------------------------------------------------------------

    public static long toNanos(Instant instant) {
        return instant.getEpochSecond() * SECOND + instant.getNano();
    }

    public static Instant toInstant(long nanos) {
        return Instant.ofEpochSecond(Math.floorDiv(nanos, SECOND), Math.floorMod(nanos, SECOND));
    }

    public static long nowNanos() {
        return toNanos(Instant.now());
    }

    /**
     * Parses an API timestamp to epoch nanoseconds, or {@link #NONE}.
     *
     * <p>The API's timestamps are Python {@code isoformat()} output: an offset
     * ("+00:00") or "Z", optionally fractional seconds. A naive timestamp (no
     * offset) is read as UTC, which is what the database stores.
     */
    public static long parseIso(String text) {
        if (text == null) {
            return NONE;
        }
        String s = text.trim();
        if (s.isEmpty()) {
            return NONE;
        }
        try {
            return toNanos(OffsetDateTime.parse(s).toInstant());
        } catch (DateTimeParseException ignored) {
            // fall through to the naive form
        }
        try {
            return toNanos(LocalDateTime.parse(s).toInstant(ZoneOffset.UTC));
        } catch (DateTimeParseException ignored) {
            return NONE;
        }
    }

    /**
     * Formats epoch nanoseconds the way the API's {@code datetime.fromisoformat}
     * accepts on every Python version it runs on: whole seconds and an explicit
     * "+00:00" offset (older Pythons reject "Z").
     */
    public static String isoUtc(long nanos) {
        // Not ISO_OFFSET_DATE_TIME: Java writes UTC as "Z", and Python 3.10's
        // fromisoformat (which the API supports) rejects "Z" with a 400.
        return UTC_SECONDS.format(OffsetDateTime.ofInstant(Instant.ofEpochSecond(Math.floorDiv(nanos, SECOND)),
                ZoneOffset.UTC)) + "+00:00";
    }

    private static final DateTimeFormatter UTC_SECONDS =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT);

    // ------------------------------------------------------------------
    // The cash session
    // ------------------------------------------------------------------

    public static LocalDate etDate(long nanos) {
        return ZonedDateTime.ofInstant(toInstant(nanos), NEW_YORK).toLocalDate();
    }

    public static boolean isWeekday(LocalDate date) {
        DayOfWeek day = date.getDayOfWeek();
        return day != DayOfWeek.SATURDAY && day != DayOfWeek.SUNDAY;
    }

    public static long open(LocalDate date) {
        return toNanos(ZonedDateTime.of(date, OPEN, NEW_YORK).toInstant());
    }

    public static long close(LocalDate date) {
        return toNanos(ZonedDateTime.of(date, CLOSE, NEW_YORK).toInstant());
    }

    public static LocalDate previousWeekday(LocalDate date) {
        LocalDate d = date.minusDays(1);
        while (!isWeekday(d)) {
            d = d.minusDays(1);
        }
        return d;
    }

    /**
     * The date of the session that is in progress at {@code nanos}, or the most
     * recent one to have opened before it. Overnight and on weekends that is
     * the last weekday's session, whose levels are the ones still standing.
     */
    public static LocalDate latestSessionDate(long nanos) {
        LocalDate d = etDate(nanos);
        if (!isWeekday(d) || nanos < open(d)) {
            d = previousWeekday(d);
        }
        return d;
    }

    /** True from 09:30 to 16:00 ET on a weekday. */
    public static boolean isRegularHours(long nanos) {
        LocalDate d = etDate(nanos);
        return isWeekday(d) && nanos >= open(d) && nanos < close(d);
    }

    /** The first weekday 09:30 ET strictly after {@code nanos}. */
    public static long nextOpenAfter(long nanos) {
        LocalDate d = etDate(nanos);
        if (isWeekday(d) && nanos < open(d)) {
            return open(d);
        }
        d = d.plusDays(1);
        while (!isWeekday(d)) {
            d = d.plusDays(1);
        }
        return open(d);
    }

    // ------------------------------------------------------------------
    // Display
    // ------------------------------------------------------------------

    /** "3:59 PM ET" for today, "Fri 3:59 PM ET" for any other day. */
    public static String clockLabel(long nanos, long nowNanos) {
        ZonedDateTime at = ZonedDateTime.ofInstant(toInstant(nanos), NEW_YORK);
        boolean sameDay = at.toLocalDate().equals(etDate(nowNanos));
        return (sameDay ? CLOCK_ET : DAY_CLOCK_ET).format(at) + " ET";
    }
}
