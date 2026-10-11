# Organic acquisition workstream - 11 October 2026

The plan behind `/gex-levels`, the `/spx-gamma-levels` changes that shipped with it, what to do next, and how to tell whether any of it worked.

Source data: a Semrush keyword gap and SERP study (zerogex.io against menthorq.com, spotgamma.com, gexbot.com and gexstream.com) and the September 4 Search Console review. Semrush volumes and positions are estimates; Search Console is the source of truth wherever the two disagree.

## 1. Which page owns which search

One page per intent. A second page aimed at the same query splits links and relevance between two URLs and usually makes both rank worse.

| Intent | Example queries (Semrush volume / difficulty) | Owner page | Supporting pages |
|---|---|---|---|
| See GEX levels, any instrument | gex levels (210 / 13), gex data (170 / 19), gex charts (90 / 5), free gamma exposure chart (50 / 11), gamma exposure dashboard (70 / 15) | `/gex-levels` (new) | `/chart` for the interactive chart |
| One ticker's levels and net GEX today | spx net gex current value (pos. 16, 320), spx net gex current (pos. 17, 70), spx 0dte net gex current (pos. 11, 70), spx net gex (90 / 12), gex for spx (140 / 17) | `/spx-gamma-levels` | `/education/spx-net-gamma-exposure-today` for the concept |
| Same, other tickers | qqq gex (pos. 27, 110), spy gamma levels, ndx gex, es / nq gamma levels | `/<ticker>-gamma-levels` | |
| Free levels in general | free gamma levels (pos. 22, 260), free gex levels, spotgamma free alternative | `/gex-levels` | the six ticker pages; a future SpotGamma comparison |
| What GEX is | what is gex (210 / 15), gex trading (260 / 18), gex meaning | `/education/what-is-gex-in-trading` | `/education/gamma-exposure-explained` (pillar) |
| Dealer gamma, the concept | dealer gamma (50 / 4) | `/education/gamma-exposure-explained` | `/education/0dte-dealer-positioning-explained` |
| Interactive chart / terminal | gamma exposure chart, gex chart free | `/chart` | `/gex-levels` links it in the hero |

The rule that keeps `/gex-levels` and `/spx-gamma-levels` from competing: `/gex-levels` never leads with a single ticker, and its title, H1 and description name all six; the SPX page owns every "SPX ..." query and links to `/gex-levels` only as "all six on one page".

## 2. What shipped in this workstream

- **`/gex-levels`**: server-rendered, force-static with a one-minute refresh, public and self-canonical, in the sitemap at daily / 0.95. It shows all six instruments as compact panels (delayed reference spot, gamma flip, call wall, put wall, net GEX, as-of time, regime, and a small server-drawn level map) plus one table of the same numbers, then short explainers linking the full articles, a free-versus-paid comparison checked against the tiers help page, related links, and a visible FAQ mirrored as FAQPage markup. It reads the exact delayed snapshot the ticker pages read (same function, same cache, same last-good fallback and stale flags), so it adds no backend load and cannot disagree with them.
- **Links into `/gex-levels`**: the footer's "Free gamma levels" column (every page), the end-of-article levels box (every article), the six ticker pages, the education hub, the homepage, `/chart`, the GEX explainer, `llms.txt` and on-site search.
- **`/spx-gamma-levels`** (all six ticker pages share the template): a delayed net GEX reading with its as-of time directly under the H1 ("SPX net GEX +$1.84B · gamma flip 6690 · delayed, as of ..."), the answer section retitled "SPX net GEX today: current value and levels", and a one-line link to `/gex-levels` under the ticker cards. The 0DTE FAQ, the corrected update-frequency answer and the links to the wall study, methodology, free chart and live dashboard landed with the site audit branch. The title was deliberately left alone (backlog item 2).

### Files and reuse

| File | What |
|---|---|
| `frontend/app/gex-levels/page.tsx` | New page. Reuses `loadSnapshots`, `snapshotFreshness`, `REGIME_DISPLAY` and `SYMBOL_CHAIN` from the levels view, plus `LandingHeader`, the levels-page `Footer`, `TrialButton` / `ComparePlansButton`, `LevelsEmailSignup`, `BreadcrumbJsonLd` and the `gexSummary` formatters. New only: the instrument panel and the small SVG level map. |
| `frontend/app/spx-gamma-levels/gammaLevels.tsx` | Exports the snapshot loader, freshness rules and labels (behavior unchanged; the freshness logic moved into one exported function both pages call). Net GEX line, section title, hub link. |
| `frontend/core/auth.ts`, `components/ClientLayout.tsx`, `next-sitemap.config.mjs` | Public route rule, marketing shell, sitemap entry (daily, 0.95). |
| `components/Footer.tsx`, `components/LiveLevelsCTA.tsx`, `app/LandingClient.tsx` (+ i18n), `app/chart/ChartClient.tsx`, `app/education/page.tsx`, `content/articles/what-is-gex-in-trading.md`, `core/llmsTxt.ts`, `app/search/SearchClient.tsx` | Links into `/gex-levels`. |
| `frontend/tests/gexLevels.test.ts`, `tests/sitemapCoverage.test.ts` | Static rendering, shared data path, metadata lengths, public and listed, FAQ markup from the visible FAQ, every link resolves, the hub is linked from the pages above. |

