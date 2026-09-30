# ZeroGEX vs Quant Data (2026): GEX Maps, Pricing, and Coverage Compared

*A fair side-by-side of ZeroGEX and Quant Data (quantdata.us): what each platform is built for, how Quant Data's Interval Map and ZeroGEX's GEX Heatmap compare, what the APIs cost, where Quant Data is the stronger choice, and where a dedicated index-levels tool fits better. Quant Data's details come from its own site, help center, and app listings, checked {{quantdata:checked}}.*

---

## The short version

- **Quant Data** is built around real-time options order flow, with dark and lit pool prints, news, alerts, and iOS and Android apps. Its exposure tools, including the Interval Map, cover any U.S. stock or index with listed options.
- **ZeroGEX** is built around one job: modeled dealer positioning - the gamma flip, the call and put walls, and the signals built on them - for six symbols: SPX, SPY, QQQ, NDX, and the ES and NQ futures.

If your trades start from order flow across the whole market, Quant Data is closer to what you need. If you day trade the index complex and want its levels in depth, ZeroGEX is.

## The Interval Map and the GEX Heatmap

Quant Data's best-known view is the Interval Map: strikes up the side, the session across, and one bubble per strike per interval, sized by the exposure and colored green for positive and red for negative, with the underlying's price drawn through it. It can show gamma, delta, vanna, or charm exposure, at intervals from one minute up, as raw values or as the change from one interval to the next.

ZeroGEX's closest view is the GEX Heatmap, included with Basic: net dealer gamma by strike through the session, orange for positive and blue for negative, with the price candles and the gamma flip drawn on top ([how to read it](/help/platform/reading-charts)). On the Dealer Positioning page, a second heatmap sets strikes against days to expiration, out to a week, so you can see which expirations carry the gamma at each strike.

The differences run both ways:

- **More exposures and tickers on Quant Data.** ZeroGEX maps gamma only, on six symbols. It reads vanna and charm as a signal rather than a map, and it does not publish delta exposure, on purpose: [here is why](/education/why-we-dont-publish-dex).
- **The regime line on ZeroGEX.** The gamma flip is drawn on the heatmap itself, from a gamma profile computed across a range of prices, so price, the strikes, and the regime line sit in one picture. The method is on the [Methodology](/methodology) page.

Both tools model dealer gamma the same basic way: from the options chain, counting calls as positive and puts as negative. Quant Data's help center describes its figures as an estimate, not a direct look into any dealer's inventory, and ZeroGEX says the same.

### Reading a strike that "builds" during the day

Open interest is published once a day, after the close. On a gamma map built from it, a strike's color changes during the session because its options are repriced as price, time, and implied volatility move, not because dealers opened new positions. Near expiration, gamma near the money rises as time runs out, so a 0DTE strike next to price can deepen through the day with no new positions at all. Read a growing bubble or band as "this strike matters more as the clock runs," and read the flow separately. On ZeroGEX, that is the Hedging Flow page, which estimates the hedge implied by today's trades ([how it works](/education/hedging-flow-explained)).

## Prices

List prices before promotions and tax, checked {{quantdata:checked}}. Quant Data's platform plan, which covers its web dashboard and its iOS and Android apps, is {{quantdata:platform:monthly}} a month, or {{quantdata:platform:annual}} a year, with a 7-day free trial on either. Both prices are for non-professional traders; registered professionals are sent to a separate Professional plan. Its API is a separate plan again. ZeroGEX's prices are the ones on its [Pricing](/pricing) page today.

| Plan | Billed monthly | Billed yearly |
|---|---|---|
| ZeroGEX Basic | {{zgx:basic:monthly}}/mo | {{zgx:basic:annual}}/yr (about {{zgx:basic:annual:mo}}/mo) |
| ZeroGEX Pro, with API access | {{zgx:pro:monthly}}/mo | {{zgx:pro:annual}}/yr (about {{zgx:pro:annual:mo}}/mo) |
| Quant Data, non-professional | {{quantdata:platform:monthly}}/mo | {{quantdata:platform:annual}}/yr (about {{quantdata:platform:annual:mo}}/mo) |
| Quant Data API plan | {{quantdata:api:monthly}}/mo | {{quantdata:api:annual}}/yr (about {{quantdata:api:annual:mo}}/mo) |

