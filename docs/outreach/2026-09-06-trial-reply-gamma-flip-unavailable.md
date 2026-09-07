# Trial reply — "gamma flip unavailable" (Mat, 2026-09-06)

Mat (mathenan.aa24@gmail.com) replied to the day-2 value email
(`buildTrialValueEmail`, sent 2026-09-06 10:48 UTC):

> I have had gamma flip as unavailable so far, does it only appear
> occasionally? I was most interested in seeing that gamma level?

This is a 1:1 founder reply from your own inbox, same as the cancellation
follow-ups. **The trial has already been extended** (`make extend-trial`,
2026-09-06 21:56 UTC): it now runs through **2026-09-18**, and the ~48h
reminder is re-armed for the new window.

> **Status:** round one was sent on 2026-09-06 (the first draft, with the
> weekend-snapshot line; Mat did not mind). Mat replied the same evening,
> warmly, and asked for content on trading the levels on **NQ** charts. That
> answers the open symbol question. Round two is at the end of this file.

## The read

- **"Unavailable" is a declined publish, not a gap in the feed.**
  `_resolve_gamma_flip` (zerogex-oa, `src/analytics/main_engine.py`) builds
  the spot-shift dealer gamma profile on a ±20% grid, widens to ±35% and ±50%,
  and accepts a zero crossing only if it is interior (≥10% of the grid width
  from either edge), structurally significant (local peak ≥2% of the chain's
  p90 reference) and within 8% of spot (`max_flip_distance_pct`, `default`
  profile in `src/config.py`). Otherwise `gamma_flip_point` persists NULL and
  every surface shows it as such. The methodology page, the calculation guide
  and the zero-gamma article all say this in public.
