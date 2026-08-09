# Pin Strike Explained: The Reachable 0DTE Gamma Pin

*Pin Strike is the reachable 0DTE strike with the strongest modeled positive dealer-gamma stabilization into expiration. What it is, how it's built, why it is deliberately not "the biggest gamma strike," and why it is allowed to return no active pin.*

---

## The problem Pin Strike is trying to solve

By the last few hours of a 0DTE session, one question dominates the tape: *if price drifts, where does it want to settle?* Traders reach for a grab-bag of levels to answer it — the call wall, the put wall, max pain, the largest gamma strike — and each one answers a slightly different question, none of them exactly the one being asked.

Pin Strike is a purpose-built answer to that specific question. It estimates the nearby strike with the strongest combination of two things:

1. **Stabilizing dealer gamma *at that strike*** — would dealer hedging there lean *against* moves (pull price back), and
2. **Reachability** — can price realistically get to, and finish near, that strike before the 0DTE close?

Both halves matter, and the second one is what makes Pin Strike different from every other level on the board. A strike can carry an enormous gamma footprint and still be a terrible pin candidate if price has no realistic chance of reaching it into the bell. Pin Strike is built to demote those unreachable giants and surface the reachable node that price can actually be organized around.

If you're new to the underlying mechanics, the [Gamma Exposure pillar](/education/gamma-exposure-explained) covers how dealer gamma drives hedging, [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) covers the regime line, and [Max Pain Explained](/education/max-pain-explained) covers the settlement-magnet idea Pin Strike is often confused with. This piece assumes that background and builds on it.

---

## What is a pin, mechanically?

A "pin" is a self-reinforcing equilibrium created by dealer delta-hedging in a **positive-gamma** neighborhood. The mechanism is worth stating precisely, because Pin Strike is a direct attempt to measure it.

When dealers are net long gamma around a strike, their hedge is *stabilizing*: as price rises toward the strike they must sell the underlying, and as price falls toward it they must buy. That hedging leans against the move from both sides — it's a restoring force that pulls price back toward the node and damps realized volatility around it. The heavier and more concentrated that positive gamma, the stronger the restoring force, and the more price tends to get "stuck" near the strike into expiration.

The opposite regime matters just as much. When dealers are net *short* gamma around a level, hedging is *destabilizing* — they sell into weakness and buy into strength, amplifying moves rather than damping them. A short-gamma neighborhood cannot pin; it does the reverse. So the raw material for a pin is specifically **locally concentrated, net-positive dealer gamma** — not gamma in general, and not gamma somewhere else on the chain.

One honest caveat up front, the same one that applies to every dealer-positioning read on the platform: the sign of dealer gamma is a **modeled convention**, not a directly observed fact. Public open interest does not reveal whether dealers are long or short any given contract. ZeroGEX uses the standard SPX-style convention — dealers modeled long the calls customers overwrite (positive gamma) and short the puts customers buy (negative gamma) — and Pin Strike reuses that exact convention rather than inventing a second one. It is a model of positioning, and it is described throughout as what hedging *tends* to do, never as a guarantee.

---

## The key idea: price the book *as if spot were at the strike*

Here is the conceptual move that makes Pin Strike work, and the one most level tools skip.

Gamma is not a fixed property of a strike. A contract's gamma depends on where spot is *right now* relative to that strike — it peaks when the option is at-the-money and falls away as it moves in- or out-of-the-money. So the gamma a strike shows *today, at the current price* tells you how much that strike is contributing to hedging **here**. It does **not** tell you how much stabilizing force would exist **there**, if price actually traveled to that strike.

But "there, if price traveled to it" is exactly the question a pin is about. A pin is a hypothetical: *were price to arrive at strike K, would the book hold it?*

So Pin Strike answers the hypothetical directly. For each candidate strike `K`, it **simulates the entire options book as though spot were sitting at `K`** and re-prices every contract's gamma at that hypothetical spot using the same Black-Scholes gamma the rest of the platform uses. It then signs and scales that re-priced gamma into dealer dollar-gamma with the platform's canonical convention:

```
GEX_i(K) = dealer_sign_i × gamma_i_at_K × OI_i × 100 × K² × 0.01
```

