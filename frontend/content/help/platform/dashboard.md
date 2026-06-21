# Reading the Dashboard

*The page you open first every morning. Every tile, every chart, every cue explained.*

---

## What the Dashboard is for

The Dashboard is the **single-screen read** of the current market. It answers, in 30 seconds, three questions:

1. **Where are dealers positioned?** (the GEX regime)
2. **What is the tape saying?** (flow + technicals)
3. **What is the composite read?** (signals blended into one direction)

You're not making decisions on the Dashboard. You're orienting. From there you drill into the right page.

## The anatomy

### 1. The regime header

The top of the page shows the **GEX regime label** — Positive Gamma, Negative Gamma, or Transitioning — alongside a short read of what that means for behavior right now. If you only have time for one piece of information today, this is the one.

### 2. The price tile

The headline price tile shows the live last price, the change versus the previous session close, and the session badge. Pre-market and after-hours quotes are shown with the prior close as the baseline; during regular hours the same-session open is the baseline.

### 3. The Net GEX tile

The Net GEX tile is the headline gamma exposure number — calculated **at spot** so it reads the right side of the gamma flip. A positive number means dealers are net long gamma; negative means they're net short. The color and trend chip reinforce sign and direction.

### 4. The Gamma Flip tile

Distance to the flip — both as a strike and as a percent of spot. The flip is the level at which the dealer gamma curve crosses zero. Above the flip, dealer hedging dampens moves; below, it amplifies them. The closer you are to the flip, the higher the structural risk of a regime change.

### 5. The Call Wall / Put Wall tiles

The strikes with the largest call gamma and put gamma respectively. These tend to act as intraday resistance and support, especially when the market is in positive gamma. See [Gamma Walls Explained](/education/gamma-walls-explained) for the structural read.

### 6. The Max Pain tile

The strike that minimizes the total dollar value of outstanding options at expiration. Most relevant inside the last 24–48 hours before a meaningful expiration. See [Max Pain Explained](/education/max-pain-explained).

### 7. The Volatility tiles

Live IV, IV rank, and realized vol with sparklines. Useful for sizing — a Squeeze Setup at low realized vol is a different trade than at high.

### 8. The Trade Bias section

A blended bias chip ("Long bias", "Short bias", "Neutral") with the contributing inputs underneath. This is a read-from-the-top synthesis — it is **not** a trade signal.

### 9. The Composite Score panel

The MSI composite score, the trigger state, and the contributing signal weights. For the full breakdown, click through to [Composite Score](/help/platform/composite-score).

### 10. The Flow snapshot

A short read on premium-weighted flow, smart-money bias, and net volume — three different ways of looking at the tape. The full pages live under [Flow Analysis](/help/platform/flow-analysis) and [Smart Money](/help/platform/smart-money).

## How the dashboard refreshes

Tiles update live. Most refresh every second during regular trading hours. The GEX surface refreshes on a slightly slower cadence — typically every 5–15 seconds — because the underlying chain snapshot is the bottleneck. There is no need to reload the page.

## Pre-market, after-hours, and closed

The Dashboard adapts to the session:

- **Pre-market / After-hours** — extended-hours quote is shown alongside the prior regular-session close.
- **Closed** — the most recent regular-session close is shown; signals reflect the last computed state.

Look at the session badge in the price row to confirm.

## Reading the Dashboard in 30 seconds

The discipline:

1. Read the **regime label**.
2. Read **Net GEX** and the **distance to the flip**.
3. Read **call wall and put wall** — these are your levels.
4. Read **trade bias** and the **composite score**.
5. Decide which page to open for the actual trade.

That's it. If you find yourself spending more than 30 seconds here, you've stopped orienting and started analyzing — go to the signal page that's relevant.

## See also

- [How Signals Work End-to-End](/help/platform/signals-overview)
- [Dealer Positioning](/help/platform/dealer-positioning)
- [Using the Live Bulletin](/help/platform/live-bulletin)
