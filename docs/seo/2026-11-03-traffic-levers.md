# Five traffic levers - 3 November 2026

Five ways to bring more people to zerogex.io without changing or removing anything members use. Each was checked against the live site and the code on `release` (14b1ae3), the plan was audited by a second, independent review before it shipped (what that changed is under "Audit"), and the result is on branch `claude/seo-traffic-levers`.

The September and October work (`2026-09-04-search-console-review.md`, `2026-10-11-site-seo-audit.md`, `2026-10-11-organic-acquisition-workstream.md`) already covered titles, canonicals, sitemaps, structured data, page weight, internal links, the `/gex-levels` hub and llms.txt. Nothing here repeats it.

## What the live site showed (3 November)

- **Cloudflare is turning AI crawlers away.** `https://zerogex.io/robots.txt` starts with a block Cloudflare adds ("BEGIN Cloudflare Managed content"): `Content-Signal: ai-train=no`, then `Disallow: /` for GPTBot (OpenAI), ClaudeBot (Anthropic), Google-Extended (Gemini), Applebot-Extended (Apple Intelligence), CCBot (Common Crawl) and about 27 others. Requests that identify as GPTBot, ClaudeBot, CCBot, Amazonbot or Bytespider also get HTTP 403 at Cloudflare's edge, `/llms.txt` included. Search crawlers and in-chat agents (Googlebot, bingbot, OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot) get through. Nothing in the repo records a decision to block AI crawlers. The cause is the zone's "AI Crawler and Agent access policies" in Cloudflare, with Training set to block.
- **No IndexNow and no Bing verification.** Bing learns about the daily pages and the ~24 dated permalinks each session adds only when it recrawls the sitemaps.
- **No robots meta tag on any page**, so Google uses its default image preview size, and Discover's large-image cards are not available to the site.
- **No RSS or Atom feed.**
- **The live sitemap lists two images as pages**: `/icon.png` and `/apple-icon.png`.
- Server response is fine (0.2-0.5 s to first byte on the pages checked), so page speed is not where the next gain is.

## The five

### 1. Let the AI assistants learn the site (Cloudflare setting + robots.txt)

**Why it brings traffic.** People ask ChatGPT, Claude, Gemini and Apple Intelligence "what's a good free GEX tool" or "where can I see SPX gamma levels". The tools that search the web at that moment can already read the site. What is blocked is what the models learn ahead of time, and with it whether they name ZeroGEX when they answer without searching. Google-Extended also controls whether the Gemini app may use the pages to ground its answers; it does not affect Google Search or AI Overviews.

**The decision, written down.** Welcome the assistants that send people: GPTBot, ClaudeBot and CCBot (the open crawl many other models learn from), plus the Google-Extended and Applebot-Extended permissions. Those two are tokens, not crawlers: allowing them adds no crawling at all, only the right to use what Googlebot and Applebot already fetch. Keep everyone else on Cloudflare's former list out: data resellers, single-purpose scrapers, and search engines for markets ZeroGEX does not serve. Bytespider ignores robots.txt, so it stays blocked at the edge too.

**What changed.** `frontend/core/crawlerPolicy.ts` holds both lists and the reasoning; `frontend/app/robots.ts` now serves the keep-out list itself, so once Cloudflare stops writing its own block the policy lives in the repo, where it is versioned and tested (`frontend/tests/crawlerPolicy.test.ts` renders robots.txt and checks that no search engine or assistant is shut out and every keep-out crawler is). Deploying this alone changes nothing a crawler sees: until the Cloudflare setting changes, Cloudflare's block still sits in front of it.

**The trade-off.** The public pages may be used to train AI models. They are marketing and education pages, the paid data is not on them, and `llms-full.txt` already publishes every explainer for AI use. More crawling means some load on the server; the checklist says how to watch it for a week.

### 2. Tell Bing the same day: IndexNow, plus Bing Webmaster Tools