Read that carefully: the spot in the dollar-gamma formula is `K` itself (so the `S²` scale becomes `K²`), because we are pricing the world in which spot *is* `K`. `dealer_sign_i` is `+` for calls and `−` for puts (the modeled convention above), `OI_i` is open interest, `100` is the contract multiplier, and the trailing `× 0.01` puts everything on the industry-standard "dollars of hedging per 1% move" footing. It is the identical GEX convention used for the walls and the gamma flip — Pin Strike does not introduce a competing definition of dealer gamma; it just evaluates the existing one at a different, hypothetical spot.

This is the crux of why Pin Strike is a genuinely different metric and not a repackaged largest-GEX read: it is built on *counterfactual* gamma (what the book would be at K), not *current* gamma (what the book is now).

---

## Local restoring gamma: a pin is a neighborhood, not a chain total

A pin is a *local* feature. It's about the gamma clustered right around a strike, not the aggregate gamma of the entire chain, and certainly not gamma sitting hundreds of points away. So for each candidate `K`, Pin Strike weights each contract's contribution by how close that contract's strike is to `K`, using a Gaussian kernel:

```
kernel(K, strike_i) = exp( −(strike_i − K)² / (2 × bandwidth²) )
```

Contracts sitting right at `K` count fully; contracts a few strikes away count for less; contracts far away contribute essentially nothing. Summing the kernel-weighted dealer GEX gives the **local gamma** at `K`:

```
local_gex(K) = Σ  GEX_i(K) × kernel(K, strike_i)
```

The `bandwidth` — how wide "nearby" is — is not hardcoded, because strike grids differ across products (SPY and QQQ list dollar-wide strikes near the money, SPX prints every five points, NDX coarser still). Pin Strike derives the bandwidth from the **median spacing of the nearby listed strikes**, so the kernel automatically scales to whatever product it's looking at. This is a configurable parameter, not a magic number.

Then the decisive step. Only a *positive* local gamma can pin:

```
restoring_gex(K) = max( local_gex(K), 0 )
```

If the neighborhood around `K` is net short dealer gamma — a destabilizing, move-amplifying pocket — its restoring score is zero. It is not a weak pin; it is *not a pin at all*, and it is scored accordingly. This single `max(·, 0)` is what encodes the physics: pins are made of positive gamma, full stop.

---

## Reachability: why the biggest node doesn't automatically win

Local restoring gamma tells you how *strong* a pin would be if price got there. It says nothing about whether price *can* get there. Distance is the missing half.

Consider a session where spot is at 772 and there's a colossal positive-gamma node at 820. That node might have ten times the restoring gamma of a modest node at 773 — but with a few hours left in the session and volatility where it is, 820 is essentially out of reach. Treating it as the pin would be nonsense. Price is not going to organize itself around a level it can't travel to before the close.

So Pin Strike multiplies each candidate's restoring gamma by a **reachability weight** derived from how far the strike is, measured in the market's own units of "expected move." Using current spot, a representative implied volatility, and the *actual* remaining time to expiration:

```
z(K)            = ln(K / spot) / (σ × √τ)
reachability(K) = exp( −½ × z² )
```

`z` is the log-distance to the strike expressed in standard deviations of the terminal price distribution — the number of expected moves away it sits. `reachability` is the (unnormalized) Gaussian density at that distance: it is `1.0` for a strike right at spot and decays smoothly toward zero as the strike moves further away than volatility-and-time can plausibly carry price. Because distance is measured in `σ√τ` units, the same formula works identically across SPY, QQQ, SPX and NDX with no per-symbol dollar constants.

Two inputs in that formula deserve emphasis, because they're where reachability earns its keep:

- **`σ` is a representative at-the-money implied vol**, taken from the near-the-money 0DTE options themselves (the same ATM-IV basis the platform uses elsewhere). It is not a fabricated default — if there is no usable ATM IV, reachability can't be trusted and the metric declines to produce a pin rather than inventing a number.
- **`τ` is the *actual intraday* time remaining to the 0DTE settlement**, in years — seconds to the close, not a lazy `1/365`. This matters enormously for 0DTE: at 10:00 a.m. a strike five points away is very reachable; at 3:45 p.m. the same strike may be several expected moves out. Reachability collapses as the clock runs down, exactly as a real into-expiration pin does.

