.PHONY: help install dev build rebuild start stop restart logs status users referrals migrate migrate-tiers all-to-pro delete-user seed-founders grant-founding activate-late-founder clear-zombie-customers webhook-health trial-reminders verified-never-paid verify-reminders winback public-cohort cancellations diagnose-user grant-partner-pro revoke-partner partner-grant-expiry partner-commissions backup-monitoring backup-auth clean deploy logo blog-images

# Default target
help:
	@echo "ZeroGEX Web - Available Commands:"
	@echo ""
	@echo "  make install    - Install dependencies"
	@echo "  make dev        - Run development server"
	@echo "  make build      - Build for production"
	@echo "  make rebuild    - Clean build and restart PM2"
	@echo "  make start      - Start PM2 process"
	@echo "  make stop       - Stop PM2 process"
	@echo "  make restart    - Restart PM2 process"
	@echo "  make logs       - View PM2 logs (live)"
	@echo "  make status     - Check PM2 status"
	@echo "  make users      - Print auth users + entitlements (TIER=Admin|Pro|Basic, AUTH=L|G|A, PAID=yes, TRIAL=yes, EMAIL_ONLY=yes)"
	@echo "                    Founder column: E=eligible, R=redeemed (intro 12mo), L=lifetime 25% off"
	@echo "  make referrals  - Print the referral ledger + per-referrer summary (signups, rewards, banked months)"
	@echo "  make migrate    - Force the auth DB's lazy migration to run now (use after --start-from <step> deploys that add new columns)"
	@echo "  make migrate-tiers - Migrate legacy starter/elite users to basic/pro (DRY_RUN=1 to preview)"
	@echo "  make all-to-pro - Promote every non-admin user to pro (DRY_RUN=1 to preview)"
	@echo "  make delete-user EMAIL=<email> - Delete a user (DRY_RUN=1 to preview, YES=1 to skip prompt)"
	@echo "  make seed-founders - Flag current users as founding_eligible (DRY_RUN=1 to preview, YES=1 to apply, BEFORE=<iso> for cutoff)"
	@echo "  make grant-founding EMAIL=<email> [GRANT_FOUNDING_TIER=pro] - Manual founding comp: set tier + founding_eligible=1 in one shot (DRY_RUN=1 to preview)"
	@echo "  make activate-late-founder EMAIL=<email> [TIER=basic|pro] [CADENCE=monthly|annual] [TRIAL_DAYS=N|TRIAL_END=<iso>] - Mint a founding-rate Stripe Checkout link for a member who missed the July-1 deadline (DRY_RUN=1 to preview, YES=1 to mint)"
	@echo "  make clear-zombie-customers - NULL stripe_customer_id on rows with no subscription (APPLY=1 to write, dry-run by default)"
	@echo "  make webhook-health - Stripe webhook health summary (errors/orphans/failed payments, last 24h + 7d)"
	@echo "  make trial-reminders - Send ~48h-before-trial-end reminder emails (DRY_RUN=1 to preview, YES=1 to send, PREVIEW_TO=<email> for a sample)"
	@echo "  make verified-never-paid - Send the founder-voice trial-nudge to users who signed up + verified but never opened checkout (DRY_RUN=1 to preview, YES=1 to send, PREVIEW_TO=<email> for a sample, LAG_HOURS=<n> to override the 2h default)"
	@echo "  make verify-reminders - Send the founder-voice 'finish verifying to unlock the trial' nudge to users who signed up but never confirmed their email (mints a fresh 24h verify link; DRY_RUN=1 to preview, YES=1 to send, PREVIEW_TO=<email> for a sample, LAG_HOURS=<n> to override the 2h default)"
	@echo "  make winback - Send the ~1-month-after-churn win-back email to lapsed subscribers (what's new + a discount, no pressure; DRY_RUN=1 to preview, YES=1 to send, PREVIEW_TO=<email> for a sample, PREVIEW_MODE=auto|promo|manual to force a variant, LAG_DAYS=<n>/LOOKBACK_DAYS=<n> to override the 30d/60d window)"
	@echo "  make grant-partner-pro EMAIL=<email> [DAYS=90] [COMMISSION_BPS=3000] [WINDOW_MONTHS=12] [PROMO_CODE=...] [COUPON_ID=...] [DISCLOSURE_URL=...] - Activate a Creator Partner: flips partner_tier='creator', stamps Pro grant, registers the Stripe promotion_code (DRY_RUN=1 to preview, YES=1 to apply)"
	@echo "  make revoke-partner EMAIL=<email> [KEEP_STRIPE_PROMO=1] - Wind down a Creator Partner: clears partner_* state, deactivates the Stripe promo code, downgrades tier if no paying sub. Keeps referral_code + accrued commission ledger. (DRY_RUN=1 to preview, YES=1 to apply)"
	@echo "  make partner-grant-expiry - Sweep expired Creator Partner Pro grants and downgrade to public (DRY_RUN=1 to preview, YES=1 to apply). Driven daily by systemd timer; this target is the same thing the timer fires."
	@echo "  make partner-commissions [EMAIL=<partner>] [FULL=1] [STATUS=accrued|paid|reversed] - Print the Creator Partner commission ledger: per-partner totals and (with --full) full row-by-row view. Use at month-end to figure out payouts."
	@echo "  make public-cohort - Break the tier='public' cohort into reactivation segments (EMAILS=1 for paste-ready lists, COHORT=<key> to filter, SHOW_LAST_LOGIN=1 to split warm/cold/never, WARM_DAYS=<n> to tune, SINCE=<YYYY-MM-DD> to filter to signups on/after a date)"
	@echo "  make cancellations - List customers who cancelled and when (pending = clicked Cancel, still has access; lapsed = subscription ended). STATUS=pending|lapsed to filter, EMAILS=1 for a recipient list, CSV=1 to export, SINCE=<YYYY-MM-DD> for cancellations on/after a date"
	@echo "  make diagnose-user EMAIL=<email> - Read-only dump of one user: DB row, last 20 audit events, live Stripe customer/subscription/invoices, and notes on whether the July-1 founding deferral applied"
	@echo "  make backup-monitoring - Backup Admin->Monitoring JSON data (S3_BUCKET=s3://... optional)"
	@echo "  make backup-auth - Online backup of the SQLite auth DB (S3_BUCKET=, BACKUP_GPG_RECIPIENT= optional)"
	@echo "  make clean      - Remove build artifacts"
	@echo "  make deploy     - Full deployment (pull, install, rebuild)"
	@echo "  make logo       - Copy logos from assets to public"
	@echo "  make blog-images - Copy blog post images from assets/blog to frontend/public/blog"
	@echo ""

