.PHONY: integration-assets help install dev build rebuild start stop restart logs status users x-handles referrals attribute-referral send-403-notice migrate migrate-tiers all-to-pro delete-user seed-founders grant-founding grant-founding-on-existing-sub apply-founding-lifetime activate-late-founder extend-trial quarterly-receipt foh-donation-reminder signup-alarm set-cancellation cancel-subscription honor-winback-discount recover-orphan-payment scan-orphan-payments clear-zombie-customers backfill-daily-metrics webhook-health cancellation-alerts trial-reminders trial-engagement renewal-engagement trial-value-nudge payment-failed-preview verified-never-paid verify-reminders winback reactivation checkout-recovery founding-final-call public-cohort cancellations churn-breakdown backfill-refund-audit enable-portal-cancel-reasons save-url reset-save-latch gex-rank-backtest diagnose-user subscriber-headcount reset-user-for-testing dedupe-payment-methods grant-partner-pro revoke-partner partner-grant-expiry partners partner-commissions backup-monitoring backup-auth auth-backups-prune janitor janitor-noconfirm clean deploy logo og-check verify-gate blog-images ninjatrader-package
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
	@echo "  make users      - Print auth users + entitlements (TIER=Admin|Pro|Basic, AUTH=L|G|A, PAID=yes, TRIAL=yes, X_ONLY=yes, EMAIL_ONLY=yes)"
	@echo "                    Founder column: E=eligible, R=redeemed (intro 12mo), L=lifetime 25% off"
	@echo "  make x-handles  - List only users who registered an X/Twitter handle (email + @handle). EMAIL_ONLY=yes for just emails"
	@echo "  make referrals  - Print the referral ledger + per-referrer summary (signups, rewards, banked months)"
	@echo "  make attribute-referral EMAIL=<referee> REF=<code-or-email> - Manually tie an organic signup to a referrer (back-attribution). REWARD=1 also grants the referrer's free month if the referee already converted to paid (the webhook won't). DRY_RUN=1 to preview, YES=1 to apply"
	@echo "  make send-403-notice                     - One-off: notify the 10 API users hit by the 2026-08-31 scope-enforcement 403s (excludes Jim, answered personally). DRY_RUN=1 to preview, ONLY=<addr> to test one, YES=1 to send"
	@echo "  make migrate    - Force the auth DB's lazy migration to run now (use after --start-from <step> deploys that add new columns)"
	@echo "  make migrate-tiers - Migrate legacy starter/elite users to basic/pro (DRY_RUN=1 to preview)"
	@echo "  make backfill-daily-metrics - Rebuild the one-row-per-day metrics table behind Admin->Monitoring->Daily Signals, and print the relationship tests. DAYS=<n> to limit the window, X_CSV=<path> / GOOGLE_CSV=<path> / COMBINED_CSV=<path> to import an X or Search Console export, REPORT=0 to skip the readout"
	@echo "  make all-to-pro - Promote every non-admin user to pro (DRY_RUN=1 to preview)"
	@echo "  make delete-user EMAIL=<email> - Delete a user (DRY_RUN=1 to preview, YES=1 to skip prompt)"
	@echo "  make seed-founders - Flag current users as founding_eligible (DRY_RUN=1 to preview, YES=1 to apply, BEFORE=<iso> for cutoff)"
	@echo "  make grant-founding EMAIL=<email> [GRANT_FOUNDING_TIER=pro] - Manual founding comp: set tier + founding_eligible=1 in one shot (DRY_RUN=1 to preview)"
	@echo "  make activate-late-founder EMAIL=<email> [TIER=basic|pro] [CADENCE=monthly|annual] [TRIAL_DAYS=N|TRIAL_END=<iso>] - Mint a founding-rate Stripe Checkout link for a member who missed the July-1 deadline (DRY_RUN=1 to preview, YES=1 to mint)"
	@echo "  make grant-founding-on-existing-sub EMAIL=<email> [TIER=pro] [CADENCE=annual] [PRORATION=always_invoice|create_prorations|none] - Convert an EXISTING paying member's live subscription to the founding rate in place (swap plan + founding coupon + metadata.founding=1, so the webhook grants founding + schedules the lifetime 25%-off). The has-a-sub twin of activate-late-founder. DRY_RUN=1 to preview, YES=1 to apply"
	@echo "  make apply-founding-lifetime - One-time batch: apply the founding lifetime 25%-off coupon to founders past month 11 that the event-driven webhook misses (annual founders emit no mid-year events). Idempotent; run once the cohort's intro year ends (~mid-2027). EMAIL=<addr> for one member, FORCE=1 to ignore the 11-month gate, DRY_RUN=1 to preview, YES=1 to apply"
	@echo "  make extend-trial EMAIL=<email> (EXTEND_DAYS=N | TRIAL_END=<iso>) - Manually lengthen one customer's free trial by pushing out Stripe trial_end; re-arms the ~48h reminder so the reminder + trial->paid cutover still run automatically (DRY_RUN=1 to preview, YES=1 to apply)"
	@echo "  make quarterly-receipt - Interactive end-to-end quarterly FOH receipt: prompts for amount/quarter/date, updates content/giving/totals.json, commits, pushes, and rebuilds. Never posts to X — prints the tweet for you to paste. Optional flags: AMOUNT=<usd> QUARTER=<label> DATE=<YYYY-MM-DD> EMAIL=<addr> NO_PUSH=1 NO_REBUILD=1 YES=1 DRY_RUN=1"
	@echo "  make foh-donation-reminder - Send the quarterly FOH reminder email to the admin (fully self-contained instructions inside). Meant for cron on the 5th of Jan/Apr/Jul/Oct; TO=<addr> overrides the FOH_REMINDER_EMAIL env; QUARTER=<label> overrides the auto-detected closing quarter; DRY_RUN=1 to preview"
	@echo "  make set-cancellation EMAIL=<email> (OFF=1 | ON=1) - Flip one customer's cancel_at_period_end: OFF=1 stops a scheduled cancel (renews, or converts a trial to paid); ON=1 schedules a cancel at period end (DRY_RUN=1 to preview, YES=1 to apply)"
	@echo "  make honor-winback-discount EMAIL=<email> - Honor the manual 'reply discount' win-back offer: STACK a 25%-off-1-year coupon on top of any existing discounts and (default) stop a scheduled cancel so the sub converts/renews on the card on file. COUPON=<id> pins a coupon; CREATE_COUPON=1 [PERCENT=25] mints one; KEEP_CANCELLATION=1 leaves the cancel intact. DRY_RUN=1 to preview, YES=1 to apply"
	@echo "  make scan-orphan-payments [SINCE_DAYS=120] [VERBOSE=1] - Sweep every paid Stripe invoice for members who paid in full and are still on a free tier (the ones who never wrote in). Read-only; prints the recover-orphan-payment command for each hit"
	@echo "  make clear-zombie-customers - NULL stripe_customer_id on rows with no subscription (APPLY=1 to write, dry-run by default)"
	@echo "  make webhook-health - Stripe webhook health summary (errors/orphans/failed payments, last 24h + 7d)"
	@echo "  make signup-alarm  - Check the trailing registration rate and email the operator if signups have flatlined. Runs hourly via systemd (step 096); FORCE=1 bypasses the active-hours/cooldown gates, DRY_RUN=1 previews without sending, WINDOW=<h>/MIN=<n> override thresholds"
	@echo "  make trial-engagement - Review trials by whether the member has used the product since signup (read-only, DORMANT_ONLY=1 to filter)"
	@echo "  make renewal-engagement - Review ACTIVE subscribers by whether they have used the product before their renewal (read-only, DORMANT_ONLY=1 to filter)"
	@echo "  make trial-reminders - Send ~48h-before-trial-end reminder emails (DRY_RUN=1 to preview, YES=1 to send, PREVIEW_TO=<email> for a sample, RENDER=<email> to dry-run one member's real copy to files without sending)"
	@echo "  make trial-value-nudge - Send the mid-trial (~day 2) value/activation nudge to current trialers, ahead of the day 3-7 cancel wave (DRY_RUN=1 to preview, YES=1 to send, PREVIEW_TO=<email> for a sample, WINDOW_HOURS=N to tune the window)"
	@echo "  make card-expiry-reminders - Email active subscribers whose card on file expires within ~45 days so they update it before a renewal fails (DRY_RUN=1 to preview, YES=1 to send, PREVIEW_TO=<email> for a sample, THRESHOLD_DAYS=N / LIMIT=N to tune)"
	@echo "  make payment-failed-preview - Send yourself a sample of the payment-failed dunning email (PREVIEW_TO=<email>; FINAL=1 for the retries-exhausted variant, NO_CARD=1 for the neutral fallback)"
	@echo "  make verified-never-paid - Send the founder-voice trial-nudge to users who signed up + verified but never opened checkout (DRY_RUN=1 to preview, YES=1 to send, PREVIEW_TO=<email> for a sample, LAG_HOURS=<n> to override the 2h default)"
	@echo "  make verify-reminders - Send the founder-voice 'finish verifying to unlock the trial' nudge to users who signed up but never confirmed their email (mints a fresh 24h verify link; DRY_RUN=1 to preview, YES=1 to send, PREVIEW_TO=<email> for a sample, LAG_HOURS=<n> to override the 2h default)"
	@echo "  make winback - Send the ~1-month-after-churn win-back email to lapsed subscribers (what's new + a discount, no pressure). DIGEST=1 [DIGEST_TO=<email>] emails you the recipient list + draft and sends nothing (weekly review); YES=1 delivers; DRY_RUN=1 previews; PREVIEW_TO=<email> sends one sample; PREVIEW_MODE=auto|promo|manual forces a variant; LAG_DAYS/LOOKBACK_DAYS override the window"
	@echo "  make reactivation - Send the second-touch reactivation email (extended free trial) to cold verified-never-paid signups who signed up >=21d ago. DIGEST=1 [DIGEST_TO=<email>] emails you the recipient list + draft and sends nothing (review); YES=1 delivers; DRY_RUN=1 previews; PREVIEW_TO=<email> sends one sample; LAG_DAYS/LOOKBACK_DAYS override the 21d/3650d window; LIMIT=<n> caps the drip (default 50; 0=unlimited)"
	@echo "  make checkout-recovery - Send the one-shot abandoned-checkout recovery nudge to users who started Stripe Checkout but never subscribed (promo copy quotes the live Basic/Pro rates from Stripe). Fired by the checkout-recovery systemd timer. DRY_RUN=1 previews, YES=1 sends, PREVIEW_TO=<email> for a sample, PREVIEW_FOUNDING=1 for the founding variant, LAG_HOURS/LOOKBACK_HOURS override the window"
	@echo "  make founding-final-call - Send the one-shot founding final-call urgency email to founding-eligible non-redeemers before the lock-in deadline (quotes live founding rates from Stripe; no-op once the deadline passes). DRY_RUN=1 previews, YES=1 sends, PREVIEW_TO=<email> for a sample"
	@echo "  make grant-partner-pro EMAIL=<email> [DAYS=90] [COMMISSION_BPS=3000] [WINDOW_MONTHS=12] [PROMO_CODE=...] [COUPON_ID=...] [DISCLOSURE_URL=...] [X_HANDLE=...] - Activate a Creator Partner: flips partner_tier='creator', stamps Pro grant, registers the Stripe promotion_code, optionally sets the X handle (DRY_RUN=1 to preview, YES=1 to apply)"
	@echo "  make revoke-partner EMAIL=<email> [KEEP_STRIPE_PROMO=1] - Wind down a Creator Partner: clears partner_* state, deactivates the Stripe promo code, downgrades tier if no paying sub. Keeps referral_code + accrued commission ledger. (DRY_RUN=1 to preview, YES=1 to apply)"
	@echo "  make partner-grant-expiry - Sweep expired Creator Partner Pro grants and downgrade to public (DRY_RUN=1 to preview, YES=1 to apply). Driven daily by systemd timer; this target is the same thing the timer fires."
	@echo "  make partners [EMAIL=<partner>] - Roster of every Creator Partner: X handle, referral + promo codes, commission rate/window, Pro-grant expiry, activation date, disclosure URL. The 'who are my partners' view."
	@echo "  make partner-commissions [EMAIL=<partner>] [FULL=1] [STATUS=accrued|paid|reversed] - Print the Creator Partner commission ledger: per-partner totals and (with --full) full row-by-row view. Use at month-end to figure out payouts."
	@echo "  make public-cohort - Break the tier='public' cohort into reactivation segments (EMAILS=1 for paste-ready lists, COHORT=<key> to filter, SHOW_LAST_LOGIN=1 to split warm/cold/never, WARM_DAYS=<n> to tune, SINCE=<YYYY-MM-DD> to filter to signups on/after a date)"
	@echo "  make cancellations - List customers who canceled and when (pending = clicked Cancel, still has access; lapsed = subscription ended). STATUS=pending|lapsed to filter, EMAILS=1 for a recipient list, CSV=1 to export, SINCE=<YYYY-MM-DD> for cancellations on/after a date"
	@echo "  make cancellation-alerts - Email yourself one alert per cancellation, carrying the reason the member typed on their way out. Sweeps the audit log (so a failed send retries instead of vanishing) and latches each event once. Driven every 15m by the cancellation-alerts systemd timer. DRY_RUN=1 to preview, SINCE=<YYYY-MM-DD|iso> to backfill history, PREVIEW_TO=<email> for a sample, MARK_ONLY=1 to silence a backlog without emailing (ignores LIMIT — it takes the whole backlog), KIND=pending|lapsed, INCLUDE_SILENT_LAPSES=1 to also see lapses that captured no reason (skipped by default), LIMIT=<n>/LOOKBACK=<hours>/THROTTLE_MS=<ms> to tune, TO=<email> to override the recipient"
	@echo "  make churn-breakdown - Diagnose a cancellation spike: split recent cancels into trial-abandon vs paid-cancel vs lapsed (and lapses into payment-failed vs voluntary/expired), by tier, tenure (trial-cliff detector), signup source, daily timeline, and captured cancel reasons. WINDOW=<days> (default 14) or SINCE=<YYYY-MM-DD> to set the window, CSV=1 for per-user rows"
	@echo "  make backfill-refund-audit - Write the refund_issued audit rows for refunds issued before the webhook recorded them (idempotent, rows carry the refund's own timestamp). DRY_RUN=1 to preview, YES=1 to write, SINCE=<YYYY-MM-DD>, LIMIT=<n>"
	@echo "  make enable-portal-cancel-reasons - Turn on the Stripe billing-portal cancellation survey (feedback + free-text) so future cancels record a WHY. DRY_RUN=1 to preview, YES=1 to apply. CHANGES THE LIVE CUSTOMER PORTAL"
	@echo "  make gex-rank-backtest [SYMBOL=NQ] [SESSIONS=120] - Measure whether GEX rank actually predicts where price reacts, against a shuffled-label null and a random-strike control, bucketed by distance from the open. Needs ~80 sessions minimum to detect anything. SELF_TEST=1 runs it against synthetic data with a planted answer."
	@echo "  make diagnose-user EMAIL=<email> - Read-only dump of one user: DB row, last 20 audit events, live Stripe customer/subscription/invoices, and notes on whether the July-1 founding deferral applied"
	@echo "  make subscriber-headcount [NAMES=1] - Decompose the admin Total Subscribers chart (Full Subscriber / Converting / Free Trial / Trial Grace) and account for every subscription-carrying account it does not count — paused, setup-withheld, lapsed. Answers 'why did the headcount move' (read-only)"
	@echo "  make recover-orphan-payment EMAIL=<email> - Restore a member who PAID an invoice after Stripe had already canceled their subscription for nonpayment (money collected, still on Public). Re-creates the plan with billing anchored at the end of the period they paid for, so they are never charged twice. DRY by default, YES=1 to apply, INVOICE=in_... to pick the invoice"
	@echo "  make save-url EMAIL=<email> - Print the signed one-click self-serve SAVE url (app/save) for a member + their eligibility, to test the retention flow without a real cancellation email (read-only)"
	@echo "  make reset-save-latch EMAIL=<email> - TESTING: clear a member's one-shot save latch (retention_offer_claimed_at) so the /save flow can be claimed again"
	@echo "  make reset-user-for-testing EMAIL=<email> - TESTING: reset one account to a clean pre-signup state (tier=public, subscription/trial latches cleared) so you can re-run signup + plan switching. DRY by default, APPLY=1 to write, KEEP_FOUNDING=1 / KEEP_CUSTOMER=1 to preserve those"
	@echo "  make dedupe-payment-methods (EMAIL=<email> | CUSTOMER=cus_... | ALL=1) - Detach duplicate same-card/same-Link payment methods from Stripe customers, keeping the default/subscription method (INSPECT=1 to just list, DRY by default, APPLY=1 to detach)"
	@echo "  make backup-monitoring - Backup Admin->Monitoring JSON data (S3_BUCKET=s3://... optional)"
	@echo "  make backup-auth - Online backup of the SQLite auth DB (S3_BUCKET=, BACKUP_GPG_RECIPIENT= optional)"
	@echo "  make auth-backups-prune - Prune old auth-DB backups: delete auth-*.db.gz* older than AUTH_BACKUP_RETENTION_DAYS (default 30) but ALWAYS keep the newest AUTH_BACKUP_KEEP (default 48; 0 = raw mtime-only). Shared by backup-auth + janitor"
	@echo "  make janitor     - Nightly cleanup (interactive): prune auth backups (keep-newest floor) + drop frontend/.next/cache + npm cache clean. Prints the plan and asks before acting"
	@echo "  make janitor-noconfirm - Same as janitor but no prompt (what the zerogex-web-janitor systemd timer runs nightly)"
	@echo "  make clean      - Remove build artifacts"
	@echo "  make deploy     - Full deployment (pull, install, rebuild)"
	@echo "  make logo       - Copy logos from assets to public"
	@echo "  make og-check   - Check the DEPLOYED site serves the social card this checkout expects, and name the cause when it does not (stale deploy / missing PNG / wrong twitter:card / Cloudflare blocking X's fetcher / X's own card cache). Read-only; PAGE=<path> to check the exact URL you post (e.g. /?v=2), ORIGIN=<url> to point elsewhere"
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

