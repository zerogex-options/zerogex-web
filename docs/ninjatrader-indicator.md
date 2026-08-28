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
| `assets/ninjatrader/` | The genuine NinjaTrader export (`ZeroGexGammaLevels.zip`). See its README. |
| `scripts/verify-ninjatrader-package.py` | Proves the archive's embedded source is the source of record before it is published. Fails the deploy if not. |
| `Makefile` → `ninjatrader-package` | Verifies, then copies the archive into `public/ninjatrader/`. Run by `make deploy` **before** the build so the page's build-time presence check sees it. |

There is no middleware in the frontend, so everything under `public/` is
served statically with no auth gate — the `.cs` downloads exactly the way
the existing `.pine` file does.

## What it draws

- **Gamma Flip**, **Call Wall**, **Put Wall**, **Max Pain**, **Pin Strike**
  as horizontal lines with price labels (each toggleable, each with its own
  color). A level the API returns as `null` is hidden, not drawn at zero.
- **GEX 1..N** — the strikes carrying the most dealer gamma, dashed so they
  stay distinct from the headline walls. Free: the profile the histogram uses
  already carries every strike's net gamma, so this ranks data already in
  hand, with no extra request. Ranked on **absolute** gamma, so a heavy put
  strike ranks alongside a heavy call strike — the question is "where is the
  most dealer gamma", not "where is it most positive".
- **VWAP** — session volume-weighted average price, from
  `GET /api/technicals/vwap-deviation?...&window_units=1`. This is the one
  feature that costs a second request per poll. It is best-effort: a failure
  leaves the levels untouched rather than costing the user the lines they came
  for. `window_units=1` returns a single bucket, so the flat extractor cannot
  pick up an older bar. `vwap` is in the API's `PRICE_FIELDS`, so on ES/NQ it
  arrives projected like every other level, and the `technicals` scope it needs
  is already in every external tier (see *Which key works*).
- An **info panel** (top-right) showing the five values, the symbol, and how
  many seconds ago the snapshot was computed.
- Optional **price-cross alerts** (NinjaTrader `Alert()`) when price crosses
  a level.

- An optional **per-strike gamma histogram**: one horizontal bar per strike,
  its length scaled to `|net_gex|` against the largest bar in view and coloured
  by sign. Pinned to the **left edge of the chart window** — it used to run
  leftward from the last bar and so crept across the chart as bars formed,
  which a tester reported as the profile refusing to sit still. Left rather
  than right because the labels now own the right margin. Off by default: it is
  forty extra bars on the price panel, and an existing user's chart shouldn't
  sprout them on update.