# Install dependencies
install:
	@echo "Installing dependencies..."
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm install'

# Run development server
dev:
	@echo "Starting development server..."
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run dev'

# Build for production
build:
	@echo "Building for production..."
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run build'

# Clean build and restart
rebuild:
	@echo "Cleaning build directory..."
	rm -rf frontend/.next
	@echo "Building for production..."
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run build'
	@echo "Restarting PM2 process..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 restart zerogex-web'
	@echo "Rebuild complete!"

# Start PM2 process
start:
	@echo "Starting PM2 process..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 start ecosystem.config.js'

# Stop PM2 process
stop:
	@echo "Stopping PM2 process..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 stop zerogex-web'

# Restart PM2 process
restart:
	@echo "Restarting PM2 process..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 restart zerogex-web'

# View logs
logs:
	@echo "Viewing PM2 logs (Ctrl+C to exit)..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 logs zerogex-web'

# Check PM2 status
status:
	@echo "PM2 process status:"
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 status zerogex-web'
	@echo ""
	@echo "Detailed info:"
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 describe zerogex-web'

# Print auth users and entitlements from SQLite. Optional filters:
#   TIER=Admin|Pro|Basic    Filter to one tier
#   AUTH=L|G|A              Filter to users with that auth method (L=local, G=Google, A=Apple)
#   PAID=yes                Filter to paying users (subscription_status='active' — excludes trialing)
#   TRIAL=yes               Filter to users currently on a free trial (subscription_status='trialing')
#   EMAIL_ONLY=yes          Print only email addresses, one per line
users:
	@cd frontend && TIER='$(TIER)' AUTH='$(AUTH)' PAID='$(PAID)' TRIAL='$(TRIAL)' EMAIL_ONLY='$(EMAIL_ONLY)' bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-auth-users.mjs'

