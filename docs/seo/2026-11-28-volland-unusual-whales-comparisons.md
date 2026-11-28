# Volland and Unusual Whales comparison pages, and the Nov 27 Search Console reports - 28 November 2026

Branch `claude/volland-unusual-whales-comparisons`, off `release` at 3900ce24. Two new comparison pages in the house format, the wiring they need, a correction to the Unusual Whales paragraph in the GEX tools roundup, and a read of the three Search Console exports Michael sent (Performance, Coverage, Breadcrumbs, all to Nov 27).

**These are drafts for Michael's review.** Every statement about Volland and Unusual Whales was read first-hand on November 28 from the vendor's own pages (table below), but a comparison page makes claims about a named competitor, so read the two pages and the claims table before merging.

## What the Search Console reports say

**Competitor searches.** In three months, zero impressions for any query containing "volland" or "unusual whales". That is expected rather than a demand signal: no page mentioned either name, so Google never showed the site for them. Search Console cannot show demand for a search the site does not appear in; a keyword tool can. Comparison pages do earn impressions roughly in proportion to the competitor's brand: SpotGamma's page took 1,175 impressions (position 7.5), Bullflow's 565, Quant Data's 108, MenthorQ's 48. Competitor queries the site already appears for: "spotgamma free alternative" (position 2.0), "spotgamma alternative" (35.4), "spotgamma pricing" (12.2), "gex bot pricing" (9.0) and "gexbot alternative" (11.6), with no GEXBot page.

**Traffic.** Clicks rose every week from mid-October (717 a week) to 1,025 in the week from November 19, the best week in the export. Impressions rose from 7,842 to 11,756 over the last three weeks. The Black Friday sale overlaps the latest week, so this is not attributed to the November 22 SEO work. About 80% of clicks are brand searches.

**The November 22 work, five days in.** `/education/gamma-squeeze-explained` is indexed and showing: 35 impressions at position 30.8, and "gamma squeeze" at position 67 on 13 impressions. Too early to read anything else.

**Pages.** `/nq-gamma-levels` is the second-largest click source after the homepage (1,275 clicks, 8.5% CTR). `/spx-gamma-levels` takes the most impressions (23,448 at position 5.8, 3.1% CTR).

**Coverage.** Indexed pages grew from 417 (Sep 3) to 1,537 (Nov 16), mostly the dated replay, forecast, scorecard and hedging-flow pages. Two rows grew and are worth a look, neither urgent:

- **Not found (404): 319**, against 224 in September (those were the translation URLs, since redirected). The export carries counts only. Likeliest cause: dated replay pages for sessions whose data has aged out, which now 404 by design. A 404 for a page that no longer exists does not hurt rankings. To confirm, export the URL list (Pages, "Not found (404)", Export) and send it.
- **Crawled - currently not indexed: 506**, against 52 in September. Mostly dated permalinks: Google indexes some of the near-identical dated pages and not others, which is normal for pages of that kind.

**Breadcrumbs.** No errors or warnings; 30 valid pages and rising. Nothing to do.

## Shipped

### `/education/zerogex-vs-volland`

