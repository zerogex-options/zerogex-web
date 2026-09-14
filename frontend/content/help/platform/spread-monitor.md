# Spread Monitor

*Quoted bid/ask width and liquidity across the option chain — whether the market is tradeable, not just what it means.*

---

## What this page shows

Every other Metrics page reads the option book to tell you what it **means**: where dealer gamma sits, which strike pins, how the surface shifted overnight. None of them tell you whether you can actually **get filled**.

That gap matters. A gamma wall three points away is worth nothing to a trader whose put is quoted 12.40 x 15.80. On the days the setup is best — a fast tape, a vol spike, a crowded hedging bid — the markets are often widest, and a plan built on the midpoint quietly stops working.

The Spread Monitor measures the execution half: how wide the market is quoted, which side of the book is worse, where in the chain it thins out, and whether today is unusual for this symbol.

## The three numbers, and why one isn't enough

### Spread as a share of premium

`100 × (ask − bid) ÷ mid`

The headline. It answers "how much of what I pay is the toll?" and it is what makes a cheap option untradeable: a put quoted 0.05 x 0.35 is 150% wide, and no edge survives that. It is comparable across strikes within a chain and roughly comparable across products.

### Spread in basis points of the index

`10,000 × (ask − bid) ÷ spot`

The cross-symbol measure, and the **only** one you should use to compare SPX against NDX. SPX trades near 6,800 and NDX near 25,000 — a $1.00-wide market means something completely different on each, and comparing their dollar widths compares their index levels rather than their liquidity.

### Share of the chain with no market at all

The most severe liquidity failure doesn't show up in any width statistic, because a width can't be computed for it. A contract quoted **0.00 x 2.40** has no bid: there is nothing to sell into, at any price.

Averaging that in as "240% wide" would be a fabrication. Dropping it silently would be worse — a chain would appear to *tighten* as its wings went untradeable, because only the still-quoted contracts would remain in the sample. So those contracts are counted in their own column and excluded from every median.

A chain whose median width is unchanged but whose no-bid share has doubled has got worse, and only that column says so.

## Why median and p90, never an average

Chain-wide quote quality has no upper bound. One stale far-wing strike quoted 0.05 x 4.00 is 195% wide, and an average over a few hundred contracts will happily report that one contract as the state of the whole chain.

The **median** says where the typical contract sits. The **p90** says how bad the bad ones are.

Both are needed, and they answer different questions. The complaint that starts "spreads are untradeable" is usually a p90 observation; the reply "looks fine to me" is usually a median one. Showing both is what makes that disagreement resolvable.

## Reading the page

### The header cards

**Put spread** and **Call spread** are the median widths on each side of the book, with the per-contract cost of crossing underneath. Read them next to each other rather than on their own — the difference between them is the reading.

**Put / call width** divides one by the other. Above 1 means the downside is the expensive side to trade. That is a hedging bid, not a broad liquidity problem, and it behaves differently: it concentrates in the OTM puts and it unwinds when the bid for protection does.

**No market at all** is the coverage number described above.

### Against this symbol's own history

There is no universal "wide" for a quoted spread. SPX puts are structurally wider than SPY puts on the calmest day of the year, so any fixed threshold would be wrong for one of them at all times.

So this page never calls a reading wide in the abstract. It ranks today against the same symbol's own trailing sessions — "wider than 96% of the last 60 sessions" — and when it doesn't have that history yet, it shows the measurement and says **no baseline yet** rather than inventing a verdict.

### Since the open

A different question from the one above, and both matter. A chain can be wide all day (bad percentile, flat drift) or start orderly and deteriorate into the close (ordinary percentile, drift of 3×). Neither reading substitutes for the other.

### Through the session

Puts and calls plotted separately, one point per 15-minute bucket. They are never blended, because the days people complain about are days when the puts widened and the calls did not — and a single line splits the difference and shows a shrug.

The shaded band underneath is the share of puts with no two-sided market, on its own axis. It is not a width and shouldn't be read against one: it is the population that *has* no width.

### Where the chain thins

Median width by distance from spot, **signed** — downside strikes on the left, upside on the right, spot in the middle, laid out the way a skew chart is.

That orientation is the point. Bucketing by unsigned distance from the money would fold the two wings on top of each other and average away exactly the asymmetry you're looking for.

### By expiration

Per-expiration rather than in DTE ranges. "2–7 DTE" is not something anyone trades: it blends Wednesday's expiry with Friday's, and those routinely differ by more than the change worth noticing. "Today's puts are 8% wide and Friday's are 3%" is a sentence you can act on.

### Daily record

One row per trading day, written from the same reduction as the live reading above, so the two are directly comparable.

The band between the line and its upper edge is the gap between the typical contract and the worst tenth. When both rise, the whole chain got worse. When only the band rises, the wings blew out while the money stayed orderly — a different market, and the more common of the two.

### Across symbols

The same reading on every index with an option chain of its own. Compare using the **put width vs index** column, for the reason given above.

## What this page does not claim

**Quoted, not effective.** Effective spread compares fills to the midpoint at the time of the fill. That needs per-trade prints with timestamps and an NBBO to measure against, and ZeroGEX stores neither. Everything here is the width market makers are *showing*, not what trades actually filled at. Skilled execution routinely beats the quoted width; this page will not show that.

**No depth.** The feed carries no bid/ask sizes, so "1,000 up" and "1 up" at the same width are indistinguishable here. A tight quote for one contract is not liquidity, and this page cannot tell you which you have.

**Not a broker or venue statistic.** These are consolidated quotes. They describe the market, not any particular broker's routing.

## ES and NQ

The Spread Monitor is not available for the futures. ES and NQ carry no option chain in ZeroGEX — their dealer levels are SPX and NDX option-derived and converted onto the futures price axis using the live basis.

That conversion works for levels. It cannot work here: a quoted spread is a width a market maker is showing on a real contract, and scaling an SPX quote by the futures basis would invent a market nobody published — in answer to the one question this page exists to answer honestly. Switch to SPX or NDX instead.

## Practical uses

- **Before sizing a position.** A 2% spread on a $1.00 option is 2¢; the same 2% on a 0DTE wing you're paying $0.15 for is real money against a small edge.
- **When a setup and the tape disagree.** If the signal fired but the market is in the widest decile of the quarter, the constraint is execution, not conviction.
- **Choosing between index products.** The cross-symbol table answers "is NDX any better than SPX today?" on a comparable basis.
- **Timing an exit.** The session chart shows whether widths are deteriorating into the close, which is when a plan to "get out at the end of the day" quietly gets expensive.
