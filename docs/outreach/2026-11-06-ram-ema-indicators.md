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

> **Status:** both checks under "Confirm before sending" passed on Nov 6, so
> the first draft goes as written. You asked for the build the same day: it is
> on branch `claude/chart-ema-lines` (zerogex-web only). The "It's live" draft
> at the end is unsent: send it once that branch is deployed and the check
> above it passes.

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
  (zerogex-oa `Makefile`, the note above `DB_MAINTAIN_TABLES`). The history
  starts on 2026-06-29: 93 sessions for SPY and QQQ, 92 for SPX and NDX
  (checked on the box, Nov 6).
  - SPY, QQQ, SPX, NDX: the 13 and 40 work. The 200 needs 200 sessions, which
    at today's pace is mid-April 2027.
  - ES, NQ: their bars are still deleted after 60 days (zerogex-oa
    `_futures_retention_days` falls back to `DATA_RETENTION_DAYS=60`), so about
    44 sessions, and the window never grows. Only the 13 means much on their
    daily chart. The box's `.env` sets `DATA_RETENTION_DAYS=60` and has no
    `FUTURES_BARS_RETENTION_DAYS` line (checked Nov 6), so the 60 days apply,
    not the 7 the ES/NQ rollout started with.
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

Two checks on the EC2 box. Neither needs the build. **Both passed on Nov 6:**
history from 2026-06-29 (92 to 93 sessions), and no
`FUTURES_BARS_RETENTION_DAYS` override in `.env`.

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

## What shipped (2026-11-06)

zerogex-web branch `claude/chart-ema-lines`. No backend change, no schema
change, nothing to run on the database.

- **Layers → Studies → EMAs**, on every Gamma Terminal chart: /chart, the
  Dashboard, My Dashboard and the Fuseline Radar. Off by default, the chart's
  rule for new overlays (`DEFAULT_OVERLAYS`). "All" in Quick looks turns it
  on; the other looks turn it off.
- **Three lines, 13, 40 and 200.** Under the switch, each line has a color
  square (shows or hides that line) and a length box, 2 to 200 bars. A length
  takes effect as it is typed; anything out of range is clamped when the box
  is left. **Reset to defaults** puts back 13, 40 and 200. Lengths are saved
  per browser, per page (the Terminal and the Dashboard each keep their own,
  as they already do for every overlay).
- **Hover a candle** and the readout card lists each line's value. The legend
  under the chart names each line, and says "EMA 200 · needs 200 bars" where
  the chart has too few candles (the daily chart until about mid-April, and the
  radar's 4-minute candles).
- **The math** (`frontend/core/movingAverages.ts`): seeded with the simple
  average of the first `length` closes, as TradingView does, with the 176
  candles the pool slice leaves out fed in as warm-up. The newest point moves
  with the live price.
- **Colors** are three new tokens, `--color-ema-1/2/3`, one set for light
  themes and one for dark. Each sits at least dE 14.9 from every gamma-level
  color in all 12 palettes (the levels hold each other to 12), and a new test
  in `tests/chartLevelPalette.test.ts` keeps it that way.
- **Not on the free delayed preview**: its switch reads "Live only" (180
  candles is too few for a 200).
- **Help**: an EMAs section and table row in the Gamma Terminal guide in all
  five languages (required by `tests/gammaTerminalGuide.test.ts`), plus a line
  each in Reading Charts and the Fuseline Radar guide.
- **Checked**: type check, lint (one warning, already on `release`), the full
  frontend suite (3,742 pass, 0 fail; `release` is 3,727 and 0, the 15 extra
  being the new tests), and the real page in a browser against a mock price
  feed: light and dark themes, a phone, the daily chart, Rewind, and settings
  surviving a reload.

## It's live: confirm before sending

After the branch is deployed, sign in and open https://zerogex.io/chart:

1. Click **Layers**. **EMAs** should be under Studies. Turn it on: three
   lines appear over the candles (pink, yellow-green and peach on a dark
   theme; orchid, navy and crimson on a light one), and the legend under the
   chart lists `EMA 13`, `EMA 40`, `EMA 200`.
2. Click **1D**. The legend should read `EMA 200 · needs 200 bars`.

- **No EMAs row in Layers:** the site is still on the old build. Deploy again.
- **The row is there but no lines draw on 5M:** don't send; ask Claude.

## It's live: draft

**Subject:** Re: Request to add EMA's

Hi Ram,

EMAs are live on the charts.

On the Gamma Terminal (and the same chart on the dashboard), click Layers above the chart and turn on EMAs under Studies. You'll get three lines: 13, 40 and 200. Under the switch, each line has its own box. Type any length from 2 to 200, or click a line's color square to hide it. The chart remembers your lengths on that browser, and hovering a candle shows each line's value there.

Two things to know:

1. On SPY and QQQ the chart includes pre-market and after-hours candles, so the EMAs do too. Next to a chart set to regular hours only, they'll read a bit differently, most of all the 200. SPX and NDX are regular hours only, so those line up.
2. The 200 doesn't show on the daily chart yet, because our daily history doesn't reach back 200 trading days. The 13 and 40 work there, and the legend under the chart says when a line needs more history.

Thanks again for the suggestion. I'd like to hear how it works for you.

Best,
Michael

## If he replies

- **He wants the daily 200 now, or asks about ES and NQ on the daily chart.**
  That's the backfill above. SPY, QQQ, SPX and NDX need only the backfill; ES
  and NQ also need the retention change first. Neither is on the critical path.