- **When Mat looked.** The audit trail (`make diagnose-user`) puts the whole
  visit on Friday 2026-09-04: registered 13:13 UTC, last seen 16:38 UTC — that
  is 09:13 to 12:38 ET, pre-open through midday — and no return since. So the
  blank was seen during the live morning session, not on a frozen weekend
  snapshot. Both failure modes fit that window: the morning-open degraded
  chain (implied vols spike, modeled gamma collapses, the structural gate
  rejects everything until the book settles) and a flip genuinely sitting more
  than 8% from spot in a one-sided pre-holiday regime (the May 22, 2026 SPX
  precedent the engine's own throttle comment cites). Which one it was on
  Friday is checkable — see "Verify first".
- **Which surface.** Step 2 of the value email sent Mat to the Gamma Chart,
  whose chip reads `FLIP UNAVAILABLE`. Until this branch, that chip explained
  itself only through a native SVG `<title>` — a slow hover nobody knows to
  make, no visible mark, and copy ("one-signed or too thin") older than the
  declined-publish explainer the dashboard card and the Key Levels strip got
  on 2026-09-03 (`9658a97`). The chip now carries the same amber "?" and the
  same shared copy, chain attribution for ES / NQ included (see below).
- **Symbol unknown.** If Mat was on ES or NQ, the levels come from the SPX /
  NDX chain and the blank is an SPX / NDX miss.
- **Tier is Basic.** Step 3 of the value email (Trade Bias) is a Pro-tier
  page (`core/navigation.ts`), so a Basic trialer following the email hits a
  gate on the third step. Not this thread's problem, but the template should
  pick its third step by tier — noted at the end.

## Verify first

- Which day it was on Friday: open the replay for the session,
  `https://zerogex.io/replay/SPX/2026-09-04` (and `/SPY/`, `/QQQ/`,
  `/NDX/` — the replay says when a level is absent rather than drawing
  nothing, `2fec1ad`). If the flip resolved late morning, say so and give the
  level; if it never resolved, say that instead. Fill in the bracketed
  sentence in the draft with what you actually see; do not send the
  placeholder.
- Nothing more to verify for the extension: the second `diagnose-user` run
  already shows Stripe `trial_end` and the users row at 2026-09-18, and the
  re-armed 48h reminder will quote the new date. The in-app trial banner
  carries no date, so there is nothing for Mat to see until that reminder.

## Links

- https://zerogex.io/education/zero-gamma-level-explained — "How the zero
  gamma level is found", point 1: *The level can be absent.* The closest
  thing we have to an article on exactly this question.
- https://zerogex.io/guides/gamma-flip-calculation-before-vs-after — "The
  hardened flip resolver": the three gates and the honest NULL.
- https://zerogex.io/help/platform/reading-charts — "When there's no flip
  line": the `FLIP UNAVAILABLE` chip specifically.
- https://zerogex.io/methodology — the degraded-data paragraph.

## Draft

> **Subject:** Re: Getting a real read out of your ZeroGEX trial
>
> Hi Mat,
>
> Good question, and it deserves a straight answer: no, the flip isn't
> something that only appears now and then. "Unavailable" means the model
> looked and declined to publish a number.
>
> Here's what's behind it. ZeroGEX doesn't read the flip off a static list of
> strikes. It re-prices the whole option chain at every hypothetical price
> from roughly 20% below spot to 20% above, sums the modeled dealer gamma at
> each one, and calls the flip the price where that curve crosses zero. It
> only publishes that crossing when it sits within 8% of spot and is backed by
> real open interest rather than a noise-floor wobble. If nothing clears that
> bar you get a blank instead of a level I can't stand behind. Most tools
> print a flip every day regardless, which is why ours can look "missing" next
> to them.
>
> The two usual reasons for a blank:
>
> 1. Spot is deep inside one regime. In a strong long-gamma grind the zero
>    crossing can sit more than 8% below the market, and a level that far away
>    isn't tradeable on any horizon.
> 2. The chain is degraded when you look. Around the open, implied vols spike
>    and modeled gamma collapses across the board; the same happens in
>    extended hours or on a thin, one-sided chain. Those blanks usually clear
>    as the session settles.
>
> You were in the app on Friday morning, which is exactly when the second one
> bites hardest. [CONFIRM AND FILL IN from Friday's replay — e.g. "I pulled
> Friday's SPX snapshots: the flip was unresolved from the open until about
> 11:40 ET, then printed about 3% below spot for the rest of the day." — or,
> if it never resolved: "SPX's flip didn't resolve at all on Friday: the
> crossing sat about 9% below spot all session. That's the regime, not a
> fault."]
>
> Two things you can do whenever the flip is blank:
>
> - Read the sign of Net GEX at spot, the tile right next to it. Positive
>   means dealers are modeled long gamma (pinning, vol dampening); negative
>   means short gamma (trend, vol expansion). The regime is there even without
>   the level.
> - Open Dealer Positioning and look at the gamma profile chart. You'll see
>   the whole curve, and if it never crosses zero anywhere near spot, that's
>   the blank explained in one picture.
>
> On the dashboard, hover the amber "?" next to a blank Gamma Flip and it will
> say why, including which chain came up short. That matters if you were
> looking at ES or NQ: they have no options of their own, so their levels come
> from the SPX and NDX chains.
>
> The write-ups, if you want them: the zero gamma article has a short section
> on why the level can be absent
> (https://zerogex.io/education/zero-gamma-level-explained), and the
> calculation guide walks through the exact gates
> (https://zerogex.io/guides/gamma-flip-calculation-before-vs-after).
>
> One question back: which symbol were you on? If it was SPX or SPY I'd like
> to pull Friday's snapshots and look at them myself.
>
> And since the holiday weekend ate three of your seven days, I've extended
> your trial by a week: it now runs through September 18, so you get a proper
> run of live sessions with it.
>
> Michael
> Founder, ZeroGEX

## Done on this branch

- The Gamma Chart's `FLIP UNAVAILABLE` chip now carries the shared
  unresolved-level explainer (`core/keyLevels.unresolvedLevelTooltip`) behind
  the same amber `?` + TooltipWrapper the dashboard card and the Key Levels
  strip use, with the ES / NQ chain attribution. Label and copy live in
  `core/flipStatusChip.ts` and are pinned by `tests/flipStatusChip.test.ts`;
  the reading-charts help page says so in all five locales.

## Worth a separate ticket

- `buildTrialValueEmail` (`core/mailer.ts`) sends every trialer to Trade
  Bias as step 3, but Trade Bias is Pro-only and the trial can be Basic (as
  Mat's is). Pick the third step by tier — Live Bulletin or Dealer Positioning
  for Basic — so the "fastest path" never ends at an upgrade gate.

---

## Round 2 — Mat's reply, and the NQ follow-up

Mat's reply, in full effect: the explanation landed ("the chances of me being a
long-term subscriber of yours have now dramatically improved"), the extension
was appreciated, and one ask: *recommendations for content that breaks down
optimal ways to trade these gamma levels on NQ charts.*

### The read

- **NQ answers "which symbol".** ES / NQ carry no chain of their own
  (`core/symbols.ts`): NQ's levels are the NDX book projected onto the NQ
  price axis with the live futures basis (`src/jobs/futures_projection.py`).
  So the blank Mat saw on Friday morning was the NDX chain declining to
  publish, exactly the case the 2026-09-03 chain-attribution copy was written
  for.
- **What we actually have for an NQ trader.** Nothing is NQ-specific by
  title, but one piece is squarely about Nasdaq: *How Often Do Gamma Walls
  Actually Break?* measured 737 wall tests across SPY / SPX / QQQ / NDX and
  found S&P walls held about two times in three within the hour while Nasdaq
  walls were close to a coin flip (QQQ 50.1%, NDX 46.8% break within 60 min),
  with QQQ and NDX statistically indistinguishable — the odds belong to the
  index, not the chain you watch. That is the single most useful thing to
  tell someone about to trade NQ off these levels, and it argues for sizing,
  not for a different level.
- **Tools that fit Basic.** Replay is public and takes NQ
  (`/replay?symbol=NQ`, `/replay/NQ/<date>`; about thirty NQ sessions exist
  per the 2026-09-04 backtest note). The TradingView and thinkorswim scripts
  are free and manual-entry; NinjaTrader and Sierra Chart auto-update but need
  a Pro API key (`docs/integrations.md`). Pair Comparison and Gamma Terminal
  are Basic. Trade Bias and Backtesting are Pro — not offered below.
- **Keep the caveat in.** The same study found none of nineteen wall
  properties predicted which wall would break. Recommending "how to trade
  the levels" content without that sentence would oversell.

### Links used

- https://zerogex.io/education/how-often-do-gamma-walls-break
- https://zerogex.io/education/how-to-trade-around-gamma-flip
- https://zerogex.io/education/gamma-walls-explained
- https://zerogex.io/replay?symbol=NQ
- https://zerogex.io/integrations

### Draft

> **Subject:** Re: Getting a real read out of your ZeroGEX trial
>
> Hi Mat,
>
> Thank you for that. It's kind, and it's also useful: the only way I find out
> where the product confuses people is when someone tells me, so a thorough
> answer is partly self-interest. On the long-term part, no pressure from me.
> The trial's job is to let you decide on evidence rather than on a hunch, and
> if you get to the end still unsure, I'd rather hear that than have you
> subscribe anyway.
>
> On the extension, that's exactly what it's for. The honest test of this is
> a run of live sessions with the levels open next to your NQ chart, and a
> trial that starts on the Friday before a long weekend doesn't give you one.
> You have through September 18 now; use all of it.
>
> NQ also answers my question. ES and NQ don't have an options chain of their
> own, so your levels are the NDX book converted onto NQ prices with the live
> futures basis. Two things follow. The blank you saw was the NDX chain
> declining to publish a flip, not a gap in the NQ data. And NDX is the coarse
> Nasdaq book, with strikes every 25 points, so don't expect NQ to respect a
> level to the tick.
>
> For "how to trade these on NQ", three reads, in this order:
>
> 1. How Often Do Gamma Walls Actually Break? We Measured It. This is the one
>    for you. We measured 737 wall tests across SPY, SPX, QQQ and NDX. S&P
>    walls held about two times in three within the hour; Nasdaq walls were
>    close to a coin flip, and it made no difference whether you watched QQQ
>    or NDX. The break odds belong to the index, not the chain you watch. For
>    an NQ trader that means a wall is a prior with a known hit rate, not a
>    line that holds, and the same trade deserves smaller size than it would
>    on ES. https://zerogex.io/education/how-often-do-gamma-walls-break
>
> 2. How to Trade Around Gamma Flip Levels. The regime-switch workflow: check
>    which side of the flip you're on at the open, set a trigger for a cross,
>    watch the distance and the drift, and read Net GEX magnitude alongside
>    it. https://zerogex.io/education/how-to-trade-around-gamma-flip
>
> 3. Gamma Walls Explained, for the mechanics of why a wall behaves the way it
>    does. https://zerogex.io/education/gamma-walls-explained
>
> Then two ways to see it on an NQ chart rather than read about it:
>
> - Replay. Pick a past NQ session and scrub through it with the levels drawn
>   as they were at each minute. Watching how NQ treated the call wall and
>   the flip across ten or so recent sessions will teach you more than any
>   article: https://zerogex.io/replay?symbol=NQ
>
> - Your own chart. There's a free TradingView script and a free thinkorswim
>   study that draw the day's four levels on your NQ chart; you type the
>   numbers in from the free NQ page each morning. If you're on NinjaTrader or
>   Sierra Chart there are auto-updating versions, though those need a Pro API
>   key. https://zerogex.io/integrations
>
> One caveat I'd rather say now than have you find out: nothing in that study
> predicted which individual wall would break. The edge is in the base rate
> and the regime, not in reading a specific level. The levels are context for
> a decision, not the decision.
>
> If you tell me which platform you chart NQ on, I'll point you at the exact
> script. Enjoy the rest of the long weekend.
>
> Michael
> Founder, ZeroGEX
