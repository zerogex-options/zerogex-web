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
| `frontend/components/PlotOnNinjaTrader.tsx` | "Plot these levels on NinjaTrader" section rendered on all four gamma pages, mirroring `PlotOnTradingView.tsx`. Offers the packaged import when one exists and the `.cs` otherwise, framed as a Pro feature. |
| `assets/ninjatrader/` | Slot for a genuine NinjaTrader export (`ZeroGexGammaLevels.zip`). See its README. |
| `Makefile` → `ninjatrader-package` | Guarded copy of that archive into `public/ninjatrader/`, run by `make deploy` **before** the build so the page's build-time presence check sees it. |

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

- An optional **per-strike gamma histogram**: one right-anchored horizontal
  segment per strike, running left from the last bar, length scaled to
  `|net_gex|` against the largest bar in view, coloured by sign. Off by
  default — it is dozens of extra draw objects on the price panel, and an
  existing user's chart shouldn't sprout them on update.

The histogram pulls `profile` from the same response, so it costs no extra
request. `Histogram strikes (nearest spot)` maps straight to the endpoint's
`strikes` query parameter (server-bounded 1–200, clamped client-side so a bad
setting can't produce a `422`).

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
   - **Show strike profile histogram** — off by default; turn it on for the
     per-strike gamma bars, and tune `Histogram strikes` / `Histogram width`.
   - Toggle levels, colors, labels, info panel, and alerts to taste.

If a packaged export has been published, the gamma pages offer it instead and
step 2 collapses to **File → Utilities → Import NinjaScript…**.

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
  `Draw.TextFixed` / `Draw.Line` API from `OnBarUpdate` (no SharpDX), so it's
  simple and robust. Hidden or null levels call `RemoveDrawObject` so nothing
  lingers.
- **The histogram's profile array** needs more than the flat extractor: its
  keys repeat per element. `ExtractProfile` walks the array by brace depth and
  runs the same extractor *scoped to one element*, where each key is unique
  again. Profile elements hold only numbers, so depth alone delimits them.
- **The API key is deliberately not a `[NinjaScriptProperty]`.** NinjaTrader
  renders every one of those into the indicator label across the top of the
  chart, so marking the key as one would put a live credential in plain text on
  screen and into every screenshot a user shares. Dropping the attribute keeps
  it in the settings dialog and in the saved workspace, but out of the label.
  Do not re-add it. Anything genuinely secret added later needs the same
  treatment.
- **Histogram redraws are gated.** `Draw.Line` takes `barsAgo`, which resolves
  to an absolute bar at draw time, so the bars must be redrawn as bars form or
  they drift off the right edge. Redrawing dozens of objects on every tick of
  an `OnEachTick` indicator is wasteful, so the redraw fires only on a new bar,
  a new snapshot, or a toggle. Bar count is also clamped to `CurrentBar`.

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
   against a live key, with the histogram both off and on.
5. **Packaged import:** export from NT8 and commit the archive to
   `assets/ninjatrader/` (see its README). Until then the pages offer the
   `.cs` and the deploy step no-ops — nothing breaks.

---

For informational and educational purposes only. Not financial advice.
Options trading involves significant risk.
