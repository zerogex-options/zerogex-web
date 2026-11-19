# Ron Windsor: how fast is the feed, compared with DataFirst? (2026-11-19)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** From Ron Windsor (rwinholdings@gmail.com, signs "R Win Holdings")
to support@, subject "How fast is your GEX data feed? Comparing to DataFirst".
He trades NQ futures and pays for DataFirst Basic ($49.99 a month). He uses QQQ
options, 1-week / 0DTE, for the gamma flip and the call and put walls, as a
morning bias only, not as an entry signal. DataFirst's open interest updates
once a day. Seven numbered questions: how often the levels are recomputed, how
often open interest updates, print-to-screen latency, opening vs closing flow,
QQQ / SPX / NQ coverage, which plan and what price, and API / NinjaTrader /
TradingView.

> **Status:** unsent. Check his account first (see "Before sending"), then
> reply in the same thread.

## The read

- **He's a careful buyer comparing specs, so give him numbers.** Every answer
  below is checked against the code, the help pages or the live site (see
  "Verified").
- **Two answers cut against us, and both stay in.** The flow isn't a
  print-by-print tape (a trade usually reaches the Flow page within a minute),
  and before the 9:30 open the levels don't yet carry that morning's open
  interest update. He uses the levels as a morning bias, so the second one
  matters most to him. He'd find both in a week of use; better from us.
- **NQ is our strongest answer.** NQ is its own symbol, built from the NDX
  book (the index itself) and converted at fair value, so there's no QQQ ratio
  to keep up. QQQ stays available for his current read.
- **His 1-week / 0DTE view carries over.** The book holds the ten nearest
  expirations plus the next two monthlies on SPX and NDX, and the Expiry
  filter narrows the flip and walls to 0DTE or to the dates he picks.
- **Price: same speed on both plans.** Basic at $39 is under his $49.99. Pro
  is the plan if he wants the levels drawn in NinjaTrader on their own.
- **The sale gets one paragraph, only if he's first-time.** Checkout refuses
  it to anyone who has held a plan or trial.
- **Nothing about DataFirst beyond what he wrote.** I haven't read its site.

## Verified

1. **Levels every 60 seconds, both plans.** `ANALYTICS_INTERVAL=60`
   (zerogex-oa `src/config.py`, `.env.example`); the API advertises the
   `analytics_cycle` profile at 60 s (`API_Guide.md`, "Cadence profiles"); the
   Nov 6 session found "GEX published every minute"
   (zerogex-oa `docs/runbooks/mag7_rollout.md`). Same speed on Basic and Pro is
   the site's own claim (`content/articles/zerogex-vs-bullflow.md`). Greeks and
   IV are computed in-house on every chain read; the vendor's Greeks are
   deliberately not fetched (zerogex-oa `src/ingestion/providers/thetadata.py`,
   `_to_quote`).
2. **Open interest once a day, in at the 9:30 open.** `help/platform/data-coverage.md`,
   "Market hours" and "Pre-market and after-hours": SPX and NDX, and the ES and
   NQ levels drawn from them, aren't recomputed until 9:30, "which is also when
   the next session's open interest comes in". No intraday estimate. The two
   intraday reads are the Gamma Terminal's **Basis: Volume**
   (`help/platform/gamma-terminal.md`) and **Hedging Flow**
   (`help/platform/hedging-flow.md`), both Basic.
3. **A trade usually reaches the Flow page within a minute.** This is an
   estimate from the pipeline's parts, not a stopwatch test:
   - the chain is polled, not streamed (`thetadata.py` docstring, point 1),
     and option rows were 4 to 18 s old at the median on Nov 6, SPX the
     stalest (`mag7_rollout.md`);
   - flow facts are refreshed by the API at most every 15 s per symbol
     (`FLOW_CACHE_REFRESH_MIN_SECONDS`, `src/api/database.py`
     `_refresh_flow_cache`) and by the analytics engine each minute;
   - the Flow page polls every 5 s (`frontend/hooks/useFlowSeries.ts`,
     `DEFAULT_INCREMENTAL_MS`).

   That adds up to about half a minute typically and about a minute at worst
   on SPX. The flow is per contract per minute; Smart Money says the same
   ("Each row is one contract's trading within one minute").
