# Ahmad Nagi: why walls and not the flip (2026-10-27)

Ahmad Nagi wrote to Support at 4:05 PM, in the thread "Re: Permission to log
your free delayed GEX levels for private research". They read "How Often Do
Gamma Walls Actually Break? We Measured It" and asked why the study measured
walls rather than the gamma flip: was it the user question that started the
project, or did we look at the flip and find it less suited to that kind of
test? They're deciding which level to study and asked for the reasoning, "even
if it's just a short note".

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it pastes straight into a mail client. The earlier part of the
thread (the request to log the free delayed levels) isn't in either repo, so the
draft doesn't refer back to it.

> **Status:** drafted 2026-10-27, not sent.

## The read

- **It was the user question.** The study's design doc records the origin: a
  trader's SPX 7720 call wall that broke, and how to judge the odds of that
  (zerogex-oa `docs/design/wall-break-odds.md`, "Origin"). Nothing in
  `research/` measures the flip as a level. The flip appears only as two
  candidate features in the wall study (`flip_distance`, `spot_above_flip`),
  and both changed sign between SPX and QQQ. So the record says we never tested
  the flip and passed on it. Only you know whether you weighed it informally.
- **The reason the same test doesn't fit the flip is our own published
  position.** Both flip guides say the flip is a regime boundary, not support
  or resistance (`how-to-read-a-gamma-flip.md`, "Treating the flip as support
  or resistance"; `how-to-trade-around-gamma-flip.md`). A hold-or-break rate
  tests a claim the flip doesn't make. That is the useful answer to "which
  level is better to study".
- **The one internal look at the flip's real claim** is zerogex-oa
  `research/trade_bias_movement`, the 2026-09-25 run (README, "Result"): SPY
  and SPX, 49 sessions (Jul 17 to Sep 25). In short gamma, the 30-minute range
  was 1.26x [1.08, 1.45] that of other minutes, and 1.08x [1.03, 1.13] after
  adjusting for time of day and recent movement. It's context, not a verdict:
  uncorrected for multiple comparisons and under that study's own 10% bar.
  "Short gamma" there is the sign of total net GEX (plus a gradient filter),
  which `research/short_gamma_trend` notes can disagree with net GEX at spot.
  That's why the draft calls it a cousin of a flip test, not the test.
- **The logging notes are about our free pages.** Every read there is at least
  15 minutes old and carries an "as of" time. When the flip is unresolved, the
  page still shows "Net dealer GEX (at spot)", and the methodology page says
  the two come from the same curve and can't contradict each other. NDX's flip
  went blank for days at a time in August and September (see
  `2026-09-28-sulby-nq-gamma-flip.md`).
- **Left out on purpose:** the free /replay page (it would save weeks of
  logging, but pointing a researcher at it is your call; see below), and how
  sensitive the flip is to modeling settings (true, but too deep for a short
  note).

## Before sending

1. **Check the first paragraph against your memory.** It says we didn't test
   the flip first and decide against it. That's what the repo shows. If you did
   weigh the flip at the time, change that sentence to say why.
2. **Decide on the sixth paragraph** ("The closest we've come…"). It quotes an
   internal study you haven't published. The email stands without it. Keep it
   if you're comfortable sharing preliminary numbers, since it shows the trap
   in the paragraph before it with real data.

## Draft

**Subject:** Re: Permission to log your free delayed GEX levels for private research

Hi Ahmad,

Thanks for reading it so closely. The short answer is that it was the user question. A trader wrote in after SPX broke through a big call wall and asked how to judge the odds of that happening, so walls were what we set out to measure. We didn't test the flip first and decide against it.

Having done the work, though, I wouldn't run the same test on the flip, because the flip doesn't make the same claim. A wall's claim is about a place: price tends to stall there, so "price reached it; did it hold or break?" tests it directly. The flip's claim is about behavior on either side of it: above the flip, modeled dealer hedging should dampen moves, and below it, add to them. Nothing in that says price should stop at the flip, which is why our own guide says not to trade it as support or resistance (https://zerogex.io/education/how-to-read-a-gamma-flip). A hold-or-break rate for the flip wouldn't confirm or refute anything.

So which is better depends on the question you want to answer.

Walls are the cleaner study. The event and the outcome are both well defined, and you'd have our numbers to check yours against. Ours cover one summer, so a replication over a different stretch of market would be worth having. The article's limits section also leaves a question open: whether most of the useful information is in whether price reaches a wall at all, rather than in what happens once it gets there.

The flip is the more open question, and the harder study. The test I'd run is whether price moves further over the next 30 to 60 minutes when it's below the flip than when it's above. The trap is that time of day and recent volatility predict movement by themselves. Price also often gets below the flip by falling, and falling markets tend to be more volatile anyway. So compare minutes at the same time of day after similar recent movement, or the flip gets credit for volatility that was already there.

The closest we've come is an internal check we haven't published: SPY and SPX, 49 sessions from mid-July to late September. When our model had dealers net short gamma, the high-to-low range over the next 30 minutes was about 26% larger than at other times. Adjusting for time of day and recent movement shrank that to about 8%. That's the direction the theory predicts, but it's small and we haven't confirmed it on new data. It also defined the regime by the sign of total net GEX rather than by the flip itself, so treat it as a close cousin of that test.

Two practical notes on logging from our free pages:

1. They run about 15 minutes behind, so key each reading to the "as of" time on the page, not the time you logged it.
2. Some snapshots publish no flip, when there's no crossing close enough to price for us to stand behind. On NDX that can last for days, so don't just drop those minutes. Log "Net dealer GEX (at spot)" as well. It comes from the same curve as the flip, so its sign is the regime the flip divides (positive above, negative below), and it's still published when the flip isn't.

I'd be glad to hear what you find, whichever level you pick.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If they reply

- **They want the internal study's details.** The shareable figures, all from
  the same run: short gamma 1.26x raw and 1.08x adjusted (intervals above);
  the first half hour travels 1.76x as far as the rest of the day; after the
  busiest fifth of recent movement, 1.61x, and after the quietest fifth, 0.75x.
  Intervals are a date-level block bootstrap. Nothing else on the flip's
  regime claim has been run on market data (the MSI study's empirical arm,
  `research/msi_regime_excursion`, is built but unrun).
- **They ask for history instead of logging forward.** The free /replay page
  has per-minute walls and flip for recent sessions, no login (the page lists
  the last 30; the API allows up to 180). Your call whether to offer it:
  pulling many sessions hits the API harder than reading the levels pages.
- **They ask how the flip is computed, or whether it has changed.**
  https://zerogex.io/methodology covers the spot-shift profile, the three
  acceptance gates, and why an unresolved flip prints nothing.
  https://zerogex.io/guides/gamma-flip-calculation-before-vs-after documents
  the switch from the old cumulative-by-strike method.
