# Why Does SPY Pin Near a Strike? Options Pinning Explained

*Why does SPY pin near specific strikes — especially on Fridays and into the close? It's rarely coincidence. Options pinning explained: the modeled dealer-hedging mechanism that can pull price toward a strike, why it tends to be strongest on OPEX and end-of-day, and how to read whether today's tape is likely to pin.*

---

## Pinning isn't superstition

If you trade SPY weekly options regularly, you've watched it happen: SPY drifts toward a round-number strike — 580, 583, 585 — and on Friday afternoon it sits there, oscillating in a 30-cent range, refusing to leave. Same thing happens around quarterly expiries and on monthly OPEX. Same thing on plenty of regular Wednesdays and Thursdays when the 0DTE chain is loaded.

A lot of traders treat pinning as a vibes-based phenomenon — "the market knows where it wants to settle" — or chalk it up to chart patterns. There's a more concrete story underneath: modeled dealer hedging at heavy gamma strikes can generate flows that tend to pull price back toward the strike, alongside other contributors like liquidity, positioning, and expiration mechanics. Once you can see the mechanism, you can also gauge when it's more likely to be operating today and when it isn't.

This piece walks through the actual mechanics of pinning, why it intensifies near expiry, the two pin types most traders confuse, and the structural conditions that make today a pin day. For the trader-facing "is SPY pinned right now" checklist, see [How to Know If SPY Is Pinned](/education/how-to-know-if-spy-is-pinned). For the related max-pain discussion, see [Max Pain Explained](/education/max-pain-explained).

---

## The dealer-hedging mechanism behind pinning

The mechanism is easiest to see once you write it out — keeping in mind it's a model of dealer behavior, not something you can read directly off the tape:

1. A specific strike — let's say SPY 583 — carries a large gamma concentration. Under the standard positioning model, the dealer book is assumed **long** the gamma there. (A large concentration on its own isn't proof of that — open interest shows how many contracts are open, not who is long or short — but it's the working assumption when calls dominate the strike.)
2. If the dealer book is long gamma at the strike, hedging pushes *against* moves away from it — the stabilizing reflex that tends to pin price. (It is the positive-gamma regime playing out at a single dominant strike.)
3. When SPY rises through 583, the modeled hedge delta grows positive, so to stay neutral dealers tend to **sell** SPY.
4. When SPY drops through 583, the modeled hedge delta grows negative, so to stay neutral dealers tend to **buy** SPY.
5. Each excursion away from 583 invites a hedge trade *back toward* 583. The strike can act as a magnet — not because anyone is targeting it, but because, under the model, the hedging math leans price back that way.

That's a plausible read of what's happening when you see SPY oscillating in a tight range: the aggregate dealer book correcting back toward neutral on every move. It's rarely the only thing going on — liquidity, trader behavior, and expiration mechanics contribute too — but it's often a dominant one.

---

## Why pinning intensifies near expiry

The mechanism above applies to any option — but the *strength* of the pin depends on gamma magnitude at the strike. Two things make that magnitude huge near expiry:

### Gamma scales with 1/√T

Gamma per option contract is roughly inversely proportional to the square root of time-to-expiry. A 0DTE option's gamma at-the-money is roughly 5× a same-strike 5-DTE option's gamma, and orders of magnitude larger than a monthly. The closer you get to expiry, the larger the per-contract gamma — and the larger the hedging trade each tick of price requires.

A 0DTE strike that everyone is positioned around can behave like a black hole for spot. Dealers may need to move very large amounts of underlying for very small price changes, so pinning can become the path of least resistance.

### Open interest concentrates at round strikes

The market structurally concentrates open interest at round numbers — 580, 583, 585 in SPY, 5800, 5810 in SPX. By Friday afternoon, the gamma concentration at one or two of those strikes can dominate the rest of the chain combined. That single-strike dominance is a big part of the visible "magnetism" traders feel at the close.

Combine the two — short time-to-expiry + concentrated OI at round strikes — and Friday-afternoon pins become more structurally likely. Wednesday and Monday have weaker versions of the same setup as 0DTE flow keeps growing.

---

## Two pin types — and they're not the same

A common source of confusion: **max pain** vs. the **gamma magnet**. Both get called "the pin," but they're computed differently and they can disagree.

### Max pain

Max pain is the strike at which total option-holder payout would be minimized at expiry. It's a payoff-geometry calculation — pure intrinsic value math. It tells you the strike that's "structurally favorable" to option writers.

### Gamma magnet

The gamma magnet is the strike with the largest absolute dealer gamma concentration — the strike where forced hedging is loudest. It's a hedging-flow read.

When the two strikes agree, the pin thesis tends to be at its sharpest. When they disagree, ZeroGEX leans on the gamma magnet, because it maps to the modeled hedging flow rather than payoff geometry alone — but that's a lean, not a rule, and which read matters more depends on the modeled dealer-gamma sign and the surrounding flow.

[Max Pain Explained](/education/max-pain-explained) covers this distinction in depth and is honest about how often max pain alone misleads.

---

## When the pin holds

The structural conditions that make today a pin day:

- **Positive-gamma regime.** Spot above the modeled gamma flip; Net GEX clearly positive. Without this, the modeled hedging reflex can invert, and the same strike may release price instead of attracting it.
- **Heavy strike concentration near spot.** The gamma magnet sits close to price — ZeroGEX treats roughly 0.3-0.5% as "near," though that band is a house heuristic, not an industry standard. Magnets far from spot tend to act more as targets than active pins.
- **Max pain and the gamma magnet agree.** Both pointing to the same level. Compounds the structural pull.
- **Expiry-dominated chain.** 0DTE/weekly options carry most of the gamma. Monthly-dominated chains pin much less reliably.
- **Calm catalyst calendar.** No major macro data or central bank event during the session.
- **Realized vol compressing.** Tape is showing the dealer-dampening reflex working.

When most of these line up, the pin has structural probability behind it.

---

## When the pin breaks

The pin unwinds when:

- **The gamma flip cross happens.** Spot drops below the modeled flip; crossing it suggests the model's aggregate hedging tendency has changed sign, so the same magnet may start releasing price rather than attracting it.
- **A catalyst lands.** CPI, FOMC, NFP, single-name shock. Macro flow overwhelms the dealer reflex.
- **Net GEX decays meaningfully.** Near-expiry gamma is repricing: ATM gamma can rise while decisively ITM or OTM gamma tends toward zero. The aggregate may strengthen or weaken.
- **The magnet migrates.** Confirmed open interest is generally published for the next session, but the modeled magnet can still shift mid-session as spot, gamma, time, and IV change — or as inferred intraday positioning builds at a different strike — moving the target elsewhere.
- **Skew shifts.** A heavy put bid (fear) can flip the chain's dealer-book sign even at the same strike.

A pin that's been holding for two hours is more durable than one that just formed, but no pin lasts indefinitely. The conditions that supported it have to keep holding for the pin to hold.

---

## Reading the pin in real time

A short workflow:

1. **Identify the heaviest gamma strike near spot.** This is the magnet candidate.
2. **Check Net GEX.** This is a modeled figure — estimated dealer gamma under the traditional call-positive/put-negative open-interest convention, not observed dealer inventory. A substantial positive value is the condition that supports the pin; negative or near-zero readings argue against it.
3. **Check the gamma flip.** Spot needs to be above. If the flip is right at spot, you're contested — pin might form, might not.
4. **Cross-check max pain.** Same strike or within ~0.3% of the magnet (a ZeroGEX heuristic) → sharper pin thesis. Materially different → weaker thesis; ZeroGEX leans on the magnet, since it maps to the modeled hedging flow.
5. **Read the time of day.** Before noon ET, charm hasn't piled up enough to drive the pin hard. After 14:00 ET, the pull intensifies. After 15:30 ET, the closing-window dynamics dominate.

Once you've identified the pin, the trading playbook is in [How to Know If SPY Is Pinned](/education/how-to-know-if-spy-is-pinned) — short version: fade extremes, skip middle, small size.

---

## Worked example

SPY is at 582.95 on a Friday afternoon. ZeroGEX shows:

- **Net GEX:** +$1.4B (positive — long-gamma regime)
- **Gamma Flip:** 581.20 (spot well above)
- **Heaviest 0DTE strike:** 583.00 (essentially at spot)
- **Max Pain:** 583.00 (agrees with gamma magnet)
- **Time:** 14:15 ET (charm pile-up starting)

Every structural condition for a pin is on. The magnet sits at 583; max pain agrees at 583; regime is long-gamma; we're inside the active EOD window. The probability that SPY oscillates inside a ~30-cent range around 583 through the close is materially elevated.

Practical lean: tight 582.70-583.30 range is the expected path. Excursions to the edges are fade-setup candidates. Center of the range is no-trade territory. Size small. Watch for the breakdown conditions — especially if a single-name shock or unexpected headline hits.

Now imagine the same setup with Net GEX at −$600M and the gamma flip at 583.50 (spot below). The "pin" thesis falls apart. Same chain, same strike, opposite read — because the modeled regime that governs whether the magnet tends to attract or release has flipped sign.

---

## Common misconceptions

- **"Pinning is psychology."** It's mostly mechanics. Modeled dealer hedging happens regardless of who's watching — the hedge flow doesn't care whether traders believe in it — though liquidity and positioning play a role too.
- **"SPY always pins at round numbers."** It pins at strikes where positioning concentrates. Round numbers are common because OI clusters there — but the actual mechanism is the OI, not the roundness.
- **"If max pain is X, price will close at X."** Often wrong. Max pain is payoff geometry, not a hedging force; the modeled gamma magnet maps more directly to hedging flow. When they disagree, ZeroGEX leans on the magnet.
- **"Pins are bullish/bearish."** Neither. They're vol-suppressive. Range-bound. The direction comes from elsewhere; the pin is about *character of price action*, not direction.
- **"Pinning happens every Friday."** Often, but not always. Some Fridays have catalysts, short-gamma regimes, or migrating magnets that prevent the pin. Reading the conditions matters.

---

## Takeaway

> SPY tends to pin because modeled dealer hedging at heavy gamma strikes can pull price back toward the strike. The pull is real enough — and readable enough — to use, as long as the structural conditions support it and you treat it as a probability, not a certainty.

The discipline is to verify the conditions before assuming today is a pin day. Long-gamma regime + heavy strike at spot + max-pain agreement + late session stacks the odds toward a sharp pin. Any one of those flipping weakens the read; all of them flipping effectively kills it.

Educational content only — none of the above is a trade recommendation.

---

If you want to see today's heaviest gamma strike, max pain, gamma flip, and Net GEX — the four numbers that decide whether SPY pins today — the free ZeroGEX gamma-levels view surfaces them all.
