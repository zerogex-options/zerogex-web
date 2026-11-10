package io.zerogex.bookmap.core;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.net.URLDecoder;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/** Answers requests from a function of the URL, and records every request. */
public final class FakeTransport implements HttpTransport {

    public final List<String> urls = Collections.synchronizedList(new ArrayList<String>());
    public final List<Map<String, String>> headers = Collections.synchronizedList(new ArrayList<Map<String, String>>());
    public volatile Function<String, Response> handler;

    public FakeTransport(Function<String, Response> handler) {
        this.handler = handler;
    }

    @Override
    public Response get(String url, Map<String, String> h, int connectTimeoutMs, int readTimeoutMs) throws IOException {
        urls.add(url);
        headers.add(new HashMap<String, String>(h));
        Response r = handler.apply(url);
        if (r == null) {
            throw new IOException("connection refused");
        }
        return r;
    }

    public static Response ok(String body) {
        return new Response(200, body, null);
    }

    public static Response status(int code, String body) {
        return new Response(code, body, null);
    }

    public static Response status(int code, String body, String retryAfter) {
        Map<String, String> h = new HashMap<String, String>();
        h.put("retry-after", retryAfter);
        return new Response(code, body, h);
    }

    public int count(String pathFragment) {
        int n = 0;
        synchronized (urls) {
            for (String u : urls) {
                if (u.contains(pathFragment)) {
                    n++;
                }
            }
        }
        return n;
    }

    /** Query parameters of a URL, decoded. */
    public static Map<String, String> query(String url) {
        Map<String, String> out = new HashMap<String, String>();
        int q = url.indexOf('?');
        if (q < 0) {
            return out;
        }
        for (String pair : url.substring(q + 1).split("&")) {
            int eq = pair.indexOf('=');
            try {
                out.put(URLDecoder.decode(pair.substring(0, eq), "UTF-8"), URLDecoder.decode(pair.substring(eq + 1), "UTF-8"));
            } catch (UnsupportedEncodingException e) {
                throw new IllegalStateException(e);
            }
        }
        return out;
    }
}
