# Pin Strike

*What the Pin Strike is, how the score and the Strong / Moderate / Weak strength label are computed, when a pin is labeled Far instead, and the limitations worth knowing before you lean on it.*

---

## What Pin Strike is

Pin Strike is the **reachable same-day (0DTE) strike with the strongest modeled positive dealer gamma into expiration**.

It answers a question none of the other levels ask: *if price drifted to strike K, would dealer hedging there be locally stabilizing - and can price actually get to K before the close?*

That makes it a distinct metric, not a rename of one you already have:

| Level | What it measures |
| --- | --- |
| **Call / Put Wall** | The strike at or above / at or below spot with the largest *current* dollar call / put gamma, summed over every expiration ZeroGEX loads. A concentration, measured at today's spot. |
| **Gamma Flip** | The hypothetical spot at which *aggregate* dealer gamma changes sign. |
| **Max Pain** | The strike minimizing aggregate option-holder intrinsic payout at settlement. |
| **GEX King** | The strike with the largest current `\|net GEX\|`, across the whole chain. |
| **Pin Strike** | The reachable 0DTE strike with the strongest *locally restoring* dealer gamma, priced as if spot were already there. |

Pin Strike deliberately does **not** just pick the largest-gamma strike. A huge far-OTM gamma node that price cannot plausibly reach into the close scores near zero.

## How the score is computed

For every candidate strike `K`:

```
pin_score(K) = restoring_gamma(K) × reachability(K)
```

**`restoring_gamma(K)`** - dealer gamma re-priced **as if spot were at K**. Every contract's gamma is recomputed with Black-Scholes at `S = K` using that contract's own implied vol and time to expiration, signed with the standard dealer convention (calls `+`, puts `−`), scaled to dollar gamma per 1% move on an open-interest basis, then weighted by a Gaussian kernel in strike space so only gamma *concentrated around K* contributes. The result is floored at zero: a neighborhood dominated by dealer-short put gamma scores zero and cannot pin.

The kernel bandwidth is **one median strike interval** of the nearby chain, so it adapts automatically across SPY (~$1 grid), SPX (~5pt) and NDX (coarser).

**`reachability(K)`** - how plausibly price gets there:

```
z = ln(K / spot) / (σ · √τ)
reachability(K) = exp(-½ z²)
```

where `σ` is representative ATM implied vol and `τ` is the *actual* remaining time to the 0DTE close. It peaks at 1.0 for a strike at spot and decays as the strike moves away faster than vol × √time can carry price. Because distance is measured in vol·√time units, the same formula works on every underlying with no per-symbol constants.

The **candidate set** is every listed strike within ±2.5 expected moves of spot (`|ln(K/spot)| ≤ 2.5·σ·√τ`), restricted to the **same-day expiration only**. Only actual listed strikes are considered, so the Pin Strike is always a real, quotable contract.

The winner is the highest `pin_score`. Ties break toward the strike nearest spot.

## How the strength label is computed

This is the part that surprises people, so it is worth stating plainly.

The **Strong / Moderate / Weak** label does not measure how *big* the pin is. It measures how much the winning strike **dominates the other viable candidates**:

```
pin_confidence = winning_score / Σ(all positive candidate scores)
```

| Label | Confidence |
| --- | --- |
| **Strong** | ≥ 50% |
| **Moderate** | ≥ 33% |
| **Weak** | below 33% |

We use share-of-field rather than a raw dollar threshold deliberately: a dollar cutoff would be underlying-dependent and would not survive the jump from SPY to NDX. Confidence is scale-free, so one set of thresholds is honest across every symbol.

The cost of that choice is real, and you should know it: **"Weak" means "did not dominate the field", not "small".**

### Why a big, isolated gamma peak can still read Weak

A worked example. Suppose the 0DTE chain shows this net gamma by strike, with a pronounced peak:

| Strike | Net gamma |
| --- | --- |
| 29,480 | 257m |
| 29,490 | 320m |
| **29,500** | **949m** |
| 29,510 | 62m |
| 29,520 | −3m |

That looks like a sharp, isolated peak - roughly 3× its neighbors on the way up, collapsing by over 90% immediately after. Intuitively, a strong pin.

But the kernel bandwidth here is one strike interval (10 points), so a neighbor 10 points away carries about 61% weight and one 20 points away about 14%. After smoothing, the *candidates around the peak inherit most of the peak's own gamma*:

