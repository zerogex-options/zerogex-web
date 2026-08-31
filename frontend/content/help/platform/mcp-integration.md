# Building an MCP Server on the ZeroGEX API

*What the consolidated levels endpoint returns, tool definitions to start from, and how to stop a language model quoting stale levels as if they were live.*

---

## Who this is for

You want to ask an AI assistant — Claude, or anything else that speaks the Model Context Protocol — questions like *"where is QQQ's gamma flip"* or *"is SPX in positive gamma right now"*, and get an answer computed from live dealer positioning rather than from the model's training data.

MCP is the bridge. You run a small server that exposes a few tools; the assistant calls them when a question needs live data. This page covers the ZeroGEX-specific half: which endpoint to build on, how to shape the tools, and the one failure mode that matters when the consumer is a language model rather than a chart.

It assumes you have a Pro key. If you don't, start with [API Access & Keys](/help/platform/api-access).

This is also the answer for platforms whose scripting language can't reach the network. Pine Script (TradingView) and thinkScript (thinkorswim) are both sandboxed with no outbound HTTP, so no study running inside them can pull the levels — but an assistant with an MCP server can, and you can read the answer alongside your chart.

## Start with the consolidated levels endpoint

```
GET https://api.zerogex.io/api/v1/levels/{symbol}?strikes=40
Authorization: Bearer <your key>
Accept: application/json
```

One call returns every dealer-positioning level plus the per-strike gamma profile. It is the only endpoint most MCP servers need, and it is the same endpoint our NinjaTrader indicator polls.

`strikes` is optional and bounded **1–200** — outside that range the API returns `422`, so clamp the value in your client rather than trusting a number the model produced. It controls how many strikes come back in `profile`, ranked nearest spot. Everything else in the response is fixed cost, so ask for a small profile unless you actually need the curve.

### What comes back

