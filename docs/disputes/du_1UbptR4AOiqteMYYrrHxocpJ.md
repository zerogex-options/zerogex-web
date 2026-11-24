# Dispute du_1UbptR4AOiqteMYYrrHxocpJ: evidence package

| Field | Value |
| --- | --- |
| Dispute ID | `du_1UbptR4AOiqteMYYrrHxocpJ` |
| Amount | $59.00 USD |
| Issuer | JPMorgan Chase Bank N.A. (Debit) |
| Reason | Product not received (Stripe `product_not_received`; on a Visa card this is reason code **13.1**) |
| Cardholder | nhu pham (annhuphamdinh@gmail.com) |
| User ID | `user_60079f16044a7a158bd72190` |
| Stripe customer | `cus_VRSbs4BPkYFHmP` |
| Subscription | `sub_1UQZhy4AOiqteMYYrRN4GDUT` |
| Disputed invoice | `in_1UQsR74AOiqteMYY7F1VyxqS`, $59.00, paid 2026-10-15 17:27:25 UTC |
| Evidence deadline | **2026-11-30, 6:59:59 PM EST** |

## Status

- [x] ~~Step 1. Renewal stopped before 2026-11-15 17:27 UTC~~ Missed: the renewal charged
  $44.25 at 2026-11-15 18:28 UTC (`in_1Uc7DU4AOiqteMYYuSr66Ygp`). See Step 1 for the fix.
- [ ] Step 1 fix. **Renewal refunded in full in Stripe. Not done yet, and it now comes
  first:** the subscription is already canceled, so until the refund goes through the
  customer has paid $44.25 for a month they can't use.
- [x] Step 1 fix. Evidence pulled (Step 3 commands) on 2026-11-16 UTC, before the cancel.
- [x] Step 1 fix. Subscription canceled immediately (`cancel-subscription FORCE=1`) on
  2026-11-16 UTC: tier `public`, 1 API key revoked. This ran before the refund, so the
  daily orphan-payment alert may name this customer until the refund is in. **Don't act
  on the command that alert suggests** (applied, it would restore their access); refund
  instead.
- [x] Step 2. Nothing from the customer: per Michael (2026-11-16), they never responded
  to any email
- [x] Step 3. Evidence checked: all four checks pass (see Step 3)
- [ ] Step 4. Evidence filed in Stripe (date: ____)
- [ ] Outcome: ____

## Recommendation: counter it, and file by hand

This case is very different from `du_1U6cn34AOiqteMYYYCr2OaKn`, which lost in September
because that customer never came back after day one and we had no usage to show. This
customer used Pro for the whole month, and our records show it:

- **Bought Pro themselves** on 2026-10-15, from inside their account, through a
  confirmation screen that stated the amount and the money-back guarantee.
- **Opened 539 pages of the service on 29 different days** after paying, about 26 hours
  of on-screen time, mostly the charts page and their dashboards.
- **Created 23 Pro API keys and used 17 of them** to make requests to our API, the last
  on 2026-10-26. Only a signed-in member on an active Pro plan can create one.
- **Kept signing in** through 2026-11-13, the week the dispute was filed.
- **On 2026-11-07, three weeks after the charge, opened the cancellation screen and
  chose "Keep my access & apply 25% off"** instead of canceling.
- **Never used the one-click refund** their account page offered for the first 7 days,
  even though they were on that page generating API keys during that week.

"Product not received" is the claim our records answer most directly, and Stripe's own
analysis of this dispute reason found that submitting usage logs raises the win rate.

**File it by hand; don't leave it to Smart Disputes.** If nothing is filed, Stripe may
counter it automatically at the deadline with Smart Disputes, which builds the case from
what Stripe can see: the payment, the receipt, the customer's details. It can't see our
sign-ins, API keys, page views or the Nov 7 choice, and those are the whole case. Filing
by hand adds the $15 dispute-countered fee, which Stripe returns if we win.

### Weak points, stated plainly

- ~~**23 API keys in about a week is unusual.**~~ Resolved by the key-service lookup.
  Each new key revokes the one before it (`core/apiKeyAdmin.ts`, `provisionApiKey`,
  `revoke_existing: true`), and every revocation lands on the exact microsecond the next
  key was created, so all 23 were the customer regenerating. The worry was that the API
  wasn't working for them. It was: 17 of the 23 keys were used to make requests, several
  within minutes of being created, and the last key was used on 2026-10-26.
