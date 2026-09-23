# Andrés Puerta — the confluence write-up, IV walls, and Quant Data's Exposure Forecast (2026-09-13)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

Andrés (`ibfinanzas@hotmail.com`, signs "Andrés Puerta", sends as *jorge andres
puerta arango*) is the tester the Pin Strike regression is named after —
`frontend/tests/pinStrike.test.ts:135`, *"The session Andres described: the pin
walked 30 points DOWN with the tape."* He writes in Spanish-inflected English,
he is on the Gamma Chart daily, and he reads the signal pages closely enough to
notice when one contradicts itself.

> **Status:** unsent. Two inbound mails arrived fifty minutes apart on
> 2026-09-13 and should be answered as one reply.

## Thread so far

1. **2026-09-13 21:38, inbound.** "Greetings and thanks." Five things — see below.
   Attached `ATrain_Trades_IV_Walls_Final.pdf`, a two-page guide from ATrain
   Trades on their "IV Walls".
2. **2026-09-13 22:28, inbound.** "RE: Greetings and thanks." Quant Data shipped
   an **Exposure Forecast** beta; he pasted Andrew Hiesinger's announcement, a
   screenshot of it on SPY, and asked whether we would add "something better
   than this" to ZeroGEX. Mentions he has tried this himself with Kalman filters
   and econometric models and could not get it good enough.

## What Andrés actually said

- **Thanks for the score fix on the Gamma/VWAP Confluence.** He was "really
  worried" about it. He needs that tool plotting the levels correctly.
- **He is waiting for "the paper"** to understand the score better — and he
  wants the **cluster levels** explained too. This is the one real ask in the
  mail, and it is asked twice in one sentence.
- **He accepts the answer on not persisting the confluence reading.** *"I got it
  bout making last longer the confluence, you are right sir, the way it works
  now, is the better one."* Closed — acknowledge and move on.
- **The GEX ribbons are too many.** He wants fewer blue and gold ribbons;
  Friday's chart "plotted just a few" and he liked that better.
- **Do we plot IV-derived expected range high/low?** He attached the ATrain PDF
  as the example of what he means, and says he likes how that author explains it.

## The read

### "The paper" exists. He does not know it exists.

`cb392bd` (2026-09-11) published
`frontend/content/articles/gamma-vwap-confluence-explained.md` at
`/education/gamma-vwap-confluence-explained`. It is exactly what he is waiting
for: what the score measures, how the cluster is built, why the quality floor
makes a −5 mean *no cluster* rather than *weak bearish*, and why two symbols
disagree. It went live two days before he wrote, and nothing in the product
linked it from the Gamma/VWAP Confluence page. So he is waiting for a document
that was already finished. Lead with the link.

The page now carries that link at the foot of "How it's built". No signal page
has ever linked its explainer — there is no shared affordance for it and none
is added here, since that is a wider change than this thread needs — but the
one page he is reading should not leave him waiting for a published article.

That commit also recorded why it was written from the signal and not from the
router's docstring: **the docstring describes the clustering incorrectly.**

### The page he would read next contradicts the article — two ways

Both are fixed in this change, because sending him a link to the article while
the page tells him something else is worse than sending nothing.

1. **The "How it's built" block was the wrong formula.** It read *"Cluster the
   five reference levels … by their pairwise gap relative to spot"* and
   `Cluster Quality = (Members in Cluster / 5) × (1 − Cluster Gap % / Max Gap)`.
   That is the bad docstring, copied. The signal keeps the **flip and VWAP as
   permanent members** — which is why no card ever reads below `Members: 2` —
   and admits max pain, max gamma and the call wall only within **0.15%** of the
   flip/VWAP midpoint. Quality is `1 − gap% ÷ 1.0%` floored at 0.05, extra
   members multiply at `1 + 0.15 × (members − 2)`, distance saturates near
   ±0.30%, and long gamma inverts the sign at 0.7× rather than scaling it. The
   block now says all of that. The title tooltip had the same defect — it
   implied all five levels must stack — and is rewritten.
