# Ram Kishore: EMA lines on the charts (2026-11-06)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Ram Kishore wrote to you directly (Gmail marks it External), subject "Request
to add EMA's":

> Good morning, Michael,
>
> I am checking in to see if we can add EMA indicators to the charts. Ideally,
> we could include the 13, 40, and 200 EMAs, or provide an option for users to
> select their preferred EMA length.
>
> Best regards,
> Ram

No earlier thread with Ram in this folder.

> **Status:** the draft is unsent, and it promises the feature. Nothing is
> built yet. Send it only if you want it built.

## The answer

Yes, on every intraday chart, with the data we have today. An EMA is
arithmetic on the candle closes the chart already loads, so it needs no new
data, no backend change and no schema change. The one gap is a 200-day EMA on
the daily chart: we don't store 200 days of price history yet.

## The read

- **Nothing exists today.** No chart draws an EMA or any other moving average,
  and the API computes none. The Gamma Terminal's Studies are VWAP, Centroids,
  Expected Range and PD/PM Levels (`frontend/components/GammaTerminalChart.tsx`,
  `LAYER_ROWS`).
- **One change covers "the charts".** The Gamma Terminal chart is the same
  component on /chart, the Dashboard, My Dashboard and the Fuseline Radar.
  EMAs would be a new row under Layers → Studies.
- **Intraday has enough candles.** Every timeframe loads the newest 576 candles
  (`frontend/hooks/useMarketHistorical.ts`, `CACHE_BAR_LIMIT`; the API caps
  `window_units` at 576). A 200 EMA needs 200 to start, and the rest let it
  settle. Simulated on SPY-like 5-minute bars, a 200 EMA started 576 candles
  back sits within about 4 cents of one started from years of history (12 cents
  at the 95th percentile). The 13 and 40 match to the cent.
- **Where they won't match other platforms.** The EMAs follow the candles the
  chart draws. SPX and NDX are regular hours only, and ES and NQ are the full
  futures session, so those line up with TradingView. SPY, QQQ and NVDA include
  pre-market and after-hours candles (04:00 to 20:00 ET), so their EMAs do too:
  a 200 EMA on 5-minute candles spans about one day instead of two and a half.
  Next to a chart set to regular hours only, those will read differently. The
  "it's live" email should say so.
- **The daily chart is short of history.** Daily candles are built from the
  stored 1-minute bars, which were deleted after 60 days until 2026-08-25
  (zerogex-oa `Makefile`, the note above `DB_MAINTAIN_TABLES`). So the history
  should start around 2026-06-26, about 94 sessions. Not checked against the
  database from here; see "Confirm before sending".
  - SPY, QQQ, SPX, NDX: the 13 and 40 work. The 200 needs 200 sessions, which
    at today's pace is mid-April 2027.
  - ES, NQ: their bars are still deleted after 60 days (zerogex-oa
    `_futures_retention_days` falls back to `DATA_RETENTION_DAYS=60`), so about
    44 sessions, and the window never grows. Only the 13 means much on their
    daily chart. That assumes the box's `.env` leaves
    `FUTURES_BARS_RETENTION_DAYS` blank. The ES/NQ rollout started it at 7, and
    a week of bars (about 115 hourly candles) is too few for a 200 on the
    1-hour chart too. The second check below says which.
  - NVDA: bars only since 2026-10-20, about 14 sessions. The 1-, 5- and
    15-minute charts are fine, the 1-hour 200 needs a few more weeks, and the
    daily chart has too few candles for any of the three.
- **Closing the daily gap is optional and can wait.** zerogex-oa
  `src/tools/underlying_backfill.py` loads older 1-minute bars from
  TradeStation, which serves years of them. Two years for SPY, QQQ, SPX and NDX
  would give the daily 200 room to settle (a daily request tops out at 576
  candles, about 2.3 years). The cost: the daily chart's history query reads
  every stored row for the symbol (`_bucket_floor_subquery` falls through to a
  full scan on `1day`), so it would read about five times more. Time the 1D
  chart's load before and after. ES and NQ would also need
  `FUTURES_BARS_RETENTION_DAYS` raised before `make futures-backfill`, or the
  ingester deletes the backfill again.