- **Chase debit again**, the same issuer and card type as the August loss. Debit issuers
  lean toward the cardholder, which is exactly why the usage record matters here.
- **We charged them again after the dispute opened** (the Nov 15 renewal). Refunding it
  in full and saying so plainly in the evidence (the paragraph of A about the renewal) is the honest
  version, and it reads as good faith rather than a merchant that kept billing.

## Step 1: refund the renewal, then end the subscription

**What happened.** The plan was to stop the renewal before 2026-11-15 17:27 UTC with
`set-cancellation ON=1`. That didn't happen in time: Stripe created the renewal invoice
`in_1Uc7DU4AOiqteMYYuSr66Ygp` at 17:27:48 UTC and charged $44.25 (the Nov 7 discount
applied) at 18:28 UTC. The subscription is now active through 2026-12-15.

**The fix: give the $44.25 back and end the subscription now.** A customer who disputed
one charge will very likely dispute the next, which means another fee and a second
dispute on the account's record. Refunding closes that door, and it has to come first:
Stripe won't refund a charge once it's disputed. The customer loses nothing they paid
for: the disputed $59.00 bought Oct 15 to Nov 15, and they had all of it.

**Where it stands (2026-11-16):** parts 2 and 3 below are done. Part 1, the refund, is
not, and it's the only thing left before filing.

Do it in this order.

1. **Refund the renewal in Stripe**: the customer's page → the $44.25 payment from
   Nov 15 → Refund → the full $44.25. If Stripe says the charge is already disputed,
   stop and tell me: that's a second dispute, and it's handled differently.

   Do not use `make money-back-refund` for this. The guarantee only ever covers the
   first payment on a subscription (`core/moneyBackGuarantee.ts`), so it would go after
   the disputed $59.00, which Stripe won't refund, and leave the $44.25 alone.

2. **Pull the evidence (both Step 3 commands)** before the next part. Ending the
   subscription revokes the customer's API key, and the key service may stop listing a
   key once it's revoked.

3. **End the subscription now.** Preview first:

   ```bash
   make cancel-subscription EMAIL=annhuphamdinh@gmail.com FORCE=1 DRY_RUN=1
   ```

   ```bash
   make cancel-subscription EMAIL=annhuphamdinh@gmail.com FORCE=1 YES=1
   ```

   It cancels with no proration credit and no final invoice (`core/pastDueCancel.ts`),
   drops the account to `public`, revokes the API key, and sends the customer nothing;
   the webhook's subscription-deleted path sends nothing either. `FORCE=1` is needed
   because the subscription is `active`, and ending access now is the point: the period
   it's in has just been refunded. `set-cancellation ON=1` is the wrong tool now, since
   it would keep the customer on Pro until Dec 15 without paying.

Refund before canceling, not after. A paid invoice on a canceled subscription is what
the daily orphan-payment sweep (06:40) looks for, and it would email you a false alarm if
it ran in between. With the refund already in place, it skips the payment
(`core/orphanPayment.ts` stops on a refunded amount).

That order slipped: the cancel ran first. So until the refund is in, the sweep may email
an alert naming this customer, most likely as "Paid, then lost access before the period
they bought was over", with a suggested command (a preview by default). **Don't act on
it**: applied, it would give the customer their access back. The refund is the fix, and
once it's in, the sweep stops reporting them.

## Step 2: check the support inbox

Search for `annhuphamdinh@gmail.com`, `nhu` and `pham`. If the customer ever wrote in,
above all about something not working, the API, or a refund, stop and send it to me
before filing. The evidence says they never contacted us, and that has to be true.

## Step 3: pull the evidence (read-only)

Run these before the cancel in Step 1. The two files they use are on the host (merged
2026-11-15). From the repo root:

```bash
sqlite3 -readonly /var/lib/zerogex/auth.db < docs/disputes/du_1UbptR4AOiqteMYYrrHxocpJ-evidence.sql > ~/dispute-du_1UbptR4A.txt
```

Then the API-key lookup, which asks the backend key service for every key on the account
with its created and last-used times, and adds the answer to the same file:

```bash
cd ~/zerogex-web/frontend && source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --env-file=.env.local -e 'const e=process.env; const base=(e.ZEROGEX_API_BASE_URL||"http://127.0.0.1:8000").replace(/\/+$/,""); fetch(base+"/api/admin/api-keys?user_id="+encodeURIComponent("annhuphamdinh@gmail.com"),{headers:{Authorization:"Bearer "+(e.ZEROGEX_API_TOKEN||e.ZEROGEX_API_KEY),"X-Admin-Token":e.ZEROGEX_ADMIN_TOKEN||""}}).then(async r=>{const t=await r.text(); let out=t; try{out=JSON.stringify(JSON.parse(t),null,2)}catch{} console.log("== API KEYS from the key service (HTTP "+r.status+") ==\n"+out)}).catch(err=>console.log("== API KEYS: could not reach the key service: "+err.message))' >> ~/dispute-du_1UbptR4A.txt
```

Both commands only read. Without `active_only=true` (which `getActiveApiKey` sends), the
endpoint lists revoked keys too, which the run confirmed.

**Run on 2026-11-16 UTC. All four checks pass**, and the final text below is built from
that output:

1. **Purchase.** `2026-10-15 17:27:28 from IP 2607:9540:40:a081:b0ef:5e4e:ac8:3b5c`,
   logged as `Trial ended for paid switch basic/monthly → pro/monthly on sub
   sub_1UQZhy4AOiqteMYYrRN4GDUT (charged $59.00 today as quoted, money-back guarantee;
   discounts unchanged)`. So the confirmation screen did show the guarantee line.
2. **Money-back refund requests on file: 0.**
3. **Page views after the charge:** 539 pages on 29 different days, about 1,569 minutes
   on screen, the last at 2026-11-13 02:50 UTC. Every day from Oct 15 to Nov 13 has
   views except Nov 8.
4. **API keys:** 23 created (the first at 2026-10-15 18:17, 50 minutes after the
   purchase), 17 used, the last use 2026-10-26 23:30:29 UTC on `annhuphamdinh-22`.

Also from the run: 9 sign-ins (2026-10-14 to 2026-11-13), and every row in the access
log, purchase included, comes from inside `2607:9540:40::/48`.

## Step 4: file it in Stripe

Dashboard → the dispute → **Counter dispute**, and file it yourself rather than accepting
the Smart Disputes submission. When asked what was sold, choose the digital product or
online service option: nothing was shipped. The form's wording changes from time to
time; the API field names below say what each box is for.

| Paste this | Into (API field) |
| --- | --- |
| A. Main explanation | the main explanation or "additional information" box (`uncategorized_text`) |
| B. Access activity log | "Access activity log" (`access_activity_log`). If the form has no such box, put it after A. |
| C. Refund policy disclosure | the refund-policy disclosure box, if asked (`refund_policy_disclosure`) |
| D. Short fields | their matching boxes |
| E. Attachments | file uploads |

Submit a few days before the deadline (2026-11-30, 6:59:59 PM EST), not on the day.

## Step 5 (optional): email the customer

Purely tactical: a cardholder who sees the merchant has the records sometimes withdraws
the dispute, which ends it weeks sooner. Send it only after both the refund and the
filing, because it says both happened. If they reply that they'll withdraw, add the
reply to the case; a promise to withdraw is not a withdrawal.

> Subject: Your ZeroGEX payment dispute
>
> You told your bank you didn't receive ZeroGEX Pro, which you paid $59.00 for on
> October 15.
>
> Our records show otherwise. After paying, you used Pro on 29 different days and used
> our API through October 26. On November 7 you chose to keep your subscription at 25%
> off instead of canceling, and you kept signing in until just before you filed the
> dispute. We've sent these records to your bank.
>
> Your subscription is canceled, and the $44.25 renewal from November 15 has been
> refunded.
>
> If you filed the dispute by mistake, you can withdraw it with your bank.
>
> Michael
> ZeroGEX

## The evidence

**Final text.** Every number comes from the evidence pull on 2026-11-16
(`~/dispute-du_1UbptR4A.txt`, Step 3), and every quote from the code that was live at
the time (see "What the customer saw"). Two sentences are only true once two things are
done, so don't paste until both are:

- the $44.25 refund (the paragraph of A about the renewal says it happened);
- the inbox search coming up empty (item 5 of A says they never contacted us). Done:
  per Michael, they never responded to any email.

### A. Main explanation (`uncategorized_text`)

> The cardholder's claim that they did not receive this service is false. Our records
> show they bought it themselves, used it on 29 of the 32 days the charge covered, and
> three weeks after paying chose to keep it instead of canceling.
>
> ZeroGEX Pro is an online subscription to an options-analytics website (zerogex.io) and
> its API. Nothing is shipped. The customer receives the service by signing in to their
> account, and it was live on their account from the moment of purchase.
>
> 1. PURCHASE. On October 15, 2026, the cardholder upgraded to Pro from inside their own
> signed-in account. Before charging, our confirmation screen told them: "Your free trial
> ends today, and $59.00 is charged to your card on file now. Covered by our 7-day
> money-back guarantee - limit one refund per customer." They clicked "Confirm and pay."
> That is the disputed charge (invoice in_1UQsR74AOiqteMYY7F1VyxqS). They had created the
> account the day before, checking the box to agree to our Terms of Service, and verified
> their email address.
>
> 2. DELIVERY. Pro access started at that moment and stayed on, without interruption, for
> the entire period the charge paid for (October 15 to November 15, 2026). We never
> suspended, limited or withheld it.
>
> 3. USE. After the purchase, the cardholder opened 539 pages of the service on 29
> different days, most often the charts page and their dashboards, with about 26 hours
> on screen. They created 23 Pro API keys on their account page and used 17 of them to
> make requests to our API, most recently on October 26. They were still signing in on
> November 13, the day before this dispute reached us. An API key can only be created by
> a signed-in member with active Pro access, so every key is itself proof that the
> service was working for them.
>
> 4. CHOSE TO KEEP IT. On November 7, 2026, three weeks after the charge, the cardholder
> opened our cancellation screen. We offered 25% off to stay. They clicked "Keep my
> access & apply 25% off" instead of "No thanks, continue to cancel." A customer who had
> not received the service would have had nothing to keep.
>
> 5. NEVER ASKED FOR A REFUND. For 7 days after the payment, their account page offered a
> full refund at the click of a button ("Request a full refund"). They were on that very
> page that week, creating API keys, and never used it. They have never contacted us to
> report a problem or ask for their money back.
>
> Every action in the attached log, from creating the account through the purchase to
> the last sign-in, came from the same network (IPv6 2607:9540:40::/48).
>
> After the dispute was filed, the subscription renewed automatically on November 15,
> 2026, for $44.25. We refunded that renewal in full and ended the subscription, so the
> cardholder has paid nothing beyond the disputed charge, for a month of service they
> used almost daily.
>
> The service was delivered in full and used extensively. We ask the issuer to reverse
> this chargeback.

### B. Access activity log (`access_activity_log`)

Paste everything in the box below, as is: the Step 3 output, with the key service's
answer turned into a table (straight from `created_at`, `last_used_at` and
`revoked_at`) and a closing paragraph. It's about 8,300 characters, under Stripe's
20,000 per field. If the form's box won't take it, print it to PDF and upload it instead.

Do not trim rows. A log with gaps reads as edited. The SQL already leaves out rows the
system wrote rather than the customer (webhook syncs, emails, scripts).

