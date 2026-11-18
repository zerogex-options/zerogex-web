# the_real_scientist_1: "will you be running any Black Friday specials?" (2026-11-18)

American English, and each paragraph in the reply is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** From the_real_scientist_1@proton.me to support@zerogex.io, Wed Nov 18
at 9:46 AM, subject "Question About Pricing":

> Quick question, will you be running any black Friday specials?
>
> Thanks

No name given, so the draft opens "Hi there".

## The read

- **Yes, and it's now built.** The sale is on branch `claude/black-friday-sale`:
  50% off every payment in the first year of any plan, for first-time members
  who pay today, Friday, November 27 through Tuesday, December 1. The rules and
  the setup are in `docs/black-friday-2026-runbook.md`.
- **No code to type.** The pricing page shows the sale prices and checkout
  applies them, so the reply sends them to `/pricing` and nothing else.
- **Say the trial trade-off up front.** The sale price is paid today and never
  comes with the free trial. Someone who planned to start the Basic trial should
  hear that from us, not discover it at checkout. The 7-day money-back guarantee
  covers every sale purchase, so they still have a way out.
- **Annual is the best value**, and the most useful for the business: $99.50 for
  a year of Basic is $8.29 a month, paid up front.
- **They asked nine days early.** Asking about Black Friday means they're
  waiting for it, so the reply gives the exact dates rather than pushing them to
  buy at full price today.

## Verify first

1. **Has this address held a subscription before?** The sale is for first-time
   members only. If they had a trial or a plan under this email, the page won't
   offer it to them, and the reply as written would promise something checkout
   refuses.

   ```bash
   make diagnose-user EMAIL=the_real_scientist_1@proton.me
   ```

   Check it prints `Auth DB: /var/lib/zerogex/auth.db`. "No such user" or a
   never-subscribed account means the reply is right as written. If they've
   subscribed before, tell me and I'll rewrite the reply.
2. **The sale must be set up before November 27**: merge, deploy, then the four
   steps in section 2 of the runbook. The reply can go out before that, as long
   as the 50% and the dates are final.

## Draft reply

Reply in the same thread.

Hi there,

Yes, we are. From Friday, November 27 through Tuesday, December 1, every ZeroGEX plan is 50% off for your first year.

That's Basic at $19.50 a month instead of $39, or Pro at $29.50 instead of $59. Annual is the best value: $99.50 for your first year of Basic (normally $199), or $149.50 for Pro (normally $299). Quarterly plans are half off too.

The sale is for first-time subscribers who pay when they sign up, so it can't be combined with the 7-day free trial. You're still covered, though: every sale purchase comes with our 7-day money-back guarantee, so if ZeroGEX isn't for you, you can get a full refund from your Account page within 7 days.

There's no code to enter. Just visit https://zerogex.io/pricing any time during the sale and the prices are applied automatically.

If you'd like help picking the plan that fits how you trade, just reply. I read every message.

Best,
Michael
Founder, ZeroGEX

## Worth knowing

- **If you'd rather let them buy now,** open the sale early (runbook section 4,
  "Open it now") and change the reply's first sentence to "Yes, and it's
  already on: through Tuesday, December 1, ...".