Volland builds its dealer book from individual trades and argues openly against open-interest GEX, which is ZeroGEX's method. The page answers that on the merits instead of avoiding it: it states Volland's method and its criticism in Volland's own words, states ZeroGEX's method and limits in the words its methodology page already uses, and says neither sees dealer inventory directly. It gives Volland real credit where it leads (greek depth, positioning that moves with the day's trades, 4,500 tickers, workspaces, community) and makes ZeroGEX's case on price, the trial, levels as prices, once-a-minute updates, ES and NQ on both plans, API access on Pro, chart integrations, free levels and the published record.

### `/education/zerogex-vs-unusual-whales`

Unusual Whales is a broad flow platform with GEX as one feature, so the page compares GEX head to head and concedes the breadth. Its key facts come from Unusual Whales' own help article, which ranks four GEX methods best to worst: its SPX-only "Periscope True GEX" from a Cboe market-maker dataset, then directionalized volume, raw volume, and open interest last. The page says ZeroGEX uses open interest, and that ZeroGEX's own methodology agrees participant-classified data like Cboe's supports a richer reconstruction, and that ZeroGEX is testing such data with no findings yet. It also shows that the two define their walls differently.

### Wiring

- **Prices** (`core/comparisonPrices.ts`): both vendors as dated snapshots. Volland is monthly only (its help center says it sells no yearly plans). Unusual Whales' yearly prices were not recorded, because the annual toggle on its pricing page could not be read; the page quotes monthly list prices and tells readers to check the vendor for yearly. One new price shape, `pack`, because Volland sells "2,000 Volland API Calls" for $500 with no billing period stated, and recording that as monthly would claim a period Volland did not.
- **Registry, FAQ, related reading**: both pages, five-question FAQs (no dollar figures, competitor check date included, as the test requires). With seven comparison pages, a six-card list cannot link every sibling, so each page now links the siblings its reader is likeliest to weigh next, and `best-gex-tools` links all seven. Every comparison page keeps at least two siblings pointing at it.
- **Links in**: `/pricing`'s "Still comparing?" row, and `best-gex-tools` (in its text and its related cards).
- **Tests**: both pages join `tests/comparisonPrices.test.ts` (every token resolves, the FAQ is dated, every price comparison the pages make in words is pinned) and `tests/methodologyClaims.test.ts` (no dealer-certainty overclaims).

### The GEX tools roundup (`best-gex-tools`)

Its Unusual Whales paragraph said every paid plan includes the SPX market-maker exposure. On November 28, Unusual Whales' pricing page put True GEX on Retail Pro and Retail Max only. The paragraph now matches the vendor's pages and links the new comparison. A Volland paragraph was added to the dealer-positioning bucket. The roundup's "Updated" date moved to November 28.

## Claims to review, with sources

Checked November 28, 2026. Paraphrases are marked as such; quotes are verbatim.

### Volland

| Claim on the page | Source |
|---|---|
| Six tiers, monthly: VolHacks $99, Swing $150, 0DTE $250, Insight $400, Universe $1,000, Institutional $5,000, with the features listed per tier | [vol.land/pricing](https://vol.land/pricing) |
| "approximately 4,500 unique tickers and updates every 2 minutes, unless otherwise noted" | vol.land/pricing |
| /ES and /NQ on Universe; "Coming Soon: Additional Futures Tickers" | vol.land/pricing |
| No free trial: "No. Volland has superior data..." (pricing FAQ); "we don't offer a traditional free trial of the live dashboard" but the Volland Academy, "a free self-directed learning platform" | vol.land/pricing; [vol.land/help](https://vol.land/help), FAQ tab |
| Greeks: "charm, delta, delta-adjusted gamma, delta decay, gamma, rho, theta, vanna, vega, and vomma. Delta decay is available on select tiers." | vol.land/help, FAQ tab |
| Monthly plans only: "We do not offer daily, weekly, yearly, etc. plans." | vol.land/help, FAQ tab |
| Method: OPRA trade feed; "determines if each order filled is a buy or a write on the dealer side" using "executed price, execution IV, binomial fair value, and bid/ask spreads as a guide" | vol.land/help, FAQ tab |
| GEX "has proven to be too reductive to be accurate" | vol.land/help, FAQ tab |
| Line in the sand: the price where dealers "would have to change their hedging activity"; GEX users would call it the gamma flip "but they aren't measuring it even close to correctly" | vol.land/help, FAQ tab |
| 2-minute updates at all tiers; "The 0DTE widget refreshes every 5 minutes." | vol.land/help, FAQ tab |
| "4,500+ unique tickers"; "We focus on the top 1,000 most liquid tickers by option volume." | vol.land/help, FAQ tab |
| VolHacks widgets narrow support and resistance into buckets; in-depth education recommended (paraphrase) | vol.land/help, FAQ tab |
| "it takes at least a month to learn Volland" (on average) | vol.land/help, FAQ tab |
| Unlimited workspaces; subscriber Discord channels; user guide; 1-on-1 sessions | vol.land/help, FAQ tab |
| API: "2,000 Volland API Calls", $500, requires 0DTE, Insight, Universe or Institutional; updated every 5 minutes during the market day; no historical data | [vol.land/api](https://vol.land/api) and its FAQ |
| "ALL SALES ARE FINAL." | [vol.land/terms-of-service](https://vol.land/terms-of-service) (last updated April 21, 2026) and the help center FAQ |
| Volland is a registered trademark of Ad Deum Funds | [vol.land](https://vol.land) footer |

One conflict on Volland's own site: its About page and the help center's About tab still say "200+" tickers, against 4,500 on the pricing page and help FAQ. The page quotes the pricing page.

### Unusual Whales

| Claim on the page | Source |
|---|---|
| Retail Basic $50/mo (GEX heatmap for every optionable ticker, live; True GEX "On Pro and Max"), Retail Pro $75/mo ("10-min True GEX for SPX"), Retail Max $120/mo ("1-min True GEX for SPX") | [unusualwhales.com/pricing](https://unusualwhales.com/pricing) (list prices printed beside Black Friday sale prices) |
| API Options Starter $99/mo; API plans "are data-only: they don't include the website or mobile app"; Bundle Basic (website and API) $199/mo | unusualwhales.com/pricing, API and bundle tabs and FAQ |
| Free accounts: "options flow is 2 trading days behind, news 15 minutes, and alerts 30 minutes"; the Discord is free | unusualwhales.com/pricing FAQ |
| 7-day free trial on monthly Retail Basic and the API | unusualwhales.com/pricing FAQ |
| "All sales are final"; a wrong product can be swapped within 7 days | unusualwhales.com/pricing FAQ |
| Platform features: flow, alerts, dark pool, news, screeners, CME futures data, prediction markets, Mr. Whale, web/iOS/Android, data downloads on Pro and Max, "100K+ traders" | unusualwhales.com/pricing and [homepage](https://unusualwhales.com) |
| Periscope True GEX: SPX only, "a dataset provided DIRECTLY FROM CBOE", "differentiates between customer and MM orders"; 10-minute (Pro) and 1-minute (Max) refresh | [Help article: An overview of Gamma Exposure and GEX tools](https://unusualwhales.com/information/an-overview-of-gamma-exposure-and-gex-tools) |
| Four methods ranked best to worst; open interest "by far the simplest" and least accurate; a heatmap version of directionalized volume "included in all platform subscriptions" | same help article |
| Call wall and put wall: strike above/below spot "with the largest positive net gamma"; gamma magnet; gamma flip; built from "directionalized volume" by default; up to five nearby flips; read the regime from net gamma, not the flip | [API docs: GEX Levels](https://api.unusualwhales.com/docs/api/gexgreeks/gex-levels) |
| Open-interest greek exposure "updates once per day at market open" | [API docs: Greek Exposure](https://api.unusualwhales.com/docs/api/gexgreeks/greek-exposure) |
| "the pages checked do not say it publishes GEX levels on the futures price" (an absence, worded as such) | the pages above |

## Not done, and why

- **Translations of the two pages.** English first, so a correction after review is made once rather than five times. The test marks them pending and fails the moment a translation file appears without the token checks.
- **Unusual Whales' yearly prices.** The annual toggle on its pricing page could not be switched in a headless browser. A minute in a normal browser would add them; tell me the four yearly figures and they go in `core/comparisonPrices.ts`.
- **"Six symbols" on the five older comparison pages.** They predate NVDA (Nov 3) and MSFT (Nov 5) and say six in all five languages. It understates ZeroGEX, which is not urgent; queued as a separate task.
- **The roundup's translations.** The German, Spanish, French and Italian versions still carry the old Unusual Whales wording and have no Volland paragraph. Same follow-up task.
- **A GEXBot page.** "gex bot pricing" already shows the site at position 9 with no page. GEXBot's site needed a browser to read in October; now that one is available, it is the next candidate.

## Checklist

1. Read both pages on the branch (`frontend/content/articles/zerogex-vs-volland.md` and `zerogex-vs-unusual-whales.md`) and the claims table above. Spot-check any claim against its source.
2. Merge `claude/volland-unusual-whales-comparisons` into `release`, then on the server: `make deploy`.
3. Google Search Console, URL Inspection, Request Indexing for `https://zerogex.io/education/zerogex-vs-volland` and `https://zerogex.io/education/zerogex-vs-unusual-whales`. Bing gets both from the next weekday IndexNow run.

### Check after deploy

- Both URLs return 200 with their own titles, and the price tables show figures, not `{{...}}`.
- `https://zerogex.io/pricing` lists both in the "Still comparing?" row.
- `curl -s https://zerogex.io/feed.xml | grep -c '<item>'` prints two more than before (the feed lists every education article).

## How to tell whether it worked

| When | Where | Healthy |
|---|---|---|
| 1-2 weeks | URL Inspection on both pages | Indexed |
| 4-6 weeks | Search Console, Performance, Query containing "volland", then "unusual whales" | Impressions on the new pages. Expect "unusual whales gex", "volland alternative" and similar long-tail first; the bare brand names belong to the vendors |
| 6-8 weeks | Same, Pages tab | The two pages alongside SpotGamma's (1,175 impressions in the 90 days to Nov 27) |
