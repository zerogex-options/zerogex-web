# Jesse: forgot to cancel Pro before it renewed, asks for a courtesy refund (2026-11-27)

American English, and each paragraph in the drafts is a single line with no
hard wrapping, so it can be pasted straight into a mail client.

> **Status, Fri Nov 27:** Option A. You refunded the Nov 26 renewal in the
> Stripe Dashboard ("at least he was friendly about it"), then ran
> `make cancel-subscription ... FORCE=1 YES=1`: plan canceled, tier `public`,
> one active API key revoked. Fits the courtesy rule in
> `docs/refund-requests.md`, so a second request from him is a no.

**Inbound.** Thu Nov 26, 4:48 PM ET, to support@, "Courtesy Refund Request",
from Jesse Sanchez
(jceternalfuturesresource@gmail.com). He meant to cancel before the $59
renewal, has already canceled on his Account page, knows the terms say renewals
aren't refundable, and asks for a one-time courtesy refund. He says he'll
understand if not.

## His account (`make diagnose-user`, Nov 27)

| | |
|---|---|
| Plan | Pro monthly, $59. No trial: Pro is paid up front |
| Joined | Mon Oct 26, 4:14 PM ET. Paid $59 the same minute, and made two API keys that day |
| Renewed | Thu Nov 26, 4:16 PM ET, $59 |
| Canceled | Thu Nov 26, 4:46 PM ET, 30 minutes after the renewal. No reason given |
| Emailed | 4:48 PM ET, two minutes after canceling |
| Access | Until Sat Dec 26, 3:15 PM ET, as things stand |

## The read

- **He isn't a free-trial user.** He paid for a full month of Pro and kept it.
  This is a paying customer who forgot a renewal, not someone who took the
  trial and ran.
- **He got no warning, by design.** Monthly plans get no renewal reminder; only
  quarterly (7 days) and annual (30 days) do (`frontend/core/renewalReminder.ts`).
  That's the difference from Nolan, who got the 2-day trial email.
- **Either answer is defensible.** He has used none of the new month, and a
  refund costs you about $2 in Stripe fees on top of the $59. Saying no is
  safe with him: he wrote that he understands renewals aren't refundable, and
  he keeps Pro until Dec 26.
- **My pick: refund it, as a one-time courtesy.** He asked within the hour,
  hasn't used the time, and it's his first ask. It matches what you did for
  Nolan. A rule you can apply in a minute: refund once per customer when they
  cancel and ask within a day of the charge and haven't used the time since,
  and say it's a one-time courtesy. Everyone else gets the terms.
- **Both drafts ask why.** The cancel window asked (the reason is optional),
  and the automatic "Sorry to see you go - mind sharing why?" went out at 4:46
  PM. He skipped both. The reply asks once more, and doesn't make the refund
  depend on an answer.
- **Don't use `make money-back-refund` for this.** It refunds every payment on
  the subscription, so with `FORCE=1` it would return both months, $118. The
  guarantee doesn't cover renewals anyway. Refund only the Nov 26 payment, in
  the Stripe Dashboard.

## Option A: refund (recommended)

1. **Refund, in the Stripe Dashboard.** Open the customer (search his email),
   open the **$59.00 payment from Nov 26** (not Oct 26), choose Refund: full
   amount, reason **Requested by customer**. Not "Fraudulent".

   The rest run in `~/zerogex-web` on the server.

2. **Preview the cancel, no writes:**

   ```bash
   make cancel-subscription EMAIL=jceternalfuturesresource@gmail.com FORCE=1 DRY_RUN=1
   ```

   Check for `Auth DB: /var/lib/zerogex/auth.db`, `Open invoices: 0` and
   `Tier (DB): pro → public`. It also revokes his two API keys.

3. **Apply:**

   ```bash
   make cancel-subscription EMAIL=jceternalfuturesresource@gmail.com FORCE=1 YES=1
   ```

   It ends with `Done. ... subscription canceled (now 'canceled'), tier reset
   to public.` It sends him no email.

4. **Reply,** in his thread:

Hi Jesse,

I've refunded the November 26 renewal ($59) as a one-time courtesy and closed your plan, so your Pro access, including your API keys, has ended. The refund usually shows up within 5 to 10 business days.

One question, if you don't mind: why did you cancel? One line is plenty. It helps me decide what to fix or build next.

Best,
Michael

## Option B: decline

Nothing to run: his cancel already stops the next charge. Reply in his thread:

Hi Jesse,

Thanks for asking so clearly. As you mentioned, renewals aren't refundable, so I'm going to leave this charge in place. Your cancellation did go through: you won't be charged again, and you keep full Pro access, API included, until December 26.

One question, if you don't mind: why did you cancel? One line is plenty. It helps me decide what to fix or build next.

Best,
Michael

## If he replies

- **He says why.** Note it. If it's a bug or a missing feature, look before
  promising anything.
- **Basic or a discount?** Not before he answers. Offering one now is a guess,
  and a pitch right after a refund reads as pushy. If he says price: Basic at
  $39 a month, or the standard 50%-off win-back. Either way, he lands in your
  Monday win-back digest about 30 days after the plan closed (around Dec 28),
  and you can approve or skip him there.
- **Option B, and he pushes back or mentions his bank:** refund (Option A).
  A dispute costs more than $59.
