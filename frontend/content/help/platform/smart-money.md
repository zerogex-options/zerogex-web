# Smart Money

*The smart-money screen — what qualifies a trade as smart-money, how the C/P ratio is computed, and how to use the bias intraday.*

---

## What "smart money" means here

Smart money is a heuristic — a tag we apply to options trades that have the structural fingerprint of an informed bet:

- **Size** — premium and contract size meaningfully above the average for the strike/expiry.
- **Aggression** — paid at or through the offer (buy) or hit the bid (sell), not mid-prices.
- **Repetition** — multiple aggressive prints in the same direction in a short window.
- **Conviction premium** — the trade pays a non-trivial percent of the contract's value.

A single block alone doesn't qualify. A pattern of conviction trades on a strike does.

## What this page shows

### The smart-money C/P ratio

The ratio of smart-money call premium to smart-money put premium. A reading well above 1 means smart-money flow is structurally bid for calls; well below means puts. This is **not** the same as the headline PCR (put/call ratio) — it filters to high-conviction prints only.

### The smart-money tape

A live feed of smart-money-tagged trades — size, premium, strike, expiry, direction, time. Click to see the trade in context.

### The smart-money bias

A blended bias chip — bullish, bearish, neutral — built from the C/P ratio plus the net premium-weighted flow on the smart-money subset.

### The strike concentration map

Where smart-money flow has concentrated by strike, color-coded by direction. Useful for spotting "where the big money is leaning".

## How to use it

Three patterns:

1. **Smart-money strongly long calls + composite positive + GEX gradient supportive** ⇒ structural read aligns with smart-money flow. High-conviction directional.
2. **Smart-money strongly long puts at the put wall** ⇒ defending or fading. Combined with a Positioning Trap reading, this can be tradeable counter-bias.
3. **Smart-money flow neutral, headline flow strong** ⇒ the headline is retail-driven; treat with caution.

## What it isn't

The smart-money tag is a **probabilistic heuristic**. Not every smart-money print is informed; not every informed trade gets flagged. The page is most useful at the **bias level** — what is the cumulative tilt? — rather than as a trade signal on individual prints.

## The bigger picture

Smart-money flow is one of several inputs into the Positioning Trap basic signal (which uses signed smart-money imbalance) and into the Market Pressure Index (smart-money flow skew). The smart-money page is the standalone read; the signals are the interpretations.

## See also

- [Flow Analysis](/help/platform/flow-analysis)
- [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow)
- [Positioning Trap Signal Explained](/education/positioning-trap-explained)