# Build for production.
#
# Depends on ninjatrader-package because the NinjaTrader download URL is
# content-addressed: core/ninjaTraderManifest.ts is COMMITTED (so a plain build
# resolves) but the hashed file it names is GITIGNORED and written only by that
# step. Build without it on a box that has never run it and the page ships a
# download button pointing at a file that is not on disk -- a 404 for the
# customer, from a build that reported success. `make deploy` always ran this
# step; `make build` and `make rebuild` did not, so a routine rebuild between
# deploys silently reintroduced the bug. Cheap and idempotent, so it just
# becomes a prerequisite rather than something to remember.
build: ninjatrader-package integration-assets
	@echo "Building for production..."
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run build'

# Clean build and restart. Same prerequisite, and for a second reason: Next
# reads public/ once at boot, so a file that appears there while the server is
# running keeps 404ing until a restart. Generating before the PM2 restart below
# means one command leaves the box consistent; generating after would not.
rebuild: ninjatrader-package integration-assets
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
#   X_ONLY=yes              Filter to users who registered an X/Twitter handle
#   EMAIL_ONLY=yes          Print only email addresses, one per line
users:
	@cd frontend && TIER='$(TIER)' AUTH='$(AUTH)' PAID='$(PAID)' TRIAL='$(TRIAL)' X_ONLY='$(X_ONLY)' EMAIL_ONLY='$(EMAIL_ONLY)' bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-auth-users.mjs'

