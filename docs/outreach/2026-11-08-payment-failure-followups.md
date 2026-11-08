# Payment-failure follow-ups (2026-11-08)

Sent with `make send-founder-notes`. Right before each note goes out, it
re-checks the member against Stripe and our database, and skips anyone who has
paid, canceled or asked to cancel since. It fills in their first name and their
signed pay link, adds Michael's signature card, and Bccs him a copy. It sends
one note per invoice, ever, so running it again never sends a note twice.

Source: the `payment_declines` query run on the box on Nov 8 at about 1 PM ET.
It covers every invoice with a declined attempt in the previous two days: 29
invoices, 9 of them renewals and 20 of them first charges after a free trial.
19 of the 29 were insufficient funds. Nothing points to a fault on our side or
Stripe's. Each member was checked against the earlier rounds in this folder. A
pay-link lookup run on the box later that afternoon confirmed all 16 invoices
below were still open, and the invoice ids come from it.

## How to send

On the server, after merging this branch.

1. Dry run. It prints every note exactly as it will go out, the name each
   greeting will use and where that name came from, and SEND, WAIT or SKIP for
   each note:

```bash
AUTH_DB_PATH=/var/lib/zerogex/auth.db make send-founder-notes FILE=docs/outreach/2026-11-08-payment-failure-followups.md
```

2. Send:

```bash
AUTH_DB_PATH=/var/lib/zerogex/auth.db make send-founder-notes FILE=docs/outreach/2026-11-08-payment-failure-followups.md YES=1
```

`AUTH_DB_PATH` is set so the send latch lands in the production database.

Notes 1 and 2 say Pro is paused (`access: off`). If either member somehow still
has Pro, that note waits, and a later run sends it. Note 4 says the account is
still on (`access: on`), so a run after its cutoff on Tuesday morning skips it.

Note 10 greets with a plain "Hi," instead of the name on file, which is
"Mimouni" and reads as a surname.

## Who gets what

Only US cards get a dollar amount, plus Alexander, who is billed in USD and whose
Nov 3 deal named $44.25. Elsewhere the card may be billed in a local currency.

| # | Member | What failed | Reason | Tries, since |
|---|---|---|---|---|
| 1 | yeny1974@yahoo.com | Pro renewal | Link keeps failing (`link_connection_closed`) | 5, Oct 29 |
| 2 | lybydallh053@gmail.com | Pro renewal ($30 off) | insufficient funds | 3, Nov 1 |
| 3 | acontrerasarellana@gmail.com | First Pro charge, $44.25 (25% off) | insufficient funds | 2, Nov 6 |
| 4 | bazigar88@gmail.com | Basic renewal ($20 off) | insufficient funds (Link) | 1, Nov 7 |
| 5 | colbyscott001@gmail.com | First charge after trial, $39 | insufficient funds | 2, Nov 4 |
| 6 | yahyaarmex@gmail.com | First charge after trial | insufficient funds | 3, Nov 4 |
| 7 | snaur.matej@seznam.cz | First charge after trial | card can't be charged (`invalid_account`) | 3, Nov 4 |
| 8 | waila.sarah19941992forever@gmail.com | First charge after trial | no reason given (Link) | 3, Nov 3 |
| 9 | demargthomas@gmail.com | First charge after trial, $39 | insufficient funds | 4, Nov 1 |
| 10 | isaacwesr1@gmail.com | First charge after trial | insufficient funds | 4, Nov 1 |
| 11 | scesa.fg@gmail.com | First charge after trial | no reason given (Link) | 5, Nov 2 |
| 12 | jbsabbino@gmail.com | First charge after trial | insufficient funds | 5, Oct 29 |
| 13 | ajwan.naif662@gmail.com | First charge after trial | insufficient funds | 5, Oct 29 |
| 14 | na2030knsa@gmail.com | First charge after trial | no reason given (Link) | 5, Oct 29 |
| 15 | rodrigobena3@gmail.com | First charge after trial | no reason given (Link) | 6, Oct 28 |
| 16 | louayejr11@gmail.com | First charge after trial | insufficient funds | 7, Oct 30 |

