# Fortune Futures Trading: canceled 15 minutes after the trial charge (2026-11-18)

American English, and each paragraph in the drafts is a single line with no
hard wrapping, so it can be pasted straight into a mail client.

**Inbound.** No email from them, only the cancellation alert.
fortunefuturestrading@gmail.com (`user_8432ffb04bcbd3eb77bc372f`) canceled
Basic monthly in the app on Tue Nov 17 at 7:50 PM ET, 15 minutes after their
free trial converted and $39 cleared. Survey reason "Other", nothing typed.

> **Status:** sent Tue Nov 17, 10:56 PM ET, as "Hi Jose". **Jose replied Wed
> Nov 18, 12:58 AM ET:** "I actually did mean to cancel and I didn't think I'd
> have such spotty service on my trip. I apologize for the inconvenience I
> wanted to mostly take the trial to se if I would pick up using it at the
> beginning of next year. I don't trade November/December." That meets the
> condition the email offered the refund on.
>
> **Done, Wed Nov 18.** Refunded in full in the Stripe Dashboard at 10:47 AM
> ET (`refund_issued`: charge `py_3UcwqF4AOiqteMYY1q1pbYrj`, 3900 of 3900,
> invoice `in_1Ucvty4AOiqteMYYiq0l3npI`). Plan canceled 12 seconds later with
> `make cancel-subscription ... FORCE=1 YES=1` (no API keys were active, no
> open invoices), and the reply under "Refund it" went out. `make
> diagnose-user` afterward: tier `public`, status `canceled`, not counted as a
> subscriber. `MONEY EVER COLLECTED` still reads $39 because Stripe keeps a
> refunded invoice marked paid; the `refund_issued` row is the record that it
> went back. Still open: the January free week, if he writes back.

## Their account (`make diagnose-user`, Nov 18)

| | |
|---|---|
| Came from | organic/direct |
| Trial | 7-day Basic **no-card trial**, started Tue Nov 10, 6:34 PM ET |
| Pro attempt | Thu Nov 12, 12:49 to 12:51 AM ET: tried to switch to Pro four times. Each time the app said to add a card first. They added one (Link) 17 seconds after the last try. The switch itself never happened, and they stayed on Basic |
| Reminders | Mid-trial nudge Nov 12. Trial-end reminder Sun Nov 15, 6:17 PM ET, which offered Pro again. They didn't take it |
| Charged | **$39** on Tue Nov 17, 7:35 PM ET, an hour after the trial ended, through Link (invoice `in_1Ucvty4AOiqteMYYiq0l3npI`). "Your ZeroGEX trial just became a full membership" went out the same minute |
| Canceled | Tue Nov 17, 7:50 PM ET, 15 minutes later. Clicked past 25% off and a pause |
| Access ends | **Thu Dec 17, 6:34 PM ET** |
| Visible use | One sign-in on Fri Nov 13, plus the Nov 12 and Nov 17 visits. Page views don't write audit rows, so there may have been more |
| Stripe | `cus_VbbmffplO1sQON`, `sub_1UaOYv4AOiqteMYYonpiMkfm` |

`MONEY EVER COLLECTED` reads "YES — 0 cleared invoice(s)" only because the
invoice-history table refreshes on a timer and hadn't caught up. Stripe shows
the $39 paid.

## The read

- **Most likely, they never meant to pay for Basic.** A no-card trial ends
  with no charge. The card went on for the Pro switch: the app asked for one,
  they added it, and the switch never happened. When the trial ended, Stripe
  charged that card $39 for Basic, and they canceled 15 minutes later.
- **The draft offers the $39 back.** A trial conversion isn't under the
  money-back guarantee, they haven't asked, and this is goodwill. Offer it
  anyway: the card went on for a plan they never got, and a "didn't mean to
  pay" charge is how a dispute starts ($15 fee plus your time, as with Lee on
  Oct 30). If you'd rather wait for them to ask, delete the paragraph that
  starts "If you meant to cancel" and the rest still works.
- **It asks about Pro instead of assuming.** Four tries in two minutes says
  they wanted it on Nov 12. But the Nov 15 reminder offered Pro again and they
  passed, so Pro may not be the whole story.
- **No discount in this one.** There's a month of access left, so there's time
  to ask first and offer the right thing second. The 50% is ready if price
  comes up (your dry run: `B6vo4Qlk`, $19.50 a month for 12 months).
- **Why the switch didn't happen is partly on us.** After adding the card they
  land on the Account page, which says "Card added. Your plan carries on when
  your free trial ends." Nothing mentions the Pro switch they were in the middle
  of. See the end.

## Verify first

- **Check your inbox,** including replies to "Your ZeroGEX trial just became a
  full membership". If they've written, answer that instead.
- **Re-run `make diagnose-user` right before sending.** If `Cancel at period
  end` reads `no`, they claimed the 25% link or kept the plan. Send nothing, or
  a short thank-you.

## Draft

Send it as a new email from your own inbox. Your Gmail signature goes under the
sign-off. There's no first name to use: the address is a business name.

**Subject:** About the $39, and your switch to Pro

Hi,

I saw you canceled a few minutes after your free trial turned into a paid month, so I wanted to write to you myself.

If you meant to cancel before the trial ended, just reply and I'll refund the $39 in full and close your plan. If you'd rather keep the month you've paid for, there's nothing to do: your access runs until December 17, and you won't be charged again.

I also saw you tried to switch to Pro on November 12, and the switch never went through, so you stayed on Basic. If that's part of why you canceled, tell me and I'll sort it out. If it was something else, I'd like to know that too. A few words is plenty.

Best,

## If they reply

### "Refund it"