Structured data on `/gex-levels`: WebPage (with `dateModified` from the freshest snapshot and `relatedLink` to the six ticker pages), BreadcrumbList with a matching visible breadcrumb, and FAQPage. No SoftwareApplication, rating or price markup: the page is not a product page, and nothing there would be accurate.

### Validation

- Typecheck passes; lint shows no new warnings; the full unit suite passes except the two `moneyBackServer` refund tests that already fail on `release`.
- Production build passes and prerenders `/gex-levels` as a static page.
- Against a local stub of the levels API: the page returns 200 with its own title, description, canonical and social tags and no robots directive; the H1, all six panels with numbers and as-of times, the table and the FAQ are in the server HTML; desktop and a 390px phone render with no horizontal overflow (the phone check caught a wrapping button row, fixed). `sitemap-dated.xml` listed all 38 expected stub URLs.

### Limitations

- The page uses the site's default social card. A live per-instrument card is backlog item 8.
- Futures panels show levels converted from SPX and NDX at fair value, and say so. They can differ slightly from a broker's futures chart.
- FAQ markup will not produce an FAQ rich result for a commercial site; it is there because it is valid and matches the page.

## 3. Backlog, in recommended order

| # | Work | Target intent and keywords | URL | Why | Expected value | Effort |
|---|---|---|---|---|---|---|
| 1 | Watch `/gex-levels` index and rank for 4 weeks before building anything else for these queries | gex levels, gex data, gex charts | `/gex-levels` | Low-difficulty queries; the page is new and needs crawl time | High: five of the ten gap keywords | None |
| 2 | Decide the SPX title test | spx net gex current value / current | `/spx-gamma-levels` | The title omits "net GEX"; the description and page now lead with it. Change the title only if Search Console still shows positions 11-17 after 4 weeks, then compare 28-day CTR before and after | Medium | Small |
| 3 | QQQ: a QQQ-specific FAQ answer and a QQQ note in the hero ("Nasdaq-100 ETF; levels from the QQQ chain") | qqq gex (pos. 27), qqq gamma levels, qqq call wall | `/qqq-gamma-levels` | Already ranks; the page is a ticker-swapped template with no QQQ-specific substance beyond the numbers | Medium | Small |
| 4 | SpotGamma comparison page, in the house comparison format | spotgamma alternative, spotgamma free alternative | `/education/zerogex-vs-spotgamma` | Measured demand with purchase intent. Prices captured from spotgamma.com on Oct 11, but its pricing page contradicts itself in two places; confirm before publishing | Medium-high | Medium |
| 5 | Merge the two gamma-wall pages | what is a gamma wall, gamma walls | `what-is-a-gamma-wall` into `gamma-walls-explained` (301) | Same definition, one ~300-impression query; pick the survivor from Search Console's clicks | Medium | Medium |
| 6 | A futures hub section, not a new page: ES / NQ panels already sit on `/gex-levels`; add a "futures gamma levels" sentence and links there and on the ES and NQ pages | es gamma levels, nq gamma levels, futures gex | `/es-gamma-levels`, `/nq-gamma-levels` | Futures searchers compare against TradeGEX and MenthorQ; the comparison pages exist and should be linked from the futures pages | Low-medium | Small |
| 7 | Dealer gamma: retitle one pillar H2 to use the phrase and add a short "dealer gamma" FAQ item | dealer gamma (50 / 4) | pillar | Very low difficulty; a heading and an FAQ answer, not a new page | Low | Small |
| 8 | A per-instrument social card for `/gex-levels` | (social and AI citation, not a query) | `/gex-levels/opengraph-image` | Uses the default card today; the ticker pages each have a live card | Low | Small |
| 9 | Backlinks: list `/gex-levels` as the free-levels URL in the backlink kit; pitch the embed widget to newsletters that publish SPX notes; submit to AlternativeTo and options-tool directories | free gamma levels, gex levels | `/gex-levels`, `/embed` | The pillar's problem has always been off-page; `docs/seo/backlink-kit.md` is the playbook | Medium, slow | Ongoing |
| 10 | HTML micro-cache for anonymous visitors (nginx, 60 s) | all | all non-static pages | Every article and help page renders per request; this is the remaining server-response win | Medium (Core Web Vitals) | Small change, needs testing on the box |
| 11 | Organic attribution in first-party analytics: record the referrer's search engine as the first-touch source when there is no UTM | measurement | `components/PageAnalytics.tsx`, register route | Today organic and direct are one bucket | Enables everything in section 4 without PostHog | Small, but changes attribution semantics: Michael's call |