# Print the referral ledger from SQLite: every referrer->referee relationship
# with its status (pending/rewarded) and dates, a per-referrer summary, and
# banked free-month totals.
referrals:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-referrals.mjs'

# Force the auth DB's lazy migration to run now. Used after a deploy that
# adds new columns but skipped the app rebuild + PM2 restart (most often
# `./deploy.sh --start-from <step>` flows): without this nudge the new
# columns don't land until the first user request hits the live app, and
# any operator script that touches them in the meantime fails with a
# cryptic "no such column" SQL error.
migrate:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/migrate.mts'

# Promote every non-admin user to the pro tier. Walks each known non-admin
# source tier (basic, public, and the legacy starter/elite ids) so any user
# regardless of current tier ends up on pro. Admins are intentionally left
# alone. Pass DRY_RUN=1 to preview without writing.
all-to-pro:
	@echo "Promoting basic -> pro ..."
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/update-user-tier.mjs --all-from basic --tier pro $(if $(DRY_RUN),--dry-run,)'

# Delete a user (and cascade sessions/identities, clean audit_events).
# Usage: make delete-user EMAIL=foo@example.com [DRY_RUN=1] [YES=1]
delete-user:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make delete-user EMAIL=foo@example.com)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/delete-user.mjs --email $(EMAIL) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# One-shot grant of founding_eligible=1 to existing users so they can redeem
# the founding code at checkout. Run once at cutover. Pass DRY_RUN=1 first to
# preview, then YES=1 to apply. Pass BEFORE=<iso> to freeze the cohort at a
# specific cutoff instead of "now".
seed-founders:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/seed-founders.mjs $(if $(BEFORE),--before $(BEFORE),) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Manual founding-member comp for a single user: set tier (default pro) AND
# flip founding_eligible=1 in one shot. Used when granting the founding rate
# to someone outside the seed-founders cohort. Pass DRY_RUN=1 to preview.
# Usage: make grant-founding EMAIL=foo@example.com [GRANT_FOUNDING_TIER=pro|basic] [DRY_RUN=1]
#
# Note: the tier var is intentionally named GRANT_FOUNDING_TIER, not TIER, so
# it doesn't collide with the TIER filter used by `make users`.
GRANT_FOUNDING_TIER ?= pro
grant-founding:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make grant-founding EMAIL=foo@example.com)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/update-user-tier.mjs --email $(EMAIL) --tier $(GRANT_FOUNDING_TIER) --founding-eligible $(if $(DRY_RUN),--dry-run,)'

