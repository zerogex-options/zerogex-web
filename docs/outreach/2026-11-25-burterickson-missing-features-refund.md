# burterickson@gmail.com: refunded Basic quarterly, "Missing features", nothing typed (2026-11-25)

American English, and each paragraph in the drafts is a single line with no
hard wrapping, so it can be pasted straight into a mail client.

**Inbound.** No email from them, only the money-back alert:

| | |
|---|---|
| Member | burterickson@gmail.com |
| Plan | Basic quarterly, bought at the Black Friday price |
| Refunded | $37.50, from the Account page (self-serve) |
| Reason | `missing_features` ("Missing features"). Nothing typed |
| Stripe | `sub_1UfUQy4AOiqteMYYIeW88bDM`, refund `re_3UfUQy4AOiqteMYY1lw2Qy6q` |

> **Status:** draft, unsent. No deadline.

## The read

- **The refund is finished. Nothing to run.** The alert opens "A member used
  the 7-day money-back guarantee" and has no "NEEDS DOING" list. The app only
  sends that version when the refund, the Stripe cancel and every record step
  all went through (`frontend/core/moneyBackServer.ts`). The
  `make money-back-refund` line at the bottom is printed on every alert.
- **A full refund, on their first plan.** $37.50 is the Black Friday price for
  a quarter of Basic, half of $75 (`docs/black-friday-2026-runbook.md`). The
  sale only sells to first-time members, so they joined on or after Thu Nov 19
  and got back everything they paid.
- **They've had one email so far:** "Your ZeroGEX refund is on its way", with
  the amount, the card, that access has ended, that the guarantee is one per
  customer, and a general "what didn't work for you?" No "Sorry to see you go"
  email: that one only goes out when a cancel is scheduled for later, and the
  refund cancels on the spot. So the note skips the refund details and asks
  the narrower question: which feature.
- **On Basic, "Missing features" is often a Pro tool, but not always.** Basic
  members see Pro pages with a 🔒 Pro badge in the menu, and Pro widgets on My
  Dashboard show an upgrade card, so they saw what they didn't have. It could
  just as well be something ZeroGEX doesn't do at all, like a symbol it doesn't
  cover (today: SPX, SPY, QQQ, NDX, ES and NQ). The draft names both as quick
  answers instead of guessing.
- **The offer: Pro at half off for the first year, only if it was a Pro
  tool.** That's the deal they bought Basic on, moved up a plan. It runs on the
  standing win-back coupon through the win-back link, as in the Alexandru and
  mbujold7 notes, so it doesn't depend on the sale and has no deadline. If
  you'd rather not offer it, delete the paragraph that starts "If it was one
  of the Pro tools". The rest stands on its own.
- **No promises about symbols or features.** If they name something ZeroGEX
  doesn't have, the answer is "noted, no date", the same line as the Pete note.
- **Nothing automatic pitches them in the meantime.** The Dec 1 sale last call
  skips anyone who has held a plan. The automatic win-back email reaches them
  about a month after the refund, with the same 50% off, and only after it
  shows up in your Monday digest.

## Verify first

- **Your inbox.** If they've replied to the refund confirmation, answer that
  instead, in the same thread, keeping whichever paragraphs below still fit.
- **Name.** "Burt" is read off the address. If the Stripe customer on
  `sub_1UfUQy4AOiqteMYYIeW88bDM` shows a different first name, use it. If
  you're unsure, open with "Hi,".

## Draft

Send it as a new email from your own inbox. Your Gmail signature goes under
the sign-off.

**Subject:** Which feature were you missing?

Hi Burt,

Your $37.50 refund has been issued, so there's nothing more you need to do.

When you asked for it, you picked "Missing features," and I'd really like to know what you were looking for. Was it a symbol we don't cover, getting the levels onto your own charts, or one of the tools that's only in Pro? One line back is plenty.

If it was one of the Pro tools, like Trade Bias, the Advanced Signals, backtesting, or the indicators that keep the levels updated on NinjaTrader, Sierra Chart and Bookmap, I'd be glad to give you Pro at half off for your first year. That's the same Black Friday deal you got on Basic. Just reply and I'll set it up.

Thanks for giving ZeroGEX a try.

Best,
Michael

## If they say yes to Pro

1. **Check the coupon before promising a price.** On the server, in
   `~/zerogex-web`:

   ```bash
   grep '^STRIPE_COUPON_WINBACK' frontend/.env.local
   ```

   All three Pro lines (`_PRO_MONTHLY`, `_PRO_QUARTERLY`, `_PRO_ANNUAL`)
   should be there, because they choose how often to pay at checkout. In
   Stripe (Product catalog, then Coupons), each of those IDs should read 50%
   off for 12 months (the annual one: 50% off once). If one is missing or isn't
   50%, stop and bring me the output: checkout would charge a different price
   than the email promised.

2. **Mark them as offered the win-back,** so checkout applies the coupon:

   ```bash
   sqlite3 /var/lib/zerogex/auth.db "UPDATE users SET winback_email_sent_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE email = 'burterickson@gmail.com';"
   ```

   The refund already marked them lapsed, which is the other half of what
   checkout checks. The stamp also stops the automatic win-back email from
   offering it a second time.

3. **Send the reply below,** in their thread.

4. **After they pay:** `make diagnose-user EMAIL=burterickson@gmail.com`
   should show Pro, with the win-back coupon under `Discounts`.

**Reply:**

Hi Burt,

Great. Here's your link: https://zerogex.io/pricing?winback=1

Sign in, choose Pro and how often you'd like to pay, and the half-off price shows at checkout before you pay anything: $29.50 a month, $57.50 a quarter, or $149.50 for the year. After the first year it renews at the regular price ($59, $115 or $299).

One thing to know before you pay: you've already used your one money-back refund, so this plan doesn't come with the 7-day guarantee.

Best,
Michael

## If they reply some other way

- **They name something ZeroGEX doesn't have.** Thank them, say it's noted,
  and give no date. Add it to whatever list you keep of requests.
- **They name something Basic already had.** Tell them where it is, the way
  the Alexandru note did for NDX and My Dashboard. If they'd like Basic back,
  the same steps work, checking the `_BASIC_` lines instead: the link gives
  them Basic at half off ($37.50 a quarter, what they paid before), with the
  same no-guarantee line before they pay.
- **They're wary of paying without the guarantee.** Pro monthly at $29.50 is
  the smallest step: one month, and they can cancel any time.
- **No reply.** Nothing to do. The automatic win-back email will reach them
  about a month after the refund, through your Monday digest.
