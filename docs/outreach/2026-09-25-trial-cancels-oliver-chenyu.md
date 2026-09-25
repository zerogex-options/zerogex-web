# Two trial cancels on Friday night: Oliver and Chenyu (2026-09-25)

Two Pro monthly trials were canceled in-app on Friday evening, 55 minutes
apart. Both picked a survey reason and typed nothing. Both clicked past 25% off
for a year and a pause in the cancel modal, and the ack email offered the 25%
again. Neither has paid anything, and both keep Pro until their trial ends.

This is the read and two short 1:1 founder drafts, sent from your own inbox,
one line per paragraph so they paste straight into a mail client.

Everything below is from `make diagnose-user` on each address (run 2026-09-25)
and the Stripe search results for each.

| | **orozcooliver04@gmail.com** | **desmondqi93@gmail.com** |
|---|---|---|
| User id | `user_c0230ea501afb288b172a855` | `user_bfd6ce31d57e4af5e9715885` |
| Name (Stripe) | oliver orozco | Chenyu |
| Plan | $59.00/mo, **Pro monthly** trial, no discount | same |
| Account created | Sun Sep 13, 8:31 PM ET | Mon Sep 21, 3:29 PM ET |
| Trial started | **Sun Sep 20, 6:52 PM ET** | Mon Sep 21, 3:31 PM ET |
| Canceled | Fri Sep 25, 6:31 PM ET, 16 minutes after the trial-end reminder | Fri Sep 25, 7:26 PM ET, before any reminder |
| Reason | Switched service, nothing typed | Too expensive, nothing typed |
| Access ends | **Sun Sep 27, 6:52 PM ET** | **Mon Sep 28, 3:31 PM ET** |
| Paying with | Visa ending 6035 | Link |
| API key | none | generated within 30 seconds of the welcome email (prefix `1ysd6JuL`) |
| Money ever collected | none | none |

## Oliver did not get a two-week trial

His trial was 7 days, the same as everyone's. The cancellation alert's
**Signed up** line is when he created his account, not when his trial started,
and he created the account a week before he started the trial:

| ET | What happened |
|---|---|
| Sun Sep 13, 8:31 PM | Made an account and opened Pro checkout, then left without finishing. No card, no trial. Stripe creates the customer record when checkout opens, which is why Stripe also says Sep 13. |
| Sep 13 to Sep 20 | Free tier only. He got the never-paid nudge that night and the checkout-recovery email on Tuesday. |
| Sun Sep 20, 6:52 PM | Came back, finished checkout, and the 7-day Pro trial started. Stripe agrees: the subscription, the card setup and the $0.00 invoice are all dated Sep 20. |
| Sun Sep 27, 6:52 PM | Trial ends, exactly 7 days later. |

The alert's **Tenure** line (11 days) counts from account creation too, so it
reads like a paying member rather than day 5 of a 7-day trial. See the end of
this note.

## The read

**Oliver: optional, and only for the intel.**

- The trial-end reminder went out at 6:15 PM and he canceled at 6:31. That is
  the reminder doing its job: he decided not to pay $59 and turned it off
  before the charge.
- "Switched service" with nothing typed. The only useful thing left to learn is
  which service, and what it does better. That is worth a one-question email. A
  discount is not: he has already clicked past 25% off twice.
- Light visible use: one sign-in from a mobile network on Monday afternoon, and
  he was back in the app Friday at 6:54 PM, after canceling. Page views don't
  write audit rows, so there may have been more.

**Chenyu: worth sending, ideally before Monday 3:31 PM ET.**

- Signed up Monday at 3:29 PM, was in a Pro trial two minutes later, and
  generated an API key within 30 seconds of the welcome email.
- Canceled Friday night with "too expensive", before the trial-end reminder
  would have gone out.
- He turned down $44.25 a month (25% off Pro monthly). The only prices below
  that are **Pro annual, $299, about $25 a month**, and **Basic at $39**.
  Neither has been put in front of him.
