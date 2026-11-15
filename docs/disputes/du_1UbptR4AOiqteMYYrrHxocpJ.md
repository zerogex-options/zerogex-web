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

- [ ] Step 1. Renewal stopped before 2026-11-15 17:27 UTC (`set-cancellation ON=1`)
- [ ] Step 2. Support inbox checked for anything from the customer
- [ ] Step 3. Evidence pulled and checked
- [ ] Step 4. Evidence filed in Stripe (date: ____)
- [ ] Outcome: ____

## Recommendation: counter it, and file by hand

This case is very different from `du_1U6cn34AOiqteMYYYCr2OaKn`, which lost in September
because that customer never came back after day one and we had no usage to show. This
customer used Pro for the whole month, and our records show it:

- **Bought Pro themselves** on 2026-10-15, from inside their account, through a
  confirmation screen that stated the amount and the money-back guarantee.
- **Generated Pro API keys on their account page again and again**, 2026-10-16 to
  2026-10-23. Only a signed-in member on an active Pro plan can do that, so every one
  of those rows is proof that Pro access was working.
- **Kept signing in** through 2026-11-13.
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

- **22 API keys in about a week is unusual.** Each new key revokes the one before it
  (`core/apiKeyAdmin.ts`, `provisionApiKey`, `revoke_existing: true`), so this is one
  key being regenerated over and over. It might mean they were wiring the key into
  several tools, or that the API wasn't working for them. The key-service lookup in
  Step 3 shows whether any key was ever used. The evidence text below claims only that
  keys were generated, which is true either way. Do not add a claim of API usage unless
  `last_used_at` shows it.
- **Chase debit again**, the same issuer and card type as the August loss. Debit issuers
  lean toward the cardholder, which is exactly why the usage record matters here.

## Step 1: today, before 12:27 PM Eastern (2026-11-15 17:27 UTC), stop the renewal

The subscription renews today at 17:27:25 UTC for $44.25 (the Nov 7 discount applied).
A customer with an open dispute who gets charged again will very likely dispute that
charge too, which means another fee and another dispute on the account's record.

```bash
make set-cancellation EMAIL=annhuphamdinh@gmail.com ON=1 DRY_RUN=1
```

```bash
make set-cancellation EMAIL=annhuphamdinh@gmail.com ON=1 YES=1
```

The subscription stays active until 17:27 UTC today, then ends with no renewal charge.
It sends the customer no email. When it ends, the webhook drops the account to the free
tier and revokes the API key, as for any ended subscription.

Unlike August, this goes before filing. There, the rebuttal's central claim was "the
subscription is still active and was never canceled", so filing had to come first. Here
nothing in the rebuttal depends on the subscription staying active, and the renewal falls
inside the evidence window. Ending it at the close of the period the customer paid for
keeps "access stayed on for the whole paid period" true.

Do **not** use `make cancel-subscription`: it ends access immediately, which would cut
the paid period short by a few hours and make that sentence false.

**If you get to this after 17:27 UTC**, don't run the command above. The period will
already have rolled over, so it would only schedule a cancel for Dec 15 while the $44.25
renewal invoice still goes through. Tell me instead: the fix is to delete the draft
renewal invoice in Stripe (or refund it, if it has already charged; that charge is not
disputed, so Stripe allows a refund) and end the subscription, and the last paragraph of
the evidence changes.

## Step 2: check the support inbox

Search for `annhuphamdinh@gmail.com`, `nhu` and `pham`. If the customer ever wrote in,
above all about something not working, the API, or a refund, stop and send it to me
before filing. The evidence says they never contacted us, and that has to be true.

## Step 3: pull the evidence (read-only)

Merge this branch on the host first. It only adds two files under `docs/disputes/`; it
changes nothing in the app, so there's nothing to rebuild or restart. Then, from the
repo root:

```bash
sqlite3 -readonly /var/lib/zerogex/auth.db < docs/disputes/du_1UbptR4AOiqteMYYrrHxocpJ-evidence.sql > ~/dispute-du_1UbptR4A.txt
```

Then the API-key lookup, which asks the backend key service for every key on the account
with its created and last-used times, and adds the answer to the same file:

```bash
cd ~/zerogex-web/frontend && source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && node --env-file=.env.local -e 'const e=process.env; const base=(e.ZEROGEX_API_BASE_URL||"http://127.0.0.1:8000").replace(/\/+$/,""); fetch(base+"/api/admin/api-keys?user_id="+encodeURIComponent("annhuphamdinh@gmail.com"),{headers:{Authorization:"Bearer "+(e.ZEROGEX_API_TOKEN||e.ZEROGEX_API_KEY),"X-Admin-Token":e.ZEROGEX_ADMIN_TOKEN||""}}).then(async r=>{const t=await r.text(); let out=t; try{out=JSON.stringify(JSON.parse(t),null,2)}catch{} console.log("== API KEYS from the key service (HTTP "+r.status+") ==\n"+out)}).catch(err=>console.log("== API KEYS: could not reach the key service: "+err.message))' >> ~/dispute-du_1UbptR4A.txt
```

