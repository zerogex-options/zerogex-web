# ZeroGEX Gamma Levels for Bookmap

The Bookmap add-on: a Java plug-in that draws the ZeroGEX dealer-positioning
levels (call wall, put wall, gamma flip, max pain, pin strike) on a Bookmap
chart, keeps them current from the ZeroGEX API with the trader's Pro key, and
adds on-chart labels, a per-strike gamma profile, a status badge, and
Bookmap-native alerts.

The customer-facing page is `/bookmap-indicator`; product and rollout notes are
in `docs/bookmap-indicator.md`. This file is for whoever changes the code.

## Build

```bash
integrations/bookmap/build.sh            # compile, test, link-check, package build/zerogex-bookmap.jar
integrations/bookmap/build.sh --release  # ...and publish to frontend/public/bookmap/zerogex-bookmap.jar
integrations/bookmap/build.sh --check    # rebuild and fail unless it matches the published jar byte for byte
```

Needs JDK 17+ (21 to reproduce the published bytes exactly; the jar records
the JDK in its manifest) and, the first time, `maven.bookmap.com` to fetch
Bookmap's API jars into `.cache/`. Those are Bookmap's, pinned by SHA-256 in
`build.sh`, used only to compile against, and never committed or shipped:
Bookmap provides them at runtime. There are no other dependencies, in the
add-on or in its tests.

After `--release`: commit the jar, run `make integration-assets` (it hashes the
jar into a cache-busting URL and rewrites `frontend/core/integrationAssets.ts`),
and commit that too. `frontend/tests/bookmapAddon.test.ts` fails if the jar's
embedded source hash no longer matches `src/main/java`, i.e. a source was
edited without rebuilding.

## Compatibility

The bytecode is Java 8, because Bookmap 7.0 to 7.2 run on Java 8. `build.sh`
compiles the sources against five Bookmap API versions:

| Bookmap | Java | What runs |
| --- | --- | --- |
| 8.0, 7.9, 7.4 | 21 / 21 / 11 | everything |
| 7.2 | 8 | everything but Bookmap-native alerts (spoken alerts instead) |
| 7.0 | 8 | lines and settings; no labels/profile/badge, spoken alerts |

The optional parts are loaded by name (`ZeroGexLevels.createOverlay`,
`createAlerts`), so on an older Bookmap they fail to link in isolation and the
add-on carries on. The 5-argument `registerIndicatorModifiable` (7.2+) is
called reflectively for the same reason.

## Layout

| Package | What | Bookmap types? |
| --- | --- | --- |
| `core` | API client, JSON, symbol mapping, timelines, polling, engine, layout math, status wording | no |
| `overlay` | labels, markers, profile, badge: `OverlayLayout` (pure) and `ScreenOverlay` (Bookmap 7.2+ painter) | `ScreenOverlay` only |
| `alerts` | `DeclaredAlerts` (7.4+), `SpokenAlerts` (7.0+) | yes |
| `ui` | settings panels | `StrategyPanel` |
| root | `ZeroGexLevels` (the entry point), `IndicatorLines`, `Settings`, `KeyStore` | yes |

## How it works, briefly

- **Lines** are Bookmap *modifiable* indicators, which accept a point at any
  timestamp. That is what lets the add-on draw the session's history when it
  loads and redraw a past day in replay. Prices are divided by the tick size on
  the way in (`IndicatorLines`), the one place that conversion happens.
- **Timelines** (`core/Timelines`) hold every level as a step function and
  mirror into the lines. Every value goes where it became knowable: a live
  snapshot at its `computed_at`, a history bar at its end, the post-close book
  at the close. Nothing is ever drawn before it existed.
- **The engine** (`core/Engine`) runs on its own thread: the live levels first,
  then the session's history from `/api/gex/historical`, then the previous
  overnight's post-close book from `/api/gex/summary?delay_minutes=` (reachable
  for 24 hours; older overnights are left as gaps rather than guessed). A chart
  replaying a past day gets history only.
- **Polling** (`core/PollPlanner`) learns the analytics cycle from consecutive
  `computed_at` values and asks a few seconds after each one (about two
  requests a minute in session), backs off to every 15 minutes when the engine
  is idle, and wakes 40 seconds after the open.
- **The overlay** renders every image at exactly its on-screen pixel size, so
  nothing depends on how Bookmap scales textures, and only touches shapes whose
  image or position changed.

## Tests

`build.sh` runs them all (about 15 seconds). Two kinds:

- unit tests per class in `src/test/java/io/zerogex/bookmap/core` and `overlay`;
- `AddonEndToEndTest`: the real add-on against a fake Bookmap (proxies of
  Bookmap's own `Api` and `Layer1ApiProvider` interfaces, a recording canvas)
  and a local HTTP server standing in for api.zerogex.io. It loads, draws,
  raises an alert, changes settings, builds the settings panels and unloads,
  and writes preview images to `build/preview/` (a simulated heatmap with the
  add-on's real output on top) for a human to look at.

Two classes under `src/test/java/velox/...` are test-only stand-ins for
Bookmap runtime classes its public API jar leaves out (`LineStyle` and
`PreparedImage` need them). They are never packaged.

## What has not been verified here

Bookmap itself does not run in this toolchain, so the following were checked
against the API and its javadoc but not on screen in Bookmap. See the checklist
in `docs/bookmap-indicator.md` before announcing:

- that the overlay's images render upright (y1 = bottom, y2 = top, per the
  javadoc's "y increases upward") and at the right edge of the heatmap;
- that `Layer1ApiUserMessageModifyScreenSpacePainter` registered from a
  simplified-API module is picked up (Bookmap's forum says it is, and the
  simplified loader registers its own indicators the same way);
- alert sound and popup behavior.

## Releasing a change

1. Edit, then `integrations/bookmap/build.sh --release`.
2. Bump `ZeroGexLevels.VERSION` for anything a customer would notice.
3. `make integration-assets`, then commit the jar, the manifest and the source.
4. Re-run the on-screen checklist in `docs/bookmap-indicator.md` if the overlay
   or alerts changed.