| Field | Type | Notes |
| --- | --- | --- |
| `symbol` | string | Echoes the underlying you asked for. |
| `spot` | number | Underlying price the levels were computed against. |
| `gamma_flip` | number \| null | Where modelled dealer gamma changes sign. |
| `call_wall` | number \| null | Heaviest call gamma — the level that tends to cap. |
| `put_wall` | number \| null | Heaviest put gamma — the level that tends to support. |
| `max_pain` | number \| null | Expiration magnet across the chain. |
| `pin_strike` | number \| null | The reachable same-day strike with the strongest modelled restoring gamma into the close. |
| `pin_strike_reason` | string \| null | A `REASON_*` code explaining a null pin. |
| `net_gex_at_spot` | number \| null | Signed dealer gamma at spot. The sign is the regime. |
| `as_of` | string | ISO 8601 UTC — when the snapshot was computed, not when you asked. |
| `age_seconds` | number | Seconds since `as_of`. See [Staleness](#staleness-is-the-whole-game) below. |
| `profile[]` | array | Per-strike objects carrying `strike` and `net_gex`, nearest spot first. |

Field names on this endpoint are its own: it returns `spot`, where `/api/gex/summary` returns `spot_price`. The two are separate contracts, not one renamed. The [OpenAPI reference](https://api.zerogex.io/docs) is authoritative for both.

### A null level is a level's absence, not zero

Any level can come back `null`, and that is a real answer: the book does not support one right now. Do not coalesce to `0` anywhere in your pipeline. A gamma flip rendered as zero is a price, and a model handed it will reason about it as one.

`pin_strike` is the field most likely to be null, and deliberately so — it returns nothing when there is no same-day expiry, when that expiry has already settled, when no reachable strike has net-positive local gamma, or when there isn't enough data to model. `pin_strike_reason` tells you which. Surface it: it is the difference between *"no pin today"* and *"something is broken"*.

### Supported underlyings

`SPY`, `QQQ`, `SPX`, `NDX`, `ES`, `NQ`. Anything else is a `404`.

ES and NQ have no separate options book. Gamma is computed from the SPX and NDX chains, and the price-space levels are carried onto the futures axis server-side using a measured index/future ratio. They arrive already on the right axis — there is no basis offset to apply, and applying one will put every level in the wrong place. Exposure values are deliberately *not* rescaled, so relative gamma magnitudes stay comparable.

## Tool definitions to start from

Shape tools around how a trader asks, not around your endpoint list. A short list of task-shaped tools produces better tool selection than one wrapper per route.

Two schema decisions do most of the work. **Enumerate the symbols** — the closed set belongs in the schema, where it prevents a bad call rather than explaining the `404` afterwards. And **spend the description on when *not* to reach for the tool**; it is prompt real estate, and a description that only restates the name wastes it.

### get_gamma_levels

```json
{
  "name": "get_gamma_levels",
  "description": "Current dealer-positioning levels for one underlying: gamma flip, call wall, put wall, max pain, pin strike, and net dealer gamma at spot, plus an optional per-strike gamma profile. Levels are modelled from the live options chain and re-computed roughly once a minute. Use for 'where are the levels', 'what's the gamma flip', 'is QQQ in positive gamma'. Not a price feed and not a forecast: it describes dealer positioning right now and says nothing about direction. A null level means the book does not support that level at the moment, not zero.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "symbol": {
        "type": "string",
        "enum": ["SPY", "QQQ", "SPX", "NDX", "ES", "NQ"],
        "description": "ES and NQ return levels already projected onto the futures price axis."
      },
      "strikes": {
        "type": "integer",
        "minimum": 1,
        "maximum": 200,
        "description": "How many strikes of gamma profile to include, nearest spot first. Omit unless the profile curve is actually needed."
      }
    },
    "required": ["symbol"],
    "additionalProperties": false
  }
}
```

### get_trade_bias

Backed by `GET /api/signals/trade-bias?underlying={symbol}&tenor={swing|intraday}`.

```json
{
  "name": "get_trade_bias",
  "description": "ZeroGEX's directional bias for one underlying at one horizon, as a signed score with a confidence and the regime behind it. The horizon changes the answer, and the two are allowed to disagree: 'swing' is the multi-day read led by the gamma and volatility regime; 'intraday' is the same-day (0DTE) read led by flow, tape and momentum. Always pass the horizon the user is actually trading, and say which one you used. Returns no data when the engine has not computed that pairing yet — a normal state outside market hours, not an error.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "symbol": {
        "type": "string",
        "enum": ["SPY", "QQQ", "SPX", "NDX", "ES", "NQ"]
      },
      "horizon": {
        "type": "string",
        "enum": ["swing", "intraday"],
        "description": "'intraday' is the same-day 0DTE read; 'swing' is multi-day."
      }
    },
    "required": ["symbol", "horizon"],
    "additionalProperties": false
  }
}
```

There is deliberately no default horizon. Making the model choose beats defaulting to `swing` and answering a 0DTE question with the multi-day read.

### get_session_vwap

Backed by `GET /api/technicals/vwap-deviation?symbol={symbol}&timeframe=1min&window_units=1`.

```json
{
  "name": "get_session_vwap",
  "description": "Session volume-weighted average price for one underlying, with the current deviation from it. Pair with get_gamma_levels when the question is about where price sits, not just where the levels are. On ES and NQ the VWAP arrives projected onto the futures axis like every other price field.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "symbol": {
        "type": "string",
        "enum": ["SPY", "QQQ", "SPX", "NDX", "ES", "NQ"]
      }
    },
    "required": ["symbol"],
    "additionalProperties": false
  }
}
```

`window_units=1` asks for a single bucket. It keeps the payload small and means a flat field extractor can't accidentally pick up an older bar.

## Staleness is the whole game

Hand a language model the number `601.40` and it will tell your user the gamma flip is at 601.40. It has no way to know the snapshot is nine minutes old, that price moved through it, or that the feed stalled — and it will sound equally confident either way. A wrong level stated confidently during a session is the failure that costs money, and it is entirely preventable at the tool boundary.

Three rules:

1. **Put the age in the text, not just the structure.** Structured content is for your code; the text block is what the model reads. Freshness that exists only in a JSON field the model may or may not attend to will get dropped from the answer.
2. **Label, don't refuse.** Stale data with a clear label is useful — a trader can decide what to do with a two-minute-old level. An error is not useful. Reserve hard failure for when you genuinely have nothing.
3. **Judge age against the session, not a fixed number.** Ninety seconds at 2pm ET means the feed is behind. Ninety seconds at 3am means the market is closed and the snapshot is as fresh as it will ever be. Same integer, opposite meanings.

```ts
function freshnessLine(asOf: string, ageSeconds: number): string {
  const open = isRegularMarketHours(new Date());
  const stamp = `as of ${asOf} (${ageSeconds}s ago)`;

  // Closed: any age is expected. Say so plainly, so the model doesn't hedge
  // about data that is fine.
  if (!open) {
    return `Market is closed. Last computed snapshot, ${stamp}.`;
  }

  // Open: the analytics cycle is ~60s, so ~120s is a missed cycle and
  // anything past ~300s should not be quoted as current.
  if (ageSeconds > 300) {
    return `STALE — ${stamp}. The market has likely moved through these ` +
           `levels. Say they are stale; do not present them as current.`;
  }
  if (ageSeconds > 120) {
    return `Slightly behind — ${stamp}. Mention the age when quoting these.`;
  }
  return `Live, ${stamp}.`;
}

// Lead with it. First line of the text content, every call.
return {
  content: [{
    type: "text",
    text: [freshnessLine(data.as_of, data.age_seconds), "", formatLevels(data)].join("\n"),
  }],
  structuredContent: data,
};
```

Note that the stale branch doesn't only report an age — it tells the model how to behave. Tool output is one of the few places where instructions are followed reliably, because they arrive attached to the thing the model just asked for. A bare `age_seconds: 412` leaves the judgement call to something that has no idea what your cycle time is.

## Failures worth handling by name

| Status | What it means | What your tool should return |
| --- | --- | --- |
| `401` / `403` | Almost always: the key was regenerated somewhere else. You hold **one active key per account**, so minting a new one in the browser silently retires the one in your server. | `isError: true` and say exactly that. Don't retry — retrying a retired key just burns rate limit. |
| `429` | Polling too fast. There's a `Retry-After` header. | `isError: true`, quote the retry delay. Back off in the client; never let the model drive a retry loop. |
| `422` | `strikes` outside 1–200. | Clamp in the client so it never happens. |
| `404` on trade-bias | The engine has no rows for that (symbol, horizon) yet. Normal outside market hours. | **Not** an error. Return plain text, so the model says "no intraday bias computed yet" rather than "the tool failed". |

## Polling, caching and limits

There is no streaming channel on the public API. Levels recompute on roughly a 60-second analytics cycle, so polling faster buys nothing but rate limit. Most endpoints set real cache headers — respect them. For a long-running server, cache per symbol and serve tool calls from that cache rather than hitting the API once per question.

Your Pro key's tier covers GEX, flow, max pain, technicals and signals — every derived analytic. It does **not** include raw per-contract option quotes or underlying price bars. If your integration needs those, email [support@zerogex.io](mailto:support@zerogex.io) with the use case.

## Publishing what you build

The code is yours. Publish it, open-source it, put it on a registry — our own NinjaTrader indicator and TradingView script are both public on exactly that model: **the code is free, the data is gated by the key.**

The one thing that isn't allowed is running your integration as a hosted service on *your* key for other people. That's reselling paid access, and it's the line in our [Terms](/terms). Anyone using what you build should bring their own key.

## See also

- [API Access & Keys (Pro)](/help/platform/api-access)
- [Data Coverage & Refresh](/help/platform/data-coverage)
- [API Docs (external)](https://api.zerogex.io/docs)
