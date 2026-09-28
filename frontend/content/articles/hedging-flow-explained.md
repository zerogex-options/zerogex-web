# Hedging Flow Explained: Reading the Options Tape Through the Hedge

*Most gamma tools ask how dealers might hedge if price moves. Hedging Flow asks what hedge today's options trading already implies, and whether the gamma around price is set up to absorb that push or amplify it.*

---

## A different question from GEX

Gamma exposure is a structural read. It starts from the open interest on the books and asks: if price moves, how might hedging respond?

Hedging Flow starts from the tape instead. Given the options that actually traded today, what stock hedge would that activity imply, and which way is it pushing right now?

The page pairs that estimate with a read of how dealer gamma near the current price is changing, then condenses both into one headline, **Gamma Weather**. None of it is a buy or sell signal. It answers a narrower and more useful question: is the options tape pushing with price or against it, and is the structure around price more likely to damp that push or amplify it?

---

## What the number is

ZeroGEX classifies option volume by comparing the price it traded at with the quote around that time:

- volume that prints close to the ask counts as **buyer-initiated**;
- volume that prints close to the bid counts as **seller-initiated**;
- volume in the middle of the spread, volume in the first minute of the session, and volume with no usable quote stay **unclassified**.

Within each contract and each minute, unclassified volume is split in the same buy/sell proportion as that minute's classified volume. A contract-minute with nothing classified adds nothing.

The model then assumes the passive side of each classified trade was a market maker who hedges to stay delta-neutral, and computes the stock that hedge would trade:

`(contracts bought − contracts sold) × delta × 100 × underlying price`

Delta is signed, positive for calls and negative for puts, so the sign of the result is the direction of the implied hedge: **positive means the hedge buys the underlying, negative means it sells.** The results are summed into fixed five-minute bars from 9:30 to 4:15 ET.

Two quick examples, with SPY at $660:

- A customer buys 1,000 calls at a 0.40 delta: `1,000 × 0.40 × 100 × $660 = +$26.4M`. The market maker who sold them is now short delta, so the implied hedge **buys** about $26.4M of SPY.
- A customer buys 1,000 puts at a −0.30 delta: `1,000 × (−0.30) × 100 × $660 = −$19.8M`. The implied hedge **sells** about $19.8M. Had the customer sold those puts instead, the sign flips to +$19.8M.

---

## What the number is not

The key word is *implies*. A reading of +$500M means roughly $500M of underlying buying is implied by the classified option activity, under the model's assumptions. It does not mean dealers bought $500M of stock.

ZeroGEX does not see who is on either side of a trade, whether a trade opened or closed a position, or what any market maker actually holds or hedges. The assumption that the passive side was a market maker has not yet been validated against exchange-classified market-maker data. That is why the page carries this caveat under its chart:

> Estimated hedging pressure. Inferred from aggressor-classified option trades under the assumption that the passive side of each print was a market maker; that assumption is unvalidated. Not observed dealer flow.

A few more limits are worth knowing:

- each leg of a spread is classified on its own, so one multi-leg trade can read as separate buys and sells;
- delta is taken once per contract per minute, not at the instant of each trade;
- the estimate covers the expirations and strikes ZeroGEX tracks for that symbol, not every listed contract.

---

## Calls are not automatically bullish, and puts are not automatically bearish

Because delta is signed, the direction of the implied hedge depends on both the option type and which side started the trade:

| Customer activity | Implied hedge |
|---|---|
| Buys calls | Buys the underlying (+) |
| Sells calls | Sells the underlying (−) |
| Buys puts | Sells the underlying (−) |
| Sells puts | Buys the underlying (+) |

That is why the **Call-driven** and **Put-driven** cards describe where the pressure came from, not whether it was bullish or bearish. A positive Put-driven number is entirely possible: it is what heavy put selling looks like. So is a negative Call-driven number.

---

## The cards: where the day has been

Three of the four cards summarize the session so far:

- **Session pressure** is the running net total of estimated hedging pressure since the open. It is cumulative, not the current five-minute push.
- **Call-driven** is the part of that total that came from calls.
- **Put-driven** is the part that came from puts.

Call-driven plus Put-driven equals Session pressure. Any difference in the displayed figures is rounding. The cards read the newest bar that carried real flow, so a quiet bar carried forward is not reported as new.