# Print only the users who have registered an X/Twitter handle, alongside their
# email + the handle. Thin wrapper over `make users` with X_ONLY=yes (same auth
# DB, same X Handle column). EMAIL_ONLY=yes trims it to bare emails.
x-handles:
	@cd frontend && X_ONLY=yes EMAIL_ONLY='$(EMAIL_ONLY)' bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-auth-users.mjs'

# Print the referral ledger from SQLite: every referrer->referee relationship
# with its status (pending/rewarded) and dates, a per-referrer summary, and
# banked free-month totals.
referrals:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-referrals.mjs'

# Manually attribute an organic signup to a referrer (back-attribution) — for
# when someone was really referred but signed up without the ?ref= link or the
# code at checkout. The script mirrors core/referrals.ts (backAttributeReferral +
# rewardReferrerForConvertedReferee) statement-for-statement — it can't import
# them because they resolve deps via the Next "@/" alias, which the standalone
# node runner doesn't understand — so idempotency, the creator-partner carve-out,
# and credit-vs-bank behave identically. Keep the two in sync by hand if that
# core logic changes. Refuses self-referral and already-attributed referees.
#
# Timing: the referrer's free month is granted on the referee's paid conversion
# (subscription active), so attributing a still-trialing / not-yet-subscribed
# referee lets the reward fire automatically later. For a referee who is ALREADY
# on a paid subscription, that webhook has already passed — add REWARD=1 to grant
# the referrer's month now (credit if they have an active sub, else banked).
#
# Usage:
#   make attribute-referral EMAIL=friend@example.com REF=ABCD2345 DRY_RUN=1
#   make attribute-referral EMAIL=friend@example.com REF=referrer@example.com YES=1
#   make attribute-referral EMAIL=friend@example.com REF=ABCD2345 REWARD=1 YES=1
attribute-referral:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (the referee; e.g. make attribute-referral EMAIL=friend@example.com REF=ABCD2345)"; exit 1; fi
	@if [ -z "$(REF)" ]; then echo "Error: REF is required (the referrer's 8-char code or their email)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/attribute-referral.mts --referee $(EMAIL) --referrer "$(REF)" $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(REWARD),--reward,)'

# One-off incident notice for the 2026-08-31 API scope-enforcement 403s.
# Each recipient gets their OWN failure count and endpoint list (taken from the
# audit log and baked into the script), so the mail says what actually happened
# on their account rather than apologizing in the abstract. One message per
# person — never a shared To/CC, which would leak every customer's address.
# jimmyturk@gmail.com is excluded on purpose: he reported it and was answered
# personally. Preview everything, then send yourself first, then send for real:
#   make send-403-notice DRY_RUN=1
#   make send-403-notice ONLY=you@zerogex.io YES=1
#   make send-403-notice YES=1
send-403-notice:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-api-403-incident-notice.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(ONLY),--only $(ONLY),)'

# Force the auth DB's lazy migration to run now. Used after a deploy that
# adds new columns but skipped the app rebuild + PM2 restart (most often
# `./deploy.sh --start-from <step>` flows): without this nudge the new
# columns don't land until the first user request hits the live app, and
# any operator script that touches them in the meantime fails with a
# cryptic "no such column" SQL error.
migrate:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/migrate.mts'

# Rebuild the per-day rollup behind Admin -> Monitoring -> Daily Signals, then
# print the four relationship tests it exists to answer.
#
# Everything except the X / Google columns is DERIVED from the append-only
# audit_events + users + page_view_events tables, so this is a real backfill:
# the first run reconstructs the product's whole history rather than starting a
# fresh collection, and re-running is idempotent. Run it after a deploy that
# ships this table for the first time, after importing a console export, or any
# time the numbers look stale.
#
#   DAYS=<n>             limit how far back to rebuild (default: all history)
#   X_CSV=<path>         import an X analytics daily export first
#   GOOGLE_CSV=<path>    import a Search Console "Dates" export first
#   COMBINED_CSV=<path>  import the CSV the admin page itself downloads
#   REPORT=0             rebuild only, skip the correlation readout
backfill-daily-metrics:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/backfill-daily-metrics.mts'

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
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/activate-late-founder.mts --email $(EMAIL) $(if $(TIER),--tier $(TIER),) $(if $(CADENCE),--cadence $(CADENCE),) $(if $(TRIAL_DAYS),--trial-days $(TRIAL_DAYS),) $(if $(TRIAL_END),--trial-end $(TRIAL_END),) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Comp an EXISTING paying member into founding — the has-a-sub counterpart to
# activate-late-founder (which refuses anyone who already has a subscription).
# Converts the member's live subscription IN PLACE: swaps to the target founding
# plan (default pro/annual), attaches the founding intro coupon, and stamps
# metadata.founding=1 so the webhook grants founding status and schedules the
# lifetime 25%-off coupon. Unlike a hand-applied custom coupon, founding is
# exclusive in the webhook's reconciler, so the discount survives the plan switch
# even mid-promo. PRORATION=always_invoice (default) bills the prorated founding
# rate now; create_prorations defers it to the next invoice; none makes the change
# with no immediate charge. Run `make diagnose-user EMAIL=...` first to confirm the
# member has an active subscription (if they have none, use activate-late-founder).
# Usage:
#   make grant-founding-on-existing-sub EMAIL=foo@example.com DRY_RUN=1
#   make grant-founding-on-existing-sub EMAIL=foo@example.com TIER=pro CADENCE=annual YES=1
grant-founding-on-existing-sub:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make grant-founding-on-existing-sub EMAIL=foo@example.com DRY_RUN=1)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/grant-founding-on-existing-sub.mts --email $(EMAIL) $(if $(TIER),--tier $(TIER),) $(if $(CADENCE),--cadence $(CADENCE),) $(if $(PRORATION),--proration $(PRORATION),) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Apply the founding LIFETIME 25%-off coupon to founders who are due for it — the
# on-demand twin of the webhook's maybeApplyFoundingLifetime. The webhook reaches
# MONTHLY founders (a monthly invoice event hits the month-11 window) but NOT
# ANNUAL founders (an annual sub emits no events between signup and renewal), so
# their renewal would bill full rack rate before the 25% ever lands. Run this once
# the founding cohort's intro year is ending (~May/June 2027 for a June-2026
# go-live) so every founder gets the coupon before renewal. Idempotent
# (founding_lifetime_applied_at guards re-runs), so re-run it for late stragglers.
# FORCE=1 ignores the 11-month gate (annual stragglers only — never a monthly
# founder still inside their 12-invoice intro); EMAIL=<addr> limits to one member.
# Usage:
#   make apply-founding-lifetime DRY_RUN=1
#   make apply-founding-lifetime YES=1
#   make apply-founding-lifetime EMAIL=foo@example.com FORCE=1 YES=1
apply-founding-lifetime:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/apply-founding-lifetime.mts $(if $(EMAIL),--email $(EMAIL),) $(if $(FORCE),--force,) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

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
# and send a single sample copy to that address (no DB writes). Pass
# RENDER=<email> to write THAT member's real reminder (charge + card resolved
# live from Stripe) to files without sending — a dry-run of the exact copy they
# would receive; OUT=<dir> overrides the output directory.
trial-reminders:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-trial-reminders.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),) $(if $(RENDER),--render $(RENDER),) $(if $(OUT),--out $(OUT),)'

# Send the mid-trial value/activation nudge (~day 2 of a 7-day trial) to
# currently-trialing members, BEFORE the day 3-7 cancel wave and well before the
# 48h billing reminder above. Idempotent via users.trial_midpoint_email_sent_at;
# honors marketing opt-out and skips already-canceled trials. DRY_RUN=1
# previews, YES=1 sends, PREVIEW_TO=<email> sends one sample, WINDOW_HOURS=N
# tunes the +/- window.
# Read-only review of every member currently on a free trial and whether they
# have actually used the product since signing up (users.last_seen_at vs the
# account's created_at — see core/trialEngagement). A trial converting on a
# member who never came back is the cohort that produced dispute
# du_1U6cn34AOiqteMYYYCr2OaKn; the 48h reminder already mails them different
# copy, and this is the surface for looking at them directly beforehand.
# Never writes, never calls Stripe.
#   make trial-engagement
#   make trial-engagement DORMANT_ONLY=1
trial-engagement:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/scan-trial-engagement.mts $(if $(DORMANT_ONLY),--dormant-only,)'

# Same question as trial-engagement, asked of the PAID book instead: has an
# active subscriber used the product in the period they are about to be
# re-billed for? core/trialEngagement stops at the trial boundary, so nothing
# currently looks at renewal N — see docs/renewal-dormancy-reminder-scope.md.
# This is step 0 of that scope and sends nothing: the cohort size is what
# decides whether the send path is worth building at all.
# Never writes, never calls Stripe.
#   make renewal-engagement
#   make renewal-engagement DORMANT_ONLY=1
#   make renewal-engagement DORMANCY_DAYS=14 LEAD_HOURS=120
renewal-engagement:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/scan-renewal-engagement.mts $(if $(DORMANT_ONLY),--dormant-only,) $(if $(DORMANCY_DAYS),--dormancy-days $(DORMANCY_DAYS),) $(if $(LEAD_HOURS),--lead-hours $(LEAD_HOURS),)'

