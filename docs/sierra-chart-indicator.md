# ZeroGEX Gamma Levels — Sierra Chart (ACSIL) study

An **auto-updating** ACSIL study that plots today's ZeroGEX dealer-positioning
levels (Gamma Flip, Call Wall, Put Wall, Max Pain, Pin Strike) on any Sierra
Chart chart and keeps them current by polling the ZeroGEX API.

This is the second **paid** integration, on the same terms as the NinjaTrader
indicator:

> free manual scripts (TradingView, thinkorswim) → **auto-updating studies
> (NinjaTrader 8, Sierra Chart), which need an API key**

ACSIL is C++, so unlike Pine Script and thinkScript it can make HTTP calls.
Sierra Chart's audience is professional futures traders — the people most
likely to want ES/NQ levels that maintain themselves across a session and a
quarterly roll — which is why it is worth carrying a second C-family
integration alongside NinjaTrader.

See `docs/integrations.md` for how this fits with the other three.

## ⚠️ Compile status

**The `.cpp` has not been compiled against a real Sierra Chart install.** It is
written against the portable, long-standing subset of ACSIL
(`sc.MakeHTTPRequest`, `sc.HTTPResponse`, subgraphs, `sc.GetPersistentInt`)
specifically to keep that subset small, and the design decisions below were
made to avoid the parts of the API that vary between versions. But
sierrachart.com is not reachable from the environment this was written in, so
the exact signatures could not be checked against the current ACSIL reference.

**Before publishing the download**, drop it in `ACS_Source` and run
**Analysis → Build Custom Studies DLL → Build** once. Expect any breakage to be
a one-line signature fix, not a redesign. The most likely candidates, in order:

1. `sc.CurrentSystemDateTime.GetAsDouble()` — if `GetAsDouble()` is not the
   accessor, `double Now = sc.CurrentSystemDateTime;` is the legacy form.
2. `ACSIL_HTTP_REQUEST_ERROR_TEXT` / `ACSIL_HTTP_EMPTY_RESPONSE_TEXT` — the
   sentinel names for a failed transport.
3. `sc.GetPersistentInt` / `sc.SetPersistentInt` — some versions expose the
   getter as a reference (`int& sc.GetPersistentInt(int)`), which this code is
   already compatible with.
4. `SCString::Trim()` / `MakeUpper()` / `Left()`, and `VALUEFORMAT_INHERITED`.

### What HAS been compiled and tested

The three functions that carry the study's actual logic — `ParseJsonNumber`,
`ExtractJsonNumber` and `PollClockNow` — are plain C++ with no ACSIL surface
beyond `SCString`, so they were extracted verbatim into a harness with a
stubbed `SCString`, compiled with `g++ -Wall -Wextra`, and run against
realistic `/api/v1/levels` payloads. That covers the parts most likely to be
*silently* wrong, as opposed to failing to compile:

- every level parsed out of a real response body, including fractional and
  negative-exponent values;
- `pin_strike: null` treated as absent, in both document orderings, and never
  confused with the `pin_strike_reason` key that shares its prefix;
- a 401 body yielding nothing rather than zeros;
- `null` / `true` / a quoted string / a lone `-` all rejected;
- the hand-rolled parser agreeing with `strtod` to 1e-9 relative on sixteen
  representative values in the C locale;
- every poll interval from 1s to 120s measuring exactly, which is the check
  that caught the truncation bug described below.

The harness is not committed — it stubs a vendor type it cannot ship — but it
is a dozen lines to rebuild from this description if the parsing is ever
touched again.

## Monetization model

Identical to NinjaTrader: **the download is gated at Pro; the data is gated
again by the API key.**

- The study calls `GET {ApiBaseUrl}/api/v1/levels/{Symbol}?strikes=1&api_key=<key>`.
- That endpoint is `gex`-scoped and returns only **derived** analytics — never
  raw per-contract quotes.
- Revoking the key kills the integration instantly; usage is metered per-key.
- A Pro member self-serves the key at **Account → API Access**, minted with
  tier `signals` (a superset of `analytics`), so no hand-provisioning.

