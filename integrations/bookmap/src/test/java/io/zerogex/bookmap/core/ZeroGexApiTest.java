package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.util.List;

public class ZeroGexApiTest {

    private static ZeroGexApi client(FakeTransport t, String key) {
        ZeroGexApi.clearCacheForTests();
        return new ZeroGexApi(t, "https://api.example.test/", () -> key, "test-agent");
    }

    @Test
    public void sendsTheKeyInAHeaderNeverInTheUrl() throws Exception {
        FakeTransport t = new FakeTransport(u -> FakeTransport.ok(new Fixtures.Levels().json()));
        client(t, "  zg_secret_123  ").levels("es", 60, null);
        Check.eq("https://api.example.test/api/v1/levels/ES?strikes=60", t.urls.get(0), "url");
        Check.eq("Bearer zg_secret_123", t.headers.get(0).get("Authorization"), "trimmed bearer key");
        Check.eq("test-agent", t.headers.get(0).get("User-Agent"), "user agent");
        Check.notContains(t.urls.get(0), "zg_secret", "no key in the URL");
    }

    @Test
    public void noKeyMeansNoRequest() {
        FakeTransport t = new FakeTransport(u -> FakeTransport.ok("{}"));
        ApiError e = expectError(() -> client(t, " ").levels("ES", 60, null));
        Check.eq(ApiError.Kind.NO_KEY, e.kind, "kind");
        Check.eq(0, t.urls.size(), "nothing sent");
    }

    @Test
    public void classifiesEveryFailureTheTraderCanActOn() {
        Object[][] cases = {
            {401, ApiError.Kind.KEY_REJECTED, "generating a new key retires the old one"},
            {403, ApiError.Kind.NO_ACCESS, "keys come with ZeroGEX Pro"},
            {404, ApiError.Kind.NOT_FOUND, "No dealer-positioning levels available for XYZ"},
            {422, ApiError.Kind.BAD_REQUEST, "error"},
            {500, ApiError.Kind.SERVER, "retrying"},
            {502, ApiError.Kind.SERVER, "retrying"},
            {302, ApiError.Kind.SERVER, "retrying"},
        };
        for (Object[] c : cases) {
            final int code = (Integer) c[0];
            FakeTransport t = new FakeTransport(u -> FakeTransport.status(code,
                    "{\"detail\":\"" + FakeApi.detailFor(code) + "\"}"));
            ApiError e = expectError(() -> client(t, "k").levels("ES", 1, null));
            Check.eq(c[1], e.kind, "kind for " + code);
            Check.contains(e.userMessage(), (String) c[2], "message for " + code);
        }
    }

    @Test
    public void rateLimitHonorsRetryAfter() {
        FakeTransport t = new FakeTransport(u -> FakeTransport.status(429, "{}", "120"));
        ApiError e = expectError(() -> client(t, "k").levels("ES", 1, null));
        Check.eq(ApiError.Kind.RATE_LIMITED, e.kind, "kind");
        Check.eq(120L, e.retryAfterSeconds, "retry-after seconds");
    }

    @Test
    public void networkFailuresAreTransient() {
        FakeTransport t = new FakeTransport(u -> null);
        ApiError e = expectError(() -> client(t, "k").levels("ES", 1, null));
        Check.eq(ApiError.Kind.NETWORK, e.kind, "kind");
        Check.isTrue(e.isTransient(), "transient");
    }

    @Test
    public void anHtmlPageWithStatus200IsABadPayloadAndIsNotCached() {
        FakeTransport t = new FakeTransport(u -> FakeTransport.ok("<html>captive portal</html>"));
        ZeroGexApi api = client(t, "k");
        Check.eq(ApiError.Kind.BAD_PAYLOAD, expectError(() -> api.levels("ES", 1, null)).kind, "kind");
        t.handler = u -> FakeTransport.ok(new Fixtures.Levels().json());
        try {
            api.levels("ES", 1, null);
        } catch (ApiError e) {
            throw new AssertionError("a bad body must not be served again from the cache", e);
        }
    }

    @Test
    public void refusesLevelsForTheWrongSymbol() {
        FakeTransport t = new FakeTransport(u -> FakeTransport.ok(new Fixtures.Levels().json()));
        ApiError e = expectError(() -> client(t, "k").levels("NQ", 1, null));
        Check.eq(ApiError.Kind.BAD_PAYLOAD, e.kind, "ES levels for an NQ request");
    }