trial-value-nudge:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-trial-value-nudge.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),) $(if $(WINDOW_HOURS),--window-hours $(WINDOW_HOURS),)'

# Proactive card-expiry reminder: emails active subscribers whose card on file
# expires within ~45 days so they update it before a renewal fails. DRY_RUN=1
# previews (no send/writes), YES=1 sends, PREVIEW_TO=<email> sends one sample,
# THRESHOLD_DAYS=N tunes the window, LIMIT=N caps Stripe lookups per run.
card-expiry-reminders:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-card-expiry-reminders.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),) $(if $(THRESHOLD_DAYS),--threshold-days $(THRESHOLD_DAYS),) $(if $(LIMIT),--limit $(LIMIT),)'

# Preview-only sender for the payment-failed dunning email (core/mailer.ts
# sendPaymentFailedEmail), which is otherwise webhook-only (fired from
# invoice.payment_failed, attempt 1). Pass PREVIEW_TO=<email> to send one sample.
# FINAL=1 previews the retries-exhausted variant; NO_CARD=1 the neutral
# "declined by your card issuer" fallback; NO_AMOUNT=1 drops the dollar amount.
payment-failed-preview:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-payment-failed-preview.mts $(if $(PREVIEW_TO),--to $(PREVIEW_TO),) $(if $(FINAL),--final,) $(if $(NO_CARD),--no-card,) $(if $(NO_AMOUNT),--no-amount,)'

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
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-winback.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(DIGEST),--digest $(DIGEST_TO),) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),) $(if $(PREVIEW_MODE),--preview-mode $(PREVIEW_MODE),) $(if $(LAG_DAYS),--lag-days $(LAG_DAYS),) $(if $(LOOKBACK_DAYS),--lookback-days $(LOOKBACK_DAYS),)'

# Send the second-touch reactivation email to cold verified-never-paid signups —
# the inactive-signup analog of the win-back above. Targets public-tier,
# verified, no-sub, not-churned, not-unsubscribed users who signed up inside the
# [now-LOOKBACK_DAYS, now-LAG_DAYS] window (defaults 3650d/21d — the wide
# lookback deliberately sweeps the aged backlog). Pitches an EXTENDED free trial
# (REACTIVATION_TRIAL_DAYS, default 30) granted server-side for the ?reactivate=1
# link. Idempotent via users.reactivation_email_sent_at; honors
# marketing_unsubscribed_at and carries a one-click List-Unsubscribe. Capped at
# LIMIT recipients per run (default 50) so the daily timer drips the backlog;
# LIMIT=0 lifts the cap. DRY_RUN=1 previews, YES=1 sends, PREVIEW_TO=<email>
# renders one sample (no DB writes). DIGEST=1 [DIGEST_TO=<email>] emails you the
# recipient list + the rendered draft for review (respecting LIMIT) and sends
# nothing to users — the "show me the batch before it goes" step.
reactivation:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-reactivation.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(DIGEST),--digest $(DIGEST_TO),) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),) $(if $(LAG_DAYS),--lag-days $(LAG_DAYS),) $(if $(LOOKBACK_DAYS),--lookback-days $(LOOKBACK_DAYS),) $(if $(LIMIT),--limit $(LIMIT),)'

# Send the one-shot abandoned-checkout recovery nudge to every user who started
# Stripe Checkout (billing_checkout_started audit event) but never landed a
# stripe_subscription_id, inside the [now-LOOKBACK_HOURS, now-LAG_HOURS] window
# (defaults 168h/24h). Founding-eligible users (while the lock-in deadline is
# open) get founding-deadline copy; otherwise, if the public promo is live,
# promo copy whose Basic/Pro rates are resolved LIVE from Stripe (never
# hardcoded); otherwise a generic "pick up where you left off". Idempotent via
# users.checkout_recovery_email_sent_at. This is the target the
# zerogex-web-checkout-recovery.timer fires (make checkout-recovery YES=1).
# DRY_RUN=1 previews eligible users, YES=1 sends, PREVIEW_TO=<email> renders one
# sample (PREVIEW_FOUNDING=1 forces the founding variant); LAG_HOURS/LOOKBACK_HOURS
# override the window.
checkout-recovery:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-checkout-recovery.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),) $(if $(PREVIEW_FOUNDING),--preview-founding,) $(if $(LAG_HOURS),--lag-hours $(LAG_HOURS),) $(if $(LOOKBACK_HOURS),--lookback-hours $(LOOKBACK_HOURS),)'

# Send the one-shot founding final-call urgency email to every founding-eligible
# user who hasn't yet redeemed, in the final hours before
# FOUNDING_LOCKIN_DEADLINE_ISO (the script refuses to send once the deadline has
# passed — the email points at /founding, which 404s after the cutoff). The
# offer's first-year/standard rates and lifetime % are resolved LIVE from Stripe.
# Idempotent via users.founding_final_call_email_sent_at. DRY_RUN=1 previews
# eligible users, YES=1 sends, PREVIEW_TO=<email> renders one sample.
founding-final-call:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-founding-final-call.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),)'

# Read-only deep dump of one user — DB row, last 20 audit events, live Stripe
# customer/subscription/invoice state, and a short interpretation that flags
# why the July-1 founding deferral might or might not have applied. Use when
# a founder reports an unexpected immediate charge or status mismatch.
# Usage: make diagnose-user EMAIL=foo@example.com
diagnose-user:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make diagnose-user EMAIL=foo@example.com)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/diagnose-user.mts --email $(EMAIL)'

# Decompose the admin Total Subscribers chart and account for every
# subscription-carrying account it does NOT count, so a headcount move is
# explainable without re-reading the monitoring SQL. The aggregate sibling of
# `make diagnose-user`: that one answers "why is THIS person not counted", this
# one answers "why did the number move". Read-only.
# Usage: make subscriber-headcount [NAMES=1]
subscriber-headcount:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/subscriber-headcount.mts $(if $(NAMES),--names,)'

# Restore a member whose payment was ORPHANED: Stripe exhausted its retries on a
# failed charge and canceled the subscription (dropping them to public), and the
# member then paid the still-open invoice from one of Stripe's dunning emails.
# Stripe does not resurrect a canceled subscription when its final invoice is
# paid out of band, so only invoice.paid fires — money in, no tier. The webhook
# now catches this live (maybeRecoverOrphanPayment); this is the manual twin for
# payments orphaned before that shipped, whose invoice.paid is already recorded
# in stripe_webhook_events and so cannot be replayed from the Dashboard.
#
# Re-creates the SAME plan with billing_cycle_anchor at the END of the period the
# invoice paid for and proration_behavior=none, so the member gets exactly the
# access they bought and is NOT charged again for it. Refuses to act if the
# customer already has a live subscription or if the invoice was already
# recovered. Dry-run by default.
# Usage:
#   make recover-orphan-payment EMAIL=foo@example.com
#   make recover-orphan-payment EMAIL=foo@example.com YES=1
#   make recover-orphan-payment EMAIL=foo@example.com INVOICE=in_123 YES=1
# Sweep the whole customer base for orphaned payments — read-only.
#   make scan-orphan-payments
#   make scan-orphan-payments SINCE_DAYS=365 VERBOSE=1
scan-orphan-payments:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/scan-orphan-payments.mts $(if $(SINCE_DAYS),--since-days $(SINCE_DAYS),) $(if $(VERBOSE),--verbose,)'

recover-orphan-payment:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make recover-orphan-payment EMAIL=foo@example.com)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/recover-orphan-payment.mts --email $(EMAIL) $(if $(INVOICE),--invoice $(INVOICE),) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Print the signed one-click self-serve SAVE url (app/save/route.ts) for a member
# plus their current eligibility, so you can test the retention flow in a browser
# without waiting for a real cancellation email. Read-only.
#   make save-url EMAIL=foo@example.com
save-url:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make save-url EMAIL=foo@example.com)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/print-save-url.mjs --email $(EMAIL)'

# TESTING: clear a member's one-shot self-serve SAVE latch
# (users.retention_offer_claimed_at) so the /save one-click flow can be claimed
# again. Local DB write only; never touches Stripe. Pair with set-cancellation
# ON=1 to re-arm the full flow.
#   make reset-save-latch EMAIL=foo@example.com
reset-save-latch:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make reset-save-latch EMAIL=foo@example.com)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/reset-save-latch.mjs --email $(EMAIL)'

# Reset ONE account to a clean pre-signup state (tier=public, subscription mirror
# and trial/lifecycle latches cleared) so you can re-run signup + plan switching.
# TESTING TOOL — wipes local subscription history; never calls Stripe. Dry-run by
# default; APPLY=1 to write. KEEP_FOUNDING=1 / KEEP_CUSTOMER=1 preserve those.
# Usage: make reset-user-for-testing EMAIL=foo@example.com [APPLY=1]
reset-user-for-testing:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make reset-user-for-testing EMAIL=foo@example.com)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/reset-user-for-testing.mjs --email $(EMAIL) $(if $(APPLY),--apply,) $(if $(KEEP_FOUNDING),--keep-founding,) $(if $(KEEP_CUSTOMER),--keep-customer,)'

# Detach duplicate (same card fingerprint or same Link email) payment methods
# from Stripe customers, always keeping the default / subscription method.
# Dry-run by default; APPLY=1 to detach; INSPECT=1 to just list what a customer
# has (type, fingerprint, Link email, which are protected). Target one customer
# with EMAIL=... or CUSTOMER=cus_... (works on orphaned customers), or ALL=1.
# Usage: make dedupe-payment-methods CUSTOMER=cus_... INSPECT=1
#        make dedupe-payment-methods EMAIL=foo@example.com APPLY=1   (or ALL=1)
dedupe-payment-methods:
	@if [ -z "$(EMAIL)" ] && [ -z "$(CUSTOMER)" ] && [ -z "$(ALL)" ]; then echo "Error: provide EMAIL=<addr>, CUSTOMER=cus_..., or ALL=1"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/dedupe-payment-methods.mjs $(if $(CUSTOMER),--customer $(CUSTOMER),$(if $(EMAIL),--email $(EMAIL),--all)) $(if $(INSPECT),--inspect,) $(if $(APPLY),--apply,)'

