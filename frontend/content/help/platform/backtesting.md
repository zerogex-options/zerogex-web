# Backtesting

*Replay any ZeroGEX signal or a custom rule against historical option data, priced as real option-leg round trips — net of slippage and commission — with a full risk-adjusted tearsheet, a Monte Carlo outcome cone, and results broken out by gamma regime.*

---

## What the Backtesting page is

The Backtesting page lets you test how a rule would have performed on history and see it priced the way a real trade fills — crossing the bid/ask spread, paying commission, and sitting through open-position drawdown. It is a **research tool**: use it to pressure-test ideas and reject the ones that don't hold up, not to manufacture a curve that looks good.

## What you can backtest

- **Playbook patterns** — any of the built-in signal patterns that drive live Action Cards (gamma-flip break, call-wall fade, put-wall bounce, EOD pressure drift, and more), alone or as a basket.
- **Custom strategies** — a condition builder over per-minute market structure (net GEX / net GEX at spot, distance to the gamma flip, call/put-wall distances, put-call ratio, MSI and MSI regime, convexity, …) compiled into entries.
- **Real option structures** — single ATM options, defined-risk verticals, and neutral straddles, strangles, and iron condors.

## The parameter knobs

- **Symbol** — SPY / SPX / QQQ
- **Date range** — up to the available history depth (shown on the form)
- **Entry** — a pattern basket, or a custom AND-ed condition rule
- **Exit** — underlying level targets/stops, an option-premium take-profit / stop-loss overlay, and a max-hold time stop (whichever triggers first)
- **Fill model** — slippage % and commission per contract (both applied — see below)
- **Sizing** — capital, risk per trade, max concurrent positions, and optional net-delta / net-vega caps
- **Parameter sweeps** — run a grid across one or two axes to compare settings side by side

## The outputs

### The equity curve

Your account value over the run, marked **to market** — open positions are priced at each bar, so a trade sitting in an unrealized loss shows up in the curve and in the max drawdown. Drawdown is peak-to-trough on this curve, not just booked losses.

### The performance tearsheet

The risk-adjusted battery a serious reader checks first:

- **Sharpe, Sortino, Calmar** and **CAGR**
- **Annualized volatility**, **exposure**, and the **max losing streak**
- **Expectancy per trade**, **payoff ratio**, average and largest win/loss
- An **edge t-stat** — is the average trade's result distinguishable from noise (|t| ≥ 2)?
- A **benchmark**: your return next to simply buying and holding the underlying over the same window, and the excess.

### The Monte Carlo outcome cone

Your trade sequence resampled a thousand ways, because a single equity line reads as destiny when it isn't. You get the **probability of ending profitable**, the **risk of ruin** (chance of a ≥50% drawdown), the **p5 / p50 / p95** range of returns and max drawdowns, and a shaded **equity cone** of where the account plausibly lands.

### Results by market regime

The ZeroGEX cut: the same rules split by the **dealer-gamma backdrop** (positive/suppressive vs. negative/amplifying gamma) and by **MSI regime**, with win rate, net P&L, and expectancy for each. A rule that prints in negative-gamma sessions and bleeds in positive-gamma ones is a regime bet — this is where you see it.

### The trade blotter

Every round trip with entry/exit premium, contracts, net Δ/vega, the regime at entry, net P&L, and outcome. Export the full blotter to CSV.

## How fills are modeled

- **Slippage-aware.** Each leg fills across the quoted spread — you buy at the ask, sell at the bid — widened by your slippage setting. This is the dominant, realistic cost on 0DTE.
- **Commission-aware.** Commission is charged per contract, per leg, on both entry and exit, and is folded into position sizing.
- **Defined-risk-aware.** Multi-leg structures are bounded to their no-arbitrage max loss / max gain, so an illiquid near-expiry quote can't book an impossible result.

The reported returns are **net of all of the above** — the numbers you see are after costs, not gross.

## What the backtester is **not**

- **Not a forecaster.** Past performance doesn't predict future returns. Use the backtester to **reject** rules that look bad, not to "find" rules that look good.
- **Not a substitute for out-of-sample discipline.** The Monte Carlo cone and the edge t-stat tell you how fragile a result is, but the habit still matters: design on one period, confirm on another you held back.
- **Bounded by data depth.** You can only test the window the platform has archived. A short window is a small sample — read the t-stat and the Monte Carlo range accordingly, and lean on the regime split so you know which backdrop your numbers came from.

## Reading results honestly

> Judge a rule by its **risk-adjusted** numbers and its **range of outcomes**, not its best single line.

A high win rate with a payoff ratio below 1 and a wide Monte Carlo cone is not an edge. A modest win rate with a positive expectancy, a t-stat past 2, a shallow drawdown, and consistency across gamma regimes is. Always check which regime produced the result — and whether it survives the one you're trading into today.

## Tier note

Backtesting is a Pro feature.

## See also

- [Composite Score](/help/platform/composite-score)
- [How Signals Work End-to-End](/help/platform/signals-overview)