Both commands only read. `getActiveApiKey` asks the same endpoint with
`active_only=true`, so leaving that off should list revoked keys too.

The easy path: paste the whole of `~/dispute-du_1UbptR4A.txt` to Claude and get the final
text back. To finish it yourself, check four things:

1. **Summary, "Purchase" lines.** There should be a Purchase line at about 2026-10-15
   17:27, and "Purchase record as logged" should begin `Trial ended for paid switch` and
   include `money-back guarantee`. If there is no Purchase line, stop: item 2 of A is
   wrong. If it says `no guarantee — refund already used`, take out every sentence about
   the guarantee and the refund button, in A and C below.
2. **Summary, "Money-back refund requests on file"** should be `0`. If it isn't, stop:
   item 6 of A is wrong.
3. **Page views.** If the page-view sections are empty, delete the clause in item 4 of A
   that begins "and our page-view records".
4. **API keys.** If any `last_used_at` is after 2026-10-15 17:27 UTC, add this sentence
   to the end of item 4 of A, with the latest date: "Their API keys were used to request
   data from our API, most recently on [date]." If every one is empty, add nothing.

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

This costs nothing and sometimes gets a dispute withdrawn. Send it after Step 1 has taken
effect. If they reply that they'll withdraw it, still file the evidence and attach their
reply as customer communication; a promise to withdraw is not a withdrawal.

> Subject: Your ZeroGEX Pro payment
>
> Hi,
>
> Your bank has told us you disputed your $59.00 ZeroGEX Pro payment from October 15,
> saying the service wasn't received.
>
> I want to make sure nothing went wrong on our end. Our records show your account using
> Pro through November 13, and on November 7 you chose to keep your subscription. If
> something wasn't working for you, reply and tell me what happened.
>
> Either way, your subscription has been canceled and you won't be charged again. If the
> dispute was a mistake, you can ask your bank to withdraw it.
>
> Michael
> ZeroGEX

## The evidence

All of it is drafted from facts already confirmed by `make diagnose-user` (2026-11-15)
and the code that was live at the time (see the last section). Do the Step 3 checks
before pasting.

### A. Main explanation (`uncategorized_text`)

> The customer received the service and used it throughout the month they paid for.
>
> ZeroGEX Pro is an online subscription to an options-analytics website (zerogex.io) and
> its API. Nothing is shipped: the customer receives the service by signing in to their
> account. Our records show this customer bought Pro themselves, used it for the whole
> paid period, and chose to keep it three weeks after the charge.
>
> 1. The customer created their account on October 14, 2026, verified their email
> address, and accepted our Terms of Service.
>
> 2. On October 15, 2026, the customer upgraded to Pro from inside their signed-in
> account. Before taking payment, our confirmation screen told them: "Your free trial
> ends today, and $59.00 is charged to your card on file now. Covered by our 7-day
> money-back guarantee - limit one refund per customer." They clicked "Confirm and pay."
> That is the disputed charge (invoice in_1UQsR74AOiqteMYY7F1VyxqS).
>
> 3. Pro access started at that moment and stayed on, without interruption, for the
> entire period the charge paid for (October 15 to November 15, 2026). We never
> suspended, limited or withheld it.
>
> 4. The customer used it. They acknowledged the Pro welcome screen on October 16,
> generated new Pro API keys on their account page again and again between October 16
> and October 23, and kept signing in afterward, including on October 25, October 30,
> October 31, November 7 and November 13. An API key can only be created by a signed-in
> member with active Pro access, so each of those keys shows the service working for
> them. The attached activity log lists every sign-in and action with its time and IP
> address, and our page-view records show which pages of the service they opened, day
> by day.
>
> 5. On November 7, 2026, three weeks after the charge, the customer opened our
> cancellation screen. We offered them 25% off to stay. They clicked "Keep my access &
> apply 25% off" rather than "No thanks, continue to cancel." Someone who had not
> received the service would have had no access to keep.
>
> 6. For 7 days after the payment, the customer's account page offered a full refund at
> the click of a button ("Request a full refund"). They were on that page during that
> week, generating API keys, and never asked for the refund. They have never contacted
> us to report a problem with the service.
>
> After this dispute was filed, we ended the subscription at the close of the paid
> period, so the customer will not be charged again. The service the disputed charge
> paid for had already been delivered in full.

### B. Access activity log (`access_activity_log`)

Paste the **ACCESS ACTIVITY LOG** section of `~/dispute-du_1UbptR4A.txt` exactly as
printed, then the **PAGES VIEWED PER DAY** section if it has rows, then this paragraph:

> ZeroGEX Pro was provisioned at the moment of purchase on October 15, 2026 and stayed
> live and unrestricted for the entire period covered by the disputed charge (October 15
> to November 15, 2026). Every action listed above was taken while signed in to the
> customer's own account. API keys can only be created on the account page, by a
> signed-in member with active Pro access.

Do not trim rows from the log. A log with gaps reads as edited. The SQL already leaves
out rows the system wrote rather than the customer (webhook syncs, emails, scripts),
which carry a label instead of an IP.

