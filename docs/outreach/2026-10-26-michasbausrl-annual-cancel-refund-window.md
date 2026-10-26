# michasbausrl@hotmail.de: annual Pro canceled on day 6, refund window still open (2026-10-26)

A German-speaking member paid $299 for a year of Pro on Tuesday and canceled
on Monday with "Switched service" and a thank-you in German. They are still
inside the 7-day money-back guarantee and haven't used it. This is the read, a
draft in German with an English translation, and the commands for each reply.

> **Status:** draft, unsent. **Send before Tue Oct 27, 12:58 PM ET**, when the
> refund window closes. After that, the refund paragraphs are no longer true.

Each paragraph in the drafts is a single line with no hard wrapping, so it can
be pasted straight into a mail client.

Everything below is from `make diagnose-user` (run 2026-10-26).

| | |
|---|---|
| User id | `user_44eb240122e355877903887b` |
| Came from | organic/direct. Signed up Tue Oct 20, 4:41 AM ET |
| Paid | **$299, Pro annual**, Tue Oct 20, 12:58 PM ET, sold under the 7-day money-back guarantee (`money_back=1`). Visa ending 1800 |
| Canceled | Mon Oct 26, 12:15 PM ET (day 6). Reason "Switched service". Typed: "kundenservis top und schnell ,dankeschön" ("customer service top and fast, thank you") |
| Access | until Wed Oct 20, 2027, 12:58 PM ET (cancel at period end) |
| Refund window | open until **Tue Oct 27, 12:58 PM ET** (5:58 PM in Germany). Not used |
| Where | Germany: hotmail.de address, wrote in German, Vodafone home broadband |
| Stripe | `cus_VTdZ4XGfxNU3Fs`, `sub_1USgMi4AOiqteMYY5o1woNeb` |

## The read

- **Tell them the refund is still open, and let them choose.** They said they
  switched to another service, so a paid year may be worth nothing to them.
  Nothing they've received since canceling mentions the guarantee: the ack
  email says they keep access until October 2027 and offers 25% off, and
  Stripe's billing page doesn't show it. The refund box is on the Account page,
  below the billing button. If they meant to keep the year, the email costs
  nothing. If they find out after the window closes, you risk a chargeback,
  which costs the $299 plus fees anyway.
- **The 7-day clock** starts at the invoice's paid time (2026-10-20 16:58:23
  UTC, `readInvoicePaidAtUnix`), so it ends Tue Oct 27, 16:58 UTC. Germany is
  on winter time since Sunday, so that's 5:58 PM there.
- **The comment is praise.** "kundenservis" is "Kundenservice" misspelled. If
  you answered an email from them before they canceled, that's what it refers
  to: search your inbox for the address and, if so, mention it in the first
  line.
- **In German, with "du".** They wrote in German, and the German version of
  the site addresses members with "du". Short, plain sentences. The English
  translation below matches it line for line.
- **Ask what they switched to.** The ack email didn't (a member who types a
  comment is thanked instead), and it's the most useful thing they can tell
  you.

## Verify first

- **Re-run `make diagnose-user EMAIL=michasbausrl@hotmail.de` right before
  sending.** If they already took the refund (subscription canceled, a refund
  in the history), they have the confirmation email: send nothing, or a
  one-line thanks. If `Cancel at period end` is `no`, they turned renewal back
  on: don't send this draft.
- **Name.** The draft opens with "Hallo,". If the Stripe customer
  (`cus_VTdZ4XGfxNU3Fs`) has a first name, use "Hallo <Name>,".
- **After Tue Oct 27, 12:58 PM ET**, don't send it as written.

## Draft (German, to send)

**Subject:** Deine Kündigung: volle Erstattung noch bis Dienstag möglich

