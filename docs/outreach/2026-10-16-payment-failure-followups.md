# Payment-failure follow-ups (2026-10-16)

The roundup found 44 members with a failed payment in the last 7 days. Most of
them need nothing from you:

- **12 have paid since.** That includes three from earlier rounds: yeny (paid
  Oct 13 after your note), chen (paid Oct 11, once the card fix went in) and
  carlos. currencychicknyc's $115 Pro charge failed, then went through this
  morning on a plan switch, and the failed invoice was voided.
- **17 get no note** (see "No note" for each reason). Seven of them already got
  your note on Oct 2 or Oct 7 and are still unpaid. A second unanswered note
  reads as pressure. One of the 17, guyaneseking12345, should be canceled and
  voided instead (see "No note").
- **14 get a note**, sent by `make send-founder-notes` (11 today, 3 on Saturday),
  and **1 more is yours to send by hand** (koenigera, who has no open invoice to
  attach a note to).

What changed since Oct 7: the 3-day cutoff is live. The hourly timer drops a
member to the free tier within an hour of their window closing, and Pro API
keys are revoked at that moment. A revoked key does not come back when the
member pays; they make a new one. Stripe keeps retrying for about two weeks
after the first failure, then ends the subscription and leaves the last invoice
open for the rest of the period.

Everything below comes from the roundup file generated 2026-10-16 at 14:16 UTC
(10:16 AM ET).

## How to send