---

## Putting it together: the Pin Score

Each candidate strike gets a single score — the product of the two halves:

```
pin_score(K) = restoring_gex(K) × reachability(K)
```

A strike wins only by being **both** a strong positive-gamma node **and** realistically reachable. A huge node that's unreachable scores near zero (reachability kills it). A perfectly reachable strike with no positive local gamma scores exactly zero (restoring gamma kills it). The Pin Strike is the listed strike with the maximum `pin_score`.

Candidates are restricted up front to strikes within roughly a couple of expected moves of spot — the only strikes with meaningful reachability — so the simulation stays cheap and never even considers the far tail. And only **actual listed strikes** are ever returned, so the Pin Strike is always a real, quotable contract.

Alongside the strike, Pin Strike reports a **confidence** — how dominant the winner is over the other viable pins:

```
pin_confidence = max_pin_score / Σ (all positive pin_scores)
```

A confidence near 1.0 means one node overwhelmingly owns the reachable positive-gamma landscape — a clean, singular pin. A low confidence means several comparable candidates are competing, and price is more likely to slosh between them than to lock onto one. The raw maximum score is retained too, because concentration alone can mislead when *every* score is tiny — a "dominant" pin among negligible candidates is still negligible.

---

## Why Pin Strike is not the other levels

Pin Strike sits in a family of dealer-positioning levels, and its whole value is in being genuinely distinct from each of them. The differences are not cosmetic:

- **Call Wall / Put Wall** — the strikes above and below spot with the largest *current* one-sided call/put gamma. They mark the dominant concentrations of resistance and support at *today's* price. Pin Strike is not about the largest one-sided concentration and not measured at today's price — it's about *net* local stabilization evaluated at each candidate strike as if price were there. See [Gamma Walls Explained](/education/gamma-walls-explained).