# Honor a founding member who missed the July-1 lock-in deadline: mint a
# founding-rate Stripe Checkout link (the member enters their own card). The
# subscription carries metadata.founding=1, so the webhook grants the tier,
# sends the founding welcome email, and schedules the lifetime 25%-off coupon —
# i.e. the actual founding RATE, not a free comp (that's `grant-founding`).
# Omit TIER/CADENCE to emit one link per configured plan and let the member
# pick by clicking. TRIAL_DAYS/TRIAL_END defer the first charge (card is still
# collected up front). Run `make diagnose-user EMAIL=...` first to confirm the
# member has no active subscription.
# Usage:
#   make activate-late-founder EMAIL=foo@example.com DRY_RUN=1
#   make activate-late-founder EMAIL=foo@example.com TIER=pro CADENCE=monthly YES=1
#   make activate-late-founder EMAIL=foo@example.com TRIAL_END=2026-08-01T13:30:00Z YES=1
activate-late-founder:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make activate-late-founder EMAIL=foo@example.com DRY_RUN=1)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/activate-late-founder.mts --email $(EMAIL) $(if $(TIER),--tier $(TIER),) $(if $(CADENCE),--cadence $(CADENCE),) $(if $(TRIAL_DAYS),--trial-days $(TRIAL_DAYS),) $(if $(TRIAL_END),--trial-end $(TRIAL_END),) $(if $(EXPIRES_DAYS),--expires-days $(EXPIRES_DAYS),) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Clear stripe_customer_id on rows that never produced a subscription —
# pre-cutover beta artifacts that would cause "No such customer" 400s the
# next time those users click Subscribe. Dry-run by default; pass APPLY=1
# to actually NULL them. Never touches rows with an active subscription.
clear-zombie-customers:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/clear-zombie-customers.mjs $(if $(APPLY),--apply,)'

# Stripe webhook health snapshot — counts of stripe_webhook_error /
# orphan / stale_skipped / payment_failed audit rows over the last 24h
# and 7d, plus all-time founding redemption + lifetime-coupon-applied
# counters. Exits non-zero if errors > 0 in the last 24h so it can be
# wired into cron with the standard "mail on non-zero exit" convention.
webhook-health:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/webhook-health.mjs'

# Drain queued TradeWorkz email notifications through Resend. Reads rows
# from tw_notifications_log via /api/tradeworkz/internal/queued-notifications,
# resolves each end_user -> email via the auth SQLite DB, sends the email,
# and marks the row 'sent' / 'failed'. Scheduled every minute by
# zerogex-web-tradeworkz-notify.timer. Pass DRY_RUN=1 to preview,
# LIMIT=N to bound the batch size, PREVIEW_TO=<email> for a sample send.
tradeworkz-notify:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/tradeworkz-notify-deliver.mts $(if $(DRY_RUN),--dry-run,) $(if $(LIMIT),--limit $(LIMIT),) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),)'

# Send the ~48h-before-trial-end reminder email to every currently-trialing
# user whose first charge lands in the next ~48h (windowed +/- 3h so a
# multi-hour cron cadence still catches the cohort exactly once). Idempotent
# via users.trial_reminder_email_sent_at. Pass DRY_RUN=1 to preview eligible
# users, YES=1 to actually send. Pass PREVIEW_TO=<email> to render the email
# and send a single sample copy to that address (no DB writes).
trial-reminders:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-trial-reminders.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),)'

# Send the founder-voice trial-pitch nudge to every user in the verified-
# never-paid cohort (public tier, verified email, no subscription, NOT
# founding-eligible-not-redeemed, NOT churned) whose account is at least
# LAG_HOURS old (default 2h). Idempotent via
# users.verified_never_paid_email_sent_at — every account gets this at most
# once for its lifetime. Pass DRY_RUN=1 to preview eligible users, YES=1 to
# actually send. Pass PREVIEW_TO=<email> to render the email and send a
# single sample copy to that address (no DB writes). Pass LAG_HOURS=<n>
# to override the "wait N hours after signup" gate; LOOKBACK_HOURS=<n> to
# override the "no older than N hours" upper bound.
verified-never-paid:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-verified-never-paid.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),) $(if $(LAG_HOURS),--lag-hours $(LAG_HOURS),) $(if $(LOOKBACK_HOURS),--lookback-hours $(LOOKBACK_HOURS),)'

