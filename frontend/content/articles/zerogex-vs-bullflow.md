# ZeroGEX vs Bullflow (2026): Pricing, GEX, and Options Flow Compared

*A fair side-by-side of ZeroGEX and Bullflow: what each platform is built for, what each plan costs, where Bullflow is the stronger choice, and where a dedicated gamma-levels tool fits better. Bullflow's plans and prices come from its public pricing page as of {{bullflow:checked}}, so check them there before you buy.*

---

## The short version

The two overlap less than their price lists suggest.

- **Bullflow** is built around real-time unusual options flow, with dark pool trades, mobile and desktop alerts, a Discord community, and iOS and Android apps. Gamma exposure is one set of tools inside it, and its tools reach well beyond the index.
- **ZeroGEX** is built around one job: modeled dealer positioning - the gamma flip, the call and put walls, and the signals built on them - for six symbols: SPX, SPY, QQQ, NDX, and the ES and NQ futures.

If your trade ideas come from big options orders in single stocks, Bullflow is closer to what you need. If you day trade the index complex and want its levels in depth, ZeroGEX is. Some traders run one of each.

## Prices side by side

List prices before promotions and tax. Bullflow's are from its pricing page on {{bullflow:checked}}. ZeroGEX's are the ones on the [Pricing](/pricing) page today.

| Plan | Billed monthly | Billed yearly |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mo | {{zgx:basic:annual}}/yr (about {{zgx:basic:annual:mo}}/mo) |
| Bullflow Basic | {{bullflow:basic:monthly}}/mo | {{bullflow:basic:annual}}/yr ({{bullflow:basic:annual:mo}}/mo) |
| ZeroGEX Pro | {{zgx:pro:monthly}}/mo | {{zgx:pro:annual}}/yr (about {{zgx:pro:annual:mo}}/mo) |
| Bullflow Premium | {{bullflow:premium:monthly}}/mo | {{bullflow:premium:annual}}/yr ({{bullflow:premium:annual:mo}}/mo) |
| Bullflow Data API | {{bullflow:dataApi:monthly}}/mo | {{bullflow:dataApi:annual}}/yr ({{bullflow:dataApi:annual:mo}}/mo) |

Month to month, the entry plans cost the same, and ZeroGEX Pro costs less than Bullflow Premium. On yearly billing, ZeroGEX costs less at both levels. API access is part of ZeroGEX Pro. At Bullflow it is a separate plan, which includes Premium.

ZeroGEX Basic monthly starts with a 7-day free trial, and every other ZeroGEX plan is covered by a 7-day money-back guarantee. Check Bullflow's site for its current trial and refund terms.

## What each plan includes

### Bullflow

Bullflow describes itself as a real-time unusual options flow and dark pool tracker. Its pricing page lists:

- **Basic:** real-time and historical options flow, gamma and net GEX levels, mobile and desktop alerts, AI trade signals, index flow for SPX and VIX, an options heat map, a Discord community, and tutorials.
- **Premium:** everything in Basic, plus the Bullflow Terminal workspace, real-time and historical dark pool trades with alerts, AI agent trade analysis, a gamma exposure bubble chart and multi-map view, a GEX heatmap replay it lists for 1,000+ tickers, vanna exposure data, and what it calls "500% faster GEX update speeds."
- **Data API:** everything in Premium, plus API keys, a real-time alerts API, a historical backtesting endpoint, net GEX and net vanna endpoints, up to 150 custom alerts, and access to an MCP server for coding agents.

Bullflow also publishes iOS and Android apps.

### ZeroGEX

ZeroGEX covers six symbols and nothing else: SPX, SPY, QQQ, NDX, and the ES and NQ futures, whose levels are the SPX and NDX option levels carried onto the futures price. It does not cover single stocks or dark pool prints, by design.

- **Basic:** real-time gamma levels (the gamma flip, call and put walls, and max pain), the Main Dashboard and the live Gamma Terminal, a dashboard you build from widgets, every Metrics page (dealer positioning, the GEX heatmap and strike profile, options flow, Smart Money, Hedging Flow, volatility, and technicals), the six Basic Signals, the Strategy Builder, and live options quotes.
- **Pro:** everything in Basic, plus Trade Bias, the Composite Score, the eight Advanced Signals, API access, auto-updating NinjaTrader and Sierra Chart indicators, and TradeWorkz™ (beta): bot trading, backtesting, and pattern insights.
- **Free, with no account:** 15-minute-delayed levels for all six symbols, TradingView and thinkorswim scripts, a hosted MCP server that puts the same levels in AI assistants like Claude and ChatGPT, session replay, and a public track record of every forecast.

The full breakdown is on the [Pricing](/pricing) page.

## Where Bullflow is the stronger choice

- **Breadth.** Bullflow's flow and GEX tools reach far beyond the index. If your ideas come from single-stock options activity, ZeroGEX does not cover it.
- **Dark pool trades.** Bullflow Premium has them. ZeroGEX has none.
- **Alerts and mobile apps.** Bullflow sends mobile and desktop alerts and has native apps. ZeroGEX runs in the browser, on desktop or phone, and its signal triggers show inside the app rather than as push notifications.
- **Community.** Bullflow includes a Discord community. ZeroGEX does not run one.
- **Custom alerts by API.** Bullflow's Data API plan includes up to 150 custom alerts.

## Where ZeroGEX is the stronger choice

- **Depth on the index complex.** Everything ZeroGEX builds is aimed at SPX, SPY, QQQ, NDX, ES, and NQ: per-expiration gamma, vanna and charm flow, hedging flow, and fourteen signals built on the levels, with their methods set out in the [signals guide](/guides/signals-explained).
- **The same real-time levels on both plans.** ZeroGEX Basic gets the levels Pro gets, recomputed about once a minute. Bullflow lists faster GEX updates as a Premium feature.
- **A published method and a graded record.** ZeroGEX documents how it calculates the gamma flip on its [Methodology](/methodology) page and grades every forecast it publishes, misses included, on its [Track Record](/track-record).
- **Levels where you already chart.** Free TradingView and thinkorswim scripts, and NinjaTrader and Sierra Chart indicators that update themselves on Pro. See [Integrations](/integrations).
- **API access without a separate plan,** and a lower yearly price at both levels.
- **A free way to check the levels first.** The [SPX gamma levels](/spx-gamma-levels) page and its siblings need no signup, and neither does the [MCP server](/education/gamma-levels-in-claude).

## Using both

Flow and positioning answer different questions, so pairing a flow scanner with a positioning tool is a reasonable setup: the flow shows what is being bought, and the levels show where a move is likely to run into dealer hedging. If you already use Bullflow for single-stock flow, ZeroGEX adds a deeper read of the index levels, and ZeroGEX Basic on yearly billing costs {{zgx:basic:annual}} a year.

## How to decide

- **You trade single stocks off options activity:** Bullflow, or another flow scanner.
- **You want dark pool prints, push alerts on your phone, or a trading community:** Bullflow.
- **You day trade SPX, SPY, QQQ, NDX, ES, or NQ and want the flip, the walls, and dealer-positioning signals in depth:** ZeroGEX.
- **You are not sure yet:** open the free [SPX gamma levels](/spx-gamma-levels) page, no signup needed, and compare it with what you use today.

---

Bullflow's plans and prices are from [bullflow.io/pricing](https://www.bullflow.io/pricing) as of {{bullflow:checked}} and can change at any time, so confirm them there. ZeroGEX prices on this page are read from its live price list. ZeroGEX is not affiliated with Bullflow. Educational content only, not a trade recommendation.