The read, where it shaped a note:

- **yeny1974** got the Oct 7 note on a Basic trial charge and paid on Oct 13. Now on
  Pro. Sign-ins come from outside the US, so the note names no amount.
- **lybydallh053** is an API user (two keys made in August). August and September
  each failed first, then cleared on a retry within two days. November hasn't. The
  3-day cutoff will have switched off their keys, which don't come back on payment.
  The note doesn't repeat "insufficient funds," as the Oct 2 draft also avoided.
- **acontrerasarellana** is Alexander from the Nov 3 deal
  (`2026-11-03-alexander-pro-25-off.md`). The trial ended Fri Nov 6 at 12:07 AM ET,
  and the 3-day window runs out around 1 AM ET Monday, so this note goes today.
- **bazigar88** failed on the first try in October too. The cutoff is Tuesday
  morning, so today matches the day-after timing the Oct 7 round used.

## Today's notes

### 1. yeny1974@yahoo.com

```note
to: yeny1974@yahoo.com
invoice: in_1UVt9G4AOiqteMYYcx814uQW
subject: Your ZeroGEX Pro renewal didn't go through
access: off
name: Yeny

Hi {{first_name}},

A quick note from me, not the automated emails.

Your Pro renewal on October 29 still hasn't gone through. Stripe has retried it through Link several times since, and it keeps failing, so it doesn't look like it will clear on its own.

You can pay with any card here, and Pro comes back as soon as it's paid: {{pay_link}}

If something has changed on your end, or you'd rather stop, just reply and I'll take care of it.

Best,
```

### 2. lybydallh053@gmail.com

```note
to: lybydallh053@gmail.com
invoice: in_1UXC8V4AOiqteMYYcqDNk2Ma
subject: Your ZeroGEX payment, and your API keys
access: off

Hi {{first_name}},

A quick note from me, not the automated emails.

Your November Pro payment still hasn't gone through. In August and September a retry went through within a day or two, but this one has been retrying since the start of the month without clearing.

Pro paused a few days after the payment failed, and that also switched off any API keys on your account. Pro comes back as soon as it's paid, but old keys can't be turned back on, so you'd make a new one here: https://zerogex.io/account#api-access

You can pay with any card here: {{pay_link}}

If something has changed on your end, or you have a question, just reply.

Best,
```

### 3. acontrerasarellana@gmail.com

```note
to: acontrerasarellana@gmail.com
invoice: in_1UYfO94AOiqteMYYQIFW4P1e
subject: Your ZeroGEX Pro payment didn't go through
name: Alexander

Hi {{first_name}},

A quick note from me, not the automated emails.

When the Pro trial we set up ended on Friday, the first $44.25 payment didn't go through. Your bank declined it for insufficient funds.

You can pay with any card here, and your 25% off stays in place: {{pay_link}}

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 4. bazigar88@gmail.com

```note
to: bazigar88@gmail.com
invoice: in_1UZ7Wa4AOiqteMYY5ePgZJLR
subject: Your ZeroGEX payment didn't go through
access: on

Hi {{first_name}},

A quick note from me, not the automated emails.

Your November Basic payment didn't go through on Saturday.

Stripe will try again automatically over the next few days, so it may well go through on its own. If you'd rather settle it now, you can pay with any card here: {{pay_link}}

Your account is still fully on for now.

If something has changed on your end, or you have a question, just reply.

Best,
```

### 5. colbyscott001@gmail.com

```note
to: colbyscott001@gmail.com
invoice: in_1UY8gU4AOiqteMYYjfOa05gL
subject: Your ZeroGEX payment didn't go through
name: Colby

Hi {{first_name}},

A quick note from me, not the automated emails.

Your free trial ended on November 4, and the first $39 payment didn't go through. Your bank declined it for insufficient funds.

When you're ready, you can pay with any card here: {{pay_link}}

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 6. yahyaarmex@gmail.com

