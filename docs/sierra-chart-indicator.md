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

**Compiled, but not yet inside a real Sierra Chart install.** On 2026-11-10 the
study was built with MinGW GCC 13 using the exact command Sierra Chart
publishes for its recommended **Remote Build**
(sierrachart.com, "Advanced Custom Study Interface and Language"), against
three header sets:

- third-party GitHub copies of the ACSIL headers at versions 2784 and 2927;
- the 2927 copy with the two ACSIL changes Sierra Chart's What's New lists for
  2962 (subgraph arrays become `double`) and 2969 (`sc.FreeDLL` removed), to
  stand in for the current release.

It builds with zero errors and zero warnings from the study under
`-Wall -Wextra` on all three, and did again after the `DrawStyle` fix below
(the one new ACSIL member, `sc.StorageBlock`, is in all three header sets).
Every ACSIL identifier it uses was checked
against the sierrachart.com reference and the headers. The four names this
section used to flag as doubtful (`sc.CurrentSystemDateTime.GetAsDouble()`,
the two `ACSIL_HTTP_*_TEXT` sentinels, `Get`/`SetPersistentInt`, and the
SCString calls) are all correct.

**The first build in a real install is still the final confirmation.** The
current headers aren't published outside the install, and What's New is not a
complete changelog.

### Fixed 2026-11-10 (the version first served did not build or refresh)

- **`sc.FreeDLL = 0;` removed.** Sierra Chart removed the member in 2969
  (2026-10-09), so the study as first published failed to build on any current
  install (`'struct s_sc' has no member named 'FreeDLL'`).
- **The levels froze after the first load.** `sc.HTTPResponse` is emptied only
  when the next `sc.MakeHTTPRequest` goes out, not after the call that
  delivers it. The study tested the response alone, so it re-read the same
  body on every update and never polled again. The response branch now also
  requires `P_REQUEST_IN_FLIGHT`, as Sierra Chart's own example does with its
  request state.
- **An HTTP error status arrives as the literal `"ERROR"`,** not the JSON body,
  so a rejected key (401) or unknown symbol (404) used to log the misleading
  "symbol may not be covered" message. It now names both likely causes. The
  JSON 401 check is kept in case a version passes the body through.
- **A request that fails to start** (`sc.MakeHTTPRequest` returns 0, for
  example while a timed-out one is still outstanding, since only one request
  may run at a time) used to retry on every update and open the Message Log
  each time. It now waits a full refresh interval.

### Fixed 2026-11-10: line styles and hides now stick

`ApplyLevel` used to set `DrawStyle = DRAWSTYLE_LINE` on every successful poll.
That turned the dashed Max Pain and Pin Strike solid after the first load and
undid any style picked on the Subgraphs tab within a minute, including hiding a
level, which contradicted the "restyle or hide from the Subgraphs tab" copy.

The study now touches `DrawStyle` only for a level the API returns as null:

- **On null**, it remembers the level's current style and hides it with
  `DRAWSTYLE_IGNORE`. It also writes zeros, ACSIL's "no value", so a
  spreadsheet study or alert never reads a level the API no longer reports. A
  level that is already hidden keeps its style untouched.
- **When the value returns**, it puts the remembered style back, unless the
  user picked a different one in the meantime.
- **Otherwise** it only writes the values, including into a level the user
  hid, so alerts and spreadsheet studies that reference it stay current.

The remembered style lives in `sc.StorageBlock`, not a persistent variable.
Sierra Chart resets persistent variables to 0 whenever a chartbook is opened,
but the `DRAWSTYLE_IGNORE` the study set is a study setting and is saved with
the chartbook. With a persistent variable, a level that was null when the
chartbook was saved would reopen hidden and stay hidden for good. The storage
block is saved with the chartbook too. The study writes a marker before
trusting it, since the docs don't promise it starts zeroed, and falls back to
persistent ints 5 to 9 if the pointer is ever null.

The redraw pass that extends levels across new bars now extends user-hidden
levels too, and skips any hidden level that holds zeros instead of treating it
as "re-fetch". A null level stays zero through any number of fetches, so
re-fetching on it would loop on every update.

Two edge cases are left as they are:

- A level the study has hidden for null looks the same as one the user hid.
  Choosing "Ignore" for it at that moment changes nothing, so it comes back with
  its value. To hide a level for good, hide it while it is showing.
- A chartbook saved by the earlier build while a level was hidden for null
  keeps that level hidden, since that build left no note. Set its Draw Style
  back on the Subgraphs tab once.

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

The `DrawStyle` fix was tested one level up. The whole `.cpp`, unmodified, was
compiled against a stand-in for the slice of ACSIL it uses (subgraphs with
`double` arrays, inputs, persistent ints, `sc.StorageBlock`,
`sc.MakeHTTPRequest`) under AddressSanitizer and UBSan, and driven through 12
scenarios, 86 checks. The file before the fix fails 24 of them. They cover:

- dashed Max Pain and Pin Strike, and a user's restyle or hide, kept across
  polls;
- a null level hidden and zeroed, then restored to its dashed style when the
  value returns, including after a chartbook reopen;
- no re-fetch loop while a level is null, user-hidden, or both, across new
  bars and full recalculations, and exactly one re-fetch after a recalculation
  that zeroes visible levels;
- a user's newer style winning over the remembered one;
- leftover bytes in a fresh storage block never read as a saved style.

Like the parsing harness, it is not committed.

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

**Null levels are hidden with `DRAWSTYLE_IGNORE`, and their style comes back
with the value.** The v1 contract is explicit that a null level means "could
not resolve, hide it" — and a Put Wall drawn at 0 would flatten the chart's
price scale. Apart from that, `DrawStyle` belongs to the user; see "Fixed
2026-11-10: line styles and hides now stick" above.

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
price scale. That applies to visible levels only. A hidden level holding zeros
is a null level, or a user-hidden one waiting for the next poll, and
re-fetching on it would loop.

## Install (what the page tells users)

1. Generate the key at **Account → API Access** (revealed once).
2. Copy the `.cpp` into Sierra Chart's `ACS_Source` folder, then
   **Analysis → Build Custom Studies DLL**, then **Build → Remote Build**.
   Sierra Chart compiles it on its own server, so there is no toolchain to
   install.
3. **Analysis → Studies → Add Custom Study → "ZeroGEX Gamma Levels"**, paste
   the key into *ZeroGEX API Key*, set *Symbol* to match the chart.

## Cache-busting

Content-addressed by `scripts/integration-assets-manifest.js` into
`frontend/core/integrationAssets.ts` (committed). Re-run `make integration-assets`
after editing the study and commit the manifest;
`tests/integrationAssets.test.ts` fails if you forget.