# Manually lengthen ONE customer's free trial (e.g. to thank a helpful early
# user) by pushing out the Stripe subscription's trial_end. Everything else
# stays automatic: Stripe re-schedules the trial->paid cutover to the new date,
# the webhook re-mirrors current_period_end, and the ~48h reminder email is
# re-armed so it fires before the new charge date — exactly as for any trial.
# Only touches subscriptions Stripe reports as 'trialing'. Run
# `make diagnose-user EMAIL=...` first to confirm she's actually on a trial.
# Examples:
#   make extend-trial EMAIL=foo@example.com EXTEND_DAYS=14 DRY_RUN=1
#   make extend-trial EMAIL=foo@example.com EXTEND_DAYS=14 YES=1
#   make extend-trial EMAIL=foo@example.com TRIAL_END=2026-08-01T13:30:00Z YES=1
extend-trial:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make extend-trial EMAIL=foo@example.com EXTEND_DAYS=14 DRY_RUN=1)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/extend-trial.mts --email $(EMAIL) $(if $(EXTEND_DAYS),--extend-days $(EXTEND_DAYS),) $(if $(TRIAL_END),--trial-end $(TRIAL_END),) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Interactive end-to-end quarterly Folds of Honor receipt workflow.
# Prompts for amount/quarter/date, updates content/giving/totals.json,
# commits, pushes to release, and rebuilds. Never posts to X — prints
# the tweet copy for you to paste. See docs/quarterly-receipt-workflow.md
# for the full loop.
#
# Examples:
#   make quarterly-receipt                                                 # fully interactive
#   make quarterly-receipt DRY_RUN=1                                       # preview, no changes
#   make quarterly-receipt AMOUNT=1247.50 QUARTER="Q3 2026" DATE=2026-09-30 YES=1  # non-interactive
#   make quarterly-receipt EMAIL=founder@zerogex.io                        # + email the tweet draft
#   make quarterly-receipt NO_REBUILD=1                                    # commit+push, skip rebuild
quarterly-receipt:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/quarterly-receipt.mts $(if $(AMOUNT),--amount $(AMOUNT),) $(if $(QUARTER),--quarter "$(QUARTER)",) $(if $(DATE),--date $(DATE),) $(if $(EMAIL),--email $(EMAIL),) $(if $(NO_PUSH),--no-push,) $(if $(NO_REBUILD),--no-rebuild,) $(if $(YES),--yes,) $(if $(DRY_RUN),--dry-run,)'

# Send the "time to make the FOH donation" reminder email to the admin.
# Auto-detects the just-closed calendar quarter. Ships the actual four-step
# instructions inside the email so the admin never has to look them up. Runs
# four times a year via the systemd timer installed by deploy step 095 (see
# deploy/systemd/zerogex-web-foh-donation-reminder.timer). Also runnable by
# hand for testing or a manual re-send.
#
# Env: RESEND_API_KEY, RESEND_FROM_EMAIL required. Recipient comes from
# --to flag OR the FOH_REMINDER_EMAIL env var (set in frontend/.env.local).
#
# Examples:
#   make foh-donation-reminder DRY_RUN=1                         # preview text of the email
#   make foh-donation-reminder TO=founder@zerogex.io             # send to a specific address
#   make foh-donation-reminder QUARTER="Q3 2026"                 # override auto-detected quarter
foh-donation-reminder:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-foh-donation-reminder.mts $(if $(TO),--to $(TO),) $(if $(QUARTER),--quarter "$(QUARTER)",) $(if $(DRY_RUN),--dry-run,)'

# Signup-rate alarm: emails the operator if NEW registrations flatline (fewer
# than SIGNUP_ALARM_MIN accounts created in the trailing SIGNUP_ALARM_WINDOW_HOURS).
# Reads the auth DB only. Runs hourly via the systemd timer installed by deploy
# step 096 (deploy/systemd/zerogex-web-signup-alarm.timer); the active-hours
# gate + cooldown latch are in the script, so an off-hours tick is a cheap
# no-op. Also runnable by hand for testing.
#
# Env: RESEND_API_KEY, RESEND_FROM_EMAIL required. Recipient comes from --to,
# then SIGNUP_ALARM_EMAIL, then FOH_REMINDER_EMAIL (frontend/.env.local).
# Tunables (all optional, .env.local): SIGNUP_ALARM_WINDOW_HOURS (5),
# SIGNUP_ALARM_MIN (1), SIGNUP_ALARM_ACTIVE_START_ET (10),
# SIGNUP_ALARM_ACTIVE_END_ET (22), SIGNUP_ALARM_COOLDOWN_HOURS (12).
#
# Examples:
#   make signup-alarm FORCE=1 DRY_RUN=1        # preview the decision, never sends
#   make signup-alarm FORCE=1                  # force a real send now (test the email)
#   make signup-alarm WINDOW=3 MIN=1           # ad-hoc check over a 3h window
signup-alarm:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-signup-alarm.mts $(if $(TO),--to $(TO),) $(if $(WINDOW),--window $(WINDOW),) $(if $(MIN),--min $(MIN),) $(if $(FORCE),--force,) $(if $(DRY_RUN),--dry-run,)'

# Flip ONE customer's cancel_at_period_end flag on their Stripe subscription.
# OFF=1 stops a scheduled cancellation (the sub renews, or — on a trial —
# converts to paid and charges at trial_end); ON=1 schedules a cancel at period
# end (access until then, no further charge). The webhook mirrors the flag onto
# the users row automatically; this also writes it directly for immediacy.
# Only touches trialing/active subs. Sends NO email. NOTE: clearing the flag on
# someone who chose to cancel means she'll be charged at period end unless she
# cancels again — tell her, or a surprise charge invites a dispute.
# Examples:
#   make set-cancellation EMAIL=foo@example.com OFF=1 DRY_RUN=1
#   make set-cancellation EMAIL=foo@example.com OFF=1 YES=1
#   make set-cancellation EMAIL=foo@example.com ON=1 YES=1
set-cancellation:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make set-cancellation EMAIL=foo@example.com OFF=1 DRY_RUN=1)"; exit 1; fi
	@if [ -z "$(ON)" ] && [ -z "$(OFF)" ]; then echo "Error: pass ON=1 or OFF=1"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/set-cancellation.mts --email $(EMAIL) $(if $(OFF),--off,) $(if $(ON),--on,) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Immediately cancel ONE customer's Stripe subscription and downgrade them to
