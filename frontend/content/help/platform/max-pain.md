# Max Pain

*How max pain is calculated, when it acts as a magnet versus a coincidence, and how to read it next to the gamma profile.*

---

## What max pain is

Max pain is the **strike price at expiration** at which the total dollar value of all open options is at its minimum — i.e., where option buyers in aggregate "lose the most".

It's payoff geometry, not proof of manipulation: it marks where the most option premium expires worthless, and it doesn't by itself measure dealer hedging. The old story that market makers (the natural sellers of options to customers) actively push spot to max pain is far more nuanced than it sounds — see [Max Pain Explained](/education/max-pain-explained).

Max pain is computed from open interest, which clears and publishes per session rather than updating tick-by-tick intraday — so treat it as contextual structure, not a live predictive target.

## What this page shows

### The headline tile

The current max pain strike for the next major expiry, with the distance from spot.

### The expiry selector

Max pain is per-expiry. The selector lets you pick 0DTE, this week's expiries, next week, and the next monthly.

### The chart

Strike on the x-axis; the in-the-money option payout sum (call + put) on the y-axis. The minimum point on the curve is max pain. The chart also shows:

- The current spot.
- The call wall and put wall from the GEX profile.
- The expiry-specific gamma profile underneath.

### The historical migration

A small panel showing how max pain has moved over the last few sessions for the selected expiry — useful for spotting drift toward (or away from) spot.

## When max pain matters

Max pain is most reliable:

- **In the last 24–48 hours before a meaningful expiry.** Earlier than that, the chain is too active for max pain to be stable.
- **For 0DTE on SPX.** The 0DTE chain is large enough that pin effects *can* show up — though pinning is probabilistic, not mechanical.
- **When the gamma magnet aligns with the max pain magnet.** When the max pain strike is also a heavy gamma strike (a wall), a pin is *more likely*. When they don't align, max pain is more likely coincidental — but neither reading is guaranteed.

## When it doesn't

- **In active trending markets.** Macro catalysts override pin behavior.
- **For tiny expiries or illiquid weeklies.** Not enough open interest to create pin pressure.
- **Far from expiration.** Time to expiry is one of the main factors — early in a contract's life the chain is too active for max pain to settle.

## How to read it next to gamma

Two reads:

1. **Max pain very close to a wall** ⇒ pin pressure into the close is more likely. The wall is the structural level; max pain adds context, not a guarantee.
2. **Max pain far from the walls and from spot** ⇒ ignore max pain. The structural pressure is elsewhere.

## See also

- [Max Pain Explained — and Does It Actually Work?](/education/max-pain-explained)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Gamma Walls Explained](/education/gamma-walls-explained)
