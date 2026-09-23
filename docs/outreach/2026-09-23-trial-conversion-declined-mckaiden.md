# Trial conversion declined, no grace: Mckaiden (2026-09-23)

A Pro monthly trial converted today, the first charge failed, and the account
dropped to **Public in the same second**. There was no Trial Grace, no retry, and
their API key was revoked on the spot. This note covers why that happened (it is
the payment method, not a bug in the grace code) and has a 1:1 founder draft.

American English, one line per paragraph in the draft, so it pastes straight
into a mail client. This is a **1:1 note from your own inbox**, not a campaign
send, same as the Vernon draft.

Everything below is from `make diagnose-user EMAIL=lowrymckaiden@gmail.com`
(run 2026-09-23) and the Stripe dashboard view of the failed payment.

| | **lowrymckaiden@gmail.com** |
|---|---|
| User id | `user_bceb27f2b877240ea7a7f9a9` |
| Name (Stripe billing) | Mckaiden lowry |
| Plan | $59.00/mo, **Pro monthly** (`price_1TdDBo4AOiqteMYYQtZgAbha`) |
| Signed up | 2026-09-16 14:52 UTC (Google) |
| Checkout | a SetupIntent failed at 14:54 (`generic_decline`); the trial started at 15:39 on **Cash App Pay** |
| API key | generated 2026-09-16 15:40 (prefix `SVN9YLPZ`), **revoked 2026-09-23 16:40** |
| Last seen | 2026-09-23 08:27 UTC, the morning the trial ended |
| Trial ended | 2026-09-23 15:39:49 UTC; the invoice was created 15:40:12 |
| Declined | **2026-09-23 16:40:34 UTC (12:40 PM ET)**, attempt 1 |
| Decline | `unknown`: `payment_method_provider_decline` / `cashapp_payment_declined` / `PAYMENT_DECLINED_OTHER` |
| Subscription | `sub_1UGKw54AOiqteMYYrkjrUsHt`, **deleted 16:40:34**, same second as the decline |
| Open invoice | `in_1UIsHI4AOiqteMYYZbtjdA2U`, $59, `open`, buys access until 2026-10-23 15:39:49 UTC |
| Grace | **never opened** |
| Money ever collected | **none** |
| Risk level | Normal |
| Annualized | $708 at list; $588 on the monthly promo |

## Why they got no grace period

**The grace window only opens when Stripe marks a subscription `past_due`, and
this one never went past due.** `decidePaymentGrace`
(`frontend/core/paymentGrace.ts`) closes or refuses the window for every status
except `past_due`. The window is opened by the first `past_due` sync in
`syncSubscriptionToUser`. Vernon's Link subscription on 2026-09-21 went
`active → past_due`, and trial grace opened as designed. This subscription went
`active → canceled`:

```
15:40:13.618  stripe_subscription_sync      status=active tier=pro   (trial-end invoice created)
16:40:34.436  stripe_payment_failed         attempt 1
16:40:34.450  stripe_subscription_deleted   tier reset to public     (14 ms later)
16:40:34.644  api_key_auto_revoked          pro → public
16:40:34.771  payment_failed_email_sent     trial-conversion variant
```

`customer.subscription.deleted` goes to `clearSubscriptionFromUser`
(`frontend/app/api/webhooks/stripe/route.ts`). That function always writes
`tier = 'public'`, clears the grace anchor and revokes API keys. It is built for
the normal case, where a deletion means Stripe has already used up weeks of
retries, so grace does not apply on that path.

**Stripe cancelled on the first attempt because Cash App Pay is not a card.**
Smart Retries covers card payment methods. By default, Stripe does not
automatically retry failed non-card payment methods (ACH Direct Debit is the
exception). It skips straight to the end-of-dunning action, which on this
account is *Cancel the subscription* (`docs/billing-anti-abuse-runbook.md` §3).
So the first decline was also the last attempt, and the cancel went out with it.
The 14 ms gap between the two webhook rows shows Stripe did both in one step.
No person cancelled it, and no code of ours did either: nothing in the app
cancels a subscription on a payment failure.

*Source caveat:* the non-card rule comes from Stripe's automatic-collection
docs as quoted in search results. Stripe's doc domains are blocked from the
session this was written in. The same-second cancel supports it. **Confirm it in
the dashboard** (see Verify first).

