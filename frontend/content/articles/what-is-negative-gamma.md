# What Does Negative Gamma Mean? A Plain-English Explainer

*What does negative gamma mean - and why should an options trader care? In short: it means dealer hedging amplifies moves instead of dampening them. Here's what the term actually refers to, how to spot a negative-gamma regime in real time, and what changes in your trading when you're in one.*

---

## The short answer

**Negative gamma** in options-flow context describes a regime: the dealers who sit on the other side of customer option trades are modeled to have a net-short-gamma book. The practical consequence: when SPY rises, they tend to *buy* SPY to stay hedged, and when SPY falls, they tend to *sell* SPY. Their hedging trades go **with** the direction of price - not against it.

That mechanical reflex turns the dealer book into an amplifier. Selloffs tend to accelerate. Rallies tend to extend. Realized intraday volatility tends to run higher than implied. Pin behavior tends to break down. The same chart setup that worked yesterday (when dealers were long gamma and absorbing moves) gets crushed today (when they're short gamma and chasing).

The opposite - **positive gamma** - is the more common SPY default during most calm sessions. Dealers are long gamma, hedge against the move, and dampen volatility. The full picture is covered in the [Gamma Exposure pillar](/education/gamma-exposure-explained); this piece focuses specifically on what "negative gamma" means and how to recognize it.

---

## What "negative gamma" actually refers to

Gamma is a second-order option Greek that measures how an option's delta changes as the underlying moves. A signed "gamma exposure" number is the aggregate gamma across the *modeled* dealer book. Raw gamma is positive for any *long* option - call or put - so the sign has to come from an assumption about what dealers hold: calls modeled as held long (contributing positive gamma) and puts modeled as held short (contributing negative gamma). The minus sign on the put side is the modeled *short* position, not puts being "negative gamma" by nature.

When the *net* of those signed contributions is negative, the book is modeled as short gamma overall. The conventional way this appears in flow tooling: Net GEX < 0.

> This is a modeled convention, not observed inventory. It uses the traditional call-positive / put-negative open-interest assumption; actual dealer positioning is not directly observable from public option-chain data.

The standard convention - customers overwrite calls and buy puts for protection - means dealers are typically long calls and short puts, but the *magnitudes* shift with positioning. When customer demand skews heavily toward puts (e.g., during fear regimes), the dealer book's growing short-put inventory can push net gamma negative; when calls dominate (e.g., calm uptrends where overwriting builds dealer long-call gamma), the book is modeled long gamma.

The single most useful summary stat: the **gamma flip** - the price at which the dealer gamma profile crosses zero. Above the flip, dealers are typically long gamma (positive). Below the flip, short gamma (negative). Reading the flip is essentially reading the regime line. See [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Why negative gamma amplifies moves

The mechanical chain:

1. Dealers' net delta exposure is short-gamma. As spot rises, their option-portfolio delta drops (they become more short relative to neutral).
2. To stay delta-neutral, they generally **buy** the underlying to offset the drop.
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
| Breakouts | Hedging leans against them | Hedging adds to them once a level gives way |
| Selloffs | Hedging buys into them | Hedging sells into them, so they can accelerate |
| Pin behavior | Price tends to get pulled toward heavy strikes | Pinning tends to weaken or release |
| Best playbook | Mean-reversion, fade extremes, premium-selling | Trend continuation, momentum, breakout |
| Worst playbook | Chasing breakouts, momentum | Fading rallies, dip-buying into structure |
| Typical when | SPY above the gamma flip, Net GEX > 0 | SPY below the gamma flip, Net GEX < 0 |

These are general regime leans, not guarantees. Catalysts and shocks override them. What they change is the mechanism behind a trade, not how often walls break: in our measurement, walls held about as often on either side of the flip.

---

## How to spot a negative-gamma regime in real time

A short workflow:

1. **Check the gamma flip first.** If SPY is below the flip, the model puts you in a short-gamma regime.
2. **Confirm with Net GEX.** A negative Net GEX value is the magnitude read - the more negative, the sharper the regime. Net GEX near zero is a contested regime; both reflexes are partially active.
3. **Cross-check the realized vol picture.** Short-gamma regimes show up as wider intraday ranges than the day's open implied vol suggested. If realized is expanding while implied is flat, that's the regime signature.
4. **Watch what happens after a wall gives way.** In short-gamma regimes, hedging adds to the move instead of leaning against it, so a break can keep going where it would have stalled in long gamma. How often walls broke did not change with the regime in our measurement; the difference the model expects is in what follows a break.
5. **Watch flow direction at the close.** Short-gamma into the close often produces accelerating directional moves (the EOD pressure signal becomes a continuation read, not a fade read).

---

## What changes in your trading

Concretely, things to *stop* doing in a negative-gamma regime:

- **Don't fade rallies.** The dealer reflex is amplifying. Your "mean-reversion short" is fighting the structural buying flow.
- **Don't buy dips into structure.** Same problem inverted. If the put wall gives way in short gamma, hedging adds to the slide instead of cushioning it, so it can become a slippage point.
- **Don't expect pinning.** The structural pull toward heavy strikes tends to weaken, so the magnet thesis is far less reliable here.
- **Don't size for a normal range.** Realized vol is structurally higher. Position size assuming wider stops are needed.

Things to *start* doing:

- **Trade with the move.** Trend-following setups have the hedging behind them.
- **Size any position against a wall for the break.** A wall held about as often in short gamma as in long in our measurement, but if it gives way here, hedging adds to the move, so a position betting on the wall can run further against you.
- **Be more selective on entry timing.** Wider ranges mean more risk per trade. Compensate with tighter setup criteria.
- **Watch for regime flips back to positive gamma.** They happen - the flip is dynamic. When spot crosses back above the gamma flip, the playbook flips with it.

---

## Worked example

SPX opens the day at 5,780. ZeroGEX shows:

- **Net GEX:** −$1.1B (negative - short-gamma regime)
- **Gamma Flip:** 5,810 (spot 30 points below)
- **Call Wall:** 5,820
- **Put Wall:** 5,750

Through the morning, SPX grinds higher to 5,800. The instinct on a long-gamma day would be to start fading rallies into the 5,810 flip and the 5,820 call wall.

The structural read here says the opposite. SPX is in short-gamma territory; dealer hedging is amplifying. The push toward 5,810 meets hedging that runs with it rather than against it. If the 5,820 call wall gives way in this regime, that hedging adds to the break instead of leaning against it.

The practical read: a fade here has no hedging behind it, and if the wall gives way, the move can run. That changes the risk of fading, not the odds that 5,820 holds - in our measurement of 737 wall tests, SPX walls held about two times in three within an hour whichever side of the flip price was on.

Now imagine the same chart with Net GEX at +$1.2B and the gamma flip at 5,760 (spot 40 points above). The structural read inverts: the long-gamma reflex leans against rallies into 5,820, so a fade has the hedging behind it. Same tape, opposite mechanism, depending on a single regime variable.

---

## Common misconceptions

- **"Negative gamma is bearish."** It is not. It is **vol-amplifying**. The market can rally hard in a negative-gamma regime - and the rally tends to extend further than it would in long-gamma. Negative gamma is about *character of moves*, not direction.
- **"Positive gamma is bullish."** Also no. Positive gamma is **vol-dampening**. The market can drift down in a positive-gamma regime; it just tends to do so slowly with mean-reverting bounces along the way.
- **"You can trade negative-gamma signals the same as positive-gamma signals."** Most of the damage here comes from this. The signals and the structural reads invert across regimes. A "buy the dip" thesis that has the hedging behind it above the flip can compound losses below it.
- **"Negative gamma is rare."** It happens regularly - particularly after vol spikes, during macro stress, and when the chain is heavily put-skewed. Knowing the regime in real time is what tells you when.

---

## Takeaway

> Negative gamma means dealers amplify the move instead of dampening it. Same chain, same SPY, opposite tape character - and opposite playbooks for the trader who can read the regime.

The discipline is to start every session with the regime read: where's the gamma flip, where's spot, what's Net GEX? Those three numbers tell you which playbook the structural force in the tape is going to support today. Running the wrong playbook against the regime is the most expensive mistake on the menu.

Educational content only - none of the above is a trade recommendation.

---

If you want to see today's Net GEX, gamma flip, and regime read for SPY, SPX, QQQ, and NDX - the three numbers that tell you whether dealers are long gamma or short gamma right now - [the free ZeroGEX gamma-levels view](/spx-gamma-levels) surfaces all of them, delayed about 15 minutes; the paid plans show them [in real time](/real-time-gex-0dte).
