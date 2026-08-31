# Data Coverage & Refresh

*Supported symbols, market hours behavior, how often each surface updates, and what happens around holidays and half-days.*

---

## Symbols covered

ZeroGEX provides full analytics coverage for four cash underlyings:

- **SPY** — S&P 500 ETF
- **SPX** — S&P 500 Index (European-style options)
- **QQQ** — Nasdaq 100 ETF
- **NDX** — Nasdaq 100 Index (European-style options)

These are the four most liquid, most gamma-rich underlyings in the U.S. options market — the instruments where dealer hedging activity has the greatest impact on intraday price.

Two CME equity-index futures are also first-class symbols:

- **ES** — E-mini S&P 500 futures
- **NQ** — E-mini Nasdaq 100 futures

ES and NQ are not a separate options book. ES and SPX track the same index, so the dealer book behind an ES chart *is* the SPX book — the SPX levels (and NDX, for NQ) are projected onto the futures price axis, while the price series itself comes from the CME feed. The projection ratio is measured off the tape rather than modelled from carry, so it self-corrects through each quarterly roll and there is no basis offset to configure. Dollar exposures (net, call, and put GEX) are deliberately left unprojected: the histogram scales on *relative* exposure, so the shape is the same either way. The micro contracts (/MES, /MNQ) are the same contract at a tenth the size, so the same levels apply.

We don't plan to support single-name equities. The signal model and the regime concept are designed around index-level dealer behavior.

## Market hours

ZeroGEX uses US Eastern Time throughout:

- **Pre-market** — 4:00 AM – 9:30 AM ET
- **Regular session** — 9:30 AM – 4:00 PM ET
- **After-hours** — 4:00 PM – 8:00 PM ET (where available)

The session badge in the header confirms which window you're in.

**ES and NQ run on the CME electronic session instead**, which is much wider: Sunday 6:00 PM ET straight through to Friday 5:00 PM ET, with a daily maintenance break from 5:00 to 6:00 PM ET. That covers the Asian and European sessions in full, and ES/NQ quotes are real-time CME. When a cash index is closed but its future is trading, the session badge reads "Futures" and the price tile shows the future — with the change measured against the future's own 4:00 PM ET print — rather than the frozen cash index.

The dealer levels on a futures chart still come from the index options book, which prices during U.S. hours. So overnight you are watching live ES/NQ trade against the levels as they stood at the U.S. close, updated as overnight chain data publishes (see *Pre-market and after-hours* below); they do not recompute tick-by-tick at 3:00 AM ET. If a futures quote itself goes stale, the price carries a badge naming the measured lag.

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

ZeroGEX uses **OPRA-feed options data** (the consolidated tape for U.S. options — real-time trades and quotes, used to infer intraday positioning) plus the underlying equity quote feed. Official open interest is a separate, end-of-session figure from clearing rather than a real-time value. All are professional-grade sources.

We don't disclose specific vendor names publicly, but the quality bar is institutional — same data feeds used by quant desks.

## Latency

The end-to-end latency from a trade printing on the tape to it reaching your browser is typically under a second during regular hours. The bottleneck is rarely the data — it's your network and browser. See [Streaming & Performance](/help/platform/streaming-and-performance).

## Why only the index complex

Two reasons:

1. The dealer-positioning model only works well where dealer flow is a meaningful fraction of total flow. That's the index complex — SPY, SPX, QQQ, NDX, and the ES / NQ futures that track the same two indices.
2. We'd rather get a handful of instruments right than ten instruments half-right.

Single-name equities can drift on idiosyncratic news that makes the GEX read noisier. We're not in that game.

## See also

- [API Access & Keys (Pro)](/help/platform/api-access)
- [Streaming & Performance](/help/platform/streaming-and-performance)
