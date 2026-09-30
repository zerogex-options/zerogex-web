# How to Identify Support and Resistance from Options Positioning

*Standard support and resistance is mostly psychology - drawn lines, prior swings, round numbers. Options-based support and resistance is mechanics - real positioning that drives real hedging flows. Here's how to identify it and how to read it in real time.*

---

## Two kinds of support and resistance

The retail trader's S/R toolkit is mostly chart-derived: prior swing highs and lows, trendlines, round numbers, moving averages. These work - sometimes - because enough traders watch them that they become self-fulfilling. The mechanism is psychological convergence.

Options-based support and resistance is different. It's not derived from price history; it's derived from current options positioning. The mechanism is structural: modeled dealer hedging flows that tend to fire as price approaches concentrated strikes. Much of this hedging is systematic rather than discretionary - so when the modeled dealer gamma sign lines up, those flows can act as supply near resistance and bid near support.

When chart-S/R and options-S/R agree, the level tends to be more reliable. When they disagree, the options-based read often carries more weight - because the chart level is opinion and the options level is grounded in positioning-driven hedging flow.

This piece is the practical workflow for identifying options-based S/R, reading it in real time, and knowing what to expect when price tests it. For the broader gamma framework, see the [Gamma Exposure pillar](/education/gamma-exposure-explained).

---

## The four kinds of options-based S/R

The labels below - call wall as resistance, put wall as support - describe how the modeled hedging leans in a *positive-gamma* regime. They are not fixed properties of the strike: option type alone does not set the direction, and the hedging can run with a move instead when the modeled dealer gamma sign or the surrounding flow changes.

### 1. Call walls (resistance)

The **call wall** is the strike above spot with the heaviest call gamma exposure. Under the traditional convention dealers are modeled long that inventory, so in a long-gamma regime they tend to sell into rallies that approach the wall. That selling can act as structural resistance.

Practical read: in a positive-gamma regime, hedging around the call wall leans against a rally; in a negative-gamma regime it runs with one, so if the wall gives way it can become a breakout accelerant. The regime changes that behavior, not how often the wall breaks: S&P walls held about two times in three within an hour in our measurement, on either side of the flip.

### 2. Put walls (support)

The **put wall** is the strike below spot with the heaviest put gamma exposure. When net gamma is modeled positive, the aggregate dealer book tends to buy into selloffs that approach the wall. That net buying can act as structural support - note the support comes from the positive net-gamma sign, not from the strike being made of puts (under the convention, dealers are modeled short those puts).

Same regime dependency as the call wall - in negative gamma, a put wall that gives way can become a slippage point on the way down.

The mechanics of walls in both regimes is in [Gamma Walls Explained](/education/gamma-walls-explained).

### 3. The gamma magnet (pin attraction)

The **gamma magnet** is the strike with the largest absolute gamma concentration. It's not directional - in a long-gamma regime it tends to pull price toward itself, and in short-gamma it tends to release price from itself. When the pull is active, it can act as both support and resistance at once: price above it can get drawn down toward it; price below it can get drawn up.

The magnet tends to matter most near expiry, when same-day-expiring options dominate the gamma profile. End-of-day pin behavior can come from this strike, though pinning is probabilistic - liquidity, trader behavior, and expiration mechanics contribute too, and a large concentration is not by itself proof dealers are long gamma there.

### 4. The gamma flip (regime line)

The **gamma flip** isn't S/R in the traditional sense - it's the regime boundary, a zero-crossing of the *modeled* dealer gamma profile. But it can function like a soft support/resistance line because price often pauses or briefly reverses around it (the modeled dealer reflex changes sign near that price). Above the flip, the modeled reflex is to fade; below, to chase - though the crossing is a modeling estimate, and realized behavior still depends on flow, liquidity, and vol.

See [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) for the workflow.

---

## Why does SPY reverse at these levels?

The reversals that look random on a SPY chart - price runs to some level that wasn't a prior swing or a round number, stops dead, and unwinds - are usually one of these four levels doing its job. At the **call wall**, dealers modeled long the strike sell into the rally to stay hedged, adding supply that caps the move. At the **put wall**, a net-long-gamma book buys the selloff, adding support. At the **gamma magnet**, the modeled hedging reflex pulls price back toward the strike. At the **gamma flip**, that reflex changes sign and price often pauses as it crosses. None of these is on the price chart - they're on the option chain - which is why the reversal looks like it came from nowhere until you map it to positioning. Whether a wall absorbs the move or gets run over did not depend on the regime in our measurement - S&P walls held about two times in three within an hour on either side of the flip. What the regime changes is the hedging around the level, so read the flip first: in long gamma, hedging leans against a rally into the call wall; in short gamma, it adds to the move once that wall gives way.

---

## Why options-based S/R is sturdier than chart-based S/R

Three reasons:

1. **It's systematic, not chosen.** A trader can decide whether or not to defend a trendline. Dealer gamma hedging is largely systematic - desks manage aggregate exposure rather than acting on a view - so the flow tends to happen whether the dealer believes in it or not. (Desks hedge portfolios and may use hedge bands, so it is a tendency, not a continuously guaranteed order.)

2. **It scales with positioning, not attention.** A trendline strengthens with more eyes on it; a wall reflects more open interest. The larger the modeled concentration, the larger the potential hedging flow when price approaches. The relationship is grounded in positioning, not sentiment.