The notes are the ```` ```note ```` blocks in this file. The sender reads them
straight from here, so what you read below is exactly what goes out: plain text,
from `Michael from ZeroGEX <Michael@zerogex.io>`, replies to your inbox, and a
Bcc copy to you of every one. Gmail may file those copies under Sent rather than
the inbox, since they come from your own address.

Right before each send it re-checks the member against Stripe and our database,
and it skips anyone who has paid, canceled, or already been sent a note for that
invoice. It also refuses any note whose invoice belongs to a different customer.
A note marked `access: on` only goes out while the member still has their plan,
and one marked `access: off` waits until the cutoff has removed it, so neither
can say something untrue. A `send-after` time holds a note until then.

1. Void Jaden's leftover September invoice first (section 14 says why):
   `make void-stale-invoices EMAIL=jadenhelfinstine@gmail.com`, then the same
   with `YES=1` if it lists only `in_1UDujo4AOiqteMYYtpfA6ucy`.
2. Dry run, which lists every note and prints each email as it would go out:
   `make send-founder-notes FILE=docs/outreach/2026-10-16-payment-failure-followups.md`
3. Preview, which sends you every note that will go out, today's and
   Saturday's, with the subject marked `[Preview for …]`. The pay links in them
   are live, so don't pay them:
   `make send-founder-notes FILE=docs/outreach/2026-10-16-payment-failure-followups.md PREVIEW_TO=Michael@zerogex.io`
4. Send. Any time after **2 PM ET today**, so memo2688's cutoff and the 12:23
   and 12:34 PM retries have happened first:
   `make send-founder-notes FILE=docs/outreach/2026-10-16-payment-failure-followups.md YES=1`
5. Run the same `YES=1` command again **Saturday after 11 AM ET**. It sends the
   three held for Saturday and skips everything already sent.

ayeayetrader6's note says their Pro and API keys stay on until about 8 PM ET
tonight. If step 4 runs after that, the sender skips it rather than send
something untrue; tell me and I'll rewrite it.

`make resend-payment-failed` now skips any invoice that has a founder note, so a
later run of it won't follow your note with an automated "your payment failed."

## Who gets what

| # | Member | What failed | Reason | Access now | Sends |
|---|---|---|---|---|---|
| 1 | ayeayetrader6@gmail.com | Renewal, Pro $29.50 (half price) | insufficient funds (Link) | on until ~8 PM ET tonight | Today, while still on |
| 2 | joedietrich86@icloud.com | Trial conversion, Basic $39 | no reason given (Link) | on until Sun 9:33 AM ET | Today |
| 3 | killthelevel@gmail.com | Renewal, Pro $59 | insufficient funds | off since Thu; API key revoked | Today |
| 4 | barisyelken51@yandex.com | Renewal, Pro $59 | bank's temporary error, 3 tries | off since Mon | Today |
| 5 | nhatcnguyen@gmail.com | Trial conversion, Basic $39 | insufficient funds (Link) | off since Wed | Today |
| 6 | johnresse1212@gmail.com | Trial conversion, Basic $39 | insufficient funds | off since Thu | Today, after 12:45 PM ET |
| 7 | daltonkiptoo06@gmail.com | Trial conversion, Basic $39 | bank block | off since Thu | Today |
| 8 | abdelilahaj13@gmail.com | Trial conversion, Basic $39 | bank block | off since Wed | Today |
| 9 | sandr746@gmail.com | Trial conversion, Basic $39 | insufficient funds | off since Wed | Today |
| 10 | sacfelipeferreira@gmail.com | Trial conversion, Basic $29 promo | bank's temporary error, 6 tries | off since Oct 8 | Today |
| 11 | memo2688@gmail.com | Trial conversion, Basic $39 | insufficient funds | ends ~1:50 PM ET today | Today, after the cutoff |
| 12 | 97primers-ban@icloud.com | Trial conversion, Basic $39 | bank block | on until Mon 9:29 AM ET | Saturday |
| 13 | tuananhthmno1@gmail.com | Trial conversion, Basic $39 | insufficient funds | ends ~6:50 AM ET Sat | Saturday, after the cutoff |
| 14 | jadenhelfinstine@gmail.com | Renewal, Basic $39 | no reason given (Link) | ends ~10:50 AM ET Sat | Saturday, after the cutoff |
| 15 | koenigera@yahoo.com | Pro upgrade, $59 | insufficient funds | trial ended, nothing owed | By hand, any time |

Only US members' notes name an amount (2, 3, 5, 12, 14). Elsewhere the card may
be billed in a local currency, so a dollar figure could disagree with what they
saw. First names are used only where the address clearly gives one.

---

## 1. ayeayetrader6@gmail.com

A paying Pro member since September, on half price for 12 months (campaign
TARGET). Their September charge cleared; this is the first failure. They're an
API user, with four keys made since Sep 21, the latest on Oct 9. The window
closes at 8:10 PM ET tonight and the cutoff revokes the keys, so the point of
this note is to reach them before that happens. Stripe retries at 11:10 AM ET.
If that clears, the sender skips the note.

```note
to: ayeayetrader6@gmail.com
invoice: in_1UQEpF4AOiqteMYYf2FwRcV0
subject: Your ZeroGEX payment didn't go through
access: on

Hi,

A quick note from me, not the automated emails.

Your October Pro payment didn't go through. Link declined it for insufficient funds.

Your Pro access and API keys stay on until about 8 PM Eastern tonight. If the payment hasn't gone through by then, Pro pauses and the keys are switched off. Pro comes back as soon as it's paid, but you'd need to make a new API key.

To keep everything running, you can pay with any card here: {{pay_link}}

If something has changed on your end, or you have a question, just reply.

Best,
Michael
Founder, ZeroGEX
```

## 2. joedietrich86@icloud.com

A US trial member who was in the app the night before the trial ended. Link
gave no reason for the decline. They've had one automated email so far; the
warning goes out Saturday at 12:38 PM ET, so today puts a day on either side.

```note
to: joedietrich86@icloud.com
invoice: in_1UQnq04AOiqteMYYumQi7Dwm
subject: Your ZeroGEX payment didn't go through
access: on

Hi Joe,

A quick note from me, not the automated email.

Your trial ended on Thursday, and the first $39 Basic payment didn't go through. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it.

Your account is still fully on through Sunday morning. When you're ready, you can pay with any card here: {{pay_link}}

