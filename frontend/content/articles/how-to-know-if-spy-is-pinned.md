# How to Know If SPY Is Pinned: The Five Signs

*How to know if SPY is pinned today — the five structural signs that price is being magneted toward a strike, and the trading playbook (fade extremes, skip the middle) that pinned tape rewards.*

---

## Pin recognition is the cleanest day-trade filter

Most day-trade losses come from running the wrong playbook for the regime. The single highest-leverage version of this mistake is trying to trade momentum in a pinned tape. SPY compresses toward a strike, you buy the first push, it reverses, you sell the first dip, it bounces. Death-by-chop. By 14:00 ET you're down 1.5% on a day where SPY barely moved 0.3%.

The fix is regime recognition: knowing when SPY is pinned and switching playbooks accordingly. Pinned tape rewards fading the extremes of the compression range; it punishes everything else. Once you can recognize the pin in real time, the trade selection improves immediately.

This piece walks through the five structural signs SPY is pinned today, the playbook that works in that regime, and when the pin breaks. For the related explainer on the pinning mechanism itself, see [Why Does SPY Pin Near a Strike?](/education/why-spy-pins-near-strikes); for the broader regime context, the [Gamma Exposure pillar](/education/gamma-exposure-explained).

---

## What a pin actually is

A pin is what happens when dealer hedging produces structural attraction toward a heavy gamma strike. The mechanics:

1. A specific strike — usually the heaviest 0DTE call/put concentration — carries large dealer gamma.
2. The regime is **long-gamma**: dealers hedge by selling strength and buying weakness.
3. When spot rises above the strike, dealers sell — pulling price back down.
4. When spot drops below the strike, dealers buy — pulling price back up.
5. The net effect is price oscillating in a tight range *around* the strike. The strike acts as a magnet.

Pins aren't psychological. They're the visible output of forced hedging at a strike concentration. They form most reliably on OPEX days, end-of-month, and into the cash close — anywhere same-day or near-dated options dominate the gamma profile.

The fuller mechanism is in [Why Does SPY Pin Near a Strike?](/education/why-spy-pins-near-strikes).

---

## The five signs SPY is pinned today

### Sign 1: Net GEX is meaningfully positive (long-gamma regime)

The pin only happens in a long-gamma regime. Spot must be above the gamma flip, and Net GEX must be substantial (the standard threshold most analysts watch is roughly $500M+ for SPY scale, though magnitude matters more than any specific number).

If Net GEX is negative or near zero, the pin thesis is off the table. The dealer reflex isn't pulling — it's chasing or neutral. Skip the pin playbook entirely.

### Sign 2: Max pain and the gamma magnet agree near spot

Two structural strikes worth checking: **max pain** (the strike where option-holder payout is minimized at expiry) and the **gamma magnet** (the heaviest absolute gamma strike). When they both point to the same level and that level is within 0.3% of current spot, the structural pull is at its sharpest.

When they diverge, the gamma magnet usually wins — it's the actual hedging mechanism, while max pain is the payoff geometry. See [Max Pain Explained](/education/max-pain-explained) for the difference.

### Sign 3: Spot has been oscillating around the magnet for the last hour

A live read: chart SPY against the gamma magnet strike on a 5-minute timeframe. If price has crossed the magnet line three or more times in the last 60 minutes with each excursion getting smaller, the pin is forming. The compression range tightens as the magnet pulls harder near expiry.

The opposite — price drifting consistently above or below the magnet without returning — argues against the pin. Price is in a direction, not a range.

### Sign 4: Realized volatility has compressed below implied

This one requires a vol read: if SPY's realized intraday vol over the last hour is materially below the day's implied vol, the dealer reflex is doing its job. Long-gamma hedging dampens realized vol; a successful pin shows up as realized < implied.

If realized is *expanding* (price is moving more than expected), the pin isn't holding. The dealer book is being run over by other flow.

### Sign 5: EOD Pressure is near zero inside the active window

After 14:30 ET, the EOD Pressure signal becomes informative. A reading near zero (between -0.20 and +0.20) during the active window is the structural signature of a pin — charm and pin-gravity terms are cancelling, which happens when price is sitting right at the magnet strike.

A large positive or negative EOD Pressure reading is the opposite signal: price is *away* from the magnet, and forced hedging is pushing it back toward the magnet (or away, in a short-gamma regime). See [EOD Pressure Signal Explained](/education/eod-pressure-explained) for the full read.