# 'public' — the path set-cancellation can't take (it only flips
# cancel_at_period_end on a trialing/active sub and refuses past_due/unpaid).
# Use for a trial that failed to convert and is stuck in past_due / the payment-
# recovery grace + Stripe dunning cycle. VOID_INVOICE=1 also voids every still-
# open invoice on the sub, which is what actually stops Stripe's retry attempts
# on the failed charge (canceling alone does not void an open invoice). The
# webhook mirrors the downgrade (tier=public, sub mirror cleared, API keys
# revoked); this writes it directly too for immediacy. Keeps the account (use
# make delete-user to remove it). Sends NO email. Refuses an active/trialing sub
# unless FORCE=1 (that ends paid access immediately, no refund — prefer
# set-cancellation ON=1 for those). Run `make diagnose-user EMAIL=...` first.
# Examples:
#   make cancel-subscription EMAIL=foo@example.com DRY_RUN=1
#   make cancel-subscription EMAIL=foo@example.com VOID_INVOICE=1 YES=1
#   make cancel-subscription EMAIL=foo@example.com FORCE=1 VOID_INVOICE=1 YES=1
cancel-subscription:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make cancel-subscription EMAIL=foo@example.com VOID_INVOICE=1 DRY_RUN=1)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/cancel-subscription.mts --email $(EMAIL) $(if $(VOID_INVOICE),--void-invoice,) $(if $(FORCE),--force,) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Honor the evergreen win-back "reply 'discount'" offer for ONE member by hand:
# STACK a "25% off for one year" coupon on top of any discounts already on their
# subscription (existing coupons are preserved, never stripped), and — unless
# KEEP_CANCELLATION=1 — clear cancel_at_period_end so a trialing sub converts to
# paid at trial_end (an active one renews) on the card already on file. No
# re-subscribe. The manual twin of the automated ?winback=1 checkout path.
# Coupon resolution: COUPON=<id> pins an exact coupon; otherwise the standing
# STRIPE_COUPON_WINBACK_<TIER>_<CADENCE> env for the member's plan; otherwise
# CREATE_COUPON=1 mints a deterministic PERCENT%-off (default 25) 1-year coupon
# (annual: duration=once; monthly: repeating 12 months). Sends NO email — reply
# to the member yourself. Run `make diagnose-user EMAIL=...` first to confirm
# status/plan/discounts. Examples:
#   make honor-winback-discount EMAIL=foo@example.com DRY_RUN=1
#   make honor-winback-discount EMAIL=foo@example.com CREATE_COUPON=1 YES=1
#   make honor-winback-discount EMAIL=foo@example.com COUPON=winback25 YES=1
honor-winback-discount:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make honor-winback-discount EMAIL=foo@example.com DRY_RUN=1)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/honor-winback-discount.mts --email $(EMAIL) $(if $(COUPON),--coupon $(COUPON),) $(if $(CREATE_COUPON),--create-coupon,) $(if $(PERCENT),--percent $(PERCENT),) $(if $(KEEP_CANCELLATION),--keep-cancellation,) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

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
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/grant-partner-pro.mts --email $(EMAIL) $(if $(DAYS),--days $(DAYS),) $(if $(COMMISSION_BPS),--commission-bps $(COMMISSION_BPS),) $(if $(WINDOW_MONTHS),--window-months $(WINDOW_MONTHS),) $(if $(PROMO_CODE),--promo-code $(PROMO_CODE),) $(if $(COUPON_ID),--coupon-id $(COUPON_ID),) $(if $(DISCLOSURE_URL),--disclosure-url $(DISCLOSURE_URL),) $(if $(X_HANDLE),--x-handle $(X_HANDLE),) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Move ONE paying member up a tier while LEAVING THEIR BILL WHERE IT IS --
# "you're paying for Basic, I'm giving you Pro at the price you already pay."
# A goodwill upgrade, not a comp: they keep paying, you just stop charging more
# for the better tier. For an actual freebie (no subscription at all), that's
# comp-member below.
#
# Do not hand-roll this as a tier flip. priceIdToTier (core/stripe.ts) derives
# the tier from the Stripe PRICE and every subscription sync recomputes it, so
# writing tier='pro' by hand holds only until the member's next renewal. This
# target instead switches the subscription onto the target tier's price and
# discounts it back down to what they pay today, so the webhook grants the tier
# itself -- and it therefore survives renewals.
#
# The held rate is read from the upcoming-invoice preview, i.e. net of any
# discount already on the sub (a discounted member must not get a stealth rise);
# override with CURRENT_PRICE=<dollars> if that preview isn't a representative
# full period. Existing discounts are REPLACED, not stacked -- an old coupon was
# sized against the old list price. Nothing is charged today
# (proration_behavior=none) and the member keeps the period they already paid
# for. Sends NO email -- write to the member yourself. Run
# `make diagnose-user EMAIL=...` first.
# Usage:
#   make upgrade-at-current-price EMAIL=foo@example.com DRY_RUN=1
#   make upgrade-at-current-price EMAIL=foo@example.com YES=1
#   make upgrade-at-current-price EMAIL=foo@example.com CURRENT_PRICE=19 YES=1
UPGRADE_TIER ?= pro
upgrade-at-current-price:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make upgrade-at-current-price EMAIL=foo@example.com DRY_RUN=1)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/upgrade-at-current-price.mts --email $(EMAIL) --tier $(if $(TIER),$(TIER),$(UPGRADE_TIER)) $(if $(CURRENT_PRICE),--current-price $(CURRENT_PRICE),) $(if $(COUPON),--coupon $(COUPON),) $(if $(WAIT_SECONDS),--wait-seconds $(WAIT_SECONDS),) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Permanently comp ONE member onto a paid tier for free -- the "thanks for the
# bug report, here's Pro on the house" path. Handles both shapes of account: a
# member with no subscription (bare tier flip) and a PAYING member, whose live
# subscription has to be retired first IN A SPECIFIC ORDER.
#
# Do not hand-roll this with update-user-tier. Both natural orderings are wrong:
# flipping the tier on a paying member does not hold (every subscription sync
# recomputes tier from the Stripe price, so their next renewal silently reverts
# it -- and they keep being charged), while canceling AFTER granting the comp
# destroys it (subscription.deleted hard-sets tier='public', leaving them BELOW
# where they started). This target cancels first, WAITS for the deleted webhook
# to actually land, and only then writes the comped tier.
#
# REFUND=1 also refunds the member's most recent paid invoice -- canceling is
# not a refund, and a member mid-period has already paid for time you are about
# to give away. FINALIZE=1 skips the cancel and just lands the comp; use it if
# the webhook wait times out (the script tells you when). Sends NO email --
# write to the member yourself. Run `make diagnose-user EMAIL=...` first.
# Usage:
#   make comp-member EMAIL=foo@example.com DRY_RUN=1
#   make comp-member EMAIL=foo@example.com REFUND=1 YES=1
#   make comp-member EMAIL=foo@example.com FINALIZE=1 YES=1
# List every hold-steady coupon `upgrade-at-current-price` has ever minted and
# say which are still applied to the member they were minted for. Read-only.
# Anything marked ORPHAN is applied to nothing and is safe to delete in Stripe;
# deleting a coupon never disturbs discounts already applied elsewhere. The
# configured STRIPE_COUPON_* coupons from .env.local are never listed here and
# must never be deleted -- every paying member shares those.
# Usage:
#   make held-rate-coupons
held-rate-coupons:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/upgrade-at-current-price.mts --list-orphans'

COMP_TIER ?= pro
comp-member:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make comp-member EMAIL=foo@example.com DRY_RUN=1)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/comp-member.mts --email $(EMAIL) --tier $(if $(TIER),$(TIER),$(COMP_TIER)) $(if $(REFUND),--refund,) $(if $(FINALIZE),--finalize,) $(if $(WAIT_SECONDS),--wait-seconds $(WAIT_SECONDS),) $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

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

# Roster of every Creator Partner (partner_tier='creator'): X handle,
# referral + audience promo codes, commission rate/window, Pro-grant expiry,
# activation date, and FTC disclosure URL. Read-only. This is the "who are my
# partners" view; partner-commissions below is the "what do I owe them" view.
# Filter to one partner with EMAIL=.
partners:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-partners.mjs $(if $(EMAIL),--email $(EMAIL),)'

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

# List every customer whose subscription is currently canceled, and when they
# canceled. Two states: pending (users.cancel_at_period_end=1 — clicked Cancel,
# still has access until current_period_end) and lapsed (users.subscription_
# lapsed=1 — subscription ended, tier reset to public; dated by the latest
# 'stripe_subscription_deleted' audit event). Default prints a table sorted
# most-recent-first. STATUS=pending|lapsed filters to one state, EMAILS=1 prints
# a paste-ready recipient list, CSV=1 exports id,email,status,cancelled_at,
# access_ends_at,tier with full ISO timestamps, and SINCE=<YYYY-MM-DD> restricts
# to cancellations on/after a cutoff.
cancellation-alerts:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-cancellation-alerts.mts $(if $(TO),--to $(TO),) $(if $(SINCE),--since $(SINCE),) $(if $(LOOKBACK),--lookback $(LOOKBACK),) $(if $(LIMIT),--limit $(LIMIT),) $(if $(KIND),--kind $(KIND),) $(if $(PREVIEW_TO),--preview $(PREVIEW_TO),) $(if $(THROTTLE_MS),--throttle-ms $(THROTTLE_MS),) $(if $(INCLUDE_SILENT_LAPSES),--include-silent-lapses,) $(if $(MARK_ONLY),--mark-only,) $(if $(DRY_RUN),--dry-run,)'

cancellations:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-cancellations.mjs $(if $(STATUS),--status $(STATUS),) $(if $(EMAILS),--emails,) $(if $(CSV),--csv,) $(if $(SINCE),--since $(SINCE),)'

# Decompose a recent cancellation spike into its actionable parts. Trial users
# bailing before the first charge (a conversion problem) and established paid
# members leaving (a value/positioning problem) both show up as one "cancel" bar
# on the dashboard but need opposite fixes; this splits them, and adds tenure
# (trial-cliff detector), signup source, a daily timeline, and any captured
# Stripe cancel reasons. Read-only. WINDOW defaults to 14 days.
#   make churn-breakdown
#   make churn-breakdown WINDOW=7
#   make churn-breakdown SINCE=2026-07-24 CSV=1 > churn.csv
churn-breakdown:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/churn-breakdown.mjs $(if $(WINDOW),--window $(WINDOW),) $(if $(SINCE),--since $(SINCE),) $(if $(CSV),--csv,)'

# One-shot: write the refund_issued audit rows for refunds issued before the
# webhook recorded them. The old charge.refunded handler logged only when a
# partner commission reversed, so refunds to members without a referrer left no
# trace — and Stripe keeps a refunded invoice 'paid', so diagnose-user showed
# the money leaving with nothing explaining it. Idempotent; rows carry the
# refund's own timestamp, not the run time. Always start with DRY_RUN=1.
#   make backfill-refund-audit DRY_RUN=1
#   make backfill-refund-audit YES=1
#   make backfill-refund-audit DRY_RUN=1 SINCE=2026-06-01
backfill-refund-audit:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/backfill-refund-audit.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(SINCE),--since $(SINCE),) $(if $(LIMIT),--limit $(LIMIT),)'

# Enable the Stripe billing-portal cancellation survey so every future cancel
# records WHY (a feedback enum + optional free-text comment). Without this the
# webhook's new reason-capture has nothing to capture — Stripe only sends
# cancellation_details when the portal's cancellation flow collects a reason.
# Updates the portal configuration named by STRIPE_PORTAL_CONFIG_ID (or the
# account's default). CHANGES THE LIVE CUSTOMER-FACING PORTAL.
#   make enable-portal-cancel-reasons DRY_RUN=1
#   make enable-portal-cancel-reasons YES=1
enable-portal-cancel-reasons:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/enable-portal-cancel-reasons.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,)'

