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
  one command.
- **Use `make pause-subscription`, not the Stripe Dashboard.** It sets the same
  pause the Account page does, resuming at the same minute two months out, and
  prints the bills it skips and the next charge date. The Dashboard resumes on
  a calendar day, and if that day is the January billing day, the January bill
  can land after the resume and get charged.

## Steps

Both run in `~/zerogex-web` on the server. Swap in Chandra's address.

1. **Preview**, no changes:

   ```bash
   make pause-subscription EMAIL=chandras-address@example.com MONTHS=2
   ```

   Check that `Auth DB:` shows `/var/lib/zerogex/auth.db`, `Plan:` ends in
   `monthly`, `Scheduled cancel: no`, and `Bills skipped:` lists a December
   and a January date. If it stops with "not monthly", stop too: this reply
   doesn't fit. If it says "Already paused", Chandra did it after writing.
   Skip step 2 and drop "I've paused it for you" from the reply.
2. **Pause:**

   ```bash
   make pause-subscription EMAIL=chandras-address@example.com MONTHS=2 YES=1
   ```

   It should end with `Done. ... is paused for 2 months.` and `The site has it:
   tier public, paused until ...`. If it says the site hasn't heard yet, run
   `make diagnose-user` for Chandra a minute later.
3. **Send the reply.** Fill in the two dates from the output: `Access: ... back
   on its own` and `Next charge:`. Your Gmail signature goes under the
   sign-off, as in your Nov 13 email.

## Draft reply

Hi Chandra,

No worries at all, and you haven't lost anything. I've paused it for you, so there's nothing you need to do.

The payment that just went through carries over to when you're back. The pause skips your December and January bills, so you won't be charged again until {{next charge date}}. Your access is off while it's paused and comes back on its own on {{back-on date}}.

If you're back sooner, click "Resume now" at https://zerogex.io/account.

Enjoy the trip,

## Worth knowing (can wait)

- **No pause has ended on its own yet.** The pause shipped Nov 6. The app turns
  access back on only when Stripe reports the pause ended, and nothing
  re-checks on its own. The first pauses (if anyone has taken one) end in early
  December at the earliest. When one does, run `make diagnose-user` for that
  member and look for `billing_subscription_resumed`. If it's missing, fix it
  then, well before Chandra's January date.
