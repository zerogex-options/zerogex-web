# NQ gamma flip blank on NinjaTrader: Sulby (2026-09-28)

Sulby Sare wrote to Support at 10:26 AM, subject "Don't show gamma flip", with a
NinjaTrader screenshot:

> Hello!
>
> ZeroGEX hasn't been showing me the gamma flip for a week

The screenshot is an NQ DEC26 5-minute chart. The indicator panel reads
`Flip —`, every other level is populated, it says `updated 18s ago`, and the
build stamp is **v1.6**.

A 1:1 founder reply from your own inbox. American English, one line per
paragraph in the draft, so it pastes straight into a mail client.

> **Status:** sent 2026-09-28. The same afternoon the NDX horizon override
> went live in production after a replay check; see "Follow-up" at the end.
> The first version of this file said the August NDX blackout was the same
> weighting bug, and that production's setting couldn't be seen from here. The
> replay contradicts the first claim on every blackout day it sampled, and the
> second is now known: production was not running the override. Both are
> corrected below.

## The read

- **Not a fault. The NDX flip has been more than 8% from spot for a week.** NQ
  has no chain of its own (`core/symbols.ts`). Its levels are the NDX book moved
  onto the NQ axis, so a blank NQ flip means NDX declined to publish one. The
  public replay pages give the per-minute record:

  | Session | Flip published | Where it sat when published |
  | --- | --- | --- |
  | Thu 9/17 | 268 of 389 min (69%) | 1.7–3.6% below spot |
  | Fri 9/18 (quarterly expiration) | 390 of 390 (100%) | 0.8–2.1% below |
  | Mon 9/21 | 0 of 390 | – |
  | Tue 9/22 | 14 of 390 (11:31–11:44 ET) | 7.4–7.5% below |
  | Wed 9/23 | 0 of 383 | – |
  | Thu 9/24 | 0 of 390 | – |
  | Fri 9/25 | 132 of 390 (9:30–10:21, 12:36–13:55 ET) | 3.8–7.2% below, median 7.0% |

  Across 9/21–9/25 that is 146 of 1,943 minutes, 7.5%. At 10:40 ET today the
  public NQ and NDX pages still read "Gamma Flip Unresolved", with NDX modeled
  at +$2.28B long gamma.

- **Cause: the September quarterly expiration.** After Friday 9/18 the book was
  3.16 calls per put, and NDX rallied about 4% (≈29,500 → ≈30,600 by Tuesday).
  Under the modeled convention (dealers long calls, short puts), a call-heavy
  book is long gamma across the whole band around spot. So the zero crossing of
  the spot-shift profile sits far below the market. The engine's own
  diagnostics put it 12–37% below spot Monday through Wednesday (zerogex-oa
  `5be61f4`, `55ab30d`). The resolver will not publish a crossing more than 8%
  from spot (`max_flip_distance_pct`, `default` profile in `src/config.py`), so
  it persists NULL with reason `BEYOND_MAX_DISTANCE`. The few published
  stretches sat at about 7%, right at that line. The flip shows up when the
  crossing drifts inside 8% and disappears when it drifts back out.

- **Mon–Wed is the market, not the NDX weighting bug.** `gamma_flip_raw` is the
  same cycle's crossing with no DTE weighting and no gates, over the same ±50%
  window. It sat 12–37% from spot on those days (session medians 27–35%).
  Replaying 9/23 at the 1-day horizon confirmed it: still blank (see
  Follow-up). Thursday and Friday have no stored diagnosis in the repo.
  Friday's pattern (on and off at about 7% below) fits the same regime.

- **Why NDX rather than SPX.** NDX runs about 76% of its open interest in 0DTE;
  SPX runs about 12%. The flip is a multi-day level, so same-day contracts are
  down-weighted out of it. That leaves NDX's flip resting on a thin multi-day
  book, and one quarterly expiration can reshape that book overnight. NDX is the
  more fragile chain, but it is not permanently blank: the week before, it
  published 69% and 100% of the time.

- **Sept 17's flicker was ours; the August blackout is unexplained.** The NDX
  flip was blank almost every session from Aug 3 to Sep 11, and 31% of Sept 17.
  The Sept 20 investigation diagnosed Sept 17: the shared 2-day horizon
  discounted most of NDX's book, so crossings close to spot went unpublished
  (2.8% below spot that day). Its fix is `GAMMA_PROFILE_DTE_REF_DAYS_NDX=1`. It
  also blamed the August stretch on the same cause. The 2026-09-28 replay
  contradicts that on the three blackout days it sampled: the blank minutes on
  8/12, 8/26 and 9/9 stay blank at both 1 and 2 days. Production had not been running the override (its
  `.env` held only the shared `GAMMA_PROFILE_DTE_REF_DAYS=2.0`); it went live on
  2026-09-28. The v1.6 zip went up on Aug 29, so Sulby may have seen the
  August blanks too. The draft doesn't raise them, because the complaint is
  about last week.

