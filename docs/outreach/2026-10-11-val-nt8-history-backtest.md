# Val Lav: "Does the NT8 indicator plot gamma flip history? Can I backtest it?" (2026-10-11)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Val signs "Val" and shows as *Val Lav*. Subject: "NT8 GEX indicator".

> **Status:** first reply sent. Second reply (see "Second reply") unsent.
> Reply in the same thread.

## Thread so far

1. **2026-10-11 15:58, inbound, to support.** Asks whether the NinjaTrader 8
   indicator shows only the current day's gamma flip while the market is open,
   or plots it historically across the bars loaded on the chart, and if so how
   far back. He wants to build an automated strategy on it to backtest an
   idea, and asks whether that's possible at all.
2. **Outbound.** The first draft below: indicator is live-only, history is
   in the API, two backtest traps.
3. **Inbound.** "It all sounds a bit complicated for me, but I appreciate the
   info." He's closing the thread politely. He doesn't write code.

## The read

- **Straight no on the indicator, straight yes on the backtest.** The
  indicator is live-only and can't feed a strategy. The history he needs does
  exist, through the API, on the same key.
- **Warn him off scrolling back.** The indicator draws today's flip as a line
  across the whole chart. Someone eyeballing old sessions against it would be
  testing against the wrong number and wouldn't know it. That's the one thing
  in the reply that protects him from a real mistake.
- **Give him the two backtest traps.** Bar timestamps (look-ahead) and empty
  flips. Both are silent: the backtest runs and looks fine. A strategy writer
  will value these more than anything else in the mail.
- **No promise of a history-plotting indicator.** See "If he replies".

## Verified

Read from the code on `release`, 2026-10-11.

- **The indicator is live-only.** It polls `/api/v1/levels/{symbol}` (the
  current snapshot) every 60 seconds and keeps one snapshot in memory
  (`frontend/public/ninjatrader/ZeroGexGammaLevels.cs`, `MaybeFetch`,
  `FetchAsync`). Levels are painted in `OnRender` as full-width horizontal
  lines from the left edge of the panel to the right, so today's value spans
  every bar on screen, including past sessions.
- **A strategy can't read it.** No `AddPlot`, no `Values`, no public
  `Series<double>`. Everything is drawn by hand in `OnRender`, so there's
  nothing for a NinjaScript strategy or the Strategy Analyzer to consume.
- **The history endpoint.** `GET /api/gex/historical` (zerogex-oa
  `src/api/main.py`) returns `gamma_flip`, `gamma_flip_raw`, `call_wall`,
  `put_wall`, `max_pain`, `net_gex` and more, one row per bar. Bar sizes:
  `1min`, `5min`, `15min`, `1hr`, `1day`. Up to 90 rows per request
  (`window_units`), newest first; page with `start_date` / `end_date`. It's
  listed in the Pro API help page as "Historical GEX".
- **ES / NQ are on the futures axis, per day.** The futures middleware
  projects a historical series row by row, each on its own session's
  index-to-future ratio, so a long test doesn't drift with the quarterly
  basis (`src/api/futures_middleware.py`, `_transform_series`; API guide, "A
  timestamped series").
- **Rows are stamped at bar start, carry the bar's last value.** API guide,
  `GET /api/gex/historical`: "Each row is one bar, stamped at the bar's start
  and carrying its last snapshot." NinjaTrader stamps bars at their close, so
  matching on timestamp alone leaks up to one bar of the future.
- **Empty flips are real.** `gamma_flip` is null when the book is one-signed
  or the crossing is far from spot (`src/api/models.py`, `GEXSummary`). The
  indicator shows the server's reason in its panel for the same case.
- **History isn't deleted.** `gex_summary`, which holds the flip, has been
  exempt from the 60-day production prune since 2026-08-25
  (`src/analytics/gamma_flip_carry.py`). Older rows were pruned at 60 days
  before that, so the oldest surviving row should be about 2026-06-26. Not
  checked against the database from here.

## Confirm before sending

On the EC2 box, from the `zerogex-oa` directory, run `make psql`, then:

```sql
SELECT underlying, MIN(timestamp)::date AS first_day
FROM gex_summary
WHERE gamma_flip_point IS NOT NULL
GROUP BY underlying
ORDER BY underlying;
```

If the dates aren't late June, change "late June 2026" in the draft to the
real month. ES and NQ are projected from SPX and NDX, so look at those rows.

## Draft

Hi Val,

Good question. Short answer: the indicator shows only the current levels, but the history exists, and yes, you can backtest against it through the API.

The indicator draws the latest gamma flip (plus the walls, max pain and the rest) as straight lines across the whole chart and refreshes them about once a minute. It doesn't plot what the flip was on earlier days. If you scroll back, the line you see is today's value, so don't read it as history. It also doesn't expose its values as a plot a NinjaScript strategy can read, so it won't work as-is in the Strategy Analyzer.

For a backtest, use the API endpoint /api/gex/historical. It returns the gamma flip for every bar (1-minute, 5-minute, 15-minute, hourly or daily), along with the call wall, put wall, max pain and net GEX. ES and NQ come back already on the futures price, each day converted at that day's own ratio, so the levels don't drift over a long test. It works with the same API key you have in the indicator. Docs: https://api.zerogex.io/docs

How far back: the gamma flip history starts in late June 2026. Nothing in it gets deleted, so it grows by a day every session.

The simplest setup in NinjaTrader is to download the history once into a file and have your strategy read that file when it loads, rather than calling the API during the backtest. Each request returns up to 90 bars, so page back with start_date and end_date.

Two things that will save you a headache:

1. Each row is stamped at the start of its bar but carries the value from the end of it. NinjaTrader stamps bars at their close, so match each row to the bar that closes at the end of it. Otherwise your backtest sees a few minutes into the future and will look better than it should.
2. Some bars have no flip (the value is empty). That happens when the options book doesn't cross zero near price, so there's no honest level to give. Have the strategy skip those bars rather than treat them as zero.

If you tell me what you're testing it on, I can point you to the right symbol and bar size.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If he replies

- **He asks for an indicator that plots the history.** It's buildable: on
  chart load the indicator would pull `/api/gex/historical` for the loaded
  range and draw the flip as a stepped line, and exposing it as a plot would
  also make it readable by a strategy. It's a real change (new build, a
  re-export of the zip, a round of testing on a real NT8 install). Don't
  promise it or give a date. It can wait until more than one person asks.
