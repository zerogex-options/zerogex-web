# ZeroGEX vs SpotGamma (2026): Gamma Levels, Pricing, and Free Tools Compared

*A fair side-by-side of ZeroGEX and SpotGamma: what each service is built for, how their key levels line up, how often each one updates, what each plan costs, what you can see for free, where SpotGamma is the stronger choice, and where ZeroGEX fits better. SpotGamma's plans, prices, and features come from its own site and checkout pages, checked {{spotgamma:checked}}.*

---

## The short version

SpotGamma and ZeroGEX both publish options-derived key levels: the call wall and put wall where gamma concentrates, and the price where modeled dealer gamma crosses zero. They differ in what comes around those levels and how often they move.

- **SpotGamma** is a research service as much as a data tool. Every plan gets its Founder's Note before the open and after the close each trading day, key levels for the major US indices, and daily GEX levels for more than 3,500 stocks, indices, and ETFs. Its homepage puts its real-time tools, such as TRACE (an S&P 500 heatmap) and HIRO (its real-time hedging indicator), on its higher plan.
- **ZeroGEX** covers six symbols - SPX, SPY, QQQ, NDX, and the ES and NQ futures - and goes deeper on them: levels recomputed about once a minute through the session on both plans, a gamma heatmap, hedging flow, and fourteen signals built on the levels, with a published method and a graded record.

If you want a daily research note, single-stock GEX across thousands of names, or SpotGamma's own proprietary levels, SpotGamma is closer to what you need. If you day trade the index complex and want its levels moving through the session for less, ZeroGEX is.

## The levels, side by side

| SpotGamma | ZeroGEX | What it marks |
|---|---|---|
| Call Wall | Call Wall | The strike with the largest concentration of call gamma |
| Put Wall | Put Wall | The same on the put side |
| Zero Gamma | Gamma Flip | The price where modeled dealer gamma crosses zero |
| Volatility Trigger | No counterpart | A proprietary SpotGamma level |
| Risk Pivot | No counterpart | A proprietary SpotGamma level |

The walls share a definition. SpotGamma's [call wall explainer](https://spotgamma.com/call-wall-put-wall-explained/) describes the call wall as the strike with the largest concentration of call gamma, and the put wall as its counterpart on the put side. ZeroGEX defines them almost the same way: the strike above spot carrying the heaviest call gamma exposure, and the strike below spot carrying the heaviest put gamma exposure. Both treat a wall as a reference rather than a hard ceiling or floor. ZeroGEX measured how often walls actually held: in its study of 737 wall tests, S&P walls held about two times in three within an hour of a test and Nasdaq walls about half ([the study](/education/how-often-do-gamma-walls-break)).

Zero gamma and the gamma flip are built the same way in principle. SpotGamma's [GEX guide](https://spotgamma.com/gamma-exposure-gex/) describes recalculating option gamma over a range of hypothetical spot prices and locating the crossover through zero. ZeroGEX computes its flip from a gamma profile across a range of prices too, and leaves the flip blank when the chain does not support a confident crossing. The method is on its [Methodology](/methodology) page.

SpotGamma also publishes two levels of its own. It describes the Volatility Trigger as a proprietary level derived from its estimated distribution of gamma rather than a zero crossing, and an older post of its own calls it the last major level of positive-gamma support, which may sit several points above zero gamma. It describes the Risk Pivot as a scenario level that frames where market structure may become more or less supportive; the pages checked do not say how it is calculated. ZeroGEX's nearest level to either is the gamma flip. ZeroGEX adds levels of its own: GEX King, the strike carrying the most gamma, and the Pin Strike, the nearby 0DTE strike where positive dealer gamma and the odds of price reaching it combine most strongly.

### How dealer positions are modeled

Neither service sees dealer inventory directly. ZeroGEX models it from open interest under the standard convention that dealers are long calls and short puts. SpotGamma's free gamma chart uses that same standard convention, and SpotGamma says its paid model, SGOI, estimates market-maker and buyside positioning strike by strike. Different models can put the walls at different strikes on the same day, so expect the two services' levels to differ at times.

### How often the levels update

SpotGamma's Founder's Note, with its levels for the major US indices, is delivered before the open and after the close every trading day on every plan, and its Equity Hub levels for individual stocks are updated before the open each day. Its homepage FAQ puts HIRO, TRACE, and its Volatility Dashboard on the Alpha plan, though some of its other pages list them on every plan, so confirm with SpotGamma which plan includes what you need.

ZeroGEX recomputes its levels about once a minute through the regular session, on both plans, and its free pages show the same levels about 15 minutes behind.

## Prices

List prices before promotions and tax, as SpotGamma's checkout forms charged them on {{spotgamma:checked}}. SpotGamma's pricing page also showed first-month offers that its checkout forms did not apply that day, so check its site for the current offer. SpotGamma also sells an Institutional plan, which is not compared here. ZeroGEX's prices are the ones on its [Pricing](/pricing) page today.