```text
ACCESS ACTIVITY LOG: account annhuphamdinh@gmail.com (user_60079f16044a7a158bd72190), all times UTC
2026-10-14 21:24:36 - Account created - 2607:9540:40:a081:acf6:20d9:d4b6:cafb
2026-10-14 21:24:36 - Email verification requested - 2607:9540:40:a081:acf6:20d9:d4b6:cafb
2026-10-14 21:24:57 - Email address verified - 2607:9540:40:a081:acf6:20d9:d4b6:cafb
2026-10-14 21:25:24 - Signed in - 2607:9540:40:a081:acf6:20d9:d4b6:cafb
2026-10-14 21:25:29 - Started checkout - 2607:9540:40:a081:acf6:20d9:d4b6:cafb
2026-10-14 21:26:29 - Started checkout - 2607:9540:40:a081:acf6:20d9:d4b6:cafb
2026-10-14 21:27:43 - Acknowledged the platform disclaimer - 2607:9540:40:a081:acf6:20d9:d4b6:cafb
2026-10-14 21:27:47 - Acknowledged the Basic welcome screen - 2607:9540:40:a081:acf6:20d9:d4b6:cafb
2026-10-14 21:39:04 - Signed in - 2607:9540:40:a081:b0ef:5e4e:ac8:3b5c
2026-10-15 04:06:18 - Signed in - 2607:9540:40:a00b:3021:d485:f3af:c1bf
2026-10-15 12:35:59 - Signed in - 2607:9540:40:a081:b0a7:f1f0:57d2:6b6f
2026-10-15 17:27:28 - Upgraded to Pro from inside the account and confirmed the charge of $59.00 ("Confirm and pay"). This is the disputed payment. - 2607:9540:40:a081:b0ef:5e4e:ac8:3b5c
2026-10-15 18:17:36 - Generated a Pro API key on the account page - 2607:9540:40:a081:b0ef:5e4e:ac8:3b5c
2026-10-15 18:36:54 - Generated a Pro API key on the account page - 2607:9540:40:a081:b0ef:5e4e:ac8:3b5c
2026-10-15 19:05:02 - Generated a Pro API key on the account page - 2607:9540:40:a081:b0ef:5e4e:ac8:3b5c
2026-10-15 22:22:12 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-15 22:34:51 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-15 22:51:16 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-15 22:54:41 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-15 23:15:56 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-16 00:19:30 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-16 00:24:31 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-16 01:10:44 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-16 01:29:21 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-16 02:00:57 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-16 02:19:08 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-16 03:25:41 - Acknowledged the Pro welcome screen - 2607:9540:40:a081:5592:780a:fe23:facd
2026-10-16 14:32:18 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-16 18:42:08 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-16 19:34:30 - Generated a Pro API key on the account page - 2607:9540:40:a081:fd97:f085:dcb5:5e6
2026-10-17 15:40:54 - Generated a Pro API key on the account page - 2607:9540:40:a081:7c45:fddb:449f:c0e8
2026-10-18 01:56:51 - Generated a Pro API key on the account page - 2607:9540:40:a081:81c5:9b8d:a02b:e8dd
2026-10-18 02:41:48 - Generated a Pro API key on the account page - 2607:9540:40:a081:81c5:9b8d:a02b:e8dd
2026-10-22 21:37:00 - Generated a Pro API key on the account page - 2607:9540:40:a00a:4e4:3828:52a6:60bb
2026-10-23 17:04:24 - Generated a Pro API key on the account page - 2607:9540:40:a00a:ddac:6448:589b:a681
2026-10-23 19:08:06 - Generated a Pro API key on the account page - 2607:9540:40:a00a:ddac:6448:589b:a681
2026-10-25 19:26:07 - Signed in - 2607:9540:40:a00a:a87c:92ad:d48b:f256
2026-10-30 17:54:12 - Signed in - 2607:9540:40:a00a:124b:76ad:8844:b03b
2026-10-31 21:22:14 - Signed in - 2607:9540:40:a00a:124b:76ad:8844:b03b
2026-11-07 22:45:43 - Signed in - 2607:9540:40:a00a:b990:7da:8bb7:5e23
2026-11-07 22:47:41 - Opened the cancellation screen and chose "Keep my access & apply 25% off" - 2607:9540:40:a00a:b990:7da:8bb7:5e23
2026-11-13 02:32:34 - Signed in - 2607:9540:40:a00a:124b:76ad:8844:b03b

PAGES VIEWED PER DAY while signed in to this account, all times UTC. The purchase was 2026-10-15 17:27; 539 of these pages, on 29 different days, came after it.
day | pages_viewed | minutes_on_screen
2026-10-14 | 44 | 72
2026-10-15 | 69 | 203
2026-10-16 | 69 | 297
2026-10-17 | 20 | 29
2026-10-18 | 21 | 36
2026-10-19 | 48 | 75
2026-10-20 | 28 | 168
2026-10-21 | 22 | 20
2026-10-22 | 72 | 111
2026-10-23 | 88 | 153
2026-10-24 | 2 | 0
2026-10-25 | 2 | 60
2026-10-26 | 4 | 30
2026-10-27 | 10 | 41
2026-10-28 | 12 | 58
2026-10-29 | 8 | 35
2026-10-30 | 5 | 5
2026-10-31 | 4 | 9
2026-11-01 | 9 | 1
2026-11-02 | 2 | 60
2026-11-03 | 8 | 43
2026-11-04 | 11 | 23
2026-11-05 | 5 | 43
2026-11-06 | 6 | 11
2026-11-07 | 11 | 3
2026-11-09 | 4 | 6
2026-11-10 | 5 | 60
2026-11-11 | 7 | 28
2026-11-12 | 2 | 1
2026-11-13 | 6 | 3

MOST-VIEWED PAGES, whole account, 2026-10-14 to 2026-11-13
path | views
/chart | 140
/dashboard | 93
/my-dashboard | 91
/ | 26
/account | 25
/basic-signals | 11
/greeks-gex | 10
/tape-flow-bias | 10
/trade-bias | 10
/signal-score | 9
/gex-gradient | 8
/live-bulletin | 8
/skew-delta | 8
/options-calculator | 7
/pricing | 7

API KEYS issued to this account, from our API key service, all times UTC. Each new key replaces the one before it. "Last used" is the last time our API received a request made with that key.
key | created | last used for an API request | replaced by the next key
annhuphamdinh | 2026-10-15 18:17:36 | 2026-10-15 18:21:24 | 2026-10-15 18:36:54
annhuphamdinh-1 | 2026-10-15 18:36:54 | 2026-10-15 18:40:57 | 2026-10-15 19:05:02
annhuphamdinh-2 | 2026-10-15 19:05:02 | 2026-10-15 19:06:11 | 2026-10-15 22:22:12
annhuphamdinh-3 | 2026-10-15 22:22:12 | 2026-10-15 22:22:16 | 2026-10-15 22:34:50
annhuphamdinh-4 | 2026-10-15 22:34:50 | 2026-10-15 22:34:55 | 2026-10-15 22:51:16
annhuphamdinh-5 | 2026-10-15 22:51:16 | never used | 2026-10-15 22:54:41
annhuphamdinh-6 | 2026-10-15 22:54:41 | 2026-10-15 23:09:55 | 2026-10-15 23:15:56
annhuphamdinh-7 | 2026-10-15 23:15:56 | 2026-10-16 00:16:43 | 2026-10-16 00:19:30
annhuphamdinh-8 | 2026-10-16 00:19:30 | 2026-10-16 00:19:57 | 2026-10-16 00:24:31
annhuphamdinh-9 | 2026-10-16 00:24:31 | 2026-10-16 01:02:03 | 2026-10-16 01:10:44
annhuphamdinh-10 | 2026-10-16 01:10:44 | never used | 2026-10-16 01:29:21
annhuphamdinh-11 | 2026-10-16 01:29:21 | never used | 2026-10-16 02:00:57
annhuphamdinh-12 | 2026-10-16 02:00:57 | never used | 2026-10-16 02:19:08
annhuphamdinh-13 | 2026-10-16 02:19:08 | 2026-10-16 12:46:19 | 2026-10-16 14:32:18
annhuphamdinh-14 | 2026-10-16 14:32:18 | 2026-10-16 17:55:34 | 2026-10-16 18:42:08
annhuphamdinh-15 | 2026-10-16 18:42:08 | 2026-10-16 18:58:08 | 2026-10-16 19:34:30
annhuphamdinh-16 | 2026-10-16 19:34:30 | 2026-10-16 20:50:54 | 2026-10-17 15:40:54
annhuphamdinh-17 | 2026-10-17 15:40:54 | never used | 2026-10-18 01:56:51
annhuphamdinh-18 | 2026-10-18 01:56:51 | never used | 2026-10-18 02:41:48
annhuphamdinh-19 | 2026-10-18 02:41:48 | 2026-10-20 15:54:46 | 2026-10-22 21:37:00
annhuphamdinh-20 | 2026-10-22 21:37:00 | 2026-10-23 16:26:39 | 2026-10-23 17:04:24
annhuphamdinh-21 | 2026-10-23 17:04:24 | 2026-10-23 18:21:56 | 2026-10-23 19:08:06
annhuphamdinh-22 | 2026-10-23 19:08:06 | 2026-10-26 23:30:29 | still active until the subscription ended

ZeroGEX Pro was provisioned at the moment of purchase on October 15, 2026 and stayed live and unrestricted for the entire period covered by the disputed charge (October 15 to November 15, 2026). Every action listed above was taken while signed in to the customer's own account. Members stay signed in between visits, which is why there are far fewer sign-ins than days of use. API keys can only be created on the account page, by a signed-in member with active Pro access. Page time counts only time the page was visible on the customer's screen, capped at 30 minutes per page. The customer agreed to our Terms of Service when creating the account: the sign-up form cannot be submitted without checking that box, and the acceptance is recorded with the account's creation time (2026-10-14 21:24:36 UTC).
```

