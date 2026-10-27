// The live price and candle polls carry a `fresh` token so nginx's 5 s cache
// never answers them (core/liveFreshness.ts). Measured 2026-10-27 against the
// production cache settings: through the cache a once-a-second poll saw a new
// value only every 5 to 6 s; and marking answers no-store by PATH instead froze
// a polling client on its last stored copy for good.
import test from "node:test";
import assert from "node:assert/strict";

import { FRESH_PARAM, mustNotStore, withFresh } from "../core/liveFreshness.ts";

test("the token is appended to a URL that already has a query", () => {
  const url = withFresh("/api/market/quote?symbol=SPY");
  assert.match(url, /^\/api\/market\/quote\?symbol=SPY&fresh=[a-z0-9]+$/);
});

test("and starts the query on a URL that has none", () => {
  assert.match(withFresh("/api/market/quote"), /^\/api\/market\/quote\?fresh=[a-z0-9]+$/);
});

test("one token per page load, so a poll's URL is the same every second", () => {
  const a = new URL(withFresh("/api/market/historical?symbol=SPY"), "https://x").searchParams.get(FRESH_PARAM);
  const b = new URL(withFresh("/api/market/quote?symbol=QQQ"), "https://x").searchParams.get(FRESH_PARAM);
  assert.ok(a);
  assert.equal(a, b);
});

test("a marked request is never stored", () => {
  const params = new URL(withFresh("/api/market/quote?symbol=SPY"), "https://x").searchParams;
  assert.equal(mustNotStore(params), true);
});

test("an unmarked request keeps today's caching, so open tabs on the old code never flip", () => {
  assert.equal(mustNotStore(new URLSearchParams("symbol=SPY")), false);
  assert.equal(mustNotStore(new URLSearchParams("symbol=SPY&fresh=")), false);
});