2. **`cluster_gap_pct` was back-computed wrong.** When the payload omits the
   field, `page.tsx` took `max(...) − min(...)` across all five reference levels
   and divided by spot. The gap is the distance between the **two core
   members**, flip to VWAP. Max pain, max gamma and the call wall are optional,
   and any one of them sitting far away inflated the number without being in the
   cluster at all — so on an ordinary day the "Cluster gap" field could read
   several times too wide, directly beside a "Cluster quality" computed from the
   real gap. The two never agreed and the field a reader uses to judge tightness
   was the wrong one. Now `|flip − VWAP| ÷ price`.

This is worth telling him plainly. He is the reason it was found.

### Yes, we already plot the IV expected range — it is off by default

His question is *"those levels do you use them to visualize on the chart, the
expected range high and low?"* The answer is yes, and it has been there a while:

- `GammaTerminalChart.tsx:118` — `expectedRange`, the IV-derived ±1σ band.
- `buildExpectedRange()` in `app/live-bulletin/bulletinHelpers.ts:437` —
  `σ% = (VIX/100)·√(days/252)`, band = `spot ± spot·σ%`. QQQ/NDX take **VXN**,
  SPX/SPY take **VIX** (`volatilityIndexFor`, chart line 715).
- Drawn as `ER HIGH` / `ER LOW` dashed lines (`chart line 2228-2229`), with a
  Daily / Weekly / Monthly selector that appears once the pill is on.
- `buildBandContext()` adds the gamma-aware half: whether each dealer wall sits
  inside or outside the 1σ band.
- **`DEFAULT_OVERLAYS.expectedRange = false`** (chart line 133), with the
  comment saying a new overlay should not reshape an existing user's chart
  unasked. That is why he has never seen it. It is also **live-only** — the
  delayed public snapshot carries no vol index.

Where ATrain genuinely differs, and it is worth conceding rather than glossing:
theirs is computed once each afternoon between 4:30 and 6:00 PM from SPY / QQQ /
GLD options, converted onto ES / NQ / GC, and then **held fixed for the whole
next session**. Ours is recomputed live and moves with spot, so it is not the
same object. The ZeroGEX thing that *is* fixed-for-the-session is the morning
forecast's projected range — walls plus a VIX/VXN and ATR blend, 90% coverage
target, graded held/broken at 4:05 PM. Point him at `/forecast` for that, since
it is closer to what he is actually asking for than the overlay is.

### Ribbons: he has them on, and the count is data, not a setting

`RIBBON_MIN_NORM = 0.05` in `core/gexRibbons.ts` — a strike draws nothing when
it is under 5% of the strongest orb in view. So the ribbon count is a property
of the book: a session with one dominant strike drops most lanes below the floor
and looks sparse, which is why Friday "plotted just a few". An evenly spread
book clears the floor everywhere and looks crowded. Nothing changed between
those days.

Three real controls, in the order worth trying: the **expiration filter** scopes
the ribbons as well as the rail (`railExpParam`, chart line 742), tightening the
**price zoom** cuts the lanes in view, and the **opacity slider** takes them
down without removing them. Say this rather than treating it as a bug — he is
asking for a setting we do not have, and the honest answer is that he already
has three that get him there.

### Quant Data's Exposure Forecast: most of it we already ship and grade

QD's beta classifies the environment as Pin / Grind / Volatile / Transition and
draws a forward cone with hold probabilities at +30m / +1h / +90m / +2h.

`/forecast` already commits, every morning before the open, to three claims and
grades all of them at 4:05 PM on a public receipt:

- **Expected range** — walls + VIX/VXN + ATR blend, 90% coverage target, graded
  `range_respected` held or broken.
- **Key levels** — per-line touch odds on the ladder, scored by **Brier**.
- **Expected volatility** — published and explicitly **not scored**, because
  over our history it does not beat a majority-bucket baseline.

That last one is the answer to his question. The gap between us and QD is not
the model, it is that we publish the scoreboard including the row we fail. Their
post says "our results were encouraging enough" and links no receipts.

