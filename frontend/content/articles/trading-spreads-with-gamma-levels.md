# Trading Spreads With Gamma Levels: Five Worked Examples

*A credit spread, a debit spread, a butterfly, an iron condor and a late-day put, each placed on a real SPX session from the ZeroGEX session replay. Where the strikes went relative to the walls, the flip and the pin, how each trade ended, and the days the same trade lost.*

---

## Read this first

**The levels help you place strikes. They don't pick direction.** The call wall, put wall, gamma flip and pin strike show where modeled dealer hedging is concentrated. That tells you where a short strike can sit behind heavy positioning, where a debit spread can take its profit, and at what price the reason for a trade is gone. Whether SPX goes up or down today is still your call.

**Walls break.** In our measurement of 737 wall tests, SPX walls held about two times in three within the hour, so about one in three broke, and nothing we measured about a wall predicted which ones ([How Often Do Gamma Walls Actually Break?](/education/how-often-do-gamma-walls-break)). Every trade here comes with a rule for the break, and one example is the break.

**These days were picked after the fact.** We chose sessions that show each structure clearly, which is hindsight. The levels and prices are real, read from the [session replay](/replay) at the minute named. Option prices are not shown, because the replay records the index and the levels, not option quotes. So each result is stated at expiration, where it depends only on where SPX settled. The [Strategy Builder](/help/platform/options-calculator) prices any of these structures live.

This is education, not a recommendation. Same-day options can lose their full value in minutes.

## Where everything is

![The ZeroGEX sidebar with three sections open: Main, with Main Dashboard and Gamma Terminal highlighted; Strategy Tools, with Strategy Builder highlighted; and Receipts, with Session replay highlighted](/blog/zerogex-trade-example-where-to-click.png)

The live levels are on the **Main Dashboard** and the **Gamma Terminal**, both under **Main** in the sidebar. The **Strategy Builder** is under **Strategy Tools**: pick SPX, a strategy and today's expiration, set the strikes, and it prices each leg at the live bid or ask and draws the profit or loss at expiration. Every past day is under **Receipts → Session replay**: pick SPX and a date, then drag to the minute. Every picture below comes from there.

## How to read the pictures

Each picture is the session replay chart at the entry minute. SPX price is on the left, dealer gamma by strike is on the right, and the levels are dashed lines labeled at the right edge, with their values at that minute listed along the bottom. Candles after the entry minute are dimmed, so you can see what was known at entry and what came after. We drew each trade on top: short strikes in solid amber, long strikes in dashed blue, green where the trade keeps its maximum at expiration, and red where a spread loses. Click any picture to see it larger.

## Credit spread: a put spread under the put wall

![SPX on October 2, 2026 at 10:00 AM ET in the ZeroGEX session replay: put wall 7,700 and call wall 7,750, with a short 7,690 put and a long 7,680 put drawn under the put wall](/blog/zerogex-trade-example-credit-spread-2026-10-02.png)

**The setup.** Friday, October 2. At 10:00 AM ET, SPX was at 7,731.81, between the put wall at 7,700 and the call wall at 7,750. The gamma flip was at 7,676, below spot, so dealers were modeled long gamma: hedging that leans against moves.

**The trade.** Sell the 7,690 put and buy the 7,680 put, both expiring today. The short strike sits 10 points under the put wall, so SPX has to get through the heaviest put strike before the spread is in trouble. The spread is 10 points wide, so the most it can lose is $1,000 per spread minus the credit you collected.

**The rule for the break, decided before entry.** If SPX closes ten straight one-minute bars below 7,700, a simple version of the break definition in our wall study, the reason for the trade is gone: close it.

**What happened.** SPX rose to 7,754.67 at 10:42, then fell back to the put wall. The low after entry was 7,700.51 at 11:25, half a point above it. SPX never traded below 7,700 and settled at 7,721.36. The spread expired worthless, so you kept the whole credit.

### The same trade on a day the wall broke

![SPX on October 14, 2026 at 10:00 AM ET in the ZeroGEX session replay: put wall 7,750, with a short 7,740 put and a long 7,730 put; the later candles fall through both strikes](/blog/zerogex-trade-example-credit-spread-break-2026-10-14.png)