- **What the build is.** zerogex-web only, no backend deploy:
  - The EMA math in its own `core/` file, with tests.
  - Three lines, 13, 40 and 200 by default. Each length editable (2 to 200),
    each line switchable, remembered per browser like the other chart settings.
  - Off by default, the rule for new overlays (`DEFAULT_OVERLAYS`).
  - Computed from all 576 fetched candles, not the 400 the chart keeps for
    panning (`POOL`). From 400, the 200's gap grows to about 11 cents (38 at the
    95th percentile).
  - "Live only" on the free delayed preview, which loads 180 candles
    (`app/chart/snapshot.ts`, `WINDOW_UNITS`): too few for the 200.
  - A section in the Gamma Terminal help guide.
    `tests/gammaTerminalGuide.test.ts` requires one for every Layers row.
  - The Fuseline Radar's 4-minute candles are built from 576 one-minute bars,
    so there are 144 of them: the 13 and 40 work there, the 200 can't.

## Confirm before sending

Two checks on the EC2 box. Neither needs the build.

**1. How far back the price history goes.** Only the daily-chart paragraph
depends on it. From `~/zerogex-oa`, run `make psql`, then:

```sql
SELECT symbol,
       MIN(timestamp)::date AS first_day,
       COUNT(DISTINCT (timestamp AT TIME ZONE 'America/New_York')::date) AS sessions
FROM underlying_quotes
WHERE symbol IN ('SPY', 'QQQ', 'SPX', 'NDX')
GROUP BY symbol
ORDER BY symbol;
```

- **`sessions` under 250 (about 94 expected):** send as written.
- **250 or more:** older history was loaded at some point, and the daily 200
  works today. Delete the paragraph that starts "The one exception".

**2. How long ES and NQ bars are kept.** From `~/zerogex-oa`:

```bash
grep -E '^(DATA_RETENTION_DAYS|FUTURES_BARS_RETENTION_DAYS)=' .env
```

- **`DATA_RETENTION_DAYS=60` and `FUTURES_BARS_RETENTION_DAYS` blank or
  missing:** fine, send as written.
- **`FUTURES_BARS_RETENTION_DAYS=7`:** ES and NQ keep a week of bars. After
  the close, empty the value (`FUTURES_BARS_RETENTION_DAYS=`) and run
  `sudo systemctl restart zerogex-oa-ingestion`. Deleted bars don't come back,
  but in about two weeks the 1-hour chart has enough for the 200. Send as
  written; if the build ships sooner, the ES and NQ 1-hour 200 fills in over
  those two weeks.

## Draft

**Subject:** Re: Request to add EMA's

Hi Ram,

Thanks for the suggestion. Yes, we can add EMAs.

I'm adding them to the Gamma Terminal chart, and to the same chart on the dashboard, as three lines set to 13, 40 and 200. You'll be able to change each one to any length up to 200, or switch it off. They'll work on the 1-minute, 5-minute, 15-minute and 1-hour charts.

The one exception for now is the 200 on the daily chart. A 200-day EMA needs 200 trading days of price history, and ours doesn't go back that far yet. The 13 and 40 work on daily candles for SPY, QQQ, SPX and NDX.

I'll email you as soon as it's live. In the meantime, if you also chart on TradingView, thinkorswim, NinjaTrader or Sierra Chart, our indicators put the ZeroGEX levels on those charts, next to their built-in EMAs: https://zerogex.io/integrations

Best,
Michael

## For the "it's live" email

- Where to find it: the Layers button on the chart, under Studies (use the
  name the build ships with).
- The lengths are remembered per browser, so a second computer starts on 13,
  40 and 200.
- SPY, QQQ and NVDA include pre-market and after-hours candles, so their EMAs
  do too, and a chart set to regular hours only elsewhere will show a different
  200. SPX and NDX are regular hours only.
- Not on the free delayed preview.

## If he replies

- **He wants the daily 200 now, or asks about ES and NQ on the daily chart.**
  That's the backfill above. SPY, QQQ, SPX and NDX need only the backfill; ES
  and NQ also need the retention change first. Neither is on the critical path.