What they have that we do not: the cone is anchored to the **current bar** and
re-forecasts intraday, where ours is one band committed at the open and then
left alone to be graded. That is a real difference and he should hear it named.
Do not promise it. If it gets built, the receipt gets built first.

## Verify first

- **What the score fix actually was.** He is thanking us for it, and the signal
  math lives in `zerogex-oa`, not in this repo — nothing here records it. Before
  the article link goes out, re-read the current
  `gamma_vwap_confluence` signal and confirm the article's constants (0.15%
  admission, 1.0% quality divisor, 0.05 floor, 15% per extra member, ±0.30%
  saturation, 0.7× long-gamma damping) still hold. The article was written
  2026-09-11 **from the signal**; if the fix landed after that, the article and
  this page are both now describing the old version, and the fix is what he is
  writing about.
- **His tier.** The Gamma/VWAP Confluence page is Pro. Run `make diagnose-user`
  on `ibfinanzas@hotmail.com` before the mail claims he can open anything.
- **The Expected Range pill on his symbol.** He trades ES/NQ per earlier threads
  but the screenshot he sent is SPY. The overlay is live-only; confirm it draws
  on whatever he is actually on before telling him where to click.
- **`/forecast` has a row for his symbol.** The landing page lists only dates the
  morning writer committed.

## Links used

- https://zerogex.io/education/gamma-vwap-confluence-explained
- https://zerogex.io/gamma-vwap-confluence
- https://zerogex.io/forecast

## Draft

**Subject:** Re: Greetings and thanks

Hola Andrés,

Thank you for this, and for the PDF — I read it properly, and there's an answer for you further down that I think you'll like.

First, the paper. You don't have to wait for it. It's written and it's live: https://zerogex.io/education/gamma-vwap-confluence-explained

It covers the score and the cluster, which is what you asked about. What it does not cover is why you couldn't find it, so let me say that part myself: nothing on the Gamma/VWAP Confluence page linked to it. I wrote the page, I wrote the article, and I never connected the two. You were waiting for something that was already finished. It's linked from the page now, at the bottom of the "How it's built" box.

Since you asked about the cluster levels specifically, here it is in short, and then the article has the long version.

The cluster always has two members, and they are the gamma flip and VWAP. Those two are the anchor, and that's why no card ever reads below "Members: 2" — that's the floor, not a signal.

Three more levels can join: max pain, max gamma (the GEX King) and the call wall. Each one is admitted only if it sits within 0.15% of the midpoint between the flip and VWAP. On SPX around 7,700 that's about 11 points, so it's a tight door. "Members: 4" means two of the optional three got in, and the zone is genuinely crowded.

The confluence level itself is just the average of whichever members qualified. That's the price the whole signal is measured against, and it's the line drawn on the level stack.

Then there are two numbers that tell you whether to trust it at all. The cluster gap is how far apart the flip and VWAP are, as a percentage of price. Cluster quality comes from that gap — tight is near 1.00, and past 1% apart it bottoms out at 0.05.

That floor is the thing most people misread, so I want to be direct about it. When quality is at the floor, the score is tiny no matter where price is. A −5 is not weak bearishness. It's the model telling you the two anchor levels are nowhere near each other and there is no cluster to read. Below ±20 the card says "No confluence edge" for exactly that reason.

And each member above the core two adds 15% to the magnitude — four members is 1.30× on identical geometry. That's the model saying a four-level stack deserves more attention than a two-level one.

Now the part I owe you, because you found something without knowing it.

When I went to check that the page and the article agreed before sending you this, they didn't. The "How it's built" box on the confluence page described a different cluster than the one the signal actually builds — it said all five levels get clustered and divided by five. That was copied from an internal description that was wrong, and it had been sitting there telling everyone the wrong construction.

Worse, and closer to what you'd actually notice: the "Cluster gap" number on that page was sometimes measuring the wrong thing entirely. When the server didn't send the value, the page computed it from the spread between all five levels instead of just the flip and VWAP. So one far-away level that isn't even in the cluster could make the gap read several times too wide — sitting right next to a quality score calculated from the real gap. Two numbers that could not both be true, in the exact box you'd look at to judge whether the cluster is tight.

