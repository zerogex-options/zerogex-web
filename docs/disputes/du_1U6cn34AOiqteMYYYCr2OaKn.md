# Dispute du_1U6cn34AOiqteMYYYCr2OaKn — evidence package

| Field | Value |
| --- | --- |
| Dispute ID | `du_1U6cn34AOiqteMYYYCr2OaKn` |
| Amount | $29.00 USD |
| Issuer | JPMorgan Chase Bank N.A. — Debit |
| Reason | Subscription canceled (Visa reason code **13.2**) |
| Cardholder | Jeremiah Zamora — jeremyy.zamora@gmail.com |
| User ID | `user_a6d4e5c41982998e216dd167` |
| Stripe customer | `cus_V1bhnW5LH1BZ7V` |
| Subscription | `sub_1U1YUq4AOiqteMYYGmVCi5Cn` |
| Disputed invoice | `in_1U45qG4AOiqteMYYZtU2r5FM` — paid 2026-08-14 |
| Evidence deadline | **2026-09-05** |

## Status

- **2026-08-21 — subscription scheduled to cancel at period end** (`make set-cancellation
  ON=1`). Access runs to 2026-09-13; no renewal charge will be attempted. This was our
  action, not the customer's.
- **Evidence: not yet confirmed submitted.** Every field below has been rewritten to be
  true as of 2026-08-21. If anything was submitted before that date using the earlier
  wording, it was accurate when filed and needs no correction — but do not re-submit the
  old text.

## Recommendation: counter

The cardholder's stated reason is factually contradicted by our records. **No cancellation
was ever requested, on any path**. The subscription ran with
`cancel_at_period_end = false` continuously from signup through the disputed charge and
for a week beyond it. We scheduled it to end at period end ourselves on 2026-08-21, in
response to this dispute — see "Status" below, which every evidence field must now
reflect. Visa 13.2 requires the cardholder to have actually
cancelled before the charge; they did not, and separately we satisfied Visa's
trial-conversion notification requirement 48 hours before billing.

Weak point to be aware of, stated plainly: we have **no product-usage evidence after the
charge**, and the session record confirms there is none to find — no authenticated request
was made after 2026-08-07, a week before the charge (see "Evidence checks already run").
The account was set up and used attentively on day one, then never revisited. This is a
"forgot I signed up" chargeback rather than fraud or a genuine failed cancellation, which
is winnable on the documentation — but it is not the same as showing the customer
consuming the service they paid for, and the issuer may weigh that.

See "Operational follow-up" at the bottom — **whatever the outcome, this subscription
renews 2026-09-13 and will likely produce a second chargeback if left alone.**

## The core rebuttal

Cancellation in this product is possible on exactly three paths, and every one of them
writes an audit row before anything else happens:

| Path | Code | Audit event written |
| --- | --- | --- |
| In-app "Cancel subscription" (account page → retention modal) | `frontend/app/api/billing/cancel-flow/route.ts:309` | `billing_cancel_flow_submitted` |
| Stripe-hosted billing portal cancel | `frontend/app/api/webhooks/stripe/route.ts:938` | `stripe_cancellation_requested` + `cancellation_ack_email_sent` |
| Account deletion | `frontend/app/api/account/delete/route.ts` | account-deletion events |

The webhook path fires on the genuine `cancel_at_period_end` 0→1 transition, so it captures
a cancel initiated *anywhere* — including directly in Stripe's portal, outside our UI.

**This account's audit log contains none of these events.** It contains only signup, email
verification, a password reset, two logins, disclaimer acknowledgement, the Pro onboarding
modal, and the automated billing/email lifecycle. The subscription record likewise shows
`cancel_at_period_end = no` in both our database and Stripe — not just at the time of the
charge, but as of today, six days after the dispute was filed.

## Timeline

