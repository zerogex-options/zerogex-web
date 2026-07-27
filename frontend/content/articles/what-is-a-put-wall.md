# What Is a Put Wall? How Options Traders Use Put Walls as Dealer Support

*The put wall is the strike where put-side dealer gamma piles up — usually the sturdiest dealer-hedged support on the board. This is what a put wall actually is, why price reacts there, how it moves intraday, and when it holds versus breaks.*

---

## What is a put wall?

A **put wall** is the strike below spot that carries the heaviest concentration of put-side gamma exposure on the option chain. When the net dealer book is modeled as long gamma, it is the level where hedging flows are most likely to *defend the downside* — which is why traders treat the put wall as the structural floor of the current dealer-positioning range. That floor behavior is a tendency, not a rule: it depends on the modeled or actual dealer gamma sign and the surrounding flow, not on the strike simply being made of puts.

Put wall meaning, in one sentence: it is not a psychological level or a moving average — it is real positioning. Open interest, contract by contract, weighted by the gamma each contract carries. The single strike where that put gamma is densest below the current price is the put wall.

The put wall has a mirror image above spot: the [call wall](/education/what-is-a-call-wall), the heaviest call-gamma strike, which tends to cap the upside. Together the two walls sketch the range dealer hedging mechanics tend to defend. This piece is about the put wall specifically — what it is, why it acts as support, how it moves, and when the read breaks. For the full structural picture, pair it with [Gamma Walls Explained](/education/gamma-walls-explained) and the [Gamma Exposure pillar](/education/gamma-exposure-explained).

---

## Why the put wall acts as support

The mechanism is dealer hedging, not sentiment. In a **positive-gamma** regime — spot above the [gamma flip](/education/how-to-read-a-gamma-flip) — the aggregate dealer book is modeled as net long gamma, so across the book it tends to hedge against price: buying the underlying as it falls and selling as it rises. As price falls toward a dense put strike, that buy-the-dip reflex can lean against the selloff. Note where the support comes from: under the traditional convention dealers are modeled *short* the puts themselves, so it is the positive **net** gamma sign — not the put concentration on its own — that makes the level tend to behave as a floor.

That net buying is what can create support. As price slides toward the strike, the hedging reflex can intensify: a small move down can call for a relatively larger hedging buy back up. The result can be a level where selling gets absorbed and dips tend to get bought — not because anyone believes in the number, but because the modeled hedge leans against the move.

A few things that follow directly from the mechanism:

- The put wall is **probabilistic support**, not a hard floor. It is where absorbing flow concentrates, not a guaranteed bounce.
- It is strongest in a positive-gamma regime and with high relative gamma at the strike.
- It is a *lean* that a genuine catalyst — CPI, FOMC, a vol spike — can override in seconds.

---

## Put wall vs. call wall

The two walls are symmetric but opposite:

|Wall|Where|Modeled net hedge in positive gamma|Behavior in that regime|
|---|---|---|---|
|Put wall|Heaviest put gamma below spot|Net book tends to buy as price falls|Can act as support / floor|
|Call wall|Heaviest call gamma above spot|Tends to sell as price rises|Can act as resistance / cap|

Neither wall is directional on its own, and the option type alone does not set the behavior. The put wall is not "bullish" and the call wall is not "bearish" — they are concentration levels whose *effect* depends on the modeled dealer gamma sign and the surrounding flow, i.e. which side of the gamma flip you are on. Above the flip, both walls tend to absorb moves. Below it, both can invert and release them.

---

## How the put wall moves intraday

The put wall is a live read, not a line you set at the open and trust through the close. It migrates for three common reasons:

1. **OI rebalancing.** Fresh volume into a different strike can shift the heaviest put-gamma concentration. The put wall at 10:00 ET may sit one strike lower by noon.
2. **Migration with price.** If price grinds down toward the put wall and intraday volume points to fresh protection buying just below, the modeled wall can drift lower with the move. (This is inferred from intraday volume — official open interest updates for the next session.) A put wall that *tracks* price is a weaker support read than one that *holds* — the wall is chasing, not defending.
3. **Expiry decay.** In 0DTE-heavy chains, the contracts that built the wall roll off through the afternoon. A put wall you leaned on at 11:00 ET can thin out by 14:30 ET.

The modeled wall can also shift because spot, time, and implied vol move, even if positioning does not. Reading the wall in motion is most of the edge. A put wall that hasn't moved in two hours is a very different signal from one that has slid lower with price three times.

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

The most important of these is the regime. A put wall in positive gamma can be a floor the net dealer book leans against. The same strike in negative gamma is closer to a trapdoor — once price slices through, hedging flows can reinforce the move down instead of fading it.

---

## A worked example

Suppose SPX is trading at 5,830 and the dealer book reads:

- **Put Wall:** 5,790 (−0.69% from spot)
- **Call Wall:** 5,850 (+0.34% from spot)
- **Gamma Flip:** 5,810
- **Net GEX:** +$1.5B

Net GEX is a modeled estimate of dealer gamma from the traditional call-positive/put-negative open-interest convention, not observed dealer inventory. Spot is comfortably above the flip, so this is a long-gamma session and the put wall at 5,790 is the sturdier edge of the range. The practical lean: dips toward 5,790 are the higher-probability *buy* zone, and a clean break of 5,790 would be a real tell — it likely means either a flip-cross below 5,810 into negative gamma or a catalyst strong enough to overwhelm the hedge. Below the flip, that same 5,790 stops being support and can accelerate the next leg down.

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
