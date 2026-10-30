# Canceled trial after trying Pro pages: alineaparecidamartinsvieira@gmail.com (2026-10-30)

A Basic trial member opened the locked Pro screen 4 times, then canceled the
trial. `make pro-interest-email` left them out because they had canceled. This
is the read, what to check first, and one short founder email to send from your
own inbox (one line per paragraph, so it pastes straight into a mail client).

Everything below is from the `make pro-interest-email` dry run of Oct 30 and the
code on `release`. `make diagnose-user` has not been run yet.

| | |
|---|---|
| Plan | Basic trial, canceled, still running |
| Locked Pro screen | 4 visits while on Basic, the last on Mon Oct 26 at 10:35 AM ET |
| Why they canceled | Not known yet (see Verify first) |
| Trial ends | Not known yet. By Nov 2 if it's the usual 7-day trial |

## The read

- **They were looking at Pro, then left.** We don't know which Pro pages. The
  visit log records the locked screen, not the page they were trying to open.
- **The two-day switch fits them.** In the last two days of a Basic monthly
  trial, switching to Pro keeps those days free. The first charge, on the
  trial-end date, is $59, and they can still cancel before it and pay nothing.
  Switching also turns their cancellation off. The confirm step tells them so
  before anything changes.
- **Nothing else will tell them.** The two-day trial reminder skips canceled
  trials, and the Pro interest email skipped them too. This note is the only
  place they'll hear about it.
- **Send it once the two days are open.** That's 51 hours before the trial
  ends. Before then, the same link ends the trial and charges $59 that day,
  which isn't what the email says. Their trial was already running on Oct 26,
  so on a 7-day trial the two days are open now or open within a day.
- **No discount.** Nothing says price was the problem. The two free days are
  the offer.

## Verify first

1. **Trial end and plan.** Run:

   ```bash
   make diagnose-user EMAIL=alineaparecidamartinsvieira@gmail.com
   ```

   - Under the Stripe subscription, **Trial end** is the date for the draft.
     It's in UTC: ET is 4 hours earlier until 2 AM on Nov 1, then 5 hours
     earlier.
   - **Item 0 price** should read $39.00 / month. The two-day switch only
     applies to Basic monthly. If it reads anything else, tell me and I'll
     redo the note.

2. **Why they canceled.** Run:

   ```bash
   sqlite3 -header -column /var/lib/zerogex/auth.db "SELECT a.created_at, a.message FROM audit_events a JOIN users u ON u.id = a.user_id WHERE u.email = 'alineaparecidamartinsvieira@gmail.com' AND a.type IN ('stripe_cancellation_requested', 'billing_cancel_flow_submitted') ORDER BY a.created_at;"
   ```

   - If the reason is **too expensive**, don't send this one. Tell me and I'll
     write a different note.
   - If they typed a comment, answer it in the second paragraph.

3. **Their name.** "Aline" is read off the email address. The Stripe
   dashboard shows the name on the card. If in doubt, open with "Hi,".

## Draft

A new email from your own inbox. Replace `[TRIAL END]` with the day and time
in ET, for example "Sunday, November 1 at 11:33 AM ET".

**Subject:** A question before your trial ends

```
Hi Aline,

I'm Michael, the founder of ZeroGEX. I saw you canceled your trial, and that you'd tried to open some of the Pro pages, so I wanted to ask one thing before it ends.

Was there something in Pro you were looking for? Trade Bias, the Advanced Signals, backtesting, the API? If that's part of why you canceled, there's an easy way to try it.

Your trial ends [TRIAL END]. In the two days before that, you can switch to Pro and keep those days free. Your first payment would be $59 for Pro on that date, and you can still cancel before then and pay nothing. Switching turns your cancellation off, so you'd cancel again if Pro isn't right for you.

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
- **They want longer to try it.** Extend the trial, dry run first. The two
  days then move to the new end date.

  ```bash
  make extend-trial EMAIL=alineaparecidamartinsvieira@gmail.com EXTEND_DAYS=7 DRY_RUN=1
  ```

  ```bash
  make extend-trial EMAIL=alineaparecidamartinsvieira@gmail.com EXTEND_DAYS=7 YES=1
  ```

  Extending doesn't turn their cancellation off. Switching to Pro does.
- **It was price.** No discount. If they ask, Pro annual is $299, about $24.92
  a month, paid up front under the money-back guarantee.
- **Something else.** Answer that, with no Pro pitch.
- **No reply.** Nothing to do. Their access ends when the trial does, with no
  charge.
