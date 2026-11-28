# ZeroGEX vs Unusual Whales (2026): GEX, SPX Market-Maker Data, and Pricing Compared

*A fair side-by-side of ZeroGEX and Unusual Whales for gamma exposure: what each one is built for, how each computes GEX, what their walls and flips mean, how often each updates, what each plan costs, what you can see for free, where Unusual Whales is the stronger choice, and where ZeroGEX fits better. Unusual Whales' plans, prices, and features come from its own site, help pages, and API documentation, checked {{unusualwhales:checked}}.*

---

## The short version

Unusual Whales and ZeroGEX overlap on one thing, gamma exposure, and differ on almost everything around it.

- **Unusual Whales** is a broad market-data platform built around the real-time options tape: options flow and alerts, dark pool prints, news, congressional trades, screeners, futures data, prediction markets, an AI analyst it calls Mr. Whale, and apps for the web, iOS, and Android. GEX is one part of it. Every paid dashboard plan includes a live GEX heatmap for every optionable ticker, and its Retail Pro and Retail Max plans add what it calls True GEX for SPX, built on market-maker data from Cboe.
- **ZeroGEX** is built around dealer gamma and nothing else: the gamma flip, the call and put walls, max pain, and the Pin Strike for SPX, SPY, QQQ, NDX, the ES and NQ futures, NVDA, and MSFT, recomputed about once a minute on both plans, with a gamma heatmap, hedging flow, vanna and charm flow, and fourteen signals for the six index products built on the levels.

If you want the whole options tape, alerts on any ticker, and GEX beside it in one app, Unusual Whales is closer to what you need. If you trade the index complex and want its gamma levels in depth, moving through the session, for less, ZeroGEX is.

## Four ways to compute GEX, and which each one uses

