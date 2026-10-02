# Gamma Walls Explained: Call Wall, Put Wall, and How Price Reacts

*Gamma walls are the most-watched levels in dealer-positioning analysis. What each wall does in each regime, what the gap between them tells you, how they behave into same-day expiry, and when the read holds versus breaks.*

---

## Start here

A gamma wall is a strike where modeled dealer gamma exposure is heavily concentrated. There are two: the **call wall** above spot and the **put wall** below it. Neither is support or resistance by construction - what the hedging at a wall does depends on the modeled dealer gamma *sign* and the flow around it, not on whether the contracts sitting there are calls or puts.

If that definition is what you came for, [What Is a Gamma Wall?](/education/what-is-a-gamma-wall) covers it on its own and is the shorter read.

This page is the applied one. It assumes you know what a wall is and works through the parts that decide whether the level is useful on a given day: what each wall does in each regime, what the distance between them tells you, how they behave into same-day expiry, how they migrate, and how often walls actually hold or break. For the regime context underneath all of it, pair this with [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) and the broader [Gamma Exposure pillar](/education/gamma-exposure-explained).

---

## What is a call wall?

The call wall is the strike above spot that carries the heaviest call gamma exposure. Under the traditional convention, dealers are *modeled* as long those calls, so in a positive-gamma regime they tend to sell into rallies that approach the wall - shedding the positive delta they accumulate as price climbs toward it. That hedging reflex can push against the rally.

In practice, the call wall often acts as **resistance** - not because the level is magic, and not simply because it is a call strike. In positive-gamma conditions the modeled hedging flow around it tends to lean against the move; change the gamma sign and that hedging runs with the move instead.

Things to know:

- The wall is the *current* heaviest concentration. As OI shifts, the wall moves.
- In long-gamma regimes (spot above the gamma flip), hedging around the wall leans against a rally. In short-gamma regimes it runs with one, so if the level gives way it can turn from resistance into a breakout accelerant. The regime changes that behavior, not how often the wall breaks.
- A call wall is a **probabilistic** lean, not a hard ceiling. Real flow can punch through.

---

## What is a put wall?

The put wall is the strike below spot with the heaviest put gamma exposure. When the net book is modeled as long gamma (a positive Net GEX regime), the aggregate dealer hedge tends to buy weakness and sell strength - so as price drops toward a dense put strike, that buy-the-dip reflex can lean against the selloff. That behavior comes from the *net* gamma sign, though, not from the strike being made of puts.

In practice, the put wall often acts as **support**. Like the call wall, whether the hedging around it cushions a decline, pins price, or accelerates a break depends on the modeled dealer gamma sign and the surrounding flow - not on the option type.

Things to know:

- The wall is dynamic. Heavy OI rolling off into expiry can erase a put wall by midday.
- In a short-gamma regime, dealer behavior inverts - hedging stops absorbing weakness, and if the put wall gives way it can become a slippage point on the way down.
- A put wall is a lean. Macro shocks, vol expansion, and chain refits can all override the structural read.

---

## Why price reacts at gamma walls

The mechanism is dealer hedging, not psychology. The clearest way to see it:

In a **positive-gamma** regime, dealers tend to hedge *against* price movement. They sell as price rises and buy as it falls. Near a wall, that reflex can intensify because the gamma concentration is locally large - a small move toward the wall can call for a relatively larger hedging trade away from it. This assumes the modeled dealer gamma sign holds around that strike, which is why the same wall can behave differently when the surrounding flow or net sign shifts.

In a **negative-gamma** regime, the reflex inverts. Dealers tend to hedge *with* price movement. The same wall that pinned price in long-gamma can become a breakout vector - once price clears it, the hedging trade reinforces the move instead of fading it.

A gamma wall is not a fixed property of the chain. It is a fixed *level* whose hedging effect depends on the **regime around it** - which is exactly the read the gamma flip provides. What the regime does not decide is whether the wall holds: in our measurement of 737 wall tests, S&P walls held about two times in three within an hour and Nasdaq walls about half, on either side of the flip ([How Often Do Gamma Walls Actually Break?](/education/how-often-do-gamma-walls-break)).

