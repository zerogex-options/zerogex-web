# Hedging Flow history — what exists, and what a dated permalink needs

*Companion to `docs/flow-series-endpoint.md`. That document specified the
endpoint that made the Flow Analysis page a dumb renderer; this one specifies
what would make the Hedging Flow page replayable.*

---

## 0. The short answer

**No — Hedging Flow is not stored historically today, and it cannot be read for
a past day through any endpoint the web app calls.** It is a live-session
surface and nothing else: `/hedging-flow` mounts, polls the current session
every 15 seconds, and has no notion of a date at all.

**Yes — it can be handled the way Replay and the Scorecard are**, and the
backend already contains the two pieces that make that cheap: a materialised
5-minute snapshot table (`flow_series_5min`) and a retention exemption for
exactly this shape of table. The work is a session-list endpoint, a `date`
parameter, and a dated route on the front end. None of it requires a new data
source.

---

## 1. What the page does today

`frontend/app/hedging-flow/page.tsx` is a client component. It reads three
hooks, and all three are hard-wired to "now":

| Hook | Endpoint | Date parameter? | Poll |
| --- | --- | --- | --- |
| `useHedgingFlow` | `GET /api/flow/hedging?symbol=&expirations=&smoothing=` | none | 15s |
| `useGammaRegimeSeries` | `GET /api/gex/regime-series?symbol=` | none | 30s |
| `useGammaWeather` | `GET /api/gex/weather?symbol=` | none | — |

Each response carries a `session` field naming the trading day it describes,
so the payload already knows what day it is — the caller just has no way to ask
for a different one. There is no `/hedging-flow/[symbol]/[date]` route, no
session list, no ISR page, and no OG image. The page is absent from
`next-sitemap.config.mjs`'s `DAILY_TOOL_PATHS` for the same reason: there is
nothing dated to index.

The 0DTE toggle is worth calling out because it constrains the design below. It
is not a mode — it is the expirations filter carrying `etTodayDateKey()`. On a
historical session it has to carry *that session's* date instead, or it
silently asks a question about the wrong day.

---

## 2. How Replay and the Scorecard do it

Both follow the same four-part shape, and it is worth naming the parts because
the proposal below is just this shape applied again.

1. **A session-list endpoint.** `GET /api/replay/sessions?symbol=&limit=` →
   `{ symbol, count, sessions: [{ date, bar_count, first_ts, last_ts }] }`.
   The landing page is a list of days that *have* data, not a date picker that
   can be pointed at an empty one.
2. **A dated read endpoint.** `GET /api/replay/range?symbol=&date=` returns the
   whole session in one response. The scorecard's equivalent returns one day's
   recap.
3. **A server-rendered dated route.** `app/replay/[symbol]/[date]/page.tsx` and
   `app/scorecard/[symbol]/[date]/page.tsx`, ISR-cached for an hour
   (`REVALIDATE_SECONDS = 3600`) because a closed session is immutable. Each
   ships an `opengraph-image.tsx` so a shared link previews as a branded card.
4. **An index that the sitemap lists.** `next-sitemap.config.mjs` lists
   `/replay` and `/scorecard`; the dated permalinks are discovered from them.

One rule, learned the hard way and pinned by `tests/datedPermalinks.test.ts`:
a dated page must not call `notFound()` on a null fetch. `serverApiGet` returns
null both for "this date has nothing" and "the API never answered", and a hard
404 served during a crawl costs the URL its place in the index. Use
`serverApiGetResult` and distinguish the two, as `/scorecard/[symbol]/[date]`
already does.

---

## 3. Why the recompute path is not the answer

The obvious implementation — accept a `date`, re-run the hedging-flow
computation over that day's trades — works for about a quarter and then
quietly stops.

`make db-prune` deletes rows older than `DATA_RETENTION_DAYS` (90) from
`DB_MAINTAIN_TABLES`, and `flow_by_contract` and `flow_contract_facts` are both
on that list. Those are the per-contract tables a from-scratch hedging-flow
computation reads. So a recompute endpoint would answer for the last 90 days
and return an empty session for day 91 — the worst failure mode available,
because it looks exactly like a quiet day.

The backend has already made this decision twice, in the same direction:

- `option_chains_archive` is deliberately excluded from `DB_MAINTAIN_TABLES`
  as "the durable, retention-exempt copy that backs the backtesting platform".
- `underlying_quotes` and `gex_summary` were removed from it on 2026-08-25 for
  the TradeWorkz screen, with the reasoning recorded in the Makefile: pruning
  them "capped every screen at a rolling ~90 days", and "both tables are tiny
  (~1 row/min/symbol ≈ a few hundred K rows a year)".

A 5-minute hedging-flow bar series is **smaller than either** — 78 bars per
symbol per session, roughly 20k rows per symbol per year. Storing it forever
costs approximately nothing.

---

## 4. The proposal

### 4.1 Persist what is already computed

`flow_series_5min` is the precedent to copy, not merely an analogy: it is a
snapshot table the Analytics Engine materialises once per cycle off the
per-contract facts, and `/api/flow/series` reads it instead of re-aggregating.
It is not in `DB_MAINTAIN_TABLES`.

Do the same for the three series behind this page — one table each, or one
table with a `series` discriminator:

```
hedging_flow_5min   (symbol, session_date, bar_start, expiration_scope,
                     call_flow_usd, put_flow_usd, net_flow_usd, net_flow_ma_usd,
                     cum_call_usd, cum_put_usd, cum_net_usd,
                     underlying_price, contract_count, classified_ratio,
                     is_synthetic)
gamma_regime_5min   (symbol, session_date, bar_start, spot,
                     anchored_lean, anchored_stability, anchored_net_shift,
                     anchored_gross_shift, rolling_lean, rolling_stability,
                     rolling_net_shift, rolling_gross_shift,
                     sigma_price, near_spot_stock, strike_count, rolling_bars)
gamma_weather_5min  (symbol, session_date, bar_start, state, pressure,
                     structure, gamma_trend, lean_side, cushion, persistence,
                     components JSONB)
```

`expiration_scope` is the one column that is not just a copy of the wire
format. The 0DTE toggle has to keep working on a past session, and re-deriving
it from raw trades is the thing this design is avoiding — so write two rows per
bar, `'all'` and `'0dte'`, and let the toggle pick a scope rather than compute
one. On a session that was not an expiry, the `'0dte'` rows are simply absent,
which is the same honest "no 0DTE today" the live page reports.

Do NOT add these tables to `DB_MAINTAIN_TABLES`. Add them to
`DB_VACUUM_EXTRA_TABLES` if they need vacuuming.

### 4.2 Endpoints

**`GET /api/flow/hedging/sessions`**

| Name | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `symbol` | string | yes | | `^[A-Z.]{1,10}$`, uppercased server-side |
| `limit` | integer | no | 60 | 1–250 |

```json
{
  "symbol": "SPY",
  "count": 2,
  "sessions": [
    { "date": "2026-09-16", "bar_count": 78, "had_0dte": true,
      "cum_net_usd": -412300000.0, "last_flip": "to_selling" },
    { "date": "2026-09-15", "bar_count": 78, "had_0dte": false,
      "cum_net_usd": 118400000.0, "last_flip": null }
  ]
}
```

Newest first. `bar_count` drives the Full / Partial / Thin chip the replay
landing page already renders; `cum_net_usd` and `last_flip` let the card say
something about the day rather than just naming it.

**`GET /api/flow/hedging`** — add one parameter, change nothing else.

| Name | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `date` | date | no | current session | `YYYY-MM-DD`. Absent = today, exactly as now. |

Same response envelope, with `session` already naming the day. A `date` in the
future, or one with no rows, returns `200` with `bars: []` — never `404`, for
the crawl reason in §2. A malformed `date` is `400`.

`expirations` keeps its current meaning. The frontend sends the session's own
date for the 0DTE view rather than today's, which is the fix noted in §1.

**`GET /api/gex/regime-series`** and **`GET /api/gex/weather`** take the same
`date` parameter, with the same defaults and the same empty-not-404 rule.
Without them the structure panel and the weather strip go blank on a historical
day and the page is half a page.

### 4.3 Front end

```
app/hedging-flow/page.tsx                    unchanged — live session
app/hedging-flow/sessions/page.tsx           session list (mirror app/replay/page.tsx)
app/hedging-flow/[symbol]/[date]/page.tsx    dated permalink, ISR 3600
app/hedging-flow/[symbol]/[date]/opengraph-image.tsx
```

- Thread an optional `date` through `useHedgingFlow`, `useGammaRegimeSeries`
  and `useGammaWeather`. When it is set, **stop polling** — `refreshInterval`
  must be 0 for a closed session, or the page re-fetches immutable rows forever.
- Lift the page body into a shared component that takes `{ symbol, date? }`, so
  the live route and the dated route cannot drift into two different pages.
- Use `serverApiGetResult`, and distinguish "no data" from "no answer"
  (`tests/datedPermalinks.test.ts` will check this).
- Add `/hedging-flow/sessions` to `DAILY_TOOL_PATHS` and to the additional-paths
  list in `next-sitemap.config.mjs`, next to `/replay` and `/scorecard`.
- Add a "Past sessions" link to the live page's header actions.

### 4.4 Backfill

`flow_by_contract` still holds 90 days at the moment of the first deploy, so
the new tables can be seeded with 90 days of history on day one rather than
starting empty. `src/tools/market_tide_backfill.py` and
`src/tools/forced_flow_backfill.py` are the two existing precedents for exactly
this move — a live-only series given a past by replaying the retained
per-contract tables through the same code path that writes it live. Run it
once, before the prune window eats another week.

---

## 5. What this is not

This does not make Hedging Flow *scrubbable* the way `/replay` is. Replay has
per-minute frames of a whole surface and a playhead; this is 78 bars of three
series, and the useful historical view is the finished session as one picture —
the same page, for a past day. A scrubber can come later from the same tables.

It also does not change the estimate's standing. `basis` stays
`aggressor_inferred` and `disclosure` still has to render on a historical
session: a day-old estimate is not an observation, and storing it does not
promote it.

---

## 6. Status

| Piece | Where | State |
| --- | --- | --- |
| Live page | `frontend/app/hedging-flow/page.tsx` | shipped |
| Snapshot tables | Analytics Engine | **not started** |
| `date` on the three endpoints | Analytics Engine | **not started** |
| Session-list endpoint | Analytics Engine | **not started** |
| Dated routes + OG image | `frontend/app/hedging-flow/` | **not started** |
| 90-day backfill | Analytics Engine | **not started** |

Backend references in this document were read from `zerogex-options/zerogex-oa`
at `main` (2026-08-26), which predates the Hedging Flow endpoint itself —
confirm the table names and the prune list against the deployed engine before
implementing.
