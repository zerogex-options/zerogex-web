# Why our futures price can differ from another platform

*Why an ES or NQ quote here can sit a few hundred points away from the same ticker on another chart — and why both numbers are right.*

---

**Short answer:** we may be quoting a different contract month than the chart you are comparing against. Both numbers are correct. They are different instruments.

## Futures trade as dated contracts

ES and NQ do not have a single price. They trade as separate contracts expiring in March, June, September and December, and several of them are trading at once, at different prices.

That is not a quirk of our data. It is how the exchange lists them: an S&P 500 future settling three months from now and one settling next week are two distinct contracts with two distinct order books, and nothing forces their prices together until the near one expires.

We quote the contract carrying the volume — the one actively traded.

## Contracts roll every quarter

About a week before a contract expires, trading volume migrates to the next one. Data providers switch their feeds across at that point — but **not all on the same day**. Each provider picks its own trigger: a fixed number of days before expiry, a volume or open-interest crossover, or a calendar rule set years ago.

For the week or so between one provider's switch and another's, two platforms both labelled "NQ" are showing different contracts. Neither is broken. They are answering slightly different questions about what "NQ" means today.

This is the whole cause of the mismatch, and it is why we do not publish a single roll date: there isn't one.

## The gap is cost of carry

A contract settling three months out is worth more than one settling this week. The difference is the cost of financing the position until then, less the dividends you forgo by holding futures rather than the shares.

On a quarterly roll that is typically about **1% on NQ** and **0.8% on ES**. NQ is larger because the Nasdaq-100 pays less dividend than the S&P 500, so its carry is higher.

On NQ that is a few hundred points — big enough to look like a broken feed, which is exactly why we label the contract directly rather than leaving you to work it out.

The same arithmetic explains a step in a multi-day chart. A range that spans a roll genuinely contains two contracts, so the price jumps where one ends and the next begins. That step is carry, not a market move, and charts that cross a roll say so.

## How to check

1. Hover, tap or focus the contract badge on any ES or NQ view. It names the exact contract we are quoting and when that contract expires.
2. Set your other platform to that same contract.
3. The prices should line up.

If your other feed is delayed — many free feeds run 10–15 minutes behind — you will still see a small gap from the delay itself. That one is a few points, not a few hundred.

## When it resolves

Once the old contract expires, every platform is on the new one and the difference disappears. It comes back at the next quarterly roll, and behaves the same way each time.

## Does this affect the dealer levels?

No. The gamma flip, the walls, max pain and the rest are computed from the SPX and NDX options chains and then carried onto the futures price axis, using a ratio measured off the tape rather than modelled from carry. The projection re-measures itself through each roll, so the levels track whichever contract we are quoting without a basis offset to configure. See [Data Coverage & Refresh](/help/platform/data-coverage) for how ES and NQ are served.

## Still not matching?

If both sides are on the same contract and the prices still differ by more than the delay accounts for, that is something else. Contact us at [support@zerogex.io](mailto:support@zerogex.io) with a screenshot and the timestamp.

## See also

- [Data Coverage & Refresh](/help/platform/data-coverage)
- [Troubleshooting](/help/platform/troubleshooting)
- [How to Read ZeroGEX Charts](/help/platform/reading-charts)