Keep history and the present apart. A session can carry +$2 billion of Session pressure while its latest bars have already turned negative. The total says where the day has been. It does not say where the next few minutes are going. The fourth card, **Last flip**, is about the present, and it is covered under Flips below.

---

## The flow chart: Pressure rate and Session cumulative

The chart has two views.

**Pressure rate** is the default. Each bar is one five-minute bar's estimated pressure on its own (**Pressure this bar**), with a **3-bar average** line on top, roughly the last 15 minutes. The newest bar can still be filling, and it counts in that average while it does.

**Session cumulative** plots the running Call-driven and Put-driven totals and the **Net hedging pressure** line instead.

Both views draw **Price** on the right-hand axis, which is where the useful intraday information tends to show up:

| Price | Pressure | One way to read it |
|---|---|---|
| Rising | Positive | The move has estimated hedge demand behind it |
| Rising | Negative | Price is advancing against the estimated pressure |
| Falling | Positive | Estimated buying is showing up into the decline |
| Falling | Negative | The options tape is reinforcing the move |

The relationship is usually more informative than the size of any one bar. A large impulse that barely moves price says something too: the other side of the market is taking it.

The view switch also changes the structure chart underneath, so the two always compare like with like. In Pressure rate it shows the last 30 minutes of structural change. In Session cumulative it shows the change since the open.

---

## Flips and the Last flip card

A **flip** marks the 3-bar average changing direction, and it is deliberately harder to trigger than a sign change:

- the average has to establish itself on the far side of a **flat band** around zero, which reaches half of the session's typical rate so far in each direction. A line that nicks across zero and back is treated as flat, not as two flips;
- a flip is **significant** when its swing is at least the session's typical bar-to-bar swing so far. The rest are **light**.

Both thresholds are built only from the bars before the flip, so each flip is judged on what was known at the time. The newest bar is still filling, though, so a flip on it can appear and disappear before that bar closes.

The chart marks flips with a dot on the zero line and a badge above it, and by default it shows significant flips only. The **Last flip** card is different: it shows the newest flip of any size, with the start time of its bar. When the newest flip is a light one, the card and the badge can name different flips. Untick **Significant flips only** to see the light ones on the chart. All times on the page are Eastern, on a 24-hour clock.

---

## Dealer gamma structure: what the push is running into

Hedging Flow estimates the push. **Dealer gamma structure** describes what receives it, using ZeroGEX's modeled dealer gamma and weighting each strike by how close it is to the current price. Strikes within about 1% of price carry most of the weight, and strikes more than 8% away carry none.

One thing applies to everything in this section: open interest is published once a day. These readings do not move because new positions were opened intraday. They move because the existing book is repriced as price, time and implied volatility change.

The chart draws two lines:

- **Stability** measures whether near-price gamma has changed in a direction that should damp movement (above zero, toward pinning) or amplify it (below zero, toward acceleration).
- **Lean** compares how gamma has changed below price with how it has changed above price. Above zero is **supportive**: gamma building below price, eroding above it, or both. Below zero is **capping**, the opposite.

Both measure change, not level. A reading toward pinning does not mean the whole book is long gamma. It means the structure near price moved in a damping direction over the window.

The label beside the heading combines the two lines, split at zero: **Firming** (stabilizing, supportive), **Capping** (stabilizing, building above), **Fragile bid** (supportive but thinning) and **Deteriorating** (thinning and capping). Gamma Weather, below, grades the same Stability reading with a flat band, so the chart can say Firming while the Weather strip says Flat. That is not a contradiction: a small positive reading is both.

---

## Gamma Weather: the strip at the top

**Gamma Weather** is the combined read at the top of the page. It shows a headline state, how long that state has held, a one-sentence summary, and five chips: **Pressure now**, **Lean**, **Stability**, **Gamma trend** and **Flip cushion**. Click any chip to open a chart of that field for the session, with a trail of the moments it changed.

Weather always reads all tracked expirations, and it reads the newest bar that has both hedging flow and a structure reading.

### Pressure now

**Pressure now** turns the latest bar and its 15-minute average into a direction, and the rule is stricter than the labels suggest:

- **Buying:** the latest bar and the 15-minute average are both positive, and at least one of them is larger than $25M.
- **Selling:** the mirror image.
- **Mixed:** anything else. The two disagree, one of them is exactly zero, both are inside $25M, or there is not enough history yet. The first two bars of every session read Mixed.

