# Data Coverage & Refresh

*Supported symbols, market hours behavior, how often each surface updates, and what happens around holidays and half-days.*

---

## Symbols covered

ZeroGEX provides full analytics coverage for three instruments:

- **SPY** — S&P 500 ETF
- **SPX** — S&P 500 Index (European-style options)
- **QQQ** — Nasdaq 100 ETF

These are the three most liquid, most gamma-rich underlyings in the U.S. options market — the instruments where dealer hedging activity has the greatest impact on intraday price.

We don't plan to support single-name equities. The signal model and the regime concept are designed around index-level dealer behavior.

## Market hours

ZeroGEX uses US Eastern Time throughout:

- **Pre-market** — 4:00 AM – 9:30 AM ET
- **Regular session** — 9:30 AM – 4:00 PM ET
- **After-hours** — 4:00 PM – 8:00 PM ET (where available)

The session badge in the header confirms which window you're in.

## Refresh cadence by surface

| Surface | Cadence |
| --- | --- |
| Price quote | 1 second |
| GEX summary | 5–15 seconds |
| GEX strike/DTE heatmap | 5–15 seconds |
| Flow / tape | 1 second |
| Signal scores | 1–5 seconds depending on signal |
| Composite Score | 5 seconds |
| Live Bulletin | event-driven, real time |
| Backtesting data | EOD snapshot |

The page does not need to be refreshed. Everything streams.

## Pre-market and after-hours

During extended hours:

- The price tile shows the extended-hours quote alongside the prior regular-session close.
- Signal scores continue to update where the data is sufficient. Some signals (EOD Pressure, 0DTE Position Imbalance) intentionally only compute during the regular session.
- The GEX surface reflects the regular-session-close state plus any overnight chain updates.

## When the market is closed

When the market is closed, the platform shows the most recent regular-session close values for all surfaces. The session badge reads "Closed". Signal pages show "last computed" timestamps.

## Holidays

Full-day market holidays (NYE eve excepted) — no live data; the platform shows the prior session.

Half-days (early close at 1:00 PM ET for some Fridays around holidays) — the platform respects the early close. The EOD Pressure window adapts to a 11:30 AM ET ramp on half-days.

## Historical depth

- **Quotes & flow** — multiple years of historical bars.
- **Signal scores** — backfilled to the inception of each signal.
- **GEX surfaces** — daily snapshot history; intraday history is limited to the recent window.

The Backtesting page exposes the historical horizon for whatever signal you select.

## Data sources

ZeroGEX uses **OPRA-feed options data** (the consolidated tape for U.S. options) plus the underlying equity quote feed. Both are professional-grade, real-time data sources.

We don't disclose specific vendor names publicly, but the quality bar is institutional — same data feeds used by quant desks.

## Latency

The end-to-end latency from a trade printing on the tape to it reaching your browser is typically under a second during regular hours. The bottleneck is rarely the data — it's your network and browser. See [Streaming & Performance](/help/platform/streaming-and-performance).

## Why only SPY / SPX / QQQ

Two reasons:

1. The dealer-positioning model only works well where dealer flow is a meaningful fraction of total flow. That's the index complex.
2. We'd rather get three instruments right than ten instruments half-right.

Single-name equities can drift on idiosyncratic news that makes the GEX read noisier. We're not in that game.

## See also

- [API Access & Keys (Pro)](/help/platform/api-access)
- [Streaming & Performance](/help/platform/streaming-and-performance)
