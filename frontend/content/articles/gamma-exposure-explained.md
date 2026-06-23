# Gamma Exposure (GEX) Explained: The Complete Guide

*Gamma exposure explained from the ground up — what GEX is, how dealer gamma is calculated and signed, why the regime above and below the flip behaves so differently, and how to actually use it inside a session.*

---

## Why gamma exposure matters

Most of the price action that traders try to read on a chart is a downstream effect of something happening one layer below: **dealer hedging flows**. Market makers sit on the other side of every option trade, and to stay delta-neutral, they continuously buy and sell the underlying as price moves. Whether they buy weakness or sell it — whether they dampen volatility or amplify it — depends on one structural variable: their **gamma exposure**.

Gamma exposure (GEX) is the cleanest way to read what that dealer book is doing. It tells you whether the structural force in the tape is pushing toward stability or instability, whether breakouts are likely to extend or fade, and whether the strikes you see on the chain are absorbing flow or releasing it. It does not tell you direction. It tells you the **character of the regime** you are trading in — and that is most of the edge.

This piece is the comprehensive read. We will cover what gamma exposure is, how it is built from the chain, the mechanics of positive versus negative gamma regimes, the role of the gamma flip and the gamma walls, and the practical workflow for using all of it intraday. For the deeper trader-facing reads on each sub-topic, this guide links out to [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip), [Gamma Walls Explained](/education/gamma-walls-explained), and [0DTE Dealer Positioning Explained](/education/0dte-dealer-positioning-explained). For specific second-order Greeks, see [Vanna and Charm Explained for Options Traders](/education/vanna-and-charm-explained), and for the pinning-versus-magnet discussion, see [Max Pain Explained — and Does It Actually Work?](/education/max-pain-explained).

---

## What is gamma exposure (GEX)?

Gamma exposure is the aggregate dealer hedging requirement implied by the open-interest profile of the option chain. It is the answer to one question: *if spot moves a little, how aggressively must dealers trade the underlying to keep their book delta-neutral?*

Three quick definitions to ground the rest of this piece.

### What is gamma?

Gamma is a second-order Greek that measures the **rate of change of delta** with respect to the underlying. Delta is how sensitive an option's price is to the underlying; gamma is how sensitive that sensitivity is. If delta is speed, gamma is acceleration.

Gamma is highest at the money and decays in both directions away from spot. It also decays with time — long-dated options have less gamma per contract than short-dated ones. The strongest gamma in any chain sits in the at-the-money, short-dated strikes, which is one reason 0DTE flow has reshaped intraday structure so completely.

### Why dealer gamma matters specifically

Dealers do not hold options to speculate. They warehouse them as inventory, hedging out the delta as quickly as they can. Their gamma exposure determines how that hedge has to change as price moves.

- A dealer who is **short gamma** must trade **with** the move to stay flat — buying as price rises, selling as it falls. That hedging amplifies the move.
- A dealer who is **long gamma** trades **against** the move to stay flat — selling as price rises, buying as it falls. That hedging dampens the move.

The aggregate dealer gamma exposure across the chain is, in effect, an estimate of how much underlying flow the market makers will have to push through during a given price move, and in which direction. That is what GEX captures.

### A working definition

Gamma exposure is the dollar magnitude (and sign) of dealer hedging flow per unit move in the underlying, aggregated across all open contracts. When traders ask for "gamma exposure explained" or "what is GEX," that is the answer: it is a real-time estimate of how the dealer book will react to price.

---

## How is gamma exposure calculated?

The calculation has a few moving parts, but the structure is simple.

### The per-strike formula

For a single options contract, the contribution to dealer gamma exposure (in dollars, per 1% move) is roughly:

```
contract_GEX ≈ gamma × open_interest × 100 × spot² × 0.01
```

Where:

- `gamma` is the per-option gamma from the Black-Scholes model.
- `open_interest` is the number of contracts outstanding at that strike.
- `100` is the standard contract multiplier.
- `spot²` converts gamma (which is itself per-dollar) into a hedge-flow magnitude.
- `0.01` rescales the result to a "per 1% move" interpretation, which is the industry convention.

The dollar interpretation is what makes the number useful: it answers "how much underlying do dealers have to trade if spot moves 1%?" — at a single strike, and then aggregated across the chain.

### Signed gamma exposure

To turn raw magnitude into a regime signal, each contract is signed by who holds it. The standard convention assumes:

- Customers are typically net long calls and net long puts.
- Dealers are therefore typically net short both — short calls contribute positive gamma to the dealer book, short puts contribute negative.

In practice, that produces a signed dealer GEX per strike — positive for calls, negative for puts — that, when summed, gives you the dealer's net exposure across the chain.

This is an approximation. Dealer positioning is not directly observable; it is inferred from open interest and the standard customer-long convention. Different vendors handle edge cases differently, and the assumption can break down in unusual flow conditions. As an estimator of regime, though, it has held up well enough to be the standard for years.

### Net GEX versus total GEX

Two aggregate numbers come from the same chain:

- **Total GEX** is the sum of the *absolute* contribution at each strike — a magnitude reading, indifferent to sign. It tells you how much gamma is in the system overall.
- **Net GEX** is the *signed* sum — calls minus puts. It tells you which side of the dealer book dominates, and whether the aggregate hedging reflex is dampening or amplifying.

Most regime work uses Net GEX. Magnitude matters too — a Net GEX of +$2B is a much sharper regime than +$200M — but the sign is the first read.

### Spot-shift dealer gamma versus per-strike aggregation

There are two ways to extract regime information from the chain:

1. **Per-strike aggregation** sums signed gamma exposure at each strike at today's spot. It is fast and intuitive.
2. **Spot-shift dealer gamma** re-prices every option's gamma at every hypothetical spot price on a grid, then sums to a *curve* of dealer gamma versus price. The zero crossing of that curve is the gamma flip; the value at today's spot is Net GEX-at-spot.

The spot-shift approach has one structural advantage: because the headline Net GEX and the gamma flip are read from one curve, they cannot contradict each other. A positive Net GEX always corresponds to spot sitting above the flip; a negative one always sits below. The per-strike approach can produce inconsistent signs when the chain shifts, which is why the spot-shift approach is the industry-standard for serious regime work. The methodology behind the ZeroGEX implementation is documented in detail in [GEX and the Gamma Flip — How ZeroGEX calculates them](/guides/gamma-flip-calculation-before-vs-after).

---

## Positive versus negative gamma regimes

The single most important read in dealer-positioning analysis is which side of the gamma flip spot is on. The mechanics are the inverse of each other — and the trades that work in one regime tend to be the wrong trades in the other.

### Positive gamma regime

Above the gamma flip, dealers are generally net long gamma. To stay delta-neutral, they hedge against directional moves — selling as price rises and buying as it falls. That reflex tends to:

- Compress realized volatility.
- Pull price toward strikes with heavy gamma concentration, especially into the close.
- Make breakouts harder to sustain.
- Make mean-reversion setups more reliable.

The character of the tape is **range-bound and absorbing**. Pin behavior is more likely, especially near OPEX and into the cash close. Short-premium strategies tend to work more often. Trend-following setups have a lower hit rate.

### Negative gamma regime

Below the gamma flip, dealers are generally net short gamma. To stay delta-neutral, they hedge with directional moves — buying as price rises and selling as it falls. That reflex tends to:

- Expand realized volatility.
- Make breakouts extend further than they look like they should.
- Make selloffs accelerate as they go.
- Make mean-reversion setups dangerous.

The character of the tape is **momentum-driven and amplifying**. The pins of the prior regime release; the strikes that were resistance can become breakout targets. Long-premium and trend-continuation strategies tend to work more often. Catching a falling knife in a deep negative-gamma regime fights the exact reflex that would make a dip-buy work.

### Two important caveats

The regime is a **probabilistic lean, not a guarantee.** Macro shocks, single-stock catalysts in index components, and unusual flow events can override the structural pull in either direction. A spot regime says *what the dealer reflex is*, not what every other participant will do.

The regime is also **dynamic**. The flip moves as positioning rebalances, and spot can cross it multiple times in a session. Reading the regime is a continuous activity, not a morning ritual.

---

## The gamma flip: the regime boundary

The gamma flip is the level where aggregate dealer gamma crosses zero. Above it, dealers are typically net long gamma; below it, net short. It is the structural boundary between the two regimes described above.

A few things worth being precise about:

- The flip is a **level, not a wall.** It does not resist price the way a heavy strike concentration might. It marks a behavioral inflection, not a structural barrier.
- It is a **regime line, not a directional signal.** Spot above the flip is not bullish; spot below it is not bearish. It tells you about vol character, not about direction.
- It is **dynamic.** As OI rolls and the chain reweights, the flip drifts. A stale flip is a misleading flip.
- It is a **filter, not a signal.** It tells you which playbook to run; the entry has to come from elsewhere.