| Candidate | Smoothed | Share of field |
| --- | --- | --- |
| 29,480 | 460m | 12% |
| 29,490 | 1,014m | 27% |
| **29,500** | **1,209m** | **32%** |
| 29,510 | 681m | 18% |

29,500 still wins - but at roughly 32% it lands just under the Moderate threshold and labels **Weak**. The very neighbors that make the peak look isolated in raw terms are the ones diluting its share, because each of them is itself a candidate borrowing that peak through the kernel. And this is the generous version: the real denominator spans every strike within ±2.5 expected moves, so the true share is lower still.

The practical reading: a Weak label next to a visibly heavy strike is telling you **the gamma is spread across a neighborhood rather than concentrated on one strike**. That is useful information - it means the pin is a zone, not a point - but it is not a statement that the level is insignificant.

### It reads stronger into the close

The candidate band is measured in vol·√time units, so as `τ → 0` into the close the band *narrows*. Fewer candidates, smaller denominator, higher confidence. **The same book will often read Weak at 10:00 and Moderate or Strong at 15:30** with nothing having changed structurally. Compare confidence readings at comparable times of day.

## When the pin is far from price

The candidates reach out to ±2.5 expected moves, and only positive (restoring) gamma counts. When dealers are short gamma around price, there is little of that nearby, so the strike that wins can be a distant pocket. And because the strength label measures share of the field, not distance, a lone distant candidate can even read **Strong**. On Nov 16, 2026 at 12:00, ES traded at 7,493 and falling, and the pin sat at 7,582, 89 points overhead, labeled Strong at 60%. Drawn as a teal `PIN · STRONG` line, it looked like a target. It wasn't one.

So when the pin is far from price, every surface labels it **Far** in place of Strong, Moderate or Weak, and draws it dimmed:

- The Gamma Terminal chart draws a faded line labeled `PIN · FAR`, with an outlined price tag.
- The Key Levels card keeps the strike and its distance from price, in muted ink, and adds **Far · no nearby pin**. Hover it for the details.
- The GEX Summary card and the replay snapshot read, for example, "Far: 1.19% above spot · no nearby pin". The confidence percent is dropped, because a lone distant candidate scores a high share of the field by default.
- The Daily Replay chart, the snapshot's strike profile, the GEX Strike Profile and Technicals charts, and the free gamma-levels pages mark it the same way.

The level is never hidden for being far. It is still the model's answer, and it is only hidden when the model returns no pin at all (see [When there is no pin](/help/platform/pin-strike#when-there-is-no-pin)).

**What counts as far.** More than three-quarters of the daily expected move from price. The daily expected move is the ±1σ move implied volatility prices for one session: the half-width of the band the chart's [Expected Range](/help/platform/gamma-terminal#expected-range) overlay draws with **Daily** picked, built from VIX for SPX, SPY and ES and from VXN for NDX, QQQ and NQ. Put visually: a pin is far once it sits more than three-quarters of the way from price to the edge of that band. The chart measures against it whether or not the overlay is on. Measured in expected moves rather than points, one rule works on every symbol, and it allows more room on a volatile day than on a quiet one. At a VIX of 20 it comes to about 71 ES points, or about $6.40 on SPY at 680.

Where there is no live volatility reading, a percent of price stands in: more than 1% from price for SPX, SPY and ES, 1.25% for NDX, QQQ and NQ, and 2% for a single stock. That applies on the Daily Replay and replay snapshots, while rewinding the chart, on the free gamma-levels pages, and on single stocks such as NVDA, whose own implied volatility VIX and VXN do not measure. Those cutoffs sit a little wider than the expected-move cutoff on a normal-volatility day, so without a vol reading the label errs toward not calling a pin far.

**How we picked the cutoff.** From the Daily Replay. On the November 2026 ES sessions, three-quarters of a move marked half of Nov 13 and all of Nov 16 as far, the sessions where the pin sat 89 to 150 points above a falling market, and 0 to 9% of the ordinary sessions, where it sat a typical 10 to 60 points away. Every Strong or Moderate label on Nov 16 was on a pin this rule calls far. Half a move would have marked two-thirds of an ordinary session as far. A full move would have missed the Nov 16 noon pin above.

**How to read it.** A far pin means there is no nearby pin. In short gamma, a distant or missing pin means there's no nearby stabilizing gamma: nothing close to price is positioned to slow a move, which fits the trending behavior short gamma tends to bring. Treat the far level as context, not a target.