```note
to: yahyaarmex@gmail.com
invoice: in_1UY67G4AOiqteMYYhoyot88A
subject: Your ZeroGEX payment didn't go through
name: Yahya

Hi {{first_name}},

A quick note from me, not the automated emails.

Your free trial ended on November 4, and the first payment didn't go through. Your bank declined it for insufficient funds.

When you're ready, you can pay with any card here: {{pay_link}}

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 7. snaur.matej@seznam.cz

```note
to: snaur.matej@seznam.cz
invoice: in_1UXyav4AOiqteMYYLKGP5S82
subject: Your ZeroGEX payment didn't go through
name: Matěj

Hi {{first_name}},

A quick note from me, not the automated emails.

Your free trial ended on November 4, and the first payment didn't go through. Your bank says the card on file can no longer be charged, so Stripe's retries won't fix it.

If you'd like to keep your plan, you can pay with a different card here: {{pay_link}}

If now isn't the right time, that's completely fine. Just reply and I'll cancel it.

Best,
```

### 8. waila.sarah19941992forever@gmail.com

```note
to: waila.sarah19941992forever@gmail.com
invoice: in_1UXbTY4AOiqteMYYHR2XkOUw
subject: Your ZeroGEX payment didn't go through

Hi {{first_name}},

A quick note from me, not the automated emails.

Your free trial ended on November 3, and the first payment didn't go through. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it.

When you're ready, you can pay with any card here: {{pay_link}}

Stripe will also try again automatically, so if the problem was on Link's side, it may go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 9. demargthomas@gmail.com

```note
to: demargthomas@gmail.com
invoice: in_1UX6cF4AOiqteMYYtJRaeijN
subject: Your ZeroGEX payment didn't go through

Hi {{first_name}},

A quick note from me, not the automated emails.

Your free trial ended on November 1, and the first $39 payment didn't go through. Your bank declined it for insufficient funds.

When you're ready, you can pay with any card here: {{pay_link}}

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 10. isaacwesr1@gmail.com

```note
to: isaacwesr1@gmail.com
invoice: in_1UX1hu4AOiqteMYYJcqzSQ3f
subject: Your ZeroGEX payment didn't go through

Hi,

A quick note from me, not the automated emails.

Your free trial ended on November 1, and the first payment didn't go through. Your bank declined it for insufficient funds.

When you're ready, you can pay with any card here: {{pay_link}}

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 11. scesa.fg@gmail.com

```note
to: scesa.fg@gmail.com
invoice: in_1UXN2m4AOiqteMYYOHeQj5tO
subject: Your ZeroGEX payment didn't go through

Hi {{first_name}},

A quick note from me, not the automated emails.

Your free trial ended on November 2, and the first payment still hasn't gone through. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it. Stripe has retried it several times since without luck.

When you're ready, you can pay with any card here: {{pay_link}}

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 12. jbsabbino@gmail.com

```note
to: jbsabbino@gmail.com
invoice: in_1UW6on4AOiqteMYYSPYKemFK
subject: Your ZeroGEX payment didn't go through

Hi {{first_name}},

A quick note from me, not the automated emails.

Your free trial ended on October 29, and the first payment still hasn't gone through. Your bank declined it for insufficient funds, and Stripe's retries since haven't cleared it.

If you'd like to keep your plan, you can pay with any card here: {{pay_link}}

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 13. ajwan.naif662@gmail.com

```note
to: ajwan.naif662@gmail.com
invoice: in_1UVxhE4AOiqteMYYSL3KqVyR
subject: Your ZeroGEX payment didn't go through

Hi {{first_name}},

A quick note from me, not the automated emails.

Your free trial ended on October 29, and the first payment still hasn't gone through. Your bank declined it for insufficient funds, and Stripe's retries since haven't cleared it.

If you'd like to keep your plan, you can pay with any card here: {{pay_link}}

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 14. na2030knsa@gmail.com

```note
to: na2030knsa@gmail.com
invoice: in_1UVtNF4AOiqteMYYMZ6Q4WPx
subject: Your ZeroGEX payment didn't go through

Hi {{first_name}},

A quick note from me, not the automated emails.