- **Sulby's build is seven versions old.** v1.6 draws an em dash for every
  blank. v2.3 (`4a1e08a`, 2026-09-20) draws the server's `gamma_flip_label`
  instead, which read `Flip >8%↓` for most of last week. Production's
  `/api/v1/levels` schema already carries the label, and it passes through the
  NQ projection untouched, because it is neither a price field nor a narrative
  field. The class name is unchanged and all 21 v1.6
  settings still exist in v2.3 (it adds label size and bold), so pasting over
  the old file keeps the key and symbol.

- **Upgrade trap: don't send Sulby to the .zip.** The v1.5 and v1.6 zips
  installed the indicator as `Indicators\zerogex.cs`. The zip served today
  installs it as `Indicators\EDQUANTGAMMA.cs`. Importing the new zip next to an
  old install defines `ZeroGexGammaLevels` twice, NinjaTrader can't compile
  that, and the import fails. The draft sends Sulby to the `.cs` and a paste-over
  instead. The "Grab the .cs" link only renders for a signed-in Pro account,
  hence the fallback line.

## Verify first

Nothing blocks sending. Everything in the draft comes from the public replay
pages, the live NQ page this morning, and the engine's recorded diagnostics.

Optional, on the box, if you want Thursday and Friday's stored reason codes:

```
cd ~/zerogex-oa && make gamma-flip-resolution-healthcheck SYMBOLS=NDX FLIP_SINCE=2026-09-17 BY_DATE=1
```

## Draft (sent 2026-09-28)

**Subject:** Re: Don't show gamma flip

Hi Sulby,

Thanks for the screenshot, it made this quick to pin down. Nothing is broken on your end: the indicator is updating fine, and every other level on that panel is live. For the past week there simply hasn't been a gamma flip close enough to the market for us to draw.

Some background on where the NQ flip comes from. NQ has no options of its own, so ZeroGEX builds its levels from the NDX options and converts them to NQ prices. The flip is the price where dealers' modeled gamma changes from positive to negative. We find it by re-pricing the whole NDX options chain at a range of hypothetical prices and looking for the point where that total crosses zero. We only draw it when the crossing is within 8% of the current price, which on NQ is about 2,400 points. A level further away than that isn't useful for trading.

Here's what happened. The September quarterly expiration on the 18th reset the NDX options book, and NDX rallied about 4% into the new week. What was left is heavily weighted to calls, roughly three calls open for every put. Under our model that puts dealers long gamma everywhere near the market, which pushed the flip far below the price: between 12% and 37% below from Monday through Wednesday. On Tuesday and Friday it came back inside 8% for a while (14 minutes on Tuesday, about a third of Friday's session) and the line appeared. Overall it was on screen for less than a tenth of last week's regular trading hours.

A missing flip still tells you something. It means NQ is deep in positive gamma: dealers are modeled long gamma across the whole range, and their hedging tends to sell rallies and buy dips, which damps moves. As of this morning NDX was showing about $2.3 billion of long gamma. In that regime the walls do the framing, which on your chart is the put wall at 29,796 and the call wall at 30,730. It's a tendency, not a floor and a ceiling. The flip was back for part of Friday, so it's hovering near the edge, but I can't give you a date for its return.

One more thing from your screenshot: your panel says v1.6, which is from late August. The current version is v2.3, and it fixes exactly this: instead of a dash, the Flip line now says why it's empty. For most of last week it would have read "Flip >8%↓", meaning the flip exists but sits more than 8% below the price. It also includes a handful of display fixes made since 1.6.

To update without losing your settings:

1. Log in, open https://zerogex.io/ninjatrader-indicator and click "Grab the .cs" in step 2.
2. Open the downloaded file in Notepad and copy all of it.
3. In NinjaTrader, go to New → NinjaScript Editor and, under Indicators, open the ZeroGEX indicator you already have (it's probably named "zerogex").
4. Select all of its code, paste the new code over it, and press F5.

Please use the .cs rather than the .zip for this update. The new .zip installs under a different file name, and NinjaTrader won't accept two copies of the same indicator. Your API key and symbol carry over, and the panel should read v2.3 afterward. If you don't see the download link, or anything looks off after the update, reply and I'll sort it out.

Michael
Founder, ZeroGEX

## Worth a separate ticket

- **The package's inner filename changed.** The v1.5 and v1.6 zips installed as
  `Indicators\zerogex.cs`, and the v2.3 zip installs as
  `Indicators\EDQUANTGAMMA.cs`. So anyone who upgrades the way the page tells
  them to (import the .zip) over an older zip install gets a failed import.
  `EDQUANTGAMMA` is also what they see in their NinjaScript Editor. Re-export
  under `zerogex`, have `scripts/verify-ninjatrader-package.py` pin the inner
  name, and add an "updating from an older build" line to the NinjaTrader page.

## Follow-up: the NDX horizon override (2026-09-28)

**What it is.** Before summing gamma across the chain, the resolver weights each
contract by `min(1, calendar days to expiry ÷ horizon)`
(`_dte_profile_weight`, zerogex-oa `src/analytics/main_engine.py`), so a
same-day wall can't pin a multi-day level. Every symbol shared a 2-day horizon
(`GAMMA_PROFILE_DTE_REF_DAYS=2.0` in production). `GAMMA_PROFILE_DTE_REF_DAYS_NDX=1`
gives NDX alone a 1-day horizon:

- Next-day contracts go from between half and two-thirds weight (depending on
  the time of day) to full weight.
- Same-day contracts go from hours-left ÷ 48 to hours-left ÷ 24, and still reach
  zero at the close.
- Anything two or more days out is unchanged.

NDX runs about 76% of its open interest in 0DTE, so the shared horizon was
discounting most of its book.

**Check run first**, read-only, after the close:

```
cd ~/zerogex-oa
for d in 2026-08-12 2026-08-26 2026-09-09 2026-09-17 2026-09-23; do echo "== $d"; make gamma-flip-gate-replay SYMBOL=NDX SESSION=$d SAMPLES=3 DTE_REFS=1,2 | grep -E "spot=|ref=|LARGEST"; done
make gamma-flip-gate-replay SYMBOL=NDX AT="2026-09-18 11:00" DTE_REFS=1,2 | grep -E "spot=|ref="
```

| Replayed minute | Spot | Flip at 1-day horizon | Flip at 2-day horizon |
| --- | --- | --- | --- |
| 9/17 11:56 (blank in production) | 29,425 | 28,852 | 28,805 |
| 9/17 13:57 (blank in production) | 29,432 | 28,829 | blank |
| 9/17 14:43 (blank in production) | 29,411 | 28,905 | 28,755 |
| 9/18 11:00 (published in production) | 29,469 | 29,161 | 29,109 |
| 9/23, three blank minutes | 30,459–30,626 | blank | blank |
| 8/12, 8/26, 9/9, three blank minutes each | 29,165–29,814 | blank | blank |

The tool's verdict on 9/17: "The LARGEST DTE reference that publishes in all
of them is 1 days (production runs 2)". Where a flip already published (9/18),
it moved 0.2%. On last week's market blanks (9/23) nothing appeared. The 2-day
horizon published two of the three 9/17 minutes in the replay, where production
published none. That is the on-the-edge behavior the Sept 20 investigation
measured.

**Applied** 2026-09-28 at 16:44 ET, on the box:

```
sed -i.bak-0928 '/^GAMMA_PROFILE_DTE_REF_DAYS=/a GAMMA_PROFILE_DTE_REF_DAYS_NDX=1' /home/ubuntu/zerogex-oa/.env
cd ~/zerogex-oa && make analytics-restart
```

The running service's environment shows both lines, and the backup is
`/home/ubuntu/zerogex-oa/.env.bak-0928`. To undo:
`sed -i '/^GAMMA_PROFILE_DTE_REF_DAYS_NDX=/d' /home/ubuntu/zerogex-oa/.env && cd ~/zerogex-oa && make analytics-restart`

**What moves.**

- Only NDX reads the override; NQ inherits it through the projection.
- NDX's flip, `net_gex_at_spot` and stored gamma profile (`gex_profile`, served
  by `/api/gex/profile`) all come from the same weighted curve. All three shift
  together, along with anything that reads them for NDX or NQ.
- Unchanged: `gamma_flip_raw` (it has no weighting), the 8% cap and the other
  gates, and the flip-horizon endpoints (they pass their own horizons).

**Still open: August.** The override doesn't explain the three sampled August
days. Rerun one of them without the `grep` and the report prints a line per
relaxation. Whichever one publishes names what declined the minute:

- `distance ceiling off` alone means the crossing sat more than 8% from spot.
- `DTE ramp off` alone means a crossing appears only when same-day contracts
  count at full weight.
- Any other single line names the gate that declined it. If only the
  `all gates off (control)` line publishes, more than one gate did.
