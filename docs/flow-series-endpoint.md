# `/api/flow/series` — Server-Computed Flow Analysis Series

## Purpose

Replace the per-contract `/api/flow/by-contract` feed (which the frontend
currently re-accumulates into session-cumulative series client-side) with a
single endpoint that returns ready-to-render 5-minute bars. The frontend
becomes a dumb renderer — no accumulators, no gap-filling, no alignment.

Every chart on the Flow Analysis page and the dashboard Options Flow card
pulls from this endpoint.

## Endpoint

```
GET /api/flow/series
```

### Query parameters

| Name          | Type      | Required | Default    | Notes |
| ------------- | --------- | -------- | ---------- | ----- |
| `symbol`      | string    | yes      |            | Uppercased ticker, e.g. `SPY`. Reject unknown symbols with `404`. |
| `session`     | enum      | no       | `current`  | One of `current`, `prior`. `current` = most recent trading session that has any data; `prior` = the session immediately before that. |
| `strikes`     | CSV float | no       | all        | Comma-separated strikes to include. Empty/missing = all. |
| `expirations` | CSV date  | no       | all        | Comma-separated `YYYY-MM-DD` expirations. Empty/missing = all. |
| `intervals`   | integer   | no       | full       | If provided, return only the last N 5-min bars (used by incremental polling). `intervals=1` returns just the tail bar. |

### Validation rules

- `symbol` must match `^[A-Z.]{1,10}$`. Lowercase is accepted and uppercased server-side.
- `strikes` entries must parse as finite numbers; silently drop unparseable entries, reject the whole request only if every entry is bad.
- `expirations` entries must match `^\d{4}-\d{2}-\d{2}$`; same silent-drop rule.
- `intervals`, if provided, must be a positive integer ≤ 390 (a full regular session is 81 bars; cap generously).
- On validation failure return `400` with `{"error": "<message>"}`.

## Response schema

`200 OK` with `application/json`:

```json
[
  {
    "timestamp": "2026-04-24T13:30:00Z",
    "bar_start": "2026-04-24T13:30:00Z",
    "bar_end":   "2026-04-24T13:35:00Z",
    "call_premium_cum": 12345678.9,
    "put_premium_cum":   9876543.2,
    "call_volume_cum":   150000,
    "put_volume_cum":    165000,
    "net_volume_cum":    -15000,
    "raw_volume_cum":    315000,
    "call_position_cum": 23456,
    "put_position_cum":  -1234,
    "net_premium_cum":   2469135.7,
    "put_call_ratio":    1.10,
    "underlying_price":  712.42,
    "contract_count":    318,
    "is_synthetic":      false
  },
  ...
]
```

### Field contract

