package io.zerogex.bookmap.core;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A small, strict JSON reader for the two ZeroGEX payloads this add-on reads.
 *
 * <p>Why not a library: the add-on runs inside Bookmap's JVM, next to whatever
 * versions of Gson or Jackson Bookmap and other add-ons happen to ship. A
 * dependency here is a classpath conflict waiting for someone else's update.
 * The NinjaTrader and Sierra Chart studies made the same call for the same
 * reason; this one is a real parser rather than a key scanner because Java
 * makes that cheap, and a real parser cannot be fooled by a key that prefixes
 * another ({@code pin_strike} vs {@code pin_strike_reason}).
 *
 * <p>Numbers go through {@link Double#parseDouble}, which is locale-independent
 * in Java: a European Windows install with a comma decimal separator still
 * reads {@code 5950.25} as 5950.25. (Sierra Chart's C++ had to hand-roll this.)
 *
 * <p>Objects become {@link LinkedHashMap}, arrays {@link ArrayList}, numbers
 * {@link Double}, plus {@link String}, {@link Boolean} and {@code null}.
 */
public final class Json {

    /** Deep enough for every real payload; shallow enough that a hostile one cannot blow the stack. */
    private static final int MAX_DEPTH = 64;

    private final String text;
    private int pos;

    private Json(String text) {
        this.text = text;
    }

    /** Parses a complete JSON document. Throws {@link IllegalArgumentException} on anything malformed. */
    public static Object parse(String text) {
        if (text == null) {
            throw new IllegalArgumentException("no JSON body");
        }
        Json p = new Json(text);
        p.skipWhitespace();
        Object value = p.readValue(0);
        p.skipWhitespace();
        if (p.pos != text.length()) {
            throw p.error("unexpected trailing content");
        }
        return value;
    }

    // ------------------------------------------------------------------
    // Typed accessors. Every one of them is null-tolerant, because the API
    // contract says a level may be null and a missing level must be hidden,
    // never drawn at zero.
    // ------------------------------------------------------------------

    /** The value as a JSON object, or an empty map when it is anything else. */
    @SuppressWarnings("unchecked")
    public static Map<String, Object> object(Object value) {
        return value instanceof Map ? (Map<String, Object>) value : Collections.<String, Object>emptyMap();
    }

    /** The value as a JSON array, or an empty list when it is anything else. */
    @SuppressWarnings("unchecked")
    public static List<Object> array(Object value) {
        return value instanceof List ? (List<Object>) value : Collections.emptyList();
    }

    /**
     * A finite number, or NaN when the field is absent, null, or not numeric.
     *
     * <p>Accepts numeric strings as well as numbers: the history endpoint
     * declares its prices as {@code Decimal}, which the API serializes as JSON
     * strings ({@code "7727.0"}), while the levels endpoint declares
     * {@code float} and sends numbers. Treating both the same keeps one
     * contract change on the server from blanking every chart.
     */
    public static double number(Map<String, Object> obj, String key) {
        return toNumber(obj.get(key));
    }

    public static double toNumber(Object value) {
        if (value instanceof Double) {
            double d = (Double) value;
            return Double.isInfinite(d) ? Double.NaN : d;
        }
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        if (value instanceof String) {
            String s = ((String) value).trim();
            if (s.isEmpty()) {
                return Double.NaN;
            }
            try {
                double d = Double.parseDouble(s);
                return Double.isInfinite(d) ? Double.NaN : d;
            } catch (NumberFormatException e) {
                return Double.NaN;
            }
        }
        return Double.NaN;
    }

    /** A string field, or null when absent, null, or not a string. */
    public static String string(Map<String, Object> obj, String key) {
        Object value = obj.get(key);
        return value instanceof String ? (String) value : null;
    }

    // ------------------------------------------------------------------
    // Grammar
    // ------------------------------------------------------------------

    private Object readValue(int depth) {
        if (depth > MAX_DEPTH) {
            throw error("nesting too deep");
        }
        if (pos >= text.length()) {
            throw error("unexpected end of input");
        }
        char c = text.charAt(pos);
        switch (c) {
            case '{':
                return readObject(depth);
            case '[':
                return readArray(depth);
            case '"':
                return readString();
            case 't':
                expectWord("true");
                return Boolean.TRUE;
            case 'f':
                expectWord("false");
                return Boolean.FALSE;
            case 'n':
                expectWord("null");
                return null;
            default:
                if (c == '-' || (c >= '0' && c <= '9')) {
                    return readNumber();
                }
                throw error("unexpected character '" + c + "'");
        }
    }

    private Map<String, Object> readObject(int depth) {
        Map<String, Object> out = new LinkedHashMap<String, Object>();
        pos++; // '{'
        skipWhitespace();
        if (peek() == '}') {
            pos++;
            return out;
        }
        while (true) {
            skipWhitespace();
            if (peek() != '"') {
                throw error("expected a quoted key");
            }
            String key = readString();
            skipWhitespace();
            expect(':');
            skipWhitespace();
            out.put(key, readValue(depth + 1));
            skipWhitespace();
            char c = next();
            if (c == '}') {
                return out;
            }
            if (c != ',') {
                throw error("expected ',' or '}'");
            }
        }
    }

    private List<Object> readArray(int depth) {
        List<Object> out = new ArrayList<Object>();
        pos++; // '['
        skipWhitespace();
        if (peek() == ']') {
            pos++;
            return out;
        }
        while (true) {
            skipWhitespace();
            out.add(readValue(depth + 1));
            skipWhitespace();
            char c = next();
            if (c == ']') {
                return out;
            }
            if (c != ',') {
                throw error("expected ',' or ']'");
            }
        }
    }

    private String readString() {
        pos++; // opening quote
        StringBuilder sb = null;
        int start = pos;
        while (true) {
            if (pos >= text.length()) {
                throw error("unterminated string");
            }
            char c = text.charAt(pos);
            if (c == '"') {
                String chunk = text.substring(start, pos);
                pos++;
                return sb == null ? chunk : sb.append(chunk).toString();
            }
            if (c == '\\') {
                if (sb == null) {
                    sb = new StringBuilder();
                }
                sb.append(text, start, pos);
                pos++;
                sb.append(readEscape());
                start = pos;
                continue;
            }
            if (c < 0x20) {
                throw error("control character in string");
            }
            pos++;
        }
    }

    private char readEscape() {
        char c = next();
        switch (c) {
            case '"':
                return '"';
            case '\\':
                return '\\';
            case '/':
                return '/';
            case 'b':
                return '\b';
            case 'f':
                return '\f';
            case 'n':
                return '\n';
            case 'r':
                return '\r';
            case 't':
                return '\t';
            case 'u': {
                if (pos + 4 > text.length()) {
                    throw error("truncated unicode escape");
                }
                int code = 0;
                for (int i = 0; i < 4; i++) {
                    int digit = Character.digit(text.charAt(pos++), 16);
                    if (digit < 0) {
                        throw error("bad unicode escape");
                    }
                    code = (code << 4) | digit;
                }
                return (char) code;
            }
            default:
                throw error("bad escape '\\" + c + "'");
        }
    }

    private Double readNumber() {
        int start = pos;
        if (peek() == '-') {
            pos++;
        }
        if (peek() == '0') {
            pos++;
        } else if (isDigit(peek())) {
            while (isDigit(peek())) {
                pos++;
            }
        } else {
            throw error("bad number");
        }
        if (peek() == '.') {
            pos++;
            if (!isDigit(peek())) {
                throw error("bad fraction");
            }
            while (isDigit(peek())) {
                pos++;
            }
        }
        if (peek() == 'e' || peek() == 'E') {
            pos++;
            if (peek() == '+' || peek() == '-') {
                pos++;
            }
            if (!isDigit(peek())) {
                throw error("bad exponent");
            }
            while (isDigit(peek())) {
                pos++;
            }
        }
        return Double.valueOf(text.substring(start, pos));
    }

    private void expectWord(String word) {
        if (!text.startsWith(word, pos)) {
            throw error("expected " + word);
        }
        pos += word.length();
    }

    private void expect(char c) {
        if (next() != c) {
            throw error("expected '" + c + "'");
        }
    }

    private char peek() {
        return pos < text.length() ? text.charAt(pos) : '\0';
    }

    private char next() {
        if (pos >= text.length()) {
            throw error("unexpected end of input");
        }
        return text.charAt(pos++);
    }

    private void skipWhitespace() {
        while (pos < text.length()) {
            char c = text.charAt(pos);
            if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
                pos++;
            } else {
                return;
            }
        }
    }

    private static boolean isDigit(char c) {
        return c >= '0' && c <= '9';
    }

    private IllegalArgumentException error(String message) {
        return new IllegalArgumentException("JSON " + message + " at position " + pos);
    }
}