Wednesday, October 14. At 10:00 AM, SPX was at 7,762.23 with the put wall at 7,750, so the same trade is the 7,740/7,730 put spread. SPX first traded under the wall at 10:39. By 11:10 it had closed ten straight minutes below it, with SPX at 7,741.30, so the break rule says close. The put wall itself had moved down to 7,700 at 11:05. SPX kept falling, to 7,693.31 at 2:01 PM, and settled at 7,722.12, below both strikes. The spread finished at its full $10 width, the maximum loss. Closing at 11:10, with SPX still above the short strike, would have cost less than that. How much less depends on the prices at the time, which the Strategy Builder would have shown.

A rule costs something both ways. On Monday, October 12, SPX closed ten straight minutes under its 7,800 put wall at 2:59 PM, which would have closed a 7,790/7,780 put spread. SPX then settled at 7,808.51, and that spread would have expired worthless. Pick a rule you will follow either way.

The side of the flip is not the lesson here. On October 2 spot was above the flip, and on October 14 it was two points below it. But in the wall study, which side of the flip price was on did not predict which walls broke, and the iron condor further down held all day with spot below the flip.

## Debit spread: a put spread down to the put wall

![SPX on October 16, 2026 at 10:00 AM ET in the ZeroGEX session replay: put wall 7,700, call wall 7,750 and gamma flip 7,758.58, with a long 7,740 put and a short 7,700 put; the later candles fall through 7,700](/blog/zerogex-trade-example-debit-spread-2026-10-16.png)

**The setup.** Friday, October 16. At 10:00 AM, SPX was at 7,739.15. The put wall was at 7,700 and the call wall at 7,750. The flip, at 7,758.58, was above spot, so dealers were modeled short gamma: hedging that adds to moves instead of leaning against them.

**The trade.** Say you're bearish. That is your read, not the levels'. Buy the 7,740 put and sell the 7,700 put, both expiring today. The short strike sits on the put wall, the heaviest put strike below spot. The spread is worth its full $40 width if SPX settles at or below 7,700, and what you pay for it is the most you can lose.

**What happened.** SPX reached the wall at noon and had closed ten straight minutes below it by 12:09. It fell to 7,631.77 at 3:08 PM and settled at 7,659.96. The spread finished at its full $40. Selling the 7,700 put capped the trade there, so the move below the wall paid nothing more. That cap is also what made the spread cheaper than the put alone.

**What the levels didn't say.** The day before, Thursday, October 15, SPX was also below the flip at 10:00 AM: 7,681.98 against a flip at 7,780.71. It rallied and settled at 7,744.09, 62 points higher. Both mornings showed the same reading at 10:00, and the days went opposite ways. The flip describes how hedging was modeled to behave, not which way the index would go.

The bullish mirror image is a call spread: buy a call near spot and sell the call at the call wall.

## Butterfly at the pin strike

![SPX on October 13, 2026 at 2:00 PM ET in the ZeroGEX session replay: pin strike 7,800 labeled Weak, call wall 7,800 and put wall 7,750, with a 7,790/7,800/7,810 call butterfly drawn around the pin](/blog/zerogex-trade-example-butterfly-2026-10-13.png)

**The setup.** Tuesday, October 13. At 2:00 PM, SPX was at 7,795.65. The pin strike, the reachable same-day strike with the strongest modeled stabilizing dealer gamma, was 7,800, where it had been since 10:30. It was labeled Weak (21% confidence), which means it did not dominate the other candidates. The call wall was also at 7,800, and the put wall was at 7,750.

**The trade.** Buy the 7,790/7,800/7,810 call butterfly: buy one 7,790 call, sell two 7,800 calls and buy one 7,810 call, all expiring today. It is worth $10 if SPX settles exactly at 7,800 and nothing below 7,790 or above 7,810. In between, it loses a dollar for every point away from 7,800. What you pay is the most you can lose.

**What happened.** SPX stayed between 7,795.01 and 7,812.61 for the rest of the day. The pin moved to 7,825 at 3:30 PM, and SPX settled at 7,804.53, 4.53 points from the center. The butterfly was worth $5.47 at expiration, a bit over half its maximum. Whether that is a profit depends on what you paid.

