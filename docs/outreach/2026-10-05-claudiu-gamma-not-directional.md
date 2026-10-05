# Claudiu's cancel: read long/short gamma as bullish/bearish (2026-10-05)

Claudiu (dxtinct@gmail.com) canceled Basic on Sun Oct 4, six minutes after the
second $19 renewal cleared. Michael asked what made them cancel, and Claudiu
replied Mon Oct 5 at 10:58 AM:

> Not sure what made me quit but … i was looking for an edge in us100 and
> understanding if it is short gamma or long gamma. Apaprently it did not work
> based on the signals i got from the site and .. i did not end up having more
> trades won from that informatiin but on the contrary i lost more trades after
> reluing on the data from the site..

This is the read and the 1:1 founder reply, sent from your own inbox.

Everything below is from `make diagnose-user EMAIL=dxtinct@gmail.com` (run
2026-10-05).

| | **dxtinct@gmail.com** |
|---|---|
| User id | `user_648d7f2f652a4ae48afbb30d` |
| Came from | organic/direct |
| Plan | Basic monthly, $39 less $20 for 6 months = **$19** (coupon `d0HelzOL`) |
| Paid so far | $19 on Fri Sep 4 (trial conversion), $19 on Sun Oct 4. $38 total |
| Canceled | Sun Oct 4, 8:06 AM UTC, six minutes after the renewal cleared |
| Access | until **Wed Nov 4, 6:59 AM UTC** (1:59 AM ET), so through Nov 3 for trading |
| Paying with | Visa ending 8225 |

## The read

- **They used the gamma regime as a direction call.** "Short gamma or long
  gamma" on US100, then trades that lost. The likely reading was long gamma =
  buy, short gamma = sell. The regime describes how moves behave (dampened and
  mean-reverting vs. extended and trending), not which way they go. That is
  the one thing the reply teaches.
- **US100 is the Nasdaq 100.** On ZeroGEX that is NDX (or NQ, its futures
  projection). Basic includes the live dashboard on both.
- **They still have a month of paid access.** That makes the nudge "use what
  you've already paid for," not "come back."
- **No discount.** Price isn't the complaint, and they're already on $19. The
  only offer is the switch-back at the same rate, which works only while the
  subscription still exists (through Nov 3).
- **Be ready for "there was no flip."** For much of their subscription the NDX
  gamma flip wasn't shown: most sessions from early August to Sep 11, and again
  Sep 21–25. The reply doesn't raise it, because it isn't their complaint. If
  they mention it, `2026-09-28-sulby-nq-gamma-flip.md` has the explanation.

## Verify first

- **Re-run `make diagnose-user EMAIL=dxtinct@gmail.com` right before
  sending.** If `Cancel at period end` has flipped to `no`, they switched it
  back on themselves; cut the last paragraph.
- **The $19 line.** Coupon `d0HelzOL` is $20 off for 6 months from late August,
  so it should still cover a November renewal. Confirm in Stripe on
  `sub_1U9JlS4AOiqteMYYoP41Mc8A`. If it doesn't, drop "at the same $19 a month".

## Draft

*Final wording, revised by Michael 2026-10-05.*

**Subject:** Re: I need to unsubscribe

Hi Claudiu,

Thank you for your candor. I'm sorry the trades went against you.

The most common trap with gamma is assuming long gamma means bullish and short gamma means bearish. Neither is true. The gamma regime tells you how the market is likely to move, not which direction.

- **Long (positive) gamma:** dealers' hedging tends to sell rallies and buy dips. Moves get dampened, ranges stay tighter, and price tends to come back toward the middle. Fading the extremes works better and chasing breakouts works worse. The market can still drift lower in long gamma.
- **Short (negative) gamma:** dealers' hedging tends to buy rallies and sell dips, so moves keep going in whichever direction they start. Ranges get wider and trends follow through. The market can rally hard in short gamma.

If the read is used as "long gamma means buy, short gamma means sell," it will point the wrong way about as often as the right way. It's meant to answer a different question: should I fade moves today or go with them, and how much room do my stops need?

Your access stays on through November 3 at no further cost, so here's where I'd start:

1. This short article, especially the "Common misconceptions" section near the end: https://zerogex.io/education/what-is-negative-gamma
2. The bigger picture of gamma exposure and how the levels fit together: https://zerogex.io/education/gamma-exposure-explained
3. How to use the gamma flip in practice: https://zerogex.io/education/how-to-trade-around-gamma-flip

Then, before you trade off it again, try one exercise for a week or two. US100 follows the Nasdaq 100, so set the dashboard to NDX. At the open, note whether it shows Long γ or Short γ. At the close, ask one question: was today a range day or a trend day? Ignore the direction. It won't match every day, because it's a tendency and not a rule, but after a couple of weeks you'll have your own feel for what the read is telling you.

If this changes how you'd use it and you'd like to keep your subscription, just reply before November 3 and I'll turn it back on at the same $19 a month.

Best,

Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io

## If they reply

- **They want to keep it, before Nov 3.** Dry run first, then apply:

  ```bash
  make set-cancellation EMAIL=dxtinct@gmail.com OFF=1 DRY_RUN=1
  make set-cancellation EMAIL=dxtinct@gmail.com OFF=1 YES=1
  ```

  This turns the cancel off and keeps the $20-off coupon. It sends no email,
  so reply to confirm the next charge: $19 on November 4, to the Visa ending
  8225.
- **They reply after Nov 3.** Switching back no longer works; the subscription
  and the $19 rate are gone. They come back through the pricing page. To give
  them a discount anyway, use the after-lapse path in the "If they reply"
  section of `2026-09-25-trial-cancels-oliver-chenyu.md` (the win-back stamp
  plus `/pricing?winback=1`).
- **They ask why the NDX flip was blank.** See
  `2026-09-28-sulby-nq-gamma-flip.md`. The short version: a flip more than 8%
  from the price isn't drawn, and a missing flip means NDX was modeled deep in
  long gamma.