Unusual Whales offers several GEX methods and, in its own [help article on GEX tools](https://unusualwhales.com/information/an-overview-of-gamma-exposure-and-gex-tools), ranks them from best to worst:

1. **Periscope True GEX**, for SPX only, built on a Cboe dataset that, Unusual Whales says, separates customer orders from market-maker orders and returns market-maker positioning only. It refreshes every 10 minutes on Retail Pro and every minute on Retail Max.
2. **Directionalized volume:** the day's volume, with each trade's side inferred from where it printed against the bid and ask. Unusual Whales says a heatmap version of this view is included in every paid plan, and its API builds its GEX levels from it by default.
3. **Raw intraday volume**, assuming dealers are long every call and short every put traded.
4. **Open interest**, the classic method, which it calls "by far the simplest" and the least accurate.

ZeroGEX uses the fourth: open interest under the standard convention that dealers are long the calls customers sell and short the puts customers buy, re-priced about once a minute as spot, time, and implied volatility move. Its [Methodology](/methodology) page calls the convention a disclosed assumption rather than a measurement, says where it is most likely to be wrong - call buying into a squeeze is one case - and agrees that participant-classified exchange data, the kind Periscope uses, supports a richer reconstruction of market-maker positioning than open interest does. ZeroGEX says it is testing that kind of data against its own model and has no findings yet.

## The levels, side by side

| Level | Unusual Whales, per its API documentation | ZeroGEX |
|---|---|---|
| Call wall | The strike above spot with the largest positive net gamma | The strike above spot with the heaviest call-side gamma |
| Put wall | The strike below spot with the largest positive net gamma | The strike below spot with the heaviest put-side gamma |
| Strongest strike | Gamma magnet: the strike with the largest net gamma by size | GEX King: the strike carrying the most gamma |
| Gamma flip | The interpolated price where net dealer gamma crosses zero | The price where modeled dealer gamma crosses zero, from a gamma profile across a range of prices |

The walls differ in one way that matters. Unusual Whales' [GEX levels documentation](https://api.unusualwhales.com/docs/api/gexgreeks/gex-levels) picks the strikes with the most positive net gamma, calls and puts together, while ZeroGEX's call wall counts call gamma and its put wall counts put gamma. The data behind them differs too: directionalized volume by default for Unusual Whales, open interest for ZeroGEX. On the same day, the two can land on different strikes.

Both treat the flip with care. Unusual Whales' documentation lists up to five nearby zero crossings and says to read the regime from the sign of net gamma rather than from the flip. ZeroGEX leaves its flip blank when the chain does not support a confident crossing.

## How often each one updates

On Unusual Whales, the GEX heatmap is live on every paid plan, and True GEX for SPX refreshes every 10 minutes on Retail Pro and every minute on Retail Max. Its API documentation says its open-interest greek exposure updates once a day, at the market open.

ZeroGEX recomputes its levels about once a minute through the regular session, on both plans, and its free pages show the same levels about 15 minutes behind.

## Prices

List prices before promotions and tax, as Unusual Whales' [pricing page](https://unusualwhales.com/pricing) showed them on {{unusualwhales:checked}}. Unusual Whales sells yearly plans as well; check its site for the current yearly price. ZeroGEX's prices are the ones on its [Pricing](/pricing) page today.

| Plan | Price | Gamma exposure included |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mo, or {{zgx:basic:annual}}/yr | Every level for all eight symbols, about once a minute |
| ZeroGEX Pro, with API access | {{zgx:pro:monthly}}/mo, or {{zgx:pro:annual}}/yr | The same, plus eight more signals, backtesting, and API access |
| Unusual Whales Retail Basic | {{unusualwhales:basic:monthly}}/mo | The GEX heatmap for every optionable ticker; no True GEX |
| Unusual Whales Retail Pro | {{unusualwhales:pro:monthly}}/mo | Adds True GEX for SPX, every 10 minutes |
| Unusual Whales Retail Max | {{unusualwhales:max:monthly}}/mo | True GEX for SPX every minute |

ZeroGEX Basic costs less than any Unusual Whales dashboard plan, and ZeroGEX Pro costs less than Retail Pro, the first Unusual Whales plan with True GEX. The prices buy different things, though: Unusual Whales' covers the whole options tape, every ticker, alerts, news, and much more than gamma; ZeroGEX's covers gamma on eight symbols, in depth.

**The API.** ZeroGEX Pro includes API access. Unusual Whales sells its API separately, from {{unusualwhales:apiStarter:monthly}} a month for its Options Starter plan, and its pricing FAQ says API plans are data-only, without the website or app. The website and the API together start with its Whale Bundle at {{unusualwhales:bundleBasic:monthly}} a month.

**Trials and refunds.** ZeroGEX Basic monthly starts with a 7-day free trial with nothing charged until it ends, and every other ZeroGEX plan is covered by a 7-day money-back guarantee. Unusual Whales offers a 7-day free trial on monthly Retail Basic and on its API, and a free account with limited, delayed data. Its pricing FAQ says all sales are final, though it will move you to another product within 7 days if you bought the wrong one.

## What you can see for free

- **Unusual Whales:** a free account shows options flow, dashboards, and screeners, delayed two trading days (news 15 minutes, alerts 30 minutes), and its Discord community is free.
- **ZeroGEX:** the gamma flip, call wall, put wall, and net GEX for all eight of its symbols, about 15 minutes delayed and refreshed through the session, with no signup: the market symbols together at [GEX levels today](/gex-levels), and one page per symbol, such as [SPX gamma levels](/spx-gamma-levels). The [Gamma Terminal](/chart) shows a delayed SPY gamma chart for free, and the [MCP server](/education/gamma-levels-in-claude) puts the delayed levels in AI assistants like Claude and ChatGPT.

## Where Unusual Whales is the stronger choice

- **Breadth.** Real-time flow for every options trade on US exchanges, alerts, dark pool prints, news, congressional trades, screeners, futures data, and prediction markets, with a GEX heatmap for every optionable ticker. ZeroGEX covers gamma on eight symbols.
- **Market-maker data for SPX.** Periscope True GEX is built on a Cboe dataset that, Unusual Whales says, separates market-maker orders from customer orders. ZeroGEX uses open interest and the standard convention, and its own methodology agrees that participant-classified data supports a richer reconstruction.
- **Apps and an AI analyst.** iOS and Android apps, push alerts, and Mr. Whale. ZeroGEX is a web app.
- **Community and data.** A trading community it puts at more than 100,000 traders, and daily options and dark pool data downloads on Retail Pro and Max.
- **A broad API.** REST, websocket, and MCP access to its flow, dark pool, and greek exposure data.

## Where ZeroGEX is the stronger choice

- **Price for gamma.** ZeroGEX Basic costs less than any Unusual Whales dashboard plan, and both ZeroGEX plans cost less than Retail Pro, the first with True GEX.
- **Depth on the index complex.** The flip, the walls, max pain, and the Pin Strike on SPX, SPY, QQQ, NDX, ES, and NQ, a gamma heatmap through the session, gamma by expiration, hedging flow, vanna and charm flow, and fourteen signals built on the levels, with their methods set out in the [signals guide](/guides/signals-explained).
- **Every level about once a minute, on both plans.** Unusual Whales' True GEX for SPX refreshes every 10 minutes below its top plan.
- **ES and NQ levels on the futures price.** ZeroGEX builds them from the SPX and NDX chains and carries them onto the futures contract ([how it works](/help/platform/futures-contract-months)), free on a delay at [ES gamma levels](/es-gamma-levels) and [NQ gamma levels](/nq-gamma-levels). Unusual Whales lists live CME futures data on every plan; the pages checked do not say it publishes GEX levels on the futures price.
- **API access included with Pro.** Unusual Whales' API is a separate, data-only plan.
- **Free levels, minutes old.** ZeroGEX's free levels are about 15 minutes behind, with no signup; Unusual Whales' free account sees options flow two trading days late.
- **Your own charts.** Free TradingView and thinkorswim scripts, and auto-updating NinjaTrader, Sierra Chart, and Bookmap studies on Pro ([integrations](/integrations)).
- **A published method and a graded record.** The [Methodology](/methodology) page sets out how the levels are computed and what is modeled, the [Track Record](/track-record) grades every forecast ZeroGEX publishes, misses included, and the [wall study](/education/how-often-do-gamma-walls-break) publishes how often walls actually broke.

## How to decide

- **You want the whole options tape, alerts, and GEX on any ticker in one app:** Unusual Whales.
- **You want SPX market-maker positioning from Cboe's participant data:** Unusual Whales, on Retail Pro or Max.
- **You trade SPX, SPY, QQQ, NDX, ES, or NQ and want the flip and the walls updated about once a minute, for less:** ZeroGEX.
- **You already use Unusual Whales for flow and want a second read on the levels:** compare its walls with ZeroGEX's free [GEX levels today](/gex-levels), no signup needed.

---

Unusual Whales' plans, prices, and features are from [unusualwhales.com](https://unusualwhales.com), including its pricing page, its help article on GEX tools, and its API documentation, checked {{unusualwhales:checked}}, and can change at any time, so confirm them there. ZeroGEX prices on this page are read from its live price list. ZeroGEX is not affiliated with Unusual Whales. Educational content only, not a trade recommendation.