Stripe will also try again automatically, so if the problem was on Link's side, it may go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX
```

## 3. killthelevel@gmail.com

Paid $59 for Pro in September. They haven't signed in on the site since signup
day (Sep 5), but they made an API key that day, so they may be using ZeroGEX
through the API, which never shows up in our last-seen field. The cutoff
revoked that key Thursday at 12:51 PM ET. If they are an API user, something
of theirs stopped working yesterday. The note says the key won't come back on
its own and gives them an easy way out if they've stopped using it.

```note
to: killthelevel@gmail.com
invoice: in_1UPkaQ4AOiqteMYYvlBdTt9N
subject: Your ZeroGEX Pro renewal didn't go through
access: off

Hi,

A quick note from me, not the automated emails.

Your October Pro payment of $59 didn't go through on Monday. Your bank declined it for insufficient funds, and on Thursday Pro paused, which also switched off your API key.

You can pay with any card here: {{pay_link}}

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

Either way, Pro comes back as soon as it's paid. The old API key can't be turned back on, so you'd make a new one on your account page: https://zerogex.io/account#api-access

If you're not using ZeroGEX anymore, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX
```

## 4. barisyelken51@yandex.com

A paying Pro member in Turkey. September cleared first try. Stripe has tried
three times since Oct 9, and the bank's latest answer was `try_again_later`.
That code is meant to be temporary, but a week of failures says this card isn't
going to take the charge. They came back to the site Monday afternoon, after
Pro had paused. Stripe tries again today at 5:21 PM ET.

```note
to: barisyelken51@yandex.com
invoice: in_1UOefP4AOiqteMYY6f4xd840
subject: Your ZeroGEX payment didn't go through
access: off

Hi Baris,

A quick note from me, not the automated emails.

Your October Pro payment hasn't gone through. Stripe has been retrying since October 9, and your bank's latest answer was a temporary error.

After a week of retries, it doesn't look like it will clear by itself. You can pay with a different card here, and Pro comes back as soon as it's paid: {{pay_link}}

If something has changed on your end, or you have a question, just reply.

Best,
Michael
Founder, ZeroGEX
```

## 5. nhatcnguyen@gmail.com

A US trial member. A card failed at checkout before they got in with Link.
They were in the app nine minutes before Wednesday's cutoff.

```note
to: nhatcnguyen@gmail.com
invoice: in_1UPVCU4AOiqteMYYV95Ojkn8
subject: Your ZeroGEX payment didn't go through
access: off

Hi Nhat,

A quick note from me, not the automated emails.

Your trial ended on Sunday, and the first $39 Basic payment hasn't gone through. Link declined it for insufficient funds.

Basic is paused for now, and it comes back as soon as the payment goes through. When you're ready, you can pay with any card here: {{pay_link}}

Or, once the account you use with Link has the funds, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX
```

## 6. johnresse1212@gmail.com

In Canada. They looked at annual plans before taking the monthly trial, and
were last in the app Oct 9. Stripe retries at 12:23 PM ET today, so the note
waits until 12:45.

```note
to: johnresse1212@gmail.com
invoice: in_1UPcdX4AOiqteMYYINK1C1Rw
subject: Your ZeroGEX payment didn't go through
send-after: 2026-10-16T12:45:00-04:00
access: off

Hi John,

A quick note from me, not the automated emails.

Your trial ended on Monday, and your bank declined the first Basic payment for insufficient funds.

Basic is paused for now, and it comes back as soon as the payment goes through. When you're ready, you can pay with any card here: {{pay_link}}

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX
```

## 7. daltonkiptoo06@gmail.com

In Kenya. Three tries, all declined, the latest as `do_not_honor`, a bank
block that retries rarely get past. Last in the app Oct 8, mid-trial.

```note
to: daltonkiptoo06@gmail.com
invoice: in_1UPgCL4AOiqteMYYMlNkH5zd
subject: Your ZeroGEX payment didn't go through
access: off

Hi Dalton,

A quick note from me, not the automated emails.