    @Test
    public void anApiThatIgnoresTheExpirationScopeIsRefused() {
        FakeTransport t = new FakeTransport(u -> FakeTransport.ok(new Fixtures.Levels().json()));
        ApiError e = expectError(() -> client(t, "k").levels("ES", 1, "0dte"));
        Check.contains(t.urls.get(0), "expiration=0dte", "scope sent");
        Check.contains(e.userMessage(), "ignored the expiration", "refused rather than mislabeled");
    }

    @Test
    public void twoChartsAskingAtOnceShareOneRequest() throws Exception {
        FakeTransport t = new FakeTransport(u -> FakeTransport.ok(new Fixtures.Levels().json()));
        ZeroGexApi.clearCacheForTests();
        ZeroGexApi es = new ZeroGexApi(t, null, () -> "k", "a");
        ZeroGexApi mes = new ZeroGexApi(t, null, () -> "k", "a");
        es.levels("ES", 60, null);
        mes.levels("ES", 60, null);
        Check.eq(1, t.urls.size(), "one request for two charts");
        Check.isTrue(mes.lastCall().fromCache, "second served from the shared cache");
        new ZeroGexApi(t, null, () -> "other-key", "a").levels("ES", 60, null);
        Check.eq(2, t.urls.size(), "a different key never sees another key's response");
    }

    @Test
    public void historyFollowsPagesBackAndReturnsOldestFirst() throws Exception {
        FakeApi fake = new FakeApi();
        FakeTransport t = new FakeTransport(fake::handle);
        long open = Fixtures.et(2026, 11, 9, 9, 30);
        long close = Fixtures.et(2026, 11, 9, 16, 0);
        List<SummaryRow> rows = client(t, "k").history("ES", open, close, "1min", 10);
        Check.eq(390, rows.size(), "a full session of minutes");
        Check.eq(open, rows.get(0).timestamp, "oldest first");
        Check.eq(close - MarketClock.MINUTE, rows.get(389).timestamp, "the 3:59 bar last");
        Check.eq(5, t.count("/api/gex/historical"), "five pages of 90");
        Check.contains(t.urls.get(0), "start_date=2026-11-09T14%3A30%3A00%2B00%3A00", "explicit +00:00, encoded");
        for (int i = 1; i < rows.size(); i++) {
            Check.isTrue(rows.get(i).timestamp > rows.get(i - 1).timestamp, "strictly increasing, no duplicates");
        }
    }

    @Test
    public void historyStopsAtThePageLimit() throws Exception {
        FakeApi fake = new FakeApi();
        FakeTransport t = new FakeTransport(fake::handle);
        client(t, "k").history("ES", Fixtures.et(2026, 11, 9, 9, 30), Fixtures.et(2026, 11, 9, 16, 0), "1min", 2);
        Check.eq(2, t.urls.size(), "never more than maxPages requests");
    }

    @Test
    public void serverDetailIsTrimmedAndHtmlIsNeverEchoed() {
        Check.eq(null, ZeroGexApi.serverDetail("<html>Bad Gateway</html>"), "html");
        Check.eq(null, ZeroGexApi.serverDetail("{\"detail\":[{\"loc\":[\"q\"]}]}"), "validation list");
        Check.eq("SPX 2026-10-10 has expired; pick a later date or 0DTE",
                ZeroGexApi.serverDetail("{\"detail\":\"SPX 2026-10-10 has expired; pick a later date or 0DTE\"}"), "sentence");
        Check.eq(-1L, ZeroGexApi.parseRetryAfter("Wed, 21 Oct 2015 07:28:00 GMT"), "date form ignored");
    }

    @Test
    public void malformedSymbolsNeverReachTheNetwork() {
        FakeTransport t = new FakeTransport(u -> FakeTransport.ok("{}"));
        ApiError e = expectError(() -> client(t, "k").levels("ES/../../admin", 1, null));
        Check.eq(ApiError.Kind.BAD_REQUEST, e.kind, "kind");
        Check.eq(0, t.urls.size(), "nothing sent");
    }

    interface Call {
        void run() throws ApiError;
    }

    static ApiError expectError(Call call) {
        try {
            call.run();
        } catch (ApiError e) {
            return e;
        }
        throw new AssertionError("expected an ApiError");
    }
}
