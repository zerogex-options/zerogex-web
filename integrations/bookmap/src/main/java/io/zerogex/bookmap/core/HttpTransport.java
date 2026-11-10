package io.zerogex.bookmap.core;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;

/**
 * The one network operation the add-on performs: an HTTPS GET.
 *
 * <p>An interface so every decision built on top of it — error classification,
 * backoff, caching, pagination — runs in tests against canned responses with
 * no network at all.
 */
public interface HttpTransport {

    Response get(String url, Map<String, String> headers, int connectTimeoutMs, int readTimeoutMs)
            throws IOException;

    final class Response {
        public final int status;
        public final String body;
        /** Header names lower-cased. */
        public final Map<String, String> headers;

        public Response(int status, String body, Map<String, String> headers) {
            this.status = status;
            this.body = body == null ? "" : body;
            this.headers = headers == null ? Collections.<String, String>emptyMap() : headers;
        }

        public String header(String name) {
            return headers.get(name.toLowerCase(java.util.Locale.ROOT));
        }
    }
}
