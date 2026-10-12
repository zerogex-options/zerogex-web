# Val Lav: "Does the NT8 indicator plot gamma flip history? Can I backtest it?" (2026-10-11)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Val signs "Val" and shows as *Val Lav*. Subject: "NT8 GEX indicator".

> **Status:** first and second replies sent. Third reply (see "Third
> reply: Gexbot order flow") unsent. Reply in the same thread.

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
4. **Outbound.** The second draft: Replay, and "tell me the idea".
5. **2026-10-11 9:04 PM, inbound, subject "Re: Quick question about
   ZeroGEX".** Sends a YouTube video ("Unmasking Market Dynamics with
   OrderFlow Analysis (Part 2)", channel GexFuturesTrading, which is not
   Gexbot's own channel). Asks whether Pro shows the "GEX and Convexity order
   flow" from the video, and if not, whether we can add it soon and at what
   monthly price. Says Gexbot charges $250 a month, "quite expensive for most
   people".

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

## Third reply: Gexbot order flow

### What he's asking for

Read first-hand from gexbot.com and docs.gexbot.com on 2026-10-12 (the pages
need JavaScript, so they were rendered in a headless browser). The video
itself couldn't be watched from here; its title and channel came from
YouTube's oEmbed.

- **Gexbot sells four tiers:** Classic (GEX from open interest and volume),
  State (levels from classified volume), Orderflow (classified flow signals),
  and Quant (streaming and history). Each includes the ones below it. Prices
  didn't render; Val says the one he wants is $250 a month.
- **Everything above Classic rests on trade classification:** "real-time
  options classification ... at millisecond precision to identify the
  aggressor."
- **GEX Orderflow** = "Call GEX Imbalance - Put GEX Imbalance", "the change in
  taker GEX over the last second". Gamma-weighted, signed by buyer or seller,
  per second.
- **Convexity Orderflow** = "(Long Orderflow × GEX) - (Short Orderflow ×
  GEX)", also per second. Positive means traders are buying options (wanting
  more volatility), negative means selling them. Meant to be read next to DEX
  Orderflow: positive DEX with negative convexity is a short put, positive
  DEX with positive convexity is a long call.
- **DEX Orderflow and Aggregate DEX:** the per-second change in taker delta,
  and its running total since 09:30 ET.
- They also have size filters ("threshold filters") that hide small prints.

### What we have

All in the code and help pages on `release`. All three pages are in Basic,
so Pro has them too (`frontend/content/help/platform/tiers-and-access.md`).

- **Every options trade is already classified as buyer- or
  seller-initiated** (Lee-Ready), per contract per minute
  (`flow_contract_facts`, with `buy_volume`, `sell_volume`, `delta`).
- **Hedging Flow** (`/hedging-flow`) is the delta-weighted version:
  `(buy − sell) × delta × 100 × spot`, as a bar-by-bar rate and a session
  running total, in 5-minute bars. That's the same idea as Gexbot's DEX
  Orderflow and Aggregate DEX, at 5-minute resolution, not per second.
- **Flow Analysis** (`/flow-analysis`) shows aggressor-signed volume and
  premium for calls and puts, in 1- or 5-minute bars. When net call premium
  and net put premium are both positive, aggressors are buying options. That
  answers the question convexity order flow answers, weighted by premium
  rather than gamma.
- **Smart Money** (`/smart-money`) is the day's largest prints, each tagged
  Buy or Sell, with size filters. Close to their threshold filters.
- **What we don't have:** anything gamma-weighted from classified flow (no
  GEX or convexity order flow), and nothing per second. Our trade sides are
  stored per minute.
- **Don't offer `convexity_risk` as a match.** It's |net GEX| ÷ distance to
  the flip (zerogex-oa `src/analytics/main_engine.py`), a different measure
  with a similar name.

### The read

- **Answer the question he asked: no, not in that form.** Then show what
  covers the same ground, without overselling it as equivalent.
- **Don't promise the feature or a date.** He asked for a price with it
  included. Quoting one for something that doesn't exist would be a promise.
  State today's Pro price instead (from the pricing page: $59 a month, $115 a
  quarter, $299 a year).
- **Keep it plain.** He found the backtest reply complicated. Three short
  bullets, no formulas.
- **Don't mention that these pages are in Basic too.** It's true, but he
  needs Pro for the NinjaTrader indicator's key, and his question was about
  Pro. If he asks what Basic includes, tell him straight.

### Draft

Hi Val,

Thanks for sending the video. Short answer: not in that exact form.

Gexbot's GEX and Convexity order flow weigh every options trade by its gamma and update every second. We don't have gamma-weighted order flow, and our flow charts work in 1- and 5-minute bars rather than seconds.

What Pro does have starts from the same place: every options trade is sorted into buyer-initiated or seller-initiated.

- Hedging Flow weighs each trade by its delta and shows how much stock dealers would have to buy or sell to stay hedged, bar by bar and as a running total for the day. It's the closest match to the delta (DEX) order flow in the video. https://zerogex.io/hedging-flow
- Flow Analysis shows buyer- versus seller-initiated volume and premium for calls and puts. When buyers are paying up for both, traders are buying options, which is the question convexity order flow answers. Ours is weighted by premium rather than gamma. https://zerogex.io/flow-analysis
- Smart Money lists the day's biggest trades, each tagged buy or sell, with size filters like the ones in the video. https://zerogex.io/smart-money

Pro is $59 a month, $115 a quarter, or $299 a year, and all three are included.

I can't promise gamma-weighted order flow or a date for it, so I won't quote a price for it. I've noted it as a request, and it helps to know you'd use it.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

### If he replies

- **He asks what Basic includes.** All three pages above are in Basic
  ($39 a month). The NinjaTrader indicator needs the API key, which is Pro
  only, so moving to Basic would turn the indicator off. Tell him both.
- **He asks when.** No date. It's buildable at one-minute resolution from
  data we already store (trade sides per contract, plus gamma from the option
  chain), but nothing is scheduled. Per-second isn't possible on the current
  data, so don't let "soon" turn into "like Gexbot's".
- **He asks for it in NinjaTrader.** The indicator draws levels only, no flow.
  Same answer: noted, no date.