Mixed is not the same as quiet. It means the immediate push and the short-window push do not agree enough to call a direction. The $25M floor is the same for every symbol, so it is a lower bar on SPX than on SPY or QQQ.

Next to the direction, the chip shows how settled it is:

- **Pulse:** the first evidence, not yet a condition.
- **Building:** two of the last three bars clear $25M in that direction, and so does the 15-minute average.
- **Persistent:** all three bars do.
- **Reversed:** shown on the one bar where an established side gives way, after two bars on the other side. While that is pending, a **Pressure reversing · 1/2** chip appears.

### Lean, Stability and Gamma trend

**Lean** is the chart's 30-minute Lean, read by sign: any reading of zero or above is Supportive.

**Stability** is the chart's 30-minute Stability with a $50M band around zero: **Pinning** above +$50M, **Accelerative** below −$50M, **Flat** in between. Like the $25M pressure floor, the band is the same for every symbol.

**Gamma trend** is the same Stability measurement taken against the session's first bar instead of 30 minutes ago: **Building**, **Thinning** or **Flat**. That gives you two clocks. Gamma trend Building next to Stability Accelerative is not a contradiction: it can mean the structure improved earlier in the day and is still ahead of the open, but has started to deteriorate recently.

### Flip cushion

The **Flip cushion** is the distance between price and ZeroGEX's modeled gamma flip, in points, on whichever side price is. The chip shows the distance with its direction, for example "4 pts · Narrowing". The line under the chips adds which side of the flip price is on, the band, and the change over the last 5 and 15 minutes.

Points alone would mean something different on every symbol, so the band grades the cushion against the underlying's typical 30-minute range, the median high-to-low range of 30-minute windows over the last five calendar days:

| Cushion vs. typical 30-minute range | Band |
|---|---|
| Up to 0.25× | Crossing |
| Up to 0.60× | Thin |
| Up to 1.25× | Normal |
| Above 1.25× | Secure |

The direction reads **Narrowing**, **Widening** or **Steady** over the last 15 minutes. Two details matter:

- Narrowing means the gap shrank. It does not have to mean price moved toward a fixed line, because the flip moves too.
- The cushion has no sign. When price crosses the flip, the cushion narrows to zero and then widens again on the other side. Widening right after a crossing does not mean conditions got safer.

When the band is Thin or Crossing and the cushion has closed by at least a quarter of the room that is left within 15 minutes, the chip reads **Thin and closing** and a **Transition risk** flag appears on the strip.

### How the headline is decided

The headline combines only two chips, Pressure now and Stability:

| Pressure now | Stability | Gamma Weather |
|---|---|---|
| Mixed | Any | Mixed |
| Buying | Pinning or Flat | Stable bid |
| Buying | Accelerative | Fragile rally |
| Selling | Pinning or Flat | Supported dip |
| Selling | Accelerative | Unstable |

A new state has to appear on two five-minute bars in a row before it replaces the current headline, and the newer of the two can still be filling. While it waits, the strip shows it as forming, for example **Fragile rally forming · 1/2**. Once a state holds the headline, its age reads **New**, then **Established** at 15 minutes, **Confirmed** at 30 and **Mature** at 60.

Lean, Gamma trend, the Flip cushion, Session pressure and price do not decide the headline. They are context around it. The cushion in particular qualifies the state; it never competes with it.

The names are not statements about price. "Fragile rally" does not require price to be rallying: it means buying pressure into a structure that has turned accelerative. "Supported dip" does not require a visible dip: it means selling pressure into a structure that is holding or firming. Read Weather as a description of how the current push and the current structure interact, not as a forecast.

---

## Reading a live example

![SPY Hedging Flow at 2:56 PM ET on September 28, 2026: Gamma Weather, the four cards, the Pressure rate chart and the dealer gamma structure](/blog/zerogex-hedging-flow-spy-2026-09-28-cropped.png)

Here is SPY at 2:56 PM ET on September 28, 2026, taken with the page's snapshot button. Click the image to see it larger. The price levels below are read off the chart, so treat them as approximate.

**The cards.** Session pressure reads −$4.76B: an estimated $4.76 billion of SPY selling implied by the day's classified option trades. Both books contributed almost equally, −$2.50B from calls and −$2.26B from puts. Under the model, that is customers selling calls and buying puts, and both imply a hedge that sells.

