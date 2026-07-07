# What Is a Put Wall? How Options Traders Use Put Walls as Dealer Support

*The put wall is the strike where put-side dealer gamma piles up — usually the sturdiest dealer-hedged support on the board. This is what a put wall actually is, why price reacts there, how it moves intraday, and when it holds versus breaks.*

---

## What is a put wall?

A **put wall** is the strike below spot that carries the heaviest concentration of put-side dealer gamma exposure on the option chain. It is the price level where dealer hedging flows are most likely to *defend the downside* — which is why traders treat the put wall as the structural floor of the current dealer-positioning range.

Put wall meaning, in one sentence: it is not a psychological level or a moving average — it is real positioning. Open interest, contract by contract, weighted by the gamma each contract carries. The single strike where that put gamma is densest below the current price is the put wall.

The put wall has a mirror image above spot: the [call wall](/education/what-is-a-call-wall), the heaviest call-gamma strike, which tends to cap the upside. Together the two walls sketch the range dealer hedging mechanics tend to defend. This piece is about the put wall specifically — what it is, why it acts as support, how it moves, and when the read breaks. For the full structural picture, pair it with [Gamma Walls Explained](/education/gamma-walls-explained) and the [Gamma Exposure pillar](/education/gamma-exposure-explained).

---

## Why the put wall acts as support

The mechanism is dealer hedging, not sentiment. In a **positive-gamma** regime — spot above the [gamma flip](/education/how-to-read-a-gamma-flip) — dealers are net long gamma, and the desks that wrote the heavy puts at the put-wall strike are short those puts. To stay delta-neutral, they have to **buy** the underlying as price falls toward the strike, because a short-put position gets longer delta as the market drops.

That buying is the support. As price slides toward a dense put strike, the hedging reflex intensifies: a small move down forces a relatively larger hedging buy back up. The result is a level where selling gets absorbed and dips tend to get bought — not because anyone believes in the number, but because the hedge is mechanical.

A few things that follow directly from the mechanism:

- The put wall is **probabilistic support**, not a hard floor. It is where absorbing flow concentrates, not a guaranteed bounce.
- It is strongest in a positive-gamma regime and with high relative gamma at the strike.
- It is a *lean* that a genuine catalyst — CPI, FOMC, a vol spike — can override in seconds.

---

## Put wall vs. call wall

The two walls are symmetric but opposite:

|Wall|Where|Dealer hedge in positive gamma|Typical behavior|
|---|---|---|---|
|Put wall|Heaviest put gamma below spot|Buys as price falls toward it|Support / downside floor|
|Call wall|Heaviest call gamma above spot|Sells as price rises toward it|Resistance / upside cap|

Neither wall is directional on its own. The put wall is not "bullish" and the call wall is not "bearish" — they are concentration levels whose *effect* depends on which side of the gamma flip you are on. Above the flip, both walls absorb moves. Below it, both can invert and release them.

---

## How the put wall moves intraday

The put wall is a live read, not a line you set at the open and trust through the close. It migrates for three common reasons:

1. **OI rebalancing.** Fresh volume into a different strike can shift the heaviest put-gamma concentration. The put wall at 10:00 ET may sit one strike lower by noon.
2. **Migration with price.** If price grinds down toward the put wall and traders keep buying protection just below, the wall can drift lower with the move. A put wall that *tracks* price is a weaker support read than one that *holds* — the wall is chasing, not defending.
3. **Expiry decay.** In 0DTE-heavy chains, the contracts that built the wall roll off through the afternoon. A put wall you leaned on at 11:00 ET can thin out by 14:30 ET.

Reading the wall in motion is most of the edge. A put wall that hasn't moved in two hours is a very different signal from one that has slid lower with price three times.

---

## When the put wall holds vs. breaks

The put wall is a lean that works more often when the structure supports it. A short checklist:

**More likely to hold:**

- Spot is in a positive-gamma regime (above the flip).
- The strike carries large relative gamma and Net GEX is meaningfully positive.
- The wall is *not* migrating lower with price.
- Selling into the level is decelerating.

**More likely to break:**

- Spot is in a **negative-gamma** regime (below the flip). Here the dealer reflex inverts — instead of buying the dip, hedging can *add* to the selloff, and the put wall becomes a slippage point rather than a floor.
- Net GEX is small or contracting fast.
- The wall is chasing price lower.
- A macro catalyst hits while the level is being tested.
- Directional selling is *accelerating* into the strike.

The most important of these is the regime. A put wall in positive gamma is a floor dealers defend. The same strike in negative gamma is a trapdoor — once price slices through, hedging flows reinforce the move down instead of fading it.

---

## A worked example

Suppose SPX is trading at 5,830 and the dealer book reads:

- **Put Wall:** 5,790 (−0.69% from spot)
- **Call Wall:** 5,850 (+0.34% from spot)
- **Gamma Flip:** 5,810
- **Net GEX:** +$1.5B

Spot is comfortably above the flip, so this is a long-gamma session and the put wall at 5,790 is the sturdier edge of the range. The practical lean: dips toward 5,790 are the higher-probability *buy* zone, and a clean break of 5,790 would be a real tell — it likely means either a flip-cross below 5,810 into negative gamma or a catalyst strong enough to overwhelm the hedge. Below the flip, that same 5,790 stops being support and can accelerate the next leg down.

Change one variable — say the put wall migrates from 5,790 to 5,782 as price probes 5,795 — and the read changes with it. The wall is now chasing price lower, the support lean weakens, and a break becomes more credible than it looked ten minutes earlier.

---

## How to find today's put wall

You do not have to compute dealer gamma by hand. ZeroGEX publishes the current put wall — alongside the call wall, gamma flip, max pain, and Net GEX — for the three most-traded index products, free and delayed about 15 minutes: see today's put wall on [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), and [QQQ](/qqq-gamma-levels). For the live, sub-second version with the full gamma profile and strike-by-DTE heatmap, the [real-time 0DTE GEX dashboard](/real-time-gex-0dte) plots the put wall as it migrates through the session.

---

## Takeaway

> The put wall is real positioning, not psychology — the strike where dealer hedging is most likely to defend the downside. But it is only a floor while spot is in positive gamma. Read the regime first, the wall second, and the wall's migration third.

Educational content only — none of the above is a trade recommendation.

---

Want to see this in real time? View today's **SPX / SPY / QQQ put walls** on ZeroGEX — the free [SPX](/spx-gamma-levels), [SPY](/spy-gamma-levels), and [QQQ](/qqq-gamma-levels) gamma-levels pages plot the put wall next to the [call wall](/education/what-is-a-call-wall), the gamma flip, and Net GEX. For the levels that matter most as support and resistance, see [options-based support and resistance](/education/options-support-and-resistance), and for the live read, open the [real-time 0DTE GEX dashboard](/real-time-gex-0dte).
