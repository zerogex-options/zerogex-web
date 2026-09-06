# Trial reply — "gamma flip unavailable" (Mat, 2026-09-06)

Mat (mathenan.aa24@gmail.com) replied to the day-2 value email
(`buildTrialValueEmail`, sent 2026-09-06 10:48 UTC):

> I have had gamma flip as unavailable so far, does it only appear
> occasionally? I was most interested in seeing that gamma level?

This is a 1:1 founder reply from your own inbox, same as the cancellation
follow-ups. **The trial has already been extended** (`make extend-trial`,
2026-09-06 21:56 UTC): it now runs through **2026-09-18**, and the ~48h
reminder is re-armed for the new window.

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
