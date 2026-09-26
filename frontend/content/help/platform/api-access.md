# API Access & Keys (Pro)

*How to read the API docs, what your Pro tier unlocks, and the basic auth + rate-limit model.*

---

## What the ZeroGEX API gives you

Everything the web platform shows you is computed from the same backend that powers the API. Pro subscribers get programmatic access to:

- GEX summaries and per-strike breakdowns (including the consolidated dealer-levels + gamma-profile endpoint)
- Flow data (premium, volume, smart-money buckets)
- Max pain and intraday technicals (VWAP, opening range, volume, momentum)
- Trading signals (scores and trigger states)
- Historical GEX and signal history

## The docs

Full reference lives at **[api.zerogex.io/docs](https://api.zerogex.io/docs)**. The docs are OpenAPI 3.1 compliant and available in two views:

- **Swagger UI** - interactive; click **Authorize**, paste your key, and try requests from the browser
- **ReDoc** - read-only; faster for scanning the full surface

Sending requests - from the docs or anywhere else - takes a Pro key. In the app, the **API Specs** link sends Public and Basic accounts to the Pricing page instead.

## Authentication

Authentication uses **bearer tokens**. Generate your key yourself from your account - there's nothing to wait for:

1. Sign in and go to **Account → API Access** (`/account#api-access`).
2. Click **Generate API Key** and copy the key from the one-time reveal - it's shown once, for a few minutes, and can't be retrieved again. Store it in a password manager or secret store.
3. Send it as `Authorization: Bearer <key>` on every request.

Personal API keys are a Pro feature; Basic and Public accounts are routed to Pricing. Generating a new key immediately revokes your previous one (you hold at most one active key at a time), so rotating is just a matter of regenerating. Need help or a key revoked? Email [support@zerogex.io](mailto:support@zerogex.io).

## Rate limits

The API rate-limits per key, on a per-minute window set well above what production dashboards and bots need when they respect normal request hygiene. Over-limit requests return `429 Too Many Requests` with a `Retry-After` header.

## Response format

All endpoints return JSON, in two versions:

- **v1** (`/api/...` and `/api/v1/levels/...`) - the payload itself is the response body.
- **v2** (`/api/v2/...`) - the same payload under `data`, plus a `freshness` block: when the underlying data was observed, the market session, when to treat the response as stale, and a rolled-up `freshness_status` (`fresh`, `aging`, `stale`, `session_closed`, ...). Recommended for new integrations - replace the leading `/api` (or `/api/v1`) with `/api/v2` and read the payload from `data`.

Errors return the matching HTTP status with a `{"detail": ...}` body, on both versions.

Numeric fields are typed precisely - gamma values are signed dollars, per-signal scores (`clamped_score`) are floats in [-1, +1], timestamps are ISO 8601 UTC.

## Common patterns

### Polling vs streaming

For most use cases, polling on a sane cadence (every few seconds for live metrics, every minute for historical) is enough. Streaming is not currently exposed in the public API; the web platform uses an internal channel.

### Caching

Responses are cached server-side for about five seconds, and the analytics behind most endpoints recompute about once a minute, so a tighter poll mostly returns the same body. The signal endpoints are stamped with the most recent score timestamp so you can skip identical responses.

### Backfill

The derived history endpoints - GEX (`/api/gex/historical`), max pain, and signal history - support multi-day windows. Options data is the exception: per-contract quotes are served as the latest quote or a single intraday session (`/api/option/contract`), **not** a multi-day historical series - and per-contract quotes aren't part of the standard tier anyway (see *What's gated*). If you need a longer options-quote history, contact support with the specifics.

## What's gated

- API access requires a **Pro** account. Basic and Public accounts cannot generate keys.
- Raw upstream market data - per-contract option quotes (both the latest quote and intraday contract history) - isn't part of the standard API tier. The API serves the derived analytics (GEX, flow, max pain, technicals, signals) and their history. Need raw options data for a specific use case? Email support and we'll talk through the options.

## Best practices

- You hold one active key, so every environment (dev, prod) shares it. Rotate it on a schedule by regenerating - the old key stops working immediately, so update everywhere it's used.
- Don't put a key in client-side code. The platform is built for server-side consumption.
- Set a sensible `User-Agent` - it helps us help you when a request goes wrong.

## Charting integrations

If all you want is our levels on your own chart, you may not need to write anything. All four are on the [Integrations](/integrations) page:

- **NinjaTrader 8** - a NinjaScript indicator included with Pro that polls `GET /api/v1/levels/{symbol}` with your Pro key and draws the Gamma Flip, Call Wall, Put Wall, Max Pain, and Pin Strike. Signed in to Pro, download it from any free gamma levels page (e.g. [/spx-gamma-levels](/spx-gamma-levels)), import it in NinjaTrader (**File → Utilities → Import NinjaScript…**), and paste in your key. On an ES or NQ chart set the symbol to `ES` / `NQ` and the levels arrive already on the futures price axis - there is no basis offset to apply.
- **Sierra Chart** - an ACSIL study included with Pro that polls the same endpoint with your key and draws the same five levels. Signed in to Pro, download it from [/sierra-chart-indicator](/sierra-chart-indicator) and build it with Sierra Chart's own compiler (**Analysis → Build Custom Studies DLL**).
- **TradingView** - a free Pine script. Manual entry only: Pine Script can't make HTTP calls, so you type today's numbers in yourself.
- **thinkorswim** - a free thinkScript study. Manual entry only: thinkScript is sandboxed the same way Pine Script is, so you re-copy the study each day - it comes with that day's numbers already filled in.

If your platform can't reach the network - or you'd rather ask for the levels than read them - connect an AI assistant to our free [MCP server](/help/platform/mcp-server) (delayed levels, no key), or see [Building an MCP Server on the ZeroGEX API](/help/platform/mcp-integration), which covers wiring the API into one.

## See also

- [Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access)
- [Data Coverage & Refresh](/help/platform/data-coverage)
- [The ZeroGEX MCP Server (free, no key)](/help/platform/mcp-server)
- [Building an MCP Server on the ZeroGEX API](/help/platform/mcp-integration)
- [API Docs (external)](https://api.zerogex.io/docs)