**Why it brings traffic.** Bing's index also serves Copilot, Yahoo and DuckDuckGo. IndexNow is the push version of a sitemap: one request listing the pages that changed, which Bing shares with the other participating engines (Amazon, Naver, Seznam, Yandex, Yep). The pages that rank for "today" searches change every trading day, and a page indexed a week late answers a question nobody is still asking. Google does not use IndexNow; the sitemaps remain its signal.

**What changed.**

| File | What |
|---|---|
| `frontend/core/indexNow.ts` | What to send. IndexNow asks sites not to resubmit unchanged pages, so the job remembers what it sent and each weekday sends only: the daily pages (the six levels pages, `/gex-levels`, `/chart` and the receipt indexes) once per market session, every dated permalink from the last week it has not sent yet, and any other page whose sitemap date changed (an article update, a new page). Files and other hosts are never sent. |
| `frontend/public/3c7b20a675c020ed1044107b6397cec2.txt` | The key file. IndexNow keys are public by design; the file proves the site owns the URLs it submits. |
| `frontend/scripts/indexnow-ping.mts`, `make indexnow` | Reads the built sitemap on the box and the dated sitemap from the local server, checks the key file is live, sends one request. `DRY_RUN=1` prints only; `ALL=1` sends every page, past permalinks included; `URLS="..."` sends specific pages. |
| `deploy/systemd/zerogex-web-indexnow.{service,timer}`, `deploy/steps/099.indexnow` | Weekdays at 5:43 PM New York time, after the close, the 4:01 PM forecast receipt and the 4:15 PM scorecard. Same hardening and failure email as the other jobs; the only thing it writes is its memory, in `/var/lib/zerogex-web-indexnow`. Market holidays come from the same `NEXT_PUBLIC_NYSE_HOLIDAYS` list the daily levels email uses. |
| `frontend/next-sitemap.config.mjs` | Keeps `/icon.png`, `/apple-icon.png`, `/favicon.ico` and `/feed.xml` out of the sitemap. |

**When it emails you.** Only when something on our side needs fixing: the key file is not live, or the endpoint says the request or key is invalid. A busy endpoint, or a 422 "already seen", is logged and tried again (or skipped) on the next run, with no email.

### 3. Qualify for Google Discover's large cards

**Why it brings traffic.** Discover is the article feed in the Google app and on Android's home screen. For a page that is not AMP, Google shows the large-image card only when the page allows `max-image-preview:large`; otherwise it can show at most a small thumbnail, which draws far fewer clicks. The same directive lets Google use larger thumbnails in ordinary results.

**What changed.** The root layout (`frontend/app/layout.tsx`) now sets `max-image-preview:large, max-snippet:-1, max-video-preview:-1` for every page that does not set its own robots tag. The last two are Google's defaults, stated so nothing narrows them by accident. There is no index or follow directive in it, so nothing about what gets indexed changes; the noindex pages keep exactly what they had. `/hedging-flow/sessions` set its robots to `undefined`, which in Next wipes the inherited value, so it now leaves the key out instead. `frontend/tests/robotsPreview.test.ts` fails the build if a future page overrides robots without a noindex.

**Limits.** This removes a blocker; it does not opt the site in. Discover also prefers distinct images, and 36 of the 42 articles use the generic site card as their social image, so the articles with their own image (the pillar, the walls, GEX, net GEX and best-tools pages) are the likely candidates until more get one. It also changes how `/spx-gamma-levels` can look in results, which is why the November 10 title check in the workstream doc now says to end its window the day before this ships.

### 4. An RSS feed of the articles

**Why it brings traffic.** Feed readers (Feedly, Inoreader) are how many finance readers follow sites; blog directories such as Feedspot's options-trading lists rank by and link to a site's feed; Zapier and IFTTT can post each new article to X or LinkedIn from it; and Search Console and Bing Webmaster Tools accept a feed as an extra sitemap, which helps a new article get found quickly.