| Field               | Type               | Units             | Notes |
| ------------------- | ------------------ | ----------------- | ----- |
| `timestamp`         | ISO-8601 Z string  | —                 | **Bar start**, floored to 5-minute boundary. Use this as the primary chart X key. Always present. |
| `bar_start`         | ISO-8601 Z string  | —                 | Identical to `timestamp`; included for clarity and future divergence. Always present. |
| `bar_end`           | ISO-8601 Z string  | —                 | `bar_start + 5min`. Always present. |
| `call_premium_cum`  | number             | USD (dollars)     | Σ of `net_premium` for `option_type='C'` rows up to and including this bar, across the selected contracts. |
| `put_premium_cum`   | number             | USD (dollars)     | Σ of `net_premium` for `option_type='P'` rows up to this bar. |
| `call_volume_cum`   | integer            | contracts         | Σ of `raw_volume` for calls up to this bar. |
| `put_volume_cum`    | integer            | contracts         | Σ of `raw_volume` for puts up to this bar. |
| `net_volume_cum`    | integer            | contracts, signed | Σ of `net_volume` across all contracts up to this bar. Positive = net buying. |
| `raw_volume_cum`    | integer            | contracts         | Σ of `raw_volume` across all contracts up to this bar. Always ≥ 0. |
| `call_position_cum` | integer            | contracts, signed | Σ of `net_volume` for calls up to this bar. |
| `put_position_cum`  | integer            | contracts, signed | Σ of `net_volume` for puts up to this bar. |
| `net_premium_cum`   | number             | USD (dollars)     | `call_premium_cum + put_premium_cum`. Included pre-computed so clients don't drift. |
| `put_call_ratio`    | number \| null     | ratio             | `put_volume_cum / call_volume_cum`. `null` if `call_volume_cum == 0` (avoid divide-by-zero; frontend renders as a break). |
| `underlying_price`  | number \| null     | USD               | Last-observed underlying tick whose timestamp falls inside `[bar_start, bar_end)`. Must come from the tape / an underlying OHLC source — **never** from `flow_bar_contract.underlying_price`. Invariant under strike/expiration filters. See "Underlying price semantics" below. |
| `contract_count`    | integer            | —                 | Distinct contracts contributing to this bar's *delta* (not cumulative). Used for diagnostics. |
| `is_synthetic`      | boolean            | —                 | `true` when the row was emitted as a carry-forward (no activity in this bar). Charts don't need it; diagnostics pages do. |

### Ordering & coverage guarantees

- Rows are **sorted ascending** by `timestamp`.
- Rows are **contiguous**: exactly one row per 5-minute bar from the session
  open (09:30 ET) through the latest bar that has any data in the DB, inclusive.
  No gaps. If a bar had no trade activity, emit a row with the previous
  cumulatives and `is_synthetic: true`.
- If `intervals=N` is supplied, return the **last N** rows (tail window). They
  remain contiguous and sorted; carry-forward rules still apply.
- Do **not** emit rows for bars that haven't happened yet. The client extends
  the X-axis to 16:15 ET on its own.

### Empty / error cases

| Condition                                    | Response              |
| -------------------------------------------- | --------------------- |
| Unknown symbol                               | `404` + `{"error": "symbol not found"}` |
| Symbol exists but session hasn't started yet | `200` + `[]` |
| `session=prior` requested but no prior data  | `200` + `[]` |
| All `strikes`/`expirations` filter contracts out | `200` + `[]` |
| Validation failure                           | `400` + error |
| Backend DB unavailable                       | `503` + error |

## Computation (SQL pseudocode)

Assume a `flow_bar_contract` table populated by the ingestion pipeline, one
row per `(symbol, bar_start, option_type, strike, expiration)` with per-bar
deltas:

```sql
CREATE TABLE flow_bar_contract (
    symbol        TEXT      NOT NULL,
    bar_start     TIMESTAMPTZ NOT NULL,  -- 5-min floor
    option_type   CHAR(1)   NOT NULL,    -- 'C' | 'P'
    strike        NUMERIC   NOT NULL,
    expiration    DATE      NOT NULL,
    raw_volume    INTEGER   NOT NULL,    -- ≥ 0
    raw_premium   NUMERIC   NOT NULL,    -- ≥ 0
    net_volume    INTEGER   NOT NULL,    -- signed
    net_premium   NUMERIC   NOT NULL,    -- signed
    underlying_price NUMERIC,
    PRIMARY KEY (symbol, bar_start, option_type, strike, expiration)
);
CREATE INDEX flow_bar_contract_sym_ts ON flow_bar_contract (symbol, bar_start);
```

The endpoint computation:

```sql
-- 1. Filter to the session's contracts.
WITH session_bounds AS (
    SELECT
        :session_start AS ts_start,  -- 09:30 ET of the resolved session date
        :session_end   AS ts_end     -- now() floored to 5-min, bounded by 16:15 ET
),
filtered AS (
    SELECT *
    FROM flow_bar_contract
    WHERE symbol = :symbol
      AND bar_start >= (SELECT ts_start FROM session_bounds)
      AND bar_start <= (SELECT ts_end   FROM session_bounds)
      AND (:strikes IS NULL OR strike = ANY(:strikes))
      AND (:expirations IS NULL OR expiration = ANY(:expirations))
),

-- 2. Aggregate per-bar deltas across the selected contracts.
--    NOTE: `underlying_price` is NOT aggregated here — see "Underlying price
--    semantics" below. The column on `flow_bar_contract` captures the price
--    at each contract's last trade, which is stale for contracts that didn't
--    trade in this bar. Pull the bar's actual last underlying tick from a
--    dedicated source in step 2b instead.
per_bar AS (
    SELECT
        bar_start,
        SUM(CASE WHEN option_type='C' THEN net_premium ELSE 0 END) AS call_premium_delta,
        SUM(CASE WHEN option_type='P' THEN net_premium ELSE 0 END) AS put_premium_delta,
        SUM(CASE WHEN option_type='C' THEN raw_volume  ELSE 0 END) AS call_volume_delta,
        SUM(CASE WHEN option_type='P' THEN raw_volume  ELSE 0 END) AS put_volume_delta,
        SUM(net_volume) AS net_volume_delta,
        SUM(raw_volume) AS raw_volume_delta,
        SUM(CASE WHEN option_type='C' THEN net_volume ELSE 0 END) AS call_position_delta,
        SUM(CASE WHEN option_type='P' THEN net_volume ELSE 0 END) AS put_position_delta,
        COUNT(*) AS contract_count
    FROM filtered
    GROUP BY bar_start
),

-- 2b. Pull the actual last-observed underlying tick within each 5-minute
--     window. Pick ONE of these two forms depending on what your data
--     model exposes:
--
--     (a) If you already have a 5-minute underlying OHLC table populated
--         from the tape, just left-join against it:
--
--         SELECT bar_start, close AS underlying_price
--         FROM market_quote_bar_5min
--         WHERE symbol = :symbol
--           AND bar_start >= :ts_start
--           AND bar_start <= :ts_end
--
--     (b) If you only have raw underlying ticks, window-aggregate them to
--         the 5-minute grid. This is the "last observed price in the bar"
--         the spec requires:
underlying_by_bar AS (
    SELECT
        DATE_TRUNC('minute', ts)
          - INTERVAL '1 minute'
          * (EXTRACT(MINUTE FROM ts)::int % 5) AS bar_start,
        (ARRAY_AGG(price ORDER BY ts DESC))[1] AS underlying_price
    FROM underlying_tick
    WHERE symbol = :symbol
      AND ts >= (SELECT ts_start FROM session_bounds)
      AND ts <  (SELECT ts_end   FROM session_bounds) + INTERVAL '5 minutes'
    GROUP BY 1
),

-- 3. Generate the full 5-minute timeline and LEFT JOIN both per_bar (flow)
--    and underlying_by_bar (price) so quiet bars still carry price.
timeline AS (
    SELECT generate_series(
        (SELECT ts_start FROM session_bounds),
        (SELECT ts_end   FROM session_bounds),
        INTERVAL '5 minutes'
    ) AS bar_start
),
joined AS (
    SELECT
        t.bar_start,
        COALESCE(pb.call_premium_delta, 0)  AS call_premium_delta,
        COALESCE(pb.put_premium_delta, 0)   AS put_premium_delta,
        COALESCE(pb.call_volume_delta, 0)   AS call_volume_delta,
        COALESCE(pb.put_volume_delta, 0)    AS put_volume_delta,
        COALESCE(pb.net_volume_delta, 0)    AS net_volume_delta,
        COALESCE(pb.raw_volume_delta, 0)    AS raw_volume_delta,
        COALESCE(pb.call_position_delta, 0) AS call_position_delta,
        COALESCE(pb.put_position_delta, 0)  AS put_position_delta,
        ub.underlying_price,
        COALESCE(pb.contract_count, 0)      AS contract_count,
        (pb.bar_start IS NULL)              AS is_synthetic
    FROM timeline t
    LEFT JOIN per_bar          pb USING (bar_start)
    LEFT JOIN underlying_by_bar ub USING (bar_start)
)

-- 4. Running session cumulatives, with last-known underlying carry-forward.
SELECT
    bar_start                                                      AS timestamp,
    bar_start                                                      AS bar_start,
    bar_start + INTERVAL '5 minutes'                               AS bar_end,
    SUM(call_premium_delta)  OVER w                                AS call_premium_cum,
    SUM(put_premium_delta)   OVER w                                AS put_premium_cum,
    SUM(call_volume_delta)   OVER w                                AS call_volume_cum,
    SUM(put_volume_delta)    OVER w                                AS put_volume_cum,
    SUM(net_volume_delta)    OVER w                                AS net_volume_cum,
    SUM(raw_volume_delta)    OVER w                                AS raw_volume_cum,
    SUM(call_position_delta) OVER w                                AS call_position_cum,
    SUM(put_position_delta)  OVER w                                AS put_position_cum,
    SUM(call_premium_delta + put_premium_delta) OVER w             AS net_premium_cum,
    CASE
        WHEN SUM(call_volume_delta) OVER w > 0
        THEN (SUM(put_volume_delta) OVER w)::float8
           / (SUM(call_volume_delta) OVER w)::float8
        ELSE NULL
    END                                                            AS put_call_ratio,
    -- Carry forward the last observed underlying price across quiet bars
    LAST_VALUE(underlying_price IGNORE NULLS) OVER w               AS underlying_price,
    contract_count,
    is_synthetic
FROM joined
WINDOW w AS (ORDER BY bar_start ROWS UNBOUNDED PRECEDING)
ORDER BY bar_start
-- If intervals=N, wrap this SELECT in a subquery and add:
--   LIMIT :intervals (after ordering descending and re-sorting ascending)
;
```

