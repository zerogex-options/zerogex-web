# Naif: the free month didn't happen, his access ended Nov 18 (2026-11-19)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound, Thu Nov 19, 9:27 AM ET.** Naif maibd (na777knsa@gmail.com), subject
"Free Month Subscription Activation", with a screenshot of the Oct 28 reply
promising a free month. "My subscription has now expired, and I can no longer
access the platform. Please activate the promised free month on my account."
Same member as `2026-10-27-naif-pro-chart-lag.md` and
`2026-11-12-naif-bot-trading-and-trade-audit-403.md`.

> **Status:** not yet checked on the box. Step 1 confirms the cause; the fix
> and the draft below are for the likely one (he canceled before Nov 18).

## The read

The free month was a **$59 credit on his Stripe balance** (Oct 27,
`make gift-month`, balance transaction `cbtxn_1UVMFV4AOiqteMYYAwwXtXwh`). A
credit only pays an invoice. It does not extend a subscription.

**Likely cause: he canceled after Oct 27.** `gift-month` refuses a subscription
already set to cancel, so on Oct 27 his was renewing. If he canceled later, the
subscription ended on Nov 18 as scheduled, no renewal invoice was raised, the
credit had nothing to pay, and his tier dropped to free. The timing fits: his
email came the morning after his Nov 18 renewal date. The $59 should still be
sitting unused on his balance.

**Fix: hand him the month as access, then remove the unused credit.**
`make reinstate-paid-period` re-creates his Pro plan through a date you choose,
already set to cancel then, so it never bills and sends no email. Through
**Dec 19**, not Dec 18, to make up the day he lost. Since he had canceled, it
ends then unless he clicks **Keep my plan** on the Account page, which renews
at $59 on Dec 19. The credit then has to come off, or it would pay that Dec 19
renewal too and make it two free months.

**A bug this would have hit, fixed on this branch.** The script took the plan
from the first line of his newest paid invoice. For Naif that is the Oct 25
Basic-to-Pro upgrade ($16.06), whose first line is the credit for the Basic
time he gave up. It would have put him back on **Basic**. It now takes the line
that was actually charged (`readInvoiceChargedPriceId` in
`core/stripeInvoice.ts`). Checked with a dry run against a stub of Stripe in
the same shape (`tests/reinstatePaidPeriod.test.ts`): before the fix
"basic / monthly", after it "pro / monthly". **Deploy this branch before
running step 2.**

## Steps (on the box, in `~/zerogex-web`, after deploying this branch)

1. **Confirm the cause.**

   ```bash
   make diagnose-user EMAIL=na777knsa@gmail.com
   ```

   The fix below is right if you see all three:
   - Stripe subscription `Status` is `canceled`.
   - The audit events show `billing_cancel_flow_submitted` or
     `stripe_cancellation_requested` between Oct 28 and Nov 18, then
     `stripe_subscription_deleted` around Nov 18.
   - Stripe customer `Balance` is `-$59.00`.

   **Anything else** (no cancel request in the audit log, a failed or open
   November invoice, `past_due` or `paused`, a balance other than -$59, or Pro
   still active): stop and paste me the output. The fix below would be wrong.

   Also note whether the audit events show `Revoked N API key(s): tier dropped
   pro → public`. If they do, keep the API key paragraph in the draft.

2. **Preview the reinstatement.**

   ```bash
   make reinstate-paid-period EMAIL=na777knsa@gmail.com UNTIL=2026-12-19T15:00:00Z
   ```

   It must say `Plan to reinstate:  pro / monthly`. If it says basic, stop.
   Two lines are expected here and fine: "a plan-change invoice" (it found the
   Oct 25 upgrade) and "check that — no refund was detected" (nothing was
   refunded; the comp is the free month).

3. **Apply it.**

   ```bash
   make reinstate-paid-period EMAIL=na777knsa@gmail.com UNTIL=2026-12-19T15:00:00Z YES=1
   ```

   It ends with "Done. na777knsa@gmail.com is 'pro' ... Access ends
   2026-12-19T15:00:00.000Z".

4. **Remove the unused $59 credit** in the Stripe dashboard: open his customer,
   find the credit balance section, adjust the balance, choose Debit, $59.00,
   with a note such as "Free month given as access through Dec 19 instead".
   Then `make diagnose-user EMAIL=na777knsa@gmail.com` should show Pro, the
   subscription `active` with `Cancel at period end: yes`, a current period
   end of Dec 19, and no Balance line.

5. **Send the reply below.**

## Draft reply

Reply in the same thread.

**Subject:** Re: Free Month Subscription Activation

Hi Naif,

I'm sorry about this. Your free month is now active, and you have full Pro access through December 19, at no charge.

Here's what went wrong. I set up the free month as a credit toward your November 18 renewal. Because your subscription was set to cancel on that date, there was no renewal for the credit to pay, so your access ended instead of continuing for free. I should have set it up in a way that didn't depend on the renewal.

Since you had canceled, your plan will end on December 19 and you won't be charged. If you'd like to stay on after that, click "Keep my plan" on your Account page, and it will renew at $59 on December 19. Otherwise you don't need to do anything.

One more thing: your API key stopped working when your access ended. If you use one, please create a new key on your Account page.

Best,
Michael
Founder, ZeroGEX

(Delete the API key paragraph unless step 1 showed `Revoked ... API key(s)`.)

## If he replies

- **"I never canceled."** Step 1's audit row shows how the cancel was made
  (Account page or Stripe's billing portal) and when. Send him the date. If
  there is no cancel request in the audit log at all, that is the "anything
  else" case: paste me the output.
- **Wants to keep the subscription.** "Keep my plan" does it. If he asks you
  to do it for him: `make set-cancellation EMAIL=na777knsa@gmail.com OFF=1 YES=1`
  (preview first with `DRY_RUN=1` in place of `YES=1`). Only once the $59
  credit is off (step 4), or that renewal is free too.

## Worth knowing (can wait)

- **A gift credit does nothing if the member cancels before the renewal.**
  `gift-month` only checks at the moment of the gift, and nothing warns either
  side later. This is how Naif's month got lost. A fix (warn on cancel when the
  balance holds a goodwill credit, or have `gift-month` push the period out
  instead) is its own job; nothing else is waiting on it.
- **The same first-line plan read is in orphan-payment recovery** (the
  webhook's automatic recovery, `recover-orphan-payment`,
  `scan-orphan-payments`). It would only go wrong for an upgrade invoice that
  failed, was left open, and got paid after the subscription was canceled, so
  it was left alone here.
