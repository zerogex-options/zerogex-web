# Data Coverage & Refresh

*Supported symbols, market hours behavior, how often each surface updates, and what happens around holidays and half-days.*

---

## Symbols covered

ZeroGEX provides full analytics coverage for four cash underlyings:

- **SPY** - S&P 500 ETF
- **SPX** - S&P 500 Index (European-style options)
- **QQQ** - Nasdaq 100 ETF
- **NDX** - Nasdaq 100 Index (European-style options)

These are the four most liquid, most gamma-rich underlyings in the U.S. options market - the instruments where dealer hedging activity has the greatest impact on intraday price.

Two CME equity-index futures are also first-class symbols:

- **ES** - E-mini S&P 500 futures
- **NQ** - E-mini Nasdaq 100 futures

ES and NQ are not a separate options book. ES and SPX track the same index, so the dealer book behind an ES chart *is* the SPX book - the SPX levels (and NDX, for NQ) are projected onto the futures price axis, while the price series itself comes from the CME feed. The projection uses the theoretical cost of carry for the contract we are quoting (interest rates less the index's dividend yield, over the time left to that contract's expiry), so there is no basis offset to configure, and at each quarterly roll the levels move to the new contract along with the price. Because carry is fair value, the levels can sit slightly off when futures trade rich or cheap to it, as they can overnight and around news. Dollar exposures (net, call, and put GEX) are deliberately left unprojected: the histogram scales on *relative* exposure, so the shape is the same either way. The micro contracts (/MES, /MNQ) are the same contract at a tenth the size, so the same levels apply.

Single-name equities are on the roadmap, most likely starting with the Mag 7 (AAPL, MSFT, NVDA, AMZN, GOOGL, META and TSLA). Until each one is live, the signal model and the regime concept are built around index-level dealer behavior, and this page will list each stock as it is added.

## Market hours

ZeroGEX uses US Eastern Time throughout:

- **Pre-market** - 4:00 AM - 9:30 AM ET
- **Regular session** - 9:30 AM - 4:00 PM ET
- **After-hours** - 4:00 PM - 8:00 PM ET (where available)

The session badge in the header confirms which window you're in.

**ES and NQ run on the CME electronic session instead**, which is much wider: Sunday 6:00 PM ET straight through to Friday 5:00 PM ET, with a daily maintenance break from 5:00 to 6:00 PM ET. That covers the Asian and European sessions in full, and ES/NQ quotes are real-time CME. Overnight - from 6:00 PM ET until the 9:30 AM open, while the futures are trading - SPX and NDX show their future instead of the frozen cash index: the session badge reads "Futures" and the header price shows the future, with the change measured against the future's own 4:00 PM ET print.

The dealer levels on a futures chart still come from the index options book, which prices during U.S. hours. So overnight you are watching live ES/NQ trade against the levels as they stood at the U.S. close, updated as overnight chain data publishes (see *Pre-market and after-hours* below); they do not recompute tick-by-tick at 3:00 AM ET. If a futures quote itself goes stale, the price carries a badge naming the measured lag.

## Refresh cadence by surface

| Surface | Cadence |
| --- | --- |
| Price quote | About every second |
| GEX summary, walls, flip, and max pain | Recomputed about once a minute |
| GEX strike/DTE heatmap | Recomputed about once a minute |
| Options flow | Five-minute bars |
| Signal scores | About once a minute |
| Composite Score | About once a minute |
| Volatility gauges (VIX / VXN) | Five-minute bars |
| Live Bulletin | Price every 5 seconds; levels are the once-a-minute figures above, picked up within about 10 seconds; volatility every ~30 seconds |
| Backtesting data | Historical minute-level data, not live |

The page does not need to be refreshed. Pages check for new numbers every few seconds (every 5 seconds on the signal pages), so a new value shows up within seconds of being computed.