4. **Opening vs closing: not classified.** `help/platform/flow-analysis.md`
   says the aggressor read "cannot tell an opening trade from a closing one".
   Cboe Open-Close is the same line Paolo got on Nov 3
   (`2026-11-03-paolo-volume-gex-ladder.md`).
5. **Coverage.** `help/platform/data-coverage.md`, "Symbols covered". NQ maps to
   NDX (zerogex-oa `src/symbols.py`, `FUTURES_UNDERLYINGS_MAP`), converted at
   theoretical carry (`FUTURES_BASIS_CARRY_ONLY` defaults on); MNQ uses the
   same levels. **Expirations:** the box runs `INGEST_EXPIRATIONS=10` and
   `INGEST_MONTHLY_EXPIRATIONS=2` (checked on the box Nov 4, in the Paolo
   note). Confirmed again today from the live site: the public replay for Nov
   18 lists QQQ and NDX expirations Nov 18 through Nov 25 plus a non-empty
   "far" bucket, so the book reaches well past three expirations. Expiry
   filter: `help/platform/gamma-terminal.md`, "The Expiry filter".
6. **Prices.** `frontend/core/billingPlans.ts`: Basic $39 / $75 / $199, Pro
   $59 / $115 / $299. Plan contents: `help/platform/tiers-and-access.md`. The
   Black Friday prices ($19.50, $29.50, $99.50, $149.50) are live on
   https://zerogex.io/pricing (checked Nov 19); rules in
   `docs/black-friday-2026-runbook.md`.
7. **Integrations.** `docs/integrations.md`. The NinjaTrader indicator polls
   every 60 s by default (`PollSeconds = 60`), its Symbol defaults to AUTO, and
   an MNQ chart maps to NQ (`frontend/public/ninjatrader/ZeroGexGammaLevels.cs`,
   `ChartSymbol`). API docs: https://api.zerogex.io/docs.

## Before sending

Check whether the sale applies to him:

```bash
cd ~/zerogex-web && make diagnose-user EMAIL=rwinholdings@gmail.com
```

- "No user found", or a free account that never held a plan or trial: send as
  is.
- Any past or current plan or trial: delete the Black Friday paragraph.
  Checkout refuses the sale to returning members.

## Draft

**Subject:** Re: How fast is your GEX data feed? Comparing to DataFirst

Hi Ron,

Thanks for the clear questions. Straight answers, in your order:

1. Recompute speed: the gamma flip, the call and put walls and the rest of the levels are recomputed every 60 seconds through the regular session, 9:30 to 4:00 ET, on both of our plans. We calculate the Greeks and implied volatility ourselves from the live option chain, which we re-read continuously through the session. The price on the chart updates about once a second.

2. Open interest: once a day, same as DataFirst. The new figures enter our levels at the 9:30 open, and between updates the levels move as price, time and implied volatility reprice the existing book, as you described. We don't estimate open interest during the day. For what today's trading is doing, we have two separate views: the Gamma Terminal's strike ladders can weight each strike by today's volume instead of open interest, and the Hedging Flow page estimates the hedging that today's trades imply. Both are labeled as estimates from trading, not confirmed positions.

Since you use the levels as a morning bias, one thing to know: before the open, our levels are still the previous session's book as it stood at the 4:00 PM close, so they don't reflect the overnight open interest update until 9:30. Overnight, the NQ price on our chart is live and trades against those closing levels.

3. Latency: our flow isn't a print-by-print tape. We re-read the whole option chain continuously and add each trade to one-minute bars, so an options trade usually shows up on the Flow page within a minute. That suits reading the session's flow, but it isn't built for trading single prints.

4. Opening vs closing: we don't classify it. A trade report doesn't say whether it opened or closed a position. Cboe sells separate open/close data that does, and we don't use it today. What we do classify is the aggressor, whether the buyer or the seller initiated each trade, and that's what the Flow page's bought and sold figures show. Opening vs closing only shows up in the next day's open interest.

5. Coverage: yes to QQQ and SPX, along with SPY and NDX. NQ and ES are symbols of their own, not a QQQ proxy. The NQ chart shows the live NQ price from the CME feed, with levels built from NDX options and converted to NQ prices at fair value, using the cost of carry to the contract's expiry. There's no QQQ ratio to keep up, and MNQ uses the same levels. QQQ is still there if you want to keep your current read alongside it. The levels use the ten nearest expirations, plus the next two monthlies on NDX and SPX, and an Expiry filter narrows them to 0DTE or to whichever dates you pick, so you can rebuild your 1-week / 0DTE view.

