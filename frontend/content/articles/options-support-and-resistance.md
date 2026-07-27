# How to Identify Support and Resistance from Options Positioning

*Standard support and resistance is mostly psychology — drawn lines, prior swings, round numbers. Options-based support and resistance is mechanics — real positioning that drives real hedging flows. Here's how to identify it and how to read it in real time.*

---

## Two kinds of support and resistance

The retail trader's S/R toolkit is mostly chart-derived: prior swing highs and lows, trendlines, round numbers, moving averages. These work — sometimes — because enough traders watch them that they become self-fulfilling. The mechanism is psychological convergence.

Options-based support and resistance is different. It's not derived from price history; it's derived from current options positioning. The mechanism is structural: modeled dealer hedging flows that tend to fire as price approaches concentrated strikes. Much of this hedging is systematic rather than discretionary — so when the modeled dealer gamma sign lines up, those flows can act as supply near resistance and bid near support.

When chart-S/R and options-S/R agree, the level tends to be more reliable. When they disagree, the options-based read often carries more weight — because the chart level is opinion and the options level is grounded in positioning-driven hedging flow.

This piece is the practical workflow for identifying options-based S/R, reading it in real time, and knowing when it holds versus breaks. For the broader gamma framework, see the [Gamma Exposure pillar](/education/gamma-exposure-explained).

---

## The four kinds of options-based S/R

The labels below — call wall as resistance, put wall as support — describe the *typical positive-gamma* behavior. They are not fixed properties of the strike: option type alone does not set the direction, and each can invert when the modeled dealer gamma sign or the surrounding flow changes.

### 1. Call walls (resistance)

The **call wall** is the strike above spot with the heaviest call gamma exposure. Under the traditional convention dealers are modeled long that inventory, so in a long-gamma regime they tend to sell into rallies that approach the wall. That selling can act as structural resistance.

Practical read: the call wall is one of the more reliable forms of options-based resistance in a positive-gamma regime. In a negative-gamma regime, it can invert and become a breakout target.

### 2. Put walls (support)

The **put wall** is the strike below spot with the heaviest put gamma exposure. When net gamma is modeled positive, the aggregate dealer book tends to buy into selloffs that approach the wall. That net buying can act as structural support — note the support comes from the positive net-gamma sign, not from the strike being made of puts (under the convention, dealers are modeled short those puts).

Same regime dependency as the call wall — in negative gamma, the put wall can become a slippage point on the way down.

The mechanics of walls in both regimes is in [Gamma Walls Explained](/education/gamma-walls-explained).

### 3. The gamma magnet (pin attraction)

The **gamma magnet** is the strike with the largest absolute gamma concentration. It's not directional — in a long-gamma regime it tends to pull price toward itself, and in short-gamma it tends to release price from itself. When the pull is active, it can act as both support and resistance at once: price above it can get drawn down toward it; price below it can get drawn up.

The magnet tends to matter most near expiry, when same-day-expiring options dominate the gamma profile. End-of-day pin behavior can come from this strike, though pinning is probabilistic — liquidity, trader behavior, and expiration mechanics contribute too, and a large concentration is not by itself proof dealers are long gamma there.

### 4. The gamma flip (regime line)

The **gamma flip** isn't S/R in the traditional sense — it's the regime boundary, a zero-crossing of the *modeled* dealer gamma profile. But it can function like a soft support/resistance line because price often pauses or briefly reverses around it (the modeled dealer reflex changes sign near that price). Above the flip, the modeled reflex is to fade; below, to chase — though the crossing is a modeling estimate, and realized behavior still depends on flow, liquidity, and vol.

See [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) for the workflow.

---

## Why options-based S/R is sturdier than chart-based S/R

Three reasons:

1. **It's systematic, not chosen.** A trader can decide whether or not to defend a trendline. Dealer gamma hedging is largely systematic — desks manage aggregate exposure rather than acting on a view — so the flow tends to happen whether the dealer believes in it or not. (Desks hedge portfolios and may use hedge bands, so it is a tendency, not a continuously guaranteed order.)

2. **It scales with positioning, not attention.** A trendline strengthens with more eyes on it; a wall reflects more open interest. The larger the modeled concentration, the larger the potential hedging flow when price approaches. The relationship is grounded in positioning, not sentiment.