## Where to see the numbers

- **Key Levels strip, the Gamma Terminal chart, and GEX Summary** - the Pin Strike tile and line. The chart labels the line with its strength bucket (`PIN · STRONG`), or `PIN · FAR` for a pin far from price; the GEX Summary card, and the Key Levels tile on hover, add the confidence percent, except on a far pin.
- **Replay snapshot permalinks** - `/replay/{symbol}/{date}/snapshot/{HHMM}` (time in ET) renders any historical moment with its stored confidence.
- **API** - `GET /api/v1/levels/{symbol}` returns `pin_strike` inside its `levels` object, with `pin_score`, `pin_confidence` (0-1) and `pin_strike_reason` as top-level fields. `GET /api/gex/summary` carries all four as top-level fields.

## When there is no pin

Pin Strike is nullable by design - we hide it rather than showing a misleading zero. In short gamma, a missing pin means the same as a far one: there's no nearby stabilizing gamma. When there is no active pin, `pin_strike_reason` says why:

| Reason | Meaning |
| --- | --- |
| `NO_0DTE_EXPIRATION` | No same-day expiration exists for this symbol today. |
| `NO_POSITIVE_RESTORING_GAMMA` | No neighborhood has net-positive restoring gamma - nothing can pin. |
| `INSUFFICIENT_OPTION_DATA` | Not enough structurally valid contracts (positive OI, IV, time, strike). |
| `INSUFFICIENT_IV_DATA` | No ATM contract carries a usable implied vol. We never substitute a default vol. |
| `EXPIRED` | Past the settlement instant - reachability is undefined. |
| `PIN_SCORE_TOO_WEAK` | The best candidate fell below the configured magnitude floor. |

## Pin stability - a separate read

The strength label is computed from a **single snapshot**, fresh each cycle, with no smoothing across time. A near-tie between two strikes can flip the label between adjacent minutes.

Separately, we track what the pin has *done* across the session - how long it has held, how far it has migrated, how many strikes it has genuinely occupied. That surfaces as its own line beneath the Pin tile ("Held since 09:41", or "−30 pts today · held since 14:05"). Single-minute excursions are pruned as scoring near-ties rather than reported as migrations.

Those are deliberately two different reads, and **stability does not feed the strength bucket**. A pin can be Weak but rock-steady all session, or Strong and migrating.

## After the close

The same-day options stop trading at the 4:00 PM ET close (1:00 PM on an early-close day), so the session's pin no longer describes anything. From the close until the next session's first update, the Pin Strike is the same model run on the **next expiration's** options as they stood at the close: the next session's 0DTE pin, as of the close. The tile names the expiry ("For the Mon, Nov 2 expiry"), and the stability line is hidden, because it tracked the pin of the options that expired. Through the API, `rolled_to_expiration` on `/api/gex/summary` and `/api/v1/levels` names that expiration, and `/api/gex/pin-stability` returns `404` until the next session.

## Known limitations

Stated plainly, because they affect how you should read the number:

- **Strength is dominance, not magnitude.** See above. This is the single most common misreading.
- **Far is measured against a whole day's move.** The cutoff does not shrink into the close, so late in the session a pin can be out of reach in the time left without being labeled Far. Near a pin, also weigh how much of the session is left.
- **No time smoothing.** The label is per-snapshot and can flicker on a near-tie.
- **Confidence is time-of-day sensitive.** The candidate band narrows into the close, mechanically raising confidence.
- **Strikes at the edge of the listed range are not explicitly flagged.** A candidate with no listed strikes on one side collects a one-sided kernel sum and so scores lower than a comparable interior strike. That is directionally sensible but it is a side effect of the kernel, not a designed low-confidence rule, and it is not surfaced to you.
- **0DTE only.** If you are comparing against strike-level gamma figures pulled from the full chain, you are looking at a different input set. After the close, "0DTE" means the next session's expiration (see [After the close](/help/platform/pin-strike#after-the-close)).
- **Modeled, not observed.** Pin Strike rests on the dealer-positioning convention described in [Methodology & Validation](/methodology) - that dealers are net long the calls customers overwrite and net short the puts customers buy for protection. Where that assumption is wrong, the sign is wrong.

## See also

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Max Pain](/help/platform/max-pain)
- [Reading the Charts](/help/platform/reading-charts)
- [Methodology & Validation](/methodology)
