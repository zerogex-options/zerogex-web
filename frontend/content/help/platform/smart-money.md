# Smart Money

*The smart-money screen - what qualifies a trade as smart money, how the call/put split is read, and how to use the bias intraday.*

---

## What "smart money" means here

Smart money is a heuristic - a screen for option prints big or unusual enough to be somebody's position rather than hedge scrap. Each row is one contract's trading within one minute, and it qualifies when it clears any of these bars:

- **Size** - 50 or more contracts.
- **Premium** - $50K or more.
- **Unusual smaller prints** - 20 or more contracts in a high-IV contract (IV above 40%) or a far out-of-the-money one (|delta| under 0.15).

Each qualifying print is tagged with its **aggressor side** - **Buy** when buyer-initiated premium dominated, **Sell** when seller-initiated premium did, **Neutral** when neither did - and a **notional class** from $500K+ down to under $50K. The page keeps the session's 50 largest prints by notional.

## What this page shows

### The regime banner

**Smart Money Regime** totals the call notional and the put notional of the blocks that pass your filters: **Call Buyers in Control** when calls lead by $250K or more, **Put Buyers in Control** when puts do, and **Balanced Positioning** otherwise. It counts notional from both sides of the tape - set **Side** to **Buy** if you want it to read buyers only. This is **not** the same as the headline PCR (put/call ratio) - it counts only the screened blocks.

### The filters

- **Session** - the current or the prior session.
- **Min class** - the smallest notional shown, from $500K+ (the default) down to under $50K.
- **Side** - Buy, Sell, or Neutral prints only.
- **Min |Δ|** - drops prints below a delta of 0.10, 0.25, or 0.40, trimming far out-of-the-money lotto tickets.
- **Expiry** - 0DTE, 1-7 DTE, or 8+ DTE.

### Blocks vs. underlying price

The filtered blocks as stacked bars by minute - green for calls, red for puts - against the underlying price across the session. Hover a bar to see the contracts behind it; their rows light up in the table below.

### Block detail

The same blocks as a table: time, contract, strike, expiration, DTE, type, side, delta, contracts, notional, and class. Click a header to sort (a second header becomes the tiebreaker, up to three levels), and use the funnel on Strike, Expiration, or Type to filter to one value.

## How to use it

Three patterns:

1. **Smart money heavily buying calls + MSI in a trend regime (≥ 70) + GEX gradient supportive** ⇒ structural read aligns with smart-money flow. High-conviction directional.
2. **Smart money heavily buying puts at the put wall** ⇒ defending or fading. Combined with a Positioning Trap reading, this can be tradeable counter-bias.
3. **Smart-money flow neutral, headline flow strong** ⇒ the headline is likely broad, lower-conviction participation rather than informed positioning; treat with caution.

## What it isn't

The smart-money tag is a **probabilistic heuristic**. Not every smart-money print is informed; not every informed trade gets flagged. Size is evidence, not intent: a large print can be an opening bet, a closing exit, or one leg of a spread whose other leg is elsewhere in the chain, and the tape can't tell you which. The page is most useful at the **bias level** - what is the cumulative tilt? - rather than as a trade signal on individual prints.

## ES and NQ

Smart money isn't available for ES and NQ. They have no option chain of their own here - their gamma levels are derived from SPX and NDX options - so switch to SPX or NDX to see the screen.

## The bigger picture

Smart-money flow is one of several inputs into the Positioning Trap basic signal (which uses signed smart-money imbalance) and into the Market Pressure Index (smart-money flow skew). The smart-money page is the standalone read; the signals are the interpretations.

## See also

- [Flow Analysis](/help/platform/flow-analysis)
- [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow)
- [Positioning Trap Signal Explained](/education/positioning-trap-explained)