- **Gamma Flip** — the hypothetical spot at which *aggregate* dealer gamma changes sign; the boundary between the stabilizing and destabilizing regimes for the whole book. The flip is a regime line; Pin Strike is a specific magnet *inside* a stabilizing regime. (In fact, if spot sits below the flip in net-short-gamma territory, Pin Strike will often find nothing to pin to — which is the correct answer.) See [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

- **Max Pain** — the settlement strike that minimizes aggregate option-holder intrinsic payout. It uses only open interest and strikes — no Greeks, no volatility, no dealer-sign, and no notion of reachability or of *how* dealers hedge. It's an accounting-of-payouts level. Pin Strike is a hedging-mechanics level. They frequently disagree, and when they agree it's usually because heavy gamma and heavy OI happen to coincide. See [Max Pain Explained](/education/max-pain-explained).

- **King Node / largest-GEX strike** — simply the strike with the biggest *current* dollar gamma. This is the one Pin Strike is most often mistaken for, and the reachability weight is precisely what separates them. **Pin Strike deliberately does not select the highest-GEX strike.** The King Node ignores whether price can reach it and ignores whether the node is net-stabilizing; Pin Strike is built to demote an unreachable or short-gamma giant in favor of a reachable positive-gamma node. When the two coincide, it's because the dominant gamma also happens to be near spot and stabilizing — a meaningful confirmation, not a redundancy.

The one-line version: **the walls are concentration, the flip is a regime boundary, max pain is a payout minimum, the King Node is raw size — and Pin Strike is reachable, net-positive, local stabilization into expiration.**

---

## Why 0DTE only, and why open interest

Two scoping choices are worth making explicit.

**Pin Strike is a 0DTE metric.** It uses only the nearest same-day expiration and does not blend in weeklies, monthlies, or longer-dated gamma. That's deliberate: a pin is an *into-the-close* phenomenon. Same-day gamma is what's resolving today, its reachability window is measured in hours, and its `1/√τ` gamma profile sharpens dramatically into the bell — which is exactly the regime where pinning is a real, observable behavior. Longer-dated gamma is a structural backdrop, not an intraday magnet, and mixing it in would blur the very effect the metric is trying to isolate. Pin Strike is therefore an intraday, into-expiration read — not a broad structural options level.

**Pin Strike uses the same open-interest basis as the core GEX engine.** It does not attempt to adjust positioning using intraday flow — no opening-versus-closing inference, no live re-weighting of OI. That kind of flow adjustment introduces real additional uncertainty and is a separate problem; folding it into the pin would make the metric harder to trust, not easier. The pin you see is built on the same positioning basis as every other dealer-gamma read on the platform, which keeps it consistent and interpretable.

---

## When Pin Strike comes into play

Pin Strike is most informative in a specific window and regime, and least informative outside it:

- **Late in a 0DTE session, in a positive-gamma regime.** This is its home turf. When spot is above the gamma flip and a reachable positive-gamma node exists, the Pin Strike marks where stabilizing hedging is concentrated, and price often mean-reverts around it into the close. It reads best as *the center of gravity of the current pinning range*, bracketed by the walls.

- **As a context level, not a target.** A Pin Strike is a modeled magnet, not a prediction that price will print there. It tends to describe where a range organizes, how tightly, and how confidently (via the confidence score) — not a guaranteed destination or a timing signal. It is context for a decision, never a decision.

- **Read alongside confidence and the walls.** A high-confidence pin sitting between a firm call wall and put wall is a coherent, well-defined pinning picture. A low-confidence pin, or a pin with the walls far away, is a much looser one. The number is only as meaningful as the structure around it.

And critically, it recognizes when *none* of that applies — which is the subject of the last section.

---

## When Pin Strike is null — and why we chose that

This is the part that most distinguishes Pin Strike from a naive "nearest heavy strike" tool: **it is allowed, and expected, to return no active pin.** A tool that always prints a level is easy to build and easy to misread — it manufactures false confidence on exactly the days when there's nothing to pin to. Pin Strike does the harder and more honest thing: when there is no meaningful positive-gamma pin, it returns nothing, and tells you *why*.

When there's no active pin, the metric reports one of the following reasons:

- **No 0DTE expiration** — there is no same-day expiration listed for the underlying. With no 0DTE chain, there is nothing for an intraday pin to be about.
- **Expired** — the 0DTE settlement instant has already passed (time-to-expiration ≤ 0), e.g. after the cash close. Reachability is undefined once the options have settled.
- **No positive restoring gamma** — the algorithm ran, but no reachable candidate has net-positive local dealer gamma. This is the meaningful, non-degenerate null: price is sitting in a short-gamma neighborhood where hedging is destabilizing, so *nothing pins*. Forcing a level here would be actively misleading — it would point at a strike that mechanically pushes price *away*, not toward it.
- **Insufficient IV data** — there is no usable at-the-money implied vol to anchor the reachability calculation, so distances can't be trusted. No arbitrary default vol is substituted.
- **Insufficient option data** — there is no valid 0DTE option data (no spot, or no contracts with usable open interest, IV, time, and strike), so there's nothing to model.
- **Pin score too weak** — an optional magnitude floor that suppresses a pin whose raw score is negligible. It is off by default, so it only ever fires when explicitly configured — the platform does not invent user-facing thresholds.

Two more everyday cases show up as an empty pin without a reason code: **historical replay frames** written before Pin Strike shipped simply carry no value (the line is omitted, and nothing is back-filled), and the **live gamma chart hides the pin during time-rewind**, because the pin is a summary-level value that isn't reconstructed for the per-minute rewind buffer.

The design principle underneath all of this: **an honest "no pin" is more useful than a forced one.** A negative-gamma, trending, or expiration-passed session genuinely has no gamma pin, and the correct output in those states is silence — not the nearest strike dressed up as a magnet. The metric surfaces exactly which of the conditions above applies, so a "—" is never ambiguous: it's a specific, inspectable statement about the market, not a gap in the data. In the interface this always renders as a dash — never a `0`, a `NaN`, or a misleading fallback strike.

---

## How to read it in one sentence

Pin Strike is the reachable 0DTE strike where re-pricing the book at that strike produces the strongest locally-concentrated, net-positive (stabilizing) dealer gamma into expiration — a modeled center of gravity for an into-the-close pinning range, reported with a confidence and, when the market offers no such node, deliberately reported as nothing at all.

To see it live alongside the walls, the flip and max pain, pull up [today's SPX / SPY / QQQ / NDX gamma levels](/spx-gamma-levels) and watch how the Pin Strike behaves into the final hour — and note the sessions where it goes quiet.
