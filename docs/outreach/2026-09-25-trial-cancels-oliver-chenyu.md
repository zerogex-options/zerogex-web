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
- He turned down $44.25 a month (25% off Pro monthly), in the cancel modal and
  again in the ack email.
- **Revised 2026-09-26: offer him 50% off Pro for his first year**, $29.50 a
  month for 12 months and then $59. That is below anything he has been shown,
  and it goes onto his current trial: same account, same API key, nothing to
  re-subscribe. The first version of the draft offered Pro annual ($299) and
  Basic ($39) instead. Discounted Pro is cheaper per month than Basic, so both
  lines came out.
- **Use the win-back coupon, not the business card's `TARGET` coupon.**
  `make honor-winback-discount` applies your standing win-back coupon
  (`STRIPE_COUPON_WINBACK_PRO_MONTHLY`), and `PERCENT=50` makes it refuse
  anything but 50% off for a year. `COUPON=<TARGET coupon id>` would work too,
  but every use adds to that coupon's redemption count in Stripe, which is how
  you measure the card. And if the standing coupon is 50%, it is the same offer
  the automatic win-back email (`make winback`) would send him about a month
  after his trial lapses, so this brings it forward rather than inventing a
  new deal.
- **The tool also turns his cancel off**, so the trial converts Monday at
  $29.50 on Link. Run it only after he says yes. It only works on a trialing or
  active subscription, so it has to happen before Mon 3:31 PM ET.

## Verify first

- **Re-run `make diagnose-user` on each address right before sending.** If
  `Cancel at period end` has flipped to `no`, they took the offer or resumed on
  their own. Send nothing, or a thank-you.
- **The access lines are dated.** Oliver's "until Sunday evening" is wrong
  after Sun 6:52 PM ET, and Chenyu's "until Monday afternoon" after Mon 3:31 PM
  ET. Cut the line if you send later.
- **Chenyu's name.** Stripe has "Chenyu"; the address says Desmond. The draft
  uses Chenyu, the name on his payment details.
- **Dry-run the discount before sending Chenyu's note**, so the 50% is backed
  before you promise it. This writes nothing:
  `make honor-winback-discount EMAIL=desmondqi93@gmail.com PERCENT=50 DRY_RUN=1`.
  The `Coupon to apply` line should read 50% off for 12 months, and
  `cancel_at_period_end` should show `true → false`. If it refuses because
  there is no standing win-back coupon, or it isn't 50%, add `CREATE_COUPON=1`,
  which makes (or reuses) a 50%-for-a-year coupon.

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

*Revised 2026-09-26 to lead with 50% off Pro for the first year. The first
version asked "compared to what?" and offered Pro annual and Basic.*

**Subject:** About the price

Hi Chenyu,

I saw you canceled your ZeroGEX trial because it was too expensive. That's fair.

If price is what's in the way, I can do 50% off Pro for your first year: $29.50 a month for 12 months, then the regular $59. Same account, same API key, nothing to set up again.

Just reply before your trial ends on Monday afternoon and I'll set it up.

And if it's more than the price, I'd like to know what. One line is plenty.

Best,
Michael
Founder, ZeroGEX

## If they reply

- **Oliver names a service.** Nothing to do but read it.
- **Chenyu says yes before Mon 3:31 PM ET.** Run the same command as the dry
  run with `YES=1` in place of `DRY_RUN=1` (plus `CREATE_COUPON=1` if the dry
  run needed it). It adds the coupon and turns the cancel off in one step, and
  sends no email, so reply to confirm: $29.50 is charged Monday when the trial
  ends, then monthly. His API key keeps working.
- **Chenyu says yes after his trial has ended.** The tool won't touch a
  subscription that has ended, so he re-subscribes through checkout, which
  applies the win-back coupon once his account is marked as sent the win-back
  offer:
  `sqlite3 /var/lib/zerogex/auth.db "UPDATE users SET winback_email_sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE email = 'desmondqi93@gmail.com';"`
  Then send him https://zerogex.io/pricing?winback=1. He pays $29.50 up front
  (no second trial), and he needs a new API key, because the old one is revoked
  when the trial ends. The stamp also stops the automatic win-back email from
  offering it again later. Checkout can only apply the standing win-back
  coupon, so this path gives 50% only if the dry run passed without
  `CREATE_COUPON=1`. If it needed that flag, tell him to reply before Monday
  instead of relying on this.
- **Chenyu names something other than price.** Nothing to set up. Read it.

## Worth fixing later (not urgent)

**The cancellation alert's Signed up and Tenure lines count from account
creation, not the trial start.** `frontend/scripts/send-cancellation-alerts.mts`
passes `users.created_at` as `accountCreatedAtIso`, and
`frontend/core/cancellationAlert.ts` uses it for both lines. For anyone who
abandons checkout and comes back later, which is what the checkout-recovery
email is for, the trial looks longer than it was. A "Trial started" line, with
tenure counted from it, would have answered "how did he get two weeks?" on
sight.
