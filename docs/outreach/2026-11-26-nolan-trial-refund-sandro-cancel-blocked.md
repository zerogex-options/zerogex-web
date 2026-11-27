# Nolan: refund a forgotten trial. Sandro: canceled for him after the cancel window failed (2026-11-26)

American English, and each paragraph in the drafts is a single line with no
hard wrapping, so it can be pasted straight into a mail client.

> **Status, Thu Nov 26, evening.** Both plans are canceled. Replies not sent
> yet.
>
> - **Nolan:** plan closed with `make cancel-subscription ... FORCE=1 YES=1`
>   (canceled now, tier `public`). His trial converted to a $39 charge on Wed
>   Nov 25, and he canceled in the app minutes later. The refund happens in the
>   Stripe Dashboard, so the terminal doesn't show it. Before his reply,
>   `make diagnose-user` should list a `refund_issued` row (3900 of 3900). If
>   it doesn't, refund now: the cancel didn't. Until the refund is in, the
>   06:40 orphan-payment sweep can email you about him as "paid, on a free
>   tier". The answer is the refund, not the recover command in that email.
> - **Sandro: the cause is confirmed.** The preview showed a plan change
>   waiting until period end: the switch he set up on Nov 8, held until Dec 7.
>   That's what the cancel window couldn't get past. The fixed
>   `make set-cancellation` dropped it and scheduled the cancel. He keeps Pro
>   until Mon Dec 7, 7:47 AM ET, and nothing more is charged.

## Nolan Tantay: forgot to cancel the trial, asks for a refund

**Inbound.** Wed Nov 25, 1:22 PM ET, kanaboy221@gmail.com, replying to "Sorry
to see you go": he forgot to cancel before the free trial ended, hasn't been
using it lately, has already canceled on the website, and asks whether he can
get a refund.

### The read

- **Refund it in full and close the plan now.** You've said yes to this case
  twice: Lee (Oct 30) and Jose (Nov 18), both trials that turned into a paid
  month nobody meant to keep. A trial conversion isn't under the money-back
  guarantee, so this is the "exception" your billing help page says to email
  about, and he did, politely, after canceling. Saying no saves $39 and invites
  a bank dispute: the $15 fee, your time on evidence, and the $39 if you lose.
- **End access now, not at the end of the month.** Same as Lee and Jose, and
  your own rule that access ends when a refund is issued. It also keeps him out
  of the subscriber count.
- **`make money-back-refund` can't do it.** A trial conversion is
  `not_covered`, and `FORCE=1` doesn't lift that. Refund in Stripe, then cancel
  with the script, in that order (the order the orphan-payment check expects).
- **The draft doesn't name the amount,** so it's right whatever he paid.

### Steps

On the server, in `~/zerogex-web`.

1. **Look first:**

   ```bash
   make diagnose-user EMAIL=kanaboy221@gmail.com
   ```

   Expect Basic monthly, `Cancel at period end` yes, and one paid invoice: the
   trial conversion. Note the Stripe customer id.
   - **Paid more than once** (an earlier month was billed too): refund only the
     latest payment, and change "your payment" to "your last payment" in the
     reply.
   - **No paid invoice** (the charge never cleared): there's nothing to
     refund, so skip step 2. If the status is still `active` or `past_due`, add
     `VOID_INVOICE=1` to steps 3 and 4. If it's already `canceled`, skip those
     too. Use the other first paragraph under the draft.

2. **Refund, in the Stripe Dashboard.** Open the customer, open the payment,
   choose Refund: full amount, reason **Requested by customer**. Not
   "Fraudulent", which puts his card and email on your block list. If Stripe
   says the payment is disputed, stop: he's gone to his bank, and the dispute
   is what to answer.

3. **Preview the cancel, no writes:**

   ```bash
   make cancel-subscription EMAIL=kanaboy221@gmail.com FORCE=1 DRY_RUN=1
   ```

   Check for `Auth DB: /var/lib/zerogex/auth.db`, `Open invoices: 0` and
   `Tier (DB): basic → public`. If the Auth DB line shows another path, stop.
   `FORCE=1` is needed because the plan stays active until period end.

4. **Apply:**

   ```bash
   make cancel-subscription EMAIL=kanaboy221@gmail.com FORCE=1 YES=1
   ```

   It ends with `Done. kanaboy221@gmail.com: subscription canceled (now
   'canceled'), tier reset to public.` It sends him no email.

5. **Send the reply.**

### Draft

Reply in his thread.

Hi Nolan,

No problem, it happens. I've refunded your payment in full and closed your plan, so nothing more will be charged. The refund usually shows up within 5 to 10 business days, depending on your bank.

Thanks for giving ZeroGEX a try.

Best,
Michael

**If the charge never cleared** (step 1), use this as the first paragraph
instead:

No problem, it happens. Your payment never went through, so there's nothing to refund. I've closed your plan and canceled the bill, so you won't be charged anything.

## Sandro Rigato: asked to cancel, and the cancel window wouldn't let him

**Inbound.** Two emails this morning, Thu Nov 26, from Sandro
(rigatosandro@yahoo.it on the Nov 8 note; check the From line):

- 8:36 AM ET, replying to "Thank you for subscribing to ZeroGEX!": "please my
  subscription cancel, your platform is for active day traders not for me."