3. **It is recalculated.** Spot, time, and implied volatility reprice gamma at each strike, so a different fixed-OI strike can become the wall intraday. Official OI generally updates after clearing; a migrating wall is not evidence that fresh positions opened there.

That said, options-based S/R isn't infallible. It's a probabilistic lean. Macro shocks and catalyst events override it regularly, and a regime flip changes what the hedging does. The advantage is that the lean is *grounded* - when it works, it works for a reason you can verify.

---

## How to identify the levels in real time

A short workflow:

1. **Pull the gamma flip first.** It tells you which regime you're in. The flip itself is also a soft level worth watching.
2. **Identify the call wall and put wall.** These give you the structural range - the boundaries dealer hedging leans against (in a long-gamma regime) or adds to a move through (in a short-gamma regime).
3. **Identify the gamma magnet.** Often the heaviest 0DTE strike. The magnet tells you where price gets pulled inside the wall range.
4. **Check the migration.** A wall that just jumped is a different reference from one that has been stable for hours: a migrating wall is chasing price, so the level you are watching has moved. In our measurement, neither a wall's age nor its migration predicted whether it broke.
5. **Cross-check with chart S/R.** Where the structural level aligns with a chart-based level (round number, prior swing, key moving average), the convergence can make the level sharper.

---

## When the structural level holds

In our measurement of 737 wall tests, S&P walls held about two times in three within an hour of being tested and Nasdaq walls about half ([How Often Do Gamma Walls Actually Break?](/education/how-often-do-gamma-walls-break)). The conditions traders usually check did not improve on that base rate:

- Whether spot was in a **positive-gamma regime** (above the flip) or a negative one.
- Whether Net GEX was **substantial and stable** or decaying.
- Whether the wall was **migrating** with price.
- Whether flow at the wall strike was **accelerating** or decelerating.
- How long the wall had stood, and how many times it had been tested.

So the honest prior for any wall is the base rate for its index, not a checklist.

## When the structural level breaks

What the regime changes is what hedging does when a level gives way:

- In a **positive-gamma regime**, hedging leans against the move, so a break has less hedging behind it.
- In a **negative-gamma regime**, dealers chase rather than fade, so their hedging adds to the break.
- As spot, time, or volatility change the strike ranking, the wall can **migrate**, and the level you were watching stops being the heaviest strike.
- A **catalyst** landing during the test can overwhelm the hedging in either regime.

None of this makes a level more likely to fail than to hold. Reading the regime first tells you which mechanism you are trading with, not the odds.

---

## Worked example

SPY is at 581.50. Standard charting shows resistance around 583 (prior swing high) and support around 580 (50-day MA, round number). ZeroGEX shows:

- **Call Wall:** 583.50 (close to but not exactly at the chart resistance)
- **Put Wall:** 580.00 (right at the chart support)
- **Gamma Flip:** 580.80 (between current spot and the put wall)
- **Gamma magnet:** 581.00 (basically at spot)
- **Net GEX:** +$1.1B, stable (a modeled estimate of dealer gamma from the traditional call-positive/put-negative open-interest convention, not observed dealer inventory)

The composite structural read:

- The call wall and chart resistance agree near 583 - the higher-confidence resistance zone is right where chart traders see it, but the modeled positioning puts the wall at 583.50, not the round 583.
- The put wall and chart support also agree near 580 - a stronger support read there.
- The gamma magnet at 581.00 means price can have a structural pull toward roughly where it is right now. While positive gamma holds, hedging leans against moves in both directions.
- The flip at 580.80 means a drop below 580.80 would flip the modeled regime; if that happens first and the put wall at 580 then gives way, hedging adds to the move instead of cushioning it.

The read: modeled hedging leans against moves toward either edge of the 581-583.50 range, but each wall is still a base-rate bet - SPY walls held about two times in three within an hour in our measurement, whichever side of the flip price was on. The structural read adds where the levels are and what hedging does around them; it does not tell you which one will give way.

---

## Common misreads

- **"It's at the prior swing high, so it's resistance."** Sometimes. Sometimes the actual structural level is 30 cents higher or lower - and the move that "broke" the chart resistance was always going to extend to the real wall.
- **"The put wall is at 580, so 580 will hold."** Not reliably, in either regime: S&P walls broke about one test in three within an hour in our measurement, long gamma or short. What the regime changes is what comes next - in short gamma, a put wall that gives way can become a slippage point.
- **"Options-based S/R doesn't work."** It locates real positioning, and S&P walls held about two times in three within an hour in our measurement. What it does not give you is a way to tell in advance which wall will break: regime, Net GEX, migration and flow at the strike did not.

---

## Takeaway

> Options-based support and resistance is mechanics, not psychology. It identifies the levels where dealer hedging is most likely to fire - and the modeled regime tells you whether that flow tends to absorb the move or amplify it.

The discipline is to read the structural map first, cross-check against chart-based levels for convergence, and verify the regime before deciding what to do with the level. Most of the apparent "noise" in retail chart S/R is the gap between where charts say the level is and where positioning actually puts it.

Educational content only - none of the above is a trade recommendation.

---

If you want to see today's call wall, put wall, gamma flip, and gamma magnet for SPY, SPX, QQQ, and NDX - the four structural levels that drive most options-based S/R - the free ZeroGEX gamma-levels view surfaces them.