3. **It is recalculated.** Spot, time, and implied volatility reprice gamma at each strike, so a different fixed-OI strike can become the wall intraday. Official OI generally updates after clearing; a migrating wall is not evidence that fresh positions opened there.

That said, options-based S/R isn't infallible. It's a probabilistic lean. Macro shocks, catalyst events, and regime flips override it regularly. The advantage is that the lean is *grounded* — when it works, it works for a reason you can verify.

---

## How to identify the levels in real time

A short workflow:

1. **Pull the gamma flip first.** It tells you which regime you're in. The flip itself is also a soft level worth watching.
2. **Identify the call wall and put wall.** These give you the structural range — the boundaries dealer hedging is set up to defend (in a long-gamma regime) or release (in a short-gamma regime).
3. **Identify the gamma magnet.** Often the heaviest 0DTE strike. The magnet tells you where price gets pulled inside the wall range.
4. **Check the migration.** A wall that's been stable for hours is a stronger level than one that just jumped. A migrating wall is chasing price.
5. **Cross-check with chart S/R.** Where the structural level aligns with a chart-based level (round number, prior swing, key moving average), the convergence can make the level sharper.

---

## When the structural level holds

The dealer-hedging mechanism works most reliably when:

- Spot is in a **positive-gamma regime** (above the flip).
- Net GEX is **substantial and stable** — dealer book has real magnitude.
- The wall is **not migrating** with price.
- Flow into the level is **decelerating** (chasers running out of fuel).
- No catalyst is active.

In those conditions, the structural read carries real probability behind it.

## When the structural level breaks

The mechanism inverts or breaks down when:

- Spot is in a **negative-gamma regime** — dealers chase, not fade.
- Net GEX is **decaying** — positioning is unwinding.
- The wall is **migrating** as spot, time, or volatility changes the strike ranking.
- A catalyst lands during the test.
- Flow is **accelerating** in the breakout direction.

When these conditions stack, the level is more likely to fail than to hold. Reading the regime first is what tells you which playbook to run.

---

## Worked example

SPY is at 581.50. Standard charting shows resistance around 583 (prior swing high) and support around 580 (50-day MA, round number). ZeroGEX shows:

- **Call Wall:** 583.50 (close to but not exactly at the chart resistance)
- **Put Wall:** 580.00 (right at the chart support)
- **Gamma Flip:** 580.80 (between current spot and the put wall)
- **Gamma magnet:** 581.00 (basically at spot)
- **Net GEX:** +$1.1B, stable (a modeled estimate of dealer gamma from the traditional call-positive/put-negative open-interest convention, not observed dealer inventory)

The composite structural read:

- The call wall and chart resistance agree near 583 — the higher-confidence resistance zone is right where chart traders see it, but the modeled positioning puts the wall at 583.50, not the round 583.
- The put wall and chart support also agree near 580 — a stronger support read there.
- The gamma magnet at 581.00 means price can have a structural pull toward roughly where it is right now. Compression is more likely than not while positive gamma holds.
- The flip at 580.80 means a drop below 580.80 would flip the modeled regime; the put wall at 580 might not absorb cleanly if the flip cross happens first.

The practical lean: tight 581–583.50 range is probable; fade extremes, skip the middle. The structural read sharpens the chart read materially.

---

## Common misreads

- **"It's at the prior swing high, so it's resistance."** Sometimes. Sometimes the actual structural level is 30 cents higher or lower — and the move that "broke" the chart resistance was always going to extend to the real wall.
- **"The put wall is at 580, so 580 will hold."** Only in a long-gamma regime. In short gamma, the same wall can become a slippage point.
- **"Options-based S/R doesn't work."** It does — when the regime supports it. Most failed reads come from running the long-gamma playbook in a short-gamma regime.

---

## Takeaway

> Options-based support and resistance is mechanics, not psychology. It identifies the levels where dealer hedging is most likely to fire — and the modeled regime tells you whether that flow tends to absorb the move or amplify it.

The discipline is to read the structural map first, cross-check against chart-based levels for convergence, and verify the regime before deciding what to do with the level. Most of the apparent "noise" in retail chart S/R is the gap between where charts say the level is and where positioning actually puts it.

Educational content only — none of the above is a trade recommendation.

---

If you want to see today's call wall, put wall, gamma flip, and gamma magnet for SPY, SPX, and QQQ — the four structural levels that drive most options-based S/R — the free ZeroGEX gamma-levels view surfaces them.
