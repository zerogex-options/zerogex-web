package io.zerogex.bookmap.core;

import io.zerogex.bookmap.testkit.Check;
import io.zerogex.bookmap.testkit.Test;
import java.util.List;
import java.util.Locale;
import java.util.Map;

public class JsonTest {

    @Test
    public void parsesEveryJsonType() {
        Map<String, Object> o = Json.object(Json.parse(
                " {\"a\":1,\"b\":-2.5e3,\"c\":\"x\\\"y\\\\z\\u00e9\\n\",\"d\":true,\"e\":false,\"f\":null,"
                        + "\"g\":[1,[2],{}],\"h\":{\"i\":0.25}} "));
        Check.near(1, Json.number(o, "a"), 0, "integer");
        Check.near(-2500, Json.number(o, "b"), 0, "exponent");
        Check.eq("x\"y\\z\u00e9\n", Json.string(o, "c"), "escapes");
        Check.eq(Boolean.TRUE, o.get("d"), "true");
        Check.eq(Boolean.FALSE, o.get("e"), "false");
        Check.isTrue(o.containsKey("f") && o.get("f") == null, "null kept as a present key");
        List<Object> g = Json.array(o.get("g"));
        Check.eq(3, g.size(), "array length");
        Check.near(0.25, Json.number(Json.object(o.get("h")), "i"), 0, "nested");
    }

    @Test
    public void numbersIgnoreTheDesktopLocale() {
        // A European Windows install uses a comma decimal separator. Java's
        // parser must still read 5950.25 as 5950.25, never 595025 or 5950.
        Locale before = Locale.getDefault();
        try {
            Locale.setDefault(Locale.GERMANY);
            Check.near(5950.25, Json.number(Json.object(Json.parse("{\"p\":5950.25}")), "p"), 0, "number");
            Check.near(5950.25, Json.number(Json.object(Json.parse("{\"p\":\"5950.25\"}")), "p"), 0, "string");
        } finally {
            Locale.setDefault(before);
        }
    }

    @Test
    public void nullAbsentAndNonNumericReadAsNaN() {
        Map<String, Object> o = Json.object(Json.parse("{\"a\":null,\"b\":\"abc\",\"c\":true,\"d\":\"\"}"));
        Check.nan(Json.number(o, "a"), "null");
        Check.nan(Json.number(o, "b"), "non-numeric string");
        Check.nan(Json.number(o, "c"), "boolean");
        Check.nan(Json.number(o, "d"), "empty string");
        Check.nan(Json.number(o, "missing"), "absent");
    }

    @Test
    public void malformedInputIsRejected() {
        String[] bad = {"", "{", "{\"a\":}", "{\"a\":1,}", "[1,]", "{\"a\" 1}", "01", "1.", "-", "tru",
            "{\"a\":1} x", "\"unterminated", "{\"a\":\"\\q\"}", "{\"a\":\"\u0001\"}"};
        for (final String s : bad) {
            Check.throwsA(IllegalArgumentException.class, () -> Json.parse(s), "should reject: " + s);
        }
        Check.throwsA(IllegalArgumentException.class, () -> Json.parse(null), "null body");
    }

    @Test
    public void deepNestingIsRefusedRatherThanOverflowingTheStack() {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 5000; i++) {
            sb.append('[');
        }
        Check.throwsA(IllegalArgumentException.class, () -> Json.parse(sb.toString()), "deep nesting");
    }

    @Test
    public void anHtmlErrorPageIsNotJson() {
        Check.throwsA(IllegalArgumentException.class,
                () -> Json.parse("<html><body>502 Bad Gateway</body></html>"), "html");
    }
}
