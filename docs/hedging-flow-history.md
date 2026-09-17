# Hedging Flow history — the dated permalinks

*Companion to `docs/flow-series-endpoint.md`. That document specified the
endpoint that made the Flow Analysis page a dumb renderer; this one records
what made the Hedging Flow page replayable.*

> **Status: implemented.** This began as a spec and is kept as the design
> record. Sections 1–3 describe the problem as it stood; §4 is what shipped,
> and where the built thing differs from what was first proposed, §4 says so
> and why. §6 is the deploy order, which still has one step an operator must
> run by hand and should run SOON.

---

## 0. The short answer

**Hedging Flow was not stored historically, and could not be read for a past
day through any endpoint the web app called.** It was a live-session surface
and nothing else: `/hedging-flow` mounted, polled the current session every 15
seconds, and had no notion of a date.

It is now handled the way Replay and the Scorecard are — a session list, dated
permalinks, ISR, an OG card — and the reason it can be is **retention**, not
performance. The page's own pipeline reads `flow_contract_facts`, which
`make db-prune` deletes at `DATA_RETENTION_DAYS` (90). Recomputing a past
session from it answers for a quarter and then returns an empty series that a
reader cannot tell from a quiet day. The finished bars are now written once per
analytics cycle into a retention-exempt table and kept.

Three things turned out to be already done, which is why the change is smaller
than the original spec assumed:

* **`gamma_regime_5min` already existed** and was already retention-exempt. The
  structure panel needed only a `date` parameter threaded to it — no table, no
  writer.
* **`/api/gex/weather` stores nothing at all** and derives its classification on
  read. The spec proposed a `gamma_weather_5min` table; building it would have
  been actively wrong, because deriving on read is what lets a retuned
  threshold reclassify the whole archive instead of leaving old sessions
  labelled by a rule that is no longer live. No table was built.
* **`src/hedging_flow_sql.py` already rendered a psycopg2 form of its canonical
  CTE** for "a future snapshot writer", with the window-invariance argument
  spelled out. The writer uses that text rather than a second copy.

All three endpoints also already accepted `session=current|prior`, so exactly
one session of history was reachable before this — which is not enough to
build a permalink on, but is why the shape of the `date` parameter fits
naturally beside it.

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
`DB_MAINTAIN_TABLES`, and `flow_contract_facts` is on that list. That is the
table a from-scratch hedging-flow computation reads — and it has to be that
one, not `flow_by_contract`, because `flow_by_contract` does not carry `delta`
at all (the column was dropped) so the notional cannot be formed there. So a recompute endpoint would answer for the last 90 days
and return an empty session for day 91 — the worst failure mode available,
because it looks exactly like a quiet day.

The backend has already made this decision twice, in the same direction:

- `option_chains_archive` is deliberately excluded from `DB_MAINTAIN_TABLES`
  as "the durable, retention-exempt copy that backs the backtesting platform".
- `underlying_quotes` and `gex_summary` were removed from it on 2026-08-25 for
  the TradeWorkz screen, with the reasoning recorded in the Makefile: pruning
  them "capped every screen at a rolling ~90 days", and "both tables are tiny
  (~1 row/min/symbol ≈ a few hundred K rows a year)".

A 5-minute hedging-flow bar series is **smaller than either** — 82 bars per
symbol per session per scope, roughly 40k rows per symbol per year. Storing it forever
costs approximately nothing.

---

## 4. What shipped

### 4.1 One new table, not three

`flow_series_5min` was the precedent to copy: a snapshot the Analytics Engine
materialises once per cycle off the per-contract facts, absent from
`DB_MAINTAIN_TABLES`, read instead of re-aggregated.

The original spec proposed three tables. Two of them were wrong:

* `gamma_regime_5min` **already exists** and is already retention-exempt, so
  the structure series was historical the whole time — nobody had asked it for
  a date.
* `gamma_weather_5min` **should not exist**. `/api/gex/weather` stores nothing
  and classifies on read, which is a deliberate property: retuning a threshold
  reclassifies the archive rather than leaving old sessions labelled by a rule
  that is no longer live. Freezing a verdict into a row would throw that away.
  A dated weather read is the same derivation applied to that day's two series.

So one table:

```sql
hedging_flow_5min (
    symbol, scope, bar_start,            -- PK (symbol, scope, bar_start)
    call_flow_usd, put_flow_usd, net_flow_usd,
    cum_call_usd,  cum_put_usd,  cum_net_usd,
    classified_ratio, underlying_price, contract_count, is_synthetic,
    created_at, updated_at
)
```

`scope` is `'all'` or `'0dte'`, and it is a column rather than a filter for the
reason §3 gives. The live CTE takes arbitrary strike/expiration arrays and a
snapshot cannot pre-compute an arbitrary filter — which is exactly why
`flow_series_5min` supersedes only the *unfiltered* read. But this page offers
one filter, a 0DTE toggle resolving to the session's own date, so that closed
set of two is materialised and the toggle picks a scope. A session that was not
an expiry simply has no `0dte` rows, which is the same honest answer the live
page gives rather than a fabricated flat line. Any other filter still falls
through to the CTE and still inherits the 90-day horizon.

**The table is deliberately absent from `DB_MAINTAIN_TABLES`** and present in
`DB_VACUUM_EXTRA_TABLES` instead — vacuumed, never pruned. Adding it to the
prune list would delete precisely the history that exists *because* the source
is pruned. Both the schema comment and the Makefile say so at the point where
someone would be tempted.

### 4.2 The writer

`AnalyticsEngine._refresh_hedging_flow_snapshot` runs beside the two existing
snapshot writers, once per flow cycle, both scopes. It executes
`HEDGING_FLOW_SNAPSHOT_UPSERT_PSYCOPG2` — the canonical CTE rendered for
psycopg2 from the same template the live read uses, which
`src/hedging_flow_sql.py` had already prepared "so that writer inherits this
text instead of transcribing it".

No incremental form, unlike the flow series. That one exists because its CTE
walks `flow_by_contract` with LAG-and-recumulate over the whole session
(~30s/cycle measured); this pipeline reads `flow_contract_facts`, whose values
are already per-bucket deltas, so the full-session form *is* the cheap one. It
converges rather than churns because closed bars are window-invariant and the
`IS DISTINCT FROM` guard turns a recomputed closed bar into a read with no
write — verified: a second pass over a written session writes **zero** rows.

Both flow writers now share `_flow_session_window`, so the two series cannot
drift onto grids a bar apart.

### 4.3 Endpoints

| Endpoint | Change |
| --- | --- |
| `GET /api/flow/hedging` | new optional `date=YYYY-MM-DD`, overrides `session` |
| `GET /api/gex/regime-series` | same |
| `GET /api/gex/weather` | same, passed through to both series it reads |
| `GET /api/flow/hedging/sessions` | **new** — the stored days, newest first |

A `date` resolves the window arithmetically and **does not probe
`flow_by_contract`** to decide whether the session existed. That probe is what
the other session modes use, and against a pruned table it would report "no
such session" for every day old enough to need a permalink. A well-formed date
with nothing stored returns `200` with `bars: []`; a malformed one is `400`,
never a silent fall back to the live session, which would serve today's chart
under someone else's permalink.

`session` in the response echoes the date when one was asked for, so a dated
payload is self-describing.

The sessions listing reads `hedging_flow_5min` and nothing else — listing from
the live tables would advertise exactly the 90 days the prune window keeps and
hide every older session that is still perfectly readable. Each entry carries
`bar_count`, `real_bar_count` (carry-forward bars excluded, so "thin" is
distinguishable from "short"), `had_0dte`, and the session's closing
`cum_net_usd`, which is what lets a card say something about the day rather
than only name it.

### 4.4 Front end

```
app/hedging-flow/page.tsx                       live: owns the polling
app/hedging-flow/HedgingFlowPanels.tsx          the rendering, owns no data
app/hedging-flow/sessions/page.tsx              the index, ISR 3600
app/hedging-flow/[symbol]/[date]/page.tsx       the permalink, ISR 3600
app/hedging-flow/[symbol]/[date]/DatedHedgingFlow.tsx
app/hedging-flow/[symbol]/[date]/opengraph-image.tsx
core/hedgingFlowSeries.ts                       shared wire-shape normalisation
```