Notes for implementers:

- PostgreSQL 13+ supports `IGNORE NULLS` in `LAST_VALUE`. If your target is
  older, emulate with `SUM(CASE WHEN underlying_price IS NOT NULL THEN 1 ELSE 0 END)`
  partitions and `FIRST_VALUE`.
- The `generate_series` timeline must be built in the session's **local market
  time** (America/New_York) and then converted to UTC for storage/compare,
  otherwise DST boundaries produce off-by-one-hour bars.
- Cache the result per `(symbol, session, strikes, expirations)` with a TTL
  bounded by the next 5-min bar boundary (Redis: `expire_at = next_bar_start`).
  Incremental polls with `intervals=1` should bypass the cache.

## Underlying price semantics

This is the easiest field to get subtly wrong, so call it out explicitly.

**What the client expects.** For each 5-minute bar, `underlying_price` must
be the **last observed underlying tick whose timestamp falls inside the
`[bar_start, bar_end)` window**. The yellow line on the Options Flow chart
is supposed to track SPY's intraday path — it should never be flat for
consecutive bars while the tape is actually moving.

**What does NOT work.** Do not populate `underlying_price` from
`flow_bar_contract.underlying_price`, whether via `MAX`, `MIN`, `ARRAY_AGG`,
`FIRST_VALUE`, or any other per-contract aggregation. That column captures
the underlying price at each contract's **last trade**, which can be far
from the bar boundary. A bar whose contracts all last traded during the
previous price regime will resolve to the old price; a bar that happens to
include one contract that traded after the tape moved will jump to the
new price. Observed failure mode: 20–30 minutes of flat `$709.65` followed
by a single jump to `$714.21` that then holds flat for another 30 minutes,
while SPY is actually ticking smoothly between those values.

**What to use instead.** Join against your underlying tick source (or a
pre-aggregated 5-minute underlying OHLC table) at the bar grain, as shown
in step 2b of the SQL above. Conceptually:

```
underlying_price(bar) = tape.last_price WHERE ts ∈ [bar_start, bar_end)
```

If a bar has literally zero underlying ticks (pre-open, rare data gap,
etc.), emit `null`. The client's carry-forward handles the visual
continuation — do **not** fill it server-side from a contract row.

**Filter invariance.** `underlying_price` is a property of the **tape**,
not of the filtered option contracts. Applying `strikes` or `expirations`
must not change the underlying value for a given `(symbol, bar_start)`.
Two requests for the same session with different filters should return
identical `underlying_price` across their overlapping bars. Implementation
consequence: compute underlying in a subquery that does not see the
strike/expiration filter.

## Session resolution

`session=current` resolves to:

1. `MAX(bar_start)` for the symbol.
2. The ET calendar day containing that max timestamp.
3. The 09:30 ET open of that day is `session_start`.
4. `session_end = MIN(NOW() floored to 5-min, session_start + 6h 45min)`.

`session=prior` resolves to the ET calendar day of the most recent
`bar_start` that is **strictly before** `session=current`'s ET day.

## Companion endpoint: `/api/flow/contracts`

The Strike and Expiration filter chips on the page need to know which strikes
and expirations were active in the selected session. Since `/api/flow/series`
returns aggregated bars (no per-contract breakdown), this sibling endpoint
exposes just the distinct lists.

```
GET /api/flow/contracts?symbol=SPY&session=current
```

Response:

```json
{
  "strikes":    [655, 660, 670, 680, 685, 690, 695, 700, 701, 702, 703, 704, 705],
  "expirations": ["2026-04-24", "2026-04-27", "2026-04-28", "2026-04-29"]
}
```

SQL:

```sql
SELECT
  ARRAY_AGG(DISTINCT strike ORDER BY strike)         AS strikes,
  ARRAY_AGG(DISTINCT expiration ORDER BY expiration) AS expirations
FROM flow_bar_contract
WHERE symbol = :symbol
  AND bar_start >= :session_start
  AND bar_start <= :session_end;
```

Cache with the same TTL policy as `/api/flow/series` (Redis, expires at next
bar boundary). Payload is tiny — no pagination, no polling past every 5 min.

## Frontend consumption contract (for cross-team sanity)

The client calls this endpoint twice per page load:

1. Unfiltered: `?symbol=SPY&session=current` — feeds Put/Call Ratio, Net
   Position, Net Directional Premium, Flow Snapshot cards.
2. Filtered: `?symbol=SPY&session=current&strikes=...&expirations=...` — feeds
   only the top Options Flow chart (user-filterable).

Polling cadence: incremental `intervals=1` every 5 s, full refetch every 5 min
(same as current hook).

## Test vectors

### T1 — Happy path, steady flow

Inputs:

```
symbol=SPY
session=current
(no filters, no intervals)
```

DB state (symbol=SPY, 2026-04-24):

| bar_start (ET) | option_type | strike | expiration | raw_volume | net_volume | net_premium | underlying |
| -------------- | ----------- | ------ | ---------- | ---------- | ---------- | ----------- | ---------- |
| 09:30          | C           | 700    | 2026-04-24 | 100        | +40        | +50000      | 710.00     |
| 09:30          | P           | 700    | 2026-04-24 | 80         | -20        | -30000      | 710.00     |
| 09:35          | C           | 700    | 2026-04-24 | 50         | +10        | +12000      | 710.25     |
| 09:35          | P           | 700    | 2026-04-24 | 120        | +60        | +90000      | 710.25     |

Expected response (abbreviated to relevant fields):

