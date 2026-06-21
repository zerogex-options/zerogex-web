# Backtesting

*How to run a backtest against historical signal scores, the parameter knobs, and how to read the equity curve and trade log.*

---

## What the Backtesting page is

The Backtesting page lets you replay any ZeroGEX signal against historical data and see how a simple rule would have performed. It's a **research tool**, not a strategy engine — you can't deploy from it; you use it to validate ideas.

## What you can backtest

- Any **single Advanced signal** with a custom trigger threshold.
- Any **Basic signal** as a directional filter.
- Any **composite-score band** as a regime filter.

Multi-signal stacks ("Squeeze Setup positive AND Composite ≥ +0.3") are supported through the rule builder.

## The parameter knobs

For each backtest:

- **Symbol** (SPY / SPX / QQQ)
- **Date range** — up to the available history depth
- **Entry rule** — signal score crossing a threshold
- **Exit rule** — fixed-bar exit (N minutes after entry) or take-profit / stop-loss in price terms
- **Position sizing** — fixed dollar, fixed contract count, or volatility-scaled

## The outputs

### The equity curve

Cumulative P&L over the date range. The shape of the curve matters more than the endpoint.

### The trade log

Every entry and exit with timestamp, signal score at entry, exit reason, and P&L. Click a row to see the chart for that trade.

### The summary statistics

- Trade count
- Win rate
- Average winner / average loser
- Max drawdown
- Sharpe-ish (annualized return / annualized vol)
- Average trade duration

## What the backtester is **not**

- **Not a forecaster.** Past signal performance doesn't predict future returns. Use the backtester to **reject** rules that look bad, not to "find" rules that look good.
- **Not slippage-aware.** Trades execute at the bar's open price. Real-world slippage on 0DTE can be material; the backtester doesn't model it.
- **Not commission-aware.** Add a per-trade haircut in your head.
- **Not regime-aware unless you make it so.** A rule that looks great in negative-gamma history can fail in positive-gamma sessions. Always filter or run separate backtests by regime.

## Reading the equity curve honestly

The single trader habit that improves backtesting:

> Always run the backtest on **out-of-sample data** that you held back when designing the rule.

If you designed the rule on 2024 data, test it on 2025. If the rule only works in-sample, it's overfit. Period.

## Tier note

Backtesting is a Pro feature.

## See also

- [Composite Score](/help/platform/composite-score)
- [How Signals Work End-to-End](/help/platform/signals-overview)