`PlotOnSierraChart.tsx` renders no download link at all below Pro — the gate is
the absence of the anchor, not an intercepted click, because an `<a href>` to
the `.cpp` is a right-click away from being saved regardless of `onClick`. It
is fail-closed for the same reason as its NinjaTrader sibling: the gamma-levels
pages are prerendered with no session, so the locked state is what the static
HTML and the first client paint show, and it unlocks only once
`/api/auth/session` confirms Pro.

## The API key travels in the query string

This is the one place this integration differs from NinjaTrader, and it is a
deliberate, bounded trade.

**Why.** The ACSIL HTTP call that is portable across Sierra Chart versions is
`sc.MakeHTTPRequest(URL)` — a bare GET with no way to attach request headers.
A header-only endpoint is therefore not reachable from Sierra Chart at all. So
`/api/v1/levels` (and its v2 mirror) accept `?api_key=` in addition to
`Authorization: Bearer` and `X-API-Key`.

**The cost.** A credential in a URL is materially weaker than one in a header:
proxies in the path see it, access logs record it by default, and it rides
along in `Referer` on a redirect.

**What bounds it** (all in `zerogex-oa`):

- `_QUERY_KEY_PATH_PREFIXES` in `src/api/security.py` allowlists **only**
  `/api/v1/levels` and `/api/v2/levels`. Everything else — raw quotes, flow,
  the key-administration surface — rejects a query-string credential outright.
  `tests/test_api_query_key_auth.py` pins both the behavior and the contents
  of that list, so widening it to `/api` fails the suite.
- Headers still win when both are present, so a caller that can send one is
  never downgraded because a stale URL still carries the parameter.
- nginx logs the request line through a scrubbing `log_format` that rewrites
  `api_key=…` to `api_key=REDACTED`
  (`deploy/steps/120.nginx_api`, applied in both the bootstrap and TLS server
  blocks). The rest of the query string is kept, since symbol and strikes are
  what make the log worth having. This is the same class of problem already
  handled for `/ws`, whose ticket JWT rides in `?ticket=` and which turns
  `access_log` off entirely.
- uvicorn already runs with `--no-access-log`, so nginx was the only exposure.
- nginx's `proxy_cache_key` includes `$request_uri`, so the key is part of the
  cache key and a cached response from one credential is never served to
  another.

The endpoint's entire response is derived, redistributable analytics, which is
what makes the trade acceptable here and nowhere else.

## It is not a port of the NinjaTrader indicator

Same *job*, deliberately smaller *scope*. Both poll the same endpoint on a
timer and draw dealer-positioning levels that maintain themselves, and both are
gated the same way. What Sierra Chart does **not** carry:

| | NinjaTrader 8 | Sierra Chart |
| --- | --- | --- |
| Gamma Flip, Call Wall, Put Wall, Max Pain, Pin Strike | yes | yes |
| GEX 1..N (top gamma strikes) | yes, count configurable | no |
| Session VWAP | yes | no — Sierra Chart has a better native one |
| Per-strike gamma histogram | yes, width/thickness/strike-count configurable | no |
| Per-level show/hide toggles | 8 inputs | native Subgraphs tab |
| Line width, label offset, label edge distance | 4 style inputs | native Subgraphs tab |
| Request size | `strikes=` follows the histogram setting | always `strikes=1` |

Two different reasons for the gaps. The style and show/hide inputs are absent
because Sierra Chart already gives every subgraph its own controls — replicating
them as study inputs would be worse than the native UI, not better. VWAP is
absent for the same reason: Sierra Chart ships one.

The histogram and the GEX 1..N ranks are the real functional difference, and
they are absent because they need chart-space drawing rather than horizontal
lines — the NinjaTrader version pins the histogram to the left edge of the
chart window and redraws it as bars form, which is `s_UseTool`-class work in
ACSIL and exactly the version-sensitive surface this file was written to avoid
until it has been compiled once against a real install. They are the obvious
second pass, and `strikes=1` in the request is the only thing that would need
to change on the wire.

## Files

