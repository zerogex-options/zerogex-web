# Automated Emails — Full Audit

> Status: **draft in progress.** Infrastructure, idempotency, and copy sections are
> complete and verified against source. Trigger/activation and per-script cohort
> sections are being finalized.

Every automated email ZeroGEX sends, with its copy, its trigger, how it runs on the
server, and how it is activated. Line references are to the current `release`-lineage
tree.

---

## 1. Sending infrastructure

All mail is sent through **[Resend](https://resend.com)**. There is no SMTP, no
SES, no queue — every send is a direct `resend.emails.send({ from, to, subject, text, html })`
HTTPS call made from the Node process that decides to send it.

- **Template layer:** `frontend/core/mailer.ts` — one exported `async` function per
  email type (~20 of them). Each builds a `subject`, a plain-`text` body, and an
  `html` body, then calls Resend. On a Resend error the function throws
  `Error(`Resend error: ${result.error.message}`)`.
- **Client:** a lazily-cached `Resend` instance (`getClient()`), created from
  `RESEND_API_KEY`. Throws if the key is missing.
- **From address:** `getFromAddress()` reads `RESEND_FROM_EMAIL` (throws if unset).
- **App URLs** in links come from `NEXT_PUBLIC_APP_URL` (falls back to
  `http://localhost:3000`).
- **XSS hardening:** all interpolated user/dynamic values pass through `escapeHtml()`.
- Two **one-off billing-credit scripts** (`back-credit-trial.mts`,
  `credit-founders-july1-delay.mts`) construct their own Resend client and their own
  email HTML inline rather than going through `mailer.ts`.

### Shared building blocks in `mailer.ts`

- **Folds of Honor footer** (`renderFohFooterHtml` / `renderFohFooterTextLines`):
  a compact "ZeroGEX is a Folds of Honor Proud Supporter… 3% of every subscription…"
  block. **Deliberately appended only to positive subscriber-facing emails**
  (referral reward, paid/founding welcome, welcome-back, payment recovered) and
  **omitted from urgent/transactional ones** (verify, password reset, payment failed,
  checkout recovery) so those read urgent, not decorated.
- **`TRIAL_START_HERE`** — the shared "start here" card list (Today's Read, GEX Strike
  Profile, Gamma Flip, Call/Put Wall, Net GEX, SPY/SPX/QQQ/NDX). Reused by the trial
  welcome and the trial-quickstart bridge so onboarding guidance stays in lockstep.
- **`TRIAL_DISCLAIMER_LINE`** — the "not financial advice / no guaranteed outcome"
  framing carried verbatim by every trial-facing email.
- **`API_KEY_STEPS` / `API_KEY_INTRO`** (`apiKeyTextLines` / `apiKeyHtmlBlock`) — the
  three-step self-service API-key walkthrough (open Account → API Access, click
  Generate API Key and copy the one-time secret, send it as
  `Authorization: Bearer <key>`) plus a deep link to `/account#api-access`. Carried by
  **both Pro welcome emails** (paid/trial and founding), since key generation is a Pro
  benefit (`isApiKeyEligibleTier`), and by the **welcome-back** email under a
  different intro (`API_KEY_INTRO_RETURNING`): dropping below Pro revokes every key
  the account held (`revokeApiKeysIfTierDropped`), so a resubscriber's old scripts and
  NinjaTrader charts are authenticating with a dead key and need a fresh one. The in-app Pro welcome modal
  (`components/ProWelcomeModal`) announces the same thing but fires once and is
  dismissed for good, so the email is the durable copy. Keep in sync with the modal and
  the account page's API Access section (`components/AccountApiKeys`). Covered by
  `tests/welcomeEmailApiKey.test.ts` (`npm run test:welcome-api-key`), which renders the
  real emails against a stubbed Resend transport.
- **`formatTrialEndDate`** — formats dates in **America/New_York**, so a displayed
  deadline never drifts off-by-one near midnight UTC.
- **`describeTrialLength(trialDays)`** — renders the trial-length phrase the welcome
  opens on (`"30-day free trial"`). A missing or implausible count (non-finite, `< 1`,
  `> 365`) degrades to a bare `"free trial"` rather than guessing: that phrasing is
  true for every trial length, whereas a wrong day count is a billing promise the
  trial-end date in the next sentence would immediately contradict.

### Signed unsubscribe tokens

`frontend/core/unsubToken.ts` mints stateless HMAC unsubscribe tokens
(`unsubToken`/`verifyUnsubToken`/`buildUnsubUrl`) keyed on the user id, using
`ZEROGEX_END_USER_TOKEN_SECRET`. Used by the marketing sends (reactivation,
product-update) so the `/unsubscribe` route can verify a link with no DB lookup and
nobody can forge an opt-out for another account.

---

## 2. Idempotency, gating & opt-out system

Most non-transactional emails are **latched once-per-account** in the SQLite auth DB
(`frontend/core/db.ts`, applied via `ensureColumn` migrations at boot). This is what
stops a cron re-firing the same email every run. Verified list of latch columns:

| Column | Email it gates | Set when | Cleared when |
|---|---|---|---|
| `paid_welcome_email_sent_at` | Trial/paid welcome | first paid checkout | never (see `subscription_lapsed`) |
| `trial_reminder_email_sent_at` | 48h-before-trial-end reminder | reminder sent | on each fresh `trialing` window (re-arms per trial) |
| `trial_converted_email_sent_at` | Trial-conversion confirmation | trial's first real charge clears | **never** (a paid account never gets a second trial) |
| `checkout_recovery_email_sent_at` | Abandoned-checkout nudge | nudge sent | **never** (permanent one-shot) |
| `verified_never_paid_email_sent_at` | ~2h "try the trial" nudge | nudge sent | **never** |
| `reactivation_email_sent_at` | ~3-week extended-trial nudge | nudge sent | **never** |
| `verify_reminder_email_sent_at` | "finish verifying" nudge | nudge sent | **never** |
| `founding_final_call_email_sent_at` | Founding final-call | email sent | **never** (deadline crosses once) |
| `cancel_ack_email_sent_at` | Cancellation acknowledgment | Stripe flips `cancel_at_period_end`→true | on reactivation (re-cancel can re-fire) |
| `winback_email_sent_at` | ~1-month-after-churn win-back | win-back sent | on welcome-back (`subscription_lapsed` 1→0) |
| `marketing_unsubscribed_at` | **opt-out** — excludes from marketing sends | user unsubscribes | (opt back in only manually) |

Two **flags** (not timestamps) drive the dunning/welcome logic:

- **`payment_recovery_pending`** (0/1): set to 1 when a sub enters `past_due`;
  CAS-consumed back to 0 — firing the **payment-recovered** email — on the next sync
  back to `active`. So recovery mail fires only after a real failure, never on an
  ordinary renewal, and re-arms for the next failure. Also cleared on
  `customer.subscription.deleted`.
- **`subscription_lapsed`** (0/1): set to 1 on subscription deletion, cleared to 0
  when the welcome-back fires. Discriminates "canceled then came back" (welcome-back)
  from "upgrading in place" (silent).
- **`payment_grace_started_at`**: anchors the `BILLING_PAYMENT_GRACE_DAYS` grace
  window so an established sub keeps its paid tier through Stripe's Smart Retries
  instead of dropping to Public on the first failed renewal. (Trial-conversion
  failures get no grace.)

Other gates that are **not** DB latches:

- **Payment-failed** email is gated in the webhook by `invoice.attempt_count === 1`
  so it does not re-fire on each Stripe Smart Retry.
- **Trial-conversion** emails (both the confirmation and its dunning bookend) are
  gated by `isTrialConversionInvoice` in `core/trialDunning.ts` — a pure predicate
  that identifies the conversion charge as "a `subscription_cycle` invoice created
  within ~2 days of `trial_end`". `invoice.paid` / `invoice.payment_failed` fire on
  every renewal too, so this classification is what keeps both emails off
  established members. Both branches share the one predicate so a conversion that
  clears and one that declines can never be classified differently.
- **Referral reward** is gated by the `referrals` ledger row walking
  `pending → rewarded` (a user can only be referred once — `UNIQUE referee_user_id`).
- **TradeWorkz alerts** are gated by rows in the `tw_notifications_log` table
  (one send per queued `channel='email'` row).
- **`deleted_at`** (soft-deleted accounts) are excluded from all outbound email.

---

## 3. Email catalog — copy reference

Grouped by purpose. Subject lines are verbatim; bodies are summarized with key
verbatim phrasing. All are founder-voice ("Michael, Founder, ZeroGEX") except the
auth/transactional and TradeWorkz alerts.

### 3.1 Auth / transactional

**Email verification** — `sendEmailVerification(to, verifyUrl)`
- **Subject:** `Verify your ZeroGEX email`
- Body: "Welcome to ZeroGEX! Please confirm this email address… Verification is
  required before you can subscribe to a paid plan." Button + raw URL. "This link
  expires in 24 hours." No FOH footer.

**Password reset** — `sendPasswordResetEmail(to, link)`
- **Subject:** `Reset your ZeroGEX password`
- Body: "Someone requested a password reset…" Button + raw URL. "This link expires in
  30 minutes and can only be used once." No FOH footer.

### 3.2 Trial & subscription welcome

**Trial / paid welcome** — `sendPaidWelcomeEmail(to, { trialEndIso?, trialDays?, promoIntroLabel? })`
- **Subject:** `Your ZeroGEX trial is active` (trial) **or** `Thank you for subscribing to ZeroGEX!` (immediate paid)
- Trial branch avoids "thank you for subscribing" (a trialer hasn't paid). Includes the
  **trial length** and trial-end date, cancel-anytime language, an optional **promo
  intro-rate** line, the shared "start here" list + dashboard CTA, the disclaimer line,
  the shared **API-key walkthrough** (after the disclaimer, so the dashboard stays the
  primary CTA), a founder note, a P.S. linking `/updates`, and the FOH footer.
- **The trial is not always 7 days.** `trialDays` carries the real length, which the
  webhook measures off the subscription's own window (`trial_start` → `trial_end`)
  rather than assuming `TRIAL_PERIOD_DAYS`: a cold signup returning through the
  reactivation email's `?reactivate=1` link checks out with the extended
  `REACTIVATION_TRIAL_DAYS` (default 30), and an operator can restore a hand-picked
  window with `restore-trial-after-switch.mts`. The copy renders "Your 30-day free
  trial is now active" for that member — hard-coded "7-day" copy used to promise a
  charge three weeks before the date printed in the very next sentence. Covered by
  `tests/trialWelcome.test.ts` (`npm run test:trial-welcome`).

**Founding welcome** — `sendFoundingWelcomeEmail(to, { trialEndIso? })`
- **Subject:** `Thank you for subscribing to ZeroGEX!`
- "As a Founding Member your rate is locked in for the first year, and the 25% lifetime
  discount applies automatically after that." Deferred-charge trial line when present.
  Shared **API-key walkthrough** (founding members are Pro, so they're key-eligible too).
  FOH footer.

**Trial quickstart bridge** — `sendTrialQuickstartEmail(to, { trialEndIso? })`
- **Subject:** `Getting the most out of your ZeroGEX trial`
- One-time bridge for users who were mid-trial before the activation-focused welcome
  shipped. Same "start here" guidance + disclaimer, without repeating billing mechanics.
  FOH footer. (Sent manually as a one-shot — not webhook-wired.)

**Welcome back (resubscribe)** — `sendWelcomeBackEmail(to)`
- **Subject:** `Welcome back to ZeroGEX!`
- "Your full access has been restored…" Shared **API-key walkthrough** under the
  returning-member intro — their prior key was revoked on the tier drop, so this is a
  repair notice, not a feature announcement. FOH footer.

### 3.3 Trial-end & billing / dunning

**48h trial-end reminder** — `sendTrialReminderEmail(to, { trialEndIso, promoIntroLabel?, billing? })`
- **Subject:** `Your ZeroGEX free trial ends in 2 days`
- Courtesy heads-up before auto-conversion. When `billing` is resolved from Stripe it
  names the exact charge + card ("Your subscription will begin at $X/month using your
  Visa card ending in 1234"). Manage-subscription CTA. No FOH footer.

**Trial-conversion confirmation** — `sendTrialConvertedEmail(to, { amountFormatted?, cardBrand?, cardLast4?, nextChargeIso?, fullyCredited? })`
- **Subject:** `Your ZeroGEX trial just became a full membership`
- Fired from the Stripe webhook's `invoice.paid` when a trial's **first real charge
  clears** — the success bookend to `sendTrialConversionFailedEmail`. Names what was
  actually collected (`amount_paid`, so an applied referral credit is reflected) and
  the card it came off, the next charge date, and the account page for invoices /
  card / cancel. Deliberately short: the start-here guidance shipped with the trial
  welcome and the billing mechanics with the 48h reminder, so this only confirms the
  charge. `fullyCredited` (a $0 conversion invoice, i.e. a banked referral month
  covered it) switches the copy so it never claims a payment was taken. FOH footer.
- Pure builder `buildTrialConvertedEmail` + thin sender, locked down in
  `tests/trialConverted.test.ts`.

**Payment failed** — `sendPaymentFailedEmail(to, { amountFormatted?, cardBrand?, cardLast4?, nextAttemptIso?, graceUntilIso? })`
- **Subject:** `We couldn't process your ZeroGEX payment`
- Names the failed card, states the access state (grace window vs. dropped to Public),
  gives Stripe's next retry date, links the billing portal. Each enrichment degrades to
  neutral wording if unresolved. No FOH footer (urgent).

**Payment recovered** — `sendPaymentRecoveredEmail(to)`
- **Subject:** `You're all set — your ZeroGEX payment went through`
- Reassurance bookend to payment-failed. Dashboard CTA. FOH footer.

**Referral reward** — `sendReferralRewardEmail(to, { kind: 'credited'|'banked', amountFormatted?, accountUrl })`
- **Subject:** `🎉 You earned a free month on ZeroGEX`
- `credited` = immediate Stripe balance credit; `banked` = applied next time they
  subscribe. FOH footer.

### 3.4 Conversion nudges

**Checkout recovery** — `sendCheckoutRecoveryEmail(to, { foundingDeadlineLabel, promoDeadlineLabel?, promoPricing? })`
- **Subject (3 variants):** founding → `Your ZeroGEX founding rate is still available — only until {date}`; promo → `Your ZeroGEX limited-time offer is still open — only until {date}`; plain → `Pick up where you left off at ZeroGEX`
- Founding wins precedence over promo. All variants link to `/pricing`. No FOH footer.

**Founding final call** — `sendFoundingFinalCallEmail(to, { deadlineLabel, foundingHref, billingStartLabel, pricing? })`
- **Subject:** `Final reminder: ZeroGEX founding rate closes tomorrow, {deadlineLabel}`
- Punchy urgency closer with live Basic/Pro intro vs. list pricing + lifetime %-off
  bullets (drops figures if Stripe pricing unavailable). No FOH footer.

**Verify reminder** — `sendVerifyReminderEmail(to, verifyUrl)`
- **Subject:** `Finish setting up your ZeroGEX account`
- For users who registered but never clicked verify. Freshly-minted 24h verify link;
  copy is about verification (which unlocks checkout + trial), not a discount.

**Verified, never paid** — `sendVerifiedNeverPaidEmail(to)`
- **Subject:** `Quick note from Michael at ZeroGEX`
- Founder note to verified signups who never opened checkout; pitches the 7-day trial,
  no discount. Links `/pricing?trial=1`.

**Reactivation (extended trial)** — `sendReactivationEmail(to, { trialDays, unsubUrl })`
- **Subject:** `I extended your ZeroGEX free trial to {trialDays} days`
- Second-touch for cold signups; the *offer* is a longer trial (granted server-side at
  `?reactivate=1`), no discount. Carries a real marketing unsubscribe footer **and** the
  one-click `List-Unsubscribe` / `List-Unsubscribe-Post` headers (RFC 8058).

### 3.5 Retention / churn

**Cancellation acknowledgment** — `sendCancellationEmail(to, { periodEndIso })`
- **Subject:** `Sorry to see you go — mind sharing why?`
- Fires at the click-Cancel moment (still has access until period end). Asks why,
  offers 25% off for a year via manual "reply 'discount'" fulfillment. No FOH footer.

**Win-back** — `sendWinbackEmail(to, opts)` / `renderWinbackEmail(opts)`
- **Subject (3 variants):** auto → `A lot has changed at ZeroGEX — and your discount's ready`; promo → `Your ZeroGEX intro rate is open again — through {date}`; manual → `A lot has changed at ZeroGEX since you left`
- ~1 month after a sub actually lapses. Discount precedence **auto > promo > manual**.
  "What's new" bullets come from `content/winback-highlights.json` (falls back to
  `DEFAULT_WINBACK_HIGHLIGHTS`). Plain-language opt-out footer pointing at self-service
  account deletion.

**Win-back founder digest** — `sendWinbackDigestEmail(to, { recipients, mode, sendCommand, draft })`
- **Subject:** `[ZeroGEX] Win-back review — N churned members ready (mode)`
- Weekly "here's exactly who it would go to + the rendered draft" review email to the
  founder. **Sends nothing to users** — the real send is a separate `make winback YES=1`.

**Reactivation founder digest** — `sendReactivationDigestEmail(to, { recipients, sendCommand, trialDays, draft })`
- **Subject:** `[ZeroGEX] Reactivation review — N cold signups ready (N-day trial)`
- Pre-send review digest, mirrors the win-back digest.

**Cancellation alert (operator)** — `sendCancellationAlertEmail(to, alert)`
- **Subject:** `[ZeroGEX] <email> canceled — <what they typed>` (falls back to the survey
  label, then `no reason given`)
- Fires from `frontend/scripts/send-cancellation-alerts.mts` / `make cancellation-alerts`,
  driven every 15 minutes by `zerogex-web-cancellation-alerts.timer`. **Sends nothing to
  users** — one email to the operator per churn event, carrying the Stripe cancellation
  survey (`cancel_feedback` label + verbatim `cancel_comment`), tenure, the save-window
  deadline, and the `make diagnose-user` / `save-url` / `honor-winback-discount` commands
  pre-filled with the address.
- Alerts on **both** churn rows, which mean different things: `stripe_cancellation_requested`
  (they clicked Cancel and **still have access** — the only window in which a reply can
  save them) and `stripe_subscription_deleted` (access is gone).
- **Sweeper, not a webhook send**, on purpose: the alert is derived from `audit_events`, so
  a failed send simply isn't latched and the next tick retries it, and history is
  backfillable with `SINCE=`. Idempotency is a `cancellation_alert_sent` audit row keyed
  to the churn event's own audit id (`alert_for=<id>`), so a cancel → reactivate → cancel
  alerts twice while a re-run alerts zero more times.
- No Folds of Honor footer, no unsubscribe — internal operational mail.

### 3.6 Product / ops / receipts

**Product-update newsletter** — `frontend/scripts/send-product-update.mts` (inline copy from `docs/newsletters/2026-07-*.{html,txt}`)
- **Subject (subscribers):** `What's new at ZeroGEX — and what's coming next`
- **Subject (registrants):** `Your ZeroGEX account is ready — start with the free levels`
- Founder-voice "What's new / What's coming next" product announcement. Per-recipient
  send, invisible `List-Unsubscribe` header, honors `marketing_unsubscribed_at`.

**TradeWorkz bot alert** — `sendTradeworkzNotification(to, { botId, botDisplayName, eventType, payload, dashboardUrl? })`
- **Subject:** dynamically built, e.g. `{Bot} closed LONG SPY +$1.20K (+8.3%)` /
  `{Bot} opened SHORT SPY · 5 contracts @ $4.20`
- Short entry/exit/add/cut/stopped/target alert with a structured detail table, win/loss
  chip, and dashboard CTA. Footer: "You are receiving this because you followed this bot
  on TradeWorkz™."

**One-off: trial back-credit** — `back-credit-trial.mts` (inline copy)
- **Subject:** `A small credit on your ZeroGEX account`
- Notifies a pre-trial monthly subscriber they were credited ~7/31 of a month.

**One-off: founding July-1 delay credit** — `credit-founders-july1-delay.mts` (inline copy)
- **Subject:** `A credit on your ZeroGEX Founding Member account`
- Notifies a founder they were credited one month at the founding rate ($12 Basic /
  $19 Pro) to match the deferred-first-payment change.

**Quarterly Folds of Honor receipt** — `quarterly-receipt.mts` / `make quarterly-receipt`
- Not a customer email. An **interactive, calendar-triggered** (not cron) publish loop
  that updates the giving ledger and prints a tweet draft. Optional `EMAIL=` flag mails
  the tweet draft to the operator. See `docs/quarterly-receipt-workflow.md`.

---

## 4. Triggers & activation

_(Being finalized from the in-flight investigations: exact cron/Makefile scheduling,
per-Stripe-event webhook mapping, and per-script cohort queries.)_