**What changed.** `https://zerogex.io/feed.xml` (`frontend/app/feed.xml/route.ts`, built by `frontend/core/rssFeed.ts`): one item per education article, the same set `/articles` lists, newest first, with the listing summary rather than the full text, so readers click through and scrapers get little. An article's later update does not re-announce it. Every page's `<head>` now carries the feed link readers and directories look for.

### 5. QQQ's own page: `/qqq-gamma-levels`

**Why it brings traffic.** Search Console had this page at about position 27 for "qqq gex" (backlog item 3 in the workstream doc). It was the SPY page with the ticker swapped, nothing a QQQ trader could not read elsewhere. It now says what only applies to QQQ: one sentence under the heading (QQQ is the Nasdaq-100 ETF, and its levels come from its own chain, not from NDX), and two answers in its FAQ, which also go into the page's FAQ markup:

- **How often do QQQ gamma walls break?** From the site's own study of 737 wall tests: within an hour, 50.1% of the time, close to a coin flip, against about 31% for SPY and SPX, with the 15- and 30-minute figures, and why (the Nasdaq-100 itself, not QQQ's $1 strikes).
- **Are QQQ gamma levels the same as NDX and NQ levels?** No, and how to compare them.

**What changed.** `frontend/app/spx-gamma-levels/gammaLevels.tsx` gained `SYMBOL_EXTRAS`, a per-symbol slot with only a QQQ entry. Every other page renders exactly as before: a before-and-after render of all six levels pages against the same data showed changes on the QQQ page only, and `frontend/tests/qqqLevels.test.ts` pins that (only QQQ has an entry; the shared title, description and heading templates are untouched, since the SPX title is mid-test) and checks every QQQ figure against the study's table.

## Audit

A second review, run independently of the plan's author, checked each item against the code, ran Next's own metadata merge, re-read the live site and the vendors' documentation. What it changed:

- **The fifth item.** The draft's fifth item was a GEX glossary page. It was dropped: its premise was wrong (several terms it claimed had no page, such as dollar gamma, delta hedging and 0DTE, already have explainers), one definition repeated the zero-gamma article word for word, and a definitions page with a site-wide footer link would have competed with the explainers for the same searches, against the workstream's one-page-per-intent rule. The QQQ page work replaced it.
- **AI crawlers.** The draft said to allow all training crawlers. Allowing Training in Cloudflare lifts about 30 blocks at once, including data resellers, on a two-core server that renders most pages per request. The final plan allows the five that matter and writes the rest into robots.txt. A planned crawler-check script was dropped as noise: two `curl` commands do the same.
- **IndexNow.** The draft resent recently changed pages for several days and treated a 422 as an emergency. IndexNow's FAQ asks sites not to resubmit unchanged URLs and lists repeated submissions as one cause of 422, so the job now remembers what it sent, skips holidays, and does not email on a 422. It also takes each permalink whenever its list publishes it, instead of one "newest date" across all four lists, so a list that lags at 5:43 PM is caught the next day.
- **Smaller fixes.** An existing test pinned the hedging-flow archive's old robots line and was updated; Ecosia came out of the list of engines Bing serves (it now draws mostly on Google) and Amazon went into the IndexNow list; the feed's case no longer claims it carries update dates; the Discover claim was narrowed as above; and the Nov 10 title-test note was added.

## Considered and not built

- **An NVDA levels page.** The largest new pool of search demand ("nvda gex", "nvda gamma exposure", "nvda max pain"), and the code already expects one (`core/symbols.ts`: a stock joins `LEVELS_PAGE_SYMBOLS` with its page). Not built because the levels template is hard-wired to the six current instruments and feeds the six best-performing pages, because adding NVDA to the widget, the daily email and the assistant endpoints is a product decision, and because free delayed NVDA data could not be confirmed from outside the server. It is the best next step if you want one.
- **Search-visible translations.** 124 German, Spanish, French and Italian translations exist but are served by cookie at the English URL, so search engines only see English. Giving them their own URLs is a site-wide routing change.
- **A GEX glossary.** See "Audit".
- **An nginx cache for logged-out visitors.** Not needed at today's response times.