| File | Purpose |
| --- | --- |
| `frontend/public/sierrachart/ZeroGexGammaLevels.cpp` | The study source. Served hashed; see cache-busting below. |
| `frontend/components/PlotOnSierraChart.tsx` | The Pro-gated "Plot these levels on Sierra Chart" section. |
| `frontend/app/sierra-chart-indicator/page.tsx` | The landing page. |

## Design notes

**Subgraphs, not drawing tools.** Each level is a subgraph with the same value
written across every element, which is what makes it a horizontal line. This
was chosen over `s_UseTool` / `DRAWING_HORIZONTALLINE` for two reasons: it uses
a smaller and more stable slice of ACSIL, and it integrates better — the values
show in the Values Window, users can restyle or hide each line from the
Subgraphs tab, and other studies, spreadsheet studies and alert conditions can
reference them.

**Null levels flip to `DRAWSTYLE_IGNORE`** rather than being written as zeros.
The v1 contract is explicit that a null level means "could not resolve, hide
it" — and a Put Wall drawn at 0 would flatten the chart's price scale.

**The poll clock counts seconds from a fixed offset.** `SCDateTime` counts days
from 1899-12-30, so "now" is around 46,000, and 46,000 × 86,400 overflows a
signed 32-bit int. Counting from day 40,000 keeps it in range past 2090 while
staying exact to the second. Storing days in a persistent *float* instead would
have quantized the clock to about five minutes and broken every refresh
interval shorter than that.

**`sc.UpdateAlways = 1`** so polling does not stall on a quiet chart — which is
exactly when a stale Gamma Flip is most misleading. A separate redraw pass
re-stamps the current snapshot across new bars as the chart grows, because a
horizontal line that stops short of the right-hand edge reads as a level that
ended.

**`strikes=1`** on the request: this study draws lines and no histogram, so the
default 40-strike profile would move roughly forty times the bytes per poll for
data nothing reads.

**A 401 body is JSON too** (`{"detail":"Invalid or missing API key"}`), so it
parses cleanly and yields no levels — which would otherwise look like "the API
has no data today" rather than "your key is wrong". The study checks for the
absence of a `"levels"` key and names that case explicitly in the message log.

**Numbers are parsed by hand, not with `strtod`.** `strtod` honors
`LC_NUMERIC`, and on an install whose locale uses a comma as the decimal
separator it stops at the `.` — turning `5950.25` into `5950` and drawing a
level that is silently, plausibly wrong. Sierra Chart has a large European user
base and a wrong line on a chart is worse than a missing one, so the parse
follows the JSON grammar directly, which always uses `.` wherever the machine
is.

**The poll interval floors at 30s at runtime**, matching the NinjaTrader
indicator against the same endpoint. `SetIntLimits` governs only what can be
typed into the settings dialog; a chartbook saved with a smaller number, or a
`.cht` passed between traders, carries it straight past. That is the same
lesson the NinjaTrader indicator's `[Range]` attribute learned — the input
bound catches typing, the runtime clamp is the policy.

**Two failure modes that would otherwise be silent** are handled explicitly.
An outstanding request is abandoned after 30s, because the in-flight flag is
otherwise a one-way latch and a single lost response would stop the study
permanently while it kept showing hours-old levels as though they were current.
And a subgraph array that comes back zeroed — which Sierra Chart does on a full
recalculation, i.e. a timeframe change, symbol change, or history load — is
treated as "the snapshot is gone" and triggers an immediate re-fetch, rather
than being stamped across the chart as a line at zero that would collapse the
price scale.

## Install (what the page tells users)

1. Generate the key at **Account → API Access** (revealed once).
2. Copy the `.cpp` into Sierra Chart's `ACS_Source` folder, then
   **Analysis → Build Custom Studies DLL → Build**. Sierra Chart ships its own
   compiler, so there is no toolchain to install.
3. **Analysis → Studies → Add Custom Study → "ZeroGEX Gamma Levels"**, paste
   the key into *ZeroGEX API Key*, set *Symbol* to match the chart.

## Cache-busting

Content-addressed by `scripts/integration-assets-manifest.js` into
`frontend/core/integrationAssets.ts` (committed). Re-run `make integration-assets`
after editing the study and commit the manifest;
`tests/integrationAssets.test.ts` fails if you forget.
