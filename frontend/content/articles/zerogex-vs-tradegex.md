# ZeroGEX vs TradeGEX (2026): Futures Gamma Levels, Pricing, and Coverage Compared

*A fair side-by-side of ZeroGEX and TradeGEX: what each platform is built for, how their walls and gamma flip are defined, where each one's ES and NQ levels come from, what each costs, where TradeGEX is the stronger choice, and where ZeroGEX fits better. TradeGEX's plans, prices, and features come from its own site and academy, checked {{tradegex:checked}}.*

---

## The short version

Both platforms take gamma levels from the options market and draw them on futures charts. They differ in what they cover, how they build the levels, and what comes around them.

- **TradeGEX** is built for futures day traders. It draws real-time gamma and delta exposure bars, call and put walls, a gamma flip, and its own Hedge Flow indicator on ES, NQ, YM, RTY, gold, and crude oil futures and seven large tech stocks, with native Mac and Windows apps, a built-in trade simulator, and indicators for TradingView, Tradovate, ATAS, and NinjaTrader.
- **ZeroGEX** covers six symbols - SPX, SPY, QQQ, NDX, and the ES and NQ futures - and goes deeper on them: walls weighted by gamma, a gamma flip computed from a gamma profile across a range of prices, a gamma heatmap through the session, hedging flow, and fourteen signals built on the levels, with a published method and a graded record.

If you trade the Dow, the Russell, gold, crude oil, or the big tech stocks, or want a desktop app with a trade simulator, TradeGEX is closer to what you need. If you day trade the S&P and Nasdaq complex and want to know how each level is built and how often walls have held, ZeroGEX is.

## The levels, side by side

The two platforms publish the same set of levels, mostly under the same names:

| TradeGEX | ZeroGEX | What it marks |
|---|---|---|
| Call Wall | Call Wall | The heaviest call strike: by open interest on TradeGEX, by gamma-weighted open interest on ZeroGEX |
| Put Wall | Put Wall | The same on the put side |
| Gamma Flip | Gamma Flip | The line between positive and negative modeled dealer gamma |
| Key Gamma Strike (KGS) | GEX King | The strike carrying the most gamma |
| Max Pain | Max Pain | The expiration price that leaves option holders with the least total value |

Both let you choose which expirations to read. TradeGEX's expiration selector offers 0DTE, weekly, monthly, or all expirations combined. On ZeroGEX, the Gamma Chart's expiration filter narrows the chain to any set of expirations, 0DTE included, and the walls and the flip follow it.

### Same names, different walls

The walls share names but not definitions. TradeGEX's [key-levels guide](https://tradegex.pro/academy/call-wall-put-wall-gamma-flip) places the call wall at the strike with the most call open interest and the put wall at the strike with the most put open interest, and its chart and open-interest guides say the same. (Its Greeks guide describes the walls as the dominant call and put gamma strikes instead.) ZeroGEX weights open interest by gamma, which is highest for options near the current price, where dealer hedging is most sensitive to a move. The two methods can point to different strikes when a large block of open interest sits far from price: in a raw count it counts in full, and weighted by gamma it counts for little.

The two also describe the walls differently. TradeGEX's guides describe the call wall as resistance and the put wall as support. ZeroGEX treats a wall as a concentration of gamma and measured how often walls actually held: in its study of 737 wall tests, S&P walls held about two times in three within an hour of a test and Nasdaq walls about half, and none of the nineteen things it measured about individual walls told which ones would break ([the study](/education/how-often-do-gamma-walls-break)).

ZeroGEX models dealer gamma from the options chain rather than observing it, computes its flip from a gamma profile across a range of prices, and leaves the flip blank when the chain does not support a confident crossing. The method is on its [Methodology](/methodology) page. TradeGEX's academy gives its GEX formula, gamma times open interest times the contract multiplier times the spot price squared, summed strike by strike, and describes the flip as the price where that total turns from positive to negative.

### How often the levels update

Official open interest is published once a day, after the close. TradeGEX's [open-interest guide](https://tradegex.pro/academy/open-interest-analysis) says it estimates open interest through the session from volume and trades, and its site says its GEX levels refresh every few seconds. ZeroGEX recomputes its levels about once a minute through the regular session, on both plans, as price, time, and implied volatility move against the published open interest. Its estimate of the hedging implied by the day's trades is a separate read, on the [Hedging Flow](/education/hedging-flow-explained) page. If you scalp off the levels, a refresh every few seconds is worth weighing.

### Where the ES and NQ levels come from

