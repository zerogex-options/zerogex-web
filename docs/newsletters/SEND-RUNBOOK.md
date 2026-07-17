# July 2026 Product Update — Send Runbook

Sent **directly, per-recipient, from the server** via Resend (`emails.send`) with
`scripts/send-product-update.mts`. No unsubscribe link in the email body (by
request); the script attaches an invisible `List-Unsubscribe` header for
deliverability (disable with `--no-list-unsubscribe`, not recommended).

| Audience | Who | Files | Subject |
|---|---|---|---|
| `subscribers` | Active + trialing customers (`subscription_status IN ('active','trialing')`) | `2026-07-product-update.html` / `.txt` | What's new at ZeroGEX — and what's coming next |
| `registrants` | Signed up ≤30d, verified, logged in, never subscribed, not already sent the verified-never-paid nudge | `2026-07-product-update-registrants.html` / `.txt` | Your ZeroGEX account is ready — start with the free levels |

## Prerequisites (run in production, from `frontend/`)

- Real `auth.db` reachable (`AUTH_DB_PATH`), `RESEND_API_KEY` + `RESEND_FROM_EMAIL`
  set (or in `frontend/.env.local`), Resend sending domain verified, `sqlite3`
  CLI installed.
- `ZEROGEX_END_USER_TOKEN_SECRET` and `NEXT_PUBLIC_APP_URL` set — used to sign the
  per-recipient unsubscribe links.
- **Deploy first.** It (a) serves the header image at
  `https://zerogex.io/email/zerogex-header.png` (otherwise the logo is broken),
  (b) runs the DB migration that adds `users.marketing_unsubscribed_at`, and
  (c) publishes the `/unsubscribe` route the footer link and one-click header
  point to. The send script reads `marketing_unsubscribed_at`, so it must exist.

## Send to subscribers

```
cd frontend

# 1. See the count + a sample (nothing sent)
node --experimental-strip-types scripts/send-product-update.mts --audience subscribers --dry-run

# 2. Send one preview to yourself; open on desktop + phone
node --experimental-strip-types scripts/send-product-update.mts --audience subscribers --preview-to Michael@zerogex.io

# 3. Small live test batch (first 5 real recipients)
node --experimental-strip-types scripts/send-product-update.mts --audience subscribers --send --yes --limit 5

# 4. Send to everyone remaining
node --experimental-strip-types scripts/send-product-update.mts --audience subscribers --send --yes
```

`--send` requires `--yes`. The script stamps `audit_events(type='product_update_2026_07_sent')`
per successful send, so re-running (including after the `--limit 5` test) skips
anyone already emailed — an interrupted run resumes cleanly.

## Send to registrants (later)

Same command with `--audience registrants` — or export the cohort and send from
the Resend UI:

```
node --experimental-strip-types scripts/send-product-update.mts --audience registrants --csv registrants.csv
```

## Notes

- **Throttle:** `--throttle-ms` (default 550ms ≈ 1.8/s) stays under Resend's rate
  limit; 429s are retried with backoff automatically.
- **Idempotency key:** `product_update_2026_07`. One-shot campaign.
- **Verified only:** the registrant cohort requires `email_verified_at`;
  subscribers are verified by definition.