Your trial ended on Monday, and your bank has declined the first Basic payment each time Stripe tried.

Stripe's automatic retries usually can't get past this kind of bank decline, so it's unlikely to sort itself out. Two ways to fix it: pay with a different card here, or ask your bank to allow the charge from ZeroGEX and then use the same link: {{pay_link}}

Basic comes back on as soon as it's paid.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX
```

## 8. abdelilahaj13@gmail.com

They sign in from Morocco and pay with a US-issued Mastercard. It has been
declined four times, the latest as a bank block (`transaction_not_allowed`).
They haven't been back since the day they started the trial, so the note leads
with the easy way out as much as with the fix.

```note
to: abdelilahaj13@gmail.com
invoice: in_1UPM8B4AOiqteMYYkT4KPeJd
subject: Your ZeroGEX payment didn't go through
access: off

Hi Abdelilah,

A quick note from me, not the automated emails.

Your ZeroGEX trial ended on Sunday, and your bank has declined the first Basic payment each time Stripe tried.

Stripe's automatic retries usually can't get past this kind of bank decline, so it's unlikely to sort itself out. If you'd like to keep Basic, you can pay with a different card here, or ask your bank to allow the charge from ZeroGEX and then use the same link: {{pay_link}}

If ZeroGEX isn't for you, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

And if something didn't work the way you expected, I'd like to hear about it. One line is plenty.

Best,
Michael
Founder, ZeroGEX
```

## 9. sandr746@gmail.com

In Saudi Arabia, and never came back after signup day. Five declines so far,
the latest for insufficient funds. This is the bluesky case: if a retry clears
on payday, someone who used the product once gets charged, and that's how
disputes start. The note is the easy way for them to say "cancel it."

```note
to: sandr746@gmail.com
invoice: in_1UPLDy4AOiqteMYYakLHnpjb
subject: Your ZeroGEX payment didn't go through
access: off

Hi,

A quick note from me, not the automated emails.

Your ZeroGEX trial ended on Sunday, and your bank declined the first Basic payment for insufficient funds. Stripe has been retrying since.

If you'd like to keep Basic, you can pay with any card here: {{pay_link}}

If ZeroGEX isn't for you, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

And if something didn't work the way you expected, I'd like to hear about it. One line is plenty.

Best,
Michael
Founder, ZeroGEX
```

## 10. sacfelipeferreira@gmail.com

The Oct 7 round held this one back because `try_again_later` is meant to be
temporary, and said it would come up again if it kept failing. Six tries since
Oct 5, and it's still coming back that way, so it isn't temporary. In Brazil, on
the $29 promo, and last in the app Oct 4.

```note
to: sacfelipeferreira@gmail.com
invoice: in_1UN3Oc4AOiqteMYYywthLdCl
subject: Your ZeroGEX payment didn't go through
access: off

Hi Felipe,

A quick note from me, not the automated emails.

Your ZeroGEX trial ended on October 5, and the first Basic payment still hasn't gone through. Your bank is still answering with a temporary error.

After more than a week of retries, it doesn't look like it will clear by itself. If you'd like to keep Basic, you can pay with a different card here: {{pay_link}}

If ZeroGEX isn't for you, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX
```

## 11. memo2688@gmail.com

In Chile, and active: they were in the app at 8:30 AM ET today. Their window
closes at 1:31 PM ET, and the cutoff runs around 1:50. They had the warning
yesterday afternoon, so the note waits for the cutoff and speaks to that.

```note
to: memo2688@gmail.com
invoice: in_1UQ8au4AOiqteMYYVJCp0qN2
subject: Your ZeroGEX payment didn't go through
access: off

Hi,

A quick note from me, not the automated emails.

Your trial ended on Tuesday, and your bank declined the first Basic payment for insufficient funds.

