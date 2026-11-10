package io.zerogex.bookmap.harness;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import io.zerogex.bookmap.core.HttpTransport;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.function.Function;
import java.util.zip.GZIPOutputStream;

/**
 * A real HTTP server on 127.0.0.1 standing in for api.zerogex.io, so the
 * add-on's own transport (headers, gzip, status codes) is exercised end to
 * end. Answers gzip-compressed when asked, as Cloudflare does.
 */
public final class LocalApiServer implements AutoCloseable {

    public final List<String> requests = Collections.synchronizedList(new ArrayList<String>());
    public final List<String> authHeaders = Collections.synchronizedList(new ArrayList<String>());
    private final HttpServer server;

    public LocalApiServer(final Function<String, HttpTransport.Response> handler) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", new HttpHandler() {
            @Override
            public void handle(HttpExchange ex) throws IOException {
                String url = "http://127.0.0.1" + ex.getRequestURI().toString();
                requests.add(ex.getRequestURI().toString());
                authHeaders.add(ex.getRequestHeaders().getFirst("Authorization"));
                HttpTransport.Response r = handler.apply(url);
                byte[] body = r.body.getBytes(StandardCharsets.UTF_8);
                String accept = ex.getRequestHeaders().getFirst("Accept-Encoding");
                if (accept != null && accept.contains("gzip")) {
                    ByteArrayOutputStream bos = new ByteArrayOutputStream();
                    try (GZIPOutputStream gz = new GZIPOutputStream(bos)) {
                        gz.write(body);
                    }
                    body = bos.toByteArray();
                    ex.getResponseHeaders().add("Content-Encoding", "gzip");
                }
                ex.getResponseHeaders().add("Content-Type", "application/json");
                ex.sendResponseHeaders(r.status, body.length);
                try (OutputStream os = ex.getResponseBody()) {
                    os.write(body);
                }
            }
        });
        server.start();
    }

    public String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    @Override
    public void close() {
        server.stop(0);
    }
}