# Send the founder-voice "finish verifying to unlock the free trial" nudge to
# every user who registered but never confirmed their email (public tier,
# email_verified_at NULL, no subscription) whose account is at least LAG_HOURS
# old (default 2h). Mints a fresh 24h single-use verification link per user.
# Idempotent via users.verify_reminder_email_sent_at — one reminder per account
# for its lifetime. Pass DRY_RUN=1 to preview eligible users, YES=1 to actually
# send. Pass PREVIEW_TO=<email> to render the email with a sample link and send
# a single copy (no token minted, no DB writes). Pass LAG_HOURS=<n> to override
# the "wait N hours after signup" gate; LOOKBACK_HOURS=<n> for the upper bound.
verify-reminders:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-verify-reminders.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),) $(if $(LAG_HOURS),--lag-hours $(LAG_HOURS),) $(if $(LOOKBACK_HOURS),--lookback-hours $(LOOKBACK_HOURS),)'

# Send the ~1-month-after-churn win-back email to every lapsed subscriber
# (subscription_lapsed=1, verified, no active sub) whose most-recent departure
# landed inside the [now-LOOKBACK_DAYS, now-LAG_DAYS] window (defaults 60d/30d).
# The copy leads with what's new since they left, then makes a discount offer —
# the live public promo (PROMO_END_AT) when one is running, otherwise the
# evergreen "reply 'discount' for 25% off your first year". Idempotent via
# users.winback_email_sent_at (the Stripe webhook clears it on re-subscribe so a
# future re-churn re-qualifies). Pass DRY_RUN=1 to preview eligible users, YES=1
# to actually send. PREVIEW_TO=<email> renders one sample (PREVIEW_PROMO=1 for
# a forced variant via PREVIEW_MODE=auto|promo|manual; no DB writes).
# LAG_DAYS=<n>/LOOKBACK_DAYS=<n> override the window.
winback:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-winback.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),) $(if $(PREVIEW_MODE),--preview-mode $(PREVIEW_MODE),) $(if $(LAG_DAYS),--lag-days $(LAG_DAYS),) $(if $(LOOKBACK_DAYS),--lookback-days $(LOOKBACK_DAYS),)'

# Read-only deep dump of one user — DB row, last 20 audit events, live Stripe
# customer/subscription/invoice state, and a short interpretation that flags
# why the July-1 founding deferral might or might not have applied. Use when
# a founder reports an unexpected immediate charge or status mismatch.
# Usage: make diagnose-user EMAIL=foo@example.com
diagnose-user:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make diagnose-user EMAIL=foo@example.com)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/diagnose-user.mts --email $(EMAIL)'

