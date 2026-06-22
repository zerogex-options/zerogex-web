# How to Trade Around Gamma Flip Levels

*The gamma flip is the cleanest single regime line in dealer-positioning analysis. Here's how to trade around it — what changes when spot crosses, the three setup types each regime supports, and the workflow for using the flip as a playbook switch rather than a directional signal.*

---

## The flip isn't a level — it's a playbook switch

Most retail traders who hear "gamma flip" treat it as another support/resistance line. Buy at the flip; sell at the flip; trade the bounce. That framing misses what the flip actually is. The flip isn't a level price respects — it's a **regime boundary** that determines which playbook the dealer-hedging mechanism is supporting today.

Above the flip, the dealer reflex is to fade strength and buy weakness. Mean-reversion playbooks have structural tailwind. Breakouts tend to fail; pins tend to form; volatility compresses.

Below the flip, the same reflex inverts. The dealer book amplifies moves instead of dampening them. Trend-continuation playbooks have the tailwind; breakouts extend; pins break down; volatility expands.

That's not "support and resistance at the flip." That's two different playbooks for the same chart depending on which side of one specific price you're on. Trading around the flip well means switching playbooks at the cross — not trading a level.

This piece covers the workflow. For the deeper read on what the flip is and how to read it conceptually, see [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip); for the underlying mechanics, the [Gamma Exposure pillar](/education/gamma-exposure-explained).

---

## The three setups each regime supports

### Above the flip (long-gamma regime)

**Setup type 1: Fade extremes back to the magnet.**
The dealer reflex pulls price toward heavy gamma strikes. Selling pushes near the call wall and buying dips near the put wall has structural support — the hedge flow is on your side. Position size small; take profit at the magnet.

**Setup type 2: Fade failed breakouts.**
When SPX punches above the call wall but Net GEX is positive and strengthening, the breakout is structurally likely to fail. The fade — short the break, target re-entry into the prior range — is the canonical long-gamma trade. The Trap Detection signal exists specifically for this read; see the [combined EOD Pressure & Trap Detection article](/education/eod-pressure-and-trap-detection).

**Setup type 3: Premium-selling around the gamma magnet.**
The pin behavior in a positive-gamma regime tends to compress realized volatility. Selling near-the-money premium against the magnet strike can work — though it's a defined-risk trade, not a structural lock. Size appropriately for the tail risk.

### Below the flip (short-gamma regime)

**Setup type 1: Continuation breakouts.**
Dealers must buy strength and sell weakness in this regime — the reflex extends moves. Buying a clean break above resistance (especially with Net GEX clearly negative) has structural tailwind. The Squeeze Setup signal scores for exactly this kind of coiled-and-extending setup; see [Squeeze Setup Signal Explained](/education/squeeze-setup-explained).

**Setup type 2: Don't catch the knife.**
The same reflex that amplifies rallies also amplifies selloffs. Catching falling-knife setups in a deep short-gamma regime tends to compound losses, because the dealer mechanism that would have produced the bounce in long-gamma is inverted. The dip-buy thesis specifically loses its structural support below the flip.

**Setup type 3: Trade with the flow direction, not against it.**
Tape Flow Bias and similar continuation signals carry more weight in short-gamma regimes. When premium-weighted flow is leaning one direction and Net GEX is negative, the move tends to extend rather than fade.

---

## How to actually use the flip intraday

A short workflow:

### Step 1: Check the regime at the open

Before any setup, pull the gamma flip and Net GEX. Note the gamma magnet and the walls. Spot's position relative to the flip is the first read of the day — and the playbook expectation should follow from it.

### Step 2: Set a "regime change" trigger

If spot crosses the flip during the session, your default playbook flips. This isn't symbolic — it's the actual mechanism inverting. A trader who's been fading rallies for two hours above the flip should stop doing that the moment spot crosses below; the same trade is now structurally unsupported.

### Step 3: Watch the distance, not just the side