### C. Refund policy disclosure (`refund_policy_disclosure`)

> The refund policy was shown to the cardholder at the moment of purchase, a one-click
> refund was available to them for the following week, and they agreed to the policy
> when they signed up. They never used it.
>
> 1. At purchase on October 15, 2026, the confirmation screen they clicked through said:
> "Covered by our 7-day money-back guarantee - limit one refund per customer."
>
> 2. From October 15 to October 22, 2026, their account page showed a "7-day money-back
> guarantee" panel offering the full $59.00 back, with a "Request a full refund" button.
> They visited that page during that week and did not use it.
>
> 3. Our Terms of Service, which they agreed to when they created their account on
> October 14, 2026, say in Section 4: "Plans without a free trial are covered by a
> money-back guarantee: if you request a refund from your account page within 7 days of
> the first payment on that subscription, we refund that payment (and any charge for an
> upgrade made within those 7 days) in full, cancel the subscription, and end access
> immediately." and "Except for the money-back guarantee above and where required by
> law, fees are non-refundable."

### D. Short fields

| Field | Value |
| --- | --- |
| `customer_name` | nhu pham |
| `customer_email_address` | annhuphamdinh@gmail.com |
| `customer_purchase_ip` | `2607:9540:40:a081:b0ef:5e4e:ac8:3b5c` (the in-app upgrade, 2026-10-15 17:27:28 UTC) |
| `product_description` | ZeroGEX Pro, a $59.00/month subscription to ZeroGEX (zerogex.io), an online options-analytics service: live gamma-exposure (GEX) dashboards, dealer-positioning and options-flow metrics, trade signals and backtesting tools, plus API access. Delivered online through the customer's account; nothing is shipped. |
| `service_date` | 2026-10-15 (service period 2026-10-15 to 2026-11-15) |

