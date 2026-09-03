# NinjaTrader package slot

`ZeroGexGammaLevels.zip` here is a **genuine NinjaTrader 8 export**.
`make ninjatrader-package` (run by `make deploy`) verifies it against the
source of record and then publishes it to `frontend/public/ninjatrader/`,
where the gamma pages offer it as a one-click import alongside the `.cs`.

If the file is absent the deploy step no-ops with a warning and the pages
offer the `.cs` only. Nothing breaks.

## Why this isn't generated

Only NinjaTrader can produce an archive its own importer accepts. This is what
its export actually contains — measured from a real one, not guessed:

```
Indicators\<name>.cs     the source you pasted in: CRLF, UTF-8 BOM, and with
                         a "#region NinjaScript generated code" block appended
                         holding the factory overloads NinjaTrader derives from
                         the [NinjaScriptProperty] members
Info.xml                 tiny manifest (<Version>, <Agile>); its presence is
                         what makes the archive importable
```

Note the backslash separator, and that the `.cs` is named after whatever the
indicator was called in the editor — not after our filename.

## Verification

`scripts/verify-ninjatrader-package.py` runs before the copy and **fails the
deploy** if the archive doesn't match. It exists because the export is built on
someone else's machine and then served from our domain, so "we trust whoever
sent it" is not good enough for a public download. It rejects:

- source inside the archive that differs from
  `frontend/public/ninjatrader/ZeroGexGammaLevels.cs` (after normalizing BOM
  and CRLF), which covers both tampering and the duller case — a **stale**
  archive exported before the last edit to the `.cs`
- a missing `Info.xml`, which NinjaTrader would refuse to import
- constructs in the generated tail that NinjaTrader never emits (`HttpClient`,
  `Process`, `DllImport`, …)

Its limit, stated plainly: the generated tail is compiled too, and the script
only tripwires it — it does not prove it benign. It prints the tail's hash so a
reviewer can eyeball or pin it. Read the tail once whenever the
`[NinjaScriptProperty]` set changes, since that is when it legitimately moves.

Run it by hand any time:

```
python3 scripts/verify-ninjatrader-package.py \
  assets/ninjatrader/ZeroGexGammaLevels.zip \
  frontend/public/ninjatrader/ZeroGexGammaLevels.cs
```

## Producing a new one

**Re-export whenever the `.cs` changes** — the archive embeds a copy of the
source, so a stale zip ships an old indicator. The verifier will catch it, but
catching it during a deploy is later than catching it now.

1. Compile `frontend/public/ninjatrader/ZeroGexGammaLevels.cs` in the
   NinjaScript Editor (F5) and confirm it draws against a live key.
2. **File → Utilities → Export NinjaScript…**, select **ZeroGEX Gamma Levels**.
3. Save the archive here as `ZeroGexGammaLevels.zip`.
4. Run the verifier above; it must pass.
5. Verify the round trip on a clean NT8 install:
   **File → Utilities → Import NinjaScript…**
6. Commit it, then deploy.