Both routes render the same `HedgingFlowPanels`. A historical session that
drifted from the live one would be a receipt for a chart nobody can reproduce,
and the drift would be invisible until someone compared them side by side.
`core/hedgingFlowSeries.ts` exists for the same reason one layer down: the
hooks and the server fetch reshape the wire order through one function.

**The dated page fetches entirely on the server** and the client component
fetches nothing. This is what makes the permalink public: browser calls to
`/api/flow/*` are Basic-gated at the BFF, so a client fetch would serve an
anonymous visitor — or a crawler — a header and an error. It is also free: a
finished session is immutable, so the hooks switch their poll off when `date`
is set, and the dated route does not use them at all. Both 0DTE scopes arrive
with the page and the toggle switches locally.

`/hedging-flow/sessions` is in the sitemap; `/hedging-flow` was **removed** from
it. The live tool is gated, so Googlebot following it lands on a 307 to
`/login` — "Page with redirect" in Search Console, which is exactly what the
exclude block above it already says. Ten other gated routes have the same
omission and were left alone; see the note in `next-sitemap.config.mjs`.

### 4.5 A bug found on the way

Every dated OG image on the site destructured `params` synchronously. It is a
Promise in this Next version, so `params.date` was `undefined`: the previews
rendered with no date and skipped their payload fetch entirely. A shared
scorecard card read "SPY ·" and then nothing. Fixed in all five
(`hedging-flow`, `scorecard`, `forecast`, `replay/snapshot`, `cards`) and
pinned by `tests/hedgingFlowHistory.test.ts`.

---

## 5. What this is not

It does not change the estimate's standing. `basis` stays
`aggressor_inferred` and `disclosure` still has to render on a historical
session: a day-old estimate is not an observation, and storing it does not
promote it.

---

## 6. Deploying it

In this order. Step 2 is the one with a clock on it.

| # | Step | Where |
| --- | --- | --- |
| 1 | `make schema-apply` — creates `hedging_flow_5min` | zerogex-oa |
| 2 | **`make hedging-flow-backfill`** — seeds history from retained facts | zerogex-oa |
| 3 | Deploy the engine + API | zerogex-oa |
| 4 | Deploy the web app | zerogex-web |

**Step 2 is a one-way door with a clock on it.** The engine writes only the
current session each cycle, so on the day this ships the table holds one day.
Everything before that exists solely in `flow_contract_facts`, and once a day
falls out of the 90-day prune window it is gone — the snapshot is the only
thing that would have outlived it. Run the backfill and ~90 days of history
exists permanently; don't, and it ages out a day at a time while nobody
notices. It is idempotent, commits per session, and takes `DRY_RUN=1` and
`DAYS=<n>`.

Verification, against a scratch database with the schema applied:

```
make hedging-flow-parity HEDGING_FLOW_PARITY_DSN=postgres://...
```

That seeds its own synthetic sessions under a sentinel symbol and asserts the
three properties the feature rests on: a stored bar equals what the live CTE
computes for the same window, re-running the writer over a closed session
writes zero rows, and a non-expiry session materialises no `0dte` scope.

### Tests

| Suite | Covers |
| --- | --- |
| `tests/test_hedging_flow_history.py` | routing, the `date` parameter, the sessions endpoint contract |
| `tests/test_hedging_flow_snapshot_sql.py` | the SQL, against a real Postgres (`integration`-marked) |
| `npm run test:hedging-flow-history` | normalisation, no-poll-when-dated, no client fetch, the OG params fix |
| `npm run test:dated-permalinks` | the 404-on-outage rule, now covering this page too |

### Still open

* Ten other Basic/Pro routes are missing from the sitemap's exclude list
  (`/my-dashboard`, `/gex-heatmap`, `/gamma-shift`, `/pair-comparison`,
  `/gex-strike-profile`, `/forced-flow`, `/market-tide`, `/volatility`,
  `/spread-monitor`, `/premium-heatmap`). Same omission as `/hedging-flow` had;
  left alone because changing what Google indexes for ten unrelated tools is
  not this change's call.
* No scrubber. Replay has per-minute frames of a whole surface and a playhead;
  this is 82 bars of two series, and the useful historical view is the finished
  session as one picture. A scrubber could come later from the same table.