Spot sitting 0.05% above the flip is structurally contested — both regimes are partially active. Spot sitting 0.4% above is firmly long-gamma. The distance from the flip is part of the read. The contested zone (roughly ±0.1% of the flip) is the highest-noise environment; tighten size or stand aside.

### Step 4: Watch flip migration

The flip moves intraday as positioning rebalances. A flip drifting up while price grinds higher is one read; a flip stuck while price climbs above it is another. The relationship between price and the flip is dynamic — track the *change* in the gap, not just the static distance.

### Step 5: Cross-check with Net GEX magnitude

A flip with $1.5B of Net GEX above is a sharp regime. A flip with $200M is a weak one. Magnitude matters as much as sign. The bigger the dealer book, the more the regime reflex shows up in the tape.

---

## When the flip is contested

The most dangerous state is spot sitting *at* the flip. Both regimes' reflexes are partially active, neither dominates, and behavior is unstable. The trades that work above the flip don't work; the trades that work below don't work either. Practically:

- Tighten position size or stand aside.
- Don't commit to a single regime playbook.
- Watch which side of the flip price settles on — the answer tells you which playbook to run next.
- Be especially cautious into the close, when charm flows can push spot across the flip and lock in a regime shift.

A contested flip is a regime-uncertainty signal. The right response is reduced exposure, not a different trade.

---

## Worked example

SPX is at 5,810 at the open. ZeroGEX shows:

- **Gamma Flip:** 5,802 (spot is +8 above)
- **Net GEX:** +$1.2B
- **Call Wall:** 5,820
- **Put Wall:** 5,790

Initial read: long-gamma regime, healthy positioning, structural range 5,790-5,820. Default playbook: fade the extremes (sell pushes toward 5,820, buy dips toward 5,790), skip the middle.

By 13:00 ET, SPX has slipped to 5,800 — now 2 points below the flip. Net GEX has decayed to +$300M and the flip has drifted up to 5,803. The regime is contested — spot just crossed the flip, magnitude is shrinking, and the structural reflex is weakening.

The playbook shifts. The fade-the-rally setup that was on at 14:30 is now structurally unsupported; a continuation higher is possible if Net GEX flips negative. Position size should shrink; the default trade is no trade until the regime resolves.

At 14:30 ET, Net GEX has flipped to −$200M and SPX has pushed to 5,815. This is now a short-gamma regime — the dealer reflex is amplifying, and the 5,820 call wall is no longer structural resistance; it's a breakout target. The fade-the-breakout trade is *off*; if the setup is right, the chase becomes the play.

Same chart, three different playbooks across the session — driven entirely by the regime variable.

---

## Common mistakes

- **Treating the flip as support or resistance.** It's a regime line, not a level. Buying weakness *into* the flip from above is structurally different from buying weakness from below. The same chart entry has opposite mechanism behind it.
- **Ignoring the flip when spot is far from it.** Even if spot is 1% above the flip, the flip still matters for context — it tells you which regime today's playbook is in. The flip doesn't only matter when price is near it.
- **Treating regime persistence as inevitable.** Long-gamma regimes can flip to short-gamma in an hour. The flip is dynamic. A regime read from this morning may be stale by lunch.
- **Trading the flip cross as a bounce setup.** The flip cross is a *playbook signal*, not a bounce signal. Sometimes price bounces off it; often it punches through. Don't trade the level — trade the regime change.

---

## Takeaway

> The gamma flip isn't a price level to trade against. It's a playbook switch — the line where the dealer-hedging reflex inverts. Trading around it well means changing what setups you take, not changing your entries.

The discipline is to check the regime before every setup and re-check it on every flip cross. The playbook that has structural tailwind on one side of the flip is the playbook that gets crushed on the other. Most traders who lose money "trading the flip" are actually losing money by running the wrong playbook for the regime.

Educational content only — none of the above is a trade recommendation.

---

If you want to see today's gamma flip with live distance from spot, the regime check, and Net GEX magnitude — the three numbers that decide which playbook the structural force in the tape is supporting right now — the free ZeroGEX gamma-levels view surfaces all of them.