A note on the GEX surfaces: "refresh" means the exposure is **recomputed**, not that open interest is re-polled tick-by-tick. Standard listed-options open interest is tallied by the clearinghouse after the session and published for the *next* trading day - it does not build live intraday. So intraday changes to the GEX summary and heatmap come from re-pricing the existing book as spot, time, and implied vol move - not from newly confirmed OI. Estimates of the hedging that today's trades create are a separate read on the [Hedging Flow](/help/platform/hedging-flow) page, *inferred* from trade classification rather than confirmed open interest.

## Pre-market and after-hours

During extended hours:

- The header shows the last regular-session close and its change, with the live extended-hours price and its move since that close on a second line.
- Signal scores continue to update where the data is sufficient. Some signals (EOD Pressure, 0DTE Position Imbalance) intentionally only compute during the regular session.
- The GEX surface reflects the regular-session-close state plus any overnight chain updates - including the next session's cleared open interest once it publishes.

## When the market is closed

When the market is closed, the platform shows the most recent regular-session close values for all surfaces. The session badge reads "Closed".

## Holidays

Full-day market holidays - no live data; the platform shows the prior session.

Half-days (early close at 1:00 PM ET around some holidays) - the platform respects the early close. EOD Pressure keeps its usual 2:30-4:00 PM ET window, so it stays inactive on a half day.

## Historical depth

- **GEX summary** - call wall, put wall, gamma flip, net GEX and max pain, one snapshot a minute. This history isn't trimmed, so it grows by a session every trading day. It starts on **June 29, 2026** for SPY, QQQ and SPX, and on **July 24, 2026** for NDX. ES and NQ are drawn from the SPX and NDX books, so ES starts with SPX and NQ with NDX.
- **Per-minute price bars** - kept the same way, with no rolling cutoff.
- **Detailed intraday data** - full option-chain snapshots, per-strike GEX, and contract-level flow are kept for a rolling window of about 60 days. For dates before that window, the walls and net GEX are the values recorded with each summary snapshot, and the split of GEX into calls and puts isn't available.
- **Backtesting** - option prices for a test's trades come from a separate archive, which starts on **April 20, 2026** for SPY and SPX, **April 24, 2026** for QQQ, and **July 31, 2026** for NDX. A test that uses the GEX levels can only reach back as far as the GEX summary. The Backtesting page's date range shows exactly what's available for a test.

## Data sources

ZeroGEX uses real-time options and underlying market data. It is worth being precise about what that means, because it is not all one tape:

- **Option quotes and trades** for SPY, QQQ, SPX, and NDX are based on OPRA, the consolidated tape for U.S. listed options.
- **The SPX and NDX index values** come from a separate index feed, not from the options tape.
- **SPY and QQQ prices** come from a real-time equity feed.
- **ES and NQ** prices come from the real-time CME feed.
- **Open interest** is a separate, end-of-session figure from clearing rather than a real-time value.

Greeks and every dealer-positioning metric are computed by ZeroGEX from those inputs rather than supplied ready-made by a vendor - see [Methodology & Validation](/methodology). We don't disclose specific vendor names publicly.

## Latency

During regular hours, prices typically reach your browser within seconds of the print. The dealer-positioning numbers and signals trail by design, because they're recomputed on the cycles above rather than on every trade. If updates feel slower than that, see [Streaming & Performance](/help/platform/streaming-and-performance).

## Why the index complex comes first

Two reasons:

1. The dealer-positioning model only works well where dealer flow is a meaningful fraction of total flow. That's the index complex - SPY, SPX, QQQ, NDX, and the ES / NQ futures that track the same two indices.
2. We'd rather get a handful of instruments right than ten instruments half-right.

Single-name equities can drift on idiosyncratic news, earnings above all, which makes the GEX read noisier. That is why they will be added a few at a time, most likely starting with the Mag 7, where the options market is deepest, rather than all at once.

## See also

- [API Access & Keys (Pro)](/help/platform/api-access)
- [Streaming & Performance](/help/platform/streaming-and-performance)
