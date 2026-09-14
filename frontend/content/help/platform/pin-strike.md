# Pin Strike

*What the Pin Strike is, how the score and the Strong / Moderate / Weak strength label are computed, and the limitations worth knowing before you lean on it.*

---

## What Pin Strike is

Pin Strike is the **reachable same-day (0DTE) strike with the strongest modeled positive dealer gamma into expiration**.

It answers a question none of the other levels ask: *if price drifted to strike K, would dealer hedging there be locally stabilizing — and can price actually get to K before the close?*

That makes it a distinct metric, not a rename of one you already have:

| Level | What it measures |
| --- | --- |
| **Call / Put Wall** | The strike above / below spot with the largest *current* dollar call / put gamma. A concentration, measured at today's spot. |
| **Gamma Flip** | The hypothetical spot at which *aggregate* dealer gamma changes sign. |
| **Max Pain** | The strike minimizing aggregate option-holder intrinsic payout at settlement. |
| **GEX King** | The strike with the largest current `|net GEX|`, across the whole chain. |
| **Pin Strike** | The reachable 0DTE strike with the strongest *locally restoring* dealer gamma, priced as if spot were already there. |

Pin Strike deliberately does **not** just pick the largest-gamma strike. A huge far-OTM gamma node that price cannot plausibly reach into the close scores near zero.

## How the score is computed

For every candidate strike `K`:

```
pin_score(K) = restoring_gamma(K) × reachability(K)
```

**`restoring_gamma(K)`** — dealer gamma re-priced **as if spot were at K**. Every contract's gamma is recomputed with Black-Scholes at `S = K` using that contract's own implied vol and time to expiration, signed with the standard dealer convention (calls `+`, puts `−`), scaled to dollar gamma per 1% move on an open-interest basis, then weighted by a Gaussian kernel in strike space so only gamma *concentrated around K* contributes. The result is floored at zero: a neighborhood dominated by dealer-short put gamma scores zero and cannot pin.

The kernel bandwidth is **one median strike interval** of the nearby chain, so it adapts automatically across SPY (~$1 grid), SPX (~5pt) and NDX (coarser).

**`reachability(K)`** — how plausibly price gets there:

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

That looks like a sharp, isolated peak — roughly 3× its neighbors on the way up, collapsing by over 90% immediately after. Intuitively, a strong pin.

But the kernel bandwidth here is one strike interval (10 points), so a neighbor 10 points away carries about 61% weight and one 20 points away about 14%. After smoothing, the *candidates around the peak inherit most of the peak's own gamma*:

| Candidate | Smoothed | Share of field |
| --- | --- | --- |
| 29,480 | 460m | 12% |
| 29,490 | 1,014m | 27% |
| **29,500** | **1,209m** | **32%** |
| 29,510 | 681m | 18% |

29,500 still wins — but at roughly 32% it lands just under the Moderate threshold and labels **Weak**. The very neighbors that make the peak look isolated in raw terms are the ones diluting its share, because each of them is itself a candidate borrowing that peak through the kernel. And this is the generous version: the real denominator spans every strike within ±2.5 expected moves, so the true share is lower still.

The practical reading: a Weak label next to a visibly heavy strike is telling you **the gamma is spread across a neighborhood rather than concentrated on one strike**. That is useful information — it means the pin is a zone, not a point — but it is not a statement that the level is insignificant.

### It reads stronger into the close

The candidate band is measured in vol·√time units, so as `τ → 0` into the close the band *narrows*. Fewer candidates, smaller denominator, higher confidence. **The same book will often read Weak at 10:00 and Moderate or Strong at 15:30** with nothing having changed structurally. Compare confidence readings at comparable times of day.

## Where to see the numbers

- **Key Levels strip and the Gamma Terminal chart** — the Pin Strike line and tile, with the strength bucket and confidence percent.
- **Replay snapshot permalinks** — `/replay/{symbol}/{date}/snapshot/{HHMM}` (time in ET) renders any historical moment with its stored confidence.
- **API** — `GET /api/v1/levels/{symbol}` returns `pin_strike`, `pin_score`, `pin_confidence` (0–1) and `pin_strike_reason` as top-level fields. `GET /api/gex/summary` carries the same fields.

## When there is no pin

Pin Strike is nullable by design — we hide it rather than showing a misleading zero. When there is no active pin, `pin_strike_reason` says why:

| Reason | Meaning |
| --- | --- |
| `NO_0DTE_EXPIRATION` | No same-day expiration exists for this symbol today. |
| `NO_POSITIVE_RESTORING_GAMMA` | No neighborhood has net-positive restoring gamma — nothing can pin. |
| `INSUFFICIENT_OPTION_DATA` | Not enough structurally valid contracts (positive OI, IV, time, strike). |
| `INSUFFICIENT_IV_DATA` | No ATM contract carries a usable implied vol. We never substitute a default vol. |
| `EXPIRED` | Past the settlement instant — reachability is undefined. |
| `PIN_SCORE_TOO_WEAK` | The best candidate fell below the configured magnitude floor. |

## Pin stability — a separate read

The strength label is computed from a **single snapshot**, fresh each cycle, with no smoothing across time. A near-tie between two strikes can flip the label between adjacent minutes.

Separately, we track what the pin has *done* across the session — how long it has held, how far it has migrated, how many strikes it has genuinely occupied. That surfaces as its own line beneath the Pin tile ("Held since 09:41", or "−30 pts today · held since 14:05"). Single-minute excursions are pruned as scoring near-ties rather than reported as migrations.

Those are deliberately two different reads, and **stability does not feed the strength bucket**. A pin can be Weak but rock-steady all session, or Strong and migrating.

## Known limitations

Stated plainly, because they affect how you should read the number:

- **Strength is dominance, not magnitude.** See above. This is the single most common misreading.
- **No time smoothing.** The label is per-snapshot and can flicker on a near-tie.
- **Confidence is time-of-day sensitive.** The candidate band narrows into the close, mechanically raising confidence.
- **Strikes at the edge of the listed range are not explicitly flagged.** A candidate with no listed strikes on one side collects a one-sided kernel sum and so scores lower than a comparable interior strike. That is directionally sensible but it is a side effect of the kernel, not a designed low-confidence rule, and it is not surfaced to you.
- **0DTE only.** If you are comparing against strike-level gamma figures pulled from the full chain, you are looking at a different input set.
- **Modeled, not observed.** Pin Strike rests on the dealer-positioning convention described in [Methodology & Validation](/methodology) — that customers are net long calls and net short puts against dealers. Where that assumption is wrong, the sign is wrong.

## See also

- [Dealer Positioning](/help/platform/dealer-positioning)
- [Max Pain](/help/platform/max-pain)
- [Reading the Charts](/help/platform/reading-charts)
- [Methodology & Validation](/methodology)