# Backup Admin->Monitoring data files (frontend/data/monitoring.json,
# signups.json, and mrr.json) into a timestamped tar.gz. signups.json and
# mrr.json hold the append-only daily subscriber/MRR history and are the only
# copy of it, so this is what keeps those daily numbers durable off-box.
# Defaults to a dir OUTSIDE the repo so archives are not swept into the
# whole-app backup or git. Files are written atomically by the app, so this is
# safe to run live. Set S3_BUCKET to also upload (e.g.
# S3_BUCKET=s3://my-bucket/zerogex). Prunes local archives older than
# BACKUP_RETENTION_DAYS (default 30).
BACKUP_DIR ?= $(HOME)/zerogex-monitoring-backups
BACKUP_RETENTION_DAYS ?= 30
backup-monitoring:
	@if [ ! -f frontend/data/monitoring.json ] && [ ! -f frontend/data/signups.json ] && [ ! -f frontend/data/mrr.json ]; then \
		echo "No monitoring data found in frontend/data/ (nothing to back up)."; \
		exit 0; \
	fi; \
	mkdir -p "$(BACKUP_DIR)"; \
	ts=$$(date +%Y%m%d-%H%M%S); \
	archive="$(BACKUP_DIR)/monitoring-data-$$ts.tar.gz"; \
	files=""; \
	if [ -f frontend/data/monitoring.json ]; then files="$$files monitoring.json"; fi; \
	if [ -f frontend/data/signups.json ]; then files="$$files signups.json"; fi; \
	if [ -f frontend/data/mrr.json ]; then files="$$files mrr.json"; fi; \
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
# Floor: ALWAYS keep the newest AUTH_BACKUP_KEEP archives, even if older than
# AUTH_BACKUP_RETENTION_DAYS. 48 = two days of hourly backups. The auth DB is
# Tier-1 (only copy of every account, password hash, session, user->Stripe
# mapping; RPO ~1h), so an unfloored `find -mtime +N -delete` is a footgun: if
# backup-auth ever stalls (bad creds, full disk) it would keep deleting until
# ZERO backups remain. Set AUTH_BACKUP_KEEP=0 for raw mtime-only behavior.
AUTH_BACKUP_KEEP ?= 48

# Prune local auth-DB backup archives with a keep-newest-K FLOOR. Deletes
# auth-*.db.gz* older than AUTH_BACKUP_RETENTION_DAYS but ALWAYS keeps the newest
# AUTH_BACKUP_KEEP regardless of age. This is the ONE auth-backup pruner in the
# repo: `make backup-auth` calls it after each hourly snapshot AND the nightly
# `make janitor` calls it — same logic, two schedules, never a divergent second
# pruner. The floor is the safety net: even if EVERY archive is older than N
# days (a stalled backup), the newest K survive. AUTH_BACKUP_KEEP=0 restores the
# raw mtime-only behavior. Skips cleanly if the dir is absent; per-item rm errors
# are swallowed so one bad file can't fail the run.
auth-backups-prune:
	@if [ ! -d "$(AUTH_BACKUP_DIR)" ]; then \
		echo "auth-backups: $(AUTH_BACKUP_DIR) not present — skipping"; \
	else \
		total=$$(find "$(AUTH_BACKUP_DIR)" -maxdepth 1 -type f -name 'auth-*.db.gz*' 2>/dev/null | wc -l); \
		if [ "$$total" -le "$(AUTH_BACKUP_KEEP)" ]; then \
			echo "auth-backups: $$total archive(s) <= keep-floor $(AUTH_BACKUP_KEEP) — nothing pruned"; \
		else \
			pruned_list=$$(ls -1t "$(AUTH_BACKUP_DIR)"/auth-*.db.gz* 2>/dev/null | tail -n +$$(( $(AUTH_BACKUP_KEEP) + 1 )) | \
				while read -r f; do \
					if [ -n "$$(find "$$f" -maxdepth 0 -mtime +$(AUTH_BACKUP_RETENTION_DAYS) -print 2>/dev/null)" ]; then \
						rm -f "$$f" && echo "$$f"; \
					fi; \
				done); \
			if [ -n "$$pruned_list" ]; then \
				printf '%s\n' "$$pruned_list" | sed 's/^/  pruned /'; \
				count=$$(printf '%s\n' "$$pruned_list" | wc -l | tr -d ' '); \
				echo "auth-backups: pruned $$count archive(s) older than $(AUTH_BACKUP_RETENTION_DAYS)d beyond the newest-$(AUTH_BACKUP_KEEP) floor ($(AUTH_BACKUP_DIR))"; \
			else \
				echo "auth-backups: nothing older than $(AUTH_BACKUP_RETENTION_DAYS)d beyond the newest-$(AUTH_BACKUP_KEEP) floor — kept all $$total ($(AUTH_BACKUP_DIR))"; \
			fi; \
		fi; \
	fi

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
	echo "Backup complete. Local dir: $(AUTH_BACKUP_DIR)."
	@# floored prune (the SAME target the nightly janitor runs — one pruner, not
	@# two); leading '-' makes it non-fatal so a prune hiccup never fails a backup
	-@$(MAKE) --no-print-directory auth-backups-prune

# ---------------------------------------------------------------------------
# Nightly janitor — retention + regenerable-cache cleanup (all zerogex-web's own)
# ---------------------------------------------------------------------------
# Three safe/regenerable jobs: (1) prune old auth-DB backups with the
# keep-newest-K floor (the shared auth-backups-prune target), (2) delete ONLY
# the Next.js build CACHE (frontend/.next/cache — never the built .next output),
# and (3) clean the npm cache as the app user (never root). `make janitor`
# prints the plan and waits for a typed 'yes'; `make janitor-noconfirm` is what
# the systemd timer fires. Every external tool is `command -v` guarded and
# per-item errors are swallowed so a missing tool/path can never fail the run.
NEXT_CACHE_DIR ?= frontend/.next/cache
APP_USER ?= ubuntu

janitor:
	@echo "Nightly janitor will:"
	@echo "  1. Prune $(AUTH_BACKUP_DIR)/auth-*.db.gz* older than $(AUTH_BACKUP_RETENTION_DAYS)d, keeping the newest $(AUTH_BACKUP_KEEP)"
	@echo "  2. Delete the Next.js build cache $(NEXT_CACHE_DIR) (regenerated on next build; the built .next output is left intact)"
	@echo "  3. npm cache clean --force (as $(APP_USER), never root)"
	@printf "Proceed? type 'yes': "; \
	read -r ans; \
	if [ "$$ans" != "yes" ]; then echo "aborted."; exit 1; fi
	@$(MAKE) --no-print-directory janitor-noconfirm

janitor-noconfirm:
	@echo "janitor: pruning auth-DB backups (keep-newest-$(AUTH_BACKUP_KEEP) floor)..."
	@$(MAKE) --no-print-directory auth-backups-prune
	@echo "janitor: clearing Next.js build cache ($(NEXT_CACHE_DIR))..."
	@if [ -d "$(NEXT_CACHE_DIR)" ]; then \
		rm -rf "$(NEXT_CACHE_DIR)" && echo "  cleared $(NEXT_CACHE_DIR) (regenerated on next build)" || echo "  WARNING: could not remove $(NEXT_CACHE_DIR)"; \
	else \
		echo "  $(NEXT_CACHE_DIR) not present — skipping"; \
	fi
	@echo "janitor: cleaning npm cache (as $(APP_USER), never root)..."
	@if [ "$$(id -un)" = "root" ] && [ "$(APP_USER)" != "root" ] && id -u "$(APP_USER)" >/dev/null 2>&1; then \
		sudo -u "$(APP_USER)" -H bash -lc 'source "$$HOME/.nvm/nvm.sh" >/dev/null 2>&1; nvm use 22 >/dev/null 2>&1 || true; if command -v npm >/dev/null 2>&1; then npm cache clean --force >/dev/null 2>&1 && echo "  npm cache cleaned" || echo "  npm cache clean failed (ignored)"; else echo "  npm not found — skipping"; fi' || true; \
	else \
		bash -lc 'source "$$HOME/.nvm/nvm.sh" >/dev/null 2>&1; nvm use 22 >/dev/null 2>&1 || true; if command -v npm >/dev/null 2>&1; then npm cache clean --force >/dev/null 2>&1 && echo "  npm cache cleaned" || echo "  npm cache clean failed (ignored)"; else echo "  npm not found — skipping"; fi' || true; \
	fi
	@echo "janitor: done."

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf frontend/.next
	rm -rf frontend/node_modules/.cache
	@echo "Clean complete!"

# Copy logos from assets to public
#
# The brand lockups ship as PNGs with a transparent margin baked in, and the
# margin differs per file, so they go through scripts/trim-png.js rather than
# cp: it crops to the artwork and caps the resolution, which is what lets the
# header/footer size the logo by height and get the same result in both themes.
# Prefer whatever node is on PATH, falling back to the deploy box's nvm-managed
# Node 22 (the same one `make build` uses).
TRIM_PNG = bash -lc 'if ! command -v node >/dev/null 2>&1; then source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null; fi; exec node scripts/trim-png.js "$$@"' trim-png

OG_MANIFEST = bash -lc 'if ! command -v node >/dev/null 2>&1; then source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null; fi; exec node scripts/og-image-manifest.js'

NT_MANIFEST = bash -lc 'if ! command -v node >/dev/null 2>&1; then source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null; fi; exec node scripts/ninjatrader-manifest.js'

INTEGRATION_ASSETS = bash -lc 'if ! command -v node >/dev/null 2>&1; then source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null; fi; exec node scripts/integration-assets-manifest.js'
OG_CHECK = bash -lc 'if ! command -v node >/dev/null 2>&1; then source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null; fi; exec node scripts/og-image-manifest.js --live'

logo:
	@echo "Copying logos from assets to public..."
	@$(TRIM_PNG) assets/branding/Dark_Full.png frontend/public/logo-dark.png --max-width 1024
	@$(TRIM_PNG) assets/branding/Light_Full.png frontend/public/logo-light.png --max-width 1024
	@$(TRIM_PNG) assets/branding/Dark_Title.png frontend/public/title-dark.png --max-width 1280
	@$(TRIM_PNG) assets/branding/Light_Title.png frontend/public/title-light.png --max-width 1280