Your free trial ended on October 29, and the first payment still hasn't gone through. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it. Stripe has retried it several times since without luck.

When you're ready, you can pay with any card here: {{pay_link}}

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 15. rodrigobena3@gmail.com

```note
to: rodrigobena3@gmail.com
invoice: in_1UVU4V4AOiqteMYYLPLcAToC
subject: Your ZeroGEX payment didn't go through
name: Rodri

Hi {{first_name}},

A quick note from me, not the automated emails.

Your free trial ended on October 28, and the first payment still hasn't gone through. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it. Stripe has retried it several times since without luck.

When you're ready, you can pay with any card here: {{pay_link}}

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 16. louayejr11@gmail.com

```note
to: louayejr11@gmail.com
invoice: in_1UWEyp4AOiqteMYY2IpI7ft0
subject: Your ZeroGEX payment didn't go through
name: Chouaib

Hi {{first_name}},

A quick note from me, not the automated emails.

Your free trial ended on October 30, and the first payment still hasn't gone through. Your bank declined it for insufficient funds, and Stripe's retries since haven't cleared it.

If you'd like to keep your plan, you can pay with any card here: {{pay_link}}

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

## Held: three renewals that first failed Nov 8

cedric.tannoukhi@gmail.com, femifunky001@gmail.com and wolug.tec@gmail.com. Retries
often catch these within a day (femifunky001 paid on their own in October), and
their cutoffs are Wednesday. They aren't notes yet because a note needs its
invoice id. To add them, get the ids with this read-only query, and they go in
here with a Monday `send-after`:

```bash
sqlite3 -readonly /var/lib/zerogex/auth.db "SELECT DISTINCT email, invoice_id FROM payment_declines WHERE email IN ('cedric.tannoukhi@gmail.com','femifunky001@gmail.com','wolug.tec@gmail.com') AND outcome = 'open';"
```

Otherwise the automated payment-failed and grace-warning emails cover them.

## No note (10)

**Stripe's fraud screen blocked the charge (4).** maurilusw@gmail.com (a $49
renewal), smartbuys1990@gmail.com, sam.thandokazi@yahoo.com and
mailmbugua@gmail.com, all at Radar's highest risk level. Same call as
akramkanhna on Oct 16: asking them to pay invites the exact charge Radar is
stopping.

**Throwaway-looking address (1).** voday91466@hiringview.com, the same pattern as
pexoc96894@caps7.com on Oct 16.

**Stripe's two weeks of retries run out within a day or so (2).**
andreimusat2006@gmail.com (8 tries since Oct 25) and skynet773@duck.com (7 since
Oct 26).

**Already settled (2).** chen.k.lloyd@gmail.com paid. nalaghbari48@gmail.com
canceled, and the bill is closed.

**Canceled while the bill is still retrying (1).** mauro.arciniegas19@gmail.com,
below.

## Instead of a note: cancel and void Mauro's bill

mauro.arciniegas19@gmail.com's $29 renewal has failed since Oct 26 (7 tries), and
they clicked Cancel on Nov 8. Stripe is still retrying that bill, so a retry that
clears would charge them after they canceled. This is the guyaneseking12345 case
from Oct 16, with the same fix. Cancel now and void the bill, which sends no
email:

`make cancel-subscription EMAIL=mauro.arciniegas19@gmail.com VOID_INVOICE=1 DRY_RUN=1`,
then the same with `YES=1` in place of `DRY_RUN=1`.

Their cancellation email also said they "still have full access" until the
period ends, which stopped being true at the 3-day cutoff. That email has no
version for a member whose payment already failed. Flagged as a separate code
fix. nalaghbari48 got the same email, with nothing left to charge.

## If they reply

- **"Cancel it":** `make cancel-subscription EMAIL=<email> VOID_INVOICE=1 DRY_RUN=1`,
  then the same with `YES=1`. It ends the subscription, voids the open bill so no
  retry can charge them, and sends no email. Reply yourself to confirm.
- **They pay:** nothing to do. The payment-recovered email goes out on its own.
  lybydallh053 will need a new API key, which their note already says.