- "subsription": he's been trying to cancel for two hours, "the cancellation is
  blocked at 50 per cent", "I think that AI is blocked."

His Nov 8 question (Pro to Basic quarterly instead of a refund) is in
`2026-11-08-sandro-pro-to-basic-quarterly.md`. Your reply went out Sun Nov 8,
1:27 PM ET (19:27 CET), which today's email quotes.

### The read

- **He wants to cancel, not a refund.** He hasn't asked for money back. Cancel
  at the end of the period he's paid for: no further charge, and he keeps what
  he paid for.
- **"Blocked at 50 per cent" is almost certainly the cancel window's
  half-price screen.** The window isn't translated, so he saw it in English. After the 25% offer it asks
  why, and "Too expensive" leads to "Would half price help?": a big "Keep my
  access & apply 50% off" button, with a small grey "No thanks, cancel my
  subscription" link under it. That's where he was stuck.
- **Why it most likely failed: a plan change waiting in Stripe.** Your Nov 8
  reply sent him to the billing portal to move from Pro to Basic. When the
  portal holds a change until the end of the billing period (a downgrade, which
  your help page says Pro to Basic is), Stripe attaches a "subscription
  schedule" to the subscription. While one is attached, Stripe refuses to
  change the cancellation directly: "The subscription is managed by the
  subscription schedule ..., and updating any cancelation behavior directly is
  not allowed." The cancel window doesn't check for that, so each click came
  back "Something went wrong. Please try again in a minute." Nothing is logged
  when that happens, which is why you heard from him and not from the site.
- **Not confirmed for Sandro yet.** It depends on what he picked in the portal
  on Nov 8, and whether the portal made the switch right away or held it.
  Step 3 settles it: it either works, or prints that error.
- **The fix is on its own branch,** `claude/cancel-with-pending-plan-change`.
  See the end.

### Steps

On the server, in `~/zerogex-web`.

1. **Look first** (it shows his plan, and whether one of his tries got
   through):

   ```bash
   make diagnose-user EMAIL=rigatosandro@yahoo.it
   ```

   If `Cancel at period end` already reads yes, a try went through: skip to the
   reply, with the `Current period end` date.

2. **Preview, no writes:**

   ```bash
   make set-cancellation EMAIL=rigatosandro@yahoo.it ON=1 DRY_RUN=1
   ```

   Check for `Auth DB: /var/lib/zerogex/auth.db`. The `Status:` line ends with
   the date his plan renews (in UTC). That's the date for the reply.

3. **Apply:**

   ```bash
   make set-cancellation EMAIL=rigatosandro@yahoo.it ON=1 YES=1
   ```

   - **Ends with `Done. ... true (will cancel at period end)`:** send the reply.
   - **`Error: Stripe subscription update failed: The subscription is managed
     by the subscription schedule ...`:** that's the cause, confirmed, and
     nothing was changed. Merge `claude/cancel-with-pending-plan-change`, then
     run steps 2 and 3 again. The preview now has a line `Plan change:
     waiting until period end (schedule sub_sched_...)`, and the apply drops
     that change before scheduling the cancel, so his plan simply ends on that
     date instead of switching. Nothing to deploy for this part: the script
     runs from the checkout.
   - **Any other error:** don't send the reply. Bring me the output.

   This normally sends him nothing (the script records the cancel itself, so
   the site doesn't treat it as new). If the automatic "Sorry to see you go"
   email does go out, it gives the same date, so the two agree.

### Draft

Reply in his "subsription" thread. It answers both emails. Short sentences, so
a translator handles them cleanly. The date is from the run. "You do not need
to do anything else" covers the automatic cancellation email, in case it went
out too (see the end).

Hi Sandro,

I'm sorry. The cancel button on our website did not work for you. That was a problem on our side, not yours.

I have canceled your subscription for you. You will not be charged again. You can keep using ZeroGEX until December 7, and then it stops. You do not need to do anything else.

Thank you for trying ZeroGEX. I understand. It is made mostly for active day traders.

Best,
Michael

### If he replies asking for a refund

He hasn't so far, and your policy doesn't pro-rate a canceled plan, so it's
your call. A refund would end his access on the spot, so say that if you agree.

## Worth knowing (can wait)

- **Anyone with a waiting portal downgrade can't cancel in the app.** The
  portal's own Cancel is turned off, so until the switch takes effect, they're
  stuck until they email you, as Sandro was. The branch
  `claude/cancel-with-pending-plan-change` makes the cancel window and
  `make set-cancellation` drop the waiting change first (the plan ends at
  period end anyway, which is when the change would have applied), records a
  failed cancel where `make diagnose-user` shows it, and tells the member to
  email support if a cancel still fails. Merged Nov 26. The script part works
  already (Sandro's run used it). The cancel window part goes live with the
  next `make deploy`.
- **The Nov 8 note guessed a Pro to Basic switch in the portal happens right
  away.** Sandro's shows it doesn't: the portal held it until his period ended.
  So any Pro member who downgrades in the portal is in this state until then.
- **`make set-cancellation` on a plan with a waiting change can let the
  automatic "Sorry to see you go" email through.** It writes the cancel to the
  database right away. If Stripe's notice of the release reaches the site after
  that write, the site reads it as an un-cancel, and the cancel's own notice
  then sends the email. The plan still ends correctly, and the email gives the
  same date. The in-app cancel doesn't have this gap. Queued as a separate
  task.