Both are fixed. The page now says what the signal does, and the gap is the flip-to-VWAP distance it was always supposed to be. You asked to understand the cluster levels, and the honest answer is that the page wasn't going to let you. Thank you for pushing on it.

On the confluence not persisting — thank you for taking that one. It's the decision I'm least likely to reverse, and it's good to know it reads correctly to you now.

On the ribbons. The count isn't a setting, it's the book, and that's why Friday looked different.

A strike only draws a ribbon if it carries at least 5% of the gamma of the heaviest strike on screen. On a day like Friday, where one or two strikes dominate, everything else falls under that line and disappears — so you get a few clean ribbons. On a day where gamma is spread evenly across the chain, far more strikes clear the bar and the chart fills up. Nothing changed between the two days except the book.

Three things do let you cut them down, and I'd try them in this order. The expiration filter scopes the ribbons, not just the rail — put it on 0DTE and the lanes drop immediately. Zooming the price axis in leaves fewer strikes in view. And the opacity slider next to the Ribbons button pushes them into the background without turning them off, which is what I use.

Now your IV question, which is the best one in the mail: yes. We already draw it, and you've probably never seen it, because it's off by default.

On the Gamma Chart toolbar there's a pill called Expected Range. Turn it on and you get ER HIGH and ER LOW as dashed lines — a ±1σ band built from implied volatility, which brackets roughly 68% of outcomes. A Daily / Weekly / Monthly selector appears next to it once it's on. It uses VIX on SPX and SPY, and VXN on QQQ and NDX, so the volatility measure matches the index you're looking at.

It also tells you something the guide you sent doesn't: whether the dealer call and put walls sit inside that band or outside it. Both walls inside a 1σ range is a textbook pin setup. Both outside means reaching either takes a bigger move than the options market is pricing. That's the gamma half, and it's the half I'd actually trade off.

One honest difference from the ATrain method, because they are not the same object. Theirs is calculated once in the afternoon and then held fixed for the whole next session — a level you mark and leave alone. Ours recomputes live and moves with spot, so it's a band, not a wall.

If the fixed-for-the-session version is what you want, we have that too, in a different place: https://zerogex.io/forecast

Every morning before the open we commit to a projected range for the day — built from the dealer walls plus a volatility and ATR blend — and then we grade it at 4:05 PM and publish whether it held or broke. That one you can mark on your chart at 9:30 and leave there, which I think is closer to what you were asking for.

Which brings me to Quant Data's Exposure Forecast, and I'll give you the comparison straight rather than the salesman version.

Most of it we already do. That same forecast page commits each morning to the expected range, to which dealer lines price will reach with an explicit probability on each one, and to how much the day should move. Then it grades all of it on a public receipt at 4:05 PM — the range is marked held or broken, and the level probabilities are scored with a Brier score, which punishes confident wrong calls harder than hedged ones.

Here's the part that matters to me. One of those three claims, the volatility call, is published but deliberately not scored, because when I measured it against a baseline that just guesses the most common bucket every day, it didn't beat it. So it sits on the page marked "informational — not graded" instead of being quietly counted as a win.

That's the difference I'd point at. Their announcement says the results were encouraging enough to ship. Mine says which of my three calls isn't good enough to score. You can check every one of mine against what happened.

What they have that I don't, and I'd rather name it than let you notice it later: their cone is anchored to the current bar and re-forecasts through the day, with hold probabilities at 30 minutes, an hour, 90 minutes. Mine is one band committed at the open and then left alone to be judged. Theirs answers "what now"; mine answers "what today". That's a real gap.

I'm not going to promise you an intraday version. What I'll tell you is the order I'd build it in: the grading first, then the forecast. A cone that repaints and is never scored is a very pretty thing that nobody can check, and there are enough of those already.

Kalman filters — I'd be curious what broke, if you ever feel like telling me. My guess is the state kept chasing the noise near the walls, because that's where it goes wrong for me.

Have a good week, and thank you again. The gap bug in particular was sitting there in plain sight and nobody had said anything.

Michael