- Which one fits depends on whether he uses the API: Basic drops the API, the
  advanced signals and backtesting. The draft names both and lets him pick, so
  you don't need to check the key first.
- **He can switch to annual himself** on /pricing while his trial is still
  running. The page quotes $299 and asks him to confirm, then charges it, ends
  the trial, clears the cancel and marks the payment for the 7-day money-back
  guarantee (`in_app_start_paid`, `app/api/billing/change-plan/route.ts`).
  After Monday it still works as a fresh checkout, but his API key will have
  been revoked by then.

## Verify first

- **Re-run `make diagnose-user` on each address right before sending.** If
  `Cancel at period end` has flipped to `no`, they took the offer or resumed on
  their own. Send nothing, or a thank-you.
- **The access lines are dated.** Oliver's "until Sunday evening" is wrong
  after Sun 6:52 PM ET, and Chenyu's "until Monday afternoon" after Mon 3:31 PM
  ET. Cut the line if you send later.
- **Chenyu's name.** Stripe has "Chenyu"; the address says Desmond. The draft
  uses Chenyu, the name on his payment details.

## Draft: Oliver

**Subject:** Which service did you switch to?

Hi Oliver,

I saw you canceled your ZeroGEX trial because you switched to another service. Fair enough, and this isn't a pitch.

Would you tell me which one you went with, and what made it the better fit? One line is plenty.

Your access stays on until Sunday evening either way.

Best,
Michael
Founder, ZeroGEX

## Draft: Chenyu

**Subject:** Quick question about the price

Hi Chenyu,

I saw you canceled your ZeroGEX trial because it was too expensive. That's fair, and I won't argue with it.

Can I ask one thing? Too expensive compared to what: the size of the account you trade, how often you'd use it, or another tool that does the job for less? One line is plenty.

There are also two cheaper ways to keep it, in case they didn't stand out during the trial:

- Pro billed yearly is $299, about $25 a month. You can switch on the pricing page, and it comes with a 7-day money-back guarantee.
- If you don't need the API, the advanced signals or backtesting, Basic is $39 a month. Reply and I'll switch you over.

If neither fits, there's nothing you need to do. Your access stays on until Monday afternoon.

Best,
Michael
Founder, ZeroGEX

## If they reply

- **Oliver names a service.** Nothing to do but read it.
- **Chenyu switches to annual.** Nothing to do. The switch clears the cancel
  and the webhook moves him to Pro annual.
- **Chenyu wants Basic before Monday 3:31 PM ET.** Stop the cancel with
  `make set-cancellation EMAIL=desmondqi93@gmail.com OFF=1 DRY_RUN=1`, then the
  same with `YES=1` in place of `DRY_RUN=1`. Then, in the Stripe Dashboard,
  update the price on `sub_1UICvZ4AOiqteMYYfMeg5YvM` to Basic monthly with no
  proration. The trial still ends Monday and Basic is billed from then. The
  webhook moves him to Basic, which revokes his API key, so say so in your
  reply.
- **Chenyu wants Basic after his trial has ended.** Send him to /pricing. Until
  October 1, checkout applies the best offer on its own, which brings Basic to
  about $29 a month for the first year. It is charged up front, since he has
  already had a trial.
- **Chenyu names a monthly price near $44.** He has already declined that.
  Anything lower is your call.

## Worth fixing later (not urgent)

**The cancellation alert's Signed up and Tenure lines count from account
creation, not the trial start.** `frontend/scripts/send-cancellation-alerts.mts`
passes `users.created_at` as `accountCreatedAtIso`, and
`frontend/core/cancellationAlert.ts` uses it for both lines. For anyone who
abandons checkout and comes back later, which is what the checkout-recovery
email is for, the trial looks longer than it was. A "Trial started" line, with
tenure counted from it, would have answered "how did he get two weeks?" on
sight.