```json
[
  {
    "timestamp": "2026-04-24T13:30:00Z",
    "call_premium_cum": 50000,
    "put_premium_cum": -30000,
    "call_volume_cum": 100,
    "put_volume_cum": 80,
    "net_volume_cum": 20,
    "call_position_cum": 40,
    "put_position_cum": -20,
    "net_premium_cum": 20000,
    "put_call_ratio": 0.80,
    "underlying_price": 710.00,
    "is_synthetic": false
  },
  {
    "timestamp": "2026-04-24T13:35:00Z",
    "call_premium_cum": 62000,
    "put_premium_cum": 60000,
    "call_volume_cum": 150,
    "put_volume_cum": 200,
    "net_volume_cum": 90,
    "call_position_cum": 50,
    "put_position_cum": 40,
    "net_premium_cum": 122000,
    "put_call_ratio": 1.333...,
    "underlying_price": 710.25,
    "is_synthetic": false
  }
]
```

### T2 — Quiet bar in the middle

Same symbol/date as T1, but the `09:35` bar has **zero** rows in the DB. The
next data is at `09:40`:

| bar_start (ET) | option_type | strike | ... | raw_volume | net_volume | net_premium | underlying |
| -------------- | ----------- | ------ | --- | ---------- | ---------- | ----------- | ---------- |
| 09:30          | C           | ...    | ... | 100        | +40        | +50000      | 710.00     |
| 09:40          | P           | ...    | ... | 50         | +10        | +5000       | 710.10     |

Expected response has **three** rows (no gap):

```json
[
  { "timestamp": "2026-04-24T13:30:00Z", "call_premium_cum": 50000,  "put_premium_cum": 0,    "underlying_price": 710.00, "is_synthetic": false },
  { "timestamp": "2026-04-24T13:35:00Z", "call_premium_cum": 50000,  "put_premium_cum": 0,    "underlying_price": 710.00, "is_synthetic": true },
  { "timestamp": "2026-04-24T13:40:00Z", "call_premium_cum": 50000,  "put_premium_cum": 5000, "underlying_price": 710.10, "is_synthetic": false }
]
```

The `is_synthetic: true` middle bar holds the previous cumulatives and
carries the last known underlying price.

### T3 — `intervals=1` incremental poll

Same DB as T2. Request: `?symbol=SPY&session=current&intervals=1`.

Expected response is **one** row — the tail:

```json
[
  { "timestamp": "2026-04-24T13:40:00Z", "call_premium_cum": 50000, "put_premium_cum": 5000, "is_synthetic": false }
]
```

Cumulatives in this row are the **true session totals**, not the delta. The
client uses this to cheaply update the latest point without re-downloading
the whole session.

### T4 — No data for symbol/session

Request: `?symbol=ABCDE&session=current` where `ABCDE` has zero rows today.

Expected: `200 OK` with `[]`.

### T5 — Filters drop all contracts

Request: `?symbol=SPY&session=current&strikes=999` (no contract at strike 999).

Expected: `200 OK` with `[]`. **Do not** return 81 empty synthetic rows — an
empty filter match means "no matching data," treated like T4.

### T6 — Put/Call ratio edge case

DB state: all rows are calls, zero put volume all session.

Expected: every row has `"put_call_ratio": null` (not `0`, not `Infinity`).

### T7 — Strike filter with partial match

Request: `?symbol=SPY&session=current&strikes=700,702,705`. Only contracts
with strikes in `{700, 702, 705}` contribute to the cumulatives. Bars that
had activity but only on *other* strikes become synthetic carry-forward
rows (since the filtered-to set has no delta in that bar).

## Performance targets

- P50 response time: **< 150 ms** for a full session with all filters.
- P99: **< 500 ms**.
- `intervals=1` polls: **< 50 ms** (Redis cache hit path).
- Payload size: full session ~81 rows × ~200 bytes ≈ 16 KB. Compressible to
  ~4 KB with gzip. No pagination needed.

## Rollout

Shipped directly — no feature flag. The Flow Analysis page consumes this
endpoint unconditionally. `/api/flow/by-contract` remains in use by Smart
Money, Intraday Tools, the dashboard Options Flow card, and Option Contracts;
it can be sunsetted independently.
