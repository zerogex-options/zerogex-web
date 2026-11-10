package io.zerogex.bookmap.core;

/**
 * A request that did not produce usable data, classified by what the trader
 * can do about it.
 *
 * <p>The messages are written for the chart, not for a log file. The two the
 * trader can act on are named outright, as the NinjaTrader indicator learned:
 * a rejected key almost always means a new key was generated elsewhere (only
 * one is active per account), and an uncovered symbol means picking another.
 */
public final class ApiError extends Exception {

    public enum Kind {
        /** No key entered yet. Nothing is sent. */
        NO_KEY,
        /** 401: wrong, revoked, or replaced key. Retrying cannot help. */
        KEY_REJECTED,
        /** 403: a valid key without levels access. */
        NO_ACCESS,
        /** 404: the API has no levels for this symbol (or expiration). */
        NOT_FOUND,
        /** 400 / 422: the request itself was refused, with a reason. */
        BAD_REQUEST,
        /** 429: too many requests. */
        RATE_LIMITED,
        /** 5xx, or a reply that is not the API's. Transient. */
        SERVER,
        /** Could not reach the API at all. Transient. */
        NETWORK,
        /** A 200 whose body is not the contract. */
        BAD_PAYLOAD
    }

    private static final long serialVersionUID = 1L;

    public final Kind kind;
    public final int httpStatus;
    /** The server's own sentence, when it sent one. */
    public final String detail;
    /** Seconds from a Retry-After header, or -1. */
    public final long retryAfterSeconds;

    public ApiError(Kind kind, int httpStatus, String detail, long retryAfterSeconds) {
        super(kind + (httpStatus > 0 ? " (HTTP " + httpStatus + ")" : "") + (detail != null ? ": " + detail : ""));
        this.kind = kind;
        this.httpStatus = httpStatus;
        this.detail = detail;
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public static ApiError of(Kind kind, String detail) {
        return new ApiError(kind, 0, detail, -1);
    }

    /** True when trying again later can succeed without the trader changing anything. */
    public boolean isTransient() {
        return kind == Kind.RATE_LIMITED || kind == Kind.SERVER || kind == Kind.NETWORK
                || kind == Kind.BAD_PAYLOAD;
    }

    /** One line for the chart's status badge and the settings panel. */
    public String userMessage() {
        switch (kind) {
            case NO_KEY:
                return "Paste your ZeroGEX API key in the add-on settings";
            case KEY_REJECTED:
                return "API key rejected - generating a new key retires the old one. Paste your current key";
            case NO_ACCESS:
                return "This key has no levels access - keys come with ZeroGEX Pro";
            case NOT_FOUND:
                return detail != null ? detail : "ZeroGEX has no levels for this symbol";
            case BAD_REQUEST:
                return detail != null ? detail : "Request refused (HTTP " + httpStatus + ")";
            case RATE_LIMITED:
                return "Rate limited by the API - backing off";
            case SERVER:
                return "ZeroGEX API unavailable" + (httpStatus > 0 ? " (HTTP " + httpStatus + ")" : "")
                        + " - retrying";
            case NETWORK:
                return "Can't reach api.zerogex.io" + (detail != null ? " (" + detail + ")" : "") + " - retrying";
            case BAD_PAYLOAD:
            default:
                return "Unexpected reply from the API - retrying";
        }
    }
}