## Checklist

### Deploy

1. Merge `claude/seo-traffic-levers` into `release`, then on the server: `make deploy`.
2. Install the IndexNow timer, from the repo root: `sudo ./deploy/steps/099.indexnow`. It checks the key file is live, creates the job's memory directory, enables the timer and prints today's pages without sending them.
3. Once: `make indexnow ALL=1`. It introduces every page and every past permalink; from then on the timer sends only what changes.

### Cloudflare (item 1, about five minutes, after the deploy)

1. Security > Settings > filter "Bot traffic" > **AI Crawler and Agent access policies**: set **Training** to **Allow**. Leave Search and Agent as they are. With every policy on Allow, Cloudflare stops adding its block to robots.txt and stops turning those crawlers away at the edge, and the site's own robots.txt (item 1 above) takes over.
2. AI Crawl Control > Crawlers: set **Bytespider** to **Block**.
3. Check, from any terminal (both print something different today):
   - `curl -s https://zerogex.io/robots.txt | grep -c "Cloudflare Managed"` prints `0` (today: `2`).
   - `curl -s -o /dev/null -w '%{http_code}\n' -A 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)' https://zerogex.io/llms.txt` prints `200` (today: `403`).
4. For the next week, glance at AI Crawl Control's request counts per crawler and the server's load. If one crawler is heavy, set it to Block there.

### Search engines (one-time)

1. Bing Webmaster Tools (bing.com/webmasters): sign in, choose **Import from Google Search Console**, pick zerogex.io. Then under Sitemaps make sure `https://zerogex.io/sitemap.xml` and `https://zerogex.io/sitemap-dated.xml` are listed, and add `https://zerogex.io/feed.xml`.
2. Google Search Console > Sitemaps: add `https://zerogex.io/feed.xml`.

### Check after deploy

- `curl -s https://zerogex.io/feed.xml | grep -c '<item>'` prints 42.
- View source on any article: the head has `<meta name="robots" content="max-image-preview:large, max-snippet:-1, max-video-preview:-1"/>` and the `application/rss+xml` link; `/search` and `/register` still say `noindex`.
- `curl -s https://zerogex.io/3c7b20a675c020ed1044107b6397cec2.txt` prints the key.
- `curl -s https://zerogex.io/sitemap-0.xml | grep -c 'icon.png'` prints 0.
- `https://zerogex.io/qqq-gamma-levels` shows the new sentence under the heading and the two QQQ answers in its FAQ.
- After the first weekday run: `journalctl -u zerogex-web-indexnow -n 20` ends with `HTTP 200: accepted` or `HTTP 202`.

## How to tell whether it worked

| When | Where | Healthy |
|---|---|---|
| 1 week | Bing Webmaster Tools > IndexNow and Sitemaps; Search Console > Sitemaps | Submissions accepted each weekday; the feed read as a sitemap |
| 1 week | Cloudflare AI Crawl Control | GPTBot, ClaudeBot and CCBot fetching pages; server load unremarkable |
| 4 weeks | Bing Webmaster Tools > Search Performance | Impressions for the levels pages and the dated pages |
| 4-6 weeks | `make search-console-report PAGE=/qqq-gamma-levels QUERY=qqq SPLIT=<ship date>` | Average position for "qqq gex" better than the ~27 baseline |
| 4-8 weeks | Search Console > Performance (Discover appears as its own report once there is Discover traffic) | Any Discover impressions; larger image thumbnails on mobile results |
| 2-3 months | Analytics referrers: chatgpt.com, claude.ai, gemini.google.com, copilot.microsoft.com, bing.com | Rising assistant and Bing referrals |