---

## What the distance between the walls tells you

The two walls carry more information together than either does alone. The gap between them is the range current positioning is most consistent with, and its shape is readable in two ways.

**Width.** A narrow wall range means gamma is concentrated close to spot on both sides. In a positive-gamma regime that is the classic pinning setup - hedging leans against moves in both directions. A wide range means the nearest dense strikes are far away, so there is less concentrated hedging in between and price can travel further before meeting any.

**Asymmetry.** Spot rarely sits in the middle. When one wall is much closer than the other, the near wall is the level that actually gets tested and the far one is mostly context. Spot sitting 0.3% under the call wall and 1.4% above the put wall is a different day from spot sitting midway between them: the first has a near-term decision point, the second does not.

The trap is reading width or asymmetry without the regime. Both readings above assume positive gamma. Below the flip, the same narrow range is not a pin - it is a short distance between two levels, and hedging will add to a move through either one. To run all three reads - width, asymmetry, and regime - on today's tape, check the [current SPX gamma flip, call wall, and put wall](/spx-gamma-levels).

---

## How gamma walls shift intraday

Walls do not get announced at the open and hold through the close. They migrate. Three common patterns:

1. **Gamma repricing.** Spot, time to expiry, and implied volatility change each strike’s modeled gamma and can change the ranking even while official OI is fixed.
2. **Spot-side eligibility.** A strike can move from one side of spot to the other, while another fixed-OI strike becomes the largest eligible concentration. Official OI generally updates after clearing; intraday wall migration does not establish that customers opened positions at the new strike.
3. **Near-expiry concentration.** ATM gamma can rise sharply while decisively ITM or OTM strikes tend toward zero, changing the ranking. That repricing is distinct from positions closing and from official OI updating after clearing.

A wall can also shift purely because spot, time, and implied vol move - the strike carrying the most modeled exposure changes even when positioning does not. A gamma wall is the *current* heaviest modeled-gamma strike. Treat it as a live read, not a fixed line.

---

## Gamma walls into same-day expiry

0DTE is where wall behavior is most extreme, in both directions.

Gamma on a same-day chain is very large near spot and falls away quickly from it, so the walls sit tight to price and the concentration at them is far heavier than on a longer-dated chain. When the regime supports it, that produces the strongest pinning you are likely to see - price grinding in a narrow band between two walls only a few points apart.

The same concentration makes those walls unstable. Because 0DTE gamma reprices sharply as spot moves and as the clock runs, a 0DTE wall can migrate several times in an hour without a single new position being opened. Walls can also vanish: as strikes go decisively in or out of the money their modeled gamma tends toward zero, and the ranking reshuffles around whatever is left near spot.

Two practical consequences. A 0DTE wall read has a much shorter shelf life than the same read on a monthly chain - minutes rather than hours. And once price clears a 0DTE wall in a negative-gamma regime, there is often little dense gamma left between it and the next level, which is part of why late-session breaks on expiry days can travel so far so quickly.

---

## When walls hold and when they break

Walls are not predictions, and we have measured how often they give way. Across 737 wall tests on SPY, SPX, QQQ and NDX over ten weeks in 2026, S&P walls held about two times in three within an hour of being tested and Nasdaq walls about half ([How Often Do Gamma Walls Actually Break?](/education/how-often-do-gamma-walls-break)). That base rate for the index is the best prior available, and none of the conditions traders usually reach for improved on it:

**Conditions we tested that did not predict a break:**

- Which side of the flip spot was on - positive or negative gamma.
- The wall's size, its share of the book, and its rank against its own history. Bigger walls broke slightly less, but too weakly to separate from noise.
- Net GEX, its trajectory, and the distance to the flip.
- Whether the wall was migrating with price, and whether its gamma was strengthening or being consumed.
- Signed flow at the wall strike, whether that flow was accelerating, and realized volatility.
- How long the wall had stood, how many times it had been tested, and the time of day.

**What the regime changes instead:**

- In positive gamma (above the flip), modeled hedging leans against a move into the wall, which can slow it or pin price near the strike.
- In negative gamma (below the flip), modeled hedging runs with the move, so if the wall gives way, hedging adds to the break instead of fading it.

