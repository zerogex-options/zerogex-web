# ZeroGEX Gamma Levels — Bookmap add-on

An **auto-updating** Bookmap add-on that draws the ZeroGEX dealer-positioning
levels (Gamma Flip, Call Wall, Put Wall, Max Pain, Pin Strike) on the Bookmap
heatmap and keeps them current from the ZeroGEX API. The third Pro chart
integration, on the same terms as the NinjaTrader indicator and the Sierra
Chart study (see `docs/integrations.md`).

It exists because Bookmap is where order-flow futures scalpers live. The
levels say where dealer hedging is heaviest; Bookmap shows what the book does
when price gets there. A cancelling Pro member (Corey, Nov 2026: "primarily a
futures scalper, I use a lot of Bookmap") is the request that started it.

Source and maintainer notes: `integrations/bookmap/README.md`. Customer page:
`/bookmap-indicator`.

## What it does that the other studies don't

| | NinjaTrader 8 | Sierra Chart | Bookmap |
| --- | --- | --- | --- |
| Five headline levels | yes | yes | yes |
| History before the chart opened | no | no | yes: the session, the previous sessions the chart shows, and last night's post-close book |
| Replay of a past day | no | no | yes: that day's levels, never today's |
| Labels | right margin, folded and stacked | subgraph names | right edge, folded and stacked, pinned to price |
| Levels off-screen | hidden | hidden | edge markers with distance from price |
| Per-strike gamma profile | optional | no | on by default, gold/violet |
| Regime and health in view | info panel | message log | badge: LONG/SHORT Γ, live / closed / not updating, with why |
| Alerts | price-cross | no | Bookmap-native: once per touch, spoken + popup |
| Symbol | AUTO from the chart | typed | AUTO across Rithmic, CQG, dxFeed and other namings, micros mapped |
| Contract-month check | no | no | warns when the chart and the levels are on different contracts |
| Key | per chart | per chart | once per computer, for every chart |
| Polling | fixed timer, 30 s floor | fixed timer | timed to the analytics cycle (~2/min in session, every 15 min closed) |

## Monetization

Identical to its siblings: **the download is gated at Pro, and the data is
gated again by the API key.** `PlotOnBookmap.tsx` renders no link to the jar
below Pro (fail-closed, prerendered locked). The add-on calls, with
`Authorization: Bearer <key>`:

- `GET /api/v1/levels/{symbol}` — the live levels and profile (`gex` scope);
- `GET /api/gex/historical` — the session's levels by minute (`gex` scope);
- `GET /api/gex/summary?delay_minutes=` — the post-close book for last night.

A Pro member's self-serve key (tier `signals`) covers all three. No server
change was needed. The key never goes in a URL.

## Files

| File | Purpose |
| --- | --- |
| `integrations/bookmap/` | Java source, tests, `build.sh`. See its README. |
| `frontend/public/bookmap/zerogex-bookmap.jar` | The published add-on, committed. Served hashed via `core/integrationAssets.ts`. |
| `frontend/components/PlotOnBookmap.tsx` | The Pro-gated section: what it does, download, three install steps. |
| `frontend/app/bookmap-indicator/page.tsx` | The landing. |
| `frontend/tests/bookmapAddon.test.ts` | Fails if the jar is older than its Java source, or not Java 8 bytecode. |
| `Makefile` → `bookmap-addon` | Rebuild + publish the jar (development only; not part of deploy). |

## Install (what the page tells users)

1. Generate the key at **Account → API Access** (revealed once).
2. In Bookmap: **Settings → Configure add-ons** (an Add-ons menu on some
   versions) → **Add** → the downloaded `.jar` → **ZeroGEX Gamma Levels**.
3. Enable it for the instrument, open its settings, paste the key, **Save key**.
   The key is stored once for every chart (Java Preferences: the user's
   registry hive on Windows, a plist on macOS); the symbol is read from the
   chart.

## Before announcing: check it once in a real Bookmap

Everything below was built and tested against Bookmap's published API (7.0
through 8.0), with an end-to-end test that runs the real add-on against a fake
Bookmap and a local stand-in for the API. Bookmap itself cannot run in that
toolchain, so these five things have only been checked against the API's
documentation, not on a screen. Ten minutes on any machine with Bookmap 7.2 or
later and a Pro key:

1. **It loads.** Settings → Configure add-ons → Add → the jar. "ZeroGEX Gamma
   Levels" appears; enable it on an ES (or MES) chart. Expected: five lines
   named "ZeroGEX ..." in Bookmap's indicator list.
2. **Key and status.** Open its settings, paste the key, Save key. The Status
   line should go to "Live · updated Ns ago" (in session) or "Market closed -
   levels as of ..." (evening). Click **Copy diagnostics** and keep the text.
3. **Labels read upright, at the right edge, on their lines.** If text is
   upside down, the canvas's y1/y2 are the other way round in this Bookmap
   build: swap `bottom(s)`/`top(s)` in `ScreenOverlay.render` (a two-line fix).
   If labels sit at the far left, `onHeatmapFullPixelsWidth` is not the width
   we think: send the diagnostics and a screenshot.
4. **History.** Scroll left: the lines should run back to the session open
   (and through last night, if the chart has it), stepping where a wall moved.
5. **Zoom in tight.** Off-screen walls should become markers at the top/bottom
   edge with "+/-" distances; the profile bars sit on the strikes.

Optional: turn on alerts with 2 ticks and wait for price to touch a level; a
Bookmap popup should read "ZeroGEX: ES within ... of Put Wall ...".

If 1 to 5 pass, announce. If 3 or 5 fail, the lines (the core) still work:
the trader can turn off Labels and Profile in settings while it is fixed.

## Known limits

- **Pin Strike has no history.** The history endpoint does not carry it, so
  the pin is drawn from the moments the add-on saw it live.
- **Overnights older than a day are gaps.** The post-close book (expired
  contracts removed) is only reachable through the delayed summary, which the
  API caps at 24 hours. Drawing the 3:59 PM levels instead would show walls
  built partly from contracts that had already expired.
- **0DTE scope draws live only.** History is whole-chain.
- **Overlay geometry on HiDPI screens is unverified.** If labels look small,
  the Label size setting goes up to Extra large.
- **No Bookmap Marketplace listing.** It is a manual jar install, like any
  third-party add-on. Listing it in Bookmap's Add-ons Manager is a separate
  application to Bookmap, worth doing once the on-screen check passes.

---

For informational and educational purposes only. Not financial advice.
Options trading involves significant risk.
