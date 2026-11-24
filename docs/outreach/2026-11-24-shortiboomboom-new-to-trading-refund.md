# shortiboomboom@gmail.com: refunded annual Pro, new to trading and found it too complicated (2026-11-24)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** No email from them, only the money-back alert:

| | |
|---|---|
| Member | shortiboomboom@gmail.com |
| Plan | Pro annual, bought at the Black Friday price |
| Refunded | $149.50, from the Account page (self-serve) |
| Reason | `too_complex`. Typed: "I'm new to trading. This is too complicated for me to understand." |
| Stripe | `sub_1UfAfF4AOiqteMYYrbHV7fOy`, refund `pyr_1UfBDL4AOiqteMYYLGRO3S2s` |

> **Status:** draft, unsent. No deadline: today or tomorrow is fine.

## The read

- **The refund is finished. Nothing to run.** The alert opens "A member used
  the 7-day money-back guarantee" and has no "NEEDS DOING" list. The app only
  sends that version when the refund, the Stripe cancel and every record step
  all went through (`finished` in `frontend/core/moneyBackServer.ts`). The
  `make money-back-refund` line is printed on every alert, clean or not.
- **It was a full refund.** $149.50 is the Black Friday price for a year of
  Pro, half of $299 (`docs/black-friday-2026-runbook.md`), so they got back
  everything they paid. The sale only sells to first-time members, so this was
  their first plan, bought on or after Thu Nov 19.
- **They already have the automatic confirmation.** "Your ZeroGEX refund is on
  its way" gave the amount, said access has ended and that the guarantee is one
  per customer, and asked what didn't work. They had already told you. So the
  note doesn't repeat the refund details or ask why a second time.
- **The note's job: show a person read their line, and give them somewhere
  useful to go.** ZeroGEX assumes you already know how options work, and the
  site has nothing that starts from what an option is: the Education articles
  start from dealer hedging and gamma. So the honest pointer is a free outside
  lesson for the basics, then the one ZeroGEX article written for a first read,
  "What Is GEX in Trading? Gamma Exposure Explained Simply" (public, no login).
- **The outside link** is the Options Industry Council's "What is an Option?"
  page. Checked Nov 24: it loads with no sign-in and explains calls, puts,
  strike price and expiration in plain terms. The OIC is the options
  industry's own education group, not a competitor. If you'd rather not send
  people off the site, cut that paragraph; the rest still reads fine.
- **Short, no pitch, no question.** They said it was too complicated, and a
  long email full of links would prove the point. No sale line: the sale is
  for first-time members only, and checkout would now refuse it.
- **Nothing automatic pitches them in the meantime.** The Dec 1 sale last call
  skips anyone who has ever paid. The win-back only reaches them if you send it
  from your Monday review digest, where they'll first appear around Mon Dec 28.

## Verify first

- **Your inbox.** If they've replied to the refund confirmation, answer that
  instead, in the same thread, keeping whichever paragraphs below still fit.
- **Name.** The address doesn't give one. If the Stripe customer on
  `sub_1UfAfF4AOiqteMYYrbHV7fOy` has a first name, open with "Hi <name>,".
  Otherwise "Hi," as written.

## Draft

Send it as a new email from your own inbox.

**Subject:** Thanks for giving ZeroGEX a try

Hi,

Your refund has been issued, so there's nothing more you need to do.

Thank you for telling me why. You're right that ZeroGEX is a lot to take in when you're new to trading. It's built for traders who already know how options work, so it skips the basics. That isn't a reflection on you.

If you'd like to keep learning, I'd start with options themselves: what calls and puts are, and what moves their prices. The Options Industry Council has free lessons that start from the very beginning:
https://www.optionseducation.org/optionsoverview/what-is-an-option

Once those feel familiar, this is the simplest introduction to what ZeroGEX measures. It's free to read, no account needed:
https://zerogex.io/education/what-is-gex-in-trading

Good luck as you learn.

Best,
Michael

## If they reply

- **A thank-you.** Nothing more to send, or one line back.
- **"What should I read next?"** More free Education articles, in this order:
  "What Is a Call Wall?", "What Is a Put Wall?", then "How to Read a Gamma
  Flip" (`/education/what-is-a-call-wall`, `/education/what-is-a-put-wall`,
  `/education/how-to-read-a-gamma-flip`). Stop short of which trades to take
  or how much to risk: ZeroGEX isn't an investment adviser (Terms section 5),
  the same line as `2026-11-05-mahesh-onboarding-walkthrough.md`.
- **They want to come back.** Say this before they pay: they've used their one
  refund, so a new plan has no money-back guarantee. The sale and the free
  trial are both for first-time members only, so it would be the regular price
  ($299 a year for Pro, $39 a month for Basic).
- **They ask for a call or lessons.** "I'm not able to do calls or one-on-one
  lessons, but I'm happy to answer questions by email."
