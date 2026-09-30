# ZeroGEX vs MenthorQ (2026): Gamma Levels, Pricing, and Coverage Compared

*A fair side-by-side of ZeroGEX and MenthorQ: what each platform is built for, how their gamma levels line up, what each plan costs, where MenthorQ is the stronger choice, and where ZeroGEX fits better. MenthorQ's plans, prices, and features come from its own pricing page and guides, checked {{menthorq:checked}}.*

---

## The short version

MenthorQ and ZeroGEX sell the same core thing: options-derived key levels - the strikes where call and put gamma concentrate, and the gamma flip between them - delivered into the charting platforms traders already use. The differences are in breadth, depth, extras, and price.

- **MenthorQ** covers stocks, ETFs, indices, futures, forex, and crypto, with 20+ trading models, 10+ platform integrations, an academy, an AI assistant called QUIN, and live coaching on its Pro plan.
- **ZeroGEX** covers six symbols - SPX, SPY, QQQ, NDX, and the ES and NQ futures - and goes deeper on them: levels recomputed about once a minute through the session, a gamma heatmap, hedging flow, and fourteen signals built on the levels.

If you trade many markets, or want lessons and coaching with your levels, MenthorQ is closer to what you need. If you day trade the index complex and want its levels in depth for less, ZeroGEX is.

## The levels, side by side

The two platforms' core levels line up closely, under different names:

| MenthorQ | ZeroGEX | What it marks |
|---|---|---|
| Call Resistance | Call Wall | The strike carrying the most call gamma |
| Put Support | Put Wall | The strike carrying the most put gamma |
| High Vol Level (HVL) | Gamma Flip | The line between positive and negative modeled dealer gamma |
| 0DTE versions of each | Expiration filter and Pin Strike | The same reads for same-day expirations |

MenthorQ publishes 0DTE versions of its three levels. On ZeroGEX, the Gamma Chart's expiration filter narrows the chain to any set of expirations, 0DTE included, and the walls and the flip follow it; the Pin Strike marks the nearby 0DTE strike where positive dealer gamma and the odds of price reaching it combine most strongly.

ZeroGEX models dealer gamma from the options chain rather than observing it, computes its flip from a gamma profile across a range of prices, and leaves the flip blank when the chain does not support a confident crossing. The method is on its [Methodology](/methodology) page.

### How often the levels update

MenthorQ publishes its levels in end-of-day and intraday versions, and its [intraday guide](https://menthorq.com/guide/intraday-gamma-models/) lists the refresh schedule for each asset class. ZeroGEX recomputes its levels about once a minute through the regular session, on both plans, and its free pages show the same levels about 15 minutes behind.

## Prices

List prices before promotions and tax, checked {{menthorq:checked}}. MenthorQ discounts the first month of a monthly plan - {{menthorq:premium:firstMonth}} for Premium and {{menthorq:pro:firstMonth}} for Pro, applied automatically at checkout - and its Pro plan adds coaching to Premium rather than more data.

| Plan | Billed monthly | Billed yearly |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mo | {{zgx:basic:annual}}/yr (about {{zgx:basic:annual:mo}}/mo) |
| ZeroGEX Pro, with API access | {{zgx:pro:monthly}}/mo | {{zgx:pro:annual}}/yr (about {{zgx:pro:annual:mo}}/mo) |
| MenthorQ Premium | {{menthorq:premium:monthly}}/mo | {{menthorq:premium:annual}}/yr (about {{menthorq:premium:annual:mo}}/mo) |
| MenthorQ Pro, with coaching | {{menthorq:pro:monthly}}/mo | {{menthorq:pro:annual}}/yr (about {{menthorq:pro:annual:mo}}/mo) |

Both ZeroGEX plans cost less than either MenthorQ plan, monthly or yearly. MenthorQ's discounted first month of Premium costs the same as a regular month of ZeroGEX Basic. The prices buy different things, though: MenthorQ's covers far more markets, more integrations, an academy, and on Pro, coaching; ZeroGEX's covers six symbols in depth.

ZeroGEX Basic monthly starts with a 7-day free trial, and every other ZeroGEX plan is covered by a 7-day money-back guarantee. Check MenthorQ's site for its current trial and refund terms. The full breakdown is on the [Pricing](/pricing) page.

## Where MenthorQ is the stronger choice

- **Breadth.** Stocks, ETFs, indices, futures, forex, and crypto. ZeroGEX covers six symbols.
- **More platforms.** Integrations with TradingView, NinjaTrader, Sierra Chart, Bookmap, ATAS, Quantower, MotiveWave, Tickblaze, and TrendSpider. ZeroGEX works with four: TradingView, thinkorswim, NinjaTrader, and Sierra Chart.
- **Learning and coaching.** An academy with 350+ lessons, 350+ guides, and webinars and podcasts, and on Pro, live trading sessions, weekly mentorship meetings, and a monthly strategy session. ZeroGEX has education articles and a help center, and no coaching.
- **More models.** 20+ trading models, including Blind Spot levels and the Q-Score, and QUIN, an AI assistant that screens setups and compares assets across its metrics. ZeroGEX's AI access is its free MCP server, which puts the levels in assistants like Claude and ChatGPT.

## Where ZeroGEX is the stronger choice

- **Price.** Both ZeroGEX plans cost less than either MenthorQ plan, and ZeroGEX Pro includes API access.
- **Levels recomputed about once a minute.** Through the regular session, on both plans. MenthorQ's intraday guide lists its own schedule.
- **Depth on the index complex.** A gamma heatmap through the session, gamma by expiration, vanna and charm flow, hedging flow, and fourteen signals built on the levels, with their methods set out in the [signals guide](/guides/signals-explained).
- **A published method and a graded record.** ZeroGEX documents how it calculates the gamma flip on its [Methodology](/methodology) page and grades every forecast it publishes, misses included, on its [Track Record](/track-record).
- **Levels where you already chart.** Free TradingView and thinkorswim scripts, and NinjaTrader and Sierra Chart indicators that update themselves on Pro. See [Integrations](/integrations).
- **A free way to check first.** The [SPX gamma levels](/spx-gamma-levels) page and its siblings need no signup, and neither does the [MCP server](/education/gamma-levels-in-claude).

## How to decide

- **You trade stocks, forex, crypto, or futures beyond ES and NQ:** MenthorQ.
- **You want an academy, mentorship, or live trading sessions with your levels:** MenthorQ.
- **You day trade SPX, SPY, QQQ, NDX, ES, or NQ and want the flip, the walls, and dealer-positioning signals in depth, for less:** ZeroGEX.
- **You are not sure yet:** open the free [SPX gamma levels](/spx-gamma-levels) page, no signup needed, and compare it with the levels you use today.

---

MenthorQ's plans, prices, and features are from [menthorq.com](https://menthorq.com) and its guides, checked {{menthorq:checked}}, and can change at any time, so confirm them there. ZeroGEX prices on this page are read from its live price list. ZeroGEX is not affiliated with MenthorQ. Educational content only, not a trade recommendation.