# Activate a Creator Partner end-to-end: flip partner_tier='creator', grant
# them DAYS days of Pro access (no Stripe sub), pre-mint a referral_code,
# AND register a Stripe promotion_code attached to the audience coupon with
# metadata.partner_user_id so the typeable code works at Stripe checkout
# too. The promo code is auto-derived from the email local-part if PROMO_CODE
# is omitted; pass an explicit one to match the creator's preferred brand.
# Usage:
#   make grant-partner-pro EMAIL=creator@example.com YES=1
#   make grant-partner-pro EMAIL=creator@example.com PROMO_CODE=SPYLEVELS25 DAYS=90 YES=1
#   make grant-partner-pro EMAIL=creator@example.com DRY_RUN=1
grant-partner-pro:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make grant-partner-pro EMAIL=foo@example.com YES=1)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/grant-partner-pro.mts --email $(EMAIL) $(if $(DAYS),--days $(DAYS),) $(if $(COMMISSION_BPS),--commission-bps $(COMMISSION_BPS),) $(if $(WINDOW_MONTHS),--window-months $(WINDOW_MONTHS),) $(if $(PROMO_CODE),--promo-code $(PROMO_CODE),) $(if $(COUPON_ID),--coupon-id $(COUPON_ID),) $(if $(DISCLOSURE_URL),--disclosure-url $(DISCLOSURE_URL),) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Wind down a Creator Partner: clear partner_* state on the user, deactivate
# their Stripe promotion_code, downgrade tier='pro' -> 'public' only if no
# active paying Stripe sub. Keeps referral_code (referrals ledger references
# it) and the partner_commissions ledger (accrued financial records).
# Pass KEEP_STRIPE_PROMO=1 to skip the Stripe deactivation (e.g. you'll
# handle it manually). Idempotent: re-runs on an already-revoked user
# exit cleanly with "nothing to do".
# Usage:
#   make revoke-partner EMAIL=creator@example.com DRY_RUN=1
#   make revoke-partner EMAIL=creator@example.com YES=1
#   make revoke-partner EMAIL=creator@example.com KEEP_STRIPE_PROMO=1 YES=1
revoke-partner:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make revoke-partner EMAIL=foo@example.com YES=1)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/revoke-partner.mts --email $(EMAIL) $(if $(KEEP_STRIPE_PROMO),--keep-stripe-promo,) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Sweep expired Creator Partner Pro grants and downgrade tier=pro -> public
# for partners whose 90-day grant lapsed AND who don't have an active paying
# Stripe sub. partner_tier='creator' is left alone so the commission ledger
# keeps accruing on existing referees. Driven by
# zerogex-web-partner-grant-expiry.timer in production (deploy step 087);
# this Makefile target is what the timer's service unit invokes, and what
# operators use to dry-run before the next scheduled tick.
partner-grant-expiry:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/expire-partner-grants.mjs $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Print the Creator Partner commission ledger. Read-only. Use at month-end
# to see what you owe each partner; drill into one partner with EMAIL=,
# see the whole row-by-row ledger with FULL=1, or filter to a status
# (accrued / paid / reversed) with STATUS=.
partner-commissions:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-partner-commissions.mjs $(if $(EMAIL),--email $(EMAIL),) $(if $(FULL),--full,) $(if $(STATUS),--status $(STATUS),)'

# Segment the tier='public' cohort into the four reactivation buckets used
# by the campaign (unverified / founding-eligible / churned / verified-
# never-paid). Default prints counts + a one-line copy hint per cohort,
# with the cohort key in the first column so it can be copy-pasted into
# COHORT=. Pass EMAILS=1 for a paste-ready recipient list, COHORT=<key> to
# filter to one segment (e.g. COHORT=founding-eligible EMAILS=1),
# SHOW_LAST_LOGIN=1 to further split each cohort into warm/cold/never by
# latest login_success audit row, WARM_DAYS=<n> to tune the warm threshold
# (default 30), and SINCE=<YYYY-MM-DD> to restrict the breakdown to users
# whose users.created_at is on or after the cutoff.
public-cohort:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-public-cohort.mjs --via-make $(if $(EMAILS),--emails,) $(if $(COHORT),--cohort $(COHORT),) $(if $(SHOW_LAST_LOGIN),--show-last-login,) $(if $(WARM_DAYS),--warm-days $(WARM_DAYS),) $(if $(SINCE),--since $(SINCE),)'

# List every customer whose subscription is currently cancelled, and when they
# cancelled. Two states: pending (users.cancel_at_period_end=1 — clicked Cancel,
# still has access until current_period_end) and lapsed (users.subscription_
# lapsed=1 — subscription ended, tier reset to public; dated by the latest
# 'stripe_subscription_deleted' audit event). Default prints a table sorted
# most-recent-first. STATUS=pending|lapsed filters to one state, EMAILS=1 prints
# a paste-ready recipient list, CSV=1 exports id,email,status,cancelled_at,
# access_ends_at,tier with full ISO timestamps, and SINCE=<YYYY-MM-DD> restricts
# to cancellations on/after a cutoff.
cancellations:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-cancellations.mjs $(if $(STATUS),--status $(STATUS),) $(if $(EMAILS),--emails,) $(if $(CSV),--csv,) $(if $(SINCE),--since $(SINCE),)'