Basic is paused for now, and it comes back as soon as the payment goes through. When you're ready, you can pay with any card here: {{pay_link}}

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX
```

## 12. 97primers-ban@icloud.com (Saturday)

A US card the bank declined this morning (`transaction_not_allowed`), on
attempt 1. They haven't been back since signup day, Oct 9. The automated email
went out at 9:29 AM today and the warning is due Sunday at 12:38 PM ET, so
Saturday sits between them.

```note
to: 97primers-ban@icloud.com
invoice: in_1URAFh4AOiqteMYYctfjaNHU
subject: Your ZeroGEX payment didn't go through
send-after: 2026-10-17T11:00:00-04:00

Hi,

A quick note from me, not the automated email.

Your ZeroGEX trial ended on Friday, and your bank declined the first $39 Basic payment.

Stripe's automatic retries usually can't get past this kind of bank decline, so it's unlikely to sort itself out. If you'd like to keep Basic, you can pay with a different card here, or ask your bank to allow the charge from ZeroGEX and then use the same link: {{pay_link}}

If ZeroGEX isn't for you, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

And if something didn't work the way you expected, I'd like to hear about it. One line is plenty.

Best,
Michael
Founder, ZeroGEX
```

## 13. tuananhthmno1@gmail.com (Saturday)

In Vietnam. Last in the app Oct 8, the day after signup. Their warning went out
at 8:39 AM ET today, so a note today would be a second email the same day. It
waits for Saturday's cutoff (about 6:50 AM ET).

```note
to: tuananhthmno1@gmail.com
invoice: in_1UQO7P4AOiqteMYYK6ICCr27
subject: Your ZeroGEX payment didn't go through
send-after: 2026-10-17T11:00:00-04:00
access: off

Hi,

A quick note from me, not the automated emails.

Your ZeroGEX trial ended on Wednesday, and your bank declined the first Basic payment for insufficient funds.

If you'd like to keep Basic, you can pay with any card here, and it comes back on right away: {{pay_link}}

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If ZeroGEX isn't for you, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
Michael
Founder, ZeroGEX
```

## 14. jadenhelfinstine@gmail.com (Saturday)

A paying member who uses ZeroGEX daily (in the app at 9:42 AM ET today). They
re-subscribed in September after their first trial's charge failed, and that
payment cleared. This renewal failed on Link with no reason given. Stripe
retries at 12:34 PM ET and the warning goes out at 12:38, so a note today would
land minutes after the warning. Instead it waits for Saturday's cutoff (about
10:50 AM ET), when they'll find Basic paused.

**Void first.** The September trial's failed invoice,
`in_1UDujo4AOiqteMYYtpfA6ucy` ($39), is still open on the deleted September
subscription. Its period ended around Oct 9, so paying it now would take $39
and grant nothing. Every automated email from that time still links to it, and
it would sit next to the real one on their billing page. Step 1 of "How to
send" voids it.

```note
to: jadenhelfinstine@gmail.com
invoice: in_1UQSJy4AOiqteMYYxEpQiBj4
subject: Your ZeroGEX payment didn't go through
send-after: 2026-10-17T11:00:00-04:00
access: off

Hi Jaden,

A quick note from me, not the automated emails.

Your October Basic payment of $39 didn't go through on Wednesday. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it.

Your account paused on Saturday morning, and it comes back as soon as the payment goes through. You can pay with any card here: {{pay_link}}

If something has changed on your end, or you have a question, just reply.

