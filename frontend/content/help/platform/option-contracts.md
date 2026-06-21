# Live Options Quotes

*Browse the live chain. Filtering by expiry and moneyness, sorting columns, and how the IV surface lights the colors.*

---

## What this page shows

The Live Options Quotes page is the **live options chain** for the active symbol. Every column updates in real time during market hours.

## The columns

For each strike and each expiry:

- **Strike**
- **Bid / Ask / Mid**
- **Last** and **Volume**
- **Open Interest**
- **Delta, Gamma, Vega, Theta, Charm**
- **Implied Volatility**
- **GEX contribution** — the dealer-gamma dollar value at this strike

Each row is paired (call on left, put on right) with the strike in the center column. The classic chain layout.

## Filters

The filter bar lets you scope the chain:

- **Expiration** — multi-select. Defaults to 0DTE if available, otherwise the nearest.
- **Moneyness** — ATM-band (e.g., ±5% from spot) or full chain.
- **Sort** — by strike, volume, OI, IV, GEX contribution.
- **Show only** — non-zero volume, non-zero OI, sweeps, blocks.

## The IV surface colors

Cells are color-graded by IV — cool colors (blue) for low IV, warm colors (red) for high. The scale is per-expiry, so a hot ATM in one column is not the same absolute IV as a hot ATM in another. The point is to see the **shape** of the smile, not the absolute level.

## How to read the chain

Three patterns:

1. **Where is the OI stacked?** The chain is the raw data underlying the GEX profile. The biggest OI strikes are usually where the walls are.
2. **Where is the volume?** Volume tells you what's being traded **right now**, which can diverge from OI sharply intraday.
3. **Where is the IV skew?** Steeper OTM-put IV vs OTM-call IV is the skew read.

## Quick actions

- **Click a row** to open the Strategy Builder with that leg pre-filled.
- **Hover a cell** for the full details (bid/ask size, last trade time, exchange).

## Tier note

Live Options Quotes is available to Basic and Pro.

## See also

- [Strategy Builder](/help/platform/options-calculator)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Flow Analysis](/help/platform/flow-analysis)
