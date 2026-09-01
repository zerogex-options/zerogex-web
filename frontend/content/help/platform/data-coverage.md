# Data Coverage & Refresh

*Supported symbols, market hours behavior, how often each surface updates, and what happens around holidays and half-days.*

---

## Symbols covered

ZeroGEX provides full analytics coverage for four instruments:

- **SPY** — S&P 500 ETF
- **SPX** — S&P 500 Index (European-style options)
- **QQQ** — Nasdaq 100 ETF
- **NDX** — Nasdaq 100 Index (European-style options)

These are the four most liquid, most gamma-rich underlyings in the U.S. options market — the instruments where dealer hedging activity has the greatest impact on intraday price.

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

A note on the GEX surfaces: "refresh" means the exposure is **recomputed**, not that open interest is re-polled tick-by-tick. Standard listed-options open interest is tallied by the clearinghouse after the session and published for the *next* trading day — it does not build live intraday. So intraday changes to the GEX summary and heatmap come from re-pricing the chain as spot, time, and implied vol move, plus positioning *inferred* from live volume and trade classification — not from newly confirmed OI. Treat intraday positioning shifts as inferred, not verified open interest.

## Pre-market and after-hours

During extended hours:

- The price tile shows the extended-hours quote alongside the prior regular-session close.
- Signal scores continue to update where the data is sufficient. Some signals (EOD Pressure, 0DTE Position Imbalance) intentionally only compute during the regular session.
- The GEX surface reflects the regular-session-close state plus any overnight chain updates — including the next session's cleared open interest once it publishes.

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

ZeroGEX draws on several distinct classes of professional market data, each with its own source:

- **Real-time listed U.S. options trades and quotes** — used to price the chain and to infer intraday positioning changes between official open-interest updates.
- **Official open interest** — tallied by the clearinghouse after the session and published for the next trading day. It is an end-of-session figure, not a real-time one.
- **Real-time underlying quotes** for the index and ETF.
- **A CME futures feed** for the ES / NQ pages, which is a separate entitlement from the options and equity feeds.

Greeks and every dealer-positioning metric are computed by ZeroGEX from those inputs rather than supplied ready-made by a vendor — see [Methodology & Validation](/methodology). We don't disclose specific vendor names publicly.

## Latency

The end-to-end latency from a trade printing on the tape to it reaching your browser is typically under a second during regular hours. The bottleneck is rarely the data — it's your network and browser. See [Streaming & Performance](/help/platform/streaming-and-performance).

## Why only SPY / SPX / QQQ / NDX

Two reasons:

1. The dealer-positioning model only works well where dealer flow is a meaningful fraction of total flow. That's the index complex.
2. We'd rather get four instruments right than ten instruments half-right.

Single-name equities can drift on idiosyncratic news that makes the GEX read noisier. We're not in that game.

## See also

- [API Access & Keys (Pro)](/help/platform/api-access)
- [Streaming & Performance](/help/platform/streaming-and-performance)
