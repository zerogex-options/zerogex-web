# Payment-failure follow-ups (2026-11-08)

Sent **by hand from Gmail**. Michael asked for copy-paste text this round rather
than `make send-founder-notes`. Nothing below is in a ```` ```note ```` block, so
the sender can never pick this file up and send a second copy. This file is the
record of who got a note, for the next round's "already got your note" check.

Source: the `payment_declines` query run on the box on Nov 8 at about 1 PM ET.
It covers every invoice with a declined attempt in the previous two days: 29
invoices, 9 of them renewals and 20 of them first charges after a free trial.
19 of the 29 were insufficient funds. Nothing points to a fault on our side or
Stripe's. Each member was checked against the earlier rounds in this folder.

## How to send

1. Get each member's pay link. `make diagnose-user` prints the link only while
   the bill is still open, so the loop also shows who has paid since:

```bash
for e in yeny1974@yahoo.com lybydallh053@gmail.com acontrerasarellana@gmail.com bazigar88@gmail.com colbyscott001@gmail.com yahyaarmex@gmail.com snaur.matej@seznam.cz waila.sarah19941992forever@gmail.com demargthomas@gmail.com isaacwesr1@gmail.com scesa.fg@gmail.com jbsabbino@gmail.com ajwan.naif662@gmail.com na2030knsa@gmail.com rodrigobena3@gmail.com louayejr11@gmail.com; do
  out=$(AUTH_DB_PATH=/var/lib/zerogex/auth.db make -s diagnose-user EMAIL="$e" 2>&1)
  link=$(printf '%s\n' "$out" | grep -o 'https://[^ ]*/pay?[^ ]*' | head -1)
  if [ -n "$link" ]; then status="$link"
  elif printf '%s\n' "$out" | grep -q 'pay link (for emails)'; then status="open bill but no link: check .env.local"
  elif printf '%s\n' "$out" | grep -q '=== Stripe invoices'; then status="nothing open (paid or closed): skip"
  else status="lookup failed: run make diagnose-user EMAIL=$e"; fi
  printf '%s\n    %s\n' "$e" "$status"
done
```

2. Paste each note into a new Gmail message, replace `PAY_LINK` with that
   member's link, and send. Each note ends at "Best," so the Gmail signature card
   goes right under it. Skip anyone the loop marks "nothing open".
3. Monday Nov 9: run the same loop for the three held notes (17 to 19), and send
   only to those that still print a link.

## Who gets what

Only US cards get a dollar amount, plus Alexander, who is billed in USD and whose
Nov 3 deal named $44.25. Elsewhere the card may be billed in a local currency.

| # | Member | What failed | Reason | Tries, since | Send |
|---|---|---|---|---|---|
| 1 | yeny1974@yahoo.com | Pro renewal | Link keeps failing (`link_connection_closed`) | 5, Oct 29 | Today |
| 2 | lybydallh053@gmail.com | Pro renewal ($30 off) | insufficient funds | 3, Nov 1 | Today |
| 3 | acontrerasarellana@gmail.com | First Pro charge, $44.25 (25% off) | insufficient funds | 2, Nov 6 | Today |
| 4 | bazigar88@gmail.com | Basic renewal ($20 off) | insufficient funds (Link) | 1, Nov 7 | Today |
| 5 | colbyscott001@gmail.com | First charge after trial, $39 | insufficient funds | 2, Nov 4 | Today |
| 6 | yahyaarmex@gmail.com | First charge after trial | insufficient funds | 3, Nov 4 | Today |
| 7 | snaur.matej@seznam.cz | First charge after trial | card can't be charged (`invalid_account`) | 3, Nov 4 | Today |
| 8 | waila.sarah19941992forever@gmail.com | First charge after trial | no reason given (Link) | 3, Nov 3 | Today |
| 9 | demargthomas@gmail.com | First charge after trial, $39 | insufficient funds | 4, Nov 1 | Today |
| 10 | isaacwesr1@gmail.com | First charge after trial | insufficient funds | 4, Nov 1 | Today |
| 11 | scesa.fg@gmail.com | First charge after trial | no reason given (Link) | 5, Nov 2 | Today |
| 12 | jbsabbino@gmail.com | First charge after trial | insufficient funds | 5, Oct 29 | Today |
| 13 | ajwan.naif662@gmail.com | First charge after trial | insufficient funds | 5, Oct 29 | Today |
| 14 | na2030knsa@gmail.com | First charge after trial | no reason given (Link) | 5, Oct 29 | Today |
| 15 | rodrigobena3@gmail.com | First charge after trial | no reason given (Link) | 6, Oct 28 | Today |
| 16 | louayejr11@gmail.com | First charge after trial | insufficient funds | 7, Oct 30 | Today |
| 17 | cedric.tannoukhi@gmail.com | Renewal | insufficient funds (Link) | 1, Nov 8 | Monday, if unpaid |
| 18 | femifunky001@gmail.com | Renewal | insufficient funds (Link) | 1, Nov 8 | Monday, if unpaid |
| 19 | wolug.tec@gmail.com | Renewal | insufficient funds | 1, Nov 8 | Monday, if unpaid |

The read, where it shaped a note:

- **yeny1974** got the Oct 7 note on a Basic trial charge and paid on Oct 13. Now on
  Pro. Sign-ins come from outside the US, so the note names no amount.
- **lybydallh053** is an API user (two keys made in August). August and September
  each failed first, then cleared on a retry within two days. November hasn't. The
  3-day cutoff will have switched off their keys, which don't come back on payment.
  The note doesn't repeat "insufficient funds," as the Oct 2 draft also avoided.
- **acontrerasarellana** is Alexander from the Nov 3 deal
  (`2026-11-03-alexander-pro-25-off.md`). The trial ended Fri Nov 6 at 12:07 AM ET,
  and the 3-day window runs out around 1 AM ET Monday, so his note goes today.
- **bazigar88** failed on the first try in October too. The cutoff is Tuesday
  morning, so today matches the day-after timing the Oct 7 round used.
- **17 to 19** first failed Sunday. Retries often catch these (femifunky001 paid
  on their own in October), so they wait a day. Their cutoffs are Wednesday.

## Today's notes

### 1. yeny1974@yahoo.com

**Subject:** Your ZeroGEX Pro renewal didn't go through

```text
Hi Yeny,