**Price did not follow the total.** SPY opened near $767.75, touched about $768.40 before 10:00, then slid to about $763.95 by 10:51, and the heaviest run of selling bars came during that drop. It recovered all of it by 12:25 and, apart from a spike to the day's high near $768.80 at 13:10, spent the afternoon between roughly $766.40 and $767.50. At the snapshot it sat within a dollar of its first print. The two sharp pops, around 12:20 and 13:10, came with the day's biggest buying bars, and the second gave back at once next to a large selling bar. The total stayed deeply negative while price came all the way back, which is the point of keeping Session pressure and Pressure rate apart: the first is where the tape has been, not where price has to go.

**The Weather history.** The Pressure now drawer colors each bar by the Weather state at the time: Mixed through the first hour, Unstable through the late-morning drop, Supported dip while price based near $765, Stable bid through the midday rally, and several turns since.

**Right now.** The 3-bar average flipped to buying at 14:45, which is what the Last flip card shows. It was the 13th flip the chart marked that day, a choppy tape by this measure. Buying pressure with a Flat Stability chip made the headline **Stable bid**, and it had held for 10 minutes. But the 14:55 bar, about a minute old when the snapshot was taken, was already printing on the selling side. Pressure now reads Mixed, **Mixed forming · 1/2** shows the candidate, and **Pressure reversing · 1/2** shows the buying side one bar into giving way. The header only moves to Mixed if the next bar agrees, and that one-minute-old bar can still change before it closes.

**Structure.** Stability is Flat: the 30-minute change in near-price gamma is inside $50M either way. Lean is Supportive. The chart's label reads Fragile bid for the same two readings, because it splits at zero and Stability sits a hair below it while Lean sits a hair above. Gamma trend is Thinning: near-price gamma has thinned since the open. The structure lines made their biggest moves when price did, with both below −$1.2B at the 10:50 low and Stability near +$1.35B at the 12:25 high. That fits a fixed book being repriced as price moves through it.

**Flip cushion.** SPY sits about 3 points below the modeled gamma flip, Secure and widening slowly. Below the flip is the side our [gamma flip guide](/education/how-to-read-a-gamma-flip) describes as generally short gamma, where hedging tends to amplify moves, and "Secure" says price would need more than a typical half hour's range to reach the flip. It does not say conditions are calm. Weather reads the last half hour's change in the book; the cushion reads which regime price is in. Here they point different ways: a Stable bid headline, in the amplifying regime.

**Put together:** a day of heavy estimated hedge selling, most visibly in the late-morning drop, that price has since fully recovered from, a push that turned to buying at 14:45 and was already wavering at 14:55, near-price structure that is flat now and thinner than at the open, and price comfortably on the amplifying side of the flip. That is a very different read from "−$4.76B, so bearish."

---

## How to use it

Hedging Flow works best as context for a trade idea, not as the idea itself.

Take a test of a put wall. With Pressure now reading Buying, Stability Pinning and the cushion widening, that test happens in a very different environment than the same wall tested with Selling pressure, Accelerative Stability and a cushion that is thin and closing. The level did not change. The conditions around it did. The same goes for VWAP, the opening range, the gamma flip, and the call and put walls.

The page fits into a simple sequence:

1. **Where are the levels?** ZeroGEX's gamma levels answer that.
2. **What is the options tape pushing right now?** Hedging Flow.
3. **Is the structure around price likely to absorb that push or amplify it?** Dealer gamma structure and Gamma Weather.

Hedging Flow is also different from Forced Flow, though the two share units and a sign convention. Hedging Flow reads today's trades and says what pressure they created. Forced Flow reads the standing book and asks what pressure it would create under a move in price, time or volatility.

---

## A note on the 0DTE only switch

The **0DTE only** switch limits the flow side of the page to contracts expiring that day: the four cards, the flow chart, its flip markers and badge, and the chart inside the Pressure now drawer. Gamma Weather's headline and chips and the Dealer gamma structure chart do not change. They always read all tracked expirations, because structure is a property of the whole book, and that includes the pressure behind the Pressure now chip.

For the page-by-page reference, see the [Hedging Flow help page](/help/platform/hedging-flow). For the mechanics behind it, see [Why Market Makers Trade Stock](/education/why-market-makers-trade-stock), [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip), and [Net Volume vs Directional Flow](/education/net-volume-vs-directional-flow).

Educational content only - none of the above is a trade recommendation.
