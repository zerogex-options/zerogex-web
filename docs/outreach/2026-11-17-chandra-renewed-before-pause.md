# Chandra: renewed before the pause, pause it for them (2026-11-17)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** On Fri Nov 13, 7:16 PM, you told Chandrashekar VM ("Chandra") how
to pause for 2 months from the Account page. Chandra replied: "dang, i missed
your email and it renewed already!"

> **Status:** draft, not sent.

## The read

- **No refund. Pausing now still makes Chandra whole.** During a pause, Stripe
  keeps billing on its normal schedule and voids every bill that comes due
  inside the pause (`behavior: 'void'`, the same setting the in-app pause uses
  in `frontend/app/api/billing/cancel-flow/route.ts`). So a 2-month pause voids
  exactly two monthly bills. Started right after a renewal, those are the
  December and January bills, and the November payment covers the stretch from
  the end of the pause to the February bill.
- **Example, renewed Nov 15:** paid Nov 15, paused Nov 17, Dec 15 and Jan 15
  voided, access back Jan 17, next charge Feb 15. One payment, about one month
  of access.
- **A refund on top would be a free month.** The pause still voids the January
  bill, so Chandra would get from the January resume to the February bill for
  nothing.
- **Pause it for them instead of asking again.** Chandra already missed one
  email. If this one gets missed too, December bills and you're back here. It's
  two minutes in the Stripe Dashboard.
- **In the Dashboard, set the resume date two days after the January bill**, not
  just "two months from today". The in-app pause resumes at the same minute two
  months out, which here lands after the January bill. The Dashboard takes a
  calendar day, and if that day is the January billing day itself, the January
  bill can land after the resume and get charged. Two days of margin covers any
  time zone.

## Steps

1. **Stripe Dashboard.** Open Chandra's customer, then the subscription. Check
   three things:
   - **It bills monthly.** If it's quarterly or annual, stop: a 2-month pause
     right after that renewal voids nothing and just takes away two months
     Chandra paid for (the reason the app only offers pauses on monthly), so
     this reply doesn't fit.
   - **It isn't already paused.** If it already shows payment collection
     paused, Chandra did it after writing. Check the resume date and drop "I've
     paused it for you" from the reply.
   - **The next invoice date**, e.g. Dec 15. Call that day of the month D.
2. **Pause.** Overflow menu (⋯) → **Pause payment collection** → **Until a
   custom date**, January D+2 (Dec 15 → Jan 17) → **Void invoices** →
   **Pause**. Not "Keep invoices as drafts", which collects them later, and not
   "Mark invoices uncollectible".
3. **Optional check**, in `~/zerogex-web` on the server (swap in Chandra's
   address):

   ```bash
   make diagnose-user EMAIL=chandras-address@example.com
   ```

   Tier reads `public`, and the recent events include
   `billing_subscription_paused` with "paused until" your January date.
4. **Send the reply.** Fill in the two dates: January D+2 and February D. Your
   Gmail signature goes under the sign-off, as in your Nov 13 email.

## Draft reply

Hi Chandra,

No worries at all, and you haven't lost anything. I've paused it for you, so there's nothing you need to do.

The payment that just went through carries over to when you're back. The pause skips your December and January bills, so you won't be charged again until {{February D}}. Your access is off while it's paused and comes back on its own on {{January D+2}}.

If you're back sooner, click "Resume now" at https://zerogex.io/account.

Enjoy the trip,

## Worth knowing (can wait)

- **No pause has ended on its own yet.** The pause shipped Nov 6. The app turns
  access back on only when Stripe reports the pause ended, and nothing
  re-checks on its own. The first pauses (if anyone has taken one) end in early
  December at the earliest. When one does, run `make diagnose-user` for that
  member and look for `billing_subscription_resumed`. If it's missing, fix it
  then, well before Chandra's January date.