### E. Attachments

- **Receipt** (`receipt`): the hosted invoice for `in_1UQsR74AOiqteMYY7F1VyxqS`, printed
  to PDF:
  `https://invoice.stripe.com/i/acct_1TOi5O4AOiqteMYY/live_YWNjdF8xVE9pNU80QU9pcXRlTVlZLF9WUmx6UDFGc0ZTR3RDc2tySWJiSENUa1hBeUZTbGZULDE4NTMzNDEwNA0200WprzbHEX?s=ap`
  (from `make diagnose-user` on 2026-11-15; if the link no longer opens, run it again
  for a fresh one). Upload only this invoice. The Nov 15 renewal invoice is not part of
  the dispute.
- **Terms of Service** (`refund_policy`): `zerogex.io/terms`, printed to PDF. The refund
  and money-back wording in Section 4 is unchanged since the customer accepted it on
  2026-10-14. The only change to the Terms since then is the free-trial card sentence,
  which is not part of this case.

## What the customer saw, checked against the code that was live at the time

The quotes in the evidence come from the copy as it stood on the day, not from today's
code. Repo history was checked at the last commit on `release` before each event. Each
quoted string had been in place for weeks by then (the purchase screen and refund panel
since `34f59ac8` on 2026-09-22, with the long dash in the guarantee line changed to a
hyphen on 2026-09-24; the cancellation screen since `0bb075f7` on 2026-08-13), so a
deploy running a little behind `release` would have shown the same words.

