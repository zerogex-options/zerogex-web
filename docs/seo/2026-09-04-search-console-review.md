# Search Console review — 4 September 2026

What the three GSC exports (Performance, 92 days; Performance, last 28 vs previous 28 days with
brand queries excluded; Coverage) said, and the ten changes shipped in response. Numbers below
are the ones the decisions rest on; the rest is in the exports.

## What the data said

**Traffic is brand-led and the free levels pages take the impressions.**

| Page | Clicks / impressions (92d) | CTR | Avg position |
|---|---|---|---|
| `/` | 1,461 / 6,700 | 21.8% | 3.6 |
| `/spx-gamma-levels` | 160 / 25,972 | 0.62% | 7.1 |
| `/education/best-gex-tools` | 59 / 5,862 | 1.0% | 7.1 |
| `/pricing` | 50 / 4,383 | 1.1% | 3.2 |
| `/education/gamma-exposure-explained` | 31 / 4,912 | 0.63% | 10.2 |
| `/education/spx-net-gamma-exposure-today` | 17 / 2,959 | 0.57% | 9.6 |

The homepage's clicks are almost all `zerogex` / `zero gex` (78% CTR). `/spx-gamma-levels` takes
26K impressions but only ~500 of them are identifiable non-brand queries; the rest are anonymised
long-tail and a visible tail of AI-assistant grounding searches (`(zerogex.io what is it)
site:zerogex.io`, "give me the morning spx structural map for today's session…"). Those searches
read the page rather than click it, so the page's job there is to be the citable, dated source.

**Non-brand, last 28 days: the demand is definitional and "current value" intent, and the site
ranks 10-35 for it.**

| Cluster (examples) | ~Impressions / 28d | Position | Page ranking |
|---|---|---|---|
| `spx net gex current value`, `spx net gex dollar gamma current`, `spx net gamma exposure current`, `spx 0dte net gex current` (12+ variants) | ~450 | 19-35 | `/education/spx-net-gamma-exposure-today` |
| `gamma flip`, `gamma flip meaning`, `gamma flip explained`, `gamma flip line`, `what is a gamma flip` | ~200 | 9-25 | `/education/how-to-read-a-gamma-flip` (15.2) |
| `gamma wall`, `gamma walls`, `what is a gamma wall` | ~300 | 6-9 | `/education/gamma-walls-explained` (9.2) |
| `zero gamma`, `zero gamma level`, `what is zero gamma` | ~120 | ~9 | no dedicated page |
| `gex tools`, `best gex platform`, `gex tool`, `best gamma exposure platform` | ~150 | 6-10 | `/education/best-gex-tools` (9.8) |
| `what is a put wall`, `put wall meaning` | ~60 | 19-26 | `/education/what-is-a-put-wall` — **0 impressions last 28d, 42 the 28d before** |
| `gamma exposure`, `what is gamma exposure`, `what is gex`, `gex meaning` | ~60 | 55-75 | the pillar, at 55.5 |
| `free gamma levels`, `gamma levels free`, `free gex levels`, `spotgamma free alternative` | ~30 | 15-60 | levels pages |

**Coverage:** 302 indexed / 346 not indexed. Errors: **224 "Not found (404)"**, 52 "Crawled —
currently not indexed", 31 noindex (the auth and gated routes, intended), 12 robots-blocked
(`/api`, intended), 9 alternate-with-canonical, 1 duplicate without a canonical. The 404 count
matches the localized markdown variants (`/education/<slug>.de` etc.; 248 exist, ~24 of them
newer than the sitemap fix) that an earlier sitemap emitted as pages.

**Also found in the code:** all eighteen palette fonts (~690KB) were preloaded on every page;
`/chart` — a public, indexable lead magnet — had no canonical and was not in the sitemap, nor
were `/replay` and `/forecast`; article pages showed no dates and no visible breadcrumb; the
"today's net GEX" block on the levels pages carried only net GEX and the flip, in prose, with the
other levels in styled `<div>`s inside a link.

## The ten changes

1. **`/education/spx-net-gamma-exposure-today` answers the query.** It now opens with today's
   delayed SPX net GEX, regime, gamma flip, spot, call wall, put wall and max pain (same
   endpoint and 900s cache as `/spx-gamma-levels`), as a quotable paragraph plus a real
   `<table>`, and the meta description leads with the live value. Title/H1 retargeted to
   "SPX Net GEX Today: Current SPX Net Gamma Exposure Value"; a "dollar gamma" section and two
   FAQ answers cover the wording the queries use.
