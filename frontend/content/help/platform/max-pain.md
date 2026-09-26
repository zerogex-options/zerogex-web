# Max Pain

*How max pain is calculated, when it acts as a magnet versus a coincidence, and how to read it next to the gamma profile.*

---

## What max pain is

Max pain is the **strike price at expiration** at which the total dollar value of all open options is at its minimum - i.e., where option buyers in aggregate "lose the most".

It's payoff geometry, not proof of manipulation: it marks where the most option premium expires worthless, and it doesn't by itself measure dealer hedging. The old story that market makers (the natural sellers of options to customers) actively push spot to max pain is far more nuanced than it sounds - see [Max Pain Explained](/education/max-pain-explained).

Max pain is computed from open interest, which clears and publishes per session rather than updating tick-by-tick intraday - so treat it as contextual structure, not a live predictive target.

## What this page shows

### The regime banner

**Max Pain Regime** sums up where spot sits against max pain: **Pin Risk Elevated** when spot is within 0.4% of it, otherwise **Upside Magnet** (max pain above spot) or **Downside Magnet** (max pain below), with a short read underneath.

### The snapshot cards

- **Current Max Pain (All Expirations)** - whole-chain max pain: every listed expiration pooled into one payout curve, recomputed once a day before the open. The chip beside it is the implied move - max pain minus spot, in points and percent.
- **Nearest-Expiration Max Pain** - max pain for the nearest expiration alone. Because it covers a single expiry, it can sit a few points from the whole-chain figure.
- **Underlying Price** - the latest price.

### Notional Open Interest by Strike

Call and put notional at each strike for the expiration you pick in the **Expiration** menu, with max pain and spot marked. Max pain is per-expiry, so the dashed max pain line moves with the menu. The bars are where the money sits; max pain is where the two stacks balance.

### Max Pain vs Underlying Price

Max pain as a line over the underlying's candles, with its own timeframe menu - useful for spotting drift toward (or away from) spot. Expect steps rather than a smooth drift: max pain only moves when open interest is rewritten at settlement.

## When max pain matters

Max pain is most reliable:

- **In the last 24-48 hours before a meaningful expiry.** Earlier than that, the chain is too active for max pain to be stable.
- **For 0DTE on SPX.** The 0DTE chain is large enough that pin effects *can* show up - though pinning is probabilistic, not mechanical.
- **When the gamma magnet aligns with the max pain magnet.** When the max pain strike is also a heavy gamma strike (a wall), a pin is *more likely*. When they don't align, max pain is more likely coincidental - but neither reading is guaranteed.

## When it doesn't

- **In active trending markets.** Macro catalysts override pin behavior.
- **For tiny expiries or illiquid weeklies.** Not enough open interest to create pin pressure.
- **Far from expiration.** Time to expiry is one of the main factors - early in a contract's life the chain is too active for max pain to settle.

## How to read it next to gamma

Two reads:

1. **Max pain very close to a wall** ⇒ pin pressure into the close is more likely. The wall is the structural level; max pain adds context, not a guarantee.
2. **Max pain far from the walls and from spot** ⇒ ignore max pain. The structural pressure is elsewhere.

## See also

- [Max Pain Explained - and Does It Actually Work?](/education/max-pain-explained)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Gamma Walls Explained](/education/gamma-walls-explained)
