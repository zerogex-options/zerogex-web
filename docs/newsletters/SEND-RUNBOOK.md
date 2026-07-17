# July 2026 Product Update — Send Runbook

Two audiences, two email files, one cohort script. The actual send goes out
through **Resend Broadcasts** (the emails use `{{{RESEND_UNSUBSCRIBE_URL}}}`,
which only Broadcasts resolve, and Broadcasts manage the unsubscribe/suppression
list for CAN-SPAM). The cohort script never sends the broadcast — you review and
click **Send** in Resend. That review is the intended gate on a mass send.

| Audience | Who | Files | Subject |
|---|---|---|---|
| `subscribers` | Active + trialing customers (`subscription_status IN ('active','trialing')`) | `2026-07-product-update.html` / `.txt` | What's new at ZeroGEX — and what's coming next |
| `registrants` | Signed up ≤30d, verified email, logged in (has authenticated page-view activity), never subscribed, **and not already sent the verified-never-paid nudge** (no double-touch) | `2026-07-product-update-registrants.html` / `.txt` | Your ZeroGEX account is ready — start with the free levels |

## Prerequisites (production)

- Run from `frontend/` in the environment that has the real `auth.db`
  (`AUTH_DB_PATH`), with `RESEND_API_KEY` + `RESEND_FROM_EMAIL` set (or in
  `.env.local`). `sqlite3` CLI on PATH (`sudo apt-get install sqlite3`).
- Resend sending domain (zerogex.io) verified.
- **Header image live**: the emails reference
  `https://zerogex.io/email/zerogex-header.png` — deploy so it serves, or upload
  the PNG in Resend and swap the `LOGO-IMG` src.

## Steps (repeat per audience)

1. **Count the cohort**
   ```
   node --experimental-strip-types scripts/send-product-update.mts --audience subscribers --dry-run
   node --experimental-strip-types scripts/send-product-update.mts --audience registrants --dry-run
   ```
   The registrant cohort already **excludes** anyone the automated
   *verified-never-paid* nudge reached; the dry-run reports how many were
   excluded for that reason.

2. **Preview to yourself** (real inbox, desktop + phone)
   ```
   node --experimental-strip-types scripts/send-product-update.mts --audience subscribers --preview-to Michael@zerogex.io
   ```

3. **Create a Resend Audience** for the campaign (e.g. "Product Update Jul 2026 — subscribers").

4. **Stage the cohort** into that audience:
   ```
   node --experimental-strip-types scripts/send-product-update.mts --audience subscribers --sync-to-audience <audienceId>
   ```
   (or `--csv subscribers.csv` and import the CSV in the Resend UI.)

5. **Create the Broadcast** in Resend → select the audience → From
   `ZeroGEX <you@zerogex.io>`, Reply-To `Michael@zerogex.io`, the subject above →
   paste the `.html` as the HTML body and the `.txt` as the plain-text body.
   Resend injects the unsubscribe link automatically.

6. **Send a Resend test** from the Broadcast composer; review once more.

7. **Send** (or schedule). Resend handles unsubscribe + suppression.

## Notes / decisions

- **No double-touch:** the registrant cohort excludes anyone the automated
  `send-verified-never-paid` cron already emailed. That cron keeps running, so if
  you want a clean split, consider pausing its timer while this campaign is out.
- **"Logged in"** is proxied by authenticated page-view activity (there is no
  `last_login` column). Adjust the cohort query if you want a stricter/looser
  signal.
- **Verified addresses only:** the registrant cohort already requires
  `email_verified_at`; subscribers are verified by definition. Don't send to
  unverified accounts (protects sender reputation).
- One-shot manual broadcast — no DB latch is written; Resend won't double-send
  within a broadcast, and re-running `--sync-to-audience` dedupes contacts.