Both ZeroGEX plans cost less than Quant Data's platform plan, monthly or yearly, and ZeroGEX Pro includes the API access that Quant Data sells as a separate plan. The prices buy different things, though: Quant Data's covers order flow, dark pool prints, news, and exposure maps across 6,000+ tickers, and ZeroGEX's covers six symbols in depth.

The two APIs are not the same size either. Quant Data's covers 30+ endpoints across 6,000+ tickers, including dark pool prints and implied volatility surfaces, with a year of history and a hosted MCP server. ZeroGEX's covers the six symbols it tracks: levels, GEX, flow, signals, and their history.

ZeroGEX Basic monthly starts with a 7-day free trial, and every other ZeroGEX plan is covered by a 7-day money-back guarantee. The full breakdown is on the [Pricing](/pricing) page.

## Where Quant Data is the stronger choice

- **Breadth.** Order flow and exposure maps for any U.S. stock or index with listed options. ZeroGEX covers six symbols.
- **Order flow, dark pool prints, and news in one feed.** That is Quant Data's core. ZeroGEX has no dark pool data or news feed, and its flow pages cover only the index complex.
- **More exposure types on the map.** Delta, vanna, and charm alongside gamma, at intervals you choose.
- **Mobile apps and push alerts.** Quant Data has native iOS and Android apps with push notifications. ZeroGEX runs in the browser, on desktop or phone, and its signal triggers show inside the app.
- **A bigger API.** 30+ endpoints, a year of history, and dark pool data, for building your own tools across many tickers.
- **Support around the clock.** Quant Data's plans list 24/7 live chat support. ZeroGEX support is by email.

## Where ZeroGEX is the stronger choice

- **Depth on the index complex.** Everything ZeroGEX builds is aimed at SPX, SPY, QQQ, NDX, ES, and NQ: the gamma flip, the walls, gamma by expiration, vanna and charm flow, hedging flow, and fourteen signals built on the levels, with their methods set out in the [signals guide](/guides/signals-explained).
- **The regime line on every chart.** The gamma flip is drawn on the GEX Heatmap and the price charts: the level where modeled dealer hedging tends to switch from damping moves to extending them.
- **A published method and a graded record.** ZeroGEX documents how it calculates the gamma flip on its [Methodology](/methodology) page and grades every forecast it publishes, misses included, on its [Track Record](/track-record).
- **Levels where you already chart.** Free TradingView and thinkorswim scripts, and NinjaTrader and Sierra Chart indicators that update themselves on Pro. See [Integrations](/integrations).
- **A lower price, with the API included.** Both ZeroGEX plans cost less than Quant Data's platform plan, and API access comes with Pro instead of a separate plan.
- **A free way to check first.** The [SPX gamma levels](/spx-gamma-levels) page and its siblings need no signup, and neither does the [MCP server](/education/gamma-levels-in-claude) that puts the same levels in AI assistants.

## How to decide

- **You trade single stocks off order flow, or want dark pool prints and news in one feed:** Quant Data.
- **You want delta, vanna, and charm maps across many tickers:** Quant Data.
- **You day trade SPX, SPY, QQQ, NDX, ES, or NQ and want the flip, the walls, and dealer-positioning signals in depth:** ZeroGEX.
- **You are not sure yet:** open the free [SPX gamma levels](/spx-gamma-levels) page, no signup needed, and compare it with what you use today.

---

Quant Data's features and prices are from [quantdata.us](https://quantdata.us) and its [help center](https://help.quantdata.us/en/), checked {{quantdata:checked}}, and can change at any time, so confirm them there. ZeroGEX prices on this page are read from its live price list. ZeroGEX is not affiliated with Quant Data. Educational content only, not a trade recommendation.
