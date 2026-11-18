# Chandra: renewed before the pause, pause it for them (2026-11-17)

American English, and each paragraph in the reply is a single line with no hard
wrapping, so it can be pasted straight into a mail client.

**Inbound.** On Fri Nov 13, 7:16 PM, you told Chandrashekar VM ("Chandra") how
to pause for 2 months from the Account page. Chandra replied: "dang, i missed
your email and it renewed already!"

> **Status:** done, Wed Nov 18. Paused at 12:46 AM ET with
> `make pause-subscription` (2 months, no refund). The site picked it up at
> once: tier `public`, paused until Mon Jan 18, 12:46 AM ET. The Dec 14 and
> Jan 14 bills are skipped, and the next charge is Sun Feb 14, 8:43 PM ET. No
> API key on the account, so the pause revoked nothing and the API paragraph
> came out of the reply. Then the reply below went out.
> **Follow-up Mon Jan 18:** check that Pro came back on its own (see below).

## Chandra's account

| | |
|---|---|
| Email | vmshekar@gmail.com |
| User id | `user_7b1d84c4cfce66edcb7b9d1d` |
| Plan | Pro monthly, bills on the 14th at 8:43 PM ET |
| Renewed | Sat Nov 14, 8:43 PM ET, a day after your Nov 13 email |
| Paused | Wed Nov 18, 12:46 AM ET, for 2 months |
| Resumes | Mon Jan 18, 12:46 AM ET (`2027-01-18T05:46:23Z`) |
| Bills skipped | Mon Dec 14 and Thu Jan 14 (voided) |
| Next charge | Sun Feb 14, 8:43 PM ET |
| API keys | none, so nothing was revoked |
| Stripe | `sub_1UDE4S4AOiqteMYYxAP3oQP4` |

## The read

- **No refund. Pausing now still makes Chandra whole.** During a pause, Stripe
  keeps billing on its normal schedule and voids every bill that comes due
  inside the pause (`behavior: 'void'`, the same setting the in-app pause uses
  in `frontend/app/api/billing/cancel-flow/route.ts`). So a 2-month pause voids
  exactly two monthly bills. Started right after a renewal, those are the
  December and January bills, and the November payment covers the stretch from
  the end of the pause to the February bill.
- **Chandra's numbers:** paid Nov 14, paused Nov 18, the Dec 14 and Jan 14
  bills voided, access back Jan 18, next charge Feb 14. One payment buys the
  few days in November plus Jan 18 to Feb 14, about one month of access.
- **A refund on top would be a free month.** The pause still voids the January
  bill, so Chandra would get from the January resume to the February bill for
  nothing.
- **Pause it for them instead of asking again.** Chandra already missed one
  email. If this one got missed too, December would have billed. It's one
  command.
- **Use `make pause-subscription`, not the Stripe Dashboard.** It sets the same
  pause the Account page does, resuming at the same minute two months out, and
  prints the bills it skips and the next charge date. The Dashboard resumes on
  a calendar day, and if that day is the January billing day, the January bill
  can land after the resume and get charged.

## Commands (as run)

All in `~/zerogex-web` on the server.

1. **Preview:**

   ```bash
   make pause-subscription EMAIL=vmshekar@gmail.com MONTHS=2
   ```

   Showed `Auth DB: /var/lib/zerogex/auth.db`, `Plan: pro monthly`,
   `Scheduled cancel: no`, bills skipped Dec 14 and Jan 14, next charge Feb 14.
2. **Pause:**

   ```bash
   make pause-subscription EMAIL=vmshekar@gmail.com MONTHS=2 YES=1
   ```

   Ended with `Done. vmshekar@gmail.com is paused for 2 months.` and `The site
   has it: tier public, paused until 2027-01-18T05:46:23.000Z.`
3. **API key check.** Pausing a Pro member revokes their API keys, and the
   webhook logs it when it does:

   ```bash
   sqlite3 /var/lib/zerogex/auth.db "SELECT created_at, type, message FROM audit_events WHERE user_id = 'user_7b1d84c4cfce66edcb7b9d1d' AND type LIKE 'api_key%' ORDER BY created_at DESC LIMIT 3;"
   ```

   No rows: Chandra never had a key, so the API paragraph came out of the
   reply.

## Reply (sent)

Hi Chandra,

No worries at all, and you haven't lost anything. I've paused it for you, so there's nothing you need to do.

The payment that just went through carries over to when you're back. The pause skips your December and January bills, so you won't be charged again until February 14. Your access is off while it's paused and comes back on its own on January 18.

If you're back sooner, click "Resume now" at https://zerogex.io/account, and billing picks up again on your usual monthly date.

Enjoy the trip,

## Follow-up, Mon Jan 18

```bash
make diagnose-user EMAIL=vmshekar@gmail.com
```

Tier should read `pro`, and the recent events should include
`billing_subscription_resumed`. If tier still reads `public`, the site never
heard that the pause ended and Chandra is locked out. Fix that before anything
else.

## Worth knowing (can wait)

- **This may be the first pause to end on its own.** The pause shipped Nov 6.
  The app turns access back on only when Stripe reports the pause ended, and
  nothing re-checks on its own. A 1-month pause taken in early November would
  end in early December. If one does, the same `diagnose-user` check on that
  member answers the question before Chandra's date.
- **Pausing a Pro member revokes their API keys for good**, and neither the
  pause screen nor the paused banner says so. It didn't matter here, since
  Chandra had no key. Suggested as a separate task.