| Event | Commit | Where |
| --- | --- | --- |
| Oct 14 signup: Terms Section 4 with the guarantee and the non-refundable clause | `d4559078` | `frontend/app/terms/Client.i18n.ts` (`s4GuaranteeBody`, `s4RefundsBody`) |
| Oct 14 signup: the account can't be created without checking the Terms box (required since `91638b24`, 2026-08-21); the acceptance is stored with the account's creation time | `d4559078` | `frontend/app/api/auth/register/route.ts` (`isAcceptedTermsVersionCurrent`), `frontend/core/serverAuth.ts` (`terms_accepted_at` = `created_at`) |
| Page time: counted only while the page is visible, capped at 30 minutes per view | current | `frontend/components/PageAnalytics.tsx` (`isVisible`), `frontend/core/pageAnalytics.ts` (`MAX_VISIT_MS`) |
| Oct 15 purchase: "Your free trial ends today, and {amount} is charged to your card on file now." / "Covered by our {days}-day money-back guarantee - limit one refund per customer." / "Confirm and pay" | `0aef29de` | `frontend/app/pricing/Client.i18n.ts` (`confirmSwitchBody`, `confirmSwitchGuarantee`, `confirmSwitchCta`); the amount is `Intl.NumberFormat` en-US currency, so `$59.00` |
| Oct 15 to 22: refund panel with "Request a full refund", shown only while the member is eligible | `0aef29de` | `frontend/components/MoneyBackGuaranteePanel.i18n.ts`, rendered on `frontend/app/account/page.tsx` |
| Oct 16 to 23: API keys, created only from the account page, by a signed-in member with an API-eligible (Pro) tier | `0aef29de` | `frontend/components/AccountApiKeys.tsx` (the only caller), `frontend/app/api/account/api-keys/route.ts` |
| Nov 7 cancellation screen: "Keep my access & apply {pct}% off" / "No thanks, continue to cancel" | `b24dc54a` | `frontend/components/CancelRetentionModal.i18n.ts` (`applyDiscount`, `declineToCancel`); the `discount` action in `frontend/app/api/billing/cancel-flow/route.ts` writes `billing_retention_offer_accepted` |

## Timeline (UTC, from the evidence pull and `make diagnose-user`)

| When | What |
| --- | --- |
| 2026-10-14 21:24:36 | Account created (Terms box checked at sign-up) |
| 2026-10-14 21:24:57 | Email verified |
| 2026-10-14 21:27:34 | Basic trial starts ($0.00 invoice `in_1UQZhz4AOiqteMYYcbBso8IN`) |
| **2026-10-15 17:27:28** | **In-app switch to Pro: trial ended early, $59.00 charged and paid (`in_1UQsR74AOiqteMYY7F1VyxqS`, Stripe time 17:27:25). The disputed charge.** Subscription stamped `money_back=1`. |
| 2026-10-15 18:17 to 2026-10-23 19:08 | 23 API keys created, each replacing the last; 17 used |
| 2026-10-16 03:25:41 | Pro welcome screen acknowledged |
| 2026-10-22 17:27:25 | 7-day refund window closes, unused |
| 2026-10-25, 10-30, 10-31 | Sign-ins |
| 2026-10-26 23:30:29 | Last API request (key `annhuphamdinh-22`) |
| 2026-11-07 22:45:43 | Sign-in |
| **2026-11-07 22:47:41** | **Cancellation screen: chose "Keep my access & apply 25% off"** |
| 2026-11-13 02:32:34 | Last sign-in; last page view 02:50 |
| **2026-11-14 22:57** | **Dispute opened** (Stripe: "Payment disputed Nov 14, 5:57 PM" ET) |
| 2026-11-15 17:27:25 | End of the period the disputed charge paid for |
| 2026-11-15 17:27:48 | Renewal invoice `in_1Uc7DU4AOiqteMYYuSr66Ygp` created (`subscription_cycle`); paid $44.25 at 18:28:00. Step 1 hadn't run yet. |
| 2026-11-16 | Evidence pulled, then subscription canceled immediately (1 API key revoked) |
| pending | $44.25 renewal refunded in full |

From 2026-10-15 to 2026-11-13, there are page views on every day except 2026-11-08.

## Follow-ups (none urgent)

- This is the second dispute where a renewal had to be stopped by hand. The
  `charge.dispute.created` webhook (`frontend/app/api/webhooks/stripe/route.ts`) only
  reverses partner commissions; it could also schedule the subscription to cancel at
  period end. Not needed for this case.
- If the dispute is won: no partner commission to restore. The customer has no referrer.
