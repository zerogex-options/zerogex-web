# 0DTE Dealer Positioning Explained

*Same-day expiries now dominate SPX flow. That changes how dealer gamma reads — and how the tape has to be read to keep up. 0DTE dealer positioning, explained for the practical intraday trader.*

---

## Why 0DTE changes the read

Dealer positioning has always mattered to options traders. What has changed in the last few years is the **dominance of 0DTE flow** in SPX and SPY. Same-day expiries now carry an outsized share of total gamma exposure, and because their gamma is concentrated near spot and decays into the close, the dealer hedging behavior they force is sharper, more reactive, and more regime-dependent than any prior chain structure.

If you trade SPX during the cash session and you are not reading dealer positioning through the 0DTE lens, you are reading a stale book.

This piece is the practical read for what "0DTE dealer positioning" and "dealer gamma 0DTE" actually mean in real time. We will cover why the 0DTE bucket matters more than longer-dated bucketing, what changes between negative- and positive-gamma regimes specifically for 0DTE, and how to read the tape differently in each. Pair this with [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip) for the regime line itself, [Gamma Walls Explained](/education/gamma-walls-explained) for the boundary levels, and the [Gamma Exposure pillar](/blog/gamma-exposure-explained) for the full structural background.

---

## What is 0DTE dealer positioning?

0DTE dealer positioning is the aggregate gamma exposure dealers carry on same-day-expiring options. Mechanically, it is no different from longer-dated dealer gamma — calls held short by dealers contribute positively to dealer gamma, puts held short contribute negatively, and the hedging reflex is the same: keep delta flat, trade the underlying as gamma changes.

What makes 0DTE different is the **gamma density**. Same-day options carry their largest gamma right at the money, and per-contract gamma scales roughly with `1/√T`. With `T` measured in fractions of a day, that denominator is small — and the gamma per contract becomes very large. A 0DTE strike near spot can outweigh a monthly strike at the same level by an order of magnitude.

The practical implication: the 0DTE bucket disproportionately dictates intraday dealer hedging. Even when total open interest is dominated by longer-dated strikes, the *gamma-weighted* exposure near spot is often a 0DTE story.

---

## Why dealer positioning matters most for 0DTE

Three things compound for 0DTE that do not compound the same way for longer-dated:

1. **Gamma concentration.** Same-day options carry very high gamma at the money. Hedging trades against that gamma are large per unit move, which makes near-spot price action mechanically louder.
2. **Charm decay.** As 0DTE options approach expiry, their delta drifts predictably toward 0 or 1 depending on moneyness. Dealers running a delta-neutral book have to re-hedge continuously into the close. That forced flow has a sign — and it is directly readable.
3. **Pin physics.** The same gamma concentration that makes 0DTE move dealers a lot per tick also makes the heaviest 0DTE strike a magnet in a long-gamma regime. Pin behavior tends to be sharper on 0DTE than on multi-day setups.

None of those mechanisms is unique to 0DTE — they apply to any short-dated option. They are just unusually loud in the 0DTE bucket because of how compressed `T` has become.

---

## Negative-gamma 0DTE regimes

When dealers are net short gamma — typically when spot is below the gamma flip — 0DTE flow gets noisy fast.

What the reflex does:

- A move up forces dealers to *buy*, amplifying the move.
- A move down forces dealers to *sell*, amplifying the move.
- Realized intraday vol tends to expand.
- Walls become less reliable as resistance and support — they can invert into breakout targets.
- Pin behavior near the heaviest 0DTE strike weakens or reverses.

What the tape tends to look like:

- Larger ranges, faster breakouts.
- Continuation moves more often than reversals.
- Mean-reversion entries against the trend frequently get steamrolled.
- Same-day option premiums tend to expand intraday rather than compress.

The practical lean in a short-gamma 0DTE regime is **with the move, not against it**. Trend-continuation setups tend to have better hit rates; fading the trend into 0DTE concentration is structurally fighting the dealer reflex.

---

## Positive-gamma 0DTE regimes

When dealers are net long gamma — typically when spot is above the gamma flip — 0DTE flow tends to compress.

What the reflex does:

- A move up forces dealers to *sell*, dampening the move.
- A move down forces dealers to *buy*, dampening the move.
- Realized intraday vol tends to compress.
- Walls behave more like genuine resistance and support.
- Pin behavior near the heaviest 0DTE strike strengthens into the close.

What the tape tends to look like:

- Tighter ranges, more chop, more failed breakouts.
- Pull-toward-the-heaviest-strike behavior, especially after 14:00 ET.
- Same-day option premiums tend to bleed.
- Mean-reversion setups tend to have better hit rates than trend-continuation.

The practical lean in a long-gamma 0DTE regime is **against the breakout, with the pin**. Faded rallies into the call wall, dip buys into the put wall, and short-premium structures all benefit from the dampening reflex.

---

## How to read the tape differently in each regime

A few habits that change between the two regimes:

**In a negative-gamma 0DTE regime:**

- Take breakouts of the recent range more seriously, especially when Net GEX is large and negative.
- Treat 0DTE walls as targets, not ceilings.
- Be skeptical of "this will pin" setups — the dealer reflex is not pulling.
- Size for wider stops; realized vol is structurally higher.

**In a positive-gamma 0DTE regime:**

- Default to fades of moves into 0DTE-concentrated strikes.
- Treat the heaviest gamma strike as a magnet, especially into the close.
- Be skeptical of breakouts — they fail more often.
- Tighter stops are more reasonable; ranges are more contained.

**In any regime:**

- Check whether spot is near the gamma flip. A contested regime is the worst regime to commit to either playbook.
- Check whether the heaviest 0DTE strike is migrating. A static heavy strike is a stronger pin candidate than a migrating one.
- Track Net GEX as a magnitude, not just a sign. A flip from −$2B to +$200M is a very different read than a flip from +$2B to +$200M.

---

## Reading 0DTE dealer positioning on ZeroGEX

The dashboard surfaces 0DTE-specific reads in a few places:

- **The Net GEX card** shows dealer gamma evaluated at spot (sign-consistent with the flip), giving you the magnitude of the current regime.
- **The strike-by-DTE GEX heatmap** breaks gamma down by expiry bucket so you can see how much of today's positioning is 0DTE-driven and where the heaviest same-day strikes sit.
- **The wall and flip cards** show today's structural levels with live distance from spot.

*[Image placeholder: ZeroGEX strike-by-DTE GEX heatmap with 0DTE bucket concentrated near spot — drop file at /public/blog/zerogex-strike-dte-heatmap.png]*

A worked example. Suppose SPX is at 5,825, Net GEX reads −$800M, the gamma flip sits at 5,840, and the heatmap shows a heavy 0DTE put strike at 5,820 that has been migrating down with price all morning. The structural read: dealers are short gamma, spot is below the flip, and the heaviest 0DTE strike is tracking the move rather than holding it.

Practical lean: this is a short-gamma, continuation-friendly regime, with the migrating put strike confirming rather than resisting downside. A trader who came into the session with a mean-reversion bias should be much more cautious here, because the 0DTE structure is actively pointing the other way. None of that is a trade signal — it is regime context that should reshape which entries you take seriously.

*[Image placeholder: ZeroGEX Net GEX and Gamma Flip cards showing a negative-gamma intraday read — drop file at /public/blog/zerogex-net-gex-flip-card.png]*

---

## Common mistakes when reading 0DTE dealer gamma

A short list of how 0DTE dealer positioning gets misread:

- **Using all-OI gamma in a 0DTE-dominant chain.** If most of today's gamma is 0DTE and you are reading aggregate-OI gamma, your read is averaging a near-expiry book with a far-dated book that does not matter for today's tape.
- **Treating walls as durable in a negative-gamma regime.** They are not. They become breakout targets.
- **Ignoring the regime and trading the level.** Spot at the put wall is one trade above the flip and a very different trade below it.
- **Ignoring migration.** A heavy 0DTE strike that has moved twice in the last hour is a different read than one that has been static all morning.
- **Treating 0DTE pin behavior as guaranteed.** It is a lean, not a promise. Catalysts and flow shocks routinely break the pin.

---

## Takeaway

> 0DTE has changed which part of the dealer book actually moves the tape. The total positioning matters; the *0DTE bucket* dominates the intraday read.

The discipline is the same as for any dealer-positioning read — start with the regime, then read the structure inside it — but the 0DTE bucket is where most of the gamma now lives during the cash session, and ignoring it puts you a session behind.

Educational content only — none of the above is a trade recommendation.

---

If you want to see today's 0DTE dealer positioning in real time — the regime, the heaviest same-day strikes, the live walls, and the dealer gamma profile — the free ZeroGEX dashboard surfaces all of it.
