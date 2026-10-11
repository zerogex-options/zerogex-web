# Site SEO audit - 11 October 2026

Scope: the whole public site on `release` at b9516f9, read from the code (routes, metadata, structured data, sitemap, redirects, assets, content). This is not a Search Console read. The September 4 review (`2026-09-04-search-console-review.md`) holds the query data and the ten changes already shipped; nothing it fixed is repeated here.

Method: six audit passes (indexation, metadata, structured data, page weight, content, internal linking) produced 67 findings. Each was checked against the code before anything changed, and several were dropped or narrowed on that check. Everything below shipped on branch `claude/seo-audit` unless it is listed under "Not done".

## What was already solid

- robots.txt, canonicals on every content page, the 301s for the old localized-slug 404s, noindex on gated routes through the 307 header, and the force-static levels pages with their live meta descriptions.
- Fonts: only three faces preloaded. No render-blocking third-party scripts. No chart libraries on the public pages.
- Translations are served at the same URL by cookie, and crawlers never send that cookie, so Google always indexes English. No hreflang work is needed.
- FAQ markup on 36 pages is valid and mirrors visible text. Google no longer shows FAQ rich results for commercial sites, so no new FAQ markup was added for rich results.

## Shipped

### Page weight (Core Web Vitals)

| Asset | Before | After |
|---|---|---|
| Favicon, every page | 991 KB PNG mislabeled `.ico`, 1254px | 8 KB real ICO (16/32/48px), plus a 192px icon and a 180px Apple touch icon |
| Article screenshots (13) | 4.4 MB of PNG through a plain `<img>` with no size | 1.9 MB of source PNG; served through Next's image optimizer as WebP at column width, with width and height set |
| Founder photo | 1.6 MB PNG named `.jpg` | 72 KB real JPEG |
| posthog-js | about 66 KB gzip in every page's first load | loaded only when a PostHog key is configured, after hydration |
| Header logo | full 1280px lockup preloaded for a 100-170px render | `sizes` set, so the optimizer serves about 10-19 KB |

Signed-out readers of article and help pages no longer poll the quote API every second or fire eight prewarm requests the tier gate rejects. Members are unchanged. Cache headers were added for the hashed social card, blog images, the brand mark and the logo lockups.

### Social cards and metadata

- The root layout set `og:title`, `og:url` and `twitter:title` to the homepage's, and about 54 pages inherited them, so a shared /pricing, /chart or help link showed the homepage headline. Each page now carries its own.
- Every card now names `@ZeroGEXOptions` as `twitter:site`.
- /forecast/cone had no title, description or canonical at all; it now has all three and is in the sitemap.
- Eleven descriptions of 177 to 262 characters and twelve titles of 63 to 81 characters were trimmed to fit a search result.
- Shared backtest reports, Action Cards, per-minute replay snapshots and the `/save`, `/unsubscribe` and `/convert` email-link pages are now `noindex`. Cards and snapshots keep their social previews.
- Replay and forecast permalinks now say "Gamma Flip, Call & Put Walls" and "Range, Levels, Receipt" in their titles instead of a long weekday date, and the forecast receipt describes the forecast in words instead of check-mark glyphs.

### Structured data

- Organization now uses a square 512px logo instead of the 1200x630 social card, lists "Zero GEX" as an alternate name, and names the founder.
- A Person node for the founder, cited as the author of every Article, with a visible "By Michael, founder" byline linking to /about#founder so the markup matches the page.
- Article nodes gained `@id`, `inLanguage`, `isAccessibleForFree` and `wordCount`, and point at one Organization `@id` instead of repeating it inline.
- /pricing now publishes its list prices as Offers. The NinjaTrader and Sierra Chart pages' Pro Offer now carries the Pro price from the same constant.
- Article `dateModified` now reflects the September 29 to October 9 copy passes on 17 articles, and the sitemap reads the same date, so the visible date, the structured data and the sitemap agree.

### Indexation and sitemap

- Added to the sitemap: /help/platform (the hub for 36 help articles that were listed without it) and /forecast/cone.
- The daily pages' `lastmod` was the git date of a 12-line wrapper, weeks old. It is now the last trading day's close.
- New `/sitemap-dated.xml` lists every dated replay, forecast, scorecard and hedging-flow page from the same session lists the index pages read. It is registered in robots.txt. A failed list is skipped rather than failing the sitemap.
- Action Card and replay snapshot permalinks no longer return a 404 when the backend is briefly down; they return the same "data unavailable" page the other dated permalinks use.
- /es-gamma-levels, /nq-gamma-levels, every /help page and /hedging-flow/sessions were public only because no rule matched them. They are now public by rule, and a new test fails if a sitemap page is gated or a public page is missing from the sitemap.

### Content and internal links

- Heading anchors on every article, guide and help page, an "On this page" list on documents over 2,000 words with six or more sections, and a working fourth heading level.
- One article rendered four H1s; it now has one. A test checks all 166 article files.
- The /articles listing was a hand-typed copy of the registry. It was missing one article and carried five stale titles and six stale dates; it is now derived from the registry.
- The related-reading graph had five articles with no inbound link and one with no block at all. Every article now has related links out and at least two in, enforced by a test.
- 21 links still called the gamma-flip explainer by its pre-September title; they now use the current one. Weak anchors such as "here is why" and "in real time" were made descriptive.
- Removed visible "Image placeholder" author notes from three articles.
- The levels pages now link the wall-break study they quote, the methodology, the free chart and the paid dashboard, carry a 0DTE FAQ and a corrected update-frequency answer, and build their "Learn more" list from current article titles, with ticker-specific additions.
- The homepage and /about module grids sent eight links into login walls for signed-out visitors and Googlebot. Signed-out visitors now reach each tool's public page or Platform Guide entry; members still open the tool.
- /pricing gained a "Still comparing?" row linking the four comparison pages, the GEX tools roundup, the track record, the methodology and the free levels.
- Receipt pages (replay, forecast, scorecard, hedging flow) now end with links to that symbol's free levels page, the track record and the methodology. The hedging-flow archive no longer sends signed-out visitors to a login wall.

## Not done, and why

- **SpotGamma and GEXBot comparison pages.** Real demand ("spotgamma free alternative"), but every fact must come from the vendor's own pages. SpotGamma's prices were captured on October 11 (its pricing page contradicts itself in two places); GEXBot's site renders only in a browser and could not be read. Needs Michael's review before publishing.
- **The two gamma-wall pages.** `what-is-a-gamma-wall` and `gamma-walls-explained` open with the same definition and compete for one query. Which to keep depends on which URL Search Console shows taking the clicks.
- **HTML caching for anonymous visitors (TTFB).** Every page except the six levels pages renders per request because the root layout reads cookies. A 60-second nginx micro-cache for cookie-less GETs is the low-risk first step; it is a server config change and should be tested on the box.
- **`api.zerogex.io/docs`** ranks for brand queries; whether it should be noindexed is a decision for the API service, which is not in this repo.
- **One help title kept long on purpose.** "Why Our Futures Price Can Differ From Another Platform" stays as is because the futures tooltip quotes it and a test keeps the two in step.

## Verification

- `npm run typecheck`: passes. `npm run lint`: 0 errors, 52 warnings (unchanged).
- Unit tests: all pass except the two `moneyBackServer` refund tests that fail on `release` before this work too. New tests: article registry graph and lengths, article headings, heading ids, sitemap coverage, blog image manifest, pricing offers, and two pages added to the permalink outage test.
- `npm run build` passes. A local production server returned 200 for every changed page, and the rendered head tags, contents list, byline and structured data were checked by hand.