A quick note from me, not the automated emails.

Your Pro renewal on October 29 still hasn't gone through. Stripe has retried it through Link several times since, and it keeps failing, so it doesn't look like it will clear on its own.

You can pay with any card here, and Pro comes back as soon as it's paid: PAY_LINK

If something has changed on your end, or you'd rather stop, just reply and I'll take care of it.

Best,
```

### 2. lybydallh053@gmail.com

**Subject:** Your ZeroGEX payment, and your API keys

```text
Hi,

A quick note from me, not the automated emails.

Your November Pro payment still hasn't gone through. In August and September a retry went through within a day or two, but this one has been retrying since the start of the month without clearing.

Pro paused a few days after the payment failed, and that also switched off any API keys on your account. Pro comes back as soon as it's paid, but old keys can't be turned back on, so you'd make a new one here: https://zerogex.io/account#api-access

You can pay with any card here: PAY_LINK

If something has changed on your end, or you have a question, just reply.

Best,
```

### 3. acontrerasarellana@gmail.com

**Subject:** Your ZeroGEX Pro payment didn't go through

```text
Hi Alexander,

A quick note from me, not the automated emails.

When the Pro trial we set up ended on Friday, the first $44.25 payment didn't go through. Your bank declined it for insufficient funds.

You can pay with any card here, and your 25% off stays in place: PAY_LINK

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 4. bazigar88@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi,

A quick note from me, not the automated emails.

Your November Basic payment didn't go through on Saturday.

Stripe will try again automatically over the next few days, so it may well go through on its own. If you'd rather settle it now, you can pay with any card here: PAY_LINK

Your account is still fully on for now.

If something has changed on your end, or you have a question, just reply.

Best,
```

### 5. colbyscott001@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi Colby,

A quick note from me, not the automated emails.

Your free trial ended on November 4, and the first $39 payment didn't go through. Your bank declined it for insufficient funds.

When you're ready, you can pay with any card here: PAY_LINK

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 6. yahyaarmex@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi Yahya,

A quick note from me, not the automated emails.

Your free trial ended on November 4, and the first payment didn't go through. Your bank declined it for insufficient funds.

When you're ready, you can pay with any card here: PAY_LINK

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 7. snaur.matej@seznam.cz

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi Matěj,

A quick note from me, not the automated emails.

Your free trial ended on November 4, and the first payment didn't go through. Your bank says the card on file can no longer be charged, so Stripe's retries won't fix it.

If you'd like to keep your plan, you can pay with a different card here: PAY_LINK

If now isn't the right time, that's completely fine. Just reply and I'll cancel it.

Best,
```

