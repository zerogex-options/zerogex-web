# ZeroGEX vs Volland (2026): Dealer Positioning, Greeks, and Pricing Compared

*A fair side-by-side of ZeroGEX and Volland: how each one models dealer positioning, which greeks and levels each shows, how often each updates, what each plan costs, what you can try before paying, where Volland is the stronger choice, and where ZeroGEX fits better. Volland's plans, prices, and features come from its own site and help center, checked {{volland:checked}}.*

---

## The short version

Volland and ZeroGEX both try to answer the same question: where will option dealers have to buy or sell the underlying? They answer it in different ways, and they ask different amounts of study from you.

- **Volland** builds its picture of the dealer book from individual trades. Its help center says it reads every options trade on the OPRA feed and decides, trade by trade, whether the dealer side bought or wrote it. It charts the resulting exposure for a long list of greeks - gamma, vanna, charm, delta decay and more - across more than 4,500 tickers, updated every two minutes, in workspaces you build from widgets. Its plans run from {{volland:volhacks:monthly}} to {{volland:institutional:monthly}} a month, and its help center says users take at least a month, on average, to learn it.
- **ZeroGEX** models positioning from open interest under the standard convention and publishes the result as named levels - the gamma flip, the call wall, the put wall, max pain, and the Pin Strike - for SPX, SPY, QQQ, NDX, the ES and NQ futures, and two stocks, NVDA and MSFT. The levels are recomputed about once a minute on both plans, with hedging flow, vanna and charm flow, and fourteen signals for the six index products built on top, from {{zgx:basic:monthly}} a month.

If you want the deepest greek-by-greek view of the dealer book across thousands of tickers, and you are ready to put in the study time, Volland is closer to what you need. If you trade the index complex and want the levels as prices you can act on, moving through the session, for much less, ZeroGEX is.

## How each one models dealer positioning

This is the real difference between the two, and both are open about their approach.