| Plan | Billed monthly | Billed yearly |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mo | {{zgx:basic:annual}}/yr (about {{zgx:basic:annual:mo}}/mo) |
| ZeroGEX Pro, with API access | {{zgx:pro:monthly}}/mo | {{zgx:pro:annual}}/yr (about {{zgx:pro:annual:mo}}/mo) |
| SpotGamma Essential | {{spotgamma:essential:monthly}}/mo | {{spotgamma:essential:annual}}/yr (about {{spotgamma:essential:annual:mo}}/mo) |
| SpotGamma Alpha | {{spotgamma:alpha:monthly}}/mo | {{spotgamma:alpha:annual}}/yr (about {{spotgamma:alpha:annual:mo}}/mo) |

Both ZeroGEX plans cost less than either SpotGamma plan, monthly or yearly, and a year of ZeroGEX Pro costs the same as one month of SpotGamma Alpha. The prices buy different things, though: SpotGamma's covers thousands of stocks, a twice-daily research note, webinars, and on Alpha, its real-time tools; ZeroGEX's covers six symbols in depth, with levels that move through the session on both plans.

The trials and refunds differ too. ZeroGEX Basic monthly starts with a 7-day free trial, with a card on file and nothing charged until it ends, and every other ZeroGEX plan is covered by a 7-day money-back guarantee. SpotGamma's pricing page lists no free trial on its paid plans; separately, it offers a free week of its Opening Setup daily report, with no card needed. Its terms say subscription payments are non-refundable unless otherwise indicated.

## What you can see for free

- **SpotGamma** publishes a free [SPX gamma exposure chart](https://spotgamma.com/free-tools/spx-gamma-exposure/), which it says is updated daily, along with an options profit calculator and an implied earnings chart.
- **ZeroGEX** publishes the gamma flip, call wall, put wall, and net GEX for all six of its symbols, about 15 minutes delayed and refreshed through the session, with no signup: every symbol on one page at [GEX levels today](/gex-levels), and one page per symbol, such as [SPX gamma levels](/spx-gamma-levels). The [Gamma Terminal](/chart) shows a delayed SPY gamma chart for free, and the [MCP server](/education/gamma-levels-in-claude) puts the delayed levels in AI assistants like Claude and ChatGPT.

## Where SpotGamma is the stronger choice

- **Research and commentary.** The Founder's Note before the open and after the close every trading day, on every plan, plus live weekly webinars, a Discord community, and on Alpha, live daily training sessions. ZeroGEX has education articles and a help center, and no daily note.
- **Breadth.** Daily GEX levels for more than 3,500 US stocks, indices, and ETFs in its Equity Hub, and on Alpha, HIRO across more than 3,000 stocks. ZeroGEX covers six symbols.
- **Its own positioning model and levels.** SGOI, its estimate of market-maker and buyside positioning, and the Volatility Trigger and Risk Pivot. ZeroGEX uses the standard convention and publishes no equivalent of either level.
- **More platforms.** SpotGamma lists integrations with TradingView, thinkorswim, NinjaTrader, Sierra Chart, Bookmap, TrendSpider, Jigsaw, eSignal, and EdgePro. ZeroGEX works with five: TradingView, thinkorswim, NinjaTrader, Sierra Chart, and SabrTrader.

## Where ZeroGEX is the stronger choice

- **Price.** Both ZeroGEX plans cost less than either SpotGamma plan, and ZeroGEX Pro includes API access. SpotGamma's Essential and Alpha plan lists do not include an API.
- **Levels that move through the session on both plans.** About once a minute, on Basic as well as Pro. SpotGamma's pages describe levels updated before the open each day, and its homepage puts its real-time tools on Alpha.
- **ES and NQ on the futures price.** ZeroGEX builds ES levels from the SPX chain and NQ levels from the NDX chain and projects them onto the futures contract it quotes ([how it works](/help/platform/futures-contract-months)), free on a delay at [ES gamma levels](/es-gamma-levels) and [NQ gamma levels](/nq-gamma-levels). SpotGamma's site says its levels integrate with futures platforms, but the pages checked do not say it publishes levels on the futures price.
- **More free.** All six symbols' levels, refreshed through the session on a delay, against SpotGamma's daily SPX chart.
- **A published method and a graded record.** The [Methodology](/methodology) page sets out how the levels are computed, the [Track Record](/track-record) grades every forecast ZeroGEX publishes, misses included, and the [wall study](/education/how-often-do-gamma-walls-break) publishes how often walls actually broke.
- **Depth on the index complex.** A gamma heatmap through the session, gamma by expiration, vanna and charm flow, hedging flow, and fourteen signals built on the levels, with their methods set out in the [signals guide](/guides/signals-explained).

## How to decide

- **You want a daily research note with your levels, or webinars and training:** SpotGamma.
- **You trade single stocks and want GEX levels across thousands of names:** SpotGamma.
- **You day trade SPX, SPY, QQQ, NDX, ES, or NQ and want the flip and the walls moving through the session, for less:** ZeroGEX.
- **You are looking for a free SpotGamma alternative:** open [GEX levels today](/gex-levels), no signup needed, and compare it with the levels you use now.

---

SpotGamma's plans, prices, and features are from [spotgamma.com](https://spotgamma.com) and its checkout pages, checked {{spotgamma:checked}}, and can change at any time, so confirm them there. ZeroGEX prices on this page are read from its live price list. ZeroGEX is not affiliated with SpotGamma. Educational content only, not a trade recommendation.
