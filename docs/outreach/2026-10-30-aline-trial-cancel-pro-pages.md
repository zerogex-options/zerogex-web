# Canceled trial after trying Pro pages: alineaparecidamartinsvieira@gmail.com (2026-10-30)

A Basic trial member opened the locked Pro screen 4 times, then canceled the
trial. `make pro-interest-email` left them out because they had canceled. This
is the read, the plan, and one short founder email to send from your own inbox
(one line per paragraph, so it pastes straight into a mail client).

Checked on Nov 1 with `make diagnose-user` and the audit log.

| | |
|---|---|
| Plan | Basic monthly trial ($39), canceled, still running |
| Signed up | Sun Oct 25 at 5:55 PM ET, with Google. Picked NQ in the welcome |
| Locked Pro screen | 4 visits while on Basic, the last on Mon Oct 26 at 10:35 AM ET |
| Canceled | Thu Oct 29 at 11:47 AM ET, outside the app's cancel flow, so no reason on record |
| Last seen | Thu Oct 29 at 3:28 PM ET |
| Trial ends | **Sun Nov 1 at 4:57 PM ET** |
| Pays with | Stripe Link (no card on file) |

## The read

- **They were looking at Pro, then left.** We don't know which Pro pages. The
  visit log records the locked screen, not the page they were trying to open.
- **The trial ends before the market opens.** 4:57 PM ET on a Sunday, ahead of
  the 6 PM NQ open. Switching to Pro today would bill $59 within hours, with no
  session to try it in. That's not much of an offer.
- **So extend it two days first.** That moves the end to Tue Nov 3 at 4:57 PM
  ET and gives them the Monday and Tuesday sessions. One day isn't possible:
  `extend-trial` won't set an end less than 48 hours away. Extending keeps the
  cancellation, so if they do nothing, access ends Tuesday with no charge.
- **Then the two-day switch fits.** It opens 51 hours before the new end: Sun
  Nov 1 at 1:57 PM ET. From then, switching to Pro keeps the free days, the
  first charge is $59 on Tuesday, they can still cancel before it, and
  switching turns the cancellation off. The confirm step says all of this.
- **Send after 2 PM ET.** Before 1:57 PM, the same link ends the trial and
  charges $59 at once, which isn't what the email says.
- **Nothing else will tell them.** The two-day trial reminder skips canceled
  trials, and the Pro interest email skipped them too.
- **NQ is the hook.** They picked NQ at signup. Pro's NinjaTrader and Sierra
  Chart indicators draw the levels on an NQ chart, which is worth one sentence.
- **No discount.** Nothing says price was the problem.

## The plan

1. **Before 4:57 PM ET today, extend the trial.** Dry run first. It should
   show the new trial end as 2026-11-03T21:57:36Z, plus a note that the
   cancellation date moves out too.

   ```bash
   make extend-trial EMAIL=alineaparecidamartinsvieira@gmail.com EXTEND_DAYS=2 DRY_RUN=1
   ```

   ```bash
   make extend-trial EMAIL=alineaparecidamartinsvieira@gmail.com EXTEND_DAYS=2 YES=1
   ```

2. **After 2 PM ET, send the draft below.**

If it's already past 4:57 PM ET, the trial has ended and can't be extended.
Don't send this; the note needs rewriting.

## Draft

A new email from your own inbox. "Aline" is read off the email address. We
don't store names, so if in doubt, open with "Hi,".

**Subject:** A question before your trial ends

```
Hi Aline,

I'm Michael, the founder of ZeroGEX. I saw you canceled your trial, and that you'd tried to open some of the Pro pages, so I wanted to ask one thing before it ends.

Was there something in Pro you were looking for? Trade Bias, the Advanced Signals, backtesting? You picked NQ when you signed up, so it may also help to know that Pro includes NinjaTrader and Sierra Chart indicators that draw the levels right on your NQ chart.

Your trial was due to end today, before the market even opens, so I've extended it to Tuesday at 4:57 PM ET. That gives you the Monday and Tuesday sessions to try Pro: switch before then and those days stay free. Your first payment would be $59 for Pro on Tuesday, and you can still cancel before then and pay nothing. Switching turns your cancellation off, so you'd cancel again if Pro isn't right for you. If you don't switch, your access simply ends Tuesday with no charge.

If you'd like to try it, this link opens the switch and shows the exact terms before anything changes:
https://zerogex.io/login?next=%2Fpricing%3Fplan%3Dpro%26cadence%3Dmonthly%26switch%3Dpro

And if it was something else entirely, just reply and tell me. I read every message.

Best,
Michael
Founder, ZeroGEX
Know the levels that matter before price gets there.
zerogex.io
```

## If they reply

- **They want Pro.** Point them to the link. If the trial has already ended,
  they can subscribe to Pro from the pricing page, paid up front under the
  money-back guarantee.
- **They want longer to try it.** Extend again, dry run first (the new end
  must be at least 48 hours away). The two days move to the new end date.
  Extending doesn't turn their cancellation off. Switching to Pro does.
- **It was price.** No discount. If they ask, Pro annual is $299, about $24.92
  a month, paid up front under the money-back guarantee.
- **Something else.** Answer that, with no Pro pitch.
- **No reply.** Nothing to do. Their access ends Tuesday at 4:57 PM ET, with
  no charge.