**What this means beyond this account:** every Cash App Pay member, whether
converting from a trial or renewing, gets no retry, no grace and an instant
API-key revocation on the first decline. `BILLING_PAYMENT_GRACE_DAYS` cannot help,
because there is no retry to wait for. See **Worth a separate ticket**.

## The read

**They were using it.** They generated an API key within a minute of the trial
starting and were last seen the morning the trial ended. Anything they wired to
that key began failing at 12:40 PM ET today, in the middle of the session, with
no warning. That is the main reason to write: if they are using the key, they
are looking at auth failures with nothing to explain them.

**Send them to `/pricing` and void the open invoice first.** The October pricing
shipped on 2026-09-22/23 (`docs/pricing-october-2026-runbook.md`). If it is
deployed (see Verify first), it changes which path is best for them.

- **A fresh Pro checkout** is paid up front, as every non-trial plan now is.
  It carries the **7-day money-back guarantee**: in the checkout route,
  `moneyBackCovered` is true for them because they get no trial and have never
  used a refund. While the promo is on, it is also **$49/mo for 12 months**
  instead of $59. It is the standard flow, and the page states the price and
  the terms next to the Subscribe button.
- **Paying the open invoice** would also work: orphan recovery re-creates Pro to
  Oct 23. But it is $59 with no guarantee, and there are only two ways to reach
  it. One is an `invoice.stripe.com` link, which `8e4dfaf` just removed from
  every payment email as a spam-filter risk. The other is a trip through the
  billing portal's invoice history.
- **Leaving the invoice open next to a `/pricing` restart is a double-pay
  trap.** If they restart and later click the pay link in this afternoon's
  automated email, orphan recovery sees `local_subscription_present` and grants
  nothing. That is $59 for no access, and a refund to issue.

So void `in_1UIsHI4AOiqteMYYZbtjdA2U` **before** sending. The draft then tells
them they owe nothing, and one clean path is left. Voiding gives up nothing
they would actually use: whichever way they come back, they pay for the same
Pro.

**Do not push a card.** A card SetupIntent failed (`generic_decline`) 45 minutes
before they completed checkout with Cash App Pay. Cash App may be the method that
works for them. The draft names no payment method.

**Name no reason.** `diagnose-user` classes this decline `unknown`, meaning no
usable decline code, so use neutral copy. `PAYMENT_DECLINED_OTHER` does not
tell us whether it was balance, a Cash App limit or a revoked authorization. The
draft says Cash App declined it and nothing more.

**Their old key is gone for good.** `revokeAllApiKeys` revokes; there is no
reinstate. When Pro comes back they have to generate a new key at `/account` and
swap it in.

## ⚠ Verify first

- **Re-run `make diagnose-user EMAIL=lowrymckaiden@gmail.com`.** Invoice still
  `open`, `MONEY EVER COLLECTED` still NO, tier still `public`, and no
  `billing_orphan_payment_recovered` row. If they have already paid the
  invoice from the automated email, they are restored. Do not void or send
  this. Send one line saying they are all set and need a new API key.
- **Check the cancellation reason in the dashboard.** Open
  `sub_1UGKw54AOiqteMYYrkjrUsHt`. It should read cancelled for *payment failed*
  (`cancellation_details.reason = payment_failed`), and the invoice should show
  no next payment attempt. If it reads anything else, the draft's "no automatic
  retry" sentence is wrong. Cut it.
- **Look at `/pricing` logged out.** Check that the Pro monthly card shows the
  money-back guarantee note, which confirms the new pricing is deployed. If it
  does not, cut the guarantee sentence. If it shows the $10-off promo, you can
  add this line after the guarantee sentence: *If you restart by October 1, Pro
  is $49 a month for your first year.*
- **Void the invoice, then send.** Dashboard → Invoices →
  `in_1UIsHI4AOiqteMYYZbtjdA2U` → *Void invoice*. `make void-stale-invoices`
  will not do it, because it refuses while the invoice still buys access.
  Voiding is final, and the draft states it as done.
- **Send today.** The draft says "today" and "12:40 PM Eastern". If it goes out
  later, change "today" to "yesterday" or the date.

## What they have already been sent

- `paid_welcome_email_sent` 2026-09-16 · `trial_value_nudge_sent` 2026-09-18 ·
  `trial_reminder_email_sent` 2026-09-21