Most of these can be read in real time, and none of them tells you whether this wall will hold. A macro catalyst (CPI, FOMC, NFP, a geopolitical headline) landing during a test can overwhelm the hedging in either regime. Use the index's base rate as your prior and the regime as a description of what hedging is doing around the level, not as odds.

---

## How ZeroGEX shows the call wall and put wall

The dashboard surfaces walls in two places:

- **Wall metric cards** show the current call wall and put wall strikes, with live percent distance from spot.
- **The GEX walls chart** plots the strike-by-strike gamma profile with both walls highlighted.

![ZeroGEX dashboard Call Wall and Put Wall cards with percent distance from spot](/blog/zerogex-walls-cards.png)

A worked example. Suppose SPX is at 5,830. The dashboard shows:

- **Call Wall:** 5,850 (+0.34% from spot)
- **Put Wall:** 5,790 (−0.69% from spot)
- **Net GEX:** +$1.5B
- **Gamma Flip:** 5,810

Net GEX here is a modeled estimate of dealer gamma using the traditional call-positive/put-negative open-interest convention; actual dealer inventory is not directly observable from public option-chain data. The structural read: spot is comfortably above the flip (long-gamma regime), the wall range is asymmetric - much closer to the call wall than the put wall - and Net GEX is healthy. What that tells you: the call wall is the nearer test, and a rally into it meets hedging that is modeled to lean against it. What it does not tell you is whether 5,850 holds. SPX walls held about two times in three within an hour in our measurement, whichever side of the flip price was on. A drop below 5,810 would change the mechanism, not those odds: hedging would start adding to moves instead of dampening them.

![ZeroGEX GEX walls chart highlighting the call wall and put wall on the strike-by-strike gamma profile](/blog/zerogex-walls-chart.png)

Now imagine the call wall migrates up to 5,855 as price probes 5,848. That migration is data - the strike you were watching is no longer the heaviest, so the level you are trading against has moved. It is not, by itself, a sign that the break will stick: in our measurement, whether a wall was migrating with price did not predict whether it broke.

---

## Common misconceptions

A few traps:

- **"Walls are hard support/resistance."** They are structural leans. Real flow breaks them regularly: about one test in three within an hour for S&P walls in our measurement, and about half for Nasdaq walls.
- **"The biggest open-interest strike is always the wall."** Walls are weighted by gamma exposure, not raw OI. A near-ATM strike can dominate a far-OTM strike with twice the open interest.
- **"Walls are static for the session."** They migrate. A wall that hasn't moved in two hours is one read; a wall that has drifted with price three times is a very different read.
- **"Walls work the same in any regime."** The hedging does not: in positive gamma it leans against a move into the wall, in negative gamma it adds to a move through it. How often walls broke did not change with the regime in our measurement; what changes is what hedging does around the break.
- **"The call wall is bullish, the put wall is bearish."** Neither is directional, and the option type alone does not set the behavior. They are gamma-concentration levels whose effect depends on the modeled dealer gamma sign and the surrounding flow - i.e., which side of the flip you are on.

---

## Takeaway

> Gamma walls are real positioning, not psychology. They sketch the structural range, and the gamma flip tells you whether hedging around those walls leans against moves or adds to them. Whether a given wall holds is a base rate, not a read: about two tests in three within an hour for S&P walls, about half for Nasdaq walls.

Read the regime first. Read the wall second. Read the wall migration third. That sequence tells you what dealer hedging is doing around the level - the difference between fading a rally that the dealer book is fading with you and fading a rally that the same dealer book is about to chase. It does not tell you whether this particular wall will hold; for that, the base rate for the index is the best guide we have measured.

Educational content only - none of the above is a trade recommendation.

---

If you want to see today's call wall and put wall, [the free ZeroGEX gamma-levels pages](/spx-gamma-levels) show both alongside the gamma flip and the dealer gamma profile that produced them, delayed about 15 minutes; the paid plans show them [in real time](/real-time-gex-0dte). For the broader landscape of gamma-exposure tools, see [the best GEX tools guide](/education/best-gex-tools).
