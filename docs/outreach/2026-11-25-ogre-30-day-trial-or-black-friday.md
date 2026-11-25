# OGRE: "Give me 30 day free trial and ill be back" (2026-11-25)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Wed Nov 25, 10:24 AM, from "OGRE" (the address isn't in the
screenshot), replying to the automatic win-back email `A lot has changed at
ZeroGEX - and your discount's ready`, sent Mon Nov 23 at 10:55 PM:

> Give me 30 day free trial and ill be back

> **Status:** draft, not sent. Your call (Nov 25): offer the 30-day free trial
> or the Black Friday price, not both. Their account hasn't been checked yet:
> run the two read-only checks under "Before sending" first.

## The read

- **They're a lapsed member, so the sale page won't sell them the Black Friday
  price.** The win-back email only goes to accounts whose plan ended about a
  month ago, and the sale is for accounts that have never held one
  (`docs/black-friday-2026-runbook.md`, section 1). But the discount that email
  offered them is the same price: the standing win-back coupon, 50% off for 12
  months (`B6vo4Qlk` on Basic monthly, as your dry runs for mbujold7 and Mat
  showed). Their link, `/pricing?winback=1`, applies it at checkout with no
  code. So for them, "the Black Friday price" is that link, and it needs
  nothing from you.
- **Checkout can't give them the trial, but you can, with one command.**
  Checkout gives a returning member no trial at all
  (`app/api/billing/checkout/route.ts`). `make reactivate-member ... DAYS=30`
  re-creates their old plan on the card already on file, 30 days free, with
  nothing for them to do. The automatic welcome-back email goes out, and the
  usual trial reminder goes out about 48 hours before the first charge, quoting
  the amount and the card. After 30 days it bills the regular price.
- **"Not both" holds on its own.** Once the trial starts, the webhook clears
  their win-back stamp, so the link stops applying the coupon, and checkout
  won't sell a second plan anyway. The other way round, the half-off is paid
  today, and `reactivate-member` refuses anyone with a live plan.
- **No money-back guarantee in the draft, on purpose.** Your other Black
  Friday replies mention the 7-day guarantee because sale purchases carry it.
  A returning member buying Basic monthly gets neither a trial nor the
  guarantee ("A returning member buying the trial plan gets neither", in the
  checkout route). Don't add it.
- **The page shows regular prices.** On `/pricing?winback=1` the plan cards
  list $39 and $59 under a "your win-back discount is applied automatically at
  checkout" banner. The half price appears on Stripe's checkout page. The draft
  says so, so $39 on the card doesn't look like a bait and switch.
- **December 1 is your line, not the system's.** The sale ends then, so the
  draft uses it, but the win-back coupon doesn't expire: the link keeps working
  after. If they turn up on December 3, it's your call.
- **Written for Basic monthly**, the most common plan. If `diagnose-user` shows
  they were on Pro, change "Basic" to "Pro", $39 to $59 (twice) and $19.50 to
  $29.50. Before quoting $29.50, check the Pro coupon is 50% too: your dry runs
  have only ever shown the Basic monthly one.

## Before sending (read-only, about a minute)

On the server, in `~/zerogex-web`. Put their address in a variable once, so the
commands below paste as they are:

```bash
OGRE='their-address@example.com'
```

1. **Their account:**

   ```bash
   make diagnose-user EMAIL="$OGRE"
   ```

   They should have no live subscription. If they've already come back on
   their own, don't send this. Note the plan they were on.

2. **The trial, previewed.** Writes nothing:

   ```bash
   make reactivate-member EMAIL="$OGRE" DAYS=30 DRY_RUN=1
   ```

   Check `Plan` (Basic monthly, $39), `Card` (not expired), `Trial: 30 days`
   and `First charge: $39.00`.

   - **Stops with "no payment method on file":** they'd have to enter a card
     themselves, so the trial isn't one command. Delete option 1 and send only
     the Black Friday price, or ask me before promising the trial.
   - **Stops with "price ... is archived":** add `TIER=basic CADENCE=monthly`.

## Draft reply

Same thread. Your Gmail signature goes under the sign-off.

Hi there,

Sure, I can do a 30-day free trial. The one catch is that it's either the trial or our Black Friday price, not both. Here's how each works:

1. 30-day free trial: I'll switch your Basic plan back on, and nothing is charged for 30 days. After that it's the regular $39 a month on the card on your account, unless you cancel before then from your Account page. You'll get a reminder email two days before the first charge.

2. Black Friday price, through Tuesday, December 1: half off your first 12 months back, so $19.50 a month instead of $39. You pay when you sign up, so there's no free period with this one. It's the discount from my last email, and it's applied automatically at checkout here: https://zerogex.io/pricing?winback=1 (the plan cards show regular prices; the half price shows at checkout, before you pay).

The trial lets you try it before paying anything. The half-off saves you more if you already know you're staying.

If you'd like the trial, just reply "trial" and I'll set it up. Nothing else needed on your end.

Best,
Michael

## If they reply "trial"

1. **Apply:**

   ```bash
   make reactivate-member EMAIL="$OGRE" DAYS=30 YES=1
   ```

   It should end with `Webhook landed: tier=basic, status=trialing` and
   `Done. ... with 30 days free.` Note the trial end date it prints. It's in
   UTC; Eastern is 5 hours earlier.

2. **Confirm**, same thread:

Hi there,

Done. Your Basic plan is back on, free through [trial end date]. Nothing is charged until then. After that it's $39 a month on the card on your account, unless you cancel before then from your Account page. You'll get a reminder email two days before.

Same account and login as before. Welcome back!

Best,
Michael

## If they take the Black Friday price

Nothing to set up. After they pay, `make diagnose-user EMAIL="$OGRE"` should
list the win-back coupon under `Discounts`. If it doesn't, the link didn't
apply it and they paid $39: refund $19.50 of that charge in Stripe, then run
`make honor-winback-discount EMAIL="$OGRE" PERCENT=50 DRY_RUN=1` and, if it
ends with `Next charge (after all discounts): 19.50 USD.`, the same with
`YES=1`.

## Worth knowing (can wait)

- **A trial that lapses re-arms the win-back.** If they take the trial and
  cancel before it bills, about a month later the win-back sweep will offer
  them the 50% again, like anyone whose plan ends. You review that batch first
  (the timer only sends you the digest), so you'll see them in it. There's no
  way to skip one member today; only worth building if it actually happens.
