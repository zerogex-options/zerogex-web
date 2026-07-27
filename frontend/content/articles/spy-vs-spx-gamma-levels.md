# SPY vs SPX Options: Which Gamma Levels Matter?

*SPY and SPX track the same index through two different contracts — and two separate dealer gamma books. Here's how their gamma levels differ, how to translate a level from one to the other, which book tends to carry more weight, and why the levels where they agree can matter most.*

---

## The short answer

If you trade SPX, read SPX gamma levels. If you trade SPY, read SPY gamma levels. But because both contracts track the **same** underlying index while carrying **separate** pools of open interest, a sharper read can come from watching both — and treating the levels where they line up as the ones that tend to carry extra weight.

The rest of this piece explains why the two books differ, how to convert a level between them, and which one deserves more weight when they disagree.

---

## Same index, two different contracts

SPX and SPY both track the S&P 500. What differs is the *contract* wrapped around it — and those differences shape how dealers hedge each one.

| Feature | SPX | SPY |
|---|---|---|
| What it is | S&P 500 **index** options | S&P 500 **ETF** options |
| Price scale | The index level (e.g. 6000) | ~1/10 of the index (e.g. 600) |
| Settlement | Cash-settled | Physically settled (shares) |
| Exercise style | European — no early assignment | American — early-assignment risk |
| Contract notional | ~$100 × index level (≈10× SPY) | ~$100 × ETF price |
| Strike spacing | Wider (commonly 5 points) | Finer ($1, some $0.50) |
| Dividends & tax | No dividend; Section 1256 treatment | Pays dividends; equity-option treatment |
| Typical crowd | Institutions, index & 0DTE desks | Individual investors plus institutions, share hedgers |

The single most important row for gamma is **contract notional**. One SPX contract controls roughly ten times the dollar exposure of one SPY contract, so SPX dealer hedging moves far more index-equivalent delta per contract. That matters below.

---

## Why SPY and SPX have separate gamma books

Gamma exposure is computed from an option chain's open interest — strike by strike, expiry by expiry — and then assigned a dealer sign by convention. SPX and SPY are different chains with different open interest, so each produces its **own** [gamma profile](/education/gamma-exposure-explained): its own [gamma flip](/education/how-to-read-a-gamma-flip), its own [call wall and put wall](/education/gamma-walls-explained), its own net GEX.

A framing note on all of these: net GEX and the "dealer gamma book" are *modeled* estimates — gamma magnitudes from the public chain, signed with the traditional call-positive / put-negative convention. Actual dealer inventory isn't directly observable from option-chain data, so treat both books as models of positioning rather than a ledger of what dealers actually hold.

Because both chains reference the same index, those levels usually point at the same place in S&P terms. But they are built by different crowds — SPX skews institutional and index/0DTE, SPY carries a heavier mix of individual investors and share-hedging flow — so the two books can weight strikes differently and drift apart at the margins. When they diverge, that can be information rather than noise.

---

## Translating a level from one to the other

SPY trades at roughly one-tenth of the S&P 500 index, so as a first approximation:

> SPY level ≈ SPX level ÷ 10 — SPY 600 ≈ SPX 6000, SPY 585 ≈ SPX 5850.

Two caveats keep the mapping from being exact:

- **Tracking drift.** SPY's price reflects accrued dividends and small tracking differences, so the ratio is never a clean 10.000. Convert for orientation, not to the penny.
- **Strike granularity.** In raw dollars SPY lists finer strikes ($1, some $0.50) than SPX's five-point spacing — but apply the ~10× scale: one SPY dollar is ten index points, so SPY's $1 strikes are actually *coarser* than SPX's five-point strikes in index terms, and its $0.50 strikes merely match them. In index terms SPX resolves gamma at least as finely as SPY; SPY's real edge is round-dollar strikes that can attract pinning and its share liquidity, not finer index resolution.

---

## Which book carries more weight?

For the S&P's aggregate dealer-hedging pressure, SPX is usually the primary map. Three reasons:

1. **Notional.** Roughly 10× the dollar delta per contract means SPX hedging flows tend to dominate the index-level gamma that most influences the cash index and /ES.
2. **0DTE depth.** SPX lists an expiry every trading day and is the deepest index options market there is; the same-day [dealer positioning](/education/0dte-dealer-positioning-explained) that can drive intraday volatility tends to show up there first.
3. **Cleaner mechanics.** Cash settlement and European exercise mean no early-assignment scramble distorting the book into expiry.

SPY earns its keep as the **granularity and confirmation** layer: finer strikes, enormous share liquidity, and the individual-investor and hedger flow that can produce [SPY-specific pinning](/education/why-spy-pins-near-strikes). And when you are trading SPY itself, its own walls are the levels your instrument is most likely to react to.

---

## Which levels matter for your trade?

Match the map to the instrument you are actually trading:

- **SPX, /ES, or SPX 0DTE** → SPX gamma levels are your map.
- **SPY shares or SPY options** → SPY gamma levels — your instrument's own walls and pin.
- **QQQ** → QQQ levels (see below).

Then look for **confluence**. When the SPX call wall at 6000 lines up with the SPY call wall at 600, that shared level can be sturdier than either alone — two separate modeled dealer books leaning on the same price. When they *disagree*, treat both as softer and let price tell you which book is in control.

> A level where SPX and SPY agree can matter more than the biggest wall on either chart alone.

---

## QQQ and NDX: the same logic on the Nasdaq

The Nasdaq-100 has the same split: **QQQ** is the ETF, **NDX** is the cash index, and each carries its own gamma book at a different price scale. If you trade QQQ, read [QQQ gamma levels](/qqq-gamma-levels); if you trade NDX or /NQ, the index book is your reference. The confluence idea travels — QQQ walls that agree with the NDX book can be the ones worth extra attention.

---

## Reading them side by side on ZeroGEX

The free ZeroGEX gamma-levels pages publish all three books next to each other so agreement is obvious at a glance:

- [SPX gamma levels](/spx-gamma-levels) — the index book, the primary S&P map.
- [SPY gamma levels](/spy-gamma-levels) — the ETF book, finer strikes and pin detail.
- [QQQ gamma levels](/qqq-gamma-levels) — the Nasdaq-100 read.

Each page leads with its own ticker's gamma flip, call wall, put wall, max pain, and net dealer GEX, then shows the other two for cross-checking. For the mechanics behind the levels, start with [Gamma Exposure (GEX) Explained](/education/gamma-exposure-explained), then [Gamma Walls Explained](/education/gamma-walls-explained) and [How to Read a Gamma Flip](/education/how-to-read-a-gamma-flip).

---

## Bottom line

SPY and SPX track one index through two contracts and two separate dealer gamma books. Trade the levels that belong to your instrument, use the ~10× ratio to translate between them, lean on SPX as the heavier index-level map and SPY for round-number pinning and share liquidity — and give extra weight to the levels where the two agree.

*These are derived analytics for education, not investment advice. Options trading involves significant risk.*
