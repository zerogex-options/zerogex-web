# ZeroGEX Daily Gamma Levels — thinkorswim study

A free, manual-entry thinkScript study that plots the daily ZeroGEX
dealer-positioning levels (Gamma Flip, Call Wall, Put Wall, Max Pain) as
horizontal lines on any thinkorswim chart. Same role as the TradingView script
— a **discovery funnel**, not a data integration:

> Google / thinkorswim community search → free study → daily levels page → dashboard trial

It is the second free integration, and it exists because thinkorswim is where a
large share of retail options traders already are: they are on Schwab, they are
looking at the option chain in the next tab, and asking them to move to
TradingView to see a gamma flip is asking too much.

See `docs/integrations.md` for how this fits with the other three.

## Why it is manual-entry

thinkScript runs sandboxed inside thinkorswim and has **no network access of
any kind**. There is no HTTP call, no file read, no external data source — the
language reaches only the market and fundamental data thinkorswim itself
provides. So no study on that platform can fetch live levels, and this is not a
limitation of ours to engineer around.

That also means there is nothing here to gate. The study is inert without
numbers, and the numbers are published free on the gamma-levels pages, so
gating the source would protect nothing and cost the funnel. Contrast
`docs/ninjatrader-indicator.md`, where the download **is** gated because the
data behind it is.

## Files

| File | Purpose |
| --- | --- |
| `frontend/public/thinkorswim/zerogex-daily-gamma-levels.thinkscript` | The source of record. Served hashed (see below) and copied to the clipboard by the page. |
| `frontend/components/PlotOnThinkorswim.tsx` | The "Plot these levels on thinkorswim" section, rendered standalone on `/thinkorswim-indicator`. |
| `frontend/app/thinkorswim-indicator/page.tsx` | The landing page. |

### The `.thinkscript` extension is load-bearing

thinkorswim exports studies as `.ts`. We deliberately do **not** use that
extension: `frontend/tsconfig.json` has `"include": ["**/*.ts"]` with only
`node_modules` excluded, so a thinkScript file under `public/` would be handed
to the TypeScript compiler and fail the build with a wall of syntax errors
pointing at a file nobody thinks of as TypeScript.

The download button restores the familiar name via `download="ZeroGEX_Daily_Gamma_Levels.ts"`,
so what lands in the user's Downloads folder is what they expect.
`tests/integrationAssets.test.ts` pins the stored extension.

## The copy button hands over TODAY'S levels, not a blank template

This is the only automation thinkScript allows, and it is what every vendor
shipping GEX levels to thinkorswim does — [Trading Volatility][tv] generates a
script you paste over your study, and [GEX Levels][gl] is explicit that there
is no auto-update and you re-paste to refresh. Typing four numbers into a
settings dialog was the part people dropped out on, and the part they had to
redo every morning.

[tv]: https://stocks.tradingvolatility.net/blog/export-multi-gex-levels-tos
[gl]: https://gex-levels.com/blog/thinkorswim-gamma-levels

`core/thinkorswimStudy.ts` rewrites the `input` DEFAULTS in the tracked
template rather than assembling a second copy of the script, so there is still
exactly one source of record and a filled study cannot drift from the blank
one. Three details in there are load-bearing:

- **A whole-number level still emits a decimal point.** thinkScript infers an
  input's TYPE from its default, so `input callWall = 6100;` produces an
  *integer* input that then refuses a fractional value when the user edits it.
  `6100.0` keeps it a double.
- **An unresolved level is left at `0.0`**, the study's hide-this-level
  sentinel — so a partial snapshot draws what it has rather than a line at zero.
- **The date is rendered in ET.** Market data is ET-dated; 03:30 UTC is still
  the previous evening in New York, and a study labelled with tomorrow's date
  reads as levels the user has not seen.

Each surface passes the snapshot it already has, so what gets copied is what
the reader is looking at:

| Surface | Levels |
| --- | --- |
| `/spx-`, `/spy-`, `/qqq-`, `/ndx-`, `/es-`, `/nq-gamma-levels` | that page's own ticker, from the same `primaryData` its cards render |
| `/thinkorswim-indicator` | SPX, fetched server-side at 900s to match the gamma pages |

When the fetch fails, `hasAnyLevel()` is false and the section falls back to
the blank template **and says so** — rather than promising today's numbers and
handing over four zeros. That fallback is also monitored: the split between the
`copy_prefilled` and `copy` telemetry actions is a passive alarm on the levels
fetch, since a rising share of plain `copy` means the snapshot is unavailable
well before anyone reports a blank study.

## Delivery: copy first, download second

TradingView hosts our published script, so that page just links to it. There is
no equivalent public library on thinkorswim that a stranger can install from —
sharing a study means handing over the source and having the recipient paste it
into the Study Editor. So `PlotOnThinkorswim` leads with a **Copy the study**
button and offers the file as the secondary path.

The copy button fetches the source rather than inlining it into the bundle: it
is ~6KB of thinkScript that every visitor to a gamma-levels page would
otherwise download as part of the JS payload, to serve the few who click.

It tracks three states, not two — `idle | copied | failed`. Older Safari and
any non-secure context reject `navigator.clipboard` outright, and rendering
"Copied" there would send someone to the Study Editor to paste an empty buffer.
The failure state names the download link as the recovery path and does **not**
clear itself on a timer, so it is still on screen while the reader works out
what to do about it.

## What the study draws

- Four horizontal lines (Gamma Flip, Call Wall, Put Wall, Max Pain), each
  hidden when its input is left at `0` — the unset sentinel, not a price. An
  unset level plots `Double.NaN`, which thinkorswim draws as nothing at all, so
  it costs no chart space and no legend entry.
- A price chip per line, anchored on the last bar so there is one chip per
  level rather than one per bar.
- Info chips along the top of the chart.
- Four `Alert()` conditions on `close crosses <level>`, at `Alert.BAR` so they
  fire on bar close rather than on every tick — an intrabar wick across the
  Gamma Flip that closes back inside it is noise, not a regime change.

Colours are `DefineGlobalColor` globals rather than inputs, because thinkScript
has no colour input type; users recolour them under the study's **Globals**
section in Edit Studies.

Line **style and weight are deliberately not inputs.** thinkorswim already
gives every plot its own colour/weight/style controls under Edit Studies, so a
dropdown would have duplicated a native feature — and `SetStyle()` /
`SetLineWeight()` want a compile-time constant, so driving them from a computed
`def` (which is a *series* in thinkScript, not a constant) is a good way to
make the study fail to compile the first time someone pastes it.

Every string the platform **renders** — labels, bubbles, alert text — is plain
ASCII on purpose. The comments carry normal typography, but this file travels
by clipboard into a Java editor, and a mangled character in a comment is
invisible while a mangled one on someone's chart is not.

The study syncs to the user's thinkorswim account, so the paste is one-time and
it follows them across desktop, web, and mobile.

## Install (what the page tells users)

1. On a chart: **Studies → Edit Studies… → Create**.
2. Select everything in the editor and paste ours over it.
3. Name it "ZeroGEX Daily Gamma Levels", click OK, apply it.
4. Nothing to type — the levels are already in it. To refresh tomorrow, copy
   again and paste over the same study.

## Cache-busting

The source is content-addressed by `scripts/integration-assets-manifest.js`
into `frontend/core/integrationAssets.ts` (committed), for the same reason as
the NinjaTrader indicator: `public/` is served through a 4-hour Cloudflare
cache that `make deploy` never purges, so a fixed URL could hand someone the
previous build for hours after a fix shipped. Re-run `make integration-assets`
after editing the study and commit the manifest;
`tests/integrationAssets.test.ts` fails if you forget.