- **He asks which flip to use.** `gamma_flip` is the one the indicator and
  the site draw. `gamma_flip_raw` is the nearest zero crossing to price, the
  convention other GEX dashboards publish, and it often sits much closer to
  price. Use `gamma_flip` to match what he sees on the chart.
- **He wants to test without writing code.** TradeWorkz on the platform has a
  backtester whose conditions include the gamma flip, but it prices option
  trades, not futures, so it's a different test from his.
- **He gets `429 Too Many Requests` while downloading.** He's paging too fast.
  Slow the loop down and honor the `Retry-After` header.

## Second reply

### The read

- **He doesn't code, so the API route is closed to him.** Say so in one line,
  without apologizing at length, and don't explain it again.
- **Give him one thing he can do today with no setup.** Replay is free, needs
  no login, covers ES and NQ, and lists the last 60 sessions. He can drag
  through a session and watch price against the flip. It isn't an automated
  backtest, but it's the honest no-code way to see whether his idea is worth
  more effort.
- **Ask for the idea instead of guessing.** Whether anything simpler fits
  depends entirely on what the rule is (see the notes below). One sentence
  from him settles it.
- **Note the request, promise nothing.** He wants the indicator to show past
  days. What would make this simple for him is the indicator plotting history
  as a real plot, because NinjaTrader's point-and-click Strategy Builder can
  use any indicator's plots with no code. That's the build noted under "If he
  replies" above. No date.

### Verified

- **Replay:** `frontend/app/replay/page.tsx`. Public ("Free, no login"),
  lists up to 60 recent sessions per symbol (`/api/replay/sessions?...&limit=60`),
  and the symbol picker is the shared list, which includes ES and NQ
  (`frontend/core/symbols.ts`).
- **The no-code Backtesting page doesn't fit his idea as stated** (zerogex-oa
  `src/backtesting/models.py`, `strategy.py`). It's Pro, runs on SPY, SPX,
  QQQ and NDX only, and trades options, not futures. Conditions compare one
  field against a number. "Distance to gamma flip" is unsigned (how far, not
  which side), so "price crosses above the flip" can't be written. "Net GEX
  at spot is negative" is the closest stand-in for "below the flip". That's
  why the email doesn't send him there.

### Draft

Hi Val,

Fair enough. That route is really built for people who write code.

If you'd like to check the idea by eye first, Replay is free and needs no login: pick ES or NQ and any recent session, then drag through it minute by minute and watch price against the gamma flip. https://zerogex.io/replay

If you tell me the idea in a sentence or two, I'll let you know whether there's an easier way to test it. I've also noted that you'd like the indicator to show past days on the chart.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

### If he sends the idea

- **It's about distance from the flip, or which side of zero gamma the
  market is on, and he's happy testing it on SPX options.** The Backtesting
  page can do it with no code: "Distance to gamma flip" below a percentage,
  or "Net GEX sign" positive or negative. Tell him it trades options, not
  futures, before he spends time on it.
- **It's a futures rule, or it needs "price crosses the flip".** There's no
  no-code way today. Say so plainly, and point him back to Replay to judge it
  by eye.