6. Plans and price: the speed is the same on both plans. Basic is $39 a month, or $199 a year, and has the live levels, the Gamma Terminal and the flow pages for every symbol we cover. Pro is $59 a month, or $299 a year, and adds the API, the auto-updating NinjaTrader indicator and our advanced signals.

7. Integrations: the API comes with Pro, with your own key and JSON endpoints, documented at https://api.zerogex.io/docs. NinjaTrader: yes, also on Pro. Our NT8 indicator pulls the levels with that key and refreshes them every minute, and on an NQ or MNQ chart it picks NQ on its own, so the levels arrive in NQ prices. Sierra Chart and Bookmap work the same way. TradingView: we have a free indicator, but you type the day's levels into it, because TradingView doesn't let any indicator pull in outside data. All of them are here: https://zerogex.io/integrations

If you'd like to line us up against DataFirst before paying anything, our free NQ page shows the same levels on a 15-minute delay, with no signup: https://zerogex.io/nq-gamma-levels

And if you decide to try the live version, our Black Friday sale runs through December 1: 50% off your first year on any plan for first-time members who pay when they sign up. That's Basic at $19.50 a month or $99.50 for the year, and Pro at $29.50 a month or $149.50 for the year. It can't be combined with the 7-day free trial on Basic monthly, but every sale purchase comes with a 7-day money-back guarantee. The sale prices are applied automatically at https://zerogex.io/pricing

If anything here needs more detail, just reply. I read every message.

Best,
Michael
Founder, ZeroGEX

## If he replies

- **"How exactly do you decide buyer vs seller?"** Production has used the
  tick test since the Oct 19 ThetaData cutover (`FLOW_CLASSIFIER=tick`,
  zerogex-oa `docs/runbooks/thetadata-cutover.md`): each trade is compared with
  the previous trade in the same contract, higher counts as bought, lower as
  sold, and an unchanged price carries the last direction. The 9:30 opening
  auction counts half each way. Confirm the setting on the box before writing
  that down: the public Flow Analysis and Methodology pages still describe the
  older bid/ask rule (see "Worth knowing").
- **"0DTE alone shows no flip."** A same-day book is often one-signed, so it
  has no crossing; the chart says `NO FLIP IN SELECTED EXPIRIES`. Tick the
  week's dates, or set Expiry back to All.
- **"Can I get the new open interest before the open?"** Not today: it comes in
  at 9:30. Don't give a date.
- **"Can you show open interest updating intraday?"** No. The clearinghouse
  publishes it once a day; tools that show it moving are estimating it from
  trades. Point him to the Volume basis and Hedging Flow.
- **"Do you have a faster or tick-level flow tape?"** Not today. Don't promise
  one.
- **"Can I trial first?"** Basic monthly has a 7-day free trial at the regular
  $39. The sale price is paid at signup instead, with the 7-day money-back
  guarantee. Not both.
- **"Why do your NQ levels differ from my QQQ map?"** They're different books:
  NDX options against QQQ options. QQQ is on the site too, so he can compare
  the two directly.

## Worth knowing (not urgent)

- **The public flow-method wording is out of date.** `content/methodology.md`,
  `help/platform/flow-analysis.md` (all five locales),
  `help/platform/basic-signals-dashboard.*` and `guides/signals-explained.*`
  say each print is classed against the bid/ask (Lee-Ready). Production
  classifies with the tick test since Oct 19. The draft avoids the mechanism,
  so it's consistent either way. Can wait.
- **Several zerogex-oa docs say production keeps only the nearest three
  expirations** (`docs/runbooks/mag7_rollout.md`,
  `docs/design/tradeworkz-forward-tests.md`,
  `docs/runbooks/strategy_catalog_validation.md`,
  `docs/runbooks/stock_onboarding.md`). The box runs ten plus two monthlies.
  The Nov 13 `dte_target: 2` override on the `gex_gradient_trend` forward test
  was justified by the three-expiration belief, so it may not be needed. Can
  wait.
