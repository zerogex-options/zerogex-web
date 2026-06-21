# Max Pain

*How max pain is calculated, when it acts as a magnet versus a coincidence, and how to read it next to the gamma profile.*

---

## What max pain is

Max pain is the **strike price at expiration** at which the total dollar value of all open options is at its minimum — i.e., where option buyers in aggregate "lose the most".

The classic argument is that market makers (who are the natural sellers of options to retail) have incentive to push spot toward max pain. The honest argument is more nuanced — see [Max Pain Explained](/education/max-pain-explained).

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
- **For 0DTE on SPX.** The 0DTE chain has enough size that pin pressure is real.
- **When the gamma magnet aligns with the max pain magnet.** When the max pain strike is also a heavy gamma strike (a wall), the pin pressure is real. When they don't align, it's mostly coincidence.

## When it doesn't

- **In active trending markets.** Macro catalysts override pin behavior.
- **For tiny expiries or illiquid weeklies.** Not enough open interest to create pin pressure.
- **Far from expiration.** "Time to expiry" is the determinant.

## How to read it next to gamma

Two reads:

1. **Max pain very close to a wall** ⇒ structural pin into the close. The wall is the level; max pain is the bait.
2. **Max pain far from the walls and from spot** ⇒ ignore max pain. The structural pressure is elsewhere.

## See also

- [Max Pain Explained — and Does It Actually Work?](/education/max-pain-explained)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Gamma Walls Explained](/education/gamma-walls-explained)