2. **The 224 404s are 301s.** `next.config.ts` redirects `/education|/guides|/help/platform/<slug>.<de|es|fr|it>`
   to the English page. Replay dates the API has no frames for now return a real 404 instead of a
   200 apology (soft 404); a branded `app/not-found.tsx` links to the levels and explainers.
3. **Titles rewritten from the query data.** Levels pages: `<ticker> Gamma Levels Today (Free):
   GEX, Gamma Flip, Call & Put Walls`. Best tools: `Best GEX Tools in 2026: Gamma Exposure
   Platforms Compared`. Flip: `What Is a Gamma Flip? The Gamma Flip Level Explained`. Real-time
   landing trimmed from 86 to 62 characters; education hub from 79 to 55; pricing and the
   homepage now name what the product is. On-site search index mirrors them.
4. **New explainer: `/education/zero-gamma-level-explained`** — the one on-brand cluster with
   demand, position ~9 and no page. Registry, FAQ schema, related-reading graph, `/articles`,
   hub and footer all link it.
5. **`/education/what-is-a-put-wall` expanded** from 731 to ~1,550 words: plain-English lead,
   put wall vs call wall table, vs gamma flip / max pain, what a break means, how to find
   today's put wall. Hedged wording kept throughout.
6. **Footer** gained a "Free gamma levels" column (all six tickers; only SPX was linked
   site-wide before) and a "Learn" column (pillar, flip, zero gamma, walls, net GEX, tools).
7. **Fonts:** `preload: false` on the fifteen faces outside the default palette; ~590KB less
   high-priority download on every first visit.
8. **Indexation gaps:** `/chart` self-canonical; `/chart`, `/replay`, `/forecast` in the sitemap
   (daily, 0.8); `dateModified` on the levels pages' WebPage JSON-LD.
9. **Levels pages' answer block** now carries every level in one sentence plus a shared
   `DelayedLevelsTable` — the same component the SPX net GEX article uses.
10. **Every article page** shows a breadcrumb (Home / Education / title, matching the
    BreadcrumbList JSON-LD) and published / updated dates from the registry, via `ArticleMeta`.

## What to watch, and when

- 2-3 weeks: the 404 row in Coverage should start draining as the 301s are recrawled; use
  URL Inspection on one `.de` URL to confirm Google sees the redirect. "Page with redirect"
  will grow by the same amount — that is the expected outcome, not a regression.
- 4-6 weeks: positions for `spx net gex current value` (target: top 10), `what is a gamma
  flip` / `gamma flip meaning` (target: top 8), `zero gamma` / `zero gamma level` (new page;
  target: top 5), `what is a put wall` (back into the 28-day report).
- 6-8 weeks: CTR on `/spx-gamma-levels` and `/education/best-gex-tools` against the 0.6% /
  1.0% baselines. Read them with the brand filter on; the unfiltered number is dominated by
  AI grounding queries that never click.
- Core Web Vitals in GSC (mobile): LCP should improve on every organic landing.

## Follow-ups not done here

- `tests/integrationAssets.test.ts` fails on `release` before and after this work: the committed
  Sierra Chart hash no longer matches `public/sierrachart/ZeroGexGammaLevels.cpp`. Regenerate
  the manifest (`node scripts/integration-assets-manifest.js`).
- `api.zerogex.io/docs` takes ~300 brand impressions at position 3. If that is not wanted, the
  API service should serve a `noindex` on `/docs`; it is not in this repo.
- Two pairs to watch for cannibalisation now that both rank: `what-is-a-gamma-wall` vs
  `gamma-walls-explained` for "what is a gamma wall", and the new zero-gamma page vs the flip
  explainer for "zero gamma flip". If Google keeps swapping the URL, merge the weaker one.
- `/forecast/*` and `/scorecard/*` return 404 whenever the API call fails, not only when the
  date has no data. A backend outage during a crawl would de-index those permalinks. The
  replay page distinguishes the two cases; the other two should too.
- The root layout reads cookies, so every non-`force-static` route is server-rendered per
  request. Moving the palette / theme / language read to the client would let the education
  pages be statically cached; larger change, real TTFB win.
- The pillar (`/education/gamma-exposure-explained`) ranks ~55 for "gamma exposure" and
  "what is gex". On-page it is fine; it needs links from outside the site. `docs/seo/backlink-kit.md`
  is the playbook.
