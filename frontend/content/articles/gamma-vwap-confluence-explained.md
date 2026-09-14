# Gamma / VWAP Confluence Explained — and Why Two Symbols Can Disagree

*What the confluence score measures, how the cluster is built, why the gamma regime flips the same picture from a fade into a breakout, and why SPX, SPY and QQQ can point opposite ways on the same afternoon.*

---

## The question it answers

Every dealer-positioning level answers a slightly different question. The [gamma flip](/education/how-to-read-a-gamma-flip) marks the regime boundary. The [walls](/education/gamma-walls-explained) mark concentrated one-sided gamma. [Max pain](/education/max-pain-explained) marks a settlement magnet. [Pin Strike](/education/pin-strike-explained) marks a reachable same-day attractor. VWAP marks where the session's volume actually traded.

On most days they are scattered, and you read them one at a time. Occasionally several land in the same small band of price — and that is a different situation, because independently calculated levels agreeing is more informative than any one of them alone.

Gamma / VWAP Confluence measures exactly that: **are key levels stacking up here, and what does it mean that price is where it is relative to them?**

It is a score from −100 to +100. The sign is directional, the magnitude is confidence, and the regime decides how to read both.

---

## How the cluster is built

The cluster always starts from two members: **the gamma flip and VWAP**. Those two are the core, and they are what the "confluence" is anchored on.

Three more levels can join if they are close enough — **max pain, max gamma (the GEX King) and the call wall**. Each is admitted if it sits within **0.15% of the midpoint between the flip and VWAP**. That is a tight test: on SPX at 7,700 it is about 11 points.

So a card reading `Members: 2` means only the flip and VWAP are in play. `Members: 4` means two of the optional levels came along too, and the zone is genuinely crowded.

The **confluence level** is simply the average of whichever members qualified. That is the price the whole signal is measured against.

Each extra member above the core two adds 15% to the score's magnitude. Four members is a 1.30× multiplier on the same geometry — the model's way of saying a four-level stack deserves more attention than a two-level one.

---

## Quality: how tight is the cluster?

Membership is one thing; tightness is another. The **cluster gap** is the distance between the flip and VWAP, as a percentage of price, and it drives **cluster quality**:

```
cluster_quality = 1 − (cluster_gap % ÷ 1.0%)     floored at 0.05, capped at 1.00
```

A flip and VWAP 0.1% apart give a quality near 0.90. A gap of 0.6% gives about 0.40. Anything past 1.0% floors at 0.05.

That floor matters, and it is deliberate. Rather than declaring "no confluence" and returning zero, the model keeps a fractional reading, because a hard zero should be a rare extreme rather than an everyday output. The practical consequence: **when quality is at or near the floor, the score is tiny even if price is far from the cluster.** A score of −5 is not a weak bearish signal, it is the model telling you the two anchor levels are nowhere near each other and there is no real cluster to read.

The card says so directly. Below a score of ±20 it reads **"No confluence edge"** rather than naming a direction.

---

## The regime decides what the cluster means

This is the part that surprises people, and it is the single most important idea on the page.

The score starts from where price sits relative to the cluster:

```
distance = (price − confluence level) ÷ price
```

That distance is scaled so that roughly **±0.3% saturates the reading** — beyond that, being further away adds nothing, because the model is not trying to measure how far price has gone, only which side it is on and whether it has committed.

Then the [gamma regime](/education/what-is-negative-gamma) decides what that means:

- **Negative gamma → continuation.** Dealer hedging amplifies moves. Price that has left the cluster is expected to keep going. Above the cluster reads bullish; below reads bearish.
- **Positive gamma → mean reversion, and the sign inverts.** Dealer hedging damps moves. The same picture now argues that price gets pulled *back* to the cluster. Above the cluster reads **bearish**, because the expected move is down toward it. The reading is also damped to 70% of its magnitude, because a fade is a weaker claim than a breakout.

So the identical arrangement of levels — same cluster, same side, same distance — produces **opposite scores** in the two regimes. That is not a contradiction. It is the whole point: in one regime the market runs from the level, and in the other it returns to it.

---

## Why SPX, SPY and QQQ can disagree

This follows directly, and it is the question that prompted this page.

Two symbols can produce opposite confluence scores on the same afternoon, both working perfectly, for two independent reasons.

**First, they can be in different gamma regimes.** SPX and SPY track the same index but carry different option books, and QQQ is a different index entirely. Each has its own net gamma and its own flip. If one sits in negative gamma and another in positive, the sign inverts on one and not the other. Same tape, opposite scores.

**Second, each has its own cluster in its own place.** The confluence level is built from that symbol's flip, that symbol's VWAP and that symbol's walls. Those do not sit at the same relative position across symbols. Price can be above SPX's cluster and below QQQ's at the same moment, which flips the sign again.

Either reason alone reverses the reading. Both together are ordinary.

The practical guidance: **do not use one symbol's confluence score to trade another.** Read the score for the instrument you are trading. If you want a cross-check between symbols, compare regimes and clusters directly rather than comparing the scores, because the scores have already folded both of those in.

---

## It is a live reading, not a session bias

The score is recalculated continuously. It is not a morning call that holds until the close.

When price crosses the confluence level, the sign flips — and because the score history is coloured by the current sign, the whole line repaints. The path has not changed; its colour has. A history that was green all morning and is now red is showing you the same data under a new sign.

This also means the score only updates while the market is open. A flat line into the evening is the last stored value, not a signal still running.

There is a reasonable instinct to want the reading smoothed so it persists through a session and catches larger reversals. That would break it. The signal's only job is to say what is true *now*; a version that held its opinion through a regime change would be telling you about a market that no longer exists.

---

## The expected target

Each card publishes an expected target, and it means different things by regime:

- **Mean reversion:** the target is the confluence level itself. The claim is that price returns to the cluster.
- **Continuation:** the target is projected past price, twice the distance it has already travelled from the cluster. The claim is that the move extends.

Two honest caveats. The target is geometric — it does not scale with the score, so a low-confidence card can still print a distant target. Read it alongside the score and the quality, not on its own. And in continuation it is an extrapolation, not a measured level: nothing in the option book says price stops there.

---

## Honest limits

**Dealer sign is modeled, not observed.** As everywhere else on the platform, whether dealers are long or short a contract is a convention applied to public open interest, not a fact read off the tape. The regime that drives the sign inversion above inherits that assumption.

**The cluster is arithmetic, not judgement.** The confluence level is a plain average of qualifying members. It does not weight a wall by size or a flip by how firmly it resolved.

**Two members is the floor, not a recommendation.** Every card has at least the flip and VWAP, so `Members: 2` with a wide gap is the model reporting a non-cluster, not finding one. Check quality before reading the sign.

**It is a positioning read, not a forecast.** Like every gamma level, it describes what hedging *tends* to do around a structure. A catalyst overwhelms it, and a level that has been respected all morning stops mattering the moment something larger arrives.

---

## Reading it in practice

1. **Check quality and members first.** Low quality means there is no cluster, whatever the sign says. Below ±20 the card says "No confluence edge" and means it.
2. **Then check the regime badge.** Continuation and Mean Reversion are opposite trades from the same picture, and the badge tells you which one the model is making.
3. **Then read the sign and the level.** In mean reversion the confluence level is the destination. In continuation it is the thing price is leaving.
4. **Read it per symbol.** SPX, SPY and QQQ each get their own regime and their own cluster.

You can see the live score, the level stack and the score history on the [Gamma / VWAP Confluence](/gamma-vwap-confluence) page.