---

## The pinned-tape playbook

When all (or most) of the five signs line up, the playbook is simple and contrarian:

### Do: fade the extremes of the compression range

The structural pull is back toward the magnet. Selling pushes near the top of the compression range (and buying pushes near the bottom) is the only setup where the dealer reflex is on your side. Size small — pins are probabilistic, not guaranteed — but the read is structural.

### Don't: chase the middle of the range

The middle is where the magnet sits. Buying or selling in the middle is buying into a level price is structurally trying to return to. The expected value is roughly zero with negative carry from spread and theta. This is where most pinned-tape losses come from — chasers buying every push and selling every dip in the middle.

### Don't: take momentum setups

Momentum playbooks (breakout, vol expansion, squeeze) assume the move extends. A pinned tape is the opposite assumption. Running the wrong playbook is most of the mistake.

### Do: shrink position size

Pinned tape ranges are tight. Stops are tighter. Position size should reflect the smaller reward (and the smaller distance to the magnet for the stop). Treating a pinned tape with a normal-day position size is asking for premature stop-outs.

---

## When the pin breaks

Pins don't last forever. The conditions that break them:

- **A catalyst.** CPI, FOMC, NFP, geopolitical surprise. Macro flow overwhelms the structural pull.
- **A gamma flip cross.** If spot crosses below the gamma flip, the regime inverts. The same magnet that was pulling price toward itself in long-gamma starts releasing price in short-gamma.
- **Net GEX decay.** As 0DTE positions roll off (especially after 15:30 ET), the dealer book thins. The magnet weakens.
- **A single-name or sector shock.** Major component news (NVDA, AAPL, MSFT) can shift index flow enough to override the pin.
- **The wall migrates.** If fresh open interest builds aggressively at a different strike, the magnet moves — and the old pin becomes irrelevant.

Watching for these breaks is part of the workflow. A pin that's been holding for two hours is more reliable than one that just formed — but a pin can also unwind quickly when the conditions stop supporting it.

---

## Worked example

It's 13:30 ET on a Friday. SPY is at 581.10. ZeroGEX shows:

- **Net GEX:** +$1.3B (long-gamma)
- **Gamma Flip:** 579.50 (spot well above)
- **Gamma magnet:** 581.00 (essentially at spot)
- **Max Pain:** 581.00 (agrees with magnet)
- **EOD Pressure:** +0.10 (near zero — pin signature inside window)

SPY has cycled between 580.85 and 581.30 four times in the last 60 minutes, each excursion getting smaller.

The composite read: every one of the five pin signs is on. Net GEX is healthy positive, max pain and the magnet agree at 581, the magnet sits at spot, price is oscillating with tightening amplitude, and EOD Pressure is near zero in the active window. This is a textbook pin.

Practical lean: fade the extremes (small puts near 581.30, small calls near 580.85), skip the middle entirely. Position size small. Watch for the breakdown conditions — especially Net GEX decay as the close approaches.

---

## Common misreads

Three traps:

- **"It bounced once at 580.85, so it's pinned."** A single bounce isn't a pin. You need multiple oscillations *and* the structural conditions (positive Net GEX, magnet-spot agreement). One bounce is just a bounce.
- **"It's been ranging all day, so it'll keep ranging."** Ranges break. The pin holds because of *current* structural conditions. When Net GEX decays into the close or a catalyst lands, the range breaks. The structural conditions update faster than the chart pattern does.
- **"I should buy the breakout from the pin."** Sometimes — but the breakout from a real pin is statistically less likely than the continuation of the pin until structural conditions change. Treating every probe outside the range as a breakout signal gets you long at the top and short at the bottom, repeatedly.

---

## Takeaway

> A pinned SPY tape is one of the cleanest regime reads in day trading — and it's the regime where running the wrong playbook costs the most. The five signs above are how you tell the regime is on; the playbook (fade extremes, skip middle, small size) is what works in it.

The discipline is to recognize the pin *before* you start trading the tape that day, not after you've lost three times in the middle of the range. The structural read is available from the open; the recognition is the edge.

Educational content only — none of the above is a trade recommendation.

---

If you want to see today's gamma flip, Net GEX, gamma magnet, and max pain — the four structural levels that decide whether SPY is pinned today — the free ZeroGEX gamma-levels view surfaces them all.
