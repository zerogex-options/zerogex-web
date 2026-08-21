# ZeroGEX Gamma Levels — NinjaTrader 8 indicator

An **auto-updating** NinjaScript indicator that plots today's ZeroGEX
dealer-positioning levels (Gamma Flip, Call Wall, Put Wall, Max Pain, Pin
Strike) as horizontal lines on any NinjaTrader chart. Unlike the free
manual-entry TradingView script, this one **pulls the numbers for you** — it
polls the ZeroGEX API on a timer and redraws.

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
- That endpoint is **`gex`-scoped** (`src/api/main.py` gates the levels
  router on `_scope_gex`). It returns only **derived** analytics — never raw
  per-contract quotes (`market_raw` is withheld from external keys).
- Revoking the key kills the integration instantly; usage is metered
  per-key. A future free tier can hand out delayed/EOD keys and reserve
  real-time for paid — the endpoint already returns `as_of` / `age_seconds`,
  so freshness gating is a server-side timestamp check, not a client change.

### Which key works

A Pro member generates their own key at **Account → API Access**
(`/account#api-access`) — self-serve, one-time reveal, one active key at a
time. That key is minted with tier **`signals`** (`PRO_KEY_TIER` in
`frontend/core/apiKeys.ts`), which is a superset of `analytics`:

| Tier | Scopes | Covers `/api/v1/levels`? |
| --- | --- | --- |
| `analytics` | gex, flow, maxpain, technicals | yes |
| `signals` (what Pro mints) | analytics + signals | yes |
| `full` | everything incl. `market_raw` | internal BFF only |

So **no hand-provisioning is needed** — a Pro subscriber's self-serve key
already authorizes this endpoint. (Scope enforcement is opt-in via
`API_SCOPE_ENFORCEMENT`; the tier is recorded correctly either way.)

## Files

| File | Purpose |
| --- | --- |
| `frontend/public/ninjatrader/ZeroGexGammaLevels.cs` | The indicator source. Served at `https://zerogex.io/ninjatrader/ZeroGexGammaLevels.cs`. Also the source of record if we later publish a packaged NinjaTrader import (`.zip`). |
| `frontend/components/PlotOnNinjaTrader.tsx` | "Plot these levels on NinjaTrader" section rendered on all four gamma pages, mirroring `PlotOnTradingView.tsx`. Links to the `.cs` and the install steps, framed as a Pro feature. |

There is no middleware in the frontend, so everything under `public/` is
served statically with no auth gate — the `.cs` downloads exactly the way
the existing `.pine` file does.

## What it draws

- **Gamma Flip**, **Call Wall**, **Put Wall**, **Max Pain**, **Pin Strike**
  as horizontal lines with price labels (each toggleable, each with its own
  color). A level the API returns as `null` is hidden, not drawn at zero.
- An **info panel** (top-right) showing the five values, the symbol, and how
  many seconds ago the snapshot was computed.
- Optional **price-cross alerts** (NinjaTrader `Alert()`) when price crosses
  a level.

The per-strike gamma profile that `/api/v1/levels` also returns is **not**
rendered (the levels are the primary chart overlay); a right-anchored
strike-profile histogram is the natural next enhancement — the endpoint
already returns the `profile` array, so it's a rendering-only add.

## Install

1. In NinjaTrader 8: **New → NinjaScript Editor**.
2. Right-click **Indicators → New Indicator** (or **Import…** the `.cs`),
   paste in `ZeroGexGammaLevels.cs`, and **Compile** (F5).
3. Open a chart of SPX / SPY / QQQ / NDX, right-click → **Indicators…**, add
   **ZeroGEX Gamma Levels**.
4. In the indicator settings:
   - **API key (Bearer)** — your ZeroGEX Pro key from `/account#api-access`.
   - **Symbol** — `SPX`, `SPY`, `QQQ`, or `NDX` (set it to match the chart).
   - **Poll interval** — default 60s (matches the analytics cycle).
   - Toggle levels, colors, labels, info panel, and alerts to taste.

## How it works (for maintainers)

- **Polling** is throttled to `PollSeconds` and single-in-flight
  (`Interlocked` guard). The fetch runs on a background `Task` so the data
  thread never blocks on network I/O; the parsed result is published to a
  `volatile` snapshot reference and drawn on the next `OnBarUpdate`.
- **JSON parsing is dependency-free** — a small flat-key extractor over the
  fixed `/api/v1/levels` contract, so the NinjaScript compiler needs no
  extra assembly reference. Needles are quote-delimited (`"key"`), so a key
  that merely prefixes another (`pin_strike` vs `pin_strike_reason`, `spot`
  vs `net_gex_at_spot`) cannot false-match. All numeric parsing uses
  `CultureInfo.InvariantCulture` (critical: many NinjaTrader users have a
  comma decimal separator).
- **Rendering** uses the high-level `Draw.HorizontalLine` / `Draw.Text` /
  `Draw.TextFixed` API from `OnBarUpdate` (no SharpDX), so it's simple and
  robust. Hidden or null levels call `RemoveDrawObject` so nothing lingers.

### Limitations / notes

- Refresh is driven by `OnBarUpdate`, which fires on incoming ticks. During
  the session (when levels matter and move) tick flow is continuous, so
  lines refresh within one poll interval. With **no incoming ticks** (after
  hours, a static replay), the last levels simply hold — fine, since
  post-close levels are static anyway.
- Symbol coverage follows `ANALYTICS_UNDERLYINGS` on the API side; the four
  the public gamma pages publish are SPX / SPY / QQQ / NDX. The **Symbol**
  field drives the API call, not the chart data, so set it to match the
  chart. An uncovered symbol returns `404`.
- **This file is not compiled in CI** — there is no NinjaTrader/.NET SDK in
  the web repo's toolchain, so nothing here or in review has ever built it.
  Compile it once in the NinjaScript Editor before publishing, and verify:
  the five `Draw.*` calls, `Alert()`, the brush serialization boilerplate,
  and the `HttpClient` request all resolve against your NinjaTrader 8
  version.

## Rollout order

1. **Ship the `.cs`** in `public/ninjatrader/` (served at
   `zerogex.io/ninjatrader/ZeroGexGammaLevels.cs`).
2. **Provisioning:** nothing to do — a Pro member's self-serve key already
   carries the `gex` scope this endpoint needs (see *Which key works*).
3. **Landing/CTA:** the "NinjaTrader" section on the gamma pages
   (`PlotOnNinjaTrader.tsx`), mirroring `PlotOnTradingView.tsx`.
4. **Compile check (blocking before announcement):** build once in the
   NinjaScript Editor on a real NT8 install and confirm the levels draw
   against a live key.
5. **(next)** render the strike-profile histogram; optionally publish a
   packaged NinjaTrader import `.zip` for one-click install.

---

For informational and educational purposes only. Not financial advice.
Options trading involves significant risk.