The histogram pulls `profile` from the same response, so it costs no extra
request. `Histogram strikes (nearest spot)` maps straight to the endpoint's
`strikes` query parameter (server-bounded 1–200, clamped client-side so a bad
setting can't produce a `422`).

## Install

1. In NinjaTrader 8: **New → NinjaScript Editor**.
2. Right-click **Indicators → New Indicator** (or **Import…** the `.cs`),
   paste in `ZeroGexGammaLevels.cs`, and **Compile** (F5).
3. Open a chart of ES / NQ / SPX / SPY / QQQ / NDX, right-click → **Indicators…**, add
   **ZeroGEX Gamma Levels**.
4. In the indicator settings:
   - **API key (Bearer)** — your ZeroGEX Pro key from `/account#api-access`.
   - **Symbol** — `ES`, `NQ`, `SPX`, `SPY`, `QQQ`, or `NDX` (set it to match
     the chart). On an ES or NQ chart, use `ES` / `NQ` — see below.
   - **Poll interval** — default 60s (matches the analytics cycle), floor
     30s, enforced by the runtime clamp in `MaybeFetch` and **not** by the
     `Range` attribute. A tester was found polling every 10s — six requests
     for bytes that change once a minute — and the first attempt at this
     raised the `Range` floor to 30 as well. That broke him: NinjaTrader
     validates a persisted workspace value against `Range` when the chart
     loads, and a value outside it is a modal error that stops the indicator
     loading. He opened NinjaTrader to six dialogs reading *"Value of property
     'PollSeconds' … is 10 and not in valid range between 30 and 3600"* and
     lost the indicator on the chart he trades, having changed nothing.

     **A `Range` on a persisted property may only ever widen.** It is there to
     catch typing; it cannot enforce policy, because the values it would reject
     are already sitting in workspaces on other people's machines. Policy goes
     in the runtime clamp, which repairs an existing workspace rather than
     refusing it. `PollSeconds` is now `Range(1, 3600)` — wider than any value
     that could have been persisted — and still honours 30s.
   - **Show GEX 1..N** and **Show VWAP** — both ON by default. Unlike the
     histogram these are a handful of ordinary lines rather than dozens of
     draw objects, and they are the two things traders asked for by name.
   - **Show strike profile histogram** — off by default; turn it on for the
     per-strike gamma bars, and tune `Histogram strikes` / `Histogram width` /
     `Histogram bar thickness`. Width is a percentage of the chart's width and
     thickness is the bar's height in pixels; 1px reads as a hairline rather
     than a histogram, so the default is 5.
   - Toggle levels, colors, labels, info panel, and alerts to taste.

If a packaged export has been published, the gamma pages offer it instead and
step 2 collapses to **File → Utilities → Import NinjaScript…**.

## ES and NQ (futures charts)

NinjaTrader is mostly a futures platform, so this is the common case: set
**Symbol** to `ES` or `NQ` on an ES/NQ chart and the levels come back already
on the futures price axis.

There is **no basis offset setting, and there should not be one.** ZeroGEX
never computes gamma from options on futures — ES and SPX track the same
index, so the dealer book behind an ES chart *is* the SPX book; only the price
axis differs. `FuturesProjectionMiddleware` in the API rewrites `ES` → `SPX`
inbound and carries the price-space fields across on the way out, so
`/api/v1/levels/ES` is projected without the levels router knowing futures
exist. Two properties of that design matter here:

- **Levels project, dollars don't.** `gamma_flip`, `call_wall`, `put_wall`,
  `max_pain`, `pin_strike` and each profile `strike` are in `PRICE_FIELDS`;
  `net_gex`, `call_gex` and `put_gex` are in `NEVER_PROJECT`. That is exactly
  what the histogram needs — bars are scaled by *relative* `|net_gex|`, so
  unprojected exposure is correct, not a bug.
- **Spot is never projected.** The live ES print comes from the futures feed,
  so the info panel shows the real ES price, and the response's `symbol` field
  is rewritten back to `ES` (it is in `LABEL_FIELDS`) rather than leaking
  `SPX`.

The ratio is measured off the tape rather than modelled from carry, so it
self-corrects through the quarterly roll. A client-side offset would be
strictly worse: manual, stale on roll, and wrong overnight — where the naive
`chart price − API spot` double-counts the overnight move, because cash is
frozen at the 16:00 close while the future keeps trading.

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
- **Rendering is `OnRender`, in device pixels** — SharpDX, driven by the
  chart, not the high-level `Draw` API from `OnBarUpdate`. Only the info panel
  is still a draw object (`Draw.TextFixed`, which was already anchored to the
  window and needed no fixing).

  The `Draw` API anchors everything to bars, which is right for a trendline and
  wrong for a level. Three reports from two testers were all that one decision:
  labels pinned to the last bar vanished when scrolling back through history,
  leaving unlabelled lines; the histogram crawled leftward as bars formed, when
  a profile should sit still; and a label could not be moved off the candles,
  because a bar anchor has only bars to move between. `OnRender` gets a panel
  and a price scale, and anything placed against a panel edge stays put through
  scrolling, zooming and a rewind to last week. One rewrite, three reports.

  New API surface is small and all of it standard NT8: `ChartPanel.X/Y/W/H`,
  `chartScale.GetYByValue`, `RenderTarget.DrawLine/DrawText/FillRectangle`,
  `ToDxBrush`, and `Core.Globals.DirectWriteFactory`. Dashes are drawn as
  segments rather than through a Direct2D `StrokeStyle`, because a
  `StrokeStyleProperties` struct has defaults that are not all valid and this
  file cannot be compiled here to find out which; segments use only `DrawLine`,
  already proven by the solid levels.
- **`BrushCache` converts each WPF brush once per frame.** A Direct2D brush
  belongs to the render target and must be created then disposed. Per shape
  that is forty creates a frame with the histogram on; there are only nine
  distinct colours, so they are converted once and dropped together.
- **`OnRender` is wrapped in try/catch.** NinjaTrader calls it every frame, so
  an uncaught exception throws every frame forever. It is trapped, reported
  through the info panel's status line, and the chart stays usable.
- **The render model is cached on the snapshot reference.** Ranking GEX 1..N is
  a selection pass over up to 200 strikes; the chart repaints far more often
  than the snapshot changes, so `BuildLevels` rebuilds only when the snapshot
  or the requested rank count changes. Property edits reload the whole
  indicator, so toggles and colours pick themselves up.
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
- **The profile columns are walked to the shorter of the two.** `strike` and
  `net_gex` are parsed independently, so a ragged payload should cost a missing
  bar rather than an `IndexOutOfRange` thrown once per frame inside the
  renderer.
- **`ProfileWidthBars` is a percentage now, not bars**, since the histogram no
  longer measures itself against the chart's bars. The *identifier* keeps its
  old name on purpose: NinjaTrader stores a setting under the property name, so
  renaming it would silently reset the value in every workspace that already
  holds one. Only the display label changed.

### Limitations / notes

- **`IsSuspendedWhileInactive` is deliberately `false`.** It was `true`, which
  suspends the script while its tab is inactive — and NinjaTrader restarts the
  instance on resume, dropping the snapshot. Combined with the bug below that
  read as "leave it an hour and the levels disappear". Saving one small request
  a minute was not worth the indicator appearing to break.
- **Labels sit above their line, not on it.** `Label offset above line
  (ticks)` defaults to 4 and is measured in ticks, so one setting behaves the
  same on ES, NQ and SPX, whose tick sizes differ by an order of magnitude. 0
  restores the old on-the-line behaviour. This only separates text from its
  own line; two levels a tick apart still overlap each other, which is a
  reason to keep the GEX count low rather than something the offset can fix.
- **Labels are right-aligned into the margin.** `Label distance from right edge
  (pixels)` defaults to 8, measured from the edge of the *window* rather than
  from a bar — which is the setting the `OnRender` rewrite existed to make
  possible. A trader asked to "scoot the numbers over so I can clearly see the
  bar action", and under the old model the honest answer was that he could not.
  Larger values move labels left, back toward the price action.
- **A missing snapshot never wipes the chart.** `DrawOne` removes a level when
  its value is null, which is right for a level the API genuinely reports as
  null — but passing it `s?.Level` from a null snapshot removed *everything* on
  the first frame after any restart or failed fetch. The levels are now held and
  the panel carries a `⚠ not updating` line with the reason. Holding is the
  honest default: these describe an option book, so stale-but-labelled beats
  blank.
- **401/403 is surfaced in plain words**, because only one key is active per
  account: generating a new key silently retires the one sitting in a chart, and
  that is the likeliest reason a working chart stops.
- Refresh is driven by `OnBarUpdate`, which fires on incoming ticks. During
  the session (when levels matter and move) tick flow is continuous, so
  lines refresh within one poll interval. With **no incoming ticks** (after
  hours, a static replay), the last levels simply hold — fine, since
  post-close levels are static anyway.
- Symbol coverage follows `ANALYTICS_UNDERLYINGS` on the API side, plus the
  two projected futures. The **Symbol** field drives the API call, not the
  chart data, so set it to match the chart. An uncovered symbol returns `404`.
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
   `assets/ninjatrader/` (see its README). Every deploy re-verifies it against
   the `.cs`, so re-export whenever the source changes. Absent, the pages offer
   the `.cs` and the deploy step no-ops — nothing breaks.

## Supply chain

We have no NinjaTrader in this toolchain, so the export is produced on someone
else's machine and then served from our domain. That is a real trust step, and
it is why `scripts/verify-ninjatrader-package.py` gates the publish: the source
inside the archive must equal `ZeroGexGammaLevels.cs` byte for byte after
normalising the BOM and CRLF that a Windows round trip introduces.

NinjaTrader appends a `#region NinjaScript generated code` block that is not in
our source and varies legitimately with the `[NinjaScriptProperty]` set, so it
cannot be diffed. It is compiled, though, so the verifier tripwires it against
constructs NinjaTrader never emits and prints its hash. **Read that tail by
hand whenever the property set changes** — that is the one part of a published
archive nothing else checks.

That generated block is also a useful signal in its own right: the factory
overloads it declares are derived from the `[NinjaScriptProperty]` members, so
`ApiKey` being absent from those signatures is independent confirmation that
the key stays out of the chart label.

---

For informational and educational purposes only. Not financial advice.
Options trading involves significant risk.
