# NinjaTrader package slot

Drop a **genuine NinjaTrader 8 export** here as `ZeroGexGammaLevels.zip` and
`make ninjatrader-package` (run automatically by `make deploy`) publishes it to
`frontend/public/ninjatrader/`, where the gamma pages pick it up and offer a
one-click import alongside the `.cs` source.

Until that file exists, the deploy step no-ops with a warning and the site
offers the `.cs` only. Nothing breaks.

## Why this isn't generated

Only NinjaTrader can produce an archive its own importer accepts — the layout
and the `Info.xml` manifest inside are written by NT8's export routine. A
hand-rolled zip that fails to import is worse than no zip, because the download
button would be live and broken. So this is a slot, not a build step.

## How to produce it

1. Compile `frontend/public/ninjatrader/ZeroGexGammaLevels.cs` in the
   NinjaScript Editor (F5) and confirm it draws against a live key.
2. **File → Utilities → Export NinjaScript…**
3. Select the **ZeroGEX Gamma Levels** indicator, export it, and save the
   resulting archive here as `ZeroGexGammaLevels.zip`.
4. Verify the round trip on a clean machine or a second NT8 install:
   **File → Utilities → Import NinjaScript…** and confirm it imports and draws.
5. Commit it, then deploy.

Re-export whenever the `.cs` changes — the archive embeds a copy of the source,
so a stale zip silently ships an old indicator.
