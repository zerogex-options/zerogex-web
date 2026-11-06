# Corey: founding member since June, canceled for another service (2026-11-06)

American English, and each paragraph in the draft is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** No email from him, only the cancellation alert. Thu Nov 5, 6:54 PM
ET: savage.corey@gmail.com (`user_e03e0f6addb7aa4f385baf73`), Pro, paying,
signed up and subscribed Sat Jun 13, survey reason "Switched service", nothing
typed. You know him as a founding member who has been with you since the start.

> **Status:** not sent. **Send before Fri Nov 20, 1:18 PM ET**, when his access
> ends. Run the one check below first, because it decides one paragraph.

## What he has already received

Both of these are automatic, and both are confirmed in the code:

- **The cancel email ("Sorry to see you go")**, sent seconds after he canceled
  and signed by you (`frontend/core/cancelAck.ts`, `buildCancellationEmail` in
  `frontend/core/mailer.ts`). It gave his access date, a one-click link for 25%
  off for a year, and the question "what did you switch to, and what does it do
  better?"
- **The in-app cancel modal**, if he used the Cancel button on the site rather
  than the Stripe billing page. It offered the same 25% before letting him
  cancel.

So the reply below doesn't repeat the 25% offer or the wording of that question.
That's also why `make save-url` from the alert isn't needed: his one-click link
was in the cancel email, and the offer can only be claimed once.

## The read

- **A "switched service" cancel after five months is about fit, not price.** He
  has passed on 25% at least once. Opening with a bigger discount would make him
  feel like a line in a spreadsheet. Ask what he switched to, and size any offer
  to his answer.
- **His founding rate is safe if he leaves.** When a founding member comes back,
  checkout puts the founding rate back on by itself, for monthly or annual
  billing (`frontend/core/foundingRestore.ts` and the matching branch in
  `frontend/app/api/billing/checkout/route.ts`). So "it comes back with you" is
  a true promise, and no competitor can match it.
- **Nothing to run in Stripe for this email.** The other two commands in the
  alert are for after he answers (see "If he replies").

## Check before sending

```bash
make diagnose-user EMAIL=savage.corey@gmail.com
```

- **"Founding started at"** (under "Founding state"). A date means he's on the
  founding rate: send the draft as written. A "—" means he isn't: delete the
  paragraph that starts "One more thing". This check matters here: his billing
  date, the 20th, lines up with a standard 7-day trial from June 13, not the
  July 1 start that founding checkouts got. So he may have been invited to the
  founding offer without taking it.
- **"Recent audit events"** should include `cancellation_ack_email_sent` on
  Nov 5, meaning the automatic email went out. If he has replied to it, answer
  his reply instead of sending this.
- The greeting says "Corey", taken from his email address. Change it if you
  know him by another name.

## Draft

Send it as a new email from your own inbox, not as a reply to the automatic one.

**Subject:** Thank you, Corey

Hi Corey,

I saw that you canceled, and I wanted to write to you myself. You signed up back in June, when ZeroGEX was just getting started, and you've stuck with it ever since. Thank you for that.

I'm not writing to talk you out of it. If the new service fits the way you trade better, that's the right call.

I would really like to know what you moved to, and what it's doing for you that ZeroGEX wasn't. A lot of what I build starts with a short email from a member, and after five months, your answer carries real weight with me. One line is plenty.

One more thing: your founding rate is yours to keep. If you ever decide to come back, it comes back with you.

And if it turns out to be something I can fix, I'd like the chance. Your access runs through November 20, so you'd be able to see it for yourself.

Best,
Michael

## If he replies

- **He names a feature or a data gap.** Check whether we already have it, and
  how big a job it is, before promising anything. If it ships before Nov 20,
  tell him: his access is still on.
- **He says price.** `make honor-winback-discount
  EMAIL=savage.corey@gmail.com DRY_RUN=1` shows the exact rate and his next
  bill before anything changes. It keeps any discount he already has (his
  founding rate included), undoes his cancellation, and needs no new card. It
  only works until Nov 20, 1:18 PM ET, while his subscription is still live.
- **He says the other tool is simply better.** Thank him and leave it there. If
  he's on the founding rate and comes back later, he resubscribes at
  zerogex.io/pricing and gets it back without having to ask.