### C. Refund policy disclosure (`refund_policy_disclosure`)

> The customer was shown our refund policy at the moment of purchase, had a one-click
> refund available for the week after it, and agreed to the policy when they signed up.
>
> 1. At purchase on October 15, 2026, the confirmation screen they clicked through said:
> "Covered by our 7-day money-back guarantee - limit one refund per customer."
>
> 2. From October 15 to October 22, 2026, their account page showed a "7-day money-back
> guarantee" panel offering the full $59.00 back, with a "Request a full refund" button.
> They did not use it.
>
> 3. Our Terms of Service, which the customer accepted when they created their account on
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
| `customer_purchase_ip` | the IP on the summary's "Purchase" line in `~/dispute-du_1UbptR4A.txt` |
| `product_description` | ZeroGEX Pro, a $59.00/month subscription to ZeroGEX (zerogex.io), an online options-analytics service: live gamma-exposure (GEX) dashboards, dealer-positioning and options-flow metrics, trade signals and backtesting tools, plus API access. Delivered online through the customer's account; nothing is shipped. |
| `service_date` | 2026-10-15 (service period 2026-10-15 to 2026-11-15) |

### E. Attachments

- **Receipt** (`receipt`): the hosted invoice for `in_1UQsR74AOiqteMYY7F1VyxqS`, printed
  to PDF:
  `https://invoice.stripe.com/i/acct_1TOi5O4AOiqteMYY/live_YWNjdF8xVE9pNU80QU9pcXRlTVlZLF9WUmx6UDFGc0ZTR3RDc2tySWJiSENUa1hBeUZTbGZULDE4NTI5OTg0OQ0200s5CQjlkX?s=ap`
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
| Oct 15 purchase: "Your free trial ends today, and {amount} is charged to your card on file now." / "Covered by our {days}-day money-back guarantee - limit one refund per customer." / "Confirm and pay" | `0aef29de` | `frontend/app/pricing/Client.i18n.ts` (`confirmSwitchBody`, `confirmSwitchGuarantee`, `confirmSwitchCta`); the amount is `Intl.NumberFormat` en-US currency, so `$59.00` |
| Oct 15 to 22: refund panel with "Request a full refund", shown only while the member is eligible | `0aef29de` | `frontend/components/MoneyBackGuaranteePanel.i18n.ts`, rendered on `frontend/app/account/page.tsx` |
| Oct 16 to 23: API keys, created only from the account page, by a signed-in member with an API-eligible (Pro) tier | `0aef29de` | `frontend/components/AccountApiKeys.tsx` (the only caller), `frontend/app/api/account/api-keys/route.ts` |
| Nov 7 cancellation screen: "Keep my access & apply {pct}% off" / "No thanks, continue to cancel" | `b24dc54a` | `frontend/components/CancelRetentionModal.i18n.ts` (`applyDiscount`, `declineToCancel`); the `discount` action in `frontend/app/api/billing/cancel-flow/route.ts` writes `billing_retention_offer_accepted` |

## Timeline (UTC, from `make diagnose-user` on 2026-11-15)

| When | What |
| --- | --- |
| 2026-10-14 21:24:36 | Account created; Terms accepted |
| 2026-10-14 21:24:57 | Email verified |
| 2026-10-14 21:27:34 | Basic trial starts ($0.00 invoice `in_1UQZhz4AOiqteMYYcbBso8IN`) |
| **2026-10-15 17:27:25** | **Trial ended early by the in-app switch to Pro; $59.00 charged and paid (`in_1UQsR74AOiqteMYY7F1VyxqS`). The disputed charge.** Subscription stamped `money_back=1`. |
| 2026-10-16 02:00 to 2026-10-23 19:08 | API keys `annhuphamdinh-12` through `-22` generated (earlier ones fall outside the diagnose output's last 20 events; the full log has them) |
| 2026-10-16 03:25:41 | Pro welcome screen acknowledged |
| 2026-10-22 17:27:25 | 7-day refund window closes, unused |
| 2026-10-25, 10-30, 10-31 | Sign-ins |
| 2026-11-07 22:45:43 | Sign-in |
| **2026-11-07 22:47:41** | **Cancellation screen: chose "Keep my access & apply 25% off"** |
| 2026-11-13 02:32:34 | Sign-in (last seen 02:49:19) |
| by 2026-11-15 | Dispute opened (exact date in the Stripe dashboard) |
| 2026-11-15 17:27:25 | End of the paid period; the subscription ends here once Step 1 is done |

All sign-ins and API-key rows in the diagnose output come from IPv6 addresses inside
`2607:9540:40::/48`. That isn't claimed in the evidence, because the earlier rows haven't
been checked yet; if every row in the full log fits, it can go in as one more sentence.

## Follow-ups (none urgent)

- This is the second dispute where a renewal had to be stopped by hand. The
  `charge.dispute.created` webhook (`frontend/app/api/webhooks/stripe/route.ts`) only
  reverses partner commissions; it could also schedule the subscription to cancel at
  period end. Not needed for this case.
- If the dispute is won: no partner commission to restore. The customer has no referrer.