- `payment_failed_email_sent` **2026-09-23 16:40:34 UTC**, the trial-conversion
  variant, sent 0.3 s *after* the subscription was deleted. It went out about an
  hour before `8e4dfaf` moved these emails to `/account`, so their copy still
  buttons to the hosted invoice. No grace window was open, and with no retry
  scheduled it should have rendered the `unknown`-category copy like this
  (rendered from the pre-`8e4dfaf` `buildDeclineEmailCopy`):

  > **Subject:** Your ZeroGEX trial ended — the first payment did not go through
  >
  > … The first charge on the card on file did not go through. If the account
  > has already dropped to the free Public tier, full access switches back on
  > automatically the moment a charge succeeds.
  >
  > Stripe has made its last automatic attempt, so it will not retry on its own.
  > You can complete it yourself with the link below — it takes any card.

  The noun is wrong: they have no card on file. The access line hedges on
  something the webhook could have known. It also says nothing about the
  subscription having closed, or about the API key. Once the invoice is voided,
  its link is dead too, which is why the draft says so.

## Draft

**Subject:** Why your ZeroGEX access stopped

Hi Mckaiden,

Your trial ended today, and Cash App declined the first $59 Pro payment. Cash App Pay payments don't get an automatic retry, so the subscription closed right away. That's why your account moved to the free tier and your API key stopped working at about 12:40 PM Eastern.

I've closed out that $59 bill, so you don't owe anything, and the payment link in the earlier email no longer works.

If you'd like Pro back, you can restart it any time at https://zerogex.io/pricing. It comes with a 7-day money-back guarantee.

Your old API key can't be reactivated, so once Pro is back, generate a new one at https://zerogex.io/account and swap it in wherever you used the old one.

If you'd rather not continue, there's nothing you need to do.

Michael
Founder, ZeroGEX

## After you send

- **If they restart**, checkout creates a new subscription and the ordinary sync
  grants Pro. Expect the automated welcome-back email as well:
  `subscription_lapsed = 1` makes the first active sync send it. That is normal.
  It counts as a new paid start, not a trial conversion, so this trial stays
  lost in the conversion numbers.
- **If they restart on Cash App Pay**, the checkout charge is on-session
  (they approve it in Cash App). Each renewal is not, and a declined renewal
  cancels instantly again, the same as today.
- **A money-back request within 7 days** goes through the Account page panel, or
  `make money-back-refund` if it arrives by email. See
  `docs/pricing-october-2026-runbook.md` §4.
- **With the invoice void**, they no longer qualify for
  `make open-invoice-recovery` and the Oct 23 value cliff no longer applies.
  Nothing else needs watching.

## Worth a separate ticket

- **Cash App Pay members get no retry, no grace and instant key revocation.**
  Under the new pricing, Pro and every non-monthly plan are charged at
  checkout, on-session. So Cash App Pay is now exposed on renewals and on Basic
  monthly trial conversions. Checkout sets no `payment_method_types`, so the
  Dashboard payment-method configuration decides whether Cash App Pay is
  offered. Changing the end-of-dunning action to *leave past_due* would give
  Cash App Pay a grace window, but it would also leave every card subscription
  past due for good once its retries run out. Adding app-side grace to a
  deleted subscription would be free Pro with nothing retrying behind it.
  **Recommendation:** get the Cash App Pay cohort's size and conversion from
  `make audit-trial-conversions`, which splits by payment-method type. If it is
  more than a one-off, turn Cash App Pay off for subscriptions.
- **The deletion audit row drops Stripe's cancellation reason.**
  `formatCancellationReasonSuffix` (`frontend/core/cancellationReason.ts`)
  records only the portal survey `feedback` and `comment`, never
  `cancellation_details.reason`. So `diagnose-user` prints "Stripe cancelled it
  for nonpayment" and "someone cancelled it" identically. That is why this case
  needed digging. The suffix format is parsed by churn-breakdown and is
  round-trip tested, so the parser has to learn the new token too.
- **The trial-conversion email still says "card" for wallet methods** (open
  since the Vernon note). The `invoice.payment_failed` branch already calls
  `subscriptions.retrieve` for the trial check, so it could also see
  `status === 'canceled'` and say plainly that the subscription has closed,
  instead of "if the account has already dropped".
