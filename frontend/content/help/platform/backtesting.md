# Backtesting

*Replay a ZeroGEX strategy or a custom rule against historical option data, priced as real option-leg round trips - net of slippage and commission - with a full risk-adjusted tearsheet, a Monte Carlo outcome cone, and results broken out by gamma regime.*

---

## What the Backtesting page is

The Backtesting page lets you test how a rule would have performed on history and see it priced the way a real trade fills - crossing the bid/ask spread, paying commission, and sitting through open-position drawdown. It is a **research tool**: use it to pressure-test ideas and reject the ones that don't hold up, not to manufacture a curve that looks good.

## What you can backtest

- **Strategy catalog** - the same strategies Bot Trading and Pattern Insights use (call-wall fades, put-wall bounces, gamma-flip breaks, late-day hedging drift, and more), grouped by family, alone or as a basket. Each shows its research stage and a summary of its evidence. Strategies with a playbook pattern are measured by replaying the Action Cards that pattern fired live; one marked **Replay** re-runs its bot's entry rule over history instead. A strategy that can't be backtested yet is greyed out, with the reason.
- **Custom strategies** - a condition builder over per-minute market structure (net GEX / net GEX at spot, distance to the gamma flip, call/put-wall distances, put-call ratio, MSI and MSI regime, convexity, …) compiled into entries.
- **Real option structures** - single ATM options, defined-risk verticals, and neutral straddles, strangles, and iron condors.

## The parameter knobs

- **Symbol** - SPY / SPX / QQQ / NDX
- **Date range** - up to the available history depth (the form opens on the full available window)
- **Entry** - a basket of catalog strategies, or a custom AND-ed condition rule
- **Exit** - underlying level targets/stops, an option-premium take-profit / stop-loss overlay, and a max-hold time stop (whichever triggers first)
- **Fill model** - slippage % and commission per contract (both applied - see below)
- **Sizing** - capital, risk per trade, max concurrent positions, and optional net-delta / net-vega caps
- **Parameter sweeps** - run a grid across one or two axes (up to 24 runs) to compare settings side by side

## The outputs

### The equity curve

Your account value over the run, marked **to market** - open positions are priced at each bar, so a trade sitting in an unrealized loss shows up in the curve and in the max drawdown. Drawdown is peak-to-trough on this curve, not just booked losses.

### The performance tearsheet

The risk-adjusted battery a serious reader checks first:

- **Sharpe, Sortino, Calmar** and **CAGR**
- **Annualized volatility**, **exposure**, and the **max losing streak**
- **Expectancy per trade**, **payoff ratio**, **average win** and **average loss**
- An **edge t-stat** - is the average trade's result distinguishable from noise (|t| ≥ 2)?
- A **benchmark**: your return next to simply buying and holding the underlying over the same window, and the excess.

### The Monte Carlo outcome cone

Your trade sequence resampled a thousand ways, because a single equity line reads as destiny when it isn't. You get the **probability of ending profitable**, the **risk of ruin** (chance of a ≥50% drawdown), the **median and p5-p95 range** of returns, the **median and p95 max drawdown**, and a shaded **equity cone** of where the account plausibly lands.

### Results by market regime

The ZeroGEX cut: the same rules split by the **dealer-gamma backdrop** (positive/suppressive vs. negative/amplifying gamma) and by **MSI regime**, with win rate, net P&L, and expectancy for each. A rule that prints in negative-gamma sessions and bleeds in positive-gamma ones is a regime bet - this is where you see it.

### Why N trades?

A funnel from cards loaded to trades taken - loaded, in your selected strategies, after cooldown, priced, traded - with the reasons cards dropped out along the way. If a run comes back thin or empty, start here.

### The trade blotter

Every round trip with entry/exit premium, contracts, net Δ/vega, net P&L, return, and outcome. Export the full blotter to CSV - the export also carries the gamma and MSI regime at entry. A **By Pattern** table above it splits trades, win rate and net P&L by strategy.

## Saving and sharing

- **Recent Runs** lists your latest runs; click one to reopen its results.
- **Saved configurations** - name the current setup and save it. From the list you can load it, delete it, or copy a share link that opens the Backtesting page with that setup filled in (whoever opens it needs Pro).
- **Share result** - on a completed run with trades, creates a public, read-only report: the headline numbers, the equity curve, the Monte Carlo range and the regime split. Anyone with the link can open it, no account needed.
- **Featured strategies** load a strategy with measured evidence into the form in one click.

## How fills are modeled

- **Slippage-aware.** Each leg fills across the quoted spread - you buy at the ask, sell at the bid - widened by your slippage setting. This is the dominant, realistic cost on 0DTE.
- **Commission-aware.** Commission is charged per contract, per leg, on both entry and exit, and is folded into position sizing.
- **Defined-risk-aware.** Multi-leg structures are bounded to their no-arbitrage max loss / max gain, so an illiquid near-expiry quote can't book an impossible result.

The reported returns are **net of all of the above** - the numbers you see are after costs, not gross.

## What the backtester is **not**

- **Not a forecaster.** Past performance doesn't predict future returns. Use the backtester to **reject** rules that look bad, not to "find" rules that look good.
- **Not a substitute for out-of-sample discipline.** The Monte Carlo cone and the edge t-stat tell you how fragile a result is, but the habit still matters: design on one period, confirm on another you held back.
- **Bounded by data depth.** You can only test the window the platform has archived. A short window is a small sample - read the t-stat and the Monte Carlo range accordingly, and lean on the regime split so you know which backdrop your numbers came from.

## Reading results honestly

> Judge a rule by its **risk-adjusted** numbers and its **range of outcomes**, not its best single line.

A high win rate with a payoff ratio below 1 and a wide Monte Carlo cone is not an edge. A modest win rate with a positive expectancy, a t-stat past 2, a shallow drawdown, and consistency across gamma regimes is. Always check which regime produced the result - and whether it survives the one you're trading into today.

## Tier note

Backtesting is a Pro feature, currently in beta. It sits under **TradeWorkz™** in the sidebar, next to Bot Trading and Pattern Insights. Shared result links are the exception: anyone can open one.

## See also

- [Pattern Insights](/backtesting/insights) - measured performance for every strategy in the catalog (Pro)
- [Composite Score](/help/platform/composite-score)
- [How Signals Work End-to-End](/help/platform/signals-overview)
