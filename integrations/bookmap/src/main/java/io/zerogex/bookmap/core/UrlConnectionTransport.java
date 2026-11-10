package io.zerogex.bookmap.core;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.zip.GZIPInputStream;

/**
 * {@link HttpTransport} over {@link HttpURLConnection}.
 *
 * <p>HttpURLConnection rather than {@code java.net.http.HttpClient} because it
 * exists on every JVM Bookmap has ever shipped (7.0 ran on Java 8), honors the
 * proxy settings a corporate desktop already has, and starts no threads of its
 * own inside someone else's application.
 */
public final class UrlConnectionTransport implements HttpTransport {

    /** No ZeroGEX payload is anywhere near this; a body that is has come from somewhere else. */
    private static final int MAX_BODY_BYTES = 8 * 1024 * 1024;

    @Override
    public Response get(String url, Map<String, String> headers, int connectTimeoutMs, int readTimeoutMs)
            throws IOException {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        try {
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(connectTimeoutMs);
            conn.setReadTimeout(readTimeoutMs);
            conn.setUseCaches(false);
            conn.setInstanceFollowRedirects(false); // a redirect would carry the Authorization header somewhere else
            conn.setRequestProperty("Accept-Encoding", "gzip");
            for (Map.Entry<String, String> h : headers.entrySet()) {
                conn.setRequestProperty(h.getKey(), h.getValue());
            }
            int status = conn.getResponseCode();
            Map<String, String> responseHeaders = new HashMap<String, String>();
            for (Map.Entry<String, List<String>> h : conn.getHeaderFields().entrySet()) {
                if (h.getKey() != null && h.getValue() != null && !h.getValue().isEmpty()) {
                    responseHeaders.put(h.getKey().toLowerCase(Locale.ROOT), h.getValue().get(0));
                }
            }
            InputStream raw = status >= 400 ? conn.getErrorStream() : conn.getInputStream();
            String body = "";
            if (raw != null) {
                InputStream in = raw;
                if ("gzip".equalsIgnoreCase(responseHeaders.get("content-encoding"))) {
                    in = new GZIPInputStream(raw);
                }
                try {
                    body = readCapped(in);
                } finally {
                    in.close();
                }
            }
            return new Response(status, body, responseHeaders);
        } finally {
            conn.disconnect();
        }
    }

    private static String readCapped(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream(16 * 1024);
        byte[] buf = new byte[16 * 1024];
        int n;
        while ((n = in.read(buf)) != -1) {
            if (out.size() + n > MAX_BODY_BYTES) {
                throw new IOException("response larger than " + (MAX_BODY_BYTES / (1024 * 1024)) + " MB");
            }
            out.write(buf, 0, n);
        }
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }
}
