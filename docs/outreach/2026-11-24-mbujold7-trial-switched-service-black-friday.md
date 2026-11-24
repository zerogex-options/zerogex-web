# mbujold7: a Basic trial, "Switched service", and the Black Friday price they skipped (2026-11-24)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** No email from them, only the cancellation alert.
mbujold7@icloud.com (`user_f09bdd8c81bdda0d62502f9b`) canceled a Basic monthly
free trial in the app on Mon Nov 23 at 2:57 PM ET. Survey reason "Switched
service", nothing typed. Never charged.

> **Status:** draft, not sent. Built from `make diagnose-user`, `make save-url`
> and `make honor-winback-discount ... DRY_RUN=1` (output pasted Nov 24).
> **Send today or Wednesday.** Access ends **Fri Nov 27, 1:23 PM ET**,
> Thursday is Thanksgiving, and a yes has to be applied before Friday 1:23 PM.

## Their account

| | |
|---|---|
| Plan | **Basic monthly trial**, $39 list, no discount (`price_1TdDBn4AOiqteMYYlQt3C3fC`) |
| Came from | organic/direct |
| Signed up | Fri Nov 20, 1:18 PM ET. Trial started 1:23 PM ET, paying with Link |
| Trades | **ES** (their answer to the first-run welcome's "which market do you trade?") |
| Visible use | Sign-in Sun Nov 22, 5:17 PM ET, after the day-two ES email. Canceled Mon 2:57 PM ET, an hour before the close. **Back on the site Mon 5:58 PM ET**, three hours after canceling |
| Shown so far | 25% off three times: the cancel modal twice (they went through it twice, see the end of this note) and the automatic cancel email, which also asked "what did you switch to, and what does it do better?" |
| Access ends | **Fri Nov 27, 1:23 PM ET**, no charge |
| Money collected | none |
| Stripe | `cus_VfGzDGN1y31KjM`, `sub_1UdwSu4AOiqteMYYQC2yrEBW` |

## The read

- **They passed on the Black Friday price to take the free trial.** They signed
  up the day after the sale went live. The Basic monthly card offers a choice
  during the sale: half price charged today, or the regular 7-day free trial at
  $39. Their checkout row reads `blackFriday=0 trial=7d`, so they took the
  trial. Now that they've held a subscription, the page and checkout won't sell
  them the sale (first-time members only). The runbook leaves this case to you,
  by hand (`docs/black-friday-2026-runbook.md`, section 6).
- **So the draft offers the sale price, if price was part of it.** $19.50 a
  month for 12 months, then $39. Your dry run already shows the standing
  win-back coupon (`B6vo4Qlk`, 50% off for 12 months) applies cleanly, with no
  warning, and on Basic monthly that is exactly the sale price. It's also what
  the automatic win-back email would offer them about a month after their
  access ends (a trial that runs out is marked lapsed like any other), so this
  brings it forward rather than inventing a deal. Same 50% you offered Chenyu,
  Christie and Hartshorn. If you'd rather not offer it, delete the paragraph
  that starts "If price was part of it" and the rest still works.
- **Not the 25% save link.** They've clicked past it three times, and it's a
  worse deal than the sale price. The draft doesn't mention it.
- **The question is narrower than the automatic email's.** That one already
  asked what they switched to. This one uses their ES answer and offers three
  one-word answers. "Getting them onto your charts" is there on purpose: on
  Basic, levels reach a chart only by typing them into the free TradingView or
  thinkorswim indicator. The auto-updating ones (NinjaTrader, Sierra Chart,
  Bookmap) are Pro (`docs/integrations.md`). A tool that draws ES levels on the
  chart by itself is a likely reason for an ES trader to switch.
- **They had about one trading day.** The trial started Friday afternoon, and
  they canceled Monday before the close. Coming back three hours later suggests
  they're still comparing, so the draft says their access runs to Friday.
- **The charge is spelled out.** A yes turns the cancel off, and the trial
  converts Friday at 1:23 PM ET for $19.50 on Link. The draft says so, so the
  charge isn't a surprise.
- **No name.** The address doesn't give one, so the draft opens "Hi,". If the
  Stripe customer (`cus_VfGzDGN1y31KjM`) has a first name, use it.

## Verify first

- **Check your inbox.** If they already replied to the automatic cancel email,
  answer that reply instead of sending this.
- **Re-run `make diagnose-user EMAIL=mbujold7@icloud.com` right before
  sending.** If `Cancel at period end` reads `no`, they claimed the 25% link or
  kept their plan on their own. Send nothing, or a short thank-you.

## Draft

Send it as a new email from your own inbox, not as a reply to the automatic
one. Your Gmail signature goes under the sign-off.

**Subject:** What did the other service get right?

Hi,

I saw you canceled your ZeroGEX trial on Monday and went with another service. Fair enough, and you won't be charged anything.

You told us you trade ES, so I'm curious what the other service does for ES that we didn't. Was it the levels themselves, getting them onto your charts, or the price? One word back is plenty.

If price was part of it: you signed up during our Black Friday sale, but because you chose the free trial, the sale price never applied. I'd like to give it to you anyway: $19.50 a month for your first 12 months, then the regular $39. Same account, nothing to re-enter. Just reply before your trial ends on Friday at 1:23 PM ET and I'll set it up. The first $19.50 would be charged then.

Either way, your access stays on until Friday, so feel free to keep comparing the two.

Best,
Michael

## If they say yes before Fri Nov 27, 1:23 PM ET

1. **Preview again** (they may have clicked the 25% link in the meantime):

   ```bash
   make honor-winback-discount EMAIL=mbujold7@icloud.com PERCENT=50 DRY_RUN=1
   ```

   `Resulting stack` should list only `B6vo4Qlk (50% off, 12 mo)`. If it also
   lists a 25% coupon, remove that one from the subscription in the Stripe
   Dashboard first, or the bill comes out at about $14.63 instead of the $19.50 you
   promised.

2. **Apply:**

   ```bash
   make honor-winback-discount EMAIL=mbujold7@icloud.com PERCENT=50 YES=1
   ```

   `PERCENT=50` makes it refuse anything but 50% off. The last line should
   read `Next charge (after all discounts): 19.50 USD.` If it shows any other
   amount, don't send the confirmation below.

3. **Confirm:** `make diagnose-user EMAIL=mbujold7@icloud.com` shows `Cancel at
   period end` as `no` in both sections, and `Discounts` lists `B6vo4Qlk`.
   Nothing emails them when the cancellation is undone, so the confirmation
   below is their only notice.

**Confirmation reply**, in their thread:

Hi,

Done. Your cancellation is off and you're on the Black Friday price: $19.50 a month for your first 12 months, then $39. The first $19.50 is charged Friday at 1:23 PM ET, when your trial ends, and monthly after that.

Nothing changes on your end: same account, same login.

Best,
Michael

## If they say yes after the trial has ended

The tool won't touch a subscription that has ended. They come back through
checkout instead, which applies the same 50% coupon once the account is marked
as sent the win-back offer:

```bash
sqlite3 /var/lib/zerogex/auth.db "UPDATE users SET winback_email_sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE email = 'mbujold7@icloud.com';"
```

Then send them https://zerogex.io/pricing?winback=1. They pay $19.50 up front,
with no second trial. The stamp also stops the automatic win-back email from
offering it again later.

## If they reply some other way

- **They name a service or a feature.** Nothing to set up. If it's about
  getting levels onto their charts, check what their platform is before
  replying: TradingView and thinkorswim are the free manual indicators, and
  NinjaTrader, Sierra Chart and Bookmap are Pro.
- **They're still comparing and want more time.** A week more is free and
  safe: `make extend-trial EMAIL=mbujold7@icloud.com EXTEND_DAYS=7 DRY_RUN=1`,
  then `YES=1`. Their cancel stays on, so it still ends with no charge (the dry
  run says so). The yes path above keeps working until the new end date.

## Worth fixing later (not urgent)

**The account page can still show "Cancel subscription" right after a
cancel.** This member went through the cancel flow twice, 40 seconds apart: at
19:57:58.702Z with "switched service", then again at 19:58:39.800Z with no
reason, after a second 25% offer. The cancel-flow route deliberately leaves
`cancel_at_period_end` for the webhook to write
(`frontend/app/api/billing/cancel-flow/route.ts`), `/api/billing/status` reads
it from the database, and the modal refreshes the page once, immediately. Here
the webhook landed 300 ms after the cancel (19:57:59.002Z), so that refresh most
likely beat it and the page kept offering "Cancel subscription". Only the
ended-pause case refreshes again, 4 seconds later. Harmless this time: the
second cancel sent no second email and kept the first reason. The fix is to
refresh again a few seconds later after every cancel.
