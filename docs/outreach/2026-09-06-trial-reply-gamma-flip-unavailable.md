# Trial reply — "gamma flip unavailable" (Mat, 2026-09-06)

Mat replied to the day-2 value email (`buildTrialValueEmail`, sent 2026-09-06
11:48):

> I have had gamma flip as unavailable so far, does it only appear
> occasionally? I was most interested in seeing that gamma level?

This is a 1:1 founder reply from your own inbox, same as the cancellation
follow-ups. Trial runs through 2026-09-11, so it started Friday 2026-09-04.

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
- **What he saw depends on the surface.** The Gamma Chart chip reads
  `FLIP UNAVAILABLE` with no tooltip; the dashboard card reads
  "N/A · Gamma Flip unresolved this snapshot" with the amber "?" explainer
  (added 2026-09-03, `9658a97`); the Key Levels strip shows an em-dash. Step 2
  of the email sent him to the chart, so the chip is the likely one — and it is
  the one surface that still explains nothing.
- **Timing explains "so far".** He started on the Friday before Labor Day.
  Outside the session the engine re-serves the last frozen snapshot, so from
  Friday's close through Monday every page shows one snapshot. If that one
  came up unresolved (after-hours chain, or the crossing >8% below spot — the
  May 22, 2026 pre-holiday SPX regime is the precedent the engine's own
  throttle comment cites), he has seen a single blank for three days, not a
  pattern.
- **Symbol unknown.** If he was on ES or NQ, the levels come from the SPX /
  NDX chain and the blank is an SPX / NDX miss; the card's tooltip says so, the
  chip does not.
- **He has four live sessions left** (Tue 8 – Fri 11). A trial that lands on a
  holiday weekend is a fair reason to extend.

## Verify first

- Open `/dashboard` (or the free `/spx-gamma-levels`) and check whether the
  SPX / SPY flip is resolved now and what the Net GEX sign is. Fill in the
  bracketed sentence in the draft with what you actually see; do not send the
  placeholder.
- `make diagnose-user EMAIL=<mat's address>` for the exact trial dates and
  whether the audit trail shows which pages he opened.
- Extension, if you want it:
  `make extend-trial EMAIL=<addr> EXTEND_DAYS=7 DRY_RUN=1`, then `YES=1`.

## Links

- https://zerogex.io/education/zero-gamma-level-explained — "How the zero
  gamma level is found", point 1: *The level can be absent.* The closest
  thing we have to an article on exactly his question.
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
> 2. The chain is thin or one-sided when you look: extended hours, weekends,
>    or an implied-vol spike. Outside the session the whole app is re-serving
>    the last snapshot, so if Friday's close came up blank it stays blank until
>    Tuesday's open.
>
> That second point is probably most of your experience so far. You started
> Friday, the market has been shut since, and Monday is Labor Day.
> [CONFIRM AND FILL IN — e.g. "I've just checked SPX: the flip has been
> unresolved since Friday's close because the crossing sits about 9% below
> spot, so you weren't seeing a fault."]
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
> On the dashboard, hover the amber "?" on the empty Gamma Flip card and it
> will say which chain came up short. That matters if you were looking at ES
> or NQ: they have no options of their own, so their levels come from the SPX
> and NDX chains.
>
> The write-ups, if you want them: the zero gamma article has a short section
> on why the level can be absent
> (https://zerogex.io/education/zero-gamma-level-explained), and the
> calculation guide walks through the exact gates
> (https://zerogex.io/guides/gamma-flip-calculation-before-vs-after).
>
> One question back: which symbol were you on, and roughly when? If it was
> during Friday's session on SPX or SPY I'd like to pull that snapshot and
> look at it myself.
>
> [OPTIONAL: Since the holiday weekend ate three of your seven days, I've
> extended your trial by a week so you get a proper run of live sessions with
> it.]
>
> Michael
> Founder, ZeroGEX

## Follow-up worth a ticket

The Gamma Chart's `FLIP UNAVAILABLE` chip is now the only unresolved-flip
surface with no explanation attached. The 2026-09-03 change gave the dashboard
card, the Key Levels strip and the public pages an explainer for exactly the
"is there no data?" email; the chip should carry the same copy (or a link to
the reading-charts help section), since the value email sends every new trial
to the chart as step 2.