# Backup Admin->Monitoring data files (frontend/data/monitoring.json and
# signups.json) into a timestamped tar.gz. Defaults to a dir OUTSIDE the
# repo so archives are not swept into the whole-app backup or git. Files
# are written atomically by the app, so this is safe to run live. Set
# S3_BUCKET to also upload (e.g. S3_BUCKET=s3://my-bucket/zerogex). Prunes
# local archives older than BACKUP_RETENTION_DAYS (default 30).
BACKUP_DIR ?= $(HOME)/zerogex-monitoring-backups
BACKUP_RETENTION_DAYS ?= 30
backup-monitoring:
	@if [ ! -f frontend/data/monitoring.json ] && [ ! -f frontend/data/signups.json ]; then \
		echo "No monitoring data found in frontend/data/ (nothing to back up)."; \
		exit 0; \
	fi; \
	mkdir -p "$(BACKUP_DIR)"; \
	ts=$$(date +%Y%m%d-%H%M%S); \
	archive="$(BACKUP_DIR)/monitoring-data-$$ts.tar.gz"; \
	files=""; \
	if [ -f frontend/data/monitoring.json ]; then files="$$files monitoring.json"; fi; \
	if [ -f frontend/data/signups.json ]; then files="$$files signups.json"; fi; \
	tar -czf "$$archive" -C frontend/data $$files && echo "Created $$archive"; \
	if [ -n "$(S3_BUCKET)" ]; then \
		if command -v aws >/dev/null 2>&1; then \
			echo "Uploading to $(S3_BUCKET)/ ..."; \
			aws s3 cp "$$archive" "$(S3_BUCKET)/"; \
		else \
			echo "WARNING: S3_BUCKET set but aws CLI not found; skipped upload."; \
		fi; \
	fi; \
	find "$(BACKUP_DIR)" -name 'monitoring-data-*.tar.gz' -mtime +$(BACKUP_RETENTION_DAYS) -delete; \
	echo "Backup complete. Local dir: $(BACKUP_DIR) (retention: $(BACKUP_RETENTION_DAYS) days)."

