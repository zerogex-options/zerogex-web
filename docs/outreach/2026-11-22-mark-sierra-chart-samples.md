# Mark Wilson: pictures or video of the Sierra Chart study (2026-11-22)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Mark Wilson (mark@timberwolfdesignbuild.com, Toronto) to support@,
Sun Nov 22, 9:29 AM, subject "Sierra Charts - Samples". The short ask: "can you
please forward pics or even video of Sierra Charts integrated levels so I can
further evaluate." The background he offered (marked "please skip if busy"):

- A hyper scalper on NQ (3 to 10 seconds) and a level-to-level trader on ES
  (1 to 10 minutes).
- MenthorQ for a few months, then TanukiTrade for nearly a year, then
  DeepCharts. DeepCharts' flip (he calls it HVL) "was like a vwap line" through
  the day, while TanukiTrade's "never moved all day".
- DeepCharts kept freezing and crashing ("Literally cost me thousands of
  dollars"; no gamma on Wednesday, down an hour after Thursday's open), so he
  went back to Sierra Chart a few days ago and executes through Teton.
- "Ultimately I seek a solution where I trade on the same screen as my lvls."

> **Status:** draft ready. Run the two checks under "Before sending" on the
> box, then reply in the same thread.

## The read

- **We have no pictures or video of the Sierra study, and we shouldn't make
  any.** Nothing in either repo shows it running in Sierra: the landing page is
  text only, and `docs/sierra-chart-indicator.md` still says it was compiled
  against Sierra's headers but never confirmed in a real install. A mock-up
  sent to a buyer who wants to evaluate would be a fake screenshot. So the
  draft says so up front, describes exactly what he'd see, and gives him a
  risk-free way to see it on his own Sierra.
- **What he's buying is "levels on the screen I execute from".** The study
  draws on Sierra's main price graph, so the levels sit on the chart he trades
  from with Teton. That is the answer to his "BUT, ultimately".
- **His test is the flip. Ours moves, but on Sierra it jumps rather than
  leaving a trail.** The levels are recomputed every minute in session and the
  study polls every 60 seconds, so it is not TanukiTrade's static line. But
  the study writes the latest value across every bar, so the flip is one flat
  line that moves as a whole: no VWAP-style path, and the morning bars show
  the afternoon's value. He'd see that in his first session, so it's better
  from us.
- **Reliability is the nerve, so one checkable line and no uptime claims.**
  The study fetches in the background, so a problem on our side stops the
  lines updating and leaves Sierra and his orders alone. Nothing about our
  uptime: the site was down Nov 19 to 20
  (`2026-11-20-outage-mario-sang-jae.md`).
- **The way to evaluate is his own Sierra, and the sale makes that cheap.**
  Pro is $29.50 a month for the first year in the Black Friday sale, and every
  sale purchase carries the 7-day money-back guarantee, which he can claim
  himself from the Account page. No custom coupon: the sale never stacks with
  one, and the guarantee already makes the trial risk-free.
- **He'd be one of the first to run it, so say so.** The study has been listed
  since August, but the version served until Nov 10 froze after its first
  load, and didn't build on Sierra releases from Oct 9 on
  (`docs/sierra-chart-indicator.md`, "Fixed 2026-11-10"). So the draft says "went out this month", not "new",
  and asks for any build error, as Kishan's did.
- **No competitor talk, no data-vendor talk.** He knows DeepCharts better than
  we do, and we don't name our vendor publicly. The data answer is under "If
  he replies".

## Verified

1. **What it draws.** `frontend/public/sierrachart/ZeroGexGammaLevels.cpp`:
   `sc.GraphRegion = 0`, the main price graph (line 442). Five subgraphs,
   width 2 (lines 452 to 475): Gamma Flip orange, Call Wall red and Put Wall
   green, all solid; Max Pain purple and Pin Strike light blue, dashed. No
   gamma histogram and no GEX 1..N (`docs/sierra-chart-indicator.md`, "It is
   not a port of the NinjaTrader indicator"). Restyle, hide, alerts and
   spreadsheet studies: the landing page copy
   (`frontend/components/PlotOnSierraChart.tsx`).
2. **Futures prices.** Symbol is typed per chart, ES by default (line 480).
   ES and NQ levels are the SPX and NDX books projected onto the contract we
   quote at fair value (`help/platform/data-coverage.md`, "Symbols covered").
3. **Refresh.** 60 seconds by default (line 494), with a 30-second floor at
   runtime (`MINIMUM_REFRESH_SECONDS`, line 121). The server recomputes the
   levels every 60 seconds from 9:30 to 4:00 ET (`ANALYTICS_INTERVAL=60`, see
   `2026-11-19-ron-windsor-datafirst-speed.md`, "Verified" 1).
4. **No trail.** `ApplyLevel` (line 387) writes one value into every bar, and
   the redraw pass carries it onto new bars (from line 592). Bookmap is the
   only integration that draws the history (`docs/bookmap-indicator.md`,
   comparison table).
5. **Background fetch.** One request at a time, abandoned after 30 seconds
   (`REQUEST_TIMEOUT_SECONDS`, line 112). A failed request opens Sierra's
   Message Log (lines 530 and 540) and the last levels stay drawn until the
   next good poll.
6. **Overnight.** The levels from the 4:00 PM close, less the options that
   expired at it, stand until 9:30 (`help/platform/data-coverage.md`, "Market
   hours").
7. **Sale and guarantee.** `docs/black-friday-2026-runbook.md`, section 1: Pro
   monthly $29.50 for 12 payments, first-time members only, until 11:59 PM ET
   Tue Dec 1, covered by the guarantee, never stacks. The guarantee is
   self-serve: **Request a full refund** on the Account page within 7 days of
   the first payment, one refund per customer (`help/platform/account.md`).
8. **No pictures anywhere.** `/sierra-chart-indicator` renders text only
   (`app/sierra-chart-indicator/page.tsx`, `PlotOnSierraChart.tsx`), and there
   is no Sierra image in `assets/`, `docs/ad-assets/` or `frontend/public/`.
   Kishan, the one member we know set out to build it (Nov 10), has nothing
   recorded since (`2026-11-10-kishan-sierra-pro-free-month.md`).

## Before sending (on the box)

### 1. His account: does the sale apply?

```bash
cd ~/zerogex-web && make diagnose-user EMAIL=mark@timberwolfdesignbuild.com
```

- "No user found", or a free account that never held a plan or trial: send
  as is.
- Any past or current plan or trial: checkout won't sell him the sale. Replace
  the "To try it" paragraph's first sentence with: "To try it: the study comes
  with Pro, which is $59 a month." Check that he hasn't had a refund before
  keeping the guarantee sentence (one per customer).

### 2. Is anyone's Sierra study pulling levels? (decides one sentence)

The Sierra study is the only client that puts the key in the URL with
`strikes=1`, and nginx logs those requests with the key replaced by
`REDACTED`. This counts them by day:

```bash
sudo zcat -f /var/log/nginx/access.log* | grep -F 'strikes=1&api_key=' | awk -F'"' '{split($1,a," "); split($3,b," "); split($2,r,"[/?]"); print substr(a[4],2,11), r[5], b[1], a[1], $6}' | sort | uniq -c
```

Columns: count, date, symbol, status, address, user agent. One chart at the
default setting makes about 60 requests an hour.

- **`200` rows in the dozens or more:** a working install. Keep the bracketed
  sentence in the draft.
- **Only `401` or `404`:** someone tried with a bad key or symbol. Not a
  working install. Delete the sentence.
- **`curl`, `python` or a browser in the last column:** a script, not Sierra.
  Ignore it.
- **Nothing:** no one has run it within the log's window (nginx keeps about
  two weeks by default). Delete the sentence.

The rest of the draft is true either way.

## Draft

**Reply in the same thread.**

Hi Mark,

Thanks for writing, and I read the background too. It tells me what you'd be checking for.

Straight answer first: I don't have pictures or a video of the Sierra study yet, and I'd rather not send you a mock-up of something you're evaluating. So here's exactly what you'd see, and a way to see it on your own charts without risking anything.

What it draws: you add the study to your ES chart and your NQ chart, set its Symbol to ES or NQ, and it draws five horizontal lines on the price graph, already in futures prices: the gamma flip (your HVL), the call wall, the put wall, max pain and the pin strike. Each line is a normal Sierra subgraph, so you can recolor or hide it and use it in alerts and spreadsheet studies. It sits on the chart you trade from with Teton, so your levels and your orders are on one screen, alongside any order-flow studies you run there. [Keep only if check 2 found a working install:] It's already running on Sierra charts today.

How the levels move: we recalculate them every minute from 9:30 to 4:00 ET, and the study pulls the new values every 60 seconds, so the flip moves through the session instead of sitting still all day. One difference from the VWAP-like line you described: on Sierra, each line shows the current level across the whole chart and jumps when the level moves, rather than leaving a trail. Overnight and pre-market, the lines hold the levels from the 4:00 PM close until the 9:30 open.

If we ever have a problem: the study fetches the levels in the background, so if our server stops answering, the lines stop updating, but Sierra and your Teton orders keep working.

To try it: the study comes with Pro, which is half price for your first year in our Black Friday sale: $29.50 a month, through December 1. It's covered by our 7-day money-back guarantee, so if it doesn't earn its place on your screen, click Request a full refund on your Account page within 7 days. Setup is three steps, and Sierra compiles the study for you, so there's nothing extra to install: https://zerogex.io/sierra-chart-indicator

The current version of the study went out this month, so you'd be one of the first traders running it. If the build or the study shows any error, send me the message and I'll fix it quickly.

If you'd like to compare our numbers with what you're used to first, our free pages show the same ES and NQ levels on a 15-minute delay, no signup: https://zerogex.io/es-gamma-levels and https://zerogex.io/nq-gamma-levels

Best,
Michael
Founder, ZeroGEX

## If he replies

- **"Can it show the flip's path through the day on Sierra?"** Not today, and
  don't promise it. Sierra's `sc.MakeHTTPRequest` can only put the key in the
  URL, and the only endpoints that accept that are `/api/v1/levels` and
  `/api/v2/levels`, which return the current snapshot (zerogex-oa
  `src/api/security.py`, `_QUERY_KEY_PATH_PREFIXES`, pinned by
  `tests/test_api_query_key_auth.py`). A trail from the moment the study
  loads is a study-only change; the part of the day before it loaded also
  needs history the study can reach. Either needs checking on a real Sierra.
  Note him as demand.
- **"How do I know the lines are current?"** Turn on *Log Status Messages* in
  the study's settings: each poll writes the five levels and the data's age to
  Sierra's Message Log. A failed request opens the Message Log by itself.
- **"Can it refresh faster?"** It can poll every 30 seconds, but the levels
  are recomputed once a minute, so 60 seconds misses nothing.
- **"Where does your data come from?"** OPRA, the consolidated U.S. options
  tape, for the SPX and NDX options; we compute the Greeks and implied
  volatility ourselves; the book holds the ten nearest expirations plus the
  next two monthlies (`help/platform/data-coverage.md`; the Ron note,
  "Verified" 5). We don't name the vendor publicly, and don't compare it with
  DeepCharts' feed.
- **"Do the walls hold on NQ?"** Across 737 wall tests, S&P walls held about
  two times in three within the hour and Nasdaq walls were close to a coin
  flip (`content/articles/how-often-do-gamma-walls-break.md`). The same figure
  Corey and Michael Nash got.
- **"The levels are a few hundred points off my chart."** A contract-month
  mismatch. The Sierra study has no contract check (Bookmap's does), so for a
  few days around the December roll his chart and our levels can be on
  different months: https://zerogex.io/help/platform/futures-contract-months
- **"The build failed."** Ask for the exact text from the build output or the
  Message Log. Maintainer notes are in `docs/sierra-chart-indicator.md`; after
  a fix, run `make integration-assets` and commit the manifest.
- **"Do you have a heatmap or order flow?"** Not a depth heatmap. Don't
  promise one (same answer Corey got).

## Worth knowing (can wait)

- **There is no picture of the Sierra study anywhere, and Mark won't be the
  last to ask.** If check 2 shows someone running it, or once Mark is, one
  screenshot from them (with their permission) on `/sierra-chart-indicator`
  answers this for everyone. Can wait.
