# API Access & Keys (Pro)

*How to read the API docs, what your Pro tier unlocks, and the basic auth + rate-limit model.*

---

## What the ZeroGEX API gives you

Everything the web platform shows you is computed from the same backend that powers the API. Pro subscribers get programmatic access to:

- GEX summaries and per-strike breakdowns
- Real-time quotes
- Flow data (premium, volume, smart-money buckets)
- Trading signals (scores and trigger states)
- Historical bars and signal history

## The docs

Full reference lives at **[api.zerogex.io/docs](https://api.zerogex.io/docs)**. The docs are OpenAPI 3.0 compliant and available in two views:

- **Swagger UI** — interactive; try requests from the browser
- **ReDoc** — read-only; faster for scanning the full surface

The docs require a Pro account. Public users are routed to the Pricing page on click.

## Authentication

Authentication uses **bearer tokens** issued from your Account page. The flow:

1. Open [Account](/account).
2. Open the API panel (Pro accounts only).
3. Generate a new API key. Copy it immediately — you won't see it again.
4. Include it as `Authorization: Bearer <key>` on every request.

Rotate keys at any time. Revoking a key takes effect within seconds.

## Rate limits

The API enforces rate limits per key. Limits scale with tier:

- **Pro** — generous per-minute and per-day caps, sufficient for production dashboards and bots that respect normal request hygiene.

Over-limit requests return `429 Too Many Requests` with a `Retry-After` header.

## Response format

All endpoints return JSON. Standard fields:

- `data` — the payload
- `meta` — pagination, timestamps, request ID
- `error` — on error responses; omitted on success

Numeric fields are typed precisely — gamma values are signed dollars, scores are floats in [-1, +1], timestamps are ISO 8601 UTC.

## Common patterns

### Polling vs streaming

For most use cases, polling on a sane cadence (every few seconds for live metrics, every minute for historical) is enough. Streaming is not currently exposed in the public API; the web platform uses an internal channel.

### Caching

Most endpoints set sensible HTTP cache headers — respect them. The signal endpoints are stamped with the most recent score timestamp so you can skip identical responses.

### Backfill

Historical endpoints support multi-day windows. For deep backfills, paginate using the `meta.cursor` field.

## What's gated

- API access requires a **Pro** account. Basic and Public accounts cannot generate keys.
- Some endpoints have additional Pro-only flags (e.g., raw chain dumps) — the docs label them.

## Best practices

- One key per environment (dev, prod). Rotate them on a schedule.
- Don't put a key in client-side code. The platform is built for server-side consumption.
- Set a sensible `User-Agent` — it helps us help you when a request goes wrong.

## See also

- [Tiers, Access & What Unlocks Where](/help/platform/tiers-and-access)
- [Data Coverage & Refresh](/help/platform/data-coverage)
- [API Docs (external)](https://api.zerogex.io/docs)
