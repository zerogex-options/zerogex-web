# Gamma Walls Explained: Call Wall, Put Wall, and How Price Reacts

*Gamma walls are the most-watched levels in dealer-positioning analysis. What each wall does in each regime, what the gap between them tells you, how they behave into same-day expiry, and when the read holds versus breaks.*

---

## Start here

A gamma wall is a strike where modeled dealer gamma exposure is heavily concentrated. There are two: the **call wall** above spot and the **put wall** below it. Neither is support or resistance by construction — what a wall does depends on the modeled dealer gamma *sign* and the flow around it, not on whether the contracts sitting there are calls or puts.

If that definition is what you came for, [What Is a Gamma Wall?](/education/what-is-a-gamma-wall) covers it on its own and is the shorter read.

This page is the applied one. It assumes you know what a wall is and works through the parts that decide whether the level is useful on a given day: what each wall does in each regime, what the distance between them tells you, how they behave into same-day expiry, how they migrate, and the conditions under which the read holds or fails. For the regime context underneath all of it, pair this with [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) and the broader [Gamma Exposure pillar](/education/gamma-exposure-explained).

---

## What is a call wall?

The call wall is the strike above spot that carries the heaviest call gamma exposure. Under the traditional convention, dealers are *modeled* as long those calls, so in a positive-gamma regime they tend to sell into rallies that approach the wall — shedding the positive delta they accumulate as price climbs toward it. That hedging reflex can push against the rally.

In practice, the call wall often acts as **resistance** in positive-gamma conditions — not because the level is magic, and not simply because it is a call strike, but because the modeled hedging flow around it tends to lean against the move. Change the gamma sign and the same strike can behave very differently.

Things to know:

- The wall is the *current* heaviest concentration. As OI shifts, the wall moves.
- The wall acts more reliably in long-gamma regimes (spot above the gamma flip). In short-gamma regimes the same level can invert from resistance to a breakout target.
- A call wall is a **probabilistic** lean, not a hard ceiling. Real flow can punch through.

---

## What is a put wall?

The put wall is the strike below spot with the heaviest put gamma exposure. When the net book is modeled as long gamma (a positive Net GEX regime), the aggregate dealer hedge tends to buy weakness and sell strength — so as price drops toward a dense put strike, that buy-the-dip reflex can lean against the selloff. That behavior comes from the *net* gamma sign, though, not from the strike being made of puts.

In practice, the put wall often acts as **support** when net gamma is positive. Like the call wall, whether it supports, pins, or accelerates depends on the modeled dealer gamma sign and the surrounding flow — not on the option type.

Things to know:

- The wall is dynamic. Heavy OI rolling off into expiry can erase a put wall by midday.
- In a short-gamma regime, dealer behavior inverts — the put wall stops absorbing weakness and can become a slippage point on the way down.
- A put wall is a lean. Macro shocks, vol expansion, and chain refits can all override the structural read.

---

## Why price reacts at gamma walls

The mechanism is dealer hedging, not psychology. The clearest way to see it:

In a **positive-gamma** regime, dealers tend to hedge *against* price movement. They sell as price rises and buy as it falls. Near a wall, that reflex can intensify because the gamma concentration is locally large — a small move toward the wall can call for a relatively larger hedging trade away from it. This assumes the modeled dealer gamma sign holds around that strike, which is why the same wall can behave differently when the surrounding flow or net sign shifts.

In a **negative-gamma** regime, the reflex inverts. Dealers tend to hedge *with* price movement. The same wall that pinned price in long-gamma can become a breakout vector — once price clears it, the hedging trade reinforces the move instead of fading it.

This is why walls feel like they "work" some days and not others. A gamma wall is not a fixed property of the chain. It is a fixed *level* whose behavioral effect depends on the **regime around it** — which is exactly the read the gamma flip provides.

---

## What the distance between the walls tells you

The two walls carry more information together than either does alone. The gap between them is the range current positioning is most consistent with, and its shape is readable in two ways.

**Width.** A narrow wall range means gamma is concentrated close to spot on both sides. In a positive-gamma regime that is the classic pinning setup — hedging leans against moves in both directions and the range tends to hold. A wide range means the nearest dense strikes are far away, so there is less concentrated hedging in between and price can travel further before meeting any.

**Asymmetry.** Spot rarely sits in the middle. When one wall is much closer than the other, the near wall is the level that actually gets tested and the far one is mostly context. Spot sitting 0.3% under the call wall and 1.4% above the put wall is a different day from spot sitting midway between them: the first has a near-term decision point, the second does not.

The trap is reading width or asymmetry without the regime. Both readings above assume positive gamma. Below the flip, the same narrow range is not a pin — it is a short distance between two levels that hedging will help price move through.

---

## How gamma walls shift intraday

Walls do not get announced at the open and hold through the close. They migrate. Three common patterns:

1. **Gamma repricing.** Spot, time to expiry, and implied volatility change each strike’s modeled gamma and can change the ranking even while official OI is fixed.
2. **Spot-side eligibility.** A strike can move from one side of spot to the other, while another fixed-OI strike becomes the largest eligible concentration. Official OI generally updates after clearing; intraday wall migration does not establish that customers opened positions at the new strike.
3. **Near-expiry concentration.** ATM gamma can rise sharply while decisively ITM or OTM strikes tend toward zero, changing the ranking. That repricing is distinct from positions closing and from official OI updating after clearing.

A wall can also shift purely because spot, time, and implied vol move — the strike carrying the most modeled exposure changes even when positioning does not. A gamma wall is the *current* heaviest modeled-gamma strike. Treat it as a live read, not a fixed line.

---

## Gamma walls into same-day expiry

0DTE is where wall behavior is most extreme, in both directions.

Gamma on a same-day chain is very large near spot and falls away quickly from it, so the walls sit tight to price and the concentration at them is far heavier than on a longer-dated chain. When the regime supports it, that produces the strongest pinning you are likely to see — price grinding in a narrow band between two walls only a few points apart.

The same concentration makes those walls unstable. Because 0DTE gamma reprices sharply as spot moves and as the clock runs, a 0DTE wall can migrate several times in an hour without a single new position being opened. Walls can also vanish: as strikes go decisively in or out of the money their modeled gamma tends toward zero, and the ranking reshuffles around whatever is left near spot.

Two practical consequences. A 0DTE wall read has a much shorter shelf life than the same read on a monthly chain — minutes rather than hours. And once price clears a 0DTE wall in a negative-gamma regime, there is often little dense gamma left between it and the next level, which is part of why late-session breaks on expiry days can travel so far so quickly.

---

## When walls hold and when they break

Walls are not predictions. They are leans that work more often when the structural conditions support them. A short list of when each side of the read is more likely to hold up:

**Conditions that make a wall more likely to hold:**

- Spot is in a positive-gamma regime (above the flip).
- The wall sits at a strike with very high relative gamma magnitude.
- Net GEX is meaningfully positive and stable.
- The wall is *not* migrating with price.
- Realized vol is compressing into the level.

**Conditions that make a wall more likely to break:**

- Spot is in a negative-gamma regime (below the flip).
- Net GEX is small in magnitude or rapidly contracting.
- The wall is migrating with price (chasing the move).
- A macro catalyst (CPI, FOMC, NFP, geopolitical headline) hits while the wall is being tested.
- Directional flow is *accelerating* into the level rather than decelerating.

Most of these can be read in real time. None of them are predictions. They are checks — when most line up on one side, the read is sharper; when they conflict, the read is weak and the right move is usually no trade.

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

Net GEX here is a modeled estimate of dealer gamma using the traditional call-positive/put-negative open-interest convention; actual dealer inventory is not directly observable from public option-chain data. The structural read: spot is comfortably above the flip (long-gamma regime), the wall range is asymmetric — much closer to the call wall than the put wall — and Net GEX is healthy. Practical lean: drift toward the call wall is the higher-probability path, fades of rallies into it are the cleaner setup, and downside conviction would need either a flip-cross below 5,810 or a clear catalyst to override the structural pull from positive gamma above.

![ZeroGEX GEX walls chart highlighting the call wall and put wall on the strike-by-strike gamma profile](/blog/zerogex-walls-chart.png)

Now imagine the call wall migrates up to 5,855 as price probes 5,848. That migration is data — the wall is chasing price, the trap-fade is much weaker, and the breakout above 5,850 is more credible than it looked five minutes earlier. Reading the wall in motion is most of the edge.

---

## Common misconceptions

A few traps:

- **"Walls are hard support/resistance."** They are structural leans. Real flow breaks them regularly.
- **"The biggest open-interest strike is always the wall."** Walls are weighted by gamma exposure, not raw OI. A near-ATM strike can dominate a far-OTM strike with twice the open interest.
- **"Walls are static for the session."** They migrate. A wall that hasn't moved in two hours is one read; a wall that has drifted with price three times is a very different read.
- **"Walls work the same in any regime."** They do not. Positive-gamma walls absorb. Negative-gamma walls release.
- **"The call wall is bullish, the put wall is bearish."** Neither is directional, and the option type alone does not set the behavior. They are gamma-concentration levels whose effect depends on the modeled dealer gamma sign and the surrounding flow — i.e., which side of the flip you are on.

---

## Takeaway

> Gamma walls are real positioning, not psychology. They sketch the structural range — but only the gamma flip and the regime around it tell you whether those walls will absorb moves or release them.

Read the regime first. Read the wall second. Read the wall migration third. That sequence is most of the structural edge in dealer-positioning reads — and it is also the difference between fading a rally that the dealer book is fading with you and fading a rally that the same dealer book is about to chase.

Educational content only — none of the above is a trade recommendation.

---

If you want to see today's [call wall and put wall in real time](/real-time-gex-0dte), [the free ZeroGEX dashboard](/spx-gamma-levels) plots both alongside the gamma flip and the dealer gamma profile that produced them. For the broader landscape of gamma-exposure tools, see [the best GEX tools guide](/education/best-gex-tools).