For the practical reading workflow — including what changes above versus below, how to act on it intraday, and the common mistakes — see [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Gamma walls: where the flows concentrate

If the flip is the regime boundary, the gamma walls are the structural boundaries inside it. The **call wall** is the strike above spot carrying the heaviest call gamma exposure; the **put wall** is the strike below spot with the heaviest put gamma exposure. Together they sketch the range that dealer hedging tends to defend.

The walls behave very differently in the two regimes:

- In a **positive-gamma** regime, walls absorb. The dealer reflex around them is to fade moves — selling rallies into the call wall, buying dips into the put wall.
- In a **negative-gamma** regime, walls release. The same level that resisted price in long-gamma can become a breakout target.

Walls also migrate. A call wall that drifts up as price tests it is a structurally different read than one that holds. For the full reading workflow, see [Gamma Walls Explained: Call Wall, Put Wall, and How Price Reacts](/education/gamma-walls-explained).

---

## How GEX shapes intraday volatility

Realized volatility — the actual amplitude of price moves during the session — is heavily shaped by the GEX regime, separately from implied volatility (which is what the option market is pricing for the future).

The relationship is structural:

- A deep positive-gamma regime tends to produce **lower realized vol than implied.** The dampening reflex is large enough to suppress moves the market expected. This often supports premium-selling strategies.
- A deep negative-gamma regime tends to produce **higher realized vol than implied.** The amplifying reflex expands ranges beyond what the market priced. This tends to favor long-premium and momentum strategies.

The magnitude matters as much as the sign. A flip from +$2B Net GEX to +$200M is a very different state than a flip from −$2B to +$200M, even though both arrive at a similar number. The first is a *fading* long-gamma regime; the second is a *building* one. The trajectory is part of the read.

A common mistake is using GEX as a directional signal — "Net GEX is up, so the market is going up." That is not what it says. GEX tells you about the **character of the move**, not the direction of it. A positive-gamma regime can grind down just as easily as up, but it will tend to grind rather than break.

---

## How to use GEX intraday

A practical workflow:

### Step 1: Identify the regime

Before anything else, check whether spot is above or below the gamma flip and what the Net GEX magnitude is. That single read filters out a huge share of bad trades — fades when you should be running with the move, breakouts when you should be fading them.

### Step 2: Read the walls within the regime

Find the active call wall and put wall. In a positive-gamma regime, these are your absorbing boundaries — the structural range. In a negative-gamma regime, they are weaker as resistance and can flip into breakout targets.

### Step 3: Watch migration

Levels are not static. A wall migrating with price (chasing the move) is a different read than one holding. A flip drifting up alongside price has different implications than one stuck while spot moves away. Track the *change*, not just the value.

### Step 4: Account for 0DTE concentration

When same-day options dominate the chain — which is increasingly the default for SPX during the cash session — the 0DTE bucket disproportionately drives intraday dealer behavior. The relevant gamma is the gamma at the strikes that will be alive at the close. The deeper treatment is in [0DTE Dealer Positioning Explained](/education/0dte-dealer-positioning-explained).

### Step 5: Layer in second-order Greeks where relevant

Gamma is not the whole picture. Vanna (vol-driven hedging) creates a persistent bid in vol-compression regimes; charm (time-driven hedging) drives the predictable into-close flows that show up in EOD pressure reads. The companion piece on [Vanna and Charm Explained for Options Traders](/education/vanna-and-charm-explained) covers both.

---

## Vanna and charm: the second-order story

GEX is the headline read, but it is not the whole dealer book. Two second-order Greeks materially shape dealer hedging flows on top of gamma:

- **Vanna** is the sensitivity of delta to implied vol. When IV moves, dealers' option deltas move even if spot does not — and they have to hedge that. In a vol-compression regime, vanna flows from dealer short calls often manifest as a persistent grinding bid in the underlying.
- **Charm** is the sensitivity of delta to time. As options approach expiry, their delta drifts predictably — out-of-the-money options decay toward 0, in-the-money ones toward 1 — and dealers must continuously re-hedge that drift. The cleanest place to see charm in the tape is the final 90 minutes of the cash session.

Both effects are largest when gamma is also large — which is to say, when 0DTE and short-dated options dominate the chain. Read them together with GEX, not in isolation.

---

## Common misconceptions about GEX

A few traps:

- **"Positive gamma is bullish."** It is not. It is **stabilizing**. The market can drift down in a positive-gamma regime; it just tends to do so slowly.
- **"Net GEX is a directional indicator."** It is not. Sign tells you the regime; direction comes from elsewhere.
- **"GEX levels are fixed."** They are not. The flip, the walls, and Net GEX itself all move as the chain repositions.
- **"Walls are hard support and resistance."** They are structural leans whose behavioral effect depends on the regime. They get broken regularly.
- **"GEX is a signal."** It is closer to a filter. A clean regime read sharpens every other tool you use; it does not, on its own, tell you when to enter.

---

## What GEX is not (limitations)

GEX is an estimator of dealer hedging requirements built from open interest under a standard assumption about who holds what. That makes it useful, but it is not a complete picture:

- **OI is a snapshot, not real-time inventory.** Dealer positioning shifts within the day in ways OI does not capture.
- **The customer-long-call/customer-long-put convention can break.** During unusual flow conditions, the dealer-sign assumption can mis-attribute exposure.
- **Macro events override structure.** A CPI surprise or an FOMC statement can swamp the dealer reflex.
- **Single-stock catalysts can move index GEX indirectly.** Earnings, M&A, and component news can reshape SPX flow in ways that show up in GEX with a lag.
- **Sticky-strike vs. sticky-delta** assumptions matter for spot-shift implementations; different vendors handle this differently.

The right framing is that GEX is the cleanest single read on dealer-driven structural force in the tape — not the only force, not a forecast, and not a substitute for risk management.

---

## How ZeroGEX surfaces gamma exposure

The dashboard centralizes the live reads:

- **The Net GEX card** shows the dealer-gamma-at-spot value (sign-consistent with the flip, computed from one curve).
- **The Gamma Flip card** shows the current flip level with live distance from spot.
- **The Call Wall and Put Wall cards** plot the live structural boundaries.
- **The strike-profile chart** plots the dealer gamma profile across strikes — the curve from which Net GEX and the flip are both derived.
- **The strike-by-DTE heatmap** breaks gamma down by expiry bucket, surfacing the 0DTE concentration that increasingly dominates the intraday read.

![ZeroGEX dashboard overview showing Net GEX, Gamma Flip, Call Wall, and Put Wall cards](/blog/zerogex-dashboard-overview.png)

A worked example. Suppose SPX is at 5,830 and the dashboard shows:

- **Net GEX:** +$1.5B
- **Gamma Flip:** 5,810
- **Call Wall:** 5,850
- **Put Wall:** 5,790

The composite read: spot is comfortably in long-gamma territory ($20 above the flip), Net GEX is a substantial positive number indicating real magnitude in the dealer book, and the wall range is asymmetric with the call wall closer than the put wall. The practical lean: dampened vol regime, mean-reversion-friendly tape, breakouts more likely to fade than extend, and pin behavior toward heavy gamma concentration on the table into the close. None of that is a trade signal — it is the structural backdrop against which every other tool you use should be calibrated.

![ZeroGEX strike-profile chart with the dealer gamma curve, flip line, and walls highlighted](/blog/zerogex-strike-profile-overview.png)

Now imagine the same dashboard 90 minutes later: Net GEX has decayed to +$300M and the gamma flip has drifted up to 5,825 while spot has slipped to 5,818. The regime is now contested — spot is technically below the flip, but only by a few points, and the magnitude has thinned out. That is exactly the structural state where both regimes are partially active, behavior gets unstable, and the right discipline is usually to wait for a cleaner read before committing.

---

## Takeaway

> Gamma exposure is not a prediction. It is a regime read — the structural force in the dealer book that shapes how the tape behaves, but does not on its own dictate direction.

The discipline is to lead with the regime, read the structure inside it, watch how both migrate through the session, and let GEX filter which playbook makes sense rather than treating it as a signal in its own right. Most of the edge in dealer-positioning analysis is in *not taking* the trades that fight the dealer reflex.

Educational content only — none of the above is a trade recommendation.

---

If you want to see today's [full gamma exposure read in real time](/real-time-gex-0dte) — Net GEX, the gamma flip, the call and put walls, and the dealer gamma profile — [the free ZeroGEX dashboard](/spx-gamma-levels) surfaces all of it. For a side-by-side of how ZeroGEX compares with other gamma-exposure platforms, see [the best GEX tools guide](/education/best-gex-tools).
