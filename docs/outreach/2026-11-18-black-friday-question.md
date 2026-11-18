# the_real_scientist_1: "will you be running any Black Friday specials?" (2026-11-18)

American English, and each paragraph in the reply is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** From the_real_scientist_1@proton.me to support@zerogex.io, Wed Nov 18
at 9:46 AM, subject "Question About Pricing":

> Quick question, will you be running any black Friday specials?
>
> Thanks

No name given, so the draft opens "Hi there".

> **Status:** account checked Wed Nov 18: `make diagnose-user` says "No user
> found", so they have never subscribed and the sale applies to them. The sale
> opens early, at 12:00 AM ET Thursday, Nov 19. Reply not sent yet: send it once
> `make setup-black-friday VERIFY=1` passes on the server.

## The read

- **Yes, and it's built.** The sale is on branch `claude/black-friday-sale`: 50%
  off every payment in the first year of any plan, for first-time members who
  pay today, through Tuesday, December 1. The rules and the setup are in
  `docs/black-friday-2026-runbook.md`.
- **Open it early, tonight at midnight.** The plan was Black Friday, November 27.
  Someone asking about Black Friday nine days out is waiting for it, and a week
  is long enough to forget. Opening at midnight lets them buy tomorrow morning.
- **No code to type.** The pricing page shows the sale prices and checkout
  applies them, so the reply sends them to `/pricing` and nothing else.
- **Say the trial trade-off up front.** The sale price is paid today and never
  comes with the free trial. Someone who planned to start the Basic trial should
  hear that from us, not discover it at checkout. The 7-day money-back guarantee
  covers every sale purchase, so they still have a way out.
- **Annual is the best value**, and the most useful for the business: $99.50 for
  a year of Basic is $8.29 a month, paid up front.
- **Name the time zone.** "Midnight" is Eastern (12:00 AM ET Thursday,
  `2026-11-19T05:00:00Z`). The page shows regular prices until then, so the
  reply says "after midnight tonight" and a look at 9 PM doesn't read as a
  broken promise.

## Account check (done)

```bash
make diagnose-user EMAIL=the_real_scientist_1@proton.me
```

Nov 18: "No user found with email the_real_scientist_1@proton.me". No account
means no earlier trial or plan, so they sign up fresh and get the sale price.

## Before sending

The reply promises the sale opens tonight, so set it up first: merge, deploy,
then section 2 of the runbook. `make setup-black-friday VERIFY=1` must end "no
problems" and say "Scheduled: opens in about N hour(s)" (or "Open now" after
midnight).

## Draft reply

Reply in the same thread.

Hi there,

Yes, we are! I was planning to start the sale on Black Friday, but I'll go ahead and open it tonight at midnight Eastern so you don't have to wait. It runs through Tuesday, December 1, and every ZeroGEX plan is 50% off for your first year.

That's Basic at $19.50 a month instead of $39, or Pro at $29.50 instead of $59. Annual is the best value: $99.50 for your first year of Basic (normally $199), or $149.50 for Pro (normally $299). Quarterly plans are half off too.

The sale is for first-time subscribers who pay when they sign up, so it can't be combined with the 7-day free trial. You're still covered, though: every sale purchase comes with our 7-day money-back guarantee, so if ZeroGEX isn't for you, you can get a full refund from your Account page within 7 days.

There's no code to enter. Just visit https://zerogex.io/pricing any time after midnight tonight and the sale prices are applied automatically.

If you'd like help picking the plan that fits how you trade, just reply. I read every message.

Best,
Michael
Founder, ZeroGEX