Skipped on purpose: a separate `/spx-net-gex` page (same intent as `/spx-gamma-levels`), a "gamma calculator" page (the calculator is a paid tool), a VIX gamma page (no VIX options coverage), and any page per keyword variant.

## 4. Measurement

### What exists today

- **Search Console sync**: `make sync-search-console` writes daily site-wide clicks and impressions into the daily metrics table. It does not store per-page or per-query rows, so rankings and page-level clicks are read in Search Console itself.
- **PostHog** (only if `NEXT_PUBLIC_POSTHOG_KEY` is set in production): `$pageview` on every route change, `signup` (register page), `checkout_started` (pricing), `trial_started` and `subscription_paid` (Stripe webhook, server-side, stitched to the same person), plus `trial_cta_click` and `compare_plans_click` with a `location` property. PostHog's own person properties `$initial_referring_domain` and `$initial_pathname` give organic first touch and landing page. The new page's buttons report `location` values `gex_levels_hero` and `gex_levels_plans`. No new events were added.
- **First-party page analytics** (`/admin/analytics`): visits and active time per path, and registrations by first-touch `utm_source`. Organic search has no UTM, so it is counted with direct traffic.

### Funnel to build in PostHog (no code)

`$pageview` where `$initial_referring_domain` contains `google` → `signup` → `trial_started` → `subscription_paid`, broken down by `$initial_pathname`. Save it as "Organic funnel by landing page". Add a second insight: `trial_cta_click` by `location`.

### 30 / 60 / 90 days

| Checkpoint | Look at | Healthy looks like |
|---|---|---|
| Week 1 | URL Inspection on `/gex-levels`; sitemap report shows both sitemaps read | Indexed; `sitemap-dated.xml` shows URLs discovered |
| Day 30 | Search Console, Performance, page = `/gex-levels`: impressions, queries | Impressions for "gex levels", "gex data", "gex charts"; positions under 30 |
| Day 30 | Page = `/spx-gamma-levels`, query contains "net gex": position and CTR vs. the 28 days before Oct 11 | Positions improving from 11-17; CTR not lower |
| Day 30 | Indexing report: "Crawled, currently not indexed" and "Page with redirect" | Not growing (cards and snapshots are now noindex) |
| Day 60 | `/gex-levels` positions for the five gap keywords; organic funnel in PostHog by landing page | Top 20 for the low-difficulty terms; first organic signups attributed to `/gex-levels` |
| Day 60 | Decide backlog item 2 (SPX title) from the day-30 and day-60 data | |
| Day 90 | Organic registrations, trials and paid conversions per landing page; Semrush keyword count vs. the ~52 baseline | Keyword count rising; at least one paid subscriber with an organic first touch per month |

## 5. Manual steps outside the repo

None of these were done from here; each needs Michael's access.

1. Search Console: submit `https://zerogex.io/sitemap-dated.xml` under Sitemaps (robots.txt also lists it), then request indexing for `https://zerogex.io/gex-levels` with URL Inspection.
2. Search Console: confirm the favicon update with URL Inspection on `/` (Google refreshes SERP favicons on its own schedule, often weeks).
3. PostHog: confirm `NEXT_PUBLIC_POSTHOG_KEY` is set on the production box, then build the funnel above.
4. Semrush: add `/gex-levels`, `/spx-gamma-levels` and the five gap keywords to Position Tracking so day-30 has a baseline from today.
5. Rich Results Test on `/gex-levels`, `/pricing` and one article to confirm the structured data parses (no rich result is expected for FAQ).

## 6. Deployment and verification checklist

No environment variables or new services are needed. The deploy's existing `make logo` and `make blog-images` steps copy the new icon files and regenerate the blog image manifest.

After `make deploy`:

1. `curl -sI https://zerogex.io/gex-levels` returns 200 with no `x-robots-tag`.
2. View source on `/gex-levels`: the H1, the six instrument panels with numbers and as-of times, and `<link rel="canonical" href="https://zerogex.io/gex-levels">` are in the HTML.
3. `curl -s https://zerogex.io/sitemap-0.xml | grep gex-levels` finds it; `curl -s https://zerogex.io/sitemap-dated.xml | grep -c '<url>'` is well above zero during market hours.
4. `curl -s https://zerogex.io/robots.txt` lists both sitemaps.
5. `/spx-gamma-levels` shows the net GEX line under the H1 with a time, and the page still loads its chart.
6. Signed out, the homepage "Dashboard" tool pill goes to `/chart`; signed in on a paid plan, it goes to `/dashboard`.
7. `https://zerogex.io/favicon.ico` is about 8 KB.