```
Hallo,

danke für deine netten Worte zu unserem Kundenservice. Das freut mich sehr.

Deine Kündigung ist bestätigt: Es wird nichts mehr abgebucht, und dein Pro-Zugang läuft bis zum 20. Oktober 2027 weiter.

Eins solltest du aber noch wissen: Für dich gilt noch unsere 7-Tage-Geld-zurück-Garantie. Wenn du deine 299 US-Dollar lieber zurückhaben möchtest, kannst du bis Dienstag, 27. Oktober, um 17:58 Uhr (deutsche Zeit) die volle Erstattung anfordern. Das geht hier, weiter unten auf der Seite im Abschnitt zur Geld-zurück-Garantie:
https://zerogex.io/account

Oder antworte einfach auf diese E-Mail, dann erledige ich das für dich.

Mit der Erstattung endet dein Zugang sofort. Wenn du den Zugang lieber bis Oktober 2027 behalten möchtest, musst du nichts tun.

Und eine kurze Frage, falls du einen Moment Zeit hast: Zu welchem Dienst bist du gewechselt, und was macht er besser? Eine Zeile reicht völlig.

Viele Grüße
Michael
Gründer, ZeroGEX
zerogex.io
```

## English translation (for you, not to send)

**Subject:** Your cancellation: full refund still possible until Tuesday

```
Hi,

Thank you for the kind words about our customer service. That means a lot to me.

Your cancellation is confirmed: nothing more will be charged, and your Pro access continues until October 20, 2027.

One more thing you should know, though: our 7-day money-back guarantee still applies to you. If you'd rather have your $299 back, you can request a full refund until Tuesday, October 27, at 5:58 PM (German time). You can do it here, further down the page in the money-back guarantee section:
https://zerogex.io/account

Or just reply to this email and I'll take care of it for you.

The refund ends your access right away. If you'd rather keep your access until October 2027, you don't need to do anything.

And a quick question, if you have a moment: which service did you switch to, and what does it do better? One line is plenty.

Best regards,
Michael
Founder, ZeroGEX
zerogex.io
```

## If they reply

- **They ask for the refund by email.** Dry run, then apply:

  ```bash
  make money-back-refund EMAIL=michasbausrl@hotmail.de REASON=switched_service
  make money-back-refund EMAIL=michasbausrl@hotmail.de REASON=switched_service YES=1
  ```

  The dry run should say `ELIGIBLE — $299.00 ... window closes
  2026-10-27T16:58:23.000Z`. `YES=1` refunds the full $299 to the Visa,
  cancels the subscription now, ends access and API keys, and emails them the
  refund confirmation (in English). **The 7-day check uses the moment you run
  the command, not when their email arrived.** If they asked before the
  deadline and you run it after, it refuses: add `FORCE=1`.

  Then a one-line reply in German, if you like: "Erledigt: Die 299 US-Dollar
  sind erstattet. Je nach Bank dauert es 5 bis 10 Werktage, bis das Geld auf
  deiner Karte ist. Der Euro-Betrag kann wegen des Wechselkurses leicht
  abweichen." ("Done: the $299 has been refunded. Depending on the bank, it
  takes 5 to 10 business days to reach your card. The euro amount can differ
  slightly because of the exchange rate.")
- **They take it on the Account page.** Nothing to do. The app refunds, ends
  access and sends the confirmation.
- **They want to keep the year.** Nothing to do.
- **They ask after the window closes.** I'd still refund through Tue Nov 3,
  with `FORCE=1` on the `YES=1` line. EU consumer rules generally give online
  buyers 14 days to back out, and a chargeback costs you the $299 plus fees
  anyway.
- **They name the service they switched to.** Nothing to set up; it's for
  your notes.

## Worth a look later (not urgent)

**Nothing tells a member inside their 7 days that the refund exists once they
cancel.** The ack email, the in-app cancel flow and Stripe's billing page all
skip it, and your cancellation alert shows "360 days left to reply" rather than
the refund deadline. Flagged for kfee on Sep 29. Today it took a manual email
against a one-day deadline.

**Stripe's billing page still takes cancels.** Like Matt's on Oct 16, this
cancel has no in-app cancel row (`billing_cancel_flow_submitted`), so it came
through the billing page, which `setup-billing-portal.mts` turns off.
