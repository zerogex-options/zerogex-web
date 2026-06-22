# What Does Negative Gamma Mean? A Plain-English Explainer

*What does negative gamma mean — and why should an options trader care? In short: it means dealer hedging amplifies moves instead of dampening them. Here's what the term actually refers to, how to spot a negative-gamma regime in real time, and what changes in your trading when you're in one.*

---

## The short answer

**Negative gamma** in options-flow context means the dealers who sit on the other side of customer option trades have a net-short-gamma book. The practical consequence: when SPY rises, they have to *buy* SPY to stay hedged, and when SPY falls, they have to *sell* SPY. Their hedging trades go **with** the direction of price — not against it.

That mechanical reflex turns the dealer book into an amplifier. Selloffs accelerate. Rallies extend. Realized intraday volatility tends to be higher than implied. Pin behavior breaks down. The same chart setup that worked yesterday (when dealers were long gamma and absorbing moves) gets crushed today (when they're short gamma and chasing).

The opposite — **positive gamma** — is the more common SPY default during most calm sessions. Dealers are long gamma, hedge against the move, and dampen volatility. The full picture is covered in the [Gamma Exposure pillar](/education/gamma-exposure-explained); this piece focuses specifically on what "negative gamma" means and how to recognize it.

---

## What "negative gamma" actually refers to

Gamma is a second-order option Greek that measures how an option's delta changes as the underlying moves. A signed "gamma exposure" number is the aggregate gamma across the dealer book, with calls (typically held short by dealers) contributing positively and puts (also typically held short) contributing negatively.

When the *net* of those signed contributions is negative, the dealer book is short gamma overall. The conventional way this appears in flow tooling: Net GEX < 0.

The standard customer-long-call / customer-long-put assumption means dealers are typically short both — but the *magnitudes* shift with positioning. When customer demand skews heavily toward puts (e.g., during fear regimes), the dealer book's net gamma can flip negative; when it skews toward calls (e.g., calm uptrends), the book is long gamma.

The single most useful summary stat: the **gamma flip** — the price at which the dealer gamma profile crosses zero. Above the flip, dealers are typically long gamma (positive). Below the flip, short gamma (negative). Reading the flip is essentially reading the regime line. See [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Why negative gamma amplifies moves

The mechanical chain:

1. Dealers' net delta exposure is short-gamma. As spot rises, their option-portfolio delta drops (they become more short relative to neutral).
2. To stay delta-neutral, they must **buy** the underlying to offset the drop.
3. That buying happens at the same moment customers are rallying the tape. It adds to the momentum.
4. As spot drops, the opposite: dealer option delta rises (they become more long relative to neutral); to neutralize, they **sell** the underlying. That selling adds to the downside.

In both directions, dealer hedging *reinforces* the move. The reflex is procyclical. The bigger the dealer short-gamma exposure, the more underlying flow each percent move requires.

Compare to **positive gamma**, where the same flow chain inverts: dealers sell into strength and buy into weakness, dampening the move. The structural force in the tape is countercyclical. The same news that produces a 0.5% intraday range in a long-gamma regime can produce a 2% range in a short-gamma regime.

---

## Negative gamma vs. positive gamma side by side

| | Positive gamma (long-gamma) | Negative gamma (short-gamma) |
|---|---|---|
| Dealer hedging reflex | Sell strength, buy weakness | Buy strength, sell weakness |
| Realized vol vs. implied | Tends to be **lower** | Tends to be **higher** |
| Breakouts | Often fade and snap back | Often extend |
| Selloffs | Often get absorbed near walls | Often accelerate |
| Pin behavior | Magnets pull price toward heavy strikes | Magnets release price; no pin |
| Best playbook | Mean-reversion, fade extremes, premium-selling | Trend continuation, momentum, breakout |
| Worst playbook | Chasing breakouts, momentum | Fading rallies, dip-buying into structure |
| Typical when | SPY above the gamma flip, Net GEX > 0 | SPY below the gamma flip, Net GEX < 0 |

These are general regime leans, not guarantees. Catalysts and shocks override them. But the base rate is meaningful enough that running the wrong playbook for the regime is most of the cost.

---

## How to spot a negative-gamma regime in real time

A short workflow:

1. **Check the gamma flip first.** If SPY is below the flip, you're in a short-gamma regime by definition.
2. **Confirm with Net GEX.** A negative Net GEX value is the magnitude read — the more negative, the sharper the regime. Net GEX near zero is a contested regime; both reflexes are partially active.
3. **Cross-check the realized vol picture.** Short-gamma regimes show up as wider intraday ranges than the day's open implied vol suggested. If realized is expanding while implied is flat, that's the regime signature.
4. **Watch wall behavior.** In short-gamma regimes, walls weaken or invert. The call wall that was capping rallies yesterday can become a breakout target today.
5. **Watch flow direction at the close.** Short-gamma into the close often produces accelerating directional moves (the EOD pressure signal becomes a continuation read, not a fade read).

---

## What changes in your trading

Concretely, things to *stop* doing in a negative-gamma regime:

- **Don't fade rallies.** The dealer reflex is amplifying. Your "mean-reversion short" is fighting the structural buying flow.
- **Don't buy dips into structure.** Same problem inverted. The put wall that was supporting the tape in long-gamma can become a slippage point in short-gamma.
- **Don't expect pinning.** The structural pull toward heavy strikes is off. The magnet thesis doesn't apply.
- **Don't size for a normal range.** Realized vol is structurally higher. Position size assuming wider stops are needed.

Things to *start* doing:

- **Trade with the move.** Trend-following setups have a higher hit rate.
- **Treat walls as breakout targets, not resistance.** The same level you'd have faded in long-gamma might be a continuation entry in short-gamma.
- **Be more selective on entry timing.** Wider ranges mean more risk per trade. Compensate with tighter setup criteria.
- **Watch for regime flips back to positive gamma.** They happen — the flip is dynamic. When spot crosses back above the gamma flip, the playbook flips with it.

---

## Worked example

SPX opens the day at 5,780. ZeroGEX shows:

- **Net GEX:** −$1.1B (negative — short-gamma regime)
- **Gamma Flip:** 5,810 (spot 30 points below)
- **Call Wall:** 5,820
- **Put Wall:** 5,750

Through the morning, SPX grinds higher to 5,800. The instinct on a long-gamma day would be to start fading rallies into the 5,810 flip and the 5,820 call wall.

The structural read here says the opposite. SPX is in short-gamma territory; dealer hedging is amplifying. The push toward 5,810 might extend through it rather than fade — especially if Net GEX is decaying further negative. The 5,820 call wall in this regime is more likely to act as a breakout target than as resistance.

The practical lean: skip the fade. Either trade with the momentum or stand aside. Reverse the playbook from a typical long-gamma day.

Now imagine the same chart with Net GEX at +$1.2B and the gamma flip at 5,760 (spot 40 points above). The structural read inverts: 5,820 likely acts as resistance, the long-gamma reflex absorbs rallies, the fade setup is on. Same tape, opposite read, depending on a single regime variable.

---

## Common misconceptions

- **"Negative gamma is bearish."** It is not. It is **vol-amplifying**. The market can rally hard in a negative-gamma regime — and the rally tends to extend further than it would in long-gamma. Negative gamma is about *character of moves*, not direction.
- **"Positive gamma is bullish."** Also no. Positive gamma is **vol-dampening**. The market can drift down in a positive-gamma regime; it just tends to do so slowly with mean-reverting bounces along the way.
- **"You can trade negative-gamma signals the same as positive-gamma signals."** Most retail loss comes from this. The signals and the structural reads invert across regimes. A "buy the dip" thesis that works above the flip can compound losses below it.
- **"Negative gamma is rare."** It happens regularly — particularly after vol spikes, during macro stress, and when the chain is heavily put-skewed. Knowing the regime in real time is what tells you when.

---

## Takeaway

> Negative gamma means dealers amplify the move instead of dampening it. Same chain, same SPY, opposite tape character — and opposite playbooks for the trader who can read the regime.

The discipline is to start every session with the regime read: where's the gamma flip, where's spot, what's Net GEX? Those three numbers tell you which playbook the structural force in the tape is going to support today. Running the wrong playbook against the regime is the most expensive mistake on the menu.

Educational content only — none of the above is a trade recommendation.

---

If you want to see today's Net GEX, gamma flip, and live regime read for SPY, SPX, and QQQ — the three numbers that tell you whether dealers are long gamma or short gamma right now — the free ZeroGEX gamma-levels view surfaces all of them.
