# michasbausrl@hotmail.de: "Can I use the yellow button?" (2026-11-09)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** Mon Nov 9, a reply to the Oct 26 cancellation email ("AW: Sorry to
see you go"), in English:

> I will buy your subscription in the next few days because I still use it and
> I think you should be paid for it. Thank you for letting me use it. Can I use
> the yellow button for that??? THANKS

> **Status:** draft, unsent. Run the check below first.

Background is in `2026-10-26-michasbausrl-annual-cancel-refund-window.md`. As
of Oct 26: $299 for Pro annual paid Tue Oct 20 (Visa ending 1800), canceled Mon
Oct 26 through Stripe's billing page, access until Oct 20, 2027. That note's
refund email was a draft, and nothing in the repo says whether it went out or
whether they took the refund.

## The read

- **They think they're using it for free.** Unless they took the refund, they
  aren't: the $299 covers them through Oct 20, 2027, and canceling only turned
  off next year's renewal. They don't need to buy anything. The cancellation
  email never says the year is already paid, and "keep your access at 25% off"
  reads like an offer to buy access.
- **The yellow button works for them, and it does what they're after.** It's
  the `/save` link (`app/save/route.ts`). It turns renewal back on and adds
  `winback-25pct-1yr-annual` (25% off, `duration: once`, so the next invoice
  only). Nothing is charged now (`proration_behavior: none`). The next charge
  is Oct 20, 2027: **$224.25 instead of $299**.
- **Two clicks.** The email button opens a confirmation page with its own
  yellow button ("Keep my access & apply 25% off"). Opening the page alone
  changes nothing, by design (link scanners).
- **No deadline.** The link doesn't expire. It works while the subscription is
  live, set to cancel, and the offer unclaimed: any time before Oct 20, 2027.
- **They'll hear before the charge.** With renewal back on, the renewal
  reminder emails them about 30 days ahead with the exact amount from Stripe's
  upcoming invoice.
- **No double-charge risk** if they go to the pricing page instead. Checkout
  refuses a second live subscription ("You already have an active
  subscription"). It's only a confusing error, which the reply heads off.
- **If they took the $299 refund, none of this holds.** The subscription is
  canceled, the button shows "Nothing to restore", and the reply is different.

## Check first

On the server:

```bash
sqlite3 /var/lib/zerogex/auth.db "SELECT tier, subscription_status, cancel_at_period_end, current_period_end, retention_offer_claimed_at FROM users WHERE lower(email) = 'michasbausrl@hotmail.de';"
```

Send the draft only if it reads `pro|active|1|2027-10-20...|`, with the last
field empty. Anything else (`canceled`, a `0` in the third field, or a date in
the last), don't send it as written.

## Draft reply

Reply in the same thread. "Micha" is from their mail display name ("MICHAS BAU
SRL MICHA"). Use plain "Hi," if you'd rather not guess.

Hi Micha,

Thank you, that is very kind of you, and I'm glad you're still using ZeroGEX.

Good news: you don't need to buy anything. On October 20 you paid $299 for a full year of Pro, on your Visa ending in 1800.

When you canceled, it only turned off the automatic renewal for next year. It did not refund your payment. So you are fully paid until October 20, 2027.

And yes, you can use the yellow button. It turns the renewal back on with 25% off. Nothing is charged now. On October 20, 2027, you would pay $224.25 instead of $299.

To use it, click the yellow button in my email, then click the yellow button on the page that opens. There's no rush: it works any time before October 20, 2027.

About a month before the renewal, you'll get an email with the exact amount. You can still cancel any time before then on your Account page.

Thank you again. Your message means a lot to me.

Best,
Michael
Founder, ZeroGEX

## After they click

Nothing to do. The route stacks the coupon, clears the cancel, and logs
`billing_winback_discount_honored`. To confirm, `make diagnose-user
EMAIL=michasbausrl@hotmail.de` should show `Cancel at period end: no` and
`Upcoming invoice: $224.25`.

If they say the page told them "Reply and I'll set it up" (their price didn't
map to a plan), do it by hand. Dry run, then apply:

```bash
make honor-winback-discount EMAIL=michasbausrl@hotmail.de PERCENT=25 CREATE_COUPON=1 DRY_RUN=1
```

```bash
make honor-winback-discount EMAIL=michasbausrl@hotmail.de PERCENT=25 CREATE_COUPON=1 YES=1
```

## Worth a look later (not urgent)

The cancellation email doesn't tell a paying member that the period they're in
is already paid, or that the 25% applies at the next renewal. For an annual
member who cancels in week one, that's likely how this confusion started.