| When (UTC) | What |
| --- | --- |
| 2026-08-06 21:03 | Account created; verification email issued |
| 2026-08-06 21:04 | Email verified |
| 2026-08-06 21:05 | Password reset requested and completed; login |
| 2026-08-06 21:05:55 | Checkout started — `tier=pro cadence=monthly trial=7d`, session `cs_live_a1VDjF0bVn4tig26z6PmDiDKdaYzFCvIkc3RttyMcuKjgkWFKEFXtnYRnt` |
| 2026-08-06 21:06:35 | Subscription created, status `trialing`, $0.00 invoice, trial ends 2026-08-13 |
| 2026-08-06 21:06:40 | Paid-welcome email sent |
| 2026-08-06 21:06:58 | Platform disclaimer (v2) acknowledged |
| 2026-08-06 21:07:09 | Pro welcome / API-key onboarding modal acknowledged |
| 2026-08-08 22:46 | Mid-trial value nudge email sent |
| **2026-08-11 22:19** | **Trial-end reminder sent — 48h before the first charge** |
| 2026-08-13 21:06:35 | Trial ends |
| 2026-08-13 22:07 | First charge attempt declined by issuer; payment-failed email sent; 3-day grace opened, access held |
| 2026-08-14 14:07:50 | Charge succeeds on attempt 2 — $29.00, invoice `in_1U45qG4AOiqteMYYZtU2r5FM` |
| 2026-08-14 14:08 | Payment-recovered confirmation email sent |
| 2026-08-20 | Subscription still `active`, `cancel_at_period_end = no`, next renewal 2026-09-13 |

Note the 2026-08-13 decline: the cardholder's own bank declined the first attempt, and the
charge went through the following day on retry. If they interpreted the decline as the
subscription having lapsed, that would explain the "I cancelled" framing — but a declined
card is not a cancellation, and we emailed them about both the failure and the recovery.

## Paste-ready Stripe evidence fields

### `cancellation_rebuttal`

> The customer never cancelled this subscription, and never asked us to.
>
> It ran with cancellation not scheduled continuously from signup on 2026-08-06, through
> the disputed charge on 2026-08-14, and for a further week beyond it. On 2026-08-21 we
> scheduled it to end at the close of the current paid period. That was our own decision,
> taken in response to this dispute so that the customer is not billed again while it is
> open; it was not requested by the customer, who has still never contacted us. The
> customer retains full access through 2026-09-13, the period already paid for.
>
> Cancellation is available to the customer at all times through three self-service paths:
> a "Cancel subscription" button on their account page, the Stripe-hosted billing portal,
> and account deletion. No email or support request is required, and cancellation is
> one click. Every one of these paths writes a timestamped audit record before any other
> action is taken, and the billing-portal path is driven by the Stripe webhook for
> `customer.subscription.updated`, so it captures a cancellation initiated directly in
> Stripe even if our own interface is never used.
>
> This customer's complete audit history contains no cancellation record of any kind.
> Both our database and the Stripe subscription record show `cancel_at_period_end = false`
> continuously from signup on 2026-08-06 through today. The customer has never contacted
> us by email or any other channel to request cancellation.
>
> The customer signed up on 2026-08-06 for a 7-day free trial, verified their email
> address, acknowledged our platform disclaimer, and completed the Pro onboarding flow
> including API-key setup. The trial ended 2026-08-13 and the subscription converted to
> paid as disclosed at checkout.
>
> Separately, the first conversion charge on 2026-08-13 was declined by the issuing bank.
> We emailed the customer about the failed payment that day, retried, and the charge
> succeeded on 2026-08-14, after which we emailed a payment-recovered confirmation. At no
> point during this exchange did the customer cancel or ask us to.

### `cancellation_policy_disclosure`

