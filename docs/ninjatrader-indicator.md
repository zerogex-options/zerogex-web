# ZeroGEX Gamma Levels — NinjaTrader 8 indicator

An **auto-updating** NinjaScript indicator that plots today's ZeroGEX
dealer-positioning levels (Gamma Flip, Call Wall, Put Wall, Max Pain) as
horizontal lines on any NinjaTrader chart. Unlike the free manual-entry
TradingView script, this one **pulls the numbers for you** — it polls the
ZeroGEX API on a timer and redraws.

This is the **paid** counterpart to the free TradingView funnel:

> free manual TradingView script (copy today's levels)  →  **NinjaTrader
> indicator (live, requires an API key)**

Because NinjaScript is C#/.NET it can make HTTP calls (Pine Script cannot),
so this is the first *true* auto-updating third-party charting integration.

## Monetization model

**The code is free; the data is gated by the API key.** The `.cs` file is
inert without a valid key, so it can be distributed openly (like the Pine
script) while the value — real-time levels — stays behind the paywall:

- The indicator calls `GET {ApiBaseUrl}/api/v1/levels/{Symbol}` with
  `Authorization: Bearer <key>`.
- That endpoint is `gex`-scoped (the **`analytics` tier**, which ships with
  the Pro plan). It returns only **derived** analytics — never raw
  per-contract quotes (`market_raw` is withheld from external keys).
- Revoking the key kills the integration instantly; usage is metered
  per-key. A future free tier can hand out delayed/EOD keys and reserve
  real-time for paid — the endpoint already returns `as_of` / `age_seconds`,
  so freshness gating is a server-side timestamp check, not a client change.

## Files

| File | Purpose |
| --- | --- |
| `frontend/public/ninjatrader/ZeroGexGammaLevels.cs` | The indicator source. Served at `https://zerogex.io/ninjatrader/ZeroGexGammaLevels.cs`. Also the source of record if we later publish a packaged NinjaTrader import (`.zip`). |

## What it draws

- **Gamma Flip**, **Call Wall**, **Put Wall**, **Max Pain** as horizontal
  lines with price labels (each toggleable, each with its own color).
- An **info panel** (top-right) showing the four values, the symbol, and how
  many seconds ago the snapshot was computed.
- Optional **price-cross alerts** (NinjaTrader `Alert()`) when price crosses
  a level.

The per-strike gamma profile that `/api/v1/levels` also returns is **not**
rendered in this v1 (the levels are the primary chart overlay); a
right-anchored strike-profile histogram is the natural v2 enhancement — the
endpoint already returns the `profile` array, so it's a rendering-only add.

## Install

1. In NinjaTrader 8: **New → NinjaScript Editor**.
2. Right-click **Indicators → New Indicator** (or **Import…** the `.cs`),
   paste in `ZeroGexGammaLevels.cs`, and **Compile** (F5).
3. Open a chart of SPX / SPY / QQQ, right-click → **Indicators…**, add
   **ZeroGEX Gamma Levels**.
4. In the indicator settings:
   - **API key (Bearer)** — your ZeroGEX key (from the Pro plan).
   - **Symbol** — `SPX`, `SPY`, or `QQQ` (set it to match the chart).
   - **Poll interval** — default 60s (matches the analytics cycle).
   - Toggle levels, colors, labels, info panel, and alerts to taste.

## How it works (for maintainers)

- **Polling** is throttled to `PollSeconds` and single-in-flight
  (`Interlocked` guard). The fetch runs on a background `Task` so the data
  thread never blocks on network I/O; the parsed result is published to a
  `volatile` snapshot reference and drawn on the next `OnBarUpdate`.
- **JSON parsing is dependency-free** — a small flat-key extractor over the
  fixed `/api/v1/levels` contract (every key we read is unique in the
  payload), so the NinjaScript compiler needs no extra assembly reference.
  All numeric parsing uses `CultureInfo.InvariantCulture` (critical: many
  NinjaTrader users have a comma decimal separator).
- **Rendering** uses the high-level `Draw.HorizontalLine` / `Draw.Text` /
  `Draw.TextFixed` API from `OnBarUpdate` (no SharpDX), so it's simple and
  robust.

### Limitations / notes

- Refresh is driven by `OnBarUpdate`, which fires on incoming ticks. During
  the session (when levels matter and move) tick flow is continuous, so
  lines refresh within one poll interval. With **no incoming ticks** (after
  hours, a static replay), the last levels simply hold — fine, since
  post-close levels are static anyway.
- Symbols are SPX / SPY / QQQ (the analytics coverage). Set the **Symbol**
  field to match the chart; it drives the API call, not the chart data.
- **This file is not compiled in CI** — there is no NinjaTrader/.NET SDK in
  the web repo's toolchain. Compile it once in the NinjaScript Editor after
  any edit and verify: the four `Draw.*` calls, `Alert()`, the brush
  serialization boilerplate, and the `HttpClient` request all resolve
  against your NinjaTrader 8 version.

## Rollout order

1. **Ship the `.cs`** in `public/ninjatrader/` (served at
   `zerogex.io/ninjatrader/ZeroGexGammaLevels.cs`). ✅ (this change)
2. **Gate provisioning:** issue analytics-tier keys to Pro subscribers (the
   `admin_keys` CLI already supports `--tier analytics`). A self-serve key
   panel in Account is the follow-up.
3. **Landing/CTA:** a "NinjaTrader" section on the gamma pages (mirroring
   `PlotOnTradingView.tsx`) linking to the file + install steps, framed as a
   Pro feature.
4. **(v2)** render the strike-profile histogram; optionally publish a
   packaged NinjaTrader import `.zip` for one-click install.

---

For informational and educational purposes only. Not financial advice.
Options trading involves significant risk.