Best,
Michael
Founder, ZeroGEX
```

## 15. koenigera@yahoo.com (by hand)

They canceled their Basic trial on Sunday for "missing features." Forty-seven
minutes later they added a new Visa and tried to move up to Pro, and the $59
charge was declined for insufficient funds. The switch voided that invoice, and
the trial ended last night, so nothing is active and nothing is owed. They
wanted Pro. With no open invoice, the sender can't take this one, so send it
from your inbox. Pro has no trial now, but it has the 7-day money-back
guarantee.

**Subject:** Your switch to ZeroGEX Pro

Hi,

A quick note from me.

I saw you tried to move up to Pro on Sunday and your bank declined the payment, so the switch didn't go through. Your Basic trial has since ended, so nothing is active on your account and nothing is owed.

If you'd still like Pro, you can start it here whenever you're ready: https://zerogex.io/pricing. It comes with a 7-day money-back guarantee.

When you canceled Basic, you picked "missing features" as the reason. I'd like to know which ones. One line is plenty.

Best,
Michael
Founder, ZeroGEX

---

## No note (17)

**Already got your note, still unpaid (7).** A second unanswered note reads as
pressure. Stripe ends each subscription about two weeks after its first
failure, so these close out on their own over the next week.
- alexandre@venturacap.com.br and maxii1231811@gmail.com: your Oct 2 note.
- adriano.kor@gmail.com, gardeniatattoostudio@gmail.com,
  ogreforbusiness@gmail.com, jacksonbroschard@gmail.com,
  anasounasser1@gmail.com: your Oct 7 note.

**Stripe has ended the subscription (5).** Each one's last invoice stays open
and payable until its period ends.
- ksquareinc@protonmail.com and kenmaster030684@gmail.com: your Oct 2 note.
- blueskytrader74@gmail.com and fatkhutdinovandrey@gmail.com: your Oct 7 note.
- akramkanhna@gmail.com: Stripe's fraud screen (Radar) has been blocking the
  tries at its highest risk level. They keep visiting (this morning, most
  recently) and got the automated "come back" email yesterday. Asking them to
  pay invites the exact charge Radar is stopping.

**Deleted their own account (2).** flamingocorp23@gmail.com (Oct 12) and
pexoc96894@caps7.com (Oct 14, on what looks like a throwaway address).

**Canceled themselves: cancel and void instead (1).** guyaneseking12345@gmail.com
canceled in the app 45 minutes after the trial's charge failed, giving
"missing features." This is not carlos's case. Carlos canceled before his
charge was attempted, so his cancellation email warned him it would still go
through. guyaneseking canceled after it had already failed, and for that state
the email says "You still have full access until November 12, so nothing
changes yet." Then the cutoff removed their access on Oct 15, with no warning
email, and Stripe is still retrying the $39 (next try tonight at 8:29 PM ET).
If a retry clears, they're charged for a plan they canceled after being told
nothing would change. That's a likely dispute. Cancel it and void the invoice,
which sends no email:
`make cancel-subscription EMAIL=guyaneseking12345@gmail.com VOID_INVOICE=1 DRY_RUN=1`,
then the same with `YES=1` in place of `DRY_RUN=1`.

**Dead card on what looks like a throwaway address (1).** 05xwh6fgu4@fpklm.com:
the bank says the card is invalid (`invalid_account`), so no retry can charge
it.

**A second trial on a new account (1).** d.shehan1044@gmail.com is almost
certainly d.shehan2014@gmail.com from the Oct 7 round, who canceled after that
trial's first charge failed. This account started a new free trial on Oct 7,
and its first charge has now failed too. Their window closes Saturday at 9:48
AM ET and the warning goes out today.

**Paid since (12).** Nothing to do: chen.k.lloyd, yeny1974, carlos.flanigan07,
currencychicknyc, justinfinch1212, femifunky001, ibfinanzas, pghaneian,
scorsi, fordailyoperations, tinker.dwarf, ntanalyzer.

## If they reply

- **"Cancel it":** `make cancel-subscription EMAIL=<email> VOID_INVOICE=1 DRY_RUN=1`,
  then the same with `YES=1`. It ends the subscription, voids the open invoice
  so no retry can charge them, and sends no email. Reply yourself to confirm.
- **They pay:** nothing to do. The payment-recovered email goes out on its own.
  If ayeayetrader6 pays after tonight's cutoff, their keys are already gone and
  the recovered email doesn't mention keys, so a one-line note pointing them to
  https://zerogex.io/account#api-access is worth sending then. killthelevel's
  note already covers it.
- **koenigera says which features:** forward it to me and I'll check what we
  have.