### 8. waila.sarah19941992forever@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi,

A quick note from me, not the automated emails.

Your free trial ended on November 3, and the first payment didn't go through. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it.

When you're ready, you can pay with any card here: PAY_LINK

Stripe will also try again automatically, so if the problem was on Link's side, it may go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 9. demargthomas@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi,

A quick note from me, not the automated emails.

Your free trial ended on November 1, and the first $39 payment didn't go through. Your bank declined it for insufficient funds.

When you're ready, you can pay with any card here: PAY_LINK

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 10. isaacwesr1@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi,

A quick note from me, not the automated emails.

Your free trial ended on November 1, and the first payment didn't go through. Your bank declined it for insufficient funds.

When you're ready, you can pay with any card here: PAY_LINK

Or, once the funds are in that account, Stripe's next automatic retry should go through on its own.

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 11. scesa.fg@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi,

A quick note from me, not the automated emails.

Your free trial ended on November 2, and the first payment still hasn't gone through. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it. Stripe has retried it several times since without luck.

When you're ready, you can pay with any card here: PAY_LINK

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 12. jbsabbino@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi,

A quick note from me, not the automated emails.

Your free trial ended on October 29, and the first payment still hasn't gone through. Your bank declined it for insufficient funds, and Stripe's retries since haven't cleared it.

If you'd like to keep your plan, you can pay with any card here: PAY_LINK

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 13. ajwan.naif662@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi,

A quick note from me, not the automated emails.

Your free trial ended on October 29, and the first payment still hasn't gone through. Your bank declined it for insufficient funds, and Stripe's retries since haven't cleared it.

If you'd like to keep your plan, you can pay with any card here: PAY_LINK

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 14. na2030knsa@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi,

A quick note from me, not the automated emails.

Your free trial ended on October 29, and the first payment still hasn't gone through. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it. Stripe has retried it several times since without luck.

When you're ready, you can pay with any card here: PAY_LINK

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 15. rodrigobena3@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi Rodri,

A quick note from me, not the automated emails.

Your free trial ended on October 28, and the first payment still hasn't gone through. It was charged through Link, and no reason came back with the decline, so I can't tell you what caused it. Stripe has retried it several times since without luck.

When you're ready, you can pay with any card here: PAY_LINK

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

### 16. louayejr11@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi Chouaib,

A quick note from me, not the automated emails.

Your free trial ended on October 30, and the first payment still hasn't gone through. Your bank declined it for insufficient funds, and Stripe's retries since haven't cleared it.

If you'd like to keep your plan, you can pay with any card here: PAY_LINK

If now isn't the right time, that's completely fine. Just reply and I'll cancel it so nothing is charged later.

Best,
```

## Monday's notes (only if still unpaid)

Run the loop above with these three addresses in place of the list:
`cedric.tannoukhi@gmail.com femifunky001@gmail.com wolug.tec@gmail.com`

### 17. cedric.tannoukhi@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi Cedric,

A quick note from me, not the automated emails.

Your November payment didn't go through on Sunday. Link declined it for insufficient funds.

Stripe will try again automatically, so it may well go through on its own once the funds are there. If you'd rather settle it now, you can pay with any card here: PAY_LINK

Your account is still fully on for now.

If something has changed on your end, or you have a question, just reply.

Best,
```

### 18. femifunky001@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi Olufemi,

A quick note from me, not the automated emails.

Your November payment didn't go through on Sunday. Link declined it for insufficient funds.

Stripe will try again automatically, so it may well go through on its own once the funds are there. If you'd rather settle it now, you can pay with any card here: PAY_LINK

Your account is still fully on for now.

If something has changed on your end, or you have a question, just reply.

Best,
```

### 19. wolug.tec@gmail.com

**Subject:** Your ZeroGEX payment didn't go through

```text
Hi Oliver,

A quick note from me, not the automated emails.

Your November payment didn't go through on Sunday. Your bank declined it for insufficient funds.

Stripe will try again automatically, so it may well go through on its own once the funds are there. If you'd rather settle it now, you can pay with any card here: PAY_LINK

Your account is still fully on for now.

If something has changed on your end, or you have a question, just reply.

Best,
```

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