For ES and NQ, neither platform reads the options on the futures themselves. Both build the levels from the options on the index or ETF each future tracks, and carry them onto the futures price. TradeGEX lets you choose the options source behind its GEX bars - an ETF such as SPY, QQQ, or IWM, or an index such as SPX, NDX, or RUT - and its [academy](https://tradegex.pro/academy/etf-options-futures-correlation) says the conversion ratio varies with dividends and the cost of carry. ZeroGEX builds ES levels from the SPX chain and NQ levels from the NDX chain, and projects them onto the futures contract it quotes using that contract's cost of carry ([how it works](/help/platform/futures-contract-months)).

## Prices

List prices before promotions and tax, checked {{tradegex:checked}}. TradeGEX sells one plan with full platform access, billed monthly, every six months ({{tradegex:platform:sixMonths}}), or yearly. ZeroGEX's prices are the ones on its [Pricing](/pricing) page today.

| Plan | Billed monthly | Billed yearly |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mo | {{zgx:basic:annual}}/yr (about {{zgx:basic:annual:mo}}/mo) |
| ZeroGEX Pro, with API access | {{zgx:pro:monthly}}/mo | {{zgx:pro:annual}}/yr (about {{zgx:pro:annual:mo}}/mo) |
| TradeGEX | {{tradegex:platform:monthly}}/mo | {{tradegex:platform:annual}}/yr (about {{tradegex:platform:annual:mo}}/mo) |

Month to month, ZeroGEX Basic costs less than TradeGEX, and ZeroGEX Pro costs about the same. On yearly billing, ZeroGEX Pro costs about half as much as TradeGEX - the same as TradeGEX's six-month plan - and includes API access. The prices buy different things, though: TradeGEX's covers more markets, desktop apps, and a trade simulator, and ZeroGEX's covers six symbols in depth.

The trials and refunds differ too. ZeroGEX Basic monthly starts with a 7-day free trial, with a card on file and nothing charged until it ends, and every other ZeroGEX plan is covered by a 7-day money-back guarantee. TradeGEX offers a 3-day free trial that needs a mobile number but no card and does not turn into a paid plan on its own, and its terms say refunds are given only in exceptional circumstances.

## Where TradeGEX is the stronger choice

- **More markets.** ES, NQ, YM (Dow), RTY (Russell 2000), gold, and crude oil futures, plus NVDA, TSLA, AAPL, MSFT, AMZN, META, and GOOGL. ZeroGEX covers six symbols.
- **Faster refresh.** TradeGEX says its GEX levels refresh every few seconds. ZeroGEX recomputes its levels about once a minute.
- **Desktop apps and a trade simulator.** Native Mac and Windows apps (Windows in beta), and a built-in simulator for practicing futures trades on live prices, with bracket orders and performance stats. ZeroGEX runs in the browser and has no simulator for practicing your own trades.
- **Tradovate and ATAS.** TradeGEX draws its levels on Tradovate's web chart and in ATAS, as well as on TradingView and NinjaTrader. ZeroGEX works with TradingView, thinkorswim, NinjaTrader, and Sierra Chart.
- **Delta exposure and a multi-market oscillator.** Delta exposure bars, the Hedge Flow indicator, an oscillator that combines ES, NQ, the VIX, and options flow, a VIX line on the price chart, a dual-chart view, and a weekly Commitments of Traders report for ES and NQ. ZeroGEX leaves raw delta exposure out on purpose: [here is why](/education/why-we-dont-publish-dex).

## Where ZeroGEX is the stronger choice

- **Walls weighted by gamma.** Open interest counted by how much hedging it carries near price, not by contract count alone, which is how TradeGEX's key-levels guide describes its walls.
- **A published method and a graded record.** The [Methodology](/methodology) page sets out how the levels are computed, the [Track Record](/track-record) grades every forecast ZeroGEX publishes, misses included, and the [wall study](/education/how-often-do-gamma-walls-break) publishes how often walls actually broke.
- **Depth on the S&P and Nasdaq complex.** A gamma heatmap through the session, gamma by expiration, vanna and charm flow, hedging flow, forced flow, and fourteen signals built on the levels, with their methods set out in the [signals guide](/guides/signals-explained). TradeGEX's academy says it has no single vanna or charm line; you read those effects from its VIX line, its expiration selector, and the levels.
- **API access and an MCP server.** ZeroGEX Pro includes API keys for the same data, and the free [MCP server](/education/gamma-levels-in-claude) puts the delayed levels in AI assistants like Claude and ChatGPT. TradeGEX's plan lists no API.
- **Price on yearly billing.** ZeroGEX Pro costs about half of TradeGEX's yearly price, with the API included.
- **A free way to check first.** The [ES gamma levels](/es-gamma-levels) and [NQ gamma levels](/nq-gamma-levels) pages, about 15 minutes delayed, need no signup.

## How to decide

- **You trade YM, RTY, gold, crude oil, or single tech stocks:** TradeGEX.
- **You want a desktop app, a built-in trade simulator, or your levels on Tradovate or ATAS:** TradeGEX.
- **You day trade ES, NQ, SPX, SPY, QQQ, or NDX and want to know how each level is built and how often walls have held:** ZeroGEX.
- **You are not sure yet:** open the free [ES gamma levels](/es-gamma-levels) page, no signup needed, and compare it with the levels you use today.

---

TradeGEX's plans, prices, and features are from [tradegex.pro](https://tradegex.pro) and its academy, checked {{tradegex:checked}}, and can change at any time, so confirm them there. ZeroGEX prices on this page are read from its live price list. ZeroGEX is not affiliated with TradeGEX. Educational content only, not a trade recommendation.
