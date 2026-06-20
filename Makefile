.PHONY: help install dev build rebuild start stop restart logs status users referrals migrate-tiers all-to-pro delete-user seed-founders grant-founding clear-zombie-customers webhook-health trial-reminders public-cohort diagnose-user backup-monitoring backup-auth clean deploy logo blog-images

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
	@echo "  make migrate-tiers - Migrate legacy starter/elite users to basic/pro (DRY_RUN=1 to preview)"
	@echo "  make all-to-pro - Promote every non-admin user to pro (DRY_RUN=1 to preview)"
	@echo "  make delete-user EMAIL=<email> - Delete a user (DRY_RUN=1 to preview, YES=1 to skip prompt)"
	@echo "  make seed-founders - Flag current users as founding_eligible (DRY_RUN=1 to preview, YES=1 to apply, BEFORE=<iso> for cutoff)"
	@echo "  make grant-founding EMAIL=<email> [GRANT_FOUNDING_TIER=pro] - Manual founding comp: set tier + founding_eligible=1 in one shot (DRY_RUN=1 to preview)"
	@echo "  make clear-zombie-customers - NULL stripe_customer_id on rows with no subscription (APPLY=1 to write, dry-run by default)"
	@echo "  make webhook-health - Stripe webhook health summary (errors/orphans/failed payments, last 24h + 7d)"
	@echo "  make trial-reminders - Send ~48h-before-trial-end reminder emails (DRY_RUN=1 to preview, YES=1 to send, PREVIEW_TO=<email> for a sample)"
	@echo "  make public-cohort - Break the tier='public' cohort into reactivation segments (EMAILS=1 for paste-ready lists, COHORT=<name> to filter, SHOW_LAST_LOGIN=1 to split warm/cold/never, WARM_DAYS=<n> to tune)"
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

# Send the ~48h-before-trial-end reminder email to every currently-trialing
# user whose first charge lands in the next ~48h (windowed +/- 3h so a
# multi-hour cron cadence still catches the cohort exactly once). Idempotent
# via users.trial_reminder_email_sent_at. Pass DRY_RUN=1 to preview eligible
# users, YES=1 to actually send. Pass PREVIEW_TO=<email> to render the email
# and send a single sample copy to that address (no DB writes).
trial-reminders:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/send-trial-reminders.mts $(if $(DRY_RUN),--dry-run,) $(if $(YES),--yes,) $(if $(PREVIEW_TO),--preview-to $(PREVIEW_TO),)'

# Read-only deep dump of one user — DB row, last 20 audit events, live Stripe
# customer/subscription/invoice state, and a short interpretation that flags
# why the July-1 founding deferral might or might not have applied. Use when
# a founder reports an unexpected immediate charge or status mismatch.
# Usage: make diagnose-user EMAIL=foo@example.com
diagnose-user:
	@if [ -z "$(EMAIL)" ]; then echo "Error: EMAIL is required (e.g. make diagnose-user EMAIL=foo@example.com)"; exit 1; fi
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --experimental-strip-types --no-warnings scripts/diagnose-user.mts --email $(EMAIL)'

# Segment the tier='public' cohort into the four reactivation buckets used
# by the campaign (unverified / founding-eligible / churned / verified-
# never-paid). Default prints counts + a one-line copy hint per cohort.
# Pass EMAILS=1 for a paste-ready recipient list, COHORT=<name> to filter
# to one segment (e.g. COHORT=founding-eligible EMAILS=1), SHOW_LAST_LOGIN=1
# to further split each cohort into warm/cold/never by latest login_success
# audit row, and WARM_DAYS=<n> to tune the warm threshold (default 30).
public-cohort:
	@cd frontend && bash -lc 'source $$HOME/.nvm/nvm.sh && nvm use 22 >/dev/null && node --no-warnings scripts/list-public-cohort.mjs $(if $(EMAILS),--emails,) $(if $(COHORT),--cohort $(COHORT),) $(if $(SHOW_LAST_LOGIN),--show-last-login,) $(if $(WARM_DAYS),--warm-days $(WARM_DAYS),)'

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