**When the pin misses.** On Thursday, October 8, at 3:00 PM, the pin read 7,730 and was labeled Strong (57% confidence). SPX settled at 7,765.35, 35 points away and far outside a 10-wide butterfly. Across the 35 sessions from August 28 to October 26 that had a pin at 3:00 PM, SPX settled within 10 points of it on 8. The pin is a modeled center of gravity, not a forecast ([Pin Strike Explained](/education/pin-strike-explained)).

**A broken wing.** To lean one way, move one wing further out, for example 7,790/7,800/7,815. That changes the cost and puts the extra risk on one side. The Strategy Builder lets you set each leg's strike.

## Iron condor between the walls

![SPX on September 29, 2026 at 10:00 AM ET in the ZeroGEX session replay: put wall 7,650 and call wall 7,700, with an iron condor short the 7,650 put and 7,700 call and long the 7,640 put and 7,710 call](/blog/zerogex-trade-example-iron-condor-2026-09-29.png)

**The setup.** Tuesday, September 29. At 10:00 AM, SPX was at 7,683.05, between the put wall at 7,650 and the call wall at 7,700. The flip was at 7,701.37, just above spot, so dealers were modeled short gamma.

**The trade.** Sell the 7,650 put and the 7,700 call, on the walls, and buy the 7,640 put and the 7,710 call, all expiring today. That is two 10-wide credit spreads for one combined credit. Only one side can lose at expiration, so the most you can lose is $1,000 minus the credit, per condor.

**The rule for the break.** Each side gets its own, the same as for the credit spread: if SPX closes ten straight minutes beyond a wall, close that side.

**What happened.** SPX stayed between 7,653.55, reached at 1:16 PM and 3.55 points above the short put, and 7,687.69 for the rest of the day. It settled at 7,669.75. Both spreads expired worthless, so you kept the whole credit.

**Walls move. Your strikes don't.** By 3:00 PM the put wall had moved up to 7,675, and by 3:30 the call wall had moved down to 7,675 too, as positioning gathered where price was. The levels you entered against are not the levels at the close, so watch the live ones while the trade is on.

## Late-day lottery ticket: a far out-of-the-money put

![SPX on September 30, 2026 at 3:00 PM ET in the ZeroGEX session replay: spot 7,695.20 just above the gamma flip at 7,688.49, put wall 7,675 and pin 7,690, with long 7,670 and 7,650 puts drawn below; the later candles fall to 7,654.55](/blog/zerogex-trade-example-late-put-2026-09-30.png)

**The setup.** Wednesday, September 30. At 3:00 PM, SPX was at 7,695.20, seven points above the gamma flip at 7,688.49. The put wall was at 7,675 and the pin at 7,690, labeled Moderate (33% confidence). A drop below the flip would put SPX where dealers are modeled short gamma, where hedging adds to a move. That is what makes a late squeeze possible. It doesn't make one likely.

**The trade.** Buy one 7,670 put expiring today, 25 points out of the money with an hour left. The most you can lose is what you pay, and losing it is the usual result.

**What happened.** For 40 minutes, nothing: SPX held between 7,686.70 and 7,697.31. It first traded below the flip at 3:37 PM, while the pin's confidence was still rising, to 46% at 3:50. Then SPX fell through the flip and the 7,675 put wall and settled at its low of the day, 7,654.55. The 7,670 put was worth $15.45 at expiration. The 7,650 put, 20 points further out, expired worthless by 4.55 points.

**How rare that is.** In the 41 SPX sessions on the replay from August 28 to October 26, SPX settled 25 or more points away from its 3:00 PM price once: this day. It settled 20 or more points away three times. On most days, a put or call bought 25 points out of the money at 3:00 PM is worth nothing at the close. If you buy these, size them as money you expect to lose. On the Pro plan, the [EOD Pressure](/education/eod-pressure-explained) and [Squeeze Setup](/education/squeeze-setup-explained) signals describe the late-session forces at work, but they don't call the move either.

## What carries over

- **Place strikes with the levels.** Short strikes behind a wall, debit spreads capped at the next wall, butterflies centered on the pin.
- **Decide the break rule before you enter**, and follow it both ways.
- **Watch the live levels while the trade is on.** Walls and the pin move during the day.
- **Size for the bad day.** In the wall study, about one in three SPX wall tests broke within the hour.
- **Try your own setups on past days**: **Receipts → Session replay**, any symbol, any date, any minute.
