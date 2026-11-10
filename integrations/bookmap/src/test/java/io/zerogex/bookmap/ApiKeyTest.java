package io.zerogex.bookmap;

import io.zerogex.bookmap.core.FakeApi;
import io.zerogex.bookmap.core.MarketClock;
import io.zerogex.bookmap.harness.FakeBookmap;
import io.zerogex.bookmap.harness.LocalApiServer;
import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import velox.api.layer1.data.InstrumentInfo;
import velox.api.layer1.simplified.InitialState;

/**
 * Saving the key from the settings panel: one key for every chart, pasted
 * however the trader happened to copy it, and never anything that is not one.
 * Runs against the scratch preferences store build.sh points the tests at.
 */
public class ApiKeyTest {

    private static final String KEY = "Zx9_qM4tLwV2pR8sK1nB7cY3hD6fG0jA5eU-iO2lT8w";

    private static ZeroGexLevels start(FakeBookmap bookmap, String alias, String symbol) {
        ZeroGexLevels addon = new ZeroGexLevels();
        addon.initialize(alias, new InstrumentInfo(symbol, "CME", "FUT", 0.25, 50, symbol, true), bookmap.api,
                new InitialState());
        return addon;
    }

    @Test
    public void oneKeyPastedInOneChartServesEveryChart() throws Exception {
        FakeApi truth = new FakeApi();
        try (LocalApiServer server = new LocalApiServer(truth::handle)) {
            Settings s = new Settings();
            s.apiBaseUrl = server.baseUrl();
            ZeroGexLevels es = start(new FakeBookmap(s.copy()), "ESZ6.CME@RITHMIC", "ESZ6");
            ZeroGexLevels nq = start(new FakeBookmap(s.copy()), "NQZ6.CME@RITHMIC", "NQZ6");
            try {
                Check.contains(es.saveApiKey(""), "removed", "start from no key");
                Check.isFalse(nq.hasApiKey(), "no key anywhere");

                Check.eq("Saved for every Bookmap chart on this computer", es.saveApiKey("  Bearer " + KEY + "\n"),
                        "a key copied from the docs' example header is accepted");
                Check.isTrue(nq.hasApiKey(), "the other chart has it too, without pasting");
                Check.eq("", es.settings().apiKey, "and it is not duplicated into the chart's own settings");
                AddonEndToEndTest.waitFor("the other chart to use it",
                        () -> server.authHeaders.contains("Bearer " + KEY));

                Check.contains(es.saveApiKey("paste my key here please"), "doesn't look like a ZeroGEX API key",
                        "a sentence is refused rather than sent as a credential");
                Check.isTrue(nq.hasApiKey(), "and the good key stays in place");
            } finally {
                es.stop();
                nq.stop();
                KeyStore.save("");
            }
        }
    }

    @Test
    public void theKeyNeverAppearsInTheStatusOrDiagnostics() throws Exception {
        FakeApi truth = new FakeApi();
        try (LocalApiServer server = new LocalApiServer(truth::handle)) {
            Settings s = new Settings();
            s.apiBaseUrl = server.baseUrl();
            ZeroGexLevels es = start(new FakeBookmap(s), "ESZ6.CME@RITHMIC", "ESZ6");
            try {
                es.saveApiKey(KEY);
                es.onTimestamp(MarketClock.nowNanos());
                AddonEndToEndTest.waitFor("a request", () -> !server.requests.isEmpty());
                Check.notContains(es.statusLine(), KEY, "status line");
                Check.notContains(es.diagnostics(), KEY, "diagnostics");
                Check.contains(es.diagnostics(), "API key: set (" + KEY.length() + " chars)", "only its length");
            } finally {
                es.stop();
                KeyStore.save("");
            }
        }
    }
}