# Email lockups. These used to be a hand-made PNG committed under
# frontend/public/email/, which is exactly why the campaign emails were still
# showing the pre-August logo months after `make logo` had refreshed every
# other surface -- nothing regenerated it. Deriving them here means a
# re-export from the design tool reaches the emails like it reaches the site.
#
# Always the DARK variants: both lockups sit on the navy header/footer bands,
# and per core/brand.ts the dark variant is the one carrying the light wordmark.
# Sized at 2x their CSS width (400px header, 240px footer) for retina.
#
# Deliberately NEW filenames rather than overwriting zerogex-header.png:
# zerogex.io is proxied through Cloudflare, which caches .png per edge and is
# never purged on deploy (same reasoning as the hashed og-image and favicon
# URLs below), so replacing the bytes in place could serve the old artwork to
# recipients for days. The old file stays put for the already-sent July send.
	@mkdir -p frontend/public/email
	@$(TRIM_PNG) assets/branding/Dark_Title.png frontend/public/email/zerogex-email-header.png --max-width 800
	@$(TRIM_PNG) assets/branding/Dark_Full.png frontend/public/email/zerogex-email-footer.png --max-width 480
# The social card goes through scripts/og-image-manifest.js rather than a plain
# cp. That script hashes the PNG's bytes into its filename and regenerates
# frontend/core/ogImageManifest.ts, so replacing the artwork produces a new URL
# for the og:image/twitter:image tags. The old fixed /og-image.png URL never
# moved, and zerogex.io is proxied through Cloudflare (which caches .png per
# edge and is never purged on deploy), so a scraper re-crawling the page could
# be handed the previous artwork days after the new one shipped -- and re-pin
# it. Same reasoning as the hashed favicon URL below.
	@$(OG_MANIFEST)
# The favicon goes to frontend/app/, not frontend/public/. Next's App Router
# treats app/favicon.ico as a metadata file: it serves it at /favicon.ico and
# emits <link rel="icon" href="/favicon.ico?favicon.<hash>.ico">, where the
# hash is derived from that file's bytes. That hash is the cache-buster, and
# it only moves when app/favicon.ico moves -- a copy dropped in public/ shadows
# the served bytes but leaves the hash (and so every browser's cached icon)
# untouched, which is why a new favicon used to keep showing up as the old one.
# The rm clears that shadowing copy from boxes deployed before this change;
# public/favicon.ico is gitignored, so `git pull` alone would never remove it.
#
# That rm went missing at some point and this comment outlived it, so the
# shadow was only ever cleared by hand. It is restored below. The ignore rule
# the comment claims also did not exist until now, which is how a `git add -A`
# from a Mac came to commit one.
	@rm -f frontend/public/favicon.ico
	cp assets/branding/favicon.ico frontend/app/favicon.ico
	@echo "Copying Folds of Honor partner-kit assets..."
	@if [ -f assets/branding/folds-of-honor-proud-supporter.png ]; then \
		cp assets/branding/folds-of-honor-proud-supporter.png frontend/public/folds-of-honor-proud-supporter.png && \
		echo "  ✓ Proud Supporter badge"; \
	else \
		echo "  ⚠ folds-of-honor-proud-supporter.png missing — /giving badge will 404 until you drop the PNG at assets/branding/folds-of-honor-proud-supporter.png"; \
	fi
	@if [ -f assets/branding/folds-of-honor-donation-qr.png ]; then \
		cp assets/branding/folds-of-honor-donation-qr.png frontend/public/folds-of-honor-donation-qr.png && \
		echo "  ✓ Donation QR code"; \
	else \
		echo "  ⚠ folds-of-honor-donation-qr.png missing — /giving donation QR will 404 until you drop the PNG at assets/branding/folds-of-honor-donation-qr.png"; \
	fi
	@if [ -f assets/branding/folds-of-honor-boilerplate.pdf ]; then \
		cp assets/branding/folds-of-honor-boilerplate.pdf frontend/public/folds-of-honor-boilerplate.pdf; \
	fi
	@echo "Logos copied successfully!"

# Answer "why is X still showing the old og-image?" without re-deriving it by
# hand. The symptom has four causes -- a stale committed manifest, a box that
# has not redeployed, a deploy where `make logo` did not run, and X's own card
# cache -- and only the last one is invisible from the repo, so it is the one
# people waste time on. This checks the first three against the live site and,
# when they all pass, prints the cache workaround. Read-only and safe to run
# from anywhere with network; it never writes or deploys.
og-check:
	@$(OG_CHECK)

# Smoke-test the BFF consumer-tier gate against a running deployment. The unit
# suite (npm run test:api-tier-gate) proves the decision table; this proves the
# deployed BFF enforces it, and that no free page or paying member got locked
# out in the process. Read-only: issues GETs only, never writes or deploys.
#
#   make verify-gate                              # against https://zerogex.io
#   make verify-gate BASE=http://127.0.0.1:3000   # against a local build
#
# Member-side checks need a session cookie (zgx_session from a logged-in
# browser) and the tier that account is on:
#   ZGX_SESSION=<cookie> TIER=basic make verify-gate
verify-gate:
	@cd frontend && ./scripts/verify-api-tier-gate.sh $(BASE)

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

# Publish the packaged NinjaTrader import archive, when one has been dropped in.
#
# Only NinjaTrader itself can produce an archive its importer accepts (File ->
# Utilities -> Export NinjaScript). We deliberately do NOT synthesize one here:
# a hand-rolled zip that NT8 rejects is worse than no zip at all, because the
# download button would be live and broken. So this is a guarded copy in the
# same spirit as `make logo` -- drop the real export at
# assets/ninjatrader/ZeroGexGammaLevels.zip and it ships on the next deploy;
# until then the site offers the .cs source only and this step no-ops.
#
# The .cs in frontend/public/ninjatrader/ stays the source of record either way,
# and the archive is verified against it before publishing: the export is built
# on someone else's machine and then served from our domain, so we prove the
# source inside matches ours rather than trusting the sender. That same check
# catches a stale archive exported before the last edit to the .cs.
#
# Verification, publication and the manifest entry all now happen inside
# scripts/ninjatrader-manifest.js, so they cannot disagree. They used to: the
# verify+cp lived here and the manifest was written there, which meant a failed
# verification aborted the deploy at this step while the COMMITTED manifest went
# on advertising the archive it had refused to publish. Whoever then built
# without this target shipped a page whose download button pointed at a file
# nothing had ever written — the 404 a customer hits, with no way to tell from
# the page that anything is wrong.
#
# An unverifiable archive is therefore no longer fatal: it degrades to the
# documented .cs-only path (the same one taken when no archive exists at all)
# and warns. Withholding one download is not worth blocking a whole deploy —
# and the old hard failure blocked every unrelated fix in the same push.
# Does GEX rank predict where price reacts, or is the number next to each line
# decoration? Prompted by a tester who kept pointing at levels we had told him
# were noise -- GEX 7, 8, and then 10 marking the high of day to the tick --
# against advice ("past 5 is mostly noise") that had no measurement behind it.
#
# The controls are the point. Sixteen lines on a chart means "a level got
# touched" is nearly certain, so the script compares against the same strikes
# with their rank labels shuffled, and against random strikes on the same grid,
# and reports everything inside distance buckets because the largest gamma
# strike is not the nearest one.
gex-rank-backtest:
	@cd $(CURDIR) && python3 scripts/gex-rank-backtest.py $(if $(SELF_TEST),--self-test,--symbol $(or $(SYMBOL),NQ) --last $(or $(SESSIONS),120)) $(if $(RANKS),--ranks $(RANKS),) $(if $(JSON),--json $(JSON),)

ninjatrader-package:
	@echo "Publishing NinjaTrader package..."
	@mkdir -p frontend/public/ninjatrader
	@$(NT_MANIFEST)

# Content-addressed copies of the thinkorswim and Sierra Chart study sources.
#
# Same contract as ninjatrader-package above, minus the archive handling:
# frontend/core/integrationAssets.ts is COMMITTED so a plain build resolves,
# but the hashed files it names are GITIGNORED and written only here. Skip this
# on a box that has never run it and the two study pages ship download buttons
# pointing at files that are not on disk.
integration-assets:
	@echo "Publishing chart-platform study sources..."
	@$(INTEGRATION_ASSETS)

# Full deployment
deploy:
	@echo "Starting full deployment..."
	@echo "1. Pulling latest changes..."
	git pull
	@echo "2. Installing dependencies..."
# `npm ci` and not `npm install`: install writes package-lock.json, so every
# deploy re-resolved the ^ ranges to whatever was newest on npm and left the
# tree dirty on release -- prod picked up unreviewed transitive versions and
# then those pins got committed back from the box. ci installs exactly what
# the lockfile says and never writes it. Dependency bumps belong in dev, via
# `make install`, where they can be reviewed. NOTE: ci wipes node_modules and
# reinstalls from scratch, and it hard-fails if package.json and the lockfile
# disagree -- that failure is the point, but it stops the deploy before the
# PM2 restart in step 7.
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm ci'
	@echo "3. Copying logos..."
	@make logo
	@echo "4. Copying blog images..."
	@make blog-images
	@echo "5. Publishing NinjaTrader package..."
	@make ninjatrader-package
	@echo "5b. Publishing chart-platform study sources..."
	@make integration-assets
	@echo "6. Rebuilding application..."
	rm -rf frontend/.next
	cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && npm run build'
	@echo "7. Restarting PM2..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 restart zerogex-web'
	@echo "8. Saving PM2 config..."
	bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && pm2 save'
	@echo "Deployment complete!"
	@echo ""
	@make status