**Volland works from the tape.** Its [help center](https://vol.land/help) describes the method: it uses a real-time feed of executed option trades from OPRA, and for each order it determines whether the dealer side bought or wrote, using the executed price, the implied volatility at execution, a binomial fair value, and the bid/ask spread as a guide. It then adds up the greeks each trade hands the dealer, strike by strike and expiration by expiration. Volland is openly critical of the alternative: its help center says GEX built from open interest "has proven to be too reductive to be accurate."

**ZeroGEX works from open interest.** It applies the traditional convention that dealers are net long the calls customers sell and net short the puts customers buy, and its [Methodology](/methodology) page calls that what it is: a disclosed assumption, not a measurement. Open interest is published by the clearinghouse once a day, so positions opened during a session show up in the next morning's numbers; within the session, ZeroGEX re-prices the book about once a minute as spot, time, and implied volatility move. The methodology page also lists where the convention is most likely to be wrong, such as heavy put selling or call buying into a squeeze.

Neither approach is a direct view of any dealer's inventory. Volland's counts new positions as they trade, and depends on reading who was on each side of a trade from its price, which ZeroGEX's methodology treats as an inference rather than an observation. ZeroGEX's is simpler and steady from one session to the next, and can miss a shift in positioning until the open interest catches up. Expect the two to disagree at times.

## Greeks and levels, side by side

| | Volland | ZeroGEX |
|---|---|---|
| Gamma by strike | Exposure charts, from the Swing plan up | A gamma strike profile, and a gamma heatmap through the session |
| Vanna and charm | Exposure charts by strike | Aggregate vanna and charm flow, and per-strike vanna and charm in the GEX table |
| Other greeks | Delta, delta-adjusted gamma, delta decay (from the 0DTE plan), rho, theta, vega, and vomma | Not published; see [why ZeroGEX does not headline delta exposure](/education/why-we-dont-publish-dex) |
| The regime line | Its "line in the sand," the price where, it says, dealers would have to change how they hedge | The gamma flip, from a gamma profile across a range of prices |
| Support and resistance | Read from the exposure charts; its help center says its VolHacks widgets narrow levels into buckets and recommends in-depth education to go further | Published as prices: the call wall, put wall, max pain, Pin Strike, and GEX King |

Volland's help center takes a position on the gamma flip as well: it says traders using "reductive 'GEX' assumptions" would call its line in the sand the gamma flip, "but they aren't measuring it even close to correctly." The two lines come from different models, so expect them to sit at different prices. ZeroGEX leaves its flip blank when the chain does not support a confident crossing.

## How often each one updates

Volland's help center says every tier updates every two minutes, and some widgets take longer: the 0DTE widget refreshes every five minutes, and its API FAQ says API data updates every five minutes during the market day.

ZeroGEX recomputes its levels about once a minute through the regular session, on both plans, and its free pages show the same levels about 15 minutes behind.

## Coverage

Volland's pricing page says its features cover about 4,500 tickers, and its help center says its model focuses on the 1,000 most liquid by option volume. Its pricing page puts the /ES and /NQ futures on the Universe plan and lists more futures as coming soon.

ZeroGEX covers eight symbols: SPX, SPY, QQQ, NDX, ES, NQ, NVDA, and MSFT. Its ES and NQ levels sit on the futures price on both plans ([how it works](/help/platform/futures-contract-months)).

## Prices

List prices before tax, as Volland's [pricing page](https://vol.land/pricing) showed them on {{volland:checked}}. Volland sells monthly plans only; its help center says it does not offer yearly plans. ZeroGEX's prices are the ones on its [Pricing](/pricing) page today.

| Plan | Price | What it includes |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mo, or {{zgx:basic:annual}}/yr | Levels for all eight symbols, updated about once a minute, the gamma heatmap, hedging flow, vanna and charm flow, and six signals |
| ZeroGEX Pro | {{zgx:pro:monthly}}/mo, or {{zgx:pro:annual}}/yr | Adds eight more signals, backtesting, and API access |
| Volland VolHacks | {{volland:volhacks:monthly}}/mo | Screeners: Quad Screener, Extremes, Catalyst Impact, and Spot Vol Beta |
| Volland Swing | {{volland:swing:monthly}}/mo | Adds the Ticker Widget and exposure charts |
| Volland 0DTE | {{volland:zerodte:monthly}}/mo | Adds the 0DTE widget, delta decay, a liquidity widget, and notional hedging exposure |
| Volland Insight | {{volland:insight:monthly}}/mo | Adds aggregate greek trend, dealer premiums, the volatility plane heatmap, and more |
| Volland Universe | {{volland:universe:monthly}}/mo | Adds term structure aggregate exposure and the /ES and /NQ futures |
| Volland Institutional | {{volland:institutional:monthly}}/mo | Adds floating strike, implied skew, and theo curves |

Both ZeroGEX plans cost less than Volland's cheapest plan, and a month of ZeroGEX Pro costs less than half a month of Volland Swing, the first Volland plan with exposure charts. A year of ZeroGEX Pro costs about the same as two months of Volland Swing. The prices buy different things, though: Volland's covers thousands of tickers and ten greeks; ZeroGEX's covers eight symbols, with the levels as prices and signals built on them.

**The API.** ZeroGEX Pro includes API access. Volland sells API calls separately, 2,000 calls for {{volland:api:pack}}, and only to subscribers on its 0DTE plan or higher. Its [API page](https://vol.land/api) says the API data updates every five minutes during the market day and that no historical data is available through it.

**Trials and refunds.** ZeroGEX Basic monthly starts with a 7-day free trial with nothing charged until it ends, and every other ZeroGEX plan is covered by a 7-day money-back guarantee. Volland does not offer a free trial of its live dashboard; its help center points to the Volland Academy, a free self-directed course, instead. Its [terms](https://vol.land/terms-of-service) say all sales are final.

## What you can see for free

- **Volland** points new users to the Volland Academy, which its help center describes as a free self-directed learning platform (it asks you to sign in), to its Discord community, and to the Wizard of Ops YouTube channel for its educational videos.
- **ZeroGEX** publishes the gamma flip, call wall, put wall, and net GEX for all eight of its symbols, about 15 minutes delayed and refreshed through the session, with no signup: the market symbols together at [GEX levels today](/gex-levels), and one page per symbol, such as [SPX gamma levels](/spx-gamma-levels). The [Gamma Terminal](/chart) shows a delayed SPY gamma chart for free, and the [MCP server](/education/gamma-levels-in-claude) puts the delayed levels in AI assistants like Claude and ChatGPT.

## Where Volland is the stronger choice

- **Greek depth.** Exposure charts by strike for gamma, vanna, and charm, plus delta, delta-adjusted gamma, delta decay, rho, theta, vega, and vomma. ZeroGEX maps gamma by strike and reads vanna and charm as aggregate flows and per-strike figures rather than separate charts.
- **Positioning that moves with the day's trades.** Volland's model adds each trade as it prints, so new positions count during the session. ZeroGEX's open interest picks them up the next morning.
- **Breadth.** About 4,500 tickers on Volland's pricing page, against eight on ZeroGEX.
- **Custom workspaces.** Unlimited personalized workspaces built from widgets.
- **Institutional tools.** Floating strike, implied skew, and theo curves on its top plan.
- **A community built around it.** A Discord with subscriber channels, the Volland Academy, a user guide, and private one-on-one sessions.

## Where ZeroGEX is the stronger choice

- **Price, and a way to try it.** Both ZeroGEX plans cost less than Volland's cheapest plan, ZeroGEX Basic monthly starts with a 7-day free trial, and yearly billing costs less again. Volland has no free trial of its dashboard, sells monthly plans only, and its terms say all sales are final.
- **Levels as prices.** The gamma flip, call wall, put wall, max pain, and Pin Strike, published as numbers you can put on a chart. Volland's help center recommends in-depth education to turn its data into support and resistance.
- **Updates about once a minute, on both plans.** Volland updates every two minutes, and its 0DTE widget every five.
- **ES and NQ on both plans.** ZeroGEX builds ES levels from the SPX chain and NQ levels from the NDX chain and carries them onto the futures price, free on a delay at [ES gamma levels](/es-gamma-levels) and [NQ gamma levels](/nq-gamma-levels). Volland's futures are on its Universe plan.
- **API access included with Pro.** Volland sells API calls on top of a 0DTE plan or higher.
- **Your own charts.** Free TradingView and thinkorswim scripts, and auto-updating NinjaTrader, Sierra Chart, and Bookmap studies on Pro ([integrations](/integrations)).
- **Free levels and a graded record.** Delayed levels for all eight symbols with no signup, a [Methodology](/methodology) page that says what is modeled and what is not, a [Track Record](/track-record) that grades every forecast, misses included, and a [wall study](/education/how-often-do-gamma-walls-break) on how often walls actually broke.

## How to decide

- **You want every greek charted by strike, across thousands of tickers, and you will put in the study time:** Volland.
- **You want positioning built trade by trade through the session rather than from open interest:** Volland.
- **You trade SPX, SPY, QQQ, NDX, ES, or NQ and want the flip and the walls as prices, updated about once a minute, for less:** ZeroGEX.
- **You want to look before you pay:** open [GEX levels today](/gex-levels), no signup needed, or start the ZeroGEX Basic trial.

---

Volland's plans, prices, and features are from [vol.land](https://vol.land), including its pricing page, help center, API page, and terms of service, checked {{volland:checked}}, and can change at any time, so confirm them there. ZeroGEX prices on this page are read from its live price list. ZeroGEX is not affiliated with Volland, a registered trademark of Ad Deum Funds. Educational content only, not a trade recommendation.