# Backup the SQLite auth database (users, sessions, OAuth identities,
# password-reset tokens, audit log). This file has NO other backup, so
# losing the instance volume loses every account and the user->tier
# mapping. Uses SQLite's online ".backup" (safe against the live PM2
# writer in WAL mode) instead of cp, which can capture a torn WAL and
# produce a corrupt copy. The snapshot is integrity-checked, gzip'd, and
# written to a dir OUTSIDE the repo. Set S3_BUCKET to also upload, and
# BACKUP_GPG_RECIPIENT to encrypt at rest -- STRONGLY recommended: this
# archive contains password hashes and PII. Prunes local archives older
# than AUTH_BACKUP_RETENTION_DAYS (default 30). AUTH_DB_PATH defaults to
# the value in frontend/.env.local, then frontend/data/auth.db.
AUTH_DB_PATH ?=
AUTH_BACKUP_DIR ?= $(HOME)/zerogex-auth-backups
AUTH_BACKUP_RETENTION_DAYS ?= 30
backup-auth:
	@command -v sqlite3 >/dev/null 2>&1 || { \
		echo "ERROR: sqlite3 CLI not found. Install it: sudo apt-get install -y sqlite3"; \
		echo "(A plain cp of a live WAL database can be corrupt; .backup is required.)"; \
		exit 1; \
	}; \
	db="$(AUTH_DB_PATH)"; \
	if [ -z "$$db" ] && [ -f frontend/.env.local ]; then \
		db=$$(grep -E '^AUTH_DB_PATH=' frontend/.env.local | head -1 | cut -d= -f2- | tr -d '"'); \
	fi; \
	if [ -z "$$db" ]; then db="frontend/data/auth.db"; fi; \
	if [ ! -f "$$db" ]; then echo "Auth DB not found at '$$db' (set AUTH_DB_PATH). Nothing to back up."; exit 1; fi; \
	mkdir -p "$(AUTH_BACKUP_DIR)"; \
	ts=$$(date +%Y%m%d-%H%M%S); \
	snap="$(AUTH_BACKUP_DIR)/auth-$$ts.db"; \
	archive="$$snap.gz"; \
	echo "Backing up $$db ..."; \
	sqlite3 "$$db" ".backup '$$snap'"; \
	if ! sqlite3 "$$snap" 'PRAGMA integrity_check;' | head -1 | grep -q '^ok$$'; then \
		echo "ERROR: integrity_check failed on snapshot; not keeping it."; rm -f "$$snap"; exit 1; \
	fi; \
	gzip -f "$$snap"; \
	if [ -n "$(BACKUP_GPG_RECIPIENT)" ]; then \
		if command -v gpg >/dev/null 2>&1; then \
			gpg --yes --batch --encrypt --recipient "$(BACKUP_GPG_RECIPIENT)" "$$archive" && rm -f "$$archive" && archive="$$archive.gpg"; \
		else \
			echo "WARNING: BACKUP_GPG_RECIPIENT set but gpg not found; storing UNENCRYPTED."; \
		fi; \
	fi; \
	echo "Created $$archive"; \
	if [ -n "$(S3_BUCKET)" ]; then \
		if command -v aws >/dev/null 2>&1; then \
			echo "Uploading to $(S3_BUCKET)/ ..."; \
			aws s3 cp "$$archive" "$(S3_BUCKET)/"; \
		else \
			echo "WARNING: S3_BUCKET set but aws CLI not found; skipped upload."; \
		fi; \
	fi; \
	find "$(AUTH_BACKUP_DIR)" -name 'auth-*.db.gz*' -mtime +$(AUTH_BACKUP_RETENTION_DAYS) -delete; \
	echo "Backup complete. Local dir: $(AUTH_BACKUP_DIR) (retention: $(AUTH_BACKUP_RETENTION_DAYS) days)."

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf frontend/.next
	rm -rf frontend/node_modules/.cache
	@echo "Clean complete!"

# Copy logos from assets to public
logo:
	@echo "Copying logos from assets to public..."
	cp assets/branding/Dark_Full.svg frontend/public/logo-dark.svg
	cp assets/branding/Light_Full.svg frontend/public/logo-light.svg
	cp assets/branding/Title.svg frontend/public/title.svg
	cp assets/branding/Target.svg frontend/public/target.svg
	cp assets/branding/favicon.ico frontend/public/favicon.ico
	cp assets/branding/og-image.png frontend/public/.
	@echo "Logos copied successfully!"

# Copy blog post images from assets/blog to the Next.js public/blog directory
# (the path referenced by markdown image links like /blog/<name>.png). Source
# and destination filenames are identical, so a wildcard makes this target
# self-maintaining as more images get added. Skips gracefully when the source
# directory is empty so a fresh worktree doesn't fail the deploy chain.
blog-images:
	@echo "Copying blog images from assets to public..."
	@mkdir -p frontend/public/blog
	@if ls assets/blog/*.png >/dev/null 2>&1; then \
		cp assets/blog/*.png frontend/public/blog/ && echo "Blog images copied successfully!"; \
	else \
		echo "(no blog images found in assets/blog/ — skipping)"; \
	fi

# Full deployment
deploy:
	@echo "Starting full deployment..."
	@echo "1. Pulling latest changes..."
	git pull
	@echo "2. Installing dependencies..."
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm install'
	@echo "3. Copying logos..."
	@make logo
	@echo "4. Copying blog images..."
	@make blog-images
	@echo "5. Rebuilding application..."
	rm -rf frontend/.next
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run build'
	@echo "6. Restarting PM2..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 restart zerogex-web'
	@echo "7. Saving PM2 config..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 save'
	@echo "Deployment complete!"
	@echo ""
	@make status