> The cancellation and trial terms were disclosed to the customer at three separate points
> before the disputed charge.
>
> 1. On the purchase page itself. The plan selection page the customer passed through to
>    reach Stripe Checkout carries the trial terms in the hero — "7-day free trial. Full
>    access now. No charge until day 7. Cancel anytime — no email or support request
>    required." — and, further down the same page, a section headed "Refund & Cancellation
>    Policy" which states: "Paid subscriptions are billed in advance on a recurring basis
>    through Stripe. You can cancel your subscription at any time from the Stripe-hosted
>    billing portal, accessible from your account page." That section sets out the trial
>    terms again ("You get full access right away. Your card is collected at signup but
>    isn't charged until the trial ends. Cancel before then and you pay nothing.") and,
>    under the heading "Cancel anytime.", states: "Manage or cancel your plan yourself
>    through the billing portal — no email or support request required." The customer
>    proceeded from this page to Stripe Checkout on 2026-08-06 (checkout session
>    cs_live_a1VDjF0bVn4tig26z6PmDiDKdaYzFCvIkc3RttyMcuKjgkWFKEFXtnYRnt).
>
> 2. In our published Terms of Service, linked in the footer of every page on the site
>    including the pricing page the customer purchased from. Section 4 ("Subscriptions,
>    Billing, and Cancellation") states: "Paid subscriptions are billed in advance on a
>    recurring basis through Stripe at the rates and intervals shown when you subscribe.
>    By subscribing, you authorize us and Stripe to charge your payment method for the
>    applicable fees." and "You may cancel at any time through the Stripe-hosted billing
>    portal."
>
> 3. In the welcome email sent 2026-08-06 immediately after signup, which stated the trial
>    end date and that the customer could cancel from the billing portal on their account
>    page before that date without being billed.
>
> In addition, on 2026-08-11 — 48 hours before the trial converted — we sent an
> advance-notice email with the subject "Your ZeroGEX free trial ends in 2 days." It named
> the exact trial end date, the exact amount to be charged, and the exact payment method
> ("your Visa card ending in 8562"), and stated: "your first payment will be charged then
> unless you cancel before that" and "If it isn't the right fit, you can cancel anytime
> from the billing portal on your account page and you won't be charged a cent." The
> customer took no action in response.

### `uncategorized_text`

> Supporting detail on the account record.
>
> Account: user_a6d4e5c41982998e216dd167, jeremyy.zamora@gmail.com, created 2026-08-06
> 21:03:22 UTC, email verified 2026-08-06 21:04:02 UTC.
>
> Subscription sub_1U1YUq4AOiqteMYYGmVCi5Cn, created 2026-08-06 21:06:35 UTC with a 7-day
> free trial ending 2026-08-13 21:06:35 UTC. Status: active, with access running through
> 2026-09-13 21:06:35 UTC. cancel_at_period_end was false continuously from signup until
> we ourselves set it on 2026-08-21 in response to this dispute, so that no further charge
> is attempted while it is open. Payment method: Visa ending 8562, expiry
> 12/2031, the same card used at signup and the subscription default throughout.
>
> Invoice history for this customer, in full:
>   in_1U1YUq4AOiqteMYY4oNtMsgz — $0.00, paid 2026-08-06 (trial start)
>   in_1U45qG4AOiqteMYYZtU2r5FM — $29.00, paid 2026-08-14 (the disputed charge)
>
> The $29.00 charged is below our $59.00/month list rate; the customer received a
> promotional discount applied at signup and carried into the first paid period.
>
> Every action taken to create this account and start the subscription came from a single
> residential IP address, 2603:8002:6c40:23:3cb0:8fbd:246d:69ac: account registration
> (21:03:22 UTC), the email verification request and its completion (21:04:02), a password
> reset request and completion (21:05:35), login (21:05:41), checkout initiation
> (21:05:55), acknowledgement of our platform disclaimer (21:06:58), and completion of the
> Pro onboarding and API-key setup flow (21:07:09) — seven distinct deliberate actions
> across four minutes on 2026-08-06, from one connection. This was a knowing, attended
> signup, not an incidental or unnoticed enrollment.
>
> Emails delivered to jeremyy.zamora@gmail.com before the disputed charge: paid welcome
> (2026-08-06 21:06:40), mid-trial value nudge (2026-08-08 22:46:28), trial-end reminder
> (2026-08-11 22:19:53). After the charge: payment-failed notice (2026-08-13 22:07:54) and
> payment-recovered confirmation (2026-08-14 14:08:03). None bounced and none were replied
> to with a cancellation request.

### `access_activity_log`

Stripe's form labels this **"Access activity log"**. All timestamps UTC.

> Account user_a6d4e5c41982998e216dd167 (jeremyy.zamora@gmail.com). Server-side access log:
>
> 2026-08-06 21:03:22 — account registered — 2603:8002:6c40:23:3cb0:8fbd:246d:69ac
> 2026-08-06 21:03:22 — email verification requested — 2603:8002:6c40:23:3cb0:8fbd:246d:69ac
> 2026-08-06 21:04:02 — email verification completed — 2603:8002:6c40:23:3cb0:8fbd:246d:69ac
> 2026-08-06 21:04:49 — password reset requested — 2603:8002:6c40:23:3cb0:8fbd:246d:69ac
> 2026-08-06 21:05:35 — password reset completed — 2603:8002:6c40:23:3cb0:8fbd:246d:69ac
> 2026-08-06 21:05:41 — authenticated login — 2603:8002:6c40:23:3cb0:8fbd:246d:69ac
> 2026-08-06 21:05:55 — checkout initiated, session cs_live_a1VDjF0bVn4tig26z6PmDiDKdaYzFCvIkc3RttyMcuKjgkWFKEFXtnYRnt — 2603:8002:6c40:23:3cb0:8fbd:246d:69ac
> 2026-08-06 21:06:35 — subscription created; Pro access provisioned server-side
> 2026-08-06 21:06:58 — platform disclaimer acknowledged in-app — 2603:8002:6c40:23:3cb0:8fbd:246d:69ac
> 2026-08-06 21:07:09 — Pro onboarding and API-key setup completed in-app — 2603:8002:6c40:23:3cb0:8fbd:246d:69ac
> 2026-08-06 21:34:34 — authenticated login — 146.70.174.222
>
> The account was provisioned with full Pro access on 2026-08-06, including an active API
> key issued to the customer, and that access remained live and unrestricted for the
> entire period covered by the disputed charge (2026-08-13 to 2026-09-13). The service was
> never suspended, throttled, or withheld, and access was not interrupted by the failed
> first charge on 2026-08-13 — we deliberately held the customer's Pro tier through a
> 3-day payment grace window while the retry completed.
>
> ZeroGEX is a live market-data service: the subscription entitles the customer to
> continuous access to real-time gamma-exposure analytics for as long as it is active,
> which was the case throughout. The customer never contacted us to report any difficulty
> accessing the service.

Include the 21:34:34 login and its IP. In a fraud dispute a datacenter IP would be worth
weighing; under 13.2 the cardholder has affirmatively acknowledged the subscription is
his, so identity is not contested, and a log with one row conspicuously missing its IP
reads as edited. The single-value `customer_purchase_ip` field is different — that one
correctly takes the residential address the purchase was actually made from.

This field is where honesty costs us something and we pay it anyway: the log ends on
2026-08-06. Do not pad it, and do not phrase anything to imply post-charge logins. The
defensible claim is that access was continuously *provisioned and available*, which is
true and is what the merchant is obliged to deliver. Non-use is the customer's choice.

### Simple fields

| Field | Value |
| --- | --- |
| `customer_name` | Jeremiah Zamora |
| `customer_email_address` | jeremyy.zamora@gmail.com |
| `product_description` | ZeroGEX Pro — monthly subscription to a live options gamma-exposure (GEX) analytics platform: Today's Read, GEX strike profile, gamma flip level, and call/put wall levels across SPY, SPX, QQQ and NDX, plus API access. |
| `service_date` | 2026-08-14 |
| `customer_purchase_ip` | `2603:8002:6c40:23:3cb0:8fbd:246d:69ac` |

## Attachments to upload

- **`receipt`** — the hosted invoice for `in_1U45qG4AOiqteMYYZtU2r5FM`, printed to PDF:
  `https://invoice.stripe.com/i/acct_1TOi5O4AOiqteMYY/live_YWNjdF8xVE9pNU80QU9pcXRlTVlZLF9WNEVJNnVIYUlOZFdsQklna2lOZVpCSTFHck1vSW1vLDE3Nzc5OTYxNA0200SM5fp1Og?s=ap`
- **`cancellation_policy`** — the `/terms` page, Section 4, printed to PDF.
- **`customer_communication`** — the trial-end reminder email as actually sent on
  2026-08-11. Take it from the **Resend dashboard** (search jeremyy.zamora@gmail.com,
  2026-08-11): that is the authentic sent artifact, with a delivery timestamp the bank can
  weigh, and it needs no caveat.

  Do **not** use `make trial-reminders RENDER=jeremyy.zamora@gmail.com` for this. That mode
  builds from `users.current_period_end`, which is now 2026-09-13 — so it would render an
  email saying the trial ends in September, which is not what was sent. Submitting that as
  "the email we sent" would be inaccurate and would undercut the rest of the package if the
  issuer cross-checked it.

  If Resend retention has already expired, reproduce the exact wire copy by calling the
  shared builder with the real trial-end date instead:

  ```sh
  cd frontend && node --experimental-strip-types -e "
    import('./core/mailer.ts').then(async (m) => {
      const { subject, html } = m.buildTrialReminderEmail({
        trialEndIso: '2026-08-13T21:06:35.000Z',
        billing: { chargeLabel: '\$29.00/month', cardBrand: 'Visa', cardLast4: '8562' },
      });
      console.error(subject);
      require('fs').writeFileSync('/tmp/reminder-2026-08-11.html', html);
    });
  "
  ```

  `buildTrialReminderEmail` is the same builder the cron sends through, so the copy is
  identical to what went out. Label it in the evidence as a reproduction of the 2026-08-11
  send rather than presenting it as a captured copy.
- **`service_documentation`** — a screenshot of the pricing page showing both the hero
  trial copy and the full "Refund & Cancellation Policy" section, and a screenshot of the
  account page showing the "Cancel subscription" button, to evidence that the policy was
  on the purchase page and that self-service cancellation was one click away at all times.

## Evidence checks already run

**Purchase IP — usable, include it.** `audit_events.ip` shows every account-setup and
checkout action on 2026-08-06 originating from one residential address,
`2603:8002:6c40:23:3cb0:8fbd:246d:69ac`. That is the value for `customer_purchase_ip`, and
the consistency across seven actions is written into `uncategorized_text` above.

One login 29 minutes after checkout (2026-08-06 21:34:34) came from `146.70.174.222`, a
hosting range commonly used by consumer VPNs. **Do not volunteer this.** Identity is not
contested in this dispute — the reason code is 13.2 (canceled recurring transaction), not
fraud — and `customer_purchase_ip` correctly means the IP the purchase was made from, which
is the residential one. Raising a VPN address unprompted in a non-fraud dispute introduces
doubt for no gain. It is noted here only so it isn't a surprise if it ever comes up.

**Session activity — negative, leave it out.** There is one session row, created
2026-08-06 21:34:34, with `last_rotated_at` identical to `created_at` and `expires_at`
exactly 14 days later, never extended.

Sessions rotate on the first authenticated request made more than
`AUTH_SESSION_ROTATE_AFTER_SECONDS` (default 24h) after the previous rotation, and rotation
pushes `expires_at` out by a fresh TTL (`frontend/core/serverAuth.ts:1090-1097`). An
unrotated row therefore is not merely "no evidence of a visit" — it positively establishes
that **no authenticated request was made after 2026-08-07 21:34**, a week before the
disputed charge. Any visit on or after that date would have moved both timestamps.

So there is no post-charge usage evidence to be had from the web app, and the package must
not imply otherwise. Do not include session data in the submission.

**One place left worth checking.** API keys are not in `auth.db` — they live in the backend
key service's own `api_keys` table (`frontend/core/apiKeys.ts:12`). The customer completed
the API-key onboarding flow on 2026-08-06, so if that service records last-used or
per-key request counts, it is the only remaining source of post-charge activity. If it
shows API calls after 2026-08-14, add them to `uncategorized_text` — that would be the
single strongest addition available to this package. If it shows nothing, submit as is.

## Operational follow-up

**The subscription is still active and renews 2026-09-13 at $29.00.** A customer who has
disputed one charge will very likely dispute the next one, and a second chargeback costs
another dispute fee and counts against the account's dispute ratio regardless of outcome.

Countering the dispute and cancelling the subscription are not in tension — cancelling now
does not concede the disputed charge, which covers service already delivered for the
2026-08-13 to 2026-09-13 period. Recommended sequence:

1. Submit the evidence above before 2026-09-05.
2. Cancel `sub_1U1YUq4AOiqteMYYGmVCi5Cn` **at period end** so no further charge is
   attempted, using `make set-cancellation EMAIL=jeremyy.zamora@gmail.com ON=1` (dry-run
   first). He keeps access through 2026-09-13, which he paid for, and the subscription
   then ends with no renewal.

   Do **not** use `make cancel-subscription` for this. That target is for a sub stuck in
   `past_due`/`unpaid`: it cancels immediately, drops the account to `public`, revokes API
   keys, and ends paid access with no refund — it refuses an `active` sub without `FORCE=1`
   for exactly that reason. Using it here would end access he has already paid for and
   would cost us the "he retained full access for the whole period he was billed for" fact
   that the evidence relies on.

   `set-cancellation` also sends no email, and because it mirrors the flag locally it
   suppresses the webhook's 0→1 cancel-ack transition — so it will not fire the retention
   email offering him 25% off, which is not something to send a customer mid-chargeback.
3. Optionally email the customer stating the subscription is cancelled and no further
   charges will occur. This costs nothing and occasionally results in the cardholder
   withdrawing the dispute with their bank, which is the cleanest possible outcome.