The same steps as Lee's (`2026-10-30-lee-trial-charge-refund.md`).
`make money-back-refund` can't do it: a trial conversion isn't covered
(`not_covered`), and `FORCE=1` doesn't lift that.

1. **Refund, in the Stripe Dashboard.** Open the customer
   (`cus_VbbmffplO1sQON`), open the $39.00 payment from Nov 17, and choose
   Refund: full amount, reason **Requested by customer**. Not "Fraudulent",
   which puts their card and email on your block list. If Stripe says the
   payment is disputed, they've already gone to their bank: stop, and answer the
   dispute instead.

   The rest run in `~/zerogex-web` on the server.

2. **Preview the cancel, no writes:**

   ```bash
   make cancel-subscription EMAIL=fortunefuturestrading@gmail.com FORCE=1 DRY_RUN=1
   ```

   Check for `Auth DB: /var/lib/zerogex/auth.db`,
   `Subscription: sub_1UaOYv4AOiqteMYYonpiMkfm`, `Open invoices: 0` and
   `Tier (DB): basic → public`. `FORCE=1` is needed because the plan is active.

3. **Apply:**

   ```bash
   make cancel-subscription EMAIL=fortunefuturestrading@gmail.com FORCE=1 YES=1
   ```

   It sends them no email.

4. **Confirm (optional):** `make diagnose-user` shows tier `public`, plus
   `refund_issued` (3900 of 3900) and `billing_subscription_canceled` in the
   recent events.

**Reply** (in his thread, after step 3):

Hi Jose,

No apology needed, and thanks for letting me know. I've refunded the full $39 and closed your plan, so nothing more will be charged. The refund usually shows up within 5 to 10 business days, depending on your bank.

Since your trial ran into a trip with spotty service, just reply to this email when you're ready in January, and I'll set you up with a fresh free week.

Enjoy the rest of your trip,

### January: if Jose comes back for the free week

`reactivate-member` re-creates Basic monthly on the Link account still on file
(neither the cancel nor the refund removes it), with 7 free days, then $39 a
month unless he cancels. Nothing for him to do: the "Welcome back" email goes
out on its own, and both trial reminders are re-armed.

```bash
make reactivate-member EMAIL=fortunefuturestrading@gmail.com DAYS=7 DRY_RUN=1
```

```bash
make reactivate-member EMAIL=fortunefuturestrading@gmail.com DAYS=7 YES=1
```

Then reply with the trial end date it prints. Add `TIER=pro` to both if he'd
rather try Pro.

### "I wanted Pro"

Offer Pro at the $39 they already pay, from now on: "I can put you on Pro for the same $39 a month. Want me to?" It's a $20-off-forever coupon, so decide that's a rate you're happy to hold. Run the steps only after they say yes, because the first one undoes their cancel.

1. **Turn the cancel off.** This goes first: the Pro tool checks the next bill,
   and a plan that's set to cancel has none.

   ```bash
   make set-cancellation EMAIL=fortunefuturestrading@gmail.com OFF=1 DRY_RUN=1
   ```

   ```bash
   make set-cancellation EMAIL=fortunefuturestrading@gmail.com OFF=1 YES=1
   ```

   The preview should show `cancel_at_period_end: true → false`.

2. **Move them to Pro at $39.** Nothing is charged today.

   ```bash
   make upgrade-at-current-price EMAIL=fortunefuturestrading@gmail.com CURRENT_PRICE=39 DRY_RUN=1
   ```

   ```bash
   make upgrade-at-current-price EMAIL=fortunefuturestrading@gmail.com CURRENT_PRICE=39 YES=1
   ```

   It should end with `Done. fortunefuturestrading@gmail.com is on 'pro', next
   invoice $39.00 / month`. If it says it couldn't confirm the next invoice, or
   that it FAILED, don't tell them yet.

**Reply:**

Hi,

Done. You're on Pro now, at the same $39 a month you're paying for Basic. Nothing is charged today. Your next bill is on December 17, and it's $39.

If you change your mind, you can cancel from your Account page anytime before then.

Best,

### "Too expensive"

The 50% your dry run already checked: $19.50 a month for 12 months, then $39.
It also turns their cancel off, so run it only after they say yes.

```bash
make honor-winback-discount EMAIL=fortunefuturestrading@gmail.com PERCENT=50 YES=1
```

The last line should read `Next charge (after all discounts): 19.50 USD.`

### Anything else

Nothing to set up. Thank them, and if they point at a bug or a data problem,
look before promising anything.

## Worth knowing (can wait)

- **Jose lands in the win-back digest around Mon Dec 21**, 30 days after the
  plan closes, with the 50%-off email. Approving that batch sends it to him
  too. Either way is fine: it arrives just before he plans to look again. If
  you'd rather he come back on the free week at the regular price, keep him out
  of it any time before then. `send-winback.mts` skips anyone already stamped,
  and so does the product-update email to canceled members, which carries the
  same 50%:

  ```bash
  sqlite3 /var/lib/zerogex/auth.db "UPDATE users SET winback_email_sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE email = 'fortunefuturestrading@gmail.com';"
  ```

- **A no-card trial member who adds a card to switch plans is never brought
  back to finish the switch.** `frontend/app/api/billing/change-plan/route.ts`
  answers the switch with "Add a card, then switch" and a billing-portal link
  whose return address is `/account?card_added=1`. That page says "Card added.
  Your plan carries on when your free trial ends." (`cardAddedNotice` in
  `frontend/app/account/page.i18n.ts`) and nothing about the switch. The member
  has to remember to go back to Pricing and click again. This member didn't, and
  stayed on Basic. One case, but it's a member trying to pay more. Queued as a
  separate task.
